import { LotteryCatalogItem } from "../types/lottery";
import {
  announceableResults,
  bangkokDayStart,
  bangkokNow,
  closeSlotOn,
  isClosingSoon,
  nextClosing,
  spokenCountdown,
  upcomingSlots,
  DrawSlot,
} from "../data/drawSchedule";

// Announcement planner.
//
// Pure and deterministic: given the catalog and a fixed "now", it returns the
// list of things that should be read out. The React layer only speaks what this
// returns and remembers which keys it already spoke, so a reload, a background
// tab or a slow poll can never repeat an announcement.

export type AnnouncementKind = "closing-soon" | "closed" | "next-draw" | "result";

export interface Announcement {
  /** Stable identity, also the dedupe key: `${kind}:${lotteryId}:${at}` (+ minutes). */
  key: string;
  kind: AnnouncementKind;
  lotteryId: string;
  lotteryName: string;
  at: number;
  minutes?: number;
}

export const WARN_MINUTES = [10, 5] as const;

export const kindLabels: Record<AnnouncementKind, string> = {
  "closing-soon": "ใกล้ปิดรับ",
  closed: "ปิดรับแล้ว",
  "next-draw": "รายการถัดไป",
  result: "ประกาศผล",
};

const timeLabel = (at: number): string => {
  const d = bangkokNow(at);
  return `${String(Math.floor(d.minutes / 60)).padStart(2, "0")}:${String(d.minutes % 60).padStart(2, "0")} น.`;
};

/** The smallest warning window that still contains `now`, or null when not close. */
export function activeWarning(target: number, now: number): number | null {
  let found: number | null = null;
  for (const minutes of WARN_MINUTES) {
    if (isClosingSoon(target, now, minutes)) found = minutes;
  }
  return found;
}

/**
 * Everything worth saying at `now`, in speaking order:
 * imminent closes, closes that just passed, results that are out, then the
 * next draw after that.
 */
export function planAnnouncements(
  items: LotteryCatalogItem[],
  now: number = Date.now(),
): Announcement[] {
  const out: Announcement[] = [];
  const dayStart = bangkokDayStart(now);

  for (const item of items) {
    const slot = closeSlotOn(item, dayStart);
    if (!slot) continue;

    if (now >= slot.closeAt && now < slot.drawAt) {
      // Once the numbers are out, the result announcement replaces "closed":
      // saying both would send two notifications for the same draw.
      const resultIsOut = announceableResults(items, now).some((r) => r.id === item.id);
      if (resultIsOut) continue;
      out.push({
        key: `closed:${item.id}:${slot.closeAt}`,
        kind: "closed",
        lotteryId: item.id,
        lotteryName: item.name,
        at: slot.closeAt,
      });
      continue;
    }

    if (now < slot.closeAt) {
      const minutes = activeWarning(slot.closeAt, now);
      if (minutes !== null) {
        out.push({
          key: `closing-soon:${item.id}:${slot.closeAt}:${minutes}`,
          kind: "closing-soon",
          lotteryId: item.id,
          lotteryName: item.name,
          at: slot.closeAt,
          minutes,
        });
      }
    }
  }

  for (const result of announceableResults(items, now)) {
    out.push({
      key: `result:${result.id}:${result.resultDate}`,
      kind: "result",
      lotteryId: result.id,
      lotteryName: result.name,
      at: now,
    });
  }

  // The line-up after the current one, so the announcer can say what comes next.
  // Only spoken alongside a close, a closed item or a result: on its own it would
  // repeat on every tick.
  if (out.length > 0) {
    const queue = closingQueue(items, now, 2);
    const imminent = out.find((a) => a.kind === "closing-soon" || a.kind === "closed");
    for (const slot of queue) {
      if (imminent && slot.closeAt === imminent.at) continue;
      // Same lottery on a later day is not a new line-up item worth announcing.
      if (imminent && slot.id === imminent.lotteryId) continue;
      out.push({
        key: `next-draw:${slot.id}:${slot.closeAt}`,
        kind: "next-draw",
        lotteryId: slot.id,
        lotteryName: slot.name,
        at: slot.closeAt,
      });
      break;
    }
  }

  const rank: Record<AnnouncementKind, number> = {
    "closing-soon": 0,
    closed: 1,
    result: 2,
    "next-draw": 3,
  };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.at - b.at);
}

/** Thai sentence for one announcement. */
export function announcementText(
  announcement: Announcement,
  items: LotteryCatalogItem[],
  now: number = Date.now(),
): string {
  const item = items.find((i) => i.id === announcement.lotteryId);
  const closeLabel = timeLabel(announcement.at);

  switch (announcement.kind) {
    case "closing-soon": {
      const remaining = spokenCountdown(announcement.at, now);
      const first = item ? `${item.name}` : announcement.lotteryName;
      return `แจ้งเตือน ${first} ปิดรับภายใน ${remaining} ครับ ปิดรับเวลา ${closeLabel}`;
    }
    case "closed":
      return `${announcement.lotteryName} ปิดรับแล้ว ครับ ปิดรับเวลา ${closeLabel} รอประกาศผลรางวัล`;
    case "next-draw": {
      return `รายการถัดไปคือ ${announcement.lotteryName} ครับ ปิดรับเวลา ${closeLabel}`;
    }
    case "result": {
      const result = announceableResults(items, now).find((r) => r.id === announcement.lotteryId);
      const numbers = result?.numbers || (item ? [item.firstPrize && `รางวัลที่ 1 ${item.firstPrize}`, item.top3 && `สามตัวบน ${item.top3}`, item.bottom2 && `สองตัวล่าง ${item.bottom2}`].filter(Boolean).join(" ") : "");
      return numbers ? `ประกาศผล ${announcement.lotteryName} ครับ ${numbers}` : `ประกาศผล ${announcement.lotteryName} ครับ`;
    }
    default:
      return "";
  }
}

/** One-line status for the banner: what closes next and in how long. */
export function closingHeadline(
  items: LotteryCatalogItem[],
  now: number = Date.now(),
): { slot: DrawSlot; text: string } | null {
  const slot = nextClosing(items, now);
  if (!slot) return null;
  return { slot, text: `${slot.name} ปิดรับใน ${spokenCountdown(slot.closeAt, now)}` };
}

/** The queue of closes for the settings panel, soonest first. */
export function closingQueue(
  items: LotteryCatalogItem[],
  now: number = Date.now(),
  limit = 5,
): DrawSlot[] {
  return items
    .flatMap((item) => upcomingSlots(item, now, 2))
    .sort((a, b) => a.closeAt - b.closeAt)
    .slice(0, limit);
}

/** Dedupe helper shared by the React layer and its tests. */
export function unseenAnnouncements(
  planned: Announcement[],
  seen: Iterable<string>,
): Announcement[] {
  const already = new Set(seen);
  return planned.filter((a) => !already.has(a.key));
}
