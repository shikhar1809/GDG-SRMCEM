import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Play, AlertTriangle, Clock, RotateCcw } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore';
import { updateArcadeScore } from '../utils/updateArcadeScore';
import { GUESS_IMPOSTOR_QUESTIONS } from '../utils/gameData/guessImpostorData';
import { arcadePoints, drawGradedSet, shuffleOptions, PASS_MARKS } from '../utils/scoring';
import { createGameRequestPayload, isApprovedForThisDevice } from '../utils/gameRequests';

const GAME_ID = 'guess-impostor';
const PASS_MARK_PCT = Math.round(PASS_MARKS['guess-impostor'] * 100);
const TOTAL_QUESTIONS = 6;
const DIFFICULTY_PROFILE = { easy: 2, medium: 3, hard: 1 };
const QUESTION_TIME = 15;
const REVEAL_MS = 2500;

const GuessImpostor = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('intro'); // intro|playing|roundResult|finalResult
  const [selectedOption, setSelectedOption] = useState(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [earnedPoints, setEarnedPoints] = useState(null);

  const [adminEmails, setAdminEmails] = useState([]);
  const [requestStatus, setRequestStatus] = useState('none');
  const [lobbyCode, setLobbyCode] = useState(null);
  const [requestId, setRequestId] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  const timerRef = useRef(null);
  const answeredRef = useRef(false);
  const scoreRef = useRef(0);
  const wrongRef = useRef(0);
  const timeBankRef = useRef(0);
  const savedRef = useRef(false);

  const isAdmin = auth.currentUser && adminEmails.includes(auth.currentUser.email?.toLowerCase());
  const currentQ = questions[currentQuestionIndex];

  const buildQuestions = useCallback(
    () =>
      // Shuffling here is the whole fix: the bank shipped with the impostor
      // sitting at the same index in every single question.
      drawGradedSet(GUESS_IMPOSTOR_QUESTIONS, DIFFICULTY_PROFILE).map((q) => {
        const { options, correctIndex } = shuffleOptions(q.items, q.impostorIndex);
        return { ...q, items: options, impostorIndex: correctIndex };
      }),
    []
  );

  useEffect(() => {
    setQuestions(buildQuestions());

    const unsubAdmin = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists() && snap.data().adminEmails) {
        setAdminEmails(snap.data().adminEmails.map((e) => e.toLowerCase()));
      }
    });

    let unsubReq = () => {};
    const unsubAuth = auth.onAuthStateChanged((user) => {
      setAuthChecked(true);
      unsubReq();
      if (!user) return;
      const reqId = `${user.uid}_${GAME_ID}`;
      setRequestId(reqId);
      unsubReq = onSnapshot(doc(db, 'gameRequests', reqId), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setLobbyCode(data.lobbyCode || null);
          if (data.status === 'approved' && !isApprovedForThisDevice(data, GAME_ID)) {
            setRequestStatus('device-mismatch');
            return;
          }
          setRequestStatus(data.status);
        } else {
          setRequestStatus('none');
          setLobbyCode(null);
        }
      });
    });

    return () => {
      unsubAdmin();
      unsubReq();
      unsubAuth();
    };
  }, [buildQuestions]);

  const startGame = () => {
    scoreRef.current = 0;
    wrongRef.current = 0;
    timeBankRef.current = 0;
    answeredRef.current = false;
    savedRef.current = false;
    setQuestions(buildQuestions());
    setCurrentQuestionIndex(0);
    setScore(0);
    setEarnedPoints(null);
    setSelectedOption(null);
    setTimeLeft(QUESTION_TIME);
    setGameState('playing');
  };

  const resolveRound = useCallback(
    (index, secondsLeft) => {
      if (answeredRef.current) return;
      answeredRef.current = true;
      clearInterval(timerRef.current);

      setSelectedOption(index);
      if (index !== null && index === questions[currentQuestionIndex]?.impostorIndex) {
        scoreRef.current += 1;
        timeBankRef.current += Math.max(0, secondsLeft);
        setScore(scoreRef.current);
      } else if (index !== null) {
        wrongRef.current += 1;
      }
      setGameState('roundResult');
    },
    [questions, currentQuestionIndex]
  );

  // Per-question countdown.
  useEffect(() => {
    if (gameState !== 'playing') {
      clearInterval(timerRef.current);
      return;
    }
    setTimeLeft(QUESTION_TIME);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          resolveRound(null, 0); // ran out of time: no answer, no penalty
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameState, currentQuestionIndex, resolveRound]);

  // Leave the reveal screen.
  useEffect(() => {
    if (gameState !== 'roundResult') return;
    const t = setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((i) => i + 1);
        setSelectedOption(null);
        answeredRef.current = false;
        setGameState('playing');
      } else {
        setGameState('finalResult');
      }
    }, REVEAL_MS);
    return () => clearTimeout(t);
  }, [gameState, currentQuestionIndex, questions.length]);

  // Save once.
  useEffect(() => {
    if (gameState !== 'finalResult' || savedRef.current) return;
    savedRef.current = true;

    const correct = scoreRef.current;
    const total = questions.length || TOTAL_QUESTIONS;
    const speed = correct > 0 ? timeBankRef.current / (correct * QUESTION_TIME) : 0;
    // Four options: guessing is weak enough that plain accuracy is fair.
    const points = arcadePoints({
      correct,
      wrong: wrongRef.current,
      total,
      wrongPenalty: 0,
      speed,
      passMark: PASS_MARKS[GAME_ID],
    });
    setEarnedPoints(points);

    const user = auth.currentUser;
    if (!user) return;
    (async () => {
      try {
        await setDoc(doc(db, 'guessImpostorScores', user.uid), {
          playerId: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email,
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
        console.error('Failed to save Impostor score:', err);
      }
    })();
  }, [gameState, questions.length, requestId, lobbyCode, isAdmin]);

  if (!authChecked || questions.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4285F4]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">
      <header className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-center z-50">
        <button
          onClick={() => navigate('/arcade')}
          className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-full transition-colors flex items-center border border-gray-200 shadow-sm"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </header>

      <main className="min-h-screen flex flex-col items-center justify-center p-4 pt-20">
        <AnimatePresence mode="wait">
          {gameState === 'intro' && (
            <motion.div
              key="intro"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="text-center max-w-2xl"
            >
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-black mb-6 text-[#4285F4]">
                GUESS THE IMPOSTOR
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-2 leading-relaxed">
                Find the one item that <span className="text-[#EA4335] font-bold">doesn't belong</span>{' '}
                with the others.
              </p>
              <p className="text-sm text-gray-500 mb-8">
                {TOTAL_QUESTIONS} rounds, {QUESTION_TIME} seconds each. No negative marking — always
                pick something.
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
                  <div className="bg-red-500/20 text-[#EA4335] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8" />
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
                        await setDoc(
                          doc(db, 'gameRequests', `${auth.currentUser.uid}_${GAME_ID}`),
                          createGameRequestPayload(auth.currentUser, GAME_ID, serverTimestamp),
                          { merge: true }
                        );
                      }}
                      className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#EA4335] hover:bg-red-600 text-white font-bold rounded-xl text-lg transition-colors shadow-lg mb-4"
                    >
                      Request to Play
                    </button>
                  )}

                  {requestStatus === 'pending' && (
                    <div className="flex flex-col gap-3 mb-4">
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                        <span className="font-bold">Waiting for Admin Approval...</span>
                      </div>
                      <div className="text-center font-mono text-xl font-bold bg-gray-50 py-2 rounded-lg border border-gray-200">
                        Lobby Code: <span className="text-[#EA4335]">{lobbyCode || '...'}</span>
                      </div>
                    </div>
                  )}

                  {requestStatus === 'approved' && (
                    <button
                      onClick={startGame}
                      className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#34A853] hover:bg-green-600 text-white font-bold rounded-xl text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-green-500/30"
                    >
                      <Play className="w-6 h-6 mr-3 fill-current" />
                      Start Game
                    </button>
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

                  {(requestStatus === 'pending' || requestStatus === 'approved') && (
                    <button
                      onClick={async () => {
                        if (!requestId) return;
                        try {
                          await deleteDoc(doc(db, 'gameRequests', requestId));
                        } catch (e) {
                          console.error('Failed to cancel request', e);
                        }
                      }}
                      className="w-full mt-4 inline-flex justify-center items-center px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {(gameState === 'playing' || gameState === 'roundResult') && currentQ && (
            <motion.div
              key="playing"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="w-full max-w-3xl"
            >
              <div className="mb-6 flex justify-between items-center bg-gray-50 border border-gray-200 p-4 rounded-2xl shadow-sm gap-3">
                <span className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider">
                  Round {currentQuestionIndex + 1} of {questions.length}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className={`flex items-center gap-1.5 text-sm font-bold ${
                      timeLeft <= 5 && gameState === 'playing'
                        ? 'text-[#EA4335] animate-pulse'
                        : 'text-gray-700'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    {timeLeft}s
                  </span>
                  <span className="text-sm font-bold text-[#4285F4] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                    {score}
                  </span>
                </div>
              </div>

              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-8">
                <motion.div
                  className={`h-full ${timeLeft <= 5 ? 'bg-[#EA4335]' : 'bg-[#FBBC04]'}`}
                  animate={{ width: `${(timeLeft / QUESTION_TIME) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>

              <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-8 text-center text-gray-900 leading-tight">
                Category: <span className="text-[#EA4335]">{currentQ.category}</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {currentQ.items.map((item, idx) => {
                  let style =
                    'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 hover:shadow-md';
                  if (gameState === 'roundResult') {
                    if (idx === currentQ.impostorIndex) {
                      style = 'bg-[#34A853] border-transparent text-white shadow-lg scale-105';
                    } else if (idx === selectedOption) {
                      style = 'bg-[#EA4335] border-transparent text-white shadow-lg';
                    } else {
                      style = 'bg-gray-50 border-gray-200 text-gray-500';
                    }
                  }

                  return (
                    <motion.button
                      key={item}
                      whileHover={gameState === 'playing' ? { scale: 1.02 } : {}}
                      whileTap={gameState === 'playing' ? { scale: 0.98 } : {}}
                      onClick={() => resolveRound(idx, timeLeft)}
                      disabled={gameState !== 'playing'}
                      className={`p-5 sm:p-6 rounded-2xl text-lg sm:text-2xl font-bold transition-colors duration-300 border-2 ${style}`}
                    >
                      {item}
                    </motion.button>
                  );
                })}
              </div>

              {gameState === 'roundResult' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 p-6 bg-blue-50 border border-blue-100 rounded-2xl text-center"
                >
                  <p className="text-lg text-blue-900 font-medium">
                    {selectedOption === null
                      ? "⏱ Time's up!"
                      : selectedOption === currentQ.impostorIndex
                      ? "🎉 Spot on! That's the impostor."
                      : 'Oops! Not quite.'}
                  </p>
                  <p className="text-sm text-blue-700 mt-2 italic">{currentQ.reason}</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {gameState === 'finalResult' && (
            <motion.div
              key="final"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center bg-gray-50 border border-gray-200 p-8 md:p-12 rounded-3xl max-w-lg w-full shadow-2xl"
            >
              <div className="bg-[#FBBC04]/20 text-[#FBBC04] w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl font-black">{score}</span>
              </div>
              <h2 className="text-3xl font-black mb-2 text-gray-900">Game Over!</h2>
              <p className="text-gray-600 mb-6 text-lg">
                You found {score} of {questions.length} impostors.
              </p>

              <div className="bg-white rounded-2xl py-4 mb-8 border border-gray-200">
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

              <div className="flex flex-col gap-3">
                {isAdmin && (
                  <button
                    onClick={startGame}
                    className="w-full inline-flex justify-center items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-gray-800 font-bold rounded-xl text-lg border border-gray-200 transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Play Again
                  </button>
                )}
                <button
                  onClick={() => navigate('/arcade')}
                  className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#4285F4] hover:bg-blue-600 text-white font-bold rounded-xl text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg"
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
};

export default GuessImpostor;
