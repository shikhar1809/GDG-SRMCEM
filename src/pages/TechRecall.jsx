import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, CheckCircle2, XCircle, RotateCcw, Play } from 'lucide-react';
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { updateArcadeScore } from '../utils/updateArcadeScore';

import { TECH_RECALL_WORDS } from '../utils/gameData/techRecallData';
const FALLBACK_WORDS = TECH_RECALL_WORDS.map(w => w.word);

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const TOTAL_ROUNDS = 10;
const FLASH_DURATION = 5000; // 2 seconds flash
const PLAY_DURATION = 60; // 30 seconds to type

export default function TechRecall() {
  const navigate = useNavigate();
  
  // Game state
  const [gameState, setGameState] = useState('loading'); // loading, intro, flashing, playing, revealing, results
  const [words, setWords] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [score, setScore] = useState(0);
  const [adminEmails, setAdminEmails] = useState([]);
  const [requestStatus, setRequestStatus] = useState('none');
  const [lobbyCode, setLobbyCode] = useState(null); // none, pending, approved
  const [requestId, setRequestId] = useState('');
  
  const isAdmin = auth.currentUser && adminEmails.includes(auth.currentUser.email?.toLowerCase());

  // Round state
  const [timeLeft, setTimeLeft] = useState(PLAY_DURATION);
  const [inputValue, setInputValue] = useState('');
  const [isCorrect, setIsCorrect] = useState(null);
  const [savingScore, setSavingScore] = useState(false);

  const timerRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize Game Data
  useEffect(() => {
    const initGame = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'techSharaj'));
        let fetchedWords = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.word) fetchedWords.push(data.word.toUpperCase().trim());
        });

        if (fetchedWords.length < TOTAL_ROUNDS) {
          fetchedWords = [...fetchedWords, ...FALLBACK_WORDS];
        }

        const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
          if (snap.exists() && snap.data().adminEmails) {
            setAdminEmails(snap.data().adminEmails.map(e => e.toLowerCase()));
          }
        });

        // Shuffle and pick TOTAL_ROUNDS words
        const shuffled = shuffleArray(fetchedWords).slice(0, TOTAL_ROUNDS);
          
        setWords(shuffled);
        setGameState('intro');
      } catch (error) {
        console.error("Error fetching words:", error);
        // Fallback on error
        const shuffled = shuffleArray(FALLBACK_WORDS).slice(0, TOTAL_ROUNDS);
        setWords(shuffled);
        setGameState('intro');
      }
    };

    initGame();
  }, []);

  // Listen to game request status
  useEffect(() => {
    if (!auth.currentUser) return;
    const reqId = `${auth.currentUser.uid}_tech-recall`;
    setRequestId(reqId);
    
    const unsub = onSnapshot(doc(db, 'gameRequests', reqId), (snap) => {
      if (snap.exists()) {
        const status = snap.data().status;
        setRequestStatus(status);
        if (status === 'approved' && gameState === 'intro') {
          startGame();
        }
      } else {
        setRequestStatus('none');
        setLobbyCode(null);
      }
    });
    return () => unsub();
  }, [gameState]);

  // Flashing Effect
  useEffect(() => {
    if (gameState === 'flashing') {
      const timer = setTimeout(() => {
        setGameState('playing');
      }, FLASH_DURATION);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  // Timer Interval
  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      // Auto-focus input when playing starts
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState]);

  // Timeout handler
  useEffect(() => {
    if (gameState === 'playing' && timeLeft <= 0) {
      handleRoundEnd(false);
    }
  }, [timeLeft, gameState]);

  const startGame = () => {
    setScore(0);
    setCurrentRound(0);
    setInputValue('');
    setIsCorrect(null);
    setTimeLeft(PLAY_DURATION);
    setGameState('flashing');
  };

  const handleRoundEnd = (correct) => {
    if (gameState !== 'playing') return; // Prevent double trigger
    
    setIsCorrect(correct);
    const newScore = correct ? score + 1 : score;
    if (correct) setScore(newScore);
    
    setGameState('revealing');

    setTimeout(() => {
      if (currentRound < TOTAL_ROUNDS - 1) {
        setCurrentRound(currentRound + 1);
        setInputValue('');
        setIsCorrect(null);
        setTimeLeft(PLAY_DURATION);
        setGameState('flashing');
      } else {
        endGame(newScore);
      }
    }, 2000); // Show reveal for 2 seconds
  };

  const endGame = async (finalScore) => {
    setGameState('results');
    if (auth.currentUser) {
      setSavingScore(true);
      try {
        const user = auth.currentUser;
        await setDoc(doc(db, 'techRecallScores', auth.currentUser.uid), {
          playerId: user.uid,
          displayName: user.displayName || 'Player',
          email: user.email,
          score: finalScore,
          totalRounds: TOTAL_ROUNDS,
          lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
                          timestamp: serverTimestamp()
        });
        
        // Award Arcade Score
        const earnedPts = Math.round((finalScore / TOTAL_ROUNDS) * 100);
        await updateArcadeScore(user.uid, user.displayName, user.email, 'tech-recall', earnedPts);
          
      } catch (error) {
        console.error("Error saving score:", error);
      } finally {
        setSavingScore(false);
      }
      
      // Mark request as completed
      if (requestId) {
        try {
          await setDoc(doc(db, 'gameRequests', requestId), { status: 'completed' }, { merge: true });
        } catch(e) {}
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || gameState !== 'playing') return;
    
    const currentWord = words[currentRound];
    if (inputValue.trim().toLowerCase() === currentWord.toLowerCase()) {
      handleRoundEnd(true);
    } else {
      handleRoundEnd(false);
    }
  };

  // SVG Circular Progress Calculation
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - timeLeft / PLAY_DURATION);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-gray-100 z-10">
        <button 
          onClick={() => navigate('/arcade')} 
          className="flex items-center text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 mr-2" />
          Back to Arcade
        </button>
        {gameState !== 'loading' && gameState !== 'intro' && gameState !== 'results' && (
          <div className="text-xl font-bold bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
            <span className="text-gray-500">Round {currentRound + 1}/</span>{TOTAL_ROUNDS} 
            <span className="mx-3 text-gray-600">|</span> 
            <span className="text-gray-500">Score: </span><span className="text-[#FBBC04]">{score}</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 relative">
        <AnimatePresence mode="wait">
          
          {/* Loading State */}
          {gameState === 'loading' && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-2xl text-gray-500 animate-pulse"
            >
              Loading game data...
            </motion.div>
          )}

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
                TECH-RECALL
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                A word is flashed for <span className="text-[#4285F4] font-bold">2 seconds</span>. 
                Memorize it, and type it correctly before the <span className="text-[#EA4335] font-bold">30 second</span> timer runs out.
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
                    To play this game and win exciting GDG swags, please visit our physical stall and request access.
                  </p>
                  
                  {requestStatus === 'none' && (
                    <button 
                      onClick={async () => {
                        if (!auth.currentUser) return;
                        const reqId = `${auth.currentUser.uid}_tech-recall`;
                        await setDoc(doc(db, 'gameRequests', reqId), {
                          userId: auth.currentUser.uid,
                          userName: auth.currentUser.displayName || 'Player',
                          userEmail: auth.currentUser.email,
                          gameId: 'tech-recall',
                          status: 'pending',
                          lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
                          timestamp: serverTimestamp()
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
              )}
            </motion.div>
          )}

          {/* Flashing State */}
          {gameState === 'flashing' && (
            <motion.div 
              key="flashing"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <p className="text-gray-500 text-xl mb-4 tracking-widest uppercase">Memorize the word</p>
              <h2 className="text-5xl md:text-8xl font-black text-[#4285F4] drop-shadow-[0_0_40px_rgba(66,133,244,0.6)] tracking-wider break-all px-4">
                {words[currentRound]}
              </h2>
            </motion.div>
          )}

          {/* Playing State */}
          {gameState === 'playing' && (
            <motion.div 
              key="playing"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="w-full max-w-md flex flex-col items-center"
            >
              {/* Circular Timer */}
              <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={radius} fill="none" stroke="#374151" strokeWidth="8" />
                  <circle 
                    cx="50" cy="50" r={radius} 
                    fill="none" 
                    stroke={timeLeft <= 10 ? "#EA4335" : "#4285F4"} 
                    strokeWidth="8" 
                    strokeDasharray={circumference} 
                    strokeDashoffset={strokeDashoffset} 
                    className="transition-all duration-1000 ease-linear" 
                    strokeLinecap="round" 
                  />
                </svg>
                <div className={`text-4xl font-black ${timeLeft <= 10 ? 'text-[#EA4335] animate-pulse' : 'text-gray-900'}`}>
                  {timeLeft}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="w-full">
                <p className="text-center text-gray-500 mb-2">Word length: {words[currentRound]?.length} characters</p>
                <input 
                  ref={inputRef}
                  type="text" 
                  value={inputValue} 
                  onChange={e => setInputValue(e.target.value)} 
                  placeholder="Type the word..." 
                  className="w-full bg-gray-50 border-2 border-[#4285F4] rounded-2xl px-6 py-5 text-2xl text-center text-gray-900 focus:outline-none focus:ring-4 focus:ring-[#4285F4]/50 transition-all tracking-widest shadow-lg"
                  autoComplete="off"
                  spellCheck="false"
                />
                <button 
                  type="submit" 
                  className="w-full mt-4 bg-[#4285F4] hover:bg-blue-600 text-white font-bold py-4 rounded-2xl text-xl transition-all shadow-lg hover:shadow-blue-500/25 active:scale-[0.98]"
                >
                  Submit
                </button>
              </form>
            </motion.div>
          )}

          {/* Revealing State */}
          {gameState === 'revealing' && (
            <motion.div 
              key="revealing"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center"
            >
              {isCorrect ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                  <CheckCircle2 className="w-24 h-24 text-[#34A853] mb-6 drop-shadow-[0_0_20px_rgba(52,168,83,0.5)]" />
                </motion.div>
              ) : (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                  <XCircle className="w-24 h-24 text-[#EA4335] mb-6 drop-shadow-[0_0_20px_rgba(234,67,53,0.5)]" />
                </motion.div>
              )}
              <h3 className="text-2xl text-gray-500 mb-2 uppercase tracking-wider">
                {isCorrect ? 'Correct!' : 'The word was'}
              </h3>
              <h2 className={`text-5xl md:text-7xl font-black tracking-widest ${isCorrect ? 'text-[#34A853]' : 'text-[#EA4335]'}`}>
                {words[currentRound]}
              </h2>
            </motion.div>
          )}

          {/* Results State */}
          {gameState === 'results' && (
            <motion.div 
              key="results"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center max-w-md w-full bg-gray-50/50 p-8 rounded-3xl border border-gray-200 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0, rotate: -180 }} 
                animate={{ scale: 1, rotate: 0 }} 
                transition={{ type: "spring", delay: 0.2 }}
              >
                <Trophy className="w-24 h-24 mx-auto text-[#FBBC04] mb-6 drop-shadow-[0_0_20px_rgba(251,188,4,0.5)]" />
              </motion.div>
              
              <h2 className="text-4xl font-black mb-4">Game Over!</h2>
              
              <div className="bg-white rounded-2xl py-6 mb-8 border border-gray-200">
                <p className="text-gray-500 mb-2 uppercase tracking-widest text-sm">Final Score</p>
                <p className="text-5xl font-black">
                  <span className="text-[#34A853]">{score}</span>
                  <span className="text-gray-600 mx-2">/</span>
                  <span className="text-gray-600">{TOTAL_ROUNDS}</span>
                </p>
              </div>

              {auth.currentUser ? (
                savingScore ? (
                  <p className="text-gray-500 mb-8 animate-pulse">Saving score to leaderboard...</p>
                ) : (
                  <p className="text-[#4285F4] mb-8 font-medium">Score saved to leaderboard! ✨</p>
                )
              ) : (
                <p className="text-gray-500 mb-8 text-sm">Log in to save your scores to the leaderboard.</p>
              )}

              <div className="flex flex-col gap-4">
                <button 
                  onClick={startGame} 
                  className="flex items-center justify-center w-full py-4 bg-[#4285F4] hover:bg-blue-600 text-white font-bold rounded-xl transition-colors text-lg"
                >
                  <RotateCcw className="w-5 h-5 mr-2" /> Play Again
                </button>
                <button 
                  onClick={() => navigate('/arcade')} 
                  className="w-full py-4 bg-gray-100 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors text-lg"
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
