const BASE = '';

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
