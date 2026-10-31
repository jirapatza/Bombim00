import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Search,
  Filter,
  Volume2,
  CheckCircle2,
  Hourglass,
  ArrowUpDown,
  Download,
  Copy,
  TrendingUp,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Eye,
  RefreshCw,
  TableProperties,
  Edit3,
  Plus,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { parseLotteryTimelineMinutes } from './LiveUpcomingDraws';
import { EditLotteryModal } from './EditLotteryModal';

export interface LotteryItem {
  id: string;
  name: string;
  category: 'foreign_stock' | 'thai_stock' | 'hanoi' | 'lao' | 'vip' | 'gov_savings' | 'other_foreign';
  categoryLabel: string;
  period?: 'morning' | 'afternoon' | 'evening' | 'night';
  periodLabel?: string;
  flag: string;
  drawTimeStr: string;
  closeTimeStr: string;
  drawDays: string;
  status: 'announced' | 'waiting' | 'upcoming';
  top3: string;
  bottom2: string;
  firstPrize?: string;
  setIndex?: string;
  date: string;
  source: string;
  history?: Array<{ date: string; top3: string; bottom2: string }>;
}

interface DailySummaryProps {
  lotteries: LotteryItem[];
  onSelectLottery: (lottery: LotteryItem) => void;
  onSpeakLottery: (lottery: LotteryItem) => void;
  onUpdateLotteries?: (lotteries: LotteryItem[]) => void;
  nextClosing?: { name: string; closeTimeStr: string; remainingText: string } | null;
}

