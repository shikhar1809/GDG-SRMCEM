// Playtest stand-in for src/firebase.js. Only loaded by vite.playtest.config.js.
export const auth = {
  currentUser: {
    uid: 'playtest-uid',
    displayName: 'Playtest Player',
    email: 'playtest@example.com',
    photoURL: null,
  },
  onAuthStateChanged(cb) {
    cb(this.currentUser);
    return () => {};
  },
};
export const db = { __mock: true };
export const googleProvider = { __mock: true };
