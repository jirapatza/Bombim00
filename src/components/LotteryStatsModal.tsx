import React, { useMemo, useState } from 'react';
import {
  X,
  TrendingUp,
  BarChart3,
  Calendar,
  Clock,
  Sparkles,
  Copy,
  Check,
  Flame,
  Award,
  Hash,
  Share2,
  Volume2,
  Layers,
  ArrowUpDown,
  Percent,
} from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

interface LotteryStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lottery: LotteryItem | null;
  results?: any[];
  onSpeak?: (text: string) => void;
  onOpenImageModal?: (lottery: LotteryItem) => void;
}

export const LotteryStatsModal: React.FC<LotteryStatsModalProps> = ({
  isOpen,
  onClose,
  lottery,
  results = [],
  onSpeak,
  onOpenImageModal,
}) => {
  const [copiedStats, setCopiedStats] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'frequency' | 'patterns'>('history');

  const normalizeMatchKey = (value: unknown) =>
    String(value ?? '')
      .toLocaleLowerCase()
      .replace(/[\s._#-]+/g, '');

  // Extract up to 10 past draws for this specific lottery
  const tenDraws = useMemo(() => {
    if (!lottery) return [];

    const matchedDraws: Array<{ date: string; top3: string; bottom2: string; firstPrize?: string }> = [];

    // 1. Gather from results database
    const idKey = normalizeMatchKey(lottery.id);
    const nameKey = normalizeMatchKey(lottery.name);

    if (Array.isArray(results) && results.length > 0) {
      results.forEach((row) => {
        const rowKeys = [row.หวย, row.lottery, row.lottery_code, row.ชื่อหวย, row.lotteryName]
          .map(normalizeMatchKey)
          .filter(Boolean);

        const isMatch = rowKeys.some(
          (k) =>
            k === idKey ||
            k === nameKey ||
            (nameKey && k.includes(nameKey)) ||
            (idKey && k.includes(idKey))
        );

        if (isMatch) {
          const top3 = String(row.เลขบน_3_ตัว || row.top3 || (row.รางวัลที่_1 ? String(row.รางวัลที่_1).slice(-3) : '') || '').trim();
          const bot2 = String(row.เลขล่าง_2_ตัว || row.bottom2 || row.เลขท้าย_2_ตัว || '').trim();
          const date = String(row.วันที่จัดรูปแบบ || row.งวดวันที่ || row.date || 'ไม่ระบุ').trim();
          const first = row.รางวัลที่_1 ? String(row.รางวัลที่_1).trim() : undefined;

          if (top3 || bot2) {
            // Avoid duplicate dates
            if (!matchedDraws.some((d) => d.date === date)) {
              matchedDraws.push({ date, top3, bottom2: bot2, firstPrize: first });
            }
          }
        }
      });
    }

    // 2. Also incorporate item.history if available
    if (Array.isArray(lottery.history)) {
      lottery.history.forEach((h) => {
        if (!matchedDraws.some((d) => d.date === h.date)) {
          matchedDraws.push({
            date: h.date,
            top3: h.top3,
            bottom2: h.bottom2,
          });
        }
      });
    }

    // 3. If currently announced and not yet in list, prepend current draw
    if (lottery.top3 && lottery.bottom2) {
      const currentDate = lottery.date || 'งวดปัจจุบัน';
      if (!matchedDraws.some((d) => d.date === currentDate)) {
        matchedDraws.unshift({
          date: currentDate,
          top3: lottery.top3,
          bottom2: lottery.bottom2,
          firstPrize: lottery.firstPrize,
        });
      }
    }

    // Slice to 10 latest
    return matchedDraws.slice(0, 10);
  }, [lottery, results]);

  // Compute digit frequencies (0-9)
  const frequencyStats = useMemo(() => {
    const digitCountsTop3: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const digitCountsBot2: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const totalDigitCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };

    let totalDigitsEvaluated = 0;
    let oddCount = 0;
    let evenCount = 0;
    let highCount = 0; // 5-9
    let lowCount = 0;  // 0-4
    const doubleOccurrences: string[] = [];

    tenDraws.forEach((draw) => {
      // Top 3
      if (draw.top3 && draw.top3.length === 3) {
        for (const char of draw.top3) {
          const d = parseInt(char, 10);
          if (!isNaN(d)) {
            digitCountsTop3[d] = (digitCountsTop3[d] || 0) + 1;
            totalDigitCounts[d] = (totalDigitCounts[d] || 0) + 1;
            totalDigitsEvaluated++;
            if (d % 2 === 0) evenCount++; else oddCount++;
            if (d >= 5) highCount++; else lowCount++;
          }
        }
        // Check double in top 3 (e.g. 773, 737, 377)
        const digits = draw.top3.split('');
        if (digits[0] === digits[1] || digits[1] === digits[2] || digits[0] === digits[2]) {
          doubleOccurrences.push(`งวด ${draw.date}: 3 บน ${draw.top3} (เบิ้ล/หาม)`);
        }
      }

      // Bottom 2
      if (draw.bottom2 && draw.bottom2.length === 2) {
        for (const char of draw.bottom2) {
          const d = parseInt(char, 10);
          if (!isNaN(d)) {
            digitCountsBot2[d] = (digitCountsBot2[d] || 0) + 1;
            totalDigitCounts[d] = (totalDigitCounts[d] || 0) + 1;
            totalDigitsEvaluated++;
            if (d % 2 === 0) evenCount++; else oddCount++;
            if (d >= 5) highCount++; else lowCount++;
          }
        }
        // Check double in bottom 2 (e.g. 44, 22)
        if (draw.bottom2[0] === draw.bottom2[1]) {
          doubleOccurrences.push(`งวด ${draw.date}: 2 ล่าง ${draw.bottom2} (เบิ้ล)`);
        }
      }
    });

    // Sort hot digits
    const sortedDigits = Object.entries(totalDigitCounts)
      .map(([digit, count]) => ({ digit: parseInt(digit, 10), count }))
      .sort((a, b) => b.count - a.count);

    const maxCount = Math.max(...Object.values(totalDigitCounts), 1);

    return {
      top3Counts: digitCountsTop3,
      bot2Counts: digitCountsBot2,
      totalCounts: totalDigitCounts,
      sortedHotDigits: sortedDigits,
      maxCount,
      totalDigitsEvaluated,
      oddPercentage: totalDigitsEvaluated ? Math.round((oddCount / totalDigitsEvaluated) * 100) : 50,
      evenPercentage: totalDigitsEvaluated ? Math.round((evenCount / totalDigitsEvaluated) * 100) : 50,
      highPercentage: totalDigitsEvaluated ? Math.round((highCount / totalDigitsEvaluated) * 100) : 50,
      lowPercentage: totalDigitsEvaluated ? Math.round((lowCount / totalDigitsEvaluated) * 100) : 50,
      doubleOccurrences,
    };
  }, [tenDraws]);

  // Copy Statistics text to clipboard
  const handleCopyStatsText = async () => {
    if (!lottery) return;
    const hotTop3 = frequencyStats.sortedHotDigits.slice(0, 3).map((d) => `${d.digit} (${d.count} ครั้ง)`).join(', ');

    let text = `📊 สถิติย้อนหลัง 10 งวด: ${lottery.flag} ${lottery.name}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🔥 เลขเด่นมาแรงสุด: ${hotTop3}\n`;
    text += `⚖️ อัตราส่วน: เลขคี่ ${frequencyStats.oddPercentage}% • เลขคู่ ${frequencyStats.evenPercentage}%\n`;
    text += `📈 สูง/ต่ำ: สูง(5-9) ${frequencyStats.highPercentage}% • ต่ำ(0-4) ${frequencyStats.lowPercentage}%\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📋 ผลย้อนหลัง ${tenDraws.length} งวดล่าสุด:\n`;

    tenDraws.forEach((d, idx) => {
      text += `${idx + 1}. งวด ${d.date} 👉 3 บน: ${d.top3 || '---'} • 2 ล่าง: ${d.bottom2 || '--'}\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📢 วิเคราะห์โดย Lottery Alert Pro\n`;
    text += `#สถิติหวย #${lottery.name.replace(/\s+/g, '')}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopiedStats(true);
      setTimeout(() => setCopiedStats(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareStatsText = async () => {
    if (!lottery) return;
    const hotTop3 = frequencyStats.sortedHotDigits.slice(0, 3).map((d) => `${d.digit} (${d.count} ครั้ง)`).join(', ');

    let text = `📊 สถิติย้อนหลัง 10 งวด: ${lottery.flag} ${lottery.name}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🔥 เลขเด่นมาแรงสุด: ${hotTop3}\n`;
    text += `⚖️ อัตราส่วน: เลขคี่ ${frequencyStats.oddPercentage}% • เลขคู่ ${frequencyStats.evenPercentage}%\n`;
    text += `📈 สูง/ต่ำ: สูง(5-9) ${frequencyStats.highPercentage}% • ต่ำ(0-4) ${frequencyStats.lowPercentage}%\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📋 ผลย้อนหลัง ${tenDraws.length} งวดล่าสุด:\n`;

    tenDraws.forEach((d, idx) => {
      text += `${idx + 1}. งวด ${d.date} 👉 3 บน: ${d.top3 || '---'} • 2 ล่าง: ${d.bottom2 || '--'}\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📢 วิเคราะห์โดย Lottery Alert Pro\n`;
    text += `#สถิติหวย #${lottery.name.replace(/\s+/g, '')}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `สถิติ 10 งวด: ${lottery.name}`,
          text,
        });
      } catch {
        handleCopyStatsText();
      }
    } else {
      handleCopyStatsText();
    }
  };

  const handleSpeakStats = () => {
    if (!lottery || !onSpeak) return;
    const hot1 = frequencyStats.sortedHotDigits[0]?.digit ?? 0;
    const hot2 = frequencyStats.sortedHotDigits[1]?.digit ?? 0;
    const hot3 = frequencyStats.sortedHotDigits[2]?.digit ?? 0;
    const speech = `สถิติ 10 งวดย้อนหลังของ ${lottery.name} เลขที่ออกบ่อยที่สุด 3 อันดับแรก ได้แก่ เลข ${hot1}, เลข ${hot2}, และเลข ${hot3} สัดส่วนเลขคี่อยู่ที่ร้อยละ ${frequencyStats.oddPercentage} สัดส่วนเลขคู่อยู่ที่ร้อยละ ${frequencyStats.evenPercentage}`;
    onSpeak(speech);
  };

  if (!isOpen || !lottery) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 animate-fadeIn modal-overlay overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{lottery.flag || '🎯'}</span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>สถิติ 10 งวดย้อนหลัง: {lottery.name}</span>
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>ออกรางวัล {lottery.drawTimeStr}</span>
                <span>·</span>
                <span>ปิดรับ {lottery.closeTimeStr}</span>
                <span>·</span>
                <span>{lottery.drawDays}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-5 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Sub Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>ผล 10 งวด ({tenDraws.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('frequency')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'frequency'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ความถี่ตัวเลข (0-9)</span>
            </button>
            <button
              onClick={() => setActiveTab('patterns')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'patterns'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>วิเคราะห์แนวโน้ม</span>
            </button>
          </div>

          {/* Quick Buttons */}
          <div className="flex items-center gap-2">
            {onSpeak && (
              <button
                onClick={handleSpeakStats}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors"
                title="ฟังรายงานสถิติด้วยเสียง"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleShareStatsText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
              title="แชร์สถิติ 10 งวดไปยังโซเชียลมีเดียด้วย Web Share API"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>แชร์สถิติ</span>
            </button>
            <button
              onClick={handleCopyStatsText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm"
            >
              {copiedStats ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>คัดลอกสถิติแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกสถิติ 10 งวด</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Top Quick Highlights Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                เลขเด่นอันดับ 1
              </span>
              <div className="text-xl font-bold font-mono text-amber-400 flex items-baseline gap-1">
                <span>{frequencyStats.sortedHotDigits[0]?.digit ?? '-'}</span>
                <span className="text-xs text-slate-400 font-normal">
                  ({frequencyStats.sortedHotDigits[0]?.count ?? 0} ครั้ง)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                เลขเด่นอันดับ 2
              </span>
              <div className="text-xl font-bold font-mono text-amber-400 flex items-baseline gap-1">
                <span>{frequencyStats.sortedHotDigits[1]?.digit ?? '-'}</span>
                <span className="text-xs text-slate-400 font-normal">
                  ({frequencyStats.sortedHotDigits[1]?.count ?? 0} ครั้ง)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block mb-1">สัดส่วน คู่/คี่</span>
              <div className="text-sm font-bold font-mono text-emerald-400">
                คี่ {frequencyStats.oddPercentage}% · คู่ {frequencyStats.evenPercentage}%
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block mb-1">สัดส่วน สูง/ต่ำ</span>
              <div className="text-sm font-bold font-mono text-sky-400">
                สูง {frequencyStats.highPercentage}% · ต่ำ {frequencyStats.lowPercentage}%
              </div>
            </div>
          </div>

          {/* TAB 1: 10 DRAWS HISTORY TABLE */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>บันทึกผลย้อนหลัง 10 งวดล่าสุด</span>
                <span>จำนวน {tenDraws.length} งวด</span>
              </div>

              {tenDraws.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-800/40 rounded-xl border border-slate-800">
                  <p>ยังไม่มีบันทึกผลย้อนหลังสำหรับหวยรายการนี้</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/60 shadow-inner">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/90 text-xs font-semibold text-slate-300 border-b border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">งวดที่</th>
                        <th className="py-2.5 px-3">วันที่ออกผล</th>
                        <th className="py-2.5 px-3 text-center">3 ตัวบน</th>
                        <th className="py-2.5 px-3 text-center">2 ตัวล่าง</th>
                        {tenDraws.some((d) => d.firstPrize) && (
                          <th className="py-2.5 px-3 text-center hidden sm:table-cell">รางวัลที่ 1</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono text-xs sm:text-sm">
                      {tenDraws.map((draw, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-slate-400">
                            #{idx + 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-200 font-sans">
                            {draw.date}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold tracking-wider">
                              {draw.top3 || '---'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold tracking-wider">
                              {draw.bottom2 || '--'}
                            </span>
                          </td>
                          {tenDraws.some((d) => d.firstPrize) && (
                            <td className="py-2.5 px-3 text-center text-slate-400 hidden sm:table-cell">
                              {draw.firstPrize || '-'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIGIT FREQUENCY (0-9) */}
          {activeTab === 'frequency' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                กราฟความถี่ตัวเลข 0 ถึง 9 ในผลสลาก 10 งวดล่าสุด (ยิ่งแถบยาว แสดงว่าเลขนั้นออกบ่อยที่สุด)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Digits 0 - 9 Bar Chart */}
                {Object.keys(frequencyStats.totalCounts).map((key) => {
                  const digit = parseInt(key, 10);
                  const count = frequencyStats.totalCounts[digit];
                  const top3Count = frequencyStats.top3Counts[digit] || 0;
                  const bot2Count = frequencyStats.bot2Counts[digit] || 0;
                  const percent = (count / frequencyStats.maxCount) * 100;
                  const isTop = frequencyStats.sortedHotDigits.slice(0, 3).some((d) => d.digit === digit);

                  return (
                    <div
                      key={digit}
                      className={`p-2.5 rounded-xl border transition-all ${
                        isTop
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                          : 'bg-slate-800/50 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-base ${
                              isTop
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-700 text-slate-200'
                            }`}
                          >
                            {digit}
                          </span>
                          {isTop && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold flex items-center gap-0.5">
                              <Flame className="w-3 h-3" />
                              มาแรง
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-mono text-slate-300">
                          ออกรวม <strong className="text-amber-400 font-bold">{count}</strong> ครั้ง
                          <span className="text-[11px] text-slate-400 ml-1.5">
                            (บน {top3Count} · ล่าง {bot2Count})
                          </span>
                        </div>
                      </div>

                      {/* Visual Frequency Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-700/60 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isTop ? 'bg-gradient-to-r from-amber-500 to-rose-400' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(6, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: PATTERNS & INSIGHTS */}
          {activeTab === 'patterns' && (
            <div className="space-y-4">
              {/* Hot Digits Summary */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-slate-800 to-slate-800 border border-amber-500/40">
                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>3 อันดับตัวเลขเด่นที่มาแรงที่สุด (Hot Digits)</span>
                </h4>
                <div className="flex items-center gap-4 flex-wrap">
                  {frequencyStats.sortedHotDigits.slice(0, 3).map((item, idx) => (
                    <div
                      key={item.digit}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-amber-500/30 font-mono"
                    >
                      <span className="text-xs text-amber-400 font-bold">#{idx + 1}</span>
                      <span className="text-xl font-bold text-white">{item.digit}</span>
                      <span className="text-xs text-slate-400">({item.count} ครั้ง)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Odd / Even & High / Low Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <h5 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-emerald-400" />
                    วิเคราะห์เลขคู่ vs เลขคี่
                  </h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">เลขคี่ (1, 3, 5, 7, 9)</span>
                      <strong className="text-amber-400 font-mono">{frequencyStats.oddPercentage}%</strong>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${frequencyStats.oddPercentage}%` }} />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400">เลขคู่ (0, 2, 4, 6, 8)</span>
                      <strong className="text-emerald-400 font-mono">{frequencyStats.evenPercentage}%</strong>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${frequencyStats.evenPercentage}%` }} />
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <h5 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
                    วิเคราะห์เลขสูง vs เลขต่ำ
                  </h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">เลขสูง (5, 6, 7, 8, 9)</span>
                      <strong className="text-sky-400 font-mono">{frequencyStats.highPercentage}%</strong>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-sky-400" style={{ width: `${frequencyStats.highPercentage}%` }} />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400">เลขต่ำ (0, 1, 2, 3, 4)</span>
                      <strong className="text-indigo-400 font-mono">{frequencyStats.lowPercentage}%</strong>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-indigo-400" style={{ width: `${frequencyStats.lowPercentage}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Double occurrences */}
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <h5 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-rose-400" />
                  ประวัติเลขเบิ้ล / เลขหาม ใน 10 งวดล่าสุด
                </h5>
                {frequencyStats.doubleOccurrences.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
                    {frequencyStats.doubleOccurrences.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">ไม่พบเลขเบิ้ลหรือเลขหามในช่วง 10 งวดล่าสุด</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-400">คำนวณสดจากประวัติ 10 งวดจริง</span>
          <div className="flex items-center gap-2">
            {onOpenImageModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenImageModal(lottery);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold transition-colors"
              >
                ดูรูปสรุปหวยนี้
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
