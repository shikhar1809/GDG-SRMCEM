// Arcade badges.
//
// Badges reward breadth, where the per-game points reward depth: a player who
// tries everything should be able to compete with someone who mastered one
// game. Each badge is worth points that are added to the leaderboard total.
//
// Badges are permanent once earned - re-evaluating never takes one away, so a
// leaderboard reset is the only thing that clears them.

/** The five arcade games. The Mystery Hunt is deliberately NOT one of these. */
export const ARCADE_GAME_IDS = [
  'tech-recall',
  'prompt-wars',
  'guess-impostor',
  'ai-eye',
  'tech-quiz',
];

export const BADGES = [
  {
    id: 'triple-threat',
    name: 'Triple Threat',
    icon: '🎯',
    points: 25,
    color: '#4285F4',
    description: 'Play any 3 arcade games',
    test: ({ gamesPlayed }) => gamesPlayed >= 3,
  },
  {
    id: 'arcade-master',
    name: 'Arcade Master',
    icon: '🕹️',
    points: 50,
    color: '#EA4335',
    description: 'Play all 5 arcade games',
    test: ({ gamesPlayed }) => gamesPlayed >= ARCADE_GAME_IDS.length,
  },
  {
    id: 'treasure-hunter',
    name: 'Treasure Hunter',
    icon: '🗺️',
    points: 40,
    color: '#FBBC04',
    description: 'Crack any Mystery Hunt level',
    test: ({ huntLevelsWon }) => huntLevelsWon >= 1,
  },
  {
    id: 'complete-explorer',
    name: 'Complete Explorer',
    icon: '🌟',
    points: 75,
    color: '#34A853',
    description: 'Play all 5 arcade games and crack a Mystery Hunt level',
    test: ({ gamesPlayed, huntLevelsWon }) =>
      gamesPlayed >= ARCADE_GAME_IDS.length && huntLevelsWon >= 1,
  },
  {
    id: 'mega-champion',
    name: 'Mega Champion',
    icon: '👑',
    points: 100,
    color: '#9C27B0',
    description: 'Crack the Mega Level of the Mystery Hunt',
    test: ({ megaWon }) => !!megaWon,
  },
];

export const badgeById = (id) => BADGES.find((b) => b.id === id) || null;

/** Which badges a player's stats qualify for, regardless of what they already hold. */
export const evaluateBadges = (stats) =>
  BADGES.filter((b) =>
    b.test({
      gamesPlayed: stats.gamesPlayed || 0,
      huntLevelsWon: stats.huntLevelsWon || 0,
      megaWon: stats.megaWon || false,
    })
  ).map((b) => b.id);

/** Total points for a list of badge ids. Unknown ids are worth nothing. */
export const badgePointsFor = (ids = []) =>
  ids.reduce((sum, id) => sum + (badgeById(id)?.points || 0), 0);

/** Badges newly earned this time - what the unlock animation should announce. */
export const newlyEarned = (alreadyHeld = [], nowQualified = []) => {
  const held = new Set(alreadyHeld);
  return nowQualified.filter((id) => !held.has(id));
};

/** How many distinct arcade games a scores document shows as played. */
export const countGamesPlayed = (scoreDoc = {}) =>
  ARCADE_GAME_IDS.filter((id) => scoreDoc[`played_${id}`]).length;
