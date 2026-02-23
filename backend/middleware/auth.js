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

function verifyToken(token) {
    // Try admin/stream secret first, then user secret
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return jwt.verify(token, JWT_SECRET_USER);
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    try {
        const decoded = verifyToken(token);
        if (decoded.type !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token invalido' });
    }
}

async function requireApprovedUser(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    try {
        const decoded = verifyToken(token);

        if (decoded.type === 'admin') {
            req.admin = decoded;
            return next();
        }

        if (decoded.type !== 'user') {
            return res.status(403).json({ error: 'Token invalido' });
        }

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

module.exports = { generateToken, authenticateToken, generateUserToken, generateStreamToken, verifyToken, requireApprovedUser };
