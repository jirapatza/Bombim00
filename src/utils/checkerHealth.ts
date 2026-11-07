/**
 * Distinguishes a successful browser fetch from a healthy server-side checker.
 * A fresh HTTP response can still contain stale runtime-live data.
 */
export type ConnectionHealth =
  | "offline"
  | "load-error"
  | "connecting"
  | "checker-stale"
  | "checker-unhealthy"
  | "connected";

/** Accept only server heartbeats within the past 15 minutes (with 60s clock skew). */
export function checkerHeartbeatFresh(lastRunTimestamp: string, now = Date.now()): boolean {
  const lastRun = Date.parse(lastRunTimestamp);
  return Number.isFinite(lastRun) && lastRun <= now + 60_000 && now - lastRun <= 15 * 60_000;
}

/**
 * Classify the current connection without conflating browser fetch success
 * with the server checker heartbeat. A missing, invalid, future or older-than-
 * 15-minute heartbeat cannot confirm that the checker is current.
 * Offline and fetch errors take precedence over the checker state.
 */
export function connectionHealth(
  online: boolean,
  lastSynced: string,
  liveDataError: boolean,
  lastRunTimestamp: string,
  checkerStatus: string,
  now = Date.now(),
): ConnectionHealth {
  if (!online) return "offline";
  if (liveDataError) return "load-error";
  if (!lastSynced) return "connecting";

  if (!checkerHeartbeatFresh(lastRunTimestamp, now)) return "checker-stale";
  if (checkerStatus !== "healthy") return "checker-unhealthy";
  return "connected";
}

export const connectionLabels: Record<ConnectionHealth, string> = {
  offline: "ออฟไลน์",
  "load-error": "โหลดไม่สำเร็จ",
  connecting: "กำลังเชื่อมต่อ",
  "checker-stale": "ตัวตรวจผลล่าช้า",
  "checker-unhealthy": "ระบบตรวจผลผิดปกติ",
  connected: "เชื่อมต่อแล้ว",
};
