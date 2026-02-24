const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateUserToken, verifyUserToken } = require('../middleware/auth');
const validatePassword = require('../utils/validatePassword');

const router = express.Router();

// POST /api/user-auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email invalido' });
        }

        const existing = await query(
            'SELECT username, email FROM users WHERE username = $1 OR email = $2',
            [username.trim(), email.trim().toLowerCase()]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'El usuario o email ya esta registrado' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await query(
            `INSERT INTO users (username, email, password_hash, status)
             VALUES ($1, $2, $3, 'pending')
             RETURNING uid, username, email, status, created_at`,
            [username.trim(), email.trim().toLowerCase(), passwordHash]
        );

        res.status(201).json({
            message: 'Registro exitoso. Tu cuenta esta pendiente de aprobacion.',
            user: {
                uid: result.rows[0].uid,
                username: result.rows[0].username,
                email: result.rows[0].email,
                status: result.rows[0].status
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'El usuario o email ya existe' });
        }
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// POST /api/user-auth/login
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contrasena requeridos' });
        }

        const result = await query(
            'SELECT id, uid, username, email, password_hash, status, failed_attempts, locked_until FROM users WHERE username = $1 OR email = $1',
            [username.trim()]
        );

        const dummyHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';

        if (result.rows.length === 0) {
            await bcrypt.compare(password, dummyHash);
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        const user = result.rows[0];

        // Check account lockout
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            return res.status(423).json({ error: `Cuenta bloqueada. Intenta en ${mins} minutos.` });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            const attempts = (user.failed_attempts || 0) + 1;
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                await query(
                    'UPDATE users SET failed_attempts = $1, locked_until = CURRENT_TIMESTAMP + INTERVAL \'1 minute\' * $2 WHERE id = $3',
                    [attempts, LOCKOUT_MINUTES, user.id]
                );
                return res.status(423).json({ error: `Cuenta bloqueada por ${LOCKOUT_MINUTES} minutos tras ${MAX_FAILED_ATTEMPTS} intentos fallidos.` });
            }
            await query('UPDATE users SET failed_attempts = $1 WHERE id = $2', [attempts, user.id]);
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        // Reset failed attempts on successful login
        if (user.failed_attempts > 0) {
            await query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
        }

        if (user.status === 'pending') {
            return res.status(403).json({ error: 'Tu cuenta esta pendiente de aprobacion', status: 'pending' });
        }

        if (user.status === 'rejected') {
            return res.status(403).json({ error: 'Tu cuenta ha sido rechazada', status: 'rejected' });
        }

        const token = generateUserToken(user);

        res.json({
            token,
            user: { uid: user.uid, username: user.username, email: user.email, status: user.status }
        });
    } catch (error) {
        console.error('User login error:', error);
        res.status(500).json({ error: 'Error al iniciar sesion' });
    }
});

// GET /api/user-auth/me
router.get('/me', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    try {
        const decoded = verifyUserToken(token);
        const result = await query(
            'SELECT uid, username, email, status, created_at FROM users WHERE uid = $1',
            [decoded.uid]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        return res.status(403).json({ error: 'Token invalido' });
    }
});

// POST /api/user-auth/reset-request
router.post('/reset-request', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email requerido' });

        const responseMsg = { message: 'Si el email existe, tu solicitud ha sido enviada al administrador.' };
        const minDelay = 200;
        const start = Date.now();

        const user = await query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
        if (user.rows.length > 0) {
            // Auto-expire old + insert atomically to prevent race conditions
            await query(
                "UPDATE password_resets SET status = 'completed' WHERE user_id = $1 AND status = 'pending' AND expires_at < CURRENT_TIMESTAMP",
                [user.rows[0].id]
            );
            await query(
                `INSERT INTO password_resets (user_id, expires_at)
                 SELECT $1, CURRENT_TIMESTAMP + INTERVAL '1 hour'
                 WHERE NOT EXISTS (
                     SELECT 1 FROM password_resets WHERE user_id = $1 AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP
                 )`,
                [user.rows[0].id]
            );
        }

        // Constant-time delay to prevent email enumeration via timing
        const elapsed = Date.now() - start;
        if (elapsed < minDelay) {
            await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
        }
        res.json(responseMsg);
    } catch (error) {
        console.error('Reset request error:', error);
        res.status(500).json({ error: 'Error al procesar solicitud' });
    }
});

module.exports = router;
