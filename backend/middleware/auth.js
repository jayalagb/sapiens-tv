const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'sesamotv-dev-secret');
const JWT_SECRET_USER = process.env.JWT_SECRET_USER || (process.env.NODE_ENV === 'production' ? null : 'sesamotv-dev-user-secret');
if (!JWT_SECRET || !JWT_SECRET_USER) {
    throw new Error('JWT_SECRET and JWT_SECRET_USER environment variables are required in production');
}

function generateToken(admin) {
    return jwt.sign(
        { id: admin.id, uid: admin.uid, username: admin.username, type: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function generateUserToken(user) {
    return jwt.sign(
        { id: user.id, uid: user.uid, username: user.username, type: 'user' },
        JWT_SECRET_USER,
        { expiresIn: '7d' }
    );
}

function generateStreamToken(payload, videoUid) {
    return jwt.sign(
        { uid: payload.uid, videoUid, purpose: 'stream', type: payload.type || 'user' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

function verifyAdminToken(token) {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'admin') {
        throw new Error('Not an admin token');
    }
    return decoded;
}

function verifyUserToken(token) {
    const decoded = jwt.verify(token, JWT_SECRET_USER);
    if (decoded.type !== 'user') {
        throw new Error('Not a user token');
    }
    return decoded;
}

function verifyStreamToken(token) {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'stream') {
        throw new Error('Not a stream token');
    }
    return decoded;
}

function extractAdminToken(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader) return authHeader.split(' ')[1];
    // Fallback: read from HttpOnly cookie
    const cookies = req.headers.cookie;
    if (cookies) {
        const match = cookies.split(';').map(c => c.trim()).find(c => c.startsWith('admin_token='));
        if (match) return match.split('=')[1];
    }
    return null;
}

function authenticateToken(req, res, next) {
    const token = extractAdminToken(req);

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    try {
        req.admin = verifyAdminToken(token);
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token invalido' });
    }
}

async function requireApprovedUser(req, res, next) {
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];

    // Try admin token first (from header or cookie)
    const adminToken = headerToken || extractAdminToken(req);
    if (adminToken) {
        try {
            req.admin = verifyAdminToken(adminToken);
            return next();
        } catch (err) {
            // Not an admin token, try user token
        }
    }

    const token = headerToken;
    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    try {
        const decoded = verifyUserToken(token);

        const result = await query(
            'SELECT id, uid, username, status FROM users WHERE uid = $1',
            [decoded.uid]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Usuario no encontrado' });
        }

        if (result.rows[0].status !== 'approved') {
            return res.status(403).json({ error: 'Cuenta pendiente de aprobacion', status: result.rows[0].status });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token invalido' });
    }
}

module.exports = { generateToken, authenticateToken, generateUserToken, generateStreamToken, verifyAdminToken, verifyUserToken, verifyStreamToken, requireApprovedUser };
