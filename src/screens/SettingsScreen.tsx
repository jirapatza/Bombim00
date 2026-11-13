import React, { useState } from "react";
import {
  Star,
  Plus,
  X,
  Volume2,
  VolumeX,
  Play,
  Activity,
} from "lucide-react";
import { SystemStatus } from "../types/lottery";
import { ThaiTtsService } from "../utils/thaiTts";
import { checkerHeartbeatFresh } from "../utils/checkerHealth";

interface Props {
  status: SystemStatus;
  watchedNumbers: string[];
  isVoiceEnabled: boolean;
  onToggleVoice: () => void;
  onAddWatchedNumber: (num: string) => void;
  onRemoveWatchedNumber: (num: string) => void;
}

export const SettingsScreen: React.FC<Props> = ({
  status,
  watchedNumbers,
  isVoiceEnabled,
  onToggleVoice,
  onAddWatchedNumber,
  onRemoveWatchedNumber,
}) => {
  const [newNum, setNewNum] = useState("");
  const [formError, setFormError] = useState("");

  const handleAddNumber = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newNum.replace(/\D/g, "").trim();
    if (!/^(?:[0-9]{2}|[0-9]{3}|[0-9]{6})$/.test(clean)) {
      setFormError("กรุณาใส่เลข 2, 3 หรือ 6 หลัก");
      return;
    }
    try {
      onAddWatchedNumber(clean);
      setNewNum("");
      setFormError("");
    } catch {
      setFormError("บันทึกไม่ได้ เบราว์เซอร์อาจปิดการใช้พื้นที่จัดเก็บ");
    }
  };

  const handleTestTts = () => {
    ThaiTtsService.speak(
      "ประกาศผลสลากกินแบ่งรัฐบาล รางวัลที่หนึ่ง สอง สอง สี่ เลขท้ายสองตัว แปด ห้า ครับ",
    );
  };

  const delayed = !checkerHeartbeatFresh(status.last_run_timestamp);
  const healthy = status.system_status === "healthy" && !delayed;
  const notificationTrouble = (status.notification_failures || 0) > 0 ||
    (status.active_uncertain_deliveries || 0) > 0 ||
    (status.schedule_alert_failures || 0) > 0;

  return (
    <div className="space-y-4 pb-6">
      {formError && (
        <p role="alert" className="rounded-xl bg-amber-950 p-3 text-amber-200">
          {formError}
        </p>
      )}
      {/* Watched Numbers Section */}
      <div className="rounded-2xl border border-amber-500/30 bg-slate-900 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-md">
            <Star className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              เลขนำโชคที่คุณเฝ้าดู (Watched Numbers)
            </h3>
            <p className="text-xs text-slate-400">
              เน้นผลที่ตรงกับเลขเฝ้าดูในตารางของเบราว์เซอร์นี้
              ไม่เปลี่ยนค่าตัวส่งบนเซิร์ฟเวอร์
            </p>
          </div>
        </div>

        {/* Existing Number Chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {watchedNumbers.map((num) => (
            <span
              key={num}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1 font-mono-numbers text-xs font-bold text-slate-950 shadow-sm"
            >
              {num}
              <button
                type="button"
                aria-label={`ลบเลข ${num}`}
                onClick={() => {
                  try {
                    onRemoveWatchedNumber(num);
                    setFormError("");
                  } catch {
                    setFormError("ลบไม่ได้ พื้นที่จัดเก็บไม่พร้อม");
                  }
                }}
                className="rounded-full p-0.5 hover:bg-black/20 text-slate-950"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        {/* Add Number Row */}
        <form onSubmit={handleAddNumber} className="mt-4 flex gap-2.5">
          <input
            type="text"
            value={newNum}
            onChange={(e) => setNewNum(e.target.value.replace(/\D/g, ""))}
            data-testid="add_watched_number_input"
            aria-label="เลขที่เฝ้าดู"
            placeholder="ใส่เลข 2, 3 หรือ 6 หลัก"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono-numbers"
          />
          <button
            type="submit"
            disabled={!newNum.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            เพิ่ม
          </button>
        </form>
      </div>

      {/* Voice TTS Settings */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                isVoiceEnabled
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              {isVoiceEnabled ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                ระบบเสียงอ่านผลรางวัล (TTS)
              </h3>
              <p className="text-xs text-slate-400">
                {isVoiceEnabled
                  ? "เปิดใช้งานเสียงอ่านผลภาษาไทย"
                  : "ปิดเสียงอยู่"}
              </p>
            </div>
          </div>

          <button
            onClick={onToggleVoice}
            aria-label="เปิดหรือปิดเสียงอ่านผล"
            role="switch"
            aria-checked={isVoiceEnabled}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isVoiceEnabled ? "bg-amber-500" : "bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                isVoiceEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {isVoiceEnabled && (
          <button
            onClick={handleTestTts}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-amber-400 hover:bg-slate-700 transition-colors"
          >
            <Play className="h-4 w-4" />
            ทดสอบเสียงอ่านตัวอย่าง
          </button>
        )}
      </div>

      {/* Diagnostics & System Health */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg space-y-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h3 className="text-base font-bold text-slate-100">
            ข้อมูลสถานะระบบ (Diagnostics)
          </h3>
        </div>
        <p className="text-slate-300">
          • สถานะระบบ:{" "}
          <span
            className={
              healthy
                ? "font-bold text-emerald-400"
                : "font-bold text-amber-400"
            }
          >
            {delayed
              ? "งานตรวจผลล่าช้า"
              : healthy
                ? "ทำงานปกติ"
                : status.system_status === "error"
                  ? "ตรวจผลไม่สำเร็จ"
                  : notificationTrouble
                    ? "ตรวจผลได้ แต่แจ้งเตือนติดขัด"
                    : "ทำงานได้บางส่วน"}
          </span>
        </p>
        <p className="text-slate-300">{status.status_message}</p>
        {notificationTrouble && (
          <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-amber-100 space-y-1">
            <p>ระบบยังรับผลหวยได้ แต่มีรายการแจ้งเตือนที่ส่งไม่สำเร็จหรือยังไม่ทราบผล</p>
            <p>ค้างส่ง: {status.notification_failures || 0} รายการ · ไม่ทราบผลการส่งช่วงปัจจุบัน: {status.active_uncertain_deliveries || 0} รายการ</p>
            <p className="text-amber-200/85">รายการที่ยังไม่ทราบผลจะไม่ส่งซ้ำอัตโนมัติ เพื่อป้องกันข้อความซ้ำ</p>
          </div>
        )}
        {status.source_checks && [
          { label: "รอผลจากแหล่งข้อมูล", entries: status.source_checks.waiting },
          { label: "แหล่งข้อมูลขัดข้อง", entries: status.source_checks.errors },
        ].filter(group => group.entries.length > 0).map(({ label, entries }) => (
          <details key={label} className="text-slate-300">
            <summary className="cursor-pointer">{label} ({entries.length})</summary>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {entries.map(({ source, lottery, status: code, reason }, index) => (
                <li key={`${source}-${lottery}-${index}`}>
                  {[lottery, source, code === null ? undefined : `HTTP ${code}`,
                    reason === "timeout" ? "หมดเวลารอ" :
                      reason === "network" ? "เชื่อมต่อไม่ได้" :
                        reason === "invalid_response" ? "ข้อมูลตอบกลับผิดรูปแบบ" :
                          reason === "request_budget" ? "ถึงขีดจำกัดของรอบตรวจ" : undefined]
                    .filter(Boolean).join(" · ")}
                </li>
              ))}
            </ul>
          </details>
        ))}
        <p className="text-slate-300">
          • ตรวจสอบแล้วทั้งหมด:{" "}
          <span className="font-mono-numbers font-bold text-slate-100">
            {status.total_checks} ครั้ง
          </span>
        </p>
        <p className="text-slate-300 truncate">
          • แหล่งข้อมูลล่าสุด:{" "}
          <span className="text-slate-100">{status.last_source_used}</span>
        </p>
        <p className="text-slate-300">
          • อัปเดตล่าสุด:{" "}
          <span className="font-bold text-amber-400">
            {status.last_run_date_thai || "ไม่ทราบเวลา"}
          </span>
        </p>
      </div>
    </div>
  );
};
