import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
  BarChart3,
  Calendar,
  Filter,
} from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

interface QuickLotteryMenuProps {
  isOpen: boolean;
  onClose: () => void;
  lotteries: LotteryItem[];
  onSelectLottery: (lottery: LotteryItem) => void;
  onOpenStats: (lottery: LotteryItem) => void;
  selectedLotteryId?: string;
}

export const QuickLotteryMenu: React.FC<QuickLotteryMenuProps> = ({
  isOpen,
  onClose,
  lotteries,
  onSelectLottery,
  onOpenStats,
  selectedLotteryId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'gov_savings', label: '🏛️ รัฐบาล / ออมสิน' },
    { id: 'hanoi', label: '🇻🇳 ฮานอย' },
    { id: 'lao', label: '🇱🇦 ลาว' },
    { id: 'foreign_stock', label: '📈 หุ้นต่างประเทศ' },
    { id: 'thai_stock', label: '🇹🇭 หุ้นไทย' },
    { id: 'vip', label: '⭐ หวย VIP & พิเศษ' },
  ];

  const periods = [
    { id: 'all', label: 'ทุกรอบ' },
    { id: 'morning', label: '☀️ เช้า' },
    { id: 'afternoon', label: '🌤️ บ่าย' },
    { id: 'evening', label: '🌆 เย็น' },
    { id: 'night', label: '🌙 ดึก' },
  ];

  const filteredLotteries = useMemo(() => {
    return lotteries.filter((l) => {
      // Category filter
      if (selectedCategory !== 'all' && l.category !== selectedCategory) {
        return false;
      }
      // Period filter
      if (selectedPeriod !== 'all' && l.period !== selectedPeriod) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        return (
          l.name.toLowerCase().includes(query) ||
          l.categoryLabel.toLowerCase().includes(query) ||
          l.drawDays.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [lotteries, selectedCategory, selectedPeriod, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 animate-fadeIn modal-overlay overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>เมนูเลือกหวยทุกประเภท</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  {lotteries.length} หวย
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                ค้นหาและเจาะจงหวยที่ต้องการดูผลหรือเปิดสถิติ 10 งวดได้ทันที
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="ปิดเมนู"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 space-y-3 shrink-0">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อหวย เช่น ลาว EXTRA, ดาวโจนส์ VIP, ฮานอย..."
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === c.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Period Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-slate-500 text-[11px] mr-1 shrink-0">รอบเวลา:</span>
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                  selectedPeriod === p.id
                    ? 'bg-slate-700 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 divide-y divide-slate-800/80">
          {filteredLotteries.length === 0 ? (
            <div className="py-14 text-center text-slate-400">
              <p className="text-sm">ไม่พบหวยที่ตรงกับคำค้น "{searchTerm}"</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedPeriod('all');
                }}
                className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 text-amber-400 text-xs font-semibold hover:bg-slate-700"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredLotteries.map((l) => {
                const isSelected = selectedLotteryId === l.id;
                const isAnnounced = l.status === 'announced' || (l.top3 && l.bottom2);

                return (
                  <div
                    key={l.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-md ring-1 ring-amber-500/40'
                        : 'bg-slate-850/60 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                      onClick={() => {
                        onSelectLottery(l);
                        onClose();
                      }}
                    >
                      <span className="text-2xl shrink-0">{l.flag || '🎯'}</span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                          <span>{l.name}</span>
                          {isAnnounced && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          )}
                        </h4>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 truncate">
                          <span>ออก {l.drawTimeStr}</span>
                          <span>·</span>
                          <span>ปิด {l.closeTimeStr}</span>
                          {isAnnounced && (
                            <>
                              <span>·</span>
                              <span className="text-amber-300 font-mono font-semibold">
                                บน {l.top3} / ล่าง {l.bottom2}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenStats(l);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 text-xs transition-colors flex items-center gap-1"
                        title="ดูสถิติ 10 งวด"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline text-[11px]">สถิติ</span>
                      </button>

                      <button
                        onClick={() => {
                          onSelectLottery(l);
                          onClose();
                        }}
                        className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
                        title="เลือกดูผลหวยนี้"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs text-slate-400">
          <span>แสดง {filteredLotteries.length} จากทั้งหมด {lotteries.length} รายการ</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
