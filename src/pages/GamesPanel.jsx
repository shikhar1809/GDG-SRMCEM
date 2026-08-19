import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { Award, ChevronLeft, LogOut, Search, Zap, Brain, Eye, Keyboard, Ghost, Trophy, X, Lock } from 'lucide-react';

const GAMES = [
  {
    id: 'tech-recall',
    title: 'TECH-RECALL',
    subtitle: 'Guess the Tech Word',
    description: 'Read the hint, decode the blanks, type the word. 8 rounds, 60s each. Letters reveal over time — but hints cost you points!',
    icon: Keyboard,
    color: '#4285F4',
    bgLight: 'bg-[#e8f0fe]',
    path: '/arcade/words',
    openToAll: false,
  },
  {
    id: 'prompt-wars',
    title: 'PROMPT WARS',
    subtitle: 'Guess the Prompt',
    description: 'See an AI image and name what is in it. 3 rounds, 40s each. Scored on things named, not wording.',
    icon: Brain,
    color: '#EA4335',
    bgLight: 'bg-[#fce8e6]',
    path: '/arcade/promptwars',
    openToAll: false,
  },
  {
    id: 'mystery-hunt',
    title: 'MYSTERY HUNT',
    subtitle: 'Campus QR Chase',
    description: 'Find hidden QR codes across campus, crack codes, and climb 10 levels to win!',
    icon: Search,
    color: '#FBBC04',
    bgLight: 'bg-[#fef7e0]',
    path: '/mystery-hunt',
    openToAll: true,
  },
  {
    id: 'guess-impostor',
    title: 'GUESS THE IMPOSTOR',
    subtitle: 'Find the odd one out',
    description: 'Spot the odd one out. 6 rounds, 15s each. No negative marking.',
    icon: Ghost,
    color: '#9C27B0',
    bgLight: 'bg-[#f3e5f5]',
    path: '/arcade/impostor',
    openToAll: false,
  },
  {
    id: 'ai-eye',
    title: 'AI EYE',
    subtitle: 'Real or AI?',
    description: 'Real photo or AI generated? 10 images, 8s each. Careful: a wrong answer cancels a correct one.',
    icon: Eye,
    color: '#34A853',
    bgLight: 'bg-[#e6f4ea]',
    path: '/arcade/ai-eye',
    openToAll: false,
  },
  {
    id: 'tech-quiz',
    title: 'TECH-O-FIRE',
    subtitle: 'Rapid Fire Quiz',
    description: '8 tech questions, 12 seconds each. Faster correct answers score more.',
    icon: Zap,
    color: '#EA4335',
    bgLight: 'bg-[#fce8e6]',
    path: '/arcade/tech-quiz',
    openToAll: false,
  },
  {
    id: 'guess-the-trivia',
    title: 'GUESS THE TRIVIA',
    subtitle: 'Logo or Movie?',
    description: 'See an image and guess the logo or movie shown. 5 rounds, 20s each.',
    icon: Brain,
    color: '#FF5722',
    bgLight: 'bg-[#ffebee]',
    path: '/arcade/guess-trivia',
    openToAll: false,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 200 } },
};

