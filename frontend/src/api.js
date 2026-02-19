const BASE = '';

// ─── Public API ─────────────────────────────────────────────

export async function uploadImage(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.message || `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function getJob(jobId) {
  const res = await fetch(`${BASE}/api/job/${jobId}`);
  if (!res.ok) throw new Error(`Job not found (${res.status})`);
  return res.json();
}

export function getStlUrl(jobId) {
  return `${BASE}/api/job/${jobId}/stl`;
}

export function getGlbUrl(jobId) {
  return `${BASE}/api/job/${jobId}/glb`;
}

export function getThumbnailUrl(jobId) {
  return `${BASE}/api/job/${jobId}/thumbnail`;
}

export async function getQueueStatus() {
  const res = await fetch(`${BASE}/api/queue`);
  if (!res.ok) throw new Error('Failed to fetch queue');
  return res.json();
}

export async function getHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function getGallery(limit = 20, offset = 0) {
  const res = await fetch(`${BASE}/api/gallery?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error('Failed to fetch gallery');
  return res.json();
}

export async function submitFeedback(jobId, rating, text) {
  const res = await fetch(`${BASE}/api/job/${jobId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, text: text || undefined }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit feedback');
  }
  return res.json();
}

export async function submitReport(jobId, reason, details) {
  const res = await fetch(`${BASE}/api/job/${jobId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, details: details || undefined }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit report');
  }
  return res.json();
}

export function makeWsUrl(jobId) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws/job/${jobId}`;
}

// ─── Admin API ──────────────────────────────────────────────

function getAdminToken() {
  return localStorage.getItem('admin_token');
}

async function adminFetch(path, options = {}) {
  const token = getAdminToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const admin = {
  // Auth
  async login(username, password) {
    const res = await fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Invalid credentials');
    }
    const data = await res.json();
    localStorage.setItem('admin_token', data.token);
    return data;
  },

  logout() {
    localStorage.removeItem('admin_token');
  },

  isAuthenticated() {
    return !!getAdminToken();
  },

  // Overview / Worker
  getStats: () => adminFetch('/api/admin/stats'),
  getGpu: () => adminFetch('/api/admin/gpu'),
  getWorkerStatus: () => adminFetch('/api/admin/worker/status'),
  pauseWorker: () => adminFetch('/api/admin/worker/pause', { method: 'POST' }),
  resumeWorker: () => adminFetch('/api/admin/worker/resume', { method: 'POST' }),

  // Jobs
  getJobs: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    return adminFetch(`/api/admin/jobs?${qs}`);
  },
  getJobDetail: (jobId) => adminFetch(`/api/admin/jobs/${jobId}`),
  cancelJob: (jobId) => adminFetch(`/api/admin/jobs/${jobId}/cancel`, { method: 'POST' }),
  retryJob: (jobId) => adminFetch(`/api/admin/jobs/${jobId}/retry`, { method: 'POST' }),
  deleteJob: (jobId) => adminFetch(`/api/admin/jobs/${jobId}`, { method: 'DELETE' }),

  // Moderation
  getReports: (status = 'pending') => adminFetch(`/api/admin/reports?status=${status}`),
  dismissReport: (id) => adminFetch(`/api/admin/reports/${id}/dismiss`, { method: 'POST' }),
  removeReportedJob: (id) => adminFetch(`/api/admin/reports/${id}/remove`, { method: 'POST' }),
  getBans: () => adminFetch('/api/admin/bans'),
  addBan: (ip, reason, expires_at) =>
    adminFetch('/api/admin/bans', {
      method: 'POST',
      body: JSON.stringify({ ip, reason, expires_at: expires_at || undefined }),
    }),
  removeBan: (banId) => adminFetch(`/api/admin/bans/${banId}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => adminFetch('/api/admin/settings'),
  updateSettings: (settings) =>
    adminFetch('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }),

  // Audit
  getAuditLog: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    if (params.action) qs.set('action', params.action);
    if (params.after) qs.set('after', params.after);
    if (params.before) qs.set('before', params.before);
    return adminFetch(`/api/admin/audit?${qs}`);
  },
};
