export interface LotteryCatalogItem {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  period: string;
  periodLabel: string;
  flag: string;
  drawTimeStr: string;
  closeTimeStr: string;
  drawDays: string;
  status: string;
  top3: string;
  bottom2: string;
  firstPrize: string;
  date: string;
  resultDate?: string;
  detectedAt?: string;
  source: string;
}

export interface RawLotteryResult {
  ชื่อหวย?: string;
  หวย?: string;
  หมวดหวย?: string;
  งวดวันที่?: string;
  วันที่จัดรูปแบบ?: string;
  รางวัลที่_1?: string;
  เลขท้าย_2_ตัว?: string;
  เลขบน_3_ตัว?: string;
  เลขล่าง_2_ตัว?: string;
  เลขหน้า_3_ตัว?: string[];
  เลขท้าย_3_ตัว?: string[];
  รางวัลข้างเคียงรางวัลที่_1?: string[];
  แหล่งข้อมูล?: string;
  เวลาที่ตรวจพบ?: string;
  สถานะการแจ้งเตือน?: string;
}

export interface SystemStatusLog {
  timestamp: string;
  level: string;
  message: string;
}

export interface SourceCheck {
  source: string;
  lottery?: string;
  status: number | null;
  reason?: string;
}

export interface SystemStatus {
  system_status: string;
  last_run_timestamp: string;
  last_run_date_thai: string;
  total_checks: number;
  last_source_used: string;
  status_message: string;
  active_sources_count: number;
  latest_draw_detected: string;
  notifications_sent_today: number;
  notification_failures: number;
  active_uncertain_deliveries?: number;
  old_uncertain_deliveries?: number;
  uncertain_deliveries?: number;
  schedule_alert_failures?: number;
  recent_logs: SystemStatusLog[];
  source_checks?: { waiting: SourceCheck[]; errors: SourceCheck[] };
}

export interface NtfyConfig {
  enabled: boolean;
  server: string;
  topic: string;
  priority: string;
  tags: string[];
}

export interface AppSettings {
  app_name: string;
  ntfy: NtfyConfig;
  custom_watched_numbers: string[];
  speech_polite_ending: string;
  speech_rate: number;
}

export interface TicketCheckReport {
  ticketNumber: string;
  isWin: boolean;
  winningLotteryName: string;
  drawDate: string;
  prizeType: string;
  matchedNumber: string;
}

export interface FrequencyStat {
  number: string;
  count: number;
  percentage: number;
  latestLottery: string;
  latestDate: string;
}
