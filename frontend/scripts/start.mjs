// One-step start for teammates: `npm start` or double-click start-windows.bat.
// 1. checks the Node.js version Vite needs,
// 2. installs packages on the first run and again whenever package-lock.json changes,
// 3. starts the dev server and opens the site in the default browser.
// Extra arguments go to Vite, e.g. `npm start -- --host` to open it from a phone on the same Wi-Fi.
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const lockFile = path.join(root, 'package-lock.json');
const stampFile = path.join(root, 'node_modules', '.pointer-install-stamp');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
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

console.log('\n  Starting POINTER… your browser opens in a few seconds.');
console.log('  Keep this window open while you use the site. Close it (or press Ctrl+C) to stop.\n');

const vite = spawn(process.execPath, [viteBin, '--open', ...process.argv.slice(2)], {
  cwd: root, stdio: 'inherit',
});
vite.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => vite.kill(signal));
