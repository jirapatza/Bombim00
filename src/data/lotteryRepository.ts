import {
  LotteryCatalogItem,
  RawLotteryResult,
  SystemStatus,
  AppSettings,
  TicketCheckReport,
  FrequencyStat,
} from '../types/lottery';
import { formatThaiDate } from '../utils/freshness';
import {
  DigitStat,
  StatKind,
  digitFrequency,
  hottest,
  coldest,
  longestGap,
  backtest,
  countDraws,
  BacktestReport,
} from '../utils/statistics';

// Import local JSON datasets
import rawAllLotteries from '../../data/all_lotteries.json';
import rawPreviousResults from '../../lottery_previous_results.json';
import rawSettings from '../../config/settings.json';
import rawStatus from '../../status/status.json';
import weekdayRules from '../../data/draw_weekdays.json';

const defaultCatalog = rawAllLotteries as LotteryCatalogItem[];
const defaultResults = rawPreviousResults as RawLotteryResult[];
const defaultSystemStatus = rawStatus as SystemStatus;

function getDisplayName(res: RawLotteryResult): string {
  return res.ชื่อหวย || res.หวย || 'ไม่ระบุชื่อ';
}

function getDisplayDate(res: RawLotteryResult): string {
  return res.วันที่จัดรูปแบบ || res.งวดวันที่ || 'ไม่ระบุงวด';
}

const getResolvedFirstPrize = (res: RawLotteryResult): string => res.รางวัลที่_1 || res.firstPrize || '';

/** Three-digit prize the source published itself, if any. */
function explicitTop3(res: RawLotteryResult): string {
  const value = res.เลขบน_3_ตัว || res.top3 || '';
  return /^\d{3}$/.test(value) ? value : '';
}

/**
 * 3 ตัวบน. Every lottery settles this bet on the tail of the first prize, so a
 * six-digit first prize yields its last three digits. `derived` records whether
 * the value was published by the source or computed from the first prize, so
 * the interface never presents a computed value as an official three-digit prize.
 */
function top3Of(res: RawLotteryResult): { value: string; derived: boolean } {
  const explicit = explicitTop3(res);
  if (explicit) return { value: explicit, derived: false };
  const first = getResolvedFirstPrize(res);
  return /^\d{3,}$/.test(first) ? { value: first.slice(-3), derived: true } : { value: '', derived: false };
}

function getResolvedTop3(res: RawLotteryResult): string {
  return top3Of(res).value;
}

function getResolvedBottom2(res: RawLotteryResult): string {
  return res.เลขล่าง_2_ตัว || res.เลขท้าย_2_ตัว || res.bottom2 || '';
}

/** Prize lists arrive as arrays or as one comma separated string. */
const prizeList = (value?: string[]): string[] =>
  (value ?? []).flatMap((entry) => String(entry).split(/[,\s]+/)).filter(Boolean);

const getResolvedBack3 = (res: RawLotteryResult): string[] => prizeList(res.เลขท้าย_3_ตัว ?? res.back3);
const getResolvedFront3 = (res: RawLotteryResult): string[] => prizeList(res.เลขหน้า_3_ตัว ?? res.front3);

export function normalizeName(name: string): string {
  const isVip = /(?<!s)vip|วีไอพี/i.test(name);
  const cleaned = name
    .toLowerCase()
    .replace(/(?<!s)vip/gi, '')
    .replace(/วีไอพี/g, '')
    .replace(/นิคเคอิ/g, 'นิเคอิ')
    .replace(/สตาร์/g, 'star')
    .replace(/หวยหุ้น/g, '')
    .replace(/หวย/g, '')
    .replace(/หุ้น/g, '')
    .replace(/รอบ/g, '')
    .replace(/\(ไทย\)/g, '')
    .replace(/[^a-z0-9ก-๙]/g, '');

  return cleaned + (isVip ? 'vip' : '');
}

const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const bangkokDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' });
const drawWeekdays: Record<string, number[]> = weekdayRules;

export function bangkokDateKey(now: Date): string {
  return bangkokDate.format(now);
}

