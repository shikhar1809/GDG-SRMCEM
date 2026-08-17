import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, doc, setDoc, onSnapshot, getDoc, serverTimestamp, deleteDoc, runTransaction, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { GUESS_TRIVIA_QUESTIONS } from '../utils/gameData/guessTheTriviaData';
import { updateArcadeScore } from '../utils/updateArcadeScore';
import { arcadePoints, drawGradedSet, isCloseEnough, PASS_MARKS } from '../utils/scoring';
import { preloadImages, preloadImagesAsync } from '../utils/imagePreload';
import { createGameRequestPayload, isApprovedForThisDevice } from '../utils/gameRequests';
import { Send, Clock, ChevronLeft, Trophy, RotateCcw, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GAME_ID = 'guess-the-trivia';
const PASS_MARK_PCT = Math.round(PASS_MARKS['guess-the-trivia'] * 100);
const TOTAL_ROUNDS = 5;
const DIFFICULTY_PROFILE = { easy: 2, medium: 2, hard: 1 };
const ROUND_TIME = 20;
const REVEAL_MS = 3000;

const GuessTheTrivia = () => {
  const navigate = useNavigate();
  const [globalState, setGlobalState] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [gameState, setGameState] = useState('locked'); // locked|intro|playing|roundResult|finalResult
  const [joinedPlayers, setJoinedPlayers] = useState([]);
  const [guess, setGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [lastResult, setLastResult] = useState(null); // { isCorrect, guess, answer }
  const [earnedPoints, setEarnedPoints] = useState(null);
  const [hintActive, setHintActive] = useState(false);
  const [hintFact, setHintFact]     = useState(null);

  const [adminEmails, setAdminEmails] = useState([]);
  const [requestStatus, setRequestStatus] = useState('none');
  const [lobbyCode, setLobbyCode] = useState(null);
  const [countdownValue, setCountdownValue] = useState(3);
  const [requestId, setRequestId] = useState('');

  const timerRef = useRef(null);
  const answeredRef = useRef(false);
  const scoreRef = useRef(0);
  const wrongRef = useRef(0);
  const timeBankRef = useRef(0);
  const savedRef = useRef(false);
  const guessesRef = useRef([]);
  const hintsUsedRef = useRef(0);
  const hintActiveRef = useRef(false); // stable ref so submitRound closure sees current value

  const generateHintMask = (answer) => {
    if (!answer) return [];
    return answer.split(' ').map(word => {
      if (word.length <= 2) {
        return word.split('').map(char => ({ char, revealed: true }));
      }
      return word.split('').map((char, i, arr) => ({
        char,
        revealed: (i === 0 || i === arr.length - 1 || !/[a-zA-Z0-9]/.test(char))
      }));
    });
  };

  // Keep hintActiveRef in sync with hintActive state
  useEffect(() => { hintActiveRef.current = hintActive; }, [hintActive]);

  const currentRound = rounds[roundIndex];
  const isAdmin = auth.currentUser && adminEmails.includes(auth.currentUser.email?.toLowerCase());
  const effectiveGameState = (!isAdmin && requestStatus !== 'approved' && gameState !== 'intro') ? 'locked' : gameState;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists() && snap.data().adminEmails) {
        setAdminEmails(snap.data().adminEmails.map((e) => e.toLowerCase()));
      }
    });
    return () => unsub();
  }, []);

  // Listen to global synchronized game state
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'guessTheTrivia', 'gameState'), (snap) => {
      if (snap.exists()) {
        setGlobalState(snap.data());
      } else {
        setGlobalState({ status: 'locked' });
      }
    });
    return () => unsub();
  }, []);

  // Listen for joined players when in 'intro' (staging) or 'locked' state
  useEffect(() => {
    if (gameState !== 'intro' && gameState !== 'locked' && gameState !== 'countdown') {
      setJoinedPlayers([]);
      return;
    }
    const q = query(
      collection(db, 'gameRequests'),
      where('gameId', '==', GAME_ID)
    );
    const unsub = onSnapshot(q, (snap) => {
      const players = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.status === 'pending' || data.status === 'approved') {
          players.push({ id: d.id, ...data });
        }
      });
      setJoinedPlayers(players);
    });
    return () => unsub();
  }, [gameState]);

  // Sync global state to local game loop
  useEffect(() => {
    if (!globalState) return;

    if (globalState.status === 'playing') {
      setRounds(globalState.rounds || []);
      
      // If we are just starting from intro or locked
      if (effectiveGameState === 'intro' || effectiveGameState === 'locked') {
        scoreRef.current = 0;
        wrongRef.current = 0;
        timeBankRef.current = 0;
        guessesRef.current = [];
        hintsUsedRef.current = 0;
        answeredRef.current = false;
        savedRef.current = false;
        setEarnedPoints(null);
        setLastResult(null);
        setHintActive(false);
        setHintFact(null);
        setGuess('');
        setRoundIndex(globalState.roundIndex || 0);
        
        const imageRounds = (globalState.rounds || []).filter(r => r.src);
        if (imageRounds.length > 0) {
          setGameState('preloading');
          preloadImagesAsync(imageRounds).then(() => {
            setCountdownValue(3);
            setGameState('countdown');
          });
        } else {
          setCountdownValue(3);
          setGameState('countdown');
        }
      } 
      // If Admin advanced the round
      else if (globalState.roundIndex !== roundIndex) {
        if (!answeredRef.current && rounds.length > 0) {
          // Admin advanced before player submitted, auto-fail
          guessesRef.current.push('');
          wrongRef.current += 1;
        }
        answeredRef.current = false;
        setHintActive(false);
        setHintFact(null);
        setRoundIndex(globalState.roundIndex);
        setGameState('playing');
        setGuess('');
      } else {
        // Same round — check if hint was just activated
        setHintActive(!!globalState.hintUsed);
        setHintFact(globalState.hintFact || null);
      }
    } else if (globalState.status === 'finalResult') {
      setGameState('finalResult');
    } else if (globalState.status === 'staging') {
      setGameState('intro');
      setRounds(globalState.rounds || []);
      scoreRef.current = 0;
      wrongRef.current = 0;
      timeBankRef.current = 0;
      guessesRef.current = [];
      savedRef.current = false;
      setEarnedPoints(null);
      setLastResult(null);
    } else if (globalState.status === 'locked') {
      setGameState('locked');
      setRounds([]);
      scoreRef.current = 0;
      wrongRef.current = 0;
      timeBankRef.current = 0;
      guessesRef.current = [];
      savedRef.current = false;
      setEarnedPoints(null);
      setLastResult(null);
    }
  }, [globalState]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const reqId = `${auth.currentUser.uid}_${GAME_ID}`;
    setRequestId(reqId);
    const unsub = onSnapshot(doc(db, 'gameRequests', reqId), (snap) => {
      if (!snap.exists()) {
        setRequestStatus('none');
        setLobbyCode(null);
        return;
      }
      const data = snap.data();
      setLobbyCode(data.lobbyCode || null);
      if (data.status === 'approved' && !isApprovedForThisDevice(data, GAME_ID)) {
        setRequestStatus('device-mismatch');
        return;
      }
      setRequestStatus(data.status);
    });
    return () => unsub();
  }, []);

  // Handle countdown timer
  useEffect(() => {
    if (effectiveGameState === 'countdown') {
      const interval = setInterval(() => {
        setCountdownValue((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setGameState('playing');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState]);

  useEffect(() => {
    if (rounds && rounds.length > 0) {
      preloadImages(rounds.filter(r => r.src), 0, 5); // Only preload if src exists
    }
  }, [rounds]);

  useEffect(() => {
    const isEmoji = currentRound?.emoji;
    setImageReady(!!isEmoji);
    setImageFailed(false);
    answeredRef.current = false;
    setTimeLeft(ROUND_TIME);
    setGuess('');
  }, [roundIndex, currentRound]);

  // startGame is no longer called locally for players. It's triggered by global state.

  const submitRound = useCallback(
    async (text, secondsLeft) => {
      if (answeredRef.current || !currentRound) return;
      answeredRef.current = true;
      clearInterval(timerRef.current);

      const isCorrect = isCloseEnough(text, currentRound.answer);
      guessesRef.current.push(text.trim());
      
      let wonRound = false;

      if (isCorrect) {
        try {
          wonRound = await runTransaction(db, async (transaction) => {
            const stateRef = doc(db, 'guessTheTrivia', 'gameState');
            const sfDoc = await transaction.get(stateRef);
            if (!sfDoc.exists()) return false;
            const data = sfDoc.data();
            
            // Ensure no one else has won this round yet
            if (data.roundIndex === roundIndex && !data.roundWinner) {
              transaction.update(stateRef, {
                roundWinner: auth.currentUser.uid,
                roundWinnerName: auth.currentUser.displayName || 'Anonymous',
                roundWinnerTime: serverTimestamp()
              });
              return true;
            }
            return false;
          });
        } catch (e) {
          console.error("Transaction failed: ", e);
        }

        if (wonRound) {
          scoreRef.current += 1;
          // Half points if hint was used
          if (hintActiveRef.current) {
            hintsUsedRef.current += 1;
          }
          timeBankRef.current += Math.max(0, secondsLeft);
        }
      } else {
        wrongRef.current += 1;
      }

      setLastResult({
        isCorrect,
        guess: text,
        answer: currentRound.answer,
        wonRound
      });
      setGameState('roundResult');
    },
    [currentRound, roundIndex]
  );

  useEffect(() => {
    if (gameState !== 'playing' || !imageReady || globalState?.roundWinner) {
      clearInterval(timerRef.current);
      return;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitRound('', 0); // timeout means empty guess
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameState, imageReady, roundIndex, submitRound, globalState?.roundWinner]);

  // The round transition is now controlled by Admin, so we remove the auto-timeout for moving to next round!
  // The local `roundResult` state will just wait until globalState changes roundIndex.

  useEffect(() => {
    if (gameState !== 'finalResult' || savedRef.current) return;
    savedRef.current = true;

    const correct = scoreRef.current;
    const total = rounds.length || TOTAL_ROUNDS;
    const speed = correct > 0 ? timeBankRef.current / (correct * ROUND_TIME) : 0;
    const rawPoints = arcadePoints({
      correct,
      wrong: wrongRef.current,
      total,
      wrongPenalty: 0,
      speed,
      passMark: PASS_MARKS[GAME_ID],
    });
    // Deduct 50% for each round won with a hint active
    // Each hinted round win is worth half, so we reduce proportionally
    const hintPenalty = correct > 0 ? (hintsUsedRef.current / correct) * rawPoints * 0.5 : 0;
    const points = Math.max(0, Math.round(rawPoints - hintPenalty));
    setEarnedPoints(points);

    const user = auth.currentUser;
    if (!user) return;
    (async () => {
      try {
        await setDoc(doc(db, 'guessTriviaScores', user.uid), {
          playerId: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email,
          guesses: guessesRef.current,
          questions: rounds.map((r) => r.answer),
          score: correct,
          total,
          points,
          lobbyCode: lobbyCode || null,
          timestamp: serverTimestamp(),
        });
        await updateArcadeScore(user.uid, user.displayName, user.email, GAME_ID, points);
        if (requestId) {
          const reqRef = doc(db, 'gameRequests', requestId);
          const reqDoc = await getDoc(reqRef);
          const currentPlays = (reqDoc.data()?.playCount || 0) + 1;
          const isComplete = currentPlays >= 3 && !isAdmin;
          await setDoc(reqRef, { 
            status: isComplete ? 'completed' : 'none',
            playCount: currentPlays
          }, { merge: true });
        }
      } catch (err) {
        console.error('Failed to save Trivia score:', err);
      }
    })();
  }, [gameState, rounds, requestId, lobbyCode, isAdmin]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (effectiveGameState !== 'playing' || !guess.trim()) return;
    submitRound(guess, timeLeft);
  };

  if (!globalState || (effectiveGameState === 'playing' && rounds.length === 0)) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center p-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Clock className="w-12 h-12 text-[#FF5722] mb-4" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8">
      <div className="relative z-10 flex items-center justify-between mb-6 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/arcade')}
          className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-gray-600 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-black italic tracking-wider text-[#FF5722] uppercase">
            Guess The Trivia
          </h1>
          {(effectiveGameState === 'playing' || effectiveGameState === 'roundResult') && (
            <p className="text-sm text-gray-600 font-medium">
              Round {roundIndex + 1} of {rounds.length}
            </p>
          )}
        </div>
        <div className="w-10" />
      </div>

      <div className="max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {effectiveGameState === 'locked' && (
            <motion.div
              key="locked"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto text-center"
            >
              {requestStatus === 'approved' && !isAdmin ? (
                <div className="bg-orange-50 border border-orange-200 p-8 rounded-3xl w-full text-center mt-6 shadow-sm">
                  <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <h3 className="text-3xl font-black text-orange-900 mb-2 uppercase tracking-tight">Lobby Locked</h3>
                  <p className="text-orange-700 font-bold mb-8 text-lg">Get Ready! Game is starting very soon...</p>
                  
                  {joinedPlayers.length > 0 && (
                    <div className="text-left bg-white/60 rounded-2xl p-6 border border-orange-100">
                      <p className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-4 flex items-center justify-between">
                        <span>Players Locked In</span>
                        <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full text-xs">{joinedPlayers.length}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {joinedPlayers.map(p => (
                          <div key={p.id} className="bg-white border border-orange-200 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 shadow-sm flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                            <div>
                              <div className="font-bold">{p.displayName || 'Anonymous'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock size={40} className="text-gray-400" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tight">Trivia Locked</h2>
                  
                  <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 text-left mb-8">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <Trophy size={20} className="text-[#FF5722]" /> How to Play Guess Trivia
                    </h3>
                    <ul className="text-gray-600 space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF5722] mt-1.5 shrink-0" />
                        <span>You will see 5 random logos or movie scenes.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF5722] mt-1.5 shrink-0" />
                        <span>You have {ROUND_TIME} seconds per image to guess what it is.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF5722] mt-1.5 shrink-0" />
                        <span>The faster you type the correct answer, the more points you earn!</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF5722] mt-1.5 shrink-0" />
                        <span>Misspellings are somewhat forgiving, but don't risk it!</span>
                      </li>
                    </ul>
                  </div>

                  <p className="text-gray-500 leading-relaxed font-medium">
                    The lobby is currently closed. Please wait for the host to unlock it.
                  </p>
                </>
              )}
            </motion.div>
          )}

          {effectiveGameState === 'preloading' && (
            <motion.div
              key="preloading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-md mx-auto text-center"
            >
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200 p-12 rounded-3xl shadow-sm">
                <div className="w-16 h-16 border-4 border-[#FF5722] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                <h3 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">Loading Assets...</h3>
                <p className="text-gray-500 font-medium">Preparing images for a smooth experience.</p>
              </div>
            </motion.div>
          )}

          {effectiveGameState === 'countdown' && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-[#FF5722]"
            >
              <motion.div
                key={countdownValue}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="text-white text-9xl font-black italic tracking-tighter drop-shadow-2xl"
              >
                {countdownValue}
              </motion.div>
            </motion.div>
          )}

          {effectiveGameState === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-lg mx-auto text-center"
            >
              <p className="text-gray-600 text-lg mb-2">
                You'll see {TOTAL_ROUNDS} images. Guess the logo or movie shown — <span className="font-bold text-[#FF5722]">{ROUND_TIME} seconds</span> per image.
              </p>
              
              {isAdmin ? (
                <div className="bg-orange-50 border border-orange-200 p-8 rounded-3xl w-full text-center mt-6">
                  <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-orange-800 mb-2">Staging Match</h3>
                  <p className="text-orange-600 font-medium mb-8">Waiting for players to join the lobby...</p>

                  {joinedPlayers.length > 0 && (
                    <div className="text-left bg-white/60 rounded-2xl p-6 border border-orange-100">
                      <p className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-4 flex items-center justify-between">
                        <span>Players in Lobby</span>
                        <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full text-xs">{joinedPlayers.length}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {joinedPlayers.map(p => (
                          <div key={p.id} className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 shadow-sm flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                            <div>
                              <div className="font-bold text-gray-900">{p.displayName || p.userName || 'Anonymous'}</div>
                              <div className="text-xs text-gray-500 font-normal">{p.userEmail || 'No email'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : requestStatus === 'approved' ? (
                <div className="bg-green-50 border border-green-200 p-8 rounded-3xl w-full text-center mt-6">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-green-800 mb-2">You're In!</h3>
                  <p className="text-green-700 font-medium mb-8">Waiting for the Admin to start the game...</p>
                  
                  {joinedPlayers.length > 0 && (
                    <div className="text-left bg-white/60 rounded-2xl p-6 border border-green-100">
                      <p className="text-sm font-bold text-green-800 uppercase tracking-wider mb-4 flex items-center justify-between">
                        <span>Players in Lobby</span>
                        <span className="bg-green-200 text-green-800 px-2 py-0.5 rounded-full text-xs">{joinedPlayers.length}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {joinedPlayers.map(p => (
                          <div key={p.id} className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 shadow-sm flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                            <div>
                              <div className="font-bold text-gray-900">{p.displayName || p.userName || 'Anonymous'}</div>
                              <div className="text-xs text-gray-500 font-normal">{p.userEmail || 'No email'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50/80 border border-gray-200 p-8 rounded-3xl w-full text-center mt-6">
                  <div className="bg-orange-100 text-[#FF5722] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trophy size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Join the Trivia Game!</h3>
                  <p className="text-gray-500 text-base leading-relaxed mb-6">
                    Click below to join the lobby and wait for the match to start!
                  </p>

                  {requestStatus === 'none' && (
                    <button
                      onClick={async () => {
                        if (!auth.currentUser) return;
                        const payload = createGameRequestPayload(auth.currentUser, GAME_ID, serverTimestamp);
                        payload.status = 'approved';
                        delete payload.lobbyCode;
                        await setDoc(doc(db, 'gameRequests', `${auth.currentUser.uid}_${GAME_ID}`), payload, { merge: true });
                      }}
                      className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#FF5722] hover:bg-orange-600 text-white font-bold rounded-xl text-lg transition-colors shadow-lg mb-4"
                    >
                      Join Game
                    </button>
                  )}

                  {requestStatus === 'pending' && (
                    <div className="flex flex-col gap-3 mb-4">
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                        <span className="font-bold">Waiting for Admin Approval...</span>
                      </div>
                      <div className="text-center font-mono text-xl font-bold bg-gray-50 py-2 rounded-lg border border-gray-200">
                        Lobby Code: <span className="text-[#FF5722]">{lobbyCode || '...'}</span>
                      </div>
                    </div>
                  )}

                  {requestStatus === 'pending' && joinedPlayers.length > 0 && (
                    <div className="text-left bg-white/60 rounded-2xl p-6 border border-orange-100 mb-6">
                      <p className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-4 flex items-center justify-between">
                        <span>Players in Lobby</span>
                        <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full text-xs">{joinedPlayers.length}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {joinedPlayers.map(p => (
                          <div key={p.id} className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 shadow-sm flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                            <div>
                              <div className="font-bold text-gray-900">{p.displayName || p.userName || 'Anonymous'}</div>
                              <div className="text-xs text-gray-500 font-normal">{p.userEmail || 'No email'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {requestStatus === 'completed' && (
                    <div className="bg-gray-100 text-gray-500 p-4 rounded-xl mb-4">
                      <span className="font-bold">You have already played this game.</span>
                    </div>
                  )}
                  {requestStatus === 'device-mismatch' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm mb-4">
                      This Gmail was approved on another device. Use the device that showed this lobby code, or ask a volunteer to reject and request again.
                    </div>
                  )}

                  {requestStatus === 'pending' && (
                    <button
                      onClick={async () => {
                        if (!requestId) return;
                        try {
                          await deleteDoc(doc(db, 'gameRequests', requestId));
                        } catch (e) {
                          console.error('Failed to cancel request', e);
                        }
                      }}
                      className="w-full inline-flex justify-center items-center px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {(effectiveGameState === 'playing' || effectiveGameState === 'roundResult') && !currentRound && (
            <motion.div
              key="error-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto text-center bg-gray-50 p-8 rounded-3xl border border-gray-200"
            >
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="text-gray-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Please Wait</h3>
              <p className="text-gray-500 text-sm">The game is currently loading the next set of questions. If you see this for a long time, the host is preparing the lobby.</p>
            </motion.div>
          )}

          {(effectiveGameState === 'playing' || effectiveGameState === 'roundResult') && currentRound && (
            <motion.div
              key={`round-${roundIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <div className="flex flex-col gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-2 shadow-lg overflow-hidden">
                  <div className="relative rounded-xl overflow-hidden aspect-video mx-auto bg-gray-200 flex items-center justify-center">
                    {!imageReady && !imageFailed && !currentRound.emoji && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF5722]" />
                        <span className="text-xs font-bold uppercase tracking-wider">
                          Loading image…
                        </span>
                      </div>
                    )}
                    {imageFailed && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                        <p className="text-sm font-bold text-gray-600">Image failed to load.</p>
                        <button
                          onClick={() => {
                            setImageFailed(false);
                            setImageReady(false);
                          }}
                          className="px-4 py-2 bg-[#4285F4] text-white rounded-lg font-bold text-sm"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {currentRound.emoji ? (
                      <div className="w-full h-full flex items-center justify-center bg-white/50 rounded-2xl">
                        <span className="text-7xl md:text-8xl lg:text-9xl tracking-widest drop-shadow-sm select-none">
                          {currentRound.emoji}
                        </span>
                      </div>
                    ) : (
                      <img
                        key={currentRound.id}
                        src={currentRound.src}
                        alt="Guess the logo or movie"
                        className={`w-full h-full object-contain transition-opacity duration-200 ${
                          imageReady ? 'opacity-100' : 'opacity-0'
                        }`}
                        onLoad={() => setImageReady(true)}
                        onError={() => setImageFailed(true)}
                        draggable={false}
                      />
                    )}
                  </div>
                </div>

                {/* Random Clue Card — shown for movie mode */}
                {currentRound.emoji && (() => {
                  const localQ = GUESS_TRIVIA_QUESTIONS.find(q => q.id === currentRound.id);
                  const clues = localQ?.clues;
                  if (!clues?.length) return null;
                  const clue = clues[roundIndex % clues.length];
                  const icon = clue.startsWith('Starring') ? '🎭' : clue.startsWith('Genre') ? '🎬' : '📅';
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Clue</p>
                        <p className="text-blue-900 font-semibold text-sm">{clue}</p>
                      </div>
                    </div>
                  );
                })()}


                {/* Hint Banners */}
                {hintActive && currentRound.emoji && (
                  <div className="flex flex-col gap-2">
                    {/* Hint 1 — first word(s) of movie name */}
                    <div className="bg-yellow-50 border border-yellow-300 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm animate-pulse">
                      <span className="text-2xl">💡</span>
                      <div>
                        <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider">Hint 1 — ½ Points</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                          {generateHintMask(currentRound.answer).map((word, wIdx) => (
                            <div key={wIdx} className="flex gap-1.5">
                              {word.map((cell, cIdx) => (
                                <div key={cIdx} className="flex flex-col items-center">
                                  <div className={`w-7 h-8 flex items-center justify-center text-lg font-black rounded border-2 transition-all ${cell.revealed ? 'border-yellow-500 text-yellow-700 bg-yellow-100' : 'border-yellow-300 text-transparent bg-yellow-50/50'}`}>
                                    {cell.revealed ? cell.char : ''}
                                  </div>
                                  <div className="h-0.5 w-full mt-0.5 rounded bg-yellow-400" />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Hint 2 — catchy movie fact */}
                    {hintFact && (
                      <div className="bg-orange-50 border border-orange-300 rounded-2xl px-5 py-3 flex items-start gap-3 shadow-sm">
                        <span className="text-2xl">🎬</span>
                        <div>
                          <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">Movie Dialogue</p>
                          <p className="text-orange-900 font-semibold text-sm leading-snug">{hintFact}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    Score: {scoreRef.current}
                  </span>
                  <span
                    className={`flex items-center gap-1.5 font-bold ${
                      timeLeft <= 5 && imageReady ? 'text-[#EA4335] animate-pulse' : 'text-gray-700'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    {imageReady ? `${timeLeft}s` : '—'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                {globalState?.roundWinner && globalState.roundWinner !== auth.currentUser?.uid ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center"
                  >
                    <p className="text-gray-500 uppercase tracking-widest text-xs mb-1">Result</p>
                    <p className="text-5xl font-black text-[#EA4335] mb-4">LOCKED</p>
                    
                    <p className="text-sm font-bold text-gray-800 mb-2">
                      <span className="text-[#FF5722]">{globalState.roundWinnerName}</span> answered fastest!
                    </p>
                    
                    <p className="text-sm text-gray-500 mb-1">The correct answer was</p>
                    <p className="text-xl font-bold text-gray-900 mb-4">{currentRound.answer}</p>
                  </motion.div>
                ) : effectiveGameState === 'roundResult' && lastResult ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center"
                  >
                    <p className="text-gray-500 uppercase tracking-widest text-xs mb-1">Result</p>
                    {lastResult.wonRound ? (
                      <p className="text-4xl lg:text-5xl font-black text-[#34A853] mb-4">YOU WON!</p>
                    ) : lastResult.isCorrect ? (
                      <p className="text-3xl font-black text-[#EA4335] mb-4">TOO SLOW!</p>
                    ) : (
                      <p className="text-5xl font-black text-[#EA4335] mb-4">INCORRECT</p>
                    )}

                    <p className="text-sm text-gray-500 mb-1">The answer was</p>
                    <p className="text-xl font-bold text-gray-900 mb-4">{lastResult.answer}</p>
                    {lastResult.guess && (
                      <p className="text-sm text-gray-500">You guessed: "{lastResult.guess}"</p>
                    )}
                  </motion.div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="bg-gray-50/80 border border-gray-200 p-6 rounded-3xl shadow-lg"
                  >
                    <label
                      htmlFor="guessInput"
                      className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider"
                    >
                      What is this?
                    </label>
                    <input
                      id="guessInput"
                      type="text"
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      disabled={!imageReady}
                      placeholder="Type the logo or movie name..."
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722] transition-all disabled:opacity-50"
                      autoComplete="off"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!imageReady || !guess.trim()}
                      className="w-full mt-4 bg-[#FF5722] hover:bg-orange-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg py-4"
                    >
                      Submit Guess <Send className="w-5 h-5" />
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          )}

          {effectiveGameState === 'finalResult' && (
            <motion.div
              key="final"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto bg-gray-50 border border-gray-200 rounded-3xl p-8 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10 text-[#FF5722]" />
              </div>
              <h3 className="text-3xl font-black mb-2 text-gray-900">Game Over!</h3>
              <p className="text-gray-600 mb-6 text-lg">
                You got {scoreRef.current} out of {rounds.length} right.
              </p>

              <div className="bg-white rounded-2xl py-4 mb-8 border border-gray-200">
                <p className="text-gray-500 uppercase tracking-widest text-xs mb-1">Arcade Points</p>
                <p className="text-4xl font-black text-[#FF5722]">
                  {earnedPoints === null ? '—' : earnedPoints}
                  <span className="text-lg text-gray-400"> / 100</span>
                </p>
                {earnedPoints === 0 && (
                  <p className="text-xs text-gray-500 mt-2 px-2">
                    You need {PASS_MARK_PCT}% to score. Nothing added this time — try again!
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {/* Remove Play Again button since Admin controls the flow */}
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="w-full inline-flex justify-center items-center gap-2 px-6 py-4 bg-white hover:bg-gray-50 text-gray-800 rounded-xl font-bold border border-gray-200 transition-colors"
                  >
                    Go to Admin Panel
                  </button>
                )}
                <button
                  onClick={() => navigate('/arcade')}
                  className="w-full px-6 py-4 bg-[#4285F4] hover:bg-blue-600 text-white rounded-xl font-bold transition-colors shadow-lg"
                >
                  Back to Arcade
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GuessTheTrivia;
