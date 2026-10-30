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
  Share2,
  Play,
  RefreshCw,
  FolderDown,
  AlertCircle,
  FileCode2,
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
  const [activeTab, setActiveTab] = useState<'apk' | 'pwa' | 'source'>('apk');

  // Trigger dispatch state
  const [ghToken, setGhToken] = useState<string>(() => localStorage.getItem('gh_pat') || '');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{ success: boolean; message: string } | null>(null);

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
      alert(
        'หากเบราว์เซอร์ไม่แสดงป๊อปอัปอัตโนมัติ:\n\n• บน Chrome (Android): แตะจุด 3 จุดมุมขวาบน > เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"\n• บน Safari (iPhone): แตะปุ่มแชร์ [↑] > เลือก "เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"'
      );
    }
  };

  const copyAppUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleTriggerApkBuild = async () => {
    setIsDispatching(true);
    setDispatchResult(null);
    try {
      const res = await fetch('/api/github/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: githubRepo,
          workflow: 'android-apk.yml',
          token: ghToken.trim() || undefined,
          branch: 'main',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (ghToken.trim()) localStorage.setItem('gh_pat', ghToken.trim());
        setDispatchResult({
          success: true,
          message: 'ส่งคำสั่งเริ่มบิลด์ APK บน GitHub Actions สำเร็จแล้ว! กำลังประมวลผลบนคลาวด์ (~2 นาที)',
        });
      } else {
        setDispatchResult({
          success: false,
          message: data.error || 'ไม่สามารถสั่งรันได้ กรุณากรอก GitHub Token หรือเปิดหน้า GitHub เพื่อกดปุ่ม Run workflow',
        });
      }
    } catch (err: any) {
      setDispatchResult({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const cleanRepo = githubRepo || 'jirapatza/Bombim00';
  const githubActionsUrl = `https://github.com/${cleanRepo}/actions/workflows/android-apk.yml`;
  const githubReleasesUrl = `https://github.com/${cleanRepo}/releases`;
  const githubDirectApkUrl = `https://github.com/${cleanRepo}/releases/download/latest-apk/Bombim00-latest.apk`;
  const githubZipDownloadUrl = `https://github.com/${cleanRepo}/archive/refs/heads/main.zip`;

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
              ดาวน์โหลด &amp; ติดตั้งแอปพลิเคชัน
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PRO
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              ดาวน์โหลดผ่าน GitHub ทั้งไฟล์ APK (.apk) หรือติดตั้งทันทีบนมือถือ
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
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
            1. ดาวน์โหลด APK จาก GitHub
          </button>
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
            2. ติดตั้งบนมือถือ (PWA)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('source')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'source'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderDown className="w-4 h-4" />
            3. ดาวน์โหลด ZIP
          </button>
        </div>

        {/* TAB 1: GITHUB ANDROID APK */}
        {activeTab === 'apk' && (
          <div className="space-y-4">
            <div className="bg-slate-950/80 border border-purple-500/40 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Github className="w-4 h-4 text-purple-400" />
                  ดาวน์โหลดไฟล์ Android APK (.apk) จาก GitHub
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                  Release &amp; Artifact
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                คลัง GitHub ของคุณ (<strong>{cleanRepo}</strong>) มีเวิร์กโฟลว์{' '}
                <code>.github/workflows/android-apk.yml</code> สำหรับคอมไพล์ไฟล์ APK บนคลาวด์ของ GitHub
                และเผยแพร่ลงใน GitHub Releases อัตโนมัติ
              </p>

              {/* Direct Download Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href={githubDirectApkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex flex-col justify-between shadow-lg shadow-emerald-600/20 transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5">
                      <Download className="w-4 h-4" />
                      ดาวน์โหลดไฟล์ APK ล่าสุด
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                  </div>
                  <span className="text-[11px] text-emerald-200 font-normal">
                    Bombim00-latest.apk (Direct Release)
                  </span>
                </a>

                <a
                  href={githubReleasesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-purple-500/40 text-white font-bold text-xs flex flex-col justify-between transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5">
                      <Github className="w-4 h-4 text-purple-400" />
                      เปิดหน้า GitHub Releases
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal">
                    ดูทุกเวอร์ชันที่คอมไพล์แล้ว
                  </span>
                </a>
              </div>

              {/* Trigger Build in 1 Click */}
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-amber-400 fill-current" />
                    สั่งสร้างไฟล์ APK ใหม่บน GitHub (Build Trigger)
                  </span>
                  <a
                    href={githubActionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <span>เปิด GitHub Actions</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="GitHub PAT Token (ถ้ามีสิทธิ์ Actions)"
                    value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTriggerApkBuild}
                    disabled={isDispatching}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg transition shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDispatching ? 'animate-spin' : ''}`} />
                    <span>{isDispatching ? 'กำลังสั่งรัน...' : 'เริ่มบิลด์ APK'}</span>
                  </button>
                </div>

                {dispatchResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      dispatchResult.success
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {dispatchResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{dispatchResult.message}</span>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs">
                <span className="font-bold text-slate-200 block">ขั้นตอนการโหลดจาก GitHub ด้วยตัวเอง:</span>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  <li>เปิดหน้า <strong>GitHub Actions &gt; Build Android APK</strong></li>
                  <li>กดปุ่ม <strong>&quot;Run workflow&quot;</strong> สีน้ำเงินบนหน้า GitHub เพื่อเริ่มคอมไพล์ (~2 นาที)</li>
                  <li>เมื่องานเสร็จสมบูรณ์ ให้ดาวน์โหลดไฟล์จากหัวข้อ <strong>Artifacts</strong> หรือแท็บ <strong>Releases</strong></li>
                </ol>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 text-center">
              Repository: <code className="text-purple-400">{cleanRepo}</code> • Workflow: <code className="text-amber-400">android-apk.yml</code>
            </div>
          </div>
        )}

        {/* TAB 2: PWA DIRECT INSTALL */}
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
                แอปจะถูกสร้างไอคอนบนหน้าจอหลักของคุณ เปิดใช้งานเต็มจอ (Standalone) ไม่มีแถบ URL เบราว์เซอร์
                อัปเดตข้อมูลหวย 51 รายการสดใหม่แบบเรียลไทม์ พร้อมเสียงอ่านภาษาไทย
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
                    เปิดแอพกล้องบนมือถือ (iPhone หรือ Android) ส่องที่ QR Code นี้ เพื่อเข้าใช้งานและติดตั้งแอปลงเครื่องได้ทันที
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
                  3. เลือก <strong>&quot;ติดตั้งแอป&quot;</strong> หรือ <strong>&quot;เพิ่มลงในหน้าจอหลัก&quot;</strong><br />
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
                  3. เลื่อนลงมาเลือก <strong>&quot;เพิ่มไปยังหน้าจอโฮม&quot;</strong> (Add to Home Screen)<br />
                  4. กด &quot;เพิ่ม&quot; จะได้ไอคอนแอปลงบนเครื่องทันที!
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

        {/* TAB 3: DOWNLOAD SOURCE CODE ZIP */}
        {activeTab === 'source' && (
          <div className="space-y-4">
            <div className="bg-slate-950/80 border border-indigo-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <FolderDown className="w-4 h-4 text-indigo-400" />
                  ดาวน์โหลดซอร์สโค้ดของแอปพลิเคชัน (ZIP)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                  main branch
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                ดาวน์โหลดไฟล์โค้ดทั้งหมดของโปรเจกต์จากคลัง GitHub <code>{cleanRepo}</code> เพื่อนำไปรันบนเครื่องคอมพิวเตอร์ของคุณ หรือแก้ไขต่อใน VS Code
              </p>

              <div className="pt-2">
                <a
                  href={githubZipDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
                >
                  <Download className="w-4 h-4" />
                  ดาวน์โหลด Source Code .ZIP จาก GitHub ทันที
                </a>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <span className="font-bold text-slate-200 block">วิธีนำไปรันบนคอมพิวเตอร์ (Local):</span>
              <p className="text-slate-400 text-[11px] leading-relaxed font-mono">
                1. แตกไฟล์ ZIP ที่ดาวน์โหลดมา<br />
                2. เปิด Terminal ในโฟลเดอร์นั้น<br />
                3. พิมพ์: <span className="text-amber-300">npm install</span><br />
                4. พิมพ์: <span className="text-amber-300">npm run dev</span> เพื่อเปิดแอปบน localhost:3000
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
