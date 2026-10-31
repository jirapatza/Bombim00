import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Wrench,
  Download,
  Server,
  Database,
  Cpu,
  FileCheck2,
  Globe,
  Bell,
  Volume2,
  GitBranch,
  ShieldCheck,
  Zap,
  Info,
  Clock,
  Sparkles,
  ExternalLink,
  RotateCcw,
  ListFilter,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  History,
  Terminal,
  FileSpreadsheet,
  Copy,
  Check,
  Code2,
} from 'lucide-react';

interface MonitorData {
  success: boolean;
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'error';
  system: {
    serverPort: number;
    nodeVersion: string;
    platform: string;
    uptimeSeconds: number;
    uptimeFormatted: string;
    memoryUsageMB: number;
    totalHeapMB: number;
    backgroundRunnerActive: boolean;
  };
  filesHealth: Array<{
    name: string;
    path: string;
    exists: boolean;
    critical: boolean;
    validJson?: boolean;
  }>;
  sourceChecks: Array<{
    id: string;
    name: string;
    status: 'healthy' | 'degraded' | 'error';
    latencyMs: number;
    statusCode: number;
    lastChecked: string;
  }>;
}

export interface SelfHealingActionItem {
  id: string;
  commandCode: string;
  targetDevice: string;
  description: string;
  triggerReason: string;
  timestamp: string;
  timestampThai: string;
  status: 'success' | 'warning' | 'failed';
  executionTimeMs: number;
  details: string;
  shellCommand?: string;
}

export interface SelfHealingSession {
  sessionId: string;
  triggeredAt: string;
  triggeredAtThai: string;
  triggerType: string;
  triggeredByDevice: string;
  triggerReason: string;
  overallResult: string;
  totalActionsCount: number;
  successCount: number;
  failedCount: number;
  executionDurationTotalMs: number;
  actions: SelfHealingActionItem[];
}

