import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';

export default function AppOverlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // Timer removed, handled by IdleLogout.jsx
  }, [location.pathname]);

  // Toast listener for Points added
  useEffect(() => {
    const handleScoreAdded = (e) => {
      const { points } = e.detail;
      setToast({ points, id: Date.now() });
      setTimeout(() => setToast(null), 4000);
    };

    window.addEventListener('arcadeScoreAdded', handleScoreAdded);
    return () => window.removeEventListener('arcadeScoreAdded', handleScoreAdded);
  }, []);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -50, scale: 0.5 }}
          animate={{ opacity: 1, y: 50, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.5 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex justify-center pointer-events-none"
        >
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-4 border-yellow-300 mt-4">
            <Trophy className="w-8 h-8 text-yellow-100 animate-bounce" />
            <div>
              <p className="font-black text-2xl">+{toast.points} Points!</p>
              <p className="font-bold text-yellow-100 text-sm">Added to Global Leaderboard</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
