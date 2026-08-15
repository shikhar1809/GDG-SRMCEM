// Run: node src/utils/badges.test.mjs
// Badges award real points on the leaderboard, so the unlock rules are guarded.
import assert from 'node:assert/strict';
import {
  BADGES,
  ARCADE_GAME_IDS,
  badgeById,
  evaluateBadges,
  badgePointsFor,
  newlyEarned,
  countGamesPlayed,
} from './badges.js';

const has = (stats, id) => evaluateBadges(stats).includes(id);

// --- definitions are well formed ------------------------------------------
assert.equal(ARCADE_GAME_IDS.length, 5);
assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length, 'duplicate badge ids');
for (const b of BADGES) {
  assert.ok(b.name && b.icon && b.description, `badge ${b.id} is missing display fields`);
  assert.ok(b.points > 0, `badge ${b.id} must be worth points`);
  assert.equal(typeof b.test, 'function');
}

// --- nothing is earned by doing nothing ------------------------------------
assert.deepEqual(evaluateBadges({}), [], 'a new player holds no badges');
assert.deepEqual(evaluateBadges({ gamesPlayed: 2 }), [], 'two games is not enough for anything');

// --- Triple Threat: 3+ arcade games ----------------------------------------
assert.ok(!has({ gamesPlayed: 2 }, 'triple-threat'));
assert.ok(has({ gamesPlayed: 3 }, 'triple-threat'), 'exactly 3 games unlocks it');
assert.ok(has({ gamesPlayed: 5 }, 'triple-threat'), 'still held at 5 games');

// --- Arcade Master: all 5 -----------------------------------------------------
assert.ok(!has({ gamesPlayed: 4 }, 'arcade-master'), '4 of 5 is not all of them');
assert.ok(has({ gamesPlayed: 5 }, 'arcade-master'));

// --- Treasure Hunter: any hunt level ---------------------------------------
assert.ok(!has({ huntLevelsWon: 0 }, 'treasure-hunter'));
assert.ok(has({ huntLevelsWon: 1 }, 'treasure-hunter'));
// The hunt must NOT count toward the arcade badges.
assert.ok(!has({ huntLevelsWon: 9 }, 'arcade-master'), 'hunt wins are not arcade games');
assert.ok(!has({ huntLevelsWon: 9 }, 'triple-threat'));

// --- Complete Explorer: all 5 arcade games AND a hunt level ----------------
assert.ok(!has({ gamesPlayed: 5, huntLevelsWon: 0 }, 'complete-explorer'), 'arcade alone is not enough');
assert.ok(!has({ gamesPlayed: 4, huntLevelsWon: 3 }, 'complete-explorer'), 'hunt alone is not enough');
assert.ok(has({ gamesPlayed: 5, huntLevelsWon: 1 }, 'complete-explorer'));

// --- Mega Champion: only for the level 10 winner ---------------------------
assert.ok(!has({ huntLevelsWon: 9, megaWon: false }, 'mega-champion'), 'nine levels is not the mega');
assert.ok(has({ megaWon: true }, 'mega-champion'));

// --- a full-house player collects everything -------------------------------
{
  const all = evaluateBadges({ gamesPlayed: 5, huntLevelsWon: 2, megaWon: true });
  assert.equal(all.length, BADGES.length, 'a maxed player should hold every badge');
  assert.equal(badgePointsFor(all), 290, 'total badge points changed - update the poster');
}

// --- points -----------------------------------------------------------------
assert.equal(badgePointsFor([]), 0);
assert.equal(badgePointsFor(['triple-threat']), 25);
assert.equal(badgePointsFor(['triple-threat', 'arcade-master']), 75);
assert.equal(badgePointsFor(['nonsense-id']), 0, 'unknown ids are worth nothing');
assert.equal(badgeById('nope'), null);

// --- newlyEarned drives the unlock animation, so it must not repeat --------
assert.deepEqual(newlyEarned([], ['triple-threat']), ['triple-threat']);
assert.deepEqual(newlyEarned(['triple-threat'], ['triple-threat']), [], 'already held is not new');
assert.deepEqual(
  newlyEarned(['triple-threat'], ['triple-threat', 'arcade-master']),
  ['arcade-master'],
  'only the genuinely new one is announced'
);
// Badges are permanent: losing qualification must never revoke one.
{
  const held = ['triple-threat', 'arcade-master'];
  const merged = [...new Set([...held, ...evaluateBadges({ gamesPlayed: 0 })])];
  assert.deepEqual(merged.sort(), held.sort(), 'a re-evaluation cannot take a badge away');
}

// --- counting played games from a Firestore-shaped document ----------------
assert.equal(countGamesPlayed({}), 0);
assert.equal(countGamesPlayed({ played_tech_quiz: true }), 0, 'wrong key shape must not count');
assert.equal(countGamesPlayed({ played_ai_eye: true }), 0);
assert.equal(countGamesPlayed({ 'played_ai-eye': true }), 1);
assert.equal(
  countGamesPlayed(Object.fromEntries(ARCADE_GAME_IDS.map((id) => [`played_${id}`, true]))),
  5
);
assert.equal(
  countGamesPlayed({ 'played_ai-eye': true, 'played_mystery-hunt': true }),
  1,
  'the hunt is not an arcade game'
);

console.log('badges: all checks passed');
