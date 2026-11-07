import React from "react";
import {
  House,
  History,
  TableProperties,
  Search,
  Settings,
  Bell,
  ShieldCheck,
} from "lucide-react";
export type AppTab = "live" | "history" | "summary" | "checker" | "settings";
interface Props {
  currentTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
}
export const BottomNavigation: React.FC<Props> = ({
  currentTab,
  onChangeTab,
}) => {
  const tabs = [
    { id: "live", title: "หน้าหลัก", icon: House },
    { id: "history", title: "ผลย้อนหลัง / สถิติ", icon: History },
    { id: "summary", title: "สรุป / แชร์ผล", icon: TableProperties },
    { id: "checker", title: "ตรวจรางวัล", icon: Search },
    { id: "settings", title: "ตั้งค่า", icon: Settings },
  ] as const;
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        BOMBI<span>M00</span>
        <small>LIVE RESULTS</small>
      </div>
      <nav aria-label="เมนูหลัก">
        {tabs.map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChangeTab(id)}
            data-testid={`nav_${id}`}
            aria-current={id === currentTab ? "page" : undefined}
            className={id === currentTab ? "active" : ""}
          >
            <Icon size={20} />
            <span>{title}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-callout">
        <Bell size={34} />
        <h3>ติดตามผลประจำวัน</h3>
        <p>ตั้งค่าเสียงและช่องทางรับแจ้งเตือนบนอุปกรณ์ของคุณ</p>
        <button
          className="primary-button"
          onClick={() => onChangeTab("settings")}
        >
          ตั้งค่าการแจ้งเตือน
        </button>
      </div>
      <div className="sidebar-footer">
        <ShieldCheck size={17} /> ข้อมูลตามแหล่งประกาศผล
        <small>Asia/Bangkok (UTC+7)</small>
      </div>
    </aside>
  );
};
