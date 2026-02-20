const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

let config = null;

function load() {
  if (config) return config;

  // Defaults
  config = {
    serverUrl: process.env.SERVER_URL || '',
    pollInterval: 5000,
    token: null,
  };

  // Try loading saved config
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      config.serverUrl = saved.serverUrl || config.serverUrl;
      config.pollInterval = saved.pollInterval || config.pollInterval;

      // Decrypt stored token
      if (saved.encryptedToken && safeStorage.isEncryptionAvailable()) {
        const buf = Buffer.from(saved.encryptedToken, 'base64');
        config.token = safeStorage.decryptString(buf);
      }
    }
  } catch {
    // Corrupted config — start fresh
  }

  return config;
}

function save() {
  const toSave = {
    serverUrl: config.serverUrl,
    pollInterval: config.pollInterval,
  };

  // Encrypt token if available
  if (config.token && safeStorage.isEncryptionAvailable()) {
    toSave.encryptedToken = safeStorage.encryptString(config.token).toString('base64');
  }

  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2));
}

function setToken(token) {
  config.token = token;
  save();
}

function clearToken() {
  config.token = null;
  // Remove encryptedToken from saved file
  save();
}

function getServerUrl() {
  return load().serverUrl;
}

function setServerUrl(url) {
  const cleaned = url.replace(/\/+$/, '');
  // Only allow http/https schemes to prevent file://, javascript:, etc.
  if (!/^https?:\/\//i.test(cleaned)) {
    throw new Error('Server URL must start with http:// or https://');
  }
  config.serverUrl = cleaned;
  save();
}

function getToken() {
  return load().token;
}

module.exports = { load, save, setToken, clearToken, getServerUrl, setServerUrl, getToken };
