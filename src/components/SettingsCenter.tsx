import React, { useState } from 'react';
import {
  Smartphone,
  Palette,
  Github,
  FileCode2,
  Share2,
  Shield,
  Rocket,
  Sliders,
  Settings,
  SlidersHorizontal,
  Layers,
  Sparkles,
  CheckCircle2,
  Bell,
  Zap,
} from 'lucide-react';

import { UnifiedNotificationCenter } from './UnifiedNotificationCenter';
import { GitHubAppRunner } from './GitHubAppRunner';
import { ProjectCodeEditor } from './ProjectCodeEditor';
import { MultiChannelDispatcher } from './MultiChannelDispatcher';
import { DeploymentPlaybook } from './DeploymentPlaybook';

interface SettingsCenterProps {
  settings: any;
  onSaveSettings: (newSettings: any) => void;
  rawSettingsJson: string;
  setRawSettingsJson: (json: string) => void;
  onSaveRawSettings: () => void;
  onRefreshData?: () => void;
  status?: any;
  latestDraw?: any;
  allLotteries?: any[];
  onSpeak?: (text: string) => void;
  voiceEnabled?: boolean;
  onToggleVoice?: (enabled: boolean) => void;
  onStopSpeech?: () => void;
  isSpeaking?: boolean;
  onTriggerCheck?: () => void;
  isTriggering?: boolean;
  // Template customization props
  templateProps: {
    templateTitle: string;
    setTemplateTitle: (v: string) => void;
    templateBody: string;
    setTemplateBody: (v: string) => void;
    speechScript: string;
    setSpeechScript: (v: string) => void;
    politeParticle: string;
    setPoliteParticle: (v: string) => void;
    modalTheme: string;
    setModalTheme: (v: string) => void;
    fontSize: string;
    setFontSize: (v: string) => void;
    fontFamily: string;
    setFontFamily: (v: string) => void;
    speechRate: number;
    setSpeechRate: (v: number) => void;
    onSaveTemplate: () => void;
    onApplyPreset: (presetKey: string) => void;
    onTestAnnouncement: () => void;
  };
}

