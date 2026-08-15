// Run: node scripts/badgePlaytest.mjs   (needs the playtest build served on :4173)
//
// Badges award real leaderboard points, so this drives the whole chain in a
// browser rather than trusting the unit tests alone:
//   play games -> played_ flags written -> badge earned -> points added once
//   -> unlock overlay shown -> badge appears on the leaderboard
//
// Scores persist in sessionStorage (see scripts/playtest/firestore.js), so the
// five games below accumulate exactly as they would for one real player.

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const CHROME = [
  `${process.env.HOME}/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`,
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));

const GAMES = [
  { id: 'tech-recall', path: '/arcade/words', rounds: 8 },
  { id: 'tech-quiz', path: '/arcade/tech-quiz', rounds: 8 },
  { id: 'ai-eye', path: '/arcade/ai-eye', rounds: 10 },
  { id: 'guess-impostor', path: '/arcade/impostor', rounds: 6 },
  { id: 'prompt-wars', path: '/arcade/promptwars', rounds: 3 },
];

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
};

const readScores = (page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem('__playtest_arcade_scores__') || '{}'));

/**
 * Play one game to its results screen.
 *
 * Tech Recall needs real play: it flashes a word, and since a wrong guess no
 * longer ends the round, hammering the wrong answer just burns the full timer.
 * So the harness reads the flashed word and types it, which also exercises the
 * correct-answer path rather than only the timeout path.
 */
const playGame = async (page, game) => {
  await page.goto(`${BASE}${game.path}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^start (game|quiz)$/i }).click({ force: true }).catch(() => {});

  const deadline = Date.now() + 150_000;
  let flashed = '';

  while (Date.now() < deadline) {
    if (await page.getByText(/game over|quiz complete/i).count()) break;

    // Tech Recall: grab the word while it is on screen.
    const memo = page.getByText(/memorise the word/i);
    if (await memo.count()) {
      const word = await page.locator('main h2').first().innerText().catch(() => '');
      if (word) flashed = word.trim();
      await page.waitForTimeout(250);
      continue;
    }

    const wordBox = page.locator('input[placeholder="Type the word..."]');
    if (await wordBox.count()) {
      await wordBox.fill(flashed || 'firebase').catch(() => {});
      await page.getByRole('button', { name: /^submit$/i }).click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }

    const promptBox = page.locator('textarea#promptGuess');
    if (await promptBox.count()) {
      await promptBox.fill('a red apple on a wooden table').catch(() => {});
      await page.getByRole('button', { name: /submit guess/i }).click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      continue;
    }

    // Multiple choice / real-or-AI: tap an option.
    const options = page.locator('main button:visible');
    const n = await options.count();
    if (n > 0) {
      await options.nth(Math.floor(Math.random() * n)).click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2000); // let the save + badge sync land
};

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const errors = [];
  ctx.on('page', (p) => {
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  });
  const page = await ctx.newPage();

  // Capture badge unlock events as they fire, so we can prove the animation
  // was triggered even if it has faded by the time we look.
  await ctx.addInitScript(() => {
    window.__BADGES__ = [];
    window.addEventListener('badgeUnlocked', (e) =>
      window.__BADGES__.push(...(e.detail?.badges || []).map((b) => b.id))
    );
  });

  const uid = 'playtest-uid';
  let seenBadges = [];

  for (const [i, game] of GAMES.entries()) {
    await playGame(page, game);
    const scores = await readScores(page);
    const me = scores[uid] || {};
    const played = Object.keys(me).filter((k) => k.startsWith('played_')).length;
    const fired = await page.evaluate(() => window.__BADGES__ || []);
    seenBadges = [...new Set([...seenBadges, ...fired])];

    check(
      `${game.id}: marks the game as played`,
      me[`played_${game.id}`] === true,
      `${played} game(s) played, total=${me.totalScore ?? 0}`
    );

    // Triple Threat must land on the third distinct game, not before.
    if (i === 1) {
      check('no Triple Threat after only 2 games', !seenBadges.includes('triple-threat'));
    }
    if (i === 2) {
      check('Triple Threat unlocks on the 3rd game', seenBadges.includes('triple-threat'));
      check('Arcade Master NOT yet unlocked at 3 games', !seenBadges.includes('arcade-master'));
    }
  }

  const scores = await readScores(page);
  const me = scores[uid] || {};

  check('Arcade Master unlocks after all 5 games', (me.badges || []).includes('arcade-master'));
  check(
    'hunt badges NOT awarded from arcade play alone',
    !(me.badges || []).includes('treasure-hunter') && !(me.badges || []).includes('mega-champion')
  );

  // Badge points must be counted exactly once, and be part of the total.
  const expected = { 'triple-threat': 25, 'arcade-master': 50 };
  const badgeSum = (me.badges || []).reduce((s, id) => s + (expected[id] || 0), 0);
  check(
    'badge points credited once',
    me.badgePoints === badgeSum,
    `badgePoints=${me.badgePoints} expected=${badgeSum} badges=${(me.badges || []).join(',')}`
  );

  const gameSum = Object.entries(me)
    .filter(([k]) => k.startsWith('score_'))
    .reduce((s, [, v]) => s + v, 0);
  check(
    'totalScore = game points + badge points',
    me.totalScore === gameSum + (me.badgePoints || 0),
    `total=${me.totalScore} games=${gameSum} badges=${me.badgePoints}`
  );

  // Re-running a game must not pay for the same badge twice.
  const before = me.badgePoints;
  await playGame(page, GAMES[0]);
  const after = (await readScores(page))[uid];
  check(
    'replaying does not re-award badge points',
    after.badgePoints === before,
    `${before} -> ${after.badgePoints}`
  );

  // The unlock overlay must actually render.
  await page.goto(`${BASE}/arcade`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('badgeUnlocked', {
        detail: [{ id: 'x', name: 'Test Badge', icon: '🏅', points: 10, color: '#4285F4', description: 'demo' }],
      })
    );
    window.dispatchEvent(
      new CustomEvent('badgeUnlocked', {
        detail: {
          badges: [
            { id: 'demo', name: 'Arcade Master', icon: '🕹️', points: 50, color: '#EA4335', description: 'Play all 5 arcade games' },
          ],
        },
      })
    );
  });
  await page.waitForTimeout(900);
  const overlay = await page.getByText(/badge unlocked/i).count();
  check('unlock overlay renders', overlay > 0);
  const pts = await page.getByText('+50 points').count();
  check('unlock overlay shows the points', pts > 0);

  // Leaderboard shows the badge icons.
  await page.getByRole('button', { name: /view arcade leaderboard/i }).click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
  const board = await page.locator('body').innerText();
  check('leaderboard lists the player', /playtest|anonymous/i.test(board));

  const real = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/i.test(e));
  check('no page errors', real.length === 0, real.slice(0, 2).join(' | '));

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} badge checks passed`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
