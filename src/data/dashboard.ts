import { LotteryCatalogItem } from "../types/lottery";
import { bangkokDateKey } from "./lotteryRepository";

export type DrawState = "drawn" | "latest" | "pending" | "upcoming";
export function drawTimestamp(
  item: LotteryCatalogItem,
  now = new Date(),
): number {
  const match = item.drawTimeStr.match(/(\d{1,2})[:.](\d{2})/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return NaN;
  return Date.parse(
    `${bangkokDateKey(now)}T${match[1].padStart(2, "0")}:${match[2]}:00+07:00`,
  );
}
export function drawState(
  item: LotteryCatalogItem,
  now = new Date(),
): DrawState {
  const at = drawTimestamp(item, now);
  // A result cannot be announced on the dashboard before its scheduled draw.
  // This also protects against stale or prematurely published upstream rows.
  if (!Number.isFinite(at)) return "pending";
  if (at > now.getTime()) return "upcoming";
  if (item.status === "drawn" && item.resultDate === bangkokDateKey(now))
    return "drawn";
  // A stored result from an earlier draw is shown as the latest known result,
  // never as today's announcement.
  if (item.status === "drawn" && item.resultDate) return "latest";
  return "pending";
}
// Keep summary/share views behind the same Bangkok draw-time gate as the dashboard.
export function publishedSummaryResults(items: LotteryCatalogItem[], now = new Date()): LotteryCatalogItem[] {
  return items.filter((item) => drawState(item, now) === "drawn");
}

// All rows follow the day's schedule. A filtered list of overdue or announced
// draws starts with the most recent scheduled draw, not an old midnight entry.
export function sortDailyRows(
  items: LotteryCatalogItem[],
  state: DrawState | "all" = "all",
  now = new Date(),
): LotteryCatalogItem[] {
  const descending = state === "pending" || state === "drawn" || state === "latest";
  return [...items].sort((a, b) => {
    const ta = drawTimestamp(a, now), tb = drawTimestamp(b, now);
    if (!Number.isFinite(ta)) return Number.isFinite(tb) ? 1 : String(a.name || "").localeCompare(String(b.name || ""), "th");
    if (!Number.isFinite(tb)) return -1;
    return (descending ? tb - ta : ta - tb) || String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

// Results stored from an earlier draw, newest first, used to fill the panel
// before the first draw of the day (and between draws). An item that has not
// drawn yet today still has a last known result, so this cannot rely on
// drawState: a 23:00 lottery is "upcoming" all evening.
function previousResults(items: LotteryCatalogItem[], now = new Date()): LotteryCatalogItem[] {
  const today = bangkokDateKey(now);
  return items
    .filter((item) => item.status === "drawn" && item.resultDate && item.resultDate < today)
    .sort((a, b) =>
      String(b.resultDate).localeCompare(String(a.resultDate)) ||
      drawTimestamp(b, now) - drawTimestamp(a, now));
}

export function dashboardData(items: LotteryCatalogItem[], now = new Date()) {
  const drawn = items.filter((item) => drawState(item, now) === "drawn");
  // Provider rows may receive a new detectedAt timestamp on every poll.
  // The draw schedule, not a repeated fetch time, defines "latest result".
  const latestIsToday = drawn.length > 0;
  const latest = [...sortDailyRows(drawn, "drawn", now), ...previousResults(items, now)].slice(0, 3);
  const upcoming = items
    .filter((item) => drawState(item, now) === "upcoming")
    .sort((a, b) => drawTimestamp(a, now) - drawTimestamp(b, now));
  return {
    latest,
    latestIsToday,
    next: upcoming[0] ?? null,
    drawn: drawn.length,
    latestResults: items.filter((item) => drawState(item, now) === "latest").length,
    pending: items.filter((item) => drawState(item, now) === "pending").length,
    upcoming: upcoming.length,
  };
}
export function countdown(target: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(" : ");
}
export const stateLabels: Record<DrawState, string> = {
  drawn: "ประกาศผลแล้ว",
  latest: "ผลล่าสุด",
  pending: "ถึงเวลาแล้ว / รอผล",
  upcoming: "ยังไม่ถึงเวลา",
};
