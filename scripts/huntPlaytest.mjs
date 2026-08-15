// Run: node scripts/huntPlaytest.mjs   (needs the playtest build served on :4173)
//
// Drives the Mystery Hunt board in a real browser against the seeded fixture in
// scripts/playtest/firestore.js (levels 1-8 already claimed by other people).
// Checks the rules that decide who wins a prize:
//   - all 9 normal levels are reachable, not sequential
//   - a level already won by somebody else is dead
//   - a wrong code is rejected
//   - the right code claims the level and reveals that level's form
//   - the mega level stays sealed at 8/9 and opens at 9/9

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const CHROME = [
  `${process.env.HOME}/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`,
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
};

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const errors = [];
  ctx.on('page', (p) => {
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  });
  await ctx.addInitScript(() => {
    window.__BADGES__ = [];
    window.addEventListener('badgeUnlocked', (e) =>
      window.__BADGES__.push(...(e.detail?.badges || []).map((b) => b.id))
    );
  });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/mystery-hunt`, { waitUntil: 'networkidle' });
  // Dismiss the rules card.
  await page.getByRole('button', { name: /let the hunt begin/i }).click().catch(() => {});
  await page.waitForTimeout(600);

  const openLevel = async (n) => {
    // Open nodes bob continuously to invite a tap, which Playwright reads as
    // "not stable" - force past its stability wait rather than kill the motion.
    await page.locator(`button[aria-label^="Level ${n},"]`).click({ force: true });
    await page.waitForTimeout(400);
  };
  const closeModal = async () => {
    await page.locator('.fixed.z-\\[100\\] button').first().click().catch(() => {});
    await page.waitForTimeout(300);
  };

  // --- progress counter reflects the 8 pre-claimed levels ---
  const counter = await page.locator('text=/\\d\\/9 claimed/').first().innerText();
  check('board shows 8/9 claimed', counter.includes('8/9'), counter);

  // --- a level won by someone else is dead ---
  await openLevel(3);
  const takenText = await page.locator('.fixed.z-\\[100\\]').innerText();
  check(
    'level claimed by another player is closed',
    /already claimed/i.test(takenText) && !/enter secret code/i.test(takenText.toLowerCase())
  );
  await closeModal();

  // --- mega level sealed at 8/9 ---
  await openLevel(10);
  const megaLocked = await page.locator('.fixed.z-\\[100\\]').innerText();
  check(
    'mega level sealed at 8/9',
    /sealed/i.test(megaLocked) && /8 of 9/i.test(megaLocked),
    megaLocked.replace(/\s+/g, ' ').slice(0, 60)
  );
  await closeModal();

  // --- an open level shows its clue and takes a code ---
  await openLevel(9);
  const openText = await page.locator('.fixed.z-\\[100\\]').innerText();
  check('open level shows its clue', /Clue for level 9/i.test(openText));

  // --- wrong code rejected ---
  await page.locator('input[placeholder="Enter Secret Code"]').fill('NOPE');
  await page.getByRole('button', { name: /claim level/i }).click();
  await page.waitForTimeout(600);
  const afterWrong = await page.locator('.fixed.z-\\[100\\]').innerText();
  check('wrong code rejected', /incorrect code/i.test(afterWrong));

  // --- correct code claims it and reveals that level's form ---
  await page.locator('input[placeholder="Enter Secret Code"]').fill('code9');
  await page.getByRole('button', { name: /claim level/i }).click();
  await page.waitForTimeout(900);
  const afterRight = await page.locator('.fixed.z-\\[100\\]').innerText();
  check('correct code claims the level', /you claimed this level/i.test(afterRight));

  const formHref = await page
    .locator('.fixed.z-\\[100\\] a')
    .first()
    .getAttribute('href')
    .catch(() => null);
  check('winner gets the right form link', formHref === 'https://forms.gle/level-9', formHref);
  // Lower-case entry must work - students type on phone keyboards.
  check('code entry is case-insensitive', /you claimed this level/i.test(afterRight));
  await closeModal();

  // --- mega unlocks now that all 9 are claimed ---
  const counterAfter = await page.locator('text=/\\d\\/9 claimed/').first().innerText();
  check('counter updates to 9/9', counterAfter.includes('9/9'), counterAfter);

  await openLevel(10);
  const megaOpen = await page.locator('.fixed.z-\\[100\\]').innerText();
  check(
    'mega level unlocks at 9/9',
    /Clue for level 10/i.test(megaOpen) && !/sealed/i.test(megaOpen)
  );
  await closeModal();

  // --- cracking a level must award the Treasure Hunter badge ---
  await page.waitForTimeout(1500);
  const badges = await page.evaluate(() => window.__BADGES__ || []);
  check('claiming a level awards Treasure Hunter', badges.includes('treasure-hunter'), badges.join(','));
  check(
    'Mega Champion NOT awarded for a normal level',
    !badges.includes('mega-champion'),
    badges.join(',')
  );
  const scores = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__playtest_arcade_scores__') || '{}')
  );
  const me = scores['playtest-uid'] || {};
  check('hunt badge adds its points to the total', me.totalScore === 40, `total=${me.totalScore}`);
  check(
    'arcade-only badges NOT given for a hunt win',
    !(me.badges || []).includes('arcade-master') && !(me.badges || []).includes('triple-threat'),
    (me.badges || []).join(',')
  );

  const real = errors.filter((e) => !/favicon|net::ERR/i.test(e));
  check('no page errors', real.length === 0, real.slice(0, 2).join(' | '));

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} hunt checks passed`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
