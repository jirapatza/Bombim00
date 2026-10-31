import React, { useState, useMemo, useRef, useEffect } from 'react';
import { apiFetch } from '../utils/api';
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
      setVoiceToast('🎙️ กำลังฟังเสียง... พูดหมายเลขสลาก เช่น "289594" หรือ "แปดสี่"');
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
          const digits: string[] = data.detectedDigits || [];
          const text = data.transcript || '';
          if (digits.length > 0) {
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
          lotteryName: 'สลากกินแบ่งรัฐบาลไทย',
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

  // Deduplicate available draw dates to prevent duplicate key errors in React
  const uniqueDrawDates = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    if (latestDraw?.งวดวันที่) {
      const d = String(latestDraw.งวดวันที่).trim();
      if (d) {
        seen.add(d);
        list.push(d);
      }
    }
    (results || []).forEach((r) => {
      const d = String(r.งวดวันที่ || '').trim();
      if (d && !seen.has(d)) {
        seen.add(d);
        list.push(d);
      }
    });
    return list;
  }, [results, latestDraw]);

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

        {/* Draw Date Selector & Grounding Verification */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleVerifyCurrentDrawGrounding}
            disabled={isVerifyingGrounding}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Globe className={`w-3.5 h-3.5 ${isVerifyingGrounding ? 'animate-spin' : 'text-emerald-400'}`} />
            {isVerifyingGrounding ? 'กำลังยืนยันด้วย Google...' : 'ยืนยันผลด้วย Google Search'}
          </button>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-semibold">เลือกงวดที่ตรวจ:</label>
            <select
              value={selectedDrawDate}
              onChange={(e) => setSelectedDrawDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-amber-300 font-semibold focus:outline-none"
            >
              {uniqueDrawDates.map((date, idx) => (
                <option key={`draw-date-${date}-${idx}`} value={date}>
                  {date}
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
              ผลสลากยืนยันสดจาก Google Search Grounding (gemini-3.8-flash)
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
              วางหมายเลขสลาก (1 ใบต่อ 1 บรรทัด)
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
              title="พูดเลขสลากด้วยเสียงเพื่อถอดความอัตโนมัติ"
            >
              {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isRecording ? 'หยุดพูด' : '🎙️ พูดเลขสลาก'}</span>
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
