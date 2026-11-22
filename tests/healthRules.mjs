/**
 * Liveness rules for the scheduled production watchdog.
 *
 * The committed status file is public, so the watchdog needs no Cloudflare
 * Access credentials to notice that the checker stopped running. It fails on a
 * stale heartbeat and on a delivery that needs a human, and only reports a
 * degraded status as a note: provider timeouts and pending second-source
 * evidence are routine and would otherwise keep the alarm permanently red.
 */
export const DEFAULT_MAX_AGE_MS = 20 * 60 * 1000;

export function assessStatus(status, now = Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS) {
  const reasons = [], notes = [];
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    return { ok: false, reasons: ['status_missing'], notes, ageMs: null };
  }
  const at = Date.parse(status.last_run_timestamp);
  const ageMs = Number.isFinite(at) ? now - at : null;
  if (!Number.isFinite(at)) reasons.push('heartbeat_invalid');
  else if (at > now + 60_000) reasons.push('heartbeat_in_future');
  else if (ageMs > maxAgeMs) reasons.push('heartbeat_stale');
  if (Number(status.notification_failures) > 0) reasons.push('notification_failures');
  if (Number(status.active_uncertain_deliveries) > 0) reasons.push('active_uncertain_deliveries');
  if (status.system_status !== 'healthy') notes.push(`system_${status.system_status || 'unknown'}`);
  return { ok: reasons.length === 0, reasons, notes, ageMs };
}
