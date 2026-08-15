// Run: node src/utils/gameData/gameData.test.mjs
// Validates the question banks against what the games actually draw, so a
// malformed or too-thin bank fails here rather than in front of a queue.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TECH_QUIZ_QUESTIONS } from './techQuizData.js';
import { GUESS_IMPOSTOR_QUESTIONS } from './guessImpostorData.js';
import { TECH_RECALL_WORDS } from './techRecallData.js';
import { AI_EYE_IMAGES } from './aiEyeData.js';
import { PROMPT_CHALLENGES } from './promptWarsData.js';
import { contentWords, drawGradedSet, promptSimilarity } from '../scoring.js';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../../../public');
const TIERS = ['easy', 'medium', 'hard'];
const countTier = (pool, tier) => pool.filter((x) => x.difficulty === tier).length;

// Each game must be able to fill its profile many times over, or repeat draws
// start colliding and the queue sees the same questions all afternoon.
const requireDepth = (name, pool, profile, factor = 3) => {
  for (const tier of TIERS) {
    const need = (profile[tier] || 0) * factor;
    if (need === 0) continue;
    assert.ok(
      countTier(pool, tier) >= need,
      `${name}: needs >= ${need} ${tier} items for variety, has ${countTier(pool, tier)}`
    );
  }
  // And the profile must actually be satisfiable.
  const drawn = drawGradedSet(pool, profile);
  const wanted = TIERS.reduce((a, t) => a + (profile[t] || 0), 0);
  assert.equal(drawn.length, wanted, `${name}: cannot fill its draw profile`);
};

// --- Tech Quiz -------------------------------------------------------------
{
  const pool = TECH_QUIZ_QUESTIONS;
  assert.ok(pool.length >= 30, 'quiz bank too small');
  for (const q of pool) {
    assert.ok(q.question?.length > 5, `bad question: ${q.question}`);
    assert.equal(q.options.length, 4, `needs 4 options: ${q.question}`);
    assert.equal(new Set(q.options).size, 4, `duplicate options: ${q.question}`);
    assert.ok(
      Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4,
      `bad correctIndex: ${q.question}`
    );
    assert.ok(TIERS.includes(q.difficulty), `bad difficulty: ${q.question}`);
    for (const o of q.options) assert.ok(o?.trim().length > 0, `empty option: ${q.question}`);
  }
  assert.equal(new Set(pool.map((q) => q.question)).size, pool.length, 'duplicate questions');
  requireDepth('tech-quiz', pool, { easy: 4, medium: 3, hard: 1 });
}

// --- Guess The Impostor ----------------------------------------------------
{
  const pool = GUESS_IMPOSTOR_QUESTIONS;
  assert.ok(pool.length >= 30, 'impostor bank too small');
  for (const q of pool) {
    assert.equal(q.items.length, 4, `needs 4 items: ${q.category}`);
    assert.equal(new Set(q.items).size, 4, `duplicate items: ${q.category}`);
    assert.ok(
      Number.isInteger(q.impostorIndex) && q.impostorIndex >= 0 && q.impostorIndex < 4,
      `bad impostorIndex: ${q.category}`
    );
    assert.ok(q.reason?.length > 10, `reason too thin: ${q.category}`);
    assert.ok(TIERS.includes(q.difficulty), `bad difficulty: ${q.category}`);
  }
  // The original bug: impostorIndex was 3 in all 50 questions. Runtime shuffling
  // is the real fix, but a flat bank means a stale build leaks every answer.
  const spread = new Set(pool.map((q) => q.impostorIndex));
  assert.ok(spread.size >= 3, `impostorIndex barely varies in the bank: ${[...spread]}`);
  requireDepth('guess-impostor', pool, { easy: 2, medium: 3, hard: 1 });
}

// --- Tech Recall -----------------------------------------------------------
{
  const pool = TECH_RECALL_WORDS;
  for (const w of pool) {
    assert.ok(/^[A-Za-z][A-Za-z ]*$/.test(w.word), `word must be plain letters: ${w.word}`);
    assert.ok(w.word.length >= 5, `too short to be a memory test: ${w.word}`);
    assert.ok(TIERS.includes(w.difficulty), `bad difficulty: ${w.word}`);
  }
  assert.equal(
    new Set(pool.map((w) => w.word.toLowerCase())).size,
    pool.length,
    'duplicate words'
  );
  // Tiers must actually differ in length, or the ramp is a lie.
  const avgLen = (t) => {
    const ws = pool.filter((w) => w.difficulty === t);
    return ws.reduce((a, w) => a + w.word.length, 0) / ws.length;
  };
  assert.ok(avgLen('easy') < avgLen('medium'), 'medium words must be longer than easy');
  assert.ok(avgLen('medium') < avgLen('hard'), 'hard words must be longer than medium');
  requireDepth('tech-recall', pool, { easy: 3, medium: 3, hard: 2 });
}

// --- AI Eye ----------------------------------------------------------------
{
  const pool = AI_EYE_IMAGES;
  const aiSet = pool.filter((i) => i.isAI);
  const realSet = pool.filter((i) => !i.isAI);
  assert.ok(aiSet.length >= 10, 'need at least 10 AI images to draw 5 with variety');
  assert.ok(realSet.length >= 10, 'need at least 10 real images to draw 5 with variety');
  assert.equal(new Set(pool.map((i) => i.id)).size, pool.length, 'duplicate image ids');
  for (const i of pool) {
    assert.ok(i.src?.startsWith('/game-images/'), `must be served locally: ${i.id}`);
    assert.equal(typeof i.isAI, 'boolean', `isAI must be boolean: ${i.id}`);
    // Serving these from our own origin is the whole point - a missing file
    // would show a broken box to a player at the stall.
    assert.ok(existsSync(join(publicDir, i.src)), `image not downloaded: ${i.src}`);
  }
}

// --- Prompt Wars -----------------------------------------------------------
{
  const pool = PROMPT_CHALLENGES;
  assert.equal(new Set(pool.map((c) => c.id)).size, pool.length, 'duplicate challenge ids');
  for (const c of pool) {
    const words = contentWords(c.prompt);
    // Too few words and one miss tanks the score; too many and 40s is not enough.
    assert.ok(
      words.length >= 2 && words.length <= 5,
      `prompt should have 2-5 scorable words, "${c.prompt}" has ${words.length}`
    );
    assert.ok(TIERS.includes(c.difficulty), `bad difficulty: ${c.id}`);
    assert.ok(c.src?.startsWith('/game-images/'), `must be served locally: ${c.id}`);
    assert.ok(existsSync(join(publicDir, c.src)), `image not downloaded: ${c.src}`);
    // A player who types the prompt back verbatim must score full marks.
    assert.equal(promptSimilarity(c.prompt, c.prompt), 1, `not self-consistent: ${c.prompt}`);
  }
  requireDepth('prompt-wars', pool, { easy: 1, medium: 1, hard: 1 }, 4);
}

console.log('gameData: all banks valid');
