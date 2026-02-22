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
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());

// Rate limiting
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    message: { error: 'Demasiadas peticiones' }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Geo-blocking (solo permite acceso desde España en producción)
app.use(geoBlock);

// API routes
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
    res.status(500).json({ error: err.message || 'Error interno' });
});

app.listen(PORT, () => {
    console.log('='.repeat(40));
    console.log(`SesamoTV server running on port ${PORT}`);
    console.log(`Public: http://localhost:${PORT}`);
    console.log(`Admin:  http://localhost:${PORT}/admin`);
    console.log('='.repeat(40));
});
