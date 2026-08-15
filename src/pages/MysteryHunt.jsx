import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { auth } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import LevelNode from '../components/LevelNode';
import QRModal from '../components/QRModal';
import { Trophy, ChevronLeft, ScrollText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DepthText from '../components/DepthText';

// Node positions (X, Y percentage) creating a winding path upwards
const PATH_NODES = [
  { level: 1, x: 15, y: 95 },
  { level: 2, x: 85, y: 86.6 },
  { level: 3, x: 80, y: 78.3 },
  { level: 4, x: 15, y: 70 },
  { level: 5, x: 20, y: 61.6 },
  { level: 6, x: 85, y: 53.3 },
  { level: 7, x: 80, y: 45 },
  { level: 8, x: 15, y: 36.6 },
  { level: 9, x: 20, y: 28.3 },
  { level: 10, x: 50, y: 20 },
];

export default function MysteryHunt() {
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formUrl, setFormUrl] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    let pid;
    // Use Google Auth user ID
    if (auth.currentUser) {
      pid = auth.currentUser.uid;
    } else {
      // Fallback (though ProtectedRoute should prevent this)
      pid = localStorage.getItem('gdg_hunt_player_id');
      if (!pid) {
        pid = 'player_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('gdg_hunt_player_id', pid);
      }
    }
    setPlayerId(pid);

    // 1. Initial Intro Animation Sequence
    const savedLevel = localStorage.getItem(`gdg_hunt_level_${pid}`);
    if (savedLevel) {
      setCurrentLevel(parseInt(savedLevel, 10));
    }
    
    setLoading(false);

    // Only show intro if starting fresh
    if (!savedLevel || savedLevel === '1') {
      const timer = setTimeout(() => {
        setShowIntro(false);
        setShowRules(true);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setShowIntro(false);
      setShowRules(false);
    }
  }, [auth.currentUser]);

  useEffect(() => {
    // Sync player progress and lastActive status to Firestore
    if (!playerId) return;
    const syncPlayer = async () => {
      try {
        const user = auth.currentUser;
        await setDoc(doc(db, 'huntPlayers', playerId), {
          playerId,
          displayName: user ? user.displayName : 'Unknown',
          email: user ? user.email : 'Unknown',
          currentLevel,
          lastActive: serverTimestamp()
        }, { merge: true });
      } catch(e) {
        console.error("Failed to sync player data", e);
      }
    };
    syncPlayer();
    const interval = setInterval(syncPlayer, 30000); // Heartbeat every 30s
    return () => clearInterval(interval);
  }, [playerId, currentLevel]);

  useEffect(() => {
    if (!playerId) return;
    // Listen for global configuration and hunt restarts
    const configRef = doc(db, 'huntConfig', 'global');
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.formUrl) setFormUrl(data.formUrl);
        
        if (data.globalRestartToken) {
          const localToken = localStorage.getItem(`gdg_hunt_restart_token_${playerId}`);
          if (localToken !== data.globalRestartToken.toString()) {
            // Force restart!
            localStorage.setItem(`gdg_hunt_restart_token_${playerId}`, data.globalRestartToken.toString());
            localStorage.setItem(`gdg_hunt_level_${playerId}`, '1');
            setCurrentLevel(1);
            setShowIntro(true);
            setShowRules(false);
            setTimeout(() => {
              setShowIntro(false);
              setShowRules(true);
            }, 2500);
          }
        }
      }
    });
    return () => unsubscribe();
  }, [playerId]);

  const handleCodeSubmit = async (code) => {
    try {
      const codeRef = doc(db, 'levelCodes', code);
      const codeSnap = await getDoc(codeRef);
      if (codeSnap.exists()) {
        const data = codeSnap.data();
        // Allow if the code matches the currently selected node
        if (data.level === selectedLevel) {
          const newLevel = currentLevel + 1;
          localStorage.setItem(`gdg_hunt_level_${playerId}`, newLevel);
          setCurrentLevel(newLevel);
          setSelectedLevel(null); // Close modal
          return true;
        }
      }
      return false;
    } catch(e) {
      console.error("Code check failed", e);
      return false;
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="relative min-h-screen bg-white overflow-hidden font-sans">
      
      {/* ----------------- 1. INTRO ANIMATION ----------------- */}
      <AnimatePresence>
        {showIntro && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-white"
          >
            <motion.img
              src="/gdg_logo.png"
              alt="GDG Loading"
              initial={{ scale: 0.5, rotate: -180, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 100 }}
              className="w-32 h-32 object-contain"
            />
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "200px" }}
              transition={{ delay: 1, duration: 1 }}
              className="absolute bottom-1/4 h-1 bg-[#4285F4] rounded-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------- 2. RULES POPUP ----------------- */}
      <AnimatePresence>
        {showRules && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -20 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl mx-4"
            >
              <div className="flex items-center gap-3 mb-4 md:mb-6 text-gray-900">
                <ScrollText size={32} className="text-[#4285F4] flex-shrink-0" />
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Rules of the Hunt</h2>
              </div>
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-gray-600 text-sm md:text-base">
                <li className="flex gap-3">
                  <span className="font-bold text-[#EA4335]">1.</span> 
                  Find the hidden QR codes scattered around the SRMCEM campus.
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-[#FBBC04]">2.</span> 
                  Scan the QR to get the secret code for your current level.
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-[#34A853]">3.</span> 
                  Enter the code to unlock the next level. First to finish wins!
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-gray-900">4.</span> 
                  Any cheating or sharing codes will result in disqualification.
                </li>
              </ul>
              <button 
                onClick={() => setShowRules(false)}
                className="w-full bg-[#4285F4] hover:bg-[#3367d6] text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-200"
              >
                LET THE HUNT BEGIN!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="absolute top-[22vh] md:top-[28vh] bottom-0 left-0 right-0 z-0 flex items-start justify-center">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-full h-full object-contain object-top"
        >
          <source src="/moving.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="relative z-10 w-full h-screen overflow-y-auto overflow-x-hidden scroll-smooth">
        <div className="min-h-[200vh] w-full max-w-md mx-auto relative pt-20 pb-40">
          
          {/* Top Navigation */}
          <div className="fixed top-0 left-0 w-full p-3 md:p-4 flex justify-between items-center z-20 pointer-events-none">
            <button 
              onClick={() => navigate('/')} 
              className="bg-black/40 backdrop-blur-xl text-white p-2 md:p-2.5 rounded-full pointer-events-auto hover:bg-black/60 transition-colors border border-white/10 shadow-lg"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="bg-black/40 backdrop-blur-xl px-3 md:px-4 py-1.5 md:py-2 rounded-full flex items-center gap-2 pointer-events-auto border border-white/10 shadow-lg">
              <img src="/gdg_logo.png" alt="avatar" className="w-6 h-6 rounded-full" />
              <span className="text-white font-bold text-xs md:text-sm truncate max-w-[80px] md:max-w-[120px]">
                Hunter
              </span>
            </div>
          </div>

          {/* DepthText 3D Title */}
          <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2 w-full flex justify-center z-0 opacity-90 pointer-events-none">
            <style>{`
              .mystery-title-effect .depth-text__face {
                color: rgba(255, 255, 255, 0.15) !important;
                -webkit-text-stroke: 2px rgba(255, 255, 255, 0.9);
              }
              .mystery-title-effect .depth-text__layer {
                color: rgba(255, 255, 255, 0.05) !important;
                -webkit-text-stroke: 1px rgba(255, 255, 255, 0.1);
              }
            `}</style>
            <DepthText
              className="mystery-title-effect"
              text={"MYSTERY\nHUNT"}
              layers={34}
              depth={2.4}
              faceColor="rgba(255,255,255,0)"
              depthColor="rgba(255,255,255,0)"
              tilt={7.5}
              pointerTracking={false} /* Disabled tracking because it's behind the UI */
              autoOrbit={true}
              orbitSpeed={0.35}
              fontSize="clamp(3rem, 10vw, 6rem)"
              fontWeight={900}
              shadow={true}
            />
          </div>

          {/* SVG Path connecting the nodes */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-lg" preserveAspectRatio="none">
            <path
              d={`M ${PATH_NODES[0].x}% ${PATH_NODES[0].y}% 
                 C ${PATH_NODES[1].x}% ${PATH_NODES[0].y}%, ${PATH_NODES[0].x}% ${PATH_NODES[1].y}%, ${PATH_NODES[1].x}% ${PATH_NODES[1].y}%
                 C ${PATH_NODES[2].x}% ${PATH_NODES[1].y}%, ${PATH_NODES[1].x}% ${PATH_NODES[2].y}%, ${PATH_NODES[2].x}% ${PATH_NODES[2].y}%
                 C ${PATH_NODES[3].x}% ${PATH_NODES[2].y}%, ${PATH_NODES[2].x}% ${PATH_NODES[3].y}%, ${PATH_NODES[3].x}% ${PATH_NODES[3].y}%
                 C ${PATH_NODES[4].x}% ${PATH_NODES[3].y}%, ${PATH_NODES[3].x}% ${PATH_NODES[4].y}%, ${PATH_NODES[4].x}% ${PATH_NODES[4].y}%
                 C ${PATH_NODES[5].x}% ${PATH_NODES[4].y}%, ${PATH_NODES[4].x}% ${PATH_NODES[5].y}%, ${PATH_NODES[5].x}% ${PATH_NODES[5].y}%
                 C ${PATH_NODES[6].x}% ${PATH_NODES[5].y}%, ${PATH_NODES[5].x}% ${PATH_NODES[6].y}%, ${PATH_NODES[6].x}% ${PATH_NODES[6].y}%
                 C ${PATH_NODES[7].x}% ${PATH_NODES[6].y}%, ${PATH_NODES[6].x}% ${PATH_NODES[7].y}%, ${PATH_NODES[7].x}% ${PATH_NODES[7].y}%
                 C ${PATH_NODES[8].x}% ${PATH_NODES[7].y}%, ${PATH_NODES[7].x}% ${PATH_NODES[8].y}%, ${PATH_NODES[8].x}% ${PATH_NODES[8].y}%
                 C ${PATH_NODES[9].x}% ${PATH_NODES[8].y}%, ${PATH_NODES[8].x}% ${PATH_NODES[9].y}%, ${PATH_NODES[9].x}% ${PATH_NODES[9].y}%
                `}
              fill="none"
              stroke="rgba(0,0,0,0.15)"
              strokeWidth="8"
              strokeDasharray="10, 15"
              strokeLinecap="round"
            />
          </svg>

          {/* Level Nodes */}
          {PATH_NODES.map((node) => (
            <LevelNode
              key={node.level}
              level={node.level}
              x={node.x}
              y={node.y}
              currentLevel={currentLevel}
              onClick={(lvl) => setSelectedLevel(lvl)}
            />
          ))}



        </div>
      </div>

      {/* ----------------- 4. QR CODE MODAL ----------------- */}
      <QRModal 
        isOpen={selectedLevel !== null} 
        onClose={() => setSelectedLevel(null)}
        level={selectedLevel}
        currentLevel={currentLevel}
        onCodeSubmit={handleCodeSubmit}
      />

      {/* ----------------- 5. WINNER FINAL FORM POPUP ----------------- */}
      <AnimatePresence>
        {currentLevel > 10 && formUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -5 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              className="bg-gradient-to-br from-yellow-400 via-[#FBBC04] to-yellow-600 rounded-3xl p-8 w-full max-w-lg shadow-2xl text-center text-white border-4 border-yellow-200"
            >
              <Trophy size={80} className="mx-auto mb-6 drop-shadow-lg" />
              <h2 className="text-4xl font-black uppercase tracking-tight mb-2 drop-shadow-md">You Found It!</h2>
              <p className="text-yellow-100 text-lg mb-8 font-medium">
                Congratulations! You've successfully completed the GDG SRMCEM Mystery Hunt. Claim your prize now.
              </p>
              <a 
                href={formUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full bg-white text-yellow-600 font-black text-xl py-4 rounded-xl transition-transform hover:scale-105 shadow-xl"
              >
                OPEN CLAIM FORM
              </a>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
