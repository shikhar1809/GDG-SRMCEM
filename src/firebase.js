import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace this with your actual Firebase project configuration
// from the Firebase Console (Project Settings -> General -> Web App)
const firebaseConfig = {
  apiKey: "AIzaSyBnSgnUZyMVNAbpvGgkbfb8H3DAUTBCK04",
  authDomain: "gdg-srmcem.firebaseapp.com",
  projectId: "gdg-srmcem",
  storageBucket: "gdg-srmcem.firebasestorage.app",
  messagingSenderId: "315154522687",
  appId: "1:315154522687:web:5efbc675f48b9f010cce8a",
  measurementId: "G-X1PRJTVBYS"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
