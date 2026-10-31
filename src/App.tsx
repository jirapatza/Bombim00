import React, { useState, useEffect, useRef } from 'react';
import lotteryCatalogData from '../data/all_lotteries.json';
import bundledLotteryCatalog from '../data/all_lotteries.json';
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
  Smartphone,
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

import { BroadcastKiosk } from './components/BroadcastKiosk';
import { MultiChannelDispatcher } from './components/MultiChannelDispatcher';
import { LotteryAnalytics } from './components/LotteryAnalytics';
import { LotteryTrendAnalytics } from './components/LotteryTrendAnalytics';
import { BatchTicketChecker } from './components/BatchTicketChecker';
import { DeploymentPlaybook } from './components/DeploymentPlaybook';
import { DailySummaryTable, LotteryItem } from './components/DailySummaryTable';
// Offline schedule fallback for the installed Android APK.
// The source JSON also contains sample-looking prize fields; never expose those as live results.
const offlineLotteryCatalog: LotteryItem[] = (lotteryCatalogData as LotteryItem[]).map((item) => ({
  ...item,
  top3: '',
  bottom2: '',
  firstPrize: '',
  status: 'waiting',
  date: '',
  source: 'ตารางกำหนดการในแอป (ออฟไลน์)',
}));


import { LotteryCatalogInspector } from './components/LotteryCatalogInspector';
import { GitHubAppRunner } from './components/GitHubAppRunner';
import { ProjectCodeEditor } from './components/ProjectCodeEditor';
import { MobileNotificationHub } from './components/MobileNotificationHub';
import { LiveUpcomingDraws } from './components/LiveUpcomingDraws';
import { SettingsCenter } from './components/SettingsCenter';
import { NotificationPipelineInspector } from './components/NotificationPipelineInspector';
import { AppDownloadModal } from './components/AppDownloadModal';
import { DataAccuracyCenter } from './components/DataAccuracyCenter';
import { GoogleWorkspaceHub } from './components/GoogleWorkspaceHub';
import { FirebaseSyncCenter } from './components/FirebaseSyncCenter';
import { SystemMonitorKiosk } from './components/SystemMonitorKiosk';

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

interface ProjectFile {
  name: string;
  path: string;
  category: string;
  content: string;
}

export interface ReconnectLog {
  id: string;
  timeStr: string;
  attempt: number;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  message: string;
  delayMs?: number;
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
  name: string;
  closeTimeStr: string;
  closeHour: number;
  closeMinute: number;
  drawDaysLabel: string;
}

const LOTTERY_SCHEDULE: LotteryScheduleItem[] = [
  // 【หวยเช้า】
  { name: 'ลาว EXTRA', closeTimeStr: '08:20 น.', closeHour: 8, closeMinute: 20, drawDaysLabel: 'ทุกวัน' },
  { name: 'นิเคอิเช้า VIP', closeTimeStr: '08:55 น.', closeHour: 8, closeMinute: 55, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ฮานอยอาเซียน', closeTimeStr: '09:05 น.', closeHour: 9, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'นิเคอิรอบเช้า', closeTimeStr: '09:20 น.', closeHour: 9, closeMinute: 20, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'จีนเช้า VIP', closeTimeStr: '09:55 น.', closeHour: 9, closeMinute: 55, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'จีนรอบเช้า', closeTimeStr: '10:15 น.', closeHour: 10, closeMinute: 15, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ลาว TV', closeTimeStr: '10:20 น.', closeHour: 10, closeMinute: 20, drawDaysLabel: 'ทุกวัน' },
  { name: 'ฮั่งเส็งเช้า VIP', closeTimeStr: '10:25 น.', closeHour: 10, closeMinute: 25, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'หวย ธ.ก.ส.', closeTimeStr: '10:30 น.', closeHour: 10, closeMinute: 30, drawDaysLabel: 'ทุกวันที่ 16' },
  { name: 'ฮั่งเส็งรอบเช้า', closeTimeStr: '10:50 น.', closeHour: 10, closeMinute: 50, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ฮานอย HD', closeTimeStr: '11:05 น.', closeHour: 11, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'ไต้หวัน VIP', closeTimeStr: '11:25 น.', closeHour: 11, closeMinute: 25, drawDaysLabel: 'จันทร์ - ศุกร์' },

  // 【หวยบ่าย】
  { name: 'ฮานอย STAR', closeTimeStr: '12:05 น.', closeHour: 12, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'ไต้หวัน', closeTimeStr: '12:05 น.', closeHour: 12, closeMinute: 5, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'เกาหลี VIP', closeTimeStr: '12:25 น.', closeHour: 12, closeMinute: 25, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'เกาหลี', closeTimeStr: '12:40 น.', closeHour: 12, closeMinute: 40, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'นิเคอิรอบบ่าย', closeTimeStr: '12:50 น.', closeHour: 12, closeMinute: 50, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'นิเคอิบ่าย VIP', closeTimeStr: '13:15 น.', closeHour: 13, closeMinute: 15, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'หวยออมสิน', closeTimeStr: '13:30 น.', closeHour: 13, closeMinute: 30, drawDaysLabel: 'วันที่ 1 และ 16' },
  { name: 'ลาว HD', closeTimeStr: '13:35 น.', closeHour: 13, closeMinute: 35, drawDaysLabel: 'ทุกวัน' },
  { name: 'จีนรอบบ่าย', closeTimeStr: '13:40 น.', closeHour: 13, closeMinute: 40, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ฮานอย TV', closeTimeStr: '14:05 น.', closeHour: 14, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'จีนบ่าย VIP', closeTimeStr: '14:15 น.', closeHour: 14, closeMinute: 15, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'สลากกินแบ่งรัฐบาล (ไทย)', closeTimeStr: '14:30 น.', closeHour: 14, closeMinute: 30, drawDaysLabel: 'วันที่ 1 และ 16' },
  { name: 'ฮั่งเส็งรอบบ่าย', closeTimeStr: '14:50 น.', closeHour: 14, closeMinute: 50, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ฮั่งเส็งบ่าย VIP', closeTimeStr: '15:15 น.', closeHour: 15, closeMinute: 15, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ลาว STAR', closeTimeStr: '15:35 น.', closeHour: 15, closeMinute: 35, drawDaysLabel: 'ทุกวัน' },
  { name: 'สิงคโปร์', closeTimeStr: '15:50 น.', closeHour: 15, closeMinute: 50, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ไทยเย็น', closeTimeStr: '16:00 น.', closeHour: 16, closeMinute: 0, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ฮานอยกาชาด', closeTimeStr: '16:05 น.', closeHour: 16, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'อินเดีย', closeTimeStr: '16:45 น.', closeHour: 16, closeMinute: 45, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'สิงคโปร์ VIP', closeTimeStr: '16:55 น.', closeHour: 16, closeMinute: 55, drawDaysLabel: 'จันทร์ - ศุกร์' },

  // 【หวยเย็น】
  { name: 'ฮานอยสามัคคี', closeTimeStr: '17:05 น.', closeHour: 17, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'ฮานอยพิเศษ', closeTimeStr: '17:05 น.', closeHour: 17, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'ฮานอยปกติ', closeTimeStr: '18:05 น.', closeHour: 18, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'ฮานอย VIP', closeTimeStr: '19:05 น.', closeHour: 19, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'ฮานอยพัฒนา', closeTimeStr: '19:05 น.', closeHour: 19, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'ลาวพัฒนา', closeTimeStr: '20:15 น.', closeHour: 20, closeMinute: 15, drawDaysLabel: 'จันทร์, พุธ, ศุกร์' },
  { name: 'ลาวสามัคคี', closeTimeStr: '20:15 น.', closeHour: 20, closeMinute: 15, drawDaysLabel: 'ทุกวัน' },
  { name: 'ลาวอาเซียน', closeTimeStr: '20:45 น.', closeHour: 20, closeMinute: 45, drawDaysLabel: 'ทุกวัน' },
  { name: 'ลาว VIP', closeTimeStr: '21:15 น.', closeHour: 21, closeMinute: 15, drawDaysLabel: 'ทุกวัน' },
  { name: 'ลาวสามัคคี VIP', closeTimeStr: '21:15 น.', closeHour: 21, closeMinute: 15, drawDaysLabel: 'ทุกวัน' },

  // 【หวยดึก】
  { name: 'อังกฤษ VIP', closeTimeStr: '21:40 น.', closeHour: 21, closeMinute: 40, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ลาว STAR VIP', closeTimeStr: '21:45 น.', closeHour: 21, closeMinute: 45, drawDaysLabel: 'ทุกวัน' },
  { name: 'ฮานอย EXTRA', closeTimeStr: '22:05 น.', closeHour: 22, closeMinute: 5, drawDaysLabel: 'ทุกวัน' },
  { name: 'อังกฤษ', closeTimeStr: '22:10 น.', closeHour: 22, closeMinute: 10, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'เยอรมัน', closeTimeStr: '22:10 น.', closeHour: 22, closeMinute: 10, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'รัสเซีย', closeTimeStr: '22:25 น.', closeHour: 22, closeMinute: 25, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'เยอรมัน VIP', closeTimeStr: '22:40 น.', closeHour: 22, closeMinute: 40, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ลาวกาชาด', closeTimeStr: '23:20 น.', closeHour: 23, closeMinute: 20, drawDaysLabel: 'ทุกวัน' },
  { name: 'รัสเซีย VIP', closeTimeStr: '23:40 น.', closeHour: 23, closeMinute: 40, drawDaysLabel: 'จันทร์ - ศุกร์' },
  { name: 'ดาวโจนส์ VIP', closeTimeStr: '00:05 น.', closeHour: 24, closeMinute: 5, drawDaysLabel: 'อังคาร - เสาร์' },
  { name: 'ดาวโจนส์ STAR', closeTimeStr: '00:55 น.', closeHour: 24, closeMinute: 55, drawDaysLabel: 'อังคาร - เสาร์' },
  { name: 'ดาวโจนส์', closeTimeStr: '01:00 น.', closeHour: 25, closeMinute: 0, drawDaysLabel: 'อังคาร - เสาร์' },
];

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

function isLotteryScheduledOnDate(item: LotteryScheduleItem, weekday: string, dayOfMonth: number): boolean {
  const rule = item.drawDaysLabel || '';
  if (rule.includes('ทุกวัน')) return true;
  if (rule.includes('ทุกวันที่ 16')) return dayOfMonth === 16;
  if (rule.includes('วันที่ 1 และ 16')) return dayOfMonth === 1 || dayOfMonth === 16;
  const weekdayThai: Record<string, string> = {
    Sunday: 'อาทิตย์', Monday: 'จันทร์', Tuesday: 'อังคาร', Wednesday: 'พุธ',
    Thursday: 'พฤหัส', Friday: 'ศุกร์', Saturday: 'เสาร์',
  };
  const todayThai = weekdayThai[weekday];
  const orderedDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  const namedDays = orderedDays.filter((name) => rule.includes(name));
  if (!todayThai || namedDays.length === 0) return false;
  if (rule.includes('-') && namedDays.length >= 2) {
    const start = orderedDays.indexOf(namedDays[0]);
    const end = orderedDays.indexOf(namedDays[namedDays.length - 1]);
    const today = orderedDays.indexOf(todayThai);
    return start <= end ? today >= start && today <= end : today >= start || today <= end;
  }
  return namedDays.includes(todayThai);
}

function selectThaiVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const thaiVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('th'));
  return thaiVoices.find((voice) => /male|man|ชาย/i.test(voice.name)) || thaiVoices[0];
}

function getLotteryResultFingerprint(row: any): string {
  return JSON.stringify([
    String(row?.หวย || row?.ชื่อหวย || row?.lotteryName || '').trim().toLocaleLowerCase(),
    String(row?.งวดวันที่ || row?.วันที่จัดรูปแบบ || row?.drawDate || '').trim(),
    String(row?.รางวัลที่_1 || row?.เลขบน_3_ตัว || row?.top3 || row?.firstPrize || '').trim(),
    String(row?.เลขท้าย_2_ตัว || row?.เลขล่าง_2_ตัว || row?.bottom2 || row?.last2 || '').trim(),
  ]);
}

function getNextClosingLottery(currentTime = new Date()): { name: string; closeTimeStr: string; remainingText: string } {
  let currentHour = currentTime.getHours();
  // If midnight to 03:00, count as 24..27
  if (currentHour < 4) {
    currentHour += 24;
  }
  const currentMinutes = currentHour * 60 + currentTime.getMinutes();

  for (const item of LOTTERY_SCHEDULE) {
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
    name: LOTTERY_SCHEDULE[0].name,
    closeTimeStr: LOTTERY_SCHEDULE[0].closeTimeStr + ' (รอบเช้า)',
    remainingText: 'รอบเช้าถัดไป',
  };
}

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  } catch (e) {
    // Ignore audio context errors if browser blocked
  }
}

function spellDigits(numStr: string): string {
  if (!numStr) return '';
  return numStr.split('').join(' ');
}

