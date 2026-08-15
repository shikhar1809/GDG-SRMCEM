import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Updates a user's global arcade score.
 * Ensures only the HIGHEST score per game is kept, allowing replays.
 * 
 * @param {string} userId - The Firebase auth user ID
 * @param {string} userName - The user's display name
 * @param {string} userEmail - The user's email
 * @param {string} gameId - Unique ID for the game (e.g. 'prompt-wars', 'tech-quiz')
 * @param {number} points - Points to award (Max 100)
 * @returns {Promise<boolean>} - True if points were successfully awarded/updated.
 */
export const updateArcadeScore = async (userId, userName, userEmail, gameId, points) => {
  if (!userId) return false;
  
  const scoreRef = doc(db, 'arcadeScores', userId);
  const safePoints = Math.min(100, Math.max(0, Math.round(points))); // Cap points at 100
  
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
        window.dispatchEvent(new CustomEvent('arcadeScoreAdded', { detail: { points: diff, gameId } }));
        return true;
      } else {
        console.log(`User scored ${safePoints} in ${gameId}, but previous best was ${oldScore}. Total score unchanged.`);
        return false;
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
      window.dispatchEvent(new CustomEvent('arcadeScoreAdded', { detail: { points: safePoints, gameId } }));
      return true;
    }
  } catch (error) {
    console.error("Error updating arcade score:", error);
    return false;
  }
};
