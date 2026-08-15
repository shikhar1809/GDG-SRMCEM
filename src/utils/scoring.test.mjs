// Run: node src/utils/scoring.test.mjs
// Guards the arcade scoring curve. If these fail, the stall leaderboard is unfair.
import assert from 'node:assert/strict';
import {
  arcadePoints,
  arcadePointsFromRatio,
  PASS_MARKS,
  shuffleOptions,
  drawGradedSet,
  isCloseEnough,
  normalizeAnswer,
  contentWords,
  promptSimilarity,
} from './scoring.js';

// --- pass mark: a game must be WON before it pays anything ---
// Below the pass mark the player scores a hard 0, so turning up and tapping
// through never puts you on the leaderboard.
assert.equal(arcadePoints({ correct: 3, wrong: 5, total: 8, passMark: 0.5 }), 0, '3/8 is below pass');
assert.equal(arcadePoints({ correct: 4, wrong: 4, total: 8, passMark: 0.5 }), 43, '4/8 exactly passes');
assert.ok(
  arcadePoints({ correct: 4, wrong: 4, total: 8, passMark: 0.5 }) >
    arcadePoints({ correct: 3, wrong: 5, total: 8, passMark: 0.5 }),
  'crossing the pass mark must increase points, never decrease'
);
assert.equal(arcadePointsFromRatio(0.49, 1, 0.5), 0, 'ratio games respect the pass mark too');
assert.ok(arcadePointsFromRatio(0.5, 0, 0.5) > 0, 'exactly at the pass mark still scores');
// Every game must have a pass mark, or a typo silently disables the gate.
for (const id of ['tech-quiz', 'guess-impostor', 'tech-recall', 'prompt-wars', 'ai-eye']) {
  assert.ok(PASS_MARKS[id] > 0 && PASS_MARKS[id] <= 1, `missing pass mark for ${id}`);
}

// --- the scale is shared: same performance, same points, whatever the game ---
assert.equal(arcadePoints({ correct: 8, wrong: 2, total: 10, wrongPenalty: 0, speed: 0 }), 68);
assert.equal(arcadePoints({ correct: 10, wrong: 0, total: 10, speed: 1 }), 100, 'perfect + instant = 100');
assert.equal(arcadePoints({ correct: 10, wrong: 0, total: 10, speed: 0 }), 85, 'perfect + slow still 85');
assert.equal(arcadePoints({ correct: 0, wrong: 10, total: 10, speed: 1 }), 0, 'fast + all wrong earns no speed bonus');
assert.equal(arcadePoints({ correct: 0, wrong: 0, total: 0 }), 0, 'no rounds cannot divide by zero');

// --- AI Eye: 2 options, so a coin-flipper must net ~0 ---
const aiEye = (c, w) =>
  arcadePoints({ correct: c, wrong: w, total: 10, wrongPenalty: 1, speed: 0, passMark: PASS_MARKS['ai-eye'] });
assert.equal(aiEye(5, 5), 0, 'coin-flipper gets nothing');
assert.equal(aiEye(4, 6), 0, 'below chance clamps at 0, never negative');
assert.equal(aiEye(8, 2), 51);
assert.equal(aiEye(10, 0), 85);
assert.ok(aiEye(7, 3) > 0 && aiEye(7, 3) < aiEye(8, 2), 'monotonic in skill');

// --- Quiz / Impostor: 4 options, plain accuracy ---
const quiz = (c, t) =>
  arcadePoints({ correct: c, wrong: t - c, total: t, wrongPenalty: 0, speed: 0, passMark: PASS_MARKS['tech-quiz'] });
assert.equal(quiz(6, 8), 64);
assert.equal(quiz(8, 8), 85);
assert.equal(quiz(0, 8), 0);

// --- timeouts must not be punished harder than a wrong guess ---
const timedOut = arcadePoints({ correct: 5, wrong: 0, total: 10, wrongPenalty: 1 });
const guessedWrong = arcadePoints({ correct: 5, wrong: 5, total: 10, wrongPenalty: 1 });
assert.ok(timedOut > guessedWrong, 'skipping beats guessing wrong on penalty games');

// --- option shuffling actually moves the answer and keeps it correct ---
// The bug this guards: every impostor question shipped with impostorIndex === 3.
{
  const items = ['Facebook', 'Instagram', 'Twitter', 'Microsoft Excel'];
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const r = shuffleOptions(items, 3);
    assert.equal(r.options.length, 4);
    assert.equal(r.options[r.correctIndex], 'Microsoft Excel', 'answer must follow the shuffle');
    assert.deepEqual([...r.options].sort(), [...items].sort(), 'no option lost or duplicated');
    seen.add(r.correctIndex);
  }
  assert.equal(seen.size, 4, 'answer must reach every slot, not sit at index 3');
}

