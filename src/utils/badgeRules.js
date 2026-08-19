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
    id: 'welcome-badge',
    title: 'Orientation 2026',
    shortTitle: 'Orientation',
    tier: 'Bronze',
    subtitle: 'SRMCEM',
    description: 'Awarded to everyone who visits the stall or joins the platform.',
    accent: '#3b82f6',
    glow: '#60a5fa',
    ribbon: '#bfdbfe',
    text: '#1e3a8a',
    order: 1,
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
  return BADGE_DEFINITIONS.map((badge) => {
    return {
      ...badge,
      eligible: true,
      progressText: `Welcome to GDG!`,
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
