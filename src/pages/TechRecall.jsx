import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, CheckCircle2, XCircle, RotateCcw, Play, Lightbulb } from 'lucide-react';
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { updateArcadeScore } from '../utils/updateArcadeScore';
import { TECH_RECALL_WORDS } from '../utils/gameData/techRecallData';
import { arcadePoints, drawGradedSet, isCloseEnough, PASS_MARKS } from '../utils/scoring';
import { createGameRequestPayload, isApprovedForThisDevice } from '../utils/gameRequests';

const GAME_ID = 'tech-recall';
const PASS_MARK_PCT = Math.round(PASS_MARKS['tech-recall'] * 100);
const TOTAL_ROUNDS = 8;
const DIFFICULTY_PROFILE = { easy: 5, medium: 2, hard: 1 };
const READ_DURATION = 10;  // seconds to read the hint before input appears
const ROUND_DURATION = 90; // seconds to guess after the reading phase

// How many seconds between each letter reveal (max 3 reveals)
// With 90s: reveals at 30s, 60s, 90s elapsed (60s, 30s, 0s remaining)
const REVEAL_INTERVAL = 30;

// Point multipliers based on how many letters were revealed when answered
// 0 reveals = full, 1 = 80%, 2 = 60%, 3 = 40%
const HINT_MULTIPLIERS = [1.0, 0.8, 0.6, 0.4];

const REVEAL_MS = 1800; // brief "correct/wrong" screen duration

/**
 * Build the masked display for a word.
 * revealCount = how many extra letters have been shown beyond the first.
 * Always show index 0. Then reveal indices 1..revealCount deterministically.
 * Returns an array of { char, revealed } for each letter.
 */
function buildMask(word, revealCount) {
  if (!word) return [];
  const upper = word.toUpperCase();
  // Strategy: reveal letters from the end to give useful shape info
  // positions to reveal: [0] always, then pick evenly-spaced interior positions
  const len = upper.length;
  const revealed = new Set([0]); // first letter always shown

  // Pre-compute up to 3 extra positions spread through the word
  // We go: ~33%, ~66%, ~50% of the word
  const extras = [
    Math.floor(len * 0.7),
    Math.floor(len * 0.4),
    len - 1,
  ].slice(0, 3);

  for (let i = 0; i < revealCount && i < extras.length; i++) {
    revealed.add(extras[i]);
  }

  return upper.split('').map((char, idx) => ({
    char,
    revealed: revealed.has(idx),
  }));
}

