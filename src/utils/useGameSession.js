import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, increment } from 'firebase/firestore';
import { db, auth } from './../firebase';

// Each player gets this many goes at each game. Their leaderboard entry keeps
// the BEST run (see updateArcadeScore), so a second attempt can only help.
export const MAX_ATTEMPTS = 2;

/**
 * Everything the five arcade games need to talk to the stall: admin check,
 * the approval request, and how many attempts are left.
 *
 * This lived copy-pasted in all five game pages, which is how they drifted
 * apart - some auto-started on approval, some didn't, and one never handled
 * the "already played" state at all.
 *
 * Returns:
 *   isAdmin       staff can always play, for demos and testing
 *   status        'none' | 'pending' | 'approved' | 'completed'
 *   attemptsUsed  runs finished so far
 *   attemptsLeft  MAX_ATTEMPTS - attemptsUsed (0 once used up)
 *   canPlay       approved (or admin) AND attempts remaining
 *   autoStart     true only for the FIRST attempt, so finishing run 1 does not
 *                 immediately relaunch the game under the player
 */
export function useGameSession(gameId) {
  const [adminEmails, setAdminEmails] = useState([]);
  const [status, setStatus] = useState('none');
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [lobbyCode, setLobbyCode] = useState(null);
  const [requestId, setRequestId] = useState('');
  const [loaded, setLoaded] = useState(false);

  const user = auth.currentUser;
  const isAdmin = !!user && adminEmails.includes(user.email?.toLowerCase());

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists() && snap.data().adminEmails) {
        setAdminEmails(snap.data().adminEmails.map((e) => e.toLowerCase()));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }
    const reqId = `${user.uid}_${gameId}`;
    setRequestId(reqId);
    const unsub = onSnapshot(doc(db, 'gameRequests', reqId), (snap) => {
      if (!snap.exists()) {
        setStatus('none');
        setAttemptsUsed(0);
        setLobbyCode(null);
      } else {
        const data = snap.data();
        setStatus(data.status || 'none');
        setAttemptsUsed(data.attemptsUsed || 0);
        setLobbyCode(data.lobbyCode || null);
      }
      setLoaded(true);
    });
    return () => unsub();
  }, [gameId, user]);

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptsUsed);
  const canPlay = (isAdmin || status === 'approved') && (isAdmin || attemptsLeft > 0);
  const autoStart = status === 'approved' && attemptsUsed === 0;

  const requestToPlay = useCallback(async () => {
    if (!user) return;
    await setDoc(doc(db, 'gameRequests', `${user.uid}_${gameId}`), {
      userId: user.uid,
      userName: user.displayName || 'Player',
      userEmail: user.email,
      gameId,
      status: 'pending',
      attemptsUsed: 0,
      lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
      timestamp: serverTimestamp(),
    });
  }, [gameId, user]);

  const cancelRequest = useCallback(async () => {
    if (!requestId) return;
    try {
      await deleteDoc(doc(db, 'gameRequests', requestId));
    } catch (e) {
      console.error('Failed to cancel request', e);
    }
  }, [requestId]);

  /**
   * Burn one attempt. Called when a run reaches its results screen.
   * The session only closes once every attempt is spent, so the player can
   * start their second go without queueing for staff again.
   */
  const consumeAttempt = useCallback(async () => {
    if (!requestId || isAdmin) return;
    const used = attemptsUsed + 1;
    try {
      await setDoc(
        doc(db, 'gameRequests', requestId),
        {
          attemptsUsed: increment(1),
          status: used >= MAX_ATTEMPTS ? 'completed' : 'approved',
          lastPlayedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to record attempt', e);
    }
  }, [requestId, attemptsUsed, isAdmin]);

  return {
    isAdmin,
    status,
    attemptsUsed,
    attemptsLeft,
    canPlay,
    autoStart,
    lobbyCode,
    requestId,
    loaded,
    requestToPlay,
    cancelRequest,
    consumeAttempt,
  };
}
