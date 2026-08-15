import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Camera, Bot, CheckCircle, XCircle, Trophy, Clock, RotateCcw } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateArcadeScore } from '../utils/updateArcadeScore';
import { AI_EYE_IMAGES } from '../utils/gameData/aiEyeData';
import { arcadePoints, shuffleArray, PASS_MARKS } from '../utils/scoring';
import { useGameSession } from '../utils/useGameSession';
import StallGate from '../components/StallGate';

const GAME_ID = 'ai-eye';
const PASS_MARK_PCT = Math.round(PASS_MARKS['ai-eye'] * 100);
const PER_SIDE = 5; // 5 AI + 5 real = 10 rounds
const ROUND_TIME = 8;
const FEEDBACK_MS = 900;

const AIEye = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showFeedback, setShowFeedback] = useState(null); // 'correct' | 'wrong' | 'timeout'
  const [isGameOver, setIsGameOver] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [earnedPoints, setEarnedPoints] = useState(null);

  const session = useGameSession(GAME_ID);

  const timerRef = useRef(null);
  const answeredRef = useRef(false);
  const scoreRef = useRef(0);
  const wrongRef = useRef(0);
  const timeBankRef = useRef(0);
  const savedRef = useRef(false);

  const isAdmin = session.isAdmin;
  const currentImage = images[currentIndex];

  // A guaranteed 5/5 split, shuffled. A random sample could deal 8 AI images in
  // a row, and a player who notices that can ride the streak instead of looking.
  const buildDeck = useCallback(() => {
    const ai = shuffleArray(AI_EYE_IMAGES.filter((i) => i.isAI)).slice(0, PER_SIDE);
    const real = shuffleArray(AI_EYE_IMAGES.filter((i) => !i.isAI)).slice(0, PER_SIDE);
    return shuffleArray([...ai, ...real]);
  }, []);

  useEffect(() => {
    setImages(buildDeck());
  }, [buildDeck]);


  // Warm the next image so the round after this one starts instantly.
  useEffect(() => {
    const next = images[currentIndex + 1];
    if (next) new Image().src = next.src;
  }, [images, currentIndex]);

  // Reset load state whenever the round changes.
  useEffect(() => {
    setImageReady(false);
    setImageFailed(false);
    answeredRef.current = false;
    setTimeLeft(ROUND_TIME);
  }, [currentIndex]);

  const resolveRound = useCallback(
    (guessedAI, secondsLeft) => {
      if (answeredRef.current || !currentImage) return;
      answeredRef.current = true;
      clearInterval(timerRef.current);

      if (guessedAI === null) {
        setShowFeedback('timeout'); // no answer, no penalty
      } else if (currentImage.isAI === guessedAI) {
        scoreRef.current += 1;
        timeBankRef.current += Math.max(0, secondsLeft);
        setScore(scoreRef.current);
        setShowFeedback('correct');
      } else {
        wrongRef.current += 1;
        setShowFeedback('wrong');
      }

      setTimeout(() => {
        setShowFeedback(null);
        if (currentIndex < images.length - 1) {
          setCurrentIndex((i) => i + 1);
        } else {
          setIsGameOver(true);
        }
      }, FEEDBACK_MS);
    },
    [currentImage, currentIndex, images.length]
  );

  // The clock only runs once the player can actually SEE the image. On stall
  // wifi an unguarded timer would burn a whole round on a blank grey box.
  useEffect(() => {
    if (!isStarted || isGameOver || !imageReady || showFeedback) {
      clearInterval(timerRef.current);
      return;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          resolveRound(null, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isStarted, isGameOver, imageReady, showFeedback, currentIndex, resolveRound]);

  // Save once.
  useEffect(() => {
    if (!isGameOver || savedRef.current) return;
    savedRef.current = true;

    const correct = scoreRef.current;
    const total = images.length || PER_SIDE * 2;
    const speed = correct > 0 ? timeBankRef.current / (correct * ROUND_TIME) : 0;
    // Two options, so a coin-flipper would otherwise walk away with ~50 points.
    // A wrong answer cancels a right one; skipping costs nothing.
    const points = arcadePoints({
      correct,
      wrong: wrongRef.current,
      total,
      wrongPenalty: 1,
      speed,
      passMark: PASS_MARKS[GAME_ID],
    });
    setEarnedPoints(points);

    const user = auth.currentUser;
    if (!user) return;
    (async () => {
      try {
        await setDoc(doc(db, 'aiEyeScores', user.uid), {
          playerId: user.uid,
          displayName: user.displayName || 'Player',
          email: user.email || '',
          score: correct,
          wrong: wrongRef.current,
          total,
          points,
          lobbyCode: session.lobbyCode || null,
          timestamp: serverTimestamp(),
        });
        await updateArcadeScore(user.uid, user.displayName, user.email, GAME_ID, points);
        await session.consumeAttempt();
      } catch (error) {
        console.error('Error saving AI Eye score:', error);
      }
    })();
  }, [isGameOver, images.length, session]);

  const replay = () => {
    scoreRef.current = 0;
    wrongRef.current = 0;
    timeBankRef.current = 0;
    answeredRef.current = false;
    savedRef.current = false;
    setImages(buildDeck());
    setCurrentIndex(0);
    setScore(0);
    setEarnedPoints(null);
    setShowFeedback(null);
    setIsGameOver(false);
  };

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-white text-gray-900 p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <button
          onClick={() => navigate('/arcade')}
          className="absolute top-6 left-6 text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={24} /> Back
        </button>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center max-w-lg">
          <h2 className="text-5xl font-black mb-6">AI EYE</h2>
          <p className="text-gray-500 mb-2 text-lg">
            {PER_SIDE * 2} photos. Decide if each one is{' '}
            <span className="text-[#34A853] font-bold">Real</span> or{' '}
            <span className="text-[#9C27B0] font-bold">AI Generated</span>.{' '}
            {ROUND_TIME} seconds each.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-xl p-4 text-sm mb-8 text-left">
            <strong>Careful:</strong> only 2 choices here, so a wrong answer{' '}
            <strong>cancels out</strong> a correct one. Running out of time costs you nothing — if
            you truly can't tell, letting the clock run is better than a blind tap.
          </div>

          {!isAdmin ? (
            <StallGate session={session} accent="#34A853" onStart={() => setIsStarted(true)} />
          ) : (
            <button
              onClick={() => setIsStarted(true)}
              className="bg-[#34A853] hover:bg-green-600 text-white font-bold py-4 px-10 rounded-full text-xl shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              Start Game
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  if (isGameOver) {
    const net = Math.max(0, score - wrongRef.current);
    return (
      <div className="min-h-screen bg-white text-gray-900 p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <button
          onClick={() => navigate('/arcade')}
          className="absolute top-6 left-6 text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={24} /> Back to Arcade
        </button>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gray-50 p-8 rounded-3xl shadow-2xl border border-gray-200 text-center max-w-md w-full"
        >
          <h2 className="text-4xl font-black mb-2 tracking-tight">Game Over!</h2>
          <p className="text-gray-500 mb-6 font-medium">How good is your AI Eye?</p>

          <div className="grid grid-cols-3 gap-2 mb-6 text-center">
            <div className="bg-white rounded-xl py-3 border border-gray-200">
              <div className="text-2xl font-black text-[#34A853]">{score}</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Right</div>
            </div>
            <div className="bg-white rounded-xl py-3 border border-gray-200">
              <div className="text-2xl font-black text-[#EA4335]">{wrongRef.current}</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Wrong</div>
            </div>
            <div className="bg-white rounded-xl py-3 border border-gray-200">
              <div className="text-2xl font-black text-gray-900">{net}</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Net</div>
            </div>
          </div>

          <div className="bg-[#e6f4ea] rounded-2xl py-4 mb-8 border border-green-100">
            <p className="text-gray-500 uppercase tracking-widest text-xs mb-1">Arcade Points</p>
            <p className="text-4xl font-black text-[#34A853]">
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
                onClick={replay}
                className="w-full py-4 bg-white hover:bg-gray-50 text-gray-800 rounded-2xl font-bold text-lg border border-gray-200 transition-colors inline-flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                {isAdmin ? 'Play Again' : `Attempt ${session.attemptsUsed + 1} of 2`}
              </button>
            )}
            <button
              onClick={() => navigate('/arcade')}
              className="w-full py-4 bg-[#4285F4] hover:bg-blue-600 text-white rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-lg"
            >
              Back to Arcade
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / images.length) * 100;
  const canAnswer = imageReady && !showFeedback;

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl flex items-center justify-between mb-6 mt-2">
        <button
          onClick={() => navigate('/arcade')}
          className="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2 p-2 -ml-2 rounded-full hover:bg-gray-50"
        >
          <ArrowLeft size={24} />
          <span className="hidden sm:inline font-medium">Back</span>
        </button>

        <h1 className="text-lg md:text-2xl font-black tracking-tight text-gray-900 text-center uppercase">
          AI Eye
        </h1>

        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1.5 font-bold ${
              timeLeft <= 3 && canAnswer ? 'text-[#EA4335] animate-pulse' : 'text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            {imageReady ? timeLeft : '—'}
          </span>
          <span className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 font-black text-[#34A853]">
            {score}
          </span>
        </div>
      </div>

      <div className="w-full max-w-2xl mb-6">
        <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
          <span>Image {currentIndex + 1}</span>
          <span>{images.length} Total</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full bg-[#34A853] rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="w-full max-w-2xl relative flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 250, damping: 25 }}
            className="bg-gray-50 rounded-3xl p-4 sm:p-5 shadow-2xl border border-gray-200 relative overflow-hidden flex-1 flex flex-col"
          >
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute inset-0 z-20 flex items-center justify-center backdrop-blur-md text-white ${
                    showFeedback === 'correct'
                      ? 'bg-[#34A853]/90'
                      : showFeedback === 'wrong'
                      ? 'bg-[#EA4335]/90'
                      : 'bg-gray-700/90'
                  }`}
                >
                  <motion.div
                    initial={{ scale: 0.5, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex flex-col items-center"
                  >
                    {showFeedback === 'correct' ? (
                      <CheckCircle size={88} className="mb-4" />
                    ) : (
                      <XCircle size={88} className="mb-4" />
                    )}
                    <span className="text-4xl font-black tracking-widest uppercase">
                      {showFeedback === 'correct'
                        ? 'Correct'
                        : showFeedback === 'wrong'
                        ? 'Wrong'
                        : "Time's up"}
                    </span>
                    <span className="mt-2 text-sm font-bold uppercase tracking-wider opacity-90">
                      It was {currentImage?.isAI ? 'AI Generated' : 'Real'}
                    </span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-5 bg-gray-200 flex-shrink-0">
              {!imageReady && !imageFailed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#34A853]" />
                  <span className="text-xs font-bold uppercase tracking-wider">Loading image…</span>
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
              {currentImage && (
                <img
                  key={currentImage.id}
                  src={currentImage.src}
                  alt="Is this photo real or AI generated?"
                  className={`w-full h-full object-cover transition-opacity duration-200 ${
                    imageReady ? 'opacity-100' : 'opacity-0'
                  }`}
                  draggable={false}
                  onLoad={() => setImageReady(true)}
                  onError={() => setImageFailed(true)}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-auto">
              <button
                onClick={() => resolveRound(false, timeLeft)}
                disabled={!canAnswer}
                className="group relative flex flex-col items-center justify-center gap-2 py-5 bg-white hover:bg-green-50 rounded-2xl border-2 border-gray-200 hover:border-[#34A853] transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100"
              >
                <Camera size={32} className="text-[#34A853]" />
                <span className="font-black text-lg tracking-wider text-gray-900">REAL</span>
              </button>

              <button
                onClick={() => resolveRound(true, timeLeft)}
                disabled={!canAnswer}
                className="group relative flex flex-col items-center justify-center gap-2 py-5 bg-white hover:bg-purple-50 rounded-2xl border-2 border-gray-200 hover:border-[#9C27B0] transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100"
              >
                <Bot size={32} className="text-[#9C27B0]" />
                <span className="font-black text-lg tracking-wider text-gray-900">AI GEN</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AIEye;
