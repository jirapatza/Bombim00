import type { RawLotteryResult } from "../types/lottery";

export type StatKind = "top3" | "bottom2" | "front3" | "back3";

export interface DigitStat {
  number: string;
  count: number;
  percentage: number;
  gapRounds: number;
  latestDate: string;
  latestLottery: string;
}

export interface DrawNumbers {
  date: string;
  lottery: string;
  numbers: string[];
}

export interface AnalysisSummary {
  numbers: number;
  backtestRounds: number;
  knownNumbers: number;
  totalRounds: number;
}

export interface BacktestReport {
  rounds: number;
  hits: number;
  hitRate: number;
  pick: number;
  window: number;
  kind: StatKind;
}

function splitThreeDigitNumbers(value: string): string[] {
  if (!value) return [];
  return value.trim().split(/[,;\s]+/).filter((token) => /^\d{3}$/.test(token));
}

/**
 * Resolve the numbers of one draw for a given prize kind.
 * Never invents numbers: rows without a usable value return an empty list.
 */
export function resolveNumbers(
  res: RawLotteryResult,
  kind: StatKind,
): string[] {
  switch (kind) {
    case "top3": {
      const direct = res.เลขบน_3_ตัว;
      if (direct && /^\d{3}$/.test(direct)) return [direct];
      const first = res.รางวัลที่_1;
      return first && /^\d{3,}$/.test(first) ? [first.slice(-3)] : [];
    }
    case "bottom2": {
      const value = [res.เลขล่าง_2_ตัว, res.เลขท้าย_2_ตัว].find((n) => n && /^\d{2}$/.test(n));
      return value ? [value] : [];
    }
    case "front3":
      return (res.เลขหน้า_3_ตัว ?? []).flatMap(splitThreeDigitNumbers);
    case "back3":
      return (res.เลขท้าย_3_ตัว ?? []).flatMap(splitThreeDigitNumbers);
  }
}

const thaiMonths = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function dateKey(value: string): string {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T ])/);
  const numeric = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  const thai = value.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  const year = Number(iso?.[1] ?? numeric?.[3] ?? thai?.[3]);
  const month = iso ? Number(iso[2]) : numeric ? Number(numeric[2]) : thaiMonths.indexOf(thai?.[2] ?? "") + 1;
  const day = Number(iso?.[3] ?? numeric?.[1] ?? thai?.[1]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year >= 2400 ? year - 543 : year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Convert raw results into newest-first draws, regardless of input order.
 * Rows without usable numbers for the requested kind are skipped.
 */
export function toDraws(
  results: RawLotteryResult[],
  kind: StatKind,
): DrawNumbers[] {
  const draws: DrawNumbers[] = [];
  for (const res of results) {
    const numbers = resolveNumbers(res, kind);
    if (numbers.length === 0) continue;
    draws.push({
      date: res.วันที่จัดรูปแบบ || res.งวดวันที่ || "",
      lottery: res.ชื่อหวย || res.หวย || "",
      numbers,
    });
  }
  return draws.sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)));
}

/**
 * Digit frequency across draws.
 * - A number appearing in several prizes of the same draw counts once (Set).
 * - gapRounds counts draws since the latest appearance: 0 = appeared in the
 *   newest draw, 1 = skipped the newest draw, and so on.
 * Draws are sorted newest-first by their dated results.
 */
export function digitFrequency(
  results: RawLotteryResult[],
  kind: StatKind,
): DigitStat[] {
  const draws = toDraws(results, kind);
  const total = draws.length;
  if (total === 0) return [];

  const acc = new Map<string, { count: number; latestIndex: number; latest: DrawNumbers }>();
  draws.forEach((draw, index) => {
    for (const num of new Set(draw.numbers)) {
      const entry = acc.get(num);
      if (entry) entry.count += 1;
      // draws are newest-first, so the first hit is the most recent one
      else acc.set(num, { count: 1, latestIndex: index, latest: draw });
    }
  });

  const stats: DigitStat[] = [];
  for (const [number, entry] of acc) {
    stats.push({
      number,
      count: entry.count,
      percentage: (entry.count / total) * 100,
      gapRounds: entry.latestIndex,
      latestDate: entry.latest.date,
      latestLottery: entry.latest.lottery,
    });
  }
  return stats;
}

export function analysisSummary(stats: DigitStat[], backtest: BacktestReport): AnalysisSummary {
  const numbers = poolSizeForKind(backtest.kind);
  const knownNumbers = stats.length;
  const totalRounds = Math.max(0, ...stats.map((stat) => stat.gapRounds ?? 0)) + 1;
  return { numbers, backtestRounds: backtest.rounds, knownNumbers, totalRounds };
}

export function hottest(stats: DigitStat[], limit = 15): DigitStat[] {
  return [...stats]
    .sort((a, b) => b.count - a.count || (b.gapRounds ?? 0) - (a.gapRounds ?? 0) || a.number.localeCompare(b.number, "en", { numeric: true }))
    .slice(0, limit);
}

export function coldest(stats: DigitStat[], limit = 15): DigitStat[] {
  return [...stats]
    .sort((a, b) => a.count - b.count || (b.gapRounds ?? 0) - (a.gapRounds ?? 0) || a.number.localeCompare(b.number, "en", { numeric: true }))
    .slice(0, limit);
}

export function longestGap(stats: DigitStat[], limit = 15): DigitStat[] {
  return [...stats]
    .sort((a, b) => (b.gapRounds ?? 0) - (a.gapRounds ?? 0) || a.count - b.count || a.number.localeCompare(b.number, "en", { numeric: true }))
    .slice(0, limit);
}

function poolSizeForKind(kind: StatKind): number {
  return kind === "bottom2" ? 100 : 1000;
}

/**
 * Backtest the "frequent numbers from the recent window predict the next draw"
 * rule. Draws are sorted newest-first, then rebuilt oldest-to-newest inside.
 * Only rounds with at least one scored number are counted, and the hit rate is
 * reported as measured, with no tuning of the data.
 */
export function backtest(
  results: RawLotteryResult[],
  kind: StatKind,
  options: { pick?: number; window?: number } = {},
): BacktestReport {
  const pick = options.pick ?? 15;
  const windowSize = options.window ?? 50;
  const chronological = toDraws(results, kind).filter((draw) => dateKey(draw.date)).reverse();
  let rounds = 0;
  let hits = 0;

  for (let i = 1; i < chronological.length; i++) {
    const from = Math.max(0, i - windowSize);
    const counts = new Map<string, number>();
    for (const draw of chronological.slice(from, i)) {
      for (const num of new Set(draw.numbers)) {
        counts.set(num, (counts.get(num) ?? 0) + 1);
      }
    }
    const predicted = new Set(
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, pick)
        .map(([num]) => num),
    );
    const actual = new Set(chronological[i].numbers);
    if (actual.size === 0) continue;
    rounds += 1;
    if ([...actual].some((n) => predicted.has(n))) hits += 1;
  }

  return {
    rounds,
    hits,
    hitRate: rounds > 0 ? (hits / rounds) * 100 : 0,
    pick,
    window: windowSize,
    kind,
  };
}
