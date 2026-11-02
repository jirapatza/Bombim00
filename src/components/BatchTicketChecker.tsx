import React, { useState, useMemo, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import { apiFetch } from '../utils/api';
import { getResultNumbers, formatResultPair } from '../utils/lotteryResult';
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
  RotateCcw,
  Mic,
  MicOff,
  Globe,
  RefreshCw,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react';

interface BatchProps {
  results: any[];
  latestDraw: any;
}

interface TicketMatch {
  ticketNumber: string;
  isWinner: boolean;
  prizesWon: Array<{ prizeName: string }>;
  error?: string;
}

export const BatchTicketChecker: React.FC<BatchProps> = ({ results, latestDraw }) => {
  const [selectedDrawKey, setSelectedDrawKey] = useState<string>('');
  const [rawTicketsInput, setRawTicketsInput] = useState<string>('');
  const [checkedResults, setCheckedResults] = useState<TicketMatch[] | null>(null);
  const [copiedSlip, setCopiedSlip] = useState(false);

  // Audio transcription & Voice input state (gemini-3.5-transcribe)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Search Grounding verification state (gemini-3.8-flash)
  const [isVerifyingGrounding, setIsVerifyingGrounding] = useState(false);
  const [groundingVerifiedText, setGroundingVerifiedText] = useState<string | null>(null);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);

  // Cleanup media recorder on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleStartVoice = async () => {
    setVoiceToast(null);
    audioChunksRef.current = [];
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์ไม่รองรับการบันทึกเสียง');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendVoiceToTranscribe(blob);
      };

      recorder.start();
      setIsRecording(true);
      setVoiceToast('🎙️ กำลังฟังเสียง... พูดเลข 3 ตัวหรือ 2 ตัว เช่น "เจ็ดแปดสอง" หรือ "ห้าสิบเจ็ด"');
    } catch (err: any) {
      setVoiceToast(`❌ ไมโครโฟน: ${err.message || 'ไม่สามารถเปิดไมค์ได้'}`);
      setIsRecording(false);
    }
  };

  const handleStopVoice = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendVoiceToTranscribe = async (blob: Blob) => {
    setIsTranscribing(true);
    setVoiceToast('⏳ กำลังถอดเสียงด้วย Gemini 3.5 Transcribe...');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const res = await apiFetch('/api/ai/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64: base64data, mimeType: 'audio/webm' }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const digits: string[] = (data.detectedDigits || []).map(String).filter((value: string) => /^\d{2,3}$/.test(value));
          const text = data.transcript || '';
          if (digits.length > 0) {
            setCheckedResults(null);
            setRawTicketsInput((prev) => {
              const existing = prev.trim();
              return existing ? `${existing}\n${digits.join('\n')}` : digits.join('\n');
            });
            setVoiceToast(`✅ ถอดเสียงสำเร็จ: "${text}" (เพิ่มเลข: ${digits.join(', ')})`);
          } else {
            setVoiceToast(`ℹ️ ถอดเสียง: "${text}"`);
          }
        } else {
          setVoiceToast(`❌ ${data.error || 'ถอดเสียงล้มเหลว'}`);
        }
        setIsTranscribing(false);
      };
    } catch (err: any) {
      setVoiceToast(`❌ ผิดพลาด: ${err.message}`);
      setIsTranscribing(false);
    }
  };

  const handleVerifyCurrentDrawGrounding = async () => {
    setIsVerifyingGrounding(true);
    try {
      const res = await apiFetch('/api/ai/verify-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotteryName: targetDraw.ชื่อหวย || targetDraw.name || 'หวยที่เลือก',
          drawDate: selectedDrawDate,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGroundingVerifiedText(data.verifiedText);
        setGroundingSources(data.sources || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsVerifyingGrounding(false);
    }
  };

  // Select a specific lottery and draw, rather than mixing all lotteries on one date.
  const uniqueDraws = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ key: string; row: any }> = [];
    for (const row of [...(results || []), ...(latestDraw ? [latestDraw] : [])]) {
      const date = String(row.งวดวันที่ || row.วันที่จัดรูปแบบ || '').trim();
      const name = String(row.ชื่อหวย || row.name || row.หวย || 'หวย').trim();
      if (!date) continue;
      const key = JSON.stringify([name, date, formatResultPair(row)]);
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ key, row });
      }
    }
    return list;
  }, [results, latestDraw]);
  const targetDraw = uniqueDraws.find((draw) => draw.key === selectedDrawKey)?.row || uniqueDraws[0]?.row || {};
  const activeDrawKey = uniqueDraws.find((draw) => draw.row === targetDraw)?.key || '';
  const selectedDrawDate = String(targetDraw.งวดวันที่ || targetDraw.วันที่จัดรูปแบบ || '');
  const selectedLotteryName = String(targetDraw.ชื่อหวย || targetDraw.name || targetDraw.หวย || 'หวย');
  const selectedPair = getResultNumbers(targetDraw);

  useEffect(() => {
    setCheckedResults(null);
    setGroundingVerifiedText(null);
  }, [activeDrawKey]);

  const handleCheckBatch = () => {
    const lines = rawTicketsInput
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const matches: TicketMatch[] = [];

    const { top3, bottom2 } = getResultNumbers(targetDraw);
    for (const ticket of lines) {
      const valid = /^\d{2,3}$/.test(ticket);
      const expected = ticket.length === 3 ? top3 : bottom2;
      const error = !valid
        ? 'กรอกเฉพาะเลข 2 หรือ 3 หลัก'
        : !expected ? `ยังไม่มีผล ${ticket.length === 3 ? '3 ตัวบน' : '2 ตัวล่าง'} สำหรับงวดนี้` : undefined;
      const isWinner = !error && ticket === expected;
      matches.push({
        ticketNumber: ticket,
        isWinner,
        prizesWon: isWinner ? [{ prizeName: ticket.length === 3 ? '3 ตัวบน' : '2 ตัวล่าง' }] : [],
        error,
      });
    }

    setCheckedResults(matches);

    const hasWinners = matches.some((m) => m.isWinner);
    if (hasWinners) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'],
        });
      } catch (err) {
        console.error('Confetti animation error:', err);
      }
    }
  };

  const totalWinnersCount = checkedResults
    ? checkedResults.filter((item) => item.isWinner).length
    : 0;

  const generateSlipText = () => {
    if (!checkedResults) return '';
    let text = `🧾 ผลการตรวจ ${selectedLotteryName}\nงวดวันที่: ${selectedDrawDate}\nผล: ${formatResultPair(targetDraw)}\n`;
    text += `จำนวนเลขที่ตรวจ: ${checkedResults.length} รายการ\n`;
    text += `ตรงผล: ${totalWinnersCount} รายการ\n`;
    text += `----------------------------------------\n`;
    checkedResults.forEach((t, idx) => {
      if (t.isWinner) {
        const prizes = t.prizesWon.map((p) => p.prizeName).join(', ');
        text += `${idx + 1}. [เลข ${t.ticketNumber}] ✅ ตรงผล: ${prizes}\n`;
      } else {
        text += `${idx + 1}. [เลข ${t.ticketNumber}] ${t.error || 'ไม่ตรงผล'}\n`;
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

  const exportSlipExcel = () => {
    if (!checkedResults || checkedResults.length === 0) return;
    try {
      const wb = XLSX.utils.book_new();
      const rows = checkedResults.map((t, idx) => ({
        'ลำดับ': idx + 1,
        'เลขที่ตรวจ': t.ticketNumber,
        'สถานะ': t.error || (t.isWinner ? 'ตรงผล' : 'ไม่ตรงผล'),
        'ประเภทเลข': t.prizesWon.map((p) => p.prizeName).join(', ') || '-',
        'ชื่อหวย': selectedLotteryName,
        'งวดวันที่ตรวจ': selectedDrawDate,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 16 },
        { wch: 16 },
        { wch: 30 },
        { wch: 20 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'ผลการตรวจสลาก');
      XLSX.writeFile(wb, `ticket-check-${selectedDrawDate.replace(/\s+/g, '_')}.xlsx`);
    } catch (err) {
      console.error('Export slip Excel failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-6 h-6 text-amber-400" />
            ตรวจเลข 3 ตัวบน–2 ตัวล่างแบบชุด
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            เปรียบเทียบเลข 2 หรือ 3 หลักกับผลของหวยและงวดที่เลือก
          </p>
        </div>

        {/* Draw Date Selector & Grounding Verification */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleVerifyCurrentDrawGrounding}
            disabled={isVerifyingGrounding || !uniqueDraws.length}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Globe className={`w-3.5 h-3.5 ${isVerifyingGrounding ? 'animate-spin' : 'text-emerald-400'}`} />
            {isVerifyingGrounding ? 'กำลังยืนยันด้วย Google...' : 'ยืนยันผลด้วย Google Search'}
          </button>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-semibold">เลือกหวยและงวด:</label>
            <select
              value={activeDrawKey}
              onChange={(e) => {
                setSelectedDrawKey(e.target.value);
                setCheckedResults(null);
                setGroundingVerifiedText(null);
              }}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-amber-300 font-semibold focus:outline-none"
            >
              {uniqueDraws.map(({ key, row }) => (
                <option key={key} value={key}>
                  {row.ชื่อหวย || row.name || row.หวย || 'หวย'} · {row.งวดวันที่ || row.วันที่จัดรูปแบบ}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grounding Verification Result Box */}
      {groundingVerifiedText && (
        <div className="bg-slate-900/90 border border-emerald-500/40 p-4 rounded-3xl space-y-2 text-xs animate-fade-in shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              ข้อมูลอ้างอิงผล 3 ตัวบน–2 ตัวล่าง
            </span>
            <button
              type="button"
              onClick={() => setGroundingVerifiedText(null)}
              className="text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              ปิด
            </button>
          </div>
          <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{groundingVerifiedText}</p>
          {groundingSources.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
              <span>แหล่งอ้างอิง:</span>
              {groundingSources.slice(0, 3).map((s, i) => (
                <a
                  key={i}
                  href={s.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline flex items-center gap-0.5"
                >
                  {s.title}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input Box & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200">
              กรอกเลข 2 หรือ 3 หลัก (1 รายการต่อบรรทัด)
            </label>

            {/* Voice Input Button */}
            <button
              type="button"
              onClick={isRecording ? handleStopVoice : handleStartVoice}
              disabled={isTranscribing}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40'
              } disabled:opacity-50`}
              title="พูดเลข 2–3 ตัวด้วยเสียงเพื่อถอดความอัตโนมัติ"
            >
              {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isRecording ? 'หยุดพูด' : '🎙️ พูดเลข 2–3 ตัว'}</span>
            </button>
          </div>

          {voiceToast && (
            <div className="text-[11px] p-2.5 rounded-xl bg-slate-950 border border-indigo-500/40 text-indigo-300 animate-fade-in font-medium">
              {voiceToast}
            </div>
          )}

          <textarea
            rows={8}
            value={rawTicketsInput}
            onChange={(e) => { setRawTicketsInput(e.target.value); setCheckedResults(null); }}
            placeholder="ตัวอย่าง:\n782\n57\n007\n09"
            className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-700 text-sm font-mono text-amber-300 leading-relaxed focus:outline-none focus:border-amber-400 resize-none"
          />

          <button
            type="button"
            onClick={handleCheckBatch}
            disabled={!uniqueDraws.length || !rawTicketsInput.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 cursor-pointer transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            ตรวจเลขทั้งหมด
          </button>
        </div>

        {/* Right Column: Result Overview Cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary Banner */}
          {checkedResults ? (
            <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-emerald-950/60 border border-amber-500/40 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
              <div>
                <span className="text-xs uppercase tracking-wider text-amber-400 font-bold block mb-1">
                  ผล {selectedLotteryName} · งวด {selectedDrawDate}
                </span>
                <div className="text-3xl sm:text-4xl font-black text-white font-mono flex items-baseline gap-2">
                  <span className="text-amber-300">{selectedPair.top3 || '---'}</span>
                  <span className="text-sm text-slate-400">-</span>
                  <span className="text-emerald-400">{selectedPair.bottom2 || '--'}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  ตรงผลทั้งหมด{' '}
                  <strong className="text-emerald-300 font-bold">{totalWinnersCount}</strong> จาก{' '}
                  {checkedResults.length} รายการ
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportSlipExcel}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/40 cursor-pointer transition flex items-center gap-1.5"
                  title="ส่งออกใบบันทึกผลตรวจสลากเป็น Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>บันทึกเป็น Excel</span>
                </button>
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
              <div className="text-sm font-semibold text-slate-400">ยังไม่ได้เริ่มตรวจเลข</div>
              <p className="text-xs max-w-sm mx-auto">
                เลือกหวยและงวด แล้วกรอกเลข 2 หรือ 3 หลักทางซ้ายมือ แล้วกดปุ่ม &quot;ตรวจเลขทั้งหมด&quot;
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
                          ตรงผล
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-slate-500" />
                          {item.error || 'ไม่ตรงผล'}
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

                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">{item.error || 'ไม่ตรงเลขที่ประกาศ'}</span>
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
