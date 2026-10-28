import React, { useState, useEffect } from 'react';
import {
  Tv,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sparkles,
  Clock,
  Radio,
  Trophy,
  Flame,
  CheckCircle2,
  Bell,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Layers,
  Repeat
} from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

interface BroadcastKioskProps {
  latestDraw: any;
  allLotteries: LotteryItem[];
  selectedLottery: LotteryItem | null;
  onSelectLottery: (lottery: LotteryItem) => void;
  nextClosing: { name: string; closeTimeStr: string; remainingText: string };
  onTriggerSpeech: (lottery?: LotteryItem) => void;
  isSpeaking: boolean;
  onStopSpeech: () => void;
}

export const BroadcastKiosk: React.FC<BroadcastKioskProps> = ({
  allLotteries,
  selectedLottery,
  onSelectLottery,
  nextClosing,
  onTriggerSpeech,
  isSpeaking,
  onStopSpeech,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [autoCarousel, setAutoCarousel] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Active displayed lottery
  const activeLottery = selectedLottery || allLotteries[carouselIndex] || allLotteries[0];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto carousel effect
  useEffect(() => {
    if (!autoCarousel || allLotteries.length === 0) return;
    const interval = setInterval(() => {
      setCarouselIndex((prev) => {
        const next = (prev + 1) % allLotteries.length;
        onSelectLottery(allLotteries[next]);
        return next;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [autoCarousel, allLotteries, onSelectLottery]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const playChimeSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch {}
  };

  const handleNextLottery = () => {
    const currentIdx = allLotteries.findIndex((l) => l.id === activeLottery?.id);
    const nextIdx = (currentIdx + 1) % allLotteries.length;
    onSelectLottery(allLotteries[nextIdx]);
  };

  const handlePrevLottery = () => {
    const currentIdx = allLotteries.findIndex((l) => l.id === activeLottery?.id);
    const prevIdx = (currentIdx - 1 + allLotteries.length) % allLotteries.length;
    onSelectLottery(allLotteries[prevIdx]);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl transition-all duration-300 border border-amber-500/40 bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white shadow-2xl ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none p-8 flex flex-col justify-between' : 'p-6 sm:p-8'
      }`}
    >
      {/* Background Glow Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar / Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shadow-[0_0_15px_rgba(251,191,36,0.25)]">
            <Tv className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white animate-pulse">
                LIVE ON AIR
              </span>
              <span className="text-xs text-amber-400 font-mono font-bold">
                {currentTimeStr} น.
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 tracking-tight">
              สถานีจอถ่ายทอดสดรวมทุกหวย (Multi-Lottery Live TV Display)
            </h2>
          </div>
        </div>

        {/* Lottery Switcher & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lottery Selector Dropdown */}
          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-2 py-1">
            <span className="text-xs text-slate-400 mr-2 font-medium">สลับหวย:</span>
            <select
              value={activeLottery?.id || ''}
              onChange={(e) => {
                const found = allLotteries.find((l) => l.id === e.target.value);
                if (found) onSelectLottery(found);
              }}
              className="bg-transparent text-xs text-amber-300 font-bold focus:outline-none cursor-pointer"
            >
              {allLotteries.map((l) => (
                <option key={l.id} value={l.id} className="bg-slate-900 text-white">
                  {l.flag} {l.name} ({l.drawTimeStr})
                </option>
              ))}
            </select>
          </div>

          {/* Carousel Toggle */}
          <button
            type="button"
            onClick={() => setAutoCarousel(!autoCarousel)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
              autoCarousel
                ? 'bg-purple-600 text-white border-purple-400 animate-pulse'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="หมุนเวียนสลับหวยอัตโนมัติทุก 8 วินาที"
          >
            <Repeat className="w-3.5 h-3.5" />
            {autoCarousel ? 'หมุนเวียนเปิดอยู่' : 'สลับหวยวนอัตโนมัติ'}
          </button>

          {/* Previous / Next Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={handlePrevLottery}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title="หวยก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextLottery}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title="หวยถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={playChimeSound}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 cursor-pointer flex items-center gap-1.5 transition"
            title="กดเล่นเสียงระฆังเปิดงาน"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            เสียงกริ่ง
          </button>

          {isSpeaking ? (
            <button
              type="button"
              onClick={onStopSpeech}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white cursor-pointer flex items-center gap-1.5 animate-pulse transition"
            >
              <VolumeX className="w-4 h-4" />
              หยุดเสียง
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onTriggerSpeech(activeLottery)}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold shadow-lg shadow-amber-500/25 cursor-pointer flex items-center gap-1.5 transition"
            >
              <Volume2 className="w-4 h-4" />
              อ่านเสียงหวยนี้
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition"
            title={isFullscreen ? 'ย่อหน้าต่างกลับ' : 'แสดงผลเต็มหน้าจอ (TV Kiosk)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Lottery TV Showcase */}
      {activeLottery && (
        <div className="relative z-10 py-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl">{activeLottery.flag}</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {activeLottery.categoryLabel}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                เวลาออกผล: <strong>{activeLottery.drawTimeStr}</strong>
              </span>
            </div>
            <h3 className="text-2xl sm:text-5xl font-black text-white drop-shadow-md">
              {activeLottery.name}
            </h3>
            <span className="text-xs text-slate-400">
              งวดประจำวันที่ {activeLottery.date} • แหล่งข้อมูล: {activeLottery.source}
            </span>
          </div>

          {/* Huge Numbers Podium */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Top 3 Digits Podium */}
            <div className="relative group bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_35px_rgba(251,191,36,0.2)] flex flex-col items-center justify-center">
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/40">
                3 ตัวบน
              </div>
              <Trophy className="w-10 h-10 text-amber-400 mb-2 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
              <span className="text-sm uppercase tracking-widest text-amber-300 font-black mb-1">
                เลข 3 ตัวบน (Top 3)
              </span>
              <div className="text-6xl sm:text-8xl font-mono font-black text-amber-200 tracking-wider sm:tracking-widest drop-shadow-[0_0_25px_rgba(251,191,36,0.5)] my-2">
                {activeLottery.top3 || '---'}
              </div>
              <span className="text-xs text-slate-400 font-medium">
                ผลรางวัลสามตัวบนตรง
              </span>
            </div>

            {/* Bottom 2 Digits Podium */}
            <div className="relative group bg-gradient-to-b from-emerald-950/40 via-slate-900/90 to-slate-950 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_35px_rgba(52,211,153,0.2)] flex flex-col items-center justify-center">
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40">
                2 ตัวล่าง
              </div>
              <Flame className="w-10 h-10 text-emerald-400 mb-2 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
              <span className="text-sm uppercase tracking-widest text-emerald-300 font-black mb-1">
                เลข 2 ตัวล่าง (Bottom 2)
              </span>
              <div className="text-6xl sm:text-8xl font-mono font-black text-emerald-300 tracking-widest drop-shadow-[0_0_25px_rgba(52,211,153,0.5)] my-2">
                {activeLottery.bottom2 || '--'}
              </div>
              <span className="text-xs text-slate-400 font-medium">
                ผลรางวัลสองตัวล่างตรง
              </span>
            </div>
          </div>

          {/* Additional Market Details or First Prize */}
          {(activeLottery.setIndex || activeLottery.firstPrize) && (
            <div className="max-w-2xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
              <span className="text-xs text-slate-400 font-semibold block mb-1">
                {activeLottery.setIndex ? 'ดัชนีตลาดหุ้น / จุดทศนิยม' : 'รางวัลที่ 1 / รางวัลเต็ม'}
              </span>
              <span className="text-2xl font-mono font-black text-cyan-300">
                {activeLottery.setIndex || activeLottery.firstPrize}
              </span>
            </div>
          )}

          {/* Next Closing Countdown Alert Box */}
          <div className="max-w-4xl mx-auto bg-gradient-to-r from-indigo-950/60 via-purple-950/50 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                <Clock className="w-5 h-5 text-indigo-400 animate-spin" style={{ animationDuration: '8s' }} />
              </div>
              <div>
                <div className="text-xs text-indigo-300 font-semibold uppercase tracking-wider flex items-center gap-2">
                  <span>หวยรอบต่อไปที่จะปิดรับในเวลานี้</span>
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                </div>
                <div className="text-base font-bold text-white">
                  {nextClosing.name}{' '}
                  <span className="text-indigo-300 font-mono">({nextClosing.closeTimeStr})</span>
                </div>
              </div>
            </div>

            <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-indigo-500/30 text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">เวลาที่เหลือ</span>
              <span className="text-sm font-black text-amber-400 font-mono">
                {nextClosing.remainingText}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Breaking News Marquee */}
      <div className="relative z-10 bg-slate-950/90 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center gap-3 overflow-hidden">
        <div className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Radio className="w-3 h-3 animate-pulse" />
          สรุปผลทุกหวย
        </div>
        <div className="overflow-hidden whitespace-nowrap w-full">
          <div className="inline-block animate-marquee text-xs font-medium text-slate-300">
            {allLotteries.map((l, i) => (
              <span key={l.id} className="mr-6">
                {l.flag} <strong>{l.name}</strong>:{' '}
                {l.status === 'announced' ? (
                  <>
                    บน <span className="text-amber-400 font-mono font-bold">{l.top3}</span> / ล่าง{' '}
                    <span className="text-emerald-400 font-mono font-bold">{l.bottom2}</span>
                  </>
                ) : (
                  <span className="text-amber-300/80">รอผล (ปิด {l.closeTimeStr})</span>
                )}
                {i < allLotteries.length - 1 ? ' • ' : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
