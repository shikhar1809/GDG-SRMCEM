import React, { useState, useEffect } from 'react';
import { db, auth, googleProvider, storage } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Shield, RefreshCw, LogOut, Users, Settings, Brain, Search, Globe, Power, AlertTriangle, Flame, Ghost, Eye, Trophy, Lightbulb, Unlock, ScrollText, Download, CheckCircle2 } from 'lucide-react';
import { ALL_LEVELS, MEGA_LEVEL, NORMAL_LEVELS, normalizeCode, claimedNormalCount, isMegaLevel, MEGA_LEVEL_POINTS, NORMAL_LEVEL_POINTS } from '../utils/huntConfig';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const SUPER_ADMINS = ['royalshikher@gmail.com', 'i.e.ishantiwari@gmail.com'];

export default function AdminGames() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('arcadeLeaderboard'); // 'arcadeLeaderboard', 'global', 'mystery', 'promptwars'
  
  // Mystery Hunt State
  const [huntPhase, setHuntPhase] = useState('locked');
  const [forceMegaUnlock, setForceMegaUnlock] = useState(false);
  const [players, setPlayers] = useState([]);
  const [huntLevels, setHuntLevels] = useState({}); // { level: {hint, code, formUrl} }
  const [huntTeams, setHuntTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [huntClaims, setHuntClaims] = useState({}); // { level: claim }
  const [mysteryTab, setMysteryTab] = useState('dashboard'); // 'dashboard', 'teams', 'config'
  
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
      snap.forEach(d => p.push({ id: d.id, ...d.data() }));
      setPlayers(p);
    });

    // Fetch Mystery Hunt Phase
    const stateUnsub = onSnapshot(doc(db, 'huntState', 'status'), (snap) => {
      if (snap.exists()) {
        setHuntPhase(snap.data().state || 'locked');
        setForceMegaUnlock(snap.data().forceMegaUnlock || false);
      } else {
        setHuntPhase('locked');
        setForceMegaUnlock(false);
      }
    });

    // Fetch Mystery Hunt Teams
    const teamsUnsub = onSnapshot(collection(db, 'huntTeams'), (snap) => {
      const t = [];
      snap.forEach(d => t.push({ id: d.id, ...d.data() }));
      setHuntTeams(t);
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


    // Mystery Hunt: public level board (hints) + who has claimed what.
    const huntLevelsUnsub = onSnapshot(collection(db, 'huntLevels'), (snap) => {
      setHuntLevels(prev => {
        const next = { ...prev };
        snap.forEach(d => {
          const lvl = Number(d.data().level ?? d.id);
          next[lvl] = { 
            ...next[lvl], 
            ...d.data()
          };
        });
        return next;
      });
    });

    const huntClaimsUnsub = onSnapshot(collection(db, 'huntClaims'), (snap) => {
      const next = {};
      snap.forEach(d => { next[Number(d.data().level ?? d.id)] = { id: d.id, ...d.data() }; });
      setHuntClaims(next);
    });

    // Codes live in huntLevelCodes keyed BY the code, and listing is blocked for
    // players. Admins can list, which is how we recover the current code + form
    // link to show in these boxes.
    const fetchHuntCodes = async () => {
      try {
        const snap = await getDocs(collection(db, 'huntLevelCodes'));
        setHuntLevels(prev => {
          const next = { ...prev };
          snap.forEach(d => {
            const lvl = Number(d.data().level);
            next[lvl] = { ...next[lvl], code: d.id, formUrl: d.data().formUrl || '' };
          });
          return next;
        });
      } catch (e) {
        console.error("Failed to fetch hunt codes (are you an admin?)", e);
      }
    };
    fetchHuntCodes();

    return () => {
      configUnsub();
      playersUnsub();
      pwUnsub();
      pwSubsUnsub();
      requestsUnsub();
      arcadeUnsub();
      huntLevelsUnsub();
      huntClaimsUnsub();
      teamsUnsub();
      stateUnsub();
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

  // Wipes every claim so all levels reopen. Clues, codes and form links are
  // kept - this resets the race, not the configuration.
  const handleRestartAll = async () => {
    const claimed = Object.keys(huntClaims).length;
    if (
      !window.confirm(
        `Reopen ALL hunt levels? This deletes ${claimed} claim(s), so every level goes back up for grabs and the Mega Level re-locks. Clues and codes are kept.`
      )
    )
      return;
    try {
      // For each claim, deduct points from the team
      for (const level of Object.keys(huntClaims)) {
        const claim = huntClaims[level];
        if (claim && claim.teamId) {
          const pts = isMegaLevel(Number(level)) ? MEGA_LEVEL_POINTS : NORMAL_LEVEL_POINTS;
          await updateDoc(doc(db, 'huntTeams', claim.teamId), { score: increment(-pts) }).catch(() => {});
        }
      }
      await Promise.all(
        Object.keys(huntClaims).map((level) => deleteDoc(doc(db, 'huntClaims', String(level))))
      );
      alert('All levels reopened.');
    } catch (e) {
      console.error(e);
      alert('Failed to reset the hunt. Ensure you have admin privileges.');
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

  const setHuntField = (level, field, value) =>
    setHuntLevels(prev => ({ ...prev, [level]: { ...prev[level], [field]: value } }));

  const validateGameStart = () => {
    let missingLog = [];
    for (const level of ALL_LEVELS) {
      const cfg = huntLevels[level] || {};
      const missing = [];
      if (!(cfg.hint1 || '').trim()) missing.push("Hint 1 Text");
      if (!(cfg.hint2 || '').trim()) missing.push("Hint 2 Text");
      if (!(cfg.hint3 || '').trim()) missing.push("Hint 3 Text");
      if (!cfg.hintImage3) missing.push("Hint 3 Image");

      if (missing.length > 0) {
        missingLog.push(`Level ${level}: ${missing.join(', ')}`);
      }
    }
    
    if (missingLog.length > 0) {
      return window.confirm(
        `WARNING: Some levels are not fully configured!\n\n${missingLog.join('\n')}\n\nDo you want to continue to this phase anyway?`
      );
    }
    return true;
  };

  const generateHuntReportPDF = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.text("GDG Arcade - Mystery Hunt Final Report", 14, 22);
      
      doc.setFontSize(14);
      doc.text("Level Claims (First to crack)", 14, 32);
      
      const claimsData = Object.keys(huntClaims).sort((a,b) => Number(a)-Number(b)).map(level => {
        const claim = huntClaims[level];
        const dateStr = claim.claimedAt?.toDate ? claim.claimedAt.toDate().toLocaleString() : "Unknown";
        return [
          level == 10 ? '10 (MEGA)' : level,
          claim.teamName || "N/A",
          claim.playerName || claim.displayName || "N/A",
          claim.code || "N/A",
          dateStr
        ];
      });

      doc.autoTable({
        startY: 38,
        head: [['Level', 'Team', 'Player', 'Secret Code Used', 'Time']],
        body: claimsData,
        theme: 'grid',
        headStyles: { fillColor: [66, 133, 244] },
      });
      
      // Use previousAutoTable or default fallback
      let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || (doc.autoTable && doc.autoTable.previous && doc.autoTable.previous.finalY) || 150;
      finalY += 15;
      
      // Check if we need a new page
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }
      
      doc.setFontSize(14);
      doc.text("Team Details", 14, finalY);
      
      const teamDetails = huntTeams.map(t => {
        const teamPlayers = players.filter(p => p.teamId === t.id);
        const playerNames = teamPlayers.map(p => p.displayName).join(", ");
        const playerEmails = teamPlayers.map(p => p.email).join(", ");
        
        return [
          t.name,
          t.passcode || "N/A",
          t.score || 0,
          playerNames,
          playerEmails
        ];
      });
      
      doc.autoTable({
        startY: finalY + 6,
        head: [['Team Name', 'Passcode', 'Score', 'Players', 'Emails']],
        body: teamDetails,
        theme: 'grid',
        headStyles: { fillColor: [52, 168, 83] },
        styles: { cellWidth: 'wrap' },
        columnStyles: {
          3: { cellWidth: 40 },
          4: { cellWidth: 50 }
        }
      });
      
      doc.save(`MysteryHunt_Final_Report_${Date.now()}.pdf`);
    } catch (e) {
      console.error("PDF Generation Error:", e);
      alert("Failed to generate PDF. Check console for details.");
    }
  };

  const handleCompleteHunt = async () => {
    if (!window.confirm("Are you SURE you want to complete the hunt? This will download the final report and PERMANENTLY ERASE all teams, players, and claims from the database for the next event!")) return;
    
    // 1. Generate Report
    generateHuntReportPDF();

    // 2. Reset the Hunt Data
    try {
      // Clear claims
      const claimsSnap = await getDocs(collection(db, 'huntClaims'));
      claimsSnap.forEach(async (d) => await deleteDoc(doc(db, 'huntClaims', d.id)));
      
      // Clear teams
      const teamsSnap = await getDocs(collection(db, 'huntTeams'));
      teamsSnap.forEach(async (d) => await deleteDoc(doc(db, 'huntTeams', d.id)));

      // Clear players
      const playersSnap = await getDocs(collection(db, 'huntPlayers'));
      playersSnap.forEach(async (d) => await deleteDoc(doc(db, 'huntPlayers', d.id)));

      // Reset Phase
      await setDoc(doc(db, 'huntState', 'status'), { state: 'locked' }, { merge: true });

      alert("Hunt completed and reset successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to reset hunt data.");
    }
  };

  const handleImageUpload = async (level, hintIndex, file) => {
    if (!file) return;
    const storageRef = ref(storage, `mystery_hunt_hints/level${level}_hint${hintIndex}_${Date.now()}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {},
      (error) => {
        console.error("Upload failed", error);
        alert("Failed to upload image.");
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setHuntField(level, `hintImage${hintIndex}`, downloadURL);
      }
    );
  };

  const handleSaveMysteryConfig = async () => {
    // Duplicate secret code validation
    const codeCounts = {};
    for (const level of ALL_LEVELS) {
      const code = normalizeCode(huntLevels[level]?.code || '');
      if (code) {
        codeCounts[code] = (codeCounts[code] || 0) + 1;
      }
    }
    const duplicates = Object.keys(codeCounts).filter(k => codeCounts[k] > 1);
    if (duplicates.length > 0) {
      alert(`Duplicate secret codes found: ${duplicates.join(', ')}. Each level must have a unique secret code.`);
      return;
    }

    setSaving(true);
    try {
      // Existing code docs, so a changed code deletes the old one instead of
      // leaving a second working code behind.
      const snap = await getDocs(collection(db, 'huntLevelCodes'));
      const existingByLevel = {};
      snap.forEach(d => { existingByLevel[Number(d.data().level)] = d.id; });

      for (const level of ALL_LEVELS) {
        const cfg = huntLevels[level] || {};
        const hint = (cfg.hint || '').trim();
        const activeHintLevel = cfg.activeHintLevel || 1;
        const hint1 = (cfg.hint1 || '').trim();
        const hint2 = (cfg.hint2 || '').trim();
        const hint3 = (cfg.hint3 || '').trim();
        const hintImage1 = cfg.hintImage1 || null;
        const hintImage2 = cfg.hintImage2 || null;
        const hintImage3 = cfg.hintImage3 || null;
        
        const code = normalizeCode(cfg.code || '');
        const formUrl = (cfg.formUrl || '').trim();

        // Public board doc: hints only. Never the code or the form link.
        await setDoc(doc(db, 'huntLevels', String(level)), {
          level,
          hint,
          activeHintLevel,
          hint1,
          hint2,
          hint3,
          hintImage1,
          hintImage2,
          hintImage3,
          isMega: level === MEGA_LEVEL,
        }, { merge: true });

        const oldCode = existingByLevel[level];
        if (!code) {
          if (oldCode) await deleteDoc(doc(db, 'huntLevelCodes', oldCode));
          continue;
        }
        if (oldCode && oldCode !== code) {
          await deleteDoc(doc(db, 'huntLevelCodes', oldCode));
        }
        await setDoc(doc(db, 'huntLevelCodes', code), { level, formUrl });
      }
      alert("Mystery Hunt configuration saved.");
    } catch (e) {
      console.error(e);
      alert("Failed to save. Ensure you have admin privileges.");
    }
    setSaving(false);
  };

  const handleReleaseLevel = async (level) => {
    const claim = huntClaims[level];
    if (!claim) return;
    if (!window.confirm(`Release Level ${level}? ${claim.displayName || 'The current winner'} will lose the claim and the level reopens for everyone.`)) return;
    try {
      if (claim.teamId) {
        const pts = isMegaLevel(Number(level)) ? MEGA_LEVEL_POINTS : NORMAL_LEVEL_POINTS;
        await updateDoc(doc(db, 'huntTeams', claim.teamId), { score: increment(-pts) }).catch(() => {});
      }
      await deleteDoc(doc(db, 'huntClaims', String(level)));
    } catch (e) {
      console.error(e);
      alert("Failed to release the level.");
    }
  };

  const handleExportPDF = () => {
    const docPdf = new jsPDF();
    docPdf.text("GDG SRMCEM Mystery Hunt - Full Report", 14, 15);
    
    const tableColumn = ["Team", "DQ", "Score", "Level", "Claimed By", "Email", "Time"];
    const tableRows = [];

    Object.values(huntClaims)
      .sort((a,b) => {
        const timeA = a.claimedAt?.toMillis ? a.claimedAt.toMillis() : (a.claimedAt || 0);
        const timeB = b.claimedAt?.toMillis ? b.claimedAt.toMillis() : (b.claimedAt || 0);
        return timeB - timeA; // latest first
      })
      .forEach(claim => {
        const team = huntTeams.find(t => t.id === claim.teamId);
        const teamName = team ? team.name : claim.teamName;
        const dq = team?.disqualified ? 'Yes' : 'No';
        const score = team?.score || 0;
        const time = claim.claimedAt ? new Date(claim.claimedAt.toDate ? claim.claimedAt.toDate() : claim.claimedAt).toLocaleString() : 'N/A';
        
        tableRows.push([
          teamName,
          dq,
          score,
          claim.level,
          claim.playerName || claim.displayName,
          claim.email,
          time
        ]);
    });

    docPdf.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 133, 244] }
    });
    
    docPdf.save(`mystery_hunt_report_${Date.now()}.pdf`);
  };

  const handleCreateTeam = async () => {
    const tName = newTeamName.trim();
    if (!tName) return;
    const passcode = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
    try {
      // Use team name as ID for easier lookup, sanitize it
      const safeId = tName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      await setDoc(doc(db, 'huntTeams', safeId), {
        name: tName,
        passcode,
        score: 0,
        disqualified: false,
        createdAt: serverTimestamp()
      });
      setNewTeamName('');
    } catch (e) {
      console.error(e);
      alert("Failed to create team.");
    }
  };

  const handleDisqualifyTeam = async (teamId) => {
    if (!window.confirm(`Disqualify this team? All members will be instantly kicked to the home page.`)) return;
    try {
      await updateDoc(doc(db, 'huntTeams', teamId), { disqualified: true });
      alert("Team disqualified!");
    } catch (e) {
      console.error(e);
      alert("Failed to disqualify team.");
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm("Delete this team?")) return;
    try {
      await deleteDoc(doc(db, 'huntTeams', teamId));
    } catch (e) {
      console.error(e);
      alert("Failed to delete team.");
    }
  };

  const handleSendBroadcast = async () => {
    const msg = broadcastMsg.trim();
    if (!msg) return;
    try {
      await setDoc(doc(db, 'huntBroadcasts', Date.now().toString()), {
        message: msg,
        timestamp: serverTimestamp()
      });
      setBroadcastMsg('');
      alert("Broadcast sent!");
    } catch (e) {
      console.error(e);
      alert("Failed to send broadcast.");
    }
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
    if (!window.confirm(
      "DANGER: This will permanently delete ALL arcade scores AND all per-game scores (Tech Recall, Tech Quiz, Prompt Wars, AI Eye, Guess Impostor, Game Requests).\n\nScores cannot be recovered. Continue?"
    )) return;

    // Per-game collections write back into arcadeScores via updateArcadeScore,
    // so they MUST be cleared too or the leaderboard refills on next replay.
    const SCORE_COLLECTIONS = [
      'arcadeScores',
      'techRecallScores',
      'techQuizScores',
      'promptWarsSubmissions',
      'aiEyeScores',
      'guessImpostorScores',
      'gameRequests',
    ];

    try {
      for (const col of SCORE_COLLECTIONS) {
        const snap = await getDocs(collection(db, col));
        await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, col, d.id))));
      }
      alert("Leaderboard and all per-game scores cleared!");
    } catch (e) {
      console.error(e);
      alert("Failed to clear scores: " + e.message);
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
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                    <Trophy className="text-[#34A853]" /> Global Arcade Leaderboard
                  </h2>
                  <span className="text-sm text-gray-500 font-medium bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
                    {arcadeScores.length} player{arcadeScores.length !== 1 ? 's' : ''} registered
                  </span>
                </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="pb-4 font-bold uppercase tracking-wider text-gray-400 text-xs">Rank</th>
                      <th className="pb-4 font-bold uppercase tracking-wider text-gray-400 text-xs">Player</th>
                      <th className="pb-4 font-bold uppercase tracking-wider text-orange-400 text-xs">Tech-O-Fire</th>
                      <th className="pb-4 font-bold uppercase tracking-wider text-blue-400 text-xs">Tech Recall</th>
                      <th className="pb-4 font-bold uppercase tracking-wider text-red-400 text-xs">Prompt Wars</th>
                      <th className="pb-4 font-bold uppercase tracking-wider text-green-400 text-xs">AI Eye</th>
                      <th className="pb-4 font-bold uppercase tracking-wider text-purple-400 text-xs">Impostor</th>
                      <th className="pb-4 font-bold uppercase tracking-wider text-gray-700 text-xs text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arcadeScores.length === 0 ? (
                      <tr><td colSpan="8" className="py-8 text-center text-gray-400">No players on the leaderboard yet.</td></tr>
                    ) : (
                      arcadeScores.map((score, idx) => {
                        const gameScore = (gid) => score[`played_${gid}`] ? (score[`score_${gid}`] || 0) : null;
                        const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
                        const rankBg = ['bg-yellow-50', 'bg-gray-50', 'bg-orange-50'];

                        const ScoreCell = ({ gid, color }) => {
                          const pts = gameScore(gid);
                          if (pts === null) return <td className="py-4 text-center text-gray-200 font-medium">—</td>;
                          return (
                            <td className="py-4 text-center">
                              <span className={`font-black text-base ${color}`}>{pts}</span>
                              <span className="text-gray-400 text-xs"> pts</span>
                            </td>
                          );
                        };

                        return (
                        <tr key={score.id} className={`border-b border-gray-50 last:border-0 transition-colors ${idx < 3 ? rankBg[idx] + ' hover:brightness-95' : 'hover:bg-gray-50'}`}>
                          <td className="py-4 pl-2">
                            <span className={`font-black text-xl ${idx < 3 ? rankColors[idx] : 'text-gray-300'}`}>
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                            </span>
                          </td>
                          <td className="py-4 font-bold text-gray-800">
                            {score.displayName || 'Anonymous'} <br />
                            <span className="font-normal text-xs text-gray-400">{score.email}</span>
                          </td>
                          <ScoreCell gid="tech-quiz" color="text-orange-500" />
                          <ScoreCell gid="tech-recall" color="text-blue-500" />
                          <ScoreCell gid="prompt-wars" color="text-red-500" />
                          <ScoreCell gid="ai-eye" color="text-green-500" />
                          <ScoreCell gid="guess-impostor" color="text-purple-500" />
                          <td className="py-4 text-right pr-2">
                            <span className={`font-black text-xl ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-500' : idx === 2 ? 'text-amber-600' : 'text-gray-700'}`}>
                              {score.totalScore}
                            </span>
                            <span className="text-gray-400 text-xs"> pts</span>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-blue-100 max-w-6xl">
              <h2 className="text-xl font-bold mb-4 text-[#4285F4] flex items-center gap-2">
                🧹 Bulk Cleanup
              </h2>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Remove all <strong>completed</strong> game requests in one click. Pending and approved requests are unaffected.
              </p>
              <button
                onClick={async () => {
                  const completed = gameRequests.filter(r => r.status === 'completed');
                  if (completed.length === 0) { alert('No completed requests to dismiss.'); return; }
                  if (!window.confirm(`Dismiss ${completed.length} completed request(s)?`)) return;
                  try {
                    await Promise.all(completed.map(r => deleteDoc(doc(db, 'gameRequests', r.id))));
                    alert(`${completed.length} completed requests dismissed.`);
                  } catch (e) {
                    alert('Failed: ' + e.message);
                  }
                }}
                className="w-full md:w-auto bg-blue-50 text-[#4285F4] font-bold py-3 px-6 rounded-xl hover:bg-blue-100 transition-colors border border-blue-200"
              >
                Dismiss All Completed Requests ({gameRequests.filter(r => r.status === 'completed').length})
              </button>
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
          <div className="space-y-6 max-w-6xl">
            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
              <button 
                onClick={() => setMysteryTab('dashboard')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${mysteryTab === 'dashboard' ? 'bg-[#4285F4] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setMysteryTab('teams')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${mysteryTab === 'teams' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                Teams Management
              </button>
              <button 
                onClick={() => setMysteryTab('config')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${mysteryTab === 'config' ? 'bg-[#FBBC04] text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                Level Configuration
              </button>
            </div>

            {/* Sub-tab: Dashboard */}
            {mysteryTab === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  {/* Game Phase Control */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-orange-100">
                <h2 className="text-xl font-bold mb-4 text-orange-600 flex items-center gap-2">🕹️ Game Phase</h2>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => setDoc(doc(db, 'huntState', 'status'), { state: 'locked' }, { merge: true })}
                    className={`p-3 rounded-xl font-bold text-sm text-left transition-colors flex justify-between items-center ${huntPhase === 'locked' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                  >
                    <span>1. Locked (Default)</span>
                    {huntPhase === 'locked' && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                  </button>
                  <button 
                    onClick={() => setDoc(doc(db, 'huntState', 'status'), { state: 'onboarding' }, { merge: true })}
                    className={`p-3 rounded-xl font-bold text-sm text-left transition-colors flex justify-between items-center ${huntPhase === 'onboarding' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                  >
                    <span>2. Onboarding (Join Teams)</span>
                    {huntPhase === 'onboarding' && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                  </button>
                  <button 
                    onClick={() => {
                      if (!validateGameStart()) return;
                      setDoc(doc(db, 'huntState', 'status'), { state: 'playing' }, { merge: true });
                    }}
                    className={`p-3 rounded-xl font-bold text-sm text-left transition-colors flex justify-between items-center ${huntPhase === 'playing' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                  >
                    <span>3. Playing (Game Live)</span>
                    {huntPhase === 'playing' && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                  </button>
                  <button 
                    onClick={async () => {
                      if (!validateGameStart()) return;
                      await setDoc(doc(db, 'huntState', 'status'), { state: 'level10' }, { merge: true });
                      await setDoc(doc(db, 'huntBroadcasts', Date.now().toString()), {
                        message: `The MEGA LEVEL has now been launched!`,
                        timestamp: serverTimestamp()
                      });
                    }}
                    className={`p-3 rounded-xl font-bold text-sm text-left transition-colors flex justify-between items-center ${huntPhase === 'level10' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                  >
                    <span>4. Mega Level (Level 10 Live)</span>
                    {huntPhase === 'level10' && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                  </button>
                  <button 
                    onClick={async () => {
                      if (window.confirm("Are you sure you want to end the game? This will lock the board for all players.")) {
                        await setDoc(doc(db, 'huntState', 'status'), { state: 'ended' }, { merge: true });
                      }
                    }}
                    className={`p-3 rounded-xl font-bold text-sm text-left transition-colors flex justify-between items-center ${huntPhase === 'ended' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                  >
                    <span>5. Ended (Game Over)</span>
                    {huntPhase === 'ended' && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                  </button>
                  {huntPhase === 'ended' && (
                    <button 
                      onClick={handleCompleteHunt}
                      className="mt-4 w-full p-3 bg-gray-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors shadow-sm"
                    >
                      <Download size={18} /> Complete Hunt & Download Report
                    </button>
                  )}
                </div>
              </div>
                  
                  {/* Broadcasts */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100">
                <h2 className="text-xl font-bold mb-4 text-[#4285F4] flex items-center gap-2">📢 Broadcast Message</h2>
                <div className="flex flex-col gap-3">
                  <textarea
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    rows={2}
                    placeholder="Send a live alert to all players..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#4285F4] transition-colors resize-none"
                  />
                  <button 
                    onClick={handleSendBroadcast}
                    className="bg-[#4285F4] hover:bg-blue-600 text-white font-bold py-2 rounded-xl transition-colors text-sm"
                  >
                    Send to Everyone
                  </button>
                </div>
              </div>
                </div>
                <div className="lg:col-span-2 space-y-6">
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
                <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-3">Hunt Progress</h3>
                <div className="bg-gray-100 rounded-full h-4 w-full overflow-hidden mb-2 relative">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(claimedNormalCount(huntClaims) / NORMAL_LEVELS) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-gray-800 mix-blend-overlay">
                    {claimedNormalCount(huntClaims)} / {NORMAL_LEVELS} Claimed
                  </div>
                </div>
                
                <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider mt-6 mb-3">Top Teams</h3>
                <div className="space-y-2">
                  {[...huntTeams]
                    .filter(t => !t.disqualified)
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .slice(0, 5)
                    .map((team, idx) => (
                    <div key={team.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className={`font-black w-4 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-gray-300'}`}>#{idx + 1}</span>
                        <span className="font-bold text-gray-700">{team.name}</span>
                      </div>
                      <span className="bg-white border border-gray-100 px-3 py-1 rounded-full text-purple-700 font-black text-xs shadow-sm">{team.score || 0} pts</span>
                    </div>
                  ))}
                  {huntTeams.filter(t => !t.disqualified).length === 0 && (
                    <div className="text-sm text-gray-400 text-center py-2">No teams yet.</div>
                  )}
                </div>
              </div>
                </div>
              </div>
            )}

            {/* Sub-tab: Teams Management */}
            {mysteryTab === 'teams' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-1">
                  {/* Team Management */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-100">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-purple-600 flex items-center gap-2"><Users /> Teams</h2>
                  <button onClick={handleExportPDF} className="text-xs font-bold bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm">
                    <Download size={14} /> Export Report (PDF)
                  </button>
                </div>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g. Team Alpha"
                    className="flex-1 border-2 border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-purple-500"
                  />
                  <button 
                    onClick={handleCreateTeam}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded-xl font-bold text-sm"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {huntTeams.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No teams created yet.</p>
                  ) : (
                    [...huntTeams].sort((a, b) => (b.score || 0) - (a.score || 0)).map((team, idx) => {
                      const crackedLevels = Object.values(huntClaims)
                        .filter(c => c.teamId === team.id)
                        .map(c => c.level)
                        .sort((a, b) => a - b);
                        
                      return (
                      <div key={team.id} className="flex flex-col bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 font-black text-xs w-3">{idx + 1}</span>
                            <div>
                              <div className="font-bold text-gray-800 text-sm">{team.name}</div>
                              <div className="text-[10px] text-gray-500 font-mono tracking-widest mt-0.5">CODE: {team.passcode}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {team.disqualified && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded uppercase">DQ</span>}
                            <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{team.score || 0} pts</span>
                            {!team.disqualified && (
                              <button onClick={() => handleDisqualifyTeam(team.id)} className="text-red-600 bg-red-100 hover:bg-red-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ml-1">
                                Disqualify
                              </button>
                            )}
                            <button onClick={() => handleDeleteTeam(team.id)} className="text-red-400 hover:text-red-600 p-1">
                              <LogOut size={14} />
                            </button>
                          </div>
                        </div>
                        {crackedLevels.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2 pl-5">
                            <span className="text-[10px] uppercase font-bold text-gray-400 mr-1 self-center">Cracked:</span>
                            {crackedLevels.map(lvl => (
                              <span key={lvl} className={`text-[10px] font-black px-1.5 py-0.5 rounded ${lvl === MEGA_LEVEL ? 'bg-yellow-200 text-yellow-800' : 'bg-emerald-100 text-emerald-700'}`}>
                                L{lvl}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 pl-5 border-t border-gray-100 pt-2 space-y-2">
                          {players.filter(p => p.teamId === team.id).length === 0 ? (
                            <div className="text-[10px] text-gray-400 italic">No players joined yet.</div>
                          ) : (
                            players.filter(p => p.teamId === team.id).map(p => {
                              const pClaims = Object.values(huntClaims).filter(c => c.teamId === team.id && (c.uid === p.id || c.email === p.email));
                              const lastActiveStr = p.lastActive ? new Date(p.lastActive.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown';
                              return (
                                <div key={p.id} className="flex flex-col text-[10px] bg-white p-2 rounded border border-gray-100">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="font-bold text-gray-700">{p.displayName}</div>
                                      <div className="text-gray-400">{p.email}</div>
                                    </div>
                                    <div className="text-gray-400 text-right">
                                      Active: {lastActiveStr}
                                    </div>
                                  </div>
                                  {pClaims.length > 0 && (
                                    <div className="mt-1 flex flex-col gap-0.5 border-t border-gray-50 pt-1">
                                      {pClaims.map(c => (
                                        <div key={c.level} className="flex justify-between text-gray-500">
                                          <span>Cracked L{c.level}</span>
                                          <span>{c.claimedAt ? new Date(c.claimedAt.toDate()).toLocaleTimeString() : ''}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )})
                  )}
                </div>
              </div>
                </div>
                <div className="lg:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center h-fit mt-6">
                  <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-4">
                    <Users size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Team Rules</h3>
                  <p className="text-gray-500 text-sm max-w-xs">
                    Teams can have a maximum of 3 members. Players join via the 4-digit passcode generated here. The points scored by any team member are awarded to the entire team.
                  </p>
                </div>
              </div>
            )}

            {/* Sub-tab: Level Configuration */}
            {mysteryTab === 'config' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  {/* Per-level hint / code / form configuration */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                  <Search className="text-[#FBBC04]" /> Hunt Levels
                </h2>
                <span className="text-sm font-bold bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full">
                  {claimedNormalCount(huntClaims)}/{NORMAL_LEVELS} claimed
                  {claimedNormalCount(huntClaims) >= NORMAL_LEVELS && ' — MEGA UNLOCKED'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                All {NORMAL_LEVELS} levels are open to players at once and each has exactly one winner.
                The clue is public; the code and form link stay hidden until someone cracks the level.
                Level {MEGA_LEVEL} stays sealed until all {NORMAL_LEVELS} are claimed.
              </p>

              <div className="space-y-4 mb-8">
                {ALL_LEVELS.map((level) => {
                  const cfg = huntLevels[level] || {};
                  const claim = huntClaims[level];
                  const mega = level === MEGA_LEVEL;
                  return (
                    <div
                      key={level}
                      className={`p-4 rounded-2xl border ${mega ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'}`}
                    >
                      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                        <span className="font-black text-gray-800">
                          {mega ? `MEGA — Level ${level}` : `Level ${level}`}
                        </span>
                        {claim ? (
                          <span className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                              Won by {claim.displayName || claim.email}
                            </span>
                            <button
                              onClick={() => handleReleaseLevel(level)}
                              className="text-xs font-bold bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full inline-flex items-center gap-1"
                            >
                              <Unlock size={12} /> Release
                            </button>
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                            Open
                          </span>
                        )}
                      </div>

                      <div className="space-y-3 mb-4">
                        {[1, 2, 3].map(hl => (
                          <div key={hl} className={`p-3 rounded-xl border ${cfg.activeHintLevel === hl ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <Lightbulb size={11} /> Hint Level {hl} 
                                {cfg.activeHintLevel === hl && <span className="ml-1 text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded text-[9px]">ACTIVE</span>}
                              </label>
                              <button
                                onClick={async () => {
                                  await setDoc(doc(db, 'huntLevels', String(level)), {
                                    hint: cfg[`hint${hl}`] || '',
                                    activeHintLevel: hl,
                                    hint1: cfg.hint1 || '',
                                    hint2: cfg.hint2 || '',
                                    hint3: cfg.hint3 || '',
                                    hintImage3: cfg.hintImage3 || null,
                                  }, { merge: true });
                                  await setDoc(doc(db, 'huntBroadcasts', Date.now().toString()), {
                                    message: `Hint Level ${hl} dropped for ${mega ? 'the MEGA LEVEL' : `Level ${level}`}!`,
                                    timestamp: serverTimestamp()
                                  });
                                }}
                                className={`text-[10px] font-bold py-1 px-3 rounded-lg transition-colors uppercase tracking-wide ${cfg.activeHintLevel === hl ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
                                disabled={cfg.activeHintLevel === hl}
                              >
                                Activate & Broadcast
                              </button>
                            </div>
                            <textarea
                              value={cfg[`hint${hl}`] || ''}
                              onChange={(e) => setHuntField(level, `hint${hl}`, e.target.value)}
                              rows={2}
                              placeholder={`Type Hint Level ${hl} text here...`}
                              className={`w-full border rounded-lg p-2 text-sm focus:outline-none transition-colors resize-none mb-2 ${cfg.activeHintLevel === hl ? 'border-blue-300 bg-blue-50/50 focus:border-blue-500 text-blue-900' : 'border-gray-200 focus:border-[#4285F4]'}`}
                            />
                            {hl === 3 && (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(level, hl, e.target.files[0])}
                                    className="text-[10px] w-full max-w-[200px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                                  />
                                  {cfg[`hintImage${hl}`] && (
                                    <a href={cfg[`hintImage${hl}`]} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline ml-2 whitespace-nowrap">
                                      View Image
                                    </a>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-gray-400">OR</span>
                                  <div className="flex-1 relative flex items-center">
                                    <input 
                                      type="url"
                                      value={cfg[`hintImage${hl}`] || ''}
                                      onChange={(e) => setHuntField(level, `hintImage${hl}`, e.target.value)}
                                      placeholder="Paste an Image URL instead..."
                                      className={`w-full border rounded p-1.5 text-xs focus:outline-none focus:border-[#4285F4] pr-8 ${cfg[`hintImage${hl}`] ? 'border-green-400 bg-green-50 text-green-900' : 'border-gray-200'}`}
                                    />
                                    {cfg[`hintImage${hl}`] && (
                                      <div className="absolute right-2 text-green-500" title="Image URL loaded">
                                        <CheckCircle2 size={16} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
                            Secret code (on the QR)
                          </label>
                          <input
                            type="text"
                            value={cfg.code || ''}
                            onChange={(e) => setHuntField(level, 'code', e.target.value.toUpperCase())}
                            placeholder="e.g. GDG7X2"
                            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-mono tracking-widest focus:outline-none focus:border-[#FBBC04] transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">
                            Google Form link
                          </label>
                          <input
                            type="url"
                            value={cfg.formUrl || ''}
                            onChange={(e) => setHuntField(level, 'formUrl', e.target.value)}
                            placeholder="https://forms.gle/..."
                            className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#FBBC04] transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleSaveMysteryConfig}
                disabled={saving}
                className="w-full bg-[#FBBC04] hover:bg-yellow-500 text-gray-900 font-bold py-4 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save All Hunt Levels'}
              </button>
            </div>
                </div>
                <div className="lg:col-span-1 space-y-6">
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
              </div>
            )}
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
