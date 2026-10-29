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
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  TableProperties
} from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

interface LiveUpcomingDrawsProps {
  lotteries: LotteryItem[];
  onSelectLottery: (lottery: LotteryItem) => void;
  onSpeakLottery: (lottery: LotteryItem) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onNavigateToSummary?: () => void;
}

// Convert "HH:MM น." to session timeline minutes
// 09:30 -> 570 mins
// 23:30 -> 1410 mins
// 01:00 (close) -> 1440 + 60 = 1500 mins
// 04:00 (Dow Jones draw) -> 1440 + 240 = 1680 mins
export function parseLotteryTimelineMinutes(timeStr: string): number {
  if (!timeStr) return 9999;
  const cleaned = timeStr.replace('น.', '').replace(' ', '').trim();
  const parts = cleaned.split(':');
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      // Overnight draws from 00:00 to 06:00 count at the end of the day's cycle
      if (h < 7) {
        h += 24;
      }
      return h * 60 + m;
    }
  }
  return 9999;
}

// Get current Bangkok time (UTC+7)
function getBangkokCurrentTime(): { hours: number; minutes: number; seconds: number; timelineMinutes: number; timeStr: string } {
  const now = new Date();
  const bangkokStr = now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour12: false });
  const bDate = new Date(bangkokStr);
  const hours = bDate.getHours();
  const minutes = bDate.getMinutes();
  const seconds = bDate.getSeconds();
  let timelineHours = hours;
  if (hours < 7) {
    timelineHours = hours + 24;
  }
  const timelineMinutes = timelineHours * 60 + minutes;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { hours, minutes, seconds, timelineMinutes, timeStr };
}

