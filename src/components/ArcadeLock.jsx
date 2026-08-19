import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from './LoadingScreen';
import { useMinLoadTime } from '../hooks/useMinLoadTime';

const SUPER_ADMINS = ['royalshikher@gmail.com', 'i.e.ishantiwari@gmail.com'];

export default function ArcadeLock({ children }) {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [arcadeEnabled, setArcadeEnabled] = useState(false);
  const [adminEmails, setAdminEmails] = useState([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setArcadeEnabled(data.arcadeEnabled === true);
        if (data.adminEmails) {
          setAdminEmails(data.adminEmails.map(e => e.toLowerCase()));
        }
      }
      setConfigLoaded(true);
    });
    return () => unsub();
  }, []);

  const displayLoading = useMinLoadTime(!configLoaded, 1500);

  if (displayLoading) {
    return <LoadingScreen text="Loading Arcade..." />;
  }

  const isAdmin = user && (adminEmails.includes(user.email?.toLowerCase()) || SUPER_ADMINS.includes(user.email?.toLowerCase()));

  if (!arcadeEnabled && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <Lock className="w-20 h-20 text-[#EA4335] mb-6" />
        <h1 className="text-3xl font-black mb-4">Arcade is Locked</h1>
        <p className="text-slate-400 max-w-md font-medium text-lg leading-relaxed">
          If you think this is a mistake, contact any GDG SRMCEM admin.
        </p>
        <button 
          onClick={() => navigate('/')} 
          className="mt-8 bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-sm"
        >
          Return Home
        </button>
      </div>
    );
  }

  return children;
}
