// Run: node scripts/simulateArcade.mjs
//
// Plays every arcade game thousands of times with simulated players and prints
// the score distribution. This is the check that actually matters for a stall:
// the old build handed out ~100 for four games and ~25 for Prompt Wars, so the
// leaderboard was decided almost entirely by which game you happened to play.
//
// What we want to see:
//   - a blind guesser lands near 0 in EVERY game (nobody wins by tapping)
//   - a decent player lands in a similar band in every game
//   - a strong player can reach the 80s-90s but 100 stays rare
//   - the spread is wide enough that the top 10 is not a 20-way tie

import {
  arcadePoints,
  arcadePointsFromRatio,
  drawGradedSet,
  promptSimilarity,
  PASS_MARKS,
} from '../src/utils/scoring.js';
import { TECH_QUIZ_QUESTIONS } from '../src/utils/gameData/techQuizData.js';
import { GUESS_IMPOSTOR_QUESTIONS } from '../src/utils/gameData/guessImpostorData.js';
import { TECH_RECALL_WORDS } from '../src/utils/gameData/techRecallData.js';
import { PROMPT_CHALLENGES } from '../src/utils/gameData/promptWarsData.js';

const RUNS = 5000;
const chance = (p) => Math.random() < p;

// A player is described by how likely they are to succeed at each tier, and how
// much of the clock they typically use.
const PLAYERS = {
  'blind guesser': { easy: 0, medium: 0, hard: 0, pace: 0.15, guesses: true },
  weak: { easy: 0.55, medium: 0.3, hard: 0.15, pace: 0.35, guesses: true },
  average: { easy: 0.85, medium: 0.6, hard: 0.3, pace: 0.45, guesses: true },
  strong: { easy: 0.97, medium: 0.88, hard: 0.65, pace: 0.6, guesses: true },
  expert: { easy: 1, medium: 0.98, hard: 0.9, pace: 0.75, guesses: true },
};

// For guess-driven games the "blind guesser" answers at random rather than
// using the skill numbers above.
const randomHit = (options) => chance(1 / options);

const playRoundGame = (player, pool, profile, roundTime, options, wrongPenalty, gameId) => {
  const set = drawGradedSet(pool, profile);
  let correct = 0;
  let wrong = 0;
  let timeBank = 0;

  for (const q of set) {
    const isBlind = player.easy === 0;
    const hit = isBlind ? randomHit(options) : chance(player[q.difficulty] ?? player.medium);
    if (hit) {
      correct++;
      timeBank += roundTime * player.pace;
    } else {
      wrong++; // simulated players always answer; timeouts are modelled as wrong
    }
  }
  const speed = correct > 0 ? timeBank / (correct * roundTime) : 0;
  return arcadePoints({
    correct,
    wrong,
    total: set.length,
    wrongPenalty,
    speed,
    passMark: PASS_MARKS[gameId],
  });
};

const games = {
  'tech-quiz': (p) =>
    playRoundGame(p, TECH_QUIZ_QUESTIONS, { easy: 4, medium: 3, hard: 1 }, 12, 4, 0, 'tech-quiz'),
  'guess-impostor': (p) =>
    playRoundGame(p, GUESS_IMPOSTOR_QUESTIONS, { easy: 2, medium: 3, hard: 1 }, 15, 4, 0, 'guess-impostor'),
  'tech-recall': (p) =>
    // Free text: a blind guesser cannot type a word they never saw, so the
    // "options" count is effectively infinite.
    playRoundGame(p, TECH_RECALL_WORDS, { easy: 3, medium: 3, hard: 2 }, 15, 1e9, 0, 'tech-recall'),
  'ai-eye': (p) => {
    // Always 5 AI + 5 real, 2 options, wrong cancels a correct.
    let correct = 0;
    let wrong = 0;
    let timeBank = 0;
    const isBlind = p.easy === 0;
    const skill = (p.easy + p.medium + p.hard) / 3;
    // A blind guesser is a literal coin flip. Anyone else starts at chance and
    // climbs with skill, capped - even an expert misreads a good fake.
    const hitRate = isBlind ? 0.5 : Math.min(0.95, 0.5 + skill * 0.45);
    for (let i = 0; i < 10; i++) {
      if (chance(hitRate)) {
        correct++;
        timeBank += 8 * p.pace;
      } else {
        wrong++;
      }
    }
    const speed = correct > 0 ? timeBank / (correct * 8) : 0;
    return arcadePoints({
      correct,
      wrong,
      total: 10,
      wrongPenalty: 1,
      speed,
      passMark: PASS_MARKS['ai-eye'],
    });
  },
  'prompt-wars': (p) => {
    const set = drawGradedSet(PROMPT_CHALLENGES, { easy: 1, medium: 1, hard: 1 });
    const ratios = [];
    let timeBank = 0;
    for (const c of set) {
      const words = c.prompt.split(/\s+/);
      // Model the player naming some fraction of the real content words.
      const skill = p[c.difficulty] ?? p.medium;
      const kept = words.filter(() => chance(Math.max(0.05, skill)));
      const ratio = promptSimilarity(kept.join(' '), c.prompt);
      ratios.push(ratio);
      timeBank += 40 * p.pace * ratio;
    }
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const solved = ratios.reduce((a, b) => a + b, 0);
    const speed = solved > 0 ? timeBank / (solved * 40) : 0;
    return arcadePointsFromRatio(avg, speed, PASS_MARKS['prompt-wars']);
  },
};

