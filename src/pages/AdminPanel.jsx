import React, { useState, useEffect } from 'react';
import { db, auth, storage } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, updateDoc, collectionGroup, query, where, getDocs, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Shield, Lock, Unlock, Upload, Users, FileText, Image as ImageIcon, AlertTriangle, Globe, Download, Calendar } from 'lucide-react';
import { badgeBgBase64 } from '../utils/badgeBgBase64';
import LoadingScreen from '../components/LoadingScreen';
import { useMinLoadTime } from '../hooks/useMinLoadTime';

const googleProvider = new GoogleAuthProvider();
const SUPER_ADMINS = ['royalshikher@gmail.com', 'i.e.ishantiwari@gmail.com'];

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const downloadAdminBadge = (badge, name) => {
  const safeName = escapeXml(name || 'GDG Player');
  const bgImage = badge?.bgUrl ? badge.bgUrl : `data:image/jpeg;base64,${badgeBgBase64}`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1024 1024">
  <image href="${bgImage}" x="0" y="0" width="1024" height="1024" preserveAspectRatio="xMidYMid slice" />
  <rect x="230" y="695" width="564" height="110" rx="30" fill="#ffffff" />
  <text x="512" y="765" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="52" font-weight="800" letter-spacing="2">${safeName.toUpperCase()}</text>
</svg>`.trim();

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${badge.id}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.svg`;
  link.click();
  URL.revokeObjectURL(url);
};

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);
  const displayLoading = useMinLoadTime(loading || (!configLoaded && user), 3000);
  const [adminEmails, setAdminEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [credentials, setCredentials] = useState([]);
  const [credTitle, setCredTitle] = useState('');
  const [credSubtitle, setCredSubtitle] = useState('');
  const [credFile, setCredFile] = useState(null);
  const [credUploading, setCredUploading] = useState(false);

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [viewingLogsFor, setViewingLogsFor] = useState(null);

  const [generatingBadgeFor, setGeneratingBadgeFor] = useState(null);
  const [manualName, setManualName] = useState('');

  const [eventsCatalog, setEventsCatalog] = useState([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLink, setNewEventLink] = useState('');
  const [newEventImageLink, setNewEventImageLink] = useState('');

  const loadLogsForCred = async (cred) => {
    setViewingLogsFor(cred);
    setLogsLoading(true);
    setLogsError(null);
    try {
      const q = query(collectionGroup(db, 'badges'), where('badgeId', '==', cred.id));
      const snap = await getDocs(q);
      const fetchedLogs = [];
      snap.forEach(d => fetchedLogs.push(d.data()));
      // Sort by date claimed (newest first)
      fetchedLogs.sort((a, b) => (b.claimedAt?.seconds || 0) - (a.claimedAt?.seconds || 0));
      setLogs(fetchedLogs);
    } catch (e) {
      console.error('Logs query error:', e);
      setLogsError(e.message || 'Unknown error occurred while fetching logs');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [arcadeEnabled, setArcadeEnabled] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubConfig = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAdminEmails(data.adminEmails || []);
        setArcadeEnabled(data.arcadeEnabled === true);
        setEventsCatalog(data.eventsCatalog || []);
      }
      setConfigLoaded(true);
    });
    const unsubCreds = onSnapshot(collection(db, 'openCredentials'), (snap) => {
      let creds = [];
      let hasWelcome = false;
      snap.forEach(d => {
        if (d.id === 'welcome-badge') hasWelcome = true;
        creds.push({ id: d.id, ...d.data() });
      });
      if (!hasWelcome) {
        creds.unshift({
          id: 'welcome-badge',
          title: 'Orientation 2026',
          subtitle: 'SRMCEM',
          isActive: true
        });
      }
      setCredentials(creds);
      if (creds.length > 0 && !viewingLogsFor) {
        // If we want to default load logs for the first one we could do it here, but it's better to wait for click
      }
    });
    return () => {
      unsubConfig();
      unsubCreds();
    };
  }, [user, viewingLogsFor]);

  const isAdmin = user && (adminEmails.includes(user.email?.toLowerCase()) || SUPER_ADMINS.includes(user.email?.toLowerCase()));

  if (displayLoading) return <LoadingScreen text="Loading Admin..." />;

  if (!user) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
        <div className='bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-gray-100'>
          <Shield className='w-16 h-16 text-[#4285F4] mx-auto mb-6' />
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>Overall Admin Panel</h1>
          <p className='text-gray-500 mb-8'>Sign in with Google to continue</p>
          <button onClick={() => signInWithPopup(auth, googleProvider)} className='w-full bg-[#4285F4] hover:bg-[#3367d6] text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2'>
            <Globe className='w-5 h-5' /> Sign In with Google
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
        <div className='bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-gray-100'>
          <AlertTriangle className='w-16 h-16 text-[#ea4335] mx-auto mb-6' />
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>Access Denied</h1>
          <p className='text-gray-500 mb-8'>Your email is not authorized as an overall admin.</p>
          <button onClick={() => signOut(auth)} className='bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg transition-colors'>Sign Out</button>
        </div>
      </div>
    );
  }

  const handleAddEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) return;
    await updateDoc(doc(db, 'huntConfig', 'global'), { adminEmails: arrayUnion(newEmail.toLowerCase().trim()) });
    setNewEmail('');
  };

  const handleRemoveEmail = async (emailToRemove) => {
    await updateDoc(doc(db, 'huntConfig', 'global'), { adminEmails: arrayRemove(emailToRemove) });
  };

  const toggleArcade = async () => {
    await updateDoc(doc(db, 'huntConfig', 'global'), { arcadeEnabled: !arcadeEnabled });
  };

  const handleAddEvent = async () => {
    if (!newEventTitle) return;
    const newEvent = {
      id: Date.now().toString(),
      title: newEventTitle.trim(),
      date: newEventDate.trim(),
      link: newEventLink.trim(),
      imageLink: newEventImageLink.trim()
    };
    await updateDoc(doc(db, 'huntConfig', 'global'), { eventsCatalog: arrayUnion(newEvent) });
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventLink('');
    setNewEventImageLink('');
  };

  const handleRemoveEvent = async (eventToRemove) => {
    await updateDoc(doc(db, 'huntConfig', 'global'), { eventsCatalog: arrayRemove(eventToRemove) });
  };

  const handleCreateCredential = async () => {
    if (!credTitle || !credFile) return alert('Title and Image are required');
    setCredUploading(true);
    try {
      const fileRef = ref(storage, `credentials/${Date.now()}_${credFile.name}`);
      const uploadTask = await uploadBytesResumable(fileRef, credFile);
      const url = await getDownloadURL(uploadTask.ref);

      const credId = credTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
      await setDoc(doc(db, 'openCredentials', credId), {
        title: credTitle,
        subtitle: credSubtitle,
        bgUrl: url,
        isActive: true,
        createdAt: serverTimestamp()
      });

      setCredTitle('');
      setCredSubtitle('');
      setCredFile(null);
    } catch (e) {
      alert('Error creating credential: ' + e.message);
    } finally {
      setCredUploading(false);
    }
  };

  const toggleLock = async (cred) => {
    await setDoc(doc(db, 'openCredentials', cred.id), { isActive: !cred.isActive }, { merge: true });
  };



  return (
    <div className='min-h-screen bg-gray-50 flex'>
      {/* Sidebar Menu */}
      <div className='w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0'>
        <div className='p-6 border-b border-gray-100'>
          <h1 className='text-xl font-bold flex items-center gap-2 text-gray-900'>
            <Shield className='text-[#4285F4]' /> Admin Panel
          </h1>
        </div>
        <nav className='flex-1 p-4 space-y-2'>
          <button 
            onClick={() => { setActiveSection('dashboard'); setViewingLogsFor(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeSection === 'dashboard' ? 'bg-[#e8f0fe] text-[#1967d2]' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Globe className='w-5 h-5' /> Dashboard
          </button>
          <button 
            onClick={() => { setActiveSection('credentials'); setViewingLogsFor(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeSection === 'credentials' ? 'bg-[#e8f0fe] text-[#1967d2]' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Upload className='w-5 h-5' /> Credentials
          </button>
          <button 
            onClick={() => { setActiveSection('access'); setViewingLogsFor(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeSection === 'access' ? 'bg-[#e8f0fe] text-[#1967d2]' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Users className='w-5 h-5' /> Access Control
          </button>
          <button 
            onClick={() => { setActiveSection('events'); setViewingLogsFor(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeSection === 'events' ? 'bg-[#e8f0fe] text-[#1967d2]' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Calendar className='w-5 h-5 text-[#34A853]' /> Event Catalog
          </button>
        </nav>
        <div className='p-4 border-t border-gray-100'>
          <button onClick={() => signOut(auth)} className='w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold transition-colors'>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className='flex-1 p-8 overflow-y-auto text-gray-900'>
        <div className='max-w-5xl mx-auto'>
          
          {/* DASHBOARD SECTION */}
          {activeSection === 'dashboard' && (
            <div className='space-y-6'>
              <div>
                <h2 className='text-3xl font-bold mb-2'>Dashboard Overview</h2>
                <p className='text-gray-500'>Manage master controls and arcade status.</p>
              </div>
              <div className='bg-white p-8 rounded-2xl shadow-sm border border-gray-100'>
                <h3 className='text-xl font-bold mb-6 flex items-center gap-2'><Globe className="text-[#34a853]" /> Master Controls</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col justify-between gap-6">
                    <div>
                      <h4 className="font-bold text-lg text-gray-900">GDG Arcade Status</h4>
                      <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                        When off, the arcade is completely locked and hidden from the home page for standard users.
                      </p>
                    </div>
                    <button 
                      onClick={toggleArcade} 
                      className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold transition-all shadow-sm ${
                        arcadeEnabled 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {arcadeEnabled ? <><Unlock size={20}/> SYSTEM ONLINE</> : <><Lock size={20}/> SYSTEM OFFLINE</>}
                    </button>
                  </div>
                  
                  <div className="bg-[#e8f0fe] p-6 rounded-xl border border-blue-100 flex flex-col justify-between gap-6">
                    <div>
                      <h4 className="font-bold text-lg text-[#1967d2]">Games Admin Portal</h4>
                      <p className="text-[#1967d2]/80 text-sm mt-2 leading-relaxed">
                        Manage specific game states, update team scores, reset the leaderboard, and tweak global settings.
                      </p>
                    </div>
                    <a href="/admingames" className="w-full inline-flex items-center justify-center bg-[#4285F4] hover:bg-[#3367d6] text-white px-6 py-4 rounded-xl font-bold transition-all shadow-sm">
                      Go to Games Admin &rarr;
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CREDENTIALS SECTION */}
          {activeSection === 'credentials' && (
            <div className='space-y-6'>
              {!viewingLogsFor ? (
                <>
                  <div>
                    <h2 className='text-3xl font-bold mb-2'>Credentials Management</h2>
                    <p className='text-gray-500'>Create, lock, and manage digital badges.</p>
                  </div>
                  
                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
                    {/* Create Credentials */}
                    <div className='bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-fit'>
                      <h3 className='text-xl font-bold mb-6 flex items-center gap-2'><Upload className="text-[#4285F4]" /> Create Credential</h3>
                      <div className='space-y-5'>
                        <div>
                          <label className='block text-gray-700 text-sm font-bold mb-2'>Badge Title</label>
                          <input type='text' placeholder='e.g., Event Winner' className='w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4285F4]/50' value={credTitle} onChange={e => setCredTitle(e.target.value)} />
                        </div>
                        <div>
                          <label className='block text-gray-700 text-sm font-bold mb-2'>Subtitle / Organizer</label>
                          <input type='text' placeholder='e.g., GDG SRMCEM' className='w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4285F4]/50' value={credSubtitle} onChange={e => setCredSubtitle(e.target.value)} />
                        </div>
                        <div className='bg-gray-50 border border-gray-200 rounded-xl p-5'>
                          <label className='block text-gray-700 text-sm font-bold mb-3'>Upload Blank Design Image</label>
                          <input type='file' accept='image/*' onChange={e => setCredFile(e.target.files[0])} className="w-full text-gray-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#e8f0fe] file:text-[#1967d2] hover:file:bg-[#d2e3fc] cursor-pointer" />
                        </div>
                        <button onClick={handleCreateCredential} disabled={credUploading} className='w-full bg-[#4285F4] hover:bg-[#3367d6] text-white px-6 py-4 rounded-xl font-bold disabled:opacity-50 shadow-sm transition-colors mt-4'>{credUploading ? 'Uploading & Creating...' : 'Publish Credential'}</button>
                      </div>
                    </div>
                    
                    {/* Existing Credentials */}
                    <div className='bg-white p-8 rounded-2xl shadow-sm border border-gray-100'>
                      <h3 className='text-xl font-bold mb-6 flex items-center gap-2'><ImageIcon className="text-[#34a853]" /> Existing Credentials</h3>
                      <div className='space-y-4 overflow-y-auto max-h-[600px] pr-2'>
                        {credentials.map(cred => (
                          <div key={cred.id} className='bg-gray-50 border border-gray-200 p-5 rounded-xl flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow'>
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className='font-bold text-lg text-gray-900'>{cred.title}</h4>
                                <p className='text-gray-500 text-sm mt-1'>{cred.subtitle}</p>
                              </div>
                              <button onClick={() => toggleLock(cred)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${cred.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                                {cred.isActive ? <><Unlock size={14}/> Active</> : <><Lock size={14}/> Locked</>}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <button onClick={() => loadLogsForCred(cred)} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium transition-colors text-sm">
                                <FileText size={16}/> Details
                              </button>
                              <button onClick={() => setGeneratingBadgeFor(cred)} className="w-full flex items-center justify-center gap-2 bg-[#e8f0fe] border border-blue-200 hover:bg-[#d2e3fc] text-[#1967d2] py-2.5 rounded-lg font-medium transition-colors text-sm">
                                <Download size={16}/> Gen Copy
                              </button>
                            </div>
                          </div>
                        ))}
                        {credentials.length === 0 && <p className="text-gray-500 text-center py-8">No credentials created yet.</p>}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Details / Logs View */
                <div className='bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in zoom-in-95 duration-200'>
                  <div className='flex items-center justify-between mb-8 pb-6 border-b border-gray-100'>
                    <div>
                      <button onClick={() => setViewingLogsFor(null)} className="text-[#4285F4] hover:underline flex items-center gap-2 mb-4 font-medium text-sm">
                        &larr; Back to all credentials
                      </button>
                      <h2 className='text-3xl font-bold text-gray-900 flex items-center gap-3'>
                        {viewingLogsFor.title}
                        <span className="bg-[#e8f0fe] text-[#1967d2] text-sm px-3 py-1 rounded-full font-bold">
                          {logsLoading ? '...' : logs.length} total claims
                        </span>
                      </h2>
                      <p className='text-gray-500 mt-2'>{viewingLogsFor.subtitle} • ID: {viewingLogsFor.id}</p>
                    </div>
                  </div>

                  {logsLoading ? (
                    <div className="p-12 text-center text-gray-500 font-medium animate-pulse flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-[#4285F4] border-t-transparent rounded-full animate-spin mb-4"></div>
                      Loading claim data...
                    </div>
                  ) : logsError ? (
                    <div className="p-12 text-center text-red-500 font-medium">
                      <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                      <p className="text-lg mb-2">Failed to load claims</p>
                      <p className="text-sm font-normal text-red-400 max-w-xl mx-auto break-words">{logsError}</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto max-h-[600px]">
                        <table className='w-full text-left'>
                          <thead className="bg-gray-100 sticky top-0 shadow-sm">
                            <tr className='text-gray-600 text-sm uppercase tracking-wider'>
                              <th className='py-4 px-6 font-semibold'>Claimed Name</th>
                              <th className='py-4 px-6 font-semibold'>Email / Google ID</th>
                              <th className='py-4 px-6 font-semibold'>Date & Time Claimed</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {logs.map((log, i) => (
                              <tr key={i} className='hover:bg-gray-50 transition-colors'>
                                <td className='py-4 px-6 font-bold text-gray-900'>{log.claimedName}</td>
                                <td className='py-4 px-6 text-gray-600'>{log.recipientEmail || log.userId}</td>
                                <td className='py-4 px-6 text-gray-500 text-sm'>
                                  {log.claimedAt?.toDate?.().toLocaleString(undefined, { 
                                    dateStyle: 'medium', 
                                    timeStyle: 'short' 
                                  }) || 'Unknown'}
                                </td>
                              </tr>
                            ))}
                            {logs.length === 0 && (
                              <tr>
                                <td colSpan='3' className='py-16 text-center text-gray-500'>
                                  <div className="flex flex-col items-center justify-center">
                                    <FileText className="w-12 h-12 text-gray-300 mb-4" />
                                    <p className="text-lg">No one has claimed this badge yet.</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ACCESS CONTROL SECTION */}
          {activeSection === 'access' && (
            <div className='space-y-6'>
              <div>
                <h2 className='text-3xl font-bold mb-2'>Access Control</h2>
                <p className='text-gray-500'>Manage who has overall admin access.</p>
              </div>
              <div className='bg-white p-8 rounded-2xl shadow-sm border border-gray-100'>
                <h3 className='text-xl font-bold mb-6 flex items-center gap-2 text-gray-900'><Users className="text-[#4285F4]" /> Authorized Admins</h3>
                <div className='flex flex-col sm:flex-row gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100'>
                  <input type='email' placeholder='Enter email to add as admin' className='bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 flex-1 focus:outline-none focus:ring-2 focus:ring-[#4285F4]/50 shadow-sm' value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                  <button onClick={handleAddEmail} className='bg-[#4285F4] hover:bg-[#3367d6] text-white px-8 py-3 rounded-xl font-bold shadow-sm whitespace-nowrap transition-colors'>Add Admin</button>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <ul className='divide-y divide-gray-200'>
                    {adminEmails.map(email => (
                      <li key={email} className='flex items-center justify-between p-5 bg-white hover:bg-gray-50 transition-colors'>
                        <span className="text-gray-800 font-medium text-lg">{email}</span>
                        <button onClick={() => handleRemoveEmail(email)} className='text-[#ea4335] bg-red-50 hover:bg-red-100 px-5 py-2.5 rounded-lg font-bold transition-colors'>Revoke Access</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {/* EVENTS SECTION */}
          {activeSection === 'events' && (
            <div className='space-y-6'>
              <div>
                <h2 className='text-3xl font-bold mb-2'>Event Catalog</h2>
                <p className='text-gray-500'>Manage upcoming events displayed on the Home page.</p>
              </div>
              <div className='bg-white p-8 rounded-2xl shadow-sm border border-gray-100'>
                <h3 className='text-xl font-bold mb-6 flex items-center gap-2 text-gray-900'><Calendar className="text-[#34A853]" /> Manage Events</h3>
                <div className='flex flex-col gap-4 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-100'>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type='text' placeholder='Event Title (e.g. Android Study Jam)' className='bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4285F4]/50 shadow-sm' value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} />
                    <input type='text' placeholder='Date (e.g. Oct 25, 2026)' className='bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4285F4]/50 shadow-sm' value={newEventDate} onChange={e => setNewEventDate(e.target.value)} />
                    <input type='text' placeholder='Registration/Details Link (Optional)' className='bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-[#4285F4]/50 shadow-sm' value={newEventLink} onChange={e => setNewEventLink(e.target.value)} />
                    <input type='text' placeholder='Image Link (Optional)' className='bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-[#4285F4]/50 shadow-sm' value={newEventImageLink} onChange={e => setNewEventImageLink(e.target.value)} />
                  </div>
                  <button onClick={handleAddEvent} className='bg-[#4285F4] hover:bg-[#3367d6] text-white px-8 py-3 rounded-xl font-bold shadow-sm transition-colors self-end mt-2'>Add Event</button>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <ul className='divide-y divide-gray-200'>
                    {eventsCatalog.map(event => (
                      <li key={event.id} className='flex flex-col md:flex-row md:items-center justify-between p-5 bg-white hover:bg-gray-50 transition-colors gap-4'>
                        <div>
                          <span className="text-gray-900 font-bold text-lg block">{event.title}</span>
                          <span className="text-gray-500 text-sm block mt-1">{event.date}</span>
                          <div className="flex gap-4 mt-1">
                            {event.link && <a href={event.link} target="_blank" rel="noopener noreferrer" className="text-[#4285F4] text-sm hover:underline inline-block">Event Link</a>}
                            {event.imageLink && <a href={event.imageLink} target="_blank" rel="noopener noreferrer" className="text-[#34a853] text-sm hover:underline inline-block">Image Link</a>}
                          </div>
                        </div>
                        <button onClick={() => handleRemoveEvent(event)} className='text-[#ea4335] bg-red-50 hover:bg-red-100 px-5 py-2.5 rounded-lg font-bold transition-colors w-fit'>Remove</button>
                      </li>
                    ))}
                    {eventsCatalog.length === 0 && <li className="p-8 text-center text-gray-500">No events currently.</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>

      {generatingBadgeFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xl p-6">
            <h3 className="text-xl font-bold mb-2">Generate Copy</h3>
            <p className="text-gray-500 text-sm mb-4">Create a custom SVG badge for {generatingBadgeFor.title}.</p>
            <input 
              type="text" 
              placeholder="Enter name (e.g. John Doe)" 
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4285F4] mb-4"
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setGeneratingBadgeFor(null); setManualName(''); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors">Cancel</button>
              <button 
                onClick={() => {
                  if(manualName.trim().length >= 2) {
                    downloadAdminBadge(generatingBadgeFor, manualName.trim());
                    setGeneratingBadgeFor(null);
                    setManualName('');
                  }
                }} 
                disabled={manualName.trim().length < 2}
                className="bg-[#4285F4] hover:bg-[#3367d6] text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
              >Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}