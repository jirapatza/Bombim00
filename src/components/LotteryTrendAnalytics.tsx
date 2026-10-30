import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  Flame,
  Snowflake,
  Sparkles,
  Calendar,
  Layers,
  Hash,
  Filter,
  CheckCircle2,
  PieChart as PieIcon,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Trophy,
} from 'lucide-react';

export interface LotteryResultItem {
  งวดวันที่?: string;
  วันที่จัดรูปแบบ?: string;
  รางวัลที่_1?: string;
  เลขท้าย_2_ตัว?: string;
  เลขบน_3_ตัว?: string;
  เลขล่าง_2_ตัว?: string;
  เลขหน้า_3_ตัว?: string[];
  เลขท้าย_3_ตัว?: string[];
  ชื่อหวย?: string;
  หวย?: string;
  หมวดหวย?: string;
  [key: string]: any;
}

export interface LotteryTrendAnalyticsProps {
  results: LotteryResultItem[];
  title?: string;
  description?: string;
  onSelectNumber?: (num: string) => void;
}

const BAR_COLORS = [
  '#f59e0b', // Amber 500
  '#eab308', // Yellow 500
  '#f97316', // Orange 500
  '#06b6d4', // Cyan 500
  '#3b82f6', // Blue 500
  '#6366f1', // Indigo 500
  '#8b5cf6', // Violet 500
  '#ec4899', // Pink 500
  '#10b981', // Emerald 500
  '#14b8a6', // Teal 500
];

