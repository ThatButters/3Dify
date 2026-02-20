const $ = (sel) => document.querySelector(sel);

let currentState = null;

function updateUI(state) {
  currentState = state;

  // Status badge
  const badge = $('#status-badge');
  if (!state.workerConnected) {
    badge.textContent = 'disconnected';
    badge.className = 'status-badge disconnected';
  } else if (state.paused) {
    badge.textContent = 'paused';
    badge.className = 'status-badge paused';
  } else if (state.processing > 0) {
    badge.textContent = 'processing';
    badge.className = 'status-badge processing';
  } else {
    badge.textContent = 'connected';
    badge.className = 'status-badge connected';
  }

  // Worker card
  $('#worker-status').textContent = state.workerConnected
    ? (state.paused ? 'Paused' : 'Connected')
    : 'Disconnected';
  $('#worker-status').style.color = state.workerConnected
    ? (state.paused ? 'var(--muted)' : 'var(--success)')
    : 'var(--danger)';

  $('#gpu-name').textContent = state.gpuName || '—';

  // GPU card
  if (state.gpuVramTotal && state.gpuVramUsed != null) {
    const usedPct = Math.round((state.gpuVramUsed / state.gpuVramTotal) * 100);
    $('#vram-bar').style.width = usedPct + '%';
    const free = (state.gpuVramTotal - state.gpuVramUsed).toFixed(1);
    $('#vram-label').textContent = `${free} / ${state.gpuVramTotal.toFixed(1)} GB free`;

    // Color the bar based on usage
    if (usedPct > 90) {
      $('#vram-bar').style.background = 'var(--danger)';
    } else if (usedPct > 70) {
      $('#vram-bar').style.background = 'var(--warning)';
    } else {
      $('#vram-bar').style.background = 'linear-gradient(90deg, var(--accent), var(--accent-2))';
    }
  }

  $('#gpu-temp').textContent = state.gpuTemp != null ? `${state.gpuTemp}°C` : '—';
  $('#gpu-util').textContent = state.gpuUtil != null ? `${state.gpuUtil}%` : '—';

  // Queue stats
  $('#q-pending').textContent = state.pending ?? 0;
  $('#q-processing').textContent = state.processing ?? 0;
  $('#q-complete').textContent = state.complete ?? 0;
  const failedEl = $('#q-failed');
  failedEl.textContent = state.failed ?? 0;
  failedEl.className = (state.failed > 0) ? 'stat-num danger' : 'stat-num';

  const total = (state.pending ?? 0) + (state.processing ?? 0) + (state.complete ?? 0) + (state.failed ?? 0);
  $('#q-total').textContent = total;

  // Recent jobs — use DOM API to avoid XSS from server data
  const jobsList = $('#jobs-list');
  jobsList.textContent = '';
  if (state.recentJobs && state.recentJobs.length > 0) {
    const allowedStatuses = new Set(['pending', 'processing', 'complete', 'failed']);
    for (const job of state.recentJobs) {
      const row = document.createElement('div');
      row.className = 'job-row';

      const idSpan = document.createElement('span');
      idSpan.className = 'job-id';
      idSpan.textContent = String(job.id || '').substring(0, 8);

      const badgeSpan = document.createElement('span');
      const status = allowedStatuses.has(job.status) ? job.status : 'pending';
      badgeSpan.className = `job-badge ${status}`;
      badgeSpan.textContent = status;

      row.appendChild(idSpan);
      row.appendChild(badgeSpan);
      jobsList.appendChild(row);
    }
  } else {
    const msg = document.createElement('div');
    msg.className = 'empty-msg';
    msg.textContent = 'No recent jobs';
    jobsList.appendChild(msg);
  }

  // Local worker status
  const localStatus = $('#local-worker-status');
  if (state.localWorkerRunning) {
    localStatus.textContent = 'Running';
    localStatus.style.color = 'var(--success)';
  } else {
    localStatus.textContent = 'Stopped';
    localStatus.style.color = 'var(--muted)';
  }

  // Pause/Resume button
  const btn = $('#pause-btn');
  btn.disabled = !state.workerConnected;
  if (state.paused) {
    btn.textContent = 'Resume Processing';
    btn.onclick = () => window.trayAPI.resumeWorker();
  } else {
    btn.textContent = 'Pause Processing';
    btn.onclick = () => window.trayAPI.pauseWorker();
  }

  // Local worker start/stop button
  const localBtn = $('#local-worker-btn');
  if (state.localWorkerRunning) {
    localBtn.textContent = 'Stop Worker';
    localBtn.onclick = () => window.trayAPI.stopLocalWorker();
  } else {
    localBtn.textContent = 'Start Worker';
    localBtn.onclick = () => window.trayAPI.startLocalWorker();
  }
}

// Listen for state updates from main process
window.trayAPI.onStateUpdate((state) => {
  updateUI(state);
});
