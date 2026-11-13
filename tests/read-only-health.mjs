// Read-only production /health inspection. Never POST, modify D1, or publish ntfy.
// A confirmed Cloudflare Access sign-in is an explicitly reported SKIP, not a health pass.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const endpoint = process.env.BOMBIM_WORKER_HEALTH_URL ||
  'https://bombim00-lottery-checker.jirapatcip2557.workers.dev/health';
const marker = '\n__BOMBIM_FINAL_URL__=';
let raw;
try {
  raw = execFileSync('curl', [
    '--silent', '--show-error', '--fail-with-body', '--location', '--max-redirs', '3',
    '--proto-redir', '=https', '--max-time', '20',
    '--retry', '2', '--retry-delay', '1', '--header', 'Accept: application/json',
    '--write-out', marker + '%{url_effective}',
    endpoint,
  ], { encoding: 'utf8', timeout: 70000 });
} catch (error) {
  console.error('Worker /health GET failed:', String(error.stderr || error.message).slice(0, 600));
  process.exit(1);
}

const index = raw.lastIndexOf(marker);
if (index < 0) {
  console.error('Worker /health GET did not include the final redirect URL.');
  process.exit(1);
}
const body = raw.slice(0, index);
let finalUrl;
try {
  finalUrl = new URL(raw.slice(index + marker.length).trim());
} catch {
  console.error('Worker /health returned an invalid final redirect URL.');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(body);
} catch {
  const originHost = new URL(endpoint).hostname;
  const accessHost = finalUrl.hostname.endsWith('.cloudflareaccess.com');
  const accessPath = finalUrl.hostname === originHost &&
    finalUrl.pathname.startsWith('/cdn-cgi/access/');
  const loginDocument = /<html(?:\s|>)/i.test(body) && /<head(?:\s|>)/i.test(body) &&
    /<title>\s*Sign in[^<]{0,100}Cloudflare Access\s*<\/title>/i.test(body);

  if (finalUrl.protocol === 'https:' && (accessHost || accessPath) && loginDocument) {
    console.log('::warning::HEALTH_SKIPPED_ACCESS: /health requires Cloudflare Access authentication; status and counters were not verified.');
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        'Production /health: SKIPPED — confirmed Cloudflare Access login. Status/counters not verified.\n');
    }
    process.exit(0);
  }
  console.error('Worker /health returned non-JSON that was not a verified Cloudflare Access login.');
  process.exit(1);
}

const fields = ['active_uncertain_deliveries', 'old_uncertain_deliveries', 'uncertain_deliveries'];
const valid = typeof data.status === 'string' &&
  fields.every(key => Number.isInteger(data[key]) && data[key] >= 0);
console.log(JSON.stringify({
  status: data.status ?? null,
  active_uncertain_deliveries: data.active_uncertain_deliveries ?? null,
  old_uncertain_deliveries: data.old_uncertain_deliveries ?? null,
  uncertain_deliveries: data.uncertain_deliveries ?? null,
}, null, 2));
if (!valid) {
  console.error('Worker /health is missing the PR #87 counters or status.');
  process.exit(1);
}
if (data.active_uncertain_deliveries + data.old_uncertain_deliveries !== data.uncertain_deliveries) {
  console.error('Worker /health uncertainty counters do not reconcile.');
  process.exit(1);
}
