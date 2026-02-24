const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username y password requeridos' });
        }

        const result = await query(
            'SELECT id, uid, username, email, password_hash, failed_attempts, locked_until FROM admins WHERE username = $1 OR email = $1',
            [username]
        );

        // Dummy hash to prevent timing attacks when user not found
        const dummyHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';

        if (result.rows.length === 0) {
            await bcrypt.compare(password, dummyHash);
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        const admin = result.rows[0];

        // Check account lockout
        if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
            const mins = Math.ceil((new Date(admin.locked_until) - new Date()) / 60000);
            return res.status(423).json({ error: `Cuenta bloqueada. Intenta en ${mins} minutos.` });
        }

        const valid = await bcrypt.compare(password, admin.password_hash);
        if (!valid) {
            const attempts = (admin.failed_attempts || 0) + 1;
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                await query(
                    'UPDATE admins SET failed_attempts = $1, locked_until = CURRENT_TIMESTAMP + INTERVAL \'1 minute\' * $2 WHERE id = $3',
                    [attempts, LOCKOUT_MINUTES, admin.id]
                );
                return res.status(423).json({ error: `Cuenta bloqueada por ${LOCKOUT_MINUTES} minutos tras ${MAX_FAILED_ATTEMPTS} intentos fallidos.` });
            }
            await query('UPDATE admins SET failed_attempts = $1 WHERE id = $2', [attempts, admin.id]);
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        // Reset failed attempts on successful login
        if (admin.failed_attempts > 0) {
            await query('UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [admin.id]);
        }

        const token = generateToken(admin);
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 24h
            path: '/api'
        });
        res.json({
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

router.post('/logout', (req, res) => {
    res.clearCookie('admin_token', { path: '/api' });
    res.json({ message: 'Sesion cerrada' });
});

module.exports = router;
