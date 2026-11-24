import React, { useMemo, useState } from "react";
import { LotteryCatalogItem, RawLotteryResult } from "../types/lottery";
import { normalizeName } from "../data/lotteryRepository";
import { backtest, projectNext, StatKind } from "../utils/statistics";

interface Props {
  items: LotteryCatalogItem[];
  results: RawLotteryResult[];
  now?: Date;
  limit?: number;
}

const KINDS: { kind: StatKind; label: string; pool: number }[] = [
  { kind: "bottom2", label: "2 ตัวล่าง", pool: 100 },
  { kind: "top3", label: "3 ตัวบน", pool: 1000 },
];

const PICK = 15;
const WINDOW = 50;
// A draw that closes further out than this is tomorrow's problem, not the next
// one, so it stays off the panel.
const HORIZON_MINUTES = 12 * 60;

const bangkokClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "22:25 น." -> 1345. Anything unreadable sorts last instead of throwing. */
export function closeMinutes(closeTimeStr: string): number {
  const match = /(\d{1,2})[:.](\d{2})/.exec(closeTimeStr ?? "");
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

function nowMinutes(now: Date): number {
  const [hour, minute] = bangkokClock.format(now).split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * Minutes until a close, wrapping past midnight so a 00:05 draw is four
 * minutes away at 00:01 rather than twenty-three hours away.
 */
function minutesUntilClose(item: LotteryCatalogItem, current: number): number {
  const close = closeMinutes(item.closeTimeStr);
  if (close === Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  return (close - current + 24 * 60) % (24 * 60);
}

/** The next draws by close time, skipping anything past the horizon. */
export function upcomingDraws(
  items: LotteryCatalogItem[],
  now: Date,
  limit = 5,
): LotteryCatalogItem[] {
  const current = nowMinutes(now);
  const timed = items
    .map((item) => ({ item, wait: minutesUntilClose(item, current) }))
    .sort((a, b) => a.wait - b.wait);
  const soon = timed.filter((entry) => entry.wait <= HORIZON_MINUTES);
  return (soon.length > 0 ? soon : timed).slice(0, limit).map((entry) => entry.item);
}

export const ProjectionPanel: React.FC<Props> = ({ items, results, now = new Date(), limit = 5 }) => {
  const [kind, setKind] = useState<StatKind>("bottom2");
  const active = KINDS.find((entry) => entry.kind === kind) ?? KINDS[0];

  const rows = useMemo(
    () =>
      upcomingDraws(items, now, limit).map((item) => {
        // History rows carry either the catalog id or the Thai display name,
        // depending on which collector wrote them.
        const name = normalizeName(item.name);
        const own = results.filter(
          (row) => row.หวย === item.id || normalizeName(row.ชื่อหวย ?? "") === name,
        );
        const scoped = projectNext(own, kind, { pick: PICK, window: WINDOW });
        const pooled = scoped && scoped.draws >= 3 ? scoped : projectNext(results, kind, { pick: PICK, window: WINDOW });
        return { item, projection: pooled, own: scoped && scoped.draws >= 3 };
      }),
    [items, results, kind, now, limit],
  );

  const measured = useMemo(
    () => backtest(results, kind, { pick: PICK, window: WINDOW }),
    [results, kind],
  );

  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-black text-slate-100">คาดการณ์งวดถัดไป</h3>
          <p className="text-xs font-semibold text-slate-400">
            {`จัดอันดับเลขที่ออกบ่อยใน ${WINDOW} งวดล่าสุด · เลือก ${PICK} เลข · ไม่ใช่ผลรางวัล`}
          </p>
        </div>
        <div className="flex gap-1.5">
          {KINDS.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              onClick={() => setKind(entry.kind)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                entry.kind === kind
                  ? "bg-amber-500 text-slate-950"
                  : "border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map(({ item, projection, own }) => (
          <li key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <span className="text-sm font-bold text-slate-100">
                <span className="flag mr-1">{item.flag}</span>
                {item.name}
              </span>
              <span className="text-xs text-slate-400">ปิดรับ {item.closeTimeStr}</span>
            </div>
            {projection ? (
              <>
                <div className="font-mono-numbers mt-1 text-base font-black tracking-wide text-amber-400">
                  {projection.numbers.join(" · ")}
                </div>
                                <div className="mt-1 text-xs text-slate-400">
                  {`โอกาสตามทฤษฎี ${projection.chance.toFixed(2)}% (${projection.numbers.length} เลขจาก ${active.pool.toLocaleString("en-US")}) · ฐานสถิติ ${
                    own
                      ? `${projection.draws} งวดของรายการนี้`
                      : `รวม ${projection.draws} งวดทุกประเภท (รายการนี้ยังมีประวัติไม่พอ)`
                  }`}
                </div>
              </>
            ) : (
              <div className="mt-1 text-xs text-slate-400">ยังไม่มีผลย้อนหลังพอจะคาดการณ์</div>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-slate-400">
        {`ทดสอบกับผลจริง ${measured.rounds} งวด: ถูก ${measured.hits} งวด${
          measured.rounds > 0 ? ` (${measured.hitRate.toFixed(1)}%)` : ""
        } · สุ่ม ${measured.pick} เลขล้วนได้ ${((measured.pick / active.pool) * 100).toFixed(2)}% ต่องวด`}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        เป็นการคำนวณจากสถิติย้อนหลัง ไม่ใช่ผลรางวัลและไม่รับประกันผล ระบบจะประกาศผลจริงเมื่อต้นทางยืนยันเท่านั้น
      </p>
    </section>
  );
};
