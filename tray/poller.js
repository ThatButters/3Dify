const api = require('./api');
const config = require('./config');
const { notify } = require('./notifier');

let timer = null;
let stateCallback = null;
let authCallback = null;
let lastState = null;
let tick = 0;

// Normalized state shape sent to tray/popup/notifier
function emptyState() {
  return {
    workerConnected: false,
    paused: false,
    gpuName: null,
    gpuTemp: null,
    gpuUtil: null,
    gpuVramTotal: null,
    gpuVramUsed: null,
    gpuVramFree: null,
    pending: 0,
    processing: 0,
    complete: 0,
    failed: 0,
    recentJobs: [],
    error: null,
  };
}

function normalizeState(dashboard, gpu, jobs) {
  const s = emptyState();

  if (dashboard) {
    // Worker
    const w = dashboard.worker || {};
    s.workerConnected = !!w.connected;
    s.paused = !!w.paused;
    s.gpuName = w.gpu_name || (w.info && w.info.gpu_name) || null;

    // Queue
    const q = dashboard.queue || {};
    s.pending = (q.pending ?? 0) + (q.assigned ?? 0);
    s.processing = q.processing ?? 0;
    s.complete = q.complete ?? q.completed ?? 0;
    s.failed = (q.failed ?? 0) + (q.expired ?? 0);
  }

  // Recent jobs from /api/admin/jobs
  if (jobs && jobs.jobs) {
    s.recentJobs = jobs.jobs.slice(0, 5);
  }

  if (gpu) {
    s.gpuTemp = gpu.temperature ?? gpu.temp ?? null;
    s.gpuUtil = gpu.utilization ?? gpu.util ?? null;
    s.gpuVramTotal = gpu.vram_total ?? gpu.memory_total ?? null;
    s.gpuVramUsed = gpu.vram_used ?? gpu.memory_used ?? null;
    if (s.gpuVramTotal != null && s.gpuVramUsed != null) {
      s.gpuVramFree = Math.round((s.gpuVramTotal - s.gpuVramUsed) * 10) / 10;
    }
    if (!s.gpuName && gpu.name) {
      s.gpuName = gpu.name;
    }
  }

  return s;
}

function detectChanges(prev, curr) {
  if (!prev) return; // First poll — no notifications

  // Worker connection changes
  if (prev.workerConnected && !curr.workerConnected) {
    notify('Worker Disconnected', 'The 3Dify worker has lost connection.');
  } else if (!prev.workerConnected && curr.workerConnected) {
    notify('Worker Reconnected', 'The 3Dify worker is back online.');
  }

  // Job completion detection: processing count decreased, complete count increased
  if (curr.complete > prev.complete) {
    const diff = curr.complete - prev.complete;
    notify('Job Complete', `${diff} job${diff > 1 ? 's' : ''} finished successfully.`);
  }

  // Check recent jobs for failures
  if (curr.recentJobs && prev.recentJobs) {
    const prevIds = new Set(prev.recentJobs.filter(j => j.status === 'failed').map(j => j.id));
    const newFails = curr.recentJobs.filter(j => j.status === 'failed' && !prevIds.has(j.id));
    for (const job of newFails) {
      const id = (job.id || '').substring(0, 8);
      notify('Job Failed', `Job ${id} failed${job.error ? ': ' + job.error : ''}`);
    }
  }
}

async function poll() {
  try {
    let dashboard = null;
    let gpu = null;
    let jobs = null;

    // Cycle fetches across ticks to spread load: 0=all, then rotate
    const cycle = tick % 3;
    if (cycle === 0 || tick === 0) {
      dashboard = await api.getDashboard();
    }
    if (cycle === 1 || tick === 0) {
      gpu = await api.getGpu();
    }
    if (cycle === 2 || tick === 0) {
      jobs = await api.getJobs({ limit: 5 });
    }

    // Merge with last known state for data we didn't fetch this tick
    const state = normalizeState(
      dashboard || (lastState?._rawDashboard ?? null),
      gpu || (lastState?._rawGpu ?? null),
      jobs || (lastState?._rawJobs ?? null),
    );

    // Keep raw data for merging on next tick
    state._rawDashboard = dashboard || lastState?._rawDashboard;
    state._rawGpu = gpu || lastState?._rawGpu;
    state._rawJobs = jobs || lastState?._rawJobs;

    detectChanges(lastState, state);
    lastState = state;
    tick++;

    if (stateCallback) stateCallback(state);
  } catch (e) {
    if (e.message === 'AUTH_EXPIRED') {
      stopPolling();
      if (authCallback) authCallback();
      return;
    }

    // Network error — report disconnected state
    const state = emptyState();
    state.error = e.message;
    if (stateCallback) stateCallback(state);
  }
}

function startPolling(onState, onAuth) {
  stateCallback = onState;
  authCallback = onAuth;
  lastState = null;
  tick = 0;

  // Immediate first poll
  poll();

  // Then poll on interval
  const interval = config.load().pollInterval || 5000;
  timer = setInterval(poll, interval);
}

function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  stateCallback = null;
  authCallback = null;
}

module.exports = { startPolling, stopPolling };
