// Playtest stand-in for firebase/auth.
export const signOut = async () => {};
export const signInWithPopup = async () => {};
export const signInWithRedirect = async () => {};
export const getRedirectResult = async () => null;
export const onAuthStateChanged = (auth, cb) => {
  cb(auth.currentUser);
  return () => {};
};
export class GoogleAuthProvider {}
