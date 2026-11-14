// Windows-only interactive OAuth bootstrap for an isolated test. The resulting
// OAuth credentials are encrypted with Windows DPAPI for the current user;
// nothing is printed except the Google authorization URL and status.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const redirect = 'http://127.0.0.1:8765/callback';
const filename = process.argv[2];
if (process.platform !== 'win32') throw Error('Windows DPAPI is required');
if (!filename || !process.env.LOCALAPPDATA) throw Error('Usage: node authorize-web.mjs <web-client-json>');
const { web } = JSON.parse(await readFile(filename, 'utf8'));
if (!web?.client_id || !web?.client_secret || !web?.redirect_uris?.includes(redirect)) {
  throw Error('Expected a web client with the exact registered loopback redirect');
}
const state = randomBytes(32).toString('base64url');
const verifier = randomBytes(64).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
let handled = false;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, redirect);
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const got = Buffer.from(url.searchParams.get('state') || '');
  const expected = Buffer.from(state);
  if (handled || got.length !== expected.length || !timingSafeEqual(got, expected)) { res.writeHead(400).end('Invalid or expired request'); return; }
  handled = true;
  try {
    const code = url.searchParams.get('code');
    if (!code) throw Error('Consent not granted');
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: web.client_id, client_secret: web.client_secret, code, code_verifier: verifier,
        grant_type: 'authorization_code', redirect_uri: redirect }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('Token exchange failed');
    const token = await response.json();
    if (!token.refresh_token || !String(token.scope || '').split(' ').includes('https://www.googleapis.com/auth/gmail.send')) throw Error('No refresh token or gmail.send scope');
    const secret = JSON.stringify({ client_id: web.client_id, client_secret: web.client_secret, refresh_token: token.refresh_token });
    const command = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $s=[Console]::In.ReadToEnd(); $b=[Text.Encoding]::UTF8.GetBytes($s); $e=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($e))";
    const encrypted = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { input: secret, encoding: 'utf8', windowsHide: true });
    if (encrypted.status !== 0 || !encrypted.stdout) throw Error('Could not protect credentials');
    const directory = join(process.env.LOCALAPPDATA, 'Bombim00-v2-watchdog');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'gmail-oauth.dpapi'), encrypted.stdout, { flag: 'wx', mode: 0o600 });
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('Authorization completed. You can close this page.');
    console.log('Gmail authorization saved encrypted for the current Windows user. No email was sent.');
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('Authorization was not completed. Return to the assistant.');
    console.log('Authorization was not completed. No credentials were saved.');
  } finally { server.close(); }
});
server.listen(8765, '127.0.0.1', () => {
  const query = new URLSearchParams({ client_id: web.client_id, redirect_uri: redirect, response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send', state, code_challenge: challenge,
    code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' });
  console.log(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
});
setTimeout(() => { console.log('Authorization timed out.'); server.close(); }, 300000).unref();

