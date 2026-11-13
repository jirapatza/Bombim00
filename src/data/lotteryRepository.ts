import {
  LotteryCatalogItem,
  RawLotteryResult,
  SystemStatus,
  AppSettings,
  TicketCheckReport,
  FrequencyStat,
} from '../types/lottery';

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

function getResolvedTop3(res: RawLotteryResult): string {
  if (res.เลขบน_3_ตัว) return res.เลขบน_3_ตัว;
  if (res.รางวัลที่_1 && res.รางวัลที่_1.length >= 3) {
    return res.รางวัลที่_1.slice(-3);
  }
  return '';
}

function getResolvedBottom2(res: RawLotteryResult): string {
  return res.เลขล่าง_2_ตัว || res.เลขท้าย_2_ตัว || '';
}

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
    if (!irregular && !drawWeekdays[rule]?.includes(weekday)) return [];
    const name = normalizeName(item.name);
    const eligible = item.id === 'thai_gov'
      ? current.filter((row) => /^\d{6}$/.test(row.รางวัลที่_1 ?? ''))
      : current;
    const matched = eligible.find((row) => row.หวย === item.id) ??
      eligible.find((row) => name && name === normalizeName(getDisplayName(row)));
    if (irregular && !matched) return [];
    if (!matched) {
      return { ...item, status: 'waiting', top3: '', bottom2: '', firstPrize: '', date: 'ไม่ระบุ', resultDate: undefined };
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
async function fetchLiveJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${LIVE_DATA_ROOT}/${path}?v=${Math.floor(Date.now() / 15_000)}`, { cache: 'no-store', signal });
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
      draws.set(key, `${getDisplayName(row)} — ${date}`);
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
        const first = row.รางวัลที่_1 ?? '';
        const add = (prizeType: string, matchedNumber: string) => {
          wins.set(`${prizeType}:${matchedNumber}`, { ticketNumber: num, isWin: true,
            winningLotteryName: getDisplayName(row), drawDate: drawDate(row), prizeType, matchedNumber });
        };
        const tokens = (items: string[] = []) => items.flatMap((item) => item.split(/[,\s]+/));
        if (num.length === 6 && first === num) add('รางวัลที่ 1 เต็มใบ', first);
        if ((num.length === 2 || num.length === 6) && getResolvedBottom2(row) === num.slice(-2))
          add('เลขท้าย 2 ตัว', num.slice(-2));
        // Upper-three bets are distinct from official front/rear-three prizes.
        if (num.length === 3 && !/^\d{6}$/.test(first) &&
            !getDisplayName(row).includes('รัฐบาล') && row.เลขบน_3_ตัว === num)
          add('เลข 3 ตัวบน', num);
        if (num.length === 3 || num.length === 6) {
          if (tokens(row.เลขหน้า_3_ตัว).includes(num.slice(0, 3))) add('เลขหน้า 3 ตัว', num.slice(0, 3));
          if (tokens(row.เลขท้าย_3_ตัว).includes(num.slice(-3))) add('เลขท้าย 3 ตัว', num.slice(-3));
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
