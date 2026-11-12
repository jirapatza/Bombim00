import React, { Suspense, lazy, useState, useEffect, useMemo, useCallback } from "react";
import { DeviceHealthPanel } from "./components/DeviceHealthPanel";
import { Header } from "./components/Header";
import { BottomNavigation, AppTab } from "./components/BottomNavigation";
import { LiveResultsScreen } from "./screens/LiveResultsScreen";
import { LotteryRepository } from "./data/lotteryRepository";
import { ThaiTtsService } from "./utils/thaiTts";
import {
  LotteryCatalogItem,
  RawLotteryResult,
  SystemStatus,
  AppSettings,
  TicketCheckReport,
  FrequencyStat,
} from "./types/lottery";

// Secondary screens load on demand so the first paint ships less JavaScript.
const HistoryScreen = lazy(() => import("./screens/HistoryScreen").then((m) => ({ default: m.HistoryScreen })));
const SummaryScreen = lazy(() => import("./screens/SummaryScreen").then((m) => ({ default: m.SummaryScreen })));
const TicketCheckerScreen = lazy(() => import("./screens/TicketCheckerScreen").then((m) => ({ default: m.TicketCheckerScreen })));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen").then((m) => ({ default: m.SettingsScreen })));

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>("live");
  const [currentTimeString, setCurrentTimeString] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [lastSynced, setLastSynced] = useState("");
  const [liveDataError, setLiveDataError] = useState(false);
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
  const [settings, setSettings] = useState<AppSettings>(() =>
    LotteryRepository.getSettings(),
  );
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

        {/* Main Content Area */}
        <main className="app-main">
          <Suspense fallback={<p role="status" className="p-4 text-sm text-slate-400">กำลังโหลด…</p>}>
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

          {currentTab === "history" && (
            <HistoryScreen
              results={results}
              top2Stats={top2Stats}
              top3Stats={top3Stats}
            />
          )}

          {currentTab === "summary" && (
            <SummaryScreen lotteries={todayLotteries} />
          )}

          {currentTab === "checker" && (
            <TicketCheckerScreen
              reports={ticketReports}
              onCheck={handleCheckTickets}
              onClear={handleClearTickets}
            />
          )}

          {currentTab === "settings" && (
            <>
              <div className="settings-layout">
                <DeviceHealthPanel
                  online={online}
                  lastSynced={lastSynced}
                  status={status}
                  liveDataError={liveDataError}
                  isRefreshing={isRefreshing}
                  onRecover={handleRefresh}
                />
                <SettingsScreen
                  settings={settings}
                  status={status}
                  watchedNumbers={watchedNumbers}
                  isVoiceEnabled={isVoiceEnabled}
                  onToggleVoice={handleToggleVoice}
                  onAddWatchedNumber={handleAddWatchedNumber}
                  onRemoveWatchedNumber={handleRemoveWatchedNumber}
                  onUpdateNtfy={handleUpdateNtfy}
                />
              </div>
            </>
          )}
          </Suspense>
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
