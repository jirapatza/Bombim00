import React, { useState } from "react";
import {
  Activity,
  MonitorSmartphone,
  RefreshCw,
  VolumeX,
} from "lucide-react";
import { ThaiTtsService } from "../utils/thaiTts";
import { connectionHealth, connectionLabels } from "../utils/checkerHealth";
import type { SystemStatus } from "../types/lottery";
interface Props {
  online: boolean;
  lastSynced: string;
  status: SystemStatus;
  liveDataError: boolean;
  isRefreshing: boolean;
  onRecover: () => Promise<boolean>;
}
export function DeviceHealthPanel({
  online,
  lastSynced,
  status,
  liveDataError,
  isRefreshing,
  onRecover,
}: Props) {
  const checkerHealth = connectionHealth(
    online,
    lastSynced,
    liveDataError,
    status.last_run_timestamp,
    status.system_status,
  );
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);
  const recover = async () => {
    setBusy(true);
    setReport("กำลังหยุดเสียงค้างและเชื่อมต่อข้อมูลใหม่…");
    ThaiTtsService.stop();
    try {
      const ok = await onRecover();
      setReport(
        ok
          ? "โหลดข้อมูลล่าสุดสำเร็จ หากงานตรวจผลฝั่งเซิร์ฟเวอร์ล่าช้า ต้องตรวจ worker เพิ่มเติม"
          : "ยังโหลดข้อมูลไม่ได้ เก็บข้อมูลเดิมไว้แล้ว ตรวจอินเทอร์เน็ตหรือแหล่งข้อมูลแล้วลองใหม่",
      );
    } catch {
      setReport("กู้คืนไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel device-panel" aria-labelledby="device-heading">
      <div className="section-heading">
        <h2 id="device-heading">
          <MonitorSmartphone size={21} /> อุปกรณ์และการกู้คืน
        </h2>
        <span className="badge blue">เบราว์เซอร์นี้</span>
      </div>
      <div className="health-grid">
        <div>
          <Activity size={18} />
          <p>การเชื่อมต่อ</p>
          <strong>{online ? "เครือข่ายพร้อม" : "ออฟไลน์"}</strong>
          <small>โหลดข้อมูลสำเร็จล่าสุด: {lastSynced || "ยังไม่สำเร็จ"}</small>
        </div>
        <div>
          <Activity size={18} />
          <p>ตัวตรวจผลฝั่งเซิร์ฟเวอร์</p>
          <strong>{connectionLabels[checkerHealth]}</strong>
          <small>
            {checkerHealth === "checker-stale"
              ? "ยืนยันการตรวจผลล่าสุดภายใน 15 นาทีไม่ได้ แม้เว็บจะโหลดข้อมูลสำเร็จ"
              : "สถานะจากข้อมูลตรวจผลล่าสุด ไม่ใช่การยืนยันว่าโทรศัพท์ได้รับแจ้งเตือน"}
          </small>
        </div>
        <div>
          <VolumeX size={18} />
          <p>ระบบเสียง</p>
          <strong>
            {"speechSynthesis" in window ? "เบราว์เซอร์รองรับ" : "ไม่รองรับ"}
          </strong>
          <small>เสียงภาษาไทยขึ้นกับเสียงที่ติดตั้งในเครื่อง</small>
        </div>
      </div>
      <div className="hero-actions">
        <button
          className="primary-button"
          onClick={recover}
          disabled={busy || isRefreshing}
        >
          <RefreshCw size={16} className={busy ? "animate-spin" : ""} />{" "}
          {busy ? "กำลังกู้คืน…" : "ซ่อมแซม / เชื่อมต่อใหม่"}
        </button>
        <button
          className="quiet-button"
          onClick={() => {
            ThaiTtsService.stop();
            setReport("หยุดเสียงและล้างคิวอ่านผลในเครื่องนี้แล้ว");
          }}
        >
          หยุดเสียงค้าง
        </button>
      </div>
      <p role="status" className="muted">
        {report}
      </p>
      <p className="muted footnote">
        กู้คืนโดยโหลดข้อมูลใหม่และหยุดเสียง ไม่ลบการตั้งค่า เลขเฝ้าดู
        หรือประวัติผล หากแหล่งข้อมูลกลับมา ระบบจะลองโหลดใหม่ทุก 15
        วินาทีขณะเปิดหน้านี้
        การควบคุมโทรศัพท์เครื่องอื่นและรีสตาร์ตเซิร์ฟเวอร์ต้องใช้ระบบจัดการแยก
      </p>
    </section>
  );
}
