import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

export default function AppOverlay() {
  const [toast, setToast] = useState(null);
  const [isOffline, setIsOffline] = useState(() => navigator.onLine === false);
  const [pendingScore, setPendingScore] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setPendingScore(false);
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  useEffect(() => {
    const handlePending = () => setPendingScore(true);
    window.addEventListener('arcadeScorePending', handlePending);
    return () => window.removeEventListener('arcadeScorePending', handlePending);
  }, []);

  return (
    <>
      {(isOffline || pendingScore) && (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] flex justify-center pointer-events-none">
          <div className="max-w-xl rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-900 shadow-lg">
            {isOffline
              ? 'Network is offline. Do not close the game until it reconnects.'
              : 'Score save is pending. Keep this tab open; it will retry automatically.'}
          </div>
        </div>
      )}
      {toast ? (
        <div className="fixed top-12 left-0 right-0 z-[9999] flex justify-center pointer-events-none">
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-4 border-yellow-300 animate-bounce">
            <Trophy className="w-8 h-8 text-yellow-100" />
            <div>
              <p className="font-black text-2xl">+{toast.points} Points!</p>
              <p className="font-bold text-yellow-100 text-sm">Added to Global Leaderboard</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
