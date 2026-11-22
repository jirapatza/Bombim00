// Scheduled production watchdog. Reads public files only: no token, no writes.
// The committed status heartbeat is the liveness signal, so a checker that dies
// silently turns this job red instead of staying invisible behind Cloudflare Access.
import { appendFileSync } from 'node:fs';
import { assessStatus } from './healthRules.mjs';

const STATUS_URL = process.env.BOMBIM_STATUS_URL ||
  'https://raw.githubusercontent.com/jirapatza/Bombim00/runtime-live/status/status.json';
const HEALTH_URL = process.env.BOMBIM_WORKER_HEALTH_URL ||
  'https://bombim00-lottery-checker.jirapatcip2557.workers.dev/health';
const maxAgeMs = (Number(process.env.BOMBIM_MAX_HEARTBEAT_AGE_MIN) || 20) * 60_000;

const lines = [];
const problems = [];
const report = () => {
  const text = lines.join('\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
};

async function getJson(url, headers = {}) {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}v=${Date.now()}`, {
    headers: { Accept: 'application/json', ...headers },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

try {
  const status = await getJson(STATUS_URL);
  const verdict = assessStatus(status, Date.now(), maxAgeMs);
  const ageMinutes = verdict.ageMs === null ? 'unknown' : (verdict.ageMs / 60_000).toFixed(1);
  lines.push(`Public status heartbeat: ${status.last_run_timestamp || 'missing'} (${ageMinutes} min ago, limit ${maxAgeMs / 60_000})`);
  lines.push(`system_status: ${status.system_status || 'unknown'}; ` +
    `notification_failures: ${status.notification_failures ?? 'n/a'}; ` +
    `active_uncertain_deliveries: ${status.active_uncertain_deliveries ?? 'n/a'}; ` +
    `total_checks: ${status.total_checks ?? 'n/a'}`);
  if (status.status_message) lines.push(`message: ${status.status_message}`);
  for (const note of verdict.notes) lines.push(`note: ${note} (reported, not a failure)`);
  if (!verdict.ok) problems.push(...verdict.reasons.map(reason => `status: ${reason}`));
} catch (error) {
  problems.push(`status: unreadable (${String(error.message).slice(0, 200)})`);
}

const clientId = process.env.CF_ACCESS_CLIENT_ID, clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
if (clientId && clientSecret) {
  try {
    const health = await getJson(HEALTH_URL, { 'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret });
    const counters = ['active_uncertain_deliveries', 'old_uncertain_deliveries', 'uncertain_deliveries'];
    const valid = typeof health.status === 'string' && counters.every(key => Number.isInteger(health[key]) && health[key] >= 0);
    lines.push(`Worker /health: ${health.status}; uncertain ${health.uncertain_deliveries} ` +
      `(active ${health.active_uncertain_deliveries}, old ${health.old_uncertain_deliveries})`);
    if (!valid) problems.push('health: missing counters');
    else if (health.active_uncertain_deliveries + health.old_uncertain_deliveries !== health.uncertain_deliveries) {
      problems.push('health: counters do not reconcile');
    }
  } catch (error) {
    problems.push(`health: unreadable (${String(error.message).slice(0, 200)})`);
  }
} else {
  lines.push('Worker /health: SKIPPED — set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET to verify Access-protected counters.');
}

report();
if (problems.length) {
  console.error(`Watchdog failed: ${problems.join('; ')}`);
  process.exit(1);
}
console.log('Watchdog passed.');
