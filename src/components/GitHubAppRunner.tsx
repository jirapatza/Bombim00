import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import {
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Github,
  Terminal,
  ExternalLink,
  Check,
  Clock,
  Key,
  Activity,
  Cpu,
  RefreshCw,
  Zap,
  Info,
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
  actor?: {
    login: string;
    avatar_url: string;
  };
}

const getApiBase = () => {
  const custom = localStorage.getItem('cf_worker_url');
  if (custom && custom.trim() && custom !== 'https://bombim00-github-api.jirapatcip2557.workers.dev') {
    return custom.replace(/\/+$/, '');
  }
  return '';
};

interface GitHubAppRunnerProps {
  onRefreshStatus?: () => void;
  systemStatus?: any;
  allLotteriesCount?: number;
}

export function GitHubAppRunner({ onRefreshStatus, systemStatus, allLotteriesCount = 54 }: GitHubAppRunnerProps) {
  const [subTab, setSubTab] = useState<'runner' | 'runs'>('runner');

  // Persist only non-secret repository preferences.
  const [repo, setRepo] = useState<string>(() => localStorage.getItem('gh_repo') || 'jirapatza/Bombim00');
  const [branch, setBranch] = useState<string>(() => localStorage.getItem('gh_branch') || 'main');
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [workflowFile, setWorkflowFile] = useState<string>('lottery.yml');

  // Connection & Runner health state
  const [connectionStatus, setConnectionStatus] = useState<{
    checking: boolean;
    githubConnected: boolean;
    serverConnected: boolean;
    repoName: string;
    totalRuns: number;
    lastChecked?: string;
  }>({
    checking: false,
    githubConnected: false,
    serverConnected: false,
    repoName: 'jirapatza/Bombim00',
    totalRuns: 0,
  });

  // Dispatch parameters
  const [forceNotify, setForceNotify] = useState<boolean>(false);
  const [lotteryTarget, setLotteryTarget] = useState<string>('all');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  // Local simulation runner
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);

  // Runs history
  const [runs, setRuns] = useState<GitHubRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState<boolean>(false);
  const [runsError, setRunsError] = useState<string | null>(null);

  const checkConnectionStatus = async () => {
    setConnectionStatus((prev) => ({ ...prev, checking: true }));
    try {
      let ghOk = false;
      let count = 0;
      try {
        const ghRes = await fetch(`https://api.github.com/repos/${repo}`, {
          headers: { 'User-Agent': 'LotteryAlert/1.0' },
        });
        if (ghRes.ok) {
          ghOk = true;
          const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=1`, {
            headers: { 'User-Agent': 'LotteryAlert/1.0' },
          }).catch(() => null);
          if (runsRes && runsRes.ok) {
            const rData = await runsRes.json();
            count = Number.isFinite(rData.total_count) ? rData.total_count : 0;
          }
        }
      } catch {
        ghOk = false;
      }

      let srvOk = false;
      try {
        const srvRes = await apiFetch(`${getApiBase()}/api/status`);
        if (srvRes.ok) srvOk = true;
      } catch {
        srvOk = false;
      }

      setConnectionStatus({
        checking: false,
        githubConnected: ghOk,
        serverConnected: srvOk,
        repoName: repo,
        totalRuns: count,
        lastChecked: new Date().toLocaleTimeString('th-TH'),
      });
    } catch {
      setConnectionStatus((prev) => ({ ...prev, checking: false }));
    }
  };

  useEffect(() => {
    localStorage.removeItem('gh_token');
  }, []);

  // Refresh the selected repository and workflow without loading removed editors.
  useEffect(() => {
    checkConnectionStatus();
    fetchRuns();
  }, [repo, workflowFile]);

  // Dispatch workflow run on GitHub
  const handleDispatchWorkflow = async () => {
    if (!repo) {
      setDispatchResult({ error: 'กรุณากรอกชื่อ GitHub Repository เช่น username/lottery-alert' });
      return;
    }

    setIsDispatching(true);
    setDispatchResult(null);

    // Save non-secret connection preferences
    localStorage.setItem('gh_repo', repo);
    localStorage.setItem('gh_branch', branch);
    // Do not persist the GitHub credential in browser storage.

    try {
      const inputs = workflowFile === 'lottery.yml' ? {
        force_notify: forceNotify ? 'true' : 'false',
        lottery_target: lotteryTarget,
      } : {};

      const res = await apiFetch(`${getApiBase()}/api/github/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo,
          branch,
          token,
          workflow: workflowFile,
          inputs,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDispatchResult({ success: true, message: data.message });
        // Automatically switch to runs tab or refresh runs after a brief moment
        setTimeout(() => {
          fetchRuns();
        }, 2000);
      } else {
        setDispatchResult({ error: data.error || 'Failed to dispatch workflow' });
      }
    } catch (err: any) {
      setDispatchResult({ error: err.message || 'Network error' });
    } finally {
      setIsDispatching(false);
    }
  };

  // Fetch recent GitHub Actions runs
  const fetchRuns = async () => {
    if (!repo) return;
    setIsLoadingRuns(true);
    setRunsError(null);

    try {
      const res = await apiFetch(`${getApiBase()}/api/github/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo,
          token,
          workflow: workflowFile,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRuns(data.workflow_runs || []);
      } else {
        setRunsError(data.error || 'ไม่สามารถดึงข้อมูล Runs จาก GitHub ได้');
      }
    } catch (err: any) {
      setRunsError(err.message || 'Network error');
    } finally {
      setIsLoadingRuns(false);
    }
  };

  // Simulate local runner execution
  const handleSimulateRunner = async () => {
    setIsSimulating(true);
    setSimulationLogs(['🚀 กำลังเตรียมสภาพแวดล้อม Python 3.10/3.11 และอ่าน settings.json...']);

    try {
      const res = await apiFetch(`${getApiBase()}/api/simulate-runner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, forceNotify, lotteryTarget }),
      });

      const data = await res.json();
      const output = [data.stdout, data.stderr].filter(Boolean).join('\n');
      const lines = output.split('\n').filter((line: string) => line.trim().length > 0);
      if (!res.ok || !data.success) {
        lines.push(`❌ ผิดพลาด: ${data.error || data.message || 'ไม่สามารถรันการตรวจสอบได้'}`);
      } else {
        lines.push(data.message || 'ตรวจสอบผลหวยเสร็จสิ้น');
      }
      setSimulationLogs(lines);
      onRefreshStatus?.();
    } catch (err: any) {
      setSimulationLogs((prev) => [...prev, `❌ ผิดพลาด: ${err.message}`]);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Headline */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30 rounded-3xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shadow-lg shadow-purple-600/20">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-wide">
                  GitHub Actions Runner
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  รันบน GitHub โดยตรง
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                สั่งรันระบบตรวจผลหวยบน GitHub Actions หรือบนเซิร์ฟเวอร์ และตรวจสอบประวัติการทำงานกับผลลัพธ์การรันจากหน้าจอนี้
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateRunner}
              disabled={isSimulating}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              <Cpu className={`w-4 h-4 ${isSimulating ? 'animate-spin' : 'text-amber-400'}`} />
              {isSimulating ? 'กำลังทดสอบรัน...' : '💻 รันตรวจผลบน Server ทันที'}
            </button>
            <a
              href={`https://github.com/${repo}/actions`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-md"
            >
              <ExternalLink className="w-4 h-4 text-purple-400" />
              เปิด GitHub Actions จริง
            </a>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-2 mt-6 border-t border-slate-800/80 pt-4 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setSubTab('runner')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              subTab === 'runner'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            1. สั่งรันบน GitHub (Dispatch Runner)
          </button>

          <button
            onClick={() => {
              setSubTab('runs');
              fetchRuns();
            }}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              subTab === 'runs'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            2. ประวัติการรันสด (Live Workflow Runs)
          </button>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: DISPATCH RUNNER                                              */}
      {/* ========================================================================= */}
      {subTab === 'runner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Connection Status Dashboard Card */}
            <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                    <Github className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>คลัง GitHub: <code className="text-purple-300 font-mono">{repo}</code></span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                        connectionStatus.githubConnected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        <CheckCircle2 className={`w-3 h-3 ${connectionStatus.githubConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
                        {connectionStatus.checking ? 'กำลังตรวจสอบ GitHub...' : connectionStatus.lastChecked ? (connectionStatus.githubConnected ? 'เชื่อมต่อแล้ว (Public Repo)' : 'ยังเชื่อมต่อ GitHub ไม่ได้') : 'ยังไม่ได้ตรวจสอบ GitHub'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2.5">
                      <span>สาขา: <strong className="text-slate-200 font-mono">{branch}</strong></span>
                      <span>•</span>
                      <span>ประวัติการรันจริงบน GitHub: <strong className="text-amber-300 font-mono">{connectionStatus.totalRuns} ครั้ง</strong></span>
                      <span>•</span>
                      <span className={`flex items-center gap-1 ${connectionStatus.serverConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus.serverConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                        {connectionStatus.checking ? 'กำลังตรวจสอบ API Server...' : connectionStatus.lastChecked ? (connectionStatus.serverConnected ? 'API Server: เชื่อมต่อแล้ว' : 'API Server: ยังไม่เชื่อมต่อ') : 'API Server: ยังไม่ได้ตรวจสอบ'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={checkConnectionStatus}
                    disabled={connectionStatus.checking}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs rounded-xl font-medium cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${connectionStatus.checking ? 'animate-spin text-purple-400' : ''}`} />
                    เช็คการเชื่อมต่อสด
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-400" />
                  การเชื่อมต่อกับ GitHub Repository
                </span>
                <span className="text-[11px] text-slate-400">บันทึกเฉพาะชื่อ Repository และ Branch; ไม่บันทึก PAT</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    GitHub Repository (owner/repo) *
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น jirapatza/Bombim00"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>GitHub Personal Access Token (PAT)</span>
                    <span className="text-[10px] text-purple-400 font-normal">(ใช้เมื่อเซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GITHUB_TOKEN)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-[11px] text-slate-400 hover:text-purple-300 cursor-pointer"
                  >
                    {showToken ? 'ซ่อนรหัส' : 'แสดงรหัส'}
                  </button>
                </div>
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder="เว้นว่างหากเซิร์ฟเวอร์ตั้งค่า GITHUB_TOKEN ไว้แล้ว"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 mt-1 text-[11px] text-slate-400">
                  <span>💡 หากไม่มี PAT Token: สามารถกดปุ่ม <strong>"💻 รันตรวจผลบน Server ทันที"</strong> ด้านล่างเพื่อรันสคริปต์ตรวจหวยได้ (ต้องใช้เซิร์ฟเวอร์ที่รองรับ Python)</span>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,workflow"
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <span>สร้าง PAT Token</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Target Workflow Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block flex items-center justify-between">
                  <span>เลือก Workflow การทำงานที่ต้องการรัน (Target Workflow) *</span>
                  <span className="text-[10px] text-amber-400 font-mono">.github/workflows/{workflowFile}</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setWorkflowFile('lottery.yml')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1 ${
                      workflowFile === 'lottery.yml'
                        ? 'bg-purple-950/50 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Zap className={`w-3.5 h-3.5 ${workflowFile === 'lottery.yml' ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold text-slate-100">lottery.yml</span>
                    </div>
                    <span className="text-[10px] text-slate-400">ตรวจหวย & แจ้งเตือนอัตโนมัติ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkflowFile('runtime-smoke.yml')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1 ${
                      workflowFile === 'runtime-smoke.yml'
                        ? 'bg-purple-950/50 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Activity className={`w-3.5 h-3.5 ${workflowFile === 'runtime-smoke.yml' ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold text-slate-100">runtime-smoke.yml</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Smoke Test CI/CD</span>
                  </button>
                </div>
              </div>

              {/* Workflow Dispatch Inputs */}
              {workflowFile === 'lottery.yml' ? (
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      พารามิเตอร์ส่งเข้ารันบน GitHub Actions (Workflow Inputs)
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                      ฐานข้อมูลจริง: {allLotteriesCount || 54} รายการหวย
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        กลุ่มหวยเป้าหมาย (Lottery Target)
                      </label>
                      <select
                        value={lotteryTarget}
                        onChange={(e) => setLotteryTarget(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 hover:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-medium"
                      >
                        <option value="all">🌟 ทุกรายการที่แหล่งข้อมูลรองรับ (ไม่รวมหวยแม่โขงที่ตัดออก)</option>
                        <option value="vip">⭐ หวยหุ้น VIP & พิเศษ (31 รายการ: นิเคอิ VIP, จีน VIP, ฮั่งเส็ง VIP, รัสเซีย VIP ฯลฯ)</option>
                        <option value="foreign_stock">🌐 หวยหุ้นต่างประเทศรอบปกติ (14 รายการ: นิเคอิ, จีน, ฮั่งเส็ง, ไต้หวัน, เกาหลี, สิงคโปร์ ฯลฯ)</option>
                        <option value="hanoi">🇻🇳 หวยฮานอย (2 รายการในแคตตาล็อกหลัก)</option>
                        <option value="lao">🇱🇦 หวยลาว (3 รายการในแคตตาล็อกหลัก)</option>
                        <option value="thai_stock">📈 หวยหุ้นไทย (SET / ไทยเที่ยง / ไทยเย็น)</option>
                        <option value="government">🇹🇭 สลากกินแบ่งรัฐบาล / ออมสิน / ธ.ก.ส. (3 รายการ)</option>
                        <option value="malay">🇲🇾 หวยมาเลย์ 4D / Magnum</option>
                        <option value="liw">⏱️ หวย LIW (รอบทุก 15 นาที)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 p-2 bg-slate-900/60 rounded-xl border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forceNotify}
                          onChange={(e) => setForceNotify(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                        <span>
                          <strong className="text-amber-400">Force Notify</strong> (บังคับส่งแจ้งเตือนทันที)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Clarification Box: Why 29 previously vs 54+ now */}
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
                    <div className="flex items-center justify-between text-slate-300 font-semibold">
                      <span className="flex items-center gap-1.5 text-amber-300">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        ชี้แจง: ทำไมเดิมข้อความระบุว่ามี 29 รายการ?
                      </span>
                      <span className="text-emerald-400 font-mono font-bold">ปัจจุบันเชื่อมต่อ: 54+ รายการ</span>
                    </div>
                    <p className="leading-relaxed">
                      ข้อความเดิม "29 รายการ" เป็นข้อความตัวอย่าง (placeholder) ในร่างแรกเริ่มของโปรเจกต์ ซึ่งตอนนั้นรวบรวมเฉพาะหุ้นหลักบางตัว แต่ปัจจุบันระบบได้เชื่อมต่อกับฐานข้อมูลจริง <code className="text-amber-300 font-mono">data/all_lotteries.json</code> ครบถ้วนแล้ว <strong>54 รายการ</strong> (หุ้น VIP 31 รายการ, หุ้นต่างประเทศ 14 รายการ, ฮานอย 2+ รายการ, ลาว 3+ รายการ, หุ้นไทย, สลากกินแบ่งรัฐบาล/ออมสิน/ธ.ก.ส. 3 รายการ) และเมื่อสั่งรันสคริปต์ตรวจผลสด จะตรวจจับผลการออกรางวัลได้ถึง <strong>56 รายการ</strong> แบบ Real-time!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/70 border border-cyan-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                    <Activity className="w-4 h-4" />
                    <span>โหมด Smoke Test CI/CD: ตรวจสอบความพร้อมของเซิร์ฟเวอร์</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    รันการทดสอบ Unit Tests และทดสอบการเรียกใช้งาน Python Script และ Vite Build เพื่อให้มั่นใจว่าโค้ดไม่มีข้อผิดพลาด
                  </p>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSimulateRunner}
                  disabled={isSimulating}
                  className="px-5 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 active:scale-95"
                >
                  <Cpu className={`w-4 h-4 ${isSimulating ? 'animate-spin' : 'text-slate-950'}`} />
                  {isSimulating ? 'กำลังรันตรวจผลสด...' : '💻 รันตรวจผลบน Server ทันที'}
                </button>

                <button
                  type="button"
                  onClick={handleDispatchWorkflow}
                  disabled={isDispatching}
                  className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-lg shadow-purple-600/30 flex items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <Play className={`w-4 h-4 ${isDispatching ? 'animate-spin' : ''}`} />
                  {isDispatching ? 'กำลังส่งคำสั่งไปยัง GitHub...' : '🚀 สั่งรันบน GitHub Actions ทันที'}
                </button>

                <a
                  href={`https://github.com/${repo}/actions/workflows/${workflowFile}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  เปิดหน้ารันบน GitHub
                </a>
              </div>

              {/* Result Notification */}
              {dispatchResult && (
                <div
                  className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 ${
                    dispatchResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {dispatchResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="font-bold">
                        {dispatchResult.success ? 'สั่งรันบน GitHub สำเร็จ!' : 'สถานะการสั่งรัน:'}
                      </div>
                      <div className="mt-0.5 text-slate-300 break-all leading-relaxed">
                        {dispatchResult.message || dispatchResult.error}
                      </div>
                    </div>
                    {!dispatchResult.success && !token && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSimulateRunner}
                          className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          ⚡ รันตรวจผลสดบน Server ทันที
                        </button>
                        <a
                          href={`https://github.com/${repo}/actions/workflows/${workflowFile}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          ไปกด Run บนหน้าเว็บ GitHub โดยตรง
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Execution Logs Console */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-lg flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  คอนโซลผลลัพธ์การรัน (Runner Console)
                </span>
                {simulationLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSimulationLogs([])}
                    className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    ล้างจอ
                  </button>
                )}
              </div>

              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-[11px] flex-1 min-h-[300px] max-h-[460px] overflow-y-auto space-y-1.5 text-slate-300">
                {simulationLogs.length > 0 ? (
                  simulationLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`leading-relaxed break-all ${
                        log.includes('[SUCCESS]') || log.includes('สำเร็จ')
                          ? 'text-emerald-400 font-semibold'
                          : log.includes('[WARN]')
                          ? 'text-amber-400'
                          : log.includes('[ERROR]') || log.includes('❌')
                          ? 'text-rose-400 font-semibold'
                          : log.includes('[CHECK]') || log.includes('[CATALOG]')
                          ? 'text-cyan-300'
                          : 'text-slate-300'
                      }`}
                    >
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-600 text-center py-16 space-y-2">
                    <Terminal className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
                    <div>ยังไม่มีประวัติการรันล่าสุด</div>
                    <div className="text-[10px] text-slate-700">
                      กดปุ่ม "🚀 สั่งรันบน GitHub Actions" หรือ "💻 รันตรวจผลบน Server" เพื่อเริ่มการตรวจสอบ
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                <span>Node.js v22.23.4 • Python 3.11 Environment</span>
                <span>Auto-sync with status/status.json</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: LIVE WORKFLOW RUNS                                           */}
      {/* ========================================================================= */}
      {subTab === 'runs' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                ประวัติการรัน Workflow บน GitHub Actions ล่าสุด ({runs.length} รายการ)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                เชื่อมต่อและดึงข้อมูลสดผ่าน GitHub Actions API ของ <code className="text-purple-300">{repo}</code>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchRuns}
                disabled={isLoadingRuns}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRuns ? 'animate-spin text-purple-400' : ''}`} />
                รีเฟรชข้อมูลสด
              </button>
              <a
                href={`https://github.com/${repo}/actions`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                เปิดดูใน GitHub
              </a>
            </div>
          </div>

          {runsError && (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
              <div>{runsError} (กรุณากรอก Personal Access Token ในแท็บที่ 1 เพื่อปลดล็อกการดึงข้อมูลสด)</div>
            </div>
          )}

          {isLoadingRuns ? (
            <div className="text-center py-16 text-xs text-slate-400 flex flex-col items-center gap-2">
              <RotateCw className="w-6 h-6 animate-spin text-purple-400" />
              <span>กำลังดึงข้อมูล Workflow Runs จาก GitHub...</span>
            </div>
          ) : runs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                    <th className="py-3 px-3">Run #</th>
                    <th className="py-3 px-3">สถานะ (Status)</th>
                    <th className="py-3 px-3">Event</th>
                    <th className="py-3 px-3">Branch</th>
                    <th className="py-3 px-3">เวลาที่รัน (Created)</th>
                    <th className="py-3 px-3 text-right">ลิงก์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {runs.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-bold text-white">#{r.run_number}</td>
                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            r.conclusion === 'success'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : r.conclusion === 'failure'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : r.status === 'in_progress'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {r.conclusion === 'success' && <Check className="w-3 h-3 text-emerald-400" />}
                          {r.conclusion === 'failure' && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                          {r.status === 'in_progress' && <RotateCw className="w-3 h-3 animate-spin text-amber-400" />}
                          {r.conclusion || r.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-300">
                        {r.event === 'schedule' ? (
                          <span className="text-cyan-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Cron Schedule
                          </span>
                        ) : r.event === 'workflow_dispatch' ? (
                          <span className="text-purple-300 flex items-center gap-1">
                            <Play className="w-3 h-3" /> Manual Dispatch
                          </span>
                        ) : (
                          r.event
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{r.head_branch}</td>
                      <td className="py-3 px-3 text-slate-400">
                        {new Date(r.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                      </td>
                      <td className="py-3 px-3 text-right font-sans">
                        <a
                          href={r.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-400 hover:text-purple-300 font-bold inline-flex items-center gap-1 hover:underline"
                        >
                          Logs <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              ยังไม่มีประวัติการรันในฐานข้อมูล หรือยังไม่ได้ใส่ Personal Access Token
            </div>
          )}
        </div>
      )}

    </div>
  );
}
