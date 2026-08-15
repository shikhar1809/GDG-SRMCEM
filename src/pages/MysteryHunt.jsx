import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import LevelNode from '../components/LevelNode';
import QRModal from '../components/QRModal';
import { Trophy, ChevronLeft, ScrollText } from 'lucide-react';
import { syncBadges } from '../utils/updateArcadeScore';
import { useNavigate } from 'react-router-dom';
import {
  ALL_LEVELS,
  NORMAL_LEVELS,
  MEGA_LEVEL,
  PATH_NODES,
  claimedNormalCount,
  levelStatus,
  normalizeCode,
} from '../utils/huntConfig';

export default function MysteryHunt() {
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [levels, setLevels] = useState({}); // { [level]: { hint } }
  const [claims, setClaims] = useState({}); // { [level]: { uid, displayName, formUrl } }
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid || null;

  // Intro animation, then the rules card - but only on a player's first visit.
  useEffect(() => {
    const seen = localStorage.getItem('gdg_hunt_rules_seen');
    const t = setTimeout(() => {
      setShowIntro(false);
      if (!seen) setShowRules(true);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  // Board data. Hints are public; the secret codes and form links are not.
  useEffect(() => {
    const unsubLevels = onSnapshot(collection(db, 'huntLevels'), (snap) => {
      const next = {};
      snap.forEach((d) => {
        next[Number(d.data().level ?? d.id)] = d.data();
      });
      setLevels(next);
      setLoading(false);
    });

    const unsubClaims = onSnapshot(collection(db, 'huntClaims'), (snap) => {
      const next = {};
      snap.forEach((d) => {
        next[Number(d.data().level ?? d.id)] = d.data();
      });
      setClaims(next);
    });

    return () => {
      unsubLevels();
      unsubClaims();
    };
  }, []);

  // Keep a presence record so staff can see who is playing.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const sync = () =>
      setDoc(
        doc(db, 'huntPlayers', user.uid),
        {
          playerId: user.uid,
          displayName: user.displayName || 'Unknown',
          email: user.email || 'Unknown',
          lastActive: serverTimestamp(),
        },
        { merge: true }
      ).catch((e) => console.error('Failed to sync hunt player', e));
    sync();
    const id = setInterval(sync, 60000);
    return () => clearInterval(id);
  }, []);

  const claimedCount = claimedNormalCount(claims);
  const myWins = useMemo(
    () => ALL_LEVELS.filter((l) => claims[l]?.uid === uid).length,
    [claims, uid]
  );

  /**
   * Check a code and, if it is right, claim the level.
   * The claim is a `create`, so Firestore rejects it outright if someone else
   * got there first - that is what makes "first correct code wins" safe when
   * two people submit at the same moment.
   */
  const handleCodeSubmit = useCallback(
    async (rawCode) => {
      const user = auth.currentUser;
      if (!user) return 'You must be signed in to claim a level.';
      const level = selectedLevel;
      const code = normalizeCode(rawCode);
      if (!code) return 'Enter the code first.';

      if (claims[level]) {
        return claims[level].uid === user.uid
          ? true
          : `${claims[level].displayName || 'Someone'} already claimed this level.`;
      }

      let codeSnap;
      try {
        codeSnap = await getDoc(doc(db, 'huntLevelCodes', code));
      } catch (e) {
        console.error('Code lookup failed', e);
        return 'Network problem. Check your connection and try again.';
      }

      if (!codeSnap.exists() || Number(codeSnap.data().level) !== Number(level)) {
        return 'Incorrect code. Try again!';
      }

      try {
        await setDoc(doc(db, 'huntClaims', String(level)), {
          level: Number(level),
          code,
          uid: user.uid,
          displayName: user.displayName || 'Player',
          email: user.email || '',
          formUrl: codeSnap.data().formUrl || '',
          claimedAt: serverTimestamp(),
        });
        // Cracking a level can unlock Treasure Hunter, Complete Explorer or
        // Mega Champion, so re-check badges straight away.
        syncBadges(user.uid, user.displayName, user.email).catch((e) =>
          console.error('Badge sync after claim failed', e)
        );
        return true;
      } catch (e) {
        // Rules only allow `create`, so a write that lands second is denied.
        if (e?.code === 'permission-denied') {
          return 'Too late — somebody just claimed this level!';
        }
        console.error('Claim failed', e);
        return 'Could not claim the level. Try again.';
      }
    },
    [selectedLevel, claims]
  );

  const activeStatus = selectedLevel ? levelStatus(selectedLevel, claims, uid) : null;

  return (
    <div className="relative min-h-screen bg-white overflow-hidden font-sans">
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
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRules && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -20 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center gap-3 mb-4 md:mb-6 text-gray-900">
                <ScrollText size={32} className="text-[#4285F4] flex-shrink-0" />
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                  Rules of the Hunt
                </h2>
              </div>
              <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-gray-600 text-sm md:text-base">
                <li className="flex gap-3">
                  <span className="font-bold text-[#EA4335]">1.</span>
                  All {NORMAL_LEVELS} levels are open right now. Tap any one to read its clue —
                  solve them in any order you like.
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-[#FBBC04]">2.</span>
                  Each clue leads to a hidden QR code on the SRMCEM campus. Scan it to get that
                  level's secret code.
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-[#34A853]">3.</span>
                  <span>
                    <strong>Every level has only ONE winner.</strong> The first person to enter the
                    correct code claims it and gets the prize form. That level then closes for
                    everyone else.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-[#4285F4]">4.</span>
                  Once all {NORMAL_LEVELS} levels are claimed, the{' '}
                  <strong>Mega Level</strong> unlocks for everybody at once.
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-gray-900">5.</span>
                  Sharing codes or cheating means disqualification.
                </li>
              </ul>
              <button
                onClick={() => {
                  localStorage.setItem('gdg_hunt_rules_seen', '1');
                  setShowRules(false);
                }}
                className="w-full bg-[#4285F4] hover:bg-[#3367d6] text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-200"
              >
                LET THE HUNT BEGIN!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="absolute top-[22vh] md:top-[28vh] bottom-0 left-0 right-0 z-0 flex items-start justify-center">
        <video autoPlay loop muted playsInline className="w-full h-full object-contain object-top">
          <source src="/moving.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="relative z-10 w-full h-screen overflow-y-auto overflow-x-hidden scroll-smooth">
        <div className="min-h-[200vh] w-full max-w-md mx-auto relative pt-20 pb-40">
          {/* Top bar */}
          <div className="fixed top-0 left-0 w-full p-3 md:p-4 flex justify-between items-center z-20 pointer-events-none">
            <button
              onClick={() => navigate('/')}
              className="pointer-events-auto p-2.5 bg-white/90 backdrop-blur border border-gray-200 rounded-full shadow-sm text-gray-700 hover:bg-white transition-colors"
            >
              <ChevronLeft size={22} />
            </button>

            <div className="pointer-events-auto bg-white/90 backdrop-blur border border-gray-200 rounded-full shadow-sm px-4 py-2 flex items-center gap-2">
              <Trophy size={16} className="text-[#FBBC04]" />
              <span className="text-sm font-black text-gray-800">
                {claimedCount}/{NORMAL_LEVELS} claimed
              </span>
              {myWins > 0 && (
                <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  You: {myWins}
                </span>
              )}
            </div>

            <button
              onClick={() => setShowRules(true)}
              className="pointer-events-auto p-2.5 bg-white/90 backdrop-blur border border-gray-200 rounded-full shadow-sm text-gray-700 hover:bg-white transition-colors"
            >
              <ScrollText size={20} />
            </button>
          </div>

          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4285F4]" />
            </div>
          ) : (
            PATH_NODES.map((node) => {
              const status = levelStatus(node.level, claims, uid);
              return (
                <LevelNode
                  key={node.level}
                  level={node.level}
                  x={node.x}
                  y={node.y}
                  status={status}
                  claimName={claims[node.level]?.displayName}
                  onClick={setSelectedLevel}
                />
              );
            })
          )}
        </div>
      </div>

      <QRModal
        isOpen={selectedLevel !== null}
        onClose={() => setSelectedLevel(null)}
        level={selectedLevel || MEGA_LEVEL}
        status={activeStatus}
        hint={levels[selectedLevel]?.hint}
        claim={claims[selectedLevel]}
        formUrl={claims[selectedLevel]?.formUrl}
        claimedCount={claimedCount}
        onCodeSubmit={handleCodeSubmit}
      />
    </div>
  );
}
