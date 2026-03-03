const API_BASE = '/api';

function getUserToken() {
    return localStorage.getItem('sesamotv_user_token');
}

async function apiCall(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = getUserToken();
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    const res = await fetch(API_BASE + endpoint, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
}

async function apiUserRegister(username, email, password) {
    return await apiCall('/user-auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
    });
}

async function apiUserLogin(username, password) {
    return await apiCall('/user-auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
}

async function apiGetMe() {
    return await apiCall('/user-auth/me');
}

async function apiRequestReset(email) {
    return await apiCall('/user-auth/reset-request', {
        method: 'POST',
        body: JSON.stringify({ email })
    });
}

async function apiGetVideos(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return await apiCall('/videos' + (qs ? '?' + qs : ''));
}

async function apiGetFilters() {
    return await apiCall('/videos/filters');
}

async function apiGetVideo(uid) {
    return await apiCall('/videos/' + uid);
}

async function apiGetTags() {
    return await apiCall('/tags');
}

async function apiTrackView(uid) {
    return await apiCall('/videos/' + uid + '/view', { method: 'POST' });
}

async function apiRateVideo(uid, rating) {
    return await apiCall('/videos/' + uid + '/rate', {
        method: 'POST',
        body: JSON.stringify({ rating })
    });
}

async function getStreamUrl(uid) {
    const data = await apiCall('/videos/' + uid + '/stream-token');
    return data.url;
}
