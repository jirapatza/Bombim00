import React from "react";
import { Volume2, VolumeX, RefreshCw, Radio } from "lucide-react";
import { connectionHealth, connectionLabels } from "../utils/checkerHealth";
interface Props {
  currentTimeString: string;
  isVoiceEnabled: boolean;
  isRefreshing: boolean;
  onToggleVoice: () => void;
  onRefresh: () => void;
  online: boolean;
  lastSynced: string;
  liveDataError: boolean;
  lastRunTimestamp: string;
  checkerStatus: string;
  notificationFailures?: number;
  activeUncertainDeliveries?: number;
}
export const Header: React.FC<Props> = ({
  currentTimeString,
  isVoiceEnabled,
  isRefreshing,
  onToggleVoice,
  onRefresh,
  online,
  lastSynced,
  liveDataError,
  lastRunTimestamp,
  checkerStatus,
  notificationFailures = 0,
  activeUncertainDeliveries = 0,
}) => {
  const health = connectionHealth(online, lastSynced, liveDataError, lastRunTimestamp, checkerStatus);
  return (
  <header className="app-header">
    <div>
      <span className="mobile-brand">
        BOMBI<span>M00</span>
      </span>
      <p className="header-date">
        {new Intl.DateTimeFormat("th-TH", {
          timeZone: "Asia/Bangkok",
          dateStyle: "long",
        }).format(new Date())}
      </p>
      <p className="muted text-xs">◷ {currentTimeString} น. • เวลาไทย</p>
    </div>
    <div className="header-actions">
      <button
        className="quiet-button"
        onClick={onRefresh}
        disabled={isRefreshing}
        data-testid="top_refresh_button"
        aria-label="รีเฟรชข้อมูล"
      >
        <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
        <span className="desktop-label">รีเฟรชข้อมูล</span>
      </button>
      <span
        role="status"
        className={`badge ${health === "connected" ? "green" : "gold"}`}
        title={health === "checker-stale" ? "เว็บโหลดข้อมูลได้ แต่ยืนยันไม่ได้ว่าตัวตรวจผลฝั่งเซิร์ฟเวอร์อัปเดตภายใน 15 นาที" : undefined}
      >
        <Radio size={13} />
        {health === "checker-unhealthy" && (notificationFailures > 0 || activeUncertainDeliveries > 0)
          ? "ตรวจผลได้ แต่แจ้งเตือนติดขัด"
          : connectionLabels[health]}
      </span>
      <button
        className="quiet-button"
        onClick={onToggleVoice}
        data-testid="top_voice_toggle"
        aria-label={isVoiceEnabled ? "ปิดเสียงอ่านผล" : "เปิดเสียงอ่านผล"}
        aria-pressed={isVoiceEnabled}
      >
        {isVoiceEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
      </button>
    </div>
  </header>
  );
};