export const DailySummaryTable: React.FC<DailySummaryProps> = ({
  lotteries,
  onSelectLottery,
  onSpeakLottery,
  onUpdateLotteries,
  nextClosing,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closing_soon' | 'closed_waiting' | 'announced'>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Schedule editor state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLottery, setEditingLottery] = useState<LotteryItem | null>(null);

  // Bangkok time in minutes for 4-stage live calculation
  const getBangkokMinutes = () => {
    const now = new Date();
    const bangkokStr = now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour12: false });
    const bDate = new Date(bangkokStr);
    let hours = bDate.getHours();
    if (hours < 4) hours += 24;
    return hours * 60 + bDate.getMinutes();
  };
  const currentBangkokMinutes = getBangkokMinutes();

  // Helper to get 4-stage live status for any lottery
  const getItemStage = (item: LotteryItem) => {
    const closeMin = parseLotteryTimelineMinutes(item.closeTimeStr);
    const drawMin = parseLotteryTimelineMinutes(item.drawTimeStr);

    if (item.status === 'announced' || currentBangkokMinutes >= drawMin) {
      return {
        stage: 'announced' as const,
        label: 'ออกผลแล้ว',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        detail: `ออกผลแล้ว (${item.drawTimeStr})`,
      };
    }

    if (currentBangkokMinutes >= closeMin && currentBangkokMinutes < drawMin) {
      const waitMins = Math.max(1, drawMin - currentBangkokMinutes);
      return {
        stage: 'closed_waiting' as const,
        label: '🔴 ปิดรับแล้ว - รอผล',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse font-bold',
        detail: `ปิดรับแล้ว รอผลอีก ${waitMins} นาที`,
      };
    }

    const minsUntilClose = closeMin - currentBangkokMinutes;
    if (minsUntilClose <= 15 && minsUntilClose > 0) {
      return {
        stage: 'closing_soon' as const,
        label: `🟡 ใกล้ปิด! (${minsUntilClose}น.)`,
        badgeClass: 'bg-amber-500/25 text-amber-300 border-amber-500/50 animate-pulse font-bold',
        detail: `รีบแทง! เหลือ ${minsUntilClose} นาที`,
      };
    }

    return {
      stage: 'open' as const,
      label: '🟢 เปิดรับแทง',
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      detail: `ปิดรับ ${item.closeTimeStr}`,
    };
  };

  // Sort ALL lotteries strictly by real timeline order
  const chronoSorted = useMemo(() => {
    return [...lotteries].sort((a, b) => {
      return parseLotteryTimelineMinutes(a.drawTimeStr) - parseLotteryTimelineMinutes(b.drawTimeStr);
    });
  }, [lotteries]);

  // Filter items according to search, category, and 4-stage status
  const filteredLotteries = useMemo(() => {
    return chronoSorted.filter((item) => {
      // Period filter
      if (['morning', 'afternoon', 'evening', 'night'].includes(selectedCategory)) {
        if (item.period !== selectedCategory) return false;
      } else if (selectedCategory === 'vip') {
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

      // 4-Stage Status filter
      if (statusFilter !== 'all') {
        const itemStage = getItemStage(item).stage;
        if (itemStage !== statusFilter) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = item.name.toLowerCase().includes(term);
        const matchTop = item.top3.includes(term);
        const matchBottom = item.bottom2.includes(term);
        const matchCat = item.categoryLabel.toLowerCase().includes(term);
        if (!matchName && !matchTop && !matchBottom && !matchCat) return false;
      }
      return true;
    });
  }, [chronoSorted, selectedCategory, statusFilter, searchTerm, currentBangkokMinutes]);

  // Statistics for 4 stages
  const totalCount = lotteries.length;
  const stagesCount = useMemo(() => {
    let open = 0;
    let closing = 0;
    let closed = 0;
    let announced = 0;
    lotteries.forEach((l) => {
      const s = getItemStage(l).stage;
      if (s === 'open') open++;
      else if (s === 'closing_soon') closing++;
      else if (s === 'closed_waiting') closed++;
      else if (s === 'announced') announced++;
    });
    return { open, closing, closed, announced };
  }, [lotteries, currentBangkokMinutes]);

  const handleSaveLottery = (savedItem: LotteryItem) => {
    if (!onUpdateLotteries) return;
    const exists = lotteries.some((l) => l.id === savedItem.id);
    let updated: LotteryItem[];
    if (exists) {
      updated = lotteries.map((l) => (l.id === savedItem.id ? savedItem : l));
    } else {
      updated = [savedItem, ...lotteries];
    }
    onUpdateLotteries(updated);
  };

  const handleDeleteLottery = (id: string) => {
    if (!onUpdateLotteries) return;
    const updated = lotteries.filter((l) => l.id !== id);
    onUpdateLotteries(updated);
  };

  // Generate plain text summary for copying to LINE / Telegram
  const copyDailySummaryText = () => {
    const todayStr = new Date().toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    let text = `📊 ตารางสรุปผลหวยประจำวัน (${todayStr})\n`;
    text += `เรียงตามลำดับเวลาออกจริง ทั้งหมด ${totalCount} หวย\n`;
    text += `(ออกแล้ว ${stagesCount.announced} • รอผล ${stagesCount.closed} • กำลังเปิดรับ ${stagesCount.open + stagesCount.closing})\n`;
    text += `========================================\n`;

    chronoSorted.forEach((l, idx) => {
      if (l.status === 'announced') {
        text += `${idx + 1}. [${l.drawTimeStr}] ${l.flag} ${l.name}\n   👉 3 ตัวบน: ${l.top3} | 2 ตัวล่าง: ${l.bottom2}\n`;
        if (l.setIndex) text += `   📈 ตลาด: ${l.setIndex}\n`;
      } else {
        text += `${idx + 1}. [${l.drawTimeStr}] ${l.flag} ${l.name} ⏳ ยังไม่ออก (ปิดรับ ${l.closeTimeStr})\n`;
      }
    });
    text += `========================================\n`;
    text += `อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH')} น. • Lottery Alert System\n`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'foreign_stock':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'thai_stock':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'hanoi':
        return 'bg-red-500/15 text-red-300 border-red-500/30';
      case 'lao':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'vip':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'gov_savings':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
              DAILY RESULTS & SCHEDULE CONTROL
            </span>
            <span className="text-xs text-slate-400">
              ตารางเวลา 4 ช่วง (เช้า, บ่าย, เย็น, ดึก) พร้อมสถานะสด 4 ขั้นตอน
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-400" />
            ตารางสรุปผลหวยและตัวควบคุมตารางเวลา ({totalCount} รายการ)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ติดตามสถานะสด: กำลังเปิดรับ • ใกล้ปิดรับ • ปิดรับแล้วรอลุ้นผล • ออกผลรางวัลแล้ว และปุ่มแก้ไขเวลา
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Lottery Button */}
          {onUpdateLotteries && (
            <button
              type="button"
              onClick={() => {
                setEditingLottery(null);
                setIsEditModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 cursor-pointer shadow-md transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              เพิ่มหวยใหม่
            </button>
          )}

          {/* Copy Full Summary */}
          <button
            type="button"
            onClick={copyDailySummaryText}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 cursor-pointer shadow-md transition flex items-center gap-1.5"
          >
            <Copy className="w-4 h-4" />
            {copiedSummary ? 'คัดลอกแล้ว!' : 'คัดลอกสรุปผลทั้งหมด'}
          </button>
        </div>
      </div>

      {/* 4-Stage Live Metric Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Stage 1: Open */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}
          className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
            statusFilter === 'open'
              ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-xs text-blue-400 font-semibold block">🟢 กำลังเปิดรับแทง</span>
            <span className="text-2xl sm:text-3xl font-black text-blue-300 font-mono">{stagesCount.open}</span>
            <span className="text-[11px] text-slate-500 block">เปิดรับตามปกติ</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Hourglass className="w-5 h-5" />
          </div>
        </div>

        {/* Stage 2: Closing Soon (< 15 mins) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'closing_soon' ? 'all' : 'closing_soon')}
          className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
            statusFilter === 'closing_soon'
              ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-xs text-amber-400 font-semibold block">🟡 ใกล้ปิดรับแทง!</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">{stagesCount.closing}</span>
            <span className="text-[11px] text-slate-500 block">เหลือน้อยกว่า 15 นาที</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 animate-pulse text-amber-400" />
          </div>
        </div>

        {/* Stage 3: Closed & Waiting Draw */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'closed_waiting' ? 'all' : 'closed_waiting')}
          className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
            statusFilter === 'closed_waiting'
              ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-xs text-rose-400 font-semibold block">🔴 ปิดรับแล้ว - รอผล</span>
            <span className="text-2xl sm:text-3xl font-black text-rose-300 font-mono">{stagesCount.closed}</span>
            <span className="text-[11px] text-slate-500 block">กำลังรอลุ้นรางวัล</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <Clock className="w-5 h-5 animate-spin text-rose-400" style={{ animationDuration: '6s' }} />
          </div>
        </div>

        {/* Stage 4: Announced */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'announced' ? 'all' : 'announced')}
          className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
            statusFilter === 'announced'
              ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-xs text-emerald-400 font-semibold block">🔵 ออกผลรางวัลแล้ว</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">{stagesCount.announced}</span>
            <span className="text-[11px] text-slate-500 block">มีผล 3 ตัว / 2 ตัว</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-3">
        {/* Category Filter Pills */}
        <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌟 ทุกหวย ({lotteries.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('morning')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'morning'
                ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-amber-500/30'
            }`}
          >
            ☀️ หวยเช้า ({lotteries.filter((l) => l.period === 'morning').length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('afternoon')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'afternoon'
                ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-300'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-orange-500/30'
            }`}
          >
            🌤️ หวยบ่าย ({lotteries.filter((l) => l.period === 'afternoon').length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('evening')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'evening'
                ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-300'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-rose-500/30'
            }`}
          >
            🌇 หวยเย็น ({lotteries.filter((l) => l.period === 'evening').length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('night')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'night'
                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-indigo-500/30'
            }`}
          >
            🌌 หวยดึก ({lotteries.filter((l) => l.period === 'night').length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('vip')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'vip'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            👑 หวย VIP &amp; พิเศษ (
            {lotteries.filter((l) => l.category === 'vip' || l.name.includes('VIP') || l.categoryLabel.includes('VIP')).length}
            )
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('foreign_stock')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'foreign_stock'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌏 หุ้นต่างประเทศ
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('thai_stock')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'thai_stock'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇹🇭 หุ้นไทย
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('hanoi')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'hanoi'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇻🇳 ตระกูลฮานอย
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('lao')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'lao'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇱🇦 ตระกูลหวยลาว
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('gov_savings')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'gov_savings'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🏛️ รัฐบาล &amp; ออมสิน &amp; ธ.ก.ส.
          </button>
        </div>

        {/* Search & Status Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="ค้นหาชื่อหวย หรือตัวเลขผลรางวัล..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold text-[11px] mr-1">สถานะ:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] ${
                statusFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              ทั้งหมด ({chronoSorted.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('open')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] ${
                statusFilter === 'open' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              🟢 เปิดรับ ({stagesCount.open})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('closing_soon')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] ${
                statusFilter === 'closing_soon' ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/50' : 'text-slate-400 hover:text-white'
              }`}
            >
              🟡 ใกล้ปิด ({stagesCount.closing})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('closed_waiting')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] ${
                statusFilter === 'closed_waiting' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔴 ปิดรับแล้ว ({stagesCount.closed})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('announced')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] ${
                statusFilter === 'announced' ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔵 ออกผลแล้ว ({stagesCount.announced})
            </button>
          </div>
        </div>
      </div>

      {/* Main Timeline Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] font-bold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-3 text-center w-12">ลำดับ</th>
                <th className="py-3.5 px-3">เวลาออกผล</th>
                <th className="py-3.5 px-4">รายการหวย</th>
                <th className="py-3.5 px-3">เวลาปิดรับ</th>
                <th className="py-3.5 px-3">หมวดหมู่</th>
                <th className="py-3.5 px-3 text-center">3 ตัวบน</th>
                <th className="py-3.5 px-3 text-center">2 ตัวล่าง</th>
                <th className="py-3.5 px-3">ดัชนี / แหล่งข้อมูล</th>
                <th className="py-3.5 px-3 text-center">สถานะ</th>
                <th className="py-3.5 px-4 text-right">เครื่องมือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {filteredLotteries.length > 0 ? (
                filteredLotteries.map((item, index) => {
                  const isAnnounced = item.status === 'announced';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => onSelectLottery(item)}
                    >
                      {/* Order */}
                      <td className="py-3.5 px-3 text-center text-slate-500 font-bold">
                        {index + 1}
                      </td>

                      {/* Draw Time */}
                      <td className="py-3.5 px-3 font-semibold text-amber-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="font-bold">{item.drawTimeStr}</span>
                        </div>
                      </td>

                      {/* Name & Flag */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl shrink-0">{item.flag}</span>
                          <div>
                            <div className="font-bold text-white text-xs group-hover:text-amber-400 transition flex items-center gap-1.5">
                              {item.name}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {item.drawDays}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Closing Time */}
                      <td className="py-3.5 px-3 text-slate-400">
                        <span>{item.closeTimeStr}</span>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getCategoryBadgeClass(
                            item.category
                          )}`}
                        >
                          {item.categoryLabel}
                        </span>
                      </td>

                      {/* Top 3 */}
                      <td className="py-3.5 px-3 text-center">
                        {isAnnounced && item.top3 ? (
                          <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/40 shadow-sm inline-block">
                            {item.top3}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 text-slate-500 font-semibold text-xs border border-slate-800">
                            ⏳ รอผล
                          </span>
                        )}
                      </td>

                      {/* Bottom 2 */}
                      <td className="py-3.5 px-3 text-center">
                        {isAnnounced && item.bottom2 ? (
                          <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-sm border border-emerald-500/40 shadow-sm inline-block">
                            {item.bottom2}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 text-slate-500 font-semibold text-xs border border-slate-800">
                            ⏳ รอผล
                          </span>
                        )}
                      </td>

                      {/* Index / Source */}
                      <td className="py-3.5 px-3 text-slate-400 font-sans text-[11px] truncate max-w-[160px]">
                        {item.setIndex ? (
                          <span className="text-emerald-400 font-mono">{item.setIndex}</span>
                        ) : (
                          <span>{item.source}</span>
                        )}
                      </td>

                      {/* 4-Stage Live Status Badge */}
                      <td className="py-3.5 px-3 text-center font-sans">
                        {(() => {
                          const stageInfo = getItemStage(item);
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${stageInfo.badgeClass}`}
                              title={stageInfo.detail}
                            >
                              {stageInfo.stage === 'announced' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                              {stageInfo.stage === 'closed_waiting' && <Clock className="w-3 h-3 text-rose-400 animate-spin" style={{ animationDuration: '6s' }} />}
                              {stageInfo.stage === 'closing_soon' && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                              {stageInfo.stage === 'open' && <Hourglass className="w-3 h-3 text-blue-400" />}
                              {stageInfo.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Tools & Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Lottery Button */}
                          {onUpdateLotteries && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLottery(item);
                                setIsEditModalOpen(true);
                              }}
                              title="แก้ไขเวลาและข้อมูลหวยนี้"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSpeakLottery(item);
                            }}
                            title="ฟังเสียงประกาศ"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectLottery(item)}
                            title="ดูรายละเอียด"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500">
                    ไม่พบรายการหวยที่ตรงกับคำค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule & Lottery Editor Modal */}
      <EditLotteryModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingLottery(null);
        }}
        lottery={editingLottery}
        onSave={handleSaveLottery}
        onDelete={handleDeleteLottery}
      />
    </div>
  );
};
