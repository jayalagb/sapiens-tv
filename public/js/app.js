let currentScreen = 'home';
let videos = [];
let tags = [];
let selectedTag = null;
let searchQuery = '';
let currentVideo = null;

async function init() {
    await loadTags();
    await loadVideos();
    render();
}

async function loadTags() {
    try {
        tags = await apiGetTags();
    } catch (e) {
        console.error('Error loading tags:', e);
        tags = [];
    }
}

async function loadVideos(params = {}) {
    try {
        videos = await apiGetVideos(params);
    } catch (e) {
        console.error('Error loading videos:', e);
        videos = [];
    }
}

function render() {
    const app = document.getElementById('app');
    if (currentScreen === 'player' && currentVideo) {
        app.innerHTML = renderPlayer();
    } else {
        app.innerHTML = renderHome();
    }
}

function renderHome() {
    return `
        <div class="container">
            <header class="header">
                <h1 class="logo">SesamoTV</h1>
            </header>

            <div class="search-bar">
                <input type="text" id="search-input" placeholder="Buscar videos..."
                       value="${searchQuery}" oninput="handleSearch(this.value)">
            </div>

            <div class="tags-bar">
                <button class="tag-chip ${!selectedTag ? 'active' : ''}" onclick="filterByTag(null)">Todos</button>
                ${tags.map(t => `
                    <button class="tag-chip ${selectedTag === t.name ? 'active' : ''}"
                            onclick="filterByTag('${t.name}')">${t.name} (${t.video_count})</button>
                `).join('')}
            </div>

            <div class="video-grid">
                ${videos.length === 0 ? '<p class="empty-msg">No hay videos disponibles</p>' :
                  videos.map(v => `
                    <div class="video-card" onclick="openVideo('${v.uid}')">
                        <div class="video-thumb">
                            ${v.thumbnailUrl ? `<img src="${v.thumbnailUrl}" alt="">` :
                              `<div class="thumb-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>`}
                            ${v.duration ? `<span class="duration">${formatDuration(v.duration)}</span>` : ''}
                        </div>
                        <div class="video-info">
                            <h3 class="video-title">${escapeHtml(v.title)}</h3>
                            <div class="video-meta">
                                <span>${v.views || 0} vistas</span>
                                <span>${timeAgo(v.createdAt)}</span>
                            </div>
                            <div class="video-tags">
                                ${(v.tags || []).map(t => `<span class="tag-badge">${t.name}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                  `).join('')}
            </div>
        </div>
    `;
}

function renderPlayer() {
    const v = currentVideo;
    return `
        <div class="container">
            <header class="header">
                <button class="back-btn" onclick="goHome()">&#8592; Volver</button>
                <h1 class="logo">SesamoTV</h1>
            </header>

            <div class="player-wrapper">
                <video id="video-player" controls playsinline autoplay
                       src="${getStreamUrl(v.uid)}">
                    Tu navegador no soporta video HTML5.
                </video>
            </div>

            <div class="video-details">
                <h2 class="video-detail-title">${escapeHtml(v.title)}</h2>
                <div class="video-meta">
                    <span>${v.views || 0} vistas</span>
                    <span>${timeAgo(v.createdAt)}</span>
                </div>
                ${v.description ? `<p class="video-description">${escapeHtml(v.description)}</p>` : ''}
                <div class="video-tags">
                    ${(v.tags || []).map(t => `<span class="tag-badge clickable" onclick="goHome(); filterByTag('${t.name}')">${t.name}</span>`).join('')}
                </div>
            </div>

            ${videos.length > 0 ? `
                <div class="related-section">
                    <h3>Mas videos</h3>
                    <div class="related-list">
                        ${videos.filter(rv => rv.uid !== v.uid).slice(0, 6).map(rv => `
                            <div class="related-card" onclick="openVideo('${rv.uid}')">
                                <div class="related-thumb">
                                    ${rv.thumbnailUrl ? `<img src="${rv.thumbnailUrl}" alt="">` :
                                      `<div class="thumb-placeholder small"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>`}
                                </div>
                                <div class="related-info">
                                    <div class="related-title">${escapeHtml(rv.title)}</div>
                                    <div class="related-meta">${rv.views || 0} vistas</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

async function openVideo(uid) {
    try {
        currentVideo = await apiGetVideo(uid);
        currentScreen = 'player';
        render();
        apiTrackView(uid);
    } catch (e) {
        console.error('Error opening video:', e);
    }
}

function goHome() {
    currentScreen = 'home';
    currentVideo = null;
    render();
}

let searchTimeout;
function handleSearch(value) {
    searchQuery = value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        selectedTag = null;
        await loadVideos(value ? { search: value } : {});
        render();
    }, 300);
}

async function filterByTag(tagName) {
    selectedTag = tagName;
    searchQuery = '';
    await loadVideos(tagName ? { tag: tagName } : {});
    render();
}

function formatDuration(seconds) {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `hace ${days}d`;
    return new Date(dateStr).toLocaleDateString('es-ES');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