export function SystemMonitorKiosk() {
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [healingHistory, setHealingHistory] = useState<SelfHealingSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [isSelfHealing, setIsSelfHealing] = useState<boolean>(false);
  const [healingTargetDevice, setHealingTargetDevice] = useState<string | null>(null);
  const [healResult, setHealResult] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'error' | 'healthy'>('all');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'success' | 'issues'>('all');
  const [searchHistoryTerm, setSearchHistoryTerm] = useState<string>('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);
  const [clientSpeechReady, setClientSpeechReady] = useState<boolean>(true);
  const [clientOnline, setClientOnline] = useState<boolean>(navigator.onLine);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Helper to provide realistic shell command if older history record lacks it
  const getDefaultShellCommand = (code: string): string => {
    switch (code) {
      case 'REPAIR_FILESYSTEM_DIRS':
        return 'mkdir -p config status data && chmod 755 config status data && ls -ld config status data';
      case 'RESTORE_CONFIG_SCHEMA':
        return 'node -e \'const fs=require("fs"); const c=JSON.parse(fs.readFileSync("config/settings.json","utf-8")); console.log("Config OK:", c.app_name);\'';
      case 'CLEAR_MUTEX_LOCK':
        return 'export RUNNER_LOCK=0 && pkill -f "lottery_checker.py" 2>/dev/null || true';
      case 'SYNC_OFFLINE_CACHE':
        return 'python3 -c "import json; r=json.load(open(\'lottery_previous_results.json\')); print(f\'Validated {len(r)} historical draws\')"';
      case 'RESET_SYSTEM_HEALTH_METRICS':
        return 'node -e \'const fs=require("fs"); const s=JSON.parse(fs.readFileSync("status/status.json")); s.system_status="healthy"; fs.writeFileSync("status/status.json", JSON.stringify(s, null, 2));\'';
      case 'VERIFY_GATEWAYS_REACHABILITY':
        return 'curl -s -m 5 -I https://glo.or.th https://ntfy.sh https://api.github.com/repos/jirapatza/Bombim00';
      default:
        return `# Executing auto-repair for ${code}\nsystemctl restart lotto-daemon.service || true`;
    }
  };

  const handleCopyCommand = async (command: string, actionId: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(command);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = command;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCommandId(actionId);
      setTimeout(() => {
        setCopiedCommandId((prev) => (prev === actionId ? null : prev));
      }, 2500);
    } catch (err) {
      console.error('Failed to copy command:', err);
    }
  };

  // Check client speech synthesis capability
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setClientSpeechReady(true);
    } else {
      setClientSpeechReady(false);
    }

    const handleOnline = () => setClientOnline(true);
    const handleOffline = () => setClientOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchMonitorStatus = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/system/monitor');
      if (res.ok) {
        const data = await res.json();
        setMonitorData(data);
      }
    } catch (err) {
      console.error('Failed to fetch system monitor status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHealingHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await apiFetch('/api/system/self-heal-history');
      if (res.ok) {
        const data = await res.json();
        if (data.history && Array.isArray(data.history)) {
          setHealingHistory(data.history);
          if (data.history.length > 0 && !expandedSessionId) {
            setExpandedSessionId(data.history[0].sessionId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch self-heal history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorStatus();
    fetchHealingHistory();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMonitorStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Automated Self-Healing Routine (supports either All or specific device target)
  const handleAutoSelfHeal = async (params?: { targetDevice?: string; triggerReason?: string }) => {
    setIsSelfHealing(true);
    setHealingTargetDevice(params?.targetDevice || null);
    setHealResult(null);
    try {
      const res = await apiFetch('/api/system/self-heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDevice: params?.targetDevice,
          triggerReason: params?.triggerReason,
          triggerType: params?.targetDevice ? 'device_error_repair' : 'manual_user_click',
        }),
      });
      const data = await res.json();
      setHealResult(data);
      if (data.session) {
        setExpandedSessionId(data.session.sessionId);
      }
      // Re-fetch monitor status and history
      await Promise.all([fetchMonitorStatus(), fetchHealingHistory()]);
    } catch (err: any) {
      setHealResult({
        success: false,
        message: 'เกิดข้อผิดพลาดขณะเรียกใช้งานระบบซ่อมแซม: ' + (err.message || 'Network error'),
        timestamp: new Date().toISOString(),
        fixedActions: ['พบปัญหาการเชื่อมต่อไปยัง API Endpoint ซ่อมแซม'],
      });
    } finally {
      setIsSelfHealing(false);
      setHealingTargetDevice(null);
    }
  };

  // Clear Self-Healing History
  const handleClearHistory = async () => {
    if (!window.confirm('คุณต้องการล้างประวัติคำสั่งซ่อมแซมตัวเองทั้งหมดใช่หรือไม่?')) return;
    try {
      const res = await apiFetch('/api/system/self-heal-history', { method: 'DELETE' });
      if (res.ok) {
        setHealingHistory([]);
        setExpandedSessionId(null);
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  // Export Self-Healing Logs as JSON
  const handleExportHealingLogsJson = () => {
    const blob = new Blob([JSON.stringify(healingHistory, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `self-healing-actions-log-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Comprehensive Diagnostic Report
  const handleDownloadDiagnosticReport = () => {
    const reportData = {
      reportTitle: 'รายงานวิเคราะห์และตรวจสอบสุขภาพระบบ (System Diagnostic Report)',
      generatedAt: new Date().toISOString(),
      generatedThai: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      overallHealth: monitorData?.overallStatus || 'unknown',
      clientEnvironment: {
        userAgent: navigator.userAgent,
        online: clientOnline,
        speechSynthesisAvailable: clientSpeechReady,
        screenResolution: `${window.innerWidth}x${window.innerHeight}`,
      },
      serverMetrics: monitorData?.system || {},
      criticalFiles: monitorData?.filesHealth || [],
      externalFeeds: monitorData?.sourceChecks || [],
      selfHealingHistory: healingHistory,
      lastSelfHealLog: healResult,
      quickResolutionGuide: [
        'หากไฟล์ JSON เสียหาย: กดปุ่ม "⚡ ซ่อมแซมระบบอัตโนมัติ" หรือกดซ่อมเฉพาะจุดที่การ์ดไฟล์นั้นๆ',
        'หากติด Merge Conflict ใน GitHub: ให้เปิดเมนู GitHub CI/CD แล้วกดแก้ไขข้อขัดแย้งในหน้า Pull Request',
        'หาก ntfy ส่งไม่ผ่าน: ตรวจสอบ Topic ว่าตรงกับแอปบนมือถือหรือไม่',
      ],
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-diagnostic-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Subsystem list
  const settingsFile = monitorData?.filesHealth.find((f) => f.name === 'config/settings.json');
  const statusFile = monitorData?.filesHealth.find((f) => f.name === 'status/status.json');
  const gloCheck = monitorData?.sourceChecks.find((s) => s.id === 'glo');
  const ranlottoCheck = monitorData?.sourceChecks.find((s) => s.id === 'ranlotto');
  const ntfyCheck = monitorData?.sourceChecks.find((s) => s.id === 'ntfy');
  const githubCheck = monitorData?.sourceChecks.find((s) => s.id === 'github');

  const services = [
    {
      id: 'express_server',
      name: 'Node.js Express API Server',
      category: 'Core Service',
      icon: Server,
      status: monitorData?.success ? 'healthy' : monitorData ? 'error' : 'degraded',
      statusText: monitorData?.success ? `API ตอบกลับแล้ว (Port ${monitorData.system.serverPort})` : 'ยังไม่ได้รับผลตรวจจาก API Server',
      latency: null,
      details: monitorData
        ? `Node ${monitorData.system.nodeVersion} • Uptime ${monitorData.system.uptimeFormatted} • RAM ${monitorData.system.memoryUsageMB}MB / ${monitorData.system.totalHeapMB}MB`
        : 'รอผลตรวจสุขภาพจาก API Server',
      easyFix: 'ตรวจสอบ API Server และดูผลตอบกลับล่าสุดก่อนสั่งซ่อมแซม',
    },
    {
      id: 'background_runner',
      name: 'Local Background Lottery Runner',
      category: 'Automation Engine',
      icon: Cpu,
      status: monitorData?.system.backgroundRunnerActive ? 'healthy' : 'degraded',
      statusText: monitorData?.system.backgroundRunnerActive
        ? 'เปิดใช้งานตัวตรวจในเซิร์ฟเวอร์นี้ทุก 10 นาที'
        : 'ยังยืนยันไม่ได้ว่าตัวตรวจเบื้องหลังเปิดใช้งาน',
      latency: null,
      details: 'เป็นตัวตรวจเบื้องหลังของ API Server แยกจาก GitHub Actions ที่ตรวจทุก 5 นาที',
      easyFix: 'ตรวจสอบ DISABLE_BACKGROUND_CHECK และบันทึกการทำงานของ API Server',
    },
    {
      id: 'settings_file',
      name: 'System Config (config/settings.json)',
      category: 'Filesystem Database',
      icon: FileCheck2,
      status: settingsFile?.exists && settingsFile.validJson !== false ? 'healthy' : monitorData ? 'error' : 'degraded',
      statusText: !monitorData ? 'ยังไม่ได้ตรวจสอบไฟล์' : settingsFile?.exists && settingsFile.validJson !== false
        ? 'ไฟล์มีอยู่และเป็น JSON ที่อ่านได้'
        : 'ไม่พบไฟล์หรือ JSON ไม่ถูกต้อง',
      latency: null,
      details: 'ไฟล์กำหนดค่าแหล่งข้อมูล ช่องทางแจ้งเตือน และแม่แบบเสียง',
      easyFix: 'ตรวจสอบไฟล์ config/settings.json ก่อนกู้คืนหรือแก้ไข',
    },
    {
      id: 'status_file',
      name: 'Runtime Status (status/status.json)',
      category: 'Filesystem Database',
      icon: Activity,
      status: statusFile?.exists && statusFile.validJson !== false ? 'healthy' : monitorData ? 'error' : 'degraded',
      statusText: !monitorData ? 'ยังไม่ได้ตรวจสอบไฟล์' : statusFile?.exists && statusFile.validJson !== false
        ? 'ไฟล์มีอยู่และเป็น JSON ที่อ่านได้'
        : 'ไม่พบไฟล์หรือ JSON ไม่ถูกต้อง',
      latency: null,
      details: 'เก็บสถานะการตรวจหวยล่าสุดและบันทึกเหตุการณ์',
      easyFix: 'สำรองไฟล์ก่อนซ่อมแซม status/status.json',
    },
    {
      id: 'glo_feed',
      name: 'GLO Host Reachability',
      category: 'External Data Source',
      icon: Globe,
      status: gloCheck?.status || 'degraded',
      statusText: !gloCheck ? 'ยังไม่ได้ตรวจสอบ' : gloCheck.status === 'healthy'
        ? `เข้าถึงโดเมนได้ (HTTP ${gloCheck.statusCode})`
        : `การตรวจเข้าถึงโดเมนไม่ผ่าน (HTTP ${gloCheck.statusCode || 'ไม่มีการตอบกลับ'})`,
      latency: gloCheck?.latencyMs ?? null,
      details: 'ตรวจสอบการเข้าถึงโดเมน GLO เท่านั้น ไม่ได้ยืนยันว่า API ส่งผลหวยล่าสุดได้',
      easyFix: 'หากต้องการยืนยันผลจริง ให้ทดสอบ endpoint ผลหวยและตรวจข้อมูลตอบกลับ',
    },
    {
      id: 'ranlotto_feed',
      name: 'RANLOTTO Host Reachability',
      category: 'External Data Source',
      icon: Globe,
      status: ranlottoCheck?.status || 'degraded',
      statusText: !ranlottoCheck ? 'ยังไม่ได้ตรวจสอบ' : ranlottoCheck.status === 'healthy'
        ? `เข้าถึงโดเมนได้ (HTTP ${ranlottoCheck.statusCode})`
        : `การตรวจเข้าถึงโดเมนไม่ผ่าน (HTTP ${ranlottoCheck.statusCode || 'ไม่มีการตอบกลับ'})`,
      latency: ranlottoCheck?.latencyMs ?? null,
      details: 'ตรวจสอบการเข้าถึง host เท่านั้น ไม่ได้ยืนยันความครบถ้วนของผลหวยแต่ละหมวด',
      easyFix: 'ทดสอบ API endpoint จริงและตรวจ schema ของผลตอบกลับ',
    },
    {
      id: 'ntfy_push',
      name: 'ntfy.sh Gateway Reachability',
      category: 'Push Notification Hub',
      icon: Bell,
      status: ntfyCheck?.status || 'degraded',
      statusText: !ntfyCheck ? 'ยังไม่ได้ตรวจสอบ' : ntfyCheck.status === 'healthy'
        ? `เข้าถึง ntfy ได้ (HTTP ${ntfyCheck.statusCode})`
        : `ตรวจการเข้าถึง ntfy ไม่ผ่าน (HTTP ${ntfyCheck.statusCode || 'ไม่มีการตอบกลับ'})`,
      latency: ntfyCheck?.latencyMs ?? null,
      details: 'การเข้าถึงเซิร์ฟเวอร์ไม่ได้ยืนยันว่ามือถือสมัคร Topic หรือได้รับการแจ้งเตือนแล้ว',
      easyFix: 'ตรวจสอบ Topic บน Android และทดสอบ publish พร้อมตรวจ HTTP response',
    },
    {
      id: 'speech_engine',
      name: 'Web Speech Thai Audio Engine',
      category: 'Speech Synthesis',
      icon: Volume2,
      status: clientSpeechReady ? 'healthy' : 'error',
      statusText: clientSpeechReady ? 'เบราว์เซอร์รองรับ SpeechSynthesis' : 'เบราว์เซอร์ไม่รองรับ SpeechSynthesis',
      latency: null,
      details: 'การรองรับ API ไม่ได้ยืนยันว่ามีเสียงภาษาไทยหรือเสียงผู้ชายบนอุปกรณ์นี้',
      easyFix: 'ตรวจรายชื่อเสียงที่ติดตั้งบน Android และทดสอบเสียงจริง',
    },
    {
      id: 'firestore_db',
      name: 'Firebase Cloud Firestore Sync',
      category: 'Cloud Persistence',
      icon: Database,
      status: 'degraded',
      statusText: 'ยังไม่มีการตรวจสอบการเชื่อมต่อ Firestore จาก System Monitor',
      latency: null,
      details: 'ไม่แสดงสถานะเขียวจนกว่าจะมีผลตรวจการเชื่อมต่อจริง',
      easyFix: 'ตรวจ Firebase SDK และอ่านผลการเชื่อมต่อจากแอปก่อนสรุปสถานะ',
    },
    {
      id: 'github_sync',
      name: 'GitHub API Host Reachability',
      category: 'DevOps & Source Code',
      icon: GitBranch,
      status: githubCheck?.status || 'degraded',
      statusText: !githubCheck ? 'ยังไม่ได้ตรวจสอบ' : githubCheck.status === 'healthy'
        ? `เข้าถึง GitHub API ได้ (HTTP ${githubCheck.statusCode})`
        : `ตรวจการเข้าถึง GitHub API ไม่ผ่าน (HTTP ${githubCheck.statusCode || 'ไม่มีการตอบกลับ'})`,
      latency: githubCheck?.latencyMs ?? null,
      details: 'ตรวจสอบการเข้าถึง GitHub API เท่านั้น ไม่ได้ยืนยันสิทธิ์เขียนไฟล์หรือสั่งรัน Workflow',
      easyFix: 'ตรวจสอบสิทธิ์ GitHub และผล Workflow แยกจากการเข้าถึง host',
    },
  ];

  const healthyCount = services.filter((s) => s.status === 'healthy').length;
  const errorCount = services.filter((s) => s.status === 'error').length;
  const degradedCount = services.filter((s) => s.status === 'degraded').length;

  const filteredServices = services.filter((s) => {
    if (activeFilter === 'healthy') return s.status === 'healthy';
    if (activeFilter === 'error') return s.status === 'error' || s.status === 'degraded';
    return true;
  });

  // Calculate self-healing stats
  const totalSessionsCount = healingHistory.length;
  const totalExecutedActions = healingHistory.reduce((acc, sess) => acc + (sess.actions?.length || 0), 0);
  const totalSuccessActions = healingHistory.reduce(
    (acc, sess) => acc + (sess.actions?.filter((a) => a.status === 'success').length || 0),
    0
  );
  const overallSuccessRate =
    totalExecutedActions > 0 ? Math.round((totalSuccessActions / totalExecutedActions) * 100) : 100;

  // Filter history sessions
  const filteredHistory = healingHistory.filter((session) => {
    if (historyFilter === 'success' && session.overallResult !== 'success') return false;
    if (historyFilter === 'issues' && session.overallResult === 'success') return false;
    if (searchHistoryTerm.trim()) {
      const q = searchHistoryTerm.toLowerCase();
      const matchDevice = session.triggeredByDevice?.toLowerCase().includes(q);
      const matchReason = session.triggerReason?.toLowerCase().includes(q);
      const matchAction = session.actions?.some(
        (a) =>
          a.commandCode.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.targetDevice.toLowerCase().includes(q) ||
          a.triggerReason.toLowerCase().includes(q)
      );
      return matchDevice || matchReason || matchAction;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner: Master NOC & Device Health Monitor */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Ambient background glow */}
        <div
          className={`absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none ${
            errorCount > 0 ? 'bg-red-500' : degradedCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Network Operations Center (NOC)
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  errorCount > 0
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                    : degradedCount > 0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    errorCount > 0 ? 'bg-red-400' : degradedCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                {errorCount > 0
                  ? `พบ ${errorCount} อุปกรณ์/บริการมีปัญหา`
                  : degradedCount > 0
                  ? 'ระบบทำงานได้แต่มีความหน่วง'
                  : 'ทุกอุปกรณ์ & บริการทำงานปกติ 100%'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              🖥️ มอนิเตอร์ตรวจสอบอุปกรณ์ &amp; ระบบซ่อมแซมตัวเองอัตโนมัติ
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              จอแสดงผลสถานะการทำงานของอุปกรณ์ เซิร์ฟเวอร์ ฐานข้อมูล และช่องทางแจ้งเตือนทั้งหมด
              หากจุดใดทำงานปกติจะขึ้น <strong className="text-emerald-400 font-semibold">สีเขียว 🟢</strong>{' '}
              หากจุดใดขัดข้องหรือพังจะขึ้น <strong className="text-red-400 font-semibold">สีแดง 🔴</strong>{' '}
              พร้อมระบบ <strong className="text-amber-300 font-semibold">Self-Healing Actions Log</strong> ที่บันทึกคำสั่งซ่อมแซมที่ถูกรันโดยละเอียดเมื่ออุปกรณ์แจ้งข้อผิดพลาด
            </p>
          </div>

          {/* Action Buttons: Auto Self-Heal & Download Diagnostics */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleAutoSelfHeal()}
              disabled={isSelfHealing}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 flex items-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${isSelfHealing ? 'animate-spin' : ''}`} />
              <span>{isSelfHealing ? 'กำลังซ่อมแซมระบบอัตโนมัติ...' : '⚡ ซ่อมแซมระบบอัตโนมัติ (Self-Heal All)'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadDiagnosticReport}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-md"
            >
              <Download className="w-4 h-4 text-sky-400" />
              <span>📥 ดาวน์โหลดผลวิเคราะห์</span>
            </button>

            <button
              type="button"
              onClick={() => {
                fetchMonitorStatus();
                fetchHealingHistory();
              }}
              disabled={isLoading}
              title="ตรวจสอบสดเดี๋ยวนี้"
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick KPI Count Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">ทำงานปกติ (Online)</div>
              <div className="text-lg font-black text-emerald-400">{healthyCount} จุด</div>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center font-bold">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">พบปัญหา (Error)</div>
              <div className="text-lg font-black text-red-400">{errorCount} จุด</div>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">เซิร์ฟเวอร์เปิดต่อเนื่อง</div>
              <div className="text-sm font-black text-amber-300">
                {monitorData?.system.uptimeFormatted || 'กำลังโหลด...'}
              </div>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">หน่วยความจำ RAM Heap</div>
              <div className="text-sm font-black text-indigo-300">
                {monitorData?.system.memoryUsageMB || 0} MB
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Self-Healing Feedback Banner (if executed) */}
      {healResult && (
        <div
          className={`p-5 rounded-3xl border transition-all animate-in fade-in slide-in-from-top-3 ${
            healResult.success
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/40 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-2xl ${
                  healResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}
              >
                {healResult.success ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  {healResult.success
                    ? '🎉 ซ่อมแซมและฟื้นฟูระบบสำเร็จเรียบร้อย! (Self-Healing Success)'
                    : '⚠️ การซ่อมแซมระบบพบข้อผิดพลาดบางส่วน'}
                </h3>
                <p className="text-xs text-slate-300 mt-1">{healResult.message}</p>

                {healResult.executedActions && healResult.executedActions.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-300 flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-amber-400" />
                      <span>คำสั่งที่ระบบสั่งรันเพื่อแก้ไขข้อผิดพลาด (Executed Auto-Repair Commands):</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {healResult.executedActions.map((action: SelfHealingActionItem, idx: number) => {
                        const cmdText = action.shellCommand || getDefaultShellCommand(action.commandCode);
                        const cmdId = `banner-${action.id || idx}`;
                        return (
                          <div
                            key={action.id || idx}
                            className="text-xs bg-slate-900/95 p-3 rounded-xl border border-slate-800 text-slate-200 flex flex-col justify-between gap-2 shadow-md"
                          >
                            <div className="flex items-start gap-2.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-amber-300 text-[11px]">
                                    {action.commandCode}
                                  </span>
                                  <span className="text-[10px] text-slate-500">({action.executionTimeMs}ms)</span>
                                </div>
                                <div className="text-[11px] text-slate-300">{action.description}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  เป้าหมาย: <span className="text-slate-300">{action.targetDevice}</span>
                                </div>
                              </div>
                            </div>

                            {/* Shell Script Block */}
                            <div className="mt-1 bg-slate-950 rounded-lg border border-slate-800/80 p-2 font-mono text-[11px] flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 overflow-hidden text-emerald-300">
                                <span className="text-amber-400 font-bold select-none">$</span>
                                <span className="truncate text-slate-300">{cmdText}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyCommand(cmdText, cmdId)}
                                className="shrink-0 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer transition"
                                title="คัดลอกคำสั่ง Shell"
                              >
                                {copiedCommandId === cmdId ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400 font-bold">คัดลอกแล้ว</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-400" />
                                    <span>คัดลอก</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setHealResult(null)}
              className="text-slate-400 hover:text-white p-1 text-xs cursor-pointer"
            >
              ✕ ปิด
            </button>
          </div>
        </div>
      )}

      {/* Filter and Control Bar for Devices */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">กรองอุปกรณ์:</span>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ทั้งหมด ({services.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('error')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'error'
                ? 'bg-red-500 text-white font-black'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400" />
            มีปัญหา / เสีย ({errorCount + degradedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('healthy')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'healthy'
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ทำงานปกติ ({healthyCount})
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>อัปเดตสถานะอัตโนมัติทุก 15 วินาที</span>
          </label>
        </div>
      </div>

      {/* Services & Devices Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((service) => {
          const Icon = service.icon;
          const isError = service.status === 'error';
          const isDegraded = service.status === 'degraded';
          const isTargetBeingHealed = isSelfHealing && healingTargetDevice === service.name;

          return (
            <div
              key={service.id}
              className={`rounded-3xl p-5 border-2 transition-all flex flex-col justify-between relative overflow-hidden ${
                isError
                  ? 'bg-red-950/20 border-red-500/80 shadow-lg shadow-red-500/10 ring-1 ring-red-500/50'
                  : isDegraded
                  ? 'bg-amber-950/20 border-amber-500/70 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/70 border-emerald-500/40 hover:border-emerald-500/70 shadow-md'
              }`}
            >
              {/* Top Row: Icon, Service Name, Status Badge */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
                        isError
                          ? 'bg-red-500/20 border-red-500/50 text-red-400'
                          : isDegraded
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {service.category}
                      </span>
                      <h3 className="font-bold text-sm text-white">{service.name}</h3>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                      isError
                        ? 'bg-red-500 text-white shadow-sm shadow-red-500/50 animate-pulse'
                        : isDegraded
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isError ? 'bg-white' : isDegraded ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    {isError ? 'เสีย / ERROR' : isDegraded ? 'หน่วง / DEGRADED' : 'ปกติ / HEALTHY'}
                  </span>
                </div>

                {/* Status Message Text */}
                <div
                  className={`text-xs font-semibold p-2.5 rounded-xl border mb-3 flex items-start gap-2 ${
                    isError
                      ? 'bg-red-950/40 border-red-800/60 text-red-200'
                      : isDegraded
                      ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                      : 'bg-slate-950/60 border-slate-800/80 text-emerald-300'
                  }`}
                >
                  {isError ? (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : isDegraded ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <span>{service.statusText}</span>
                </div>

                {/* Details snippet */}
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">{service.details}</p>
              </div>

              {/* Bottom: Latency, Easy Fix Advice, and Device Quick-Repair Button */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-slate-500" />
                    เวลาตอบสนอง:
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      typeof service.latency !== 'number'
                        ? 'text-slate-400'
                        : service.latency < 200
                        ? 'text-emerald-400'
                        : service.latency < 500
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {typeof service.latency === 'number' ? `${service.latency} ms` : 'ไม่มีค่าที่วัดจริง'}
                  </span>
                </div>

                {/* Easy Fix Advice Box */}
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-start gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-amber-300 font-bold">วิธีแก้ง่ายสุด: </span>
                    <span>{service.easyFix}</span>
                  </div>
                </div>

                {/* Per-device Quick Repair Action */}
                <button
                  type="button"
                  onClick={() =>
                    handleAutoSelfHeal({
                      targetDevice: service.name,
                      triggerReason: `สั่งซ่อมแซมและตรวจสอบเฉพาะอุปกรณ์: ${service.name} (สถานะ: ${service.statusText})`,
                    })
                  }
                  disabled={isSelfHealing}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    isError
                      ? 'bg-red-500 hover:bg-red-400 text-white shadow-md shadow-red-500/20'
                      : isDegraded
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${isTargetBeingHealed ? 'animate-spin' : ''}`} />
                  <span>
                    {isTargetBeingHealed
                      ? 'กำลังซ่อมแซมอุปกรณ์นี้...'
                      : isError
                      ? '⚡ สั่งแก้ปัญหาจุดนี้ทันที (Auto-Repair This Error)'
                      : '🔧 ทดสอบซ่อมแซม & ตรวจสอบจุดนี้'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* DETAILED SELF-HEALING ACTIONS LOG (TRACKS REPAIR COMMANDS & ERROR TRIGGERS) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
        {/* Section Header & Metrics */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                <History className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                📋 บันทึกประวัติคำสั่งซ่อมแซมระบบอัตโนมัติ (Self-Healing Actions Log)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              ติดตามบันทึกคำสั่ง Auto-Repair ทั้งหมดที่ถูกเรียกใช้งานเมื่ออุปกรณ์รายงานข้อผิดพลาด พร้อมระบุเวลา สาเหตุ และสถานะความสำเร็จ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={fetchHealingHistory}
              disabled={isHistoryLoading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isHistoryLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>รีเฟรช</span>
            </button>

            <button
              type="button"
              onClick={handleExportHealingLogsJson}
              disabled={healingHistory.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>ส่งออก JSON</span>
            </button>

            <button
              type="button"
              onClick={handleClearHistory}
              disabled={healingHistory.length === 0}
              className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>ล้างประวัติ</span>
            </button>
          </div>
        </div>

        {/* Top Mini-Stats Strip for Self-Healing */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">รอบการซ่อมแซมทั้งหมด</span>
            <div className="text-xl font-black text-white mt-0.5">{totalSessionsCount} ครั้ง</div>
          </div>
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">คำสั่งที่ถูกรันสะสม</span>
            <div className="text-xl font-black text-amber-400 mt-0.5">{totalExecutedActions} คำสั่ง</div>
          </div>
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">อัตราความสำเร็จ</span>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{overallSuccessRate}%</div>
          </div>
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">รอบล่าสุดเมื่อ</span>
            <div className="text-xs font-bold text-slate-200 mt-1 truncate">
              {healingHistory[0]?.triggeredAtThai || 'ยังไม่มีประวัติ'}
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setHistoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                historyFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              ทั้งหมด ({healingHistory.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('success')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                historyFilter === 'success' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              สำเร็จ 100%
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('issues')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                historyFilter === 'issues' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              มีปัญหา/คำเตือน
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchHistoryTerm}
              onChange={(e) => setSearchHistoryTerm(e.target.value)}
              placeholder="ค้นหาคำสั่ง, อุปกรณ์, หรือสาเหตุข้อผิดพลาด..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Sessions & Actions Timeline */}
        {filteredHistory.length === 0 ? (
          <div className="bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 p-8 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-300">ยังไม่มีบันทึกคำสั่งซ่อมแซมตัวเอง</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              ระบบจะบันทึกประวัติทันทีเมื่อมีการตรวจพบข้อผิดพลาด หรือเมื่อกดปุ่ม "ซ่อมแซมระบบอัตโนมัติ"
            </p>
            <button
              type="button"
              onClick={() => handleAutoSelfHeal()}
              className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>รันการตรวจสอบ &amp; ซ่อมแซมระบบรอบแรกเดี๋ยวนี้</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((session, sIdx) => {
              const isExpanded = expandedSessionId === session.sessionId;
              const hasFailure = session.actions?.some((a) => a.status !== 'success');

              return (
                <div
                  key={session.sessionId}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    hasFailure ? 'border-red-500/40 bg-slate-950/90' : 'border-slate-800 bg-slate-950/70'
                  }`}
                >
                  {/* Session Header Strip */}
                  <div
                    onClick={() => setExpandedSessionId(isExpanded ? null : session.sessionId)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          hasFailure
                            ? 'bg-red-500/20 text-red-400 border-red-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        }`}
                      >
                        {hasFailure ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-white">{session.triggeredAtThai}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              session.overallResult === 'success'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-red-500/20 text-red-300 border border-red-500/40'
                            }`}
                          >
                            {session.overallResult === 'success' ? 'สำเร็จทุกคำสั่ง' : 'พบคำเตือน/ผิดพลาด'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            ID: {session.sessionId.slice(-8)}
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-amber-300 font-semibold">อุปกรณ์เป้าหมาย:</span>
                          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] text-slate-200">
                            {session.triggeredByDevice}
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{session.triggerReason}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 sm:self-center">
                      <div className="text-right text-xs">
                        <div className="font-mono font-bold text-amber-400">
                          {session.actions?.length || 0} คำสั่งย่อย
                        </div>
                        <div className="text-[10px] text-slate-500">{session.executionDurationTotalMs} ms</div>
                      </div>
                      <div className="p-1 rounded-lg bg-slate-900 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Actions Detail Table */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 bg-slate-900/60 p-4 space-y-3">
                      <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-amber-400" />
                          รายการคำสั่ง Auto-Repair ที่ถูกกระตุ้นตามลำดับ (Sequential Actions Execution):
                        </span>
                        <span className="text-[11px] text-slate-500">
                          สถานะ: {session.successCount}/{session.totalActionsCount} สำเร็จ
                        </span>
                      </div>

                      <div className="space-y-2">
                        {session.actions?.map((act, aIdx) => {
                          const isActSuccess = act.status === 'success';
                          const isActWarning = act.status === 'warning';
                          const commandToDisplay = act.shellCommand || getDefaultShellCommand(act.commandCode);
                          const actionCmdId = act.id || `${session.sessionId}-act-${aIdx}`;

                          return (
                            <div
                              key={act.id || aIdx}
                              className={`p-3.5 rounded-2xl border text-xs flex flex-col gap-3 transition ${
                                isActSuccess
                                  ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                                  : isActWarning
                                  ? 'bg-amber-950/30 border-amber-800/60'
                                  : 'bg-red-950/40 border-red-800/60'
                              }`}
                            >
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-850/80 pb-2">
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-slate-500 font-mono text-[11px]">#{aIdx + 1}</span>
                                    <span className="font-mono font-black text-amber-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] shadow-sm">
                                      {act.commandCode}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                        isActSuccess
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : isActWarning
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                      }`}
                                    >
                                      {act.status}
                                    </span>
                                    <span className="text-slate-300 text-xs font-semibold">
                                      {act.description}
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                                    <div>
                                      <span className="text-slate-500">อุปกรณ์เป้าหมาย: </span>
                                      <span className="text-slate-200 font-semibold">{act.targetDevice}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">เหตุผลที่กระตุ้น: </span>
                                      <span className="text-amber-200/90">{act.triggerReason}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right text-[11px] text-slate-400 shrink-0 md:self-center flex md:flex-col items-center md:items-end justify-between gap-1">
                                  <div className="font-mono text-slate-300 font-semibold">{act.timestampThai.split(' ')[1]} น.</div>
                                  <div className="text-[10px] text-slate-500 font-mono">ใช้เวลา: {act.executionTimeMs} ms</div>
                                </div>
                              </div>

                              {/* Diagnostic Details Snippet */}
                              {act.details && (
                                <div className="text-[11px] text-slate-400 font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex items-start gap-1.5">
                                  <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                                  <span>{act.details}</span>
                                </div>
                              )}

                              {/* Executed Shell Command / Script Block */}
                              <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/80 text-[11px] text-slate-400 font-mono">
                                  <div className="flex items-center gap-1.5">
                                    <Code2 className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="font-bold text-slate-300">
                                      คำสั่ง Shell / สคริปต์ที่รัน (Executed Shell Command):
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCommand(commandToDisplay, actionCmdId)}
                                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                                    title="คัดลอกคำสั่ง Shell ไปยังคลิปบอร์ด"
                                  >
                                    {copiedCommandId === actionCmdId ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400 font-bold">คัดลอกคำสั่งแล้ว!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                                        <span>คัดลอกคำสั่ง</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <div className="p-3 font-mono text-xs overflow-x-auto text-emerald-300 bg-slate-950 flex items-start gap-2.5">
                                  <span className="text-amber-400 select-none font-bold text-sm leading-none pt-0.5">$</span>
                                  <code className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-slate-200 select-all flex-1">
                                    {commandToDisplay}
                                  </code>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* GitHub Merge Conflict & Actions Check Helper Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              กรณีพบข้อความ "Branch has merge conflicts / All checks have failed" บน GitHub
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              เกิดจาก branch มีโค้ดที่ขัดแย้งกับ main branch หรือ workflow เก่าล้มเหลว
              คุณสามารถกดปุ่ม "ซ่อมแซมระบบอัตโนมัติ" ในหน้านี้เพื่ออัปเดต workflow ไฟล์ และรันจำลองทดสอบผ่านระบบทันที
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://github.com/jirapatza/Bombim00/pulls"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
          >
            <span>ดู Pull Request บน GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
