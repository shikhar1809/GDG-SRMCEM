/**
 * Staff run the stall and test the games, so their scores would otherwise sit
 * at the top of the board they are judging. Filter them out of every ranking.
 *
 * Both the player leaderboard and the admin panel use this, so the two can
 * never show a different top 10.
 */
export const withoutAdmins = (scores, adminEmails = []) => {
  const blocked = new Set(adminEmails.map((e) => (e || '').toLowerCase()));
  return scores.filter((s) => !blocked.has((s.email || '').toLowerCase()));
};

export const rankScores = (scores) =>
  [...scores].sort((a, b) => {
    if ((b.totalScore || 0) !== (a.totalScore || 0)) {
      return (b.totalScore || 0) - (a.totalScore || 0);
    }
    // Tie-break on who got there first.
    const at = a.lastUpdated?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
    const bt = b.lastUpdated?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
    return at - bt;
  });
