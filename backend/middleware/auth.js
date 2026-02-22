const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'sesamotv-dev-secret';

function generateToken(admin) {
    return jwt.sign(
        { id: admin.id, uid: admin.uid, username: admin.username },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    try {
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token invalido' });
    }
}

function generateUserToken(user) {
    return jwt.sign(
        { id: user.id, uid: user.uid, username: user.username, type: 'user' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

async function requireApprovedUser(req, res, next) {
    // Accept token from header or query param (needed for <video src>)
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Admin tokens pass through (no type field = admin)
        if (!decoded.type) {
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

module.exports = { generateToken, authenticateToken, generateUserToken, requireApprovedUser };
