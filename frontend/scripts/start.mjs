// One-step start for teammates: `npm start` or double-click start-windows.bat.
// 1. checks the Node.js version Vite needs,
// 2. installs packages on the first run and again whenever package-lock.json changes,
// 3. ensures the PHP API server (localhost:8000) is running if PHP is installed,
// 4. starts the dev server and opens the site in the default browser.
// Extra arguments go to Vite, e.g. `npm start -- --host` to open it from a phone on the same Wi-Fi.
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(root, '..');
const lockFile = path.join(root, 'package-lock.json');
const stampFile = path.join(root, 'node_modules', '.pointer-install-stamp');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function isPortListening(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(350);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function findPhpBinary() {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['php'], { encoding: 'utf8' });
  if (probe.status === 0 && probe.stdout.trim()) {
    return probe.stdout.trim().split(/\r?\n/)[0].trim();
  }
  const candidates = process.platform === 'win32'
    ? ['C:\\xampp\\php\\php.exe', 'C:\\wamp64\\bin\\php\\php8.3.0\\php.exe', 'C:\\laragon\\bin\\php\\php.exe']
    : ['/opt/homebrew/bin/php', '/usr/local/bin/php', '/usr/bin/php', '/Applications/XAMPP/xamppfiles/bin/php'];
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

// Vite 8 needs Node 20.19+ or 22.12+.
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;
if (!nodeOk) {
  fail(`Node.js ${process.versions.node} is too old. Install the current LTS version:\n`
    + '    winget install OpenJS.NodeJS.LTS     (or download it from https://nodejs.org)\n'
    + '  then close this window and start again.');
}

const lockHash = createHash('sha256').update(fs.readFileSync(lockFile)).digest('hex');
const installed = fs.existsSync(viteBin)
  && fs.existsSync(stampFile)
  && fs.readFileSync(stampFile, 'utf8').trim() === lockHash;

if (!installed) {
  console.log('\n  Installing packages (first run or packages changed) — this takes a minute…\n');
  // npm is npm.cmd on Windows, which needs a shell; one fixed command string, no user input.
  const result = spawnSync('npm install --no-audit --no-fund', { cwd: root, stdio: 'inherit', shell: true });
  if (result.status !== 0) fail('npm install failed. Check your internet connection and try again.');
  fs.writeFileSync(stampFile, `${lockHash}\n`);
}

let phpProc = null;
const apiAlreadyUp = await isPortListening(8000);
if (apiAlreadyUp) {
  console.log('  Using running PHP API server at http://localhost:8000');
} else {
  const phpBin = findPhpBinary();
  if (phpBin) {
    phpProc = spawn(phpBin, ['-S', 'localhost:8000'], { cwd: repoRoot, stdio: ['ignore', 'ignore', 'pipe'] });
    phpProc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (/error|fatal|failed|address already in use/i.test(text)) process.stderr.write(`  [php] ${text}`);
    });
    await new Promise((r) => setTimeout(r, 350));
    if (await isPortListening(8000)) {
      console.log('  Started PHP API server at http://localhost:8000');
    }
  } else {
    console.warn('  Warning: `php` command not found — start PHP/XAMPP manually (`php -S localhost:8000`) for API calls.');
  }
}

console.log('\n  Starting POINTER… your browser opens in a few seconds.');
console.log('  Keep this window open while you use the site. Close it (or press Ctrl+C) to stop.\n');

const vite = spawn(process.execPath, [viteBin, '--open', ...process.argv.slice(2)], {
  cwd: root, stdio: 'inherit',
});
const cleanup = () => {
  if (phpProc && !phpProc.killed) phpProc.kill();
};
vite.on('exit', (code) => {
  cleanup();
  process.exit(code ?? 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    cleanup();
    vite.kill(signal);
  });
}
