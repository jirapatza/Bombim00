type ScheduledLottery = {
  id?: string;
  name?: string;
  category?: string;
};

/** Keep monthly government lottery entries out of daily lists on non-draw dates. */
export function filterLotteriesForDrawDate<T extends ScheduledLottery>(
  lotteries: T[],
  date: Date = new Date(),
): T[] {
  const bangkokDay = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
  }).format(date));

  return lotteries.filter((item) => {
    if (item.category !== 'gov_savings') return true;

    const id = String(item.id ?? '').trim().toLowerCase();
    const name = String(item.name ?? '').trim();
    const isBaac = id === 'baac' || /ธ\s*\.?\s*ก\s*\.?\s*ส\s*\.?|ธกส/u.test(name);
    if (isBaac) return bangkokDay === 16;

    const isGsb = id === 'gsb' || name.includes('ออมสิน');
    if (isGsb) return bangkokDay === 1 || bangkokDay === 16;

    const isThaiGovernment = id === 'thai_gov' || /รัฐบาล|สลากกินแบ่ง/u.test(name);
    if (isThaiGovernment) return bangkokDay === 1 || bangkokDay === 16;

    return true;
  });
}