export function LiveUpcomingDraws({
  lotteries,
  onSelectLottery,
  onSpeakLottery,
  voiceEnabled,
  onToggleVoice,
  onNavigateToSummary,
}: LiveUpcomingDrawsProps) {
  const [bangkokTime, setBangkokTime] = useState(getBangkokCurrentTime());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Optional Simulation Mode: allow previewing morning (10:00), afternoon (15:00), evening (18:00), or real-time
  const [simulatedHour, setSimulatedHour] = useState<number | null>(null);

  // Live 1-second clock
  useEffect(() => {
    const timer = setInterval(() => {
      setBangkokTime(getBangkokCurrentTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Effective Bangkok timeline minutes (real or simulated)
  const currentEffectiveMinutes = useMemo(() => {
    if (simulatedHour !== null) {
      let h = simulatedHour;
      if (h < 7) h += 24;
      return h * 60 + bangkokTime.minutes;
    }
    return bangkokTime.timelineMinutes;
  }, [simulatedHour, bangkokTime]);

  // Sort ALL lotteries strictly by real timeline (09:30 morning to 04:00 night)
  const chronoSortedAll = useMemo(() => {
    return [...lotteries].sort((a, b) => {
      return parseLotteryTimelineMinutes(a.drawTimeStr) - parseLotteryTimelineMinutes(b.drawTimeStr);
    });
  }, [lotteries]);

  // Split lotteries:
  // 1) UPCOMING / WAITING: has not drawn yet (drawTime > currentEffectiveMinutes)
  // 2) ANNOUNCED: has already drawn (drawTime <= currentEffectiveMinutes)
  const { upcomingLotteries, announcedLotteries, nextLottery, minutesRemaining, secondsRemaining, isTomorrow } = useMemo(() => {
    if (!chronoSortedAll || chronoSortedAll.length === 0) {
      return {
        upcomingLotteries: [],
        announcedLotteries: [],
        nextLottery: null,
        minutesRemaining: 0,
        secondsRemaining: 0,
        isTomorrow: false,
      };
    }

    const upcoming: LotteryItem[] = [];
    const announced: LotteryItem[] = [];

    chronoSortedAll.forEach((item) => {
      const drawMin = parseLotteryTimelineMinutes(item.drawTimeStr);
      if (drawMin > currentEffectiveMinutes) {
        upcoming.push(item);
      } else {
        announced.push(item);
      }
    });

    // In announced list: sort reverse-chronological so the MOST RECENTLY ANNOUNCED comes first!
    announced.sort((a, b) => parseLotteryTimelineMinutes(b.drawTimeStr) - parseLotteryTimelineMinutes(a.drawTimeStr));

    if (upcoming.length > 0) {
      const next = upcoming[0];
      const nextDrawMin = parseLotteryTimelineMinutes(next.drawTimeStr);
      const diffTotalSeconds = Math.max(0, (nextDrawMin - currentEffectiveMinutes) * 60 - bangkokTime.seconds);
      const minRem = Math.floor(diffTotalSeconds / 60);
      const secRem = diffTotalSeconds % 60;
      return {
        upcomingLotteries: upcoming,
        announcedLotteries: announced,
        nextLottery: next,
        minutesRemaining: minRem,
        secondsRemaining: secRem,
        isTomorrow: false,
      };
    }

    // If all draws finished today: next lottery is the first draw tomorrow morning (Nikkei 09:30)
    return {
      upcomingLotteries: [],
      announcedLotteries: announced,
      nextLottery: chronoSortedAll[0],
      minutesRemaining: 0,
      secondsRemaining: 0,
      isTomorrow: true,
    };
  }, [chronoSortedAll, currentEffectiveMinutes, bangkokTime.seconds]);

  // Filtered upcoming lotteries for display on the main page
  const displayUpcomingLotteries = useMemo(() => {
    return upcomingLotteries.filter((item) => {
      if (selectedCategory === 'vip') {
        const isVip = item.category === 'vip' || item.name.includes('VIP') || item.categoryLabel.includes('VIP');
        if (!isVip) return false;
      } else if (selectedCategory === 'hanoi') {
        const isHanoi = item.category === 'hanoi' || item.name.includes('ฮานอย');
        if (!isHanoi) return false;
      } else if (selectedCategory === 'lao') {
        const isLao = item.category === 'lao' || item.name.includes('ลาว');
        if (!isLao) return false;
      } else if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = item.name.toLowerCase().includes(q);
        const mCat = item.categoryLabel.toLowerCase().includes(q);
        if (!mName && !mCat) return false;
      }
      return true;
    });
  }, [upcomingLotteries, selectedCategory, searchQuery]);

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
                หน้าหลัก: หวยที่ยังไม่ออก &amp; กำลังจะออกผล
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                ● เรียงตามเวลาออกผลจริง
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              เวลาปัจจุบัน (ไทย): <strong className="text-amber-300 font-mono text-sm">{bangkokTime.timeStr} น.</strong> • 
              กำลังรอออกผล <strong className="text-amber-400">{upcomingLotteries.length}</strong> หวย • 
              ออกผลแล้ว <strong className="text-emerald-400">{announcedLotteries.length}</strong> หวย (จากทั้งหมด {lotteries.length} หวย)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Simulation dropdown if user wants to test morning/afternoon/night */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={simulatedHour === null ? 'real' : simulatedHour}
              onChange={(e) => {
                const val = e.target.value;
                setSimulatedHour(val === 'real' ? null : parseInt(val, 10));
              }}
              className="bg-transparent text-slate-300 font-medium focus:outline-none cursor-pointer"
            >
              <option value="real">🕒 เวลาจริง ({bangkokTime.timeStr})</option>
              <option value="9">🌅 จำลอง 09:00 น. (เช้า - รอ 31 หวย)</option>
              <option value="12">☀️ จำลอง 12:00 น. (เที่ยง)</option>
              <option value="15">🌤️ จำลอง 15:30 น. (บ่ายแก่)</option>
              <option value="18">🌇 จำลอง 18:00 น. (ช่วงเย็น)</option>
              <option value="21">🌙 จำลอง 21:00 น. (รอบค่ำ)</option>
              <option value="23">🌌 จำลอง 23:15 น. (รอบดึก)</option>
            </select>
          </div>

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
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/90 via-slate-900 to-purple-950/80 border-2 border-amber-500/50 rounded-3xl p-6 shadow-2xl space-y-4">
          {/* Background Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-indigo-500/20 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950 flex items-center gap-1.5 shadow-md">
                <Flame className="w-3.5 h-3.5 fill-current" />
                หวยตัวถัดไปที่กำลังจะออกผล (คิวถัดไป)
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
                <div className="px-3 py-1.5 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  หวยรอบแรกของวันพรุ่งนี้ ({nextLottery.drawTimeStr})
                </div>
              )}
            </div>
          </div>

          {/* Main Card Content */}
          <div className="relative grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left 7 cols: Lottery Identity & Timing */}
            <div className="md:col-span-7 space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-5xl drop-shadow-md">{nextLottery.flag}</span>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    {nextLottery.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1.5">
                    <span className="flex items-center gap-1 bg-amber-500/15 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      ปิดรับเวลา: <strong className="text-white">{nextLottery.closeTimeStr}</strong>
                    </span>
                    <span className="flex items-center gap-1 bg-indigo-500/15 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      เวลาออกผล: <strong className="text-white">{nextLottery.drawTimeStr}</strong>
                    </span>
                    <span className="text-slate-400 text-xs">{nextLottery.drawDays}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
                <span>แหล่งข้อมูล: <strong className="text-slate-200">{nextLottery.source}</strong></span>
                {nextLottery.setIndex && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-400 font-mono">ดัชนีอ้างอิง: {nextLottery.setIndex}</span>
                  </>
                )}
              </div>
            </div>

            {/* Right 5 cols: Waiting State & Action Buttons */}
            <div className="md:col-span-5 bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <Hourglass className="w-3.5 h-3.5" />
                  สถานะ: กำลังรอออกผล
                </span>
                <span className="text-[11px] text-slate-400 font-mono">{nextLottery.drawTimeStr}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">3 ตัวบน</span>
                  <span className="font-mono text-xl font-bold text-amber-400/80">
                    ⏳ รอผล
                  </span>
                </div>

                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">2 ตัวล่าง</span>
                  <span className="font-mono text-xl font-bold text-emerald-400/80">
                    ⏳ รอผล
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSpeakLottery(nextLottery)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Volume2 className="w-4 h-4" />
                  ทดสอบเสียงแจ้งเตือนหวยนี้
                </button>

                <button
                  type="button"
                  onClick={() => onSelectLottery(nextLottery)}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  ดูรายละเอียด
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LIST OF ALL UPCOMING LOTTERIES TODAY ==================== */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              หวยที่ยังไม่ออกผลวันนี้ ({upcomingLotteries.length} หวย)
            </h3>
            <span className="text-xs text-slate-400">
              เรียงลำดับตามเวลาออกผลจริงจากเช้าไปค่ำ
            </span>
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌟 ทั้งหมด ({upcomingLotteries.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('vip')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'vip'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            👑 หวย VIP &amp; พิเศษ (
            {upcomingLotteries.filter((l) => l.category === 'vip' || l.name.includes('VIP') || l.categoryLabel.includes('VIP')).length}
            )
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('hanoi')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'hanoi'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇻🇳 ฮานอย ({upcomingLotteries.filter((l) => l.category === 'hanoi' || l.name.includes('ฮานอย')).length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('lao')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'lao'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇱🇦 หวยลาว ({upcomingLotteries.filter((l) => l.category === 'lao' || l.name.includes('ลาว')).length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('foreign_stock')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'foreign_stock'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌏 หุ้นต่างประเทศ ({upcomingLotteries.filter((l) => l.category === 'foreign_stock').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('thai_stock')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'thai_stock'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇹🇭 หุ้นไทย ({upcomingLotteries.filter((l) => l.category === 'thai_stock').length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อหวย เช่น นิเคอิ VIP, ลาว, ฮานอย..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        {displayUpcomingLotteries.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayUpcomingLotteries.map((item, idx) => {
              const isNext = nextLottery?.id === item.id;
              const itemDrawMin = parseLotteryTimelineMinutes(item.drawTimeStr);
              const diffMin = Math.max(0, itemDrawMin - currentEffectiveMinutes);
              const hoursWait = Math.floor(diffMin / 60);
              const minsWait = diffMin % 60;

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectLottery(item)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-3 ${
                    isNext
                      ? 'bg-gradient-to-br from-indigo-950/70 to-slate-900 border-amber-500/70 shadow-xl ring-2 ring-amber-500/20'
                      : 'bg-slate-900/80 hover:bg-slate-850 border-slate-800 hover:border-slate-700 shadow-md'
                  }`}
                >
                  <div>
                    {/* Top row: Flag, Name, Category */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{item.flag}</span>
                        <div>
                          <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                            {item.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 block">
                            {item.categoryLabel}
                          </span>
                        </div>
                      </div>

                      {isNext ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          คิวถัดไป
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          ลำดับที่ {idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Time Schedule Row */}
                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center gap-1 text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>ปิดรับ: <strong className="text-white">{item.closeTimeStr}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-indigo-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>ออกผล: <strong className="text-white">{item.drawTimeStr}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Waiting Number Placeholder */}
                  <div className="grid grid-cols-2 gap-2 text-center bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">3 ตัวบน</span>
                      <span className="font-mono text-base font-bold text-slate-500">
                        ⏳ รอผล
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">2 ตัวล่าง</span>
                      <span className="font-mono text-base font-bold text-slate-500">
                        ⏳ รอผล
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Remaining Time & Speak button */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                      <Hourglass className="w-3 h-3 animate-spin" />
                      {hoursWait > 0 ? `อีกประมาณ ${hoursWait} ชม. ${minsWait} น.` : `อีกประมาณ ${minsWait} นาที`}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSpeakLottery(item);
                      }}
                      title="ฟังเสียงประกาศรอบถัดไป"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="text-base font-bold text-white">
              หวยทุกตัวในรอบวันนี้ได้ออกผลครบถ้วนแล้ว!
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              ท่านสามารถดูผลรางวัลย้อนหลังและสรุปตัวเลขทั้งหมด 31 รายการได้ที่ตารางสรุปผลรายวัน
            </p>
            {onNavigateToSummary && (
              <button
                type="button"
                onClick={onNavigateToSummary}
                className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer inline-flex items-center gap-1.5"
              >
                <TableProperties className="w-4 h-4" />
                เปิดดูตารางสรุปผลรายวัน
              </button>
            )}
          </div>
        )}
      </div>

      {/* ==================== RECENTLY ANNOUNCED DRAWS SECTION ==================== */}
      {announcedLotteries.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                🎉 หวยที่เพิ่งออกผลไปล่าสุด ({announcedLotteries.length} หวยที่ออกแล้ววันนี้)
              </h3>
            </div>

            {onNavigateToSummary && (
              <button
                type="button"
                onClick={onNavigateToSummary}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>ดูตารางสรุปผลหวยทั้งหมด ({lotteries.length} รายการ)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Show top 4 most recently announced */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {announcedLotteries.slice(0, 4).map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectLottery(item)}
                className="bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 p-3.5 rounded-2xl transition cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{item.flag}</span>
                    <span className="text-xs font-bold text-slate-100 truncate max-w-[120px]">
                      {item.name}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {item.drawTimeStr}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-[9px] text-slate-400 block">3 ตัวบน</span>
                    <span className="font-mono text-lg font-black text-amber-400">
                      {item.top3 || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block">2 ตัวล่าง</span>
                    <span className="font-mono text-lg font-black text-emerald-400">
                      {item.bottom2 || '-'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <span className="truncate max-w-[120px]">{item.setIndex || item.source}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSpeakLottery(item);
                    }}
                    className="p-1 rounded bg-slate-800 text-slate-300 hover:text-amber-400"
                    title="ฟังเสียงประกาศ"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
