// Downloads every AI Eye / Prompt Wars image into public/game-images/ so the
// stall serves them from Firebase Hosting instead of hitting pollinations.ai
// and picsum.photos live from 50 phones on shared wifi.
//
// Run: node scripts/fetchGameImages.mjs        (skips files already present)
//      node scripts/fetchGameImages.mjs --force (re-downloads everything)
//
// pollinations generates on demand and can take 10-30s per image, so this is
// slow and sequential on purpose. Re-run it if it reports failures.

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AI_EYE_IMAGES } from '../src/utils/gameData/aiEyeData.js';
import { PROMPT_CHALLENGES } from '../src/utils/gameData/promptWarsData.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const MIN_BYTES = 3000; // anything smaller is an error page, not a photo

const targets = [
  ...AI_EYE_IMAGES.map((i) => ({ src: i.src, url: i.remoteUrl })),
  ...PROMPT_CHALLENGES.map((c) => ({ src: c.src, url: c.remoteUrl })),
];

const exists = async (p) => {
  try {
    const s = await stat(p);
    return s.size >= MIN_BYTES;
  } catch {
    return false;
  }
};

const fetchWithRetry = async (url, attempts = 3) => {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_BYTES) throw new Error(`too small (${buf.length}b)`);
      return buf;
    } catch (err) {
      lastErr = err;
      if (i < attempts) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw lastErr;
};

let ok = 0;
let skipped = 0;
const failed = [];

for (const [idx, t] of targets.entries()) {
  const out = join(root, 'public', t.src);
  const label = `[${idx + 1}/${targets.length}] ${t.src}`;

  if (!force && (await exists(out))) {
    skipped++;
    console.log(`${label} - already present`);
    continue;
  }

  try {
    await mkdir(dirname(out), { recursive: true });
    const buf = await fetchWithRetry(t.url);
    await writeFile(out, buf);
    ok++;
    console.log(`${label} - ${(buf.length / 1024).toFixed(0)}kb`);
  } catch (err) {
    failed.push({ src: t.src, reason: err.message });
    console.error(`${label} - FAILED: ${err.message}`);
  }
}

console.log(`\ndownloaded ${ok}, skipped ${skipped}, failed ${failed.length}`);
if (failed.length) {
  console.error('re-run to retry:', failed.map((f) => f.src).join(', '));
  process.exit(1);
}
