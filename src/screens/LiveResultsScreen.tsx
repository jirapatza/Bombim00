import React, { useEffect, useRef, useState } from "react";
import {
  Timer,
  ArrowRight,
  CheckCircle2,
  Layers,
  CalendarDays,
  Search,
  Volume2,
  Copy,
  Share2,
  X,
  Bell,
  RotateCcw,
} from "lucide-react";
import { LotteryCatalogItem } from "../types/lottery";
import { ThaiTtsService, buildAnnouncement } from "../utils/thaiTts";
import { copyText } from "../utils/socialShare";
import {
  countdown,
  dashboardData,
  drawState,
  drawTimestamp,
  DrawState,
  stateLabels,
} from "../data/dashboard";

interface Props {
  lotteries: LotteryCatalogItem[];
  watchedNumbers: string[];
  isVoiceEnabled: boolean;
  onSettings: () => void;
}
export const LiveResultsScreen: React.FC<Props> = ({
  lotteries,
  watchedNumbers,
  isVoiceEnabled,
  onSettings,
}) => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const [period, setPeriod] = useState("ทั้งหมด");
  const [filter, setFilter] = useState<DrawState | "all">("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = lotteries.find((item) => item.id === detailId) ?? null;
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (detail && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [detail?.id]);
  useEffect(() => {
    if (detailId && !detail) setDetailId(null);
  }, [detailId, detail]);
  const summaryRef = useRef<HTMLElement>(null);
  const now = new Date();
  const data = dashboardData(lotteries, now);
  const showAll = (state: DrawState | "all" = "all") => {
    setFilter(state);
    setQuery("");
    setCategory("ทั้งหมด");
    setPeriod("ทั้งหมด");
    summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const filtered = lotteries
    .filter((item) => {
      const text =
        `${item.name} ${item.top3} ${item.bottom2} ${item.firstPrize}`.toLowerCase();
      return (
        text.includes(query.trim().toLowerCase()) &&
        (filter === "all" || drawState(item, now) === filter) &&
        (category === "ทั้งหมด" || item.categoryLabel === category) &&
        (period === "ทั้งหมด" || item.periodLabel === period)
      );
    })
    .sort((a, b) => {
      const key = (item: LotteryCatalogItem) => {
        const timestamp = drawTimestamp(item, now);
        return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
      };
      return key(a) - key(b);
    });
  const resultText = (item: LotteryCatalogItem) =>
    `${item.name} งวด ${item.date}\n${item.firstPrize ? `รางวัลที่ 1: ${item.firstPrize}\n` : ""}3 ตัวบน: ${item.top3 || "—"} / 2 ตัวล่าง: ${item.bottom2 || "—"}`;
  const copy = async (item: LotteryCatalogItem) =>
    setMessage(
      (await copyText(resultText(item)))
        ? "คัดลอกผลแล้ว"
        : "คัดลอกไม่ได้ กรุณาอนุญาตคลิปบอร์ดหรือเลือกข้อความผลด้วยตนเอง",
    );
  const share = async (item: LotteryCatalogItem) => {
    try {
      if (navigator.share)
        await navigator.share({
          title: `ผล${item.name}`,
          text: resultText(item),
        });
      else await copy(item);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage("แชร์ไม่สำเร็จ ลองคัดลอกผลแทน");
    }
  };
  const metrics = [
    {
      title: "รายการทั้งหมด",
      value: lotteries.length,
      icon: Layers,
      state: "all",
      color: "blue",
    },
    {
      title: "ประกาศผลแล้ว",
      value: data.drawn,
      icon: CheckCircle2,
      state: "drawn",
      color: "green",
    },
    {
      title: "กำลังรอผล",
      value: data.pending,
      icon: Timer,
      state: "pending",
      color: "gold",
    },
    {
      title: "ยังไม่ถึงเวลา",
      value: data.upcoming,
      icon: CalendarDays,
      state: "upcoming",
      color: "blue",
    },
  ] as const;
  return (
    <div className="dashboard-stack">
      <section className="panel next-panel" aria-labelledby="next-title">
        <div className="section-heading">
          <h2 id="next-title">
            <Timer size={21} /> รายการกำลังจะออกถัดไป
          </h2>
          <span className="badge blue">ตามตารางวันนี้</span>
        </div>
        {data.next ? (
          <div className="next-grid">
            <div>
              <div className="lottery-title">
                <span className="flag">{data.next.flag}</span>
                <div>
                  <h3>{data.next.name}</h3>
                  <p>{data.next.categoryLabel}</p>
                </div>
              </div>
              <div className="draw-countdown">
                <div>
                  <p>เวลาประกาศตามตาราง</p>
                  <strong>{data.next.drawTimeStr}</strong>
                </div>
                <div>
                  <p>เหลือเวลา</p>
                  <strong className="countdown">
                    {countdown(drawTimestamp(data.next, now))}
                  </strong>
                  <small>ชั่วโมง : นาที : วินาที</small>
                </div>
              </div>
            </div>
            <div>
              <div className="waiting-results">
                <div>
                  <p>ผล 3 ตัว</p>
                  <strong>⌛ รอผล</strong>
                </div>
                <div>
                  <p>ผล 2 ตัว</p>
                  <strong>⌛ รอผล</strong>
                </div>
              </div>
              <div className="hero-actions">
                <button className="primary-button" onClick={onSettings}>
                  <Bell size={16} /> ตั้งค่าการแจ้งเตือน
                </button>
                <button className="quiet-button" onClick={() => showAll()}>
                  ดูรายการทั้งหมด <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            {data.pending
              ? "รายการตามตารางวันนี้ถึงเวลาแล้ว กำลังรอแหล่งข้อมูลประกาศผล"
              : "ไม่มีรายการที่กำลังจะออกเพิ่มเติมในวันนี้"}
          </div>
        )}
        <p className="muted footnote">
          เวลาออกเป็นเวลาตามตาราง ผลจะแสดงเมื่อแหล่งข้อมูลประกาศแล้วเท่านั้น
        </p>
      </section>
      <div className="metric-grid">
        {metrics.map(({ title, value, icon: Icon, state, color }) => (
          <button
            key={state}
            className={`panel metric ${color}`}
            onClick={() => showAll(state)}
          >
            <span className="metric-icon">
              <Icon size={25} />
            </span>
            <span>
              <span className="muted">{title}</span>
              <strong>{value}</strong>
              <small>รายการ</small>
              <span className="metric-link">
                ดูทั้งหมด <ArrowRight size={12} />
              </span>
            </span>
          </button>
        ))}
      </div>
      <section className="panel" aria-labelledby="latest-title">
        <div className="section-heading">
          <h2 id="latest-title">
            3 รายการที่ออกล่าสุด <span className="badge green">ผลวันนี้</span>
          </h2>
          <button className="text-button" onClick={() => showAll("drawn")}>
            ดูทั้งหมด <ArrowRight size={15} />
          </button>
        </div>
        <div className="latest-grid">
          {data.latest.map((item, index) => (
            <button
              className={`latest-card rank-${index}`}
              key={item.id}
              onClick={() => {
                setMessage("");
                setDetailId(item.id);
              }}
            >
              <span className="rank">{index + 1}</span>
              <div className="lottery-title">
                <span className="flag">{item.flag}</span>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.categoryLabel}</p>
                </div>
              </div>
              <div className="result-pair">
                <div>
                  <strong>{item.firstPrize || item.top3 || "—"}</strong>
                  <small>{item.firstPrize ? "รางวัลที่ 1" : "ผล 3 ตัว"}</small>
                </div>
                <div>
                  <strong>{item.bottom2 || "—"}</strong>
                  <small>ผล 2 ตัว</small>
                </div>
              </div>
              <div className="latest-footer">
                <span>
                  {item.detectedAt &&
                  Number.isFinite(Date.parse(item.detectedAt))
                    ? `ตรวจพบ ${new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(new Date(item.detectedAt))} น.`
                    : `ตามตาราง ${item.drawTimeStr}`}
                </span>
                <span>
                  ดูผล <ArrowRight size={12} />
                </span>
              </div>
            </button>
          ))}
        </div>
        {!data.latest.length && (
          <div className="empty-state">ยังไม่มีผลที่ยืนยันแล้วของวันนี้</div>
        )}
        <p className="muted footnote">
          เรียงตามเวลาตรวจพบผล หากไม่มีเวลา ใช้เวลาออกตามตาราง
        </p>
      </section>
      <section
        className="panel daily-panel"
        ref={summaryRef}
        aria-labelledby="daily-title"
      >
        <div className="section-heading">
          <h2 id="daily-title">
            สรุปผลประจำวันนี้ <span className="badge green">วันนี้</span>
          </h2>
          <span className="muted text-xs">
            {new Intl.DateTimeFormat("th-TH", {
              timeZone: "Asia/Bangkok",
              dateStyle: "long",
            }).format(now)}
          </span>
        </div>
        <div className="filter-tabs">
          {(["all", "drawn", "pending", "upcoming"] as const).map((state) => (
            <button
              key={state}
              className={filter === state ? "selected" : ""}
              aria-pressed={filter === state}
              onClick={() => setFilter(state)}
            >
              {state === "all" ? "ทั้งหมด" : stateLabels[state]}
            </button>
          ))}
        </div>
        <div className="table-tools">
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="ค้นหาหวยหรือผลรางวัล"
              placeholder="ค้นหาชื่อหวย / ผลรางวัล"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="หมวดหมู่"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["ทั้งหมด", ...new Set(lotteries.map((i) => i.categoryLabel))].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
          <select
            aria-label="ช่วงเวลา"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {["ทั้งหมด", ...new Set(lotteries.map((i) => i.periodLabel))].map(
              (p) => (
                <option key={p}>{p}</option>
              ),
            )}
          </select>
          <button
            aria-label="รีเซ็ตตัวกรอง"
            className="quiet-button"
            onClick={() => showAll()}
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <div className="table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th>เวลาออก</th>
                <th>รายการ</th>
                <th>ประเภท</th>
                <th>ผล 3 ตัว / รางวัลที่ 1</th>
                <th>ผล 2 ตัว</th>
                <th>สถานะ</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const state = drawState(item, now);
                const matched =
                  state === "drawn" &&
                  watchedNumbers.some(
                    (n) =>
                      n === item.top3 ||
                      n === item.bottom2 ||
                      n === item.firstPrize,
                  );
                return (
                  <tr key={item.id} className={matched ? "watched-row" : ""}>
                    <td>{item.drawTimeStr}</td>
                    <td>
                      <span className="table-name">
                        <span>{item.flag}</span>
                        {item.name}
                      </span>
                    </td>
                    <td className="muted">{item.categoryLabel}</td>
                    <td className="number">
                      {state === "drawn"
                        ? item.firstPrize || item.top3 || "—"
                        : "—"}
                    </td>
                    <td className="number bottom-number">
                      {state === "drawn" ? item.bottom2 || "—" : "—"}
                    </td>
                    <td>
                      <span
                        className={`badge ${state === "drawn" ? "green" : state === "pending" ? "gold" : "blue"}`}
                      >
                        {stateLabels[state]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        aria-label={`ดูผล ${item.name}`}
                        onClick={() => {
                          setMessage("");
                          setDetailId(item.id);
                        }}
                      >
                        ดูผล <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty-state">ไม่พบรายการที่ตรงกับตัวกรอง</div>
        )}
        <div className="table-bottom">
          <span className="muted">
            {filtered.length} จาก {lotteries.length} รายการที่ออกวันนี้
          </span>
          <button className="quiet-button" onClick={() => showAll()}>
            แสดงรายการทั้งหมด
          </button>
        </div>
      </section>
      {detail && (
        <dialog
          ref={dialogRef}
          className="result-dialog"
          aria-label={`ผล ${detail.name}`}
          onClose={() => setDetailId(null)}
          onCancel={() => setDetailId(null)}
        >
          <div className="section-heading">
            <h2>
              {detail.flag} {detail.name}
            </h2>
            <button
              className="quiet-button"
              aria-label="ปิดรายละเอียด"
              onClick={() => setDetailId(null)}
            >
              <X size={19} />
            </button>
          </div>
          <p className="muted">
            {detail.date} • ตามตาราง {detail.drawTimeStr}
          </p>
          {drawState(detail, now) === "drawn" ? (
            <>
              <div className="result-pair">
                <div>
                  <strong>{detail.firstPrize || detail.top3 || "—"}</strong>
                  <small>{detail.firstPrize ? "รางวัลที่ 1" : "3 ตัวบน"}</small>
                </div>
                <div>
                  <strong>{detail.bottom2}</strong>
                  <small>2 ตัวล่าง</small>
                </div>
              </div>
              <p className="muted">แหล่งข้อมูล: {detail.source}</p>
              <div className="hero-actions">
                <button
                  className="quiet-button"
                  disabled={!isVoiceEnabled}
                  onClick={() =>
                    ThaiTtsService.speak(buildAnnouncement(detail))
                  }
                >
                  <Volume2 size={16} /> อ่านผล
                </button>
                <button className="quiet-button" onClick={() => copy(detail)}>
                  <Copy size={16} /> คัดลอก
                </button>
                <button className="quiet-button" onClick={() => share(detail)}>
                  <Share2 size={16} /> แชร์
                </button>
              </div>
              <p role="status" className="muted">
                {message}
              </p>
            </>
          ) : (
            <div className="empty-state">
              {stateLabels[drawState(detail, now)]} • ยังไม่มีผลที่ยืนยันแล้ว
            </div>
          )}
        </dialog>
      )}
    </div>
  );
};
