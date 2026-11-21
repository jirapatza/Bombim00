import React, { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { isIos, isStandalone } from "../utils/install";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallApp: React.FC = () => {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [ios] = useState(isIos);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            installed ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
          }`}
        >
          <Smartphone className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100">ติดตั้งเป็นแอป</h3>
          <p className="text-xs text-slate-400">
            {installed
              ? "ติดตั้งแล้ว เปิดจากไอคอนบนหน้าจอได้เลย"
              : "เปิดแบบแอปได้เต็มจอ และทำให้ iPhone รับแจ้งเตือนได้"}
          </p>
        </div>
      </div>

      {installed ? (
        <p className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs text-emerald-400" role="status">
          กำลังใช้งานในโหมดแอป
        </p>
      ) : prompt ? (
        <button
          type="button"
          onClick={() => void install()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500"
        >
          <Download className="h-4 w-4" /> ติดตั้งแอป
        </button>
      ) : (
        <ol className="mt-3 space-y-1.5 rounded-xl bg-slate-950 px-3 py-2.5 text-xs text-slate-300">
          {ios ? (
            <>
              <li>1. เปิดหน้านี้ด้วย Safari</li>
              <li>2. กดปุ่มแชร์ (สี่เหลี่ยมลูกศรขึ้น)</li>
              <li>3. เลือก “เพิ่มไปที่หน้าจอโฮม”</li>
              <li>4. เปิดจากไอคอน แล้วค่อยเปิดแจ้งเตือน (iOS 16.4 ขึ้นไป)</li>
            </>
          ) : (
            <>
              <li>1. เปิดเมนูเบราว์เซอร์ (⋮)</li>
              <li>2. เลือก “ติดตั้งแอป” หรือ “เพิ่มไปที่หน้าจอโฮม”</li>
              <li>3. เปิดจากไอคอนเพื่อรับแจ้งเตือน</li>
            </>
          )}
        </ol>
      )}
    </div>
  );
};
