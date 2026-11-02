export type ScheduledLottery = {
  id?: string;
  name?: string;
  category?: string;
  drawDays?: string;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
type Weekday = (typeof WEEKDAYS)[number];

const THAI_DAY_NAMES: Record<string, Weekday> = {
  'อาทิตย์': 'Sun',
  'จันทร์': 'Mon',
  'อังคาร': 'Tue',
  'พุธ': 'Wed',
  'พฤหัส': 'Thu',
  'พฤหัสบดี': 'Thu',
  'ศุกร์': 'Fri',
  'เสาร์': 'Sat',
};

function getBangkokDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(date);

  return {
    day: Number(parts.find((part) => part.type === 'day')?.value || 1),
    weekday: (parts.find((part) => part.type === 'weekday')?.value || 'Mon') as Weekday,
  };
}

function scheduledWeekdays(drawDays: string): Weekday[] | null {
  const rule = String(drawDays || '').trim();
  if (!rule) return null;
  if (/ทุกวัน/u.test(rule)) return [...WEEKDAYS];

  const matches = Object.keys(THAI_DAY_NAMES)
    .sort((a, b) => b.length - a.length)
    .filter((day) => rule.includes(day));
  const days = [...new Set(matches.map((day) => THAI_DAY_NAMES[day]))];
  if (days.length > 0) return days;

  const englishDays: Record<string, Weekday> = {
    sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
  };
  const englishMatches = Object.entries(englishDays)
    .filter(([label]) => new RegExp(label, 'i').test(rule))
    .map(([, day]) => day);
  return englishMatches.length > 0 ? [...new Set(englishMatches)] : null;
}

export function isVipLottery(item: ScheduledLottery): boolean {
  const category = String(item.category ?? '').toLowerCase();
  const id = String(item.id ?? '').toLowerCase();
  const name = String(item.name ?? '');
  return category === 'vip' || /(?:^|[_\\s-])(vip|star)(?:$|[_\\s-])/i.test(id) || /vip|สตาร์|star/i.test(name);
}

/** Regular, non-VIP stock draws use their explicit schedule when one is configured. */
export function isRegularStockLottery(item: ScheduledLottery): boolean {
  if (isVipLottery(item)) return false;
  const category = String(item.category ?? '').toLowerCase();
  const id = String(item.id ?? '').toLowerCase();
  const name = String(item.name ?? '');

  if (['foreign_stock', 'thai_stock', 'other_foreign'].includes(category)) return true;
  if (/stock|nikkei|hangseng|china|taiwan|korea|singapore|india|dowjones|uk|germany|russia|thai_evening/i.test(id)) return true;
  return /หุ้น|นิเคอิ|ฮั่งเส็ง|จีน|ไต้หวัน|เกาหลี|สิงคโปร์|อินเดีย|อังกฤษ|เยอรมัน|รัสเซีย|ดาวโจนส์|ไทยเย็น/u.test(name);
}

export function isGovernmentLottery(item: ScheduledLottery): boolean {
  const category = String(item.category ?? '').toLowerCase();
  const id = String(item.id ?? '').toLowerCase();
  const name = String(item.name ?? '');
  return category === 'gov_savings' || ['thai_gov', 'gsb', 'baac'].includes(id) ||
    /รัฐบาล|สลากกินแบ่ง|ออมสิน|ธ\\s*\\.?\\s*ก\\s*\\.?\\s*ส\\s*\\.?|ธกส/u.test(name);
}

/**
 * Filters the summary table by the selected Bangkok calendar date.
 * VIP products are always visible; all other configured draw-day rules take priority.
 * Regular stocks without an explicit rule fall back to weekdays only.
 */
export function filterLotteriesForDrawDate<T extends ScheduledLottery>(
  lotteries: T[],
  date: Date = new Date(),
): T[] {
  const { day, weekday } = getBangkokDateParts(date);

  return lotteries.filter((item) => {
    if (isGovernmentLottery(item)) {
      const id = String(item.id ?? '').trim().toLowerCase();
      const name = String(item.name ?? '').trim();
      const isBaac = id === 'baac' || /ธ\\s*\\.?\\s*ก\\s*\\.?\\s*ส\\s*\\.?|ธกส/u.test(name);
      return isBaac ? day === 16 : day === 1 || day === 16;
    }

    // VIP variants are explicitly configured as daily in this application.
    if (isVipLottery(item)) return true;

    // A configured schedule is authoritative, including exceptional Saturday draws.
    const days = scheduledWeekdays(item.drawDays || '');
    if (days) return days.includes(weekday);

    // Without an explicit schedule, regular stocks default to weekdays only.
    if (isRegularStockLottery(item)) return weekday !== 'Sat' && weekday !== 'Sun';

    // Known daily categories without a schedule remain daily; unknown categories hide.
    const category = String(item.category ?? '').toLowerCase();
    if (['hanoi', 'lao'].includes(category)) return true;
    return false;
  });
}
