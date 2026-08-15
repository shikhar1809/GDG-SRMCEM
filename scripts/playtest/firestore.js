// Playtest stand-in for firebase/firestore.
//
// Reads return the state the stall runs in (approved admin, hunt configured);
// writes are recorded on window.__ARCADE_WRITES__ so the harness can assert a
// game or a hunt claim actually saved.
//
// The hunt half models the one rule that matters: a claim is a CREATE, so the
// second person to submit a correct code is rejected exactly as the real
// Firestore rules reject them.
const ADMIN = 'playtest@example.com';

export const doc = (_db, path, id) => ({ __path: id ? `${path}/${id}` : String(path) });
export const collection = (_db, path) => ({ __path: path });
export const serverTimestamp = () => new Date().toISOString();
export const increment = (n) => ({ __increment: n });

// --- seeded hunt fixture -----------------------------------------------------
const LEVELS = 10;
const huntLevels = {};
const huntCodes = {};
for (let l = 1; l <= LEVELS; l++) {
  huntLevels[l] = { level: l, hint: `Clue for level ${l}: look near the ${l} pillar.`, isMega: l === 10 };
  huntCodes[`CODE${l}`] = { level: l, formUrl: `https://forms.gle/level-${l}` };
}
// Pre-claim levels 1-8 by other people so the harness only has to win #9 to
// prove the mega level unlocks at exactly 9/9.
const huntClaims = {};
for (let l = 1; l <= 8; l++) {
  huntClaims[l] = { level: l, uid: `other-${l}`, displayName: `Player ${l}`, formUrl: '' };
}

const listeners = { huntClaims: new Set(), huntLevels: new Set() };
const snapOf = (obj) => ({
  forEach: (fn) => Object.entries(obj).forEach(([id, data]) => fn({ id, data: () => data })),
  docs: Object.entries(obj).map(([id, data]) => ({ id, data: () => data })),
  empty: Object.keys(obj).length === 0,
});
const notify = (name, obj) => listeners[name].forEach((cb) => cb(snapOf(obj)));

export const onSnapshot = (ref, cb) => {
  const path = ref?.__path || '';
  if (path === 'huntConfig/global') {
    cb({ exists: () => true, data: () => ({ adminEmails: [ADMIN], formUrl: '' }) });
    return () => {};
  }
  if (path === 'huntLevels') {
    cb(snapOf(huntLevels));
    listeners.huntLevels.add(cb);
    return () => listeners.huntLevels.delete(cb);
  }
  if (path === 'huntClaims') {
    cb(snapOf(huntClaims));
    listeners.huntClaims.add(cb);
    return () => listeners.huntClaims.delete(cb);
  }
  // Everything else (game requests, leaderboards) is empty: the admin
  // "Start Game" path is what the arcade harness drives.
  cb({ exists: () => false, data: () => null, forEach: () => {}, docs: [] });
  return () => {};
};

export const getDoc = async (ref) => {
  const path = ref?.__path || '';
  const m = path.match(/^huntLevelCodes\/(.+)$/);
  if (m) {
    const data = huntCodes[m[1]];
    return { exists: () => !!data, data: () => data };
  }
  return { exists: () => false, data: () => null };
};

export const getDocs = async (ref) => {
  const path = ref?.__path || '';
  if (path === 'huntLevelCodes') return snapOf(huntCodes);
  if (path === 'huntLevels') return snapOf(huntLevels);
  if (path === 'huntClaims') return snapOf(huntClaims);
  return { empty: true, forEach: () => {}, docs: [] };
};

const record = (kind, ref, data) => {
  window.__ARCADE_WRITES__ = window.__ARCADE_WRITES__ || [];
  window.__ARCADE_WRITES__.push({ kind, path: ref?.__path, data });
};

export const setDoc = async (ref, data) => {
  const path = ref?.__path || '';
  const m = path.match(/^huntClaims\/(\d+)$/);
  if (m) {
    const level = Number(m[1]);
    // Mirrors the real rule: create is allowed, update is not.
    if (huntClaims[level]) {
      const err = new Error('Missing or insufficient permissions.');
      err.code = 'permission-denied';
      throw err;
    }
    huntClaims[level] = { ...data, level };
    record('set', ref, data);
    notify('huntClaims', huntClaims);
    return;
  }
  record('set', ref, data);
};

export const updateDoc = async (ref, data) => record('update', ref, data);
export const deleteDoc = async (ref) => {
  const m = (ref?.__path || '').match(/^huntClaims\/(\d+)$/);
  if (m) {
    delete huntClaims[Number(m[1])];
    notify('huntClaims', huntClaims);
  }
  record('delete', ref, null);
};
