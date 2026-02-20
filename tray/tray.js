const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;
let clickHandler = null;
let menuHandler = null;
let currentStatus = 'grey';

// Generate a 16x16 tray icon as a colored circle
function makeIcon(color) {
  // 16x16 RGBA raw pixel buffer
  const size = 16;
  const buf = Buffer.alloc(size * size * 4, 0);

  const cx = 7.5, cy = 7.5, r = 6.5;

  const colors = {
    green:  [16, 185, 129],  // #10b981
    orange: [233, 115, 22],  // #e97316
    red:    [239, 68, 68],   // #ef4444
    grey:   [115, 115, 115], // #737373
  };

  const [cr, cg, cb] = colors[color] || colors.grey;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const offset = (y * size + x) * 4;

      if (dist <= r) {
        // Anti-alias the edge
        const alpha = dist > r - 1 ? Math.round((r - dist) * 255) : 255;
        // Slight gradient: lighter at top-left
        const gradient = 1 + 0.15 * (1 - (dx + dy) / (2 * r));
        buf[offset]     = Math.min(255, Math.round(cr * gradient));
        buf[offset + 1] = Math.min(255, Math.round(cg * gradient));
        buf[offset + 2] = Math.min(255, Math.round(cb * gradient));
        buf[offset + 3] = alpha;
      }
    }
  }

  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

const icons = {};
function getIcon(status) {
  if (!icons[status]) {
    icons[status] = makeIcon(status);
  }
  return icons[status];
}

function buildTooltip(state) {
  if (!state) return '3Dify Monitor — connecting...';

  const parts = ['3Dify'];

  if (!state.workerConnected) {
    parts.push('Worker disconnected');
  } else if (state.paused) {
    parts.push('Paused');
  } else if (state.processing > 0) {
    parts.push(`${state.processing} job${state.processing > 1 ? 's' : ''} processing`);
  } else {
    parts.push('Idle');
  }

  if (state.gpuTemp != null) {
    parts.push(`GPU ${state.gpuTemp}°C`);
  }

  return parts.join(' — ');
}

function buildContextMenu(state) {
  const items = [];

  // Worker status
  const workerLabel = state?.workerConnected
    ? `Worker: Connected${state.gpuName ? ` (${state.gpuName})` : ''}`
    : 'Worker: Disconnected';
  items.push({ label: workerLabel, enabled: false });

  // GPU info
  if (state?.workerConnected && state.gpuVramFree != null) {
    items.push({
      label: `GPU: ${state.gpuVramFree}GB free, ${state.gpuTemp ?? '?'}°C, ${state.gpuUtil ?? '?'}%`,
      enabled: false,
    });
  }

  // Queue
  items.push({
    label: `Queue: ${state?.pending ?? 0} pending, ${state?.processing ?? 0} processing`,
    enabled: false,
  });

  items.push({ type: 'separator' });

  // Pause/Resume toggle
  if (state?.paused) {
    items.push({ label: 'Resume Processing', click: () => menuHandler('resume') });
  } else {
    items.push({ label: 'Pause Processing', click: () => menuHandler('pause') });
  }

  // Local worker start/stop
  if (state?.localWorkerRunning) {
    items.push({ label: 'Stop Local Worker', click: () => menuHandler('stop-worker') });
  } else {
    items.push({ label: 'Start Local Worker', click: () => menuHandler('start-worker') });
  }

  items.push({ type: 'separator' });

  items.push({ label: 'Open Admin Panel', click: () => menuHandler('open-admin') });
  items.push({ label: 'Open 3Dify', click: () => menuHandler('open-site') });

  items.push({ type: 'separator' });

  items.push({ label: 'Quit', click: () => menuHandler('quit') });

  return Menu.buildFromTemplate(items);
}

function getStatusColor(state) {
  if (!state || !state.workerConnected) return 'red';
  if (state.paused) return 'grey';
  if (state.processing > 0) return 'orange';
  return 'green';
}

let latestState = null;

function createTray(onClick, onMenuAction) {
  clickHandler = onClick;
  menuHandler = onMenuAction;

  tray = new Tray(getIcon('grey'));
  tray.setToolTip('3Dify Monitor — connecting...');

  tray.on('click', (_event, bounds) => {
    // On Windows, bounds from click event can be empty — use tray.getBounds() as fallback
    const b = (bounds && bounds.width > 0) ? bounds : tray.getBounds();
    if (clickHandler) clickHandler(b);
  });

  tray.on('double-click', (_event, bounds) => {
    const b = (bounds && bounds.width > 0) ? bounds : tray.getBounds();
    if (clickHandler) clickHandler(b);
  });

  // Single right-click handler that always uses latest state
  tray.on('right-click', () => {
    tray.popUpContextMenu(buildContextMenu(latestState));
  });
}

function updateTray(state) {
  if (!tray || tray.isDestroyed()) return;

  latestState = state;

  const status = getStatusColor(state);
  if (status !== currentStatus) {
    tray.setImage(getIcon(status));
    currentStatus = status;
  }

  tray.setToolTip(buildTooltip(state));
}

function destroyTray() {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { createTray, updateTray, destroyTray };
