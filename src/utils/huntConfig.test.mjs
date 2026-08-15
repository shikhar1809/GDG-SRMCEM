// Run: node src/utils/huntConfig.test.mjs
// Guards the unlock rules for the Mystery Hunt board.
import assert from 'node:assert/strict';
import {
  ALL_LEVELS,
  NORMAL_LEVELS,
  MEGA_LEVEL,
  isMegaLevel,
  isMegaUnlocked,
  claimedNormalCount,
  levelStatus,
  normalizeCode,
} from './huntConfig.js';

const ME = 'uid-me';
const OTHER = 'uid-other';
const claimAll = (n, uid = OTHER) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { uid, level: i + 1 }]));

assert.equal(ALL_LEVELS.length, 10);
assert.equal(isMegaLevel(10), true);
assert.equal(isMegaLevel(9), false);

// --- all 9 normal levels are open from the start, in any order ---
{
  const none = {};
  for (let l = 1; l <= NORMAL_LEVELS; l++) {
    assert.equal(levelStatus(l, none, ME), 'open', `level ${l} must be open from the start`);
  }
  assert.equal(levelStatus(MEGA_LEVEL, none, ME), 'locked', 'mega starts locked');
}

// --- one winner per level ---
{
  const claims = { 3: { uid: ME, level: 3 }, 4: { uid: OTHER, level: 4 } };
  assert.equal(levelStatus(3, claims, ME), 'won', 'my claim shows me the form');
  assert.equal(levelStatus(3, claims, OTHER), 'taken', 'someone else sees it as gone');
  assert.equal(levelStatus(4, claims, ME), 'taken');
  assert.equal(levelStatus(5, claims, ME), 'open', 'unclaimed levels stay open');
}

// --- mega unlocks only when ALL 9 are claimed, by anyone ---
{
  for (let n = 0; n < NORMAL_LEVELS; n++) {
    const claims = claimAll(n);
    assert.equal(isMegaUnlocked(claims), false, `mega must stay locked at ${n}/9`);
    assert.equal(levelStatus(MEGA_LEVEL, claims, ME), 'locked');
  }
  const all = claimAll(NORMAL_LEVELS);
  assert.equal(claimedNormalCount(all), 9);
  assert.equal(isMegaUnlocked(all), true, 'mega opens at 9/9');
  assert.equal(levelStatus(MEGA_LEVEL, all, ME), 'open', 'mega opens for everyone, not just winners');
  assert.equal(levelStatus(MEGA_LEVEL, all, OTHER), 'open');
}

// --- claiming the mega level must not itself count toward the 9 ---
{
  const claims = { ...claimAll(8), 10: { uid: OTHER, level: 10 } };
  assert.equal(claimedNormalCount(claims), 8, 'mega claim is not one of the 9');
  assert.equal(isMegaUnlocked(claims), false);
}

// --- once mega is claimed it reads as won/taken, not open ---
{
  const claims = { ...claimAll(9), 10: { uid: ME, level: 10 } };
  assert.equal(levelStatus(MEGA_LEVEL, claims, ME), 'won');
  assert.equal(levelStatus(MEGA_LEVEL, claims, OTHER), 'taken');
}

// --- code entry is forgiving about case and stray spaces ---
assert.equal(normalizeCode(' gdg 123 '), 'GDG123');
assert.equal(normalizeCode('GdG123'), 'GDG123');
assert.equal(normalizeCode(''), '');
assert.equal(normalizeCode(null), '');

console.log('huntConfig: all checks passed');
