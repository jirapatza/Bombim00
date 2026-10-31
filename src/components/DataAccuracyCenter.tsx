import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import {
  ShieldCheck,
  Search,
  Mic,
  MicOff,
  ExternalLink,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Radio,
  Clock,
  ArrowRight,
  Hash,
  Copy,
  Check,
  FileCheck2,
  Volume2,
  Sliders,
  ChevronRight,
  Database,
  Zap,
} from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

interface GroundingSource {
  title: string;
  uri: string;
}

interface VerificationResult {
  query: string;
  verifiedText: string;
  sources: GroundingSource[];
  webSearchQueries: string[];
  timestamp: string;
  isFallback?: boolean;
  circuitBreakerActive?: boolean;
  fallbackReason?: string;
  fromCache?: boolean;
  remainingCooldownSec?: number;
}

interface DataAccuracyCenterProps {
  allLotteries?: LotteryItem[];
  latestDraw?: any;
  onApplyTicketCheck?: (numbers: string[]) => void;
  onSelectLottery?: (lottery: LotteryItem) => void;
}

export const DataAccuracyCenter: React.FC<DataAccuracyCenterProps> = ({
  allLotteries = [],
  latestDraw,
  onApplyTicketCheck,
  onSelectLottery,
}) => {
  // Tabs: Grounding Search vs Voice Transcription
  const [activeTab, setActiveTab] = useState<'grounding' | 'voice'>('grounding');

  // Search Grounding state
  const [selectedLottery, setSelectedLottery] = useState<string>('สลากกินแบ่งรัฐบาลไทย');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Audio recording & Transcription state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  const [detectedDigits, setDetectedDigits] = useState<string[]>([]);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  // Clean up media recorder on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 1. Google Search Grounding Verification
  const handleVerifyWithSearch = async (targetLotteryName?: string) => {
    const nameToQuery = targetLotteryName || selectedLottery;
    setIsVerifying(true);
    setVerifyError(null);

    try {
      const res = await apiFetch('/api/ai/verify-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotteryName: nameToQuery,
          query: customQuery.trim() ? customQuery.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'การตรวจสอบด้วย Google Search ล้มเหลว');
      }

      setVerificationResult({
        query: data.query,
        verifiedText: data.verifiedText,
        sources: data.sources || [],
        webSearchQueries: data.webSearchQueries || [],
        timestamp: data.timestamp || new Date().toISOString(),
        isFallback: Boolean(data.isFallback),
        circuitBreakerActive: Boolean(data.circuitBreakerActive),
        fallbackReason: data.fallbackReason,
        fromCache: Boolean(data.fromCache),
        remainingCooldownSec: data.remainingCooldownSec,
      });
    } catch (err: any) {
      setVerifyError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsVerifying(false);
    }
  };

  // 2. Microphone Recording for Audio Transcription
  const startRecording = async () => {
    setTranscribeError(null);
    setTranscriptionText('');
    setDetectedDigits([]);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับการบันทึกเสียงจากไมโครโฟน');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioForTranscription(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setTranscribeError(err.message || 'ไม่สามารถเข้าถึงไมโครโฟนได้');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendAudioForTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    setTranscribeError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        try {
          const res = await apiFetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64data,
              mimeType: 'audio/webm',
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'การถอดความเสียงล้มเหลว');
          }

          setTranscriptionText(data.transcript || 'ถอดความเสียงสำเร็จแต่ไม่พบคำพูดที่ชัดเจน');
          setDetectedDigits(data.detectedDigits || []);
        } catch (postErr: any) {
          setTranscribeError(postErr.message || 'เกิดข้อผิดพลาดในการส่งข้อมูลเสียง');
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (err: any) {
      setTranscribeError(err.message || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์เสียง');
      setIsTranscribing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Philosophy */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-amber-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/25">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  ศูนย์ตรวจสอบความแม่นยำข้อมูลสด &amp; ตรวจสลากด้วยเสียง
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                  AI Grounding &amp; Voice
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                ยกระดับความแม่นยำของผลรางวัล 100% ด้วย <strong>Google Search Grounding (gemini-3.8-flash)</strong> อ้างอิงแหล่งข่าวสดทางการ พร้อมระบบถอดเสียงพูดสลากจากไมโครโฟนด้วย <strong>Audio Transcription (gemini-3.5-transcribe)</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('grounding')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'grounding'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              1. ตรวจสอบข้อมูลสด (Google Search)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('voice')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'voice'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mic className="w-4 h-4" />
              2. พูดตรวจสลากด้วยเสียง (Transcribe)
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GOOGLE SEARCH GROUNDING VERIFICATION                               */}
      {/* ========================================================================= */}
      {activeTab === 'grounding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-lg">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  เลือกรายการหวยที่ต้องการตรวจสอบผลสด
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">gemini-3.8-flash</span>
              </div>

              {/* Quick Select Buttons */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-semibold block">
                  ปุ่มลัดตรวจสอบยอดนิยม:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLottery('สลากกินแบ่งรัฐบาลไทย');
                      handleVerifyWithSearch('สลากกินแบ่งรัฐบาลไทย');
                    }}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-left transition flex items-center justify-between cursor-pointer group"
                  >
                    <span>🇹🇭 รัฐบาลไทย (GLO)</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLottery('หวยฮานอยปกติ และฮานอยพิเศษ');
                      handleVerifyWithSearch('หวยฮานอยปกติ และฮานอยพิเศษ');
                    }}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-left transition flex items-center justify-between cursor-pointer group"
                  >
                    <span>🇻🇳 ฮานอยปกติ / พิเศษ</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLottery('หวยลาวพัฒนา ล่าสุด');
                      handleVerifyWithSearch('หวยลาวพัฒนา ล่าสุด');
                    }}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-left transition flex items-center justify-between cursor-pointer group"
                  >
                    <span>🇱🇦 ลาวพัฒนา</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLottery('หวยหุ้นไทยรอบเย็น และหุ้นต่างประเทศ');
                      handleVerifyWithSearch('หวยหุ้นไทยรอบเย็น และหุ้นต่างประเทศ');
                    }}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-left transition flex items-center justify-between cursor-pointer group"
                  >
                    <span>📈 หวยหุ้นไทย / นอก</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
                  </button>
                </div>
              </div>

              {/* Custom Search Form */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    ชื่อหวยหรือรายการที่ต้องการตรวจสอบ
                  </label>
                  <select
                    value={selectedLottery}
                    onChange={(e) => setSelectedLottery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    <option value="สลากกินแบ่งรัฐบาลไทย">🇹🇭 สลากกินแบ่งรัฐบาลไทย (งวด 1 และ 16)</option>
                    <option value="หวยออมสิน และ หวย ธ.ก.ส.">🏦 หวยออมสิน &amp; หวย ธ.ก.ส.</option>
                    <option value="หวยฮานอยปกติ ฮานอยพิเศษ และ ฮานอย VIP">🇻🇳 ฮานอยปกติ / พิเศษ / VIP</option>
                    <option value="หวยลาวพัฒนา ลาวสามัคคี และ ลาวสตาร์">🇱🇦 ลาวพัฒนา / สามัคคี / สตาร์</option>
                    <option value="หวยหุ้นนิเคอิเช้า-บ่าย และ หวยหุ้นฮั่งเส็ง">🇯🇵 หุ้นนิเคอิ &amp; ฮ่องกงฮั่งเส็ง</option>
                    <option value="หวยหุ้นดาวโจนส์ และ หุ้นจีน">🇺🇸 ดาวโจนส์ &amp; หุ้นจีน</option>
                    {allLotteries.map((l) => (
                      <option key={l.id} value={`${l.name} (${l.categoryLabel})`}>
                        {l.flag} {l.name} ({l.drawTimeStr})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    คำสั่งค้นหาเจาะจงเพิ่มเติม (Optional Query)
                  </label>
                  <input
                    type="text"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    placeholder="เช่น งวดวันที่ 16 ตุลาคม 2569 หรือ รางวัลข้างเคียง"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleVerifyWithSearch()}
                  disabled={isVerifying}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Search className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
                  {isVerifying ? 'กำลังค้นหาและตรวจสอบจาก Google Search...' : '🔍 ตรวจสอบความถูกต้องจาก Google Search ทันที'}
                </button>
              </div>

              {verifyError && (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                  <span>{verifyError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Results Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-lg min-h-[460px] flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">
                      ผลการตรวจสอบสด (Search Grounded Verification Output)
                    </h3>
                  </div>
                  {verificationResult && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      ตรวจสอบเมื่อ: {new Date(verificationResult.timestamp).toLocaleTimeString('th-TH')}
                    </span>
                  )}
                </div>

                {isVerifying ? (
                  <div className="py-24 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto animate-spin">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-white">กำลังส่งคำถามค้นหาไปยัง Google Search...</div>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      โมเดล Gemini 3.8 Flash กำลังอ่านผลการออกรางวัลจากแหล่งข้อมูลทางการและเว็บข่าวเพื่อยืนยันความถูกต้อง
                    </p>
                  </div>
                ) : verificationResult ? (
                  <div className="space-y-4 pt-3">
                    {/* Crash Shield / Circuit Breaker Banner when active */}
                    {(verificationResult.circuitBreakerActive || verificationResult.isFallback) && (
                      <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-2 shadow-lg">
                        <div className="flex items-center justify-between font-bold text-amber-300">
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-amber-400" />
                            🛡️ ระบบป้องกันระบบล่มทำงาน (Circuit Breaker &amp; Safe Fallback)
                          </span>
                          {verificationResult.remainingCooldownSec !== undefined && verificationResult.remainingCooldownSec > 0 && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[10px] font-mono border border-amber-500/30">
                              คูลดาวน์ป้องกัน: {verificationResult.remainingCooldownSec}s
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          {verificationResult.fallbackReason || 'ระบบตรวจพบขีดจำกัดโควตา API หรืออัตราการเชื่อมต่อหนาแน่น จึงเปิดระบบความปลอดภัยอัตโนมัติ โดยนำข้อมูลจริงที่ยืนยันแล้วในแคชระบบมาแสดงผลแทน เพื่อให้ระบบพร้อมใช้งานต่อเนื่อง 100% ไม่สะดุด'}
                        </p>
                      </div>
                    )}

                    {/* High-speed cache badge */}
                    {verificationResult.fromCache && (
                      <div className="px-3 py-1.5 rounded-xl bg-teal-950/40 border border-teal-500/40 text-teal-300 text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                          <Zap className="w-3.5 h-3.5 text-teal-400" />
                          ⚡ โหลดผลลัพธ์ด่วนจาก High-Speed Memory Cache (ช่วยประหยัดโควตาและแสดงผลทันที)
                        </span>
                      </div>
                    )}

                    {/* Verified Content Card */}
                    <div className={`rounded-2xl p-5 shadow-inner space-y-3 ${
                      verificationResult.circuitBreakerActive || verificationResult.isFallback
                        ? 'bg-slate-950/90 border border-amber-500/30'
                        : 'bg-slate-950/80 border border-emerald-500/30'
                    }`}>
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                        <span className={`font-bold flex items-center gap-1.5 ${
                          verificationResult.circuitBreakerActive || verificationResult.isFallback
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}>
                          {verificationResult.circuitBreakerActive || verificationResult.isFallback ? (
                            <>
                              <ShieldCheck className="w-4 h-4 text-amber-400" />
                              ข้อมูลที่บันทึกไว้ในระบบ (Safe Fallback Record)
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ข้อมูลยืนยันสดจาก Google Search Grounding
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(verificationResult.verifiedText, 'verified')}
                          className="text-slate-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1"
                        >
                          {copiedKey === 'verified' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey === 'verified' ? 'คัดลอกแล้ว' : 'คัดลอกผล'}
                        </button>
                      </div>

                      <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                        {verificationResult.verifiedText}
                      </div>
                    </div>

                    {/* Grounding Sources / Citations */}
                    {verificationResult.sources.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                          แหล่งข้อมูลอ้างอิงจากอินเทอร์เน็ต (Grounded Web Sources):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {verificationResult.sources.map((src, i) => (
                            <a
                              key={i}
                              href={src.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-xs text-slate-300 hover:text-white transition flex items-center justify-between group"
                            >
                              <span className="truncate pr-2 font-medium">{src.title}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search queries used */}
                    {verificationResult.webSearchQueries && verificationResult.webSearchQueries.length > 0 && (
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 pt-1">
                        <span>คำค้นที่ใช้:</span>
                        {verificationResult.webSearchQueries.map((q, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-slate-400">
                            {q}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-24 text-center space-y-2 text-slate-500">
                    <Search className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                    <div className="text-sm font-semibold text-slate-400">ยังไม่มีการเรียกตรวจสอบข้อมูลสด</div>
                    <p className="text-xs max-w-sm mx-auto">
                      กดปุ่มตรวจสอบด้านซ้ายเพื่อดึงและเปรียบเทียบผลรางวัลจริงจาก Google Search
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                <span>ระบบ Search Grounding ทำงานผ่านเซิร์ฟเวอร์แบบเรียลไทม์</span>
                <span>Powered by Gemini 3.8 Flash</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AUDIO TRANSCRIPTION STUDIO (gemini-3.5-transcribe)               */}
      {/* ========================================================================= */}
      {activeTab === 'voice' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recorder Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-lg text-center">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between text-left">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Mic className="w-4 h-4 text-indigo-400" />
                  บันทึกเสียงพูดเพื่อตรวจสลาก
                </span>
                <span className="text-[10px] text-indigo-400 font-mono">gemini-3.5-transcribe</span>
              </div>

              {/* Big Mic Button */}
              <div className="py-6 flex flex-col items-center justify-center space-y-4">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                  className={`w-28 h-28 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all shadow-2xl relative ${
                    isRecording
                      ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-rose-600/40 ring-4 ring-rose-500/30'
                      : 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-500 hover:scale-105 text-white shadow-indigo-600/30'
                  } disabled:opacity-50`}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-10 h-10 mb-1" />
                      <span className="text-[10px] font-black tracking-wider uppercase">กดหยุด</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-10 h-10 mb-1" />
                      <span className="text-[10px] font-black tracking-wider uppercase">กดเพื่อพูด</span>
                    </>
                  )}
                </button>

                {isRecording && (
                  <div className="flex items-center gap-2 text-rose-400 font-mono font-bold text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                    <span>กำลังบันทึกเสียง... 00:{String(recordingSeconds).padStart(2, '0')}</span>
                  </div>
                )}

                <div className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  {isRecording
                    ? 'พูดหมายเลขสลาก เช่น "ตรวจรางวัลสองแปดเก้าห้าเก้าสี่" หรือ "เลขแปดสี่"'
                    : 'แตะปุ่มไมโครโฟนด้านบนเพื่อเริ่มพูดเลขสลาก หรือค้นหาผลรางวัลด้วยเสียง'}
                </div>
              </div>

              {transcribeError && (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs text-left flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                  <span>{transcribeError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Transcription Results (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-lg min-h-[460px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-bold text-sm text-white">
                      ผลการถอดความเสียง (Audio Transcription Results)
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                    Speech to Text
                  </span>
                </div>

                {isTranscribing ? (
                  <div className="py-24 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center mx-auto animate-spin">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-white">กำลังประมวลผลและถอดความเสียง...</div>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      โมเดล Gemini 3.5 Transcribe กำลังแปลงเสียงพูดเป็นข้อความภาษาไทยและสกัดตัวเลขสลาก
                    </p>
                  </div>
                ) : transcriptionText ? (
                  <div className="space-y-4 pt-3">
                    {/* Full Transcription Card */}
                    <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                        <span className="font-bold text-indigo-400">ข้อความที่ถอดได้ (Transcript):</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(transcriptionText, 'transcript')}
                          className="text-slate-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1"
                        >
                          {copiedKey === 'transcript' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey === 'transcript' ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </button>
                      </div>
                      <p className="text-sm font-medium text-slate-100 leading-relaxed">
                        &quot;{transcriptionText}&quot;
                      </p>
                    </div>

                    {/* Detected Digits & Direct Check Buttons */}
                    {detectedDigits.length > 0 && (
                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Hash className="w-4 h-4 text-amber-400" />
                          ตรวจพบตัวเลขสลากจากเสียงพูด:
                        </span>

                        <div className="flex flex-wrap gap-2.5">
                          {detectedDigits.map((num, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-900 border border-amber-500/40 rounded-xl px-4 py-2 flex items-center gap-3 shadow-md"
                            >
                              <span className="font-mono text-xl font-black text-amber-300 tracking-wider">
                                {num}
                              </span>
                              {onApplyTicketCheck && (
                                <button
                                  type="button"
                                  onClick={() => onApplyTicketCheck([num])}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  ตรวจเลขนี้
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {onApplyTicketCheck && (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => onApplyTicketCheck(detectedDigits)}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              ส่งตัวเลขทั้งหมดเข้า Batch Ticket Checker ทันที
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-24 text-center space-y-2 text-slate-500">
                    <Mic className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                    <div className="text-sm font-semibold text-slate-400">ยังไม่มีเสียงที่ถูกบันทึก</div>
                    <p className="text-xs max-w-sm mx-auto">
                      แตะปุ่มไมโครโฟนด้านซ้ายเพื่อทดสอบพูดหมายเลขสลาก
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                <span>บันทึกเสียงและถอดความแบบไร้รอยต่อ</span>
                <span>Powered by Gemini 3.5 Transcribe</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
