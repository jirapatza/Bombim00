export type ScheduledLottery = {
  id?: string;
  name?: string;
  category?: string;
  drawDays?: string;
};

export function isVipLottery(item: ScheduledLottery): boolean {
  const cat = String(item.category ?? '').toLowerCase();
  const id = String(item.id ?? '').toLowerCase();
  const name = String(item.name ?? '');
  if (cat === 'vip') return true;
  if (/\b(vip|star)\b/i.test(id)) return true;
  if (/vip|สตาร์|star/i.test(name)) return true;
  return false;
}

export function isRegularStockLottery(item: ScheduledLottery): boolean {
  if (isVipLottery(item)) return false;
  const cat = String(item.category ?? '').toLowerCase();
  const id = String(item.id ?? '').toLowerCase();
  const name = String(item.name ?? '');

  if (cat === 'foreign_stock' || cat === 'thai_stock') return true;
  if (id.includes('stock') || /nikkei|hangseng|china|taiwan|korea|singapore|india|dowjones|uk|germany|russia|thai_evening/i.test(id)) {
    return true;
  }
  if (/หุ้น|นิเคอิ|ฮั่งเส็ง|จีน|ไต้หวัน|เกาหลี|สิงคโปร์|อินเดีย|อังกฤษ|เยอรมัน|รัสเซีย|ดาวโจนส์|ไทยเย็น/u.test(name)) {
    return true;
  }
  return false;
}

export function isGovernmentLottery(item: ScheduledLottery): boolean {
  const cat = String(item.category ?? '').toLowerCase();
  const id = String(item.id ?? '').toLowerCase();
  const name = String(item.name ?? '');
  return (
    cat === 'gov_savings' ||
    id === 'thai_gov' ||
    id === 'gsb' ||
    id === 'baac' ||
    /รัฐบาล|สลากกินแบ่ง|ออมสิน|ธ\s*\.?\s*ก\s*\.?\s*ส\s*\.?|ธกส/u.test(name)
  );
}

/** Keep non-draw lotteries out of the list on specific dates.
 * - Weekends (Saturday & Sunday): Regular stock markets are closed; ONLY VIP stocks and daily lotteries draw.
 * - Weekdays (Monday-Friday): Both regular stocks and VIP stocks draw.
 * - Thai Government and GSB: Only on days 1 and 16.
 * - BAAC: Only on day 16.
 * - Lao Development: Monday, Wednesday, Friday.
 */
export function filterLotteriesForDrawDate<T extends ScheduledLottery>(
  lotteries: T[],
  date: Date = new Date(),
): T[] {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    weekday: 'short', // 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
  }).formatToParts(date);

  const bangkokDay = Number(parts.find((p) => p.type === 'day')?.value || 1);
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
  const isWeekend = weekdayStr === 'Sat' || weekdayStr === 'Sun';

  return lotteries.filter((item) => {
    // 1. Government and Savings: strictly day 1 and 16 (or day 16 for BAAC)
    if (isGovernmentLottery(item)) {
      const id = String(item.id ?? '').trim().toLowerCase();
      const name = String(item.name ?? '').trim();
      const isBaac = id === 'baac' || /ธ\s*\.?\s*ก\s*\.?\s*ส\s*\.?|ธกส/u.test(name);
      if (isBaac) return bangkokDay === 16;

      const isGsb = id === 'gsb' || name.includes('ออมสิน');
      if (isGsb) return bangkokDay === 1 || bangkokDay === 16;

      const isThaiGovernment = id === 'thai_gov' || /รัฐบาล|สลากกินแบ่ง/u.test(name);
      if (isThaiGovernment) return bangkokDay === 1 || bangkokDay === 16;

      return bangkokDay === 1 || bangkokDay === 16;
    }

    // 2. Regular Stock Lotteries: Closed on Saturday & Sunday; open Monday to Friday
    if (isRegularStockLottery(item)) {
      if (isWeekend) {
        return false;
      }
      return true;
    }

    // 3. Lao Development (ออกเฉพาะ จันทร์, พุธ, ศุกร์)
    const id = String(item.id ?? '').trim().toLowerCase();
    const name = String(item.name ?? '').trim();
    const isLaoDevelopment =
      (id === 'laoslotto' || id === 'lao_development' || name.includes('ลาวพัฒนา')) &&
      !name.includes('EXTRA') &&
      !name.includes('VIP') &&
      !name.includes('TV') &&
      !name.includes('STAR');
    if (isLaoDevelopment) {
      return weekdayStr === 'Mon' || weekdayStr === 'Wed' || weekdayStr === 'Fri';
    }

    // 4. VIP Stocks and Daily Lotteries: draw every day including weekends
    return true;
  });
}

