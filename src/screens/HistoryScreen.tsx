import React, { useState, useMemo } from 'react';
import { History, TrendingUp, Search, X, Copy, Check, BarChart3 } from 'lucide-react';
import { RawLotteryResult, FrequencyStat } from '../types/lottery';
import { StatKind, DigitStat, hottest, coldest, longestGap, countDraws } from '../utils/statistics';
import { LotteryRepository } from '../data/lotteryRepository';
import { copyText } from '../utils/socialShare';

interface Props {
  results: RawLotteryResult[];
  top2Stats: FrequencyStat[];
  top3Stats: FrequencyStat[];
}

export const HistoryScreen: React.FC<Props> = ({ results, top2Stats, top3Stats }) => {
  const [activeSubTab, setActiveSubTab] = useState<0 | 1 | 2>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [selectedKind, setSelectedKind] = useState<StatKind>('top3');
  const [selectedLottery, setSelectedLottery] = useState('');
  const lotteryNames = useMemo(() => [...new Set(results.map((row) => row.ชื่อหวย || row.หวย || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')), [results]);
  const lottery = lotteryNames.includes(selectedLottery) ? selectedLottery : lotteryNames[0] || '';

  const filteredResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return results.slice(0, 80);

    return results
      .filter((res) => {
        const name = (res.ชื่อหวย || res.หวย || '').toLowerCase();
        const first = res.รางวัลที่_1 || '';
        const top3 = res.เลขบน_3_ตัว || (first.length >= 3 ? first.slice(-3) : '');
        const bottom2 = res.เลขล่าง_2_ตัว || res.เลขท้าย_2_ตัว || '';
        const date = res.วันที่จัดรูปแบบ || res.งวดวันที่ || '';

        return (
          name.includes(q) ||
          first.includes(q) ||
          top3.includes(q) ||
          bottom2.includes(q) ||
          date.includes(q)
        );
      })
      .slice(0, 80);
  }, [results, searchQuery]);

  const handleCopy = async (res: RawLotteryResult, index: number) => {
    const name = res.ชื่อหวย || res.หวย || 'ไม่ระบุชื่อ';
    const date = res.วันที่จัดรูปแบบ || res.งวดวันที่ || 'ไม่ระบุงวด';
    const first = res.รางวัลที่_1 || '';
    const top3 = res.เลขบน_3_ตัว || (first.length >= 3 ? first.slice(-3) : '-');
    const bottom2 = res.เลขล่าง_2_ตัว || res.เลขท้าย_2_ตัว || '-';

    const text = `${name} งวด ${date}\n${first ? `รางวัลที่ 1: ${first}\n` : ''}บน: ${top3} / ล่าง: ${bottom2}`;
    const ok = await copyText(text);
    setCopyFailed(!ok);
    if (ok) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const maxTop2Count = top2Stats[0]?.count || 1;
  const maxTop3Count = top3Stats[0]?.count || 1;

  const analysisStats = useMemo(() => {
    if (activeSubTab !== 2) return [];
    return lottery ? LotteryRepository.getDetailedStats(selectedKind, lottery) : [];
  }, [activeSubTab, selectedKind, lottery, results]);

  const analysisDraws = useMemo(() => {
    if (activeSubTab !== 2) return 0;
    return LotteryRepository.getAnalysisDrawCount(selectedKind, lottery);
  }, [activeSubTab, selectedKind, lottery, results]);

  const hottestNumbers = useMemo(() => {
    if (activeSubTab !== 2 || analysisStats.length === 0) return [];
    return hottest(analysisStats, 15);
  }, [activeSubTab, analysisStats]);

  const coldestNumbers = useMemo(() => {
    if (activeSubTab !== 2 || analysisStats.length === 0) return [];
    return coldest(analysisStats, 15, selectedKind, analysisDraws);
  }, [activeSubTab, analysisStats, selectedKind, analysisDraws]);

  const longestGapNumbers = useMemo(() => {
    if (activeSubTab !== 2 || analysisStats.length === 0) return [];
    return longestGap(analysisStats, 15, selectedKind, analysisDraws);
  }, [activeSubTab, analysisStats, selectedKind, analysisDraws]);

  const backtestReport = useMemo(() => {
    if (activeSubTab !== 2) return null;
    return lottery ? LotteryRepository.getBacktestReport(selectedKind, { pick: 15, window: 50 }, lottery) : null;
  }, [activeSubTab, selectedKind, lottery, results]);

  return (
    <div className="space-y-4 pb-20">
      {copyFailed && <p role="alert" className="rounded-xl border border-amber-600 bg-amber-950 p-3 text-sm text-amber-200">คัดลอกไม่ได้ กรุณาตรวจสิทธิ์คลิปบอร์ด</p>}
      {/* Subtab Switcher */}
      <div className="flex rounded-2xl border border-slate-800 bg-slate-900 p-1">
        <button
          onClick={() => setActiveSubTab(0)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
            activeSubTab === 0
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="h-4 w-4" />
          ผลย้อนหลัง ({results.length})
        </button>
        <button
          onClick={() => setActiveSubTab(1)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
            activeSubTab === 1
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          สถิติเลขเด็ดออกบ่อย
        </button>
        <button
          onClick={() => setActiveSubTab(2)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
            activeSubTab === 2
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          วิเคราะห์เชิงลึก
        </button>
      </div>

      {activeSubTab === 0 ? (
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อหวย หรืองวดวันที่ หรือตัวเลข..."
              data-testid="history_search_input"
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-3 pl-12 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="ล้างคำค้นหาผลย้อนหลัง"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="space-y-3">
            {filteredResults.map((item, idx) => {
              const name = item.ชื่อหวย || item.หวย || 'ไม่ระบุชื่อ';
              const date = item.วันที่จัดรูปแบบ || item.งวดวันที่ || 'ไม่ระบุงวด';
              const first = item.รางวัลที่_1 || item.firstPrize || '';
              const explicitTop3 = item.เลขบน_3_ตัว || item.top3 || '';
              const top3 = explicitTop3 || (first.length >= 3 ? first.slice(-3) : '-');
              const bottom2 = item.เลขล่าง_2_ตัว || item.เลขท้าย_2_ตัว || item.bottom2 || '-';
              const hasFirstPrize = /^\d{6}$/.test(first);
              const officialBack3 = (item.เลขท้าย_3_ตัว ?? item.back3 ?? [])
                .flatMap((entry) => String(entry).split(/[,\s]+/)).filter(Boolean);
              const officialThree = officialBack3.length
                ? officialBack3
                : (item.threeDigits ?? []).flatMap((entry) => String(entry).split(/[,\s]+/)).filter(Boolean);
              const officialLabel = officialBack3.length ? 'เลขท้าย 3 ตัว' : 'เลข 3 ตัว (หน้า/ท้าย)';

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-4 transition-all hover:border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-slate-100">{name}</h4>
                    <span className="text-xs font-semibold text-amber-400">{date}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="flex flex-col items-center justify-center rounded-xl bg-amber-500/15 py-2 px-3 border border-amber-500/30">
                      <span className="text-[11px] font-bold text-amber-400">
                        {hasFirstPrize ? 'รางวัลที่ 1' : '3 ตัวบน'}
                      </span>
                      <span className="font-mono-numbers text-xl font-black text-amber-300">
                        {hasFirstPrize ? first : top3}
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-500/15 py-2 px-3 border border-emerald-500/30">
                      <span className="text-[11px] font-bold text-emerald-400">2 ตัวล่าง</span>
                      <span className="font-mono-numbers text-xl font-black text-emerald-400">
                        {bottom2}
                      </span>
                    </div>
                  </div>

                  {officialThree.length > 0 && (
                    <p className="mt-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                      {officialLabel}: <span className="font-mono-numbers font-bold">{officialThree.join(" • ")}</span>
                    </p>
                  )}

                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                    <span>แหล่ง: {item.แหล่งข้อมูล || 'ระบบหลัก'}</span>
                    <button
                      onClick={() => handleCopy(item, idx)}
                      aria-label={`คัดลอกผล ${name} งวด ${date}`}
                      title="คัดลอกผลหวย"
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-amber-400 transition-colors"
                    >
                      {copiedIndex === idx ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeSubTab === 1 ? (
        /* Statistics Subtab */
        <div className="space-y-6">
          {/* Top 2-digit frequency */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
              <span>🔥 15 อันดับ เลขท้าย 2 ตัวที่ออกบ่อยที่สุด (2-Digit Frequency)</span>
            </h3>

            <div className="space-y-2">
              {top2Stats.map((stat) => {
                const barWidth = Math.min(Math.max((stat.count / maxTop2Count) * 100, 5), 100);
                return (
                  <div
                    key={stat.number}
                    className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3.5"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black font-mono-numbers text-xl shadow-md">
                      {stat.number}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-100">ออกแล้ว {stat.count} ครั้ง</span>
                        <span className="font-extrabold text-amber-400">
                          {stat.percentage.toFixed(1)}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>

                      <p className="truncate text-[11px] text-slate-400">
                        งวดล่าสุด: {stat.latestLottery} ({stat.latestDate})
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 3-digit frequency */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-emerald-400 flex items-center gap-1.5">
              <span>⭐ 15 อันดับ เลข 3 ตัวบนที่ออกบ่อยที่สุด (3-Digit Frequency)</span>
            </h3>

            <div className="space-y-2">
              {top3Stats.map((stat) => {
                const barWidth = Math.min(Math.max((stat.count / maxTop3Count) * 100, 5), 100);
                return (
                  <div
                    key={stat.number}
                    className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3.5"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-black font-mono-numbers text-lg shadow-md">
                      {stat.number}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-100">ออกแล้ว {stat.count} ครั้ง</span>
                        <span className="font-extrabold text-emerald-400">
                          {stat.percentage.toFixed(1)}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>

                      <p className="truncate text-[11px] text-slate-400">
                        งวดล่าสุด: {stat.latestLottery} ({stat.latestDate})
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Deep Analysis Subtab */
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="analysis-lottery" className="text-sm font-bold text-slate-200">เลือกหวยสำหรับวิเคราะห์</label>
            <select id="analysis-lottery" value={lottery} onChange={(event) => setSelectedLottery(event.target.value)} className="w-full min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-slate-100">
              {lotteryNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <p className="text-xs text-slate-400">สถิติและงวดทดสอบนับเฉพาะหวยที่เลือก</p>
            {!lottery && <p role="status" className="text-sm text-slate-300">ยังไม่มีผลหวยสำหรับวิเคราะห์</p>}
          </div>
          {/* Kind Selector */}
          <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
            <button
              onClick={() => setSelectedKind('top3')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                selectedKind === 'top3' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3 ตัวบน
            </button>
            <button
              onClick={() => setSelectedKind('bottom2')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                selectedKind === 'bottom2' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2 ตัวล่าง
            </button>
          </div>

          {/* Backtest Report */}
          {backtestReport && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                <span>📊 ผลทดสอบย้อนหลัง (Backtest)</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-800/50 p-3 border border-slate-700/50">
                  <div className="text-slate-400">จำนวนงวดทดสอบ</div>
                  <div className="mt-1 text-lg font-black text-slate-100">{backtestReport.rounds}</div>
                </div>
                <div className="rounded-xl bg-slate-800/50 p-3 border border-slate-700/50">
                  <div className="text-slate-400">อัตราการทายถูก</div>
                  <div className="mt-1 text-lg font-black text-amber-400">{backtestReport.rounds ? `${backtestReport.hitRate.toFixed(2)}%` : 'ยังไม่มีงวดทดสอบ'}</div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                เลือกเลขที่ออกบ่อยสูงสุด {backtestReport.pick} เลขจากไม่เกิน {backtestReport.window} งวดก่อนหน้า เทียบกับงวดถัดไปของหวยเดียวกัน · ถูก {backtestReport.hits}/{backtestReport.rounds} งวด ไม่ใช่การรับประกันผลในอนาคต
              </p>
            </div>
          )}

          {/* Hottest Numbers */}
          {hottestNumbers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                <span>🔥 เลขร้อน (ออกบ่อยที่สุด 15 อันดับ)</span>
              </h3>
              <div className="space-y-2">
                {hottestNumbers.map((stat) => {
                  const maxCount = hottestNumbers[0]?.count || 1;
                  const barWidth = Math.min(Math.max((stat.count / maxCount) * 100, 5), 100);
                  return (
                    <div
                      key={stat.number}
                      className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-slate-900 p-3.5"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black font-mono-numbers text-xl shadow-md">
                        {stat.number}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-100">ออก {stat.count} ครั้ง</span>
                          <span className="font-extrabold text-amber-400">{stat.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${barWidth}%` }} />
                        </div>
                        <p className="truncate text-[11px] text-slate-400">
                          งวดล่าสุด: {stat.latestLottery} ({stat.latestDate})
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Coldest Numbers */}
          {coldestNumbers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-blue-400 flex items-center gap-1.5">
                <span>❄️ เลขเย็น (ยังไม่ออกจากข้อมูลที่มี 15 อันดับ)</span>
              </h3>
              <div className="space-y-2">
                {coldestNumbers.map((stat) => {
                  const maxCount = coldestNumbers[coldestNumbers.length - 1]?.count || 1;
                  const barWidth = Math.min(Math.max((stat.count / maxCount) * 100, 5), 100);
                  return (
                    <div
                      key={stat.number}
                      className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-slate-900 p-3.5"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-slate-950 font-black font-mono-numbers text-xl shadow-md">
                        {stat.number}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-100">ออก {stat.count} ครั้ง</span>
                          <span className="font-extrabold text-blue-400">{stat.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${barWidth}%` }} />
                        </div>
                        <p className="truncate text-[11px] text-slate-400">
                          {stat.count === 0 ? `ยังไม่ออกจากข้อมูลที่มี (${stat.gapRounds} งวด)` : `งวดล่าสุด: ${stat.latestLottery} (${stat.latestDate})`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Longest Gap */}
          {longestGapNumbers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-purple-400 flex items-center gap-1.5">
                <span>⏳ เลขขาดนาน (นับจากข้อมูลที่มีมากที่สุด)</span>
              </h3>
              <div className="space-y-2">
                {longestGapNumbers.map((stat) => {
                  const maxGap = longestGapNumbers[0]?.gapRounds || 1;
                  const barWidth = Math.min(Math.max((stat.gapRounds / maxGap) * 100, 5), 100);
                  return (
                    <div
                      key={stat.number}
                      className="flex items-center gap-3 rounded-2xl border border-purple-500/20 bg-slate-900 p-3.5"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500 text-slate-950 font-black font-mono-numbers text-xl shadow-md">
                        {stat.number}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-100">ขาด {stat.gapRounds} งวด</span>
                          <span className="font-extrabold text-purple-400">ออกแล้ว {stat.count} ครั้ง</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${barWidth}%` }} />
                        </div>
                        <p className="truncate text-[11px] text-slate-400">
                          {stat.count === 0 ? `ยังไม่ออกจากข้อมูลที่มี (${stat.gapRounds} งวด)` : `งวดล่าสุด: ${stat.latestLottery} (${stat.latestDate})`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
