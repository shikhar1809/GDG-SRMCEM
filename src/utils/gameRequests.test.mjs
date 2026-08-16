import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const {
  createGameRequestPayload,
  getLocalRequestToken,
  isApprovedForThisDevice,
} = await import('./gameRequests.js');

const user = {
  uid: 'student-1',
  displayName: 'Student One',
  email: 'student@example.com',
};
const serverTimestamp = () => 'server-time';

const request = createGameRequestPayload(user, 'tech-quiz', serverTimestamp);

assert.equal(request.userId, user.uid);
assert.equal(request.userEmail, user.email);
assert.equal(request.status, 'pending');
assert.equal(request.timestamp, 'server-time');
assert.match(request.lobbyCode, /^\d{3}$/);
assert.equal(getLocalRequestToken('tech-quiz'), request.requestToken);

assert.equal(
  isApprovedForThisDevice({ ...request, status: 'approved' }, 'tech-quiz'),
  true,
  'same request token should start on the requesting device'
);

assert.equal(
  isApprovedForThisDevice({ ...request, requestToken: 'other-device', status: 'approved' }, 'tech-quiz'),
  false,
  'approval from another device must not start this device'
);

assert.equal(
  isApprovedForThisDevice({ status: 'approved' }, 'tech-quiz'),
  true,
  'legacy approved requests without tokens should still work'
);

console.log('gameRequests: all checks passed');
