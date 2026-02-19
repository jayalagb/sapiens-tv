const jwt = require('jsonwebtoken');

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

module.exports = { generateToken, authenticateToken };
