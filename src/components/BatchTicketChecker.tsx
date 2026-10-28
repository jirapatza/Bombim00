import React, { useState } from 'react';
import {
  Ticket,
  Search,
  CheckCircle2,
  XCircle,
  Trophy,
  DollarSign,
  Download,
  Copy,
  Printer,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface BatchProps {
  results: any[];
  latestDraw: any;
}

interface TicketMatch {
  ticketNumber: string;
  isWinner: boolean;
  prizesWon: Array<{ prizeName: string; amount: number }>;
  totalPrize: number;
}

export const BatchTicketChecker: React.FC<BatchProps> = ({ results, latestDraw }) => {
  const [selectedDrawDate, setSelectedDrawDate] = useState<string>(latestDraw?.งวดวันที่ || '16 ตุลาคม 2569');
  const [rawTicketsInput, setRawTicketsInput] = useState<string>(
    '289594\n84\n120984\n012425\n318972\n999999\n555555'
  );
  const [checkedResults, setCheckedResults] = useState<TicketMatch[] | null>(null);
  const [copiedSlip, setCopiedSlip] = useState(false);

  // Find target draw
  const targetDraw = results.find((r) => r.งวดวันที่ === selectedDrawDate) || latestDraw || {};

  const handleCheckBatch = () => {
    const lines = rawTicketsInput
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const matches: TicketMatch[] = [];

    const firstPrize = targetDraw.รางวัลที่_1 || '';
    const last2Prize = targetDraw.เลขท้าย_2_ตัว || '';
    const front3List: string[] = targetDraw.เลขหน้า_3_ตัว || [];
    const rear3List: string[] = targetDraw.เลขท้าย_3_ตัว || [];
    const adjacentList: string[] = targetDraw.รางวัลข้างเคียงรางวัลที่_1 || [];
    const prize2List: string[] = targetDraw.รางวัลที่_2 || [];

    for (const raw of lines) {
      const ticket = raw.padStart(raw.length < 6 ? raw.length : 6, '0');
      const wonList: Array<{ prizeName: string; amount: number }> = [];

      // Check 1st Prize
      if (ticket.length === 6 && ticket === firstPrize) {
        wonList.push({ prizeName: 'รางวัลที่ 1', amount: 6000000 });
      }

      // Check Adjacent
      if (ticket.length === 6 && adjacentList.includes(ticket)) {
        wonList.push({ prizeName: 'รางวัลข้างเคียงรางวัลที่ 1', amount: 100000 });
      }

      // Check 2nd Prize
      if (ticket.length === 6 && prize2List.includes(ticket)) {
        wonList.push({ prizeName: 'รางวัลที่ 2', amount: 200000 });
      }

      // Check Last 2 Digits
      if (ticket.length >= 2) {
        const last2OfTicket = ticket.slice(-2);
        if (last2OfTicket === last2Prize) {
          wonList.push({ prizeName: 'เลขท้าย 2 ตัว', amount: 2000 });
        }
      }

      // Check Front 3 Digits (for 6-digit tickets)
      if (ticket.length === 6) {
        const front3OfTicket = ticket.slice(0, 3);
        if (front3List.includes(front3OfTicket)) {
          wonList.push({ prizeName: 'เลขหน้า 3 ตัว', amount: 4000 });
        }
      }

      // Check Rear 3 Digits
      if (ticket.length >= 3) {
        const rear3OfTicket = ticket.slice(-3);
        if (rear3List.includes(rear3OfTicket)) {
          wonList.push({ prizeName: 'เลขท้าย 3 ตัว', amount: 4000 });
        }
      }

      const totalPrize = wonList.reduce((sum, p) => sum + p.amount, 0);
      matches.push({
        ticketNumber: raw,
        isWinner: wonList.length > 0,
        prizesWon: wonList,
        totalPrize,
      });
    }

    setCheckedResults(matches);
  };

  const totalPrizeAll = checkedResults
    ? checkedResults.reduce((sum, item) => sum + item.totalPrize, 0)
    : 0;

  const totalWinnersCount = checkedResults
    ? checkedResults.filter((item) => item.isWinner).length
    : 0;

  const generateSlipText = () => {
    if (!checkedResults) return '';
    let text = `🧾 ใบบันทึกผลการตรวจสลากกินแบ่งรัฐบาล\nงวดวันที่: ${selectedDrawDate}\n`;
    text += `จำนวนสลากที่ตรวจ: ${checkedResults.length} ใบ\n`;
    text += `ถูกรางวัล: ${totalWinnersCount} ใบ | รวมเงินรางวัล: ${totalPrizeAll.toLocaleString()} บาท\n`;
    text += `----------------------------------------\n`;
    checkedResults.forEach((t, idx) => {
      if (t.isWinner) {
        const prizes = t.prizesWon.map((p) => `${p.prizeName} (${p.amount.toLocaleString()} บ.)`).join(', ');
        text += `${idx + 1}. [เลข ${t.ticketNumber}] 🎉 ถูกรางวัล: ${prizes}\n`;
      } else {
        text += `${idx + 1}. [เลข ${t.ticketNumber}] ❌ ไม่ถูกรางวัล\n`;
      }
    });
    text += `----------------------------------------\n`;
    text += `ระบบ Lottery Alert Pro • เวลาตรวจ: ${new Date().toLocaleString('th-TH')}\n`;
    return text;
  };

  const copySlip = () => {
    const text = generateSlipText();
    navigator.clipboard.writeText(text);
    setCopiedSlip(true);
    setTimeout(() => setCopiedSlip(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-6 h-6 text-amber-400" />
            ระบบตรวจสลากกินแบ่งแบบชุด (Batch Ticket Checker & Prize Calculator)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ตรวจสลากหลายสิบใบพร้อมกันในคลิกเดียว คำนวณสรุปเงินรางวัลรวมทั้งหมดอัตโนมัติ
          </p>
        </div>

        {/* Draw Date Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-semibold">เลือกงวดที่ตรวจ:</label>
          <select
            value={selectedDrawDate}
            onChange={(e) => setSelectedDrawDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-amber-300 font-semibold focus:outline-none"
          >
            {results.map((r) => (
              <option key={r.งวดวันที่} value={r.งวดวันที่}>
                {r.งวดวันที่}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Input Box & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200">
              วางหมายเลขสลาก (1 ใบต่อ 1 บรรทัด หรือคั่นด้วย ,)
            </label>
            <span className="text-[10px] text-slate-500">
              รองรับทั้ง 2, 3, หรือ 6 หลัก
            </span>
          </div>

          <textarea
            rows={8}
            value={rawTicketsInput}
            onChange={(e) => setRawTicketsInput(e.target.value)}
            placeholder="ตัวอย่าง:\n289594\n84\n012425\n318972"
            className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-700 text-sm font-mono text-amber-300 leading-relaxed focus:outline-none focus:border-amber-400 resize-none"
          />

          <button
            type="button"
            onClick={handleCheckBatch}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 cursor-pointer transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            ตรวจรางวัลทั้งหมดทันที
          </button>
        </div>

        {/* Right Column: Result Overview Cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary Banner */}
          {checkedResults ? (
            <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-emerald-950/60 border border-amber-500/40 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
              <div>
                <span className="text-xs uppercase tracking-wider text-amber-400 font-bold block mb-1">
                  สรุปผลการตรวจรางวัลประจำงวด {selectedDrawDate}
                </span>
                <div className="text-3xl sm:text-4xl font-black text-white font-mono flex items-baseline gap-2">
                  <span className="text-emerald-400">{totalPrizeAll.toLocaleString()}</span>
                  <span className="text-sm text-slate-300 font-normal">บาท</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  ถูกรางวัลทั้งหมด{' '}
                  <strong className="text-emerald-300 font-bold">{totalWinnersCount}</strong> จาก{' '}
                  {checkedResults.length} ใบ
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copySlip}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer transition flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedSlip ? 'คัดลอกสลิปแล้ว!' : 'คัดลอกใบสรุป'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-3xl p-10 text-center text-slate-500 space-y-2">
              <Ticket className="w-10 h-10 mx-auto text-slate-600" />
              <div className="text-sm font-semibold text-slate-400">ยังไม่ได้เริ่มตรวจสลาก</div>
              <p className="text-xs max-w-sm mx-auto">
                วางหมายเลขสลากกินแบ่งที่ต้องการตรวจทางซ้ายมือ แล้วกดปุ่ม &quot;ตรวจรางวัลทั้งหมดทันที&quot;
              </p>
            </div>
          )}

          {/* Results Table */}
          {checkedResults && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 overflow-hidden">
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {checkedResults.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 transition ${
                      item.isWinner
                        ? 'bg-emerald-950/30 border-emerald-500/40'
                        : 'bg-slate-950/60 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500 w-5">
                        {idx + 1}.
                      </span>
                      <span
                        className={`text-xl font-mono font-black tracking-wider ${
                          item.isWinner ? 'text-emerald-300' : 'text-slate-300'
                        }`}
                      >
                        {item.ticketNumber}
                      </span>
                      {item.isWinner ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ถูกรางวัล!
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-slate-500" />
                          ไม่ถูกรางวัล
                        </span>
                      )}
                    </div>

                    {/* Prize detail */}
                    <div className="text-right">
                      {item.isWinner ? (
                        <div>
                          <div className="text-xs font-bold text-amber-300">
                            {item.prizesWon.map((p) => p.prizeName).join(', ')}
                          </div>
                          <div className="text-sm font-black font-mono text-emerald-400">
                            +{item.totalPrize.toLocaleString()} บาท
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">- 0 บ. -</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
