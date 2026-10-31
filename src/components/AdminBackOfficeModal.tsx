import React, { useState } from 'react';
import {
  X,
  Settings,
  Bell,
  Shield,
  Activity,
  Github,
  Search,
  Smartphone,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Send,
  Zap,
  Flame,
  Radio,
  FileCode2,
  Database,
  Cpu,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

import { SettingsCenter } from './SettingsCenter';
import { SystemMonitorKiosk } from './SystemMonitorKiosk';
import { GitHubAppRunner } from './GitHubAppRunner';
import { DataAccuracyCenter } from './DataAccuracyCenter';
import { AppDownloadModal } from './AppDownloadModal';

interface AdminBackOfficeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: any;
  onSaveSettings: (newSettings: any) => void;
  status: any;
  latestDraw: any;
  allLotteries: any[];
  voiceEnabled: boolean;
  onToggleVoice: (v: boolean) => void;
  onStopSpeech: () => void;
  isSpeaking: boolean;
  onTriggerCheck: () => void;
  isTriggering: boolean;
  onRefreshData: () => void;
  templateProps: any;
  onOpenAppDownload: () => void;
}

export const AdminBackOfficeModal: React.FC<AdminBackOfficeModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  status,
  latestDraw,
  allLotteries,
  voiceEnabled,
  onToggleVoice,
  onStopSpeech,
  isSpeaking,
  onTriggerCheck,
  isTriggering,
  onRefreshData,
  templateProps,
  onOpenAppDownload,
}) => {
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<
    'notifications' | 'filter_dedup' | 'monitor' | 'runner' | 'accuracy' | 'app_info'
  >('filter_dedup');

  // Purge / Cleanup state
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurgeHistory = async () => {
    setIsCleaning(true);
    setCleanMessage(null);
    try {
      const res = await fetch('/api/lotteries/cleanup-history', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCleanMessage(`✅ ${data.message} (ลบไปแล้ว ${data.removedCount} รายการ, คงเหลือ ${data.totalAfter} งวดมาตรฐาน)`);
        onRefreshData();
      } else {
        setCleanMessage(`❌ ไม่สามารถล้างข้อมูลได้: ${data.error}`);
      }
    } catch (err: any) {
      setCleanMessage(`❌ เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const navItems = [
    {
      id: 'filter_dedup' as const,
      label: 'คัดกรองหวย & ป้องกันแจ้งซ้ำ',
      sublabel: 'แก้ปัญหา LIW / ยี่กี / ส่งซ้ำ 3 รอบ',
      icon: Shield,
      badge: 'แก้ไขแล้ว',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'notifications' as const,
      label: 'ช่องทางแจ้งเตือน',
      sublabel: 'ntfy, Discord, Telegram, Webhook',
      icon: Bell,
    },
    {
      id: 'monitor' as const,
      label: 'สุขภาพระบบ & ซ่อมแซมอัตโนมัติ',
      sublabel: 'System Monitor & Self-Healing',
      icon: Activity,
    },
    {
      id: 'runner' as const,
      label: 'สั่งรันตรวจผล & GitHub Actions',
      sublabel: 'จำลองสคริปต์ & Workflow Dispatch',
      icon: Github,
    },
    {
      id: 'accuracy' as const,
      label: 'ตรวจสอบความแม่นยำ AI',
      sublabel: 'Google Search Grounding & Voice',
      icon: Search,
    },
    {
      id: 'app_info' as const,
      label: 'ติดตั้งแอป & ข้อมูลระบบ',
      sublabel: 'Android APK / PWA / เวอร์ชั่นระบบ',
      icon: Smartphone,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[92vh] max-h-[900px] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 font-black">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  ระบบหลังบ้าน &amp; ตั้งค่าควบคุมระบบ
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Control &amp; Diagnostics Center
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                ศูนย์จัดการสำหรับผู้ดูแลระบบ ตรวจสอบข้อผิดพลาด ปรับตั้งค่าการแจ้งเตือน และแก้ไขปัญหาความซ้ำซ้อน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 cursor-pointer active:scale-95"
              title="ปิดหน้าต่างหลังบ้าน"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Sidebar + Right Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-900/60">
          
          {/* Sub-menu Sidebar */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 p-3 sm:p-4 bg-slate-950/60 overflow-y-auto no-scrollbar space-y-2 shrink-0">
            <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>เมนูย่อยระบบหลังบ้าน</span>
              <span className="text-[11px] text-amber-400/90 font-medium">6 รายการ</span>
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeAdminSubTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveAdminSubTab(item.id)}
                  className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                      isSelected ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-sm sm:text-base truncate">{item.label}</span>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{item.sublabel}</p>
                  </div>
                </button>
              );
            })}

            {/* Quick System Action Card */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Zap className="w-4 h-4" />
                <span>คำสั่งด่วนผู้ดูแลระบบ</span>
              </div>
              <p className="text-xs text-slate-400">
                สั่งตรวจผลหวยทันที หรือล้างแคชข้อมูลที่ไม่ต้องการ
              </p>
              <div className="pt-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onTriggerCheck}
                  disabled={isTriggering}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isTriggering ? 'animate-spin' : ''}`} />
                  <span>{isTriggering ? 'กำลังตรวจผล...' : '▶️ ตรวจผลหวยเดี๋ยวนี้'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

            {/* ================= SUB-TAB 1: FILTER & ANTI-DUPLICATE SHIELD ================= */}
            {activeAdminSubTab === 'filter_dedup' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                
                {/* Header Banner */}
                <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white">
                        ระบบคัดกรองหวย &amp; ป้องกันการแจ้งเตือนซ้ำ (Smart Deduplication Shield)
                      </h3>
                      <p className="text-sm text-slate-300 mt-1">
                        ชี้แจงสาเหตุหวยแปลกปลอม (เช่น LIW), ปัญหาแจ้งซ้ำ 3 รอบ และเครื่องมือทำความสะอาดข้อมูล
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Explanation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: LIW Origin */}
                  <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                      <Info className="w-5 h-5" />
                      <h4>หวย LIW รอบ 17:15 มาจากไหน?</h4>
                    </div>
                    <div className="text-sm text-slate-300 leading-relaxed space-y-2">
                      <p>
                        <strong>สาเหตุ:</strong> มาจากฟีด API ภายนอก (<code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">ThaiLottoAPI</code>) ซึ่งมีบริการส่งผลหวยยี่กี / ปิงปอง (LIW) ตลอด 24 ชั่วโมง รอบละ 15 นาที โดยที่ระบบเวอร์ชันก่อนหน้าไม่ได้ล็อกรายการหวยไว้ ทำให้ดึงผลหวย LIW ปนเข้ามาในระบบ
                      </p>
                      <p className="text-emerald-400 font-medium">
                        ✓ <strong>การแก้ไข:</strong> ระบบได้เพิ่ม Whitelist บล็อกหมวด <code className="text-white bg-slate-800 px-1 rounded">liw</code>, <code className="text-white bg-slate-800 px-1 rounded">pingpong</code>, <code className="text-white bg-slate-800 px-1 rounded">yeekee</code> และจำกัดเฉพาะ 54 หวยมาตรฐานที่ผู้ใช้กำหนดไว้เท่านั้น
                      </p>
                    </div>
                  </div>

                  {/* Card 2: 3-Times Duplicate & Category Separation */}
                  <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <h4>ส่งซ้ำ 3 รอบ และ &quot;แยกหมวด&quot; คืออะไร?</h4>
                    </div>
                    <div className="text-sm text-slate-300 leading-relaxed space-y-2">
                      <p>
                        <strong>&quot;แยกหมวด&quot;:</strong> คือฟังก์ชันดึงหวยหุ้นแยกตาม 4 กลุ่ม (หุ้นปกติ, หุ้น VIP, หุ้นพิเศษ, หุ้น VISA) จากเว็บผลหวย
                      </p>
                      <p>
                        <strong>ทำไมถึงส่งซ้ำ 3 รอบ:</strong> เนื่องจากระบบก่อนหน้านี้นำคำว่า &quot;หมวดหวย&quot; และรูปแบบวันที่ที่เขียนไม่เหมือนกัน (เช่น 31.10.2026 vs 31 ตุลาคม 2569) มาร่วมตรวจสอบความซ้ำซ้อน ทำให้มองว่าเป็นคนละงวดกัน จึงส่งแจ้งเตือนซ้ำทุก 10 นาที
                      </p>
                      <p className="text-emerald-400 font-medium">
                        ✓ <strong>การแก้ไข:</strong> เปลี่ยนเป็น <strong>Smart Fingerprint</strong> ตรวจสอบที่ตัวเลขรางวัลจริง (3 ตัวบน + 2 ตัวล่าง) และแปลงงวดวันที่เป็นมาตรฐานเดียวกัน ตัดหมวดหวยออกจากการเทียบผล ทำให้บล็อกการส่งซ้ำได้อย่างแม่นยำ 100%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Purge Action Box */}
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-950/80 border border-amber-500/30 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold text-white flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-rose-400" />
                        <span>ทำความสะอาดประวัติผลหวย (Purge LIW &amp; Duplicates)</span>
                      </h4>
                      <p className="text-sm text-slate-400 mt-1">
                        คลิกปุ่มนี้เพื่อลบหวย LIW / ปิงปอง และผลที่บันทึกซ้ำซ้อนออกจากประวัติระบบทันที
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handlePurgeHistory}
                      disabled={isCleaning}
                      className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm sm:text-base flex items-center gap-2 shadow-lg shadow-rose-600/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <Trash2 className={`w-5 h-5 ${isCleaning ? 'animate-spin' : ''}`} />
                      <span>{isCleaning ? 'กำลังล้างประวัติ...' : '⚡ ลบหวย LIW & ผลซ้ำออกจากประวัติ'}</span>
                    </button>
                  </div>

                  {cleanMessage && (
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 text-sm font-bold text-emerald-300 animate-in fade-in">
                      {cleanMessage}
                    </div>
                  )}
                </div>

                {/* Whitelisted Catalog Overview */}
                <div className="p-5 rounded-3xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>รายการ 54 หวยมาตรฐานที่ระบบรองรับ (Whitelist Catalog)</span>
                    </h4>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
                      ✓ ป้องกันหวยนอกระบบ 100%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    เฉพาะหวยในรายการนี้เท่านั้นที่จะได้รับการตรวจสอบผลและส่งแจ้งเตือน:
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300">
                    {allLotteries.map((l, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-1.5">
                        <span>{l.flag}</span>
                        <span className="font-medium">{l.name}</span>
                        <span className="text-[10px] text-amber-400/80">({l.drawTimeStr || l.closeTimeStr})</span>
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* ================= SUB-TAB 2: NOTIFICATIONS SETTINGS ================= */}
            {activeAdminSubTab === 'notifications' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <SettingsCenter
                  settings={settings}
                  onSaveSettings={onSaveSettings}
                  status={status}
                  latestDraw={latestDraw}
                  allLotteries={allLotteries}
                  voiceEnabled={voiceEnabled}
                  onToggleVoice={onToggleVoice}
                  onStopSpeech={onStopSpeech}
                  isSpeaking={isSpeaking}
                  onTriggerCheck={onTriggerCheck}
                  isTriggering={isTriggering}
                  templateProps={templateProps}
                />
              </div>
            )}

            {/* ================= SUB-TAB 3: SYSTEM HEALTH & SELF-HEALING ================= */}
            {activeAdminSubTab === 'monitor' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Activity className="w-5 h-5 text-emerald-400" />
                      ศูนย์ตรวจสอบและซ่อมแซมระบบอัตโนมัติ (Self-Healing Kiosk)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ตรวจวัดความหน่วงของ API แหล่งข้อมูล ตรวจสอบความถูกต้องของไฟล์คอนฟิก และกู้คืนระบบเมื่อเกิดข้อผิดพลาด
                    </p>
                  </div>
                </div>
                <SystemMonitorKiosk />
              </div>
            )}

            {/* ================= SUB-TAB 4: RUNNER & GITHUB ACTIONS ================= */}
            {activeAdminSubTab === 'runner' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Github className="w-5 h-5 text-slate-300" />
                      GitHub Actions &amp; App Runner Simulator
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      สั่งรัน workflow บน GitHub หรือจำลองการรันสคริปต์ตรวจหวยบน Server
                    </p>
                  </div>
                </div>
                <GitHubAppRunner
                  onRefreshStatus={onRefreshData}
                  systemStatus={status}
                  allLotteriesCount={allLotteries.length}
                />
              </div>
            )}

            {/* ================= SUB-TAB 5: ACCURACY CENTER ================= */}
            {activeAdminSubTab === 'accuracy' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Search className="w-5 h-5 text-emerald-400" />
                      ศูนย์ยืนยันความแม่นยำด้วย AI Grounding (Google Search)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ตรวจสอบผลสลากกับแหล่งข้อมูลจริงผ่าน Google Search Grounding ป้องกันผลหลอก
                    </p>
                  </div>
                </div>
                <DataAccuracyCenter
                  allLotteries={allLotteries}
                  onSelectLottery={() => {}}
                />
              </div>
            )}

            {/* ================= SUB-TAB 6: APP INFO & DOWNLOAD ================= */}
            {activeAdminSubTab === 'app_info' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="p-6 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">ติดตั้งแอปพลิเคชันมือถือ &amp; ข้อมูลระบบ</h3>
                      <p className="text-sm text-slate-400">
                        ติดตั้งเป็นแอป Progressive Web App (PWA) บนมือถือ หรือดาวน์โหลด Android APK
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onOpenAppDownload}
                      className="px-6 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-base flex items-center gap-2.5 shadow-lg shadow-purple-600/25 transition cursor-pointer active:scale-95"
                    >
                      <Smartphone className="w-5 h-5 text-amber-300" />
                      <span>📲 เปิดหน้าต่างดาวน์โหลดแอป Android &amp; PWA</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-800 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block">เวอร์ชันระบบ:</span>
                      <span className="font-bold text-white text-sm">v2.1.0 Enterprise</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block">จำนวนหวยที่รองรับ:</span>
                      <span className="font-bold text-emerald-400 text-sm">54 หวยมาตรฐาน</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block">ระบบป้องกันแจ้งซ้ำ:</span>
                      <span className="font-bold text-amber-400 text-sm">Smart Deduplication Active</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};
