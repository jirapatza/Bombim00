// One-time interactive smoke test. Does not persist or print tokens.
// Run only after the owner explicitly approves an actual test email.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const [path, recipient] = process.argv.slice(2);
if (!path || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/.test(recipient || '')) throw Error('Usage: node gmail-smoke.mjs <desktop-client-json> <recipient>');
const { installed } = JSON.parse(await readFile(path, 'utf8'));
if (!installed?.client_id || !installed?.client_secret) throw Error('Expected Google Desktop OAuth credentials');
const state = randomBytes(32).toString('base64url');
const verifier = randomBytes(64).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
let handled = false;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const received = Buffer.from(url.searchParams.get('state') || '');
  const expected = Buffer.from(state);
  if (received.length !== expected.length || !timingSafeEqual(received, expected) || handled) { res.writeHead(400).end('Invalid or expired request'); return; }
  handled = true;
  const code = url.searchParams.get('code');
  if (!code) { res.writeHead(400).end('Authorization was not completed.'); console.log('Authorization not completed.'); server.close(); return; }
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: installed.client_id, client_secret: installed.client_secret, code, code_verifier: verifier,
        grant_type: 'authorization_code', redirect_uri: `http://127.0.0.1:${server.address().port}/callback` }), signal: AbortSignal.timeout(15000) });
    if (!tokenResponse.ok) throw Error('Token exchange failed');
    const token = await tokenResponse.json();
    if (!token.access_token) throw Error('No access token');
    const mime = `To: ${recipient}\r\nSubject: Bombim00 watchdog test\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nThis is an authorized test email.\r\n`;
    const sent = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST',
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url') }), signal: AbortSignal.timeout(15000) });
    if (!sent.ok) throw Error(`Gmail rejected the test: HTTP ${sent.status}`);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('Test request accepted by Gmail. You may close this page.');
    console.log('Gmail accepted the test request. No tokens were saved.');
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('Test did not complete. Return to the assistant.');
    console.log('Test did not complete; the delivery outcome may be uncertain. No tokens were saved.');
  } finally { server.close(); }
});
server.listen(0, '127.0.0.1', () => {
  const params = new URLSearchParams({ client_id: installed.client_id, redirect_uri: `http://127.0.0.1:${server.address().port}/callback`,
    response_type: 'code', scope: 'https://www.googleapis.com/auth/gmail.send', state, code_challenge: challenge,
    code_challenge_method: 'S256', access_type: 'offline' });
  console.log(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});
setTimeout(() => { console.log('Authorization timed out; no tokens were saved.'); server.close(); }, 300000).unref();
