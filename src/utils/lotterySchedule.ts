export type ScheduledLottery = {
  id?: string;
  name?: string;
  category?: string;
  drawDays?: string;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
type Weekday = (typeof WEEKDAYS)[number];

const THAI_DAY_NAMES: Record<string, Weekday> = {
  'อาทิตย์': 'Sun', 'จันทร์': 'Mon', 'อังคาร': 'Tue', 'พุธ': 'Wed',
  'พฤหัสบดี': 'Thu', 'พฤหัส': 'Thu', 'ศุกร์': 'Fri', 'เสาร์': 'Sat',
};

function getBangkokDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', day: 'numeric', weekday: 'short',
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

  const thaiEntries = Object.entries(THAI_DAY_NAMES).sort((a, b) => b[0].length - a[0].length);
  const tokens: Array<{ index: number; end: number; day: Weekday }> = [];
  for (let i = 0; i < rule.length;) {
    const match = thaiEntries.find(([label]) => rule.startsWith(label, i));
    if (match) {
      tokens.push({ index: i, end: i + match[0].length, day: match[1] });
      i += match[0].length;
    } else i++;
  }

  if (tokens.length > 0) {
    const result = new Set<Weekday>();
    for (let i = 0; i < tokens.length; i++) {
      result.add(tokens[i].day);
      const next = tokens[i + 1];
      if (!next) continue;
      const between = rule.slice(tokens[i].end, next.index);
      if (/(?:-|–|—|ถึง|จนถึง)/u.test(between)) {
        let cursor = (WEEKDAYS.indexOf(tokens[i].day) + 1) % WEEKDAYS.length;
        const end = WEEKDAYS.indexOf(next.day);
        while (cursor !== end) {
          result.add(WEEKDAYS[cursor]);
          cursor = (cursor + 1) % WEEKDAYS.length;
        }
      }
    }
    return WEEKDAYS.filter((day) => result.has(day));
  }

  const englishDays: Record<string, Weekday> = {
    sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
  };
  const englishTokens = Object.entries(englishDays)
    .flatMap(([label, day]) => [...rule.matchAll(new RegExp(label, 'gi'))].map((m) => ({ index: m.index!, end: m.index! + label.length, day })))
    .sort((a, b) => a.index - b.index);
  if (!englishTokens.length) return null;
  const result = new Set<Weekday>();
  for (let i = 0; i < englishTokens.length; i++) {
    result.add(englishTokens[i].day);
    const next = englishTokens[i + 1];
    if (next && /(?:-|–|—|to|through)/i.test(rule.slice(englishTokens[i].end, next.index))) {
      let cursor = (WEEKDAYS.indexOf(englishTokens[i].day) + 1) % WEEKDAYS.length;
      const end = WEEKDAYS.indexOf(next.day);
      while (cursor !== end) {
        result.add(WEEKDAYS[cursor]);
        cursor = (cursor + 1) % WEEKDAYS.length;
      }
    }
  }
  return WEEKDAYS.filter((day) => result.has(day));
}

export function isVipLottery(item: ScheduledLottery): boolean {
  const category = String(item.category ?? '').toLowerCase();
  const id = String(item.id ?? '').toLowerCase();
  const name = String(item.name ?? '');
  return category === 'vip' || /(?:^|[_\\s-])(vip|star)(?:$|[_\\s-])/i.test(id) || /vip|สตาร์|star/i.test(name);
}

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
    if (isVipLottery(item)) return true;

    // Explicit draw-day configuration is authoritative, including weekend draws.
    const days = scheduledWeekdays(item.drawDays || '');
    if (days) return days.includes(weekday);

    if (isRegularStockLottery(item)) return weekday !== 'Sat' && weekday !== 'Sun';
    const category = String(item.category ?? '').toLowerCase();
    if (['hanoi', 'lao'].includes(category)) return true;
    return false;
  });
}
