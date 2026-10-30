import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Send,
  Zap,
  Volume2,
  Smartphone,
  MessageSquare,
  Bot,
  Database,
  Filter,
  Sliders,
  Layers,
  Sparkles,
  Trophy,
  Activity,
  Play,
  RotateCcw,
  Check,
  Info,
  ListOrdered,
  Eye,
  FileCheck,
  Search,
  Hourglass,
  Calendar,
  TableProperties
} from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';
import { parseLotteryTimelineMinutes } from './LiveUpcomingDraws';

// 6-Step Pipeline Definition
export interface PipelineStep {
  stepNumber: number;
  id: string;
  title: string;
  subtitle: string;
  description: string;
  rules: string[];
  criticality: 'MUST_DO_FIRST' | 'HIGH' | 'CORE' | 'DISPATCH' | 'PERSIST';
  badge: string;
  badgeColor: string;
  icon: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    stepNumber: 1,
    id: 'validation',
    title: 'ขั้นตอนที่ 1: ตรวจสอบความถูกต้องของข้อมูล (Validation & Sanity Check)',
    subtitle: 'อันดับที่ 1 ต้องทำก่อนเสมอ (Must Do First)',
    description: 'ก่อนที่จะประมวลผลใดๆ ระบบต้องตรวจสอบ Format ข้อมูลดิบที่รับมาจาก API หรือ Scraper ว่าครบถ้วนถูกต้อง ป้องกันการแจ้งเตือนด้วยข้อมูลขยะหรือค่า Null',
    rules: [
      'ตรวจเช็คตัวเลขหลัก (รางวัลที่ 1 ต้องมี 6 หลักหรือ 3 หลัก, เลขท้าย 2 ตัวต้องมี 2 หลัก)',
      'กรองค่าว่าง (Empty String), undefined, NaN, หรือข้อความ Error ออกทันที',
      'ตรวจวันที่ของงวด (Draw Date) ว่าเป็นงวดปัจจุบันหรือย้อนหลัง',
      'หากข้อมูลไม่ผ่านการตรวจสอบ ให้ Drop ทิ้งและบันทึก Warning Log โดยไม่ยิงเตือน',
    ],
    criticality: 'MUST_DO_FIRST',
    badge: 'ลำดับ 1 • ทำก่อนเสมอ',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: 'FileCheck',
  },
  {
    stepNumber: 2,
    id: 'deduplication',
    title: 'ขั้นตอนที่ 2: ป้องกันการแจ้งเตือนซ้ำ (Fingerprint Hash Deduplication)',
    subtitle: 'อันดับที่ 2 ห้ามส่งซ้ำ (Anti-Spam Filter)',
    description: 'ป้องกันการยิงแจ้งเตือนซ้ำงวดเดิม โดยนำ (ชื่อหวย + งวดวันที่ + ผลรางวัล) มาเข้ารหัส Fingerprint Hash แล้วเทียบกับฐานข้อมูลประวัติ',
    rules: [
      'คำนวณ Fingerprint Hash: SHA/JSON Hash ของ (ชื่อหวย + วันที่ + เลขบน + เลขล่าง)',
      'ตรวจสอบใน lottery_previous_results.json หากมีค่าตรงกันและส่งสำเร็จแล้ว = SKIP ทันที',
      'ป้องกันการยิงซ้ำรบกวนผู้ใช้ แม้ Cron หรือ Poller จะตรวจทุก 1-5 นาที',
      'ยกเว้นเฉพาะกรณี Force Notify หรือผู้ใช้กดทดสอบด้วยตนเอง',
    ],
    criticality: 'MUST_DO_FIRST',
    badge: 'ลำดับ 2 • กรองผลซ้ำ',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    icon: 'ShieldCheck',
  },
  {
    stepNumber: 3,
    id: 'classification',
    title: 'ขั้นตอนที่ 3: ตรวจสอบเลขเฝ้าระวัง & จัดคิวแจ้งเตือนตามเวลาหวยจริง (Watchlist & Timeline Scheduling)',
    subtitle: 'อันดับที่ 3 ลำดับตามเวลาออกจริง (Chronological Order)',
    description: 'ตรวจสอบผลรางวัลกับเลขเฝ้าระวังที่ผู้ใช้บันทึกไว้ พร้อมจัดคิวส่งแจ้งเตือนเรียงลำดับตามเวลาหวยออกจริง (ตั้งแต่ 08:30 น. จนถึง 04:00 น. ดึก) โดยไม่มีการแบ่งแยกเกรดความสำคัญใดๆ',
    rules: [
      'ตรวจ Custom Watched Numbers: หากเลขออกตรงกับเลขที่ผู้ใช้เฝ้าระวัง ให้ไฮไลท์แจ้งเตือนพิเศษทันที',
      'จัดคิวส่งผลเรียงตามเวลาออกรางวัลจริงของหวยแต่ละประเภทอย่างตรงไปตรงมา',
      'เลือกแม่แบบข้อความ (Message Template) ที่ผู้ใช้เลือกไว้',
      'คำนวณรอบหวยถัดไปที่จะปิดรับ (Next Closing Draw) เพื่อแนบไปในประกาศ',
    ],
    criticality: 'HIGH',
    badge: 'ลำดับ 3 • เรียงตามเวลาหวยจริง',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: 'ListOrdered',
  },
  {
    stepNumber: 4,
    id: 'cooldown',
    title: 'ขั้นตอนที่ 4: ตรวจสอบ Cooldown & Rate Limiting (Throttling Check)',
    subtitle: 'อันดับที่ 4 ควบคุมอัตราการส่ง (Rate Limiting)',
    description: 'ป้องกันการยิง API หรือ Webhook ถี่เกินไปจนติด Rate Limit หรือส่งข้อความรัวเกินไปใน 1 วินาที',
    rules: [
      'ตรวจสอบ Cooldown Minutes (เช่น 15 นาที สำหรับงวดเดิม)',
      'จัดคิวแบบ Sequential Queue หน่วงเวลา 250ms ระหว่างการยิงแต่ละ Channel',
      'หากมีหลายผลออกพร้อมกัน ให้จัดคิวเรียงอ่านเสียงทีละผล ไม่พูดทับซ้อนกัน',
    ],
    criticality: 'CORE',
    badge: 'ลำดับ 4 • คุมอัตราส่ง',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    icon: 'Clock',
  },
  {
    stepNumber: 5,
    id: 'dispatch',
    title: 'ขั้นตอนที่ 5: กระจายแจ้งเตือนตามลำดับช่องทาง (Multi-Channel Dispatch)',
    subtitle: 'อันดับที่ 5 ยิงแจ้งเตือนตามลำดับช่องทาง (Fallback Chain)',
    description: 'ส่งผลการออกรางวัลไปยังช่องทางต่างๆ ตามลำดับ โดยมีกลไกสำรองกรณีช่องทางใดช่องทางหนึ่งล้มเหลว',
    rules: [
      'ช่องทางที่ 1 (ทันที): In-App Pop-up Modal + เสียงอ่านภาษาไทย (Thai Speech Synthesis)',
      'ช่องทางที่ 2 (ด่วนที่สุด): Mobile Push Notification (ntfy.sh iOS/Android แจ้งเตือนสั่น/มีเสียง)',
      'ช่องทางที่ 3 (สำรอง/คอมมูนิตี้): Discord Webhook (Rich Embed Card สีทอง/เขียว)',
      'ช่องทางที่ 4 (สำรอง/กลุ่มแชท): Telegram Bot (HTML Formatted Message พร้อมตัวหนา)',
      'ช่องทางที่ 5 (ระบบเชื่อมต่อภายนอก): External Custom Webhook / HTTP Callback',
    ],
    criticality: 'DISPATCH',
    badge: 'ลำดับ 5 • กระจายข้อความ',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
    icon: 'Send',
  },
  {
    stepNumber: 6,
    id: 'persistence',
    title: 'ขั้นตอนที่ 6: บันทึกประวัติและยืนยันสถานะ (Audit Logging & Status Update)',
    subtitle: 'อันดับที่ 6 บันทึกความสมบูรณ์ (Audit Confirmation)',
    description: 'บันทึกประวัติผลสลาก บันทึกสถานะการส่ง ความเร็วในการตอบสนอง (ms) และอัปเดตจำนวนแจ้งเตือนของวันนี้',
    rules: [
      'บันทึกสถานะ "sent" หรือ "failed" ลงใน lottery_previous_results.json',
      'อัปเดต status.json: บันทึก total_checks, notifications_sent_today, last_source_used',
      'เพิ่มประวัติ Log ใน recent_logs สูงสุด 20 รายการล่าสุด เพื่อการตรวจสอบย้อนหลัง',
      'ส่ง Callback หรือแสดง Toast ยืนยันบนหน้าแดชบอร์ด',
    ],
    criticality: 'PERSIST',
    badge: 'ลำดับ 6 • บันทึก & ตรวจสอบ',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    icon: 'Database',
  },
];

