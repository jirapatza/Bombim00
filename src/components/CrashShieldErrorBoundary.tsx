import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  ShieldAlert,
  RotateCcw,
  RefreshCw,
  Home,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  LifeBuoy
} from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  isolateScope?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
  autoRecoverCountdown: number | null;
}

/**
 * CrashShieldErrorBoundary
 * ระบบป้องกันระบบล่มอัตโนมัติ (Anti-Crash, Fault-Tolerance & Auto-Recovery)
 * ป้องกันไม่ให้แอปพลิเคชันค้าง จอดำ หรือหยุดทำงานเมื่อเกิดข้อผิดพลาดรันไทม์
 */
export class CrashShieldErrorBoundary extends Component<Props, State> {
  private timer: any = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
      autoRecoverCountdown: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.log('[CRASH-SHIELD] Caught client-side runtime error:', error.message);
    this.setState({ errorInfo });

    // Optional auto-recover countdown for isolated widgets
    if (this.props.isolateScope) {
      this.setState({ autoRecoverCountdown: 5 });
      this.timer = setInterval(() => {
        this.setState((prev) => {
          if (prev.autoRecoverCountdown === null || prev.autoRecoverCountdown <= 1) {
            clearInterval(this.timer);
            this.handleReset();
            return { autoRecoverCountdown: null };
          }
          return { autoRecoverCountdown: prev.autoRecoverCountdown - 1 };
        });
      }, 1000);
    }
  }

  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }

  handleReset = () => {
    if (this.timer) clearInterval(this.timer);
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      autoRecoverCountdown: null,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleHardReload = () => {
    try {
      // Safe cleanup of temporary invalid states
      sessionStorage.clear();
    } catch {
      // Ignore sessionStorage security exceptions
    }
    window.location.reload();
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('activeTab');
      localStorage.removeItem('lastSelectedLottery');
      sessionStorage.clear();
    } catch {
      // Ignore
    }
    window.location.reload();
  };

  handleCopyReport = () => {
    const report = [
      '=== CRASH SHIELD INCIDENT REPORT ===',
      `Timestamp: ${new Date().toISOString()}`,
      `Error: ${this.state.error?.message || 'Unknown error'}`,
      `Stack: ${this.state.error?.stack || 'No stack'}`,
      `Component Stack: ${this.state.errorInfo?.componentStack || 'No component stack'}`,
    ].join('\n');

    navigator.clipboard?.writeText(report);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      const isIsolated = Boolean(this.props.isolateScope);

      if (isIsolated) {
        // Compact fallback for inner component isolation
        return (
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-sky-400/30 text-slate-200 shadow-xl space-y-3 my-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-300 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-sky-200">
                    {this.props.fallbackTitle || 'ระบบป้องกันส่วนประกอบล่มทำงาน (Safe Recovery Active)'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    ตรวจพบข้อผิดพลาดในส่วนประกอบนี้ ระบบได้แยกส่วนเพื่อไม่ให้กระทบทั้งหน้าจอ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {this.state.autoRecoverCountdown !== null
                  ? `กู้คืนอัตโนมัติ (${this.state.autoRecoverCountdown}s)`
                  : 'รีเซ็ตและกู้คืน'}
              </button>
            </div>
          </div>
        );
      }

      // Full-page shield fallback
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-cyan-400/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
            <div className="absolute top-0 right-0 translate-x-12 -translate-y-12 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-400 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/25 shrink-0">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-400/15 text-cyan-200 border border-cyan-400/40 uppercase">
                    Crash Shield Active
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date().toLocaleTimeString('th-TH')}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                  ระบบป้องกันระบบล่มทำงาน (Anti-Crash Shield)
                </h1>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  ระบบตรวจพบข้อผิดพลาดที่ไม่คาดคิดในส่วนการแสดงผล เกราะป้องกันได้แยกข้อผิดพลาดทันทีเพื่อป้องกันไม่ให้แอปพลิเคชันค้างหรือหยุดทำงาน
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>ข้อความสาเหตุ:</span>
              </div>
              <div className="text-slate-300 font-mono bg-slate-900 p-2.5 rounded-xl border border-slate-800/80 break-words max-h-24 overflow-y-auto">
                {this.state.error?.message || 'Unexpected application render condition'}
              </div>
            </div>

            {/* Recovery Action Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-400 hover:from-sky-400 hover:to-cyan-300 text-slate-950 font-black text-sm shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
              >
                <RotateCcw className="w-4 h-4" />
                กู้คืนระบบและเริ่มทำงานต่อทันที (Auto-Recover)
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={this.handleHardReload}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  รีโหลดหน้านี้ใหม่
                </button>
                <button
                  type="button"
                  onClick={this.handleClearCacheAndReload}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-slate-700"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  ล้างแคชและเริ่มใหม่
                </button>
              </div>
            </div>

            {/* Collapsible Technical Details */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>{this.state.showDetails ? 'ซ่อนรายละเอียดทางเทคนิค' : 'แสดงข้อมูลวิเคราะห์ข้อผิดพลาด'}</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleCopyReport}
                  className="text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer text-[11px]"
                >
                  {this.state.copied ? <Check className="w-3.5 h-3.5 text-cyan-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{this.state.copied ? 'คัดลอกรายงานแล้ว' : 'คัดลอกรายงาน'}</span>
                </button>
              </div>

              {this.state.showDetails && (
                <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-48 space-y-1">
                  <div className="text-cyan-300 font-bold">Stack Trace:</div>
                  <pre className="whitespace-pre-wrap">{this.state.error?.stack || 'No stack trace available'}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
