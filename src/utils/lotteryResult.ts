export type ResultNumbersSource = {
  top3?: unknown;
  bottom2?: unknown;
  firstPrize?: unknown;
  last2?: unknown;
  first?: unknown;
  รางวัลที่_1?: unknown;
  เลขบน_3_ตัว?: unknown;
  เลขล่าง_2_ตัว?: unknown;
  เลขท้าย_2_ตัว?: unknown;
};

function resultDigits(value: unknown, width: number): string {
  const digits = String(value ?? '').trim();
  return /^\d+$/.test(digits) ? digits.slice(-width).padStart(width, '0') : '';
}

/** One presentation for every lottery: three upper digits and two lower digits. */
export function getResultNumbers(row: ResultNumbersSource = {}) {
  const top3 = [row.เลขบน_3_ตัว, row.top3, row.รางวัลที่_1, row.firstPrize, row.first]
    .map((value) => resultDigits(value, 3)).find(Boolean) || '';
  const bottom2 = [row.เลขล่าง_2_ตัว, row.เลขท้าย_2_ตัว, row.bottom2, row.last2]
    .map((value) => resultDigits(value, 2)).find(Boolean) || '';
  return { top3, bottom2 };
}

export function formatResultPair(row: ResultNumbersSource): string {
  const { top3, bottom2 } = getResultNumbers(row);
  return `${top3 || '---'} - ${bottom2 || '--'}`;
}

/** Exact canonical matching keeps regular, VIP, special and morning/afternoon draws separate. */
export function normalizeLotteryIdentity(value: unknown): string {
  const text = String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  const vip = /vip|วีไอพี/i.test(text);
  return text.replace(/vip|วีไอพี/gi, '')
    .replace(/นิคเคอิ/g, 'นิเคอิ')
    .replace(/^หวยหุ้น|^หวย|^หุ้น/u, '')
    .replace(/รอบ(?=เช้า|บ่าย)/gu, '')
    .replace(/\(ไทย\)/gu, '')
    .replace(/[\s._#()–—-]+/g, '') + (vip ? 'vip' : '');
}

/** Explicit provider aliases; no substring matching across draw variants. */
export const RESULT_ALIASES: Record<string, string[]> = {
  thai_gov: ['thailotto', 'หวยรัฐบาลไทย', 'สลากกินแบ่งรัฐบาล'],
  gsb: ['gsblotto', 'หวยออมสิน'], baac: ['baaclotto', 'หวยธกส', 'หวย ธ.ก.ส.'],
  nikkei_morning: ['stocknikkei1'], nikkei_afternoon: ['stocknikkei2'],
  china_morning: ['stockchina1'], china_afternoon: ['stockchina2'],
  hangseng_morning: ['stockhangseng1'], hangseng_afternoon: ['stockhangseng2'],
  taiwan: ['stocktaiwan'], korea: ['stockkorea'], singapore: ['stocksingapore'],
  thai_stock_evening: ['stockthai4'], india: ['stockindia'],
  lao_patthana: ['laoslotto', 'หวยลาวพัฒนา'],
  hanoi_special: ['hanoylottospecial'], hanoi_regular: ['hanoylotto'], hanoi_vip: ['hanoylottovip'],
  malay: ['malaylotto'], lao_extra: ['laoslottoextra'],
  hanoi_patthana: [], hanoi_samakki: [], hanoi_extra: [], hanoi_hd: [], hanoi_tv: [], hanoi_star: [],
  lao_samakki: [], lao_samakki_vip: [], lao_star_vip: [], lao_vip: [],
};
export function matchesLottery(item: {id?: string; name?: string}, row: Record<string, any>): boolean {
  const code = String(row.หวย || row.lottery_code || '').toLowerCase();
  if (/^[a-z0-9_]+$/.test(code)) {
    const knownId = Object.keys(RESULT_ALIASES).find(id => [id, ...RESULT_ALIASES[id]].some(alias => alias.toLowerCase() === code));
    if (knownId) return item.id === knownId;
  }
  const names = [item.id, item.name, ...(RESULT_ALIASES[item.id || ''] || [])].filter(Boolean).map(normalizeLotteryIdentity);
  return [row.หวย, row.ชื่อหวย, row.lotteryName, row.name, row.lottery_code, row.lottery]
    .filter(Boolean).some(value => names.includes(normalizeLotteryIdentity(value)));
}
