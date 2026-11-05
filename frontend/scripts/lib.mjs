// Shared helpers for the optimize:* scripts.
// All paths go through node:path, so Windows backslashes and spaces are safe.
// External tools are spawned without a shell, so no quoting is needed.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RAW = path.join(ROOT, 'assets', 'raw');
export const WORK = path.join(ROOT, 'assets', 'work');
export const PUBLIC = path.join(ROOT, 'public');

export const argv = process.argv.slice(2);
export const hasFlag = (name) => argv.includes(`--${name}`);
export const FORCE = hasFlag('force');

export const rel = (p) => path.relative(ROOT, p) || '.';

/** Recursively list files under `dir` whose extension is in `exts`. Missing dir → []. */
export function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const wanted = exts.map((e) => e.toLowerCase());
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, exts));
    else if (wanted.includes(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out.sort();
}

export function noFiles(dir, exts) {
  console.log(`no files — ${rel(dir)} ထဲမှာ ${exts.join(' / ')} မရှိပါ`);
}

/** Output folder that mirrors the file's sub-folder under `srcRoot`. */
export function mirrorDir(file, srcRoot, destRoot) {
  const dir = path.join(destRoot, path.dirname(path.relative(srcRoot, file)));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** True when every output exists and is newer than the source (skip unless --force). */
export function isUpToDate(src, outputs) {
  if (FORCE) return false;
  const srcTime = fs.statSync(src).mtimeMs;
  return outputs.every((o) => fs.existsSync(o) && fs.statSync(o).mtimeMs >= srcTime);
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}

export const sizeOf = (p) => fs.statSync(p).size;

/** Run a program and collect its output. Rejects on non-zero exit. */
export function run(cmd, args, { echo = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; if (echo) process.stdout.write(d); });
    child.stderr.on('data', (d) => { stderr += d; if (echo) process.stderr.write(d); });
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        err.message = `"${cmd}" ကို PATH ထဲမှာ မတွေ့ပါ။ install ပြီးကာစဆိုရင် terminal ကို restart လုပ်ပါ။`;
      }
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(cmd)} exited with code ${code}\n${stderr.trim().split('\n').slice(-15).join('\n')}`));
    });
  });
}

/** Process files one at a time (keeps memory low on an 8GB machine) and report failures. */
export async function eachFile(files, fn) {
  let failed = 0;
  for (const file of files) {
    try {
      await fn(file);
    } catch (err) {
      failed++;
      console.error(`✗ ${rel(file)}: ${err.message}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} file(s) failed`);
    process.exitCode = 1;
  }
}
