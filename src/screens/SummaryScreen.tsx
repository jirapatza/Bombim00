import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Download,
  X,
  Check,
  Sparkles,
} from 'lucide-react';
import { publishedSummaryResults } from '../data/dashboard';
import { LotteryCatalogItem } from '../types/lottery';
import {
  generateSummaryCanvas,
  downloadCanvasAsImage,
  shareCanvasImage,
  copyText,
} from '../utils/socialShare';

interface Props {
  lotteries: LotteryCatalogItem[];
}

export const SummaryScreen: React.FC<Props> = ({ lotteries }) => {
  const [selectedPeriodTab, setSelectedPeriodTab] = useState('รวมทั้งวัน');
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [copiedTextSuccess, setCopiedTextSuccess] = useState(false);

  const periodOptions = ['รวมทั้งวัน', 'รอบเช้า', 'รอบบ่าย', 'รอบเย็น', 'รอบดึก'];

  const now = new Date();
  const bangkokDateStr = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: 'long', day: 'numeric',
  }).format(now);

  const published = publishedSummaryResults(lotteries, now);
  const period = periodOptions.indexOf(selectedPeriodTab);
  const displayedItems = period > 0
    ? published.filter((item) => item.period === ['morning', 'afternoon', 'evening', 'night'][period - 1])
    : published;

  const handleGenerateImage = async () => {
    setIsGenerating(true);
    try {
      const canvas = await generateSummaryCanvas(
        'สรุปผลหวยประจำวัน',
        bangkokDateStr,
        selectedPeriodTab,
        displayedItems
      );
      setPreviewCanvas(canvas);
      setPreviewDataUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสร้างรูปภาพ');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopySummaryText = async () => {
    const lines = [
      `📢 สรุปผลหวยประจำวัน (${selectedPeriodTab})`,
      `🗓 วันที่ ${bangkokDateStr}\n`,
    ];
    displayedItems.forEach((it) => {
      const top = it.firstPrize ? `รางวัลที่ 1 ${it.firstPrize}` : `3 ตัว ${it.top3}`;
      lines.push(`${it.flag} ${it.name}: ${top} / 2 ตัว ${it.bottom2}`);
    });
    lines.push('\nติดตามผลหวยสดได้ที่ Bombim00: https://bombim00.pages.dev');

    const ok = await copyText(lines.join('\n'));
    setCopyError(!ok);
    setCopiedTextSuccess(ok);
    if (ok) {
      setTimeout(() => setCopiedTextSuccess(false), 2000);
    }
  };

  const handleDownload = () => {
    if (previewCanvas) {
      downloadCanvasAsImage(previewCanvas, `lottery_summary_${selectedPeriodTab}.png`);
    }
  };

  const handleShareDirect = () => {
    if (previewCanvas) {
      shareCanvasImage(previewCanvas, `สรุปผลหวยประจำวัน ${selectedPeriodTab} (${bangkokDateStr})`);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {copyError && <p role="alert">คัดลอกไม่ได้ กรุณาตรวจสิทธิ์คลิปบอร์ด</p>}
      {/* Top Header Card with Summary Metrics */}
      <div className="rounded-2xl border border-amber-500/30 bg-slate-900 p-5 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-100">สรุปผลหวยรายวัน</h3>
            <p className="text-xs font-semibold text-amber-400">ประจำวันที่ {bangkokDateStr}</p>
          </div>
          <span className="rounded-xl bg-amber-500 px-3 py-1 text-xs font-black text-slate-950">
            {displayedItems.length} รายการ
          </span>
        </div>

        {/* Action Buttons: Generate Image Card & Copy Text */}
        <div className="mt-4 flex gap-2.5">
          <button
            onClick={handleGenerateImage}
            disabled={isGenerating || !displayedItems.length}
            data-testid="generate_share_image_button"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating ? 'กำลังสร้างรูปภาพ...' : 'สร้างรูปภาพแชร์'}
          </button>

          <button
            onClick={handleCopySummaryText}
            disabled={!displayedItems.length}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-slate-800/80 py-2.5 text-xs font-bold text-amber-400 hover:bg-slate-800 transition-colors"
          >
            {copiedTextSuccess ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400">คัดลอกแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                คัดลอกข้อความ
              </>
            )}
          </button>
        </div>
      </div>

      {/* Period Tab Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {periodOptions.map((p) => {
          const isSelected = selectedPeriodTab === p;
          return (
            <button
              key={p}
              onClick={() => {
                setSelectedPeriodTab(p);
                setPreviewCanvas(null);
                setPreviewDataUrl(null);
              }}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Summary Table Header */}
      <div className="flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-400 border border-slate-800">
        <div className="flex-1 min-w-0">ชื่อหวย & รอบ</div>
        <div className="w-24 text-center text-amber-400">3 ตัว / รางวัลที่ 1</div>
        <div className="w-24 text-center text-emerald-400">2 ตัวล่าง</div>
      </div>

      {/* Summary Table Rows */}
      <div className="space-y-2">
        {!displayedItems.length && (
          <p className="py-5 text-center text-sm text-slate-400">ยังไม่มีผลที่ประกาศสำหรับช่วงนี้</p>
        )}
        {displayedItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
              <span className="text-xl select-none">{item.flag}</span>
              <div className="truncate">
                <h5 className="truncate text-sm font-bold text-slate-100">{item.name}</h5>
                <p className="text-[11px] text-slate-400">ออก {item.drawTimeStr}</p>
                {item.firstPrize && <p className="text-xs text-amber-300">รางวัลที่ 1 {item.firstPrize}</p>}
              </div>
            </div>
            <div className="w-24 rounded-lg bg-amber-500 px-1 py-1 text-center text-slate-950" aria-label={item.firstPrize ? `รางวัลที่ 1 ${item.firstPrize}` : `3 ตัว ${item.top3 || "—"}`}>
              <span className="block text-[10px] font-semibold">{item.firstPrize ? 'รางวัลที่ 1' : '3 ตัว'}</span>
              <span className={item.firstPrize ? 'block text-xs font-black' : 'block text-sm font-black'}>{item.firstPrize || item.top3 || '—'}</span>
            </div>
            <div className="ml-2 w-24 rounded-lg bg-emerald-500 py-1 text-center text-sm font-black text-slate-950">
              {item.bottom2}
            </div>
          </div>
        ))}
      </div>

      {/* Image Preview & Share Dialog */}
      {previewDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-amber-500 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-bold text-slate-100">ภาพสรุปผลหวย (Social Card)</h4>
              <button
                aria-label="ปิดภาพสรุป"
                onClick={() => {
                  setPreviewCanvas(null);
                  setPreviewDataUrl(null);
                }}
                className="rounded-full p-1 text-slate-400 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable image view */}
            <div className="my-4 max-h-[55vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2 text-center">
              <img
                src={previewDataUrl}
                alt="Social Summary Card"
                className="mx-auto rounded-lg shadow-md max-w-full h-auto"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={handleShareDirect}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:bg-amber-400 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                แชร์รูปภาพทันที
              </button>
              <button
                onClick={handleDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                ดาวน์โหลดรูปภาพ
              </button>
              <button
                aria-label="ปิดภาพสรุป"
                onClick={() => {
                  setPreviewCanvas(null);
                  setPreviewDataUrl(null);
                }}
                className="rounded-xl border border-slate-800 px-4 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
