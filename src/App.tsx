import { startSpeechPlayback, playNotificationChime } from './utils/speechPlayback';
import './overview.css';
import { ResultsOverview, IndividualHistory } from './components/ResultsOverview';
import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import bundledLotteryCatalog from '../data/all_lotteries.json';
import { apiFetch, loginDashboard } from './utils/api';
import { waitForDispatchedWorkflow } from './utils/workflowTracking';
import { getResultNumbers, formatResultPair, matchesLottery } from './utils/lotteryResult';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Settings,
  FileCode2,
  Bookmark,
  CheckSquare,
  Send,
  Sliders,
  History,
  Shield,
  ExternalLink,
  Copy,
  Download,
  Search,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Database,
  Play,
  Flame,
  Check,
  Code2,
  Terminal,
  FolderGit2,
  Info,
  Volume2,
  VolumeX,
  X,
  Clock,
  Calendar,
  Radio,
  Trophy,
  RotateCcw,
  Zap,
  Layers,
  Palette,
  Type,
  FileText,
  Eye,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  RotateCw,
  StopCircle,
  AlertCircle,
  Activity,
  Tv,
  Share2,
  BarChart3,
  Ticket,
  Rocket,
  ListFilter,
  Github,
  ListOrdered,
  TableProperties,
  TrendingUp,
  Globe,
  Mic,
} from 'lucide-react';

const BatchTicketChecker = lazy(() => import('./components/BatchTicketChecker').then((module) => ({ default: module.BatchTicketChecker })));
import type { LotteryItem } from './components/DailySummaryTable';
const DailySummaryTable = lazy(() => import('./components/DailySummaryTable').then((module) => ({ default: module.DailySummaryTable })));
import { LatestThreeResults } from './components/LatestThreeResults';
import { filterLotteriesForDrawDate, isGovernmentLottery } from './utils/lotterySchedule';
// Local lottery catalog fallback for the web dashboard.
// The source JSON also contains sample-looking prize fields; never expose those as live results.
const bundledLotteryFallback: LotteryItem[] = (bundledLotteryCatalog as LotteryItem[]).map((item) => ({
  ...item,
  top3: '',
  bottom2: '',
  firstPrize: '',
  status: 'waiting',
  date: 'ไม่ระบุ',
  source: 'ตารางกำหนดเวลา — รอผลจริงจากแหล่งข้อมูล',
}));


const GitHubAppRunner = lazy(() => import('./components/GitHubAppRunner').then((module) => ({ default: module.GitHubAppRunner })));
import { LiveUpcomingDraws } from './components/LiveUpcomingDraws';
import { SettingsCenter } from './components/SettingsCenter';
const DataAccuracyCenter = lazy(() => import('./components/DataAccuracyCenter').then((module) => ({ default: module.DataAccuracyCenter })));
const SystemMonitorKiosk = lazy(() => import('./components/SystemMonitorKiosk').then((module) => ({ default: module.SystemMonitorKiosk })));
import { CrashShieldErrorBoundary } from './components/CrashShieldErrorBoundary';
import { ShieldCheck } from 'lucide-react';
const AdminBackOfficeModal = lazy(() => import('./components/AdminBackOfficeModal').then((module) => ({ default: module.AdminBackOfficeModal })));

interface LotteryResult {
  ชื่อหวย?: string;
  หมวดหวย?: string;
  หวย?: string;
  งวดวันที่: string;
  วันที่จัดรูปแบบ?: string;
  รางวัลที่_1: string;
  เลขท้าย_2_ตัว: string;
  เลขบน_3_ตัว?: string;
  เลขล่าง_2_ตัว?: string;
  เลขหน้า_3_ตัว?: string[];
  เลขท้าย_3_ตัว?: string[];
  รางวัลข้างเคียงรางวัลที่_1?: string[];
  รางวัลที่_2?: string[];
  แหล่งข้อมูล?: string;
  เวลาที่ตรวจพบ?: string;
  สถานะการแจ้งเตือน?: string;
}

interface SystemStatus {
  system_status: string;
  last_run_timestamp?: string;
  last_run_date_thai?: string;
  total_checks?: number;
  last_source_used?: string;
  status_message?: string;
  active_sources_count?: number;
  latest_draw_detected?: string;
  notifications_sent_today?: number;
  sources_health?: Record<string, { status: string; last_response_ms?: number | null; last_checked?: string | null }>;
  recent_logs?: Array<{ timestamp: string; level: string; message: string }>;
}


export interface LotteryAnnouncement {
  id: string;
  lotteryName: string;
  drawDate: string;
  firstPrize: string;
  last2Digits: string;
  front3Digits?: string[];
  last3Digits?: string[];
  adjacentPrizes?: string[];
  source?: string;
  nextClosing: {
    name: string;
    closeTimeStr: string;
    remainingText: string;
  };
  note?: string;
}

interface LotteryScheduleItem {
  id: string;
  name: string;
  category: LotteryItem['category'];
  closeTimeStr: string;
  closeHour: number;
  closeMinute: number;
  drawDaysLabel: string;
}

// The catalogue is the single source of truth for names, draw days and closing times.
const LOTTERY_SCHEDULE: LotteryScheduleItem[] = (bundledLotteryCatalog as LotteryItem[])
  .filter((item) => !isGovernmentLottery(item))
  .map((item) => {
    const match = String(item.closeTimeStr || '').match(/(\d{1,2})[:.](\d{2})/);
    if (!match) return null;
    const rawHour = Number(match[1]);
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      closeTimeStr: item.closeTimeStr,
      closeHour: rawHour < 4 ? rawHour + 24 : rawHour,
      closeMinute: Number(match[2]),
      drawDaysLabel: item.drawDays || '',
    };
  })
  .filter((item): item is LotteryScheduleItem => item !== null);

function getBangkokClockParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'long', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return {
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')), minute: Number(value('minute')),
    day: Number(value('day')), weekday: value('weekday'),
  };
}

function isLotteryScheduledOnDate(item: LotteryScheduleItem, dateKey: string): boolean {
  // Share the Bangkok-time draw-day rules used by the live and summary views.
  return filterLotteriesForDrawDate([{
    id: item.id,
    name: item.name,
    category: item.category,
    drawDays: item.drawDaysLabel,
  }], new Date(`${dateKey}T12:00:00+07:00`)).length > 0;
}
function selectThaiVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;
  const thaiVoices = voices.filter(
    (voice) => voice.lang.toLowerCase().replace('_', '-').startsWith('th') || /thai|ไทย/i.test(voice.name)
  );
  if (thaiVoices.length > 0) {
    return (
      thaiVoices.find((v) => /kanya|niwat|google|siri/i.test(v.name)) ||
      thaiVoices.find((v) => /th-th|th_th/i.test(v.lang)) ||
      thaiVoices[0]
    );
  }
  return undefined;
}

// Exact canonical keys keep normal, VIP, special and VISA draws separate.
function normalizeResultLotteryKey(value: unknown): string {
  const text = String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  const vip = /vip|วีไอพี/i.test(text);
  return text
    .replace(/vip|วีไอพี/gi, '')
    .replace(/นิคเคอิ/g, 'นิเคอิ')
    .replace(/^หวยหุ้น|^หวย|^หุ้น/u, '')
    .replace(/รอบ(?=เช้า|บ่าย)/gu, '')
    .replace(/\(ไทย\)/gu, '')
    .replace(/[\s._#()–—-]+/g, '') + (vip ? 'vip' : '');
}

function providerDrawDateIso(row: any): string {
  const months: Record<string, number> = {
    มกราคม: 1, มค: 1, กุมภาพันธ์: 2, กพ: 2, มีนาคม: 3, มีค: 3,
    เมษายน: 4, เมย: 4, พฤษภาคม: 5, พค: 5, มิถุนายน: 6, มิย: 6,
    กรกฎาคม: 7, กค: 7, สิงหาคม: 8, สค: 8, กันยายน: 9, กย: 9,
    ตุลาคม: 10, ตค: 10, พฤศจิกายน: 11, พย: 11, ธันวาคม: 12, ธค: 12,
  };
  for (const raw of [row?.งวดวันที่, row?.draw_date, row?.drawDate, row?.date, row?.วันที่จัดรูปแบบ]) {
    const text = String(raw ?? '').trim();
    let year = 0, month = 0, day = 0;
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/);
    const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:$|\s)/);
    const thai = text.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{4})(?:$|\s)/);
    if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    else if (dmy) [year, month, day] = [Number(dmy[3]), Number(dmy[2]), Number(dmy[1])];
    else if (thai) [year, month, day] = [Number(thai[3]), months[thai[2].replace(/\./g, '')] || 0, Number(thai[1])];
    if (year >= 2400) year -= 543;
    if (!year || !month || !day) continue;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return '';
}


