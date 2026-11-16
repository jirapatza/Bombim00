import { LotteryCatalogItem } from "../types/lottery";
import { drawState } from "./dashboard";
import { bangkokDateKey } from "./lotteryRepository";

// Pure schedule rules for the in-app announcer.
//
// Kept free of React, the DOM and the speech engine so every rule can be
// unit-tested against a fixed "now". Nothing here touches the runtime data
// branch, the Worker or the Python checker.

export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const DAY_NAMES = /(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์)/g;
const DAY_RANGE = /(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์)\s*-\s*(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์)/;

export interface BangkokNow {
  year: number;
  month: number;
  day: number;
  weekday: number;
  minutes: number;
  seconds: number;
  secondsOfDay: number;
  dateKey: string;
  timeLabel: string;
  dayLabel: string;
}

/** Bangkok wall clock, independent of the device time zone. */
export function bangkokNow(at: Date | number = Date.now()): BangkokNow {
  const ms = typeof at === "number" ? at : at.getTime();
  const shifted = new Date(ms + BANGKOK_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const weekday = shifted.getUTCDay();
  const hours = shifted.getUTCHours();
  const minutesOfHour = shifted.getUTCMinutes();
  const seconds = shifted.getUTCSeconds();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    year,
    month,
    day,
    weekday,
    minutes: hours * 60 + minutesOfHour,
    seconds,
    secondsOfDay: hours * 3600 + minutesOfHour * 60 + seconds,
    dateKey: `${year}-${pad(month)}-${pad(day)}`,
    timeLabel: `${pad(hours)}:${pad(minutesOfHour)}:${pad(seconds)}`,
    dayLabel: `วัน${THAI_DAYS[weekday]}`,
  };
}

/** Bangkok midnight expressed on the same UTC scale as Date.now(). */
export function bangkokDayStart(at: Date | number = Date.now()): number {
  const p = bangkokNow(at);
  return Date.UTC(p.year, p.month - 1, p.day) - BANGKOK_OFFSET_MS;
}

