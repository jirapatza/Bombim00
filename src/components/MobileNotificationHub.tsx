import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Bell,
  Send,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Volume2,
  VolumeX,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Zap,
  ShieldCheck,
  Layers,
  Clock,
  Radio,
  Flame,
  Globe
} from 'lucide-react';

interface MobileNotificationHubProps {
  currentTopic?: string;
  onUpdateTopic?: (topic: string) => void;
  latestDraw?: any;
  allLotteries?: any[];
  onSpeak?: (text: string) => void;
  nextClosing?: { name: string; closeTimeStr: string };
}

export function MobileNotificationHub({
  currentTopic = 'lottery-alert',
  onUpdateTopic,
  latestDraw,
  allLotteries = [],
  onSpeak,
  nextClosing,
}: MobileNotificationHubProps) {
  const [topic, setTopic] = useState<string>(
    () => localStorage.getItem('mobile_ntfy_topic') || currentTopic || 'lottery-alert-thai'
  );
  const [server, setServer] = useState<string>('https://ntfy.sh');
  const [priority, setPriority] = useState<string>('urgent'); // 5 = urgent (vibrate + ring)
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<{ success?: boolean; message?: string; error?: string; timestamp?: string } | null>(null);

  // Selected lottery for testing
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>('');

  useEffect(() => {
    if (!selectedLotteryId && allLotteries.length > 0) {
      setSelectedLotteryId(allLotteries[0].id);
    }
  }, [allLotteries, selectedLotteryId]);
  const [customNote, setCustomNote] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Browser Web Notification Permission on phone
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  const handleRequestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('เบราว์เซอร์ของคุณไม่รองรับ Notification API');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
      if (perm === 'granted') {
        new Notification('🔔 เปิดรับการแจ้งเตือนสำเร็จ!', {
          body: 'อุปกรณ์เครื่องนี้พร้อมรับการแจ้งเตือนผลหวยทันทีที่ผลออกรางวัล',
          icon: '/favicon.ico',
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Find preview lottery details
  const getSelectedLotteryData = () => {
    if (selectedLotteryId === 'gov') {
      return {
        name: 'สลากกินแบ่งรัฐบาล',
        flag: '🇹🇭',
        date: latestDraw?.งวดวันที่ || 'งวดล่าสุด',
        top3: latestDraw?.รางวัลที่_1 ? String(latestDraw.รางวัลที่_1).slice(-3) : '-',
        bottom2: latestDraw?.เลขท้าย_2_ตัว || '-',
        firstPrize: latestDraw?.รางวัลที่_1 || '-',
        nextClosing: nextClosing ? `${nextClosing.name} (${nextClosing.closeTimeStr})` : 'ตรวจสอบตารางรอบถัดไป',
      };
    }
    const found = allLotteries.find((l) => l.id === selectedLotteryId);
    if (found) {
      return {
        name: found.name,
        flag: found.flag || '🎯',
        date: found.date || 'วันนี้',
        top3: found.top3 || '-',
        bottom2: found.bottom2 || '-',
        firstPrize: found.firstPrize || found.top3 || '-',
        nextClosing: nextClosing ? `${nextClosing.name} (${nextClosing.closeTimeStr})` : 'ตรวจสอบตารางรอบถัดไป',
      };
    }
    return {
      name: 'ยังไม่มีรายการหวยให้ทดสอบ',
      flag: '🎯',
      date: 'ยังไม่มีข้อมูล',
      top3: '-',
      bottom2: '-',
      firstPrize: '-',
      nextClosing: nextClosing ? `${nextClosing.name} (${nextClosing.closeTimeStr})` : 'ตรวจสอบตารางรอบถัดไป',
    };
  };

  const currentPreview = getSelectedLotteryData();

  // Send real mobile push notification
  const handleSendMobilePush = async () => {
    if (!topic.trim()) {
      alert('กรุณาระบุ Topic สำหรับการส่งเข้าโทรศัพท์');
      return;
    }

    setIsSending(true);
    setSendResult(null);

    const title = `📢 ผล${currentPreview.name} งวด ${currentPreview.date}`;
    const message = `${currentPreview.flag} ${currentPreview.name}\n📅 งวดวันที่: ${currentPreview.date}\n\n🎯 3 ตัวบน / รางวัลที่ 1: ${currentPreview.firstPrize}\n🔢 2 ตัวล่าง: ${currentPreview.bottom2}\n\n⏰ หวยรอบถัดไปที่กำลังจะปิด: ${currentPreview.nextClosing}${customNote ? `\n💬 หมายเหตุ: ${customNote}` : ''}\n📡 ระบบส่งแจ้งเตือนอัตโนมัติ`;

    try {
      // Send directly to ntfy. The APK is a static Capacitor app and has no
      // same-origin Express API, so a relative /api URL will fail on-device.
      const ntfyUrl = `${server.replace(/\/$/, '')}/${encodeURIComponent(topic.trim())}`;
      const res = await fetch(ntfyUrl, {
        method: 'POST',
        headers: {
          'Title': title,
          'Priority': priority === 'urgent' ? '5' : priority === 'high' ? '4' : '3',
          'Tags': 'tada,loudspeaker,moneybag',
          'Click': window.location.origin,
        },
        body: message,
      });

      const responseText = await res.text();
      let data: any = {};
      try { data = responseText ? JSON.parse(responseText) : {}; } catch { data = { message: responseText }; }

      if (!res.ok || data.error) {
        throw new Error(data.error || data.message || `ส่ง ntfy ไม่สำเร็จ (HTTP ${res.status})`);
      }

      setSendResult({
        success: true,
        message: `ntfy รับคำขอส่งข้อความแล้ว (${server}/${topic}) แต่ยังยืนยันไม่ได้ว่ามือถือได้รับข้อความ`,
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });

      // Save topic to storage
      localStorage.setItem('mobile_ntfy_topic', topic.trim());
      if (onUpdateTopic) onUpdateTopic(topic.trim());

      // If browser push permitted, also display in current browser
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
        });
      }

      // Voice read out if handler provided
      if (onSpeak) {
        onSpeak(`ทดสอบเสียงแจ้งเตือน ${currentPreview.name} ตัวเลขทดสอบ ${currentPreview.firstPrize} และ ${currentPreview.bottom2}`);
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        error: err.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleTestSound = () => {
    const sample = 'ทดสอบระบบเสียงแจ้งเตือน เฮียฮวดพารวย ขอให้โชคดีทุกท่าน';
    if (onSpeak) {
      onSpeak(sample);
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sample);
      utterance.lang = 'th-TH';
      window.speechSynthesis.speak(utterance);
    } else {
      alert('อุปกรณ์นี้ไม่รองรับระบบอ่านออกเสียง');
    }
  };

  const ntfyWebUrl = `${server.replace(/\/$/, '')}/${topic.trim()}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ntfyWebUrl)}`;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-inner">
              <Smartphone className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  ศูนย์เชื่อมต่อและแจ้งเตือนเข้าโทรศัพท์มือถือ (Mobile Push 100%)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  iOS &amp; Android
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                ตั้งค่าส่งแจ้งเตือนเด้งเตือนบนหน้าจอล็อก (Lock Screen) พร้อมเสียงเตือนและการสั่นเตือนบนโทรศัพท์ไอโฟนและแอนดรอยด์ ฟรี 100% ไม่เสียค่าบริการ
              </p>
            </div>
          </div>

          {/* Direct subscribe button */}
          <a
            href={ntfyWebUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition"
          >
            <ExternalLink className="w-4 h-4" />
            เปิดหน้าแจ้งเตือนบนมือถือ
          </a>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Setup Steps & Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Subscribe Setup */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">
                  1
                </span>
                กำหนดชื่อช่องแจ้งเตือนส่วนตัว (Personal Topic)
              </div>
              <span className="text-[11px] text-slate-400 font-mono">ntfy.sh</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Topic Name (ตั้งชื่ออะไรก็ได้ที่ไม่ซ้ำกับผู้อื่น)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="เช่น lottery-alert-bombimm43"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  ระดับความสำคัญ (Priority)
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="urgent">Urgent (ระดับ 5 - มีเสียงเตือน+สั่น)</option>
                  <option value="high">High (ระดับ 4 - เด้งป๊อปอัพ)</option>
                  <option value="default">Default (ระดับ 3 - ปกติ)</option>
                </select>
              </div>
            </div>

            {/* Quick preset topics */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400">สุ่มชื่อ Topic ด่วน:</span>
              <button
                type="button"
                onClick={() => setTopic(`lottery-vip-${Math.floor(1000 + Math.random() * 9000)}`)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono border border-slate-700 cursor-pointer"
              >
                lottery-vip-XXXX
              </button>
              <button
                type="button"
                onClick={() => setTopic('lottery-alert-bombimm43')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono border border-slate-700 cursor-pointer"
              >
                lottery-alert-bombimm43
              </button>
            </div>
          </div>

          {/* Step 2: Connection Ways (App & Browser) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-100 border-b border-slate-800 pb-3">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                2
              </span>
              วิธีเปิดรับการแจ้งเตือนบนมือถือ (2 ช่องทาง)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Native Phone App */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="font-bold text-xs text-slate-200 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  วิธีที่ A: โหลดแอป ntfy ฟรี
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ดาวน์โหลดแอป <strong>ntfy</strong> จาก App Store (iPhone) หรือ Google Play (Android) แล้วกดปุ่มเครื่องหมาย + ใส่ชื่อ Topic ด้านบน
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href="https://apps.apple.com/app/ntfy/id1625396347"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 font-semibold"
                  >
                    🍏 App Store (iOS)
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=io.heckel.ntfy"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 font-semibold"
                  >
                    🤖 Google Play (Android)
                  </a>
                </div>
              </div>

              {/* Option B: Web Browser Push */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="font-bold text-xs text-slate-200 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  วิธีที่ B: เปิดรับผ่านเบราว์เซอร์เครื่องนี้
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  กดปุ่มด้านล่างเพื่ออนุญาตให้หน้าเว็บนี้ส่ง Push Notification มายังหน้าจอมือถือของคุณทันที
                </p>
                <button
                  type="button"
                  onClick={handleRequestBrowserPermission}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    browserPermission === 'granted'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  {browserPermission === 'granted'
                    ? '✓ ได้รับอนุญาตบนเครื่องนี้แล้ว'
                    : 'เปิดรับการแจ้งเตือนบนเครื่องนี้'}
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Trigger Live Test Push */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                  3
                </span>
                ทดสอบส่งแจ้งเตือนเข้าโทรศัพท์เดี๋ยวนี้
              </div>
              <span className="text-[11px] text-emerald-400 font-bold">1-Click Test</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  เลือกหวยสำหรับข้อความทดสอบ
                </label>
                <select
                  value={selectedLotteryId}
                  onChange={(e) => setSelectedLotteryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {allLotteries.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.flag} {l.name} ({l.drawTimeStr})
                    </option>
                  ))}
                  <option value="gov">สลากกินแบ่งรัฐบาล (GLO)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  ข้อความเสริม (Optional Note)
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="เช่น ยินดีกับผู้โชคดีทุกท่าน!"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestSound}
              className="w-full py-3 mb-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-sm rounded-2xl border border-amber-500/30 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Volume2 className="w-4 h-4" />
              🔊 ทดสอบเสียงอ่านภาษาไทย
            </button>

            <button
              type="button"
              disabled={isSending}
              onClick={handleSendMobilePush}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-sm rounded-2xl shadow-xl shadow-amber-500/25 transition cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
              {isSending ? 'กำลังยิงแจ้งเตือนเข้าโทรศัพท์...' : '🚀 ยิงการแจ้งเตือนเข้ามือถือทันที (Send Test to Phone)'}
            </button>

            {/* Send Result status */}
            {sendResult && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-center gap-3 animate-fade-in ${
                  sendResult.success
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                }`}
              >
                {sendResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold">
                    {sendResult.success ? 'ส่งแจ้งเตือนสำเร็จ 100%!' : 'เกิดข้อผิดพลาดในการส่ง'}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    {sendResult.message || sendResult.error} ({sendResult.timestamp})
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Live Mockup & QR Code */}
        <div className="lg:col-span-5 space-y-6">
          {/* QR Code Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-400" />
                สแกนเปิดด้วยกล้องมือถือ (QR Code)
              </span>
              <span className="text-[10px] text-amber-400 font-mono">Instant Connect</span>
            </div>

            <div className="flex justify-center py-2">
              <div className="p-3 bg-white rounded-2xl shadow-xl inline-block border-2 border-amber-400/50">
                <img
                  src={qrCodeUrl}
                  alt="ntfy QR Code"
                  className="w-44 h-44 object-contain"
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-300">
                ส่องกล้องมือถือมาที่ QR Code นี้ เพื่อเปิดรับการแจ้งเตือนของ Topic <code className="text-amber-300 font-mono font-bold">{topic}</code> ทันที
              </p>

              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopy(ntfyWebUrl, 'url')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedKey === 'url' ? 'คัดลอก URL แล้ว!' : 'คัดลอก URL แจ้งเตือน'}
                </button>
              </div>
            </div>
          </div>

          {/* Smartphone Mockup Preview */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-slate-400" />
                ตัวอย่างการแสดงผลบนหน้าจอมือถือ (Lock Screen Preview)
              </span>
            </div>

            {/* Simulated Phone Chassis */}
            <div className="max-w-[320px] mx-auto bg-slate-950 border-4 border-slate-800 rounded-[38px] p-4 shadow-2xl space-y-3 relative overflow-hidden">
              {/* Dynamic Island / Speaker */}
              <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto"></div>

              {/* Simulated Notification Banner */}
              <div className="bg-slate-900/95 backdrop-blur border border-amber-500/40 rounded-2xl p-3.5 shadow-xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <Bell className="w-3.5 h-3.5 animate-bounce" />
                    ntfy • {topic}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">เมื่อสักครู่</span>
                </div>

                <div className="font-bold text-xs text-slate-100">
                  📢 ผล{currentPreview.name} งวด {currentPreview.date}
                </div>

                <div className="text-[11px] text-slate-300 font-mono leading-relaxed space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <div>🎯 3 ตัวบน: <strong className="text-amber-300 font-bold">{currentPreview.firstPrize}</strong></div>
                  <div>🔢 2 ตัวล่าง: <strong className="text-emerald-400 font-bold">{currentPreview.bottom2}</strong></div>
                  <div className="text-[10px] text-amber-200/90 pt-1 border-t border-slate-800/80">
                    ⏰ ปิดถัดไป: {currentPreview.nextClosing}
                  </div>
                </div>

                {/* Simulated action button on notification */}
                <div className="pt-1 flex gap-2">
                  <div className="flex-1 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold rounded-lg text-center">
                    เปิดดูผลในแอป
                  </div>
                </div>
              </div>

              {/* Status bar bottom */}
              <div className="text-center text-[10px] text-slate-600 font-mono pt-2">
                ระบบพร้อมส่งแจ้งเตือน 24 ชั่วโมง
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
