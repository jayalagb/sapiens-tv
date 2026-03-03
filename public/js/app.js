let currentScreen = 'landing';
let currentUser = null;
let videos = [];
let tags = [];
let selectedTags = [];
let selectedLocations = [];
let selectedUniversities = [];
let availableFilters = { locations: [], universities: [] };
let searchQuery = '';
let currentVideo = null;

async function init() {
    if (getUserToken()) {
        try {
            currentUser = await apiGetMe();
            if (currentUser.status === 'approved') {
                currentScreen = 'home';
                await Promise.all([loadTags(), loadFilters()]);
                await loadVideos();
            } else {
                localStorage.removeItem('sesamotv_user_token');
                currentScreen = 'landing';
            }
        } catch (e) {
            localStorage.removeItem('sesamotv_user_token');
            currentScreen = 'landing';
        }
    }
    render();
}

async function loadTags() {
    try { tags = await apiGetTags(); } catch (e) { tags = []; }
}

async function loadVideos(params = {}) {
    try { videos = await apiGetVideos(params); } catch (e) { videos = []; }
}

async function loadFilters() {
    try { availableFilters = await apiGetFilters(); } catch (e) { availableFilters = { locations: [], universities: [] }; }
}

async function render() {
    const app = document.getElementById('app');
    switch (currentScreen) {
        case 'landing': app.innerHTML = renderLanding(); break;
        case 'login': app.innerHTML = renderLoginScreen(); break;
        case 'register': app.innerHTML = renderRegisterScreen(); break;
        case 'reset': app.innerHTML = renderResetScreen(); break;
        case 'player': app.innerHTML = await renderPlayer(); break;
        default: app.innerHTML = renderHome(); break;
    }
}

// --- Landing ---

function renderLanding() {
    return `
        <div class="landing">
            <div class="landing-hero">
                <h1 class="landing-logo">SesamoTV</h1>
                <p class="landing-tagline">Tu plataforma de videos</p>
                <div class="landing-actions">
                    <button class="btn btn-landing-primary" onclick="navigateTo('login')">Iniciar Sesion</button>
                    <button class="btn btn-landing-secondary" onclick="navigateTo('register')">Crear Cuenta</button>
                </div>
            </div>
        </div>
    `;
}

// --- Login ---

function renderLoginScreen() {
    return `
        <div class="auth-screen">
            <div class="auth-box">
                <h2 class="auth-title">Iniciar Sesion</h2>
                <div id="auth-error" class="auth-msg error" style="display:none"></div>
                <input type="text" id="login-user" class="auth-input" placeholder="Usuario o email">
                <input type="password" id="login-pass" class="auth-input" placeholder="Contrasena"
                       onkeydown="if(event.key==='Enter')handleLogin()">
                <button class="btn btn-primary btn-full" onclick="handleLogin()" id="login-btn">Entrar</button>
                <p class="auth-link"><a href="#" onclick="navigateTo('reset');return false">Olvidaste tu contrasena?</a></p>
                <p class="auth-link">No tienes cuenta? <a href="#" onclick="navigateTo('register');return false">Registrate</a></p>
                <p class="auth-link"><a href="#" onclick="navigateTo('landing');return false">Volver</a></p>
            </div>
        </div>
    `;
}

