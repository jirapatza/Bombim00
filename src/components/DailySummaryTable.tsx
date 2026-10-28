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
  RefreshCw
} from 'lucide-react';

export interface LotteryItem {
  id: string;
  name: string;
  category: 'foreign_stock' | 'thai_stock' | 'hanoi' | 'lao' | 'vip' | 'gov_savings' | 'other_foreign';
  categoryLabel: string;
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

  // Filter and sort items from morning to night
  const filteredLotteries = useMemo(() => {
    return lotteries.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
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
  }, [lotteries, selectedCategory, statusFilter, searchTerm]);

  // Statistics
  const totalCount = lotteries.length;
  const announcedCount = lotteries.filter((l) => l.status === 'announced').length;
  const waitingCount = totalCount - announcedCount;

  // Generate plain text summary for copying
  const copyDailySummaryText = () => {
    const todayStr = new Date().toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    let text = `📊 ตารางสรุปผลหวยทุกประเภท ประจำวันที่ ${todayStr}\n`;
    text += `รวมทั้งหมด ${totalCount} รายการ (ออกผลแล้ว ${announcedCount} • รอผล ${waitingCount})\n`;
    text += `========================================\n`;

    filteredLotteries.forEach((l) => {
      if (l.status === 'announced') {
        text += `${l.flag} ${l.name} (${l.drawTimeStr})\n   👉 3 ตัวบน: ${l.top3} | 2 ตัวล่าง: ${l.bottom2}\n`;
        if (l.setIndex) text += `   📈 ตลาด: ${l.setIndex}\n`;
      } else {
        text += `${l.flag} ${l.name} (${l.drawTimeStr}) ⏳ รอออกผล (ปิดรับ ${l.closeTimeStr})\n`;
      }
    });
    text += `========================================\n`;
    text += `ระบบ Lottery Alert Pro • อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH')} น.\n`;

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
              TIMELINE SUMMARY
            </span>
            <span className="text-xs text-slate-400">
              ตั้งแต่เช้าตรู่จรดค่ำ รวมทุกหวย {totalCount} รายการ
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-400" />
            ตารางสรุปผลหวยทุกประเภท ประจำวัน (Daily Timeline Matrix)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            สรุปผลครบทั้งหวยหุ้นไทย หวยหุ้นต่างประเทศ ตระกูลฮานอย ตระกูลลาว หวย VIP มาเลย์ และหวยรัฐบาล เรียงตามลำดับเวลาตั้งแต่เช้า
          </p>
        </div>

        {/* Action Button: Copy Full Summary */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyDailySummaryText}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition flex items-center gap-1.5"
          >
            <Copy className="w-4 h-4 text-amber-400" />
            {copiedSummary ? 'คัดลอกสรุปแล้ว!' : 'คัดลอกตารางสรุปทั้งหมด'}
          </button>
        </div>
      </div>

      {/* Metric Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">หวยทั้งหมดในระบบ</span>
            <span className="text-2xl font-black text-white font-mono">{totalCount}</span>
            <span className="text-[11px] text-slate-500 block">รายการ</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-bold">
            Σ
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-400 font-semibold block">ออกผลแล้ว</span>
            <span className="text-2xl font-black text-emerald-300 font-mono">{announcedCount}</span>
            <span className="text-[11px] text-slate-500 block">มีผล 3 ตัว/2 ตัว</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-400 font-semibold block">กำลังรอผลออก</span>
            <span className="text-2xl font-black text-amber-300 font-mono">{waitingCount}</span>
            <span className="text-[11px] text-slate-500 block">รอบค่ำ & ดึก</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Hourglass className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-purple-400 font-semibold block">หวยหุ้น & VIP</span>
            <span className="text-2xl font-black text-purple-300 font-mono">
              {lotteries.filter((l) => l.category === 'foreign_stock' || l.category === 'thai_stock' || l.category === 'vip').length}
            </span>
            <span className="text-[11px] text-slate-500 block">รายการครอบคลุม</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-3">
        {/* Category Pills */}
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
            onClick={() => setSelectedCategory('foreign_stock')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'foreign_stock'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌏 หุ้นต่างประเทศ (นิเคอิ, ฮั่งเส็ง, จีน, ดาวโจนส์)
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('thai_stock')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'thai_stock'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇹🇭 หุ้นไทย (เช้า, เที่ยง, บ่าย, เย็น)
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('hanoi')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'hanoi'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇻🇳 ตระกูลฮานอย (เฉพาะกิจ, พิเศษ, ปกติ)
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('lao')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'lao'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇱🇦 ตระกูลหวยลาว (พัฒนา, สตาร์)
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('vip')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'vip'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            💎 หวย VIP (ฮานอย VIP, ลาว VIP, ดาวโจนส์ VIP)
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('gov_savings')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'gov_savings'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🏛️ รัฐบาล & ออมสิน & ธ.ก.ส.
          </button>
        </div>

        {/* Search & Status Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="ค้นหาชื่อหวย, เลข 3 ตัว หรือ 2 ตัว..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">สถานะ:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('announced')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === 'announced' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400'
              }`}
            >
              ออกแล้ว
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('waiting')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === 'waiting' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400'
              }`}
            >
              รอผล
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
                <th className="py-3.5 px-4">รายการหวย / รอบ</th>
                <th className="py-3.5 px-3">หมวดหมู่</th>
                <th className="py-3.5 px-3">เวลาออกผล</th>
                <th className="py-3.5 px-3 text-center">3 ตัวบน</th>
                <th className="py-3.5 px-3 text-center">2 ตัวล่าง</th>
                <th className="py-3.5 px-3">ผลตลาด / รายละเอียด</th>
                <th className="py-3.5 px-3 text-center">สถานะ</th>
                <th className="py-3.5 px-4 text-right">เครื่องมือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {filteredLotteries.length > 0 ? (
                filteredLotteries.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition group cursor-pointer"
                    onClick={() => onSelectLottery(item)}
                  >
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

                    {/* Draw Time */}
                    <td className="py-3.5 px-3 font-semibold text-slate-300">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{item.drawTimeStr}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block font-normal">
                        ปิด {item.closeTimeStr}
                      </span>
                    </td>

                    {/* Top 3 */}
                    <td className="py-3.5 px-3 text-center">
                      {item.status === 'announced' ? (
                        <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm border border-amber-500/40 shadow-sm inline-block">
                          {item.top3}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-bold">---</span>
                      )}
                    </td>

                    {/* Bottom 2 */}
                    <td className="py-3.5 px-3 text-center">
                      {item.status === 'announced' ? (
                        <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-sm border border-emerald-500/40 shadow-sm inline-block">
                          {item.bottom2}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-bold">--</span>
                      )}
                    </td>

                    {/* Market Details / 1st Prize */}
                    <td className="py-3.5 px-3 text-[11px] text-slate-400 font-sans">
                      {item.setIndex ? (
                        <span className="font-mono text-cyan-300 block">{item.setIndex}</span>
                      ) : item.firstPrize ? (
                        <span className="font-mono text-slate-300 block">
                          เต็ม: <strong className="text-amber-200">{item.firstPrize}</strong>
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                      <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">
                        {item.source}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 text-center font-sans">
                      {item.status === 'announced' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ออกแล้ว
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                          <Hourglass className="w-3 h-3 text-amber-400" />
                          รอผล
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onSpeakLottery(item)}
                          disabled={item.status !== 'announced'}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 cursor-pointer disabled:opacity-30 transition"
                          title="ฟังเสียงอ่านผลภาษาไทย"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectLottery(item)}
                          className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold cursor-pointer transition flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          ดูสถิติ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
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