/** "08:30 น." / "8.30" / "08:30" -> minutes after Bangkok midnight. */
export function parseClock(value: string | undefined): number | null {
  const match = (value ?? "").match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * "จันทร์ - ศุกร์" and friends -> the Bangkok weekdays it covers.
 * null means every day, either because the catalog says so or because the
 * rule is free-form text such as "ตามประกาศวันงวดจริง (อาจเลื่อน)".
 */
export function parseDrawDays(rule: string | undefined): Set<number> | null {
  const text = (rule ?? "").trim();
  if (!text || text.includes("ทุกวัน")) return null;
  const unique = [...new Set([...text.matchAll(DAY_NAMES)].map((m) => THAI_DAYS.indexOf(m[1])))].filter(
    (d) => d >= 0,
  );
  if (!unique.length) return null;
  const range = text.match(DAY_RANGE);
  if (range) {
    let cursor = THAI_DAYS.indexOf(range[1]);
    const to = THAI_DAYS.indexOf(range[2]);
    do {
      unique.push(cursor);
      cursor = (cursor + 1) % 7;
    } while (cursor !== (to + 1) % 7);
  }
  return new Set(unique);
}

export interface DrawSlot {
  id: string;
  name: string;
  categoryLabel: string;
  drawAt: number;
  closeAt: number;
  minutesUntilClose: number;
}

/**
 * Scheduled close and draw of a lottery on one Bangkok day.
 * Returns null when the item has no usable schedule, or does not draw that day.
 */
export function closeSlotOn(
  item: LotteryCatalogItem,
  dayStart: number,
): { drawAt: number; closeAt: number } | null {
  const close = parseClock(item.closeTimeStr);
  const draw = parseClock(item.drawTimeStr);
  if (close === null || draw === null) return null;
  const allowed = parseDrawDays(item.drawDays);
  const weekday = new Date(dayStart + BANGKOK_OFFSET_MS).getUTCDay();
  if (allowed && !allowed.has(weekday)) return null;
  // A closing time after the draw would mean a negative selling window.
  const closeMinutes = Math.min(close, draw);
  return { drawAt: dayStart + draw * 60_000, closeAt: dayStart + closeMinutes * 60_000 };
}

/** Upcoming closes for one lottery, soonest first, walking forward a week. */
export function upcomingSlots(
  item: LotteryCatalogItem,
  now: number = Date.now(),
  limit = 3,
): DrawSlot[] {
  const out: DrawSlot[] = [];
  const start = bangkokDayStart(now);
  for (let d = 0; d < 8 && out.length < limit; d += 1) {
    const slot = closeSlotOn(item, start + d * DAY_MS);
    if (!slot || slot.closeAt <= now) continue;
    out.push({
      id: item.id,
      name: item.name,
      categoryLabel: item.categoryLabel,
      drawAt: slot.drawAt,
      closeAt: slot.closeAt,
      minutesUntilClose: Math.max(0, Math.round((slot.closeAt - now) / 60_000)),
    });
  }
  return out.sort((a, b) => a.closeAt - b.closeAt).slice(0, limit);
}

/** The next lottery to close across the whole catalog. */
export function nextClosing(
  items: LotteryCatalogItem[],
  now: number = Date.now(),
): DrawSlot | null {
  let best: DrawSlot | null = null;
  for (const item of items) {
    const slot = upcomingSlots(item, now, 1)[0];
    if (slot && (!best || slot.closeAt < best.closeAt)) best = slot;
  }
  return best;
}

/** The following closes after the current one, so the announcer can preview them. */
export function followingClosings(
  items: LotteryCatalogItem[],
  now: number = Date.now(),
  count = 2,
): DrawSlot[] {
  return items
    .flatMap((item) => upcomingSlots(item, now, count + 1))
    .sort((a, b) => a.closeAt - b.closeAt)
    .slice(0, count);
}

/** Countdown label: "1:05:09", "12:34", or "45 วินาที" inside the last minute. */
export function countdown(target: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((target - now) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  if (m > 0) return `${m}:${pad(s)}`;
  return `${s} วินาที`;
}

/**
 * A scheduled close is urgent inside its last `minutes` minutes.
 * The boundary is inclusive on both ends, so a 09:20 close still warns at 09:10.
 */
export function isClosingSoon(target: number, now: number, minutes: number): boolean {
  const remaining = (target - now) / 1000;
  return remaining > 0 && remaining <= minutes * 60;
}

/** True once selling has closed but the draw itself has not happened yet. */
export function isBetweenCloseAndDraw(
  item: LotteryCatalogItem,
  now: number = Date.now(),
): boolean {
  const slot = closeSlotOn(item, bangkokDayStart(now));
  if (!slot) return false;
  return now >= slot.closeAt && now < slot.drawAt;
}

/** Spoken countdown in Thai units. */
export function spokenCountdown(target: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((target - now) / 1000));
  if (seconds < 60) return `อีกประมาณ ${seconds} วินาที`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `อีกประมาณ ${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `อีกประมาณ ${hours} ชั่วโมง ${rest} นาที` : `อีกประมาณ ${hours} ชั่วโมง`;
}

export interface AnnouncedResult {
  id: string;
  name: string;
  resultDate: string;
  numbers: string;
}

/**
 * A result may only be read out on the Bangkok draw date it belongs to, after
 * its scheduled draw, and only when at least one number is present. This keeps
 * a stale or prematurely published row from being announced as today's result.
 */
export function announceableResults(
  items: LotteryCatalogItem[],
  now: number = Date.now(),
): AnnouncedResult[] {
  const today = bangkokDateKey(new Date(now));
  return items
    .filter((item) => drawState(item, new Date(now)) === "drawn")
    .map((item) => ({ item, resultDate: item.resultDate ?? item.date }))
    .filter(({ item, resultDate }) => resultDate === today)
    .filter(({ item }) => Boolean(item.top3 || item.bottom2 || item.firstPrize))
    .map(({ item, resultDate }) => ({
      id: item.id,
      name: item.name,
      resultDate,
      numbers: [item.firstPrize && `รางวัลที่ 1 ${item.firstPrize}`, item.top3 && `สามตัวบน ${item.top3}`, item.bottom2 && `สองตัวล่าง ${item.bottom2}`]
        .filter(Boolean)
        .join(" "),
    }));
}
