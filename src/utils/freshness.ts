const THAI_MONTHS: Record<string, number> = {
  "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
  "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
  มกราคม: 1, กุมภาพันธ์: 2, มีนาคม: 3, เมษายน: 4, พฤษภาคม: 5, มิถุนายน: 6,
  กรกฎาคม: 7, สิงหาคม: 8, กันยายน: 9, ตุลาคม: 10, พฤศจิกายน: 11, ธันวาคม: 12,
};

export interface ThaiDate {
  year: number;
  month: number;
  day: number;
}

const THAI_MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function parseThaiDate(text: string): ThaiDate | null {
  // The checker writes ISO for a draw it has just detected and Thai for stored
  // history, so both shapes reach the dashboard.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  const match = /(\d{1,2})\s+(\S+)\s+(\d{4})/.exec(text);
  const month = match && THAI_MONTHS[match[2]];
  if (!match || !month) return null;
  const year = Number(match[3]);
  return { year: year > 2400 ? year - 543 : year, month, day: Number(match[1]) };
}

/** Same date, always written the way the rest of the dashboard writes it. */
export function formatThaiDate(text: string): string {
  const parsed = parseThaiDate(text);
  if (!parsed) return text;
  return `${parsed.day} ${THAI_MONTH_NAMES[parsed.month - 1]} ${parsed.year + 543}`;
}

// Longest wait a source can legitimately take between two draws of this item.
export function expectedGapDays(drawDays: string): number {
  if (drawDays.includes("ทุกวัน")) return 1;
  if (/จันทร์\s*-\s*ศุกร์|อังคาร\s*-\s*เสาร์/.test(drawDays)) return 3;
  if (drawDays.includes("จันทร์, พุธ, ศุกร์")) return 3;
  if (drawDays.includes("ตามประกาศ")) return 16;
  return 3;
}

export interface Freshness {
  days: number;
  stale: boolean;
  label: string;
}

// The dashboard speaks Asia/Bangkok everywhere, so "today" must mean that
// calendar day even when the device sits in another timezone.
const bangkokDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
});

export function bangkokDayNumber(now: Date): number {
  const parts = bangkokDate.formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(value("year"), value("month") - 1, value("day")) / 86_400_000;
}

export function assessFreshness(dateText: string, drawDays: string, today: Date): Freshness | null {
  const parsed = parseThaiDate(dateText);
  if (!parsed) return null;
  const days = Math.round(bangkokDayNumber(today) - Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86_400_000);
  if (!Number.isFinite(days)) return null;
  return {
    days,
    // One extra day of tolerance: a source usually publishes the morning after.
    stale: days > expectedGapDays(drawDays) + 1,
    label: days <= 0 ? "วันนี้" : `${days} วันก่อน`,
  };
}
