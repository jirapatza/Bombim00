import React, { Component, Suspense, lazy, useState, useEffect, useMemo, useCallback } from "react";
import { DeviceHealthPanel } from "./components/DeviceHealthPanel";
import { Header } from "./components/Header";
import { BottomNavigation, AppTab } from "./components/BottomNavigation";
import { LiveResultsScreen } from "./screens/LiveResultsScreen";
import { LotteryRepository } from "./data/lotteryRepository";
import { ThaiTtsService } from "./utils/thaiTts";
import { trackDiagnostic } from "./utils/siteDiagnostics";
import { ChunkRecovery } from "./utils/chunkRecovery";
import {
  LotteryCatalogItem,
  RawLotteryResult,
  SystemStatus,
  AppSettings,
  TicketCheckReport,
  FrequencyStat,
} from "./types/lottery";

// Secondary screens load on demand so the first paint ships less JavaScript.
// Each screen has its own factory so one failed chunk cannot blank the others,
// and each gets its own boundary and Suspense slot.
export type ScreenKey = "history" | "summary" | "checker" | "settings";

const screenLoaders: Record<
  ScreenKey,
  () => Promise<{ default: React.ComponentType<any> }>
> = {
  history: () => import("./screens/HistoryScreen").then((m) => ({ default: m.HistoryScreen })),
  summary: () => import("./screens/SummaryScreen").then((m) => ({ default: m.SummaryScreen })),
  checker: () => import("./screens/TicketCheckerScreen").then((m) => ({ default: m.TicketCheckerScreen })),
  settings: () => import("./screens/SettingsScreen").then((m) => ({ default: m.SettingsScreen })),
};

const chunkRecovery = new ChunkRecovery({
  storage: (() => {
    try {
      return typeof window === "undefined" ? null : window.sessionStorage;
    } catch {
      // Some privacy modes throw on access itself.
      return null;
    }
  })(),
  isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
  reload: () => window.location.reload(),
});

// A recovery reload rebuilds the app, so the active tab is kept across it:
// otherwise a chunk failure on Settings would always drop the user on the live tab.
const TAB_STORAGE_KEY = "lottery_active_tab";
const APP_TABS: AppTab[] = ["live", "history", "summary", "checker", "settings"];

const initialTab = (): AppTab => {
  try {
    const saved = window.sessionStorage.getItem(TAB_STORAGE_KEY);
    if (saved && (APP_TABS as string[]).includes(saved)) return saved as AppTab;
  } catch {
    /* Storage can be blocked; the live tab is the safe default. */
  }
  return "live";
};

// React.lazy caches a rejected import forever, so a retry needs a fresh lazy
// component rather than a re-render of the same one.
const lazyScreens = new Map<string, React.ComponentType<any>>();

const getScreenComponent = (key: ScreenKey, attempt: number): React.ComponentType<any> => {
  const cacheKey = `${key}#${attempt}`;
  const cached = lazyScreens.get(cacheKey);
  if (cached) return cached;
  // Only the current attempt is reachable, so earlier ones are dropped instead
  // of accumulating a rejected lazy component per retry tap.
  if (attempt > 0) lazyScreens.delete(`${key}#${attempt - 1}`);
  const created = lazy(async () => {
    const mod = await screenLoaders[key]();
    // Reaching a chunk proves the cached index.html is current, so a later
    // failure is allowed to trigger one more automatic reload.
    chunkRecovery.markChunkReady();
    return mod;
  });
  lazyScreens.set(cacheKey, created);
  return created;
};

const screenFallback = (
  <p role="status" className="p-4 text-sm text-slate-400">
    กำลังโหลด…
  </p>
);

type ScreenBoundaryProps = React.PropsWithChildren<{
  onError?: (error: unknown) => void;
  onRetry?: () => void;
}>;

class ScreenErrorBoundary extends Component<ScreenBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    // Anonymous health signal only: no message, stack or component tree leaves the browser.
    trackDiagnostic("frontend_render_error", "app");
    this.props.onError?.(error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-800 bg-amber-950 p-4 text-sm text-amber-100"
      >
        <p>โหลดหน้านี้ไม่สำเร็จ ส่วนอื่นของระบบยังใช้งานได้ตามปกติ</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {this.props.onRetry && (
            <button
              type="button"
              className="rounded-lg bg-amber-700 px-3 py-2 font-medium text-white hover:bg-amber-600"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onRetry?.();
              }}
            >
              ลองโหลดหน้านี้อีกครั้ง
            </button>
          )}
          <button
            type="button"
            className="rounded-lg border border-amber-700 px-3 py-2 font-medium text-amber-100 hover:bg-amber-900"
            onClick={() => window.location.reload()}
          >
            โหลดหน้าเว็บใหม่
          </button>
        </div>
      </div>
    );
  }
}

