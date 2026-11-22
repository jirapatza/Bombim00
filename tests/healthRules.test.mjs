import test from "node:test";
import assert from "node:assert/strict";
import { assessStatus, DEFAULT_MAX_AGE_MS } from "./healthRules.mjs";

const now = Date.parse("2026-11-22T14:00:00Z");
const fresh = {
  system_status: "healthy",
  last_run_timestamp: "2026-11-22T20:58:00+07:00",
  notification_failures: 0,
  active_uncertain_deliveries: 0,
};

test("a fresh healthy status passes", () => {
  assert.deepEqual(assessStatus(fresh, now), { ok: true, reasons: [], notes: [], ageMs: 2 * 60_000 });
});

test("a checker that stopped running is a failure, not a skip", () => {
  const stale = { ...fresh, last_run_timestamp: new Date(now - DEFAULT_MAX_AGE_MS - 60_000).toISOString() };
  const verdict = assessStatus(stale, now);
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.reasons, ["heartbeat_stale"]);
});

test("a missing, invalid or future heartbeat fails", () => {
  assert.deepEqual(assessStatus(null, now).reasons, ["status_missing"]);
  assert.deepEqual(assessStatus({ ...fresh, last_run_timestamp: "not-a-date" }, now).reasons, ["heartbeat_invalid"]);
  assert.deepEqual(assessStatus({ ...fresh, last_run_timestamp: new Date(now + 5 * 60_000).toISOString() }, now).reasons,
    ["heartbeat_in_future"]);
});

test("a failed or ambiguous delivery raises the alarm", () => {
  assert.deepEqual(assessStatus({ ...fresh, notification_failures: 2 }, now).reasons, ["notification_failures"]);
  assert.deepEqual(assessStatus({ ...fresh, active_uncertain_deliveries: 1 }, now).reasons,
    ["active_uncertain_deliveries"]);
});

test("a degraded status is reported but does not fail on its own", () => {
  const verdict = assessStatus({ ...fresh, system_status: "degraded" }, now);
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.notes, ["system_degraded"]);
});

test("the age limit is configurable", () => {
  const old = { ...fresh, last_run_timestamp: new Date(now - 30 * 60_000).toISOString() };
  assert.equal(assessStatus(old, now).ok, false);
  assert.equal(assessStatus(old, now, 45 * 60_000).ok, true);
});