// --- graded draw: every player must face the same difficulty profile ---
{
  const pool = [];
  for (let i = 0; i < 20; i++) pool.push({ id: `e${i}`, difficulty: 'easy' });
  for (let i = 0; i < 20; i++) pool.push({ id: `m${i}`, difficulty: 'medium' });
  for (let i = 0; i < 20; i++) pool.push({ id: `h${i}`, difficulty: 'hard' });

  for (let i = 0; i < 200; i++) {
    const set = drawGradedSet(pool, { easy: 4, medium: 3, hard: 1 });
    assert.equal(set.length, 8);
    assert.equal(set.filter((q) => q.difficulty === 'easy').length, 4, 'profile must hold every draw');
    assert.equal(set.filter((q) => q.difficulty === 'medium').length, 3);
    assert.equal(set.filter((q) => q.difficulty === 'hard').length, 1);
    assert.equal(new Set(set.map((q) => q.id)).size, 8, 'no question twice in one game');
    const tiers = set.map((q) => q.difficulty);
    assert.deepEqual(tiers, [...tiers].sort((a, b) =>
      ({ easy: 0, medium: 1, hard: 2 }[a] - { easy: 0, medium: 1, hard: 2 }[b])), 'must ramp easy -> hard');
  }

  // Draws must actually vary, or the queue memorises the set.
  const first = new Set();
  for (let i = 0; i < 50; i++) first.add(drawGradedSet(pool, { easy: 4, medium: 3, hard: 1 })[0].id);
  assert.ok(first.size > 3, 'draw must be randomised within a tier');
}
{
  // Thin pool: degrade to fewer questions, never crash, never duplicate.
  const thin = [{ id: 'a', difficulty: 'easy' }, { id: 'b', difficulty: 'medium' }];
  const set = drawGradedSet(thin, { easy: 4, medium: 3, hard: 1 });
  assert.equal(set.length, 2);
  assert.equal(new Set(set.map((q) => q.id)).size, 2);
  assert.equal(drawGradedSet([], { easy: 4 }).length, 0, 'empty pool is survivable');
}
{
  // Untagged legacy items must still be usable rather than silently dropped.
  const untagged = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
  assert.equal(drawGradedSet(untagged, { medium: 2 }).length, 2);
}

// --- Tech Recall answer matching: forgiving on phones, not a free pass ---
assert.equal(normalizeAnswer('  Fire-Base!  '), 'firebase');
assert.ok(isCloseEnough('firebase', 'Firebase'), 'case insensitive');
assert.ok(isCloseEnough('fire base', 'Firebase'), 'spacing ignored');
assert.ok(isCloseEnough('kubernets', 'Kubernetes'), 'one typo on a long word forgiven');
assert.ok(isCloseEnough('polymorphsm', 'Polymorphism'), 'long word, one dropped letter');
assert.ok(!isCloseEnough('cap', 'Cat'), 'short words must be exact');
assert.ok(!isCloseEnough('python', 'Kubernetes'), 'wrong word is wrong');
assert.ok(!isCloseEnough('', 'Firebase'), 'empty is not an answer');
assert.ok(!isCloseEnough('   ', 'Firebase'), 'whitespace is not an answer');

// --- Prompt Wars: the old Jaccard scorer gave 66% for a perfect answer ---
assert.equal(contentWords('A red apple on the table').join(','), 'red,apple,table');
assert.equal(promptSimilarity('red apple on a table', 'A red apple on the table'), 1, 'stopwords must not cost you');
assert.equal(promptSimilarity('a red apple on the table', 'A red apple on the table'), 1, 'exact answer = full marks');
assert.ok(promptSimilarity('clouds', 'a white cloud') > 0, 'plural matches singular');
{
  const half = promptSimilarity('an apple', 'A red apple on the table');
  assert.ok(half > 0.2 && half < 0.5, `partial credit for partial answer, got ${half}`);
}
{
  // Type every noun you can think of and the precision guard should bite.
  const spam = promptSimilarity(
    'red apple table dog cat car tree sun moon star house boat plane train city',
    'A red apple on the table'
  );
  assert.ok(spam < 0.5, `word-spam must not beat a real answer, got ${spam}`);
}
assert.equal(promptSimilarity('', 'A red apple'), 0);
assert.equal(promptSimilarity('the a of', 'A red apple'), 0, 'stopwords alone score nothing');
assert.equal(promptSimilarity('banana', 'A red apple'), 0);

// --- ratio-scored games land on the same curve as round-scored ones ---
assert.equal(arcadePointsFromRatio(1, 1), 100);
assert.equal(arcadePointsFromRatio(0.8, 0), 68);
assert.equal(arcadePointsFromRatio(0, 1), 0);
assert.equal(arcadePointsFromRatio(1.5, 2), 100, 'clamped, never over 100');

console.log('scoring.js: all checks passed');
