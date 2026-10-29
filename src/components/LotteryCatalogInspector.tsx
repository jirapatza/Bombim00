import React, { useState } from 'react';
import {
  ListFilter,
  Search,
  Volume2,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  History,
  Send,
  Plus,
  CheckCircle2,
  Check,
  Calendar,
  Share2,
  Tv,
  Globe,
  Radio
} from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

interface CatalogProps {
  lotteries: LotteryItem[];
  selectedLottery: LotteryItem | null;
  onSelectLottery: (lottery: LotteryItem) => void;
  onSpeakLottery: (lottery: LotteryItem) => void;
  onAddWatchedNumber: (num: string) => void;
  onSwitchToBroadcast: (lottery: LotteryItem) => void;
}

export const LotteryCatalogInspector: React.FC<CatalogProps> = ({
  lotteries,
  selectedLottery,
  onSelectLottery,
  onSpeakLottery,
  onAddWatchedNumber,
  onSwitchToBroadcast,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [addedNumber, setAddedNumber] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'ทุกรายการ', count: lotteries.length },
    { id: 'morning', label: '☀️ หวยเช้า', count: lotteries.filter((l) => l.period === 'morning').length },
    { id: 'afternoon', label: '🌤️ หวยบ่าย', count: lotteries.filter((l) => l.period === 'afternoon').length },
    { id: 'evening', label: '🌇 หวยเย็น', count: lotteries.filter((l) => l.period === 'evening').length },
    { id: 'night', label: '🌌 หวยดึก', count: lotteries.filter((l) => l.period === 'night').length },
    { id: 'foreign_stock', label: 'หุ้นต่างประเทศ', count: lotteries.filter((l) => l.category === 'foreign_stock').length },
    { id: 'thai_stock', label: 'หุ้นไทย', count: lotteries.filter((l) => l.category === 'thai_stock').length },
    { id: 'hanoi', label: 'ฮานอย', count: lotteries.filter((l) => l.category === 'hanoi').length },
    { id: 'lao', label: 'หวยลาว', count: lotteries.filter((l) => l.category === 'lao').length },
    { id: 'vip', label: 'หวย VIP', count: lotteries.filter((l) => l.category === 'vip').length },
    { id: 'gov_savings', label: 'รัฐบาล & ออมสิน', count: lotteries.filter((l) => l.category === 'gov_savings').length },
  ];

  const filteredList = lotteries.filter((l) => {
    if (['morning', 'afternoon', 'evening', 'night'].includes(activeCategory)) {
      if (l.period !== activeCategory) return false;
    } else if (activeCategory !== 'all' && l.category !== activeCategory) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.top3.includes(q) ||
        l.bottom2.includes(q) ||
        l.categoryLabel.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const current = selectedLottery || lotteries[0];

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
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
              LOTTERY EXPLORER
            </span>
            <span className="text-xs text-slate-400">
              คลิกเลือกดูผลหวยแต่ละรายการได้อย่างอิสระ
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2">
            <ListFilter className="w-6 h-6 text-purple-400" />
            เมนูเลือกดูผลหวยทุกประเภท (All Lotteries Catalog & Inspector)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            เลือกดูผลหวยที่ต้องการ มีข้อมูลผลรางวัล 3 ตัวบน, 2 ตัวล่าง, ประวัติผลย้อนหลัง และสั่งอ่านออกเสียงภาษาไทยเฉพาะหวยนั้นได้ทันที
          </p>
        </div>
      </div>

      {/* Main Layout: Left Menu & Right Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Menu Selector (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-4 flex flex-col max-h-[800px]">
          {/* Search in Menu */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="ค้นหาเมนูหวย..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-purple-400"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex space-x-1.5 overflow-x-auto pb-1 text-[11px]">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer ${
                  activeCategory === c.id
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>

          {/* Menu Items List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredList.map((item) => {
              const isSelected = current?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectLottery(item)}
                  className={`w-full text-left p-3 rounded-2xl transition cursor-pointer flex items-center justify-between border ${
                    isSelected
                      ? 'bg-purple-950/40 border-purple-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{item.flag}</span>
                    <div className="truncate">
                      <div className="font-bold text-xs truncate flex items-center gap-1.5">
                        {item.name}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {item.drawTimeStr} • {item.categoryLabel}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    {item.status === 'announced' ? (
                      <div>
                        <span className="text-xs font-black font-mono text-amber-300">
                          {item.top3}
                        </span>
                        <span className="text-slate-500 font-mono text-xs mx-1">/</span>
                        <span className="text-xs font-black font-mono text-emerald-300">
                          {item.bottom2}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-medium">รอผล</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Inspector (8 cols) */}
        {current && (
          <div className="lg:col-span-8 space-y-6">
            {/* Top Showcase Banner for Selected Lottery */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-purple-950/40 border border-purple-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                <div className="flex items-center gap-3">
                  <span className="text-4xl p-2 rounded-2xl bg-slate-900 border border-slate-800">
                    {current.flag}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                        {current.categoryLabel}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ออกผล: <strong>{current.drawTimeStr}</strong> (ปิดรับ {current.closeTimeStr})
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-3xl font-black text-white mt-1">
                      {current.name}
                    </h3>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSpeakLottery(current)}
                    disabled={current.status !== 'announced'}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 cursor-pointer disabled:opacity-40 transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <Volume2 className="w-4 h-4" />
                    ฟังเสียงประกาศหวยนี้
                  </button>

                  <button
                    type="button"
                    onClick={() => onSwitchToBroadcast(current)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 cursor-pointer transition flex items-center gap-1.5"
                    title="นำขึ้นจอใหญ่ Live Broadcast"
                  >
                    <Tv className="w-4 h-4" />
                    ขึ้นจอ Live
                  </button>
                </div>
              </div>

              {/* Big Numbers Showcase */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/70 border-2 border-amber-500/40 rounded-2xl p-6 text-center space-y-1">
                  <span className="text-xs uppercase tracking-widest text-amber-400 font-bold block">
                    3 ตัวบน (Top 3)
                  </span>
                  <div className="text-5xl sm:text-6xl font-black text-amber-300 font-mono tracking-widest drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                    {current.top3 || '---'}
                  </div>
                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleWatch(current.top3)}
                      className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-700 flex items-center gap-1 cursor-pointer transition"
                    >
                      {addedNumber === current.top3 ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      เพิ่มเข้า Watchlist
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950/70 border-2 border-emerald-500/40 rounded-2xl p-6 text-center space-y-1">
                  <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold block">
                    2 ตัวล่าง (Bottom 2)
                  </span>
                  <div className="text-5xl sm:text-6xl font-black text-emerald-300 font-mono tracking-widest drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                    {current.bottom2 || '--'}
                  </div>
                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleWatch(current.bottom2)}
                      className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-700 flex items-center gap-1 cursor-pointer transition"
                    >
                      {addedNumber === current.bottom2 ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      เพิ่มเข้า Watchlist
                    </button>
                  </div>
                </div>
              </div>

              {/* Extra Market Details / 1st Prize */}
              {(current.setIndex || current.firstPrize) && (
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">
                    {current.setIndex ? 'ดัชนีตลาดหุ้น / จุดทศนิยม' : 'รางวัลที่ 1 เต็มหลัก'}
                  </span>
                  <span className="text-sm font-mono font-bold text-cyan-300">
                    {current.setIndex || current.firstPrize}
                  </span>
                </div>
              )}
            </div>

            {/* Historical Table for This Lottery */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" />
                  สถิติผลย้อนหลังเฉพาะ {current.name}
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  {current.history?.length || 0} งวดย้อนหลัง
                </span>
              </div>

              {current.history && current.history.length > 0 ? (
                <div className="space-y-2">
                  {current.history.map((h, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-bold w-5">{idx + 1}.</span>
                        <span className="text-xs font-sans text-slate-300">{h.date}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-sans">3 ตัว:</span>
                          <span className="text-sm font-bold text-amber-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {h.top3}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-sans">2 ตัว:</span>
                          <span className="text-sm font-bold text-emerald-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {h.bottom2}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-500 font-sans">
                  ยังไม่มีข้อมูลย้อนหลังสำหรับหวยนี้
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
