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
  today = bangkokDate.format(new Date()),
): LotteryCatalogItem[] {
  const current = results.filter((row) =>
    drawDate(row) === today && /^\d{3}$/.test(getResolvedTop3(row)) && /^\d{2}$/.test(getResolvedBottom2(row))
  );
  return catalog.map((item) => {
    const name = normalizeName(item.name);
    const matched = current.find((row) => row.หวย === item.id) ??
      current.find((row) => name && name === normalizeName(getDisplayName(row)));
    if (!matched) {
      return { ...item, status: 'waiting', top3: '', bottom2: '', firstPrize: '', date: 'ไม่ระบุ' };
    }
    return {
      ...item,
      status: 'drawn',
      top3: getResolvedTop3(matched),
      bottom2: getResolvedBottom2(matched),
      firstPrize: /^\d{6}$/.test(matched.รางวัลที่_1 ?? '') ? matched.รางวัลที่_1! : '',
      date: getDisplayDate(matched),
      source: matched.แหล่งข้อมูล || 'ผลตรวจล่าสุด',
    };
  });
}

const LIVE_DATA_ROOT = 'https://raw.githubusercontent.com/jirapatza/Bombim00/runtime-live';
async function fetchLiveJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${LIVE_DATA_ROOT}/${path}`, { cache: 'no-cache', signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// LocalStorage Keys
const STORAGE_WATCHED_NUMBERS = 'lottery_watched_numbers_v1';
const STORAGE_SETTINGS = 'lottery_app_settings_v1';

export class LotteryRepository {
  private static lotteries: LotteryCatalogItem[] = [];
  private static results: RawLotteryResult[] = defaultResults;
  private static status: SystemStatus = defaultSystemStatus;

  static init(): void {
    this.lotteries = mergeCatalogWithResults(defaultCatalog, this.results);
  }

  static getLotteries(): LotteryCatalogItem[] {
    if (this.lotteries.length === 0) {
      this.init();
    }
    return this.lotteries;
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
      ntfy: {
        enabled: (rawSettings as any).channels?.ntfy?.enabled ?? true,
        server: (rawSettings as any).channels?.ntfy?.server || 'https://ntfy.sh',
        topic: (rawSettings as any).channels?.ntfy?.topic || 'lottery-alert-live',
        priority: (rawSettings as any).channels?.ntfy?.priority || 'high',
        tags: (rawSettings as any).channels?.ntfy?.tags || ['moneybag', 'dart', 'loudspeaker'],
      },
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
      const status = rawStatus as SystemStatus | null;
      if (!Array.isArray(catalog) || !catalog.length || !Array.isArray(results) ||
          !status || !Number.isFinite(Date.parse(status.last_run_timestamp))) {
        throw new Error('Invalid runtime data');
      }
      const current = mergeCatalogWithResults(catalog, results);
      this.results = results;
      this.lotteries = current;
      this.status = status;
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }

  static checkTickets(rawInput: string): TicketCheckReport[] {
    const numbers = rawInput
      .split(/[, \n\t|;]+/)
      .map((n) => n.replace(/\D/g, '').trim())
      .filter(Boolean);

    if (numbers.length === 0) return [];

    const reports: TicketCheckReport[] = [];

    for (const num of numbers) {
      let matchedWin: TicketCheckReport | null = null;

      for (const res of this.results) {
        const first = res.รางวัลที่_1?.trim() || '';
        const top3 = getResolvedTop3(res).trim();
        const bottom2 = getResolvedBottom2(res).trim();
        const front3List = res.เลขหน้า_3_ตัว || [];
        const last3List = res.เลขท้าย_3_ตัว || [];
        const displayName = getDisplayName(res);
        const displayDate = getDisplayDate(res);

        // Check first prize
        if (first && (first === num || (first.length === 6 && first.slice(-num.length) === num && (num.length === 2 || num.length === 3)))) {
          if (first.length === 6 && first === num) {
            matchedWin = {
              ticketNumber: num,
              isWin: true,
              winningLotteryName: displayName,
              drawDate: displayDate,
              prizeType: 'รางวัลที่ 1 เต็มใบ',
              matchedNumber: first,
            };
            break;
          }
        }

        // Check 2-digit match
        if (num.length === 2 && bottom2 === num) {
          matchedWin = {
            ticketNumber: num,
            isWin: true,
            winningLotteryName: displayName,
            drawDate: displayDate,
            prizeType: 'เลขท้าย 2 ตัว',
            matchedNumber: bottom2,
          };
          break;
        }

        // Check 3-digit top match
        if (num.length === 3 && top3 === num) {
          matchedWin = {
            ticketNumber: num,
            isWin: true,
            winningLotteryName: displayName,
            drawDate: displayDate,
            prizeType: 'เลข 3 ตัวบน',
            matchedNumber: top3,
          };
          break;
        }

        // Check front / last 3 digits
        if (num.length === 3) {
          if (front3List.some((item) => item.includes(num))) {
            matchedWin = {
              ticketNumber: num,
              isWin: true,
              winningLotteryName: displayName,
              drawDate: displayDate,
              prizeType: 'เลขหน้า 3 ตัว',
              matchedNumber: num,
            };
            break;
          }
          if (last3List.some((item) => item.includes(num))) {
            matchedWin = {
              ticketNumber: num,
              isWin: true,
              winningLotteryName: displayName,
              drawDate: displayDate,
              prizeType: 'เลขท้าย 3 ตัว',
              matchedNumber: num,
            };
            break;
          }
        }
      }

      if (matchedWin) {
        reports.push(matchedWin);
      } else {
        reports.push({
          ticketNumber: num,
          isWin: false,
          winningLotteryName: 'ไม่พบรางวัลในงวดล่าสุด',
          drawDate: 'ทุกงวดที่มีการบันทึก',
          prizeType: 'ไม่ถูกรางวัล',
          matchedNumber: '-',
        });
      }
    }

    return reports;
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

  static getNextClosingLottery(lotteries: LotteryCatalogItem[]): {
    item: LotteryCatalogItem;
    remaining: string;
  } | null {
    if (!lotteries || lotteries.length === 0) return null;

    // Calculate Bangkok time in minutes from midnight
    const now = new Date();
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
      const match = item.closeTimeStr.match(/(\d{1,2})[:.](\d{2})/);
      if (match) {
        const hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const targetMinutes = hour * 60 + minute;

        const diff =
          targetMinutes >= curMinutes
            ? targetMinutes - curMinutes
            : targetMinutes + 24 * 60 - curMinutes;

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
