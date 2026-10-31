import React, { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  Calendar,
  Clock,
  Search,
  Filter,
  Volume2,
  CheckCircle2,
  Hourglass,
  ArrowUpDown,
  Download,
  Copy,
  TrendingUp,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  History,
  RotateCcw,
  Eye,
  RefreshCw,
  TableProperties,
  Edit3,
  Plus,
  Trash2,
  AlertTriangle,
  Share2,
  Image as ImageIcon,
  BarChart3,
  ListFilter,
  Check,
  Flame,
} from 'lucide-react';
import { parseLotteryTimelineMinutes } from './LiveUpcomingDraws';
import { filterLotteriesForDrawDate } from '../utils/lotterySchedule';
import { EditLotteryModal } from './EditLotteryModal';
import { SummaryImageModal } from './SummaryImageModal';
import { LotteryStatsModal } from './LotteryStatsModal';
import { QuickLotteryMenu } from './QuickLotteryMenu';

export interface LotteryItem {
  id: string;
  name: string;
  category: 'foreign_stock' | 'thai_stock' | 'hanoi' | 'lao' | 'vip' | 'gov_savings' | 'other_foreign';
  categoryLabel: string;
  period?: 'morning' | 'afternoon' | 'evening' | 'night';
  periodLabel?: string;
  flag: string;
  drawTimeStr: string;
  closeTimeStr: string;
  drawDays: string;
  status: 'announced' | 'waiting' | 'upcoming';
  top3: string;
  bottom2: string;
  firstPrize?: string;
  setIndex?: string;
  date: string;
  source: string;
  history?: Array<{ date: string; top3: string; bottom2: string }>;
}

interface DailySummaryProps {
  lotteries: LotteryItem[];
  onSelectLottery: (lottery: LotteryItem) => void;
  onSpeakLottery: (lottery: LotteryItem) => void;
  onUpdateLotteries?: (lotteries: LotteryItem[]) => void;
  nextClosing?: { name: string; closeTimeStr: string; remainingText: string } | null;
  results?: any[];
}

