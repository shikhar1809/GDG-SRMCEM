// Central arcade scoring. Every game must report on the same 0-100 scale so the
// combined leaderboard is meaningful. Two knobs only:
//
//   85 pts  accuracy  - how much you got right (chance-corrected where guessing pays)
//   15 pts  speed     - how much clock you left on the table, scaled BY accuracy so
//                       tapping through fast with wrong answers earns nothing
//
// Guess handling per game shape:
//   2-option (AI Eye)          -> wrongPenalty 1    (a coin-flipper nets ~0)
//   4-option (Quiz, Impostor)  -> wrongPenalty 0    (plain accuracy)
//   free text (Recall, Prompt) -> wrongPenalty 0    (nothing to guess at)
//
// Timeouts are never penalised - only a submitted wrong answer is.

export const ACCURACY_WEIGHT = 85;
export const SPEED_WEIGHT = 15;

// Points are only awarded for actually WINNING a game. Below the pass mark a
// player scores nothing at all - turning up and tapping through must not put
// you on the leaderboard. Above it, the full fair curve applies.
export const DEFAULT_PASS_MARK = 0.5;

/**
 * @param {number} correct  rounds answered correctly
 * @param {number} wrong    rounds answered incorrectly (excludes timeouts)
 * @param {number} total    rounds played
 * @param {number} wrongPenalty  marks deducted per wrong answer (0 or 1)
 * @param {number} speed    0..1, fraction of the allotted time left unused
 * @param {number} passMark 0..1 accuracy needed to score anything at all
 * @returns {number} 0-100
 */
export const arcadePoints = ({
  correct,
  wrong = 0,
  total,
  wrongPenalty = 0,
  speed = 0,
  passMark = DEFAULT_PASS_MARK,
}) => {
  if (!total || total <= 0) return 0;
  const net = Math.max(0, correct - wrong * wrongPenalty);
  const accuracy = Math.min(1, net / total);
  if (accuracy < passMark) return 0;
  const speedFactor = Math.min(1, Math.max(0, speed));
  return Math.round(ACCURACY_WEIGHT * accuracy + SPEED_WEIGHT * accuracy * speedFactor);
};

/** Same shape, but for games scored on a 0..1 quality signal instead of right/wrong. */
export const arcadePointsFromRatio = (ratio, speed = 0, passMark = DEFAULT_PASS_MARK) => {
  const q = Math.min(1, Math.max(0, ratio));
  if (q < passMark) return 0;
  const speedFactor = Math.min(1, Math.max(0, speed));
  return Math.round(ACCURACY_WEIGHT * q + SPEED_WEIGHT * q * speedFactor);
};

/**
 * How much a player must get right before a game pays out anything.
 * Uniform 50% everywhere except AI Eye: its accuracy is already net of the
 * wrong-answer penalty, so 50% net there would mean 8 of 10 right - too steep
 * for a "win". 30% net means 6-7 of 10 right with a couple wrong, which is
 * a reasonable pass for a tricky visual judgement task.
 */
export const PASS_MARKS = {
  'tech-quiz': 0.5,
  'guess-impostor': 0.5,
  'tech-recall': 0.5,
  'prompt-wars': 0.5,
  'ai-eye': 0.3,
  'guess-the-trivia': 0.5,
};

export const shuffleArray = (array) => {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Shuffle multiple-choice options and follow the correct answer to its new slot.
 * Without this, a fixed correctIndex in the question bank lets the queue behind
 * you memorise answer positions.
 */
export const shuffleOptions = (options, correctIndex) => {
  const tagged = options.map((option, i) => ({ option, isAnswer: i === correctIndex }));
  const mixed = shuffleArray(tagged);
  return {
    options: mixed.map((t) => t.option),
    correctIndex: mixed.findIndex((t) => t.isAnswer),
  };
};

/**
 * Draw a set with a FIXED difficulty profile instead of a flat random sample.
 *
 * A flat sample is the quiet unfairness at a stall: one player draws eight easy
 * questions and walks off with 90, the next draws eight hard ones and gets 30,
 * and the leaderboard measures luck. Everyone should face the same shape.
 *
 * Falls back to any tier that still has items if one runs dry, so a thin pool
 * degrades to "fewer questions" rather than "crash".
 *
 * @param {Array<{difficulty?: string}>} pool
 * @param {{easy?: number, medium?: number, hard?: number}} profile
 */
export const drawGradedSet = (pool, profile) => {
  const byTier = { easy: [], medium: [], hard: [] };
  for (const item of pool) {
    (byTier[item.difficulty] || byTier.medium).push(item);
  }
  for (const tier of Object.keys(byTier)) byTier[tier] = shuffleArray(byTier[tier]);

  const picked = [];
  const leftovers = [];
  for (const tier of ['easy', 'medium', 'hard']) {
    const want = profile[tier] || 0;
    picked.push(...byTier[tier].slice(0, want));
    leftovers.push(...byTier[tier].slice(want));
  }

  const wanted = (profile.easy || 0) + (profile.medium || 0) + (profile.hard || 0);
  if (picked.length < wanted) {
    picked.push(...shuffleArray(leftovers).slice(0, wanted - picked.length));
  }
  // Ramp up: easy first so a nervous player at the stall gets a win early.
  const rank = { easy: 0, medium: 1, hard: 2 };
  return picked.sort((a, b) => (rank[a.difficulty] ?? 1) - (rank[b.difficulty] ?? 1));
};

// ---------------------------------------------------------------------------
// Tech Recall - free-text answer matching
// ---------------------------------------------------------------------------

export const normalizeAnswer = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // students type on phones: ignore spaces, dots, dashes

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
};

/**
 * Accept the answer if it matches, allowing one typo on longer words.
 * A 15-character term typed on a phone keyboard should not be lost to one
 * transposed letter - but short words must still be exact or "cat"/"cap" collide.
 */
export const isCloseEnough = (guess, target) => {
  const g = normalizeAnswer(guess);
  const t = normalizeAnswer(target);
  if (!g || !t) return false;
  if (g === t) return true;
  const tolerance = t.length >= 10 ? 2 : t.length >= 6 ? 1 : 0;
  return tolerance > 0 && levenshtein(g, t) <= tolerance;
};

// ---------------------------------------------------------------------------
// Prompt Wars - similarity between a typed prompt and the reference prompt
// ---------------------------------------------------------------------------

// Words that carry no visual information and must not be scored either way.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'with', 'and', 'or', 'is',
  'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this', 'that', 'these',
  'those', 'for', 'from', 'by', 'as', 'into', 'over', 'under', 'near', 'up',
  'down', 'out', 'very', 'some', 'there', 'their', 'his', 'her', 'photo',
  'image', 'picture', 'shot', 'view',
]);

// Cheap suffix stripping so "clouds" matches "cloud" and "running" matches "run".
const stem = (w) => {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  return w;
};

export const contentWords = (text) => {
  const words = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .map(stem);
  return [...new Set(words)];
};

/**
 * 0..1 similarity. Recall-driven: name the things that are actually in the
 * picture and you score. A precision guard stops the obvious exploit of typing
 * thirty nouns and hoping - once the guess runs past 2x the reference length it
 * starts costing you.
 */
export const promptSimilarity = (guess, reference) => {
  const ref = contentWords(reference);
  const got = contentWords(guess);
  if (ref.length === 0 || got.length === 0) return 0;

  const refSet = new Set(ref);
  const matched = got.filter((w) => refSet.has(w)).length;
  const recall = matched / ref.length;
  const precisionGuard = Math.min(1, (ref.length * 2) / got.length);
  return Math.min(1, recall * precisionGuard);
};
