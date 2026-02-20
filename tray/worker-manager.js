const { spawn, execSync } = require('child_process');

// Configuration — set via environment variables or .env file
const WSL_DISTRO = process.env.TRAY_WSL_DISTRO || 'Ubuntu-22.04';
const WORKER_DIR = process.env.TRAY_WORKER_DIR || '';
const CONDA_SH = process.env.TRAY_CONDA_SH || '';
const CONDA_ENV = process.env.TRAY_CONDA_ENV || 'hunyuan3d';

// Reject values that could be used for shell injection
const SHELL_UNSAFE = /[;&|`$(){}!<>\n\r]/;
function validatePaths() {
  for (const [name, val] of [['TRAY_WORKER_DIR', WORKER_DIR], ['TRAY_CONDA_SH', CONDA_SH], ['TRAY_CONDA_ENV', CONDA_ENV]]) {
    if (val && SHELL_UNSAFE.test(val)) {
      return `${name} contains unsafe characters`;
    }
  }
  return null;
}

let workerProcess = null;
let workerRunning = false;
let outputLines = [];
const MAX_OUTPUT_LINES = 200;

function isRunning() {
  return workerRunning && workerProcess !== null && workerProcess.exitCode === null;
}

function getOutput() {
  return outputLines.join('\n');
}

/**
 * Kill any orphaned worker.py processes in WSL.
 * Called on tray app startup to clean up from previous crashes/exits.
 */
function killOrphans() {
  try {
    execSync(
      `wsl -d ${WSL_DISTRO} -- bash -c "pkill -INT -f 'python worker.py' 2>/dev/null; exit 0"`,
      { windowsHide: true, timeout: 5000 },
    );
  } catch {
    // Ignore — no orphans or WSL not available
  }
}

function start() {
  if (isRunning()) {
    return { ok: false, error: 'Worker is already running' };
  }

  if (!WORKER_DIR || !CONDA_SH) {
    return {
      ok: false,
      error: 'Worker not configured. Set TRAY_WORKER_DIR and TRAY_CONDA_SH in .env',
    };
  }

  const pathErr = validatePaths();
  if (pathErr) {
    return { ok: false, error: pathErr };
  }

  outputLines = [];
  workerRunning = true;

  // Run python in foreground so stdout/stderr pipe through normally.
  // Use exec to replace bash with python so workerProcess.pid maps to the
  // actual python process (via WSL), enabling clean shutdown.
  const bashCmd =
    `source '${CONDA_SH}' && ` +
    `conda activate '${CONDA_ENV}' && ` +
    `cd '${WORKER_DIR}' && ` +
    `set -a && [ -f .env ] && source .env && set +a && ` +
    `exec python worker.py --preload`;

  workerProcess = spawn('wsl', ['-d', WSL_DISTRO, '--', 'bash', '-c', bashCmd], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  workerProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      outputLines.push(line);
      if (outputLines.length > MAX_OUTPUT_LINES) outputLines.shift();
    }
  });

  workerProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      outputLines.push('[stderr] ' + line);
      if (outputLines.length > MAX_OUTPUT_LINES) outputLines.shift();
    }
  });

  workerProcess.on('close', (code) => {
    workerRunning = false;
    outputLines.push(`[worker exited with code ${code}]`);
    workerProcess = null;
  });

  workerProcess.on('error', (err) => {
    workerRunning = false;
    outputLines.push(`[worker error: ${err.message}]`);
    workerProcess = null;
  });

  return { ok: true };
}

function stop() {
  if (!isRunning()) {
    return { ok: false, error: 'Worker is not running' };
  }

  try {
    // Send SIGINT to the WSL process tree via the Windows-side PID.
    // This propagates through WSL to the python process.
    workerProcess.kill('SIGINT');

    // Give it 5 seconds to shut down, then force kill
    setTimeout(() => {
      if (workerProcess && workerProcess.exitCode === null) {
        workerProcess.kill('SIGKILL');
        workerRunning = false;
        workerProcess = null;
      }
    }, 5000);
  } catch {
    if (workerProcess) {
      workerProcess.kill();
      workerRunning = false;
      workerProcess = null;
    }
  }

  return { ok: true };
}

/**
 * Force-stop the worker synchronously. Called during app quit
 * to ensure no orphan processes are left behind.
 */
function forceStop() {
  if (workerProcess && workerProcess.exitCode === null) {
    try {
      workerProcess.kill('SIGKILL');
    } catch {
      // ignore
    }
    workerProcess = null;
    workerRunning = false;
  }
  // Also kill any WSL-side orphans as a safety net
  killOrphans();
}

module.exports = { start, stop, forceStop, killOrphans, isRunning, getOutput };