export const DailySummaryTable: React.FC<DailySummaryProps> = ({
  lotteries,
  onSelectLottery,
  onSpeakLottery,
  onUpdateLotteries,
  nextClosing,
  results = [],
}) => {
  // Mode: Today vs Daily Historical Date Picker
  const [summaryMode, setSummaryMode] = useState<'today' | 'daily'>('today');
  
  // Date picker state (Bangkok Time)
  const getTodayBangkokIso = () => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  };
  const todayBangkokIso = useMemo(() => getTodayBangkokIso(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayBangkokIso);
  const isSelectedDateToday = selectedDate === todayBangkokIso;

  // Thai Date Formatter (พ.ศ.)
  const formatThaiDisplayDate = (isoDate: string) => {
    try {
      const [y, m, d] = isoDate.split('-').map(Number);
      if (!y || !m || !d) return isoDate;
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  // Date Shift Helper (+1 / -1 day)
  const shiftSelectedDate = (days: number) => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() + days);
      const nextIso = dateObj.toISOString().slice(0, 10);
      if (nextIso > todayBangkokIso) return; // Cannot pick future dates
      setSelectedDate(nextIso);
      setSummaryMode(nextIso === todayBangkokIso ? 'today' : 'daily');
    } catch {
      // fallback
    }
  };

  // Robust Date Normalizer across ISO, Thai dotted/slashed, and Thai text
  const normalizeDateToIso = (raw: unknown): string => {
    if (!raw) return '';
    const str = String(raw).trim();
    // 1. ISO: YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const y = Number(isoMatch[1]);
      const year = y > 2400 ? y - 543 : y;
      const m = String(isoMatch[2]).padStart(2, '0');
      const d = String(isoMatch[3]).padStart(2, '0');
      return `${year}-${m}-${d}`;
    }
    // 2. DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (dmyMatch) {
      const d = String(dmyMatch[1]).padStart(2, '0');
      const m = String(dmyMatch[2]).padStart(2, '0');
      const y = Number(dmyMatch[3]);
      const year = y > 2400 ? y - 543 : y;
      return `${year}-${m}-${d}`;
    }
    // 3. Thai month text
    const thaiMonths: Record<string, string> = {
      'ม.ค.': '01', 'มกราคม': '01',
      'ก.พ.': '02', 'กุมภาพันธ์': '02',
      'มี.ค.': '03', 'มีนาคม': '03',
      'เม.ย.': '04', 'เมษายน': '04',
      'พ.ค.': '05', 'พฤษภาคม': '05',
      'มิ.ย.': '06', 'มิถุนายน': '06',
      'ก.ค.': '07', 'กรกฎาคม': '07',
      'ส.ค.': '08', 'สิงหาคม': '08',
      'ก.ย.': '09', 'กันยายน': '09',
      'ต.ค.': '10', 'ตุลาคม': '10',
      'พ.ย.': '11', 'พฤศจิกายน': '11',
      'ธ.ค.': '12', 'ธันวาคม': '12',
    };
    for (const [tMon, mNum] of Object.entries(thaiMonths)) {
      if (str.includes(tMon)) {
        const dayMatch = str.match(/(\d{1,2})/);
        const yearMatch = str.match(/(\d{4})/);
        if (dayMatch && yearMatch) {
          const d = String(dayMatch[1]).padStart(2, '0');
          const y = Number(yearMatch[1]);
          const year = y > 2400 ? y - 543 : y;
          return `${year}-${mNum}-${d}`;
        }
      }
    }
    return '';
  };

  // Collect all available historical draw dates from results feed and history
  const availableHistoricalDates = useMemo(() => {
    const datesSet = new Set<string>();
    if (Array.isArray(results)) {
      results.forEach((row) => {
        const iso = normalizeDateToIso(row.วันที่จัดรูปแบบ || row.งวดวันที่ || row.date || row.draw_date);
        if (iso) datesSet.add(iso);
      });
    }
    lotteries.forEach((l) => {
      l.history?.forEach((h) => {
        const iso = normalizeDateToIso(h.date);
        if (iso) datesSet.add(iso);
      });
    });
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [results, lotteries]);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closing_soon' | 'closed_waiting' | 'announced'>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [detailLottery, setDetailLottery] = useState<LotteryItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [autoShareImage, setAutoShareImage] = useState(false);
  const [imageModalLotteries, setImageModalLotteries] = useState<LotteryItem[]>([]);
  const [imageModalTitle, setImageModalTitle] = useState('สรุปผลหวย');
  const [imageModalPeriod, setImageModalPeriod] = useState('สรุปภาพรวม');

  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsModalLottery, setStatsModalLottery] = useState<LotteryItem | null>(null);

  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);

  // Schedule editor state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLottery, setEditingLottery] = useState<LotteryItem | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const normalizeMatchKey = (value: unknown) => String(value ?? '').toLocaleLowerCase().replace(/[\s._#-]+/g, '');
  const getResultDateSortValue = (row: any): number => {
    const raw = String(row?.วันที่จัดรูปแบบ || row?.งวดวันที่ || row?.date || row?.draw_date || '').trim();
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const dotted = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dotted) {
      const year = Number(dotted[3]) >= 2400 ? Number(dotted[3]) - 543 : Number(dotted[3]);
      return Date.UTC(year, Number(dotted[2]) - 1, Number(dotted[1]));
    }
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const resultAliases: Record<string, string[]> = {
    nikkei_morning: ['หวยหุ้นนิเคอิเช้า', 'หวยหุ้นนิคเคอิเช้า', 'stocknikkei1'],
    nikkei_afternoon: ['หวยหุ้นนิเคอิบ่าย', 'หวยหุ้นนิคเคอิบ่าย', 'stocknikkei2'],
    nikkei_vip_morning: ['หวยหุ้นนิเคอิ VIP เช้า', 'หวยหุ้นนิคเคอิ VIP เช้า'],
    nikkei_vip_afternoon: ['หวยหุ้นนิเคอิ VIP บ่าย', 'หวยหุ้นนิคเคอิ VIP บ่าย'],
    china_morning: ['หวยหุ้นจีนเช้า', 'stockchina1'],
    china_afternoon: ['หวยหุ้นจีนบ่าย', 'stockchina2'],
    china_vip_morning: ['หวยหุ้นจีน VIP เช้า'],
    china_vip_afternoon: ['หวยหุ้นจีน VIP บ่าย'],
    hangseng_morning: ['หวยหุ้นฮั่งเส็งเช้า', 'stockhangseng1'],
    hangseng_afternoon: ['หวยหุ้นฮั่งเส็งบ่าย', 'stockhangseng2'],
    hangseng_vip_morning: ['หวยหุ้นฮั่งเส็ง VIP เช้า'],
    hangseng_vip_afternoon: ['หวยหุ้นฮั่งเส็ง VIP บ่าย'],
    taiwan: ['หวยหุ้นไต้หวัน', 'stocktaiwan'],
    taiwan_vip: ['หวยหุ้นไต้หวัน VIP'],
    korea: ['หวยหุ้นเกาหลี', 'stockkorea'],
    korea_vip: ['หวยหุ้นเกาหลี VIP'],
    singapore: ['หวยหุ้นสิงคโปร์', 'stocksingapore'],
    singapore_vip: ['หวยหุ้นสิงคโปร์ VIP'],
    thai_stock_evening: ['หวยหุ้นไทยเย็น', 'stockthai4'],
    india: ['หวยหุ้นอินเดีย', 'stockindia'],
    russia: ['หวยหุ้นรัสเซีย'],
    dowjones: ['หวยหุ้นดาวโจนส์'],
    thai_gov: ['หวยรัฐบาลไทย', 'สลากกินแบ่งรัฐบาล', 'thailotto'],
    gsb: ['หวยออมสิน', 'gsblotto'],
    baac: ['หวยธกส.', 'หวย ธ.ก.ส.', 'baaclotto'],
  };

  const selectedResult = detailLottery
    ? results
        .filter((row) => {
          const idKey = normalizeMatchKey(detailLottery.id);
          const nameKey = normalizeMatchKey(detailLottery.name);
          const allowedKeys = [idKey, nameKey, ...(resultAliases[detailLottery.id] || []).map(normalizeMatchKey)].filter(Boolean);
          const candidates = [row.หวย, row.lottery, row.lottery_code, row.ชื่อหวย, row.lotteryName]
            .map(normalizeMatchKey)
            .filter(Boolean);
          return candidates.some((key) => allowedKeys.includes(key));
        })
        .sort((a, b) => getResultDateSortValue(b) - getResultDateSortValue(a))[0]
    : null;

  // Bangkok time in minutes for 4-stage live calculation
  const getBangkokMinutes = () => {
    const now = new Date();
    const bangkokStr = now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour12: false });
    const bDate = new Date(bangkokStr);
    let hours = bDate.getHours();
    if (hours < 4) hours += 24;
    return hours * 60 + bDate.getMinutes();
  };
  const currentBangkokMinutes = getBangkokMinutes();

  // Helper to get 4-stage live status for any lottery
  const getItemStage = (item: LotteryItem) => {
    if (!isSelectedDateToday || summaryMode === 'daily') {
      if (item.status === 'announced' || (item.top3 && item.bottom2)) {
        return {
          stage: 'announced' as const,
          label: 'ออกผลแล้ว',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          detail: `ออกผลแล้ว (งวด ${item.date})`,
        };
      }
      return {
        stage: 'closed_waiting' as const,
        label: '⏳ รอผล / ไม่มีรอบ',
        badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
        detail: `ไม่มีผลบันทึกในวันที่ ${selectedDate}`,
      };
    }

    const closeMin = parseLotteryTimelineMinutes(item.closeTimeStr);
    const drawMin = parseLotteryTimelineMinutes(item.drawTimeStr);

    if (item.status === 'announced' || currentBangkokMinutes >= drawMin) {
      return {
        stage: 'announced' as const,
        label: 'ออกผลแล้ว',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        detail: `ออกผลแล้ว (${item.drawTimeStr})`,
      };
    }

    if (currentBangkokMinutes >= closeMin && currentBangkokMinutes < drawMin) {
      const waitMins = Math.max(1, drawMin - currentBangkokMinutes);
      return {
        stage: 'closed_waiting' as const,
        label: '🔴 ปิดรับแล้ว - รอผล',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse font-bold',
        detail: `ปิดรับแล้ว รอผลอีก ${waitMins} นาที`,
      };
    }

    const minsUntilClose = closeMin - currentBangkokMinutes;
    if (minsUntilClose <= 15 && minsUntilClose > 0) {
      return {
        stage: 'closing_soon' as const,
        label: `🟡 ใกล้ปิด! (${minsUntilClose}น.)`,
        badgeClass: 'bg-amber-500/25 text-amber-300 border-amber-500/50 animate-pulse font-bold',
        detail: `รีบแทง! เหลือ ${minsUntilClose} นาที`,
      };
    }

    return {
      stage: 'open' as const,
      label: '🟢 เปิดรับแทง',
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      detail: `ปิดรับ ${item.closeTimeStr}`,
    };
  };

  // Process lotteries according to Today vs Daily Selected Date
  const activeLotteryList = useMemo(() => {
    if (isSelectedDateToday && summaryMode === 'today') return lotteries;

    // Filter lotteries appropriate for selected date (e.g. government lotteries on 1st/16th)
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    const baseList = filterLotteriesForDrawDate(lotteries, dateObj);

    // Daily mode: map each lottery to the historical draw on selectedDate
    return baseList.map((item) => {
      const idKey = normalizeMatchKey(item.id);
      const nameKey = normalizeMatchKey(item.name);
      const allowedKeys = [idKey, nameKey, ...(resultAliases[item.id] || []).map(normalizeMatchKey)].filter(Boolean);

      const matchedRows = results.filter((row) => {
        const rowDateIso = normalizeDateToIso(row.วันที่จัดรูปแบบ || row.งวดวันที่ || row.date || row.draw_date);
        if (rowDateIso !== selectedDate) return false;

        const candidates = [row.หวย, row.lottery, row.lottery_code, row.ชื่อหวย, row.lotteryName]
          .map(normalizeMatchKey)
          .filter(Boolean);
        return candidates.some((k) => allowedKeys.includes(k) || (k && nameKey && (k.includes(nameKey) || nameKey.includes(k))));
      });

      if (matchedRows.length > 0) {
        const best = matchedRows[0];
        const top3 = String(best.เลขบน_3_ตัว || best.top3 || (best.รางวัลที่_1 ? String(best.รางวัลที่_1).slice(-3) : '') || '').trim();
        const bot2 = String(best.เลขล่าง_2_ตัว || best.bottom2 || best.เลขท้าย_2_ตัว || '').trim();
        return {
          ...item,
          status: 'announced' as const,
          top3: top3 || item.top3,
          bottom2: bot2 || item.bottom2,
          firstPrize: best.รางวัลที่_1 || item.firstPrize,
          date: best.งวดวันที่ || selectedDate,
          source: best.แหล่งข้อมูล || 'ประวัติผลรางวัล (JSON)',
        };
      }

      // Check item.history
      const historyMatch = item.history?.find((h) => {
        const hIso = normalizeDateToIso(h.date);
        return hIso === selectedDate;
      });
      if (historyMatch) {
        return {
          ...item,
          status: 'announced' as const,
          top3: historyMatch.top3,
          bottom2: historyMatch.bottom2,
          date: historyMatch.date,
          source: 'ประวัติผลรางวัล',
        };
      }

      return {
        ...item,
        status: 'waiting' as const,
        top3: '',
        bottom2: '',
        date: selectedDate,
      };
    });
  }, [lotteries, summaryMode, isSelectedDateToday, selectedDate, results]);

  // Count announced results for historical date banner
  const historicalAnnouncedCount = useMemo(() => {
    return activeLotteryList.filter((l) => l.status === 'announced' || (l.top3 && l.bottom2)).length;
  }, [activeLotteryList]);

  // Sort ALL lotteries strictly by real timeline order
  const chronoSorted = useMemo(() => {
    return [...activeLotteryList].sort((a, b) => {
      return parseLotteryTimelineMinutes(a.drawTimeStr) - parseLotteryTimelineMinutes(b.drawTimeStr);
    });
  }, [activeLotteryList]);

  // Filter items according to search, category, and 4-stage status
  const filteredLotteries = useMemo(() => {
    return chronoSorted.filter((item) => {
      // Period filter
      if (['morning', 'afternoon', 'evening', 'night'].includes(selectedCategory)) {
        if (item.period !== selectedCategory) return false;
      } else if (selectedCategory === 'vip') {
        const isVip = item.category === 'vip' || item.name.includes('VIP') || item.categoryLabel.includes('VIP');
        if (!isVip) return false;
      } else if (selectedCategory === 'hanoi') {
        const isHanoi = item.category === 'hanoi' || item.name.includes('ฮานอย');
        if (!isHanoi) return false;
      } else if (selectedCategory === 'lao') {
        const isLao = item.category === 'lao' || item.name.includes('ลาว');
        if (!isLao) return false;
      } else if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // 4-Stage Status filter
      if (statusFilter !== 'all') {
        const itemStage = getItemStage(item).stage;
        if (itemStage !== statusFilter) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = item.name.toLowerCase().includes(term);
        const matchTop = item.top3.includes(term);
        const matchBottom = item.bottom2.includes(term);
        const matchCat = item.categoryLabel.toLowerCase().includes(term);
        if (!matchName && !matchTop && !matchBottom && !matchCat) return false;
      }
      return true;
    });
  }, [chronoSorted, selectedCategory, statusFilter, searchTerm, currentBangkokMinutes, summaryMode]);

  // Statistics for 4 stages
  const totalCount = activeLotteryList.length;
  const stagesCount = useMemo(() => {
    let open = 0;
    let closing = 0;
    let closed = 0;
    let announced = 0;
    activeLotteryList.forEach((l) => {
      const s = getItemStage(l).stage;
      if (s === 'open') open++;
      else if (s === 'closing_soon') closing++;
      else if (s === 'closed_waiting') closed++;
      else if (s === 'announced') announced++;
    });
    return { open, closing, closed, announced };
  }, [activeLotteryList, currentBangkokMinutes, summaryMode]);

  const handleSaveLottery = (savedItem: LotteryItem) => {
    if (!onUpdateLotteries) return;
    const exists = lotteries.some((l) => l.id === savedItem.id);
    let updated: LotteryItem[];
    if (exists) {
      updated = lotteries.map((l) => (l.id === savedItem.id ? savedItem : l));
    } else {
      updated = [savedItem, ...lotteries];
    }
    onUpdateLotteries(updated);
  };

  const handleDeleteLottery = (id: string) => {
    if (!onUpdateLotteries) return;
    const updated = lotteries.filter((l) => l.id !== id);
    onUpdateLotteries(updated);
  };

  // Generate plain text according to user format
  const generateBulkSummaryText = () => {
    let periodName = 'รวมทั้งหมด';
    if (selectedCategory === 'morning') periodName = 'รอบเช้า';
    else if (selectedCategory === 'afternoon') periodName = 'รอบบ่าย';
    else if (selectedCategory === 'evening') periodName = 'รอบเย็น';
    else if (selectedCategory === 'night') periodName = 'รอบดึก';

    const dateDisplay = isSelectedDateToday && summaryMode === 'today'
      ? new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
      : formatThaiDisplayDate(selectedDate);

    const itemsToShare = filteredLotteries.filter((l) => l.status === 'announced' || (l.top3 && l.bottom2));
    const listToUse = itemsToShare.length > 0 ? itemsToShare : filteredLotteries;

    let headerEmoji = '☀️';
    if (periodName.includes('บ่าย')) headerEmoji = '🌤️';
    else if (periodName.includes('เย็น')) headerEmoji = '🌆';
    else if (periodName.includes('ดึก')) headerEmoji = '🌙';
    else if (periodName.includes('ทั้งหมด') || periodName.includes('รวม')) headerEmoji = '📋';

    let text = `${headerEmoji} สรุปผลหวย${periodName} (${dateDisplay})\n`;
    text += `📋 ทั้งหมด ${listToUse.length} รายการ\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    listToUse.forEach((l, idx) => {
      const top3 = l.top3 || '---';
      const bot2 = l.bottom2 || '--';
      text += `${idx + 1}. ${l.flag} ${l.name} ${l.flag}\n`;
      text += ` 👉 3 บน: ${top3} • 2 ล่าง: ${bot2}\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📢 อัปเดตเรียลไทม์ผ่าน Lottery Alert Pro\n`;
    text += `#ผลหวย #หวยหุ้น #หวยฮานอย #หวยลาว`;
    return text;
  };

  // Copy Full Summary Text
  const copyDailySummaryText = async () => {
    const summary = generateBulkSummaryText();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = summary;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopiedSummary(true);
      showToast('คัดลอกข้อความสรุปตามรูปแบบเรียบร้อยแล้ว! 📋');
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      showToast('คัดลอกไม่สำเร็จ');
    }
  };

  // Share Full Summary Text via Web Share API
  const shareDailySummaryText = async () => {
    const summary = generateBulkSummaryText();
    let periodName = 'สรุปผลหวย';
    if (selectedCategory === 'morning') periodName = 'สรุปผลหวยรอบเช้า';
    else if (selectedCategory === 'afternoon') periodName = 'สรุปผลหวยรอบบ่าย';
    else if (selectedCategory === 'evening') periodName = 'สรุปผลหวยรอบเย็น';
    else if (selectedCategory === 'night') periodName = 'สรุปผลหวยรอบดึก';

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${periodName} (${summaryMode === 'today' ? 'วันนี้' : selectedDate})`,
          text: summary,
        });
        showToast('แชร์สรุปผลหวยสำเร็จ! 🎉');
      } catch {
        copyDailySummaryText();
      }
    } else {
      copyDailySummaryText();
    }
  };

  // Copy single lottery result
  const copySingleLottery = async (l: LotteryItem) => {
    const top3 = l.top3 || '---';
    const bot2 = l.bottom2 || '--';
    const dateStr = l.date || 'งวดล่าสุด';
    const text = `${l.flag} ${l.name} ${l.flag} (งวดวันที่ ${dateStr})\n 👉 3 บน: ${top3} • 2 ล่าง: ${bot2}\n📢 อัปเดตเรียลไทม์ผ่าน Lottery Alert Pro\n#ผลหวย #${l.name.replace(/\s+/g, '')}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showToast(`คัดลอกผล ${l.name} เรียบร้อยแล้ว! 📋`);
    } catch {
      showToast('คัดลอกไม่สำเร็จ');
    }
  };

  // Share single lottery result
  const shareSingleLottery = async (l: LotteryItem) => {
    const top3 = l.top3 || '---';
    const bot2 = l.bottom2 || '--';
    const dateStr = l.date || 'งวดล่าสุด';
    const text = `${l.flag} ${l.name} ${l.flag} (งวดวันที่ ${dateStr})\n 👉 3 บน: ${top3} • 2 ล่าง: ${bot2}\n📢 อัปเดตเรียลไทม์ผ่าน Lottery Alert Pro\n#ผลหวย #${l.name.replace(/\s+/g, '')}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `ผลหวย ${l.name} (${dateStr})`,
          text: text,
        });
        showToast(`แชร์ผลหวย ${l.name} สำเร็จ! 🎉`);
      } catch {
        copySingleLottery(l);
      }
    } else {
      copySingleLottery(l);
    }
  };

  // Pronounce announcement per user instruction:
  // For Thai Gov Lottery: read full official prizes.
  // For stock lotteries and others: read 3 ตัว 2 ตัว without saying บน/ล่าง!
  const handleCustomSpeakLottery = (item: LotteryItem) => {
    const isThaiGov = item.category === 'gov_savings' || item.id === 'thai_gov' || item.name.includes('สลากกินแบ่งรัฐบาล') || item.name.includes('หวยรัฐบาลไทย');
    const topResult = String(item.top3 || item.firstPrize || '').trim();
    const bottomResult = String(item.bottom2 || '').trim();

    if (!topResult && !bottomResult) {
      showToast('ยังไม่มีผลรางวัลจริงสำหรับอ่านออกเสียง');
      return;
    }

    const thaiNums: Record<string, string> = {
      '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
      '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า'
    };
    const spell = (str: string) => str.split('').map((c) => thaiNums[c] || c).join(' ');

    let speechText = `ประกาศผล ${item.name} งวดวันที่ ${item.date || 'ล่าสุด'}. `;
    if (isThaiGov && item.firstPrize) {
      speechText += `รางวัลที่หนึ่ง ออกเลข ${spell(item.firstPrize)}. `;
      if (bottomResult) speechText += `เลขท้ายสองตัว ออกเลข ${spell(bottomResult)}. `;
    } else {
      // User requirement: stocks read 3 ตัว 2 ตัว, do not say 3 บน 2 ล่าง
      if (topResult) speechText += `สามตัว ออกเลข ${spell(topResult)}. `;
      if (bottomResult) speechText += `สองตัว ออกเลข ${spell(bottomResult)}. `;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(speechText);
      u.lang = 'th-TH';
      u.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const thaiVoice = voices.find((v) => v.lang.includes('th') || v.name.includes('Thai'));
      if (thaiVoice) u.voice = thaiVoice;
      window.speechSynthesis.speak(u);
      showToast(`กำลังอ่านผล: ${item.name}`);
    } else {
      onSpeakLottery(item);
    }
  };

  // Open Image Modal
  const handleOpenImageModal = (specificLottery?: LotteryItem, autoShare = false) => {
    setAutoShareImage(autoShare);
    if (specificLottery) {
      setImageModalLotteries([specificLottery]);
      setImageModalTitle(`ผลหวย ${specificLottery.name}`);
      setImageModalPeriod(specificLottery.periodLabel || 'ผลรางวัล');
    } else {
      let periodName = 'สรุปผลหวยรวมทั้งหมด';
      if (selectedCategory === 'morning') periodName = 'สรุปผลหวยรอบเช้า';
      else if (selectedCategory === 'afternoon') periodName = 'สรุปผลหวยรอบบ่าย';
      else if (selectedCategory === 'evening') periodName = 'สรุปผลหวยรอบเย็น';
      else if (selectedCategory === 'night') periodName = 'สรุปผลหวยรอบดึก';
      else if (!isSelectedDateToday || summaryMode === 'daily') periodName = `สรุปผลหวยประจำงวด ${formatThaiDisplayDate(selectedDate)}`;

      const itemsToUse = filteredLotteries.filter((l) => l.status === 'announced' || (l.top3 && l.bottom2));
      setImageModalLotteries(itemsToUse.length > 0 ? itemsToUse : filteredLotteries);
      setImageModalTitle(periodName);
      setImageModalPeriod(periodName);
    }
    setIsImageModalOpen(true);
  };

  // Open 10-draw stats modal
  const handleOpenStatsModal = (lottery: LotteryItem) => {
    setStatsModalLottery(lottery);
    setIsStatsModalOpen(true);
  };

  const downloadResultsCsv = async () => {
    if (!Array.isArray(results) || results.length === 0) {
      showToast('ยังไม่มีข้อมูลผลหวยให้ดาวน์โหลด');
      return;
    }

    const columns = [
      ['ชื่อหวย', 'ชื่อหวย'],
      ['รหัสหวย', 'หวย'],
      ['หมวดหวย', 'หมวดหวย'],
      ['งวดวันที่', 'งวดวันที่'],
      ['รางวัลที่ 1', 'รางวัลที่_1'],
      ['เลขบน 3 ตัว', 'เลขบน_3_ตัว'],
      ['เลขท้าย 2 ตัว', 'เลขท้าย_2_ตัว'],
      ['เลขล่าง 2 ตัว', 'เลขล่าง_2_ตัว'],
      ['แหล่งข้อมูล', 'แหล่งข้อมูล'],
      ['เวลาที่ตรวจพบ', 'เวลาที่ตรวจพบ'],
    ] as const;
    const csvCell = (value: unknown) => {
      const cell = Array.isArray(value) ? value.join(', ') : String(value ?? '');
      return '"' + cell.replace(/"/g, '""') + '"';
    };
    const csv = '\uFEFF' + [
      columns.map(([label]) => csvCell(label)).join(','),
      ...results.map((row) => columns.map(([, key]) => csvCell(row?.[key])).join(',')),
    ].join('\r\n');
    const fileName = `Bombim00-results-${new Date().toISOString().slice(0, 10)}.csv`;

    try {
      if (Capacitor.isNativePlatform()) {
        const file = await Filesystem.writeFile({
          path: fileName,
          data: csv,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'ผลหวย Bombim00',
          text: `ส่งออกผลหวย ${results.length} รายการ`,
          url: file.uri,
          dialogTitle: 'บันทึกหรือแชร์ไฟล์ผลหวย',
        });
      } else {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
      showToast('ส่งออก CSV เรียบร้อยแล้ว! 📥');
    } catch (error) {
      console.error('CSV export failed:', error);
      showToast('ส่งออกไฟล์ไม่สำเร็จ');
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'foreign_stock':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'thai_stock':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'hanoi':
        return 'bg-red-500/15 text-red-300 border-red-500/30';
      case 'lao':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'vip':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'gov_savings':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-amber-500/50 text-white shadow-2xl flex items-center gap-2 text-sm animate-bounce">
          <Check className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          UNIFIED CALENDAR & DATE SELECTION TOOLBAR (Clean, single source of truth)
          ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xl space-y-3">
        {/* Row 1: Quick Preset Buttons, Historical Dates Dropdown, Stepper & Calendar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Quick Date Preset Pills & Feed Dates Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 1. Today Button */}
            <button
              type="button"
              onClick={() => {
                setSelectedDate(todayBangkokIso);
                setSummaryMode('today');
              }}
              className={`px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                isSelectedDateToday && summaryMode === 'today'
                  ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400 font-extrabold'
                  : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>☀️ สรุปวันนี้</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/25 font-mono uppercase tracking-wider font-bold">
                Live
              </span>
            </button>

            {/* 2. Yesterday Button */}
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                const yIso = d.toISOString().slice(0, 10);
                setSelectedDate(yIso);
                setSummaryMode('daily');
              }}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition cursor-pointer ${
                selectedDate === (() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  return d.toISOString().slice(0, 10);
                })()
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 ring-1 ring-amber-400'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              เมื่อวาน
            </button>

            {/* 3. Two Days Ago Button */}
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 2);
                const twoDaysAgoIso = d.toISOString().slice(0, 10);
                setSelectedDate(twoDaysAgoIso);
                setSummaryMode('daily');
              }}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition cursor-pointer hidden sm:inline-flex ${
                selectedDate === (() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 2);
                  return d.toISOString().slice(0, 10);
                })()
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 ring-1 ring-amber-400'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              2 วันก่อน
            </button>

            {/* 4. Dropdown of all dates that actually have recorded data in JSON feed */}
            {availableHistoricalDates.length > 0 && (
              <div className="relative inline-flex items-center">
                <select
                  value={selectedDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setSelectedDate(newDate);
                    setSummaryMode(newDate === todayBangkokIso ? 'today' : 'daily');
                  }}
                  className="bg-slate-950 text-amber-300 font-semibold text-xs border border-amber-500/30 hover:border-amber-400 rounded-xl px-2.5 py-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400"
                  title="เลือกดูผลหวยตามงวดที่มีข้อมูลจริงในระบบ"
                >
                  <option value="" disabled>-- เลือกงวดที่มีข้อมูลในระบบ ({availableHistoricalDates.length} งวด) --</option>
                  {availableHistoricalDates.map((dateStr) => (
                    <option key={dateStr} value={dateStr}>
                      งวด {formatThaiDisplayDate(dateStr)} {dateStr === todayBangkokIso ? '(วันนี้)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right: Stepper (< Calendar Input >) & All-Lotteries Menu */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Calendar Stepper */}
            <div className="flex items-center bg-slate-950 border border-slate-700 hover:border-amber-500/50 rounded-xl p-1 transition shadow-inner">
              {/* Previous Day Button */}
              <button
                type="button"
                onClick={() => shiftSelectedDate(-1)}
                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded-lg transition cursor-pointer"
                title="ย้อนหลัง 1 วัน"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Native Calendar Date Picker */}
              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                <input
                  type="date"
                  max={todayBangkokIso}
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setSummaryMode(e.target.value === todayBangkokIso ? 'today' : 'daily');
                    }
                  }}
                  className="bg-transparent text-amber-300 font-mono text-xs sm:text-sm font-bold focus:outline-none cursor-pointer"
                  title="คลิกไอคอนปฏิทินเพื่อเลือกวันย้อนหลัง"
                />
              </div>

              {/* Next Day Button */}
              <button
                type="button"
                onClick={() => shiftSelectedDate(1)}
                disabled={selectedDate >= todayBangkokIso}
                className={`p-1.5 rounded-lg transition ${
                  selectedDate >= todayBangkokIso
                    ? 'text-slate-600 cursor-not-allowed opacity-40'
                    : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900 cursor-pointer'
                }`}
                title="ถัดไป 1 วัน"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Menu Button */}
            <button
              type="button"
              onClick={() => setIsQuickMenuOpen(true)}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <ListFilter className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">เมนูเลือกหวยทุกประเภท</span> ({lotteries.length})
            </button>
          </div>
        </div>

        {/* Row 2: Active Historical Date Banner (Shown when inspecting past dates) */}
        {!isSelectedDateToday && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                <History className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-amber-300">
                  กำลังดูผลหวยย้อนหลัง ประจำงวดวันที่ {formatThaiDisplayDate(selectedDate)}
                </span>
                <span className="text-slate-400 ml-2">
                  (พบผลรางวัล <strong className="text-emerald-400 font-mono font-bold">{historicalAnnouncedCount}</strong> รายการ จากทั้งหมด {totalCount} รายการ)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDate(todayBangkokIso);
                setSummaryMode('today');
              }}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>กลับสู่งวดวันนี้</span>
            </button>
          </div>
        )}
      </div>

      {/* Header Banner & Social Action Buttons */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 sm:p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
              {isSelectedDateToday && summaryMode === 'today' ? 'TODAY LIVE SUMMARY' : 'DAILY ARCHIVE SUMMARY'}
            </span>
            <span className="text-xs text-slate-400">
              {isSelectedDateToday && summaryMode === 'today'
                ? 'อัปเดตเรียลไทม์ 4 ช่วงเวลา'
                : `ดูผลย้อนหลังประจำงวด ${formatThaiDisplayDate(selectedDate)} (พบ ${historicalAnnouncedCount} รายการ)`}
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-400" />
            <span>
              {isSelectedDateToday && summaryMode === 'today'
                ? `ตารางสรุปผลหวยวันนี้ (${totalCount} รายการ)`
                : `สรุปผลหวยประจำงวดวันที่ ${formatThaiDisplayDate(selectedDate)} (${totalCount} รายการ)`}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            พร้อมเครื่องมือส่งออกรูปการสรุป (.PNG), คัดลอกข้อความแชร์, ดูสถิติ 10 งวด และอ่านออกเสียง
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 🖼️ View Summary Image Button */}
          <button
            type="button"
            onClick={() => handleOpenImageModal()}
            className="px-4 py-2.5 sm:px-5 sm:py-3 text-sm sm:text-base font-black rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 cursor-pointer shadow-lg shadow-amber-500/20 transition flex items-center gap-2 ring-1 ring-amber-400 active:scale-95"
            title="สร้างรูปภาพสรุปผลหวยความละเอียดสูงเพื่อบันทึกหรือแชร์"
          >
            <ImageIcon className="w-5 h-5 text-slate-950" />
            <span>🖼️ ดูรูปการสรุป (PNG)</span>
          </button>

          {/* 🚀 Direct Web Share API for Generated Image */}
          <button
            type="button"
            onClick={() => handleOpenImageModal(undefined, true)}
            className="px-4 py-2.5 sm:px-5 sm:py-3 text-sm sm:text-base font-black rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 active:scale-95"
            title="แชร์รูปภาพสรุปผลหวยไปยังโซเชียลมีเดียด้วย Web Share API โดยตรง"
          >
            <Share2 className="w-5 h-5" />
            <span>แชร์รูปภาพ</span>
          </button>

          {/* 📋 Copy Summary Text */}
          <button
            type="button"
            onClick={copyDailySummaryText}
            className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 cursor-pointer shadow-md transition flex items-center gap-2 active:scale-95"
            title="คัดลอกข้อความสรุปตามรูปแบบแชต"
          >
            {copiedSummary ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-bold">คัดลอกแล้ว!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-amber-400" />
                <span>คัดลอกข้อความสรุป</span>
              </>
            )}
          </button>

          {/* 📤 Share Summary Text */}
          <button
            type="button"
            onClick={shareDailySummaryText}
            className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 cursor-pointer shadow-md transition flex items-center gap-2 active:scale-95"
            title="แชร์ข้อความสรุปผลหวย"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>แชร์สรุป</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={() => void downloadResultsCsv()}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition flex items-center gap-1.5"
            title="ดาวน์โหลดไฟล์ CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>CSV</span>
          </button>

          {/* Add Lottery Button */}
          {onUpdateLotteries && (
            <button
              type="button"
              onClick={() => {
                setEditingLottery(null);
                setIsEditModalOpen(true);
              }}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>เพิ่ม</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Stage Live Metric Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Stage 1: Open */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}
          className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
            statusFilter === 'open'
              ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-xs text-blue-400 font-semibold block">🟢 กำลังเปิดรับแทง</span>
            <span className="text-2xl sm:text-3xl font-black text-blue-300 font-mono">{stagesCount.open}</span>
            <span className="text-[11px] text-slate-500 block">เปิดรับตามปกติ</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Hourglass className="w-5 h-5" />
          </div>
        </div>

        {/* Stage 2: Closing Soon (< 15 mins) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'closing_soon' ? 'all' : 'closing_soon')}
          className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
            statusFilter === 'closing_soon'
              ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-xs text-amber-400 font-semibold block">🟡 ใกล้ปิดรับแทง!</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">{stagesCount.closing}</span>
            <span className="text-[11px] text-slate-500 block">เหลือน้อยกว่า 15 นาที</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 animate-pulse text-amber-400" />
          </div>
        </div>

        {/* Stage 3: Closed & Waiting Draw */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'closed_waiting' ? 'all' : 'closed_waiting')}
          className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
            statusFilter === 'closed_waiting'
              ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-xs text-rose-400 font-semibold block">🔴 ปิดรับแล้ว - รอผล</span>
            <span className="text-2xl sm:text-3xl font-black text-rose-300 font-mono">{stagesCount.closed}</span>
            <span className="text-[11px] text-slate-500 block">กำลังรอลุ้นรางวัล</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <Clock className="w-5 h-5 animate-spin text-rose-400" style={{ animationDuration: '6s' }} />
          </div>
        </div>

        {/* Stage 4: Announced */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'announced' ? 'all' : 'announced')}
          className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
            statusFilter === 'announced'
              ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-xs text-emerald-400 font-semibold block">🔵 ออกผลรางวัลแล้ว</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">{stagesCount.announced}</span>
            <span className="text-[11px] text-slate-500 block">มีผล 3 ตัว / 2 ตัว</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-3">
        {/* Category & Period Filter Pills */}
        <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌟 ทุกหวย ({activeLotteryList.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('morning')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'morning'
                ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-amber-500/30'
            }`}
          >
            ☀️ รอบเช้า ({activeLotteryList.filter((l) => l.period === 'morning').length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('afternoon')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'afternoon'
                ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-300'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-orange-500/30'
            }`}
          >
            🌤️ รอบบ่าย ({activeLotteryList.filter((l) => l.period === 'afternoon').length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('evening')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'evening'
                ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-300'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-rose-500/30'
            }`}
          >
            🌆 รอบเย็น ({activeLotteryList.filter((l) => l.period === 'evening').length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('night')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'night'
                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-indigo-500/30'
            }`}
          >
            🌙 รอบดึก ({activeLotteryList.filter((l) => l.period === 'night').length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('gov_savings')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'gov_savings'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🏛️ รัฐ/ออมสิน ({activeLotteryList.filter((l) => l.category === 'gov_savings').length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('hanoi')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'hanoi'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇻🇳 ฮานอย ({activeLotteryList.filter((l) => l.category === 'hanoi' || l.name.includes('ฮานอย')).length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('lao')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'lao'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🇱🇦 ลาว ({activeLotteryList.filter((l) => l.category === 'lao' || l.name.includes('ลาว')).length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('foreign_stock')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'foreign_stock'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            📈 หุ้นต่างประเทศ ({activeLotteryList.filter((l) => l.category === 'foreign_stock').length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('vip')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'vip'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            ⭐ หวย VIP & หุ้นพิเศษ
          </button>
        </div>

        {/* Search Bar & Active Stats Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อหวย, วันออก, หรือตัวเลข (เช่น ลาว EXTRA, 731, 42)..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>แสดง <strong>{filteredLotteries.length}</strong> จาก {totalCount} รายการ</span>
            {statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="text-amber-400 hover:underline cursor-pointer"
              >
                ล้างตัวกรองสถานะ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Results Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950/90 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-3 text-center">ลำดับ</th>
                <th className="py-3.5 px-3">เวลาออกผล</th>
                <th className="py-3.5 px-4">ชื่อหวย / ประเทศ</th>
                <th className="py-3.5 px-3">เวลาปิดรับ</th>
                <th className="py-3.5 px-3">หมวดหมู่</th>
                <th className="py-3.5 px-3 text-center">3 ตัวบน</th>
                <th className="py-3.5 px-3 text-center">2 ตัวล่าง</th>
                <th className="py-3.5 px-3 text-center">สถานะ</th>
                <th className="py-3.5 px-4 text-right">ปุ่มแชร์ / สถิติ / เครื่องมือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {filteredLotteries.length > 0 ? (
                filteredLotteries.map((item, index) => {
                  const isAnnounced = item.status === 'announced' || (item.top3 && item.bottom2);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => {
                        setDetailLottery(item);
                        onSelectLottery(item);
                      }}
                    >
                      {/* Order */}
                      <td className="py-3.5 px-3 text-center text-slate-500 font-bold">
                        {index + 1}
                      </td>

                      {/* Draw Time */}
                      <td className="py-3.5 px-3 font-semibold text-amber-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="font-bold">{item.drawTimeStr}</span>
                        </div>
                      </td>

                      {/* Name & Flag */}
                      <td className="py-4 px-4 font-sans">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl shrink-0">{item.flag}</span>
                          <div>
                            <div className="font-black text-white text-sm sm:text-base group-hover:text-amber-400 transition flex items-center gap-1.5">
                              {item.name}
                            </div>
                            <span className="text-xs text-slate-400 font-mono">
                              {item.drawDays}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Closing Time */}
                      <td className="py-4 px-3 text-slate-300 text-sm font-semibold">
                        <span>{item.closeTimeStr}</span>
                      </td>

                      {/* Category Badge */}
                      <td className="py-4 px-3 font-sans">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getCategoryBadgeClass(
                            item.category
                          )}`}
                        >
                          {item.categoryLabel}
                        </span>
                      </td>

                      {/* Top 3 */}
                      <td className="py-4 px-3 text-center">
                        {isAnnounced && item.top3 ? (
                          <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-black text-base sm:text-lg border border-amber-500/50 shadow-sm inline-block">
                            {item.top3}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-xl bg-slate-950 text-slate-500 font-bold text-xs sm:text-sm border border-slate-800">
                            ⏳ รอผล
                          </span>
                        )}
                      </td>

                      {/* Bottom 2 */}
                      <td className="py-4 px-3 text-center">
                        {isAnnounced && item.bottom2 ? (
                          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-base sm:text-lg border border-emerald-500/50 shadow-sm inline-block">
                            {item.bottom2}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-xl bg-slate-950 text-slate-500 font-bold text-xs sm:text-sm border border-slate-800">
                            ⏳ รอผล
                          </span>
                        )}
                      </td>

                      {/* 4-Stage Live Status Badge */}
                      <td className="py-4 px-3 text-center font-sans">
                        {(() => {
                          const stageInfo = getItemStage(item);
                          return (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 ${stageInfo.badgeClass}`}
                            >
                              {stageInfo.stage === 'announced' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                              {stageInfo.stage === 'closed_waiting' && <Clock className="w-3 h-3 text-rose-400" />}
                              {stageInfo.stage === 'closing_soon' && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                              {stageInfo.stage === 'open' && <Hourglass className="w-3 h-3 text-blue-400" />}
                              {stageInfo.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Tools & Actions: Copy, Share, 10-draw stats, Image, Speak */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Copy button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copySingleLottery(item);
                            }}
                            title="คัดลอกผลหวยนี้"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Share button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              shareSingleLottery(item);
                            }}
                            title="แชร์ผลหวยนี้"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {/* 10-Draw Statistics button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenStatsModal(item);
                            }}
                            title="ดูสถิติ 10 งวด"
                            className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                            <span className="hidden xl:inline">สถิติ 10 งวด</span>
                          </button>

                          {/* Image card preview button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenImageModal(item, false);
                            }}
                            title="สร้างและดูรูปสรุปผลหวยนี้"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>

                          {/* Direct Web Share Image Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenImageModal(item, true);
                            }}
                            title="แชร์รูปภาพผลหวยนี้ไปยังโซเชียลมีเดียด้วย Web Share API โดยตรง"
                            className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 transition cursor-pointer flex items-center gap-1"
                          >
                            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden xl:inline text-[11px] font-semibold">แชร์รูป</span>
                          </button>

                          {/* Speech Synthesis (Custom rule: stocks read 3 ตัว 2 ตัว without บน/ล่าง) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCustomSpeakLottery(item);
                            }}
                            title="ฟังเสียงอ่านผล (3 ตัว / 2 ตัว)"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Lottery */}
                          {onUpdateLotteries && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLottery(item);
                                setIsEditModalOpen(true);
                              }}
                              title="แก้ไขเวลาและข้อมูลหวยนี้"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <p className="text-sm">ไม่พบรายการหวยที่ตรงกับคำค้นหาหรือตัวกรอง</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Image Modal (รูปการสรุป PNG) */}
      <SummaryImageModal
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false);
          setAutoShareImage(false);
        }}
        title={imageModalTitle}
        dateStr={
          isSelectedDateToday && summaryMode === 'today'
            ? new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
            : formatThaiDisplayDate(selectedDate)
        }
        lotteries={imageModalLotteries}
        periodLabel={imageModalPeriod}
        autoShare={autoShareImage}
      />

      {/* 10-Draw Statistics Modal */}
      <LotteryStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => {
          setIsStatsModalOpen(false);
          setStatsModalLottery(null);
        }}
        lottery={statsModalLottery}
        results={results}
        onSpeak={(text) => {
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'th-TH';
            u.rate = 0.95;
            window.speechSynthesis.speak(u);
          }
        }}
        onOpenImageModal={(l) => handleOpenImageModal(l)}
      />

      {/* Comprehensive Quick Lottery Menu */}
      <QuickLotteryMenu
        isOpen={isQuickMenuOpen}
        onClose={() => setIsQuickMenuOpen(false)}
        lotteries={activeLotteryList}
        onSelectLottery={(l) => {
          setDetailLottery(l);
          onSelectLottery(l);
        }}
        onOpenStats={(l) => handleOpenStatsModal(l)}
        selectedLotteryId={detailLottery?.id}
      />

      {/* Schedule & Lottery Editor Modal */}
      <EditLotteryModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingLottery(null);
        }}
        lottery={editingLottery}
        onSave={handleSaveLottery}
        onDelete={handleDeleteLottery}
      />

      {/* Lottery Detail Modal */}
      {detailLottery && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 animate-fadeIn modal-overlay p-3 sm:p-4"
          role="presentation"
          onClick={() => setDetailLottery(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`รายละเอียด${detailLottery.name}`}
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl border border-amber-500/40 bg-slate-950 p-4 sm:p-5 shadow-2xl space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-amber-400 font-semibold">รายละเอียดรายการหวย</div>
                <h3 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                  <span>{detailLottery.flag}</span>
                  <span>{detailLottery.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">{detailLottery.categoryLabel} • {detailLottery.drawDays}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailLottery(null)}
                aria-label="ปิดรายละเอียด"
                className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-[10px] text-slate-400">เวลาออกตามกำหนด</div>
                <div className="mt-1 text-lg font-bold text-amber-300">{detailLottery.drawTimeStr}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-[10px] text-slate-400">เวลาปิดรับตามกำหนด</div>
                <div className="mt-1 text-lg font-bold text-slate-200">{detailLottery.closeTimeStr}</div>
              </div>
            </div>

            {selectedResult ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-emerald-300">ผลที่พบในฐานข้อมูล</span>
                  <span className="text-[10px] text-slate-400">{selectedResult.งวดวันที่ || selectedResult.วันที่จัดรูปแบบ || ''}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-950/80 p-3">
                    <div className="text-[10px] text-amber-400">รางวัลที่ 1 / 3 ตัวบน</div>
                    <div className="mt-1 break-all font-mono text-xl font-black text-amber-300">
                      {selectedResult.รางวัลที่_1 || selectedResult.firstPrize || selectedResult.เลขบน_3_ตัว || selectedResult.top3 || '—'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-3">
                    <div className="text-[10px] text-emerald-400">เลขท้าย 2 ตัว / 2 ตัวล่าง</div>
                    <div className="mt-1 break-all font-mono text-xl font-black text-emerald-300">
                      {selectedResult.เลขท้าย_2_ตัว || selectedResult.เลขล่าง_2_ตัว || selectedResult.bottom2 || selectedResult.last2 || '—'}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500">แหล่งข้อมูล: {selectedResult.แหล่งข้อมูล || selectedResult.source || 'ไม่ระบุ'}</div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
                <div className="text-sm font-semibold text-amber-200">ยังไม่พบผลรางวัลจริงของรายการนี้</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  ข้อมูลด้านบนเป็นกำหนดการเท่านั้น ระบบจะไม่แสดงเลขตัวอย่างแทนผลจริง
                </p>
              </div>
            )}

            {/* Modal Quick Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleOpenStatsModal(detailLottery)}
                className="flex-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 px-3 py-2 text-xs font-bold hover:bg-amber-500/30 transition flex items-center justify-center gap-1.5"
              >
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span>สถิติ 10 งวด</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenImageModal(detailLottery)}
                className="flex-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>สร้างรูปสรุป</span>
              </button>

              <button
                type="button"
                onClick={() => copySingleLottery(detailLottery)}
                className="rounded-xl bg-slate-800 border border-slate-700 text-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-700 transition flex items-center justify-center gap-1"
                title="คัดลอกข้อความผลหวย"
              >
                <Copy className="w-4 h-4 text-amber-400" />
                <span>คัดลอก</span>
              </button>

              <button
                type="button"
                onClick={() => handleCustomSpeakLottery(detailLottery)}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Volume2 className="w-4 h-4" />
                <span>อ่านผล</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
