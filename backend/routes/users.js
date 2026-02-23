const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/users
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        let sql = `
            SELECT u.uid, u.username, u.email, u.status,
                   u.created_at, u.approved_at,
                   a.username as approved_by_username
            FROM users u
            LEFT JOIN admins a ON u.approved_by = a.id
        `;
        const params = [];

        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            sql += ` WHERE u.status = $1`;
            params.push(status);
        }

        sql += ` ORDER BY
            CASE u.status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 WHEN 'rejected' THEN 3 END,
            u.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(sql, params);

        const countsResult = await query(
            `SELECT status, COUNT(*)::int as count FROM users GROUP BY status`
        );

        const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
        countsResult.rows.forEach(r => {
            counts[r.status] = r.count;
            counts.total += r.count;
        });

        // Get pending reset count
        const resetsResult = await query(
            "SELECT COUNT(*)::int as count FROM password_resets WHERE status = 'pending'"
        );
        counts.pendingResets = resetsResult.rows[0].count;

        res.json({
            users: result.rows.map(u => ({
                uid: u.uid,
                username: u.username,
                email: u.email,
                status: u.status,
                createdAt: u.created_at,
                approvedAt: u.approved_at,
                approvedBy: u.approved_by_username
            })),
            counts
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// GET /api/users/reset-requests - List pending password reset requests
router.get('/reset-requests', async (req, res) => {
    try {
        const result = await query(`
            SELECT pr.id, pr.created_at, pr.status,
                   u.uid as user_uid, u.username, u.email
            FROM password_resets pr
            JOIN users u ON pr.user_id = u.id
            WHERE pr.status = 'pending'
            ORDER BY pr.created_at DESC
        `);
        res.json(result.rows.map(r => ({
            id: r.id,
            userUid: r.user_uid,
            username: r.username,
            email: r.email,
            createdAt: r.created_at
        })));
    } catch (error) {
        console.error('Get reset requests error:', error);
        res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
});

// PUT /api/users/:uid/reset-password - Admin sets new password for user
router.put('/:uid/reset-password', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Contrasena debe tener al menos 6 caracteres' });
        }

        const user = await query('SELECT id, username FROM users WHERE uid = $1', [req.params.uid]);
        if (user.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        const hash = await bcrypt.hash(password, 10);
        await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hash, user.rows[0].id]);

        // Mark any pending resets as completed
        await query("UPDATE password_resets SET status = 'completed' WHERE user_id = $1 AND status = 'pending'",
            [user.rows[0].id]);

        res.json({ message: `Contrasena de ${user.rows[0].username} actualizada` });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Error al resetear contrasena' });
    }
});

// PUT /api/users/:uid/approve
router.put('/:uid/approve', async (req, res) => {
    try {
        const result = await query(
            `UPDATE users SET status = 'approved', approved_at = CURRENT_TIMESTAMP,
             approved_by = $1, updated_at = CURRENT_TIMESTAMP
             WHERE uid = $2 RETURNING uid, username, status`,
            [req.admin.id, req.params.uid]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ message: 'Usuario aprobado', user: result.rows[0] });
    } catch (error) {
        console.error('Approve user error:', error);
        res.status(500).json({ error: 'Error al aprobar usuario' });
    }
});

// PUT /api/users/:uid/reject
router.put('/:uid/reject', async (req, res) => {
    try {
        const result = await query(
            `UPDATE users SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
             WHERE uid = $1 RETURNING uid, username, status`,
            [req.params.uid]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ message: 'Usuario rechazado', user: result.rows[0] });
    } catch (error) {
        console.error('Reject user error:', error);
        res.status(500).json({ error: 'Error al rechazar usuario' });
    }
});

// DELETE /api/users/:uid
router.delete('/:uid', async (req, res) => {
    try {
        const result = await query(
            'DELETE FROM users WHERE uid = $1 RETURNING username',
            [req.params.uid]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ message: `Usuario ${result.rows[0].username} eliminado` });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

module.exports = router;
