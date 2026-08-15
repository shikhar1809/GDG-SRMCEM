import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';

/**
 * Global toasts: points added, and the badge unlock celebration.
 *
 * Badge unlocks queue rather than overwrite - finishing your fifth game can
 * earn three badges at once, and each one should get its moment.
 */
export default function AppOverlay() {
  const [toast, setToast] = useState(null);
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [badge, setBadge] = useState(null);

  useEffect(() => {
    const onScore = (e) => {
      const { points } = e.detail;
      if (!points) return;
      setToast({ points, id: Date.now() });
      setTimeout(() => setToast(null), 3500);
    };
    const onBadge = (e) => {
      const list = e.detail?.badges || [];
      if (list.length) setBadgeQueue((q) => [...q, ...list]);
    };
    window.addEventListener('arcadeScoreAdded', onScore);
    window.addEventListener('badgeUnlocked', onBadge);
    return () => {
      window.removeEventListener('arcadeScoreAdded', onScore);
      window.removeEventListener('badgeUnlocked', onBadge);
    };
  }, []);

  // Show queued badges one at a time.
  useEffect(() => {
    if (badge || badgeQueue.length === 0) return;
    const [next, ...rest] = badgeQueue;
    setBadge(next);
    setBadgeQueue(rest);
    const t = setTimeout(() => setBadge(null), 4200);
    return () => clearTimeout(t);
  }, [badge, badgeQueue]);

  return (
    <>
      {/* Points toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -50, scale: 0.5 }}
            animate={{ opacity: 1, y: 50, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.5 }}
            className="fixed top-0 left-0 right-0 z-[9998] flex justify-center pointer-events-none px-4"
          >
            <div className="bg-[#FBBC04] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <Trophy className="w-8 h-8 text-white" />
              <div>
                <p className="font-black text-2xl">+{toast.points} Points!</p>
                <p className="font-bold text-yellow-50 text-sm">Added to the leaderboard</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge unlock celebration */}
      <AnimatePresence>
        {badge && (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none px-4"
          >
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" />

            {/* Rays behind the medal */}
            <motion.div
              initial={{ scale: 0, rotate: 0 }}
              animate={{ scale: 1, rotate: 360 }}
              transition={{ duration: 4, ease: 'linear' }}
              className="absolute w-[420px] h-[420px] rounded-full opacity-25"
              style={{
                background: `conic-gradient(from 0deg, ${badge.color}, transparent 25%, ${badge.color} 50%, transparent 75%, ${badge.color})`,
              }}
            />

            <motion.div
              initial={{ scale: 0.4, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 14, stiffness: 200 }}
              className="relative bg-white rounded-3xl px-8 py-8 shadow-2xl text-center max-w-xs w-full"
            >
              <p
                className="text-xs font-black uppercase tracking-[0.2em] mb-4"
                style={{ color: badge.color }}
              >
                Badge Unlocked
              </p>

              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 10, stiffness: 180, delay: 0.15 }}
                className="w-28 h-28 mx-auto rounded-full flex items-center justify-center mb-5 shadow-lg"
                style={{ backgroundColor: `${badge.color}1a`, border: `4px solid ${badge.color}` }}
              >
                <span className="text-5xl leading-none">{badge.icon}</span>
              </motion.div>

              <h3 className="text-2xl font-black text-gray-900 mb-1">{badge.name}</h3>
              <p className="text-sm text-gray-500 mb-4 leading-snug">{badge.description}</p>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="inline-block text-white font-black text-lg px-5 py-2 rounded-full"
                style={{ backgroundColor: badge.color }}
              >
                +{badge.points} points
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
