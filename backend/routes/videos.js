const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { authenticateToken, requireApprovedUser, verifyStreamToken } = require('../middleware/auth');
const { uploadBlob, getBlobProperties, downloadBlobStream, deleteBlob, generateSasUrl } = require('../config/blobStorage');
const { generateThumbnail } = require('../utils/thumbnail');

const rateLimit = require('express-rate-limit');

const router = express.Router();

async function auditLog(req, action, targetType, targetId, details) {
    try {
        const adminId = req.admin?.id || null;
        const ip = req.ip || req.headers['x-forwarded-for'] || null;
        await query(
            `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip_addr)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [adminId, action, targetType, targetId, details || null, ip]
        );
    } catch (e) {
        console.error('Audit log error (non-fatal):', e.message);
    }
}

const PROVINCIAS = [
    'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila',
    'Badajoz', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria',
    'Castellón', 'Ciudad Real', 'Córdoba', 'A Coruña', 'Cuenca', 'Girona',
    'Granada', 'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Illes Balears',
    'Jaén', 'León', 'Lleida', 'La Rioja', 'Lugo', 'Madrid', 'Málaga',
    'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Las Palmas', 'Pontevedra',
    'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria',
    'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Bizkaia',
    'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'
];

const videoActionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo mas tarde.' }
});

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

// Validate video file magic bytes to prevent disguised uploads
function isValidVideoMagicBytes(filePath) {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    // MP4 / MOV / M4V: 'ftyp' box at offset 4
    if (buf.slice(4, 8).toString('ascii') === 'ftyp') return true;
    // MP4 fallback: 'moov' or 'mdat' or 'free' at offset 4 (unusual but valid)
    const box4 = buf.slice(4, 8).toString('ascii');
    if (['moov', 'mdat', 'free', 'skip', 'wide'].includes(box4)) return true;
    // WebM / MKV: EBML header 0x1A 0x45 0xDF 0xA3
    if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return true;
    // AVI: RIFF....AVI
    if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 11).toString('ascii') === 'AVI') return true;

    return false;
}

// Transform thumbnail blob name to API URL
function thumbnailApiUrl(video) {
    return video.thumbnail_url ? `/api/videos/${video.uid}/thumbnail` : null;
}

// GET /api/videos - List videos (requires approved user)
router.get('/', requireApprovedUser, async (req, res) => {
    try {
        // Free-tier short-circuit: return top 3 by views + top 1 by likes
        if (req.query.free_tier === 'true') {
            const top3 = await query(
                `SELECT id, uid, title, description, video_url, thumbnail_url,
                        duration, views_count, sort_order, likes_count, location, university, created_at
                 FROM videos ORDER BY views_count DESC LIMIT 3`
            );
            const top3ids = top3.rows.map(r => r.id);
            const top1 = await query(
                `SELECT id, uid, title, description, video_url, thumbnail_url,
                        duration, views_count, sort_order, likes_count, location, university, created_at
                 FROM videos WHERE id != ALL($1) ORDER BY likes_count DESC LIMIT 1`,
                [top3ids]
            );
            const freeRows = [...top3.rows, ...top1.rows];

            let userId = null;
            if (req.user) {
                const userResult = await query('SELECT id FROM users WHERE uid = $1', [req.user.uid]);
                if (userResult.rows.length > 0) userId = userResult.rows[0].id;
            }

            const freeVideos = await Promise.all(freeRows.map(async (video) => {
                const tagsResult = await query(
                    `SELECT t.id, t.name FROM tags t
                     JOIN video_tags vt ON t.id = vt.tag_id
                     WHERE vt.video_id = $1`,
                    [video.id]
                );
                let userLiked = false;
                if (userId) {
                    const ul = await query(
                        'SELECT id FROM video_likes WHERE user_id = $1 AND video_id = $2',
                        [userId, video.id]
                    );
                    userLiked = ul.rows.length > 0;
                }
                return {
                    uid: video.uid,
                    title: video.title,
                    description: video.description,
                    videoUrl: video.video_url,
                    thumbnailUrl: thumbnailApiUrl(video),
                    duration: video.duration,
                    views: video.views_count,
                    sortOrder: video.sort_order,
                    likes: video.likes_count || 0,
                    userLiked,
                    location: video.location || '',
                    university: video.university || '',
                    tags: tagsResult.rows,
                    createdAt: video.created_at
                };
            }));

            return res.json(freeVideos);
        }

        const { tag, tags: tagsParam, search, location: locationParam, university: universityParam } = req.query;
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);
        let sql, params;

        // Parse multi-value location/university filters
        const locationFilter = locationParam ? locationParam.split(',').map(l => l.trim()).filter(Boolean) : [];
        const universityFilter = universityParam ? universityParam.split(',').map(u => u.trim()).filter(Boolean) : [];

        // Build location/university WHERE clauses
        const extraConditions = [];
        const extraParams = [];
        if (locationFilter.length > 0) {
            extraParams.push(locationFilter);
            extraConditions.push(`v.location = ANY($${extraParams.length + (tagsParam ? 4 : tag ? 3 : (search ? 3 : 2))})`);
        }
        if (universityFilter.length > 0) {
            extraParams.push(universityFilter);
            extraConditions.push(`v.university = ANY($${extraParams.length + (tagsParam ? 4 : tag ? 3 : (search ? 3 : 2))})`);
        }

        if (tagsParam) {
            const tagNames = tagsParam.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
            const locIdx = locationFilter.length > 0 ? 5 : null;
            const univIdx = universityFilter.length > 0 ? (locIdx ? 6 : 5) : null;
            const whereExtra = [
                locIdx ? `v.location = ANY($${locIdx})` : null,
                univIdx ? `v.university = ANY($${univIdx})` : null
            ].filter(Boolean);
            const havingClause = `HAVING COUNT(DISTINCT t.id) = $2`;
            sql = `SELECT v.id, v.uid, v.title, v.description, v.video_url, v.thumbnail_url,
                          v.duration, v.views_count, v.sort_order, v.likes_count, v.location, v.university, v.created_at
                   FROM videos v
                   JOIN video_tags vt ON v.id = vt.video_id
                   JOIN tags t ON vt.tag_id = t.id
                   WHERE t.name = ANY($1)${whereExtra.length > 0 ? ' AND ' + whereExtra.join(' AND ') : ''}
                   GROUP BY v.id
                   ${havingClause}
                   ORDER BY v.likes_count DESC, v.created_at DESC
                   LIMIT $3 OFFSET $4`;
            params = [tagNames, tagNames.length, limit, offset,
                      ...(locationFilter.length > 0 ? [locationFilter] : []),
                      ...(universityFilter.length > 0 ? [universityFilter] : [])];
        } else if (tag) {
            const locIdx = locationFilter.length > 0 ? 4 : null;
            const univIdx = universityFilter.length > 0 ? (locIdx ? 5 : 4) : null;
            const whereExtra = [
                locIdx ? `v.location = ANY($${locIdx})` : null,
                univIdx ? `v.university = ANY($${univIdx})` : null
            ].filter(Boolean);
            sql = `SELECT v.id, v.uid, v.title, v.description, v.video_url, v.thumbnail_url,
                          v.duration, v.views_count, v.sort_order, v.likes_count, v.location, v.university, v.created_at
                   FROM videos v
                   JOIN video_tags vt ON v.id = vt.video_id
                   JOIN tags t ON vt.tag_id = t.id
                   WHERE t.name = $1${whereExtra.length > 0 ? ' AND ' + whereExtra.join(' AND ') : ''}
                   ORDER BY v.likes_count DESC, v.created_at DESC
                   LIMIT $2 OFFSET $3`;
            params = [tag.toLowerCase(), limit, offset,
                      ...(locationFilter.length > 0 ? [locationFilter] : []),
                      ...(universityFilter.length > 0 ? [universityFilter] : [])];
        } else if (search) {
            const escapedSearch = search.replace(/[%_\\]/g, '\\$&');
            const locIdx = locationFilter.length > 0 ? 4 : null;
            const univIdx = universityFilter.length > 0 ? (locIdx ? 5 : 4) : null;
            const whereExtra = [
                locIdx ? `location = ANY($${locIdx})` : null,
                univIdx ? `university = ANY($${univIdx})` : null
            ].filter(Boolean);
            sql = `SELECT id, uid, title, description, video_url, thumbnail_url,
                          duration, views_count, sort_order, likes_count, location, university, created_at
                   FROM videos
                   WHERE (title ILIKE $1 ESCAPE '\\' OR description ILIKE $1 ESCAPE '\\')${whereExtra.length > 0 ? ' AND ' + whereExtra.join(' AND ') : ''}
                   ORDER BY likes_count DESC, created_at DESC
                   LIMIT $2 OFFSET $3`;
            params = [`%${escapedSearch}%`, limit, offset,
                      ...(locationFilter.length > 0 ? [locationFilter] : []),
                      ...(universityFilter.length > 0 ? [universityFilter] : [])];
        } else {
            const locIdx = locationFilter.length > 0 ? 3 : null;
            const univIdx = universityFilter.length > 0 ? (locIdx ? 4 : 3) : null;
            const whereExtra = [
                locIdx ? `location = ANY($${locIdx})` : null,
                univIdx ? `university = ANY($${univIdx})` : null
            ].filter(Boolean);
            sql = `SELECT id, uid, title, description, video_url, thumbnail_url,
                          duration, views_count, sort_order, likes_count, location, university, created_at
                   FROM videos
                   ${whereExtra.length > 0 ? 'WHERE ' + whereExtra.join(' AND ') : ''}
                   ORDER BY likes_count DESC, created_at DESC
                   LIMIT $1 OFFSET $2`;
            params = [limit, offset,
                      ...(locationFilter.length > 0 ? [locationFilter] : []),
                      ...(universityFilter.length > 0 ? [universityFilter] : [])];
        }

        const result = await query(sql, params);

        // Get user id for like lookup (only for user tokens, not admin)
        let userId = null;
        if (req.user) {
            const userResult = await query('SELECT id FROM users WHERE uid = $1', [req.user.uid]);
            if (userResult.rows.length > 0) userId = userResult.rows[0].id;
        }

        // Get tags and userLiked for each video
        const videos = await Promise.all(result.rows.map(async (video) => {
            const tagsResult = await query(
                `SELECT t.id, t.name FROM tags t
                 JOIN video_tags vt ON t.id = vt.tag_id
                 WHERE vt.video_id = $1`,
                [video.id]
            );

            let userLiked = false;
            if (userId) {
                const ul = await query(
                    'SELECT id FROM video_likes WHERE user_id = $1 AND video_id = $2',
                    [userId, video.id]
                );
                userLiked = ul.rows.length > 0;
            }

            return {
                uid: video.uid,
                title: video.title,
                description: video.description,
                videoUrl: video.video_url,
                thumbnailUrl: thumbnailApiUrl(video),
                duration: video.duration,
                views: video.views_count,
                sortOrder: video.sort_order,
                likes: video.likes_count || 0,
                userLiked,
                location: video.location || '',
                university: video.university || '',
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

// GET /api/videos/filters - Get available filter values with counts (requires approved user)
// MUST be registered before /:uid to avoid route conflict
router.get('/filters', requireApprovedUser, async (req, res) => {
    try {
        const [locResult, univResult] = await Promise.all([
            query(`SELECT location AS name, COUNT(*)::int AS count FROM videos
                   WHERE location != '' GROUP BY location ORDER BY location`),
            query(`SELECT university AS name, COUNT(*)::int AS count FROM videos
                   WHERE university != '' GROUP BY university ORDER BY university`)
        ]);
        res.json({
            locations: locResult.rows,
            universities: univResult.rows
        });
    } catch (error) {
        console.error('Get filters error:', error);
        res.status(500).json({ error: 'Error al obtener filtros' });
    }
});

// GET /api/videos/:uid - Get single video (requires approved user)
router.get('/:uid', requireApprovedUser, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, uid, title, description, video_url, thumbnail_url,
                    duration, views_count, sort_order, likes_count, location, university, created_at
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

        // Get user's like status if authenticated as user
        let userLiked = false;
        if (req.user) {
            const userResult = await query('SELECT id FROM users WHERE uid = $1', [req.user.uid]);
            if (userResult.rows.length > 0) {
                const ul = await query(
                    'SELECT id FROM video_likes WHERE user_id = $1 AND video_id = $2',
                    [userResult.rows[0].id, video.id]
                );
                userLiked = ul.rows.length > 0;
            }
        }

        res.json({
            uid: video.uid,
            title: video.title,
            description: video.description,
            videoUrl: video.video_url,
            thumbnailUrl: thumbnailApiUrl(video),
            duration: video.duration,
            views: video.views_count,
            sortOrder: video.sort_order,
            likes: video.likes_count || 0,
            userLiked,
            location: video.location || '',
            university: video.university || '',
            tags: tagsResult.rows,
            createdAt: video.created_at
        });
    } catch (error) {
        console.error('Get video error:', error);
        res.status(500).json({ error: 'Error al obtener video' });
    }
});

// GET /api/videos/:uid/thumbnail - Serve thumbnail image (no auth required)
router.get('/:uid/thumbnail', async (req, res) => {
    try {
        const result = await query('SELECT thumbnail_url FROM videos WHERE uid = $1', [req.params.uid]);
        if (result.rows.length === 0 || !result.rows[0].thumbnail_url) {
            return res.status(404).json({ error: 'Thumbnail no encontrado' });
        }

        const blobName = result.rows[0].thumbnail_url;
        const stream = await downloadBlobStream(blobName, 0);

        res.set({
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=86400'
        });
        stream.pipe(res);
    } catch (error) {
        console.error('Thumbnail error:', error);
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Thumbnail no encontrado en storage' });
        }
        res.status(500).json({ error: 'Error al obtener thumbnail' });
    }
});

// GET /api/videos/:uid/stream-token - Get a SAS URL for direct streaming from Azure Blob Storage
router.get('/:uid/stream-token', videoActionLimiter, requireApprovedUser, async (req, res) => {
    try {
        const result = await query('SELECT video_url FROM videos WHERE uid = $1', [req.params.uid]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }
        const url = await generateSasUrl(result.rows[0].video_url, 20);
        res.json({ url });
    } catch (error) {
        console.error('Stream token error:', error);
        res.status(500).json({ error: 'Error al generar URL de streaming' });
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

        // Verify user/admin still exists and is authorized
        if (decoded.type === 'user') {
            const userCheck = await query('SELECT status FROM users WHERE uid = $1', [decoded.uid]);
            if (userCheck.rows.length === 0 || userCheck.rows[0].status !== 'approved') {
                return res.status(403).json({ error: 'Usuario no autorizado' });
            }
        } else if (decoded.type === 'admin') {
            const adminCheck = await query('SELECT id FROM admins WHERE uid = $1', [decoded.uid]);
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Admin no autorizado' });
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

// POST /api/videos/:uid/like - Toggle like on a video (requires approved user)
router.post('/:uid/like', videoActionLimiter, requireApprovedUser, async (req, res) => {
    try {
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

        // Check if already liked
        const existing = await query(
            'SELECT id FROM video_likes WHERE user_id = $1 AND video_id = $2',
            [userId, videoId]
        );

        let liked;
        if (existing.rows.length > 0) {
            // Unlike: remove and decrement
            await query('DELETE FROM video_likes WHERE user_id = $1 AND video_id = $2', [userId, videoId]);
            await query('UPDATE videos SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [videoId]);
            liked = false;
        } else {
            // Like: insert and increment
            await query('INSERT INTO video_likes (user_id, video_id) VALUES ($1, $2)', [userId, videoId]);
            await query('UPDATE videos SET likes_count = likes_count + 1 WHERE id = $1', [videoId]);
            liked = true;
        }

        const updatedVideo = await query('SELECT likes_count FROM videos WHERE id = $1', [videoId]);
        res.json({ liked, likes: updatedVideo.rows[0].likes_count });
    } catch (error) {
        console.error('Like video error:', error);
        res.status(500).json({ error: 'Error al dar like al video' });
    }
});

// POST /api/videos/:uid/view - Increment view count (requires approved user)
router.post('/:uid/view', videoActionLimiter, requireApprovedUser, async (req, res) => {
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

        // Validate actual file content via magic bytes
        if (!isValidVideoMagicBytes(req.file.path)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'El archivo no es un video valido' });
        }

        const { title, description, tags, location, university } = req.body;
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
        if (!location || !PROVINCIAS.includes(location)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Provincia invalida o no seleccionada' });
        }
        if (!university || !university.trim()) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Universidad requerida' });
        }
        if (university.trim().length > 50) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Universidad demasiado larga (max 50 caracteres)' });
        }

        const uid = uuidv4();
        const blobName = req.file.filename; // uuid.ext

        // Generate thumbnail before uploading video (non-fatal)
        let thumbnailBlobName = null;
        try {
            const thumbPath = await generateThumbnail(req.file.path);
            if (thumbPath) {
                thumbnailBlobName = `thumb_${uid}.jpg`;
                await uploadBlob(thumbnailBlobName, thumbPath);
                fs.unlinkSync(thumbPath);
            }
        } catch (thumbErr) {
            console.error('Thumbnail generation failed (non-fatal):', thumbErr.message);
        }

        // Upload video to Azure Blob Storage
        await uploadBlob(blobName, req.file.path);

        // Delete temp file
        fs.unlinkSync(req.file.path);

        // Get max sort_order
        const maxOrder = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM videos');
        const sortOrder = maxOrder.rows[0].next_order;

        const result = await query(
            `INSERT INTO videos (uid, title, description, video_url, thumbnail_url, sort_order, uploaded_by, location, university)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, uid, title, description, video_url, thumbnail_url, sort_order, likes_count, location, university, created_at`,
            [uid, title, description || '', blobName, thumbnailBlobName, sortOrder, req.admin.id, location, university.trim()]
        );

        const video = result.rows[0];

        // Add tags if provided
        if (tags) {
            let tagIds;
            try { tagIds = JSON.parse(tags); } catch { tagIds = []; }
            if (Array.isArray(tagIds) && tagIds.length > 0) {
                const validTags = await query('SELECT id FROM tags WHERE id = ANY($1)', [tagIds]);
                const validIds = validTags.rows.map(r => r.id);
                for (const tagId of validIds) {
                    await query('INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [video.id, tagId]);
                }
            }
        }

        await auditLog(req, 'upload_video', 'video', video.uid, `title: ${video.title}`);
        res.status(201).json({
            uid: video.uid,
            title: video.title,
            description: video.description,
            videoUrl: video.video_url,
            thumbnailUrl: thumbnailApiUrl(video),
            sortOrder: video.sort_order,
            likes: video.likes_count || 0,
            location: video.location || '',
            university: video.university || '',
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
        if (order.length > 500) {
            return res.status(400).json({ error: 'Demasiados elementos (max 500)' });
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
        const { title, description, tags, location, university } = req.body;
        if (title && title.length > 255) {
            return res.status(400).json({ error: 'Titulo demasiado largo (max 255 caracteres)' });
        }
        if (description && description.length > 5000) {
            return res.status(400).json({ error: 'Descripcion demasiado larga (max 5000 caracteres)' });
        }
        if (location !== undefined && location !== '' && !PROVINCIAS.includes(location)) {
            return res.status(400).json({ error: 'Provincia invalida' });
        }
        if (university !== undefined && university.trim().length > 50) {
            return res.status(400).json({ error: 'Universidad demasiado larga (max 50 caracteres)' });
        }
        const videoLocation = location !== undefined ? location : undefined;
        const videoUniversity = university !== undefined ? university.trim() : undefined;

        const result = await query(
            `UPDATE videos SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                location = COALESCE($4, location),
                university = COALESCE($5, university),
                updated_at = CURRENT_TIMESTAMP
             WHERE uid = $3
             RETURNING id, uid, title, description, video_url, sort_order, likes_count, location, university`,
            [title, description, req.params.uid, videoLocation, videoUniversity]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }

        const video = result.rows[0];

        // Update tags if provided
        if (tags !== undefined) {
            await query('DELETE FROM video_tags WHERE video_id = $1', [video.id]);
            const tagIds = Array.isArray(tags) ? tags : JSON.parse(tags);
            if (tagIds.length > 0) {
                const validTags = await query('SELECT id FROM tags WHERE id = ANY($1)', [tagIds]);
                const validIds = validTags.rows.map(r => r.id);
                for (const tagId of validIds) {
                    await query('INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [video.id, tagId]);
                }
            }
        }

        await auditLog(req, 'edit_video', 'video', video.uid, `title: ${video.title}`);
        res.json({ message: 'Video actualizado', uid: video.uid });
    } catch (error) {
        console.error('Update video error:', error);
        res.status(500).json({ error: 'Error al actualizar video' });
    }
});

// DELETE /api/videos/:uid - Delete video (admin)
router.delete('/:uid', authenticateToken, async (req, res) => {
    try {
        const result = await query('SELECT id, video_url, thumbnail_url FROM videos WHERE uid = $1', [req.params.uid]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }

        // Delete blobs from Azure Storage
        await deleteBlob(result.rows[0].video_url);
        if (result.rows[0].thumbnail_url) {
            await deleteBlob(result.rows[0].thumbnail_url);
        }

        await query('DELETE FROM videos WHERE id = $1', [result.rows[0].id]);
        await auditLog(req, 'delete_video', 'video', req.params.uid, null);
        res.json({ message: 'Video eliminado' });
    } catch (error) {
        console.error('Delete video error:', error);
        res.status(500).json({ error: 'Error al eliminar video' });
    }
});

module.exports = router;
