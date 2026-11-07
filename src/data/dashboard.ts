import { LotteryCatalogItem } from "../types/lottery";
import { bangkokDateKey } from "./lotteryRepository";

export type DrawState = "drawn" | "pending" | "upcoming";
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
  const descending = state === "pending" || state === "drawn";
  return [...items].sort((a, b) => {
    const ta = drawTimestamp(a, now), tb = drawTimestamp(b, now);
    if (!Number.isFinite(ta)) return Number.isFinite(tb) ? 1 : String(a.name || "").localeCompare(String(b.name || ""), "th");
    if (!Number.isFinite(tb)) return -1;
    return (descending ? tb - ta : ta - tb) || String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

export function dashboardData(items: LotteryCatalogItem[], now = new Date()) {
  const drawn = items.filter((item) => drawState(item, now) === "drawn");
  // Provider rows may receive a new detectedAt timestamp on every poll.
  // The draw schedule, not a repeated fetch time, defines "latest result".
  const latest = sortDailyRows(drawn, "drawn", now).slice(0, 3);
  const upcoming = items
    .filter((item) => drawState(item, now) === "upcoming")
    .sort((a, b) => drawTimestamp(a, now) - drawTimestamp(b, now));
  return {
    latest,
    next: upcoming[0] ?? null,
    drawn: drawn.length,
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
  pending: "ถึงเวลาแล้ว / รอผล",
  upcoming: "ยังไม่ถึงเวลา",
};
