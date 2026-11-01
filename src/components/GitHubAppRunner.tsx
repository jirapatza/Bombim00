import React, { useEffect, useState } from 'react';
import { apiFetch, setDashboardPassword as setApiDashboardPassword } from '../utils/api';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Github,
  KeyRound,
  Play,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface GitHubRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  event: string;
  run_number: number;
  head_branch: string;
}

interface GitHubAppRunnerProps {
  onRefreshStatus?: () => void;
  systemStatus?: any;
  allLotteriesCount?: number;
}

const TARGET_OPTIONS = [
  { value: 'all', label: '🌟 ทุกรายการที่รองรับ' },
  { value: 'vip', label: '⭐ หวย VIP' },
  { value: 'foreign_stock', label: '🌐 หุ้นต่างประเทศ' },
  { value: 'hanoi', label: '🇻🇳 หวยฮานอย' },
  { value: 'lao', label: '🇱🇦 หวยลาว' },
  { value: 'thai_stock', label: '📈 หุ้นไทย' },
  { value: 'government', label: '🇹🇭 สลากกินแบ่งรัฐบาล' },
  { value: 'malay', label: '🇲🇾 หวยมาเลย์' },
];

export function GitHubAppRunner({ onRefreshStatus, allLotteriesCount = 54 }: GitHubAppRunnerProps) {
  const [dashboardPassword, setDashboardPassword] = useState('');
  const [target, setTarget] = useState('all');
  const [forceNotify, setForceNotify] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<GitHubRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const saveDashboardPassword = () => {
    const value = dashboardPassword.trim();
    setDashboardPassword(value);
    setApiDashboardPassword(value);
    setMessage(value ? 'ใช้รหัสผ่านในหน่วยความจำของหน้านี้แล้ว (ไม่บันทึกลงอุปกรณ์)' : 'ลบรหัสผ่านออกจากหน่วยความจำแล้ว');
  };

  const fetchRuns = async () => {
    setIsLoadingRuns(true);
    setError(null);
    try {
      const response = await apiFetch('/api/github/runs', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || `อ่านประวัติการรันไม่สำเร็จ (HTTP ${response.status})`);
      }
      setRuns(Array.isArray(data.workflow_runs) ? data.workflow_runs : []);
    } catch (err: any) {
      setError(err?.message || 'ไม่สามารถอ่านประวัติ GitHub Actions ได้');
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const checkConnection = async () => {
    try {
      const response = await apiFetch('/api/health', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      setApiReady(Boolean(response.ok && data.ok));
      if (!response.ok || !data.ok) setError('API Server ยังไม่พร้อมใช้งาน');
    } catch {
      setApiReady(false);
      setError('ไม่สามารถเชื่อมต่อ API Server ได้');
    }
  };

  useEffect(() => {
    void checkConnection();
    void fetchRuns();
  }, []);

  const dispatchWorkflow = async () => {
    setIsDispatching(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch('/api/github/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: 'lottery.yml',
          inputs: {
            lottery_target: target,
            force_notify: forceNotify ? 'true' : 'false',
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.queued) {
        throw new Error(data.error || `ส่งคำสั่งตรวจผลไม่สำเร็จ (HTTP ${response.status})`);
      }
      setMessage('ส่งคำสั่งไป GitHub Actions แล้ว กำลังรอผลการตรวจสอบ');
      onRefreshStatus?.();
      window.setTimeout(() => { void fetchRuns(); }, 2500);
    } catch (err: any) {
      setError(err?.message || 'ส่งคำสั่งตรวจผลไม่สำเร็จ');
    } finally {
      setIsDispatching(false);
    }
  };

  const formatTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('th-TH');
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-slate-950 via-purple-950/40 to-slate-900 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">GitHub Actions Runner</h2>
              <p className="text-xs text-slate-400">ระบบตรวจผลทำงานบน GitHub Actions เพียงจุดเดียว ไม่มีตัวตรวจซ้ำบน Render</p>
            </div>
          </div>
          <a
            href="https://github.com/jirapatza/Bombim00/actions/workflows/lottery.yml"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-200 hover:bg-purple-500/20"
          >
            เปิด Workflow <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <KeyRound className="w-4 h-4 text-amber-400" />
            รหัสผ่าน Dashboard
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={dashboardPassword}
              onChange={(event) => setDashboardPassword(event.target.value)}
              placeholder="กรอกรหัส DASH_PASSWORD ที่ตั้งไว้ใน Render"
              autoComplete="current-password"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={saveDashboardPassword}
              className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400"
            >
              ใช้รหัสผ่านนี้
            </button>
          </div>
          <p className="text-[11px] text-slate-500">รหัสผ่านอยู่ในหน่วยความจำของหน้านี้เท่านั้น ไม่บันทึกลงอุปกรณ์หรือ GitHub และต้องกรอกใหม่เมื่อรีเฟรชหน้า</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${apiReady ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : apiReady === false ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>
            {apiReady ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            API {apiReady ? 'พร้อมใช้งาน' : apiReady === false ? 'ไม่พร้อม' : 'กำลังตรวจสอบ'}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300">Repository: jirapatza/Bombim00</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300">Branch: main</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300">รายการในแคตตาล็อก: {allLotteriesCount}</span>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <Zap className="w-4 h-4 text-amber-400" />
          สั่งตรวจผลหวย
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">กลุ่มหวยที่ต้องการตรวจ</span>
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400"
            >
              {TARGET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-300">
            <input type="checkbox" checked={forceNotify} onChange={(event) => setForceNotify(event.target.checked)} />
            <span>Force Notify — บังคับส่งแจ้งเตือน</span>
          </label>
        </div>
        <button
          type="button"
          onClick={dispatchWorkflow}
          disabled={isDispatching || apiReady === false}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-3 text-sm font-black text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className={`w-4 h-4 ${isDispatching ? 'animate-pulse' : ''}`} />
          {isDispatching ? 'กำลังส่งคำสั่ง...' : 'สั่งตรวจผลผ่าน GitHub Actions'}
        </button>
        {message && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">{message}</p>}
        {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <Activity className="w-4 h-4 text-purple-400" />
            ประวัติการทำงานล่าสุด
          </div>
          <button
            type="button"
            onClick={() => { void fetchRuns(); void checkConnection(); }}
            disabled={isLoadingRuns}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRuns ? 'animate-spin' : ''}`} />
            รีเฟรช
          </button>
        </div>
        {isLoadingRuns ? (
          <div className="flex items-center gap-2 py-5 text-xs text-slate-400"><Clock className="w-4 h-4 animate-pulse" /> กำลังโหลดประวัติ...</div>
        ) : runs.length ? (
          <div className="space-y-2">
            {runs.map((run) => (
              <a key={run.id} href={run.html_url} target="_blank" rel="noreferrer" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 hover:border-purple-500/40">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-100">{run.name} · #{run.run_number}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{formatTime(run.created_at)} · {run.head_branch} · {run.event}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${run.status === 'completed' && run.conclusion === 'success' ? 'bg-emerald-500/10 text-emerald-300' : run.status === 'in_progress' ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>
                  {run.status === 'completed' ? run.conclusion || 'completed' : run.status}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="py-4 text-xs text-slate-500">ยังไม่พบประวัติการรัน หรือ API ยังอ่านข้อมูลไม่ได้</p>
        )}
      </section>
    </div>
  );
}
