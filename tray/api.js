const config = require('./config');

async function request(method, endpoint, body = null) {
  const url = `${config.getServerUrl()}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };

  const token = config.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  if (res.status === 401) {
    config.clearToken();
    throw new Error('AUTH_EXPIRED');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try { detail = JSON.parse(text).detail || text; } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }

  return res.json();
}

async function login(username, password) {
  const url = `${config.getServerUrl()}/api/admin/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try { detail = JSON.parse(text).detail || text; } catch {}
    throw new Error(detail || 'Login failed');
  }

  const data = await res.json();
  config.setToken(data.token);
  return data;
}

async function getDashboard() {
  return request('GET', '/api/admin/dashboard');
}

async function getGpu() {
  return request('GET', '/api/admin/gpu');
}

async function getWorkerStatus() {
  return request('GET', '/api/admin/worker/status');
}

async function getJobs(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request('GET', `/api/admin/jobs${qs ? '?' + qs : ''}`);
}

async function pauseWorker() {
  return request('POST', '/api/admin/worker/pause');
}

async function resumeWorker() {
  return request('POST', '/api/admin/worker/resume');
}

module.exports = { login, getDashboard, getGpu, getWorkerStatus, getJobs, pauseWorker, resumeWorker };
