import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const PENDING_KEY = 'gdg_pending_arcade_scores_v1';

const readPendingScores = () => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
};

const writePendingScores = (items) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(items.slice(-30)));
  } catch {
    // Local storage can be unavailable in strict/private browser modes.
  }
};

const pendingId = ({ userId, gameId }) => `${userId}:${gameId}`;

const rememberPendingScore = (payload) => {
  const id = pendingId(payload);
  const next = [
    ...readPendingScores().filter((item) => pendingId(item) !== id),
    { ...payload, queuedAt: Date.now() },
  ];
  writePendingScores(next);
};

const clearPendingScore = (payload) => {
  writePendingScores(readPendingScores().filter((item) => pendingId(item) !== pendingId(payload)));
};

export const flushPendingArcadeScores = async (userId) => {
  const pending = readPendingScores().filter((item) => !userId || item.userId === userId);
  if (pending.length === 0) return 0;

  let cleared = 0;
  for (const item of pending) {
    const ok = await updateArcadeScore(
      item.userId,
      item.userName,
      item.userEmail,
      item.gameId,
      item.points,
      { fromQueue: true }
    );
    if (ok) cleared++;
  }
  return cleared;
};

/**
 * Updates a user's global arcade score.
 * Ensures only the HIGHEST score per game is kept, allowing replays.
 * 
 * @param {string} userId - The Firebase auth user ID
 * @param {string} userName - The user's display name
 * @param {string} userEmail - The user's email
 * @param {string} gameId - Unique ID for the game (e.g. 'prompt-wars', 'tech-quiz')
 * @param {number} points - Points to award for this game's best attempt.
 * @returns {Promise<boolean>} - True if points were successfully awarded/updated.
 */
export const updateArcadeScore = async (userId, userName, userEmail, gameId, points, options = {}) => {
  if (!userId) return false;
  
  const scoreRef = doc(db, 'arcadeScores', userId);
  const numericPoints = Number(points);
  const safePoints = Number.isFinite(numericPoints) ? Math.max(0, Math.round(numericPoints)) : 0;
  const payload = { userId, userName, userEmail, gameId, points: safePoints };
  if (!options.fromQueue) rememberPendingScore(payload);
  
  try {
    const docSnap = await getDoc(scoreRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const oldScore = data[`score_${gameId}`] || 0;
      
      // Only update if they beat their previous high score for this game
      if (safePoints > oldScore) {
        const diff = safePoints - oldScore;
        await updateDoc(scoreRef, {
          totalScore: increment(diff),
          [`score_${gameId}`]: safePoints,
          [`played_${gameId}`]: true,
          displayName: userName || data.displayName,
          email: userEmail || data.email,
          lastUpdated: serverTimestamp()
        });
        console.log(`Successfully updated ${gameId} score from ${oldScore} to ${safePoints}. (+${diff} total pts)`);
        clearPendingScore(payload);
        window.dispatchEvent(new CustomEvent('arcadeScoreAdded', { detail: { points: diff, gameId } }));
        return true;
      } else {
        console.log(`User scored ${safePoints} in ${gameId}, but previous best was ${oldScore}. Total score unchanged.`);
        clearPendingScore(payload);
        return true;
      }
    } else {
      // First time playing an arcade game
      await setDoc(scoreRef, {
        userId,
        displayName: userName || 'Anonymous',
        email: userEmail || 'No Email',
        totalScore: safePoints,
        [`score_${gameId}`]: safePoints,
        [`played_${gameId}`]: true,
        lastUpdated: serverTimestamp()
      });
      console.log(`Successfully awarded ${safePoints} pts for ${gameId}.`);
      clearPendingScore(payload);
      window.dispatchEvent(new CustomEvent('arcadeScoreAdded', { detail: { points: safePoints, gameId } }));
      return true;
    }
  } catch (error) {
    console.error("Error updating arcade score:", error);
    window.dispatchEvent(new CustomEvent('arcadeScorePending', { detail: { gameId } }));
    return false;
  }
};
