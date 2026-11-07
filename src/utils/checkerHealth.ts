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

  const lastRun = Date.parse(lastRunTimestamp);
  // Reject missing, invalid, or implausibly future timestamps as well as stale ones.
  if (!Number.isFinite(lastRun) || lastRun > now + 60_000 || now - lastRun > 15 * 60_000)
    return "checker-stale";
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
