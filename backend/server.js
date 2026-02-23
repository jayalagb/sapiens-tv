const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { geoBlock } = require('./middleware/geoBlock');
const authRoutes = require('./routes/auth');
const userAuthRoutes = require('./routes/userAuth');
const usersRoutes = require('./routes/users');
const videoRoutes = require('./routes/videos');
const tagRoutes = require('./routes/tags');

const app = express();
const PORT = process.env.PORT || 4000;

// Security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true }
        : false
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:4000'];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, same-origin)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS no permitido'));
        }
    }
}));

// Rate limiting - global
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Demasiadas peticiones' }
}));

// Rate limiting - auth endpoints (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos. Intenta de nuevo mas tarde.' }
});
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Demasiados registros. Intenta de nuevo mas tarde.' }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Geo-blocking (solo permite acceso desde España en producción)
app.use(geoBlock);

// API routes
app.use('/api/auth/login', authLimiter);
app.use('/api/user-auth/login', authLimiter);
app.use('/api/user-auth/register', registerLimiter);
app.use('/api/user-auth/reset-request', registerLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/user-auth', userAuthRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/tags', tagRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Archivo demasiado grande (max 500MB)' });
    }
    if (err.message === 'CORS no permitido') {
        return res.status(403).json({ error: 'Origen no permitido' });
    }
    res.status(500).json({ error: 'Error interno' });
});

app.listen(PORT, () => {
    console.log('='.repeat(40));
    console.log(`SesamoTV server running on port ${PORT}`);
    console.log(`Public: http://localhost:${PORT}`);
    console.log(`Admin:  http://localhost:${PORT}/admin`);
    console.log('='.repeat(40));
});
