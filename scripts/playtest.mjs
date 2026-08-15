// Run: node scripts/playtest.mjs            (needs `npx vite preview` on :4173)
//      node scripts/playtest.mjs --headed
//
// Serve the playtest build first:
//   npx vite build --config vite.playtest.config.js && npx vite preview --outDir dist-playtest --port 4173
//
// Drives the real built app in a real browser and plays every arcade game
// several times. Unit tests cover the scoring maths; this covers the parts
// maths cannot: timers actually firing, rounds advancing, the reveal screen
// clearing, and the game reaching a results screen instead of hanging.
//
// vite.playtest.config.js swaps Firebase for local mocks at build time, so
// nothing touches production and the player is treated as an approved admin -
// which is exactly the state a student is in once staff approve them.

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const HEADED = process.argv.includes('--headed');

const CHROME_CANDIDATES = [
  `${process.env.HOME}/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`,
  `${process.env.HOME}/.cache/ms-playwright/chromium-1208/chrome-linux/chrome`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) throw new Error('no chromium binary found');

const log = (...a) => console.log(...a);

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
};

const run = async () => {
  const browser = await chromium.launch({ executablePath, headless: !HEADED });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });

  // Surface real page errors - a silent React crash would otherwise look like
  // "the game just didn't advance".
  const pageErrors = [];
  ctx.on('page', (p) => {
    p.on('pageerror', (e) => pageErrors.push(e.message));
    p.on('console', (m) => {
      if (m.type() === 'error') pageErrors.push(m.text());
    });
  });

  const page = await ctx.newPage();

  const games = [
    { id: 'tech-quiz', path: '/arcade/tech-quiz', rounds: 8, start: /start quiz/i },
    { id: 'guess-impostor', path: '/arcade/impostor', rounds: 6, start: /start game/i },
    { id: 'ai-eye', path: '/arcade/ai-eye', rounds: 10, start: /start game/i },
    { id: 'tech-recall', path: '/arcade/words', rounds: 8, start: /start game/i },
    { id: 'prompt-wars', path: '/arcade/promptwars', rounds: 3, start: /start game/i },
  ];

  for (const game of games) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      pageErrors.length = 0;
      const label = `${game.id} run ${attempt}`;
      try {
        await page.goto(`${BASE}${game.path}`, { waitUntil: 'networkidle', timeout: 20000 });
        await page.getByRole('button', { name: game.start }).click({ timeout: 15000 });

        const played = await playGame(page, game);
        const crashed = pageErrors.filter((e) => !/favicon|net::ERR/i.test(e));
        record(
          label,
          played.reachedResults && crashed.length === 0,
          `${played.rounds} rounds, points=${played.points ?? '?'}${
            crashed.length ? `, errors: ${crashed.slice(0, 2).join(' | ')}` : ''
          }`
        );
      } catch (err) {
        record(label, false, err.message.split('\n')[0]);
      }
    }
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  log(`\n${results.length - failed.length}/${results.length} playthroughs passed`);
  process.exit(failed.length === 0 ? 0 : 1);
};

// Plays one game to its results screen, answering as it goes.
const playGame = async (page, game) => {
  let rounds = 0;
  let actions = 0;
  let pendingWord = null;
  const deadline = Date.now() + 240_000;
  const seen = (sel) => page.locator(sel).first().isVisible().catch(() => false);

  while (Date.now() < deadline) {
    // Results screen?
    if (await seen('text=/Arcade Points/i')) {
      const value = await page
        .locator('text=/Arcade Points/i')
        .first()
        .locator('xpath=following-sibling::*[1]')
        .innerText()
        .catch(() => null);
      return { reachedResults: true, rounds, points: value?.replace(/\s+/g, ' ').trim() };
    }

    // Any game can surface a failed image; recovering is part of the flow.
    const retry = page.getByRole('button', { name: /^retry$/i });
    if (await retry.isVisible().catch(() => false)) {
      await retry.click().catch(() => {});
      await page.waitForTimeout(200);
      continue;
    }

    let acted = false;

    if (game.id === 'tech-recall') {
      // Catch the word while it is flashing so we can answer correctly - that
      // exercises the win path and keeps the run inside the timers.
      if (await seen('text=/Memorise the word/i')) {
        const w = await page.locator('main h2').first().innerText().catch(() => null);
        if (w) pendingWord = w.trim();
      }
      const input = page.locator('input[placeholder="Type the word..."]');
      if (await input.isVisible().catch(() => false)) {
        const current = await input.inputValue().catch(() => '');
        if (pendingWord && current !== pendingWord) {
          await input.fill(pendingWord);
          await page.getByRole('button', { name: /^submit$/i }).click().catch(() => {});
          rounds++;
          pendingWord = null;
          acted = true;
        }
      }
    } else if (game.id === 'prompt-wars') {
      const ta = page.locator('#promptGuess');
      if ((await ta.isVisible().catch(() => false)) && (await ta.isEnabled().catch(() => false))) {
        await ta.fill('a red apple on a wooden table');
        await page.getByRole('button', { name: /submit guess/i }).click().catch(() => {});
        rounds++;
        acted = true;
      }
    } else if (game.id === 'ai-eye') {
      const btn = page.getByRole('button', { name: /^REAL$/ });
      if ((await btn.isVisible().catch(() => false)) && (await btn.isEnabled().catch(() => false))) {
        await btn.click().catch(() => {});
        rounds++;
        acted = true;
      }
    } else {
      const options = page.locator('main button:not([disabled])');
      const n = await options.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const b = options.nth(i);
        const text = (await b.innerText().catch(() => '')) || '';
        if (/arcade|back|play again|retry/i.test(text)) continue;
        await b.click().catch(() => {});
        rounds++;
        acted = true;
        break;
      }
    }

    actions++;
    // Poll fast enough to catch a ~2s flash, but pause after acting so the
    // reveal animation can finish.
    await page.waitForTimeout(acted ? 700 : 150);
    if (rounds > game.rounds + 2 || actions > 3000) break;
  }

  return { reachedResults: false, rounds, points: null };
};

run();
