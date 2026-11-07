import React, { useState } from "react";
import {
  Activity,
  MonitorSmartphone,
  RefreshCw,
  VolumeX,
  Bell,
} from "lucide-react";
import { ThaiTtsService } from "../utils/thaiTts";
interface Props {
  online: boolean;
  lastSynced: string;
  isRefreshing: boolean;
  onRecover: () => Promise<boolean>;
}
export function DeviceHealthPanel({
  online,
  lastSynced,
  isRefreshing,
  onRecover,
}: Props) {
  const [permission, setPermission] = useState(
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
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
  const requestPermission = async () => {
    setReport(
      "กรุณาตอบคำขอสิทธิ์ของเบราว์เซอร์ หากไม่แสดงให้ตรวจการตั้งค่าเว็บไซต์",
    );
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setReport(
        result === "granted"
          ? "อนุญาตแล้ว ปุ่มทดสอบใช้ตรวจการแจ้งเตือนในเบราว์เซอร์นี้ได้"
          : "ยังไม่ได้รับอนุญาต เปลี่ยนสิทธิ์ได้ในการตั้งค่าเว็บไซต์ของเบราว์เซอร์",
      );
    } catch {
      setReport("ขอสิทธิ์ไม่ได้ ตรวจว่าใช้ HTTPS และเบราว์เซอร์รองรับ");
    }
  };
  const testNotification = () => {
    try {
      new Notification("BOMBIM00 • ทดสอบอุปกรณ์", {
        body: "การแจ้งเตือนในเบราว์เซอร์นี้ทำงาน นี่ไม่ใช่ผลหวยหรือการทดสอบ ntfy",
      });
      setReport("ส่งคำขอแจ้งเตือนทดสอบในเครื่องนี้แล้ว กรุณาตรวจหน้าจอของคุณ");
    } catch {
      setReport(
        "เบราว์เซอร์นี้ส่งการแจ้งเตือนไม่ได้ ลองตรวจสิทธิ์หรือใช้แอป ntfy",
      );
    }
  };
  const permissionLabels: Record<string, string> = {
    granted: "อนุญาตแล้ว",
    denied: "ถูกปิดกั้น",
    default: "ยังไม่ได้อนุญาต",
    unsupported: "ไม่รองรับ",
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
          <VolumeX size={18} />
          <p>ระบบเสียง</p>
          <strong>
            {"speechSynthesis" in window ? "เบราว์เซอร์รองรับ" : "ไม่รองรับ"}
          </strong>
          <small>เสียงภาษาไทยขึ้นกับเสียงที่ติดตั้งในเครื่อง</small>
        </div>
        <div>
          <Bell size={18} />
          <p>สิทธิ์แจ้งเตือน</p>
          <strong>{permissionLabels[permission]}</strong>
          <small>สิทธิ์นี้แยกจากการรับ ntfy บนโทรศัพท์</small>
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
        {permission === "default" && (
          <button className="quiet-button" onClick={requestPermission}>
            ขอสิทธิ์แจ้งเตือน
          </button>
        )}
        {permission === "granted" && (
          <button className="quiet-button" onClick={testNotification}>
            ทดสอบแจ้งเตือนเครื่องนี้
          </button>
        )}
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
