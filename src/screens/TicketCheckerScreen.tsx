import React, { useState } from 'react';
import {
  Ticket,
  CheckCircle,
  Trophy,
  Info,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TicketCheckReport } from '../types/lottery';
import { LotteryRepository } from '../data/lotteryRepository';

interface Props {
  reports: TicketCheckReport[];
  onCheck: (input: string) => void;
  onClear: () => void;
}

export const TicketCheckerScreen: React.FC<Props> = ({
  reports,
  onCheck,
  onClear,
}) => {
  const [inputText, setInputText] = useState('');

  const winCount = reports.filter((r) => r.isWin).length;

  const handleRunCheck = () => {
    if (!inputText.trim()) return;
    onCheck(inputText);

    // If any ticket won, fire celebratory confetti
    setTimeout(() => {
      const generatedReports = LotteryRepository.checkTickets(inputText);
      if (generatedReports.some((r) => r.isWin)) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#F59E0B', '#10B981', '#38BDF8'],
          });
        } catch {
          // ignore
        }
      }
    }, 100);
  };

  const handleClear = () => {
    setInputText('');
    onClear();
  };

  const quickSamples = [
    { sample: '85, 224', label: 'ผลงวดล่าสุด' },
    { sample: '071, 92', label: 'หวยออมสิน' },
    { sample: '612, 21', label: 'หวย ธ.ก.ส.' },
  ];

  return (
    <div className="space-y-4 pb-20">
      {/* Hero Card */}
      <div className="rounded-2xl border border-amber-500/30 bg-slate-900 p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-md">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-100">ตรวจสลากรางวัลอัตโนมัติ</h3>
            <p className="text-xs text-amber-400">รองรับตรวจเลขเดี่ยว และตรวจชุดหลายใบพร้อมกัน</p>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-300">
          กรอกตัวเลขที่ต้องการตรวจ (คั่นด้วยเครื่องหมายจุลภาค เว้นวรรค หรือขึ้นบรรทัดใหม่):
        </p>

        {/* Textarea */}
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          data-testid="ticket_input_field"
          placeholder="ตัวอย่าง: 85, 224, 071, 95, 612"
          className="mt-2 h-28 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />

        {/* Quick Sample Chips */}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {quickSamples.map((q) => (
            <button
              key={q.label}
              onClick={() => setInputText(q.sample)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
            >
              {q.label} ({q.sample})
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleRunCheck}
            disabled={!inputText.trim()}
            data-testid="check_tickets_button"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 shadow-md hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            ตรวจผลรางวัลทันที
          </button>

          {(inputText || reports.length > 0) && (
            <button
              onClick={handleClear}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              ล้างข้อมูล
            </button>
          )}
        </div>
      </div>

      {/* Result Summary Banner */}
      {reports.length > 0 && (
        <div
          className={`rounded-2xl border p-4 transition-all ${
            winCount > 0
              ? 'border-emerald-500/60 bg-emerald-950/30 shadow-lg shadow-emerald-950/30'
              : 'border-slate-800 bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  winCount > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {winCount > 0 ? <Trophy className="h-5 w-5" /> : <Info className="h-5 w-5" />}
              </div>
              <div>
                <h4
                  className={`text-sm font-black ${
                    winCount > 0 ? 'text-emerald-400' : 'text-slate-200'
                  }`}
                >
                  {winCount > 0
                    ? `ยินดีด้วย! ถูกรางวัล ${winCount} รายการ 🎉`
                    : 'ไม่พบตัวเลขที่ถูกรางวัล'}
                </h4>
                <p className="text-xs text-slate-400">ตรวจทั้งหมด {reports.length} หมายเลข</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports List */}
      {reports.length > 0 && (
        <div className="space-y-2.5">
          {reports.map((rep, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3.5 rounded-2xl border bg-slate-900 p-4 transition-all ${
                rep.isWin
                  ? 'border-emerald-500/60 bg-gradient-to-r from-emerald-950/20 to-slate-900 shadow-md'
                  : 'border-slate-800'
              }`}
            >
              {/* Ticket Number Box */}
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-mono-numbers text-lg font-black shadow-inner ${
                  rep.isWin ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {rep.ticketNumber}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h5
                    className={`text-sm font-black ${
                      rep.isWin ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {rep.prizeType}
                  </h5>
                  {rep.isWin && (
                    <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-slate-950">
                      ถูกรางวัล
                    </span>
                  )}
                </div>

                <p className="truncate text-xs text-slate-300 mt-0.5">
                  {rep.winningLotteryName} ({rep.drawDate})
                </p>

                {rep.isWin && (
                  <p className="text-xs font-bold text-amber-400 mt-0.5">
                    หมายเลขรางวัลที่ออก: {rep.matchedNumber}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