interface NotificationPipelineInspectorProps {
  settings: any;
  latestDraw: any;
  allLotteries: LotteryItem[];
  onTriggerCheck: () => void;
  onSpeak: (text: string) => void;
}

export const NotificationPipelineInspector: React.FC<NotificationPipelineInspectorProps> = ({
  settings,
  latestDraw,
  allLotteries,
  onTriggerCheck,
  onSpeak,
}) => {
  const [activeStepTab, setActiveStepTab] = useState<number>(1);
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState<string>('all');
  const [timelineSearch, setTimelineSearch] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [selectedTestLotteryId, setSelectedTestLotteryId] = useState<string>('');
  const [simulationLogs, setSimulationLogs] = useState<Array<{ step: number; title: string; status: 'ok' | 'warn' | 'pending'; time: string; message: string }>>([]);
  const [simulatedProgress, setSimulatedProgress] = useState<number>(0);

  // Sort ALL lotteries strictly by real timeline order (08:30 morning to 04:00 night)
  const chronoSortedLotteries = useMemo(() => {
    return [...allLotteries].sort((a, b) => {
      return parseLotteryTimelineMinutes(a.drawTimeStr) - parseLotteryTimelineMinutes(b.drawTimeStr);
    });
  }, [allLotteries]);

  // Filtered timeline lotteries
  const filteredTimelineLotteries = useMemo(() => {
    return chronoSortedLotteries.filter((item) => {
      // Category filter
      if (timelineCategoryFilter === 'vip') {
        const isVip = item.category === 'vip' || item.name.includes('VIP') || item.categoryLabel.includes('VIP');
        if (!isVip) return false;
      } else if (timelineCategoryFilter === 'hanoi') {
        const isHanoi = item.category === 'hanoi' || item.name.includes('ฮานอย');
        if (!isHanoi) return false;
      } else if (timelineCategoryFilter === 'lao') {
        const isLao = item.category === 'lao' || item.name.includes('ลาว');
        if (!isLao) return false;
      } else if (timelineCategoryFilter !== 'all' && item.category !== timelineCategoryFilter) {
        return false;
      }

      // Search term
      if (timelineSearch.trim()) {
        const term = timelineSearch.toLowerCase();
        const matchName = item.name.toLowerCase().includes(term);
        const matchTime = item.drawTimeStr.toLowerCase().includes(term);
        const matchCat = item.categoryLabel.toLowerCase().includes(term);
        if (!matchName && !matchTime && !matchCat) return false;
      }

      return true;
    });
  }, [chronoSortedLotteries, timelineCategoryFilter, timelineSearch]);

  const defaultTestLottery = allLotteries.find((item) => item.category !== 'gov_savings') || allLotteries[0];
  const selectedTestLottery = selectedTestLotteryId === 'gov'
    ? null
    : allLotteries.find((item) => item.id === selectedTestLotteryId) || defaultTestLottery;

  // Run full 6-step simulation
  const runFullPipelineSimulation = async () => {
    setIsSimulating(true);
    setSimulationLogs([]);
    setSimulatedProgress(0);

    const isGovernment = selectedTestLotteryId === 'gov' || (!selectedTestLottery && !defaultTestLottery);
    const testLottery = selectedTestLottery
      ? {
          ชื่อหวย: selectedTestLottery.name,
          หวย: selectedTestLottery.id,
          หมวดหวย: selectedTestLottery.category,
          งวดวันที่: selectedTestLottery.date || 'ตัวอย่างสำหรับทดสอบ',
          รางวัลที่_1: selectedTestLottery.category === 'gov_savings'
            ? selectedTestLottery.firstPrize || '-'
            : selectedTestLottery.top3 || selectedTestLottery.firstPrize || '-',
          เลขบน_3_ตัว: selectedTestLottery.top3 || '-',
          เลขท้าย_2_ตัว: selectedTestLottery.bottom2 || '-',
        }
      : latestDraw
        ? { ...latestDraw, หมวดหวย: 'government' }
        : null;

    if (!testLottery) {
      setSimulationLogs([{
        step: 1,
        title: 'Validation & Sanity Check',
        status: 'warn',
        time: new Date().toLocaleTimeString('th-TH'),
        message: 'ไม่มีข้อมูลหวยในแคตตาล็อกหรือผลรัฐบาลล่าสุดให้ทดสอบ',
      }]);
      setIsSimulating(false);
      return;
    }

    const usesGovernmentFormat = isGovernment || ['government', 'gov_savings'].includes(testLottery.หมวดหวย || '');

    const addLog = (step: number, title: string, status: 'ok' | 'warn', message: string) => {
      const time = new Date().toLocaleTimeString('th-TH');
      setSimulationLogs((prev) => [...prev, { step, title, status, time, message }]);
    };

    // Step 1: Validation
    setSimulatedProgress(16);
    await new Promise((r) => setTimeout(r, 450));
    const upperNumber = usesGovernmentFormat
      ? testLottery.รางวัลที่_1
      : testLottery.เลขบน_3_ตัว || testLottery.รางวัลที่_1;
    const hasValidNumbers = Boolean(upperNumber && testLottery.เลขท้าย_2_ตัว && upperNumber !== '-');
    addLog(
      1,
      'Validation & Sanity Check',
      hasValidNumbers ? 'ok' : 'warn',
      hasValidNumbers
        ? usesGovernmentFormat
          ? `[จำลองผ่าน] ${testLottery.ชื่อหวย}: รางวัลที่ 1 (${upperNumber}), 2 ตัวล่าง (${testLottery.เลขท้าย_2_ตัว})`
          : `[จำลองผ่าน] ${testLottery.ชื่อหวย}: 3 ตัวบน (${upperNumber}), 2 ตัวล่าง (${testLottery.เลขท้าย_2_ตัว})`
        : '[เตือน] ไม่พบตัวเลขครบถ้วน'
    );

    // Step 2: Deduplication
    setSimulatedProgress(33);
    await new Promise((r) => setTimeout(r, 450));
    const fingerprint = `${testLottery.ชื่อหวย || 'หวย'}_${testLottery.งวดวันที่}_${upperNumber}`;
    addLog(
      2,
      'Fingerprint Hash Deduplication',
      'ok',
      `[จำลอง] คำนวณ Hash: ${fingerprint.slice(0, 32)}... สำหรับตรวจจับผลซ้ำ`
    );

    // Step 3: Timeline & Watchlist Match
    setSimulatedProgress(50);
    await new Promise((r) => setTimeout(r, 450));
    const watched = settings?.notifications?.custom_watched_numbers || ['84', '289594'];
    const matchedWatched = watched.filter((w: string) =>
      String(upperNumber || '').includes(w) || testLottery.เลขท้าย_2_ตัว === w
    );
    addLog(
      3,
      'Watchlist Match & Timeline Ordering',
      'ok',
      `[จำลอง] เรียงคิว ${testLottery.ชื่อหวย} ตามเวลาที่กำหนด ${
        matchedWatched.length > 0 ? `🎯 ตรงกับเลขเฝ้าระวัง: [${matchedWatched.join(', ')}]!` : '(ไม่มีเลขเฝ้าระวังตรงกับผลตัวอย่าง)'
      }`
    );

    // Step 4: Cooldown
    setSimulatedProgress(66);
    await new Promise((r) => setTimeout(r, 450));
    addLog(
      4,
      'Cooldown & Rate Limiting',
      'ok',
      '[จำลอง] ตรวจเงื่อนไข Cooldown 15 นาที (ไม่ได้ส่งคำขอจริง)'
    );

    // Step 5: Multi-Channel Dispatch
    setSimulatedProgress(83);
    await new Promise((r) => setTimeout(r, 600));
    addLog(
      5,
      'Multi-Channel Dispatch',
      'ok',
      'จำลองเส้นทางการส่ง: In-App Sound -> ntfy -> Discord -> Telegram (ยังไม่ได้ส่งข้อความจริง)'
    );

    // Step 6: Persistence
    setSimulatedProgress(100);
    await new Promise((r) => setTimeout(r, 400));
    addLog(
      6,
      'Persistence & Audit Logging',
      'ok',
      '[จำลอง] แสดงขั้นตอนการบันทึก status และประวัติเท่านั้น ยังไม่ได้เขียนไฟล์จริง'
    );

    setIsSimulating(false);
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: 6-STEP NOTIFICATION PIPELINE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                PIPELINE EXECUTION ORDER
              </span>
              <span className="text-xs text-slate-400">
                เรียงตามลำดับ 1 ถึง 6 อย่างเคร่งครัด
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
              1. ลำดับขั้นตอนการตรวจสอบ &amp; แจ้งเตือน (Notification Architecture Pipeline)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              โครงสร้างกระบวนการส่งข้อความแจ้งเตือน 6 ขั้นตอนตามลำดับความสำคัญ ต้องทำขั้นตอน 1 ให้ผ่านก่อนจึงจะก้าวสู่ขั้นถัดไปได้
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="เลือกรายการหวยสำหรับจำลองการทดสอบ"
              value={selectedTestLotteryId || defaultTestLottery?.id || 'gov'}
              onChange={(event) => setSelectedTestLotteryId(event.target.value)}
              disabled={isSimulating}
              className="max-w-[240px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200"
            >
              {allLotteries.map((item) => (
                <option key={item.id} value={item.id}>{item.flag || '🎯'} {item.name}</option>
              ))}
              <option value="gov">🇹🇭 สลากกินแบ่งรัฐบาล (ผลล่าสุด)</option>
            </select>
            <button
            type="button"
            disabled={isSimulating}
            onClick={runFullPipelineSimulation}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs cursor-pointer shadow-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSimulating ? (
              <>
                <Hourglass className="w-4 h-4 animate-spin text-white" />
                กำลังจำลอง 6 ขั้นตอน...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                ทดสอบรันไปป์ไลน์ครบ 6 ขั้นตอน
              </>
            )}
            </button>
          </div>
        </div>

        {/* 6 Step Cards Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PIPELINE_STEPS.map((step) => {
            const isSelected = activeStepTab === step.stepNumber;
            return (
              <div
                key={step.id}
                onClick={() => setActiveStepTab(step.stepNumber)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-850 border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-black text-slate-500">
                      STEP {step.stepNumber}/6
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${step.badgeColor}`}>
                      {step.badge}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{step.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">{step.description}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-indigo-400 font-semibold">{step.subtitle}</span>
                  <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-1 text-white' : 'text-slate-600'}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Step Drill-Down */}
        {(() => {
          const current = PIPELINE_STEPS.find((s) => s.stepNumber === activeStepTab) || PIPELINE_STEPS[0];
          return (
            <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-mono font-black text-lg">
                    {current.stepNumber}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{current.title}</h4>
                    <span className="text-xs text-indigo-300 font-medium">{current.subtitle}</span>
                  </div>
                </div>

                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${current.badgeColor}`}>
                  {current.badge}
                </span>
              </div>

              <p className="text-xs text-slate-300">{current.description}</p>

              <div>
                <span className="text-xs font-bold text-slate-400 block mb-2">กฎเกณฑ์การประมวลผล (Rules Enforced):</span>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {current.rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        {/* Simulation Execution Logs */}
        {simulationLogs.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                ผลการจำลองการทำงานของไปป์ไลน์แบบ Real-time
              </span>
              <span className="text-xs font-mono text-slate-400">
                ความคืบหน้า: {simulatedProgress}%
              </span>
            </div>

            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${simulatedProgress}%` }}
              ></div>
            </div>

            <div className="space-y-1.5 font-mono text-xs max-h-56 overflow-y-auto">
              {simulationLogs.map((log, index) => (
                <div
                  key={index}
                  className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start justify-between gap-3 text-slate-300"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white">[Step {log.step}] {log.title}:</span>{' '}
                      <span className="text-slate-300">{log.message}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: CHRONOLOGICAL LOTTERY DRAW TIMELINE MATRIX (เรียงตามเวลาหวยออกจริง ครบทุกหวยและตระกูล VIP ทั้งหมด) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                CHRONOLOGICAL TIMELINE MATRIX
              </span>
              <span className="text-xs text-slate-400">
                เรียงตามเวลาหวยออกจริง 08:30 น. ถึง 04:00 น. ดึก
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-400" />
              2. ตารางลำดับเวลาหวยออกจริง (Chronological Lottery Draw Timetable Matrix)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              เรียงตามเวลาที่หวยออกผลจริงอย่างแท้จริง ไม่มีแบ่งเกรดความสำคัญใดๆ ครบถ้วนทุกหวยและตระกูล VIP ทั้งหมด ({allLotteries.length} รายการ)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
              รวมทั้งหมด <strong className="text-amber-400">{allLotteries.length}</strong> รายการ
            </span>
          </div>
        </div>

        {/* Filters Bar: Category Pills & Search */}
        <div className="space-y-3">
          <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setTimelineCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                timelineCategoryFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🌟 ทุกหวย ({chronoSortedLotteries.length})
            </button>

            <button
              type="button"
              onClick={() => setTimelineCategoryFilter('vip')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                timelineCategoryFilter === 'vip'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              👑 หวย VIP &amp; พิเศษ (
              {chronoSortedLotteries.filter((l) => l.category === 'vip' || l.name.includes('VIP') || l.categoryLabel.includes('VIP')).length}
              )
            </button>

            <button
              type="button"
              onClick={() => setTimelineCategoryFilter('hanoi')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                timelineCategoryFilter === 'hanoi'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🇻🇳 ฮานอย ({chronoSortedLotteries.filter((l) => l.category === 'hanoi' || l.name.includes('ฮานอย')).length})
            </button>

            <button
              type="button"
              onClick={() => setTimelineCategoryFilter('lao')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                timelineCategoryFilter === 'lao'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🇱🇦 หวยลาว ({chronoSortedLotteries.filter((l) => l.category === 'lao' || l.name.includes('ลาว')).length})
            </button>

            <button
              type="button"
              onClick={() => setTimelineCategoryFilter('foreign_stock')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                timelineCategoryFilter === 'foreign_stock'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🌏 หุ้นต่างประเทศ ({chronoSortedLotteries.filter((l) => l.category === 'foreign_stock').length})
            </button>

            <button
              type="button"
              onClick={() => setTimelineCategoryFilter('thai_stock')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                timelineCategoryFilter === 'thai_stock'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🇹🇭 หุ้นไทย ({chronoSortedLotteries.filter((l) => l.category === 'thai_stock').length})
            </button>

            <button
              type="button"
              onClick={() => setTimelineCategoryFilter('gov_savings')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                timelineCategoryFilter === 'gov_savings'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🏛️ รัฐบาล &amp; ออมสิน ({chronoSortedLotteries.filter((l) => l.category === 'gov_savings').length})
            </button>
          </div>

          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="ค้นหาชื่อหวย หรือเวลา เช่น 09:25 หรือ VIP..."
              value={timelineSearch}
              onChange={(e) => setTimelineSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Timetable Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTimelineLotteries.map((item, idx) => {
            const isAnnounced = item.status === 'announced';
            const isVip = item.category === 'vip' || item.name.includes('VIP');

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition relative flex flex-col justify-between space-y-2.5 ${
                  isVip
                    ? 'bg-slate-950/90 border-purple-500/30 hover:border-purple-500/60'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top row: Order Queue & Draw Time Badge */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      #{idx + 1}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        ออก {item.drawTimeStr}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        (ปิด {item.closeTimeStr})
                      </span>
                    </div>
                  </div>

                  {/* Lottery Name & Flag */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.flag}</span>
                      <div>
                        <h4 className="text-sm font-bold text-white leading-snug">
                          {item.name}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {item.categoryLabel}
                        </span>
                      </div>
                    </div>

                    {isVip && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        VIP
                      </span>
                    )}
                  </div>
                </div>

                {/* Status / Results Box */}
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs">
                  {isAnnounced ? (
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[9px] text-slate-400 block">3 ตัวบน</span>
                        <span className="font-mono font-black text-amber-300 text-sm">{item.top3 || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block">2 ตัวล่าง</span>
                        <span className="font-mono font-black text-emerald-300 text-sm">{item.bottom2 || '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 font-mono text-xs flex items-center gap-1.5">
                      <Hourglass className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      ⏳ รอผลตามเวลา
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onSpeak(`หวย ${item.name} เวลาออก ${item.drawTimeStr} เวลาปิดรับ ${item.closeTimeStr}`)}
                    title="ฟังเสียงประกาศ"
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: MULTI-CHANNEL DISPATCH FALLBACK ORDER (ลำดับการส่งช่องทาง) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-400" />
            3. ลำดับการส่งกระจายข้อความ (Channel Dispatch Fallback Order)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            ส่งตามลำดับ 1 ถึง 5 หากช่องทางใดเกิด Timeout หรือ Error ระบบจะส่งช่องทางถัดไปต่อเนื่องทันทีโดยไม่หยุดชะงัก
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                1st Priority (ทันที)
              </span>
              <h5 className="font-bold text-sm text-white mt-2">In-App Pop-up &amp; Voice</h5>
              <p className="text-[11px] text-slate-400 mt-1">
                แสดงผลบนหน้าจอแดชบอร์ดทันที พร้อมเปิดเสียงอ่านภาษาไทยแบบ Sequential Queue
              </p>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold mt-3">Latency &lt; 50ms</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                2nd Priority (มือถือ)
              </span>
              <h5 className="font-bold text-sm text-white mt-2">ntfy Mobile Push</h5>
              <p className="text-[11px] text-slate-400 mt-1">
                ส่ง Notification ตรงเข้าโทรศัพท์มือถือ iOS / Android (เปิดแจ้งเตือนสั่น/เสียง)
              </p>
            </div>
            <span className="text-[10px] text-amber-400 font-semibold mt-3">Latency ~ 150ms</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/40 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                3rd Priority (Discord)
              </span>
              <h5 className="font-bold text-sm text-white mt-2">Discord Webhook</h5>
              <p className="text-[11px] text-slate-400 mt-1">
                ส่งการ์ด Rich Embed สีทองหรูหราไปยัง Discord Channel ของกลุ่มหรือเซิร์ฟเวอร์
              </p>
            </div>
            <span className="text-[10px] text-indigo-400 font-semibold mt-3">Latency ~ 250ms</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-blue-500/40 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                4th Priority (Telegram)
              </span>
              <h5 className="font-bold text-sm text-white mt-2">Telegram Bot</h5>
              <p className="text-[11px] text-slate-400 mt-1">
                ส่งข้อความพร้อมเน้นตัวหนา HTML ไปยัง Telegram Chat หรือ Channel
              </p>
            </div>
            <span className="text-[10px] text-blue-400 font-semibold mt-3">Latency ~ 300ms</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-700 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                5th Priority (Custom)
              </span>
              <h5 className="font-bold text-sm text-white mt-2">Custom HTTP Webhook</h5>
              <p className="text-[11px] text-slate-400 mt-1">
                ส่ง HTTP POST JSON ไปยัง Server / ระบบ POS / จอแสดงผลภายนอก
              </p>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold mt-3">Configurable</span>
          </div>
        </div>
      </div>
    </div>
  );
};
