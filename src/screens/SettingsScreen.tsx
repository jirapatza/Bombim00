import React, { useState } from 'react';
import {
  Star,
  Plus,
  X,
  Volume2,
  VolumeX,
  Play,
  Bell,
  Save,
  CloudSync,
  Activity,
  Check,
} from 'lucide-react';
import { AppSettings, SystemStatus } from '../types/lottery';
import { ThaiTtsService } from '../utils/thaiTts';

interface Props {
  settings: AppSettings;
  status: SystemStatus;
  watchedNumbers: string[];
  isVoiceEnabled: boolean;
  onToggleVoice: () => void;
  onAddWatchedNumber: (num: string) => void;
  onRemoveWatchedNumber: (num: string) => void;
  onUpdateNtfy: (server: string, topic: string, priority: string) => void;
}

export const SettingsScreen: React.FC<Props> = ({
  settings,
  status,
  watchedNumbers,
  isVoiceEnabled,
  onToggleVoice,
  onAddWatchedNumber,
  onRemoveWatchedNumber,
  onUpdateNtfy,
}) => {
  const [newNum, setNewNum] = useState('');
  const [ntfyServer, setNtfyServer] = useState(settings.ntfy.server);
  const [ntfyTopic, setNtfyTopic] = useState(settings.ntfy.topic);
  const [ntfyPriority, setNtfyPriority] = useState(settings.ntfy.priority);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleAddNumber = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newNum.replace(/\D/g, '').trim();
    if (clean) {
      onAddWatchedNumber(clean);
      setNewNum('');
    }
  };

  const handleSaveNtfy = () => {
    onUpdateNtfy(ntfyServer, ntfyTopic, ntfyPriority);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleTestTts = () => {
    ThaiTtsService.speak(
      'ประกาศผลสลากกินแบ่งรัฐบาล รางวัลที่หนึ่ง สอง สอง สี่ เลขท้ายสองตัว แปด ห้า ครับ'
    );
  };

  const dataSources = [
    { name: 'สำนักงานสลากกินแบ่งรัฐบาล (GLO Official)', active: true },
    { name: 'ThaiLottoAPI (หุ้น / VIP / ลาว)', active: true },
    { name: 'RANLOTTO Public API (ไทยสำรอง)', active: true },
    { name: 'LotteryChecks API', active: true },
    { name: 'Sanook / Pholhuay Fallback', active: false },
  ];

  return (
    <div className="space-y-4 pb-20">
      {/* Watched Numbers Section */}
      <div className="rounded-2xl border border-amber-500/30 bg-slate-900 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-md">
            <Star className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              เลขนำโชคที่คุณเฝ้าดู (Watched Numbers)
            </h3>
            <p className="text-xs text-slate-400">
              ระบบจะแจ้งเตือนและเน้นสีเป็นพิเศษเมื่อออกผลรางวัล
            </p>
          </div>
        </div>

        {/* Existing Number Chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {watchedNumbers.map((num) => (
            <span
              key={num}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1 font-mono-numbers text-xs font-bold text-slate-950 shadow-sm"
            >
              {num}
              <button
                type="button"
                onClick={() => onRemoveWatchedNumber(num)}
                className="rounded-full p-0.5 hover:bg-black/20 text-slate-950"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        {/* Add Number Row */}
        <form onSubmit={handleAddNumber} className="mt-4 flex gap-2.5">
          <input
            type="text"
            value={newNum}
            onChange={(e) => setNewNum(e.target.value.replace(/\D/g, ''))}
            data-testid="add_watched_number_input"
            placeholder="ใส่เลข 2 ตัว หรือ 3 ตัว..."
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono-numbers"
          />
          <button
            type="submit"
            disabled={!newNum.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            เพิ่ม
          </button>
        </form>
      </div>

      {/* Voice TTS Settings */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                isVoiceEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {isVoiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                ระบบเสียงอ่านผลรางวัล (TTS)
              </h3>
              <p className="text-xs text-slate-400">
                {isVoiceEnabled ? 'เปิดใช้งานเสียงอ่านผลภาษาไทย' : 'ปิดเสียงอยู่'}
              </p>
            </div>
          </div>

          <button
            onClick={onToggleVoice}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isVoiceEnabled ? 'bg-amber-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                isVoiceEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {isVoiceEnabled && (
          <button
            onClick={handleTestTts}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-amber-400 hover:bg-slate-700 transition-colors"
          >
            <Play className="h-4 w-4" />
            ทดสอบเสียงอ่านตัวอย่าง
          </button>
        )}
      </div>

      {/* Push Notifications (ntfy) Settings */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg space-y-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-400 text-slate-950 shadow-md">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              การแจ้งเตือน Push Notification (ntfy)
            </h3>
            <p className="text-xs text-slate-400">เชื่อมต่อเซิร์ฟเวอร์แจ้งเตือนผลหวยสด</p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          <div>
            <label className="text-slate-400 font-medium block mb-1">Server URL</label>
            <input
              type="text"
              value={ntfyServer}
              onChange={(e) => setNtfyServer(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono-numbers"
            />
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">Topic Channel</label>
            <input
              type="text"
              value={ntfyTopic}
              onChange={(e) => setNtfyTopic(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono-numbers"
            />
          </div>
        </div>

        <button
          onClick={handleSaveNtfy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:bg-amber-400 transition-colors"
        >
          {savedSuccess ? (
            <>
              <Check className="h-4 w-4" />
              บันทึกการตั้งค่าสำเร็จ!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              บันทึกการตั้งค่า
            </>
          )}
        </button>
      </div>

      {/* Data Sources Status */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-400 text-slate-950 shadow-md">
            <CloudSync className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              สถานะแหล่งข้อมูล (Data Sources)
            </h3>
            <p className="text-xs text-slate-400">ความพร้อมและลำดับความสำคัญของ API</p>
          </div>
        </div>

        <div className="space-y-2">
          {dataSources.map((ds) => (
            <div
              key={ds.name}
              className="flex items-center justify-between rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs"
            >
              <span className="text-slate-200 truncate pr-2">{ds.name}</span>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                  ds.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {ds.active ? 'พร้อมใช้งาน' : 'สแตนด์บาย'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Diagnostics & System Health */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg space-y-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h3 className="text-base font-bold text-slate-100">ข้อมูลสถานะระบบ (Diagnostics)</h3>
        </div>
        <p className="text-slate-300">
          • สถานะระบบ:{' '}
          <span className="font-bold text-emerald-400">
            {status.system_status} (พร้อมทำงาน)
          </span>
        </p>
        <p className="text-slate-300">
          • ตรวจสอบแล้วทั้งหมด:{' '}
          <span className="font-mono-numbers font-bold text-slate-100">
            {status.total_checks} ครั้ง
          </span>
        </p>
        <p className="text-slate-300 truncate">
          • แหล่งข้อมูลล่าสุด:{' '}
          <span className="text-slate-100">{status.last_source_used}</span>
        </p>
        <p className="text-slate-300">
          • อัปเดตล่าสุด:{' '}
          <span className="font-bold text-amber-400">
            {status.last_run_date_thai || '03/11/2026 01:43:47 น.'}
          </span>
        </p>
      </div>
    </div>
  );
};
