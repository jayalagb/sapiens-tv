const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username y password requeridos' });
        }

        const result = await query(
            'SELECT id, uid, username, email, password_hash FROM admins WHERE username = $1 OR email = $1',
            [username]
        );

        // Dummy hash to prevent timing attacks when user not found
        const dummyHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';

        if (result.rows.length === 0) {
            await bcrypt.compare(password, dummyHash);
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        const admin = result.rows[0];
        const valid = await bcrypt.compare(password, admin.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        const token = generateToken(admin);
        res.json({
            token,
            admin: {
                uid: admin.uid,
                username: admin.username,
                email: admin.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT uid, username, email FROM admins WHERE uid = $1',
            [req.admin.uid]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Admin no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
