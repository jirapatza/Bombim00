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
