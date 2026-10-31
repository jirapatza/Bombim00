import React, { useMemo } from 'react';
import { Clock3, Radio, Trophy } from 'lucide-react';

interface LatestResultRow {
  ชื่อหวย?: string;
  หวย?: string;
  lotteryName?: string;
  งวดวันที่?: string;
  วันที่จัดรูปแบบ?: string;
  รางวัลที่_1?: string;
  เลขบน_3_ตัว?: string;
  เลขท้าย_2_ตัว?: string;
  เลขล่าง_2_ตัว?: string;
  top3?: string;
  bottom2?: string;
  firstPrize?: string;
  แหล่งข้อมูล?: string;
  source?: string;
  เวลาที่ตรวจพบ?: string;
  detectedAt?: string;
}

interface LatestThreeResultsProps {
  results: LatestResultRow[];
}

function parseDetectedAt(value?: string): number {
  if (!value) return Number.NaN;
  const raw = value.trim();
  // Backend timestamps without an offset are stored as Bangkok local time.
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) &&
    !/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)
    ? `${raw}+07:00`
    : raw;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatDetectedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(timestamp);
}

export const LatestThreeResults: React.FC<LatestThreeResultsProps> = ({ results }) => {
  const latest = useMemo(() => {
    return (Array.isArray(results) ? results : [])
      .map((row) => ({ row, timestamp: parseDetectedAt(row.เวลาที่ตรวจพบ || row.detectedAt) }))
      .filter(({ row, timestamp }) => {
        const hasResult = Boolean(
          String(row.รางวัลที่_1 || row.เลขบน_3_ตัว || row.top3 || row.firstPrize || '').trim() ||
          String(row.เลขท้าย_2_ตัว || row.เลขล่าง_2_ตัว || row.bottom2 || '').trim()
        );
        return hasResult && Number.isFinite(timestamp);
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);
  }, [results]);

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-slate-950/90 p-4 sm:p-5 shadow-xl shadow-cyan-950/20" aria-labelledby="latest-three-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300"><Trophy className="h-5 w-5" /></div>
          <div>
            <h2 id="latest-three-heading" className="text-base font-black text-white sm:text-lg">3 รายการที่ตรวจพบผลล่าสุด</h2>
            <p className="text-xs text-slate-400">เรียงตามเวลาที่ระบบตรวจพบข้อมูลจริง</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
          <Radio className="h-3 w-3" /> LIVE DATA
        </span>
      </div>

      {latest.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-8 text-center">
          <Clock3 className="mx-auto mb-2 h-6 w-6 text-slate-500" />
          <p className="text-sm font-semibold text-slate-300">ยังไม่มีผลที่มีเวลาตรวจพบยืนยันได้</p>
          <p className="mt-1 text-xs text-slate-500">เมื่อระบบได้รับข้อมูลผลพร้อม timestamp รายการล่าสุดจะแสดงที่นี่</p>
        </div>
      ) : (
        <ol className="grid gap-3 md:grid-cols-3">
          {latest.map(({ row, timestamp }, index) => {
            const name = row.ชื่อหวย || row.หวย || row.lotteryName || 'ไม่ระบุชื่อรายการ';
            const top = row.เลขบน_3_ตัว || row.รางวัลที่_1 || row.top3 || row.firstPrize || '—';
            const bottom = row.เลขล่าง_2_ตัว || row.เลขท้าย_2_ตัว || row.bottom2 || '—';
            const source = row.แหล่งข้อมูล || row.source || 'ไม่ระบุแหล่งข้อมูล';
            const drawDate = row.วันที่จัดรูปแบบ || row.งวดวันที่ || '';
            return (
              <li key={`${name}-${timestamp}-${index}`} className={`rounded-xl border p-3 ${index === 0 ? 'border-cyan-400/40 bg-cyan-950/30' : 'border-slate-800 bg-slate-900/70'}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-black tracking-wide text-cyan-200">อันดับ {index + 1}</span>
                  {index === 0 && <span className="text-[10px] font-bold text-cyan-300">ล่าสุด</span>}
                </div>
                <h3 className="truncate text-sm font-extrabold text-white" title={name}>{name}</h3>
                {drawDate && <p className="mt-1 text-[11px] text-slate-500">งวด {drawDate}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-950/80 p-2">
                    <p className="text-[10px] text-slate-500">3 หลัก / รางวัลที่ 1</p>
                    <p className="mt-1 font-mono text-xl font-black tracking-wider text-amber-300">{top}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-2">
                    <p className="text-[10px] text-slate-500">2 หลัก</p>
                    <p className="mt-1 font-mono text-xl font-black tracking-wider text-emerald-300">{bottom}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-2">
                  <span className="truncate text-[10px] text-slate-500" title={source}>{source}</span>
                  <time className="shrink-0 text-[10px] tabular-nums text-slate-400" dateTime={new Date(timestamp).toISOString()}>{formatDetectedAt(timestamp)}</time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-slate-500">หมายเหตุ: เวลาที่แสดงคือเวลาที่ระบบตรวจพบข้อมูล ไม่ใช่การยืนยันเวลาประกาศผลจากผู้ให้บริการ หากแหล่งข้อมูลไม่ส่ง timestamp ระบบจะไม่นำรายการนั้นมาจัดอันดับ</p>
    </section>
  );
};