const pct = (arr, q) => arr[Math.floor((arr.length - 1) * q)];
const results = {};

for (const [gameName, play] of Object.entries(games)) {
  results[gameName] = {};
  for (const [playerName, player] of Object.entries(PLAYERS)) {
    const scores = [];
    for (let i = 0; i < RUNS; i++) scores.push(play(player));
    scores.sort((a, b) => a - b);
    results[gameName][playerName] = {
      p10: pct(scores, 0.1),
      median: pct(scores, 0.5),
      p90: pct(scores, 0.9),
      max: scores[scores.length - 1],
      perfect: ((scores.filter((s) => s === 100).length / RUNS) * 100).toFixed(1),
    };
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n=== Arcade score simulation (${RUNS} runs per cell) ===\n`);
console.log(
  pad('game', 16) +
    pad('player', 15) +
    pad('p10', 6) +
    pad('median', 8) +
    pad('p90', 6) +
    pad('max', 6) +
    '%at100'
);
console.log('-'.repeat(66));
for (const [g, byPlayer] of Object.entries(results)) {
  for (const [p, r] of Object.entries(byPlayer)) {
    console.log(
      pad(g, 16) + pad(p, 15) + pad(r.p10, 6) + pad(r.median, 8) + pad(r.p90, 6) + pad(r.max, 6) + r.perfect
    );
  }
  console.log('-'.repeat(66));
}

// --- assertions: these are the fairness properties, not just pretty output ---
let failures = 0;
const check = (cond, msg) => {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failures++;
  }
};

for (const [g, byPlayer] of Object.entries(results)) {
  // With a pass mark in place, random tapping falls below the threshold in
  // every game and scores a hard 0. Nobody reaches the leaderboard by luck.
  const guessCeiling = 5;
  check(
    byPlayer['blind guesser'].median <= guessCeiling,
    `${g}: blind guessing pays too well (median ${byPlayer['blind guesser'].median} > ${guessCeiling})`
  );
  check(
    byPlayer.average.median - byPlayer['blind guesser'].median >= 30,
    `${g}: skill must clearly beat guessing (gap ${byPlayer.average.median - byPlayer['blind guesser'].median})`
  );
  check(
    byPlayer.expert.median > byPlayer.average.median,
    `${g}: expert must beat average (${byPlayer.expert.median} vs ${byPlayer.average.median})`
  );
  check(
    byPlayer.average.median > byPlayer.weak.median,
    `${g}: average must beat weak (${byPlayer.average.median} vs ${byPlayer.weak.median})`
  );
  check(
    Number(byPlayer.average.perfect) < 5,
    `${g}: a 100 should be rare for an average player (${byPlayer.average.perfect}%)`
  );
  check(byPlayer.expert.max >= 70, `${g}: a strong player must be able to score well`);
}

// The point of the whole exercise: comparable games.
for (const level of ['average', 'strong']) {
  const medians = Object.entries(results).map(([g, b]) => [g, b[level].median]);
  const values = medians.map(([, m]) => m);
  const spread = Math.max(...values) - Math.min(...values);
  console.log(
    `\n${level} player medians: ` + medians.map(([g, m]) => `${g}=${m}`).join('  ') + `  (spread ${spread})`
  );
  check(spread <= 30, `${level}: games must be comparable, spread is ${spread} points`);
}

console.log(failures === 0 ? '\nsimulation: all fairness checks passed' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
