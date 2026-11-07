import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({
  entryPoints: ["src/utils/checkerHealth.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { connectionHealth, connectionLabels, checkerHeartbeatFresh } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);
const now = Date.parse("2026-11-07T12:50:00Z");

test("fresh server heartbeat is the only green connected state", () => {
  assert.equal(connectionHealth(true, "19:50", false, "2026-11-07T19:49:00+07:00", "healthy", now), "connected");
  assert.equal(connectionLabels.connected, "เชื่อมต่อแล้ว");
});

test("browser fetch success does not hide stale or invalid server heartbeat", () => {
  assert.equal(connectionHealth(true, "19:50", false, "2026-11-07T19:22:59+07:00", "healthy", now), "checker-stale");
  assert.equal(connectionHealth(true, "19:50", false, "", "healthy", now), "checker-stale");
  assert.equal(connectionHealth(true, "19:50", false, "garbage", "healthy", now), "checker-stale");
  assert.equal(connectionHealth(true, "19:50", false, "2026-11-07T19:52:00+07:00", "healthy", now), "checker-stale");
});

test("offline, fetch error and connecting states override server health", () => {
  assert.equal(connectionHealth(false, "19:50", false, "", "healthy", now), "offline");
  assert.equal(connectionHealth(true, "19:50", true, "", "healthy", now), "load-error");
  assert.equal(connectionHealth(true, "", false, "", "healthy", now), "connecting");
});

test("checker reports unhealthy despite fresh heartbeat", () => {
  assert.equal(connectionHealth(true, "19:50", false, "2026-11-07T19:49:00+07:00", "degraded", now), "checker-unhealthy");
  assert.equal(connectionHealth(true, "19:50", false, "2026-11-07T19:35:00+07:00", "healthy", now), "connected");
  assert.equal(connectionHealth(true, "19:50", false, "2026-11-07T19:34:59+07:00", "healthy", now), "checker-stale");
});

test("settings and header share exactly the same checker heartbeat rule", () => {
  assert.equal(checkerHeartbeatFresh("2026-11-07T19:49:00+07:00", now), true);
  assert.equal(checkerHeartbeatFresh("2026-11-07T19:35:00+07:00", now), true);
  assert.equal(checkerHeartbeatFresh("2026-11-07T19:34:59+07:00", now), false);
  assert.equal(checkerHeartbeatFresh("2026-11-07T19:52:00+07:00", now), false);
  assert.equal(checkerHeartbeatFresh("invalid", now), false);
});
