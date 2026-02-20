const { Notification } = require('electron');

// Dedup: track recent notification keys to avoid spam
const recentKeys = new Map();
const DEDUP_WINDOW_MS = 30_000; // 30 seconds

function notify(title, body) {
  // Dedup check
  const key = `${title}::${body}`;
  const now = Date.now();

  if (recentKeys.has(key) && now - recentKeys.get(key) < DEDUP_WINDOW_MS) {
    return; // Suppress duplicate
  }
  recentKeys.set(key, now);

  // Clean old entries
  for (const [k, t] of recentKeys) {
    if (now - t > DEDUP_WINDOW_MS) recentKeys.delete(k);
  }

  if (!Notification.isSupported()) return;

  const n = new Notification({
    title,
    body,
    icon: undefined, // Uses app icon
    silent: false,
  });

  n.show();
}

module.exports = { notify };
