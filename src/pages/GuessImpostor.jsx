import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Play, AlertTriangle } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { updateArcadeScore } from '../utils/updateArcadeScore';

import { GUESS_IMPOSTOR_QUESTIONS as FALLBACK_QUESTIONS } from '../utils/gameData/guessImpostorData';

const GuessImpostor = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('intro'); // intro, playing, roundResult, finalResult
  const [selectedOption, setSelectedOption] = useState(null);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [requestStatus, setRequestStatus] = useState('none');
  const [lobbyCode, setLobbyCode] = useState(null);
  const [requestId, setRequestId] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Randomize 5 questions from fallback
    const shuffled = [...FALLBACK_QUESTIONS].sort(() => 0.5 - Math.random());
    setQuestions(shuffled.slice(0, 5));
    
    // Check if user is admin
    const unsubAdmin = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists() && snap.data().adminEmails && auth.currentUser) {
        setIsAdmin(snap.data().adminEmails.includes(auth.currentUser.email?.toLowerCase()));
      }
    });

    const checkAuth = auth.onAuthStateChanged((user) => {
      setAuthChecked(true);
      if (user) {
        const reqId = `${user.uid}_guess-impostor`;
        setRequestId(reqId);
        const unsubReq = onSnapshot(doc(db, 'gameRequests', reqId), (snap) => {
          if (snap.exists()) {
            setRequestStatus(snap.data().status);
            setLobbyCode(snap.data().lobbyCode);
          } else {
            setRequestStatus('none');
            setLobbyCode(null);
          }
        });
        return () => unsubReq();
      }
    });

    return () => {
      unsubAdmin();
      checkAuth();
    };
  }, []);

  const startGame = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setGameState('playing');
  };

  const handleOptionClick = async (index) => {
    if (gameState !== 'playing') return;
    
    setSelectedOption(index);
    const isCorrect = index === questions[currentQuestionIndex].impostorIndex;
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setGameState('roundResult');

    setTimeout(async () => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOption(null);
        setGameState('playing');
      } else {
        setGameState('finalResult');
        await finishGame(isCorrect ? score + 1 : score);
      }
    }, 2500);
  };

  const finishGame = async (finalScore) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const submissionRef = doc(db, 'guessImpostorSubmissions', user.uid);
        await setDoc(submissionRef, {
          playerId: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email,
          score: finalScore,
          total: questions.length,
          lobbyCode: lobbyCode || Math.floor(100 + Math.random() * 900).toString(),
          timestamp: serverTimestamp()
        });
        
        // Award Arcade Score
        const earnedPts = Math.round((finalScore / questions.length) * 100);
        await updateArcadeScore(user.uid, user.displayName, user.email, 'guess-impostor', earnedPts);
        
      } catch (err) {
        console.error("Failed to save score:", err);
      }
      
      // Mark request as completed
      if (requestId) {
        try {
          await setDoc(doc(db, 'gameRequests', requestId), { status: 'completed' }, { merge: true });
        } catch(e) {}
      }
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      
      {/* Header */}
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
          
          {/* Intro State */}
          {gameState === 'intro' && (
            <motion.div 
              key="intro"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="text-center max-w-2xl"
            >
              <h1 className="text-5xl md:text-7xl font-black mb-6 text-[#4285F4]">
                GUESS THE IMPOSTOR
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Find the one tech product or company that <span className="text-[#EA4335] font-bold">doesn't belong</span> with the others.
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
                    To play this game and win exciting GDG swags, please visit our physical stall and request access.
                  </p>
                  
                  {requestStatus === 'none' && (
                    <button 
                      onClick={async () => {
                        if (!auth.currentUser) return;
                        const reqId = `${auth.currentUser.uid}_guess-impostor`;
                        await setDoc(doc(db, 'gameRequests', reqId), {
                          userId: auth.currentUser.uid,
                          userName: auth.currentUser.displayName || 'Player',
                          userEmail: auth.currentUser.email,
                          gameId: 'guess-impostor',
                          status: 'pending',
                          lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
                          timestamp: serverTimestamp()
                        });
                      }}
                      className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#EA4335] hover:bg-red-600 text-white font-bold rounded-xl text-lg transition-colors shadow-lg mb-4"
                    >
                      Request to Play
                    </button>
                  )}

                  {requestStatus === 'pending' && (
                    <div className="flex flex-col gap-3 mb-4">
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
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

                  {(requestStatus === 'pending' || requestStatus === 'approved') && (
                    <button 
                      onClick={async () => {
                        if (!requestId) return;
                        try {
                          await deleteDoc(doc(db, 'gameRequests', requestId));
                        } catch(e) {}
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

          {/* Playing & Round Result State */}
          {(gameState === 'playing' || gameState === 'roundResult') && currentQ && (
            <motion.div 
              key="playing"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="w-full max-w-3xl"
            >
              <div className="mb-8 flex justify-between items-center bg-gray-50 border border-gray-200 p-4 rounded-2xl shadow-sm">
                <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="text-sm font-bold text-[#4285F4] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  Score: {score}
                </span>
              </div>
              
              <h2 className="text-2xl md:text-4xl font-bold mb-8 text-center text-gray-900 leading-tight">
                Category: <span className="text-[#EA4335]">{currentQ.category}</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {currentQ.items.map((item, idx) => {
                  let btnState = 'normal';
                  if (gameState === 'roundResult') {
                    if (idx === currentQ.impostorIndex) btnState = 'correct';
                    else if (idx === selectedOption) btnState = 'wrong';
                    else btnState = 'dimmed';
                  }

                  const getBtnStyle = () => {
                    if (btnState === 'correct') return 'bg-[#34A853] border-transparent text-white shadow-lg shadow-green-500/30 scale-105';
                    if (btnState === 'wrong') return 'bg-[#EA4335] border-transparent text-white shadow-lg shadow-red-500/30';
                    if (btnState === 'dimmed') return 'bg-gray-50 border-gray-200 text-gray-400 opacity-50';
                    return 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 hover:shadow-md';
                  };

                  return (
                    <motion.button
                      key={idx}
                      whileHover={gameState === 'playing' ? { scale: 1.02 } : {}}
                      whileTap={gameState === 'playing' ? { scale: 0.98 } : {}}
                      onClick={() => handleOptionClick(idx)}
                      disabled={gameState !== 'playing'}
                      className={`p-6 rounded-2xl text-xl md:text-2xl font-bold transition-all duration-300 border-2 ${getBtnStyle()}`}
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
                  className="mt-8 p-6 bg-blue-50 border border-blue-100 rounded-2xl text-center shadow-inner"
                >
                  <p className="text-lg text-blue-900 font-medium">
                    {selectedOption === currentQ.impostorIndex 
                      ? "🎉 Spot on! That's the impostor." 
                      : "Oops! Not quite."}
                  </p>
                  <p className="text-sm text-blue-700 mt-2 italic">
                    {currentQ.reason}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Final Result State */}
          {gameState === 'finalResult' && (
            <motion.div 
              key="final"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center bg-gray-50 border border-gray-200 p-8 md:p-12 rounded-3xl max-w-lg shadow-2xl"
            >
              <div className="bg-[#FBBC04]/20 text-[#FBBC04] w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl font-black">{score}</span>
              </div>
              <h2 className="text-3xl font-black mb-2 text-gray-900">Game Over!</h2>
              <p className="text-gray-600 mb-8 text-lg">
                You got {score} out of {questions.length} correct.
              </p>
              
              <button 
                onClick={() => navigate('/arcade')}
                className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#4285F4] hover:bg-blue-600 text-white font-bold rounded-xl text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
              >
                Back to Arcade
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
};

export default GuessImpostor;
