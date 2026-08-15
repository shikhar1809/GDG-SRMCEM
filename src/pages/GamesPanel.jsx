import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { ChevronLeft, LogOut, Search, Zap, Brain, Eye, Keyboard, Lock, MapPin, Ghost, Trophy, X } from 'lucide-react';
import { withoutAdmins, rankScores } from '../utils/leaderboard';
import { badgeById, BADGES } from '../utils/badges';



const GAMES = [
  {
    id: 'tech-recall',
    title: 'TECH-RECALL',
    subtitle: 'Write Get Word',
    description: 'A tech word flashes for ~2 seconds. Remember it and type it back. 8 rounds, 15s each.',
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
    description: "Spot the odd one out. 6 rounds, 15s each. No negative marking.",
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
  const [allScores, setAllScores] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists() && snap.data().adminEmails) {
        setAdminEmails(snap.data().adminEmails.map(e => e.toLowerCase()));
      }
    });

    const arcadeUnsub = onSnapshot(collection(db, 'arcadeScores'), (snap) => {
      const scores = [];
      snap.forEach(d => scores.push({ id: d.id, ...d.data() }));
      setAllScores(scores);
    });

    return () => {
      unsub();
      arcadeUnsub();
    };
  }, []);

  const isAdmin = user && adminEmails.includes(user.email?.toLowerCase());
  // Staff run the stall, so their test scores must not sit on the board.
  const arcadeScores = rankScores(withoutAdmins(allScores, adminEmails)).slice(0, 10);

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
            <button onClick={() => { localStorage.clear(); signOut(auth); navigate('/'); }} className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400">
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
          <button 
            onClick={() => setShowLeaderboard(true)}
            className="inline-flex items-center gap-2 bg-[#34A853] hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full transition-colors shadow-sm hover:shadow-md"
          >
            <Trophy size={20} />
            View Arcade Leaderboard
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
            </motion.button>
          );
        })}
      </motion.div>

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
                          {score.badges?.length ? (
                            <div className="flex gap-1 mt-0.5">
                              {score.badges.map((id) => {
                                const b = badgeById(id);
                                return b ? (
                                  <span key={id} title={`${b.name} (+${b.points})`} className="text-base leading-none">
                                    {b.icon}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 truncate w-32">{score.email}</div>
                          )}
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
