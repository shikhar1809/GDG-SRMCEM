// Run: node scripts/attemptsPlaytest.mjs   (needs the playtest build on :4173)
//
// Walks the flow a real student goes through, as a NON-admin (?asPlayer=1):
//   request to play -> staff approve -> attempt 1 -> attempt 2 -> locked out
//
// The 2-attempt rule decides who gets a second shot at a prize, so it is driven
// in a browser rather than trusted to the unit tests.

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const CHROME = [
  `${process.env.HOME}/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`,
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));

const GAME = '/arcade/impostor?asPlayer=1';
const REQ_ID = 'playtest-uid_guess-impostor';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
};

const readRequest = (page) =>
  page.evaluate(
    (id) => JSON.parse(sessionStorage.getItem('__playtest_game_requests__') || '{}')[id] || null,
    REQ_ID
  );

/** Stand in for a volunteer tapping Approve in the admin panel. */
const approve = (page) =>
  page.evaluate((id) => {
    const all = JSON.parse(sessionStorage.getItem('__playtest_game_requests__') || '{}');
    all[id] = { ...(all[id] || {}), status: 'approved' };
    sessionStorage.setItem('__playtest_game_requests__', JSON.stringify(all));
  }, REQ_ID);

const playRound = async (page) => {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await page.getByText(/game over/i).count()) break;
    const options = page.locator('main button:visible');
    const n = await options.count();
    if (n > 0) await options.nth(Math.floor(Math.random() * n)).click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1800);
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

  // --- a student who has not asked yet cannot play ---
  await page.goto(`${BASE}${GAME}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  let body = await page.locator('body').innerText();
  check('player sees the stall gate, not the game', /visit our stall/i.test(body));
  check('gate advertises the attempt allowance', /2 attempts/i.test(body));
  check('no way to start without approval', !/^start game$/im.test(body));

  // --- request, then wait for staff ---
  await page.getByRole('button', { name: /request to play/i }).click({ force: true });
  await page.waitForTimeout(900);
  body = await page.locator('body').innerText();
  check('request shows the waiting state', /waiting for admin approval/i.test(body));
  check('a lobby code is shown to read out', /lobby code/i.test(body));
  let req = await readRequest(page);
  check('request is created as pending with 0 attempts', req?.status === 'pending' && req?.attemptsUsed === 0);

  // --- staff approve: the game waits for the player to tap Start ---
  await approve(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  body = await page.locator('body').innerText();
  check('approval does NOT auto-start the game', !/round 1 of/i.test(body));
  check('approved gate offers Start', /start game/i.test(body), body.replace(/\s+/g, ' ').slice(0, 70));

  await page.getByRole('button', { name: /^start game$/i }).click({ force: true });
  await page.waitForTimeout(800);
  check('attempt 1 begins on tap', (await page.getByText(/round 1 of/i).count()) > 0);
  await playRound(page);
  req = await readRequest(page);
  check('attempt 1 is recorded', req?.attemptsUsed === 1, `attemptsUsed=${req?.attemptsUsed}`);
  check('session stays open for attempt 2', req?.status === 'approved', `status=${req?.status}`);

  // --- attempt 2 must NOT auto-start, or it would relaunch under the player ---
  await page.goto(`${BASE}${GAME}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  body = await page.locator('body').innerText();
  check('attempt 2 does not auto-start', !/round 1 of/i.test(body));
  check('gate offers attempt 2', /attempt 2/i.test(body), body.replace(/\s+/g, ' ').slice(0, 80));

  await page.getByRole('button', { name: /start attempt 2/i }).click({ force: true });
  await page.waitForTimeout(800);
  await playRound(page);
  req = await readRequest(page);
  check('attempt 2 is recorded', req?.attemptsUsed === 2, `attemptsUsed=${req?.attemptsUsed}`);
  check('session closes after the last attempt', req?.status === 'completed', `status=${req?.status}`);

  // --- third go must be refused ---
  await page.goto(`${BASE}${GAME}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  body = await page.locator('body').innerText();
  check('third attempt is refused', /all 2 attempts used/i.test(body), body.replace(/\s+/g, ' ').slice(0, 80));
  check('no start button once used up', !/start attempt/i.test(body));

  const real = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/i.test(e));
  check('no page errors', real.length === 0, real.slice(0, 2).join(' | '));

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} attempt checks passed`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
