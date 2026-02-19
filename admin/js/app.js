let currentScreen = 'login';
let admin = null;
let videos = [];
let tags = [];
let editingVideo = null;
let dragItem = null;

async function init() {
    if (authToken) {
        try {
            admin = await apiGetMe();
            currentScreen = 'dashboard';
            await loadData();
        } catch (e) {
            logout();
        }
    }
    render();
}

async function loadData() {
    [videos, tags] = await Promise.all([apiGetVideos(), apiGetTags()]);
}

function render() {
    const app = document.getElementById('app');
    switch (currentScreen) {
        case 'login': app.innerHTML = renderLogin(); break;
        case 'dashboard': app.innerHTML = renderDashboard(); break;
        case 'upload': app.innerHTML = renderUpload(); break;
        case 'edit': app.innerHTML = renderEdit(); break;
        case 'tags': app.innerHTML = renderTags(); break;
    }
}

function renderLogin() {
    return `
        <div class="login-screen">
            <div class="login-box">
                <h1>SesamoTV Admin</h1>
                <input type="text" id="login-user" placeholder="Usuario" class="input">
                <input type="password" id="login-pass" placeholder="Contrasena" class="input"
                       onkeydown="if(event.key==='Enter')handleLogin()">
                <button class="btn btn-primary" onclick="handleLogin()">Entrar</button>
            </div>
        </div>
    `;
}

