const geoip = require('geoip-lite');
const { query } = require('../config/database');

// Países permitidos (código ISO)
const ALLOWED_COUNTRIES = ['ES']; // España

// In-memory cache for geo-block setting
let geoBlockEnabled = null;

async function loadGeoBlockSetting() {
    try {
        const result = await query("SELECT value FROM settings WHERE key = 'geo_block_enabled'");
        if (result.rows.length > 0) {
            geoBlockEnabled = result.rows[0].value === 'true';
        } else {
            geoBlockEnabled = false;
        }
    } catch (err) {
        // Table may not exist yet — default to env var behavior
        geoBlockEnabled = null;
    }
    return geoBlockEnabled;
}

async function setGeoBlockEnabled(enabled) {
    const val = enabled ? 'true' : 'false';
    await query(
        `INSERT INTO settings (key, value, updated_at) VALUES ('geo_block_enabled', $1, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
        [val]
    );
    geoBlockEnabled = enabled;
}

// IPs que siempre están permitidas (localhost, Azure health checks, etc.)
const WHITELISTED_IPS = [
    '127.0.0.1',
    '::1',
    'localhost'
];

// Endpoints excluidos del geo-bloqueo (health checks, monitorización)
const EXCLUDED_PATHS = [
    '/api/health',
    '/health'
];

// Rangos de IP privadas (desarrollo local)
const isPrivateIP = (ip) => {
    if (!ip) return false;
    if (ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('172.16.') || ip.startsWith('172.17.') ||
        ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
        ip.startsWith('172.20.') || ip.startsWith('172.21.') ||
        ip.startsWith('172.22.') || ip.startsWith('172.23.') ||
        ip.startsWith('172.24.') || ip.startsWith('172.25.') ||
        ip.startsWith('172.26.') || ip.startsWith('172.27.') ||
        ip.startsWith('172.28.') || ip.startsWith('172.29.') ||
        ip.startsWith('172.30.') || ip.startsWith('172.31.')) {
        return true;
    }
    return false;
};

// Obtener IP real del cliente (considerando proxies/load balancers)
const getClientIP = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = forwarded.split(',').map(ip => ip.trim());
        return ips[0];
    }

    const realIP = req.headers['x-real-ip'] ||
                   req.headers['x-client-ip'] ||
                   req.connection?.remoteAddress ||
                   req.socket?.remoteAddress ||
                   req.ip;

    if (realIP === '::ffff:127.0.0.1') return '127.0.0.1';
    if (realIP?.startsWith('::ffff:')) return realIP.substring(7);

    return realIP;
};

// Middleware de geo-bloqueo
const geoBlock = async (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    // Env var override: if GEO_BLOCK_DISABLED=true, always skip
    if (process.env.GEO_BLOCK_DISABLED === 'true') {
        return next();
    }

    // Check DB setting (lazy-load on first request)
    if (geoBlockEnabled === null) {
        await loadGeoBlockSetting();
    }

    // If DB says geo-blocking is disabled, skip
    if (geoBlockEnabled === false) {
        return next();
    }

    if (EXCLUDED_PATHS.some(path => req.path === path || req.path.startsWith(path))) {
        return next();
    }

    const clientIP = getClientIP(req);

    if (WHITELISTED_IPS.includes(clientIP)) {
        return next();
    }

    if (isPrivateIP(clientIP)) {
        return next();
    }

    const geo = geoip.lookup(clientIP);

    if (!geo) {
        console.warn(`[GEO-BLOCK] IP sin ubicación bloqueada: ${clientIP}`);
        return res.status(403).json({
            error: {
                message: 'No se puede verificar tu ubicación',
                code: 'GEO_UNKNOWN'
            }
        });
    }

    if (!ALLOWED_COUNTRIES.includes(geo.country)) {
        console.warn(`[GEO-BLOCK] Acceso bloqueado: IP=${clientIP}, País=${geo.country}`);
        return res.status(403).json({
            error: {
                message: 'Acceso no permitido desde tu ubicación',
                code: 'GEO_BLOCKED'
            }
        });
    }

    console.log(`[GEO-ALLOW] Acceso desde España: IP=${clientIP}`);
    next();
};

module.exports = { geoBlock, getClientIP, ALLOWED_COUNTRIES, setGeoBlockEnabled, loadGeoBlockSetting };
