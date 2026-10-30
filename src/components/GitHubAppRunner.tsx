import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Github,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  Download,
  Settings,
  Shield,
  Clock,
  Layers,
  Key,
  Flame,
  FileCode2,
  Activity,
  Cpu,
  RefreshCw,
  FolderGit2,
  Sparkles,
  Zap,
  Info
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

const API_BASE = 'https://bombim00-github-api.jirapatcip2557.workers.dev';

interface GitHubAppRunnerProps {
  onRefreshStatus?: () => void;
  systemStatus?: any;
}

export function GitHubAppRunner({ onRefreshStatus, systemStatus }: GitHubAppRunnerProps) {
  const [subTab, setSubTab] = useState<'runner' | 'runs' | 'builder' | 'setup'>('runner');

  // GitHub credentials & config (saved to localStorage for user convenience)
  const [repo, setRepo] = useState<string>(() => localStorage.getItem('gh_repo') || 'jirapatza/Bombim00');
  const [branch, setBranch] = useState<string>(() => localStorage.getItem('gh_branch') || 'main');
  const [token, setToken] = useState<string>(() => '');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [workflowFile, setWorkflowFile] = useState<string>('lottery.yml');

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

  // Workflow builder
  const [workflowYaml, setWorkflowYaml] = useState<string>('');
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState<boolean>(false);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState<boolean>(false);
  const [workflowSaveStatus, setWorkflowSaveStatus] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load workflow yaml on mount
  useEffect(() => {
    fetchWorkflowYaml();
  }, []);

  const fetchWorkflowYaml = async () => {
    setIsLoadingWorkflow(true);
    try {
      const res = await fetch(`${API_BASE}/api/github/workflow`);
      const data = await res.json();
      if (data.content) {
        setWorkflowYaml(data.content);
      }
    } catch (err) {
      console.error('Failed to load workflow yaml:', err);
    } finally {
      setIsLoadingWorkflow(false);
    }
  };

  const saveWorkflowYaml = async () => {
    setIsSavingWorkflow(true);
    setWorkflowSaveStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/github/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, content: workflowYaml }),
      });
      const data = await res.json();
      if (data.success) {
        setWorkflowSaveStatus('บันทึกไฟล์ .github/workflows/lottery.yml สำเร็จเรียบร้อย');
        setTimeout(() => setWorkflowSaveStatus(null), 4000);
      } else {
        setWorkflowSaveStatus(`ผิดพลาด: ${data.error}`);
      }
    } catch (err: any) {
      setWorkflowSaveStatus(`ผิดพลาด: ${err.message}`);
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Dispatch workflow run on GitHub
  const handleDispatchWorkflow = async () => {
    if (!repo) {
      setDispatchResult({ error: 'กรุณากรอกชื่อ GitHub Repository เช่น username/lottery-alert' });
      return;
    }
    if (!token) {
      setDispatchResult({ error: 'กรุณากรอก GitHub Personal Access Token (PAT) ที่มีสิทธิ์ Actions Write' });
      return;
    }

    setIsDispatching(true);
    setDispatchResult(null);

    // Save credentials to localStorage
    localStorage.setItem('gh_repo', repo);
    localStorage.setItem('gh_branch', branch);
    // Do not persist the GitHub credential in browser storage.

    try {
      const res = await fetch(`${API_BASE}/api/github/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo,
          branch,
          token,
          workflow: workflowFile,
          inputs: {
            force_notify: forceNotify ? 'true' : 'false',
            lottery_target: lotteryTarget,
          },
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
      const res = await fetch(`${API_BASE}/api/github/runs`, {
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
    setSimulationLogs(['🚀 กำลังเตรียมสภาพแวดล้อม Python 3.11 และอ่าน settings.json...']);

    try {
      const res = await fetch(`${API_BASE}/api/simulate-runner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, forceNotify, lotteryTarget }),
      });

      const data = await res.json();
      if (data.stdout || data.stderr) {
        const lines = (data.stdout + '\n' + (data.stderr || ''))
          .split('\n')
          .filter((l: string) => l.trim().length > 0);
        setSimulationLogs(lines);
      } else {
        setSimulationLogs([data.message || 'การจำลองเสร็จสิ้น']);
      }

      if (onRefreshStatus) {
        onRefreshStatus();
      }
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
                  GitHub Actions Runner & App Creator
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  รันบน GitHub โดยตรง
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                สร้างแอพพลิเคชันและสั่งรันระบบตรวจผลหวยอัตโนมัติบน GitHub Actions ได้จากหน้าจอนี้โดยตรง พร้อมตัวมอนิเตอร์ Workflow Runs, ปรับแต่งไฟล์ YAML, และคำสั่งจำลอง Runner เสมือนจริง
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
              {isSimulating ? 'กำลังทดสอบรัน...' : '💻 จำลองรันบน Server เสมือน'}
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

          <button
            onClick={() => setSubTab('builder')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              subTab === 'builder'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            3. ปรับแต่งไฟล์ Workflow (.yml Builder)
          </button>

          <button
            onClick={() => setSubTab('setup')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              subTab === 'setup'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            4. สร้างแอพพลิเคชั่นบน GitHub & Secrets Setup
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
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-400" />
                  การเชื่อมต่อกับ GitHub Repository
                </span>
                <span className="text-[11px] text-slate-400">บันทึกลงเบราว์เซอร์ของคุณอย่างปลอดภัย</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    GitHub Repository (owner/repo) *
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น bombimm43/lottery-alert"
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
                    <span>GitHub Personal Access Token (PAT) *</span>
                    <span className="text-[10px] text-purple-400 font-normal">(สิทธิ์: Actions Read & Write)</span>
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
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  สร้างได้ที่ GitHub &gt; Settings &gt; Developer Settings &gt; Personal access tokens &gt; Tokens (classic) หรือ Fine-grained
                </p>
              </div>

              {/* Workflow Dispatch Inputs */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-4">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  พารามิเตอร์ส่งเข้ารันบน GitHub Actions (Workflow Inputs)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      กลุ่มหวยเป้าหมาย (Lottery Target)
                    </label>
                    <select
                      value={lotteryTarget}
                      onChange={(e) => setLotteryTarget(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value="all">🌟 ทุกรายการหวย (29 รายการ หุ้น/ฮานอย/ลาว/รัฐ)</option>
                      <option value="government">🇹🇭 สลากกินแบ่งรัฐบาลไทย & ออมสิน</option>
                      <option value="thai_stock">📈 หวยหุ้นไทย (เช้า-เที่ยง-บ่าย-เย็น)</option>
                      <option value="foreign_stock">🌐 หวยหุ้นต่างประเทศ (นิเคอิ/ฮั่งเส็ง/จีน/ดาวโจนส์)</option>
                      <option value="hanoi">🇻🇳 หวยฮานอย (HD / พิเศษ / ปกติ / VIP)</option>
                      <option value="lao">🇱🇦 หวยลาว (พัฒนา / สตาร์ / VIP)</option>
                      <option value="malay">🇲🇾 หวยมาเลย์ 4D</option>
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
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDispatchWorkflow}
                  disabled={isDispatching}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-lg shadow-purple-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  <Play className={`w-4 h-4 ${isDispatching ? 'animate-spin' : ''}`} />
                  {isDispatching ? 'กำลังส่งคำสั่งไปยัง GitHub...' : '🚀 สั่งรันบน GitHub Actions ทันที'}
                </button>

                <button
                  type="button"
                  onClick={handleSimulateRunner}
                  disabled={isSimulating}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Cpu className="w-4 h-4 text-amber-400" />
                  จำลองรันบน Server ทันที
                </button>
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
                  <div>
                    <div className="font-bold">
                      {dispatchResult.success ? 'สั่งรันบน GitHub สำเร็จ!' : 'เกิดข้อผิดพลาดในการสั่งรัน:'}
                    </div>
                    <div className="mt-0.5 text-slate-300 break-all">
                      {dispatchResult.message || dispatchResult.error}
                    </div>
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
                      กดปุ่ม "🚀 สั่งรันบน GitHub Actions" หรือ "💻 จำลองรันบน Server" เพื่อเริ่มการตรวจสอบ
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

      {/* ========================================================================= */}
      {/* SUB-TAB 3: WORKFLOW YAML BUILDER                                         */}
      {/* ========================================================================= */}
      {subTab === 'builder' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-purple-400" />
                ปรับแต่งไฟล์ .github/workflows/lottery.yml
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                แก้ไขกำหนดเวลา Cron, ตัวแปร Secrets, และขั้นตอนการทำงานของ GitHub Actions
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(workflowYaml, 'workflow_yaml')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition flex items-center gap-1"
              >
                {copiedKey === 'workflow_yaml' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
                {copiedKey === 'workflow_yaml' ? 'คัดลอกแล้ว!' : 'คัดลอก YAML'}
              </button>

              <button
                type="button"
                onClick={saveWorkflowYaml}
                disabled={isSavingWorkflow}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-md shadow-purple-600/30 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {isSavingWorkflow ? 'กำลังบันทึก...' : 'บันทึกลงไฟล์ .yml'}
              </button>
            </div>
          </div>

          {workflowSaveStatus && (
            <div
              className={`p-3.5 rounded-xl border text-xs ${
                workflowSaveStatus.includes('สำเร็จ')
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {workflowSaveStatus}
            </div>
          )}

          {/* Quick Schedule Presets */}
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              ตารางเวลาการรันอัตโนมัติ (Cron Schedules) ที่ตั้งค่าไว้ในไฟล์:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="font-bold text-amber-300 mb-0.5">1. สลากกินแบ่งรัฐบาล (วันที่ 1, 16)</div>
                <div className="font-mono text-[11px] text-slate-400">*/15 7-10 1,16 * *</div>
                <div className="text-[11px] text-slate-500 mt-1">ทุก 15 นาที ช่วง 14:00 - 17:00 น.</div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="font-bold text-cyan-300 mb-0.5">2. หวยหุ้นไทย & ต่างประเทศ (จันทร์-ศุกร์)</div>
                <div className="font-mono text-[11px] text-slate-400">30 3,8,10,13 * * 1-5</div>
                <div className="text-[11px] text-slate-500 mt-1">เวลา 10:30, 15:30, 17:30, 20:00 น.</div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="font-bold text-emerald-300 mb-0.5">3. Heartbeat / สรุปผลประจำวัน</div>
                <div className="font-mono text-[11px] text-slate-400">0 9 * * *</div>
                <div className="text-[11px] text-slate-500 mt-1">ทุกวัน เวลา 16:00 น. (UTC 09:00)</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={workflowYaml}
              onChange={(e) => setWorkflowYaml(e.target.value)}
              rows={20}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-emerald-300 focus:outline-none focus:border-purple-500 leading-relaxed shadow-inner"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: GITHUB APPLICATION CREATOR & SETUP GUIDE                     */}
      {/* ========================================================================= */}
      {subTab === 'setup' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-lg">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-purple-400" />
                คู่มือการสร้างแอพพลิเคชันและ Deploy ขึ้น GitHub แบบทีละขั้นตอน
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                ทำตาม 4 ขั้นตอนสั้นๆ นี้เพื่อเปิดระบบแจ้งเตือนอัตโนมัติบน GitHub ให้ทำงานฟรี 24 ชม. ตลอดชีพ
              </p>
            </div>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-slate-100 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-black">
                      1
                    </span>
                    <span>สร้าง GitHub Repository ใหม่ & สั่ง Push โค้ดทั้งหมดขึ้น GitHub</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        `git init\ngit add .\ngit commit -m "feat: complete lottery alert system with github actions runner"\ngit branch -M main\ngit remote add origin https://github.com/${repo}.git\ngit push -u origin main`,
                        'git_commands'
                      )
                    }
                    className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    {copiedKey === 'git_commands' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'git_commands' ? 'คัดลอกคำสั่งแล้ว' : 'คัดลอกคำสั่ง Git'}
                  </button>
                </div>

                <pre className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 font-mono text-[11px] text-amber-300 overflow-x-auto leading-relaxed">
{`git init
git add .
git commit -m "feat: complete lottery alert system with github actions runner"
git branch -M main
git remote add origin https://github.com/${repo}.git
git push -u origin main`}
                </pre>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="font-bold text-xs text-slate-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-black">
                    2
                  </span>
                  <span>ตั้งค่า GitHub Secrets (Settings &gt; Secrets and variables &gt; Actions)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-amber-400">NTFY_TOPIC</div>
                      <div className="text-[11px] text-slate-400">ชื่อ Topic สำหรับส่งแจ้งเตือนมือถือ</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('NTFY_TOPIC', 's1')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono cursor-pointer"
                    >
                      {copiedKey === 's1' ? 'คัดลอกแล้ว' : 'Copy'}
                    </button>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-amber-400">DISCORD_WEBHOOK_URL</div>
                      <div className="text-[11px] text-slate-400">Webhook แจ้งเตือนเข้า Discord</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('DISCORD_WEBHOOK_URL', 's2')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono cursor-pointer"
                    >
                      {copiedKey === 's2' ? 'คัดลอกแล้ว' : 'Copy'}
                    </button>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-amber-400">TELEGRAM_BOT_TOKEN</div>
                      <div className="text-[11px] text-slate-400">บอทโทเคน Telegram (ถ้าใช้)</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('TELEGRAM_BOT_TOKEN', 's3')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono cursor-pointer"
                    >
                      {copiedKey === 's3' ? 'คัดลอกแล้ว' : 'Copy'}
                    </button>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-amber-400">TELEGRAM_CHAT_ID</div>
                      <div className="text-[11px] text-slate-400">ห้องแชท Telegram (ถ้าใช้)</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('TELEGRAM_CHAT_ID', 's4')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono cursor-pointer"
                    >
                      {copiedKey === 's4' ? 'คัดลอกแล้ว' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl space-y-2">
                <div className="font-bold text-xs text-slate-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-black">
                    3
                  </span>
                  <span>เปิดสิทธิ์ Workflow Permissions เพื่อให้ Actions บันทึกผลกลับเข้า Repo ได้</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pl-7">
                  ไปที่ <strong>Settings &gt; Actions &gt; General &gt; Workflow permissions</strong> เลือก{' '}
                  <strong className="text-emerald-400">"Read and write permissions"</strong> และติ๊กถูก{' '}
                  <strong>"Allow GitHub Actions to create and approve pull requests"</strong> แล้วกด Save
                </p>
              </div>

              {/* Step 4 */}
              <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl space-y-2">
                <div className="font-bold text-xs text-slate-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-black">
                    4
                  </span>
                  <span>ทดสอบยิงคำสั่งแรกจากแท็บ "1. สั่งรันบน GitHub"</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pl-7">
                  ใส่ Personal Access Token แล้วกดปุ่ม <strong>"🚀 สั่งรันบน GitHub Actions ทันที"</strong>{' '}
                  ระบบจะสั่ง Trigger ทันที และสามารถดูประวัติการรันสดในแท็บที่ 2 ได้แบบเรียลไทม์
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