function mergeCatalogWithProviderResults(catalog: LotteryItem[], rows: LotteryResult[], todayIso: string): LotteryItem[] {
  const actualResults = rows.map((row) => ({ row, date: providerDrawDateIso(row), ...getResultNumbers(row) }))
    .filter((result) => result.date && result.top3 && result.bottom2)
    .sort((a, b) => b.date.localeCompare(a.date) ||
      (Date.parse(b.row.เวลาที่ตรวจพบ || '') || 0) - (Date.parse(a.row.เวลาที่ตรวจพบ || '') || 0));
  return catalog.map((item) => {
    const actual = actualResults.find(({ row }) => matchesLottery(item, row));
    if (!actual) {
      return { ...item, top3: '', bottom2: '', firstPrize: '', date: '', status: 'waiting', source: 'รอผลจริงจากแหล่งข้อมูล' };
    }
    return {
      ...item,
      // Today's catalog must never reuse an older draw's numbers in live or image views.
      // The complete historical record remains available in the separate results feed.
      top3: actual.date === todayIso ? actual.top3 : '',
      bottom2: actual.date === todayIso ? actual.bottom2 : '',
      firstPrize: actual.date === todayIso ? actual.row.รางวัลที่_1 || actual.top3 : '',
      date: actual.row.งวดวันที่ || actual.date,
      source: actual.row.แหล่งข้อมูล || 'แหล่งข้อมูลผลหวย',
      status: actual.date === todayIso ? 'announced' : 'waiting',
    };
  });
}

function getLotteryResultFingerprint(row: any): string {
  const { top3, bottom2 } = getResultNumbers(row);
  return JSON.stringify([
    normalizeResultLotteryKey(row?.หวย || row?.ชื่อหวย || row?.lotteryName),
    providerDrawDateIso(row), top3, bottom2,
  ]);
}

function getNextClosingLottery(currentTime = new Date()): { name: string; closeTimeStr: string; remainingText: string } {
  const bangkokNow = getBangkokClockParts(currentTime);
  let currentHour = bangkokNow.hour;
  // If midnight to 03:00, count as 24..27
  if (currentHour < 4) {
    currentHour += 24;
  }
  const currentMinutes = currentHour * 60 + bangkokNow.minute;
  const todaysSchedule = LOTTERY_SCHEDULE.filter((item) =>
    isLotteryScheduledOnDate(item, bangkokNow.dateKey)
  );

  for (const item of todaysSchedule) {
    const itemMinutes = item.closeHour * 60 + item.closeMinute;
    if (itemMinutes > currentMinutes) {
      const diff = itemMinutes - currentMinutes;
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      let remainingText = '';
      if (hours > 0) {
        remainingText = `อีกประมาณ ${hours} ชั่วโมง ${mins} นาที`;
      } else {
        remainingText = `อีกประมาณ ${mins} นาที`;
      }
      return {
        name: item.name,
        closeTimeStr: item.closeTimeStr,
        remainingText,
      };
    }
  }

  return {
    name: LOTTERY_SCHEDULE[0]?.name || 'รอประกาศรอบถัดไป',
    closeTimeStr: LOTTERY_SCHEDULE[0] ? LOTTERY_SCHEDULE[0].closeTimeStr + ' (รอบเช้า)' : 'ไม่ระบุ',
    remainingText: 'รอบเช้าถัดไป',
  };
}

function playChime() { void playNotificationChime(); }

const THAI_NUMBER_WORDS: Record<string, string> = {
  '0': 'ศูนย์',
  '1': 'หนึ่ง',
  '2': 'สอง',
  '3': 'สาม',
  '4': 'สี่',
  '5': 'ห้า',
  '6': 'หก',
  '7': 'เจ็ด',
  '8': 'แปด',
  '9': 'เก้า',
};

function spellDigits(numStr: string): string {
  if (!numStr || numStr === '-' || numStr === '--' || numStr === '---') return 'ยังไม่ออก';
  return numStr
    .trim()
    .split('')
    .map((char) => THAI_NUMBER_WORDS[char] || char)
    .join(' ');
}

