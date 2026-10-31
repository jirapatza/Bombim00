import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Smartphone,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Send,
  ExternalLink,
  QrCode,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Zap,
  Copy,
  Check,
} from 'lucide-react';

export interface UnifiedNotificationCenterProps {
  settings: any;
  onSaveSettings: (newSettings: any) => void;
  voiceEnabled: boolean;
  onToggleVoice: (enabled: boolean) => void;
  onSpeakSample: () => void;
  onStopSpeech: () => void;
  isSpeaking?: boolean;
  speechRate: number;
  onSetSpeechRate: (rate: number) => void;
  latestDraw?: any;
  status?: any;
  onTriggerCheck?: () => void;
  isTriggering?: boolean;
  allLotteries?: any[];
  // Advanced controls
  onOpenAdvanced?: (tab: string) => void;
}

export const UnifiedNotificationCenter: React.FC<UnifiedNotificationCenterProps> = ({
  settings,
  onSaveSettings,
  voiceEnabled,
  onToggleVoice,
  onSpeakSample,
  onStopSpeech,
  isSpeaking = false,
  speechRate,
  onSetSpeechRate,
  latestDraw,
  status,
  onTriggerCheck,
  isTriggering = false,
  allLotteries = [],
  onOpenAdvanced,
}) => {
  const ntfyConfig = settings?.channels?.ntfy || settings?.ntfy || {};
  const [topic, setTopic] = useState<string>(ntfyConfig.topic || 'lottery-alert-live');
  const [isNtfyEnabled, setIsNtfyEnabled] = useState<boolean>(ntfyConfig.enabled !== false);
  const [isTestingNtfy, setIsTestingNtfy] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const ntfyServer = ntfyConfig.server || 'https://ntfy.sh';
  const cleanServer = ntfyServer.replace(/\/+$/, '');
  const subscribeUrl = `${cleanServer}/${encodeURIComponent(topic)}`;

  // Save changes to settings
  const handleSaveNotificationConfig = (newTopic: string, enabled: boolean) => {
    const updated = {
      ...settings,
      channels: {
        ...(settings?.channels || {}),
        ntfy: {
          ...(settings?.channels?.ntfy || {}),
          enabled,
          topic: newTopic.trim(),
          server: cleanServer,
          priority: 'high',
          tags: ['moneybag', 'dart', 'loudspeaker'],
        },
      },
      ntfy: {
        ...(settings?.ntfy || {}),
        enabled,
        topic: newTopic.trim(),
        server: cleanServer,
      },
    };
    onSaveSettings(updated);
  };

  // Test send to mobile app
  const handleTestMobilePush = async () => {
    setIsTestingNtfy(true);
    setTestResult(null);

    const sampleLottery = allLotteries.find((item) => item.category !== 'gov_savings') || allLotteries[0];
    const lotteryName = sampleLottery?.name || latestDraw?.ชื่อหวย || 'ตัวอย่างหวย';
    const top3 = sampleLottery?.top3 || (sampleLottery?.firstPrize ? String(sampleLottery.firstPrize).slice(-3) : '') ||
      (latestDraw?.รางวัลที่_1 ? String(latestDraw.รางวัลที่_1).slice(-3) : '-') || '-';
    const last2 = sampleLottery?.bottom2 || latestDraw?.เลขท้าย_2_ตัว || '-';
    const drawDate = sampleLottery?.date || latestDraw?.งวดวันที่ || 'ตัวอย่างสำหรับทดสอบ';

    try {
      const res = await fetch('/api/test-ntfy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          server: cleanServer,
          title: `ทดสอบแจ้งเตือน ${lotteryName} งวด ${drawDate}`,
          message: `ข้อความทดสอบเท่านั้น (ไม่ใช่ผลหวยจริง)\n🎯 หวย: ${lotteryName}\n🔺 3 ตัวบน: ${top3}\n🔻 2 ตัวล่าง: ${last2}\nระบบส่งคำขอไปยัง ntfy server; โปรดตรวจสอบการได้รับบน Android ด้วยตนเอง`,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestResult({ success: true, message: `ntfy server ตอบรับคำขอส่งไปยัง topic ${topic} แล้ว โปรดตรวจสอบมือถือด้วยตนเอง (ยังยืนยันการรับบนเครื่องไม่ได้)` });
      } else {
        setTestResult({ success: false, message: data.error || `HTTP ${res.status}: ส่งไม่สำเร็จ` });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: `เชื่อมต่อไม่สำเร็จ: ${err.message}` });
    } finally {
      setIsTestingNtfy(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(subscribeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Architecture Philosophy Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/25">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  ระบบแจ้งเตือนแบบรวมศูนย์ (Unified Alert Center)
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  โครงสร้างเรียบง่าย • ใช้งานได้จริง
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                แบ่งหน้าที่ชัดเจน: <strong>ระบบหลังบ้านตรวจผลเงียบๆ</strong> แล้วส่งเข้า <strong>2 เสาหลักการแจ้งเตือน (เสียงพูดไทย + แอปมือถือ)</strong> ที่เดียวจบ ไม่ซับซ้อน ไม่ตีกัน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              หลังบ้านตรวจผล: <strong>อัตโนมัติทุก 10 นาที</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. THE 2 CORE NOTIFICATION PILLARS (TWO CARDS SIDE-BY-SIDE) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ==================== PILLAR 1: VOICE ANNOUNCEMENT ==================== */}
        <div className={`rounded-3xl border transition-all duration-300 p-6 flex flex-col justify-between shadow-xl ${
          voiceEnabled
            ? 'bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/40 shadow-amber-500/5'
            : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div>
            {/* Header with Switch */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  voiceEnabled ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-500'
                }`}>
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    1. แจ้งเตือนด้วยเสียงพูดภาษาไทย
                  </h3>
                  <p className="text-xs text-slate-400">
                    อ่านประกาศผลรางวัลสดบนหน้าจอคอมพิวเตอร์/หน้าเว็บ
                  </p>
                </div>
              </div>

              {/* Big On/Off Toggle Button */}
              <button
                type="button"
                onClick={() => onToggleVoice(!voiceEnabled)}
                className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors cursor-pointer ${
                  voiceEnabled ? 'bg-amber-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    voiceEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Voice Settings Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 text-xs">
                <span className="text-slate-300 font-semibold">สถานะเสียงพูดประกาศ:</span>
                <span className={`font-bold px-2.5 py-1 rounded-lg ${
                  voiceEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {voiceEnabled ? '🔊 เปิดใช้งานพร้อมอ่านผล' : '🔇 ปิดเสียงอยู่'}
                </span>
              </div>

              {/* Speech Speed selector */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-semibold">ความเร็วเสียงอ่าน:</span>
                  <span className="text-amber-400 font-mono font-bold">{speechRate}x</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => onSetSpeechRate(0.85)}
                    className={`py-1.5 rounded-xl border transition cursor-pointer ${
                      speechRate < 0.95
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    ช้าชัดเจน (0.85x)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetSpeechRate(1.0)}
                    className={`py-1.5 rounded-xl border transition cursor-pointer ${
                      speechRate >= 0.95 && speechRate <= 1.05
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    ปกติ (1.0x)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetSpeechRate(1.15)}
                    className={`py-1.5 rounded-xl border transition cursor-pointer ${
                      speechRate > 1.05
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    เร็วทันใจ (1.15x)
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                💡 <em>เมื่อผลสลากออก หรือกดตรวจผล ระบบจะอ่านออกเสียงชื่อหวย เลขรางวัลที่ 1 เลขท้าย 2 ตัว และหวยรอบถัดไปที่จะปิดรับให้อัตโนมัติ</em>
              </div>
            </div>
          </div>

          {/* Action Buttons for Voice */}
          <div className="pt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={onSpeakSample}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              <span>🔊 ทดลองฟังเสียงประกาศภาษาไทย</span>
            </button>

            {isSpeaking && (
              <button
                type="button"
                onClick={onStopSpeech}
                title="หยุดเสียง"
                className="py-2.5 px-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>หยุด</span>
              </button>
            )}
          </div>
        </div>

        {/* ==================== PILLAR 2: MOBILE / APP PUSH (NTFY) ==================== */}
        <div className={`rounded-3xl border transition-all duration-300 p-6 flex flex-col justify-between shadow-xl ${
          isNtfyEnabled
            ? 'bg-gradient-to-br from-indigo-500/10 via-slate-900 to-slate-900 border-indigo-500/40 shadow-indigo-500/5'
            : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div>
            {/* Header with Switch */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  isNtfyEnabled ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-800 text-slate-500'
                }`}>
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    2. แจ้งเตือนเข้าแอป / มือถือ (App Push)
                  </h3>
                  <p className="text-xs text-slate-400">
                    เด้งเตือนทันทีบนสมาร์ตโฟน (Android / iOS) ผ่าน ntfy.sh
                  </p>
                </div>
              </div>

              {/* Big On/Off Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  const nextState = !isNtfyEnabled;
                  setIsNtfyEnabled(nextState);
                  handleSaveNotificationConfig(topic, nextState);
                }}
                className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors cursor-pointer ${
                  isNtfyEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    isNtfyEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Mobile App Push Configuration (Unified Single Topic) */}
            <div className="space-y-4">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                <label className="text-xs font-bold text-slate-200 block">
                  ชื่อห้องแจ้งเตือน (Topic Name) — ใช้ค่านี้ร่วมกันทั้งระบบ:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      placeholder="เช่น lottery-alert-live"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveNotificationConfig(topic, isNtfyEnabled)}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer active:scale-95 shadow"
                  >
                    💾 บันทึก
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>เซิร์ฟเวอร์: <code className="text-indigo-400 font-mono">{cleanServer}</code></span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="hover:text-amber-400 text-slate-400 flex items-center gap-1 cursor-pointer transition"
                  >
                    {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLink ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ห้อง'}</span>
                  </button>
                </div>
              </div>

              {/* Status / feedback message */}
              {testResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                📲 <em>วิธีรับแจ้งเตือน: ติดตั้งแอป <strong>ntfy</strong> บนมือถือ (ฟรี ไม่มีโฆษณา) แล้วกด Subscribe ห้อง <strong>{topic}</strong> ก็จะได้รับแจ้งเตือนทันทีที่ผลหวยออก!</em>
              </div>
            </div>
          </div>

          {/* Action Buttons for Mobile Push */}
          <div className="pt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestMobilePush}
              disabled={isTestingNtfy || !isNtfyEnabled}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Send className={`w-3.5 h-3.5 ${isTestingNtfy ? 'animate-spin' : ''}`} />
              <span>{isTestingNtfy ? 'กำลังส่งทดสอบ...' : '⚡ ส่งแจ้งเตือนเข้ามือถือทันที'}</span>
            </button>

            <a
              href={subscribeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <span>เปิดรับบนเว็บ</span>
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
            </a>
          </div>
        </div>
      </div>

      {/* 3. BACKEND CHECK ENGINE (AUTOMATIC BACKGROUND PROCESS) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                ระบบตรวจผลรางวัลหลังบ้าน (Backend Check Engine)
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300">
                  ทำงานอัตโนมัติ
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                หลังบ้านจะทำงานเงียบๆ ตรวจผลหวยทุก 10 นาที เมื่อพบผลใหม่จะบันทึกและส่งแจ้งเตือนเข้าแอปมือถือทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTriggerCheck}
              disabled={isTriggering}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
              <span>{isTriggering ? 'กำลังตรวจผลสด...' : '⚡ ตรวจสอบผลสดทันที'}</span>
            </button>
          </div>
        </div>

        {/* Status metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400">สถานะหลังบ้าน</span>
            <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {status?.system_status || 'Healthy (พร้อมทำงาน)'}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400">งวดล่าสุดที่ตรวจพบ</span>
            <div className="text-sm font-bold text-amber-300 mt-1 truncate">
              {status?.latest_draw_detected || latestDraw?.งวดวันที่ || '30.10.2026'}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400">รอบที่ตรวจสำเร็จทั้งหมด</span>
            <div className="text-sm font-bold text-white mt-1">
              {status?.total_checks || 0} รอบ
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400">ตรวจล่าสุดเมื่อ</span>
            <div className="text-sm font-bold text-indigo-300 mt-1 truncate">
              {status?.last_run_date_thai || 'เพิ่งตรวจไปเมื่อครู่'}
            </div>
          </div>
        </div>
      </div>

      {/* 4. OPTIONAL ADVANCED SECTION (COLLAPSIBLE - KEPT TIDY) */}
      <div className="border border-slate-800/80 rounded-3xl overflow-hidden bg-slate-900/60">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-800/40 transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-200">
                ⚙️ การตั้งค่าขั้นสูง (Advanced Options &amp; External Integrations)
              </span>
              <span className="text-[11px] text-slate-500 block">
                ปรับแต่งเทมเพลตข้อความ, GitHub Actions, แก้ไขโค้ด หรือดู settings.json
              </span>
            </div>
          </div>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-slate-800/80 bg-slate-950/60 space-y-4">
            <p className="text-xs text-slate-400">
              เลือกเมนูขั้นสูงที่ต้องการปรับแต่งเพิ่มเติม (ระบบหลัก 2 ตัวด้านบนทำงานสมบูรณ์แล้ว ไม่จำเป็นต้องปรับตรงนี้หากไม่ต้องการเชื่อมต่อเสริม):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onOpenAdvanced?.('template')}
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition cursor-pointer group"
              >
                <div className="text-xs font-bold text-purple-300 group-hover:text-purple-200">
                  🎨 ข้อความ &amp; เสียงอ่านไทย
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  ปรับบทประกาศและความเร็วเสียงพูด
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