async function handleLogin() {
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;
    try {
        const data = await apiLogin(username, password);
        admin = data.admin;
        currentScreen = 'dashboard';
        await loadData();
        render();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function renderDashboard() {
    return `
        <div class="admin-layout">
            <nav class="sidebar">
                <h2 class="sidebar-logo">SesamoTV</h2>
                <div class="nav-item active" onclick="navigateTo('dashboard')">Videos</div>
                <div class="nav-item" onclick="navigateTo('upload')">Subir Video</div>
                <div class="nav-item" onclick="navigateTo('tags')">Tags</div>
                <div class="nav-item logout" onclick="handleLogout()">Cerrar sesion</div>
            </nav>
            <main class="main-content">
                <div class="content-header">
                    <h2>Videos (${videos.length})</h2>
                    <button class="btn btn-primary" onclick="navigateTo('upload')">+ Subir Video</button>
                </div>
                <div class="video-list" id="video-list">
                    ${videos.length === 0 ? '<p class="empty">No hay videos. Sube el primero!</p>' :
                      videos.map((v, i) => `
                        <div class="video-row" draggable="true" data-uid="${v.uid}" data-index="${i}"
                             ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="drop(event)">
                            <div class="drag-handle">&#9776;</div>
                            <div class="video-row-thumb">
                                ${v.thumbnailUrl ? `<img src="${v.thumbnailUrl}">` :
                                  `<div class="row-thumb-placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>`}
                            </div>
                            <div class="video-row-info">
                                <div class="video-row-title">${escapeHtml(v.title)}</div>
                                <div class="video-row-meta">${v.views || 0} vistas | ${(v.tags||[]).map(t=>t.name).join(', ') || 'sin tags'}</div>
                            </div>
                            <div class="video-row-actions">
                                <button class="btn btn-sm" onclick="startEdit('${v.uid}')">Editar</button>
                                <button class="btn btn-sm btn-danger" onclick="confirmDelete('${v.uid}', '${escapeHtml(v.title)}')">Eliminar</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </main>
        </div>
    `;
}

function renderUpload() {
    return `
        <div class="admin-layout">
            <nav class="sidebar">
                <h2 class="sidebar-logo">SesamoTV</h2>
                <div class="nav-item" onclick="navigateTo('dashboard')">Videos</div>
                <div class="nav-item active" onclick="navigateTo('upload')">Subir Video</div>
                <div class="nav-item" onclick="navigateTo('tags')">Tags</div>
                <div class="nav-item logout" onclick="handleLogout()">Cerrar sesion</div>
            </nav>
            <main class="main-content">
                <h2>Subir Video</h2>
                <div class="form-card">
                    <div class="form-group">
                        <label>Video</label>
                        <div class="drop-zone" id="drop-zone"
                             ondrop="handleDrop(event)" ondragover="event.preventDefault(); this.classList.add('dragover')"
                             ondragleave="this.classList.remove('dragover')">
                            <input type="file" id="video-file" accept="video/*" onchange="handleFileSelect(event)" hidden>
                            <p id="drop-text">Arrastra un video aqui o <a href="#" onclick="document.getElementById('video-file').click(); return false;">selecciona</a></p>
                            <video id="video-preview" controls style="display:none; max-width:100%; max-height:300px;"></video>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Titulo</label>
                        <input type="text" id="upload-title" class="input" placeholder="Titulo del video">
                    </div>
                    <div class="form-group">
                        <label>Descripcion</label>
                        <textarea id="upload-desc" class="input textarea" placeholder="Descripcion (opcional)"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Tags</label>
                        <div class="tag-select">
                            ${tags.map(t => `
                                <label class="tag-option">
                                    <input type="checkbox" value="${t.id}" class="upload-tag">
                                    ${t.name}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <button class="btn btn-primary" id="upload-btn" onclick="handleUpload()">Subir Video</button>
                </div>
            </main>
        </div>
    `;
}

function renderEdit() {
    const v = editingVideo;
    if (!v) return renderDashboard();
    const videoTagIds = (v.tags || []).map(t => t.id);

    return `
        <div class="admin-layout">
            <nav class="sidebar">
                <h2 class="sidebar-logo">SesamoTV</h2>
                <div class="nav-item" onclick="navigateTo('dashboard')">Videos</div>
                <div class="nav-item" onclick="navigateTo('upload')">Subir Video</div>
                <div class="nav-item" onclick="navigateTo('tags')">Tags</div>
                <div class="nav-item logout" onclick="handleLogout()">Cerrar sesion</div>
            </nav>
            <main class="main-content">
                <h2>Editar Video</h2>
                <div class="form-card">
                    <div class="form-group">
                        <label>Titulo</label>
                        <input type="text" id="edit-title" class="input" value="${escapeHtml(v.title)}">
                    </div>
                    <div class="form-group">
                        <label>Descripcion</label>
                        <textarea id="edit-desc" class="input textarea">${escapeHtml(v.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Tags</label>
                        <div class="tag-select">
                            ${tags.map(t => `
                                <label class="tag-option">
                                    <input type="checkbox" value="${t.id}" class="edit-tag" ${videoTagIds.includes(t.id) ? 'checked' : ''}>
                                    ${t.name}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn-primary" onclick="saveEdit()">Guardar</button>
                        <button class="btn" onclick="navigateTo('dashboard')">Cancelar</button>
                    </div>
                </div>
            </main>
        </div>
    `;
}

function renderTags() {
    return `
        <div class="admin-layout">
            <nav class="sidebar">
                <h2 class="sidebar-logo">SesamoTV</h2>
                <div class="nav-item" onclick="navigateTo('dashboard')">Videos</div>
                <div class="nav-item" onclick="navigateTo('upload')">Subir Video</div>
                <div class="nav-item active" onclick="navigateTo('tags')">Tags</div>
                <div class="nav-item logout" onclick="handleLogout()">Cerrar sesion</div>
            </nav>
            <main class="main-content">
                <h2>Tags</h2>
                <div class="form-card">
                    <div class="form-group" style="display:flex;gap:10px;">
                        <input type="text" id="new-tag" class="input" placeholder="Nuevo tag..."
                               onkeydown="if(event.key==='Enter')addTag()" style="flex:1;">
                        <button class="btn btn-primary" onclick="addTag()">Crear</button>
                    </div>
                    <div class="tags-list">
                        ${tags.map(t => `
                            <div class="tag-row">
                                <span>${t.name} <small>(${t.video_count} videos)</small></span>
                                <button class="btn btn-sm btn-danger" onclick="deleteTag(${t.id}, '${t.name}')">Eliminar</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </main>
        </div>
    `;
}

// --- Actions ---

let selectedFile = null;

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) showPreview(file);
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) showPreview(file);
}

function showPreview(file) {
    selectedFile = file;
    const preview = document.getElementById('video-preview');
    const text = document.getElementById('drop-text');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    text.textContent = file.name;
}

async function handleUpload() {
    if (!selectedFile) return alert('Selecciona un video');
    const title = document.getElementById('upload-title').value;
    if (!title) return alert('Titulo requerido');

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', title);
    formData.append('description', document.getElementById('upload-desc').value);
    const tagIds = [...document.querySelectorAll('.upload-tag:checked')].map(c => parseInt(c.value));
    formData.append('tags', JSON.stringify(tagIds));

    const btn = document.getElementById('upload-btn');
    btn.disabled = true;
    btn.textContent = 'Subiendo...';

    try {
        await apiUploadVideo(formData);
        alert('Video subido!');
        selectedFile = null;
        await loadData();
        navigateTo('dashboard');
    } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.textContent = 'Subir Video';
    }
}

async function startEdit(uid) {
    editingVideo = videos.find(v => v.uid === uid);
    if (!editingVideo) {
        try { editingVideo = await apiCall('/videos/' + uid); } catch (e) { return; }
    }
    currentScreen = 'edit';
    render();
}

async function saveEdit() {
    const title = document.getElementById('edit-title').value;
    const description = document.getElementById('edit-desc').value;
    const tagIds = [...document.querySelectorAll('.edit-tag:checked')].map(c => parseInt(c.value));

    try {
        await apiUpdateVideo(editingVideo.uid, { title, description, tags: tagIds });
        alert('Video actualizado');
        await loadData();
        navigateTo('dashboard');
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function confirmDelete(uid, title) {
    if (confirm('Eliminar "' + title + '"? Esta accion no se puede deshacer.')) {
        try {
            await apiDeleteVideo(uid);
            await loadData();
            render();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }
}

async function addTag() {
    const input = document.getElementById('new-tag');
    const name = input.value.trim();
    if (!name) return;
    try {
        await apiCreateTag(name);
        await loadData();
        render();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function deleteTag(id, name) {
    if (confirm('Eliminar tag "' + name + '"?')) {
        try {
            await apiDeleteTag(id);
            await loadData();
            render();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }
}

// --- Drag & Drop Reorder ---

function dragStart(e) {
    dragItem = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => dragItem.classList.add('dragging'), 0);
}

function dragOver(e) {
    e.preventDefault();
    const target = e.currentTarget;
    if (target !== dragItem && target.classList.contains('video-row')) {
        const rect = target.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const list = document.getElementById('video-list');
        if (e.clientY < mid) {
            list.insertBefore(dragItem, target);
        } else {
            list.insertBefore(dragItem, target.nextSibling);
        }
    }
}

async function drop(e) {
    e.preventDefault();
    if (dragItem) dragItem.classList.remove('dragging');
    dragItem = null;

    // Save new order
    const rows = document.querySelectorAll('.video-row');
    const order = [...rows].map((row, i) => ({ uid: row.dataset.uid, sortOrder: i }));
    try {
        await apiReorderVideos(order);
        await loadData();
    } catch (e) {
        console.error('Reorder error:', e);
    }
}

function navigateTo(screen) {
    currentScreen = screen;
    render();
}

function handleLogout() {
    logout();
    admin = null;
    currentScreen = 'login';
    render();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
