import React, { useState, useEffect } from 'react';
import { db, auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Shield, RefreshCw, LogOut, Users, Settings, Brain, Search, Globe, Power, AlertTriangle, Flame, Ghost, Eye, Trophy } from 'lucide-react';

const SUPER_ADMINS = ['royalshikher@gmail.com', 'i.e.ishantiwari@gmail.com'];

export default function AdminGames() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('arcadeLeaderboard'); // 'arcadeLeaderboard', 'global', 'mystery', 'promptwars'
  
  // Mystery Hunt State
  const [players, setPlayers] = useState([]);
  const [codes, setCodes] = useState({}); // { level: code }
  
  // Game Requests State
  const [gameRequests, setGameRequests] = useState([]);
  
  // Global State
  const [formUrl, setFormUrl] = useState('');
  const [adminEmails, setAdminEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  
  // Arcade Leaderboard State
  const [arcadeScores, setArcadeScores] = useState([]);
  
  // Prompt Wars State
  const [pwRoundName, setPwRoundName] = useState('');
  const [pwImageUrl, setPwImageUrl] = useState('');
  const [pwOriginalPrompt, setPwOriginalPrompt] = useState('');
  const [pwIsActive, setPwIsActive] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSubmissions, setPwSubmissions] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch Global Config
    const configUnsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists()) {
        setFormUrl(snap.data().formUrl || '');
        if (snap.data().adminEmails) {
          setAdminEmails(snap.data().adminEmails);
        }
      }
      setConfigLoaded(true);
    });

    // Fetch Mystery Hunt Players
    const playersUnsub = onSnapshot(collection(db, 'huntPlayers'), (snap) => {
      const p = [];
      snap.forEach(d => p.push(d.data()));
      setPlayers(p);
    });

    // Fetch Prompt Wars Active Round
    const pwUnsub = onSnapshot(doc(db, 'promptWars', 'activeRound'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPwRoundName(data.roundName || '');
        setPwImageUrl(data.imageUrl || '');
        setPwOriginalPrompt(data.originalPrompt || '');
        setPwIsActive(data.isActive || false);
      }
    });

    // Fetch Arcade Leaderboard
    const arcadeUnsub = onSnapshot(collection(db, 'arcadeScores'), (snap) => {
      const scores = [];
      snap.forEach(d => scores.push({ id: d.id, ...d.data() }));
      setArcadeScores(scores.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)));
    });

    // Fetch Prompt Wars Submissions
    const pwSubsUnsub = onSnapshot(collection(db, 'promptWarsSubmissions'), (snap) => {
      const subs = [];
      snap.forEach(d => subs.push({ id: d.id, ...d.data() }));
      setPwSubmissions(subs.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      }));
    });

    // Fetch Game Requests
    const requestsUnsub = onSnapshot(collection(db, 'gameRequests'), (snap) => {
      const reqs = [];
      snap.forEach(d => reqs.push({ id: d.id, ...d.data() }));
      setGameRequests(reqs.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      }));
    });


    // Fetch Mystery Hunt Codes
    const fetchCodes = async () => {
      try {
        const snap = await getDocs(collection(db, 'levelCodes'));
        const newCodes = {};
        snap.forEach(d => {
          newCodes[d.data().level] = d.id;
        });
        setCodes(newCodes);
      } catch (e) {
        console.error("Failed to fetch codes (are you an admin?)", e);
      }
    };
    fetchCodes();

    return () => {
      configUnsub();
      playersUnsub();
      pwUnsub();
      pwSubsUnsub();
      requestsUnsub();
      arcadeUnsub();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      const msg = e.message.toLowerCase();
      if (msg.includes('closing') || msg.includes('hidden') || msg.includes('network') || msg.includes('cancelled')) {
        import('firebase/auth').then(({ signInWithRedirect }) => {
          signInWithRedirect(auth, googleProvider);
        });
      } else {
        alert("Login failed: " + e.message);
      }
    }
  };

  const handleRestartAll = async () => {
    if (!window.confirm("Are you sure you want to restart the hunt for ALL players? This will reset everyone to level 1.")) return;
    try {
      await setDoc(doc(db, 'huntConfig', 'global'), {
        globalRestartToken: Date.now()
      }, { merge: true });
      alert("Hunt restarted for all players!");
    } catch (e) {
      console.error(e);
      alert("Failed to restart");
    }
  };

  const handleSaveGlobalConfig = async () => {
    setSaving(true);
    try {
      const emailList = adminEmails.map(e => e.trim().toLowerCase()).filter(e => e.length > 0);
      await setDoc(doc(db, 'huntConfig', 'global'), { formUrl, adminEmails: emailList }, { merge: true });
      alert("Global Configuration saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to save. Ensure you have admin privileges.");
    }
    setSaving(false);
  };

  const handleSaveMysteryConfig = async () => {
    setSaving(true);
    try {
      const snap = await getDocs(collection(db, 'levelCodes'));
      const existing = {}; // { level: code }
      snap.forEach(d => { existing[d.data().level] = d.id; });

      for (let i = 1; i <= 10; i++) {
        const newCode = codes[i];
        const oldCode = existing[i];

        if (newCode && newCode !== oldCode) {
          if (oldCode) {
            await deleteDoc(doc(db, 'levelCodes', oldCode));
          }
          await setDoc(doc(db, 'levelCodes', newCode), { level: i });
        }
      }
      alert("Mystery Hunt codes saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to save. Ensure you have admin privileges.");
    }
    setSaving(false);
  };

  const handleSavePromptWars = async () => {
    setPwSaving(true);
    try {
      await setDoc(doc(db, 'promptWars', 'activeRound'), {
        roundName: pwRoundName.trim(),
        imageUrl: pwImageUrl.trim(),
        originalPrompt: pwOriginalPrompt.trim(),
        isActive: pwIsActive,
      }, { merge: true });
      alert("Prompt Wars round saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to save Prompt Wars settings.");
    }
    setPwSaving(false);
  };

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (email && !adminEmails.includes(email)) {
      setAdminEmails([...adminEmails, email]);
      setNewEmail('');
    }
  };

  const handleRemoveEmail = (emailToRemove) => {
    setAdminEmails(adminEmails.filter(e => e !== emailToRemove));
  };

  const handleResetTechQuizScores = async () => {
    if (!window.confirm("Are you sure you want to clear all Tech-O-Fire scores? This cannot be undone.")) return;
    try {
      const snap = await getDocs(collection(db, 'techQuizScores'));
      snap.forEach(async (d) => {
        await deleteDoc(doc(db, 'techQuizScores', d.id));
      });
      alert("Tech-O-Fire scores cleared!");
    } catch (e) {
      console.error(e);
      alert("Failed to clear scores.");
    }
  };

  const handleResetArcadeLeaderboard = async () => {
    if (!window.confirm("DANGER: Are you sure you want to clear the ENTIRE Global Arcade Leaderboard? This will delete all arcade scores and cannot be undone.")) return;
    try {
      const snap = await getDocs(collection(db, 'arcadeScores'));
      snap.forEach(async (d) => {
        await deleteDoc(doc(db, 'arcadeScores', d.id));
      });
      alert("Global Arcade Leaderboard cleared!");
    } catch (e) {
      console.error(e);
      alert("Failed to clear leaderboard.");
    }
  };

  if (loading || !configLoaded) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="w-16 h-16 border-4 border-[#4285F4] border-t-transparent rounded-full animate-spin"></div></div>;

  const isSuperAdmin = user?.email && SUPER_ADMINS.includes(user.email.toLowerCase());
  const isPlaymaker = user?.email && adminEmails.includes(user.email.toLowerCase());
  const hasAccess = isSuperAdmin || isPlaymaker;

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center text-gray-900 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full text-center border border-red-100">
          <div className="bg-red-100 text-red-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} />
          </div>
          <h1 className="text-2xl font-black mb-2">Unauthorized</h1>
          <p className="text-gray-500 mb-8">You do not have permission to access the Super Admin panel.</p>
          <div className="bg-gray-50 p-3 rounded-xl mb-6 text-sm font-mono text-gray-600 flex items-center justify-between">
            <span>Logged in as: {user.email}</span>
            <button 
              onClick={() => { localStorage.clear(); signOut(auth); }} 
              className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold transition-colors text-xs"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active players: lastActive within last 10 minutes
  const activePlayers = players.filter(p => {
    if (!p.lastActive) return false;
    const lastActive = p.lastActive.toDate ? p.lastActive.toDate() : new Date(p.lastActive);
    return (Date.now() - lastActive.getTime()) < 10 * 60 * 1000;
  });

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans pb-12">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto p-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Shield size={28} className="text-[#4285F4]" />
            <h1 className="text-xl font-black uppercase tracking-wide">GDG Arcade Admin</h1>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
            <span className="text-sm font-medium text-gray-600">{user.email}</span>
            <button onClick={() => { localStorage.clear(); signOut(auth); }} className="text-red-500 hover:bg-red-100 p-1.5 rounded-full transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
        
        {/* TABS */}
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex gap-6 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('arcadeLeaderboard')}
              className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'arcadeLeaderboard' ? 'border-[#34A853] text-[#34A853]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
            >
              <Trophy size={18} /> Global Leaderboard
            </button>
            <button 
              onClick={() => setActiveTab('global')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'global' ? 'border-[#4285F4] text-[#4285F4]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
          >
            <Globe size={18} /> Access Control
          </button>
          <button 
            onClick={() => setActiveTab('mystery')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'mystery' ? 'border-[#FBBC04] text-[#FBBC04]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
          >
            <Search size={18} /> Mystery Hunt
          </button>
          <button 
            onClick={() => setActiveTab('promptwars')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'promptwars' ? 'border-[#EA4335] text-[#EA4335]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
          >
            <Brain size={18} /> Prompt Wars
          </button>
          <button 
            onClick={() => setActiveTab('techofire')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'techofire' ? 'border-[#FF6B35] text-[#FF6B35]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
          >
            <Flame size={18} /> Tech-O-Fire
          </button>
          <button 
            onClick={() => setActiveTab('techrecall')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'techrecall' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
          >
            <Power size={18} /> Tech Recall
          </button>
          <button 
            onClick={() => setActiveTab('impostor')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'impostor' ? 'border-purple-500 text-purple-500' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
          >
            <Ghost size={18} /> Guess Impostor
          </button>
          <button 
            onClick={() => setActiveTab('aieye')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'aieye' ? 'border-green-500 text-green-500' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
          >
            <Eye size={18} /> AI Eye
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">

          {/* --- GLOBAL LEADERBOARD TAB --- */}
          {activeTab === 'arcadeLeaderboard' && (
            <div className="space-y-6">
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-6xl">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                  <Trophy className="text-[#34A853]" /> Global Arcade Leaderboard
                </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-100 text-gray-500">
                      <th className="pb-4 font-bold uppercase tracking-wider">Rank</th>
                      <th className="pb-4 font-bold uppercase tracking-wider">Player</th>
                      <th className="pb-4 font-bold uppercase tracking-wider">Total Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arcadeScores.length === 0 ? (
                      <tr><td colSpan="3" className="py-8 text-center text-gray-400">No players on the leaderboard yet.</td></tr>
                    ) : (
                      arcadeScores.map((score, idx) => (
                        <tr key={score.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-4 font-black text-gray-400 text-lg">#{idx + 1}</td>
                          <td className="py-4 font-bold text-gray-800">
                            {score.displayName || 'Anonymous'} <br />
                            <span className="font-normal text-xs text-gray-500">{score.email}</span>
                          </td>
                          <td className="py-4 font-black text-green-500 text-xl">{score.totalScore} pts</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-red-100 max-w-6xl">
              <h2 className="text-xl font-bold mb-4 text-[#EA4335] flex items-center gap-2">
                <AlertTriangle /> Danger Zone
              </h2>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                This will permanently delete all scores from the unified Arcade Leaderboard. Use only when resetting for a new batch of players.
              </p>
              <button 
                onClick={handleResetArcadeLeaderboard}
                className="w-full md:w-auto bg-red-50 text-[#EA4335] font-bold py-3 px-6 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
              >
                Reset Entire Arcade Leaderboard
              </button>
            </div>
          </div>
        )}

        {/* --- GLOBAL SETTINGS TAB --- */}
        {activeTab === 'global' && (
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
              <Settings className="text-[#4285F4]" /> Playermaker Access
            </h2>
            
            <div className="space-y-4 mb-8">
              <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wider">Allowed Playermaker Emails</h3>
              <p className="text-sm text-gray-500">Only these emails can access locked games at the physical stand. Mystery Hunt is open to all.</p>
              
              <div className="flex gap-2 mb-4">
                <input 
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddEmail(); }}
                  className="flex-1 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#4285F4] transition-colors"
                  placeholder="playermaker@example.com"
                />
                <button 
                  onClick={handleAddEmail}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="border-2 border-gray-100 rounded-2xl max-h-64 overflow-y-auto bg-gray-50 p-2 space-y-2">
                {adminEmails.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No emails added yet.</p>
                ) : (
                  adminEmails.map((email, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 px-4 rounded-xl shadow-sm">
                      <span className="font-mono text-gray-700 text-sm">{email}</span>
                      <button 
                        onClick={() => handleRemoveEmail(email)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        title="Remove email"
                      >
                        <LogOut size={16} className="rotate-180" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button 
              onClick={handleSaveGlobalConfig}
              disabled={saving}
              className="w-full bg-[#4285F4] hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 mt-8"
            >
              {saving ? 'Saving...' : 'Save Access Control'}
            </button>
          </div>
        )}


        {/* --- MYSTERY HUNT TAB --- */}
        {activeTab === 'mystery' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-1 space-y-6">
              {/* Stats */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="text-[#FBBC04]" /> Live Stats</h2>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-yellow-50 p-4 rounded-2xl text-center">
                    <div className="text-3xl font-black text-yellow-600">{activePlayers.length}</div>
                    <div className="text-xs font-bold text-yellow-500 uppercase">Active (10m)</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-2xl text-center">
                    <div className="text-3xl font-black text-green-600">{players.filter(p => p.currentLevel > 10).length}</div>
                    <div className="text-xs font-bold text-green-500 uppercase">Winners</div>
                  </div>
                </div>
                
                <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-3">Players per Level</h3>
                <div className="space-y-2">
                  {[...Array(10)].map((_, i) => {
                    const level = i + 1;
                    const count = players.filter(p => p.currentLevel === level).length;
                    return (
                      <div key={level} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-600">Level {level}</span>
                        <span className="bg-gray-100 px-3 py-1 rounded-full text-gray-700 font-bold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-red-100">
                <h2 className="text-xl font-bold mb-4 text-[#EA4335] flex items-center gap-2"><RefreshCw /> Danger Zone</h2>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">Force all currently playing clients to immediately reset back to Level 1. Use carefully.</p>
                <button 
                  onClick={handleRestartAll}
                  className="w-full bg-red-50 text-[#EA4335] font-bold py-4 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                >
                  Restart Hunt for All
                </button>
              </div>
            </div>

            {/* Level Codes */}
            <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                <Search className="text-[#FBBC04]" /> Level Codes Configuration
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {[...Array(10)].map((_, i) => {
                  const level = i + 1;
                  return (
                    <div key={level} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Level {level} Code</label>
                      <input 
                        type="text" 
                        value={codes[level] || ''} 
                        onChange={e => setCodes({...codes, [level]: e.target.value.trim()})}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#FBBC04] transition-colors"
                        placeholder={`Code for Level ${level}`}
                      />
                    </div>
                  );
                })}
              </div>

              <button 
                onClick={handleSaveMysteryConfig}
                disabled={saving}
                className="w-full bg-[#FBBC04] hover:bg-yellow-500 text-gray-900 font-bold py-4 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Mystery Hunt Codes'}
              </button>
            </div>
            
            {/* Active Players Table */}
            <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 mt-2">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                <Users className="text-gray-400" /> Currently Active Hunters
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-100 text-gray-500">
                      <th className="pb-4 font-bold uppercase tracking-wider">Name</th>
                      <th className="pb-4 font-bold uppercase tracking-wider">Email</th>
                      <th className="pb-4 font-bold uppercase tracking-wider text-center">Level</th>
                      <th className="pb-4 font-bold uppercase tracking-wider text-right">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePlayers.length === 0 ? (
                      <tr><td colSpan="4" className="py-8 text-center text-gray-400">No active players right now.</td></tr>
                    ) : (
                      activePlayers.map(p => (
                        <tr key={p.playerId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-4 font-bold text-gray-800">{p.displayName || 'Anonymous'}</td>
                          <td className="py-4 text-gray-500">{p.email || 'N/A'}</td>
                          <td className="py-4 text-center">
                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-black">Lvl {p.currentLevel}</span>
                          </td>
                          <td className="py-4 text-right text-gray-500 font-mono text-xs">
                            {p.lastActive ? new Date(p.lastActive.toDate ? p.lastActive.toDate() : p.lastActive).toLocaleTimeString() : 'Unknown'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- PROMPT WARS TAB --- */}
        {activeTab === 'promptwars' && (
          <div className="space-y-6">
            {/* Prompt Wars Requests Table */}
            {(() => {
              const gameSpecificRequests = gameRequests.filter(req => req.gameId === 'prompt-wars');
              return (
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-6xl">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                    <Brain className="text-red-500" /> Prompt Wars Live Requests
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-100 text-gray-500">
                          <th className="pb-4 font-bold uppercase tracking-wider">Player</th>
                          <th className="pb-4 font-bold uppercase tracking-wider">Status</th>
                          <th className="pb-4 font-bold uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameSpecificRequests.length === 0 ? (
                          <tr><td colSpan="3" className="py-8 text-center text-gray-400">No active game requests for Prompt Wars.</td></tr>
                        ) : (
                          gameSpecificRequests.map(req => (
                            <tr key={req.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="py-4 font-bold text-gray-800">
                                {req.userName || 'Anonymous'} {req.lobbyCode && <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full ml-2 font-mono">Code: {req.lobbyCode}</span>} <br />
                                <span className="font-normal text-xs text-gray-500">{req.userEmail}</span>
                              </td>
                              <td className="py-4">
                                {req.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-black">Pending</span>}
                                {req.status === 'approved' && <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-black">Playing</span>}
                                {req.status === 'completed' && <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-black">Completed</span>}
                              </td>
                              <td className="py-4 text-right flex justify-end gap-2">
                                {req.status === 'pending' && (
                                  <button
                                    onClick={async () => {
                                      await setDoc(doc(db, 'gameRequests', req.id), { status: 'approved' }, { merge: true });
                                    }}
                                    className="bg-[#34A853] hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                    onClick={async () => {
                                      await deleteDoc(doc(db, 'gameRequests', req.id));
                                    }}
                                    className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                                  >
                                    {req.status === 'pending' ? 'Reject' : 'Dismiss'}
                                  </button>
                                </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}


          </div>
        )}

        {/* --- TECH-O-FIRE TAB --- */}
        {activeTab === 'techofire' && (
          <div className="space-y-6">
            {/* Tech-O-Fire Requests Table */}
            {(() => {
              const gameSpecificRequests = gameRequests.filter(req => req.gameId === 'tech-quiz');
              return (
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-6xl">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                    <Flame className="text-orange-500" /> Tech-O-Fire Live Requests
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-100 text-gray-500">
                          <th className="pb-4 font-bold uppercase tracking-wider">Player</th>
                          <th className="pb-4 font-bold uppercase tracking-wider">Status</th>
                          <th className="pb-4 font-bold uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameSpecificRequests.length === 0 ? (
                          <tr><td colSpan="3" className="py-8 text-center text-gray-400">No active game requests for Tech-O-Fire.</td></tr>
                        ) : (
                          gameSpecificRequests.map(req => (
                            <tr key={req.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="py-4 font-bold text-gray-800">
                                {req.userName || 'Anonymous'} {req.lobbyCode && <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full ml-2 font-mono">Code: {req.lobbyCode}</span>} <br />
                                <span className="font-normal text-xs text-gray-500">{req.userEmail}</span>
                              </td>
                              <td className="py-4">
                                {req.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-black">Pending</span>}
                                {req.status === 'approved' && <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-black">Playing</span>}
                                {req.status === 'completed' && <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-black">Completed</span>}
                              </td>
                              <td className="py-4 text-right flex justify-end gap-2">
                                {req.status === 'pending' && (
                                  <button
                                    onClick={async () => {
                                      await setDoc(doc(db, 'gameRequests', req.id), { status: 'approved' }, { merge: true });
                                    }}
                                    className="bg-[#34A853] hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                    onClick={async () => {
                                      await deleteDoc(doc(db, 'gameRequests', req.id));
                                    }}
                                    className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                                  >
                                    {req.status === 'pending' ? 'Reject' : 'Dismiss'}
                                  </button>
                                </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* --- TECH RECALL TAB --- */}
        {activeTab === 'techrecall' && (
          <div className="space-y-6">
            {/* Tech Recall Requests Table */}
            {(() => {
              const gameSpecificRequests = gameRequests.filter(req => req.gameId === 'tech-recall');
              return (
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-6xl">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                    <Power className="text-blue-500" /> Tech Recall Live Requests
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-100 text-gray-500">
                          <th className="pb-4 font-bold uppercase tracking-wider">Player</th>
                          <th className="pb-4 font-bold uppercase tracking-wider">Status</th>
                          <th className="pb-4 font-bold uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameSpecificRequests.length === 0 ? (
                          <tr><td colSpan="3" className="py-8 text-center text-gray-400">No active game requests for Tech Recall.</td></tr>
                        ) : (
                          gameSpecificRequests.map(req => (
                            <tr key={req.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="py-4 font-bold text-gray-800">
                                {req.userName || 'Anonymous'} {req.lobbyCode && <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full ml-2 font-mono">Code: {req.lobbyCode}</span>} <br />
                                <span className="font-normal text-xs text-gray-500">{req.userEmail}</span>
                              </td>
                              <td className="py-4">
                                {req.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-black">Pending</span>}
                                {req.status === 'approved' && <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-black">Playing</span>}
                                {req.status === 'completed' && <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-black">Completed</span>}
                              </td>
                              <td className="py-4 text-right flex justify-end gap-2">
                                {req.status === 'pending' && (
                                  <button
                                    onClick={async () => {
                                      await setDoc(doc(db, 'gameRequests', req.id), { status: 'approved' }, { merge: true });
                                    }}
                                    className="bg-[#34A853] hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                    onClick={async () => {
                                      await deleteDoc(doc(db, 'gameRequests', req.id));
                                    }}
                                    className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                                  >
                                    {req.status === 'pending' ? 'Reject' : 'Dismiss'}
                                  </button>
                                </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* --- GUESS THE IMPOSTOR TAB --- */}
        {activeTab === 'impostor' && (
          <div className="space-y-6">
            {/* Impostor Requests Table */}
            {(() => {
              const gameSpecificRequests = gameRequests.filter(req => req.gameId === 'guess-impostor');
              return (
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-6xl">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                    <Ghost className="text-purple-500" /> Guess The Impostor Live Requests
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-100 text-gray-500">
                          <th className="pb-4 font-bold uppercase tracking-wider">Player</th>
                          <th className="pb-4 font-bold uppercase tracking-wider">Status</th>
                          <th className="pb-4 font-bold uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameSpecificRequests.length === 0 ? (
                          <tr><td colSpan="3" className="py-8 text-center text-gray-400">No active game requests for Guess The Impostor.</td></tr>
                        ) : (
                          gameSpecificRequests.map(req => (
                            <tr key={req.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="py-4 font-bold text-gray-800">
                                {req.userName || 'Anonymous'} {req.lobbyCode && <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full ml-2 font-mono">Code: {req.lobbyCode}</span>} <br />
                                <span className="font-normal text-xs text-gray-500">{req.userEmail}</span>
                              </td>
                              <td className="py-4">
                                {req.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-black">Pending</span>}
                                {req.status === 'approved' && <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-black">Playing</span>}
                                {req.status === 'completed' && <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-black">Completed</span>}
                              </td>
                              <td className="py-4 text-right flex justify-end gap-2">
                                {req.status === 'pending' && (
                                  <button
                                    onClick={async () => {
                                      await setDoc(doc(db, 'gameRequests', req.id), { status: 'approved' }, { merge: true });
                                    }}
                                    className="bg-[#34A853] hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                    onClick={async () => {
                                      await deleteDoc(doc(db, 'gameRequests', req.id));
                                    }}
                                    className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                                  >
                                    {req.status === 'pending' ? 'Reject' : 'Dismiss'}
                                  </button>
                                </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* --- AI EYE TAB --- */}
        {activeTab === 'aieye' && (
          <div className="space-y-6">
            {/* AI Eye Requests Table */}
            {(() => {
              const gameSpecificRequests = gameRequests.filter(req => req.gameId === 'ai-eye');
              return (
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-6xl">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                    <Eye className="text-green-500" /> AI Eye Live Requests
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-100 text-gray-500">
                          <th className="pb-4 font-bold uppercase tracking-wider">Player</th>
                          <th className="pb-4 font-bold uppercase tracking-wider">Status</th>
                          <th className="pb-4 font-bold uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameSpecificRequests.length === 0 ? (
                          <tr><td colSpan="3" className="py-8 text-center text-gray-400">No active game requests for AI Eye.</td></tr>
                        ) : (
                          gameSpecificRequests.map(req => (
                            <tr key={req.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="py-4 font-bold text-gray-800">
                                {req.userName || 'Anonymous'} {req.lobbyCode && <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full ml-2 font-mono">Code: {req.lobbyCode}</span>} <br />
                                <span className="font-normal text-xs text-gray-500">{req.userEmail}</span>
                              </td>
                              <td className="py-4">
                                {req.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-black">Pending</span>}
                                {req.status === 'approved' && <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-black">Playing</span>}
                                {req.status === 'completed' && <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-black">Completed</span>}
                              </td>
                              <td className="py-4 text-right flex justify-end gap-2">
                                {req.status === 'pending' && (
                                  <button
                                    onClick={async () => {
                                      await setDoc(doc(db, 'gameRequests', req.id), { status: 'approved' }, { merge: true });
                                    }}
                                    className="bg-[#34A853] hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                    onClick={async () => {
                                      await deleteDoc(doc(db, 'gameRequests', req.id));
                                    }}
                                    className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                                  >
                                    {req.status === 'pending' ? 'Reject' : 'Dismiss'}
                                  </button>
                                </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
