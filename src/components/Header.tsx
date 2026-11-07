import React from "react";
import { Volume2, VolumeX, RefreshCw, Radio } from "lucide-react";
interface Props {
  currentTimeString: string;
  isVoiceEnabled: boolean;
  isRefreshing: boolean;
  onToggleVoice: () => void;
  onRefresh: () => void;
  online: boolean;
  lastSynced: string;
  liveDataError: boolean;
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
}) => (
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
        className={`badge ${online && lastSynced && !liveDataError ? "green" : "gold"}`}
      >
        <Radio size={13} />
        {!online
          ? "ออฟไลน์"
          : liveDataError
            ? "โหลดไม่สำเร็จ"
            : lastSynced
              ? "เชื่อมต่อแล้ว"
              : "กำลังเชื่อมต่อ"}
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
