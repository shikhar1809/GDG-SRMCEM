import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Clock, Award, RotateCcw, Zap } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore';
import { updateArcadeScore } from '../utils/updateArcadeScore';
import { TECH_QUIZ_QUESTIONS } from '../utils/gameData/techQuizData';
import { arcadePoints, drawGradedSet, shuffleOptions, PASS_MARKS } from '../utils/scoring';
import { createGameRequestPayload, isApprovedForThisDevice } from '../utils/gameRequests';

const GAME_ID = 'tech-quiz';
const PASS_MARK_PCT = Math.round(PASS_MARKS['tech-quiz'] * 100);
const TOTAL_QUESTIONS = 8;
const DIFFICULTY_PROFILE = { easy: 4, medium: 3, hard: 1 };
const QUESTION_TIME = 12; // first-years need longer than 10s to read four options
const DELAY_AFTER_ANSWER = 1500;

export default function TechQuiz() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [adminEmails, setAdminEmails] = useState([]);
  const [requestStatus, setRequestStatus] = useState('none');
  const [lobbyCode, setLobbyCode] = useState(null);
  const [requestId, setRequestId] = useState('');
  const [earnedPoints, setEarnedPoints] = useState(null);

  const timerRef = useRef(null);
  const answeredRef = useRef(false); // guards timeout vs tap racing on one question
  const timeBankRef = useRef(0);
  const wrongRef = useRef(0);
  // The old bug: finishQuiz() read `score` from a stale closure, so a correct
  // answer on the LAST question never counted. Truth lives in a ref now.
  const scoreRef = useRef(0);
  const savedRef = useRef(false);

  const isAdmin = auth.currentUser && adminEmails.includes(auth.currentUser.email?.toLowerCase());

  const buildQuestions = useCallback(
    () =>
      drawGradedSet(TECH_QUIZ_QUESTIONS, DIFFICULTY_PROFILE).map((q) => {
        const { options, correctIndex } = shuffleOptions(q.options, q.correctIndex);
        return { ...q, options, correctIndex };
      }),
    []
  );

  useEffect(() => {
    setQuestions(buildQuestions());
  }, [buildQuestions]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists() && snap.data().adminEmails) {
        setAdminEmails(snap.data().adminEmails.map((e) => e.toLowerCase()));
      }
    });
    return () => unsub();
  }, []);

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
      if (isApprovedForThisDevice(data, GAME_ID)) setIsStarted((s) => s || true);
    });
    return () => unsub();
  }, []);

  const finishQuiz = useCallback(async () => {
    setQuizFinished(true);
    if (savedRef.current) return;
    savedRef.current = true;

    const correct = scoreRef.current;
    const total = questions.length || TOTAL_QUESTIONS;
    const speed = correct > 0 ? timeBankRef.current / (correct * QUESTION_TIME) : 0;
    // Four options: guessing is already weak, so no negative marking here.
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
    try {
      await setDoc(doc(db, 'techQuizScores', user.uid), {
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
    } catch (error) {
      console.error('Error saving Tech Quiz score:', error);
    }
  }, [questions.length, requestId, lobbyCode]);

  const moveToNextQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => {
      if (prev < questions.length - 1) {
        setSelectedAnswer(null);
        setIsAnswering(false);
        answeredRef.current = false;
        return prev + 1;
      }
      finishQuiz();
      return prev;
    });
  }, [questions.length, finishQuiz]);

  const resolveAnswer = useCallback(
    (index, secondsLeft) => {
      if (answeredRef.current) return;
      answeredRef.current = true;
      clearInterval(timerRef.current);

      setIsAnswering(true);
      setSelectedAnswer(index);

      if (index !== null && index === questions[currentQuestionIndex]?.correctIndex) {
        scoreRef.current += 1;
        timeBankRef.current += Math.max(0, secondsLeft);
        setScore(scoreRef.current);
      } else if (index !== null) {
        wrongRef.current += 1;
      }

      setTimeout(moveToNextQuestion, DELAY_AFTER_ANSWER);
    },
    [questions, currentQuestionIndex, moveToNextQuestion]
  );

  // One timer per question.
  useEffect(() => {
    if (!isStarted || quizFinished || questions.length === 0 || isAnswering) return;
    setTimeLeft(QUESTION_TIME);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          resolveAnswer(null, 0); // timeout: no answer, no penalty
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isStarted, quizFinished, questions.length, currentQuestionIndex, isAnswering, resolveAnswer]);

  const restartQuiz = () => {
    scoreRef.current = 0;
    wrongRef.current = 0;
    timeBankRef.current = 0;
    answeredRef.current = false;
    savedRef.current = false;
    setQuestions(buildQuestions());
    setCurrentQuestionIndex(0);
    setScore(0);
    setEarnedPoints(null);
    setQuizFinished(false);
    setSelectedAnswer(null);
    setIsAnswering(false);
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Zap className="w-12 h-12 text-[#EA4335]" />
        </motion.div>
      </div>
    );
  }

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-white text-gray-900 p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <button
          onClick={() => navigate('/arcade')}
          className="absolute top-6 left-6 text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2"
        >
          <ChevronLeft size={24} /> Back
        </button>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center max-w-lg">
          <h2 className="text-5xl font-black mb-6 text-gray-900">TECH-O-FIRE</h2>
          <p className="text-gray-500 mb-2 text-lg">
            {TOTAL_QUESTIONS} rapid-fire tech questions,{' '}
            <span className="text-[#EA4335] font-bold">{QUESTION_TIME} seconds</span> each.
          </p>
          <p className="text-gray-400 mb-8 text-sm">
            No negative marking — answer everything. Faster correct answers score more.
          </p>

          {!isAdmin ? (
            <div className="bg-gray-50/80 border border-gray-200 p-8 rounded-3xl w-full text-center mx-auto shadow-2xl">
              <div className="bg-[#fce8e6] text-[#EA4335] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Award size={32} />
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
                  className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#EA4335] hover:bg-red-600 text-white font-bold rounded-xl text-lg transition-colors shadow-lg"
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
                    Lobby Code: <span className="text-[#EA4335]">{lobbyCode || '...'}</span>
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
              {requestStatus === 'device-mismatch' && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
                  This Gmail was approved on another device. Use the device that showed this lobby code, or ask a volunteer to reject and request again.
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsStarted(true)}
              className="bg-[#EA4335] hover:bg-red-600 text-white font-bold py-4 px-10 rounded-full text-xl shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
            >
              <Zap className="fill-current w-6 h-6" />
              Start Quiz
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercentage = (timeLeft / QUESTION_TIME) * 100;
  const isDangerTime = timeLeft <= 3;

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans">
      <header className="p-4 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <button
          onClick={() => navigate('/arcade')}
          className="p-2 hover:bg-gray-50 rounded-full transition-colors flex items-center gap-2"
        >
          <ChevronLeft className="w-6 h-6" />
          <span className="hidden sm:inline font-medium">Arcade</span>
        </button>
        <div className="flex items-center gap-2 text-[#EA4335] font-bold text-xl tracking-wider">
          <Zap className="w-6 h-6" />
          <span>TECH-O-FIRE</span>
        </div>
        <div className="text-sm font-bold text-gray-500">
          {score}/{questions.length}
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {!quizFinished ? (
            <motion.div
              key="question-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500 font-medium">
                    Question {currentQuestionIndex + 1} / {questions.length}
                  </span>
                  <div
                    className={`flex items-center gap-2 font-bold text-lg ${
                      isDangerTime ? 'text-[#EA4335] animate-pulse' : 'text-gray-900'
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                    <span>{timeLeft}s</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${isDangerTime ? 'bg-[#EA4335]' : 'bg-[#FBBC04]'}`}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, ease: 'linear' }}
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center mb-8">
                <motion.h2
                  key={currentQuestionIndex}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-center"
                >
                  {currentQuestion.question}
                </motion.h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option, index) => {
                  let buttonStyle =
                    'bg-white border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-[#EA4335]';

                  if (isAnswering) {
                    if (index === currentQuestion.correctIndex) {
                      buttonStyle = 'bg-[#34A853] border-[#34A853] text-white shadow-lg';
                    } else if (selectedAnswer === index) {
                      buttonStyle = 'bg-[#EA4335] border-[#EA4335] text-white';
                    } else {
                      buttonStyle = 'bg-gray-50 border-gray-200 text-gray-500';
                    }
                  }

                  return (
                    <motion.button
                      key={index}
                      whileHover={!isAnswering ? { scale: 1.02 } : {}}
                      whileTap={!isAnswering ? { scale: 0.98 } : {}}
                      onClick={() => resolveAnswer(index, timeLeft)}
                      disabled={isAnswering}
                      className={`relative p-5 sm:p-6 rounded-2xl border-2 text-left text-base sm:text-lg font-medium transition-colors duration-300 ${buttonStyle}`}
                    >
                      <span className="block mr-8">{option}</span>
                      {isAnswering && index === currentQuestion.correctIndex && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 text-[#34A853]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                      )}
                      {isAnswering && selectedAnswer === index && index !== currentQuestion.correctIndex && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 text-[#EA4335]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result-screen"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
                className="w-28 h-28 bg-[#FBBC04] rounded-full flex items-center justify-center shadow-lg"
              >
                <Award className="w-14 h-14 text-white" />
              </motion.div>

              <div>
                <h2 className="text-4xl font-bold mb-2">Quiz Complete!</h2>
                <p className="text-gray-500 text-lg">Here's how you did</p>
              </div>

              <div className="bg-gray-50 p-8 rounded-3xl border border-gray-200 w-full max-w-sm">
                <div className="text-6xl font-black text-[#EA4335] mb-2">
                  {score}
                  <span className="text-3xl text-gray-400">/{questions.length}</span>
                </div>
                <p className="text-xl font-medium mb-4">
                  {score === questions.length
                    ? 'Perfect Score! 🏆'
                    : score >= questions.length * 0.7
                    ? 'Great Job! 🌟'
                    : score >= questions.length * 0.5
                    ? 'Good Effort! 👍'
                    : 'Keep Practicing! 💪'}
                </p>
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-gray-500 uppercase tracking-widest text-xs mb-1">Arcade Points</p>
                  <p className="text-3xl font-black text-[#4285F4]">
                    {earnedPoints === null ? '—' : earnedPoints}
                    <span className="text-base text-gray-400"> / 100</span>
                  </p>
                {earnedPoints === 0 && (
                  <p className="text-xs text-gray-500 mt-2 px-2">
                    You need {PASS_MARK_PCT}% to score. Nothing added this time — try again!
                  </p>
                )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                {isAdmin && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={restartQuiz}
                    className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-800 font-bold py-4 px-6 rounded-xl transition-colors border border-gray-200"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Play Again
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/arcade')}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#4285F4] hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-colors shadow-lg"
                >
                  Back to Arcade
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