export default function GamesPanel() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [adminEmails, setAdminEmails] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [arcadeScores, setArcadeScores] = useState([]);
  const [playCounts, setPlayCounts] = useState({});

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'gameRequests'), where('userId', '==', user.uid));
    const unsubReqs = onSnapshot(q, (snap) => {
      const counts = {};
      snap.forEach(d => {
        const data = d.data();
        counts[data.gameId] = data.playCount || (data.status === 'completed' ? 1 : 0);
      });
      setPlayCounts(counts);
    });
    return () => unsubReqs();
  }, [user]);

  const [arcadeEnabled, setArcadeEnabled] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.adminEmails) {
          setAdminEmails(data.adminEmails.map(e => e.toLowerCase()));
        }
        setArcadeEnabled(data.arcadeEnabled === true);
      }
    });

    const arcadeUnsub = onSnapshot(collection(db, 'arcadeScores'), (snap) => {
      const scores = [];
      snap.forEach(d => scores.push({ id: d.id, ...d.data() }));
      setArcadeScores(scores.sort((a, b) => {
        if ((b.totalScore || 0) !== (a.totalScore || 0)) {
          return (b.totalScore || 0) - (a.totalScore || 0);
        }
        // Tie-breaker: earliest submission wins
        const aTime = a.lastUpdated?.toMillis?.() || Date.now();
        const bTime = b.lastUpdated?.toMillis?.() || Date.now();
        return aTime - bTime;
      }).slice(0, 10));
    });

    return () => {
      unsub();
      arcadeUnsub();
    };
  }, []);

  const SUPER_ADMINS = ['royalshikher@gmail.com', 'i.e.ishantiwari@gmail.com'];
  const isAdmin = user && (adminEmails.includes(user.email?.toLowerCase()) || SUPER_ADMINS.includes(user.email?.toLowerCase()));



  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Header */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
            <ChevronLeft size={22} />
          </button>
          <div className="flex items-center gap-2.5">
            <img src="/gdg_logo.png" alt="GDG" className="w-7 h-7 object-contain" />
            <span className="font-bold text-gray-800 text-lg tracking-tight">GDG Arcade</span>
          </div>
          <div className="flex items-center gap-3">
            {user && user.photoURL && (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-gray-200" />
            )}
            <button onClick={() => { signOut(auth); navigate('/'); }} className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Welcome & Prizes Section */}
      <div className="max-w-5xl mx-auto px-4 pt-10 pb-6 flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-start">
        {/* Welcome Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 w-full text-center md:text-left"
        >
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 md:mb-4">
            Hey, <span className="text-[#4285F4]">{user?.displayName?.split(' ')[0] || 'Player'}</span> 👋
          </h1>
          <p className="text-gray-500 text-base md:text-lg mb-4 md:mb-6">Pick a game and show everyone what you've got!</p>
          <div className="mb-4 md:mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
            Scores, approvals, and badges are linked to this Gmail: <strong>{user?.email}</strong>. Do not share one Gmail between players.
          </div>
          <button
            onClick={() => setShowLeaderboard(true)}
            className="inline-flex items-center gap-2 bg-[#34A853] hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full transition-colors shadow-sm hover:shadow-md"
          >
            <Trophy size={20} />
            View Arcade Leaderboard
          </button>
          <button
            onClick={() => navigate('/credential/mybadges')}
            className="ml-0 md:ml-3 mt-3 md:mt-0 inline-flex items-center gap-2 bg-[#4285F4] hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full transition-colors shadow-sm hover:shadow-md"
          >
            <Award size={20} />
            My Badges
          </button>
        </motion.div>

        {/* Prizes Image */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full sm:w-3/4 md:w-5/12 lg:w-1/3 bg-white border border-gray-100 rounded-2xl p-4 md:p-5 shadow-sm"
        >
          <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-gray-400 mb-3 text-center">🏆 Prizes You Can Win</h3>
          <div className="flex justify-center items-center w-full rounded-xl overflow-hidden bg-gray-50/50 p-2 border border-gray-100">
            <img
              src="/Goodies.png"
              alt="Exciting Prizes"
              className="w-full h-auto object-contain max-h-[160px] md:max-h-[200px] hover:scale-105 transition-transform duration-500"
            />
          </div>
        </motion.div>
      </div>

      {/* Game Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-5xl mx-auto px-4 pb-16 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {GAMES.map((game) => {
          const Icon = game.icon;
          return (
            <motion.button
              key={game.id}
              variants={cardVariants}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(game.path)}
              className="relative text-left w-full rounded-2xl p-6 md:p-7 border border-gray-100 bg-white hover:border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${game.bgLight} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={22} style={{ color: game.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold tracking-tight mb-0.5 text-gray-900">{game.title}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: game.color }}>{game.subtitle}</p>
                  <p className="text-gray-500 text-sm leading-relaxed">{game.description}</p>
                </div>
              </div>

              {game.openToAll && (
                <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-[#e6f4ea] text-[#34A853] px-2.5 py-1 rounded-full">
                  Open to All
                </span>
              )}
              {!isAdmin && !game.openToAll && (
                <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                  {Math.max(0, 3 - (playCounts[game.id] || 0))} Turns Left
                </span>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Version label */}
      <div className="fixed bottom-4 left-4 z-10 text-xs font-mono font-semibold select-none" style={{ color: '#9C27B0' }}>
        v101.121
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                <Trophy className="text-[#34A853]" /> Top 10 Leaderboard
              </h2>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="space-y-3">
                {arcadeScores.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 font-bold">No scores yet. Be the first!</p>
                ) : (
                  arcadeScores.map((score, idx) => (
                    <div key={score.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 flex items-center justify-center font-black text-lg ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-700' : 'text-gray-300'}`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{score.displayName || 'Anonymous'}</div>
                          <div className="text-xs text-gray-500 truncate w-32">{score.email}</div>
                        </div>
                      </div>
                      <div className="font-black text-green-500 text-xl">{score.totalScore}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
