import { useEffect, useState } from "react";

const api = "/api/push";

async function pushRequest(path: string, method = "GET", data?: object) {
  const response = await fetch(api + path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

export function BrowserPush() {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.getRegistration("/push-sw.js")
      .then(registration => registration?.pushManager.getSubscription())
      .then(subscription => setEnabled(Boolean(subscription)))
      .catch(() => {});
  }, [supported]);

  async function change(action: "enable" | "test" | "disable") {
    setBusy(true);
    setStatus("");
    let created: PushSubscription | null = null;
    try {
      if (action === "enable" && await Notification.requestPermission() !== "granted") {
        setStatus("กรุณาอนุญาตการแจ้งเตือนของเว็บไซต์ใน Chrome");
        return;
      }
      await navigator.serviceWorker.register("/push-sw.js");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (action === "enable") {
        const { publicKey } = await pushRequest("/config");
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
          created = subscription;
        }
        await pushRequest("/subscription", "POST", { subscription: subscription.toJSON(), enrollment });
        setEnrollment("");
        setEnabled(true);
        setStatus("เปิดแจ้งเตือนแล้ว");
      } else if (subscription && action === "test") {
        await pushRequest("/test", "POST", { subscription: subscription.toJSON() });
        setStatus("บริการ Push รับข้อความทดสอบแล้ว ตรวจแถบแจ้งเตือนบนเครื่องนี้");
      } else if (subscription) {
        await pushRequest("/subscription", "DELETE", { subscription: subscription.toJSON() });
        await subscription.unsubscribe();
        setEnabled(false);
        setStatus("ปิดแจ้งเตือนแล้ว");
      }
    } catch (error) {
      if (created) await created.unsubscribe().catch(() => {});
      setStatus(error instanceof Error && error.message === "403"
        ? "เปิดแจ้งเตือนไม่ได้ ตรวจรหัสเชื่อมอุปกรณ์"
        : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="browser-push-heading">
      <h2 id="browser-push-heading">แจ้งเตือนผลหวยบนเบราว์เซอร์</h2>
      {!supported ? <p>เบราว์เซอร์นี้ไม่รองรับ Web Push</p> : (
        <div className="hero-actions">
          {enabled ? <>
            <button className="primary-button" disabled={busy} onClick={() => void change("test")}>ส่งแจ้งเตือนทดสอบ</button>
            <button className="quiet-button" disabled={busy} onClick={() => void change("disable")}>ปิดแจ้งเตือน</button>
          </> : <>
            <label>รหัสเชื่อมอุปกรณ์ <input type="password" value={enrollment} onChange={event => setEnrollment(event.target.value)} /></label>
            <button className="primary-button" disabled={busy || !enrollment} onClick={() => void change("enable")}>เปิดแจ้งเตือนผลหวย</button>
          </>}
        </div>
      )}
      <p role="status">{status}</p>
    </section>
  );
}