async function handleLogin() {
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    const errEl = document.getElementById('auth-error');

    if (!username || !password) {
        errEl.textContent = 'Completa todos los campos';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Entrando...';

    try {
        const data = await apiUserLogin(username, password);
        localStorage.setItem('sesamotv_user_token', data.token);
        currentUser = data.user;
        currentScreen = 'home';
        await Promise.all([loadTags(), loadFilters()]);
        await loadVideos();
        render();
    } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
}

// --- Register ---

function renderRegisterScreen() {
    return `
        <div class="auth-screen">
            <div class="auth-box">
                <h2 class="auth-title">Crear Cuenta</h2>
                <div id="auth-error" class="auth-msg error" style="display:none"></div>
                <div id="auth-success" class="auth-msg success" style="display:none"></div>
                <input type="text" id="reg-user" class="auth-input" placeholder="Nombre de usuario">
                <input type="email" id="reg-email" class="auth-input" placeholder="Email">
                <input type="password" id="reg-pass" class="auth-input" placeholder="Contrasena (min 8, mayuscula, minuscula, numero)">
                <button class="btn btn-primary btn-full" onclick="handleRegister()" id="reg-btn">Registrarse</button>
                <p class="auth-link">Ya tienes cuenta? <a href="#" onclick="navigateTo('login');return false">Inicia sesion</a></p>
                <p class="auth-link"><a href="#" onclick="navigateTo('landing');return false">Volver</a></p>
            </div>
        </div>
    `;
}

async function handleRegister() {
    const username = document.getElementById('reg-user').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-pass').value;
    const errEl = document.getElementById('auth-error');
    const successEl = document.getElementById('auth-success');

    errEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!username || !email || !password) {
        errEl.textContent = 'Completa todos los campos';
        errEl.style.display = 'block';
        return;
    }

    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        errEl.textContent = 'La contrasena debe tener al menos 8 caracteres, con mayuscula, minuscula y numero';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('reg-btn');
    btn.disabled = true;
    btn.textContent = 'Registrando...';

    try {
        const data = await apiUserRegister(username, email, password);
        successEl.textContent = data.message;
        successEl.style.display = 'block';
        document.getElementById('reg-user').value = '';
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-pass').value = '';
        btn.textContent = 'Registrarse';
        btn.disabled = false;
        setTimeout(() => navigateTo('login'), 3000);
    } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Registrarse';
    }
}

// --- Reset Password ---

function renderResetScreen() {
    return `
        <div class="auth-screen">
            <div class="auth-box">
                <h2 class="auth-title">Recuperar Contrasena</h2>
                <p class="auth-subtitle">Introduce tu email y enviaremos una solicitud al administrador para resetear tu contrasena.</p>
                <div id="auth-error" class="auth-msg error" style="display:none"></div>
                <div id="auth-success" class="auth-msg success" style="display:none"></div>
                <input type="email" id="reset-email" class="auth-input" placeholder="Tu email"
                       onkeydown="if(event.key==='Enter')handleResetRequest()">
                <button class="btn btn-primary btn-full" onclick="handleResetRequest()" id="reset-btn">Enviar Solicitud</button>
                <p class="auth-link"><a href="#" onclick="navigateTo('login');return false">Volver al login</a></p>
            </div>
        </div>
    `;
}

async function handleResetRequest() {
    const email = document.getElementById('reset-email').value.trim();
    const errEl = document.getElementById('auth-error');
    const successEl = document.getElementById('auth-success');

    errEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!email) {
        errEl.textContent = 'Introduce tu email';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('reset-btn');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        const data = await apiRequestReset(email);
        successEl.textContent = data.message;
        successEl.style.display = 'block';
        document.getElementById('reset-email').value = '';
        btn.textContent = 'Enviar Solicitud';
        btn.disabled = false;
    } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Enviar Solicitud';
    }
}

// --- Home ---

function buildParams() {
    const p = {};
    if (selectedTags.length) p.tags = selectedTags.join(',');
    if (selectedLocations.length) p.location = selectedLocations.join(',');
    if (selectedUniversities.length) p.university = selectedUniversities.join(',');
    if (searchQuery) p.search = searchQuery;
    return p;
}

