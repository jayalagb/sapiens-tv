const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Multer config for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'videos');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de video no soportado'));
        }
    }
});

// GET /api/videos - List videos (public)
router.get('/', async (req, res) => {
    try {
        const { tag, search, limit = 50, offset = 0 } = req.query;
        let sql, params;

        if (tag) {
            sql = `SELECT v.id, v.uid, v.title, v.description, v.video_url, v.thumbnail_url,
                          v.duration, v.views_count, v.sort_order, v.created_at
                   FROM videos v
                   JOIN video_tags vt ON v.id = vt.video_id
                   JOIN tags t ON vt.tag_id = t.id
                   WHERE t.name = $1
                   ORDER BY v.sort_order, v.created_at DESC
                   LIMIT $2 OFFSET $3`;
            params = [tag.toLowerCase(), limit, offset];
        } else if (search) {
            sql = `SELECT id, uid, title, description, video_url, thumbnail_url,
                          duration, views_count, sort_order, created_at
                   FROM videos
                   WHERE title ILIKE $1 OR description ILIKE $1
                   ORDER BY sort_order, created_at DESC
                   LIMIT $2 OFFSET $3`;
            params = [`%${search}%`, limit, offset];
        } else {
            sql = `SELECT id, uid, title, description, video_url, thumbnail_url,
                          duration, views_count, sort_order, created_at
                   FROM videos
                   ORDER BY sort_order, created_at DESC
                   LIMIT $1 OFFSET $2`;
            params = [limit, offset];
        }

        const result = await query(sql, params);

        // Get tags for each video
        const videos = await Promise.all(result.rows.map(async (video) => {
            const tagsResult = await query(
                `SELECT t.id, t.name FROM tags t
                 JOIN video_tags vt ON t.id = vt.tag_id
                 WHERE vt.video_id = $1`,
                [video.id]
            );
            return {
                uid: video.uid,
                title: video.title,
                description: video.description,
                videoUrl: video.video_url,
                thumbnailUrl: video.thumbnail_url,
                duration: video.duration,
                views: video.views_count,
                sortOrder: video.sort_order,
                tags: tagsResult.rows,
                createdAt: video.created_at
            };
        }));

        res.json(videos);
    } catch (error) {
        console.error('Get videos error:', error);
        res.status(500).json({ error: 'Error al obtener videos' });
    }
});

// GET /api/videos/:uid - Get single video (public)
router.get('/:uid', async (req, res) => {
    try {
        const result = await query(
            `SELECT id, uid, title, description, video_url, thumbnail_url,
                    duration, views_count, sort_order, created_at
             FROM videos WHERE uid = $1`,
            [req.params.uid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }

        const video = result.rows[0];
        const tagsResult = await query(
            `SELECT t.id, t.name FROM tags t
             JOIN video_tags vt ON t.id = vt.tag_id
             WHERE vt.video_id = $1`,
            [video.id]
        );

        res.json({
            uid: video.uid,
            title: video.title,
            description: video.description,
            videoUrl: video.video_url,
            thumbnailUrl: video.thumbnail_url,
            duration: video.duration,
            views: video.views_count,
            sortOrder: video.sort_order,
            tags: tagsResult.rows,
            createdAt: video.created_at
        });
    } catch (error) {
        console.error('Get video error:', error);
        res.status(500).json({ error: 'Error al obtener video' });
    }
});

// GET /api/videos/:uid/stream - Stream video with range support (public)
router.get('/:uid/stream', async (req, res) => {
    try {
        const result = await query('SELECT video_url FROM videos WHERE uid = $1', [req.params.uid]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }

        const videoPath = path.join(__dirname, '..', result.rows[0].video_url);
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        const stat = fs.statSync(videoPath);
        const fileSize = stat.size;
        const ext = path.extname(videoPath).toLowerCase();
        const mimeTypes = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
        const contentType = mimeTypes[ext] || 'video/mp4';

        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            const stream = fs.createReadStream(videoPath, { start, end });
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType
            });
            stream.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType
            });
            fs.createReadStream(videoPath).pipe(res);
        }
    } catch (error) {
        console.error('Stream error:', error);
        res.status(500).json({ error: 'Error al reproducir video' });
    }
});