export const LotteryTrendAnalytics: React.FC<LotteryTrendAnalyticsProps> = ({
  results = [],
  title = 'วิเคราะห์แนวโน้มตัวเลขที่ออกบ่อยที่สุดย้อนหลัง 10 งวด',
  description = 'สถิติความถี่ตัวเลขเด่น (0-9) และเลขท้าย 2 ตัว ด้วยชาร์ต Recharts จากฐานข้อมูล 10 งวดล่าสุด',
  onSelectNumber,
}) => {
  const [targetCategory, setTargetCategory] = useState<string>('all');
  const [selectedDigitType, setSelectedDigitType] = useState<'digits' | 'two_digits' | 'trend'>('digits');
  const [drawLimit, setDrawLimit] = useState<number>(10);

  // Filter and pick recent draws (default: last 10 draws)
  const recentDraws = useMemo(() => {
    let filtered = results || [];
    if (targetCategory !== 'all') {
      filtered = filtered.filter((r) => {
        const cat = r.หมวดหวย || '';
        const name = r.ชื่อหวย || '';
        if (targetCategory === 'gov') {
          return !cat || name.includes('สลากกินแบ่ง') || name.includes('รัฐบาล');
        }
        if (targetCategory === 'stock') {
          return cat === 'stock' || name.includes('หุ้น');
        }
        if (targetCategory === 'hanoi_lao') {
          return name.includes('ฮานอย') || name.includes('ลาว');
        }
        return true;
      });
    }

    // Default to at most `drawLimit` (10) draws
    const sliced = filtered.slice(0, drawLimit);

    // Only analyze recorded results. Never inject mock lottery numbers into a real analytics view.
    return sliced;
  }, [results, targetCategory, drawLimit]);

  // 1. Calculate Digit Frequency (0 - 9) across the 10 draws
  const digitFrequencyData = useMemo(() => {
    const counts: Record<number, { digit: string; count: number; prize1Count: number; last2Count: number }> = {};
    for (let i = 0; i <= 9; i++) {
      counts[i] = { digit: `เลข ${i}`, count: 0, prize1Count: 0, last2Count: 0 };
    }

    recentDraws.forEach((draw) => {
      // 1st prize digits
      const prize1 = String(draw.รางวัลที่_1 || draw.เลขบน_3_ตัว || '');
      for (const ch of prize1) {
        const num = parseInt(ch, 10);
        if (!isNaN(num) && num >= 0 && num <= 9) {
          counts[num].count += 1;
          counts[num].prize1Count += 1;
        }
      }

      // 2-digit bottom digits
      const last2 = String(draw.เลขท้าย_2_ตัว || draw.เลขล่าง_2_ตัว || '');
      for (const ch of last2) {
        const num = parseInt(ch, 10);
        if (!isNaN(num) && num >= 0 && num <= 9) {
          counts[num].count += 1;
          counts[num].last2Count += 1;
        }
      }
    });

    const data = Object.values(counts);
    // Sort by count descending to identify hot/cold
    const sorted = [...data].sort((a, b) => b.count - a.count);
    const maxCount = sorted[0]?.count || 1;

    return {
      chartData: data, // 0 to 9 in order
      ranked: sorted,
      maxCount,
      hotDigits: sorted.slice(0, 3),
      coldDigits: sorted.slice(-3).reverse(),
    };
  }, [recentDraws]);

  // 2. 2-Digit Numbers Frequency across the 10 draws
  const twoDigitRanking = useMemo(() => {
    const freq: Record<string, number> = {};
    recentDraws.forEach((draw) => {
      const num = String(draw.เลขท้าย_2_ตัว || draw.เลขล่าง_2_ตัว || '').trim();
      if (num && num.length >= 2) {
        const cleaned = num.slice(-2);
        freq[cleaned] = (freq[cleaned] || 0) + 1;
      }
    });

    const entries = Object.entries(freq).map(([num, count]) => ({
      number: num,
      count,
      percent: Math.round((count / Math.max(1, recentDraws.length)) * 100),
    }));

    entries.sort((a, b) => b.count - a.count || a.number.localeCompare(b.number));
    return entries.slice(0, 8); // Top 8 2-digit numbers
  }, [recentDraws]);

  // 3. Draw-by-Draw Trend Timeline for Line/Area chart
  const timelineData = useMemo(() => {
    // Reverse to chronological order (older -> newer)
    const chrono = [...recentDraws].reverse();
    return chrono.map((draw, idx) => {
      const raw2 = parseInt(String(draw.เลขท้าย_2_ตัว || draw.เลขล่าง_2_ตัว || '0').slice(-2), 10) || 0;
      const raw3 = parseInt(String(draw.เลขบน_3_ตัว || draw.รางวัลที่_1 || '0').slice(-3), 10) || 0;
      const dateLabel = draw.งวดวันที่ ? draw.งวดวันที่.split(' ')[0] : `งวดที่ ${idx + 1}`;

      return {
        index: idx + 1,
        date: dateLabel,
        fullDate: draw.งวดวันที่ || `งวด ${idx + 1}`,
        lotteryName: draw.ชื่อหวย || 'สลากกินแบ่ง',
        เลขท้าย2ตัว: raw2,
        เลขท้าย3ตัวบน: raw3,
        เลขท้าย2ตัวDisplay: String(draw.เลขท้าย_2_ตัว || '00').padStart(2, '0'),
        เลขบน3ตัวDisplay: String(raw3).padStart(3, '0'),
      };
    });
  }, [recentDraws]);

  // Odd/Even & High/Low distribution in the 10 draws
  const parityMetrics = useMemo(() => {
    let evenCount = 0;
    let oddCount = 0;
    let highCount = 0; // 50-99
    let lowCount = 0; // 00-49

    recentDraws.forEach((draw) => {
      const val = parseInt(String(draw.เลขท้าย_2_ตัว || draw.เลขล่าง_2_ตัว || '0').slice(-2), 10);
      if (!isNaN(val)) {
        if (val % 2 === 0) evenCount++;
        else oddCount++;

        if (val >= 50) highCount++;
        else lowCount++;
      }
    });

    const total = Math.max(1, recentDraws.length);
    return {
      evenPct: Math.round((evenCount / total) * 100),
      oddPct: Math.round((oddCount / total) * 100),
      highPct: Math.round((highCount / total) * 100),
      lowPct: Math.round((lowCount / total) * 100),
      totalDraws: recentDraws.length,
    };
  }, [recentDraws]);

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-amber-500/40 rounded-xl p-3 shadow-xl backdrop-blur text-xs">
          <p className="font-bold text-amber-400 text-sm">{data.digit}</p>
          <div className="mt-1 space-y-1 text-slate-300">
            <p className="flex justify-between gap-4">
              <span>ออกทั้งหมด:</span>
              <span className="font-bold text-white">{data.count} ครั้ง</span>
            </p>
            <p className="flex justify-between gap-4 text-emerald-400">
              <span>ในรางวัลที่ 1:</span>
              <span className="font-semibold">{data.prize1Count} ครั้ง</span>
            </p>
            <p className="flex justify-between gap-4 text-cyan-400">
              <span>ในเลขท้าย 2 ตัว:</span>
              <span className="font-semibold">{data.last2Count} ครั้ง</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomTimelineTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-indigo-500/40 rounded-xl p-3 shadow-xl backdrop-blur text-xs">
          <p className="font-bold text-indigo-300">{data.lotteryName}</p>
          <p className="text-slate-400 text-[11px] mb-2">{data.fullDate}</p>
          <div className="space-y-1.5 text-slate-200">
            <div className="flex items-center justify-between gap-4 bg-slate-800/80 px-2 py-1 rounded">
              <span className="text-amber-400 font-medium">เลขท้าย 2 ตัว:</span>
              <span className="font-black text-amber-300 text-sm">{data.เลขท้าย2ตัวDisplay}</span>
            </div>
            <div className="flex items-center justify-between gap-4 bg-slate-800/80 px-2 py-1 rounded">
              <span className="text-indigo-400 font-medium">เลขบน 3 ตัว:</span>
              <span className="font-black text-indigo-300 text-sm">{data.เลขบน3ตัวDisplay}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 tracking-tight">
                {title}
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Recharts Powered
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>
        </div>

        {/* Filters & Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lottery Type Filter */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700/80 text-xs">
            <button
              onClick={() => setTargetCategory('all')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                targetCategory === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setTargetCategory('gov')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                targetCategory === 'gov'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              รัฐบาลไทย
            </button>
            <button
              onClick={() => setTargetCategory('hanoi_lao')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                targetCategory === 'hanoi_lao'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ฮานอย / ลาว
            </button>
            <button
              onClick={() => setTargetCategory('stock')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                targetCategory === 'stock'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              หวยหุ้น
            </button>
          </div>

          {/* Draw Range selector */}
          <select
            value={drawLimit}
            onChange={(e) => setDrawLimit(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value={5}>5 งวดล่าสุด</option>
            <option value={10}>10 งวดล่าสุด</option>
            <option value={20}>20 งวดล่าสุด</option>
          </select>
        </div>
      </div>

      {recentDraws.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-slate-300">
          <div className="font-bold text-amber-300 mb-1">ยังไม่มีข้อมูลผลย้อนหลังที่ตรวจสอบได้</div>
          <p>เลือกหมวดอื่นหรือรอให้ระบบบันทึกผลจริงก่อน ระบบจะไม่สร้างตัวเลขตัวอย่างมาแสดงเป็นสถิติ</p>
        </div>
      ) : (
        <>
      {/* Highlights & Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hot Digits Card */}
        <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
              เลขเด่นมาบ่อย (Hot 3)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-bold">
              10 งวด
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {digitFrequencyData.hotDigits.map((item, idx) => (
              <button
                key={item.digit}
                onClick={() => onSelectNumber && onSelectNumber(item.digit.replace('เลข ', ''))}
                className="flex-1 bg-slate-800/80 hover:bg-amber-500/20 border border-amber-500/40 rounded-xl py-2 px-1 text-center transition cursor-pointer group"
              >
                <div className="text-lg font-black text-amber-300 group-hover:scale-110 transition">
                  {item.digit.replace('เลข ', '')}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">ออก {item.count} ครั้ง</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cold Digits Card */}
        <div className="bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-900 border border-cyan-500/30 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-cyan-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Snowflake className="w-4 h-4 text-cyan-400" />
              เลขดับ / ออกน้อย (Cold 3)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
              รอปลดล็อก
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {digitFrequencyData.coldDigits.map((item) => (
              <button
                key={item.digit}
                onClick={() => onSelectNumber && onSelectNumber(item.digit.replace('เลข ', ''))}
                className="flex-1 bg-slate-800/80 hover:bg-cyan-500/20 border border-cyan-500/40 rounded-xl py-2 px-1 text-center transition cursor-pointer group"
              >
                <div className="text-lg font-black text-cyan-300 group-hover:scale-110 transition">
                  {item.digit.replace('เลข ', '')}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">ออก {item.count} ครั้ง</div>
              </button>
            ))}
          </div>
        </div>

        {/* Parity (Even / Odd) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <PieIcon className="w-4 h-4 text-indigo-400" />
              สัดส่วนเลขคู่ / เลขคี่
            </span>
            <span className="text-[10px] text-slate-500">ท้าย 2 ตัว</span>
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-emerald-400">เลขคู่: {parityMetrics.evenPct}%</span>
              <span className="text-amber-400">เลขคี่: {parityMetrics.oddPct}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                style={{ width: `${parityMetrics.evenPct}%` }}
              ></div>
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-400 h-full transition-all duration-500"
                style={{ width: `${parityMetrics.oddPct}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* High / Low (50-99 vs 00-49) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-purple-400" />
              สัดส่วนเลขสูง / เลขต่ำ
            </span>
            <span className="text-[10px] text-slate-500">ท้าย 2 ตัว</span>
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-purple-400">สูง (50-99): {parityMetrics.highPct}%</span>
              <span className="text-sky-400">ต่ำ (00-49): {parityMetrics.lowPct}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500"
                style={{ width: `${parityMetrics.highPct}%` }}
              ></div>
              <div
                className="bg-gradient-to-r from-sky-500 to-blue-500 h-full transition-all duration-500"
                style={{ width: `${parityMetrics.lowPct}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Switcher Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs">
          <button
            onClick={() => setSelectedDigitType('digits')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              selectedDigitType === 'digits'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>ความถี่เลขโดด (0-9)</span>
          </button>

          <button
            onClick={() => setSelectedDigitType('trend')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              selectedDigitType === 'trend'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>เส้นทางแนวโน้มแต่ละงวด</span>
          </button>

          <button
            onClick={() => setSelectedDigitType('two_digits')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              selectedDigitType === 'two_digits'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>ยอดนิยม 2 ตัวท้าย</span>
          </button>
        </div>

        <span className="text-xs text-slate-400">
          แสดงข้อมูลจาก <strong className="text-white">{recentDraws.length}</strong> งวดล่าสุด
        </span>
      </div>

      {/* Recharts Area */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 sm:p-6 min-h-[340px]">
        {/* VIEW 1: BAR CHART DIGIT FREQUENCY 0-9 */}
        {selectedDigitType === 'digits' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-slate-300">
                กราฟแท่งแจกแจงความถี่ตัวเลข 0 ถึง 9 ในทุกตำแหน่งรางวัล
              </span>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
                  รางวัลที่ 1 / 3 ตัวบน
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-cyan-500"></span>
                  เลขท้าย 2 ตัว
                </span>
              </div>
            </div>

            <div className="w-full h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={digitFrequencyData.chartData}
                  margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="digit" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="prize1Count" name="รางวัลที่ 1" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="last2Count" name="เลขท้าย 2 ตัว" stackId="a" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 2: LINE / AREA CHART OF NUMERICAL MOVEMENT OVER TIME */}
        {selectedDigitType === 'trend' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-slate-300">
                เส้นกราฟแสดงการเคลื่อนไหวของเลขท้าย 2 ตัว (00-99) ตามลำดับงวด
              </span>
              <span className="text-indigo-400 font-medium text-[11px]">
                เรียงตามลำดับเวลาจากอดีต → ปัจจุบัน
              </span>
            </div>

            <div className="w-full h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  margin={{ top: 15, right: 10, left: -10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorLast2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 99]} tickLine={false} />
                  <Tooltip content={<CustomTimelineTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="เลขท้าย2ตัว"
                    name="เลขท้าย 2 ตัว"
                    stroke="#a855f7"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorLast2)"
                  />
                  <Line
                    type="monotone"
                    dataKey="เลขท้าย2ตัว"
                    stroke="#ec4899"
                    strokeWidth={2}
                    dot={{ fill: '#fbbf24', r: 5, strokeWidth: 2, stroke: '#1e1b4b' }}
                    activeDot={{ r: 7, fill: '#fbbf24' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 3: TOP 2-DIGIT FREQUENCIES */}
        {selectedDigitType === 'two_digits' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-slate-300">
                อันดับเลขท้าย 2 ตัวที่มีการออกซ้ำบ่อยที่สุดใน 10 งวด
              </span>
              <span className="text-emerald-400 text-[11px] font-medium">
                คลิกที่ตัวเลขเพื่อคัดลอกหรือค้นหา
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {twoDigitRanking.map((item, idx) => (
                <div
                  key={item.number}
                  onClick={() => onSelectNumber && onSelectNumber(item.number)}
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-3.5 transition cursor-pointer hover:shadow-lg group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        idx === 0
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-950'
                          : idx === 2
                          ? 'bg-amber-700 text-amber-100'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="text-xl font-black text-amber-300 group-hover:text-amber-400 transition">
                        {item.number}
                      </div>
                      <div className="text-[10px] text-slate-500">ออก {item.count} งวด</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-emerald-400">{item.percent}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick 2-digit bar breakdown */}
            <div className="w-full h-44 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={twoDigitRanking} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="number" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${val} ครั้ง`, 'จำนวนที่ออก']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#475569', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" name="จำนวนงวดที่ออก">
                    {twoDigitRanking.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Historical 10 Draws Summary List Table */}
      <div className="border border-slate-800/80 rounded-2xl overflow-hidden bg-slate-950/40">
        <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            ตารางผลการออกรางวัล {recentDraws.length} งวดล่าสุด
          </span>
          <span className="text-[11px] text-slate-400">คลิกที่หมายเลขเพื่อเลือกใช้งาน</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">ลำดับ</th>
                <th className="py-2.5 px-3">งวดวันที่</th>
                <th className="py-2.5 px-3">ชื่อหวย</th>
                <th className="py-2.5 px-3">รางวัลที่ 1 / 3 ตัวบน</th>
                <th className="py-2.5 px-3">เลขท้าย 2 ตัว</th>
                <th className="py-2.5 px-3 text-right">ลักษณะตัวเลข</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {recentDraws.map((item, idx) => {
                const prize1 = item.รางวัลที่_1 || item.เลขบน_3_ตัว || '-';
                const last2 = item.เลขท้าย_2_ตัว || item.เลขล่าง_2_ตัว || '-';
                const last2Num = parseInt(last2, 10);
                const isEven = !isNaN(last2Num) && last2Num % 2 === 0;
                const isHigh = !isNaN(last2Num) && last2Num >= 50;

                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-500 font-mono">#{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                      {item.งวดวันที่ || item.วันที่จัดรูปแบบ || `งวดที่ ${idx + 1}`}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                      {item.ชื่อหวย || item.หวย || 'ไม่ระบุชื่อหวย'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {prize1}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 text-sm">
                        {last2}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <span className="inline-flex gap-1 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${isEven ? 'bg-indigo-500/20 text-indigo-300' : 'bg-pink-500/20 text-pink-300'}`}>
                          {isEven ? 'คู่' : 'คี่'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${isHigh ? 'bg-purple-500/20 text-purple-300' : 'bg-sky-500/20 text-sky-300'}`}>
                          {isHigh ? 'สูง' : 'ต่ำ'}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
