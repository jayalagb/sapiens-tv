const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/tags - List all tags (public)
router.get('/', async (req, res) => {
    try {
        const result = await query(
            `SELECT t.id, t.name, COUNT(vt.video_id) as video_count
             FROM tags t
             LEFT JOIN video_tags vt ON t.id = vt.tag_id
             GROUP BY t.id, t.name
             ORDER BY t.name`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get tags error:', error);
        res.status(500).json({ error: 'Error al obtener tags' });
    }
});

// POST /api/tags - Create tag (admin)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nombre requerido' });
        }

        const result = await query(
            'INSERT INTO tags (name) VALUES ($1) RETURNING id, name',
            [name.trim().toLowerCase()]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Este tag ya existe' });
        }
        console.error('Create tag error:', error);
        res.status(500).json({ error: 'Error al crear tag' });
    }
});

// DELETE /api/tags/:id - Delete tag (admin)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query('DELETE FROM tags WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tag no encontrado' });
        }
        res.json({ message: 'Tag eliminado' });
    } catch (error) {
        console.error('Delete tag error:', error);
        res.status(500).json({ error: 'Error al eliminar tag' });
    }
});

module.exports = router;
