#!/usr/bin/env node
// Read-only credential preflight for existing production resources.
// Usage: node scripts/verify_cloudflare_token.mjs --target pages|worker
// Required: CLOUDFLARE_API_TOKEN (raw token), CLOUDFLARE_ACCOUNT_ID (32 hex).
// Pages: PAGES_PROJECT defaults to bombim00.
// Worker: WORKER_SCRIPT defaults to bombim00-lottery-checker; D1_DATABASE_ID is required.
// Each GET has a 10-second deadline including response-body parsing. No retries,
// redirects, writes, raw API bodies, token values or exception messages are logged.
// A successful read cannot establish that the token has deployment write permissions.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = 'https://api.cloudflare.com/client/v4';
const AUTH_REJECTION = new Set([400, 401, 403]);

export async function runPreflight({
  target,
  env = process.env,
  fetchImpl = globalThis.fetch,
  log = console.log,
  timeoutMs = 10_000,
} = {}) {
  const fail = message => { log(`::error::${message}`); return 1; };
  const token = env.CLOUDFLARE_API_TOKEN;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  if (!['pages', 'worker'].includes(target)) return fail('Specify --target pages or --target worker.');
  if (!token) return fail('Missing CLOUDFLARE_API_TOKEN secret.');
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    return fail('Malformed CLOUDFLARE_API_TOKEN: use the raw API token without Bearer prefix, quotes or whitespace.');
  }
  if (!/^[0-9a-f]{32}$/.test(accountId ?? '')) return fail('CLOUDFLARE_ACCOUNT_ID must contain 32 lowercase hex characters.');
  const project = env.PAGES_PROJECT ?? 'bombim00';
  const worker = env.WORKER_SCRIPT ?? 'bombim00-lottery-checker';
  const database = env.D1_DATABASE_ID ?? '';
  if (target === 'pages' && !/^[a-z0-9][a-z0-9-]*$/.test(project)) return fail('Invalid PAGES_PROJECT.');
  if (target === 'worker') {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(worker)) return fail('Invalid WORKER_SCRIPT.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(database)) {
      return fail('Worker preflight requires a valid D1_DATABASE_ID UUID.');
    }
  }

  // Do not interpolate API messages or environment values into GitHub annotations.
  async function request(label, path) {
    const controller = new AbortController();
    let timer;
    let timedOut = false;
    let status;
    try {
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(new Error('deadline'));
        }, timeoutMs);
      });
      const result = await Promise.race([
        (async () => {
          const response = await fetchImpl(`${API}${path}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
            redirect: 'error',
            signal: controller.signal,
          });
          status = response.status;
          const body = await response.json();
          const codes = Array.isArray(body?.errors)
            ? body.errors.map(error => error?.code).filter(Number.isSafeInteger).slice(0, 5).join(',')
            : '';
          const detail = `HTTP ${status}, codes ${codes || 'none'}`;
          const valid = body?.success === true && body.result !== null
            && typeof body.result === 'object' && !Array.isArray(body.result);
          return {
            ok: response.ok && valid,
            status,
            result: body?.result,
            message: `${label} failed (${detail}); check token, account and resource access.`,
          };
        })(),
        deadline,
      ]);
      return result;
    } catch {
      return {
        ok: false,
        // Only parsed authentication rejections qualify for token-type fallback.
        message: `${label} ${timedOut ? 'timed out' : status === undefined ? 'network request failed' : `returned invalid JSON (HTTP ${status})`}.`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  const base = `/accounts/${accountId}`;
  let verified = await request('User token verification', '/user/tokens/verify');
  // Account-owned tokens have a separate verification endpoint. Never hide a
  // timeout, a malformed response, an inactive token or an upstream failure.
  if (!verified.ok && AUTH_REJECTION.has(verified.status)) {
    log(`::notice::${verified.message} Trying account-owned token verification.`);
    verified = await request('Account token verification', `${base}/tokens/verify`);
  }
  if (!verified.ok) return fail(verified.message);
  if (verified.result.status !== 'active') return fail('Token verification did not report an active token.');
  log('::notice::Token verification passed.');

  const checks = target === 'pages'
    ? [['Pages project', `${base}/pages/projects/${encodeURIComponent(project)}`]]
    : [
      ['Worker script settings', `${base}/workers/scripts/${encodeURIComponent(worker)}/script-settings`],
      ['D1 database', `${base}/d1/database/${database}`],
    ];
  for (const [label, path] of checks) {
    const response = await request(label, path);
    if (!response.ok) return fail(response.message);
    log(`::notice::${label} readable.`);
  }
  log('::notice::Cloudflare read-only preflight passed; this does not prove deployment write permissions.');
  return 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  process.exitCode = await runPreflight({ target: args.length === 2 && args[0] === '--target' ? args[1] : undefined });
}