function toggleSidebar() {
    const sidebar = document.getElementById('filter-sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
}

function toggleAccordion(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('collapsed');
    const btn = el.previousElementSibling;
    if (btn) btn.classList.toggle('open');
}

async function toggleLocation(name) {
    const idx = selectedLocations.indexOf(name);
    if (idx !== -1) selectedLocations.splice(idx, 1);
    else selectedLocations.push(name);
    await loadVideos(buildParams());
    render();
}

async function toggleUniversity(name) {
    const idx = selectedUniversities.indexOf(name);
    if (idx !== -1) selectedUniversities.splice(idx, 1);
    else selectedUniversities.push(name);
    await loadVideos(buildParams());
    render();
}

function renderHome() {
    return `
        <div class="app-layout">
            <aside class="filter-sidebar" id="filter-sidebar">
                <div class="sidebar-header">
                    <span>Filtros</span>
                    <button class="sidebar-close" onclick="toggleSidebar()">&#10005;</button>
                </div>

                <div class="filter-section">
                    <button class="filter-toggle open" onclick="toggleAccordion('acc-prov')">
                        Provincia <span class="chevron">&#9660;</span>
                    </button>
                    <div class="filter-list" id="acc-prov">
                        ${availableFilters.locations.length === 0
                          ? '<span class="filter-empty">Sin datos</span>'
                          : availableFilters.locations.map(l => `
                            <label class="filter-item">
                                <input type="checkbox" value="${escapeHtml(l.name)}"
                                    ${selectedLocations.includes(l.name) ? 'checked' : ''}
                                    onchange="toggleLocation('${escapeHtml(l.name).replace(/'/g, "\\'")}')">
                                ${escapeHtml(l.name)} <span class="filter-count">(${l.count})</span>
                            </label>
                          `).join('')}
                    </div>
                </div>

                <div class="filter-section">
                    <button class="filter-toggle open" onclick="toggleAccordion('acc-univ')">
                        Universidad <span class="chevron">&#9660;</span>
                    </button>
                    <div class="filter-list" id="acc-univ">
                        ${availableFilters.universities.length === 0
                          ? '<span class="filter-empty">Sin datos</span>'
                          : availableFilters.universities.map(u => `
                            <label class="filter-item">
                                <input type="checkbox" value="${escapeHtml(u.name)}"
                                    ${selectedUniversities.includes(u.name) ? 'checked' : ''}
                                    onchange="toggleUniversity('${escapeHtml(u.name).replace(/'/g, "\\'")}')">
                                ${escapeHtml(u.name)} <span class="filter-count">(${u.count})</span>
                            </label>
                          `).join('')}
                    </div>
                </div>
            </aside>

            <main class="main-content">
                <div class="container">
                    <header class="header">
                        <button class="sidebar-toggle-btn" onclick="toggleSidebar()" title="Filtros">&#9776;</button>
                        <h1 class="logo">SesamoTV</h1>
                        <div class="header-right">
                            <span class="user-name">${escapeHtml(currentUser?.username || '')}</span>
                            <button class="btn btn-sm btn-outline" onclick="handleLogout()">Salir</button>
                        </div>
                    </header>

                    <div class="search-bar">
                        <input type="text" id="search-input" placeholder="Buscar videos..."
                               value="${escapeHtml(searchQuery)}" oninput="handleSearch(this.value)">
                    </div>

                    <div class="tags-bar">
                        <button class="tag-chip ${selectedTags.length === 0 ? 'active' : ''}" onclick="filterByTag(null)">Todos</button>
                        ${tags.map(t => `
                            <button class="tag-chip ${selectedTags.includes(t.name) ? 'active' : ''}"
                                    data-tag="${escapeHtml(t.name)}">${escapeHtml(t.name)} (${t.video_count})</button>
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
                                    ${renderStars(v.rating || 0)}
                                    <div class="video-tags">
                                        ${(v.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t.name)}</span>`).join('')}
                                    </div>
                                </div>
                            </div>
                          `).join('')}
                    </div>
                </div>
            </main>
        </div>
    `;
}

// --- Player ---

async function renderPlayer() {
    const v = currentVideo;
    if (!v) return renderHome();
    const streamUrl = await getStreamUrl(v.uid);
    return `
        <div class="container">
            <header class="header">
                <button class="back-btn" onclick="goHome()">&#8592; Volver</button>
                <h1 class="logo">SesamoTV</h1>
                <div class="header-right">
                    <span class="user-name">${escapeHtml(currentUser?.username || '')}</span>
                    <button class="btn btn-sm btn-outline" onclick="handleLogout()">Salir</button>
                </div>
            </header>

            <div class="player-wrapper">
                <video id="video-player" controls playsinline autoplay
                       src="${streamUrl}">
                    Tu navegador no soporta video HTML5.
                </video>
            </div>

            <div class="video-details">
                <h2 class="video-detail-title">${escapeHtml(v.title)}</h2>
                <div class="video-meta">
                    <span>${v.views || 0} vistas</span>
                    <span>${timeAgo(v.createdAt)}</span>
                </div>
                <div class="player-rating-section">
                    <div class="rating-avg">
                        ${renderStars(v.rating || 0, 'lg')}
                        <span class="rating-avg-label">${(v.rating || 0).toFixed(1)} promedio</span>
                    </div>
                    <div class="rating-user">
                        <span class="rating-user-label">Tu puntuacion:</span>
                        ${renderInteractiveStars(v.uid, v.userRating)}
                    </div>
                </div>
                ${v.description ? `<p class="video-description">${escapeHtml(v.description)}</p>` : ''}
                <div class="video-tags">
                    ${(v.tags || []).map(t => `<span class="tag-badge clickable" data-tag="${escapeHtml(t.name)}">${escapeHtml(t.name)}</span>`).join('')}
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

