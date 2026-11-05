import React, { useState, useMemo } from 'react';
import {
  Timer,
  Search,
  X,
  Volume2,
  Copy,
  Share2,
  SearchX,
  Check,
} from 'lucide-react';
import { LotteryCatalogItem } from '../types/lottery';
import { ThaiTtsService, buildAnnouncement } from '../utils/thaiTts';
import { copyText } from '../utils/socialShare';

interface Props {
  lotteries: LotteryCatalogItem[];
  watchedNumbers: string[];
  isVoiceEnabled: boolean;
  nextClosing: { item: LotteryCatalogItem; remaining: string } | null;
}

export const LiveResultsScreen: React.FC<Props> = ({
  lotteries,
  watchedNumbers,
  isVoiceEnabled,
  nextClosing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('ทั้งหมด');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [selectedStatus, setSelectedStatus] = useState('ทั้งหมด');
  const [selectedDetail, setSelectedDetail] = useState<LotteryCatalogItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const periods = ['ทั้งหมด', 'หวยเช้า', 'หวยบ่าย', 'หวยเย็น', 'หวยดึก'];
  const categories = ['ทั้งหมด', 'รัฐบาล', 'หุ้น', 'VIP'];
  const statusOptions = ['ทั้งหมด', 'ออกแล้ว', 'รอผล'];

  const filteredLotteries = useMemo(() => {
    return lotteries.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.top3?.includes(q) ||
        item.bottom2?.includes(q) ||
        item.firstPrize?.includes(q);

      const matchPeriod =
        selectedPeriod === 'ทั้งหมด' ||
        (selectedPeriod === 'หวยเช้า' && (item.period === 'morning' || item.periodLabel.includes('เช้า'))) ||
        (selectedPeriod === 'หวยบ่าย' && (item.period === 'afternoon' || item.periodLabel.includes('บ่าย'))) ||
        (selectedPeriod === 'หวยเย็น' && (item.period === 'evening' || item.periodLabel.includes('เย็น'))) ||
        (selectedPeriod === 'หวยดึก' && (item.period === 'night' || item.periodLabel.includes('ดึก')));

      const matchCategory =
        selectedCategory === 'ทั้งหมด' ||
        (selectedCategory === 'รัฐบาล' &&
          (item.category === 'government' ||
            item.name.includes('รัฐบาล') ||
            item.name.includes('ออมสิน') ||
            item.name.includes('ธ.ก.ส.'))) ||
        (selectedCategory === 'หุ้น' && (item.category.includes('stock') || item.categoryLabel.includes('หุ้น'))) ||
        (selectedCategory === 'VIP' && (item.category.includes('vip') || item.name.includes('VIP') || item.name.includes('ลาว')));

      const isDrawn = item.status === 'drawn' || Boolean(item.top3) || Boolean(item.bottom2) || Boolean(item.firstPrize);
      const matchStatus =
        selectedStatus === 'ทั้งหมด' ||
        (selectedStatus === 'ออกแล้ว' && isDrawn) ||
        (selectedStatus === 'รอผล' && !isDrawn);

      return matchQuery && matchPeriod && matchCategory && matchStatus;
    });
  }, [lotteries, searchQuery, selectedPeriod, selectedCategory, selectedStatus]);

  const handleSpeak = (item: LotteryCatalogItem) => {
    if (!isVoiceEnabled) return;
    const speech = buildAnnouncement(item);
    ThaiTtsService.speak(speech);
  };

  const handleCopy = async (item: LotteryCatalogItem) => {
    const text = `${item.name}\n3 ตัวบน: ${item.top3 || '-'}\n2 ตัวล่าง: ${item.bottom2 || '-'}\nงวด: ${item.date || 'ล่าสุด'}`;
    const ok = await copyText(text);
    if (ok) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleShare = async (item: LotteryCatalogItem) => {
    const shareText = `📢 ผล${item.name}\n3 ตัวบน: ${item.top3 || 'รอผล'}\n2 ตัวล่าง: ${item.bottom2 || 'รอผล'}\nงวด: ${item.date || 'ล่าสุด'}\nดูผลหวยเพิ่มเติมในแอป Lottery Alert`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `ผล${item.name}`,
          text: shareText,
        });
      } catch {
        // ignore share cancellation
      }
    } else {
      await copyText(shareText);
      alert('คัดลอกข้อความสำหรับแชร์เรียบร้อย');
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Next Closing Ticker Banner */}
      {nextClosing && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-600/20 via-slate-900 to-slate-900 p-4 shadow-lg shadow-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-md">
              <Timer className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400">งวดที่ใกล้ปิดรับแทงที่สุด</span>
                <span className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-xs font-extrabold text-amber-300">
                  {nextClosing.remaining}
                </span>
              </div>
              <h3 className="truncate text-base font-black text-slate-100">
                {nextClosing.item.flag} {nextClosing.item.name}
              </h3>
              <p className="text-xs text-slate-400">
                ปิดรับแทง: {nextClosing.item.closeTimeStr} • ออกผล: {nextClosing.item.drawTimeStr}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Input Field */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ค้นหาชื่อหวย หรือตัวเลขผลรางวัล..."
          data-testid="search_lottery_input"
          className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-3 pl-12 pr-10 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Period & Category Filters */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-400">ช่วงเวลาและหมวดหมู่:</span>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {periods.map((p) => {
            const isSelected = selectedPeriod === p;
            return (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-amber-500 font-bold text-slate-950 shadow-sm'
                    : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((c) => {
            const isSelected = selectedCategory === c;
            return (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-amber-500 font-bold text-slate-950 shadow-sm'
                    : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Counter & Status Filters */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-bold text-slate-300">
          รายการหวยทั้งหมด ({filteredLotteries.length} รายการ)
        </span>
        <div className="flex gap-1.5">
          {statusOptions.map((st) => {
            const isSelected = selectedStatus === st;
            return (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lottery Card List */}
      {filteredLotteries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <SearchX className="h-14 w-14 text-slate-600 mb-2" />
          <p className="text-sm text-slate-400">ไม่พบหวยที่ตรงกับเงื่อนไขการค้นหา</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLotteries.map((item) => {
            const isDrawn =
              item.status === 'drawn' ||
              Boolean(item.top3?.trim()) ||
              Boolean(item.bottom2?.trim()) ||
              Boolean(item.firstPrize?.trim());

            const isWatchedMatch = watchedNumbers.some(
              (wn) =>
                (item.bottom2 && item.bottom2 === wn) ||
                (item.top3 && item.top3 === wn) ||
                (item.firstPrize && item.firstPrize.includes(wn))
            );

            const isGov =
              item.category === 'government' ||
              item.name.includes('รัฐบาล') ||
              item.name.includes('ออมสิน') ||
              item.name.includes('ธ.ก.ส.');

            return (
              <div
                key={item.id}
                data-testid={`lottery_card_${item.id}`}
                className={`rounded-2xl border bg-slate-900 p-4 transition-all hover:border-slate-700 ${
                  isWatchedMatch ? 'border-amber-500 shadow-md shadow-amber-500/10' : 'border-slate-800'
                }`}
              >
                {/* Header: Flag, Name, Status Badge */}
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => setSelectedDetail(item)}
                  >
                    <span className="text-2xl select-none">{item.flag}</span>
                    <div>
                      <h4 className="text-base font-black text-slate-100 hover:text-amber-400 transition-colors">
                        {item.name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {item.categoryLabel} • ปิด {item.closeTimeStr}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      isDrawn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isDrawn ? 'ออกผลแล้ว' : 'รอผล'}
                  </span>
                </div>

                {/* Lucky Watched Match Banner */}
                {isWatchedMatch && (
                  <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                    <span>★ ตรงกับเลขนำโชคที่คุณเฝ้าดู!</span>
                  </div>
                )}

                {/* Results Display */}
                <div className="mt-3">
                  {isGov && item.firstPrize ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col items-center justify-center rounded-xl bg-amber-500/15 py-2.5 px-3 border border-amber-500/30">
                        <span className="text-xs font-bold text-amber-400">รางวัลที่ 1</span>
                        <span className="font-mono-numbers text-2xl font-black tracking-widest text-amber-400">
                          {item.firstPrize}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-500/15 py-2.5 px-3 border border-emerald-500/30">
                        <span className="text-xs font-bold text-emerald-400">เลขท้าย 2 ตัว</span>
                        <span className="font-mono-numbers text-2xl font-black tracking-widest text-emerald-400">
                          {item.bottom2 || item.firstPrize.slice(-2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div
                        className={`flex flex-col items-center justify-center rounded-xl py-2 px-3 transition-colors ${
                          isDrawn
                            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                            : 'bg-slate-800/80 text-slate-500'
                        }`}
                      >
                        <span className="text-xs font-bold">3 ตัวบน</span>
                        <span
                          className={`font-mono-numbers text-2xl font-black tracking-wider ${
                            isDrawn ? 'text-amber-400' : 'text-slate-500'
                          }`}
                        >
                          {item.top3 || (isDrawn ? '---' : 'รอผล')}
                        </span>
                      </div>

                      <div
                        className={`flex flex-col items-center justify-center rounded-xl py-2 px-3 transition-colors ${
                          isDrawn
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                            : 'bg-slate-800/80 text-slate-500'
                        }`}
                      >
                        <span className="text-xs font-bold">2 ตัวล่าง</span>
                        <span
                          className={`font-mono-numbers text-2xl font-black tracking-wider ${
                            isDrawn ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {item.bottom2 || (isDrawn ? '--' : 'รอผล')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions: Date & Speak, Copy, Share */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-2.5 text-xs text-slate-400">
                  <span>งวด: {item.date || 'ล่าสุด'}</span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSpeak(item)}
                      title="ฟังเสียงประกาศรางวัล"
                      className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-500/10 transition-colors"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleCopy(item)}
                      title="คัดลอกผลรางวัล"
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 transition-colors"
                    >
                      {copiedId === item.id ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleShare(item)}
                      title="แชร์ผลรางวัล"
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 transition-colors"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal Dialog */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl">{selectedDetail.flag}</span>
                <h3 className="text-xl font-black text-slate-100">{selectedDetail.name}</h3>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-sm">
              <p className="font-bold text-amber-400">ข้อมูลกำหนดเวลาการออกรางวัล:</p>
              <p className="text-slate-300">
                • เวลาปิดรับแทง: <span className="font-bold text-slate-100">{selectedDetail.closeTimeStr}</span>
              </p>
              <p className="text-slate-300">
                • เวลาออกผลรางวัล: <span className="font-bold text-slate-100">{selectedDetail.drawTimeStr}</span>
              </p>
              <p className="text-slate-300">
                • วันที่เปิดให้แทง:{' '}
                <span className="font-bold text-slate-100">
                  {selectedDetail.drawDays || 'ทุกวัน (จันทร์ - อาทิตย์)'}
                </span>
              </p>
              <p className="text-slate-400 text-xs">
                • แหล่งข้อมูล: {selectedDetail.source || 'ระบบตรวจสอบผลอัตโนมัติ'}
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => handleSpeak(selectedDetail)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-slate-950 shadow-md hover:bg-amber-400 transition-colors"
              >
                <Volume2 className="h-4 w-4" />
                ฟังเสียงประกาศ
              </button>
              <button
                onClick={() => setSelectedDetail(null)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