// A boundary per lazy screen: a chunk failure must never hide the live tab, the
// header, or the eagerly imported recovery panel on the settings tab.
const LazyScreen: React.FC<ScreenBoundaryProps> = ({ children, onError, onRetry }) => (
  <Suspense fallback={screenFallback}>
    <ScreenErrorBoundary onError={onError} onRetry={onRetry}>
      {children}
    </ScreenErrorBoundary>
  </Suspense>
);

// Vite reports a retired chunk as a failed dynamic import. Only swallow the error
// when a reload actually follows; otherwise the real reason must reach the boundary.
const installChunkRecovery = (): void => {
  if (typeof window === "undefined") return;
  window.addEventListener("vite:preloadError", (event) => {
    if (chunkRecovery.reloadAfterChunkError()) {
      event.preventDefault();
    }
  });
};

installChunkRecovery();

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>(initialTab);
  const [currentTimeString, setCurrentTimeString] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [lastSynced, setLastSynced] = useState("");
  const [liveDataError, setLiveDataError] = useState(false);
  const [screenAttempts, setScreenAttempts] = useState<Partial<Record<ScreenKey, number>>>({});
  const [contentAttempt, setContentAttempt] = useState(0);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(TAB_STORAGE_KEY, currentTab);
    } catch {
      /* Storage can be blocked; the tab simply will not survive a reload. */
    }
  }, [currentTab]);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    try {
      return localStorage.getItem("lottery_voice_enabled") !== "false";
    } catch {
      return true;
    }
  });

  // Core Data States
  const [lotteries, setLotteries] = useState<LotteryCatalogItem[]>(() =>
    LotteryRepository.getLotteries(),
  );
  const [results, setResults] = useState<RawLotteryResult[]>(() =>
    LotteryRepository.getResults(),
  );
  const [status, setStatus] = useState<SystemStatus>(() =>
    LotteryRepository.getStatus(),
  );
  const [settings, setSettings] =
    useState<AppSettings>(() => LotteryRepository.getSettings());
  const [watchedNumbers, setWatchedNumbers] = useState<string[]>(() =>
    LotteryRepository.getWatchedNumbers(),
  );
  const [ticketReports, setTicketReports] = useState<TicketCheckReport[]>([]);

  // Bangkok Clock Ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);
      setCurrentTimeString(timeStr);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute Statistics
  const top2Stats = useMemo<FrequencyStat[]>(() => {
    return LotteryRepository.getTop2DigitFrequency(15);
  }, [results]);

  const top3Stats = useMemo<FrequencyStat[]>(() => {
    return LotteryRepository.getTop3DigitFrequency(15);
  }, [results]);

  const todayLotteries = LotteryRepository.getLotteries();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await LotteryRepository.refresh();
      setStatus(LotteryRepository.getStatus());
      setLotteries(LotteryRepository.getLotteries());
      setResults(LotteryRepository.getResults());
      setLiveDataError(false);
      setLastSynced(
        new Intl.DateTimeFormat("th-TH", {
          timeZone: "Asia/Bangkok",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date()),
      );
      return true;
    } catch {
      setLiveDataError(true);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void handleRefresh();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [handleRefresh]);

  useEffect(() => {
    void handleRefresh();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void handleRefresh();
    };
    const timer = window.setInterval(refreshVisible, 15_000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [handleRefresh]);

  useEffect(() => {
    try {
      localStorage.setItem("lottery_voice_enabled", String(isVoiceEnabled));
    } catch {
      /* Browser storage can be unavailable. */
    }
  }, [isVoiceEnabled]);

  const handleToggleVoice = useCallback(() => {
    setIsVoiceEnabled((prev) => {
      const next = !prev;
      if (!next) {
        ThaiTtsService.stop();
      }
      return next;
    });
  }, []);

  const handleAddWatchedNumber = useCallback(
    (num: string) => {
      const updated = watchedNumbers.includes(num)
        ? watchedNumbers
        : [...watchedNumbers, num];
      LotteryRepository.setWatchedNumbers(updated);
      setWatchedNumbers(updated);
    },
    [watchedNumbers],
  );

  const handleRemoveWatchedNumber = useCallback(
    (num: string) => {
      const updated = watchedNumbers.filter((n) => n !== num);
      LotteryRepository.setWatchedNumbers(updated);
      setWatchedNumbers(updated);
    },
    [watchedNumbers],
  );

  const handleUpdateNtfy = useCallback(
    (server: string, topic: string, priority: string) => {
      const updated: AppSettings = {
        ...settings,
        ntfy: {
          ...settings.ntfy,
          server,
          topic,
          priority,
        },
      };
      LotteryRepository.saveSettings(updated);
      setSettings(updated);
    },
    [settings],
  );

  const handleCheckTickets = useCallback((input: string, drawKey: string) => {
    const reports = LotteryRepository.checkTickets(input, drawKey);
    setTicketReports(reports);
    return reports;
  }, []);

  const handleClearTickets = useCallback(() => {
    setTicketReports([]);
  }, []);

  const retryScreen = useCallback((key: ScreenKey) => {
    setScreenAttempts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }, []);

  // Only genuine chunk failures reload; ordinary render bugs must stay on screen
  // so the user keeps the dashboard and its data instead of losing the tab.
  const handleScreenError = useCallback((error: unknown) => {
    if (!(error instanceof Error)) return;
    const chunkFailure =
      /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(
        error.message,
      );
    if (chunkFailure) chunkRecovery.reloadAfterChunkError();
  }, []);

  const renderScreen = (key: ScreenKey, props: Record<string, unknown>) => {
    const Screen = getScreenComponent(key, screenAttempts[key] ?? 0);
    return (
      <LazyScreen
        key={key}
        onError={handleScreenError}
        onRetry={() => retryScreen(key)}
      >
        <Screen {...props} />
      </LazyScreen>
    );
  };

  return (
    <div className="app-shell">
      <BottomNavigation currentTab={currentTab} onChangeTab={setCurrentTab} />
      <div className="app-workspace">
        {/* Top Header */}
        <Header
          online={online}
          lastSynced={lastSynced}
          liveDataError={liveDataError}
          lastRunTimestamp={status.last_run_timestamp}
          checkerStatus={status.system_status}
          currentTimeString={currentTimeString}
          isVoiceEnabled={isVoiceEnabled}
          isRefreshing={isRefreshing}
          onToggleVoice={handleToggleVoice}
          onRefresh={handleRefresh}
        />

        {/* Main Content Area. The outer boundary keeps a render bug in the eager
            live screen or the recovery panel from blanking the whole dashboard. */}
        <main className="app-main">
          <ScreenErrorBoundary
            key={`content-${contentAttempt}`}
            onError={handleScreenError}
            onRetry={() => setContentAttempt((n) => n + 1)}
          >
            {liveDataError && (
              <p
                role="status"
                className="mb-3 rounded-xl bg-amber-950 p-3 text-sm text-amber-200"
              >
                โหลดข้อมูลล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลที่มีอยู่
              </p>
            )}
            {currentTab === "live" && (
              <LiveResultsScreen
                lotteries={todayLotteries}
                watchedNumbers={watchedNumbers}
                isVoiceEnabled={isVoiceEnabled}
                onSettings={() => setCurrentTab("settings")}
              />
            )}

            {currentTab === "history" &&
              renderScreen("history", { results, top2Stats, top3Stats })}

            {currentTab === "summary" && renderScreen("summary", { lotteries: todayLotteries })}

            {currentTab === "checker" &&
              renderScreen("checker", {
                reports: ticketReports,
                onCheck: handleCheckTickets,
                onClear: handleClearTickets,
              })}

            {currentTab === "settings" && (
              <div className="settings-layout">
                <DeviceHealthPanel
                  online={online}
                  lastSynced={lastSynced}
                  status={status}
                  liveDataError={liveDataError}
                  isRefreshing={isRefreshing}
                  onRecover={handleRefresh}
                />
                {renderScreen("settings", {
                  settings,
                  status,
                  watchedNumbers,
                  isVoiceEnabled,
                  onToggleVoice: handleToggleVoice,
                  onAddWatchedNumber: handleAddWatchedNumber,
                  onRemoveWatchedNumber: handleRemoveWatchedNumber,
                  onUpdateNtfy: handleUpdateNtfy,
                })}
              </div>
            )}
          </ScreenErrorBoundary>
        </main>

        <footer className="app-footer">
          ข้อมูลจากแหล่งประกาศผล • ตรวจสอบกับผู้จัดสลากก่อนใช้ผลรางวัล{" "}
          <span>Asia/Bangkok (UTC+7)</span>
        </footer>
      </div>
    </div>
  );
};
export default App;
