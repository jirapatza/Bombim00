// Read-only /health inspection. No POST, no ntfy messages, no D1 writes.
// curl uses the runner's proxy and CA configuration when Node fetch cannot connect.
import { execFileSync } from 'node:child_process';

const endpoint = process.env.BOMBIM_WORKER_HEALTH_URL ||
  'https://bombim00-lottery-checker.jirapatcip2557.workers.dev/health';

let raw;
try {
  raw = execFileSync('curl', [
    '--silent', '--show-error', '--fail-with-body', '--location', '--max-redirs', '3', '--proto-redir', '=https', '--max-time', '20',
    '--retry', '2', '--retry-delay', '1', '--header', 'Accept: application/json',
    endpoint,
  ], { encoding: 'utf8', timeout: 70000 });
} catch (error) {
  console.error('Worker /health GET failed:', String(error.stderr || error.message).slice(0, 600));
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch {
  if (raw.includes('Cloudflare Access')) {
    console.error('ACCESS_PROTECTED: Cloudflare Access requires sign-in for /health; no bypass attempted.');
    process.exit(1);
  }
  console.error('Worker /health returned invalid JSON, first chars:', raw.slice(0, 140));
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
