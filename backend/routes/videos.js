const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { authenticateToken, requireApprovedUser, generateStreamToken, verifyStreamToken } = require('../middleware/auth');
const { uploadBlob, getBlobProperties, downloadBlobStream, deleteBlob } = require('../config/blobStorage');

const router = express.Router();

// Multer config: upload to temp directory, then move to blob storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
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
        const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext) && allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de video no soportado'));
        }
    }
});

// GET /api/videos - List videos (requires approved user)
router.get('/', requireApprovedUser, async (req, res) => {
    try {
        const { tag, search } = req.query;
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);
        let sql, params;

        if (tag) {
            sql = `SELECT v.id, v.uid, v.title, v.description, v.video_url, v.thumbnail_url,
                          v.duration, v.views_count, v.sort_order, v.rating, v.created_at
                   FROM videos v
                   JOIN video_tags vt ON v.id = vt.video_id
                   JOIN tags t ON vt.tag_id = t.id
                   WHERE t.name = $1
                   ORDER BY v.rating DESC, v.created_at DESC
                   LIMIT $2 OFFSET $3`;
            params = [tag.toLowerCase(), limit, offset];
        } else if (search) {
            sql = `SELECT id, uid, title, description, video_url, thumbnail_url,
                          duration, views_count, sort_order, rating, created_at
                   FROM videos
                   WHERE title ILIKE $1 OR description ILIKE $1
                   ORDER BY rating DESC, created_at DESC
                   LIMIT $2 OFFSET $3`;
            params = [`%${search}%`, limit, offset];
        } else {
            sql = `SELECT id, uid, title, description, video_url, thumbnail_url,
                          duration, views_count, sort_order, rating, created_at
                   FROM videos
                   ORDER BY rating DESC, created_at DESC
                   LIMIT $1 OFFSET $2`;
            params = [limit, offset];
        }

        const result = await query(sql, params);

        // Get user id for rating lookup (only for user tokens, not admin)
        let userId = null;
        if (req.user) {
            const userResult = await query('SELECT id FROM users WHERE uid = $1', [req.user.uid]);
            if (userResult.rows.length > 0) userId = userResult.rows[0].id;
        }

        // Get tags and user rating for each video
        const videos = await Promise.all(result.rows.map(async (video) => {
            const tagsResult = await query(
                `SELECT t.id, t.name FROM tags t
                 JOIN video_tags vt ON t.id = vt.tag_id
                 WHERE vt.video_id = $1`,
                [video.id]
            );

            let userRating = null;
            if (userId) {
                const ur = await query(
                    'SELECT rating FROM video_ratings WHERE user_id = $1 AND video_id = $2',
                    [userId, video.id]
                );
                if (ur.rows.length > 0) userRating = parseFloat(ur.rows[0].rating);
            }

            return {
                uid: video.uid,
                title: video.title,
                description: video.description,
                videoUrl: video.video_url,
                thumbnailUrl: video.thumbnail_url,
                duration: video.duration,
                views: video.views_count,
                sortOrder: video.sort_order,
                rating: parseFloat(video.rating) || 0,
                userRating,
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

// GET /api/videos/:uid - Get single video (requires approved user)
router.get('/:uid', requireApprovedUser, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, uid, title, description, video_url, thumbnail_url,
                    duration, views_count, sort_order, rating, created_at
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

        // Get user's own rating if authenticated as user
        let userRating = null;
        if (req.user) {
            const userResult = await query('SELECT id FROM users WHERE uid = $1', [req.user.uid]);
            if (userResult.rows.length > 0) {
                const ur = await query(
                    'SELECT rating FROM video_ratings WHERE user_id = $1 AND video_id = $2',
                    [userResult.rows[0].id, video.id]
                );
                if (ur.rows.length > 0) userRating = parseFloat(ur.rows[0].rating);
            }
        }

        res.json({
            uid: video.uid,
            title: video.title,
            description: video.description,
            videoUrl: video.video_url,
            thumbnailUrl: video.thumbnail_url,
            duration: video.duration,
            views: video.views_count,
            sortOrder: video.sort_order,
            rating: parseFloat(video.rating) || 0,
            userRating,
            tags: tagsResult.rows,
            createdAt: video.created_at
        });
    } catch (error) {
        console.error('Get video error:', error);
        res.status(500).json({ error: 'Error al obtener video' });
    }
});

// GET /api/videos/:uid/stream-token - Get a short-lived token for streaming
router.get('/:uid/stream-token', requireApprovedUser, async (req, res) => {
    try {
        const result = await query('SELECT uid FROM videos WHERE uid = $1', [req.params.uid]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }
        const payload = req.user || req.admin;
        const stoken = generateStreamToken(payload, req.params.uid);
        res.json({ stoken });
    } catch (error) {
        console.error('Stream token error:', error);
        res.status(500).json({ error: 'Error al generar token de streaming' });
    }
});

// GET /api/videos/:uid/stream - Stream video from Azure Blob (uses short-lived stream token via ?stoken=)
router.get('/:uid/stream', async (req, res) => {
    try {
        const stoken = req.query.stoken;
        if (!stoken) {
            return res.status(401).json({ error: 'Stream token requerido' });
        }

        let decoded;
        try {
            decoded = verifyStreamToken(stoken);
        } catch (err) {
            return res.status(403).json({ error: 'Stream token invalido o expirado' });
        }

        if (decoded.videoUid !== req.params.uid) {
            return res.status(403).json({ error: 'Stream token invalido para este video' });
        }

        // Verify user is still approved (not revoked since token was issued)
        if (decoded.type === 'user') {
            const userCheck = await query('SELECT status FROM users WHERE uid = $1', [decoded.uid]);
            if (userCheck.rows.length === 0 || userCheck.rows[0].status !== 'approved') {
                return res.status(403).json({ error: 'Usuario no autorizado' });
            }
        }

        const result = await query('SELECT video_url FROM videos WHERE uid = $1', [req.params.uid]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }

        const blobName = result.rows[0].video_url;
        const ext = path.extname(blobName).toLowerCase();
        const mimeTypes = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
        const contentType = mimeTypes[ext] || 'video/mp4';

        const properties = await getBlobProperties(blobName);
        const fileSize = properties.contentLength;

        const range = req.headers.range;
        if (range) {
            if (!/^bytes=\d+-\d*$/.test(range)) {
                return res.status(416).json({ error: 'Range invalido' });
            }
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start < 0 || start >= fileSize || end >= fileSize || start > end) {
                return res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` }).end();
            }

            const chunkSize = end - start + 1;
            const stream = await downloadBlobStream(blobName, start, chunkSize);
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType
            });
            stream.pipe(res);
        } else {
            const stream = await downloadBlobStream(blobName, 0);
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType
            });
            stream.pipe(res);
        }
    } catch (error) {
        console.error('Stream error:', error);
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Archivo no encontrado en storage' });
        }
        res.status(500).json({ error: 'Error al reproducir video' });
    }
});

// POST /api/videos/:uid/rate - Rate a video (requires approved user)
router.post('/:uid/rate', requireApprovedUser, async (req, res) => {
    try {
        const { rating } = req.body;
        const ratingVal = parseFloat(rating);
        if (isNaN(ratingVal) || ratingVal < 0 || ratingVal > 5) {
            return res.status(400).json({ error: 'Rating debe ser entre 0 y 5' });
        }

        // Get video id
        const videoResult = await query('SELECT id FROM videos WHERE uid = $1', [req.params.uid]);
        if (videoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }
        const videoId = videoResult.rows[0].id;

        // Get user id from DB (req.user has uid from JWT)
        const userResult = await query('SELECT id FROM users WHERE uid = $1', [req.user.uid]);
        if (userResult.rows.length === 0) {
            return res.status(403).json({ error: 'Usuario no encontrado' });
        }
        const userId = userResult.rows[0].id;

        // Upsert user rating
        await query(
            `INSERT INTO video_ratings (user_id, video_id, rating)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, video_id) DO UPDATE SET rating = $3`,
            [userId, videoId, ratingVal]
        );

        // Recalculate average and update videos.rating
        const avgResult = await query(
            'SELECT COALESCE(AVG(rating), 0) as avg_rating FROM video_ratings WHERE video_id = $1',
            [videoId]
        );
        const avgRating = parseFloat(parseFloat(avgResult.rows[0].avg_rating).toFixed(1));
        await query('UPDATE videos SET rating = $1 WHERE id = $2', [avgRating, videoId]);

        res.json({ rating: avgRating, userRating: ratingVal });
    } catch (error) {
        console.error('Rate video error:', error);
        res.status(500).json({ error: 'Error al puntuar video' });
    }
});

// POST /api/videos/:uid/view - Increment view count (requires approved user)
router.post('/:uid/view', requireApprovedUser, async (req, res) => {
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

        const { title, description, tags, rating } = req.body;
        if (!title || !title.trim()) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Titulo requerido' });
        }
        if (title.length > 255) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Titulo demasiado largo (max 255 caracteres)' });
        }
        if (description && description.length > 5000) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Descripcion demasiado larga (max 5000 caracteres)' });
        }

        const uid = uuidv4();
        const blobName = req.file.filename; // uuid.ext
        const videoRating = Math.min(5, Math.max(0, parseFloat(rating) || 0));

        // Upload to Azure Blob Storage
        await uploadBlob(blobName, req.file.path);

        // Delete temp file
        fs.unlinkSync(req.file.path);

        // Get max sort_order
        const maxOrder = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM videos');
        const sortOrder = maxOrder.rows[0].next_order;

        const result = await query(
            `INSERT INTO videos (uid, title, description, video_url, sort_order, rating, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, uid, title, description, video_url, sort_order, rating, created_at`,
            [uid, title, description || '', blobName, sortOrder, videoRating, req.admin.id]
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
            rating: parseFloat(video.rating) || 0,
            createdAt: video.created_at
        });
    } catch (error) {
        // Clean up temp file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
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
            const sortOrder = parseInt(item.sortOrder, 10);
            if (!item.uid || typeof item.uid !== 'string' || isNaN(sortOrder) || sortOrder < 0) {
                return res.status(400).json({ error: 'Datos de orden invalidos' });
            }
            await query('UPDATE videos SET sort_order = $1 WHERE uid = $2', [sortOrder, item.uid]);
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
        const { title, description, tags, rating } = req.body;
        if (title && title.length > 255) {
            return res.status(400).json({ error: 'Titulo demasiado largo (max 255 caracteres)' });
        }
        if (description && description.length > 5000) {
            return res.status(400).json({ error: 'Descripcion demasiado larga (max 5000 caracteres)' });
        }
        const videoRating = rating !== undefined ? Math.min(5, Math.max(0, parseFloat(rating) || 0)) : undefined;

        const result = await query(
            `UPDATE videos SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                rating = COALESCE($4, rating),
                updated_at = CURRENT_TIMESTAMP
             WHERE uid = $3
             RETURNING id, uid, title, description, video_url, sort_order, rating`,
            [title, description, req.params.uid, videoRating]
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

        // Delete blob from Azure Storage
        await deleteBlob(result.rows[0].video_url);

        await query('DELETE FROM videos WHERE id = $1', [result.rows[0].id]);
        res.json({ message: 'Video eliminado' });
    } catch (error) {
        console.error('Delete video error:', error);
        res.status(500).json({ error: 'Error al eliminar video' });
    }
});

module.exports = router;