// POST /api/videos/:uid/view - Increment view count (public)
router.post('/:uid/view', async (req, res) => {
    try {
        await query('UPDATE videos SET views_count = views_count + 1 WHERE uid = $1', [req.params.uid]);
        res.json({ message: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Error' });
    }
});

// POST /api/videos - Upload video (admin)
router.post('/', authenticateToken, upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Video requerido' });
        }

        const { title, description, tags } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Titulo requerido' });
        }

        const uid = uuidv4();
        const videoUrl = `/uploads/videos/${req.file.filename}`;

        // Get max sort_order
        const maxOrder = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM videos');
        const sortOrder = maxOrder.rows[0].next_order;

        const result = await query(
            `INSERT INTO videos (uid, title, description, video_url, sort_order, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, uid, title, description, video_url, sort_order, created_at`,
            [uid, title, description || '', videoUrl, sortOrder, req.admin.id]
        );

        const video = result.rows[0];

        // Add tags if provided
        if (tags) {
            const tagIds = JSON.parse(tags);
            for (const tagId of tagIds) {
                await query('INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [video.id, tagId]);
            }
        }

        res.status(201).json({
            uid: video.uid,
            title: video.title,
            description: video.description,
            videoUrl: video.video_url,
            sortOrder: video.sort_order,
            createdAt: video.created_at
        });
    } catch (error) {
        console.error('Upload video error:', error);
        res.status(500).json({ error: 'Error al subir video' });
    }
});

// PUT /api/videos/reorder - Reorder videos (admin) - MUST be before /:uid
router.put('/reorder', authenticateToken, async (req, res) => {
    try {
        const { order } = req.body; // [{ uid, sortOrder }, ...]
        if (!Array.isArray(order)) {
            return res.status(400).json({ error: 'Array de orden requerido' });
        }

        for (const item of order) {
            await query('UPDATE videos SET sort_order = $1 WHERE uid = $2', [item.sortOrder, item.uid]);
        }

        res.json({ message: 'Orden actualizado' });
    } catch (error) {
        console.error('Reorder error:', error);
        res.status(500).json({ error: 'Error al reordenar' });
    }
});

// PUT /api/videos/:uid - Edit video (admin)
router.put('/:uid', authenticateToken, async (req, res) => {
    try {
        const { title, description, tags } = req.body;

        const result = await query(
            `UPDATE videos SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                updated_at = CURRENT_TIMESTAMP
             WHERE uid = $3
             RETURNING id, uid, title, description, video_url, sort_order`,
            [title, description, req.params.uid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }

        const video = result.rows[0];

        // Update tags if provided
        if (tags !== undefined) {
            await query('DELETE FROM video_tags WHERE video_id = $1', [video.id]);
            const tagIds = Array.isArray(tags) ? tags : JSON.parse(tags);
            for (const tagId of tagIds) {
                await query('INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [video.id, tagId]);
            }
        }

        res.json({ message: 'Video actualizado', uid: video.uid });
    } catch (error) {
        console.error('Update video error:', error);
        res.status(500).json({ error: 'Error al actualizar video' });
    }
});

// DELETE /api/videos/:uid - Delete video (admin)
router.delete('/:uid', authenticateToken, async (req, res) => {
    try {
        const result = await query('SELECT id, video_url FROM videos WHERE uid = $1', [req.params.uid]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }

        // Delete file
        const filePath = path.join(__dirname, '..', result.rows[0].video_url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await query('DELETE FROM videos WHERE id = $1', [result.rows[0].id]);
        res.json({ message: 'Video eliminado' });
    } catch (error) {
        console.error('Delete video error:', error);
        res.status(500).json({ error: 'Error al eliminar video' });
    }
});

module.exports = router;
