// Mystery Hunt shape and rules, shared by the player board and the admin panel
// so the two can never disagree about what "unlocked" means.
//
// Format: 9 independent levels, each with its own hint, secret code and Google
// Form. They are NOT sequential - all 9 are open from the start, and a player
// can attack them in any order. The first person to enter a level's correct
// code claims it: that level then shows its Google Form to the winner only and
// goes dead for everyone else. 9 levels = 9 winners.
//
// Level 10 is the mega level. Its hint stays hidden until all 9 are claimed,
// then it opens to everyone at once.

export const NORMAL_LEVELS = 9;
export const MEGA_LEVEL = 10;
export const TOTAL_LEVELS = MEGA_LEVEL;
export const NORMAL_LEVEL_POINTS = 75;
export const MEGA_LEVEL_POINTS = 150;

export const ALL_LEVELS = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1);
export const isMegaLevel = (level) => Number(level) === MEGA_LEVEL;

/** Board positions, kept here so admin previews and the board stay in sync. */
export const PATH_NODES = [
  { level: 1, x: 15, y: 95 },
  { level: 2, x: 85, y: 86.6 },
  { level: 3, x: 80, y: 78.3 },
  { level: 4, x: 15, y: 70 },
  { level: 5, x: 20, y: 61.6 },
  { level: 6, x: 85, y: 53.3 },
  { level: 7, x: 80, y: 45 },
  { level: 8, x: 15, y: 36.6 },
  { level: 9, x: 20, y: 28.3 },
  { level: 10, x: 50, y: 20 },
];

/** How many of the 9 normal levels have been won. */
export const claimedNormalCount = (claims) =>
  ALL_LEVELS.filter((l) => !isMegaLevel(l) && claims[l]).length;

export const mysteryHuntPointsForLevels = (levels) =>
  levels.reduce(
    (total, level) => total + (isMegaLevel(level) ? MEGA_LEVEL_POINTS : NORMAL_LEVEL_POINTS),
    0
  );

/** The mega level only opens once every normal level has a winner. */
export const isMegaUnlocked = (claims, override = false) => override || claimedNormalCount(claims) >= NORMAL_LEVELS;

/**
 * What a given player should see for a level.
 *   'won'      - this player claimed it; show their Google Form
 *   'taken'    - someone else claimed it; dead
 *   'open'     - up for grabs; show the hint and a code box
 *   'locked'   - mega level, not all 9 claimed yet; hint hidden
 */
export const levelStatus = (level, claims, uid, teamId, forceMegaUnlock = false) => {
  const claim = claims[level];
  if (claim) return (claim.teamId && teamId && claim.teamId === teamId) || claim.uid === uid ? 'won' : 'taken';
  if (isMegaLevel(level) && !isMegaUnlocked(claims, forceMegaUnlock)) return 'locked';
  return 'open';
};

/** Codes are compared case- and space-insensitively - students type on phones. */
export const normalizeCode = (code) => (code || '').toUpperCase().replace(/\s+/g, '');
