const { spawn } = require('child_process');

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
let workerPid = null; // Linux-side PID for targeted kill
let outputLines = [];
const MAX_OUTPUT_LINES = 200;

function isRunning() {
  return workerRunning && workerProcess !== null && workerProcess.exitCode === null;
}

function getOutput() {
  return outputLines.join('\n');
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
  workerPid = null;

  // Write the worker's PID to stdout on launch so we can kill it precisely later.
  // The 'echo $$' trick doesn't work here since bash -c forks python.
  // Instead, we use a wrapper that writes the python PID.
  const bashCmd =
    `source '${CONDA_SH}' && ` +
    `conda activate '${CONDA_ENV}' && ` +
    `cd '${WORKER_DIR}' && ` +
    `python worker.py --preload &` +
    `echo "PID:$!" && wait`;

  workerProcess = spawn('wsl', ['-d', WSL_DISTRO, '--', 'bash', '-c', bashCmd], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  workerProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      // Capture the Linux-side PID from our wrapper
      const pidMatch = line.match(/^PID:(\d+)$/);
      if (pidMatch) {
        workerPid = pidMatch[1];
      } else {
        outputLines.push(line);
        if (outputLines.length > MAX_OUTPUT_LINES) outputLines.shift();
      }
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
    workerPid = null;
    outputLines.push(`[worker exited with code ${code}]`);
    workerProcess = null;
  });

  workerProcess.on('error', (err) => {
    workerRunning = false;
    workerPid = null;
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
    if (workerPid) {
      // Kill the specific Linux-side PID, not a broad pkill pattern
      spawn('wsl', ['-d', WSL_DISTRO, '--', 'kill', '-INT', String(workerPid)], {
        windowsHide: true,
      });

      // Give it 5 seconds to shut down, then force kill
      const pid = workerPid;
      setTimeout(() => {
        if (workerProcess && workerProcess.exitCode === null) {
          spawn('wsl', ['-d', WSL_DISTRO, '--', 'kill', '-9', String(pid)], {
            windowsHide: true,
          });
          workerProcess.kill();
          workerRunning = false;
          workerPid = null;
          workerProcess = null;
        }
      }, 5000);
    } else {
      // Fallback: no PID captured, just kill the Windows-side process
      workerProcess.kill();
      workerRunning = false;
      workerProcess = null;
    }
  } catch {
    if (workerProcess) {
      workerProcess.kill();
      workerRunning = false;
      workerPid = null;
      workerProcess = null;
    }
  }

  return { ok: true };
}

module.exports = { start, stop, isRunning, getOutput };