function drawDate(result: RawLotteryResult): string {
  for (const date of [result.งวดวันที่, result.วันที่จัดรูปแบบ]) {
    const value = date?.trim() ?? '';
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/);
    if (iso) {
      const year = Number(iso[1]);
      return `${year >= 2400 ? year - 543 : year}-${iso[2]}-${iso[3]}`;
    }
    const numeric = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    const thai = value.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
    const month = numeric ? Number(numeric[2]) : thaiMonths.indexOf(thai?.[2] ?? '') + 1;
    const day = Number(numeric?.[1] ?? thai?.[1]);
    const year = Number(numeric?.[3] ?? thai?.[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year) {
      return [year >= 2400 ? year - 543 : year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
    }
  }
  return '';
}

/**
 * Latest verified result stored on the catalog entry itself. It is only used
 * when no result for today exists, so a stale row is never shown as today's.
 */
function storedResult(item: LotteryCatalogItem): LotteryCatalogItem | null {
  const resultDate = drawDate({ งวดวันที่: item.date } as RawLotteryResult);
  if (
    item.status !== 'announced' || !resultDate ||
    !/^\d{3}$/.test(item.top3 ?? '') || !/^\d{2}$/.test(item.bottom2 ?? '')
  ) return null;
  return { ...item, status: 'drawn', resultDate, date: item.date };
}

export function mergeCatalogWithResults(
  catalog: LotteryCatalogItem[],
  results: RawLotteryResult[],
  now = new Date(),
): LotteryCatalogItem[] {
  const today = bangkokDateKey(now);
  const current = results.filter((row) =>
    drawDate(row) === today && /^\d{2}$/.test(getResolvedBottom2(row)) &&
    (/^\d{3}$/.test(row.เลขบน_3_ตัว ?? '') || /^\d{6}$/.test(row.รางวัลที่_1 ?? ''))
  );
  return catalog.flatMap((item) => {
    const rule = item.drawDays.trim().replace(/\s*-\s*/g, ' - ');
    const irregular = rule === 'ตามประกาศวันงวดจริง (อาจเลื่อน)';
    const weekday = new Date(today + 'T00:00:00Z').getUTCDay();
    const stored = storedResult(item);
    if (!irregular && !drawWeekdays[rule]?.includes(weekday)) return stored ? [stored] : [];
    const name = normalizeName(item.name);
    const eligible = item.id === 'thai_gov'
      ? current.filter((row) => /^\d{6}$/.test(row.รางวัลที่_1 ?? ''))
      : current;
    const matched = eligible.find((row) => row.หวย === item.id) ??
      eligible.find((row) => name && name === normalizeName(getDisplayName(row)));
    if (irregular && !matched) return stored ? [stored] : [];
    if (!matched) {
      return stored ?? { ...item, status: 'waiting', top3: '', bottom2: '', firstPrize: '', date: 'ไม่ระบุ', resultDate: undefined };
    }
    const firstPrize = matched.รางวัลที่_1 ?? '';
    const hasFirstPrize = /^\d{6}$/.test(firstPrize);
    return {
      ...item,
      status: 'drawn',
      // Government adapters can carry a derived suffix; show their actual first prize separately.
      top3: ['thai_gov', 'gsb', 'baac'].includes(item.id) && hasFirstPrize ? '' : matched.เลขบน_3_ตัว ?? '',
      bottom2: getResolvedBottom2(matched),
      firstPrize: hasFirstPrize ? firstPrize : '',
      front3: matched.เลขหน้า_3_ตัว ?? item.front3,
      back3: matched.เลขท้าย_3_ตัว ?? item.back3,
      threeDigits: matched.threeDigits ?? item.threeDigits,
      date: getDisplayDate(matched),
      resultDate: today,
      detectedAt: matched.เวลาที่ตรวจพบ,
      source: matched.แหล่งข้อมูล || 'ผลตรวจล่าสุด',
    };
  });
}

const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function validSourceChecks(value: unknown): boolean {
  return object(value) && ['waiting', 'errors'].every(key => Array.isArray(value[key]) && value[key].every((entry: unknown) =>
    object(entry) && typeof entry.source === 'string' &&
    (entry.lottery === undefined || typeof entry.lottery === 'string') &&
    (entry.reason === undefined || typeof entry.reason === 'string') &&
    (entry.status === null || Number.isInteger(entry.status))));
}

export function validateLiveData(catalog: unknown, results: unknown, status: unknown): void {
  const strings = (x: Record<string, unknown>, keys: string[]) => keys.every((k) => typeof x[k] === 'string');
  const optionalStrings = ['ชื่อหวย', 'หวย', 'หมวดหวย', 'งวดวันที่', 'วันที่จัดรูปแบบ', 'รางวัลที่_1',
    'เลขท้าย_2_ตัว', 'เลขบน_3_ตัว', 'เลขล่าง_2_ตัว', 'แหล่งข้อมูล', 'เวลาที่ตรวจพบ', 'สถานะการแจ้งเตือน'];
  if (!Array.isArray(catalog) || !catalog.length || !catalog.every((x) => object(x) &&
    strings(x, ['id', 'name', 'category', 'categoryLabel', 'period', 'periodLabel', 'flag', 'drawTimeStr', 'closeTimeStr', 'drawDays'])) ||
    !Array.isArray(results) || !results.every((x) => object(x) &&
      optionalStrings.every((k) => x[k] === undefined || typeof x[k] === 'string') &&
      ['เลขหน้า_3_ตัว', 'เลขท้าย_3_ตัว', 'รางวัลข้างเคียงรางวัลที่_1'].every((k) =>
        x[k] === undefined || (Array.isArray(x[k]) && x[k].every((v: unknown) => typeof v === 'string')))) ||
    !object(status) || !strings(status, ['last_run_timestamp', 'last_run_date_thai', 'status_message', 'last_source_used', 'system_status']) ||
    !Number.isFinite(Date.parse(status.last_run_timestamp as string)) ||
    !['healthy', 'degraded', 'error'].includes(status.system_status as string) ||
    !Number.isFinite(status.total_checks)) throw new Error('Invalid runtime data');
}

const LIVE_DATA_ROOT = 'https://raw.githubusercontent.com/jirapatza/Bombim00/runtime-live';
// The checker publishes at most once a minute and the raw CDN caches for about
// five, so polling faster only adds requests without showing newer numbers.
export const POLL_MS = 60_000;
async function fetchLiveJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${LIVE_DATA_ROOT}/${path}?v=${Math.floor(Date.now() / POLL_MS)}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// LocalStorage Keys
const STORAGE_WATCHED_NUMBERS = 'lottery_watched_numbers_v1';
const STORAGE_SETTINGS = 'lottery_app_settings_v1';

export class LotteryRepository {
  private static lotteries: LotteryCatalogItem[] = [];
  private static catalog = defaultCatalog;
  private static results: RawLotteryResult[] = defaultResults;
  private static status: SystemStatus = defaultSystemStatus;

  static init(): void {
    this.lotteries = mergeCatalogWithResults(defaultCatalog, this.results);
  }

  static getLotteries(now = new Date()): LotteryCatalogItem[] {
    // Recompute even offline so Friday rows disappear at Bangkok midnight.
    return mergeCatalogWithResults(this.catalog, this.results, now);
  }

  static getResults(): RawLotteryResult[] {
    return this.results;
  }

  static getStatus(): SystemStatus {
    return this.status;
  }

  static getWatchedNumbers(): string[] {
    if (typeof window === 'undefined') {
      return (rawSettings as any).notifications?.custom_watched_numbers || ['95', '42', '84', '19', '56', '289594'];
    }
    try {
      const stored = localStorage.getItem(STORAGE_WATCHED_NUMBERS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return (rawSettings as any).notifications?.custom_watched_numbers || ['95', '42', '84', '19', '56', '289594'];
  }

  static setWatchedNumbers(numbers: string[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_WATCHED_NUMBERS, JSON.stringify(numbers));
    }
  }

  static getSettings(): AppSettings {
    const defaultVal: AppSettings = {
      app_name: (rawSettings as any).app_name || 'Lottery Alert System Pro',
      custom_watched_numbers: this.getWatchedNumbers(),
      speech_polite_ending: (rawSettings as any).message_template?.polite_particle || 'ครับ',
      speech_rate: 1.0,
    };

    if (typeof window === 'undefined') return defaultVal;

    try {
      const stored = localStorage.getItem(STORAGE_SETTINGS);
      if (stored) return { ...defaultVal, ...JSON.parse(stored) };
    } catch {
      // ignore
    }
    return defaultVal;
  }

  static saveSettings(settings: AppSettings): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
    }
  }

  private static refreshRequest: Promise<void> | undefined;

  static refresh(): Promise<void> {
    if (!this.refreshRequest) {
      this.refreshRequest = this.loadLiveData().finally(() => { this.refreshRequest = undefined; });
    }
    return this.refreshRequest;
  }

  private static async loadLiveData(): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const [catalog, results, rawStatus] = await Promise.all([
        fetchLiveJson('data/all_lotteries.json', controller.signal),
        fetchLiveJson('lottery_previous_results.json', controller.signal),
        fetchLiveJson('status/status.json', controller.signal),
      ]);
      validateLiveData(catalog, results, rawStatus);
      const status = rawStatus as SystemStatus;
      const current = mergeCatalogWithResults(catalog as LotteryCatalogItem[], results as RawLotteryResult[]);
      this.results = results as RawLotteryResult[];
      this.catalog = catalog as LotteryCatalogItem[];
      this.lotteries = current;
      this.status = { ...status, source_checks: validSourceChecks(status.source_checks) ? status.source_checks : undefined };
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }

  static getTicketDraws(): { key: string; label: string }[] {
    const draws = new Map<string, string>();
    for (const row of this.results) {
      const date = drawDate(row);
      if (!date) continue;
      const key = JSON.stringify([normalizeName(getDisplayName(row)), date]);
      draws.set(key, `${getDisplayName(row)} — ${formatThaiDate(date)}`);
    }
    return [...draws].map(([key, label]) => ({ key, label }))
      .sort((a, b) => JSON.parse(b.key)[1].localeCompare(JSON.parse(a.key)[1]) || a.label.localeCompare(b.label));
  }

  static checkTickets(rawInput: string, drawKey: string): TicketCheckReport[] {
    const rows = this.results.filter((row) =>
      JSON.stringify([normalizeName(getDisplayName(row)), drawDate(row)]) === drawKey);
    if (!rows.length) return [];
    const numbers = rawInput.split(/[, \n\t|;]+/).filter(Boolean);
    return numbers.flatMap((num): TicketCheckReport[] => {
      if (!/^(?:[0-9]{2}|[0-9]{3}|[0-9]{6})$/.test(num)) {
        return [{ ticketNumber: num, isWin: false, winningLotteryName: 'รูปแบบไม่ถูกต้อง',
          drawDate: '', prizeType: 'กรุณาใส่เลข 2, 3 หรือ 6 หลัก', matchedNumber: '-' }];
      }
      const wins = new Map<string, TicketCheckReport>();
      for (const row of rows) {
        const first = getResolvedFirstPrize(row);
        const top = top3Of(row);
        const bottom2 = getResolvedBottom2(row);
        const add = (prizeType: string, matchedNumber: string) => {
          wins.set(`${prizeType}:${matchedNumber}`, { ticketNumber: num, isWin: true,
            winningLotteryName: getDisplayName(row), drawDate: drawDate(row), prizeType, matchedNumber });
        };
        if (num.length === 6 && first === num) add('รางวัลที่ 1 เต็มใบ', first);
        if ((num.length === 2 || num.length === 6) && bottom2 && bottom2 === num.slice(-2))
          add('เลขท้าย 2 ตัว', num.slice(-2));
        // A three-digit bet is settled on the first-prize tail for every lottery,
        // including the government draw, whose six-digit first prize has no
        // separate "3 ตัวบน" prize of its own.
        if (num.length === 3 && top.value === num)
          add(top.derived ? '3 ตัวบน (ท้ายรางวัลที่ 1)' : '3 ตัวบน', num);
        if (num.length === 3 || num.length === 6) {
          const front3 = getResolvedFront3(row), back3 = getResolvedBack3(row);
          const combined = prizeList(row.threeDigits);
          // Name the prize the source actually published; fall back to the
          // neutral label only when it merged front and rear into one list.
          const settle = (digits: string) => {
            if (front3.includes(digits)) add('เลขหน้า 3 ตัว', digits);
            else if (back3.includes(digits)) add('เลขท้าย 3 ตัว', digits);
            else if (combined.includes(digits)) add('เลข 3 ตัว', digits);
          };
          for (const digits of num.length === 3 ? [num] : [num.slice(0, 3), num.slice(-3)]) settle(digits);
        }
      }
      return wins.size ? [...wins.values()] : [{ ticketNumber: num, isWin: false,
        winningLotteryName: getDisplayName(rows[0]), drawDate: drawDate(rows[0]),
        prizeType: 'ไม่พบรางวัลในข้อมูลของงวดที่เลือก', matchedNumber: '-' }];
    });
  }

  static getTop2DigitFrequency(limit: number = 15): FrequencyStat[] {
    const occurrences: Record<string, number> = {};
    const latestSeen: Record<string, { lottery: string; date: string }> = {};

    const totalCount = Math.max(this.results.length, 1);

    for (const res of this.results) {
      const num = getResolvedBottom2(res).replace(/\D/g, '');
      if (num.length === 2) {
        occurrences[num] = (occurrences[num] || 0) + 1;
        if (!latestSeen[num]) {
          latestSeen[num] = {
            lottery: getDisplayName(res),
            date: getDisplayDate(res),
          };
        }
      }
    }

    return Object.entries(occurrences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([number, count]) => {
        const pair = latestSeen[number] || { lottery: 'ไม่ระบุ', date: '-' };
        return {
          number,
          count,
          percentage: (count / totalCount) * 100,
          latestLottery: pair.lottery,
          latestDate: pair.date,
        };
      });
  }

  static getTop3DigitFrequency(limit: number = 15): FrequencyStat[] {
    const occurrences: Record<string, number> = {};
    const latestSeen: Record<string, { lottery: string; date: string }> = {};

    const totalCount = Math.max(this.results.length, 1);

    for (const res of this.results) {
      const num = getResolvedTop3(res).replace(/\D/g, '');
      if (num.length === 3) {
        occurrences[num] = (occurrences[num] || 0) + 1;
        if (!latestSeen[num]) {
          latestSeen[num] = {
            lottery: getDisplayName(res),
            date: getDisplayDate(res),
          };
        }
      }
    }

    return Object.entries(occurrences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([number, count]) => {
        const pair = latestSeen[number] || { lottery: 'ไม่ระบุ', date: '-' };
        return {
          number,
          count,
          percentage: (count / totalCount) * 100,
          latestLottery: pair.lottery,
          latestDate: pair.date,
        };
      });
  }

  static getDetailedStats(kind: StatKind, lottery?: string): DigitStat[] {
    const rows = lottery ? this.results.filter((row) => getDisplayName(row) === lottery) : this.results;
    return digitFrequency(rows, kind);
  }

  /** Dated draws available for the requested kind, used as the gap basis. */
  static getAnalysisDrawCount(kind: StatKind, lottery?: string): number {
    const rows = lottery ? this.results.filter((row) => getDisplayName(row) === lottery) : this.results;
    return countDraws(rows, kind);
  }

  static getHottestNumbers(kind: StatKind, limit: number = 15): DigitStat[] {
    return hottest(this.getDetailedStats(kind), limit);
  }

  static getColdestNumbers(kind: StatKind, limit: number = 15, lottery?: string): DigitStat[] {
    const rows = lottery ? this.results.filter((row) => getDisplayName(row) === lottery) : this.results;
    return coldest(digitFrequency(rows, kind), limit, kind, countDraws(rows, kind));
  }

  static getLongestGapNumbers(kind: StatKind, limit: number = 15, lottery?: string): DigitStat[] {
    const rows = lottery ? this.results.filter((row) => getDisplayName(row) === lottery) : this.results;
    return longestGap(digitFrequency(rows, kind), limit, kind, countDraws(rows, kind));
  }

  static getBacktestReport(
    kind: StatKind,
    options: { pick?: number; window?: number } = {},
    lottery?: string,
  ): BacktestReport {
    const rows = lottery ? this.results.filter((row) => getDisplayName(row) === lottery) : this.results;
    return backtest(rows, kind, options);
  }

  static getNextClosingLottery(lotteries: LotteryCatalogItem[], now = new Date()): {
    item: LotteryCatalogItem;
    remaining: string;
  } | null {
    if (!lotteries || lotteries.length === 0) return null;

    // Calculate Bangkok time in minutes from midnight
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour')?.value || '0';
    const minPart = parts.find((p) => p.type === 'minute')?.value || '0';
    const curMinutes = parseInt(hourPart, 10) * 60 + parseInt(minPart, 10);

    let closestItem: LotteryCatalogItem | null = null;
    let minDiff = Infinity;
    let remainingDesc = '';

    for (const item of lotteries) {
      const weekdays = drawWeekdays[item.drawDays.trim().replace(/\s*-\s*/g, ' - ')];
      // Irregular draws need an authoritative upcoming date, absent from this catalog.
      if (!weekdays) continue;
      const match = item.closeTimeStr.match(/(\d{1,2})[:.](\d{2})/);
      if (match) {
        const hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const targetMinutes = hour * 60 + minute;

        if (hour > 23 || minute > 59) continue;
        const weekday = new Date(bangkokDateKey(now) + 'T00:00:00Z').getUTCDay();
        let diff = Infinity;
        for (let offset = 0; offset <= 7; offset++) {
          const candidate = offset * 1440 + targetMinutes - curMinutes;
          if (candidate > 0 && weekdays.includes((weekday + offset) % 7)) {
            diff = candidate;
            break;
          }
        }

        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          closestItem = item;
          const diffHours = Math.floor(diff / 60);
          const diffMins = diff % 60;
          remainingDesc =
            diffHours > 0
              ? `เหลืออีก ${diffHours} ชม. ${diffMins} นาที`
              : `เหลืออีก ${diffMins} นาที`;
        }
      }
    }

    return closestItem ? { item: closestItem, remaining: remainingDesc } : null;
  }
}