// Message template presets
const TEMPLATE_PRESETS = {
  standard: {
    name: 'มาตรฐานทางการ (Standard)',
    title: '📢 ผล{lottery_name} งวด {draw_date}',
    body: '🎯 รางวัลที่ 1: {first_prize}\n🔢 เลขท้าย 2 ตัว: {last_2}\n✨ เลขหน้า 3 ตัว: {front_3}\n🌟 เลขท้าย 3 ตัว: {last_3}\n⏰ ปิดรอบถัดไป: {next_closing}\n📡 แหล่งข้อมูล: {source}',
    speech_script: 'ประกาศผล {lottery_name} ประจำงวดวันที่ {draw_date}. รางวัลที่หนึ่ง ออกเลข {first_prize_spelled}. เลขท้ายสองตัว ออกเลข {last_2_spelled}. และหวยรอบถัดไปที่จะปิดรับคือ {next_closing_name} ปิดรับเวลา {next_closing_time} {polite_ending}.',
    polite_particle: 'ครับ',
    font_family: 'sans',
    font_size: 'large',
    modal_theme: 'gold',
  },
  compact: {
    name: 'กระชับ ฉับไว (Compact)',
    title: '⚡ ผลด่วน {lottery_name} ({draw_date})',
    body: '🏆 รางวัลที่ 1: {first_prize} | 2 ตัว: {last_2}\n3 ตัวหน้า: {front_3} | 3 ตัวท้าย: {last_3}\n⏰ รอบถัดไป: {next_closing}',
    speech_script: 'ผลด่วน {lottery_name} งวดนี้ รางวัลที่หนึ่ง {first_prize_spelled}. เลขสองตัว {last_2_spelled}. หวยถัดไปปิดรับคือ {next_closing_name} เวลา {next_closing_time} {polite_ending}.',
    polite_particle: 'ครับ',
    font_family: 'mono',
    font_size: 'medium',
    modal_theme: 'emerald',
  },
  lucky: {
    name: 'สายมู มหามงคล (Lucky / Fortune)',
    title: '🧧 มหาเฮง! ผล{lottery_name} งวด {draw_date}',
    body: '💰 เลขรวย รางวัลที่ 1: {first_prize}\n💎 เลขรับทรัพย์ 2 ตัว: {last_2}\n✨ เลขหน้า 3 ตัว: {front_3}\n🌟 เลขท้าย 3 ตัว: {last_3}\n💵 ปิดรอบถัดไป: {next_closing}\nขอให้ทุกท่านเฮงๆ รวยๆ รับโชคใหญ่ครับ!',
    speech_script: 'ขอแสดงความยินดีกับผู้มีโชคทุกท่าน ประกาศผล {lottery_name} งวดวันที่ {draw_date}. รางวัลที่หนึ่ง ออกเลขมหาเฮง {first_prize_spelled}. เลขท้ายสองตัว ออกเลข {last_2_spelled}. และรอบถัดไปคือ {next_closing_name} ปิดรับเวลา {next_closing_time} ขอให้เฮงๆ รวยๆ {polite_ending}.',
    polite_particle: 'ครับ',
    font_family: 'sans',
    font_size: 'xlarge',
    modal_theme: 'ruby',
  },
  minimal: {
    name: 'มินิมอล เน้นตัวเลข (Minimalist)',
    title: '{lottery_name} • {draw_date}',
    body: '[1st] {first_prize}\n[2D] {last_2}\n[3F] {front_3}\n[3R] {last_3}\nNext: {next_closing}',
    speech_script: '{lottery_name} งวดวันที่ {draw_date} รางวัลที่หนึ่ง {first_prize_spelled} สองตัว {last_2_spelled} รอบต่อไป {next_closing_name} ปิดรับ {next_closing_time}.',
    polite_particle: '',
    font_family: 'mono',
    font_size: 'large',
    modal_theme: 'cyber',
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<
    | 'live'
    | 'summary'
    | 'checker'
    | 'accuracy'
    | 'analytics'
    | 'settings'
    | 'catalog'
    | 'github'
    | 'mobile'
    | 'overview'
    | 'broadcast'
    | 'channels'
    | 'batch'
    | 'template'
    | 'schedule'
    | 'results'
    | 'tester'
    | 'worker'
    | 'deployment'
    | 'files'
    | 'pipeline'
    | 'workspace'
    | 'firestore'
    | 'monitor'
  >('live');
  const [checkerSubTab, setCheckerSubTab] = useState<'accuracy' | 'batch' | 'history'>('accuracy');
  const [historyPrizeFilter, setHistoryPrizeFilter] = useState<'all' | 'first' | 'last2' | '3digits' | 'thai'>('all');
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [results, setResults] = useState<LotteryResult[]>([]);
  const [allLotteries, setAllLotteries] = useState<LotteryItem[]>(offlineLotteryCatalog);
  const [selectedCatalogLottery, setSelectedCatalogLottery] = useState<LotteryItem | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('lottery_checker.py');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);

  // Settings raw editor state
  const [rawSettingsMode, setRawSettingsMode] = useState<boolean>(false);
  const [rawSettingsJson, setRawSettingsJson] = useState<string>('');

  // Ticket Checker state
  const [ticketInput, setTicketInput] = useState<string>('');
  const [ticketResult, setTicketResult] = useState<{ checked: boolean; wins: string[]; message: string } | null>(null);

  // Tester state
  const [testTopic, setTestTopic] = useState<string>('my-lottery-alert-test');
  const [testPriority, setTestPriority] = useState<string>('high');
  const [testCustomMessage, setTestCustomMessage] = useState<string>('ข้อความทดสอบแจ้งเตือนหวย VIP และหุ้นต่างประเทศ (ไม่ใช่ผลหวยจริง)');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);

  // Cloudflare Worker settings & Reconnection Helper state
  const [workerUrl, setWorkerUrl] = useState<string>(() => {
    const saved = localStorage.getItem('cf_worker_url');
    if (!saved || saved === 'https://bombim00-github-api.jirapatcip2557.workers.dev') {
      return '';
    }
    return saved;
  });
  const [dashPassword, setDashPassword] = useState<string>(localStorage.getItem('cf_dash_password') || '');
  const [isWorkerConnected, setIsWorkerConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const [maxReconnectRetries, setMaxReconnectRetries] = useState<number>(5);
  const [initialRetryDelayMs, setInitialRetryDelayMs] = useState<number>(1000);
  const [backoffMultiplier, setBackoffMultiplier] = useState<number>(2.0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [autoRetryOnFail, setAutoRetryOnFail] = useState<boolean>(true);
  const [reconnectLogs, setReconnectLogs] = useState<ReconnectLog[]>([]);
  const [workerDetails, setWorkerDetails] = useState<any>(null);

  const reconnectTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Watched number input
  const [newWatchedNumber, setNewWatchedNumber] = useState<string>('');

  // ==================== REAL-TIME MODAL & SEQUENTIAL VOICE QUEUE STATE ====================
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [announcementQueue, setAnnouncementQueue] = useState<LotteryAnnouncement[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(0.95);
  const [isTransitioningQueue, setIsTransitioningQueue] = useState<boolean>(false);

  // ==================== MESSAGE & TYPOGRAPHY CUSTOMIZATION STATE ====================
  const [templateTitle, setTemplateTitle] = useState<string>('📢 ผล{lottery_name} งวด {draw_date}');
  const [templateBody, setTemplateBody] = useState<string>('🎯 รางวัลที่ 1: {first_prize}\n🔢 เลขท้าย 2 ตัว: {last_2}\n✨ เลขหน้า 3 ตัว: {front_3}\n🌟 เลขท้าย 3 ตัว: {last_3}\n⏰ ปิดรอบถัดไป: {next_closing}\n📡 แหล่งข้อมูล: {source}');
  const [speechScript, setSpeechScript] = useState<string>('ประกาศผล {lottery_name} ประจำงวดวันที่ {draw_date}. รางวัลที่หนึ่ง ออกเลข {first_prize_spelled}. เลขท้ายสองตัว ออกเลข {last_2_spelled}. และหวยรอบถัดไปที่จะปิดรับคือ {next_closing_name} ปิดรับเวลา {next_closing_time} {polite_ending}.');
  const [politeParticle, setPoliteParticle] = useState<string>('ครับ');
  const [modalTheme, setModalTheme] = useState<string>('gold');
  const [fontSize, setFontSize] = useState<string>('large');
  const [fontFamily, setFontFamily] = useState<string>('sans');

  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const queueTimeoutRef = useRef<any>(null);
  const announcementQueueRef = useRef<LotteryAnnouncement[]>([]);
  const knownResultsRef = useRef<Set<string> | null>(null);
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

  // ==================== CLOUDFLARE WORKER RECONNECTION HELPER (EXPONENTIAL BACKOFF) ====================
  const clearReconnectionTimers = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const cancelReconnection = () => {
    clearReconnectionTimers();
    setIsReconnecting(false);
    setCountdownSeconds(0);
    setReconnectLogs((prev) => [
      {
        id: 'log-' + Date.now(),
        timeStr: new Date().toLocaleTimeString('th-TH'),
        attempt: reconnectAttempt,
        status: 'cancelled' as const,
        message: 'ผู้ใช้กดยกเลิกการพยายามเชื่อมต่อใหม่',
      },
      ...prev,
    ].slice(0, 30));
    showToast('ยกเลิกการเชื่อมต่อใหม่แล้ว');
  };

  const handleConnectWithBackoff = async (retryIndex = 0, customTargetUrl?: string) => {
    clearReconnectionTimers();
    const targetUrl = customTargetUrl !== undefined ? customTargetUrl : workerUrl;

    if (!targetUrl.trim()) {
      showToast('กรุณากรอก Cloudflare Worker URL');
      return;
    }

    const currentAttempt = retryIndex + 1;
    setIsReconnecting(true);
    setReconnectAttempt(currentAttempt);

    const nowTime = new Date().toLocaleTimeString('th-TH');
    setReconnectLogs((prev) => [
      {
        id: 'log-' + Date.now(),
        timeStr: nowTime,
        attempt: currentAttempt,
        status: 'pending' as const,
        message: `[พยายามครั้งที่ ${currentAttempt}/${maxReconnectRetries}] กำลังส่งคำขอตรวจสอบสถานะไปยัง Worker...`,
      },
      ...prev,
    ].slice(0, 30));

    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 8000);

    try {
      const cleanUrl = targetUrl.replace(/\/$/, '') + '/api/status';
      const res = await fetch(cleanUrl, {
        signal: abortControllerRef.current.signal,
        headers: dashPassword ? { Authorization: `Bearer ${dashPassword}` } : {},
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setIsWorkerConnected(true);
        setIsReconnecting(false);
        setCountdownSeconds(0);
        setWorkerDetails(data);

        setReconnectLogs((prev) => [
          {
            id: 'log-' + Date.now(),
            timeStr: new Date().toLocaleTimeString('th-TH'),
            attempt: currentAttempt,
            status: 'success' as const,
            message: `[สำเร็จ] เชื่อมต่อ Worker สำเร็จ! (HTTP 200 OK • โค้ดตอบรับสมบูรณ์)`,
          },
          ...prev,
        ].slice(0, 30));

        showToast(`เชื่อมต่อ Cloudflare Worker สำเร็จในครั้งที่ ${currentAttempt}!`);
        return;
      } else {
        throw new Error(`HTTP ${res.status}: ${res.statusText || 'Response not OK'}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setIsWorkerConnected(false);

      const isAborted = err.name === 'AbortError';
      const errMsg = isAborted ? 'คำขอหมดเวลา (Connection Timeout 8s)' : (err.message || 'Network request failed');

      if (autoRetryOnFail && currentAttempt < maxReconnectRetries) {
        // Exponential Backoff calculation: delay = initialDelay * (multiplier ^ retryIndex) + jitter
        const exponentialDelay = Math.round(
          initialRetryDelayMs * Math.pow(backoffMultiplier, retryIndex) + Math.random() * 250
        );
        const delaySeconds = Math.max(1, Math.ceil(exponentialDelay / 1000));
        setCountdownSeconds(delaySeconds);

        setReconnectLogs((prev) => [
          {
            id: 'log-' + Date.now(),
            timeStr: new Date().toLocaleTimeString('th-TH'),
            attempt: currentAttempt,
            status: 'failed' as const,
            message: `[ล้มเหลวครั้งที่ ${currentAttempt}] ${errMsg} → กำลังหน่วงเวลา Exponential Backoff (${(exponentialDelay / 1000).toFixed(1)}s) ก่อนลองใหม่...`,
            delayMs: exponentialDelay,
          },
          ...prev,
        ].slice(0, 30));

        let remaining = delaySeconds;
        countdownIntervalRef.current = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setCountdownSeconds(0);
          } else {
            setCountdownSeconds(remaining);
          }
        }, 1000);

        reconnectTimerRef.current = setTimeout(() => {
          handleConnectWithBackoff(retryIndex + 1, targetUrl);
        }, exponentialDelay);
      } else {
        setIsReconnecting(false);
        setCountdownSeconds(0);
        setReconnectLogs((prev) => [
          {
            id: 'log-' + Date.now(),
            timeStr: new Date().toLocaleTimeString('th-TH'),
            attempt: currentAttempt,
            status: 'failed' as const,
            message: `[หยุดการพยายาม] ล้มเหลวครบกำหนด ${maxReconnectRetries} ครั้งแล้ว (${errMsg}) กรุณาตรวจสอบ Worker URL และการตั้งค่า CORS`,
          },
          ...prev,
        ].slice(0, 30));

        showToast(`การเชื่อมต่อล้มเหลวหลังพยายามครบ ${maxReconnectRetries} ครั้ง`);
      }
    }
  };

  const retryNowImmediately = () => {
    clearReconnectionTimers();
    handleConnectWithBackoff(reconnectAttempt, workerUrl);
  };

  const simulateBackoffFailure = () => {
    showToast('กำลังจำลองสถานการณ์เชื่อมต่อล้มเหลวเพื่อทดสอบ Exponential Backoff...');
    handleConnectWithBackoff(0, 'https://invalid-worker-simulated-test-999.workers.dev');
  };

  // Build speech text from customizable template
  const buildSpeechText = (item: LotteryAnnouncement): string => {
    let script = speechScript || 'ประกาศผล {lottery_name} ประจำงวดวันที่ {draw_date}. รางวัลที่หนึ่ง ออกเลข {first_prize_spelled}. เลขท้ายสองตัว ออกเลข {last_2_spelled}. และหวยรอบถัดไปที่จะปิดรับคือ {next_closing_name} ปิดรับเวลา {next_closing_time} {polite_ending}.';

    const replacements: Record<string, string> = {
      '{lottery_name}': item.lotteryName,
      '{draw_date}': item.drawDate,
      '{first_prize}': item.firstPrize || '-',
      '{first_prize_spelled}': spellDigits(item.firstPrize),
      '{last_2}': item.last2Digits || '-',
      '{last_2_spelled}': spellDigits(item.last2Digits),
      '{next_closing_name}': item.nextClosing?.name || 'รอบถัดไป',
      '{next_closing_time}': item.nextClosing?.closeTimeStr || '',
      '{polite_ending}': politeParticle || '',
    };

    for (const [key, val] of Object.entries(replacements)) {
      script = script.split(key).join(val);
    }

    return script;
  };

  // Speak announcement in Thai and proceed sequentially
  const speakCurrentAnnouncement = (item: LotteryAnnouncement, index: number, total: number) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) {
      setIsSpeaking(false);
      return;
    }

    stopSpeech();

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

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsTransitioningQueue(false);
    };

    // Advance outside React state updater callbacks to prevent duplicate speech in Strict Mode.
    utterance.onend = advanceQueue;
    utterance.onerror = (e) => {
      console.warn('Speech error; skipping to next queued lottery:', e);
      advanceQueue();
    };

    activeUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const speakCustomText = (text: string) => {
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
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      showToast('ระบบเสียงอ่านไม่สำเร็จ ตรวจสอบเสียงภาษาไทยใน Android');
    };
    activeUtteranceRef.current = utterance;
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  };

  const triggerAnnouncements = (items: LotteryAnnouncement[]) => {
    if (!items || items.length === 0) return;

    stopSpeech();
    if (voiceEnabled) playChime();
    announcementQueueRef.current = [...items];
    setAnnouncementQueue(items);
    setCurrentQueueIndex(0);
    setIsModalOpen(true);

    if (voiceEnabled) {
      setTimeout(() => {
        speakCurrentAnnouncement(items[0], 0, items.length);
      }, 400);
    }
  };
  triggerAnnouncementsRef.current = triggerAnnouncements;

  const handleReplay = () => {
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
    if (!('speechSynthesis' in window)) {
      showToast('เบราว์เซอร์ไม่รองรับ Speech Synthesis');
      return;
    }
    stopSpeech();
    playChime();

    const topSpelled = spellDigits(item.top3);
    const bottomSpelled = spellDigits(item.bottom2);

    let text = `ประกาศผล ${item.name} งวดวันที่ ${item.date}. `;
    text += `สามตัวบน ออกเลข ${topSpelled}. `;
    text += `สองตัวล่าง ออกเลข ${bottomSpelled}. `;
    if (item.setIndex) {
      text += `ดัชนีตลาดปิดที่ ${item.setIndex}. `;
    }
    text += `และหวยรอบถัดไปที่จะปิดรับคือ ${nextClosingNow.name} ปิดเวลา ${nextClosingNow.closeTimeStr} ค่ะ.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = speechRate;
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = selectThaiVoice(voices);
    if (thaiVoice) utterance.voice = thaiVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    activeUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    showToast(`กำลังอ่านประกาศผล ${item.name}`);
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
      setRawSettingsJson(JSON.stringify(updated, null, 2));
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
      const res = await fetch(`${workerUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(updatedSettings);
        setRawSettingsJson(JSON.stringify(updatedSettings, null, 2));
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
      setSettings(newSettings);
      try {
        await fetch(`${workerUrl}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings),
        });
        showToast(`เพิ่มเลข ${num} ลงในรายการเฝ้าระวังแล้ว`);
      } catch {}
    } else {
      showToast(`เลข ${num} อยู่ในรายการเฝ้าระวังแล้ว`);
    }
  };

  const handleSaveMultiChannelSettings = async (newSettings: any) => {
    setSettings(newSettings);
    try {
      const res = await fetch(`${workerUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      const data = await res.json();
      if (data.success) {
        showToast('บันทึกการตั้งค่าช่องทางแจ้งเตือนสำเร็จ!');
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกได้');
    }
  };

  const handleSaveRawSettings = async () => {
    try {
      const parsed = JSON.parse(rawSettingsJson);
      setSettings(parsed);
      const res = await fetch(`${workerUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (data.success) {
        showToast('💾 บันทึกการตั้งค่า JSON สำเร็จแล้ว!');
      } else {
        showToast(`เกิดข้อผิดพลาด: ${data.error || 'บันทึกไม่สำเร็จ'}`);
      }
    } catch (e: any) {
      showToast(`รูปแบบ JSON ไม่ถูกต้อง: ${e.message}`);
    }
  };

  // Update all lotteries (for schedule and result edits in modal)
  const handleUpdateAllLotteries = async (updated: LotteryItem[]) => {
    setAllLotteries(updated);
    try {
      const res = await fetch(`${workerUrl}/api/all-lotteries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (data.success) {
        showToast('💾 บันทึกและอัปเดตตารางหวยเรียบร้อยแล้ว');
      } else {
        showToast('บันทึกลงเซิร์ฟเวอร์ไม่สำเร็จ');
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกตารางหวยได้');
    }
  };

  // Fetch initial data
  const fetchData = async (): Promise<{ results: LotteryResult[]; newResults: LotteryResult[] }> => {
    setIsLoading(true);
    let safeResults: LotteryResult[] = [];
    let newResults: LotteryResult[] = [];
    try {
      const apiBase = workerUrl ? workerUrl.replace(/\/+$/, '') : '';
      const [resStatus, resSettings, resResults, resFiles, resAllLotteries] = await Promise.all([
        fetch(`${apiBase}/api/status`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`${apiBase}/api/settings`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`${apiBase}/api/results`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`${apiBase}/api/project-files`).then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch(`${apiBase}/api/all-lotteries`).then((r) => r.ok ? r.json() : []).catch(() => []),
      ]);

      if (resStatus) setStatus(resStatus);
      if (resSettings) {
        setSettings(resSettings);
        setRawSettingsJson(JSON.stringify(resSettings, null, 2));
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
        const previousKeys = knownResultsRef.current;
        if (previousKeys) {
          newResults = safeResults.filter((row: any) => {
            const key = getLotteryResultFingerprint(row);
            const hasTop = Boolean(String(row?.รางวัลที่_1 || row?.เลขบน_3_ตัว || row?.top3 || row?.firstPrize || '').trim());
            const hasBottom = Boolean(String(row?.เลขท้าย_2_ตัว || row?.เลขล่าง_2_ตัว || row?.bottom2 || row?.last2 || '').trim());
            return hasTop && hasBottom && !previousKeys.has(key);
          });
        }
        knownResultsRef.current = new Set(safeResults.map((row: any) => getLotteryResultFingerprint(row)));
        setResults(safeResults);
      }
      if (Array.isArray(resFiles)) setProjectFiles(resFiles);
      const apiLotteryCatalog = Array.isArray(resAllLotteries) ? resAllLotteries : [];
      const bundledCatalog = (bundledLotteryCatalog as LotteryItem[]).map((item) => ({
        ...item,
        // The bundled file is a schedule/catalog fallback only. Never present
        // its former sample numbers as verified lottery results.
        top3: '',
        bottom2: '',
        firstPrize: '',
        status: 'waiting' as const,
        date: 'ไม่ระบุ',
        source: 'ตารางกำหนดเวลา — รอผลจริงจากแหล่งข้อมูล',
      }));
      const availableCatalog = apiLotteryCatalog.length > 0 ? apiLotteryCatalog : bundledCatalog;
      setAllLotteries(availableCatalog);
      if (!selectedCatalogLottery && availableCatalog.length > 0) {
        setSelectedCatalogLottery(availableCatalog[0]);
      }

      if (newResults.length > 0) {
        const nextClosing = getNextClosingLottery();
        triggerAnnouncementsRef.current(newResults.map((row: any, index) => ({
          id: `live-${getLotteryResultFingerprint(row)}-${index}`,
          lotteryName: row.ชื่อหวย || row.หวย || row.lotteryName || 'หวย',
          drawDate: row.งวดวันที่ || row.วันที่จัดรูปแบบ || row.drawDate || 'งวดล่าสุด',
          firstPrize: row.รางวัลที่_1 || row.เลขบน_3_ตัว || row.top3 || row.firstPrize || '-',
          last2Digits: row.เลขท้าย_2_ตัว || row.เลขล่าง_2_ตัว || row.bottom2 || row.last2 || '-',
          front3Digits: Array.isArray(row.เลขหน้า_3_ตัว) ? row.เลขหน้า_3_ตัว : [],
          last3Digits: Array.isArray(row.เลขท้าย_3_ตัว) ? row.เลขท้าย_3_ตัว : [],
          source: row.แหล่งข้อมูล || row.source || 'แหล่งข้อมูลผลหวย',
          nextClosing,
          note: 'ตรวจพบผลใหม่จากแหล่งข้อมูล',
        })));
        showToast(`พบผลหวยใหม่ ${newResults.length} รายการ กำลังอ่านประกาศเสียง`);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
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

  // Announce each scheduled lottery closing once at its configured closing minute.
  // This runs while the app is open; Android/browser background suspension can delay it.
  useEffect(() => {
    if (!voiceEnabled || typeof window === 'undefined') return;
    const checkClosingAlerts = () => {
      const now = getBangkokClockParts();
      const due = LOTTERY_SCHEDULE.filter((item) =>
        item.closeHour % 24 === now.hour &&
        item.closeMinute === now.minute &&
        isLotteryScheduledOnDate(item, now.weekday, now.day)
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
      let res: Response | null = null;
      let data: any = null;

      if (workerUrl && dashPassword) {
        try {
          const apiBase = workerUrl.replace(/\/+$/, '');
          const remoteRes = await fetch(`${apiBase}/api/trigger`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${dashPassword}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ lotteryTarget: 'all' }),
          });
          const remoteData = await remoteRes.json().catch(() => ({}));
          if (remoteRes.ok && remoteData.success) {
            res = remoteRes;
            data = remoteData;
          }
        } catch {
          res = null;
        }
      }

      if (!res || !res.ok) {
        const localRes = await fetch('/api/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lotteryTarget: 'all' }),
        });
        const localData = await localRes.json().catch(() => ({}));
        res = localRes;
        data = localData;
      }

      if (res && res.ok && data?.success) {
        if (data.status) setStatus(data.status);
        const refreshed = await fetchData();
        if (refreshed.newResults.length === 0) {
          showToast('ตรวจสอบแหล่งข้อมูลแล้ว แต่ยังไม่พบผลใหม่ จึงไม่อ่านผลเก่าซ้ำ');
        } else {
          showToast(`ตรวจพบผลใหม่ ${refreshed.newResults.length} รายการ`);
        }
      } else {
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
    const isGovernment = selected.category === 'gov_savings';
    triggerAnnouncements([{
      id: `demo-${selected.id}-${Date.now()}`,
      lotteryName: selected.name,
      drawDate: selected.date || 'ตัวอย่างสำหรับทดสอบ',
      firstPrize: (isGovernment ? selected.firstPrize : selected.top3) || selected.firstPrize || '-',
      last2Digits: selected.bottom2 || '-',
      front3Digits: [],
      last3Digits: [],
      source: 'ตัวอย่างจากแคตตาล็อก (ไม่ใช่การยืนยันผลสด)',
      nextClosing,
      note: 'ทดสอบเสียงเท่านั้น ไม่ใช่ผลหวยจริง',
    }]);
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
      firstPrize: item.top3 || item.firstPrize || '-',
      last2Digits: item.bottom2 || '-',
      front3Digits: [],
      last3Digits: [],
      source: 'ตัวอย่างจากแคตตาล็อก (ไม่ใช่การยืนยันผลสด)',
      nextClosing,
      note: `ทดสอบเสียงรายการที่ ${index + 1} ไม่ใช่ผลหวยจริง`,
    })));
  };

  // Preview uses the currently selected catalog lottery, not a hard-coded Thai government example.
  const getRenderedPreview = () => {
    const previewLottery = selectedCatalogLottery || allLotteries.find((item) => item.category !== 'gov_savings') || allLotteries[0];
    const sample = {
      '{lottery_name}': previewLottery?.name || 'ตัวอย่างหวย',
      '{draw_date}': previewLottery?.date || 'ตัวอย่างสำหรับทดสอบ',
      '{first_prize}': previewLottery?.top3 || previewLottery?.firstPrize || '-',
      '{last_2}': previewLottery?.bottom2 || '-',
      '{front_3}': '-',
      '{last_3}': '-',
      '{source}': 'ตัวอย่างจากแคตตาล็อก (ไม่ใช่ผลสด)',
      '{next_closing}': nextClosingNow ? `${nextClosingNow.name} (${nextClosingNow.closeTimeStr})` : 'รอบถัดไป',
    };

    let title = templateTitle;
    let body = templateBody;
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
    const wins: string[] = [];

    if (cleanNum === latest.รางวัลที่_1) {
      wins.push('🏆 ถูกรางวัลที่ 1! (รางวัล 6,000,000 บาท)');
    }
    if (cleanNum.endsWith(latest.เลขท้าย_2_ตัว) || cleanNum === latest.เลขท้าย_2_ตัว) {
      wins.push(`🎯 ถูกรางวัลเลขท้าย 2 ตัว: ${latest.เลขท้าย_2_ตัว} (รางวัล 2,000 บาท)`);
    }
    latest.เลขหน้า_3_ตัว?.forEach((f: string) => {
      if (cleanNum.startsWith(f) || cleanNum === f) {
        wins.push(`✨ ถูกรางวัลเลขหน้า 3 ตัว: ${f} (รางวัล 4,000 บาท)`);
      }
    });
    latest.เลขท้าย_3_ตัว?.forEach((r: string) => {
      if (cleanNum.endsWith(r) || cleanNum === r) {
        wins.push(`🌟 ถูกรางวัลเลขท้าย 3 ตัว: ${r} (รางวัล 4,000 บาท)`);
      }
    });
    latest.รางวัลข้างเคียงรางวัลที่_1?.forEach((adj: string) => {
      if (cleanNum === adj) {
        wins.push(`💎 ถูกรางวัลข้างเคียงรางวัลที่ 1: ${adj} (รางวัล 100,000 บาท)`);
      }
    });

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
      const res = await fetch(`${workerUrl}/api/test-ntfy`, {
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
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 ${fontFamily === 'mono' ? 'font-mono' : 'font-sans'}`}>
      {/* Toast Notification */}
      {notificationToast && (
        <div className="fixed top-5 right-5 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-sm font-medium">{notificationToast}</span>
        </div>
      )}

      {/* ==================== CUSTOMIZABLE MODAL POP-UP ==================== */}
      {isModalOpen && currentAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
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
                    else handleReplay();
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
                    : 'เสียงอ่านพร้อมใช้งาน'}
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
                  รางวัลที่ 1
                </span>
                <div className={`font-black tracking-widest font-mono ${themeClasses.firstPrizeText} ${sizeClasses.first}`}>
                  {currentAnnouncement.firstPrize || '------'}
                </div>
                <span className="text-[11px] text-slate-400 mt-2 font-mono">
                  {spellDigits(currentAnnouncement.firstPrize)}
                </span>
              </div>

              <div className="bg-slate-950/90 rounded-2xl p-5 border-2 border-emerald-500/50 flex flex-col items-center justify-center text-center shadow-inner">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  เลขท้าย 2 ตัว
                </span>
                <div className={`font-black tracking-widest font-mono text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)] ${sizeClasses.last2}`}>
                  {currentAnnouncement.last2Digits || '--'}
                </div>
                <span className="text-[11px] text-slate-400 mt-2 font-mono">
                  {spellDigits(currentAnnouncement.last2Digits)}
                </span>
              </div>
            </div>

            {/* Next Closing Banner */}
            <div className="bg-gradient-to-r from-purple-950/70 via-indigo-950/70 to-slate-900 rounded-2xl p-4 border border-purple-500/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                    หวยที่ปิดรับรอบต่อไป
                  </span>
                  <div className="text-sm font-bold text-white">
                    {currentAnnouncement.nextClosing.name}
                  </div>
                  <div className="text-xs text-purple-200">
                    ปิดรับเวลา: <span className="font-bold text-amber-300">{currentAnnouncement.nextClosing.closeTimeStr}</span> ({currentAnnouncement.nextClosing.remainingText})
                  </div>
                </div>
              </div>

              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 shrink-0">
                อ่านในเสียงแล้ว
              </span>
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
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 text-slate-950 font-black">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-lg text-white tracking-tight">
                  ระบบตรวจและแจ้งเตือนผลหวยสด
                </h1>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  ระบบอัตโนมัติ 24 ชม.
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                ศูนย์กลางผลสลาก 51 หวย • เช็คผลสดเรียลไทม์ • ยืนยันข้อมูลด้วย AI &amp; เสียงประกาศไทย
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextState = !voiceEnabled;
                setVoiceEnabled(nextState);
                if (!nextState) stopSpeech();
                showToast(nextState ? 'เปิดเสียงประกาศภาษาไทย 🔊' : 'ปิดเสียงประกาศ 🔇');
              }}
              title={voiceEnabled ? 'เสียงพูดภาษาไทย: เปิดอยู่' : 'เสียงพูดภาษาไทย: ปิดอยู่'}
              className={`px-3 py-2 text-xs font-bold rounded-xl border cursor-pointer transition flex items-center gap-1.5 ${
                voiceEnabled
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-slate-800/90 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden md:inline">{voiceEnabled ? 'เสียงไทย: เปิด' : 'เสียงไทย: ปิด'}</span>
            </button>

            <button
              onClick={handleTriggerCheck}
              disabled={isTriggering}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isTriggering ? 'animate-spin' : ''}`} />
              <span>{isTriggering ? 'กำลังตรวจ...' : 'ตรวจผลทันที'}</span>
            </button>

            <button
              onClick={() => setIsDownloadModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-600/90 hover:bg-purple-600 text-white transition flex items-center gap-1.5 border border-purple-500/40 shadow-sm cursor-pointer active:scale-95"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">📲 โหลดแอป / APK</span>
            </button>

            <button
              onClick={fetchData}
              disabled={isLoading}
              title="รีเฟรชข้อมูล"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* 5 Distinct Consolidated Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex space-x-2 border-t border-slate-800/60 overflow-x-auto py-2 text-xs font-bold no-scrollbar">
            {/* Tab 1: Live & Upcoming */}
            <button
              onClick={() => setActiveTab('live')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'live'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <Radio className={`w-4 h-4 ${activeTab === 'live' ? 'animate-pulse text-slate-950' : 'text-amber-400'}`} />
              <span>🕒 หวยสด &amp; คิวออกผล</span>
            </button>

            {/* Tab 2: Daily 51 Lotteries Summary Table */}
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <TableProperties className="w-4 h-4 text-indigo-400" />
              <span>📊 ตารางสรุป 51 หวย</span>
            </button>

            {/* Tab 3: Unified Ticket Checker & AI Accuracy Center */}
            <button
              onClick={() => {
                setActiveTab('checker');
                setCheckerSubTab('accuracy');
              }}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'checker' || activeTab === 'accuracy' || activeTab === 'batch' || activeTab === 'results'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/25'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <Search className={`w-4 h-4 ${activeTab === 'checker' || activeTab === 'accuracy' ? 'text-slate-950' : 'text-emerald-400'}`} />
              <span>🔍 ตรวจสลาก &amp; ความแม่นยำ AI</span>
            </button>

            {/* Tab 4: Analytics & 10 Draws Trends */}
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <TrendingUp className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-slate-950' : 'text-amber-400'}`} />
              <span>📈 สถิติ &amp; เลขเด่น 10 งวด</span>
            </button>

            {/* Tab 5: Google Workspace (Tasks & Keep) */}
            <button
              onClick={() => setActiveTab('workspace')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'workspace'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${activeTab === 'workspace' ? 'text-white' : 'text-indigo-400'}`} />
              <span>📑 Google Tasks &amp; Keep</span>
            </button>

            {/* Tab 6: Cloud Firestore (Firebase) */}
            <button
              onClick={() => setActiveTab('firestore')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'firestore'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md shadow-amber-500/25'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <Database className={`w-4 h-4 ${activeTab === 'firestore' ? 'text-slate-950' : 'text-amber-400'}`} />
              <span>🔥 Firebase Cloud</span>
            </button>

            {/* Tab 7: System & Devices Health Monitor (NOC & 1-Click Self-Healing) */}
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'monitor'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <Activity className={`w-4 h-4 ${activeTab === 'monitor' ? 'text-slate-950 animate-spin' : 'text-emerald-400'}`} />
              <span>🖥️ มอนิเตอร์ &amp; ซ่อมแซมระบบ</span>
            </button>

            {/* Tab 8: Settings & Automation Center */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                activeTab === 'settings' || activeTab === 'channels' || activeTab === 'template' || activeTab === 'worker' || activeTab === 'github'
                  ? 'bg-slate-800 text-amber-300 border border-amber-500/50 shadow-md'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>⚙️ ตั้งค่า &amp; ระบบอัตโนมัติ</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ==================== TAB 1: LIVE UPCOMING DRAWS (WAITING & ABOUT-TO-DRAW) ==================== */}
        <div className={activeTab === 'live' ? 'block' : 'hidden'}>
          <LiveUpcomingDraws
            lotteries={allLotteries}
            onSelectLottery={(item) => {
              setSelectedCatalogLottery(item);
              setActiveTab('summary');
            }}
            onSpeakLottery={(item) => handleSpeakSpecificLottery(item)}
            onSpeakText={(text) => speakCustomText(text)}
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => {
              const nextState = !voiceEnabled;
              setVoiceEnabled(nextState);
              if (!nextState) stopSpeech();
              showToast(nextState ? 'เปิดเสียงประกาศภาษาไทย 🔊' : 'ปิดเสียงประกาศ 🔇');
            }}
            onNavigateToSummary={() => setActiveTab('summary')}
          />
        </div>

        {/* ==================== TAB 2: DAILY SUMMARY TABLE (FULL 51 LOTTERIES MATRIX) ==================== */}
        {activeTab === 'summary' && (
          <DailySummaryTable
            lotteries={allLotteries}
            onSelectLottery={(item) => {
              setSelectedCatalogLottery(item);
            }}
            onSpeakLottery={(item) => handleSpeakSpecificLottery(item)}
            onUpdateLotteries={handleUpdateAllLotteries}
            nextClosing={getNextClosingLottery()}
          />
        )}

        {/* ==================== TAB: LOTTERY CATALOG & MENU INSPECTOR ==================== */}
        {activeTab === 'catalog' && (
          <LotteryCatalogInspector
            lotteries={allLotteries}
            selectedLottery={selectedCatalogLottery}
            onSelectLottery={(item) => setSelectedCatalogLottery(item)}
            onSpeakLottery={(item) => handleSpeakSpecificLottery(item)}
            onAddWatchedNumber={handleAddWatchedNumber}
            onSwitchToBroadcast={(item) => {
              setSelectedCatalogLottery(item);
              setActiveTab('broadcast');
            }}
          />
        )}

        {/* ==================== TAB: NOTIFICATION PIPELINE & PRIORITY HIERARCHY ==================== */}
        {activeTab === 'pipeline' && (
          <NotificationPipelineInspector
            settings={settings}
            latestDraw={latestGovernmentDraw}
            allLotteries={allLotteries}
            onTriggerCheck={handleTriggerCheck}
            onSpeak={speakCustomText}
          />
        )}

        {/* ==================== TAB: OVERVIEW & STATUS ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Test Bar for Voice Modal */}
            <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    ระบบแจ้งเตือนแบบ Modal + เสียงพูดภาษาไทย
                  </h3>
                  <p className="text-xs text-slate-400">
                    พูดการออกรางวัล + แจ้งหวยรอบต่อไปที่จะปิดรับ และจัดการคิวอ่านต่อเนื่องเมื่อผลออกพร้อมกัน
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={testSingleAnnouncement}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer flex items-center gap-1.5 transition"
                >
                  <Play className="w-3.5 h-3.5 text-amber-400" />
                  ทดสอบเสียง 1 หวย
                </button>

                <button
                  type="button"
                  onClick={testDualSimultaneousAnnouncements}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 transition active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5" />
                  ทดสอบ 2 หวยพร้อมกัน (อ่านต่อเนื่องตามคิว)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('template')}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 cursor-pointer flex items-center gap-1.5 transition"
                >
                  <Palette className="w-3.5 h-3.5" />
                  ปรับแต่งตัวหนังสือ & ธีม
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">สถานะระบบ</span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                  <span className="text-lg font-bold text-slate-100 capitalize">
                    {status?.system_status || 'Healthy'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 truncate">
                  ตรวจล่าสุด: {status?.last_run_date_thai || 'ไม่มีข้อมูล'}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">งวดล่าสุดที่ตรวจพบ</span>
                <div className="text-lg font-bold text-amber-400 mt-2 truncate">
                  {status?.latest_draw_detected || latestDraw?.งวดวันที่ || 'ยังไม่มีข้อมูล'}
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  ผ่านแหล่ง: {status?.last_source_used?.toUpperCase() || latestDraw?.แหล่งข้อมูล?.toUpperCase() || '—'}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">หวยที่ปิดต่อไป ณ ตอนนี้</span>
                <div className="text-base font-bold text-purple-300 mt-2 truncate">
                  {nextClosingNow.name}
                </div>
                <span className="text-[11px] text-purple-400 mt-1 font-semibold">
                  ปิดรับ {nextClosingNow.closeTimeStr} ({nextClosingNow.remainingText})
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">ธีม & ฟอนต์ปัจจุบัน</span>
                <div className="text-base font-bold text-slate-200 mt-2 capitalize flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                  {modalTheme} • {fontSize}
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  ฟอนต์: {fontFamily === 'mono' ? 'Monospace' : 'Sans-Serif'}
                </span>
              </div>
            </div>

            {/* Latest Lottery Result Showcase Card */}
            {latestDraw && (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 p-6 shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Sparkles className="w-48 h-48 text-amber-400" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      ผลสลากกินแบ่งรัฐบาลล่าสุด
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
                      งวดประจำวันที่ {latestDraw.งวดวันที่}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextClosing = getNextClosingLottery();
                        triggerAnnouncements([
                          {
                            id: 'showcase-' + Date.now(),
                            lotteryName: 'สลากกินแบ่งรัฐบาล',
                            drawDate: latestDraw.งวดวันที่,
                            firstPrize: latestDraw.รางวัลที่_1,
                            last2Digits: latestDraw.เลขท้าย_2_ตัว,
                            front3Digits: latestDraw.เลขหน้า_3_ตัว,
                            last3Digits: latestDraw.เลขท้าย_3_ตัว,
                            source: latestDraw.แหล่งข้อมูล,
                            nextClosing: nextClosing,
                          },
                        ]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      เปิดเสียงอ่านงวดนี้
                    </button>

                    <span className="text-xs font-bold px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 uppercase">
                      {latestDraw.แหล่งข้อมูล || 'GLO Official'}
                    </span>
                  </div>
                </div>

                {/* Big Winning Numbers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950/60 rounded-2xl p-5 border border-amber-500/40 flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
                      รางวัลที่ 1
                    </span>
                    <div className="text-4xl sm:text-5xl font-black text-amber-300 tracking-widest font-mono drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                      {latestDraw.รางวัลที่_1 || '------'}
                    </div>
                    <span className="text-xs text-slate-400 mt-2">
                      รางวัลละ 6,000,000 บาท
                    </span>
                  </div>

                  <div className="bg-slate-950/60 rounded-2xl p-5 border border-emerald-500/40 flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                      เลขท้าย 2 ตัว
                    </span>
                    <div className="text-4xl sm:text-5xl font-black text-emerald-300 tracking-widest font-mono drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                      {latestDraw.เลขท้าย_2_ตัว || '--'}
                    </div>
                    <span className="text-xs text-slate-400 mt-2">
                      รางวัลละ 2,000 บาท
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">เลขหน้า 3 ตัว (2 รางวัล)</span>
                    <div className="flex gap-4 mt-2">
                      {latestDraw.เลขหน้า_3_ตัว?.map((num, idx) => (
                        <div key={idx} className="flex-1 bg-slate-900/90 py-2 rounded-lg text-center font-mono font-bold text-xl text-slate-100 border border-slate-700/60">
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">เลขท้าย 3 ตัว (2 รางวัล)</span>
                    <div className="flex gap-4 mt-2">
                      {latestDraw.เลขท้าย_3_ตัว?.map((num, idx) => (
                        <div key={idx} className="flex-1 bg-slate-900/90 py-2 rounded-lg text-center font-mono font-bold text-xl text-slate-100 border border-slate-700/60">
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Multi-Lottery Highlights (Stocks, Hanoi, Lao, VIP) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    ไฮไลต์ผลด่วนรอบวันนี้ (หุ้นไทย, หุ้นนอก, ฮานอย, ลาว, VIP)
                  </h3>
                  <p className="text-xs text-slate-400">
                    อัปเดตผลรางวัลเรียงตามเวลาเช้าจรดค่ำ สามารถคลิกดูผลฉบับเต็มได้
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('summary')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition flex items-center gap-1 cursor-pointer"
                  >
                    เปิดตารางสรุปทั้งหมด ({allLotteries.length})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {allLotteries.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedCatalogLottery(item);
                      setActiveTab('catalog');
                    }}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="flex items-center gap-1.5 font-bold text-white group-hover:text-amber-300">
                          <span>{item.flag}</span>
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="text-[10px] font-mono">{item.drawTimeStr}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {item.categoryLabel}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block">3 ตัวบน</span>
                        <span className="text-lg font-black text-amber-300">{item.top3}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">2 ตัวล่าง</span>
                        <span className="text-lg font-black text-emerald-300">{item.bottom2}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: MESSAGE & TYPOGRAPHY CUSTOMIZER ==================== */}
        {activeTab === 'template' && (
          <div className="space-y-6">
            {/* Header & Save Action */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-3xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Palette className="w-5 h-5 text-amber-400" />
                  ปรับแต่งรูปแบบตัวหนังสือ & ข้อความที่ส่ง (Message & Typography)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  ปรับข้อความที่แจ้งเตือนทาง ntfy, สคริปต์เสียงพูดภาษาไทย, ธีมสี และขนาดตัวอักษรของ Modal ได้ตามใจชอบ
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={testSingleAnnouncement}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer flex items-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  ดูตัวอย่างใน Modal จริง
                </button>

                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5 transition"
                >
                  <Check className="w-4 h-4" />
                  บันทึกรูปแบบข้อความ
                </button>
              </div>
            </div>

            {/* Presets Bar */}
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                เลือกแม่แบบข้อความสำเร็จรูป (Preset Templates)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(TEMPLATE_PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key as any)}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 text-left transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-200 group-hover:text-amber-300 transition">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                        {p.body}
                      </div>
                    </div>
                    <span className="text-[10px] text-amber-400/80 mt-2 font-semibold">
                      คลิกเพื่อใช้แม่แบบนี้ →
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Editors & Live Preview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Form Editors */}
              <div className="space-y-6">
                {/* 1. Notification Text Template */}
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    1. รูปแบบข้อความแจ้งเตือน (Push / ntfy Text)
                  </h3>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      หัวข้อข้อความ (Title)
                    </label>
                    <input
                      type="text"
                      value={templateTitle}
                      onChange={(e) => setTemplateTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      เนื้อหาข้อความ (Body)
                    </label>
                    <textarea
                      rows={6}
                      value={templateBody}
                      onChange={(e) => setTemplateBody(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500 leading-relaxed"
                    />
                  </div>

                  {/* Variable helper chips */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1.5 font-semibold">
                      คลิกแทรกตัวแปรอัตโนมัติ:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        '{lottery_name}',
                        '{draw_date}',
                        '{first_prize}',
                        '{last_2}',
                        '{front_3}',
                        '{last_3}',
                        '{next_closing}',
                        '{source}',
                      ].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setTemplateBody((prev) => prev + '\n' + v)}
                          className="px-2 py-0.5 rounded-lg bg-slate-800 text-[11px] text-amber-300 hover:bg-slate-700 cursor-pointer font-mono"
                        >
                          + {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Voice Script Template */}
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    2. สคริปต์คำพูดเสียงภาษาไทย (Thai Speech Script)
                  </h3>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      สคริปต์คำพูดประกาศผล
                    </label>
                    <textarea
                      rows={5}
                      value={speechScript}
                      onChange={(e) => setSpeechScript(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-300 font-sans focus:outline-none focus:border-amber-500 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">คำลงท้าย (Polite Ending)</label>
                      <select
                        value={politeParticle}
                        onChange={(e) => setPoliteParticle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      >
                        <option value="ค่ะ">ค่ะ (สุภาพ หญิง)</option>
                        <option value="ครับ">ครับ (สุภาพ ชาย)</option>
                        <option value="ขอให้ทุกท่านเฮงๆ รวยๆ ครับ">ขอให้ทุกท่านเฮงๆ รวยๆ ครับ (อวยพร)</option>
                        <option value="">ไม่มี (ทางการกระชับ)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">ทดลองฟังเสียง</label>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleLottery = selectedCatalogLottery || allLotteries[0];
                          if (!sampleLottery) {
                            showToast('ยังไม่มีรายการหวยให้ทดสอบเสียง');
                            return;
                          }
                          const sampleAnn: LotteryAnnouncement = {
                            id: `sample-speech-${sampleLottery.id}`,
                            lotteryName: sampleLottery.name,
                            drawDate: sampleLottery.date || 'ตัวอย่างสำหรับทดสอบ',
                            firstPrize: (sampleLottery.category === 'gov_savings' ? sampleLottery.firstPrize : sampleLottery.top3) || sampleLottery.firstPrize || '-',
                            last2Digits: sampleLottery.bottom2 || '-',
                            front3Digits: [],
                            last3Digits: [],
                            source: 'ตัวอย่างจากแคตตาล็อก ไม่ใช่ผลจริง',
                            nextClosing: getNextClosingLottery(),
                            note: 'ทดสอบเสียงเท่านั้น ไม่ใช่ผลหวยจริง',
                          };
                          playChime();
                          speakCurrentAnnouncement(sampleAnn, 0, 1);
                        }}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition border border-slate-700 flex items-center justify-center gap-1.5"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        ทดลองฟังเสียงสคริปต์นี้
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Modal Theme & Typography Styling */}
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Type className="w-4 h-4 text-purple-400" />
                    3. ปรับแต่งตัวหนังสือ & ธีมของ Modal
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">ธีมสี Modal</label>
                      <select
                        value={modalTheme}
                        onChange={(e) => setModalTheme(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                      >
                        <option value="gold">สีทองนำโชค (Gold)</option>
                        <option value="emerald">เขียวเหนี่ยวทรัพย์ (Emerald)</option>
                        <option value="purple">ม่วงหรูหรา (Royal Purple)</option>
                        <option value="cyber">ฟ้าไซเบอร์ (Cyber Cyan)</option>
                        <option value="ruby">แดงมงคล (Ruby Red)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">ขนาดตัวเลขสลาก</label>
                      <select
                        value={fontSize}
                        onChange={(e) => setFontSize(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                      >
                        <option value="compact">กะทัดรัด (Compact)</option>
                        <option value="large">ขนาดใหญ่ (Large - แนะนำ)</option>
                        <option value="xlarge">ใหญ่พิเศษ (Extra Large ชัดจากระยะไกล)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">สไตล์ฟอนต์</label>
                      <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                      >
                        <option value="sans">โมเดิร์น (Sans-serif อ่านง่าย)</option>
                        <option value="mono">ดิจิทัลคมชัด (Monospace)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Real-Time Previews */}
              <div className="space-y-6">
                {/* 1. Push Notification Mockup Preview */}
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-400" />
                    ตัวอย่างข้อความแจ้งเตือนทาง ntfy (Phone Preview)
                  </span>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 shadow-lg">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        <Bell className="w-3.5 h-3.5" />
                        ntfy • lottery-alert
                      </span>
                      <span>เมื่อสักครู่</span>
                    </div>

                    <div className="font-bold text-sm text-slate-100 mb-2">
                      {renderedPreview.title}
                    </div>

                    <div className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                      {renderedPreview.body}
                    </div>
                  </div>
                </div>

                {/* 2. Modal Live Layout Preview */}
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-400" />
                    ตัวอย่างการแสดงผลบนหน้าจอ Modal (Theme: {modalTheme})
                  </span>

                  <div className={`p-5 rounded-2xl border-2 ${themeClasses.container} space-y-4`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${themeClasses.badge}`}>
                        ตัวอย่าง Pop-up Preview
                      </span>
                      <span className="text-xs font-bold text-white">{selectedCatalogLottery?.name || allLotteries[0]?.name || 'ตัวอย่างหวย'}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className={`bg-slate-950/80 p-3 rounded-xl border flex flex-col items-center justify-center ${themeClasses.firstPrizeBox}`}>
                        <span className={`text-[10px] font-bold uppercase ${themeClasses.accent}`}>เลขบน / รางวัลที่ 1</span>
                        <div className={`font-black font-mono tracking-wider ${themeClasses.firstPrizeText} ${sizeClasses.first}`}>
                          {selectedCatalogLottery?.top3 || selectedCatalogLottery?.firstPrize || '-'}
                        </div>
                      </div>

                      <div className="bg-slate-950/80 p-3 rounded-xl border border-emerald-500/50 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold uppercase text-emerald-400">เลขล่าง 2 ตัว</span>
                        <div className={`font-black font-mono tracking-wider text-emerald-300 ${sizeClasses.last2}`}>
                          {selectedCatalogLottery?.bottom2 || '-'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                      ⏰ หวยที่ปิดรอบถัดไป: <span className="font-bold text-purple-300">{nextClosingNow.name} ({nextClosingNow.closeTimeStr})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: SCHEDULE (ตารางเวลาหวยปิดรอบถัดไป) ==================== */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    ตารางเวลาปิดรับสลากและหวย (Lottery Closing Timetable)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    ระบบจะตรวจสอบและนำชื่อหวยที่ปิดรับรอบถัดไปมารวมในเสียงพูดแจ้งเตือนอัตโนมัติ
                  </p>
                </div>

                <div className="px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                  หวยที่ปิดต่อไปตอนนี้: {nextClosingNow.name} ({nextClosingNow.closeTimeStr})
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {LOTTERY_SCHEDULE.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-slate-100">{item.name}</span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {item.closeTimeStr}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {item.drawDaysLabel}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span>ประเภท: หวยสากล / ยอดนิยม</span>
                      <button
                        type="button"
                        onClick={() => {
                          triggerAnnouncements([
                            {
                              id: 'sched-test-' + idx,
                              lotteryName: item.name,
                              drawDate: 'งวดล่าสุด',
                              firstPrize: '749215',
                              last2Digits: '63',
                              nextClosing: getNextClosingLottery(),
                            },
                          ]);
                        }}
                        className="text-amber-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                      >
                        <Volume2 className="w-3 h-3" />
                        ทดลองประกาศชื่อนี้
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: UNIFIED SETTINGS CENTER ==================== */}
        {(activeTab === 'settings' ||
          activeTab === 'mobile' ||
          activeTab === 'template' ||
          activeTab === 'github' ||
          activeTab === 'files' ||
          activeTab === 'channels' ||
          activeTab === 'deployment' ||
          activeTab === 'schedule' ||
          activeTab === 'tester' ||
          activeTab === 'worker' ||
          activeTab === 'broadcast') && (
          <SettingsCenter
            settings={settings}
            onSaveSettings={handleSaveMultiChannelSettings}
            rawSettingsJson={rawSettingsJson}
            setRawSettingsJson={setRawSettingsJson}
            onSaveRawSettings={handleSaveRawSettings}
            onRefreshData={fetchData}
            status={status}
            latestDraw={latestDraw}
            allLotteries={allLotteries}
            onSpeak={speakCustomText}
            voiceEnabled={voiceEnabled}
            onToggleVoice={(v) => {
              setVoiceEnabled(v);
              if (!v) stopSpeech();
              showToast(v ? 'เปิดเสียงประกาศภาษาไทย 🔊' : 'ปิดเสียงประกาศ 🔇');
            }}
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



        {/* ==================== TAB: NTFY TESTER ==================== */}
        {activeTab === 'tester' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">ทดสอบส่ง Push Alert ไปยัง ntfy</h3>
                  <p className="text-xs text-slate-400">
                    ทดสอบการส่งการแจ้งเตือนจริงไปยังแอป ntfy บนมือถือ หรือหน้าเว็บเบราว์เซอร์
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    ntfy Topic Name
                  </label>
                  <input
                    type="text"
                    value={testTopic}
                    onChange={(e) => setTestTopic(e.target.value)}
                    placeholder="เช่น th-lottery-alert-secret"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">ความสำคัญ (Priority)</label>
                  <select
                    value={testPriority}
                    onChange={(e) => setTestPriority(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="urgent">Urgent (สูงสุด - มีเสียงและสั่นตลอด)</option>
                    <option value="high">High (สำคัญ - แจ้งเตือนปกติพร้อมเสียง)</option>
                    <option value="default">Default (ปานกลาง)</option>
                    <option value="low">Low (เงียบ)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">ข้อความแจ้งเตือน (Message)</label>
                  <textarea
                    rows={4}
                    value={testCustomMessage}
                    onChange={(e) => setTestCustomMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500 leading-relaxed font-mono"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendTestNtfy}
                  disabled={isSendingTest}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-spin' : ''}`} />
                  {isSendingTest ? 'กำลังส่งการแจ้งเตือน...' : 'ส่งแจ้งเตือนทดสอบเดี๋ยวนี้'}
                </button>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-400 font-semibold mb-4 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-slate-400" />
                ตัวอย่างการแสดงผลบนโทรศัพท์ (Mobile Notification Preview)
              </span>

              <div className="w-[300px] bg-slate-950 border-4 border-slate-800 rounded-[36px] p-4 shadow-2xl relative">
                <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto mb-4"></div>

                <div className="bg-slate-900/90 backdrop-blur border border-amber-500/30 rounded-2xl p-3.5 shadow-lg">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400">
                      <Bell className="w-3.5 h-3.5" />
                      ntfy • {testTopic || 'lottery-alert'}
                    </div>
                    <span>เมื่อสักครู่</span>
                  </div>

                  <div className="font-bold text-xs text-slate-100 mt-1">
                    {renderedPreview.title}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed font-mono">
                    {renderedPreview.body}
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-500 mt-6">
                  ntfy.sh / Topic: {testTopic}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: MOBILE NOTIFICATION HUB (100% RELIABLE) ==================== */}
        {activeTab === 'mobile' && (
          <MobileNotificationHub
            currentTopic={settings?.channels?.ntfy?.topic || settings?.ntfy?.topic || ''}
            onUpdateTopic={(newTopic) => {
              if (settings) {
                const updated = {
                  ...settings,
                  channels: {
                    ...settings.channels,
                    ntfy: { ...(settings.channels?.ntfy || {}), topic: newTopic },
                  },
                };
                setSettings(updated);
              }
            }}
            latestDraw={latestDraw}
            allLotteries={allLotteries}
            nextClosing={getNextClosingLottery()}
            onSpeak={(txt) => {
              if (voiceEnabled) speakCustomText(txt);
            }}
          />
        )}

        {/* ==================== TAB: IN-APP CODE EDITOR & GITHUB DIRECT COMMIT ==================== */}
        {activeTab === 'files' && (
          <ProjectCodeEditor
            onRefreshProject={fetchData}
            defaultRepo={localStorage.getItem('gh_repo') || 'myuser/th-lottery-alert'}
            defaultBranch={localStorage.getItem('gh_branch') || 'main'}
          />
        )}

        {activeTab === 'worker' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    สถาปัตยกรรมความปลอดภัย Cloudflare Worker Proxy
                  </h3>
                  <p className="text-xs text-slate-400">
                    ตามแผนงานแยกหน้าควบคุม: GITHUB_TOKEN จะถูกเก็บเป็น Secret ใน Cloudflare Worker ไม่หลุดสู่บราวเซอร์
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="font-bold text-xs text-slate-200 mb-1">1. GitHub Secret (NTFY_TOPIC)</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    ใส่ใน GitHub Settings &gt; Secrets and variables &gt; Actions ชื่อ <code className="text-amber-400">NTFY_TOPIC</code> เพื่อให้ workflow รันแจ้งเตือนได้
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="font-bold text-xs text-slate-200 mb-1">2. Cloudflare Worker Secrets</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Deploy <code className="text-amber-400">api/worker.js</code> แล้วตั้ง Secret <code className="text-purple-400">GITHUB_TOKEN</code> และ <code className="text-purple-400">DASH_PASSWORD</code>
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="font-bold text-xs text-slate-200 mb-1">3. เชื่อมต่อจากหน้า Dashboard</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    ใส่ Worker URL และ DASH_PASSWORD ด้านล่าง เพื่อสั่งอัปเดต settings.json หรือ Trigger Actions จากหน้านี้
                  </p>
                </div>
              </div>
            </div>

            {/* Reconnection Helper & Connection Settings */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    ตั้งค่าเชื่อมต่อ Worker & ตัวช่วยเชื่อมต่ออัตโนมัติ (Reconnection Helper)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    ระบบจะช่วยทดลองตรวจสอบสถานะใหม่แบบทวีคูณ (Exponential Backoff) อัตโนมัติเมื่อการเชื่อมต่อล้มเหลว
                  </p>
                </div>

                {/* Live Status Badge */}
                <div className="flex items-center gap-2">
                  {isWorkerConnected ? (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                      <Wifi className="w-4 h-4 text-emerald-400" />
                      เชื่อมต่อสำเร็จ (Connected)
                    </span>
                  ) : isReconnecting ? (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
                      <RotateCw className="w-4 h-4 text-amber-400 animate-spin" />
                      กำลังลองใหม่: ครั้งที่ {reconnectAttempt}/{maxReconnectRetries}
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
                      <WifiOff className="w-4 h-4 text-slate-500" />
                      ยังไม่ได้เชื่อมต่อ (Disconnected)
                    </span>
                  )}
                </div>
              </div>

              {/* Connection Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Cloudflare Worker API URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://lottery-alert-proxy.yourname.workers.dev"
                    value={workerUrl}
                    onChange={(e) => {
                      setWorkerUrl(e.target.value);
                      localStorage.setItem('cf_worker_url', e.target.value);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Dashboard Password (DASH_PASSWORD)
                  </label>
                  <input
                    type="password"
                    placeholder="รหัสผ่านที่คุณตั้งไว้ใน Worker Secrets"
                    value={dashPassword}
                    onChange={(e) => {
                      setDashPassword(e.target.value);
                      localStorage.setItem('cf_dash_password', e.target.value);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Active Reconnection Banner (When Retry in Progress) */}
              {isReconnecting && (
                <div className="bg-gradient-to-r from-amber-950/60 via-slate-950 to-amber-950/40 border border-amber-500/40 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                        <RotateCw className="w-5 h-5 animate-spin" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-amber-300 flex items-center gap-2">
                          <span>กำลังทำงาน: ระบบ Reconnection อัตโนมัติ (Exponential Backoff)</span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[10px] font-mono">
                            พยายามครั้งที่ {reconnectAttempt} จาก {maxReconnectRetries}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5">
                          {countdownSeconds > 0 ? (
                            <span>
                              ⏳ กำลังหน่วงเวลาก่อนลองรอบถัดไปในอีก{' '}
                              <strong className="text-amber-300 text-sm">{countdownSeconds}</strong> วินาที...
                            </span>
                          ) : (
                            <span>🚀 กำลังส่งคำขอตรวจสอบสถานะไปยังเซิร์ฟเวอร์ Worker...</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={retryNowImmediately}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        ลองใหม่ทันที
                      </button>

                      <button
                        type="button"
                        onClick={cancelReconnection}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 font-semibold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5"
                      >
                        <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                        ยกเลิก
                      </button>
                    </div>
                  </div>

                  {/* Progress bar of retries */}
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (reconnectAttempt / maxReconnectRetries) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={isReconnecting}
                  onClick={() => handleConnectWithBackoff(0)}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-lg shadow-purple-600/25 flex items-center gap-2 disabled:opacity-50"
                >
                  <Wifi className="w-4 h-4" />
                  {isReconnecting ? 'กำลังลองเชื่อมต่อ...' : 'ทดสอบเชื่อมต่อ (Connect with Backoff)'}
                </button>

                <button
                  type="button"
                  disabled={isReconnecting}
                  onClick={simulateBackoffFailure}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition flex items-center gap-2 disabled:opacity-50"
                >
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  ทดสอบจำลองเชื่อมต่อล้มเหลว (Simulate Test)
                </button>
              </div>

              {/* Connected Worker Details Card */}
              {isWorkerConnected && workerDetails && (
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-4 text-xs space-y-2">
                  <div className="font-bold text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ข้อมูล Cloudflare Worker ที่เชื่อมต่ออยู่:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 font-mono text-[11px] pt-1">
                    <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Repository</span>
                      <span className="font-bold text-white">{workerDetails.repo || 'user/repo'}</span>
                    </div>
                    <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Branch</span>
                      <span className="font-bold text-white">{workerDetails.branch || 'main'}</span>
                    </div>
                    <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Status</span>
                      <span className="font-bold text-emerald-400 uppercase">{workerDetails.status || 'OK'}</span>
                    </div>
                    <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Auth Check</span>
                      <span className="font-bold text-amber-300">{workerDetails.authRequired ? 'Protected' : 'Public'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Strategy Configuration & Timeline */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    กลยุทธ์การหน่วงเวลา Exponential Backoff Strategy
                  </span>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRetryOnFail}
                      onChange={(e) => setAutoRetryOnFail(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-0 cursor-pointer"
                    />
                    เปิดใช้งาน Auto-Retry อัตโนมัติ
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      จำนวนรอบที่พยายามสูงสุด (Max Retries)
                    </label>
                    <select
                      value={maxReconnectRetries}
                      onChange={(e) => setMaxReconnectRetries(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value={3}>3 ครั้ง</option>
                      <option value={5}>5 ครั้ง (แนะนำตามมาตรฐาน)</option>
                      <option value={8}>8 ครั้ง</option>
                      <option value={10}>10 ครั้ง (ทนทานสูงสุด)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      เวลาเริ่มต้น (Initial Delay)
                    </label>
                    <select
                      value={initialRetryDelayMs}
                      onChange={(e) => setInitialRetryDelayMs(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value={1000}>1.0 วินาที</option>
                      <option value={2000}>2.0 วินาที</option>
                      <option value={3000}>3.0 วินาที</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      อัตราการคูณทวีคูณ (Backoff Multiplier)
                    </label>
                    <select
                      value={backoffMultiplier}
                      onChange={(e) => setBackoffMultiplier(parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value={1.5}>1.5x</option>
                      <option value={2.0}>2.0x (มาตรฐานสากล)</option>
                      <option value={2.5}>2.5x</option>
                    </select>
                  </div>
                </div>

                {/* Formula Visual Step Calculator */}
                <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold">สูตรคำนวณการหน่วงเวลา:</span>
                    <span className="font-mono text-amber-300">
                      Delay = {initialRetryDelayMs / 1000}s × {backoffMultiplier}^(attempt - 1) + jitter
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-300 pt-1">
                    {Array.from({ length: Math.min(5, maxReconnectRetries) }).map((_, i) => {
                      const estimatedDelay = (
                        (initialRetryDelayMs * Math.pow(backoffMultiplier, i)) /
                        1000
                      ).toFixed(1);
                      return (
                        <div
                          key={i}
                          className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 flex items-center gap-1.5"
                        >
                          <span className="text-slate-500">รอบที่ {i + 1}:</span>
                          <span className="font-bold text-amber-400">~{estimatedDelay}s</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Reconnection Activity Logs Console */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    บันทึกประวัติ Reconnection Logs
                  </span>
                  {reconnectLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setReconnectLogs([])}
                      className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      ล้างประวัติ
                    </button>
                  )}
                </div>

                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-xs max-h-48 overflow-y-auto space-y-2">
                  {reconnectLogs.length > 0 ? (
                    reconnectLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
                        <span className="text-slate-600 shrink-0 text-[10px]">{log.timeStr}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                            log.status === 'success'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : log.status === 'failed'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : log.status === 'cancelled'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse'
                          }`}
                        >
                          {log.status}
                        </span>
                        <span className="text-slate-300 break-all">{log.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-600 text-center py-4 text-xs font-sans">
                      ยังไม่มีบันทึก Reconnection • กดปุ่ม "ทดสอบเชื่อมต่อ" หรือ "จำลองเชื่อมต่อล้มเหลว" เพื่อทดสอบ
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: GITHUB ACTIONS RUNNER ==================== */}
        {activeTab === 'github' && (
          <GitHubAppRunner
            onRefreshStatus={fetchData}
            systemStatus={status}
            allLotteriesCount={allLotteries.length}
          />
        )}

        {/* ==================== TAB: LIVE BROADCAST & TV KIOSK ==================== */}
        {activeTab === 'broadcast' && (
          <BroadcastKiosk
            latestDraw={latestDraw}
            allLotteries={allLotteries}
            selectedLottery={selectedCatalogLottery}
            onSelectLottery={(item) => setSelectedCatalogLottery(item)}
            nextClosing={nextClosingNow}
            onTriggerSpeech={(item) => {
              if (item) handleSpeakSpecificLottery(item);
              else testSingleAnnouncement();
            }}
            isSpeaking={isSpeaking}
            onStopSpeech={stopSpeech}
          />
        )}

        {/* ==================== TAB: MULTI-CHANNEL DISPATCHER ==================== */}
        {activeTab === 'channels' && (
          <MultiChannelDispatcher
            settings={settings || {}}
            onSaveSettings={handleSaveMultiChannelSettings}
            latestDraw={latestDraw}
          />
        )}

        {/* ==================== TAB 4: LOTTERY STATS & TREND ANALYTICS ==================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <LotteryTrendAnalytics
              results={results}
              onSelectNumber={(num) => {
                showToast(`เลือกเลข ${num} แล้ว (คัดลอกลงคลิปบอร์ดแล้ว)`);
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(num);
                }
              }}
            />
            <LotteryAnalytics
              results={results}
              watchedNumbers={settings?.notifications?.custom_watched_numbers || []}
              onAddWatchedNumber={handleAddWatchedNumber}
            />
          </div>
        )}

        {/* ==================== TAB 3: SMART TICKET CHECKER & AI ACCURACY CENTER ==================== */}
        {(activeTab === 'checker' || activeTab === 'accuracy' || activeTab === 'batch' || activeTab === 'results') && (
          <div className="space-y-6">
            {/* Sub-navigation bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 shadow-lg flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCheckerSubTab('accuracy')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                    checkerSubTab === 'accuracy'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-950/70 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  <Globe className={`w-4 h-4 ${checkerSubTab === 'accuracy' ? 'text-slate-950' : 'text-emerald-400'}`} />
                  <span>🛡️ ยืนยันข้อมูลสด AI (Google Search &amp; Voice)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCheckerSubTab('batch')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                    checkerSubTab === 'batch'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950/70 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  <Ticket className={`w-4 h-4 ${checkerSubTab === 'batch' ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>🎯 ตรวจรางวัลสลาก (เดี่ยว &amp; ชุดหลายใบ)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCheckerSubTab('history')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                    checkerSubTab === 'history'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-950/70 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>📜 ประวัติผลสลากย้อนหลัง ({results.length} งวด)</span>
                </button>
              </div>

              <div className="text-xs text-slate-400 px-2 font-medium hidden lg:flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>งวดล่าสุด:</span>
                <span className="font-bold text-amber-300">{latestDraw?.งวดวันที่ || 'ยังไม่มีข้อมูล'}</span>
              </div>
            </div>

            {/* Subtab 1: AI Search Grounding & Voice Verification */}
            {checkerSubTab === 'accuracy' && (
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
            )}

            {/* Subtab 2: Single & Batch Ticket Checker */}
            {checkerSubTab === 'batch' && (
              <BatchTicketChecker
                results={results}
                latestDraw={latestDraw}
              />
            )}

            {/* Subtab 3: Past Results History with Prize Filter Dropdown */}
            {checkerSubTab === 'history' && (() => {
              const filteredHistoryResults = results.filter((row) => {
                // Search query filter (matches prize number, draw date, or lottery name)
                if (historySearchTerm.trim()) {
                  const term = historySearchTerm.trim().toLowerCase();
                  const nameMatch = (row.ชื่อหวย || '').toLowerCase().includes(term);
                  const dateMatch = (row.งวดวันที่ || '').toLowerCase().includes(term);
                  const firstMatch = (row.รางวัลที่_1 || '').includes(term);
                  const last2Match = (row.เลขท้าย_2_ตัว || '').includes(term);
                  const front3Match = Array.isArray(row.เลขหน้า_3_ตัว) && row.เลขหน้า_3_ตัว.some((n) => n.includes(term));
                  const last3Match = Array.isArray(row.เลขท้าย_3_ตัว) && row.เลขท้าย_3_ตัว.some((n) => n.includes(term));
                  const top3Match = (row.เลขบน_3_ตัว || '').includes(term);
                  if (!nameMatch && !dateMatch && !firstMatch && !last2Match && !front3Match && !last3Match && !top3Match) {
                    return false;
                  }
                }

                // Prize type dropdown filter
                if (historyPrizeFilter === 'first') {
                  return Boolean(row.รางวัลที่_1 && row.รางวัลที่_1.trim() !== '');
                }
                if (historyPrizeFilter === 'last2') {
                  return Boolean(row.เลขท้าย_2_ตัว && row.เลขท้าย_2_ตัว.trim() !== '');
                }
                if (historyPrizeFilter === '3digits') {
                  const hasFront3 = Array.isArray(row.เลขหน้า_3_ตัว) && row.เลขหน้า_3_ตัว.length > 0;
                  const hasLast3 = Array.isArray(row.เลขท้าย_3_ตัว) && row.เลขท้าย_3_ตัว.length > 0;
                  const hasTop3 = Boolean(row.เลขบน_3_ตัว && row.เลขบน_3_ตัว.trim() !== '');
                  return hasFront3 || hasLast3 || hasTop3;
                }
                if (historyPrizeFilter === 'thai') {
                  const category = String(row.หมวดหวย || '').toLowerCase();
                  const name = String(row.ชื่อหวย || '');
                  return (
                    ['thai', 'government', 'gov_savings'].includes(category) ||
                    name.includes('สลากกินแบ่ง') ||
                    name.includes('ออมสิน') ||
                    name.includes('ธ.ก.ส.')
                  );
                }
                return true;
              });

              // Statistics calculation
              const totalFiltered = filteredHistoryResults.length;
              const evenCount = filteredHistoryResults.filter((r) => {
                const n = parseInt(r.เลขท้าย_2_ตัว, 10);
                return !isNaN(n) && n % 2 === 0;
              }).length;
              const oddCount = filteredHistoryResults.filter((r) => {
                const n = parseInt(r.เลขท้าย_2_ตัว, 10);
                return !isNaN(n) && n % 2 !== 0;
              }).length;

              return (
                <div className="space-y-5">
                  {/* Filter Toolbar Card */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                          <History className="w-5 h-5 text-amber-400" />
                          ประวัติผลสลากและหวยย้อนหลัง (Results History)
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          ค้นหาและกรองผลรางวัลย้อนหลังจากฐานข้อมูล <code className="text-amber-300 font-mono">lottery_previous_results.json</code>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          แสดง <strong className="text-amber-400">{totalFiltered}</strong> / {results.length} งวด
                        </span>
                        {(historyPrizeFilter !== 'all' || historySearchTerm) && (
                          <button
                            onClick={() => {
                              setHistoryPrizeFilter('all');
                              setHistorySearchTerm('');
                            }}
                            className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            ล้างตัวกรอง
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Controls row: Dropdown Filter + Search Box */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-800/80">
                      {/* Dropdown Selector */}
                      <div className="md:col-span-5 flex flex-col gap-1.5">
                        <label htmlFor="history-prize-filter-select" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <ListFilter className="w-3.5 h-3.5 text-amber-400" />
                          กรองประเภทรางวัล (Prize Filter):
                        </label>
                        <div className="relative">
                          <select
                            id="history-prize-filter-select"
                            value={historyPrizeFilter}
                            onChange={(e) => setHistoryPrizeFilter(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-700 hover:border-amber-400 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium appearance-none cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-amber-400/50 pr-10 shadow-inner"
                          >
                            <option value="all">📋 ทุกรางวัล (All Prizes / มุมมองเต็ม)</option>
                            <option value="first">🏆 เฉพาะรางวัลที่ 1 (Only 1st Prize Focus)</option>
                            <option value="last2">🟢 เฉพาะเลขท้าย 2 ตัว (Only 2-Digit Prizes Focus)</option>
                            <option value="3digits">✨ เฉพาะเลข 3 ตัว (Front / Last 3-Digits)</option>
                            <option value="thai">🇹🇭 เฉพาะสลากกินแบ่งรัฐบาล (Thai Gov Only)</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                          </div>
                        </div>
                      </div>

                      {/* Search Input Box */}
                      <div className="md:col-span-7 flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Search className="w-3.5 h-3.5 text-emerald-400" />
                          ค้นหาตัวเลข / งวด / ชื่อหวย:
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={historySearchTerm}
                            onChange={(e) => setHistorySearchTerm(e.target.value)}
                            placeholder="พิมพ์เลขรางวัล เช่น 781, 69 หรือชื่อหวย เช่น นิเคอิ, ฮานอย..."
                            className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:outline-none focus:ring-1 focus:ring-emerald-400/50 pr-8 shadow-inner"
                          />
                          {historySearchTerm ? (
                            <button
                              onClick={() => setHistorySearchTerm('')}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                              <Search className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Filter Chips (1-tap pill selectors) */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                        เลือกด่วน:
                      </span>
                      {[
                        { id: 'all', label: 'ทั้งหมด (All)', icon: '📋' },
                        { id: 'first', label: 'เฉพาะรางวัลที่ 1', icon: '🏆' },
                        { id: 'last2', label: 'เฉพาะเลขท้าย 2 ตัว', icon: '🟢' },
                        { id: '3digits', label: 'เฉพาะเลข 3 ตัว', icon: '✨' },
                        { id: 'thai', label: 'สลากกินแบ่งรัฐบาล', icon: '🇹🇭' },
                      ].map((chip) => {
                        const active = historyPrizeFilter === chip.id;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => setHistoryPrizeFilter(chip.id as any)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
                              active
                                ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                            }`}
                          >
                            <span>{chip.icon}</span>
                            <span>{chip.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Dynamic Insight Banner based on selected filter */}
                    {historyPrizeFilter === 'first' && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            <strong>โหมดเจาะจงรางวัลที่ 1:</strong> ขยายขนาดตัวเลขรางวัลที่ 1 ให้เด่นชัด พร้อมปุ่มลัดคัดลอกเฉพาะเลขรางวัลที่ 1 ทันที
                          </span>
                        </div>
                        <span className="font-mono text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                          {totalFiltered} งวดที่มีรางวัลที่ 1
                        </span>
                      </div>
                    )}

                    {historyPrizeFilter === 'last2' && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs text-emerald-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            <strong>โหมดเจาะจงเลขท้าย 2 ตัว:</strong> เน้นแสดงผลเลข 2 ตัว พร้อมวิเคราะห์ความถี่เลขคู่/เลขคี่
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300">
                            เลขคู่: {evenCount} งวด
                          </span>
                          <span className="bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300">
                            เลขคี่: {oddCount} งวด
                          </span>
                        </div>
                      </div>
                    )}

                    {historyPrizeFilter === '3digits' && (
                      <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl px-4 py-2.5 text-xs text-sky-200 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>
                          <strong>โหมดเจาะจงเลข 3 ตัว:</strong> แสดงเลขหน้า 3 ตัว, เลขท้าย 3 ตัว และเลขบน 3 ตัวอย่างชัดเจน
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Empty state if no results */}
                  {filteredHistoryResults.length === 0 ? (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <Search className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-200">ไม่พบผลรางวัลที่ตรงกับเงื่อนไขการกรอง</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        ลองเปลี่ยนคำค้นหา หรือเลือกตัวกรองประเภทรางวัลเป็น "ทุกรางวัล (All Prizes)" เพื่อดูข้อมูลทั้งหมด
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPrizeFilter('all');
                          setHistorySearchTerm('');
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition cursor-pointer"
                      >
                        ล้างเงื่อนไขการค้นหาทั้งหมด
                      </button>
                    </div>
                  ) : (
                    /* History Cards Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredHistoryResults.map((row, idx) => {
                        const lotteryTitle = row.ชื่อหวย || 'สลากกินแบ่งรัฐบาล (ไทย)';
                        const hasFront3 = Array.isArray(row.เลขหน้า_3_ตัว) && row.เลขหน้า_3_ตัว.length > 0;
                        const hasLast3 = Array.isArray(row.เลขท้าย_3_ตัว) && row.เลขท้าย_3_ตัว.length > 0;
                        const hasTop3 = Boolean(row.เลขบน_3_ตัว && row.เลขบน_3_ตัว.trim() !== '');

                        // Determine card accent styling based on active prize filter
                        let cardBorder = 'hover:border-slate-700 border-slate-800';
                        if (historyPrizeFilter === 'first') {
                          cardBorder = 'border-amber-500/40 hover:border-amber-400/70 shadow-amber-950/20';
                        } else if (historyPrizeFilter === 'last2') {
                          cardBorder = 'border-emerald-500/40 hover:border-emerald-400/70 shadow-emerald-950/20';
                        } else if (historyPrizeFilter === '3digits') {
                          cardBorder = 'border-sky-500/40 hover:border-sky-400/70 shadow-sky-950/20';
                        }

                        return (
                          <div
                            key={idx}
                            className={`bg-slate-900/90 border rounded-2xl p-5 transition flex flex-col justify-between shadow-lg relative overflow-hidden group ${cardBorder}`}
                          >
                            {/* Card Top: Lottery Title & Date */}
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                    {lotteryTitle}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                    งวด {row.งวดวันที่}
                                  </div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono border border-slate-700/60 shrink-0">
                                  {row.แหล่งข้อมูล || 'glo'}
                                </span>
                              </div>

                              {/* ADAPTIVE PRIZE VIEW: Mode 1 - Only 1st Prize Focus */}
                              {historyPrizeFilter === 'first' ? (
                                <div className="space-y-3">
                                  <div className="bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-950 p-4 rounded-xl border border-amber-500/40 shadow-inner">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <Trophy className="w-3.5 h-3.5" />
                                        รางวัลที่ 1 (1st Prize)
                                      </span>
                                      <span className="text-[10px] text-amber-300/80 font-mono">
                                        {row.รางวัลที่_1.length} หลัก
                                      </span>
                                    </div>
                                    <div className="text-3xl sm:text-4xl font-black font-mono text-amber-300 tracking-wider text-center py-2 select-all">
                                      {row.รางวัลที่_1}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 pt-1 border-t border-amber-500/20">
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(row.รางวัลที่_1, `first-${idx}`)}
                                        className="text-[11px] px-2.5 py-1 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 transition font-semibold cursor-pointer flex items-center gap-1"
                                      >
                                        <Copy className="w-3 h-3" />
                                        คัดลอกเฉพาะรางวัลที่ 1
                                      </button>
                                    </div>
                                  </div>

                                  {/* Secondary context pill */}
                                  <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                                    <span className="text-slate-400">เลขท้าย 2 ตัวประกอบ:</span>
                                    <span className="font-mono font-bold text-emerald-400">{row.เลขท้าย_2_ตัว}</span>
                                  </div>
                                </div>
                              ) : historyPrizeFilter === 'last2' ? (
                                /* ADAPTIVE PRIZE VIEW: Mode 2 - Only 2-Digit Focus */
                                <div className="space-y-3">
                                  <div className="bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950 p-4 rounded-xl border border-emerald-500/40 shadow-inner">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        เลขท้าย 2 ตัว (2-Digit Prize)
                                      </span>
                                      {(() => {
                                        const num = parseInt(row.เลขท้าย_2_ตัว, 10);
                                        return !isNaN(num) ? (
                                          <span className="text-[10px] text-emerald-300/80 font-mono">
                                            {num % 2 === 0 ? 'เลขคู่' : 'เลขคี่'} • {num >= 50 ? 'สูง' : 'ต่ำ'}
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                    <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-400 tracking-wider text-center py-2 select-all">
                                      {row.เลขท้าย_2_ตัว}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 pt-1 border-t border-emerald-500/20">
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(row.เลขท้าย_2_ตัว, `last2-${idx}`)}
                                        className="text-[11px] px-2.5 py-1 rounded bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-200 transition font-semibold cursor-pointer flex items-center gap-1"
                                      >
                                        <Copy className="w-3 h-3" />
                                        คัดลอกเฉพาะเลข 2 ตัว
                                      </button>
                                    </div>
                                  </div>

                                  {/* Secondary context pill */}
                                  <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                                    <span className="text-slate-400">รางวัลที่ 1 อ้างอิง:</span>
                                    <span className="font-mono font-bold text-amber-300">{row.รางวัลที่_1}</span>
                                  </div>
                                </div>
                              ) : historyPrizeFilter === '3digits' ? (
                                /* ADAPTIVE PRIZE VIEW: Mode 3 - 3-Digit Focus */
                                <div className="space-y-3">
                                  <div className="bg-gradient-to-br from-sky-950/40 via-slate-950 to-slate-950 p-4 rounded-xl border border-sky-500/40 shadow-inner space-y-3">
                                    <div className="text-[11px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                      <Layers className="w-3.5 h-3.5" />
                                      กลุ่มรางวัลเลข 3 ตัว (3-Digits)
                                    </div>

                                    {/* Front 3 digits */}
                                    {hasFront3 && (
                                      <div>
                                        <div className="text-[10px] text-slate-400 mb-1">เลขหน้า 3 ตัว:</div>
                                        <div className="flex gap-2">
                                          {row.เลขหน้า_3_ตัว!.map((n, i) => (
                                            <span key={i} className="px-3 py-1 bg-sky-900/40 border border-sky-500/30 rounded-lg text-lg font-mono font-bold text-sky-200">
                                              {n}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Last 3 digits */}
                                    {hasLast3 && (
                                      <div>
                                        <div className="text-[10px] text-slate-400 mb-1">เลขท้าย 3 ตัว:</div>
                                        <div className="flex gap-2">
                                          {row.เลขท้าย_3_ตัว!.map((n, i) => (
                                            <span key={i} className="px-3 py-1 bg-amber-900/40 border border-amber-500/30 rounded-lg text-lg font-mono font-bold text-amber-200">
                                              {n}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Top 3 (if stock) */}
                                    {hasTop3 && !hasFront3 && !hasLast3 && (
                                      <div>
                                        <div className="text-[10px] text-slate-400 mb-1">เลขบน 3 ตัว (หุ้น/ต่างประเทศ):</div>
                                        <div className="text-2xl font-mono font-bold text-sky-300">
                                          {row.เลขบน_3_ตัว}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 text-center">
                                      <div className="text-[10px] text-slate-400">รางวัลที่ 1</div>
                                      <div className="font-mono font-bold text-amber-300">{row.รางวัลที่_1}</div>
                                    </div>
                                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 text-center">
                                      <div className="text-[10px] text-slate-400">เลขท้าย 2 ตัว</div>
                                      <div className="font-mono font-bold text-emerald-400">{row.เลขท้าย_2_ตัว}</div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* ADAPTIVE PRIZE VIEW: Mode Default - All Prizes Overview */
                                <div className="space-y-3">
                                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] text-amber-400 font-semibold uppercase flex items-center gap-1">
                                        <Trophy className="w-3 h-3" />
                                        รางวัลที่ 1
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(row.รางวัลที่_1, `c1-${idx}`)}
                                        className="text-[10px] text-slate-400 hover:text-amber-300 cursor-pointer"
                                        title="คัดลอกรางวัลที่ 1"
                                      >
                                        <Copy className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                    <div className="text-2xl font-black font-mono text-amber-300 tracking-wider">
                                      {row.รางวัลที่_1}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] text-emerald-400 font-semibold">เลขท้าย 2 ตัว</span>
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(row.เลขท้าย_2_ตัว, `c2-${idx}`)}
                                          className="text-[10px] text-slate-400 hover:text-emerald-300 cursor-pointer"
                                          title="คัดลอกเลขท้าย 2 ตัว"
                                        >
                                          <Copy className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                      <div className="text-xl font-black font-mono text-emerald-300">
                                        {row.เลขท้าย_2_ตัว}
                                      </div>
                                    </div>

                                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                                      <div className="text-[10px] text-slate-400 font-semibold">สถานะแจ้งเตือน</div>
                                      <div className="text-xs font-bold text-slate-300 mt-1 capitalize flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        {row.สถานะการแจ้งเตือน || 'Sent'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* 3-Digit chips preview if available */}
                                  {(hasFront3 || hasLast3) && (
                                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60 text-[11px] space-y-1">
                                      {hasFront3 && (
                                        <div className="flex items-center gap-1 text-slate-400">
                                          <span>หน้า 3 ตัว:</span>
                                          <span className="font-mono font-bold text-slate-200">
                                            {row.เลขหน้า_3_ตัว!.join(', ')}
                                          </span>
                                        </div>
                                      )}
                                      {hasLast3 && (
                                        <div className="flex items-center gap-1 text-slate-400">
                                          <span>ท้าย 3 ตัว:</span>
                                          <span className="font-mono font-bold text-slate-200">
                                            {row.เลขท้าย_3_ตัว!.join(', ')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Card Footer: Audio Announcement & Copy Summary Buttons */}
                            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextClosing = getNextClosingLottery();
                                  triggerAnnouncements([
                                    {
                                      id: 'hist-' + idx,
                                      lotteryName: row.ชื่อหวย || 'สลากกินแบ่งรัฐบาล',
                                      drawDate: row.งวดวันที่,
                                      firstPrize: row.รางวัลที่_1,
                                      last2Digits: row.เลขท้าย_2_ตัว,
                                      front3Digits: row.เลขหน้า_3_ตัว,
                                      last3Digits: row.เลขท้าย_3_ตัว,
                                      source: row.แหล่งข้อมูล,
                                      nextClosing: nextClosing,
                                    },
                                  ]);
                                }}
                                className="text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1 font-semibold transition"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                                เปิดเสียงอ่านงวดนี้
                              </button>

                              <button
                                onClick={() => {
                                  let copyText = `ผล${lotteryTitle} งวด ${row.งวดวันที่}: `;
                                  if (historyPrizeFilter === 'first') {
                                    copyText += `รางวัลที่ 1 = ${row.รางวัลที่_1}`;
                                  } else if (historyPrizeFilter === 'last2') {
                                    copyText += `เลขท้าย 2 ตัว = ${row.เลขท้าย_2_ตัว}`;
                                  } else {
                                    copyText += `รางวัลที่ 1 = ${row.รางวัลที่_1}, เลขท้าย 2 ตัว = ${row.เลขท้าย_2_ตัว}`;
                                    if (hasFront3) copyText += `, เลขหน้า 3 ตัว = ${row.เลขหน้า_3_ตัว!.join(' ')}`;
                                    if (hasLast3) copyText += `, เลขท้าย 3 ตัว = ${row.เลขท้าย_3_ตัว!.join(' ')}`;
                                  }
                                  copyToClipboard(copyText, `row-${idx}`);
                                }}
                                className="text-slate-400 hover:text-slate-200 cursor-pointer flex items-center gap-1 transition"
                              >
                                <Copy className="w-3 h-3" />
                                คัดลอกสรุป
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ==================== TAB: DEPLOYMENT PLAYBOOK & GUIDE ==================== */}
        {activeTab === 'deployment' && (
          <DeploymentPlaybook />
        )}

        {/* ==================== TAB: GOOGLE WORKSPACE (TASKS & KEEP) ==================== */}
        {activeTab === 'workspace' && (
          <GoogleWorkspaceHub latestResult={results[0]} />
        )}

        {/* ==================== TAB: FIREBASE FIRESTORE CLOUD DATABASE ==================== */}
        {activeTab === 'firestore' && (
          <FirebaseSyncCenter latestResult={results[0]} />
        )}

        {/* ==================== TAB: SYSTEM & DEVICES HEALTH MONITOR (NOC & 1-CLICK SELF-HEAL) ==================== */}
        {activeTab === 'monitor' && (
          <SystemMonitorKiosk />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        Lottery Alert System • ระบบแจ้งเตือนผลหวยพร้อมเสียงพูดไทย & ตัวปรับแต่งรูปแบบข้อความตัวหนังสือ
      </footer>

      {/* App Download & APK Modal */}
      <AppDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        appUrl={window.location.origin}
        githubRepo={localStorage.getItem('gh_repo') || 'jirapatza/Bombim00'}
      />
    </div>
  );
}
