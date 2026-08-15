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

// ?asPlayer=1 drops the playtest user out of the admin list, so the harness can
// exercise the request/approve/2-attempts flow a real student goes through.
const asPlayer = () =>
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('asPlayer');
const adminEmails = () => (asPlayer() ? ['someone.else@example.com'] : [ADMIN]);

// Play sessions, persisted so attempts survive the page reload between runs.
const REQ_KEY = '__playtest_game_requests__';
const loadRequests = () => {
  try {
    return JSON.parse(sessionStorage.getItem(REQ_KEY) || '{}');
  } catch {
    return {};
  }
};
const saveRequests = (o) => sessionStorage.setItem(REQ_KEY, JSON.stringify(o));

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
const requestListeners = new Set();
const snapOf = (obj) => ({
  forEach: (fn) => Object.entries(obj).forEach(([id, data]) => fn({ id, data: () => data })),
  docs: Object.entries(obj).map(([id, data]) => ({ id, data: () => data })),
  empty: Object.keys(obj).length === 0,
});
const notify = (name, obj) => listeners[name].forEach((cb) => cb(snapOf(obj)));

export const onSnapshot = (ref, cb) => {
  const path = ref?.__path || '';
  if (path === 'huntConfig/global') {
    cb({ exists: () => true, data: () => ({ adminEmails: adminEmails(), formUrl: '' }) });
    return () => {};
  }
  const req = path.match(/^gameRequests\/(.+)$/);
  if (req) {
    const emit = () => {
      const d = loadRequests()[req[1]];
      cb({ exists: () => !!d, data: () => d });
    };
    emit();
    requestListeners.add(emit);
    return () => requestListeners.delete(emit);
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
  const code = path.match(/^huntLevelCodes\/(.+)$/);
  if (code) {
    const data = huntCodes[code[1]];
    return { exists: () => !!data, data: () => data };
  }
  const score = path.match(/^arcadeScores\/(.+)$/);
  if (score) {
    const data = loadScores()[score[1]];
    return { exists: () => !!data, data: () => data };
  }
  return { exists: () => false, data: () => null };
};

export const getDocs = async (ref) => {
  const path = ref?.__path || '';
  if (path === 'huntLevelCodes') return snapOf(huntCodes);
  if (path === 'huntLevels') return snapOf(huntLevels);
  if (path === 'huntClaims') return snapOf(huntClaims);
  if (path === 'arcadeScores') return snapOf(loadScores());
  return { empty: true, forEach: () => {}, docs: [] };
};

// Arcade scores persist across page loads so a badge test can play several
// games in a row and watch the badges actually accumulate.
const SCORES_KEY = '__playtest_arcade_scores__';
const loadScores = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SCORES_KEY) || '{}');
  } catch {
    return {};
  }
};
const saveScores = (obj) => sessionStorage.setItem(SCORES_KEY, JSON.stringify(obj));

// Firestore increment() sentinels arrive as objects; resolve them against the
// current value the same way the real backend would.
const applyValue = (current, next) =>
  next && typeof next === 'object' && '__increment' in next
    ? (current || 0) + next.__increment
    : next;

const mergeScoreDoc = (id, data) => {
  const all = loadScores();
  const prev = all[id] || {};
  const next = { ...prev };
  for (const [k, v] of Object.entries(data)) next[k] = applyValue(prev[k], v);
  all[id] = next;
  saveScores(all);
  return next;
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
  const score = path.match(/^arcadeScores\/(.+)$/);
  if (score) mergeScoreDoc(score[1], data);

  const req = path.match(/^gameRequests\/(.+)$/);
  if (req) {
    const all = loadRequests();
    const prev = all[req[1]] || {};
    const next = { ...prev };
    for (const [k, v] of Object.entries(data)) next[k] = applyValue(prev[k], v);
    all[req[1]] = next;
    saveRequests(all);
    requestListeners.forEach((fn) => fn());
  }
  record('set', ref, data);
};

export const updateDoc = async (ref, data) => {
  const score = (ref?.__path || '').match(/^arcadeScores\/(.+)$/);
  if (score) mergeScoreDoc(score[1], data);
  record('update', ref, data);
};
export const deleteDoc = async (ref) => {
  const m = (ref?.__path || '').match(/^huntClaims\/(\d+)$/);
  if (m) {
    delete huntClaims[Number(m[1])];
    notify('huntClaims', huntClaims);
  }
  record('delete', ref, null);
};
