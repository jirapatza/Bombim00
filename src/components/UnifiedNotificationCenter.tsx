import React, { useState } from 'react';
import { apiFetch } from '../utils/api';
import { getResultNumbers } from '../utils/lotteryResult';
import {
  Volume2,
  Smartphone,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  ExternalLink,
  Zap,
  Copy,
  Check,
  Cpu,
} from 'lucide-react';

export interface UnifiedNotificationCenterProps {
  settings: any;
  onSaveSettings: (newSettings: any) => Promise<boolean>;
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
}) => {
  // ntfy config
  const ntfyConfig = settings?.channels?.ntfy || settings?.ntfy || {};
  const [topic, setTopic] = useState<string>(ntfyConfig.topic || 'lottery-alert-live');
  const [isNtfyEnabled, setIsNtfyEnabled] = useState<boolean>(ntfyConfig.enabled !== false);
  const [isTestingNtfy, setIsTestingNtfy] = useState<boolean>(false);
  const [ntfyTestResult, setNtfyTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const ntfyServer = ntfyConfig.server || 'https://ntfy.sh';
  const cleanServer = ntfyServer.replace(/\/+$/, '');
  const subscribeUrl = `${cleanServer}/${encodeURIComponent(topic)}`;

  // Save changes to settings for ntfy
  const handleSaveNtfyConfig = async (newTopic: string, enabled: boolean): Promise<boolean> => {
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
    return onSaveSettings(updated);
  };

  // Keep the lottery identity, draw date and result pair from the same record.
  const getTestResult = () => {
    const sampleLottery = allLotteries.find((item) => {
      const { top3, bottom2 } = getResultNumbers(item);
      return Boolean(top3 && bottom2);
    });
    const source = sampleLottery || latestDraw || allLotteries[0] || {};
    const { top3, bottom2 } = getResultNumbers(source);
    return {
      lotteryName: source.name || source.ชื่อหวย || source.หวย || 'ตัวอย่างหวย',
      top3: top3 || '---',
      last2: bottom2 || '--',
      drawDate: source.date || source.งวดวันที่ || source.วันที่จัดรูปแบบ || 'ตัวอย่างสำหรับทดสอบ',
    };
  };

  // Test send to mobile app (ntfy)
  const handleTestMobilePush = async () => {
    setIsTestingNtfy(true);
    setNtfyTestResult(null);

    const { lotteryName, top3, last2, drawDate } = getTestResult();

    try {
      const topicValue = topic.trim();
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(topicValue)) {
        throw new Error('Topic ต้องใช้ตัวอักษรภาษาอังกฤษ ตัวเลข ขีดกลาง หรือขีดล่าง ไม่เกิน 64 ตัว');
      }
      const title = `ทดสอบแจ้งเตือน ${lotteryName} งวด ${drawDate}`;
      const message = `ข้อความทดสอบเท่านั้น (ไม่ใช่ผลหวยจริง)\n🎯 หวย: ${lotteryName}\n🔺 3 ตัวบน: ${top3}\n🔻 2 ตัวล่าง: ${last2}\nระบบส่งคำขอไปยัง ntfy server เรียบร้อย`;

      const res = await apiFetch('/api/test-ntfy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicValue, server: cleanServer, title, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setNtfyTestResult({ success: true, message: `ส่งแจ้งเตือนไปยัง ntfy topic '${topicValue}' สำเร็จเรียบร้อย! 📲` });
      } else {
        throw new Error(data.error || `HTTP ${res.status}: ส่งไม่สำเร็จ`);
      }
    } catch (err: any) {
      setNtfyTestResult({ success: false, message: `เชื่อมต่อไม่สำเร็จ: ${err.message}` });
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
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-green-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/25">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  ระบบแจ้งเตือนหลัก (ntfy Push)
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  เฉพาะช่องทางที่ใช้งานจริง
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                ส่งแจ้งเตือนผ่าน <strong>แอป ntfy บนมือถือ</strong> พร้อมตัวเลือกอ่านผลด้วยเสียงภาษาไทยบนเว็บ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ตรวจผลตามรอบอัตโนมัติ · อาจล่าช้าจากต้นทาง
            </span>
          </div>
        </div>
      </div>

      {/* 2. NTFY PUSH AND WEB VOICE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ==================== MOBILE NTFY PUSH ==================== */}
        <div className={`rounded-3xl border transition-all duration-300 p-5 flex flex-col justify-between shadow-xl ${
          isNtfyEnabled
            ? 'bg-gradient-to-br from-indigo-500/10 via-slate-900 to-slate-900 border-indigo-500/40 shadow-indigo-500/5'
            : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isNtfyEnabled ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-800 text-slate-500'
                }`}>
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    แอปมือถือ (ntfy)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    เด้งเตือนบน Android &amp; iOS
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const nextState = !isNtfyEnabled;
                  if (await handleSaveNtfyConfig(topic, nextState)) setIsNtfyEnabled(nextState);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  isNtfyEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isNtfyEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-2">
                <label className="text-[11px] font-bold text-slate-300 block">
                  ชื่อห้องแจ้งเตือน (Topic):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="lottery-alert-live"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveNtfyConfig(topic, isNtfyEnabled)}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer active:scale-95"
                  >
                    บันทึก
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>เซิร์ฟเวอร์: <code className="text-indigo-400 font-mono">{cleanServer}</code></span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="hover:text-amber-400 text-slate-400 flex items-center gap-1 cursor-pointer transition"
                  >
                    {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLink ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</span>
                  </button>
                </div>
              </div>

              {ntfyTestResult && (
                <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-1.5 ${
                  ntfyTestResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {ntfyTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{ntfyTestResult.message}</span>
                </div>
              )}

              <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
                📲 <em>ติดตั้งแอป <strong>ntfy</strong> บนมือถือ แล้วกด Subscribe ห้อง <strong>{topic}</strong> เพื่อรับผลใหม่ที่ระบบตรวจพบ</em>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestMobilePush}
              disabled={isTestingNtfy || !isNtfyEnabled}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Send className={`w-3.5 h-3.5 ${isTestingNtfy ? 'animate-spin' : ''}`} />
              <span>{isTestingNtfy ? 'กำลังส่ง...' : '⚡ ทดสอบเข้ามือถือ'}</span>
            </button>
            <a
              href={subscribeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
            </a>
          </div>
        </div>

        {/* ====================  THAI VOICE ANNOUNCEMENT ==================== */}
        <div className={`rounded-3xl border transition-all duration-300 p-5 flex flex-col justify-between shadow-xl ${
          voiceEnabled
            ? 'bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/40 shadow-amber-500/5'
            : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  voiceEnabled ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-500'
                }`}>
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    เสียงพูดภาษาไทย (TTS)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    อ่านประกาศรางวัลภาษาไทยแท้
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggleVoice(!voiceEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  voiceEnabled ? 'bg-amber-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    voiceEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-300 font-semibold">ความเร็วเสียงอ่าน:</span>
                  <span className="text-amber-400 font-mono font-bold">{speechRate}x</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => onSetSpeechRate(0.85)}
                    className={`py-1.5 rounded-lg border transition cursor-pointer ${
                      speechRate < 0.95
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    ช้า (0.85x)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetSpeechRate(1.0)}
                    className={`py-1.5 rounded-lg border transition cursor-pointer ${
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
                    className={`py-1.5 rounded-lg border transition cursor-pointer ${
                      speechRate > 1.05
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    เร็ว (1.15x)
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
                🗣️ <em>สะกดตัวเลขภาษาไทย (ศูนย์ หนึ่ง สอง สาม...) และอ่านคำลงท้าย (ครับ/ค่ะ) ชัดเจนทุกงวด</em>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={onSpeakSample}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              <span>🔊 ทดลองฟังเสียงไทย</span>
            </button>
            {isSpeaking && (
              <button
                type="button"
                onClick={onStopSpeech}
                title="หยุดเสียง"
                className="py-2.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. BACKEND ENGINE STATUS & QUICK TRIGGER */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                ระบบตรวจผลรางวัลหลังบ้าน (Backend Engine)
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300">
                  ทำงานอัตโนมัติ
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                เมื่อระบบตรวจพบผลใหม่ จะส่งผ่านช่องทางที่เปิดไว้ เสียงพูดทำงานขณะเปิดหน้าเว็บและอนุญาตเสียงแล้ว
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400">สถานะระบบ</span>
            <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {status?.system_status || 'Healthy (พร้อมใช้งาน)'}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400">งวดล่าสุด</span>
            <div className="text-sm font-bold text-amber-300 mt-1 truncate">
              {status?.latest_draw_detected || latestDraw?.งวดวันที่ || 'ยังไม่มีข้อมูล'}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400">รอบตรวจแล้ว</span>
            <div className="text-sm font-bold text-white mt-1">
              {status?.total_checks || 0} รอบ
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400">ตรวจล่าสุด</span>
            <div className="text-sm font-bold text-indigo-300 mt-1 truncate">
              {status?.last_run_date_thai || 'เพิ่งตรวจไปเมื่อครู่'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
