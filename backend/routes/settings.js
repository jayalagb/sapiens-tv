const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { setGeoBlockEnabled } = require('../middleware/geoBlock');

const router = express.Router();

// All settings routes require admin auth
router.use(authenticateToken);

// GET /api/settings - Return all settings
router.get('/', async (req, res) => {
    try {
        const result = await query('SELECT key, value, updated_at FROM settings ORDER BY key');
        const settings = {};
        for (const row of result.rows) {
            settings[row.key] = row.value;
        }
        res.json(settings);
    } catch (err) {
        console.error('Error fetching settings:', err);
        res.status(500).json({ error: 'Error al obtener ajustes' });
    }
});

// PUT /api/settings/geo-blocking - Toggle geo-blocking
router.put('/geo-blocking', async (req, res) => {
    try {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'Campo "enabled" (boolean) requerido' });
        }
        await setGeoBlockEnabled(enabled);
        res.json({ geo_block_enabled: enabled });
    } catch (err) {
        console.error('Error updating geo-blocking:', err);
        res.status(500).json({ error: 'Error al actualizar ajuste' });
    }
});

module.exports = router;
