import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { BottomNavigation, AppTab } from './components/BottomNavigation';
import { LiveResultsScreen } from './screens/LiveResultsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { TicketCheckerScreen } from './screens/TicketCheckerScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LotteryRepository } from './data/lotteryRepository';
import { ThaiTtsService } from './utils/thaiTts';
import {
  LotteryCatalogItem,
  RawLotteryResult,
  SystemStatus,
  AppSettings,
  TicketCheckReport,
  FrequencyStat,
} from './types/lottery';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>('live');
  const [currentTimeString, setCurrentTimeString] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  // Core Data States
  const [lotteries, setLotteries] = useState<LotteryCatalogItem[]>(() =>
    LotteryRepository.getLotteries()
  );
  const [results, setResults] = useState<RawLotteryResult[]>(() => LotteryRepository.getResults());
  const [status, setStatus] = useState<SystemStatus>(() => LotteryRepository.getStatus());
  const [settings, setSettings] = useState<AppSettings>(() => LotteryRepository.getSettings());
  const [watchedNumbers, setWatchedNumbers] = useState<string[]>(() =>
    LotteryRepository.getWatchedNumbers()
  );
  const [ticketReports, setTicketReports] = useState<TicketCheckReport[]>([]);

  // Bangkok Clock Ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
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
  }, []);

  const top3Stats = useMemo<FrequencyStat[]>(() => {
    return LotteryRepository.getTop3DigitFrequency(15);
  }, []);

  // Compute Next Closing Lottery
  const nextClosing = useMemo(() => {
    return LotteryRepository.getNextClosingLottery(lotteries);
  }, [lotteries]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      const refreshed = LotteryRepository.refresh();
      setStatus(refreshed.status);
      setLotteries([...refreshed.lotteries]);
      setResults([...LotteryRepository.getResults()]);
      setIsRefreshing(false);
    }, 600);
  }, []);

  const handleToggleVoice = useCallback(() => {
    setIsVoiceEnabled((prev) => {
      const next = !prev;
      if (!next) {
        ThaiTtsService.stop();
      }
      return next;
    });
  }, []);

  const handleAddWatchedNumber = useCallback((num: string) => {
    setWatchedNumbers((prev) => {
      if (prev.includes(num)) return prev;
      const updated = [...prev, num];
      LotteryRepository.setWatchedNumbers(updated);
      return updated;
    });
  }, []);

  const handleRemoveWatchedNumber = useCallback((num: string) => {
    setWatchedNumbers((prev) => {
      const updated = prev.filter((n) => n !== num);
      LotteryRepository.setWatchedNumbers(updated);
      return updated;
    });
  }, []);

  const handleUpdateNtfy = useCallback(
    (server: string, topic: string, priority: string) => {
      setSettings((prev) => {
        const updated: AppSettings = {
          ...prev,
          ntfy: {
            ...prev.ntfy,
            server,
            topic,
            priority,
          },
        };
        LotteryRepository.saveSettings(updated);
        return updated;
      });
    },
    []
  );

  const handleCheckTickets = useCallback((input: string) => {
    const reports = LotteryRepository.checkTickets(input);
    setTicketReports(reports);
  }, []);

  const handleClearTickets = useCallback(() => {
    setTicketReports([]);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <Header
        currentTimeString={currentTimeString}
        isVoiceEnabled={isVoiceEnabled}
        isRefreshing={isRefreshing}
        onToggleVoice={handleToggleVoice}
        onRefresh={handleRefresh}
      />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        {currentTab === 'live' && (
          <LiveResultsScreen
            lotteries={lotteries}
            watchedNumbers={watchedNumbers}
            isVoiceEnabled={isVoiceEnabled}
            nextClosing={nextClosing}
          />
        )}

        {currentTab === 'history' && (
          <HistoryScreen
            results={results}
            top2Stats={top2Stats}
            top3Stats={top3Stats}
          />
        )}

        {currentTab === 'summary' && <SummaryScreen lotteries={lotteries} />}

        {currentTab === 'checker' && (
          <TicketCheckerScreen
            reports={ticketReports}
            onCheck={handleCheckTickets}
            onClear={handleClearTickets}
          />
        )}

        {currentTab === 'settings' && (
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
        )}
      </main>

      {/* Bottom Tab Navigation */}
      <BottomNavigation currentTab={currentTab} onChangeTab={setCurrentTab} />
    </div>
  );
};
export default App;
