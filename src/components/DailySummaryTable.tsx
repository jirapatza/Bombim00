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
  TableProperties
} from 'lucide-react';
import { parseLotteryTimelineMinutes } from './LiveUpcomingDraws';

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
}

export const DailySummaryTable: React.FC<DailySummaryProps> = ({
  lotteries,
  onSelectLottery,
  onSpeakLottery,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'announced' | 'waiting'>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Sort ALL 31 lotteries strictly by real timeline order (09:30 morning to 04:00 night)
  const chronoSorted = useMemo(() => {
    return [...lotteries].sort((a, b) => {
      return parseLotteryTimelineMinutes(a.drawTimeStr) - parseLotteryTimelineMinutes(b.drawTimeStr);
    });
  }, [lotteries]);

  // Filter items according to search, category, and status
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
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
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
  }, [chronoSorted, selectedCategory, statusFilter, searchTerm]);

  // Statistics
  const totalCount = lotteries.length;
  const announcedCount = lotteries.filter((l) => l.status === 'announced').length;
  const waitingCount = totalCount - announcedCount;

  // Generate plain text summary for copying to LINE / Telegram
  const copyDailySummaryText = () => {
    const todayStr = new Date().toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    let text = `📊 ตารางสรุปผลหวยประจำวัน (${todayStr})\n`;
    text += `เรียงตามลำดับเวลาออกจริง ทั้งหมด ${totalCount} หวย\n`;
    text += `(ออกผลแล้ว ${announcedCount} • รอผล ${waitingCount})\n`;
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
              DAILY RESULTS MATRIX
            </span>
            <span className="text-xs text-slate-400">
              เรียงตามเวลาหวยออกจริง (09:30 น. เช้า ถึง 04:00 น. ดึก)
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-400" />
            ตารางสรุปผลหวยประจำวัน (ทุกหวย {totalCount} รายการ)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            แสดงสถานะหวยทุกประเภท: หวยที่ออกผลแล้วแสดงตัวเลขชัดเจน ส่วนหวยที่ยังไม่ออกจะแสดงสถานะ &quot;รอผล&quot; พร้อมเวลาปิดรับและเวลาออกรางวัล
          </p>
        </div>

        {/* Action Button: Copy Full Summary */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyDailySummaryText}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 cursor-pointer shadow-md transition flex items-center gap-1.5"
          >
            <Copy className="w-4 h-4" />
            {copiedSummary ? 'คัดลอกสรุปแล้ว!' : 'คัดลอกตารางสรุปผลทั้งหมด'}
          </button>
        </div>
      </div>

      {/* Metric Counters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">หวยทั้งหมดในระบบ</span>
            <span className="text-3xl font-black text-white font-mono">{totalCount}</span>
            <span className="text-[11px] text-slate-500 block">เรียงตามเวลาออกจริง</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-lg">
            <TableProperties className="w-6 h-6 text-indigo-400" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-400 font-semibold block">ออกผลแล้ว</span>
            <span className="text-3xl font-black text-emerald-300 font-mono">{announcedCount}</span>
            <span className="text-[11px] text-slate-500 block">แสดงเลข 3 ตัว / 2 ตัว</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-400 font-semibold block">ยังไม่ออก (รอผล)</span>
            <span className="text-3xl font-black text-amber-300 font-mono">{waitingCount}</span>
            <span className="text-[11px] text-slate-500 block">กำลังรอคิวออกตามเวลา</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Hourglass className="w-6 h-6 animate-pulse" />
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

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">สถานะผล:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                statusFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              ทั้งหมด ({chronoSorted.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('announced')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                statusFilter === 'announced' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              ✅ ออกแล้ว ({announcedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('waiting')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                statusFilter === 'waiting' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⏳ ยังไม่ออก (รอผล) ({waitingCount})
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

                      {/* Status Badge */}
                      <td className="py-3.5 px-3 text-center font-sans">
                        {isAnnounced ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ออกแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Hourglass className="w-3 h-3 text-amber-400" />
                            รอผล
                          </span>
                        )}
                      </td>

                      {/* Tools & Listen */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
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
    </div>
  );
};
