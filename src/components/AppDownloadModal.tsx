import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Download,
  Github,
  CheckCircle2,
  ExternalLink,
  Copy,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  QrCode,
  Share2
} from 'lucide-react';

interface AppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl: string;
  githubRepo: string;
}

export const AppDownloadModal: React.FC<AppDownloadModalProps> = ({
  isOpen,
  onClose,
  appUrl,
  githubRepo,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'pwa' | 'apk'>('pwa');

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('หากเบราว์เซอร์ไม่แสดงป๊อปอัปอัตโนมัติ:\n\n• บน Chrome (Android): แตะจุด 3 จุดมุมขวาบน > เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"\n• บน Safari (iPhone): แตะปุ่มแชร์ [↑] > เลือก "เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"');
    }
  };

  const copyAppUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const githubActionsUrl = `https://github.com/${githubRepo}/actions/workflows/android-apk.yml`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              ดาวน์โหลด & ติดตั้งแอปพลิเคชัน
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PRO
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              เลือกลักษณะการติดตั้งบนมือถือของคุณได้ 2 ช่องทาง ทั้งติดตั้งทันที และไฟล์ APK
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'pwa'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            1. ติดตั้งลงมือถือทันที (แนะนำ)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'apk'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Github className="w-4 h-4" />
            2. ดาวน์โหลดไฟล์ APK (.apk)
          </button>
        </div>

        {/* TAB 1: PWA Direct Install */}
        {activeTab === 'pwa' && (
          <div className="space-y-4">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  ติดตั้งเป็นแอปแท้บนหน้าจอมือถือ (ไม่ต้องโหลดไฟล์ APK)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Android &amp; iOS (iPhone)
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                แอปจะถูกสร้างไอคอนบนหน้าจอหลักของคุณ เปิดใช้งานเต็มจอ (Standalone) ไม่มีแถบ URL เบราว์เซอร์ อัปเดตข้อมูลหวย 51 รายการสดใหม่แบบเรียลไทม์ พร้อมเสียงอ่านภาษาไทย
              </p>

              {/* Direct QR Code for instant phone access */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
                <div className="bg-white p-2 rounded-xl shrink-0 shadow-md">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(appUrl)}`}
                    alt="QR Code สำหรับเปิดแอพบนมือถือ"
                    className="w-28 h-28 object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="text-left space-y-1.5 flex-1">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-amber-400" />
                    สแกนด้วยกล้องมือถือ เพื่อเปิดและติดตั้งทันที
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    เปิดแอพกล้องบนมือถือ (iPhone หรือ Android) ส่องที่ QR Code นี้ เพื่อเข้าใช้งานและติดตั้งแอปลงเครื่องได้ทันทีโดยไม่ต้องพิมพ์ลิงก์
                  </p>
                  <a
                    href={appUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline"
                  >
                    เปิดแอพในหน้าต่างใหม่ <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleInstallPWA}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 cursor-pointer transition flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  {isInstalled ? '✓ ติดตั้งบนเครื่องแล้ว' : 'แตะที่นี่เพื่อติดตั้งแอปลงมือถือทันที'}
                </button>
              </div>
            </div>

            {/* Step instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>🤖 วิธีติดตั้งบน Android (Chrome)</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  1. เปิดลิงก์นี้ใน Google Chrome บนมือถือ<br />
                  2. แตะจุด 3 จุด (⋮) มุมขวาบนของหน้าจอ<br />
                  3. เลือก <strong>"ติดตั้งแอป"</strong> หรือ <strong>"เพิ่มลงในหน้าจอหลัก"</strong><br />
                  4. จะได้ไอคอนแอปบนหน้าจอมือถือทันที!
                </p>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>🍎 วิธีติดตั้งบน iPhone (Safari)</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  1. เปิดลิงก์นี้ใน Safari บน iPhone<br />
                  2. แตะปุ่มแชร์ <strong>[↑]</strong> ด้านล่างจอ<br />
                  3. เลื่อนลงมาเลือก <strong>"เพิ่มไปยังหน้าจอโฮม"</strong> (Add to Home Screen)<br />
                  4. กด "เพิ่ม" จะได้ไอคอนแอปลงบนเครื่องทันที!
                </p>
              </div>
            </div>

            {/* Direct App Link Box */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
              <div className="truncate text-xs font-mono text-slate-300">
                {appUrl}
              </div>
              <button
                type="button"
                onClick={copyAppUrl}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer shrink-0 flex items-center gap-1"
              >
                {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                {copiedLink ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: GitHub Android APK Workflow */}
        {activeTab === 'apk' && (
          <div className="space-y-4">
            <div className="bg-slate-950/80 border border-purple-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Github className="w-4 h-4 text-purple-400" />
                  GitHub Actions: คอมไพล์ไฟล์ APK (.apk) อัตโนมัติ
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                  Android Debug APK
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Repository ของคุณมีระบบ GitHub Actions (<strong>android-apk.yml</strong>) สำหรับสร้างไฟล์ติดตั้ง <code>app-debug.apk</code> โดยอัตโนมัติบนคลาวด์ของ GitHub ฟรี
              </p>

              <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-slate-200 block">วิธีดาวน์โหลดไฟล์ APK:</span>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  <li>กดปุ่มด้านล่างเพื่อเปิดหน้า <strong>GitHub Actions (Build Android APK)</strong></li>
                  <li>กดปุ่ม <strong>"Run workflow"</strong> สีน้ำเงินบนหน้า GitHub เพื่อเริ่มคอมไพล์ (ใช้เวลา ~2 นาที)</li>
                  <li>เมื่องานเสร็จสมบูรณ์ (เครื่องหมายถูกสีเขียว) ให้คลิกที่ชื่อรอบนั้น</li>
                  <li>เลื่อนลงมาด้านล่างสุดที่หัวข้อ <strong>Artifacts</strong> จะมีไฟล์ <strong>Bombim00-Android-debug-APK</strong> ให้ดาวน์โหลด</li>
                </ol>
              </div>

              <div className="pt-2">
                <a
                  href={githubActionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  เปิดหน้าดาวน์โหลด APK บน GitHub Actions
                </a>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 text-center">
              Repository: <code className="text-purple-400">{githubRepo}</code> • Workflow: <code className="text-amber-400">android-apk.yml</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
