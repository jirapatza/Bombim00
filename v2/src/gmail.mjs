// Phase 1 draft; credentials must be injected as secrets, never committed.
// Do not automatically retry an ambiguous Gmail send.
const ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/;
const tokenUrl = 'https://oauth2.googleapis.com/token';
const sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendWatchdogAlert(config, state, request = fetch) {
  const { clientId, clientSecret, refreshToken, recipient } = config;
  if (![clientId, clientSecret, refreshToken, recipient].every(x => typeof x === 'string' && x.trim()) || !ADDRESS.test(recipient)) {
    return { status: 'configuration_error' };
  }
  if (!['stale', 'unreachable'].includes(state)) return { status: 'configuration_error' };
  let auth;
  try {
    auth = await request(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(10000) });
    if (!auth.ok) return { status: 'authentication_error' };
    const data = await auth.json();
    if (typeof data.access_token !== 'string' || !data.access_token) return { status: 'authentication_error' };
    const subject = state === 'stale' ? 'Bombim00 watchdog: heartbeat stale' : 'Bombim00 watchdog: health unavailable';
    const body = state === 'stale' ? 'The latest successful heartbeat is at least 4 minutes old.' : 'The watchdog cannot read a valid health status.';
    const mime = `To: ${recipient}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}\r\n`;
    try {
      const response = await request(sendUrl, { method: 'POST', headers: { Authorization: `Bearer ${data.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: base64url(new TextEncoder().encode(mime)) }), signal: AbortSignal.timeout(10000) });
      if (response.ok) return { status: 'accepted' };
      return { status: response.status >= 500 ? 'uncertain' : 'rejected', httpStatus: response.status };
    } catch { return { status: 'uncertain' }; }
  } catch { return { status: 'authentication_error' }; }
}
