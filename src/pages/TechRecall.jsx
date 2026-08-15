import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, CheckCircle2, XCircle, RotateCcw, Play } from 'lucide-react';
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { updateArcadeScore } from '../utils/updateArcadeScore';
import { TECH_RECALL_WORDS } from '../utils/gameData/techRecallData';
import { arcadePoints, drawGradedSet, isCloseEnough, PASS_MARKS } from '../utils/scoring';

const GAME_ID = 'tech-recall';
const PASS_MARK_PCT = Math.round(PASS_MARKS['tech-recall'] * 100);
const TOTAL_ROUNDS = 8;
const DIFFICULTY_PROFILE = { easy: 3, medium: 3, hard: 2 };
const PLAY_DURATION = 15; // seconds to type, per round
const REVEAL_MS = 1600;

// Longer words need a longer look. Kept tight so the whole game stays ~90s.
const flashMsFor = (word = '') =>
  Math.min(3200, Math.max(1400, 900 + word.length * 140));

export default function TechRecall() {
  const navigate = useNavigate();

  const [gameState, setGameState] = useState('intro'); // intro|flashing|playing|revealing|results
  const [words, setWords] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [score, setScore] = useState(0);
  const [adminEmails, setAdminEmails] = useState([]);
  const [requestStatus, setRequestStatus] = useState('none');
  const [lobbyCode, setLobbyCode] = useState(null);
  const [requestId, setRequestId] = useState('');

  const [timeLeft, setTimeLeft] = useState(PLAY_DURATION);
  const [inputValue, setInputValue] = useState('');
  const [isCorrect, setIsCorrect] = useState(null);
  const [wrongShake, setWrongShake] = useState(0);
  const [savingScore, setSavingScore] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(null);

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const timeBankRef = useRef(0); // seconds left, summed over solved rounds only
  const roundLockRef = useRef(false); // one resolution per round, whatever fires first

  const isAdmin = auth.currentUser && adminEmails.includes(auth.currentUser.email?.toLowerCase());
  const currentWord = words[currentRound];

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists() && snap.data().adminEmails) {
        setAdminEmails(snap.data().adminEmails.map((e) => e.toLowerCase()));
      }
    });
    return () => unsub();
  }, []);

  const startGame = useCallback(() => {
    setWords(drawGradedSet(TECH_RECALL_WORDS, DIFFICULTY_PROFILE).map((w) => w.word));
    setScore(0);
    setCurrentRound(0);
    setInputValue('');
    setIsCorrect(null);
    setEarnedPoints(null);
    setTimeLeft(PLAY_DURATION);
    timeBankRef.current = 0;
    roundLockRef.current = false;
    setGameState('flashing');
  }, []);

  // Admin approval at the stall starts the game automatically.
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
      setRequestStatus(snap.data().status);
      setLobbyCode(snap.data().lobbyCode || null);
      if (snap.data().status === 'approved') {
        setGameState((s) => {
          if (s !== 'intro') return s;
          // Defer so we never call setState on another component's render.
          setTimeout(startGame, 0);
          return s;
        });
      }
    });
    return () => unsub();
  }, [startGame]);

  // Flash the word, then hand over to typing.
  useEffect(() => {
    if (gameState !== 'flashing' || !currentWord) return;
    const t = setTimeout(() => {
      roundLockRef.current = false;
      setTimeLeft(PLAY_DURATION);
      setGameState('playing');
    }, flashMsFor(currentWord));
    return () => clearTimeout(t);
  }, [gameState, currentWord]);

  const finishRound = useCallback(
    (correct, secondsLeft) => {
      if (roundLockRef.current) return;
      roundLockRef.current = true;
      clearInterval(timerRef.current);

      setIsCorrect(correct);
      if (correct) {
        setScore((s) => s + 1);
        timeBankRef.current += Math.max(0, secondsLeft);
      }
      setGameState('revealing');
    },
    []
  );

  useEffect(() => {
    if (gameState !== 'playing') {
      clearInterval(timerRef.current);
      return;
    }
    inputRef.current?.focus();
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          finishRound(false, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameState, currentRound, finishRound]);

  // Advance out of the reveal screen.
  useEffect(() => {
    if (gameState !== 'revealing') return;
    const t = setTimeout(() => {
      if (currentRound < words.length - 1) {
        setCurrentRound((r) => r + 1);
        setInputValue('');
        setIsCorrect(null);
        setGameState('flashing');
      } else {
        setGameState('results');
      }
    }, REVEAL_MS);
    return () => clearTimeout(t);
  }, [gameState, currentRound, words.length]);

  // Save once, when the results screen is reached.
  const savedRef = useRef(false);
  useEffect(() => {
    if (gameState !== 'results' || savedRef.current) return;
    savedRef.current = true;

    const solved = score;
    const speed = solved > 0 ? timeBankRef.current / (solved * PLAY_DURATION) : 0;
    // Free text: nothing to guess at, so wrong answers carry no extra penalty.
    const points = arcadePoints({
      correct: solved,
      wrong: words.length - solved,
      total: words.length,
      wrongPenalty: 0,
      speed,
      passMark: PASS_MARKS[GAME_ID],
    });
    setEarnedPoints(points);

    const user = auth.currentUser;
    if (!user) return;

    (async () => {
      setSavingScore(true);
      try {
        await setDoc(doc(db, 'techRecallScores', user.uid), {
          playerId: user.uid,
          displayName: user.displayName || 'Player',
          email: user.email,
          score: solved,
          totalRounds: words.length,
          points,
          lobbyCode: lobbyCode || null,
          timestamp: serverTimestamp(),
        });
        await updateArcadeScore(user.uid, user.displayName, user.email, GAME_ID, points);
        if (requestId) {
          await setDoc(doc(db, 'gameRequests', requestId), { status: 'completed' }, { merge: true });
        }
      } catch (error) {
        console.error('Error saving Tech Recall score:', error);
      } finally {
        setSavingScore(false);
      }
    })();
  }, [gameState, score, words.length, requestId, lobbyCode]);

  const replay = () => {
    savedRef.current = false;
    startGame();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (gameState !== 'playing' || !inputValue.trim()) return;

    if (isCloseEnough(inputValue, currentWord)) {
      finishRound(true, timeLeft);
    } else {
      // Wrong guess does not burn the round - the clock is the only cost.
      setWrongShake((n) => n + 1);
      setInputValue('');
    }
  };

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - timeLeft / PLAY_DURATION);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-hidden flex flex-col">
      <header className="p-4 flex items-center justify-between border-b border-gray-100 z-10">
        <button
          onClick={() => navigate('/arcade')}
          className="flex items-center text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 mr-2" />
          Back to Arcade
        </button>
        {gameState !== 'intro' && gameState !== 'results' && (
          <div className="text-base sm:text-xl font-bold bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
            <span className="text-gray-500">Round {currentRound + 1}/</span>
            {words.length}
            <span className="mx-3 text-gray-600">|</span>
            <span className="text-gray-500">Score: </span>
            <span className="text-[#FBBC04]">{score}</span>
          </div>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center p-4 relative">
        <AnimatePresence mode="wait">
          {gameState === 'intro' && (
            <motion.div
              key="intro"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="text-center max-w-2xl"
            >
              <h1 className="text-5xl md:text-7xl font-black mb-6 text-[#4285F4]">TECH-RECALL</h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-4 leading-relaxed">
                A tech word flashes for about{' '}
                <span className="text-[#4285F4] font-bold">2 seconds</span>. Memorise it, then type
                it before the <span className="text-[#EA4335] font-bold">{PLAY_DURATION} second</span>{' '}
                timer runs out.
              </p>
              <p className="text-sm text-gray-500 mb-8">
                {TOTAL_ROUNDS} rounds, getting harder. Wrong guesses don't end the round — keep
                trying until the clock stops. Small typos are forgiven.
              </p>

              {isAdmin ? (
                <button
                  onClick={startGame}
                  className="inline-flex items-center px-8 py-4 bg-[#34A853] hover:bg-green-600 text-white font-bold rounded-full text-xl transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-green-500/30"
                >
                  <Play className="w-6 h-6 mr-3 fill-current" />
                  Start Game
                </button>
              ) : (
                <div className="bg-gray-50/80 border border-gray-200 p-8 rounded-3xl max-w-lg mx-auto shadow-2xl">
                  <div className="bg-blue-500/20 text-[#4285F4] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trophy size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Visit Our Stall to Play!</h3>
                  <p className="text-gray-500 text-base leading-relaxed mb-6">
                    To play this game and win exciting GDG swags, please visit our physical stall and
                    request access.
                  </p>

                  {requestStatus === 'none' && (
                    <button
                      onClick={async () => {
                        if (!auth.currentUser) return;
                        await setDoc(doc(db, 'gameRequests', `${auth.currentUser.uid}_${GAME_ID}`), {
                          userId: auth.currentUser.uid,
                          userName: auth.currentUser.displayName || 'Player',
                          userEmail: auth.currentUser.email,
                          gameId: GAME_ID,
                          status: 'pending',
                          lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
                          timestamp: serverTimestamp(),
                        });
                      }}
                      className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#4285F4] hover:bg-blue-600 text-white font-bold rounded-xl text-lg transition-colors shadow-lg"
                    >
                      Request to Play
                    </button>
                  )}

                  {requestStatus === 'pending' && (
                    <div className="flex flex-col gap-3">
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                        <span className="font-bold">Waiting for Admin Approval...</span>
                      </div>
                      <div className="text-center font-mono text-xl font-bold bg-gray-50 py-2 rounded-lg border border-gray-200">
                        Lobby Code: <span className="text-[#4285F4]">{lobbyCode || '...'}</span>
                      </div>
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
                    </div>
                  )}

                  {requestStatus === 'completed' && (
                    <div className="bg-gray-100 text-gray-500 p-4 rounded-xl">
                      <span className="font-bold">You have already played this game.</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {gameState === 'flashing' && (
            <motion.div
              key={`flash-${currentRound}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-center"
            >
              <p className="text-gray-500 text-xl mb-4 tracking-widest uppercase">
                Memorise the word
              </p>
              <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-[#4285F4] tracking-wider break-all px-4">
                {currentWord}
              </h2>
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div
              key="playing"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="w-full max-w-md flex flex-col items-center"
            >
              <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={timeLeft <= 5 ? '#EA4335' : '#4285F4'}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-linear"
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  className={`text-4xl font-black ${
                    timeLeft <= 5 ? 'text-[#EA4335] animate-pulse' : 'text-gray-900'
                  }`}
                >
                  {timeLeft}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="w-full">
                <p className="text-center text-gray-500 mb-2">
                  {currentWord?.length} letters
                </p>
                <motion.input
                  key={wrongShake}
                  animate={wrongShake ? { x: [0, -10, 10, -6, 6, 0] } : {}}
                  transition={{ duration: 0.35 }}
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type the word..."
                  className="w-full bg-gray-50 border-2 border-[#4285F4] rounded-2xl px-6 py-5 text-2xl text-center text-gray-900 focus:outline-none focus:ring-4 focus:ring-[#4285F4]/50 transition-shadow tracking-widest shadow-lg"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <button
                  type="submit"
                  className="w-full mt-4 bg-[#4285F4] hover:bg-blue-600 text-white font-bold py-4 rounded-2xl text-xl transition-all shadow-lg active:scale-[0.98]"
                >
                  Submit
                </button>
              </form>
            </motion.div>
          )}

          {gameState === 'revealing' && (
            <motion.div
              key={`reveal-${currentRound}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                {isCorrect ? (
                  <CheckCircle2 className="w-24 h-24 text-[#34A853] mb-6" />
                ) : (
                  <XCircle className="w-24 h-24 text-[#EA4335] mb-6" />
                )}
              </motion.div>
              <h3 className="text-2xl text-gray-500 mb-2 uppercase tracking-wider">
                {isCorrect ? 'Correct!' : 'The word was'}
              </h3>
              <h2
                className={`text-4xl sm:text-6xl font-black tracking-widest break-all px-4 ${
                  isCorrect ? 'text-[#34A853]' : 'text-[#EA4335]'
                }`}
              >
                {currentWord}
              </h2>
            </motion.div>
          )}

          {gameState === 'results' && (
            <motion.div
              key="results"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center max-w-md w-full bg-gray-50/50 p-8 rounded-3xl border border-gray-200"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2 }}
              >
                <Trophy className="w-24 h-24 mx-auto text-[#FBBC04] mb-6" />
              </motion.div>

              <h2 className="text-4xl font-black mb-4">Game Over!</h2>

              <div className="bg-white rounded-2xl py-6 mb-4 border border-gray-200">
                <p className="text-gray-500 mb-2 uppercase tracking-widest text-sm">Words Recalled</p>
                <p className="text-5xl font-black">
                  <span className="text-[#34A853]">{score}</span>
                  <span className="text-gray-400 mx-2">/</span>
                  <span className="text-gray-400">{words.length}</span>
                </p>
              </div>

              <div className="bg-[#e8f0fe] rounded-2xl py-4 mb-8 border border-blue-100">
                <p className="text-gray-500 uppercase tracking-widest text-xs mb-1">Arcade Points</p>
                <p className="text-4xl font-black text-[#4285F4]">
                  {earnedPoints === null ? '—' : earnedPoints}
                  <span className="text-lg text-gray-400"> / 100</span>
                </p>
                {earnedPoints === 0 && (
                  <p className="text-xs text-gray-500 mt-2 px-2">
                    You need {PASS_MARK_PCT}% to score. Nothing added this time — try again!
                  </p>
                )}
              </div>

              {auth.currentUser ? (
                savingScore ? (
                  <p className="text-gray-500 mb-8 animate-pulse">Saving score to leaderboard...</p>
                ) : (
                  <p className="text-[#4285F4] mb-8 font-medium">Score saved to leaderboard! ✨</p>
                )
              ) : (
                <p className="text-gray-500 mb-8 text-sm">Log in to save your scores.</p>
              )}

              <div className="flex flex-col gap-4">
                {isAdmin && (
                  <button
                    onClick={replay}
                    className="flex items-center justify-center w-full py-4 bg-[#4285F4] hover:bg-blue-600 text-white font-bold rounded-xl transition-colors text-lg"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" /> Play Again
                  </button>
                )}
                <button
                  onClick={() => navigate('/arcade')}
                  className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors text-lg"
                >
                  Back to Arcade
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
