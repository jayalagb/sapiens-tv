const API_BASE = '/api';

async function apiCall(endpoint, options = {}) {
    const headers = { ...options.headers };
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(API_BASE + endpoint, {
        ...options,
        headers,
        credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
}

async function apiLogin(username, password) {
    const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    return data;
}

async function apiGetMe() {
    return await apiCall('/auth/me');
}

async function apiGetVideos() {
    return await apiCall('/videos');
}

async function apiUploadVideo(formData) {
    return await apiCall('/videos', { method: 'POST', body: formData });
}

async function apiUpdateVideo(uid, data) {
    return await apiCall('/videos/' + uid, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function apiDeleteVideo(uid) {
    return await apiCall('/videos/' + uid, { method: 'DELETE' });
}

async function apiReorderVideos(order) {
    return await apiCall('/videos/reorder', {
        method: 'PUT',
        body: JSON.stringify({ order })
    });
}

async function apiGetTags() {
    return await apiCall('/tags');
}

async function apiCreateTag(name) {
    return await apiCall('/tags', {
        method: 'POST',
        body: JSON.stringify({ name })
    });
}

async function apiDeleteTag(id) {
    return await apiCall('/tags/' + id, { method: 'DELETE' });
}

async function apiGetUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return await apiCall('/users' + (qs ? '?' + qs : ''));
}

async function apiApproveUser(uid) {
    return await apiCall('/users/' + uid + '/approve', { method: 'PUT' });
}

async function apiRejectUser(uid) {
    return await apiCall('/users/' + uid + '/reject', { method: 'PUT' });
}

async function apiDeleteUser(uid) {
    return await apiCall('/users/' + uid, { method: 'DELETE' });
}

async function apiGetResetRequests() {
    return await apiCall('/users/reset-requests');
}

async function apiResetPassword(uid, password) {
    return await apiCall('/users/' + uid + '/reset-password', {
        method: 'PUT',
        body: JSON.stringify({ password })
    });
}

async function apiGetSettings() {
    return await apiCall('/settings');
}

async function apiSetGeoBlocking(enabled) {
    return await apiCall('/settings/geo-blocking', {
        method: 'PUT',
        body: JSON.stringify({ enabled })
    });
}

async function logout() {
    try { await apiCall('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
}
