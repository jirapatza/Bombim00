import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  CheckCircle2,
  Hourglass,
  Calendar,
  Flame,
  TrendingUp,
  Share2,
  ChevronRight,
  ExternalLink,
  Search,
  Zap,
  Radio,
  Filter
} from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

interface LiveUpcomingDrawsProps {
  lotteries: LotteryItem[];
  onSelectLottery: (lottery: LotteryItem) => void;
  onSpeakLottery: (lottery: LotteryItem) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}

// Convert "HH:MM น." to minutes from 00:00
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 9999;
  const cleaned = timeStr.replace('น.', '').replace(' ', '').trim();
  const parts = cleaned.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return h * 60 + m;
    }
  }
  return 9999;
}

// Get current Bangkok time (UTC+7)
function getBangkokCurrentTime(): { hours: number; minutes: number; seconds: number; totalMinutes: number; timeStr: string } {
  const now = new Date();
  const bangkokStr = now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour12: false });
  const bDate = new Date(bangkokStr);
  const hours = bDate.getHours();
  const minutes = bDate.getMinutes();
  const seconds = bDate.getSeconds();
  const totalMinutes = hours * 60 + minutes;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { hours, minutes, seconds, totalMinutes, timeStr };
}

export function LiveUpcomingDraws({
  lotteries,
  onSelectLottery,
  onSpeakLottery,
  voiceEnabled,
  onToggleVoice,
}: LiveUpcomingDrawsProps) {
  const [bangkokTime, setBangkokTime] = useState(getBangkokCurrentTime());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Live 1-second clock
  useEffect(() => {
    const timer = setInterval(() => {
      setBangkokTime(getBangkokCurrentTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute the NEXT upcoming lottery dynamically based on current Bangkok time
  const { nextLottery, minutesRemaining, secondsRemaining, isTomorrow } = useMemo(() => {
    if (!lotteries || lotteries.length === 0) {
      return { nextLottery: null, minutesRemaining: 0, secondsRemaining: 0, isTomorrow: false };
    }

    const currentTotalMin = bangkokTime.totalMinutes;
    const currentSec = bangkokTime.seconds;

    // Look for lotteries today that haven't drawn yet (drawTime > currentTotalMin)
    const upcomingToday: Array<{ item: LotteryItem; diffMinutes: number }> = [];

    for (const item of lotteries) {
      const drawMin = parseTimeToMinutes(item.drawTimeStr);
      if (drawMin > currentTotalMin) {
        upcomingToday.push({
          item,
          diffMinutes: drawMin - currentTotalMin,
        });
      }
    }

    if (upcomingToday.length > 0) {
      // Sort closest first
      upcomingToday.sort((a, b) => a.diffMinutes - b.diffMinutes);
      const chosen = upcomingToday[0];
      const diffTotalSeconds = chosen.diffMinutes * 60 - currentSec;
      const minRem = Math.max(0, Math.floor(diffTotalSeconds / 60));
      const secRem = Math.max(0, diffTotalSeconds % 60);
      return { nextLottery: chosen.item, minutesRemaining: minRem, secondsRemaining: secRem, isTomorrow: false };
    }

    // If no more lotteries today, pick the earliest lottery tomorrow (e.g. 09:30 Nikkei or 04:00 Dow Jones)
    const sortedAll = [...lotteries].sort((a, b) => parseTimeToMinutes(a.drawTimeStr) - parseTimeToMinutes(b.drawTimeStr));
    const tomorrowItem = sortedAll[0] || null;
    return { nextLottery: tomorrowItem, minutesRemaining: 0, secondsRemaining: 0, isTomorrow: true };
  }, [lotteries, bangkokTime]);

  // Chronologically sort all lotteries according to draw time
  const sortedChronologicalLotteries = useMemo(() => {
    return [...lotteries].sort((a, b) => {
      const aMin = parseTimeToMinutes(a.drawTimeStr);
      const bMin = parseTimeToMinutes(b.drawTimeStr);
      return aMin - bMin;
    });
  }, [lotteries]);

  // Filtered list
  const displayLotteries = useMemo(() => {
    return sortedChronologicalLotteries.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = item.name.toLowerCase().includes(q);
        const mTop = item.top3.includes(q);
        const mBot = item.bottom2.includes(q);
        const mCat = item.categoryLabel.toLowerCase().includes(q);
        if (!mName && !mTop && !mBot && !mCat) return false;
      }
      return true;
    });
  }, [sortedChronologicalLotteries, selectedCategory, searchQuery]);

  const announcedCount = lotteries.filter((l) => l.status === 'announced').length;
  const waitingCount = lotteries.length - announcedCount;

  return (
    <div className="space-y-6">
      {/* Real-time Status Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                ศูนย์สรุปผลหวยสด &amp; คิวรอบถัดไป
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                ● Live Real-Time
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              เวลาปัจจุบัน (ไทย): <strong className="text-amber-300 font-mono text-sm">{bangkokTime.timeStr} น.</strong> • ออกผลแล้ว {announcedCount} • รอผล {waitingCount} จาก {lotteries.length} หวย
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleVoice}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 cursor-pointer ${
              voiceEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            <span>{voiceEnabled ? 'เสียงประกาศภาษาไทย: เปิด' : 'เสียงประกาศ: ปิด'}</span>
          </button>
        </div>
      </div>

      {/* ==================== HERO: NEXT UPCOMING LOTTERY IN LINE ==================== */}
      {nextLottery && (
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/80 via-slate-900 to-purple-950/80 border-2 border-indigo-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
          {/* Background Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-indigo-500/20 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950 flex items-center gap-1.5 shadow-md">
                <Flame className="w-3.5 h-3.5 fill-current" />
                หวยรอบถัดไปที่กำลังจะออก / ปิดรับ
              </span>
              <span className="text-xs text-indigo-300 font-medium">
                {nextLottery.categoryLabel}
              </span>
            </div>

            {/* Countdown Badge */}
            <div className="flex items-center gap-2">
              {!isTomorrow ? (
                <div className="px-4 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-sm font-bold flex items-center gap-2 shadow-inner">
                  <Hourglass className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>
                    ออกผลในอีก <strong className="text-white text-base">{minutesRemaining}</strong> นาที <strong className="text-white text-base">{secondsRemaining}</strong> วิ
                  </span>
                </div>
              ) : (
                <div className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                  รอบแรกของวันพรุ่งนี้ ({nextLottery.drawTimeStr})
                </div>
              )}
            </div>
          </div>

          {/* Main Card Content */}
          <div className="relative grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left 7 cols: Lottery Identity & Timing */}
            <div className="md:col-span-7 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{nextLottery.flag}</span>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    {nextLottery.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      ปิดรับ: <strong className="text-amber-300">{nextLottery.closeTimeStr}</strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      เวลาออกผล: <strong className="text-indigo-300">{nextLottery.drawTimeStr}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-slate-400">{nextLottery.drawDays}</span>
                  </div>
                </div>
              </div>

              {nextLottery.setIndex && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-300">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ดัชนีตลาด: <span className="font-bold text-white">{nextLottery.setIndex}</span>
                </div>
              )}
            </div>

            {/* Right 5 cols: Winning Numbers & Quick Actions */}
            <div className="md:col-span-5 bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                <span>ผลรางวัลล่าสุดที่บันทึก</span>
                <span className="text-[11px] text-indigo-300">{nextLottery.date}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">3 ตัวบน</span>
                  <span className="font-mono text-2xl font-black text-amber-400 tracking-wider">
                    {nextLottery.top3 || '-'}
                  </span>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">2 ตัวล่าง</span>
                  <span className="font-mono text-2xl font-black text-emerald-400 tracking-wider">
                    {nextLottery.bottom2 || '-'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSpeakLottery(nextLottery)}
                  className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  ฟังเสียงประกาศหวยนี้
                </button>

                <button
                  type="button"
                  onClick={() => onSelectLottery(nextLottery)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  ดูประวัติ
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Filter Pills & Search */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              ทั้งหมด ({lotteries.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('foreign_stock')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                selectedCategory === 'foreign_stock'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🌏 หุ้นต่างประเทศ (นิเคอิ/ฮั่งเส็ง/จีน/ดาวโจนส์)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('thai_stock')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                selectedCategory === 'thai_stock'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🇹🇭 หุ้นไทย (เช้า-ปิดเย็น)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('hanoi')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                selectedCategory === 'hanoi'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🇻🇳 หวยฮานอย (ปกติ/พิเศษ/VIP)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('lao')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                selectedCategory === 'lao'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🇱🇦 หวยลาว (พัฒนา/สตาร์/VIP)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('vip')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                selectedCategory === 'vip'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              ⭐ หวย VIP &amp; หุ้นดึก
            </button>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อหวยหรือตัวเลข..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* ==================== CHRONOLOGICAL CARDS TIMELINE ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayLotteries.map((item) => {
          const isAnnounced = item.status === 'announced';
          const isNext = nextLottery?.id === item.id;

          return (
            <div
              key={item.id}
              onClick={() => onSelectLottery(item)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-3 ${
                isNext
                  ? 'bg-gradient-to-br from-indigo-950/70 to-slate-900 border-indigo-500/60 shadow-xl ring-2 ring-indigo-500/30'
                  : 'bg-slate-900/80 hover:bg-slate-850 border-slate-800 hover:border-slate-700 shadow-md'
              }`}
            >
              {/* Card Top: Flag, Name, Timing, Status Badge */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{item.flag}</span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                        {item.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 block">
                        {item.categoryLabel}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {isNext ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      รอบถัดไป
                    </span>
                  ) : isAnnounced ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ออกผลแล้ว
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                      รอออกผล
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono bg-slate-950/50 px-2.5 py-1 rounded-lg border border-slate-850">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>ออกผล: <strong className="text-slate-200">{item.drawTimeStr}</strong></span>
                  <span>•</span>
                  <span>ปิดรับ: <strong className="text-slate-200">{item.closeTimeStr}</strong></span>
                </div>
              </div>

              {/* Numbers Section */}
              <div className="grid grid-cols-2 gap-2 text-center bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">3 ตัวบน</span>
                  <span className={`font-mono text-lg font-black tracking-wider ${isAnnounced ? 'text-amber-400' : 'text-slate-600'}`}>
                    {item.top3 || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">2 ตัวล่าง</span>
                  <span className={`font-mono text-lg font-black tracking-wider ${isAnnounced ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {item.bottom2 || '-'}
                  </span>
                </div>
              </div>

              {/* Card Footer: Index + Listen button */}
              <div className="flex items-center justify-between pt-1 text-xs">
                {item.setIndex ? (
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">
                    📈 {item.setIndex}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">
                    งวด {item.date}
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSpeakLottery(item);
                  }}
                  title="ฟังเสียงอ่านผลรางวัล"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
