import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Sparkles,
  PieChart,
  Plus,
  Check,
  Dices,
  Flame,
  Clock,
  ShieldAlert,
  Hash,
  Award
} from 'lucide-react';

interface AnalyticsProps {
  results: any[];
  watchedNumbers: string[];
  onAddWatchedNumber: (num: string) => void;
}

export const LotteryAnalytics: React.FC<AnalyticsProps> = ({
  results,
  watchedNumbers,
  onAddWatchedNumber,
}) => {
  const [selectedGeneratorType, setSelectedGeneratorType] = useState<'day_power' | 'hot_stat' | 'random'>('day_power');
  const [generatedLuckyNumbers, setGeneratedLuckyNumbers] = useState<{ twoDigits: string[]; threeDigits: string[] }>({
    twoDigits: ['84', '95'],
    threeDigits: ['594', '425'],
  });
  const [isSpinning, setIsSpinning] = useState(false);
  const [addedNumber, setAddedNumber] = useState<string | null>(null);

  // 1. Calculate 2-digit frequency
  const twoDigitStats = useMemo(() => {
    const freqMap: Record<string, number> = {};
    for (const r of results) {
      const num = r.เลขท้าย_2_ตัว;
      if (num) {
        freqMap[num] = (freqMap[num] || 0) + 1;
      }
    }
    const sorted = Object.entries(freqMap)
      .map(([num, count]) => ({ num, count, percentage: Math.round((count / Math.max(1, results.length)) * 100) }))
      .sort((a, b) => b.count - a.count);
    return sorted;
  }, [results]);

  // 2. High/Low & Even/Odd Distribution
  const distribution = useMemo(() => {
    let odd = 0;
    let even = 0;
    let high = 0; // 50-99
    let low = 0; // 00-49

    for (const r of results) {
      const num = parseInt(r.เลขท้าย_2_ตัว || '0', 10);
      if (num % 2 === 0) even++;
      else odd++;

      if (num >= 50) high++;
      else low++;
    }

    const total = Math.max(1, results.length);
    return {
      oddPercent: Math.round((odd / total) * 100),
      evenPercent: Math.round((even / total) * 100),
      highPercent: Math.round((high / total) * 100),
      lowPercent: Math.round((low / total) * 100),
    };
  }, [results]);

  // 3. Digit Frequency (0 to 9 in all 1st prizes)
  const digitCounts = useMemo(() => {
    const counts = Array(10).fill(0);
    for (const r of results) {
      const prize1 = r.รางวัลที่_1 || '';
      for (const char of prize1) {
        const d = parseInt(char, 10);
        if (!isNaN(d)) counts[d]++;
      }
    }
    const maxVal = Math.max(...counts, 1);
    return counts.map((count, digit) => ({ digit, count, barPercent: Math.round((count / maxVal) * 100) }));
  }, [results]);

  // Lucky Number Formula
  const generateLuckyNumbers = () => {
    setIsSpinning(true);
    setTimeout(() => {
      if (selectedGeneratorType === 'day_power') {
        const daysPower: Record<number, string[]> = {
          0: ['1', '8', '9'], // Sun
          1: ['9', '3', '7'], // Mon
          2: ['3', '0', '5'], // Tue
          3: ['2', '4', '8'], // Wed
          4: ['5', '9', '1'], // Thu
          5: ['6', '3', '4'], // Fri
          6: ['7', '2', '8'], // Sat
        };
        const day = new Date().getDay();
        const base = daysPower[day] || ['8', '4', '2'];
        const num2A = `${base[0]}${base[1]}`;
        const num2B = `${base[1]}${base[2]}`;
        const num3A = `${base[0]}${base[1]}${base[2]}`;
        const num3B = `${base[2]}${base[0]}${base[1]}`;
        setGeneratedLuckyNumbers({ twoDigits: [num2A, num2B], threeDigits: [num3A, num3B] });
      } else if (selectedGeneratorType === 'hot_stat') {
        const topNums = twoDigitStats.slice(0, 3).map((s) => s.num);
        const num2A = topNums[0] || '84';
        const num2B = topNums[1] || '95';
        setGeneratedLuckyNumbers({
          twoDigits: [num2A, num2B],
          threeDigits: [`2${num2A}`, `5${num2B}`],
        });
      } else {
        const rand2A = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const rand2B = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const rand3A = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const rand3B = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        setGeneratedLuckyNumbers({ twoDigits: [rand2A, rand2B], threeDigits: [rand3A, rand3B] });
      }
      setIsSpinning(false);
    }, 400);
  };

  const handleWatch = (num: string) => {
    onAddWatchedNumber(num);
    setAddedNumber(num);
    setTimeout(() => setAddedNumber(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            ระบบวิเคราะห์สถิติเลข & คาดการณ์เลขมงคล (Analytics Engine)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            วิเคราะห์ความถี่เลขท้าย 2 ตัว, เลขออกซ้ำ, สัดส่วนคู่-คี่, สูง-ต่ำ จากฐานข้อมูลย้อนหลัง {results.length} งวด
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
          <Award className="w-4 h-4 text-amber-400" />
          ประมวลผลย้อนหลัง: <strong>{results.length} งวด</strong>
        </div>
      </div>

      {/* Quick Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs text-slate-400 font-bold block mb-1">เลขท้าย 2 ตัวที่ออกบ่อยสุด</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400 font-mono">
              {twoDigitStats[0]?.num || '--'}
            </span>
            <span className="text-xs text-slate-400">
              (ออก {twoDigitStats[0]?.count || 0} ครั้ง)
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            คิดเป็น {twoDigitStats[0]?.percentage || 0}% ของสถิติทั้งหมด
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs text-slate-400 font-bold block mb-1">สัดส่วน เลขคู่ vs เลขคี่</span>
          <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
            <span className="text-indigo-400">คู่ {distribution.evenPercent}%</span>
            <span className="text-slate-600">:</span>
            <span className="text-pink-400">คี่ {distribution.oddPercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden flex">
            <div className="bg-indigo-500 h-full" style={{ width: `${distribution.evenPercent}%` }} />
            <div className="bg-pink-500 h-full" style={{ width: `${distribution.oddPercent}%` }} />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs text-slate-400 font-bold block mb-1">สัดส่วน เลขสูง (50-99) vs ต่ำ (00-49)</span>
          <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
            <span className="text-emerald-400">สูง {distribution.highPercent}%</span>
            <span className="text-slate-600">:</span>
            <span className="text-amber-400">ต่ำ {distribution.lowPercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: `${distribution.highPercent}%` }} />
            <div className="bg-amber-500 h-full" style={{ width: `${distribution.lowPercent}%` }} />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs text-slate-400 font-bold block mb-1">เลขเฝ้าระวังขณะนี้</span>
          <div className="text-2xl font-black text-amber-300 font-mono">
            {watchedNumbers.length} หมายเลข
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {watchedNumbers.slice(0, 4).join(', ')}...
          </span>
        </div>
      </div>

      {/* Main Grid: Top 10 Two-Digits vs Digit Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Table */}
        <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              อันดับเลขท้าย 2 ตัวที่ออกบ่อยที่สุด (Top 10 Hot Numbers)
            </h3>
            <span className="text-[11px] text-slate-400">เรียงตามความถี่</span>
          </div>

          <div className="space-y-2.5">
            {twoDigitStats.slice(0, 8).map((item, idx) => (
              <div
                key={item.num}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-amber-500/30 transition"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center font-mono ${
                      idx === 0
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-950'
                        : idx === 2
                        ? 'bg-amber-800 text-amber-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xl font-black font-mono text-amber-300 tracking-wider">
                    {item.num}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-28 bg-slate-800 h-2 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full"
                      style={{ width: `${Math.min(100, item.percentage * 3)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-300 w-12 text-right">
                    {item.count} ครั้ง
                  </span>

                  <button
                    type="button"
                    onClick={() => handleWatch(item.num)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 cursor-pointer transition border border-slate-700"
                    title="เพิ่มเข้าเลขเฝ้าระวัง"
                  >
                    {addedNumber === item.num ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Digit Frequency in First Prize (0-9) */}
        <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Hash className="w-4 h-4 text-emerald-400" />
              ความถี่ของแต่ละหลัก (0 - 9) ในรางวัลที่ 1
            </h3>
            <span className="text-[11px] text-slate-400">นับทุกตำแหน่ง</span>
          </div>

          <div className="space-y-2">
            {digitCounts.map((d) => (
              <div key={d.digit} className="flex items-center gap-3">
                <span className="w-6 text-center font-mono font-bold text-amber-400 text-sm">
                  {d.digit}
                </span>
                <div className="flex-1 bg-slate-950 h-5 rounded-lg overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded flex items-center justify-end px-2 text-[10px] font-bold text-slate-950 font-mono transition-all duration-500"
                    style={{ width: `${Math.max(10, d.barPercent)}%` }}
                  >
                    {d.count > 0 ? d.count : ''}
                  </div>
                </div>
                <span className="w-12 text-right font-mono text-xs text-slate-400">
                  {d.count} ครั้ง
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lucky Number Generator Widget */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30 p-6 rounded-3xl space-y-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Dices className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                เครื่องสุ่มเลขนำโชคประจำงวด (Lucky Number Generator)
              </h3>
              <p className="text-xs text-slate-400">
                คำนวณตามสูตรเลขกำลังวันมงคล, สูตรสถิติความถี่, หรือสุ่มอิสระ
              </p>
            </div>
          </div>

          {/* Generator Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setSelectedGeneratorType('day_power')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                selectedGeneratorType === 'day_power'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              สูตรกำลังวัน
            </button>
            <button
              type="button"
              onClick={() => setSelectedGeneratorType('hot_stat')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                selectedGeneratorType === 'hot_stat'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              สูตรสถิติเด่น
            </button>
            <button
              type="button"
              onClick={() => setSelectedGeneratorType('random')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                selectedGeneratorType === 'random'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              สุ่มอิสระ
            </button>
          </div>
        </div>

        {/* Display Generated Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 2 Digits */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-purple-300 font-bold block">เลขเด่น 2 ตัวตรง</span>
              <span className="text-[11px] text-slate-500">แนะนำสำหรับงวดนี้</span>
            </div>
            <div className="flex gap-2">
              {generatedLuckyNumbers.twoDigits.map((n, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-slate-900 px-3 py-2 rounded-xl border border-purple-500/40">
                  <span className="text-2xl font-black font-mono text-purple-300 tracking-wider">
                    {n}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleWatch(n)}
                    className="p-1 text-slate-400 hover:text-amber-400 cursor-pointer"
                    title="เพิ่มเข้า Watchlist"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 3 Digits */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-purple-300 font-bold block">เลขเด่น 3 ตัวตรง</span>
              <span className="text-[11px] text-slate-500">สูตรเสริมดวง</span>
            </div>
            <div className="flex gap-2">
              {generatedLuckyNumbers.threeDigits.map((n, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-slate-900 px-3 py-2 rounded-xl border border-purple-500/40">
                  <span className="text-2xl font-black font-mono text-amber-300 tracking-wider">
                    {n}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleWatch(n)}
                    className="p-1 text-slate-400 hover:text-amber-400 cursor-pointer"
                    title="เพิ่มเข้า Watchlist"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center">
          <button
            type="button"
            onClick={generateLuckyNumbers}
            disabled={isSpinning}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 cursor-pointer transition active:scale-95 inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            {isSpinning ? 'กำลังคำนวณตัวเลข...' : 'คำนวณ/สุ่มเลขนำโชคใหม่'}
          </button>
        </div>
      </div>
    </div>
  );
};
