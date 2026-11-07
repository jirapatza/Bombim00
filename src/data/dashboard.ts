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
  if (item.status === "drawn" && item.resultDate === bangkokDateKey(now))
    return "drawn";
  const at = drawTimestamp(item, now);
  return !Number.isFinite(at) || at <= now.getTime() ? "pending" : "upcoming";
}
export function dashboardData(items: LotteryCatalogItem[], now = new Date()) {
  const drawn = items.filter((item) => drawState(item, now) === "drawn");
  const latest = [...drawn]
    .sort(
      (a, b) =>
        (Date.parse(b.detectedAt || "") || drawTimestamp(b, now) || 0) -
          (Date.parse(a.detectedAt || "") || drawTimestamp(a, now) || 0) ||
        (drawTimestamp(b, now) || 0) - (drawTimestamp(a, now) || 0),
    )
    .slice(0, 3);
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
  pending: "กำลังรอผล",
  upcoming: "ยังไม่ถึงเวลา",
};