// Message template presets
const TEMPLATE_PRESETS = {
  standard: {
    name: 'มาตรฐานทางการ (Standard)',
    title: '📢 ผล{lottery_name} งวด {draw_date}',
    body: '{top3} - {last_2}',
    speech_script: 'ประกาศผล {lottery_name}. สามตัวบน {first_prize_spelled}. สองตัวล่าง {last_2_spelled}.',
    polite_particle: 'ครับ',
    font_family: 'sans',
    font_size: 'large',
    modal_theme: 'gold',
  },
  compact: {
    name: 'กระชับ ฉับไว (Compact)',
    title: '⚡ ผลด่วน {lottery_name} ({draw_date})',
    body: '{top3} - {last_2}',
    speech_script: 'ประกาศผล {lottery_name}. สามตัวบน {first_prize_spelled}. สองตัวล่าง {last_2_spelled}.',
    polite_particle: 'ครับ',
    font_family: 'mono',
    font_size: 'medium',
    modal_theme: 'emerald',
  },
  lucky: {
    name: 'สายมู มหามงคล (Lucky / Fortune)',
    title: '🧧 มหาเฮง! ผล{lottery_name} งวด {draw_date}',
    body: '{top3} - {last_2}',
    speech_script: 'ประกาศผล {lottery_name}. สามตัวบน {first_prize_spelled}. สองตัวล่าง {last_2_spelled}.',
    polite_particle: 'ครับ',
    font_family: 'sans',
    font_size: 'xlarge',
    modal_theme: 'ruby',
  },
  minimal: {
    name: 'มินิมอล เน้นตัวเลข (Minimalist)',
    title: '{lottery_name} • {draw_date}',
    body: '{top3} - {last_2}',
    speech_script: 'ประกาศผล {lottery_name}. สามตัวบน {first_prize_spelled}. สองตัวล่าง {last_2_spelled}.',
    polite_particle: '',
    font_family: 'mono',
    font_size: 'large',
    modal_theme: 'cyber',
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'summary' | 'checker' | 'live' | 'history' | 'stats' | 'notifications' | 'accuracy' | 'batch' | 'results' | 'settings' | 'diagnostics'
  >('live');
  const [isAdminBackOfficeOpen, setIsAdminBackOfficeOpen] = useState<boolean>(false);
  const [checkerSubTab, setCheckerSubTab] = useState<'accuracy' | 'batch' | 'history'>('accuracy');
  const [historyPrizeFilter, setHistoryPrizeFilter] = useState<'all' | 'first' | 'last2' | '3digits' | 'thai'>('all');
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [results, setResults] = useState<LotteryResult[]>([]);
  const [allLotteries, setAllLotteries] = useState<LotteryItem[]>(bundledLotteryFallback);
  const [selectedCatalogLottery, setSelectedCatalogLottery] = useState<LotteryItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('lottery_checker.py');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const fetchDataInFlightRef = useRef<boolean>(false);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Settings raw editor state
  const [rawSettingsMode, setRawSettingsMode] = useState<boolean>(false);

  // Ticket Checker state
  const [ticketInput, setTicketInput] = useState<string>('');
  const [ticketResult, setTicketResult] = useState<{ checked: boolean; wins: string[]; message: string } | null>(null);

  // Tester state
  const [testTopic, setTestTopic] = useState<string>('my-lottery-alert-test');
  const [testPriority, setTestPriority] = useState<string>('high');
  const [testCustomMessage, setTestCustomMessage] = useState<string>('ข้อความทดสอบแจ้งเตือนหวย VIP และหุ้นต่างประเทศ (ไม่ใช่ผลหวยจริง)');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);

  // Watched number input
  const [newWatchedNumber, setNewWatchedNumber] = useState<string>('');

  // ==================== REAL-TIME MODAL & SEQUENTIAL VOICE QUEUE STATE ====================
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [announcementQueue, setAnnouncementQueue] = useState<LotteryAnnouncement[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [audioReady, setAudioReady] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const voiceEnabledRef = useRef(true);
  voiceEnabledRef.current = voiceEnabled;
  const speechCleanupRef = useRef<(() => void) | null>(null);
  const [foregroundWarning, setForegroundWarning] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(0.95);
  const [isTransitioningQueue, setIsTransitioningQueue] = useState<boolean>(false);

  // ==================== MESSAGE & TYPOGRAPHY CUSTOMIZATION STATE ====================
  const [templateTitle, setTemplateTitle] = useState<string>('📢 ผล{lottery_name} งวด {draw_date}');
  const [templateBody, setTemplateBody] = useState<string>('{top3} - {last_2}');
  const [speechScript, setSpeechScript] = useState<string>('ประกาศผล {lottery_name}. สามตัวบน {first_prize_spelled}. สองตัวล่าง {last_2_spelled}.');
  const [politeParticle, setPoliteParticle] = useState<string>('ครับ');
  const [modalTheme, setModalTheme] = useState<string>('gold');
  const [fontSize, setFontSize] = useState<string>('large');
  const [fontFamily, setFontFamily] = useState<string>('sans');

  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const queueTimeoutRef = useRef<any>(null);
  const announcementQueueRef = useRef<LotteryAnnouncement[]>([]);
  const knownResultsRef = useRef<Set<string> | null>(null);
  const latestProviderResultsRef = useRef<LotteryResult[]>([]);
  const triggerAnnouncementsRef = useRef<(items: LotteryAnnouncement[]) => void>(() => {});
  const lastClosingAlertKeyRef = useRef<string | null>(null);

  const showToast = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => setNotificationToast(null), 3500);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('คัดลอกลง Clipboard เรียบร้อยแล้ว');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const stopSpeech = () => {
    speechCleanupRef.current?.();
    speechCleanupRef.current = null;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsTransitioningQueue(false);
    if (queueTimeoutRef.current) {
      clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
  };

  const handleCloseModal = () => {
    stopSpeech();
    setIsModalOpen(false);
    setAnnouncementQueue([]);
    setCurrentQueueIndex(0);
  };

  // Every lottery uses the same concise three-upper/two-lower announcement.
  const buildSpeechText = (item: LotteryAnnouncement): string => {
    const { top3, bottom2 } = getResultNumbers({ firstPrize: item.firstPrize, bottom2: item.last2Digits });
    return `ประกาศผล ${item.lotteryName}. สามตัวบน ${spellDigits(top3)}. สองตัวล่าง ${spellDigits(bottom2)}.`;
  };

  // Speak announcement in Thai and proceed sequentially
  const speakCurrentAnnouncement = (item: LotteryAnnouncement, index: number, total: number) => {
    if (!voiceEnabledRef.current || !('speechSynthesis' in window)) {
      setIsSpeaking(false);
      return;
    }

    if (!audioUnlockedRef.current) {
      setSpeechError('แตะฟังซ้ำหรือเปิดและทดสอบเสียง เพื่ออนุญาตเสียงบนเครื่องนี้');
      return;
    }
    stopSpeech();
    setSpeechError(null);

    const speechText = buildSpeechText(item);

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'th-TH';
    utterance.rate = speechRate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = selectThaiVoice(voices);
    if (thaiVoice) {
      utterance.voice = thaiVoice;
    }

    let advanced = false;
    const advanceQueue = () => {
      if (advanced) return;
      advanced = true;
      setIsSpeaking(false);
      activeUtteranceRef.current = null;
      const nextIndex = index + 1;
      if (nextIndex >= total) return;
      setIsTransitioningQueue(true);
      queueTimeoutRef.current = setTimeout(() => {
        setIsTransitioningQueue(false);
        const nextItem = announcementQueueRef.current[nextIndex];
        if (!nextItem) {
          console.warn('Announcement queue item missing at index', nextIndex);
          return;
        }
        setCurrentQueueIndex(nextIndex);
        speakCurrentAnnouncement(nextItem, nextIndex, announcementQueueRef.current.length);
      }, 1200);
    };

    activeUtteranceRef.current = utterance;
    speechCleanupRef.current = startSpeechPlayback(window.speechSynthesis, utterance, {
      onStart: () => { setIsSpeaking(true); setAudioReady(true); setSpeechError(null); },
      onEnd: advanceQueue,
      onError: (reason) => {
        stopSpeech();
        setIsSpeaking(false);
        setIsTransitioningQueue(false);
        setAudioReady(false);
        audioUnlockedRef.current = false;
        const message = reason === 'not-allowed' || reason === 'start-timeout'
          ? 'เสียงยังไม่เริ่มเล่น กรุณาแตะฟังซ้ำ และตรวจระดับเสียงสื่อของเครื่อง'
          : 'อ่านเสียงไม่สำเร็จ กรุณาแตะฟังซ้ำหรือตรวจเสียงภาษาไทยในเครื่อง';
        setSpeechError(message);
        showToast(message);
      },
    });
  };

  const speakCustomText = (text: string, fromGesture = false) => {
    if (fromGesture) { audioUnlockedRef.current = true; voiceEnabledRef.current = true; setVoiceEnabled(true); }
    if (!audioUnlockedRef.current) { setSpeechError('แตะเปิดและทดสอบเสียงก่อน'); return; }
    if (!('speechSynthesis' in window)) {
      showToast('อุปกรณ์นี้ไม่รองรับการอ่านออกเสียง');
      return;
    }
    stopSpeech();
    playChime();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = speechRate;
    utterance.pitch = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = selectThaiVoice(voices);
    if (thaiVoice) utterance.voice = thaiVoice;
    activeUtteranceRef.current = utterance;
    speechCleanupRef.current = startSpeechPlayback(window.speechSynthesis, utterance, {
      onStart: () => { setIsSpeaking(true); setAudioReady(true); setSpeechError(null); },
      onEnd: () => setIsSpeaking(false),
      onError: () => { stopSpeech(); setIsSpeaking(false); setAudioReady(false); audioUnlockedRef.current = false;
        setSpeechError('เสียงไม่พร้อม กรุณาตรวจเสียงภาษาไทยและระดับเสียงสื่อ แล้วกดทดสอบอีกครั้ง');
        showToast('เสียงไม่พร้อม กรุณาตรวจเสียงภาษาไทยและระดับเสียงสื่อของเครื่อง'); },
    });
  };

  const triggerAnnouncements = (items: LotteryAnnouncement[], fromGesture = false) => {
    if (fromGesture) { audioUnlockedRef.current = true; voiceEnabledRef.current = true; setVoiceEnabled(true); }
    if (!items || items.length === 0) return;
    items = items.map((item) => {
      const { top3, bottom2 } = getResultNumbers({ firstPrize: item.firstPrize, bottom2: item.last2Digits });
      return { ...item, firstPrize: top3, last2Digits: bottom2, front3Digits: [], last3Digits: [] };
    });

    stopSpeech();
    if (voiceEnabled) playChime();
    announcementQueueRef.current = [...items];
    setAnnouncementQueue(items);
    setCurrentQueueIndex(0);
    setIsModalOpen(true);

    if (voiceEnabledRef.current) {
      if (fromGesture) { speakCurrentAnnouncement(items[0], 0, items.length); return; }
      queueTimeoutRef.current = setTimeout(() => {
        speakCurrentAnnouncement(items[0], 0, items.length);
      }, 400);
    }
  };
  triggerAnnouncementsRef.current = triggerAnnouncements;

  const handleReplay = () => {
    audioUnlockedRef.current = true; voiceEnabledRef.current = true; setVoiceEnabled(true);
    playChime();
    const current = announcementQueue[currentQueueIndex];
    if (current) {
      speakCurrentAnnouncement(current, currentQueueIndex, announcementQueue.length);
    }
  };

  const handleNextInQueue = () => {
    if (currentQueueIndex + 1 < announcementQueue.length) {
      stopSpeech();
      const nextIdx = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIdx);
      const nextItem = announcementQueue[nextIdx];
      speakCurrentAnnouncement(nextItem, nextIdx, announcementQueue.length);
    }
  };

  const handlePrevInQueue = () => {
    if (currentQueueIndex > 0) {
      stopSpeech();
      const prevIdx = currentQueueIndex - 1;
      setCurrentQueueIndex(prevIdx);
      const prevItem = announcementQueue[prevIdx];
      speakCurrentAnnouncement(prevItem, prevIdx, announcementQueue.length);
    }
  };

  // Speak announcement for any specific lottery item in the catalog or summary table
  const handleSpeakSpecificLottery = (item: LotteryItem) => {
    audioUnlockedRef.current = true; voiceEnabledRef.current = true; setVoiceEnabled(true);
    if (!('speechSynthesis' in window)) {
      showToast('เบราว์เซอร์ไม่รองรับ Speech Synthesis');
      return;
    }
    stopSpeech();
    playChime();

    const { top3, bottom2 } = getResultNumbers(item);
    if (!top3 && !bottom2) {
      showToast('ยังไม่มีผลรางวัลจริงสำหรับอ่านประกาศ');
      return;
    }
    const text = `ประกาศผล ${item.name}. สามตัวบน ${spellDigits(top3)}. สองตัวล่าง ${spellDigits(bottom2)}.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = speechRate;
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = selectThaiVoice(voices);
    if (thaiVoice) utterance.voice = thaiVoice;

    activeUtteranceRef.current = utterance;
    speechCleanupRef.current = startSpeechPlayback(window.speechSynthesis, utterance, {
      onStart: () => { setIsSpeaking(true); setAudioReady(true); setSpeechError(null); },
      onEnd: () => setIsSpeaking(false),
      onError: () => { stopSpeech(); setIsSpeaking(false); setAudioReady(false); audioUnlockedRef.current = false;
        setSpeechError('อ่านเสียงไม่สำเร็จ กรุณาตรวจเสียงภาษาไทยในเครื่อง');
        showToast('อ่านเสียงไม่สำเร็จ กรุณาตรวจเสียงภาษาไทยและระดับเสียงสื่อ'); },
    });
  };

  const handleToggleVoice = (enabled: boolean) => {
    voiceEnabledRef.current = enabled;
    setVoiceEnabled(enabled);
    if (enabled) speakCustomText('เปิดเสียงแจ้งเตือนแล้วครับ', true);
    else { stopSpeech(); setAudioReady(false); }
  };

  // Apply a template preset
  const applyPreset = (presetKey: keyof typeof TEMPLATE_PRESETS) => {
    const p = TEMPLATE_PRESETS[presetKey];
    if (!p) return;
    setTemplateTitle(p.title);
    setTemplateBody(p.body);
    setSpeechScript(p.speech_script);
    setPoliteParticle(p.polite_particle);
    setFontFamily(p.font_family);
    setFontSize(p.font_size);
    setModalTheme(p.modal_theme);

    // Sync into settings draft
    if (settings) {
      const updated = {
        ...settings,
        message_template: {
          ...settings.message_template,
          preset: presetKey,
          title: p.title,
          body: p.body,
          speech_script: p.speech_script,
          polite_particle: p.polite_particle,
          font_family: p.font_family,
          font_size: p.font_size,
          modal_theme: p.modal_theme,
        },
      };
      setSettings(updated);
    }
    showToast(`ใช้แม่แบบ '${p.name}' เรียบร้อยแล้ว`);
  };

  // Save template customization to backend
  const handleSaveTemplate = async () => {
    const updatedSettings = {
      ...(settings || {}),
      message_template: {
        ...(settings?.message_template || {}),
        title: templateTitle,
        body: templateBody,
        speech_script: speechScript,
        polite_particle: politeParticle,
        modal_theme: modalTheme,
        font_size: fontSize,
        font_family: fontFamily,
      },
    };

    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(updatedSettings);
        showToast('💾 บันทึกรูปแบบข้อความและสไตล์ตัวหนังสือเรียบร้อยแล้ว!');
      } else {
        showToast('เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (e) {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกได้');
    }
  };

  // Add watched number from Analytics or Quick Picker
  const handleAddWatchedNumber = async (num: string) => {
    if (!num) return;
    const currentList = settings?.notifications?.custom_watched_numbers || [];
    if (!currentList.includes(num)) {
      const updatedList = [...currentList, num];
      const newSettings = {
        ...(settings || {}),
        notifications: {
          ...(settings?.notifications || {}),
          custom_watched_numbers: updatedList,
        },
      };
      try {
        const response = await apiFetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          showToast(data.error || `บันทึกรายการเฝ้าระวังไม่สำเร็จ (HTTP ${response.status})`);
          return;
        }
        setSettings(newSettings);
        showToast(`เพิ่มเลข ${num} ลงในรายการเฝ้าระวังแล้ว`);
      } catch {
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกได้');
      }
    } else {
      showToast(`เลข ${num} อยู่ในรายการเฝ้าระวังแล้ว`);
    }
  };

  const handleSaveMultiChannelSettings = async (newSettings: any): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        showToast(data.error || `บันทึกการตั้งค่าไม่สำเร็จ (HTTP ${res.status})`);
        return false;
      }
      setSettings(newSettings);
      showToast('บันทึกการตั้งค่าช่องทางแจ้งเตือนสำเร็จ!');
      return true;
    } catch {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกได้');
      return false;
    }
  };

  // Update all lotteries (for schedule and result edits in modal)
  const handleUpdateAllLotteries = async (updated: LotteryItem[]) => {
    try {
      const res = await apiFetch('/api/all-lotteries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        showToast(data.error || `บันทึกตารางหวยไม่สำเร็จ (HTTP ${res.status})`);
        return;
      }
      setAllLotteries(updated);
      showToast('💾 บันทึกและอัปเดตตารางหวยเรียบร้อยแล้ว');
    } catch {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกตารางหวยได้');
    }
  };

  // Fetch initial data
  const fetchData = async (): Promise<{ results: LotteryResult[]; newResults: LotteryResult[] }> => {
    // A slow request must not overlap the 15-second poll, visibility refresh, or manual refresh.
    if (fetchDataInFlightRef.current) return { results: [], newResults: [] };
    fetchDataInFlightRef.current = true;
    setIsLoading(true);
    let safeResults: LotteryResult[] = [];
    let newResults: LotteryResult[] = [];
    try {
      const rawBase = 'https://raw.githubusercontent.com/jirapatza/Bombim00/runtime-live';
      const fetchJsonWithFallback = async (primaryUrl: string, fallbackUrl?: string) => {
        const request = async (url: string) => {
          try {
            const options = { cache: 'no-store' as const, signal: AbortSignal.timeout(10000) };
            const response = url.startsWith('/api/') ? await apiFetch(url, options) : await fetch(url, options);
            return response.ok ? await response.json() : null;
          } catch {
            return null;
          }
        };
        const primary = await request(primaryUrl);
        if (primary !== null) return primary;
        return fallbackUrl ? await request(fallbackUrl) : null;
      };
      const [resStatus, resSettings, resResults, resAllLotteries] = await Promise.all([
        fetchJsonWithFallback('/api/status', `${rawBase}/status/status.json`),
        fetchJsonWithFallback('/api/settings'),
        // Use the public results file as a fallback when the web API is unavailable.
        fetchJsonWithFallback('/api/results', `${rawBase}/lottery_previous_results.json`),
        fetchJsonWithFallback('/api/all-lotteries', `${rawBase}/data/all_lotteries.json`),
      ]);

      if (resStatus) setStatus(resStatus);
      if (resSettings) {
        setSettings(resSettings);
          if (resSettings.message_template) {
          const tm = resSettings.message_template;
          if (tm.title) setTemplateTitle(tm.title);
          if (tm.body) setTemplateBody(tm.body);
          if (tm.speech_script) setSpeechScript(tm.speech_script);
          if (tm.polite_particle !== undefined) setPoliteParticle(tm.polite_particle);
          if (tm.modal_theme) setModalTheme(tm.modal_theme);
          if (tm.font_size) setFontSize(tm.font_size);
          if (tm.font_family) setFontFamily(tm.font_family);
        }
      }

      if (Array.isArray(resResults)) {
        safeResults = resResults as LotteryResult[];
        latestProviderResultsRef.current = safeResults;
        const previousKeys = knownResultsRef.current;
        if (previousKeys) {
          newResults = safeResults.filter((row: any) => {
            const key = getLotteryResultFingerprint(row);
            const { top3, bottom2 } = getResultNumbers(row);
            return Boolean(top3 && bottom2 && providerDrawDateIso(row) === getBangkokClockParts().dateKey && !previousKeys.has(key));
          });
        }
        knownResultsRef.current = new Set(safeResults.map((row: any) => getLotteryResultFingerprint(row)));
        setResults(safeResults);
      }
      const apiLotteryCatalog = Array.isArray(resAllLotteries) ? resAllLotteries : [];
      const bundledCatalog = bundledLotteryFallback;
      const availableCatalog = apiLotteryCatalog.length > 0 ? apiLotteryCatalog : bundledCatalog;
      const liveCatalog = mergeCatalogWithProviderResults(availableCatalog, latestProviderResultsRef.current, getBangkokClockParts().dateKey);
      setAllLotteries(liveCatalog);
      setSelectedCatalogLottery((selected) => liveCatalog.find((item) => item.id === selected?.id) || liveCatalog[0] || null);

      if (newResults.length > 0) {
        const nextClosing = getNextClosingLottery();
        triggerAnnouncementsRef.current(newResults.map((row: any, index) => ({
          id: `live-${getLotteryResultFingerprint(row)}-${index}`,
          lotteryName: row.ชื่อหวย || row.หวย || row.lotteryName || 'หวย',
          drawDate: row.งวดวันที่ || row.วันที่จัดรูปแบบ || row.drawDate || 'งวดล่าสุด',
          firstPrize: getResultNumbers(row).top3,
          last2Digits: getResultNumbers(row).bottom2,
          front3Digits: Array.isArray(row.เลขหน้า_3_ตัว) ? row.เลขหน้า_3_ตัว : [],
          last3Digits: Array.isArray(row.เลขท้าย_3_ตัว) ? row.เลขท้าย_3_ตัว : [],
          source: row.แหล่งข้อมูล || row.source || 'แหล่งข้อมูลผลหวย',
          nextClosing,
          note: 'ตรวจพบผลใหม่จากแหล่งข้อมูล',
        })));
        showToast(`พบผลหวยใหม่ ${newResults.length} รายการ${voiceEnabledRef.current && audioUnlockedRef.current ? ' กำลังเตรียมอ่านประกาศ' : ' — แตะเปิดและทดสอบเสียงเพื่อฟังประกาศ'}`);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      fetchDataInFlightRef.current = false;
      setIsLoading(false);
    }
    return { results: safeResults, newResults };
  };

  useEffect(() => {
    fetchData();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      fetchData();
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Foreground assistance requests the existing GitHub runner; it never runs a checker here.
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    const controller = new AbortController();
    const ensureCheck = async () => {
      if (inFlight || document.visibilityState !== 'visible' || !navigator.onLine) return;
      inFlight = true;
      try {
        const response = await apiFetch('/api/github/dispatch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ automatic: true, inputs: { lottery_target: 'all', force_notify: 'false' } }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        const data = await response.json().catch(() => ({}));
        if (!disposed) setForegroundWarning(response.ok || response.status === 409 ? null : data.error || 'เรียกตัวตรวจอัตโนมัติไม่สำเร็จ กรุณาดูสถานะ GitHub Actions');
      } catch {
        if (!disposed) setForegroundWarning('เชื่อมต่อตัวตรวจอัตโนมัติไม่ได้ จะลองใหม่เมื่อเว็บเปิดอยู่');
      } finally { inFlight = false; }
    };
    void ensureCheck();
    const timer = window.setInterval(ensureCheck, 60000);
    document.addEventListener('visibilitychange', ensureCheck);
    return () => { disposed = true; controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', ensureCheck); };
  }, []);

  // Announce each scheduled lottery closing once at its configured closing minute.
  // This runs while the app is open; Android/browser background suspension can delay it.
  useEffect(() => {
    if (!voiceEnabled || typeof window === 'undefined') return;
    const checkClosingAlerts = () => {
      const now = getBangkokClockParts();
      const due = LOTTERY_SCHEDULE.filter((item) =>
        item.closeHour % 24 === now.hour &&
        item.closeMinute === now.minute &&
        isLotteryScheduledOnDate(item, now.dateKey)
      );
      if (due.length === 0) return;
      const storageKey = `bombim00:closing-alert:${now.dateKey}:${now.hour.toString().padStart(2, '0')}:${now.minute.toString().padStart(2, '0')}`;
      if (lastClosingAlertKeyRef.current === storageKey) return;
      lastClosingAlertKeyRef.current = storageKey;
      try {
        if (window.localStorage.getItem(storageKey) === 'sent') return;
        window.localStorage.setItem(storageKey, 'sent');
      } catch {
        // In-memory deduplication above still prevents repeated alerts in this app session.
      }
      const names = due.map((item) => item.name).join(' และ ');
      speakCustomText(`แจ้งเตือนปิดรับหวย ${names} เวลา ${now.hour.toString().padStart(2, '0')} นาฬิกา ${now.minute.toString().padStart(2, '0')} นาทีครับ`);
      showToast(`แจ้งเตือนปิดรับ: ${names}`);
    };
    checkClosingAlerts();
    const timer = window.setInterval(checkClosingAlerts, 15000);
    return () => window.clearInterval(timer);
  }, [voiceEnabled, speechRate]);

  const handleTriggerCheck = async () => {
    setIsTriggering(true);
    try {
      // Choose one backend; retrying on another can run and notify twice.
      const dispatchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: 'lottery.yml', inputs: { lottery_target: 'all', force_notify: 'false' } }),
      };
      let res = await apiFetch('/api/github/dispatch', dispatchOptions);
      if (res.status === 401) {
        const password = window.prompt('กรุณากรอกรหัส Dashboard ที่ตั้งไว้ใน Render เพื่อสั่งตรวจผล');
        if (password === null) {
          showToast('ยกเลิกการตรวจผล: ยังไม่ได้ยืนยันรหัส Dashboard');
          return;
        }
        if (!password.trim()) {
          showToast('กรุณากรอกรหัส Dashboard ก่อนตรวจผล');
          return;
        }
        try {
          await loginDashboard(password);
        } catch (error: any) {
          showToast(error?.message || 'เข้าสู่ระบบไม่สำเร็จ');
          return;
        }
        // The rejected 401 request did not dispatch a workflow; retry only once.
        res = await apiFetch('/api/github/dispatch', dispatchOptions);
      }
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success) {
        if (data.queued) {
          if (!data.request_id) {
            showToast('GitHub รับคำสั่งแล้ว แต่ยังไม่มีรหัสติดตามงาน กรุณาดูประวัติการรัน');
            return;
          }
          showToast('GitHub รับคำสั่งแล้ว กำลังติดตามผลการรัน...');
          try {
            const run = await waitForDispatchedWorkflow(String(data.request_id), {
              onProgress: (progress) => {
                if (progress === 'queued') showToast('GitHub Actions อยู่ในคิว');
                if (progress === 'in_progress') showToast('GitHub Actions กำลังทำงาน');
              },
            });
            if (!run) {
              showToast('ยังยืนยันผลการรันไม่ได้ภายใน 3 นาที กรุณาดูประวัติ GitHub Actions');
              return;
            }
            if (run.conclusion !== 'success') {
              showToast('GitHub Actions จบด้วยสถานะ ' + (run.conclusion || 'ไม่ทราบสาเหตุ') + ' กรุณาตรวจบันทึกการรัน');
              return;
            }
            const refreshed = await fetchData();
            showToast(refreshed.newResults.length > 0
              ? 'GitHub Actions สำเร็จ พบข้อมูลใหม่ ' + refreshed.newResults.length + ' รายการ'
              : 'GitHub Actions ทำงานสำเร็จแล้ว โหลดข้อมูลล่าสุดเรียบร้อย');
          } catch (error: any) {
            showToast('ส่งคำสั่งแล้ว แต่ติดตามผลไม่สำเร็จ: ' + (error?.message || 'โปรดตรวจประวัติ GitHub Actions'));
          }
          return;
        }
        if (data.status) setStatus(data.status);
        const refreshed = await fetchData();
        if (refreshed.newResults.length === 0) {
          showToast('ตรวจสอบแหล่งข้อมูลแล้ว แต่ยังไม่พบผลใหม่ จึงไม่อ่านผลเก่าซ้ำ');
        } else {
          showToast(`ตรวจพบผลใหม่ ${refreshed.newResults.length} รายการ`);
        }
      } else {
        if (res.status === 401) {
          showToast('ยังไม่ได้ยืนยันรหัส Dashboard หรือรหัสไม่ถูกต้อง กรุณาเปิด ตั้งค่า → GitHub Actions แล้วกรอกรหัส Dashboard ก่อนลองอีกครั้ง');
          return;
        }
        if (res.status === 503 && String(data?.error || '').includes('DASH_PASSWORD')) {
          showToast('ระบบยังไม่ได้ตั้งค่า DASH_PASSWORD บนเซิร์ฟเวอร์ กรุณาตรวจสอบการตั้งค่า Render');
          return;
        }
        const reason = data?.error || data?.message || (res ? `HTTP ${res.status}` : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        showToast(`ตรวจสอบไม่สำเร็จ: ${reason}`);
        console.error('Trigger workflow failed:', res?.status, data);
      }
    } catch (err: any) {
      console.error('Trigger workflow connection failed:', err);
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อตรวจสอบได้');
    } finally {
      setIsTriggering(false);
    }
  };

  const testSingleAnnouncement = () => {
    const selected = selectedCatalogLottery || allLotteries.find((item) => item.category !== 'gov_savings') || allLotteries[0];
    if (!selected) {
      showToast('ยังไม่มีรายการหวยในแคตตาล็อกให้ทดสอบเสียง');
      return;
    }
    const nextClosing = getNextClosingLottery();
    triggerAnnouncements([{
      id: `demo-${selected.id}-${Date.now()}`,
      lotteryName: selected.name,
      drawDate: selected.date || 'ตัวอย่างสำหรับทดสอบ',
      firstPrize: getResultNumbers(selected).top3,
      last2Digits: getResultNumbers(selected).bottom2,
      front3Digits: [],
      last3Digits: [],
      source: 'ตัวอย่างจากแคตตาล็อก (ไม่ใช่การยืนยันผลสด)',
      nextClosing,
      note: 'ทดสอบเสียงเท่านั้น ไม่ใช่ผลหวยจริง',
    }], true);
  };

  const testDualSimultaneousAnnouncements = () => {
    const samples = allLotteries.filter((item) => item.category !== 'gov_savings').slice(0, 2);
    if (samples.length < 2) {
      showToast('ต้องมีรายการหวยอย่างน้อย 2 รายการจึงจะทดสอบเสียงต่อเนื่องได้');
      return;
    }
    const nextClosing = getNextClosingLottery();
    triggerAnnouncements(samples.map((item, index) => ({
      id: `simul-${item.id}-${Date.now()}-${index}`,
      lotteryName: item.name,
      drawDate: item.date || 'ตัวอย่างสำหรับทดสอบ',
      firstPrize: getResultNumbers(item).top3,
      last2Digits: getResultNumbers(item).bottom2,
      front3Digits: [],
      last3Digits: [],
      source: 'ตัวอย่างจากแคตตาล็อก (ไม่ใช่การยืนยันผลสด)',
      nextClosing,
      note: `ทดสอบเสียงรายการที่ ${index + 1} ไม่ใช่ผลหวยจริง`,
    })), true);
  };

  // Preview uses the currently selected catalog lottery, not a hard-coded Thai government example.
  const getRenderedPreview = () => {
    const previewLottery = selectedCatalogLottery || allLotteries.find((item) => item.category !== 'gov_savings') || allLotteries[0];
    const sample = {
      '{lottery_name}': previewLottery?.name || 'ตัวอย่างหวย',
      '{draw_date}': previewLottery?.date || 'ตัวอย่างสำหรับทดสอบ',
      '{top3}': getResultNumbers(previewLottery).top3 || '---',
      '{first_prize}': getResultNumbers(previewLottery).top3 || '---',
      '{last_2}': getResultNumbers(previewLottery).bottom2 || '--',
      '{front_3}': '-',
      '{last_3}': '-',
      '{source}': 'ตัวอย่างจากแคตตาล็อก (ไม่ใช่ผลสด)',
      '{next_closing}': nextClosingNow ? `${nextClosingNow.name} (${nextClosingNow.closeTimeStr})` : 'รอบถัดไป',
    };

    let title = templateTitle;
    let body = '{top3} - {last_2}';
    for (const [k, v] of Object.entries(sample)) {
      title = title.split(k).join(v);
      body = body.split(k).join(v);
    }
    return { title, body };
  };

  // Modal theme styling classes
  const getModalThemeClasses = () => {
    switch (modalTheme) {
      case 'emerald':
        return {
          container: 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/70 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.25)]',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          accent: 'text-emerald-400',
          firstPrizeBox: 'border-emerald-500/50',
          firstPrizeText: 'text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]',
          button: 'from-emerald-500 to-teal-500',
        };
      case 'purple':
        return {
          container: 'bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/70 border-purple-500/50 shadow-[0_0_50px_rgba(168,85,247,0.25)]',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          accent: 'text-purple-400',
          firstPrizeBox: 'border-purple-500/50',
          firstPrizeText: 'text-purple-300 drop-shadow-[0_0_20px_rgba(192,132,252,0.4)]',
          button: 'from-purple-500 to-indigo-500',
        };
      case 'ruby':
        return {
          container: 'bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/70 border-rose-500/50 shadow-[0_0_50px_rgba(244,63,94,0.25)]',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          accent: 'text-rose-400',
          firstPrizeBox: 'border-rose-500/50',
          firstPrizeText: 'text-rose-300 drop-shadow-[0_0_20px_rgba(251,113,133,0.4)]',
          button: 'from-rose-500 to-orange-500',
        };
      case 'cyber':
        return {
          container: 'bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/70 border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.25)]',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          accent: 'text-cyan-400',
          firstPrizeBox: 'border-cyan-500/50',
          firstPrizeText: 'text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]',
          button: 'from-cyan-500 to-blue-500',
        };
      default: // gold
        return {
          container: 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/70 border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.25)]',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          accent: 'text-amber-400',
          firstPrizeBox: 'border-amber-500/50',
          firstPrizeText: 'text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]',
          button: 'from-amber-500 to-yellow-500',
        };
    }
  };

  const getFontSizeClasses = () => {
    switch (fontSize) {
      case 'compact':
        return { first: 'text-3xl sm:text-4xl', last2: 'text-3xl sm:text-4xl', title: 'text-xl sm:text-2xl' };
      case 'large':
        return { first: 'text-4xl sm:text-5xl', last2: 'text-4xl sm:text-5xl', title: 'text-2xl sm:text-3xl' };
      case 'xlarge':
        return { first: 'text-5xl sm:text-6xl', last2: 'text-5xl sm:text-6xl', title: 'text-3xl sm:text-4xl' };
      default: // medium
        return { first: 'text-4xl', last2: 'text-4xl', title: 'text-2xl' };
    }
  };

  const latestDraw = results.length > 0 ? results[0] : null;
  const latestGovernmentDraw = results.find((row: any) =>
    row?.หมวดหวย === 'government' ||
    ['thailotto', 'gsblotto', 'baaclotto'].includes(String(row?.หวย || '').toLowerCase()) ||
    /รัฐบาล|ออมสิน|ธ\.ก\.ส\./.test(String(row?.ชื่อหวย || ''))
  ) || null;

  const handleCheckTicket = () => {
    const cleanNum = ticketInput.trim();
    if (!cleanNum || results.length === 0) return;

    const latest = results[0];
    const { top3, bottom2 } = getResultNumbers(latest);
    const wins: string[] = [];
    if (/^\d{3}$/.test(cleanNum) && top3 && cleanNum === top3) {
      wins.push(`ตรงเลข 3 ตัวบน: ${top3}`);
    }
    if (/^\d{2}$/.test(cleanNum) && bottom2 && cleanNum === bottom2) {
      wins.push(`ตรงเลข 2 ตัวล่าง: ${bottom2}`);
    }

    if (wins.length > 0) {
      setTicketResult({
        checked: true,
        wins: wins,
        message: `ยินดีด้วย! สลากหมายเลข ${cleanNum} ถูกรางวัลในงวด ${latest.งวดวันที่}`,
      });
    } else {
      setTicketResult({
        checked: true,
        wins: [],
        message: `เสียใจด้วย สลากหมายเลข ${cleanNum} ไม่ถูกรางวัลในงวด ${latest.งวดวันที่}`,
      });
    }
  };

  const handleSendTestNtfy = async () => {
    if (!testTopic.trim()) {
      showToast('กรุณาระบุ ntfy Topic');
      return;
    }
    setIsSendingTest(true);
    try {
      const res = await apiFetch('/api/test-ntfy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: settings?.ntfy?.server || 'https://ntfy.sh',
          topic: testTopic.trim(),
          priority: testPriority,
          message: testCustomMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`ntfy รับคำขอทดสอบแล้ว (${testTopic}); ยังยืนยันการรับบนมือถือไม่ได้`);
      } else {
        showToast(`เกิดข้อผิดพลาด: ${data.error || 'ส่งไม่สำเร็จ'}`);
      }
    } catch (err: any) {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ ntfy ได้');
    } finally {
      setIsSendingTest(false);
    }
  };

  const currentAnnouncement = announcementQueue[currentQueueIndex] || null;
  const nextClosingNow = getNextClosingLottery();
  const themeClasses = getModalThemeClasses();
  const sizeClasses = getFontSizeClasses();
  const renderedPreview = getRenderedPreview();

  return (
    <div id="bombim-app" className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 ${fontFamily === 'mono' ? 'font-mono' : 'font-sans'}`}>
      {/* Toast Notification */}
      {notificationToast && (
        <div className="fixed top-5 right-5 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-sm font-medium">{notificationToast}</span>
        </div>
      )}

      {/* ==================== CUSTOMIZABLE MODAL POP-UP ==================== */}
      {isModalOpen && currentAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 animate-fadeIn modal-overlay">
          <div className={`relative w-full max-w-2xl border-2 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 ${themeClasses.container}`}>
            
            {/* Top Bar inside Modal */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${themeClasses.button} flex items-center justify-center shadow-lg text-slate-950 animate-pulse`}>
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${themeClasses.badge}`}>
                      ประกาศผลรางวัลทันที (Live Announcement)
                    </span>

                    {announcementQueue.length > 1 && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-indigo-400" />
                        คิวที่ {currentQueueIndex + 1} จาก {announcementQueue.length}
                      </span>
                    )}
                  </div>

                  <h2 className={`font-black text-white mt-1 ${sizeClasses.title}`}>
                    {currentAnnouncement.lotteryName}
                  </h2>
                  <p className="text-xs text-slate-300 font-medium">
                    ประจำงวดวันที่: <span className={`${themeClasses.accent} font-bold`}>{currentAnnouncement.drawDate}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !voiceEnabled;
                    setVoiceEnabled(nextState);
                    if (!nextState) stopSpeech();
                    else { voiceEnabledRef.current = true; handleReplay(); }
                  }}
                  title={voiceEnabled ? 'ปิดเสียงพูด' : 'เปิดเสียงพูด'}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    voiceEnabled
                      ? `${themeClasses.badge}`
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}
                >
                  {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Speaking Status Pill */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`}></span>
                <span className="font-semibold text-slate-200">
                  {isSpeaking
                    ? '🔊 กำลังอ่านผลรางวัลด้วยเสียงภาษาไทย...'
                    : isTransitioningQueue
                    ? '⏳ อ่านรายการนี้จบแล้ว • กำลังเตรียมอ่านรายการถัดไป...'
                    : speechError || (audioReady ? 'อ่านเสียงจบแล้ว' : 'แตะฟังซ้ำเพื่อเปิดเสียงบนเครื่องนี้')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReplay}
                  className={`text-[11px] font-bold ${themeClasses.accent} hover:underline flex items-center gap-1 cursor-pointer`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  ฟังซ้ำ
                </button>
              </div>
            </div>

            {/* Main Numbers Announcement Grid (Styled according to user options) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`bg-slate-950/90 rounded-2xl p-5 border-2 flex flex-col items-center justify-center text-center shadow-inner ${themeClasses.firstPrizeBox}`}>
                <span className={`text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${themeClasses.accent}`}>
                  <Sparkles className="w-3.5 h-3.5" />
                  3 ตัวบน
                </span>
                <div className={`font-black tracking-widest font-mono ${themeClasses.firstPrizeText} ${sizeClasses.first}`}>
                  {currentAnnouncement.firstPrize || '---'}
                </div>
                <span className="text-[11px] text-slate-400 mt-2 font-mono">
                  {spellDigits(currentAnnouncement.firstPrize)}
                </span>
              </div>

              <div className="bg-slate-950/90 rounded-2xl p-5 border-2 border-emerald-500/50 flex flex-col items-center justify-center text-center shadow-inner">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  2 ตัวล่าง
                </span>
                <div className={`font-black tracking-widest font-mono text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)] ${sizeClasses.last2}`}>
                  {currentAnnouncement.last2Digits || '--'}
                </div>
                <span className="text-[11px] text-slate-400 mt-2 font-mono">
                  {spellDigits(currentAnnouncement.last2Digits)}
                </span>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              {announcementQueue.length > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevInQueue}
                    disabled={currentQueueIndex === 0}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-30 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    อันก่อนหน้า
                  </button>

                  <span className="text-xs text-slate-400 font-mono">
                    {currentQueueIndex + 1} / {announcementQueue.length}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextInQueue}
                    disabled={currentQueueIndex + 1 >= announcementQueue.length}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-30 cursor-pointer flex items-center gap-1 ${themeClasses.badge}`}
                  >
                    อ่านอันถัดไป
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-500">
                  แหล่งที่มา: {currentAnnouncement.source || 'official'}
                </span>
              )}

              <button
                type="button"
                onClick={handleCloseModal}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition border border-slate-700 ml-auto"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Executive Header & Navigation */}
      <header id="bombim-header" className="border-b border-slate-800 bg-slate-900 sticky top-0 z-40 shadow-2xl">
        <div className="overview-header">
          <div className="overview-brand"><h1>BOMBIM<span>00</span></h1><p>LIVE RESULTS</p></div>
          <div className="overview-header-actions">
            <button onClick={fetchData} disabled={isLoading}><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/> รีเฟรชข้อมูล</button>
            <button onClick={async () => {
              try {
                const response = await apiFetch('/api/auth/logout', { method: 'POST' });
                if (!response.ok) throw new Error();
                window.location.reload();
              } catch { showToast('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง'); }
            }}>ออกจากระบบ</button>
            <span className="live-pill">● LIVE</span>
            <button onClick={() => {
              if (!audioReady || !voiceEnabled) { speakCustomText('เปิดเสียงแจ้งเตือนแล้วครับ', true); }
              else { voiceEnabledRef.current = false; setVoiceEnabled(false); stopSpeech(); }
            }} aria-label={!audioReady || !voiceEnabled ? 'เปิดและทดสอบเสียง' : 'ปิดเสียงอ่าน'}>
              {voiceEnabled && audioReady ? <Volume2 size={19}/> : <VolumeX size={19}/>}
              {!audioReady || !voiceEnabled ? 'เปิดและทดสอบเสียง' : 'ปิดเสียงอ่าน'}
            </button>
            <button onClick={handleTriggerCheck} disabled={isTriggering}><Play size={17}/>{isTriggering ? 'กำลังตรวจ...' : 'ตรวจผลทันที'}</button>
          </div>
        </div>

        {(speechError || foregroundWarning) && <p role="status" className="px-4 py-2 text-sm text-amber-200">{speechError || foregroundWarning}</p>}
      {/* Main User Navigation: Clean, Clear, Large Font for General Users */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav id="bombim-main-nav" aria-label="เมนูหลัก" className="flex gap-2 sm:gap-3 border-t border-slate-800/80 overflow-x-auto py-3 text-sm sm:text-base font-black no-scrollbar">
            {[
              { id: 'live', label: 'หน้าหลัก', icon: Layers },
                            { id: 'history', label: 'ผลย้อนหลัง / สถิติ', icon: History },
              { id: 'settings', label: 'ตั้งค่า', icon: Settings },
              { id: 'summary', label: 'ตารางผลและภาพแชร์', icon: TableProperties },
              { id: 'checker', label: 'ตรวจสลากรางวัล', icon: Search },
            ].map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id ||
                (tab.id === 'checker' && ['accuracy', 'batch', 'results'].includes(activeTab));
              return (
                <button
                  key={tab.id}
                  aria-current={selected ? 'page' : undefined}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    if (tab.id === 'checker') setCheckerSubTab('batch');
                    if (tab.id === 'stats') setCheckerSubTab('history');
                  }}
                  className={`px-5 py-3 rounded-2xl flex items-center gap-2.5 whitespace-nowrap transition cursor-pointer text-sm sm:text-base font-black ${
                    selected
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                      : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="bombim-main-content" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ==================== TAB 1: LIVE UPCOMING DRAWS (WAITING & ABOUT-TO-DRAW) ==================== */}
        {activeTab === 'live' && <ResultsOverview lotteries={allLotteries} results={results} onSettings={() => setActiveTab('notifications')} onRefresh={fetchData} lastUpdated={status?.last_run_date_thai} />}
        {(activeTab === 'history' || activeTab === 'stats') && <IndividualHistory lotteries={allLotteries} results={results} showStats={activeTab === 'stats'} />}

        {/* ==================== TAB 2: DAILY SUMMARY TABLE (FULL 51 LOTTERIES MATRIX) ==================== */}
        {activeTab === 'summary' && (
          <div className="space-y-5">
            <CrashShieldErrorBoundary isolateScope fallbackTitle="ระบบป้องกันตารางสรุปผลหวยขัดข้อง (Summary Table Shield)">
            <Suspense fallback={<div className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-400">กำลังโหลดตารางสรุปผล...</div>}>
              <DailySummaryTable
                lotteries={allLotteries}
                results={results}
                onSelectLottery={(item) => {
                  setSelectedCatalogLottery(item);
                }}
                onSpeakLottery={(item) => handleSpeakSpecificLottery(item)}
                onUpdateLotteries={handleUpdateAllLotteries}
                nextClosing={getNextClosingLottery()}
              />
            </Suspense>
            </CrashShieldErrorBoundary>
          </div>
        )}

        {/* ==================== TAB 4: UNIFIED SETTINGS CENTER ==================== */}
        {(activeTab === 'settings' || activeTab === 'notifications') && (
          <SettingsCenter
            settings={settings}
            onSaveSettings={handleSaveMultiChannelSettings}
            onOpenAdminBackOffice={() => setIsAdminBackOfficeOpen(true)}
            status={status}
            latestDraw={latestDraw}
            allLotteries={allLotteries}
            voiceEnabled={voiceEnabled}
            onToggleVoice={handleToggleVoice}
            onStopSpeech={stopSpeech}
            isSpeaking={isSpeaking}
            onTriggerCheck={handleTriggerCheck}
            isTriggering={isTriggering}
            templateProps={{
              templateTitle,
              setTemplateTitle,
              templateBody,
              setTemplateBody,
              speechScript,
              setSpeechScript,
              politeParticle,
              setPoliteParticle,
              modalTheme,
              setModalTheme,
              fontSize,
              setFontSize,
              fontFamily,
              setFontFamily,
              speechRate,
              setSpeechRate,
              onSaveTemplate: handleSaveTemplate,
              onApplyPreset: (key) => applyPreset(key as any),
              onTestAnnouncement: testSingleAnnouncement,
            }}
          />
        )}



        {/* ==================== COMBINED DIAGNOSTICS CENTER ==================== */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-6">
            <section className="space-y-2">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  ภาพรวมสถานะและปัญหาระบบ
                </h2>
                <p className="text-xs text-slate-400">ตรวจสุขภาพระบบและดูรายละเอียดข้อผิดพลาดจากหน้าจอเดียว</p>
              </div>
              <Suspense fallback={<div className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-400">กำลังโหลดข้อมูลตรวจสุขภาพระบบ...</div>}><SystemMonitorKiosk /></Suspense>
            </section>
            <div className="border-t border-slate-800" />
            <section className="space-y-2">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Github className="w-5 h-5 text-slate-300" />
                  GitHub Actions และประวัติการทำงาน
                </h2>
                <p className="text-xs text-slate-400">ตรวจสอบ workflow และสั่งรันงานตรวจหวยเมื่อจำเป็น</p>
              </div>
              <Suspense fallback={<div className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-400">กำลังโหลด GitHub Actions...</div>}>
                <GitHubAppRunner onRefreshStatus={fetchData} systemStatus={status} allLotteriesCount={allLotteries.length} />
              </Suspense>
            </section>
          </div>
        )}

        {/* ==================== TAB 3: SMART TICKET CHECKER & AI ACCURACY CENTER ==================== */}
        {(activeTab === 'checker' || activeTab === 'accuracy' || activeTab === 'batch' || activeTab === 'results') && (
          <div className="space-y-6">
            {/* Sub-navigation bar with larger fonts */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCheckerSubTab('batch');
                    setActiveTab('checker');
                  }}
                  className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-sm sm:text-base font-black transition cursor-pointer flex items-center gap-2 ${
                    checkerSubTab === 'batch'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 scale-[1.02]'
                      : 'bg-slate-950/70 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  <Ticket className={`w-5 h-5 ${checkerSubTab === 'batch' ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>🎯 ตรวจรางวัลสลาก (เดี่ยว &amp; ชุดหลายใบ)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCheckerSubTab('history');
                    setActiveTab('history');
                  }}
                  className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-sm sm:text-base font-black transition cursor-pointer flex items-center gap-2 ${
                    checkerSubTab === 'history'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-[1.02]'
                      : 'bg-slate-950/70 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  <History className="w-5 h-5" />
                  <span>📜 ประวัติผลสลากย้อนหลัง ({results.length} งวด)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCheckerSubTab('accuracy');
                    setActiveTab('checker');
                  }}
                  className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-sm sm:text-base font-black transition cursor-pointer flex items-center gap-2 ${
                    checkerSubTab === 'accuracy'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 scale-[1.02]'
                      : 'bg-slate-950/70 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  <Globe className={`w-5 h-5 ${checkerSubTab === 'accuracy' ? 'text-slate-950' : 'text-emerald-400'}`} />
                  <span>🛡️ ตรวจความแม่นยำ AI</span>
                </button>
              </div>

              <div className="text-sm text-slate-300 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 font-medium hidden lg:flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>งวดล่าสุด:</span>
                <span className="font-bold text-amber-300">{latestDraw?.งวดวันที่ || 'ยังไม่มีข้อมูล'}</span>
              </div>
            </div>

            {/* Subtab 1: AI Search Grounding & Voice Verification */}
            {checkerSubTab === 'accuracy' && (
              <CrashShieldErrorBoundary isolateScope fallbackTitle="ระบบป้องกันการตรวจสอบข้อมูลขัดข้อง (AI Accuracy Shield)">
                <Suspense fallback={<div className="p-4 text-sm text-slate-400">กำลังโหลดศูนย์ตรวจสอบความแม่นยำ...</div>}>
                  <DataAccuracyCenter
                    allLotteries={allLotteries}
                    latestDraw={latestDraw}
                    onApplyTicketCheck={(numbers) => {
                      setTicketInput(numbers[0] || '');
                      setCheckerSubTab('batch');
                      showToast(`นำหมายเลข [${numbers.join(', ')}] เข้าสู่ระบบตรวจรางวัลเรียบร้อยแล้ว`);
                    }}
                    onSelectLottery={(item) => setSelectedCatalogLottery(item)}
                  />
                </Suspense>
              </CrashShieldErrorBoundary>
            )}

            {/* Subtab 2: Single & Batch Ticket Checker */}
            {checkerSubTab === 'batch' && (
              <CrashShieldErrorBoundary isolateScope fallbackTitle="ระบบป้องกันเครื่องตรวจสลากขัดข้อง (Checker Shield)">
                <Suspense fallback={<div className="p-4 text-sm text-slate-400">กำลังโหลดเครื่องตรวจสลาก...</div>}>
                  <BatchTicketChecker results={results} latestDraw={latestDraw} />
                </Suspense>
              </CrashShieldErrorBoundary>
            )}

            {/* Subtab 3: Past Results History with Prize Filter Dropdown */}
            {checkerSubTab === 'history' && <IndividualHistory lotteries={allLotteries} results={results} />}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer id="bombim-footer" className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        Lottery Alert System • ระบบแจ้งเตือนผลหวยพร้อมเสียงพูดไทย & ตัวปรับแต่งรูปแบบข้อความตัวหนังสือ
      </footer>

      {/* Admin & Back-Office Control Center Modal */}
      {isAdminBackOfficeOpen && <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 text-sm text-slate-200">กำลังโหลดศูนย์หลังบ้าน...</div>}>
      <AdminBackOfficeModal
        isOpen={isAdminBackOfficeOpen}
        onClose={() => setIsAdminBackOfficeOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveMultiChannelSettings}
        status={status}
        latestDraw={latestDraw}
        allLotteries={allLotteries}
        voiceEnabled={voiceEnabled}
        onToggleVoice={handleToggleVoice}
        onStopSpeech={stopSpeech}
        isSpeaking={isSpeaking}
        onTriggerCheck={handleTriggerCheck}
        isTriggering={isTriggering}
        onRefreshData={fetchData}
        templateProps={{
          templateTitle,
          setTemplateTitle,
          templateBody,
          setTemplateBody,
          speechScript,
          setSpeechScript,
          politeParticle,
          setPoliteParticle,
          modalTheme,
          setModalTheme,
          fontSize,
          setFontSize,
          fontFamily,
          setFontFamily,
          speechRate,
          setSpeechRate,
          onSaveTemplate: handleSaveTemplate,
          onApplyPreset: (key: string) => applyPreset(key as any),
          onTestAnnouncement: testSingleAnnouncement,
        }}
      />
      </Suspense>}
    </div>
  );
}

