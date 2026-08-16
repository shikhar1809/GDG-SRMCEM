export const BADGE_RULES_VERSION = '2026-08-15.badges.v1';

export const CREDENTIAL_URL = 'https://gdgsrmcem.web.app/credential/mybadges';

export const BADGE_GAME_RULES = [
  {
    gameId: 'tech-recall',
    scoreField: 'score_tech-recall',
    playedField: 'played_tech-recall',
    label: 'Tech Recall',
    winScore: 1,
  },
  {
    gameId: 'prompt-wars',
    scoreField: 'score_prompt-wars',
    playedField: 'played_prompt-wars',
    label: 'Prompt Wars',
    winScore: 1,
  },
  {
    gameId: 'guess-impostor',
    scoreField: 'score_guess-impostor',
    playedField: 'played_guess-impostor',
    label: 'Guess The Impostor',
    winScore: 1,
  },
  {
    gameId: 'ai-eye',
    scoreField: 'score_ai-eye',
    playedField: 'played_ai-eye',
    label: 'AI Eye',
    winScore: 1,
  },
  {
    gameId: 'tech-quiz',
    scoreField: 'score_tech-quiz',
    playedField: 'played_tech-quiz',
    label: 'Tech-O-Fire',
    winScore: 1,
  },
  {
    gameId: 'mystery-hunt',
    scoreField: 'score_mystery-hunt',
    playedField: 'played_mystery-hunt',
    label: 'Mystery Hunt',
    winScore: 75,
  },
];

export const NON_MYSTERY_GAME_IDS = BADGE_GAME_RULES
  .filter((game) => game.gameId !== 'mystery-hunt')
  .map((game) => game.gameId);

export const BADGE_DEFINITIONS = [
  {
    id: 'arcade-participant',
    title: 'Arcade Participant',
    shortTitle: 'Participant',
    tier: 'Silver',
    subtitle: 'Participated in the GDG Arcade',
    description: 'Awarded after a player participates in at least one GDG Arcade game.',
    accent: '#7dd3fc',
    glow: '#38bdf8',
    ribbon: '#dbeafe',
    text: '#0f172a',
    order: 1,
  },
  {
    id: 'multi-game-winner',
    title: 'Multi-Game Winner',
    shortTitle: 'Winner',
    tier: 'Emerald',
    subtitle: 'Won more than 3 games',
    description: 'Awarded after a player wins 4 or more GDG Arcade games.',
    accent: '#34d399',
    glow: '#10b981',
    ribbon: '#a7f3d0',
    text: '#052e16',
    order: 2,
  },
  {
    id: 'arcade-sweeper',
    title: 'Arcade Sweeper',
    shortTitle: 'Sweeper',
    tier: 'Prismatic',
    subtitle: 'Won every non-hunt game',
    description: 'Awarded after a player wins Tech Recall, Prompt Wars, Guess The Impostor, AI Eye, and Tech-O-Fire.',
    accent: '#a855f7',
    glow: '#f97316',
    ribbon: '#f5d0fe',
    text: '#2e1065',
    order: 3,
  },
];

export const getParticipatedGames = (scoreData = {}) => (
  BADGE_GAME_RULES.filter((game) => (
    scoreData[game.playedField] === true ||
    Number.isFinite(Number(scoreData[game.scoreField]))
  ))
);

export const getWonGames = (scoreData = {}) => (
  BADGE_GAME_RULES.filter((game) => Number(scoreData[game.scoreField] || 0) >= game.winScore)
);

export const getBadgeEligibility = (scoreData = {}) => {
  const participatedGames = getParticipatedGames(scoreData);
  const wonGames = getWonGames(scoreData);
  const wonGameIds = new Set(wonGames.map((game) => game.gameId));
  const wonAllNonMystery = NON_MYSTERY_GAME_IDS.every((gameId) => wonGameIds.has(gameId));

  const progress = {
    participatedGames,
    wonGames,
    wonGameIds,
    wonAllNonMystery,
  };

  return BADGE_DEFINITIONS.map((badge) => {
    if (badge.id === 'arcade-participant') {
      return {
        ...badge,
        eligible: participatedGames.length > 0,
        progressText: `${participatedGames.length}/${BADGE_GAME_RULES.length} games participated`,
      };
    }

    if (badge.id === 'multi-game-winner') {
      return {
        ...badge,
        eligible: wonGames.length > 3,
        progressText: `${wonGames.length}/4 wins needed`,
      };
    }

    return {
      ...badge,
      eligible: wonAllNonMystery,
      progressText: `${NON_MYSTERY_GAME_IDS.filter((gameId) => wonGameIds.has(gameId)).length}/${NON_MYSTERY_GAME_IDS.length} non-hunt games won`,
    };
  }).sort((a, b) => a.order - b.order);
};

export const createBadgeSnapshot = (scoreData = {}) => ({
  totalScore: Number(scoreData.totalScore || 0),
  participatedGames: getParticipatedGames(scoreData).map((game) => game.gameId),
  wonGames: getWonGames(scoreData).map((game) => game.gameId),
  scores: BADGE_GAME_RULES.reduce((acc, game) => ({
    ...acc,
    [game.gameId]: Number(scoreData[game.scoreField] || 0),
  }), {}),
});
