import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, onSnapshot, serverTimestamp, query, orderBy, limit, increment, where } from 'firebase/firestore';
import LevelNode from '../components/LevelNode';
import QRModal from '../components/QRModal';
import { Trophy, ChevronLeft, ScrollText, Lock, Users, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ALL_LEVELS,
  NORMAL_LEVELS,
  MEGA_LEVEL,
  PATH_NODES,
  claimedNormalCount,
  levelStatus,
  normalizeCode,
  isMegaLevel,
  MEGA_LEVEL_POINTS,
  NORMAL_LEVEL_POINTS
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

  const [userTeam, setUserTeam] = useState(undefined); 
  const [joinPasscode, setJoinPasscode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [broadcast, setBroadcast] = useState(null);
  const [huntPhase, setHuntPhase] = useState('locked');

  const [forceMegaUnlock, setForceMegaUnlock] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntState', 'status'), (snap) => {
      if (snap.exists()) {
        setHuntPhase(snap.data().state || 'locked');
        setForceMegaUnlock(snap.data().forceMegaUnlock || false);
      } else {
        setHuntPhase('locked');
        setForceMegaUnlock(false);
      }
    });
    return () => unsub();
  }, []);

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

  useEffect(() => {
    if (!uid) {
      setUserTeam(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'huntPlayers', uid), (snap) => {
      if (snap.exists() && snap.data().teamId) {
        setUserTeam({ id: snap.data().teamId, name: snap.data().teamName });
      } else {
        setUserTeam(null);
      }
    });
    return () => unsub();
  }, [uid]);

  // Check if team is disqualified
  useEffect(() => {
    if (!userTeam?.id) return;
    const unsub = onSnapshot(doc(db, 'huntTeams', userTeam.id), (snap) => {
      if (snap.exists() && snap.data().disqualified) {
        alert("Your team has been disqualified.");
        navigate('/');
      }
    });
    return () => unsub();
  }, [userTeam?.id, navigate]);

  useEffect(() => {
    const q = query(collection(db, 'huntBroadcasts'), orderBy('timestamp', 'desc'), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const age = data.timestamp ? Date.now() - data.timestamp.toMillis() : 0;
          if (age < 15000) { 
            setBroadcast(data.message);
            setTimeout(() => setBroadcast(null), 8000);
          }
        }
      });
    });
    return () => unsub();
  }, []);

  const handleJoinTeam = async () => {
    setJoinError('');
    if (!joinPasscode.trim()) return;
    try {
      const teamsSnap = await getDocs(query(collection(db, 'huntTeams')));
      let foundTeam = null;
      teamsSnap.forEach(d => {
        if (d.data().passcode === joinPasscode.trim()) {
          foundTeam = { id: d.id, ...d.data() };
        }
      });
      if (!foundTeam) {
        setJoinError("Invalid Team Code.");
        return;
      }
      
      const teamPlayersSnap = await getDocs(query(collection(db, 'huntPlayers'), where('teamId', '==', foundTeam.id)));
      if (teamPlayersSnap.size >= 3) {
        setJoinError("This team is already full (max 3 players).");
        return;
      }

      await setDoc(doc(db, 'huntPlayers', uid), {
        teamId: foundTeam.id,
        teamName: foundTeam.name,
      }, { merge: true });
    } catch (e) {
      console.error(e);
      setJoinError("Network error. Try again.");
    }
  };

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
          teamId: userTeam?.id || '',
          teamName: userTeam?.name || '',
          playerName: user.displayName || 'Unknown',
          displayName: userTeam?.name || user.displayName || 'Player',
          email: user.email || '',
          formUrl: codeSnap.data().formUrl || '',
          claimedAt: serverTimestamp(),
        });

        if (userTeam?.id) {
          const pts = isMegaLevel(level) ? MEGA_LEVEL_POINTS : NORMAL_LEVEL_POINTS;
          await updateDoc(doc(db, 'huntTeams', userTeam.id), { score: increment(pts) });

          await setDoc(doc(db, 'huntBroadcasts', Date.now().toString()), {
            message: `Level ${level} has been cracked by ${userTeam.name}!`,
            timestamp: serverTimestamp()
          });
        }
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
    [selectedLevel, claims, userTeam]
  );

  const isActuallyPlaying = huntPhase === 'playing' || huntPhase === 'level10';
  const effectiveForceMegaUnlock = forceMegaUnlock || huntPhase === 'level10';

  const activeStatus = selectedLevel ? levelStatus(selectedLevel, claims, uid, userTeam?.id, effectiveForceMegaUnlock) : null;

  if (huntPhase === 'ended') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-6">
          <Trophy size={48} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">The Hunt Has Concluded!</h1>
        <p className="text-lg text-gray-600 mb-8 max-w-md">
          Thank you for playing the GDG SRMCEM Mystery Hunt. The game is now over. Please check the main stage for the final results!
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-[#4285F4] hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-xl transition-colors shadow-lg shadow-blue-200"
        >
          Return to Arcade Home
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-white overflow-hidden font-sans">
      
      {/* Broadcast Toast */}
      <AnimatePresence>
        {broadcast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-blue-600 text-white p-4 rounded-2xl shadow-2xl z-[60] flex items-start gap-3 border-2 border-blue-400"
          >
            <span className="text-2xl">📢</span>
            <div>
              <div className="font-bold text-blue-100 text-xs uppercase tracking-wider mb-1">Admin Broadcast</div>
              <div className="font-medium text-sm leading-relaxed">{broadcast}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team Linking Modal */}
      <AnimatePresence>
        {huntPhase === 'onboarding' && userTeam === null && !loading && !showIntro && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-sm shadow-2xl mx-4 text-center"
            >
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy size={32} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Join Your Team</h2>
              <p className="text-sm text-gray-500 mb-6">Enter the 4-digit team passcode provided by the admin at the stall to start hunting!</p>
              
              <input
                type="text"
                placeholder="Team Passcode (e.g. 1234)"
                value={joinPasscode}
                onChange={e => setJoinPasscode(e.target.value)}
                maxLength={4}
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-center text-2xl font-black tracking-widest focus:outline-none focus:border-purple-500 mb-2"
              />
              {joinError && <div className="text-red-500 text-sm font-bold mb-4">{joinError}</div>}
              
              <button
                onClick={handleJoinTeam}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2"
              >
                Start Hunting
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {huntPhase === 'locked' && !showIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6"
          >
            <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl mx-4 max-h-[90vh] overflow-y-auto text-left">
              <div className="flex items-center gap-3 mb-2 text-gray-900">
                <Lock size={32} className="text-gray-400 flex-shrink-0" />
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Locked</h2>
              </div>
              <p className="text-gray-600 mb-6 font-medium">
                The Mystery Hunt hasn't started yet! Visit the stall to register your team.
              </p>
              
              <div className="border-t border-gray-100 pt-6 mb-6">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                  <ScrollText size={20} className="text-[#4285F4]" /> How it works
                </h3>
                <ul className="space-y-3 md:space-y-4 text-gray-600 text-sm md:text-base">
                  <li className="flex gap-3">
                    <span className="font-bold text-[#EA4335]">1.</span>
                    All {NORMAL_LEVELS} levels open at once. Tap any one to read its clue — solve them in any order you like.
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-[#FBBC04]">2.</span>
                    Each clue leads to a hidden QR code on the SRMCEM campus. Scan it to get that level's secret code.
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-[#34A853]">3.</span>
                    <span><strong>Every level has only ONE winner.</strong> The first person to enter the correct code claims it. That level then closes for everyone else.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-[#4285F4]">4.</span>
                    Once all {NORMAL_LEVELS} levels are claimed, the <strong>Mega Level</strong> unlocks for everybody at once.
                  </li>
                </ul>
              </div>

              <button
                onClick={() => navigate('/')}
                className="w-full bg-gray-900 text-white font-bold py-3 px-8 rounded-xl hover:bg-gray-800 transition-colors shadow-lg"
              >
                Go Back
              </button>
            </div>
          </motion.div>
        )}

        {huntPhase === 'onboarding' && userTeam !== null && !showIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6"
          >
            <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl mx-4 max-h-[90vh] overflow-y-auto text-left">
              <div className="flex items-center gap-3 mb-2 text-gray-900">
                <Users size={32} className="text-purple-600 flex-shrink-0 animate-pulse" />
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Team {userTeam.name} Joined!</h2>
              </div>
              <p className="text-gray-600 mb-6 font-medium">
                Hang tight. The hunt will begin shortly once the admin starts the game.
              </p>
              
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                  <ScrollText size={20} className="text-[#4285F4]" /> How it works
                </h3>
                <ul className="space-y-3 md:space-y-4 text-gray-600 text-sm md:text-base">
                  <li className="flex gap-3">
                    <span className="font-bold text-[#EA4335]">1.</span>
                    All {NORMAL_LEVELS} levels open at once. Tap any one to read its clue — solve them in any order you like.
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-[#FBBC04]">2.</span>
                    Each clue leads to a hidden QR code on the SRMCEM campus. Scan it to get that level's secret code.
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-[#34A853]">3.</span>
                    <span><strong>Every level has only ONE winner.</strong> The first person to enter the correct code claims it. That level then closes for everyone else.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-[#4285F4]">4.</span>
                    Once all {NORMAL_LEVELS} levels are claimed, the <strong>Mega Level</strong> unlocks for everybody at once.
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {huntPhase === 'playing' && userTeam === null && !loading && !showIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-200">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">Registrations Closed</h2>
            <p className="text-gray-600 text-lg mb-8 max-w-sm">
              The game is already in progress and no new teams can join at this time.
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-900 text-white font-bold py-3 px-8 rounded-full hover:bg-gray-800 transition-colors shadow-xl"
            >
              Go Back
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
        <video autoPlay loop muted playsInline controls={false} disablePictureInPicture className="w-full h-full object-contain object-top pointer-events-none">
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
              className="pointer-events-auto px-4 py-2.5 bg-[#4285F4] backdrop-blur border border-[#3367d6] rounded-full shadow-md text-white hover:bg-[#3367d6] transition-colors flex items-center gap-2 animate-pulse"
            >
              <ScrollText size={20} />
              <span className="text-sm font-black tracking-wide">RULES</span>
            </button>
          </div>

          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4285F4]" />
            </div>
          ) : huntPhase === 'locked' ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-3xl shadow-xl flex items-center gap-3 border border-gray-100">
                <Lock className="text-gray-400" />
                <span className="font-bold text-gray-800 text-lg">The hunt hasn't started yet!</span>
              </div>
            </div>
          ) : (
            PATH_NODES.map((node) => {
              const status = levelStatus(node.level, claims, uid, userTeam?.id, effectiveForceMegaUnlock);
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
        hintImage={levels[selectedLevel]?.[`hintImage${levels[selectedLevel]?.activeHintLevel || 1}`]}
        claim={claims[selectedLevel]}
        formUrl={claims[selectedLevel]?.formUrl}
        claimedCount={claimedCount}
        onCodeSubmit={handleCodeSubmit}
      />
    </div>
  );
}
