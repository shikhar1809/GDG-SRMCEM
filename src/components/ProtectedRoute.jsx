import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, googleProvider } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect } from 'firebase/auth';

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Auth error:", error);
      const msg = error.message.toLowerCase();
      if (msg.includes('closing') || msg.includes('hidden') || msg.includes('network') || msg.includes('cancelled')) {
        signInWithRedirect(auth, googleProvider);
      } else {
        setAuthError(error.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
        <img src="/gdg_logo.png" alt="GDG" className="w-24 mb-8" />
        <h1 className="text-3xl font-bold mb-4">GDG Arcade</h1>
        <p className="text-gray-400 mb-8 max-w-md">
          Sign in with your Google account to enter the GDG Arcade and play awesome tech games!
        </p>
        <button 
          onClick={handleSignIn}
          className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold flex items-center gap-3 hover:bg-gray-100 transition-colors"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          Sign in with Google
        </button>
        {authError && (
          <div className="mt-6 bg-red-900/80 border-2 border-red-500 text-white px-6 py-4 rounded-xl max-w-lg text-left shadow-lg flex flex-col items-start gap-3">
            <div>
              <p className="font-bold text-lg mb-2 flex items-center gap-2">⚠️ Authentication Error</p>
              <p className="text-sm opacity-90 mb-2">{authError}</p>
              {authError.includes('unauthorized') && (
                <div className="mt-3 bg-black/30 p-3 rounded-lg text-sm">
                  <p className="font-bold text-red-300">Action Required:</p>
                  <p>1. Go to Firebase Console</p>
                  <p>2. Go to Authentication {'>'} Settings {'>'} Authorized domains</p>
                  <p>3. Add <code className="bg-black/50 px-1 py-0.5 rounded">gdgsrmcem.web.app</code> to the list.</p>
                </div>
              )}
            </div>
            
            {(authError.toLowerCase().includes('closing') || authError.toLowerCase().includes('hidden') || authError.toLowerCase().includes('network')) && (
              <button 
                onClick={() => signInWithRedirect(auth, googleProvider)}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors w-full"
              >
                Try Alternative Sign In (Redirect Mode)
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return children;
}
