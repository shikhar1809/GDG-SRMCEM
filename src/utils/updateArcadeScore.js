import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  increment,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { evaluateBadges, newlyEarned, badgePointsFor, countGamesPlayed, badgeById } from './badges';

/**
 * Updates a user's global arcade score.
 * Only the HIGHEST score per game is kept, so replays can only help.
 *
 * @param {string} userId
 * @param {string} userName
 * @param {string} userEmail
 * @param {string} gameId  e.g. 'prompt-wars'
 * @param {number} points  0-100
 * @returns {Promise<boolean>} true if the stored score improved
 */
export const updateArcadeScore = async (userId, userName, userEmail, gameId, points) => {
  if (!userId) return false;

  const scoreRef = doc(db, 'arcadeScores', userId);
  const safePoints = Math.min(100, Math.max(0, Math.round(points)));

  try {
    const docSnap = await getDoc(scoreRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const oldScore = data[`score_${gameId}`] || 0;

      // `played_` is set even on a worse run - playing IS the badge criterion,
      // so a second attempt that scores lower must not undo progress.
      if (safePoints > oldScore) {
        const diff = safePoints - oldScore;
        await updateDoc(scoreRef, {
          totalScore: increment(diff),
          [`score_${gameId}`]: safePoints,
          [`played_${gameId}`]: true,
          displayName: userName || data.displayName,
          email: userEmail || data.email,
          lastUpdated: serverTimestamp(),
        });
        window.dispatchEvent(new CustomEvent('arcadeScoreAdded', { detail: { points: diff, gameId } }));
      } else {
        await updateDoc(scoreRef, {
          [`played_${gameId}`]: true,
          lastUpdated: serverTimestamp(),
        });
      }
    } else {
      await setDoc(scoreRef, {
        userId,
        displayName: userName || 'Anonymous',
        email: userEmail || 'No Email',
        totalScore: safePoints,
        [`score_${gameId}`]: safePoints,
        [`played_${gameId}`]: true,
        badges: [],
        badgePoints: 0,
        lastUpdated: serverTimestamp(),
      });
      window.dispatchEvent(new CustomEvent('arcadeScoreAdded', { detail: { points: safePoints, gameId } }));
    }

    await syncBadges(userId, userName, userEmail);
    return true;
  } catch (error) {
    console.error('Error updating arcade score:', error);
    return false;
  }
};

/**
 * Re-checks every badge for a player and awards any that are newly earned.
 *
 * Safe to call as often as you like: badges are only ever added, and the points
 * for a badge are credited exactly once. Call it after a game finishes and
 * after a Mystery Hunt level is claimed.
 */
export const syncBadges = async (userId, userName, userEmail) => {
  if (!userId) return [];

  try {
    const scoreRef = doc(db, 'arcadeScores', userId);
    const snap = await getDoc(scoreRef);

    // A hunt-only player has no arcade document yet, but still deserves the
    // Treasure Hunter badge, so build one rather than bailing out.
    const data = snap.exists() ? snap.data() : null;
    const held = data?.badges || [];

    // Which hunt levels this player has won.
    let huntLevelsWon = 0;
    let megaWon = false;
    try {
      const claims = await getDocs(collection(db, 'huntClaims'));
      claims.forEach((d) => {
        const c = d.data();
        if (c.uid !== userId) return;
        huntLevelsWon += 1;
        if (Number(c.level) === 10) megaWon = true;
      });
    } catch (e) {
      console.error('Could not read hunt claims for badges', e);
    }

    const qualified = evaluateBadges({
      gamesPlayed: countGamesPlayed(data || {}),
      huntLevelsWon,
      megaWon,
    });
    const fresh = newlyEarned(held, qualified);
    if (fresh.length === 0) return [];

    const allBadges = [...new Set([...held, ...fresh])];
    const awardedPoints = badgePointsFor(fresh);

    if (data) {
      await updateDoc(scoreRef, {
        badges: allBadges,
        badgePoints: increment(awardedPoints),
        totalScore: increment(awardedPoints),
        displayName: userName || data.displayName,
        email: userEmail || data.email,
        lastUpdated: serverTimestamp(),
      });
    } else {
      await setDoc(scoreRef, {
        userId,
        displayName: userName || 'Anonymous',
        email: userEmail || 'No Email',
        totalScore: awardedPoints,
        badges: allBadges,
        badgePoints: awardedPoints,
        lastUpdated: serverTimestamp(),
      });
    }

    // Drives the unlock animation in AppOverlay.
    window.dispatchEvent(
      new CustomEvent('badgeUnlocked', {
        detail: { badges: fresh.map(badgeById).filter(Boolean) },
      })
    );
    return fresh;
  } catch (error) {
    console.error('Error syncing badges:', error);
    return [];
  }
};