// --- Stars ---

function renderStars(rating, size = 'sm') {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    let html = `<div class="video-rating rating-${size}">`;
    for (let i = 0; i < full; i++) html += '<span class="star full">&#9733;</span>';
    if (half) html += '<span class="star half">&#9733;</span>';
    for (let i = 0; i < empty; i++) html += '<span class="star empty">&#9733;</span>';
    html += '</div>';
    return html;
}

function renderInteractiveStars(videoUid, userRating) {
    let html = '<div class="video-rating rating-lg rating-interactive">';
    for (let i = 1; i <= 5; i++) {
        const cls = userRating !== null && i <= userRating ? 'full' : 'empty';
        html += `<span class="star ${cls}" onclick="rateVideo('${videoUid}', ${i})" data-star="${i}">&#9733;</span>`;
    }
    html += '</div>';
    return html;
}

async function rateVideo(uid, rating) {
    try {
        const data = await apiRateVideo(uid, rating);
        // Update currentVideo with new values
        if (currentVideo && currentVideo.uid === uid) {
            currentVideo.rating = data.rating;
            currentVideo.userRating = data.userRating;
        }
        // Update in videos list too
        const idx = videos.findIndex(v => v.uid === uid);
        if (idx !== -1) {
            videos[idx].rating = data.rating;
            videos[idx].userRating = data.userRating;
        }
        render();
    } catch (e) {
        console.error('Error rating video:', e);
    }
}

// --- Actions ---

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
        selectedTags = [];
        await loadVideos(buildParams());
        render();
    }, 300);
}

async function filterByTag(tagName) {
    if (tagName === null) {
        selectedTags = [];
    } else {
        const idx = selectedTags.indexOf(tagName);
        if (idx !== -1) {
            selectedTags.splice(idx, 1);
        } else {
            selectedTags.push(tagName);
        }
    }
    searchQuery = '';
    await loadVideos(buildParams());
    render();
}

function handleLogout() {
    localStorage.removeItem('sesamotv_user_token');
    currentUser = null;
    videos = [];
    tags = [];
    selectedTags = [];
    selectedLocations = [];
    selectedUniversities = [];
    availableFilters = { locations: [], universities: [] };
    searchQuery = '';
    currentScreen = 'landing';
    render();
}

function navigateTo(screen) {
    currentScreen = screen;
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
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', init);

// Event delegation for tag clicks (avoids inline onclick quoting issues)
document.addEventListener('click', function(e) {
    const el = e.target.closest('[data-tag]');
    if (!el) return;
    const tagName = el.dataset.tag;
    if (currentScreen === 'player') goHome();
    filterByTag(tagName);
});
