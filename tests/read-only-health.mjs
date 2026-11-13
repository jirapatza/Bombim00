// Read-only production inspection. Never POST, mutate D1, or publish an ntfy message.
const endpoint = process.env.BOMBIM_WORKER_HEALTH_URL ||
  'https://bombim00-lottery-checker.jirapatcip2557.workers.dev/health';

let response;
try {
  response = await fetch(endpoint, {
    method: 'GET',
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
} catch (error) {
  console.error('Worker /health is unreachable:', error.cause?.code || error.message);
  process.exit(1);
}

if (!response.ok) {
  console.error('Worker /health HTTP status:', response.status);
  process.exit(1);
}

let data;
try {
  data = await response.json();
} catch {
  console.error('Worker /health returned invalid JSON');
  process.exit(1);
}

const fields = ['active_uncertain_deliveries', 'old_uncertain_deliveries', 'uncertain_deliveries'];
const valid = typeof data.status === 'string' &&
  fields.every(key => Number.isInteger(data[key]) && data[key] >= 0);

console.log(JSON.stringify({
  http_status: response.status,
  status: data.status ?? null,
  active_uncertain_deliveries: data.active_uncertain_deliveries ?? null,
  old_uncertain_deliveries: data.old_uncertain_deliveries ?? null,
  uncertain_deliveries: data.uncertain_deliveries ?? null,
}, null, 2));

if (!valid) {
  console.error('Worker /health is missing the PR #87 counters or the status field.');
  process.exit(1);
}
if (data.active_uncertain_deliveries + data.old_uncertain_deliveries !== data.uncertain_deliveries) {
  console.error('Worker /health uncertainty counters do not reconcile.');
  process.exit(1);
}
