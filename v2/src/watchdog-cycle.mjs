import { classifyHealth } from './watchdog.mjs';

// Adapters are deliberately injected: a production implementation needs
// independently scheduled execution and an atomic durable claim store.
export async function runWatchdog({ readHealth, claimAlert, finishAlert, resolve, sendAlert, now = Date.now() }) {
  let check;
  try {
    const result = await readHealth();
    check = classifyHealth(result.status, result.body, now);
  } catch {
    check = { state: 'unreachable' };
  }
  if (check.state === 'healthy') {
    if (resolve) await resolve();
    return { state: 'healthy' };
  }
  // A claim must persist before sending; the store must not reissue a claim
  // with an ambiguous sending outcome without operator reconciliation.
  const claim = await claimAlert(check.state);
  if (!claim) return { state: check.state, alert: 'already_claimed' };
  let outcome;
  try { outcome = await sendAlert(check.state); }
  catch { outcome = { status: 'uncertain' }; }
  const allowed = new Set(['accepted', 'rejected', 'authentication_error', 'configuration_error', 'uncertain']);
  const status = allowed.has(outcome?.status) ? outcome.status : 'uncertain';
  await finishAlert(claim, status);
  return { state: check.state, alert: status };
}
