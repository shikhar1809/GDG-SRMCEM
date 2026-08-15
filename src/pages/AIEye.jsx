import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Camera, Bot, CheckCircle, XCircle, Trophy } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { updateArcadeScore } from '../utils/updateArcadeScore';

// Hardcoded fallback images in case Firestore is empty or fails
import { AI_EYE_IMAGES as FALLBACK_IMAGES } from '../utils/gameData/aiEyeData';

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const AIEye = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showFeedback, setShowFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [isGameOver, setIsGameOver] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [adminEmails, setAdminEmails] = useState([]);
  const [requestStatus, setRequestStatus] = useState('none');
  const [lobbyCode, setLobbyCode] = useState(null);
  const [requestId, setRequestId] = useState('');
  
  const isAdmin = auth.currentUser && adminEmails.includes(auth.currentUser.email?.toLowerCase());

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'aiEyeImages'));
        const fetchedImages = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (fetchedImages.length > 0) {
          // Shuffle fetched images
          setImages(shuffleArray(fetchedImages).slice(0, 10));
        } else {
          // Use fallback and shuffle
          setImages(shuffleArray(FALLBACK_IMAGES).slice(0, 10));
        }
      } catch (error) {
        console.error("Error fetching AI Eye images:", error);
        setImages(shuffleArray(FALLBACK_IMAGES).slice(0, 10));
      } finally {
        setLoading(false);
      }
    };

    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists() && snap.data().adminEmails) {
        setAdminEmails(snap.data().adminEmails.map(e => e.toLowerCase()));
      }
    });

    fetchImages();
    
    return () => unsub();
  }, []);

  // Listen to game request status
  useEffect(() => {
    if (!auth.currentUser) return;
    const reqId = `${auth.currentUser.uid}_ai-eye`;
    setRequestId(reqId);
    
    const unsub = onSnapshot(doc(db, 'gameRequests', reqId), (snap) => {
      if (snap.exists()) {
        const status = snap.data().status;
        setRequestStatus(status);
        if (status === 'approved' && !isStarted && !isGameOver) {
          setIsStarted(true);
        }
      } else {
        setRequestStatus('none');
        setLobbyCode(null);
      }
    });
    return () => unsub();
  }, [isStarted, isGameOver]);

  const handleAnswer = (guessedAI) => {
    if (showFeedback || isGameOver) return;

    const currentImage = images[currentIndex];
    const isCorrect = currentImage.isAI === guessedAI;

    if (isCorrect) {
      setScore(prev => prev + 1);
      setShowFeedback('correct');
    } else {
      setShowFeedback('wrong');
    }

    // Wait for animation before moving to next image
    setTimeout(() => {
      setShowFeedback(null);
      if (currentIndex < images.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        handleGameOver(score + (isCorrect ? 1 : 0));
      }
    }, 1200);
  };

  const handleGameOver = async (finalScore) => {
    setIsGameOver(true);

    const user = auth.currentUser;
    if (user) {
      try {
        const scoreRef = doc(collection(db, 'aiEyeScores'), user.uid);
        await setDoc(scoreRef, {
          playerId: user.uid,
          displayName: user.displayName || 'Player',
          email: user.email || '',
          score: finalScore,
          total: images.length,
          lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
                          timestamp: serverTimestamp()
        });
        
        // Award Arcade Score
        const earnedPts = Math.round((finalScore / images.length) * 100);
        await updateArcadeScore(user.uid, user.displayName, user.email, 'ai-eye', earnedPts);
          
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  const getRating = (percentage) => {
    if (percentage >= 80) return { text: 'AI Detective 🕵️', color: 'text-cyan-400' };
    if (percentage >= 50) return { text: 'Getting There 👀', color: 'text-yellow-400' };
    return { text: 'Needs Training 🤖', color: 'text-red-400' };
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
          <h2 className="text-5xl font-black mb-6">AI Eye</h2>
          <p className="text-gray-500 mb-8 text-lg">
            In this game, you'll be shown a series of images. Your task is to identify whether each image is <span className="text-emerald-400 font-bold">Real</span> or <span className="text-indigo-400 font-bold">AI Generated</span>.
          </p>
          
          {!isAdmin ? (
            <div className="bg-gray-50/80 border border-gray-200 p-8 rounded-3xl w-full text-center max-w-md mx-auto shadow-2xl">
              <div className="bg-emerald-500/20 text-[#34d399] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
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
                    const reqId = `${auth.currentUser.uid}_ai-eye`;
                    await setDoc(doc(db, 'gameRequests', reqId), {
                      userId: auth.currentUser.uid,
                      userName: auth.currentUser.displayName || 'Player',
                      userEmail: auth.currentUser.email,
                      gameId: 'ai-eye',
                      status: 'pending',
                      lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
                          timestamp: serverTimestamp()
                    });
                  }}
                  className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#34A853] hover:bg-green-600 text-white font-bold rounded-xl text-lg transition-colors shadow-lg"
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
              className="bg-[#34A853] hover:bg-green-600 text-white font-bold py-4 px-10 rounded-full text-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all hover:scale-105 active:scale-95"
            >
              Start Game
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  if (isGameOver) {
    const percentage = Math.round((score / images.length) * 100);
    const rating = getRating(percentage);

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
          <p className="text-gray-500 mb-8 font-medium">How good is your AI Eye?</p>
          
          <div className="relative inline-block mb-6">
            <div className="text-7xl font-black text-gray-900">
              {score}<span className="text-4xl text-gray-500">/{images.length}</span>
            </div>
          </div>
          
          <div className="text-2xl font-bold mb-2">
            {percentage}% Accuracy
          </div>
          
          <div className={`text-2xl font-black ${rating.color} mb-10`}>
            {rating.text}
          </div>

          <button
            onClick={() => navigate('/arcade')}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white rounded-2xl font-bold text-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/25"
          >
            Play More Games
          </button>
        </motion.div>
      </div>
    );
  }

  const currentImage = images[currentIndex];
  const progress = ((currentIndex + 1) / images.length) * 100;

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-6 flex flex-col items-center">
      {/* Top Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-8 mt-4">
        <button 
          onClick={() => navigate('/arcade')}
          className="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2 p-2 -ml-2 rounded-full hover:bg-gray-50"
        >
          <ArrowLeft size={24} />
          <span className="hidden sm:inline font-medium">Back</span>
        </button>
        
        <h1 className="text-xl md:text-2xl font-black tracking-tight text-gray-900 text-center uppercase">
          How Good Is My AI Eye?
        </h1>
        
        <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
          <span className="text-gray-500 text-sm font-medium mr-2">SCORE</span>
          <span className="text-cyan-400 font-black text-xl">{score}</span>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
          <span>Image {currentIndex + 1}</span>
          <span>{images.length} Total</span>
        </div>
        <div className="w-full bg-gray-50 rounded-full h-3 overflow-hidden shadow-inner">
          <motion.div 
            className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Game Card */}
      <div className="w-full max-w-2xl relative flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 25 }}
            className="bg-gray-50 rounded-3xl p-5 shadow-2xl border border-gray-200 relative overflow-hidden flex-1 flex flex-col"
          >
            {/* Feedback Overlay Flash */}
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute inset-0 z-20 flex items-center justify-center backdrop-blur-md ${
                    showFeedback === 'correct' ? 'bg-green-900/90 text-green-400' : 'bg-red-900/90 text-red-400'
                  }`}
                >
                  <motion.div 
                    initial={{ scale: 0.5, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex flex-col items-center"
                  >
                    {showFeedback === 'correct' ? (
                      <>
                        <CheckCircle size={100} className="mb-6 drop-shadow-lg" />
                        <span className="text-5xl font-black tracking-widest uppercase drop-shadow-md">Correct</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={100} className="mb-6 drop-shadow-lg" />
                        <span className="text-5xl font-black tracking-widest uppercase drop-shadow-md">Wrong</span>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Image Wrapper */}
            <div className="relative w-full aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden mb-6 bg-white flex-shrink-0 shadow-inner">
              <img 
                src={currentImage.imageUrl} 
                alt="Mystery" 
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mt-auto">
              <button
                onClick={() => handleAnswer(false)}
                disabled={showFeedback !== null}
                className="group relative flex flex-col items-center justify-center gap-3 py-6 bg-white/50 hover:bg-gray-100 rounded-2xl border-2 border-gray-600 hover:border-cyan-500 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Camera size={36} className="text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
                <span className="font-black text-xl tracking-wider text-gray-900">REAL</span>
              </button>
              
              <button
                onClick={() => handleAnswer(true)}
                disabled={showFeedback !== null}
                className="group relative flex flex-col items-center justify-center gap-3 py-6 bg-white/50 hover:bg-gray-100 rounded-2xl border-2 border-gray-600 hover:border-purple-500 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Bot size={36} className="text-purple-400 group-hover:scale-110 transition-transform duration-300" />
                <span className="font-black text-xl tracking-wider text-gray-900">AI GEN</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AIEye;