export function SettingsCenter({
  settings,
  onSaveSettings,
  rawSettingsJson,
  setRawSettingsJson,
  onSaveRawSettings,
  onRefreshData,
  status,
  latestDraw,
  allLotteries = [],
  onSpeak,
  voiceEnabled = true,
  onToggleVoice,
  onStopSpeech,
  isSpeaking = false,
  onTriggerCheck,
  isTriggering = false,
  templateProps,
}: SettingsCenterProps) {
  // Default to the unified clean notification architecture
  const [subTab, setSubTab] = useState<
    'unified' | 'template' | 'channels' | 'github' | 'files' | 'playbook' | 'raw'
  >('unified');

  return (
    <div className="space-y-6">
      {/* Header with Sub-tab Navigation */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                ศูนย์จัดการและตั้งค่าระบบ (Settings Center)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                จัดระเบียบใหม่: รวมระบบแจ้งเตือนหลัก <strong>เสียงพูดไทย + แอปมือถือ</strong> ไว้ในที่เดียว ไม่ซ้ำซ้อน ไม่ตีกัน
              </p>
            </div>
          </div>

          <span className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
            ✓ สถาปัตยกรรมรวมศูนย์ (Unified)
          </span>
        </div>

        {/* Sub-tab Navigation Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {/* PRIMARY UNIFIED ALERT TAB */}
          <button
            type="button"
            onClick={() => setSubTab('unified')}
            className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              subTab === 'unified'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.02]'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${subTab === 'unified' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>🔔 ศูนย์แจ้งเตือนหลัก (เสียง &amp; แอปมือถือ)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('template')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'template'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            🎨 ข้อความ &amp; เสียงอ่านไทย
          </button>

          <button
            type="button"
            onClick={() => setSubTab('channels')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'channels'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            🌐 Discord / Telegram
          </button>

          <button
            type="button"
            onClick={() => setSubTab('github')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'github'
                ? 'bg-slate-800 text-amber-300 font-bold border border-amber-500/40 shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            🐙 GitHub Actions
          </button>

          <button
            type="button"
            onClick={() => setSubTab('files')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'files'
                ? 'bg-slate-800 text-amber-300 font-bold border border-amber-500/40 shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            💻 แก้ไขโค้ดโปรเจกต์
          </button>

          <button
            type="button"
            onClick={() => setSubTab('playbook')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'playbook'
                ? 'bg-slate-800 text-amber-300 font-bold border border-amber-500/40 shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            🚀 คู่มือใช้งาน
          </button>

          <button
            type="button"
            onClick={() => setSubTab('raw')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'raw'
                ? 'bg-slate-800 text-amber-300 font-bold border border-amber-500/40 shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            ⚙️ settings.json
          </button>
        </div>
      </div>

      {/* SUB-TAB 0: UNIFIED NOTIFICATION CENTER (STREAMLINED 2-PILLAR ARCHITECTURE) */}
      {subTab === 'unified' && (
        <UnifiedNotificationCenter
          settings={settings}
          onSaveSettings={onSaveSettings}
          voiceEnabled={voiceEnabled}
          onToggleVoice={onToggleVoice || (() => {})}
          onSpeakSample={() => templateProps.onTestAnnouncement()}
          onStopSpeech={onStopSpeech || (() => {})}
          isSpeaking={isSpeaking}
          speechRate={templateProps.speechRate}
          onSetSpeechRate={templateProps.setSpeechRate}
          latestDraw={latestDraw}
          status={status}
          onTriggerCheck={onTriggerCheck}
          isTriggering={isTriggering}
          allLotteries={allLotteries}
          onOpenAdvanced={(tab) => setSubTab(tab as any)}
        />
      )}

      {/* SUB-TAB 1: MESSAGE TEMPLATE & VOICE CUSTOMIZATION */}
      {subTab === 'template' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-400" />
                ปรับแต่งรูปแบบข้อความแจ้งเตือนและเสียงประกาศไทย
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ปรับแต่งบทพูดที่ใช้ประกาศและข้อความแจ้งเตือนผลสลาก
              </p>
            </div>

            <button
              type="button"
              onClick={templateProps.onSaveTemplate}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition active:scale-95"
            >
              💾 บันทึกรูปแบบข้อความ
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  หัวข้อแจ้งเตือน (Notification Title)
                </label>
                <input
                  type="text"
                  value={templateProps.templateTitle}
                  onChange={(e) => templateProps.setTemplateTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  บทพูดประกาศภาษาไทย (Speech Script)
                </label>
                <textarea
                  rows={4}
                  value={templateProps.speechScript}
                  onChange={(e) => templateProps.setSpeechScript(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    คำลงท้ายสุภาพ
                  </label>
                  <select
                    value={templateProps.politeParticle}
                    onChange={(e) => templateProps.setPoliteParticle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="ค่ะ">ค่ะ (ผู้หญิง)</option>
                    <option value="ครับ">ครับ (ผู้ชาย)</option>
                    <option value="">ไม่มีคำลงท้าย</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    ความเร็วเสียงพูด
                  </label>
                  <select
                    value={templateProps.speechRate}
                    onChange={(e) => templateProps.setSpeechRate(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value={0.85}>ช้า ชัดถ้อยชัดคำ (0.85x)</option>
                    <option value={0.95}>ปกติ (0.95x)</option>
                    <option value={1.1}>รวดเร็ว กระชับ (1.1x)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 block">
                  🔊 ทดสอบฟังเสียงประกาศ
                </span>
                <p className="text-[11px] text-slate-400">
                  กดปุ่มด้านล่างเพื่อฟังตัวอย่างเสียงพูดภาษาไทยตามบทพูดที่ตั้งค่าไว้
                </p>
                <button
                  type="button"
                  onClick={templateProps.onTestAnnouncement}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  ทดสอบฟังเสียงประกาศ (1-Click Listen)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: GITHUB APP RUNNER */}
      {subTab === 'github' && (
        <GitHubAppRunner
          onRefreshStatus={onRefreshData}
          systemStatus={status}
          allLotteriesCount={allLotteries?.length || 54}
        />
      )}

      {/* SUB-TAB 3: PROJECT CODE & FILE EDITOR */}
      {subTab === 'files' && (
        <ProjectCodeEditor
          onRefreshProject={onRefreshData}
          defaultRepo={localStorage.getItem('gh_repo') || 'myuser/th-lottery-alert'}
          defaultBranch={localStorage.getItem('gh_branch') || 'main'}
        />
      )}

      {/* SUB-TAB 4: MULTI-CHANNEL DISPATCHER (DISCORD / TELEGRAM) */}
      {subTab === 'channels' && (
        <MultiChannelDispatcher
          settings={settings || {}}
          onSaveSettings={onSaveSettings}
          latestDraw={latestDraw}
          allLotteries={allLotteries}
        />
      )}

      {/* SUB-TAB 5: DEPLOYMENT PLAYBOOK */}
      {subTab === 'playbook' && (
        <DeploymentPlaybook />
      )}

      {/* SUB-TAB 6: RAW SETTINGS.JSON */}
      {subTab === 'raw' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                แก้ไขไฟล์คอนฟิกดิบ (config/settings.json)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ปรับแต่งค่าตัวกรองและช่องทางการส่งข้อมูลโดยตรงในรูปแบบ JSON
              </p>
            </div>

            <button
              type="button"
              onClick={onSaveRawSettings}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition active:scale-95"
            >
              💾 บันทึก settings.json
            </button>
          </div>

          <textarea
            rows={18}
            value={rawSettingsJson}
            onChange={(e) => setRawSettingsJson(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-amber-300 focus:outline-none focus:border-amber-500 leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