export default function TechRecall() {
  const navigate = useNavigate();

  // game-level state
  const [gameState, setGameState] = useState('intro'); // intro | reading | playing | revealing | results
  const [readTimeLeft, setReadTimeLeft] = useState(READ_DURATION);
  const [words, setWords] = useState([]); // array of word objects {word, hint, difficulty}
  const [currentRound, setCurrentRound] = useState(0);
  const [adminEmails, setAdminEmails] = useState([]);
  const [requestStatus, setRequestStatus] = useState('none');
  const [lobbyCode, setLobbyCode] = useState(null);
  const [requestId, setRequestId] = useState('');

  // round-level state
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [revealCount, setRevealCount] = useState(0); // 0..3 extra letters revealed
  const [inputValue, setInputValue] = useState('');
  const [isCorrect, setIsCorrect] = useState(null);
  const [wrongShake, setWrongShake] = useState(0);

  // results / saving
  const [roundResults, setRoundResults] = useState([]); // [{word, correct, hintsUsed}]
  const [earnedPoints, setEarnedPoints] = useState(null);
  const [savingScore, setSavingScore] = useState(false);

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const roundLockRef = useRef(false);
  const savedRef = useRef(false);
  const revealCountRef = useRef(0); // mirror for use inside setInterval

  const isAdmin = auth.currentUser && adminEmails.includes(auth.currentUser.email?.toLowerCase());
  const currentWordObj = words[currentRound];

  // Firestore: admin list
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists() && snap.data().adminEmails) {
        setAdminEmails(snap.data().adminEmails.map((e) => e.toLowerCase()));
      }
    });
    return () => unsub();
  }, []);

  const startGame = useCallback(() => {
    const picked = drawGradedSet(TECH_RECALL_WORDS, DIFFICULTY_PROFILE);
    setWords(picked);
    setCurrentRound(0);
    setRoundResults([]);
    setInputValue('');
    setIsCorrect(null);
    setEarnedPoints(null);
    setTimeLeft(ROUND_DURATION);
    setRevealCount(0);
    revealCountRef.current = 0;
    roundLockRef.current = false;
    savedRef.current = false;
    setReadTimeLeft(READ_DURATION);
    setGameState('reading');
  }, []);

  // Firestore: game request listener → auto-start on admin approval
  useEffect(() => {
    if (!auth.currentUser) return;
    const reqId = `${auth.currentUser.uid}_${GAME_ID}`;
    setRequestId(reqId);

    const unsub = onSnapshot(doc(db, 'gameRequests', reqId), (snap) => {
      if (!snap.exists()) { setRequestStatus('none'); setLobbyCode(null); return; }
      const data = snap.data();
      setLobbyCode(data.lobbyCode || null);
      if (data.status === 'approved' && !isApprovedForThisDevice(data, GAME_ID)) {
        setRequestStatus('device-mismatch');
        return;
      }
      setRequestStatus(data.status);
      if (isApprovedForThisDevice(data, GAME_ID)) {
        setGameState((s) => {
          if (s !== 'intro') return s;
          setTimeout(startGame, 0);
          return s;
        });
      }
    });
    return () => unsub();
  }, [startGame]);

  // ── 6-second reading phase ────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'reading') return;
    setReadTimeLeft(READ_DURATION);
    const interval = setInterval(() => {
      setReadTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setGameState('playing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, currentRound]);

  // ── Core round timer + letter reveal ────────────────────────────────────────
  const finishRound = useCallback((correct) => {
    if (roundLockRef.current) return;
    roundLockRef.current = true;
    clearInterval(timerRef.current);

    setIsCorrect(correct);
    setRoundResults((prev) => [
      ...prev,
      { word: words[currentRound]?.word, correct, hintsUsed: revealCountRef.current },
    ]);
    setGameState('revealing');
  }, [words, currentRound]);

  useEffect(() => {
    if (gameState !== 'playing') {
      clearInterval(timerRef.current);
      return;
    }

    // Reset for this round
    roundLockRef.current = false;
    revealCountRef.current = revealCount; // sync ref

    inputRef.current?.focus();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;

        // Letter reveals: at 15s, 10s, 5s remaining (i.e., after 5s, 10s, 15s elapsed)
        const elapsed = ROUND_DURATION - next;
        const newReveal = Math.min(3, Math.floor(elapsed / REVEAL_INTERVAL));
        if (newReveal > revealCountRef.current) {
          revealCountRef.current = newReveal;
          setRevealCount(newReveal);
        }

        if (next <= 0) {
          clearInterval(timerRef.current);
          finishRound(false);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, currentRound]);

  // Advance after reveal screen
  useEffect(() => {
    if (gameState !== 'revealing') return;
    const t = setTimeout(() => {
      if (currentRound < words.length - 1) {
        setCurrentRound((r) => r + 1);
        setInputValue('');
        setIsCorrect(null);
        setRevealCount(0);
        revealCountRef.current = 0;
        setTimeLeft(ROUND_DURATION);
        setReadTimeLeft(READ_DURATION);
        setGameState('reading');
      } else {
        setGameState('results');
      }
    }, REVEAL_MS);
    return () => clearTimeout(t);
  }, [gameState, currentRound, words.length]);

  // Save score once on results
  useEffect(() => {
    if (gameState !== 'results' || savedRef.current) return;
    savedRef.current = true;

    const solved = roundResults.filter((r) => r.correct).length;
    const totalHintWeight = roundResults.reduce(
      (sum, r) => sum + HINT_MULTIPLIERS[Math.min(r.hintsUsed, 3)],
      0
    );
    // Accuracy weighted by hint multipliers (max = TOTAL_ROUNDS × 1.0)
    const weightedAccuracy = solved > 0 ? totalHintWeight / roundResults.length : 0;

    const points = arcadePoints({
      correct: Math.round(weightedAccuracy * roundResults.length),
      wrong: roundResults.length - Math.round(weightedAccuracy * roundResults.length),
      total: roundResults.length,
      wrongPenalty: 0,
      speed: 0,
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
          totalRounds: roundResults.length,
          points,
          lobbyCode: lobbyCode || null,
          timestamp: serverTimestamp(),
        });
        await updateArcadeScore(user.uid, user.displayName, user.email, GAME_ID, points);
        if (requestId) {
          await setDoc(doc(db, 'gameRequests', requestId), { status: 'completed' }, { merge: true });
        }
      } catch (err) {
        console.error('Error saving Tech Recall score:', err);
      } finally {
        setSavingScore(false);
      }
    })();
  }, [gameState, roundResults, requestId, lobbyCode]);

  const replay = () => {
    savedRef.current = false;
    startGame();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (gameState !== 'playing' || !inputValue.trim()) return;

    if (isCloseEnough(inputValue, currentWordObj?.word)) {
      finishRound(true);
    } else {
      setWrongShake((n) => n + 1);
      setInputValue('');
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const mask = buildMask(currentWordObj?.word, revealCount);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - timeLeft / ROUND_DURATION);
  const solvedCount = roundResults.filter((r) => r.correct).length;

  const hintLabel = ['No hints used', '1 hint used', '2 hints used', '3 hints used'];
  const hintColor = ['text-emerald-500', 'text-yellow-500', 'text-orange-500', 'text-red-500'];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-gray-100 z-10">
        <button
          onClick={() => navigate('/arcade')}
          className="flex items-center text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 mr-2" />
          Back
        </button>
        {gameState !== 'intro' && gameState !== 'results' && (
          <div className="text-sm sm:text-base font-bold bg-gray-50 px-4 py-2 rounded-full border border-gray-200 flex items-center gap-3">
            {gameState === 'reading' && <span className="text-[#4285F4] animate-pulse">Read… {readTimeLeft}s</span>}
            <span className="text-gray-500">Round {currentRound + 1}/{words.length}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">✓ <span className="text-emerald-500">{solvedCount}</span></span>
          </div>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center p-4 relative">
        <AnimatePresence mode="wait">

          {/* ── INTRO ── */}
          {gameState === 'intro' && (
            <motion.div
              key="intro"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="text-center max-w-2xl w-full"
            >
              <h1 className="text-5xl md:text-7xl font-black mb-4 text-[#4285F4]">TECH-RECALL</h1>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed max-w-lg mx-auto">
                Read the <span className="text-[#4285F4] font-bold">hint</span>, then guess the tech word
                from the blanks. Every <span className="text-[#FBBC04] font-bold">20 seconds</span> a new
                letter appears — but more hints means fewer points!
              </p>

              {/* How points work */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 max-w-lg mx-auto">
                {['Full pts', '80% pts', '60% pts', '40% pts'].map((label, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                    <div className={`text-lg font-black mb-1 ${hintColor[i]}`}>{label}</div>
                    <div className="text-xs text-gray-400">{i === 0 ? 'Before 1st hint' : `After hint ${i}`}</div>
                  </div>
                ))}
              </div>

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
                    To play this game and win exciting GDG swags, please visit our physical stall and request access.
                  </p>

                  {requestStatus === 'none' && (
                    <button
                      onClick={async () => {
                        if (!auth.currentUser) return;
                        await setDoc(
                          doc(db, 'gameRequests', `${auth.currentUser.uid}_${GAME_ID}`),
                          createGameRequestPayload(auth.currentUser, GAME_ID, serverTimestamp)
                        );
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
                          try { await deleteDoc(doc(db, 'gameRequests', requestId)); }
                          catch (e) { console.error('Failed to cancel request', e); }
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
                  {requestStatus === 'device-mismatch' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
                      This Gmail was approved on another device. Use the device that showed this lobby code, or ask a volunteer to reject and request again.
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── READING (hint visible, no input yet) ── */}
          {gameState === 'reading' && currentWordObj && (
            <motion.div
              key={`reading-${currentRound}`}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl flex flex-col items-center gap-6"
            >
              {/* Reading countdown */}
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-5 py-2.5 rounded-full">
                <div className="w-2.5 h-2.5 rounded-full bg-[#4285F4] animate-pulse" />
                <span className="text-[#4285F4] font-bold text-sm">Read the hint — guessing starts in {readTimeLeft}s</span>
              </div>

              {/* Hint card */}
              <div className="w-full bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex gap-3 items-start">
                <Lightbulb className="w-5 h-5 text-[#4285F4] mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 text-sm leading-relaxed font-medium">{currentWordObj.hint}</p>
              </div>

              {/* Letter mask (first letter only during reading) */}
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 px-2">
                {buildMask(currentWordObj.word, 0).map((cell, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div className={`w-9 h-10 sm:w-11 sm:h-12 rounded-lg flex items-center justify-center text-xl sm:text-2xl font-black border-2 ${
                      cell.revealed ? 'border-[#4285F4] text-[#4285F4] bg-blue-50' : 'border-gray-300 bg-gray-50'
                    }`}>
                      {cell.revealed ? cell.char : ''}
                    </div>
                    <div className="h-0.5 w-full mt-1 rounded bg-gray-300" />
                  </div>
                ))}
              </div>

              <p className="text-gray-400 text-sm">{currentWordObj.word.length} letters</p>
            </motion.div>
          )}

          {/* ── PLAYING ── */}
          {gameState === 'playing' && currentWordObj && (
            <motion.div
              key={`playing-${currentRound}`}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl flex flex-col items-center gap-6"
            >
              {/* Timer ring + reveal indicators */}
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r={radius}
                      fill="none"
                      stroke={timeLeft <= 5 ? '#EA4335' : timeLeft <= 10 ? '#FBBC04' : '#4285F4'}
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-1000 ease-linear"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className={`text-3xl font-black ${timeLeft <= 5 ? 'text-[#EA4335] animate-pulse' : 'text-gray-900'}`}>
                    {timeLeft}
                  </span>
                </div>

                {/* Hint dots */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Letters revealed</p>
                  <div className="flex gap-2">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        initial={false}
                        animate={{ scale: revealCount > i ? [1, 1.3, 1] : 1 }}
                        transition={{ duration: 0.3 }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${
                          revealCount > i
                            ? 'bg-orange-100 border-orange-400 text-orange-600'
                            : 'bg-gray-100 border-gray-200 text-gray-300'
                        }`}
                      >
                        {i + 1}
                      </motion.div>
                    ))}
                  </div>
                  <p className={`text-xs font-semibold mt-1 ${hintColor[Math.min(revealCount, 3)]}`}>
                    {hintLabel[Math.min(revealCount, 3)]}
                  </p>
                </div>
              </div>

              {/* Hint card */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex gap-3 items-start"
              >
                <Lightbulb className="w-5 h-5 text-[#4285F4] mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 text-sm leading-relaxed font-medium">{currentWordObj.hint}</p>
              </motion.div>

              {/* Letter mask */}
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 px-2">
                {mask.map((cell, idx) => (
                  <AnimatePresence key={idx}>
                    <motion.div
                      initial={false}
                      animate={cell.revealed ? { backgroundColor: '#e8f0fe', scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 0.35 }}
                      className={`relative flex flex-col items-center`}
                    >
                      <div
                        className={`w-9 h-10 sm:w-11 sm:h-12 rounded-lg flex items-center justify-center text-xl sm:text-2xl font-black border-2 transition-all ${
                          cell.revealed
                            ? 'border-[#4285F4] text-[#4285F4] bg-blue-50'
                            : 'border-gray-300 text-transparent bg-gray-50'
                        }`}
                      >
                        {cell.revealed ? cell.char : ''}
                      </div>
                      {/* underscore line */}
                      <div className="h-0.5 w-full mt-1 rounded bg-gray-300" />
                    </motion.div>
                  </AnimatePresence>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
                <motion.input
                  key={wrongShake}
                  animate={wrongShake ? { x: [0, -10, 10, -6, 6, 0] } : {}}
                  transition={{ duration: 0.35 }}
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your answer…"
                  className="w-full bg-gray-50 border-2 border-[#4285F4] rounded-2xl px-5 py-4 text-xl text-center text-gray-900 focus:outline-none focus:ring-4 focus:ring-[#4285F4]/30 transition-shadow tracking-widest shadow-sm"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <button
                  type="submit"
                  className="w-full bg-[#4285F4] hover:bg-blue-600 text-white font-bold py-4 rounded-2xl text-xl transition-all shadow-lg active:scale-[0.98]"
                >
                  Submit
                </button>
              </form>
            </motion.div>
          )}

          {/* ── REVEALING ── */}
          {gameState === 'revealing' && (
            <motion.div
              key={`reveal-${currentRound}`}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center gap-4"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                {isCorrect
                  ? <CheckCircle2 className="w-24 h-24 text-[#34A853]" />
                  : <XCircle className="w-24 h-24 text-[#EA4335]" />}
              </motion.div>
              <h3 className="text-2xl text-gray-500 uppercase tracking-wider">
                {isCorrect ? 'Correct!' : 'The answer was'}
              </h3>
              <h2 className={`text-4xl sm:text-6xl font-black tracking-widest break-all px-4 ${isCorrect ? 'text-[#34A853]' : 'text-[#EA4335]'}`}>
                {words[currentRound]?.word}
              </h2>
              {isCorrect && (
                <p className={`text-sm font-semibold ${hintColor[Math.min(revealCount, 3)]}`}>
                  {hintLabel[Math.min(revealCount, 3)]} — {Math.round(HINT_MULTIPLIERS[Math.min(revealCount, 3)] * 100)}% points
                </p>
              )}
            </motion.div>
          )}

          {/* ── RESULTS ── */}
          {gameState === 'results' && (
            <motion.div
              key="results"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center max-w-md w-full"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2 }}
              >
                <Trophy className="w-20 h-20 mx-auto text-[#FBBC04] mb-4" />
              </motion.div>

              <h2 className="text-4xl font-black mb-5">Game Over!</h2>

              {/* Per-round summary */}
              <div className="space-y-2 mb-5 text-left">
                {roundResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                    <div className="flex items-center gap-3">
                      {r.correct
                        ? <CheckCircle2 className="w-5 h-5 text-[#34A853]" />
                        : <XCircle className="w-5 h-5 text-[#EA4335]" />}
                      <span className="font-bold text-gray-800">{r.word}</span>
                    </div>
                    <span className={`text-xs font-semibold ${r.correct ? hintColor[Math.min(r.hintsUsed, 3)] : 'text-gray-400'}`}>
                      {r.correct
                        ? `${Math.round(HINT_MULTIPLIERS[Math.min(r.hintsUsed, 3)] * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-[#e8f0fe] rounded-2xl py-5 mb-5 border border-blue-100">
                <p className="text-gray-500 uppercase tracking-widest text-xs mb-1">Arcade Points</p>
                <p className="text-4xl font-black text-[#4285F4]">
                  {earnedPoints === null ? '—' : earnedPoints}
                  <span className="text-lg text-gray-400"> / 100</span>
                </p>
                {earnedPoints === 0 && (
                  <p className="text-xs text-gray-500 mt-2 px-4">
                    You need {PASS_MARK_PCT}% to score. Nothing added — try again!
                  </p>
                )}
              </div>

              {auth.currentUser ? (
                savingScore
                  ? <p className="text-gray-500 mb-5 animate-pulse">Saving score…</p>
                  : <p className="text-[#4285F4] mb-5 font-medium">Score saved to leaderboard! ✨</p>
              ) : (
                <p className="text-gray-500 mb-5 text-sm">Log in to save your scores.</p>
              )}

              <div className="flex flex-col gap-3">
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
