import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://www.sesamotv.com/api';
const TOKEN_KEY = 'sesamotv_user_token';

let cachedToken = null;

export async function getToken() {
  if (cachedToken) return cachedToken;
  cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

export async function setToken(token) {
  cachedToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function clearToken() {
  cachedToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body = null, auth = true) {
  const headers = {'Content-Type': 'application/json'};
  if (auth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  const opts = {method, headers};
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

// Auth
export const login = (username, password) =>
  request('POST', '/user-auth/login', {username, password}, false);

export const register = (username, email, password) =>
  request('POST', '/user-auth/register', {username, email, password}, false);

export const getMe = () => request('GET', '/user-auth/me');

export const resetRequest = email =>
  request('POST', '/user-auth/reset-request', {email}, false);

// Videos
export async function getVideos(search = '', tags = []) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (tags.length > 0) params.set('tags', tags.join(','));
  const qs = params.toString();
  return request('GET', `/videos${qs ? '?' + qs : ''}`);
}

export const getVideo = uid => request('GET', `/videos/${uid}`);

export const trackView = uid =>
  request('POST', `/videos/${uid}/view`).catch(() => {});

export const rateVideo = (uid, rating) =>
  request('POST', `/videos/${uid}/rate`, {rating});

export async function getStreamUrl(uid) {
  const data = await request('GET', `/videos/${uid}/stream-token`);
  return data.streamUrl || data.url;
}

export const getThumbnailUrl = uid =>
  `${BASE_URL}/videos/${uid}/thumbnail`;

// Tags
export const getTags = () => request('GET', '/tags');
