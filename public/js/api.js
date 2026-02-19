const API_BASE = '/api';

async function apiCall(endpoint, options = {}) {
    const res = await fetch(API_BASE + endpoint, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
}

async function apiGetVideos(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return await apiCall('/videos' + (qs ? '?' + qs : ''));
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

function getStreamUrl(uid) {
    return API_BASE + '/videos/' + uid + '/stream';
}
