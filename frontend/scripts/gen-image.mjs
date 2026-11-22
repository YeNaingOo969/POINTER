// Generate images with Cloudflare Workers AI (FLUX) and save them to assets/generated.
// Drafts stay out of assets/raw so optimize:images doesn't publish them; move the
// picked ones into assets/raw/images yourself.
//
// Usage:
//   npm run gen:image -- "prompt" [options]
//
// Options:
//   --model <m>   klein (default, FLUX.2 klein 4B, supports --ref), klein-9b, schnell (FLUX.1, fast, no refs)
//   --ref <file>  reference image (repeat up to 4×). Refer to them in the prompt as "image 0", "image 1"...
//   --w / --h     output size, 256–1920 (default 1024×1024)
//   --n <count>   number of variations (default 1), each with its own seed
//   --seed <int>  seed for the first variation (reproducible output)
//   --guidance <float>  FLUX.2 only: higher = follows the prompt more closely
//   --name <slug> file name prefix (default: from the prompt)
//   --out <dir>   output folder (default assets/generated)
//   --dry-run     validate everything and print the request, without calling the API
//
// Credentials come from CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN in the environment
// or the project .env file (see .env.example). They are never printed.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { ROOT, rel, formatBytes } from './lib.mjs';

const MODELS = {
  klein: { id: '@cf/black-forest-labs/flux-2-klein-4b', multipart: true },
  'klein-9b': { id: '@cf/black-forest-labs/flux-2-klein-9b', multipart: true },
  schnell: { id: '@cf/black-forest-labs/flux-1-schnell', multipart: false },
};
const MAX_REFS = 4;
const REF_MAX_SIDE = 511; // FLUX.2 requires every input image to be smaller than 512x512

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: 'string', default: 'klein' },
    ref: { type: 'string', multiple: true, default: [] },
    w: { type: 'string', default: '1024' },
    h: { type: 'string', default: '1024' },
    n: { type: 'string', default: '1' },
    seed: { type: 'string' },
    guidance: { type: 'string' },
    name: { type: 'string' },
    out: { type: 'string', default: path.join(ROOT, 'assets', 'generated') },
    'dry-run': { type: 'boolean', default: false },
  },
});

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const prompt = positionals.join(' ').trim();
if (!prompt) fail('prompt မပါပါ။ ဥပမာ: npm run gen:image -- "a red map pin icon, flat vector"');
if (prompt.length > 2048) fail('prompt က 2048 စာလုံးထက် ရှည်နေပါတယ်');

const model = MODELS[opt.model];
if (!model) fail(`--model က ${Object.keys(MODELS).join(' / ')} ထဲက တစ်ခု ဖြစ်ရပါမယ်`);
if (opt.ref.length && !model.multipart) fail(`--ref ကို ${opt.model} မှာ မသုံးနိုင်ပါ။ --model klein ကို သုံးပါ`);
if (opt.ref.length > MAX_REFS) fail(`--ref အများဆုံး ${MAX_REFS} ပုံ`);

const width = Number(opt.w);
const height = Number(opt.h);
const count = Number(opt.n);
for (const [k, v] of [['--w', width], ['--h', height]]) {
  if (!Number.isInteger(v) || v < 256 || v > 1920) fail(`${k} က 256–1920 ဖြစ်ရပါမယ်`);
}
if (!Number.isInteger(count) || count < 1 || count > 8) fail('--n က 1–8 ဖြစ်ရပါမယ်');
const firstSeed = opt.seed ? Number(opt.seed) : Math.floor(Math.random() * 2 ** 31);

// ---- credentials ----
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!opt['dry-run'] && (!ACCOUNT || !TOKEN)) {
  fail(`CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN မတွေ့ပါ။ ${rel(envFile)} ထဲမှာ ထည့်ပါ (.env.example ကြည့်ပါ)`);
}

// ---- reference images: shrink below 512px and send as PNG ----
const refs = [];
for (const file of opt.ref) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) fail(`reference မတွေ့ပါ: ${file}`);
  const buf = await sharp(abs)
    .rotate()
    .resize({ width: REF_MAX_SIDE, height: REF_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  refs.push({ file: abs, data: buf.data, size: `${buf.info.width}x${buf.info.height}` });
}

const slug = (opt.name ?? prompt)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 40) || 'image';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');

const sizeNote = model.multipart ? `${width}x${height}` : 'default size (schnell ignores --w/--h)';
console.log(`model ${opt.model} (${model.id}), ${sizeNote}, ${count} image(s), seed ${firstSeed}`);
refs.forEach((r, i) => console.log(`  image ${i}: ${rel(r.file)} → ${r.size}`));

if (opt['dry-run']) {
  console.log(`dry run — API ကို မခေါ်ပါ။ output: ${rel(path.join(opt.out, `${slug}-${stamp}-1`))}.*`);
  process.exit(0);
}

async function generate(seed) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${model.id}`;
  let body;
  if (model.multipart) {
    body = new FormData();
    body.append('prompt', prompt);
    body.append('width', String(width));
    body.append('height', String(height));
    body.append('seed', String(seed));
    if (opt.guidance) body.append('guidance', opt.guidance);
    refs.forEach((r, i) => body.append(`input_image_${i}`, new Blob([r.data], { type: 'image/png' }), `ref${i}.png`));
  } else {
    // FLUX.1 schnell takes JSON and has no width/height; steps max 8.
    body = JSON.stringify({ prompt, seed, steps: 8 });
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(model.multipart ? {} : { 'Content-Type': 'application/json' }),
    },
    body,
  });

  const type = res.headers.get('content-type') ?? '';
  if (type.startsWith('image/')) return Buffer.from(await res.arrayBuffer());

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const errors = json?.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || res.statusText;
    const hint = res.status === 429 ? ' (rate limit / နေ့စဉ် free limit ပြည့်နိုင်တယ်)'
      : res.status === 401 || res.status === 403 ? ' (token ကို Workers AI permission နဲ့ စစ်ပါ)' : '';
    throw new Error(`HTTP ${res.status} ${errors}${hint}`);
  }
  const b64 = json.result?.image;
  if (!b64) throw new Error('response ထဲမှာ image မပါပါ');
  return Buffer.from(b64, 'base64');
}

const extOf = (buf) =>
  buf[0] === 0x89 && buf[1] === 0x50 ? 'png'
    : buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg'
      : buf.subarray(8, 12).toString() === 'WEBP' ? 'webp' : 'bin';

fs.mkdirSync(opt.out, { recursive: true });
let failed = 0;
for (let i = 0; i < count; i++) {
  const seed = firstSeed + i;
  try {
    const img = await generate(seed);
    const base = path.join(opt.out, `${slug}-${stamp}-${i + 1}`);
    const file = `${base}.${extOf(img)}`;
    fs.writeFileSync(file, img);
    // Sidecar with everything needed to reproduce or iterate on this image.
    fs.writeFileSync(`${base}.json`, JSON.stringify({
      prompt, model: model.id, width, height, seed,
      guidance: opt.guidance ? Number(opt.guidance) : undefined,
      refs: refs.map((r) => rel(r.file)),
      created: new Date().toISOString(),
    }, null, 2));
    console.log(`✓ ${rel(file)} (${formatBytes(img.length)}, seed ${seed})`);
  } catch (err) {
    failed++;
    console.error(`✗ seed ${seed}: ${err.message}`);
    if (/HTTP (401|403|429)/.test(err.message)) break; // retrying won't help
  }
}
if (failed) process.exitCode = 1;
