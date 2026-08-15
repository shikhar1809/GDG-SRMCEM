import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { PROMPT_CHALLENGES } from '../utils/gameData/promptWarsData';
import { updateArcadeScore } from '../utils/updateArcadeScore';
import { arcadePointsFromRatio, drawGradedSet, promptSimilarity, contentWords, PASS_MARKS } from '../utils/scoring';
import { Send, Clock, ChevronLeft, Trophy, RotateCcw } from 'lucide-react';
import { useGameSession } from '../utils/useGameSession';
import StallGate from '../components/StallGate';
import { useNavigate } from 'react-router-dom';

const GAME_ID = 'prompt-wars';
const PASS_MARK_PCT = Math.round(PASS_MARKS['prompt-wars'] * 100);
const TOTAL_ROUNDS = 3;
const DIFFICULTY_PROFILE = { easy: 1, medium: 1, hard: 1 };
const ROUND_TIME = 40;
const REVEAL_MS = 4000;

const PromptWars = () => {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [gameState, setGameState] = useState('intro'); // intro|playing|roundResult|finalResult
  const [promptGuess, setPromptGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [lastResult, setLastResult] = useState(null); // { ratio, matched, missed }
  const [earnedPoints, setEarnedPoints] = useState(null);

  const session = useGameSession(GAME_ID);

  const timerRef = useRef(null);
  const answeredRef = useRef(false);
  const ratiosRef = useRef([]);
  const timeBankRef = useRef(0);
  const savedRef = useRef(false);
  const guessesRef = useRef([]);
  // Lets the countdown read the latest text without restarting the interval.
  const promptGuessRef = useRef('');

  const isAdmin = session.isAdmin;
  const currentRound = rounds[roundIndex];

  const buildRounds = useCallback(
    () => drawGradedSet(PROMPT_CHALLENGES, DIFFICULTY_PROFILE),
    []
  );

  useEffect(() => {
    setRounds(buildRounds());
  }, [buildRounds]);

  // Warm the next image while the player types this one.
  useEffect(() => {
    const next = rounds[roundIndex + 1];
    if (next) new Image().src = next.src;
  }, [rounds, roundIndex]);

  useEffect(() => {
    setImageReady(false);
    setImageFailed(false);
    answeredRef.current = false;
    setTimeLeft(ROUND_TIME);
    setPromptGuess('');
  }, [roundIndex]);

  const startGame = () => {
    ratiosRef.current = [];
    guessesRef.current = [];
    timeBankRef.current = 0;
    answeredRef.current = false;
    savedRef.current = false;
    setRounds(buildRounds());
    setRoundIndex(0);
    setEarnedPoints(null);
    setLastResult(null);
    setPromptGuess('');
    setGameState('playing');
  };

  const submitRound = useCallback(
    (text, secondsLeft) => {
      if (answeredRef.current || !currentRound) return;
      answeredRef.current = true;
      clearInterval(timerRef.current);

      const ratio = promptSimilarity(text, currentRound.prompt);
      ratiosRef.current.push(ratio);
      guessesRef.current.push(text.trim());
      if (ratio > 0) timeBankRef.current += Math.max(0, secondsLeft) * ratio;

      const refWords = contentWords(currentRound.prompt);
      const gotWords = new Set(contentWords(text));
      setLastResult({
        ratio,
        matched: refWords.filter((w) => gotWords.has(w)),
        missed: refWords.filter((w) => !gotWords.has(w)),
      });
      setGameState('roundResult');
    },
    [currentRound]
  );

  // Clock only runs once the image is actually visible.
  useEffect(() => {
    if (gameState !== 'playing' || !imageReady) {
      clearInterval(timerRef.current);
      return;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Score whatever is in the box rather than throwing the round away.
          submitRound(promptGuessRef.current, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameState, imageReady, roundIndex, submitRound]);

  useEffect(() => {
    promptGuessRef.current = promptGuess;
  }, [promptGuess]);

  useEffect(() => {
    if (gameState !== 'roundResult') return;
    const t = setTimeout(() => {
      if (roundIndex < rounds.length - 1) {
        setRoundIndex((i) => i + 1);
        setGameState('playing');
      } else {
        setGameState('finalResult');
      }
    }, REVEAL_MS);
    return () => clearTimeout(t);
  }, [gameState, roundIndex, rounds.length]);

  // Save once.
  useEffect(() => {
    if (gameState !== 'finalResult' || savedRef.current) return;
    savedRef.current = true;

    const ratios = ratiosRef.current;
    const avg = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
    const solvedTime = ratios.reduce((a, b) => a + b, 0);
    const speed = solvedTime > 0 ? timeBankRef.current / (solvedTime * ROUND_TIME) : 0;
    const points = arcadePointsFromRatio(avg, speed, PASS_MARKS[GAME_ID]);
    setEarnedPoints(points);

    const user = auth.currentUser;
    if (!user) return;
    (async () => {
      try {
        await setDoc(doc(db, 'promptWarsSubmissions', user.uid), {
          playerId: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email,
          guesses: guessesRef.current,
          prompts: rounds.map((r) => r.prompt),
          matchRatios: ratios.map((r) => Math.round(r * 100)),
          points,
          lobbyCode: session.lobbyCode || null,
          timestamp: serverTimestamp(),
        });
        await updateArcadeScore(user.uid, user.displayName, user.email, GAME_ID, points);
        await session.consumeAttempt();
      } catch (err) {
        console.error('Error saving Prompt Wars score:', err);
      }
    })();
  }, [gameState, rounds, session]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (gameState !== 'playing' || !promptGuess.trim()) return;
    submitRound(promptGuess, timeLeft);
  };

  if (rounds.length === 0) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center p-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Clock className="w-12 h-12 text-[#9C27B0] mb-4" />
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
          <h1 className="text-2xl md:text-3xl font-black italic tracking-wider text-[#9C27B0] uppercase">
            Prompt Wars
          </h1>
          {(gameState === 'playing' || gameState === 'roundResult') && (
            <p className="text-sm text-gray-600 font-medium">
              Round {roundIndex + 1} of {rounds.length}
            </p>
          )}
        </div>
        <div className="w-10" />
      </div>

      <div className="max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {gameState === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-lg mx-auto text-center"
            >
              <p className="text-gray-600 text-lg mb-2">
                You'll see {TOTAL_ROUNDS} AI-generated images. Type the prompt you think made each
                one — <span className="font-bold text-[#9C27B0]">{ROUND_TIME} seconds</span> per
                image.
              </p>
              <div className="bg-purple-50 border border-purple-200 text-purple-900 rounded-xl p-4 text-sm mb-8 text-left">
                You are scored on the <strong>things you name</strong>, not on exact wording. "red
                apple wooden table" scores the same as "a red apple on a wooden table". Small words
                like <em>a</em> and <em>the</em> are ignored — but padding your answer with dozens of
                unrelated nouns will lower your score.
              </div>

              {isAdmin ? (
                <button
                  onClick={startGame}
                  className="inline-flex items-center px-8 py-4 bg-[#9C27B0] hover:bg-purple-700 text-white font-bold rounded-full text-xl transition-transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  Start Game
                </button>
              ) : (
                <StallGate session={session} accent="#9C27B0" onStart={startGame} />
              )}
            </motion.div>
          )}

          {(gameState === 'playing' || gameState === 'roundResult') && currentRound && (
            <motion.div
              key={`round-${roundIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <div className="flex flex-col gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-2 shadow-lg overflow-hidden">
                  <div className="relative rounded-xl overflow-hidden aspect-square bg-gray-200 flex items-center justify-center">
                    {!imageReady && !imageFailed && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#9C27B0]" />
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
                    <img
                      key={currentRound.id}
                      src={currentRound.src}
                      alt="Guess the prompt that generated this"
                      className={`w-full h-full object-cover transition-opacity duration-200 ${
                        imageReady ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoad={() => setImageReady(true)}
                      onError={() => setImageFailed(true)}
                      draggable={false}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    Things to name: {contentWords(currentRound.prompt).length}
                  </span>
                  <span
                    className={`flex items-center gap-1.5 font-bold ${
                      timeLeft <= 10 && imageReady ? 'text-[#EA4335] animate-pulse' : 'text-gray-700'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    {imageReady ? `${timeLeft}s` : '—'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                {gameState === 'roundResult' && lastResult ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center"
                  >
                    <p className="text-gray-500 uppercase tracking-widest text-xs mb-1">Match</p>
                    <p className="text-5xl font-black text-[#9C27B0] mb-4">
                      {Math.round(lastResult.ratio * 100)}%
                    </p>

                    <p className="text-sm text-gray-500 mb-1">The actual prompt was</p>
                    <p className="text-lg font-bold text-gray-900 mb-4">"{currentRound.prompt}"</p>

                    <div className="flex flex-wrap gap-2 justify-center">
                      {lastResult.matched.map((w) => (
                        <span
                          key={w}
                          className="px-3 py-1 rounded-full bg-[#e6f4ea] text-[#188038] text-sm font-bold"
                        >
                          ✓ {w}
                        </span>
                      ))}
                      {lastResult.missed.map((w) => (
                        <span
                          key={w}
                          className="px-3 py-1 rounded-full bg-[#fce8e6] text-[#c5221f] text-sm font-bold"
                        >
                          ✗ {w}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="bg-gray-50/80 border border-gray-200 p-6 rounded-3xl shadow-lg"
                  >
                    <label
                      htmlFor="promptGuess"
                      className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider"
                    >
                      What was the prompt?
                    </label>
                    <textarea
                      id="promptGuess"
                      value={promptGuess}
                      onChange={(e) => setPromptGuess(e.target.value)}
                      disabled={!imageReady}
                      placeholder="e.g. a red apple on a wooden table"
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 min-h-[140px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#9C27B0] focus:ring-1 focus:ring-[#9C27B0] transition-all resize-none disabled:opacity-50"
                      maxLength={200}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      disabled={!imageReady || !promptGuess.trim()}
                      className="w-full mt-4 bg-[#9C27B0] hover:bg-purple-700 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg py-4"
                    >
                      Submit Guess <Send className="w-5 h-5" />
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          )}

          {gameState === 'finalResult' && (
            <motion.div
              key="final"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto bg-gray-50 border border-gray-200 rounded-3xl p-8 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10 text-[#9C27B0]" />
              </div>
              <h3 className="text-3xl font-black mb-6 text-gray-900">Game Over!</h3>

              <div className="space-y-2 mb-6">
                {rounds.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex justify-between items-center bg-white border border-gray-200 rounded-xl px-4 py-3"
                  >
                    <span className="text-sm text-gray-600 truncate mr-3">"{r.prompt}"</span>
                    <span className="font-black text-[#9C27B0] shrink-0">
                      {Math.round((ratiosRef.current[i] || 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl py-4 mb-8 border border-gray-200">
                <p className="text-gray-500 uppercase tracking-widest text-xs mb-1">Arcade Points</p>
                <p className="text-4xl font-black text-[#9C27B0]">
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
                {(isAdmin || session.attemptsLeft > 0) && (
                  <button
                    onClick={startGame}
                    className="w-full inline-flex justify-center items-center gap-2 px-6 py-4 bg-white hover:bg-gray-50 text-gray-800 rounded-xl font-bold border border-gray-200 transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                    {isAdmin ? 'Play Again' : `Attempt ${session.attemptsUsed + 1} of 2`}
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

export default PromptWars;
