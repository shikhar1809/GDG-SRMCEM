import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Clock, Award, RotateCcw, Zap } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { updateArcadeScore } from '../utils/updateArcadeScore';

import { TECH_QUIZ_QUESTIONS as FALLBACK_QUESTIONS } from '../utils/gameData/techQuizData';

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const QUESTION_TIME = 10;
const DELAY_AFTER_ANSWER = 1500;

export default function TechQuiz() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
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
  
  const isAdmin = auth.currentUser && adminEmails.includes(auth.currentUser.email?.toLowerCase());

  const timerRef = useRef(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (isStarted && !loading && !quizFinished && !isAnswering) {
      startTimer();
    }
    return () => clearInterval(timerRef.current);
  }, [loading, currentQuestionIndex, quizFinished, isAnswering, isStarted]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'techQuizQuestions'));
      let selectedQuestions = [];
      if (querySnapshot.empty) {
        selectedQuestions = shuffleArray(FALLBACK_QUESTIONS).slice(0, 10);
      } else {
        const fetchedQuestions = querySnapshot.docs.map(doc => doc.data());
        // Basic validation
        const validQuestions = fetchedQuestions.filter(
          q => q.question && q.options?.length === 4 && typeof q.correctIndex === 'number'
        );
        selectedQuestions = validQuestions.length > 0 ? validQuestions : FALLBACK_QUESTIONS;
        selectedQuestions = shuffleArray(selectedQuestions).slice(0, 10);
      }
      setQuestions(selectedQuestions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      setQuestions(shuffleArray(FALLBACK_QUESTIONS).slice(0, 10));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists() && snap.data().adminEmails) {
        setAdminEmails(snap.data().adminEmails.map(e => e.toLowerCase()));
      }
    });
    return () => unsub();
  }, []);

  // Listen to game request status
  useEffect(() => {
    if (!auth.currentUser) return;
    const reqId = `${auth.currentUser.uid}_tech-quiz`;
    setRequestId(reqId);
    
    const unsub = onSnapshot(doc(db, 'gameRequests', reqId), (snap) => {
      if (snap.exists()) {
        const status = snap.data().status;
        setRequestStatus(status);
        if (status === 'approved' && !isStarted && !loading && !quizFinished) {
          setIsStarted(true);
        }
      } else {
        setRequestStatus('none');
        setLobbyCode(null);
      }
    });
    return () => unsub();
  }, [isStarted, loading, quizFinished]);

  const startTimer = () => {
    setTimeLeft(QUESTION_TIME);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeOut = () => {
    if (isAnswering) return;
    setIsAnswering(true);
    setSelectedAnswer('timeout');
    
    setTimeout(() => {
      moveToNextQuestion();
    }, DELAY_AFTER_ANSWER);
  };

  const handleAnswer = (index) => {
    if (isAnswering) return;
    
    clearInterval(timerRef.current);
    setIsAnswering(true);
    setSelectedAnswer(index);
    
    const isCorrect = index === questions[currentQuestionIndex].correctIndex;
    if (isCorrect) {
      setScore(s => s + 1);
    }
    
    setTimeout(() => {
      moveToNextQuestion();
    }, DELAY_AFTER_ANSWER);
  };

  const moveToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswering(false);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    setQuizFinished(true);
    const user = auth.currentUser;
    if (user) {
      try {
        const scoreData = {
          playerId: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email,
          score: score,
          total: questions.length,
          lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
                          timestamp: serverTimestamp()
        };
        const docRef = doc(collection(db, 'techQuizScores'));
        await setDoc(docRef, scoreData);
        
        // Award Arcade Score (score is max 100 since questions.length = 10 and each is 10 pts)
        await updateArcadeScore(user.uid, user.displayName, user.email, 'tech-quiz', score * 10);
        
      } catch (error) {
        console.error("Error saving score:", error);
      }
      
      // Mark request as completed
      if (requestId) {
        try {
          await setDoc(doc(db, 'gameRequests', requestId), { status: 'completed' }, { merge: true });
        } catch(e) {}
      }
    }
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizFinished(false);
    setSelectedAnswer(null);
    setIsAnswering(false);
    fetchQuestions();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Zap className="w-12 h-12 text-orange-500" />
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
          <h2 className="text-5xl font-black mb-6 text-gray-900500">
            TECH-O-FIRE
          </h2>
          <p className="text-gray-500 mb-8 text-lg">
            Test your knowledge with 10 rapid-fire tech questions. You have <span className="text-orange-400 font-bold">10 seconds</span> per question. Think fast!
          </p>
          
          {!isAdmin ? (
            <div className="bg-gray-50/80 border border-gray-200 p-8 rounded-3xl w-full text-center mx-auto shadow-2xl">
              <div className="bg-orange-500/20 text-orange-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Award size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Visit Our Stall to Play!</h3>
              <p className="text-gray-500 text-base leading-relaxed mb-6">
                To play this game and win exciting GDG swags, please visit our physical stall and request access.
              </p>
              
              {requestStatus === 'none' && (
                <button 
                  onClick={async () => {
                    if (!auth.currentUser) return;
                    const reqId = `${auth.currentUser.uid}_tech-quiz`;
                    await setDoc(doc(db, 'gameRequests', reqId), {
                      userId: auth.currentUser.uid,
                      userName: auth.currentUser.displayName || 'Player',
                      userEmail: auth.currentUser.email,
                      gameId: 'tech-quiz',
                      status: 'pending',
                      lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
                          timestamp: serverTimestamp()
                    });
                  }}
                  className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#EA4335] hover:bg-red-600 text-white font-bold rounded-xl text-lg transition-colors shadow-lg"
                >
                  Request to Play
                </button>
              )}
              
              {requestStatus === 'pending' && (
                  <div className="flex flex-col gap-3">
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-bold">Waiting for Admin Approval...</span>
                      </div>
                      <div className="text-center font-mono text-xl font-bold bg-gray-50 py-2 rounded-lg border border-gray-200">
                        Lobby Code: <span className="text-purple-600">{lobbyCode || '...'}</span>
                      </div>
                    <button 
                      onClick={async () => {
                        if (!requestId) return;
                        try {
                          await deleteDoc(doc(db, 'gameRequests', requestId));
                        } catch(e) {}
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
          ) : (
            <button
              onClick={() => setIsStarted(true)}
              className="bg-[#EA4335] hover:bg-red-600 text-white font-bold py-4 px-10 rounded-full text-xl shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
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
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <button
          onClick={() => navigate('/arcade')}
          className="p-2 hover:bg-gray-50 rounded-full transition-colors flex items-center gap-2"
        >
          <ChevronLeft className="w-6 h-6" />
          <span className="hidden sm:inline font-medium">Arcade</span>
        </button>
        <div className="flex items-center gap-2 text-orange-500 font-bold text-xl tracking-wider">
          <Zap className="w-6 h-6" />
          <span>TECH-O-FIRE</span>
        </div>
        <div className="w-10"></div> {/* Spacer for alignment */}
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
              {/* Progress & Timer */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500 font-medium">
                    Question {currentQuestionIndex + 1} / {questions.length}
                  </span>
                  <div className={`flex items-center gap-2 font-bold text-lg ${isDangerTime ? 'text-red-500 animate-pulse' : 'text-gray-900'}`}>
                    <Clock className="w-5 h-5" />
                    <span>{timeLeft}s</span>
                  </div>
                </div>
                <div className="w-full bg-gray-50 h-3 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${isDangerTime ? 'bg-red-500' : 'bg-orange-500'}`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </div>
              </div>

              {/* Question */}
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

              {/* Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option, index) => {
                  let buttonStyle = "bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100 hover:border-orange-500";
                  
                  if (isAnswering) {
                    if (index === currentQuestion.correctIndex) {
                      buttonStyle = "bg-green-600 border-green-500 text-gray-900 scale-[1.02] shadow-lg shadow-green-500/20";
                    } else if (selectedAnswer === index) {
                      buttonStyle = "bg-red-600 border-red-500 text-gray-900 scale-[0.98]";
                    } else {
                      buttonStyle = "bg-gray-50 border-gray-200 text-gray-500 opacity-50";
                    }
                  }

                  return (
                    <motion.button
                      key={index}
                      whileHover={!isAnswering ? { scale: 1.02 } : {}}
                      whileTap={!isAnswering ? { scale: 0.98 } : {}}
                      onClick={() => handleAnswer(index)}
                      disabled={isAnswering}
                      className={`relative p-6 rounded-2xl border-2 text-left text-lg font-medium transition-all duration-300 ${buttonStyle}`}
                    >
                      <span className="block mr-8">{option}</span>
                      {isAnswering && index === currentQuestion.correctIndex && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                          <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
            >
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                  className="w-32 h-32 bg-orange-500 rounded-full flex items-center justify-center shadow-[0_0_60px_-15px_#f97316]"
                >
                  <Award className="w-16 h-16 text-gray-900" />
                </motion.div>
              </div>

              <div>
                <h2 className="text-4xl font-bold mb-2">Quiz Complete!</h2>
                <p className="text-gray-500 text-lg">Here's how you did</p>
              </div>

              <div className="bg-gray-50 p-8 rounded-3xl border border-gray-200 w-full max-w-sm">
                <div className="text-6xl font-black text-orange-500 mb-2">
                  {score}<span className="text-3xl text-gray-500">/{questions.length}</span>
                </div>
                <p className="text-xl font-medium">
                  {score === questions.length ? 'Perfect Score! 🏆' :
                   score >= questions.length * 0.7 ? 'Great Job! 🌟' :
                   score >= questions.length * 0.5 ? 'Good Effort! 👍' :
                   'Keep Practicing! 💪'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={restartQuiz}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-white font-bold py-4 px-6 rounded-xl transition-colors border border-gray-200"
                >
                  <RotateCcw className="w-5 h-5" />
                  Play Again
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/arcade')}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 px-6 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
                >
                  Exit
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
