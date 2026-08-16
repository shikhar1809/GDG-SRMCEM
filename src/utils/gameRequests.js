const DEVICE_KEY = 'gdg_arcade_device_id_v1';

const randomId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getDeviceId = () => {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const next = randomId();
    localStorage.setItem(DEVICE_KEY, next);
    return next;
  } catch {
    return randomId();
  }
};

export const requestTokenKey = (gameId) => `gdg_arcade_request_token_${gameId}`;

export const getLocalRequestToken = (gameId) => {
  try {
    return localStorage.getItem(requestTokenKey(gameId)) || '';
  } catch {
    return '';
  }
};

export const createGameRequestPayload = (user, gameId, serverTimestamp) => {
  const requestToken = randomId();
  try {
    localStorage.setItem(requestTokenKey(gameId), requestToken);
  } catch {
    // If storage fails, the request still works in the current tab.
  }

  return {
    userId: user.uid,
    userName: user.displayName || 'Player',
    userEmail: user.email || '',
    gameId,
    status: 'pending',
    lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
    requestToken,
    deviceId: getDeviceId(),
    deviceInfo: navigator.userAgent.slice(0, 160),
    timestamp: serverTimestamp(),
  };
};

export const isApprovedForThisDevice = (requestData, gameId) => {
  if (requestData?.status !== 'approved') return false;
  if (!requestData.requestToken) return true;
  return requestData.requestToken === getLocalRequestToken(gameId);
};
