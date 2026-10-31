import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  Sparkles,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Eye,
  Calendar,
  Send,
  Smartphone,
} from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

interface SummaryImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  dateStr: string;
  lotteries: LotteryItem[];
  periodLabel?: string;
  autoShare?: boolean;
}

export const SummaryImageModal: React.FC<SummaryImageModalProps> = ({
  isOpen,
  onClose,
  title,
  dateStr,
  lotteries,
  periodLabel,
  autoShare = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const hasAutoSharedRef = useRef(false);

  // Filter only announced or valid lotteries to present in summary image
  const displayLotteries = lotteries.filter(
    (l) => l.status === 'announced' || (l.top3 && l.bottom2)
  );

  // Fallback to all if none announced yet
  const targetLotteries = displayLotteries.length > 0 ? displayLotteries : lotteries.slice(0, 15);

  // Generate plain text according to user format
  const generateSummaryText = useCallback(() => {
    let headerEmoji = '☀️';
    if (periodLabel?.includes('บ่าย')) headerEmoji = '🌤️';
    else if (periodLabel?.includes('เย็น')) headerEmoji = '🌆';
    else if (periodLabel?.includes('ดึก')) headerEmoji = '🌙';
    else if (periodLabel?.includes('วัน')) headerEmoji = '📋';

    let text = `${headerEmoji} ${title} (${dateStr})\n`;
    text += `📋 ทั้งหมด ${targetLotteries.length} รายการ\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    targetLotteries.forEach((l, index) => {
      const top3 = l.top3 || '---';
      const bot2 = l.bottom2 || '--';
      text += `${index + 1}. ${l.flag} ${l.name} ${l.flag}\n`;
      text += ` 👉 3 บน: ${top3} • 2 ล่าง: ${bot2}\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📢 อัปเดตเรียลไทม์ผ่าน Lottery Alert Pro\n`;
    text += `#ผลหวย #หวยหุ้น #หวยฮานอย #หวยลาว`;
    return text;
  }, [periodLabel, title, dateStr, targetLotteries]);

  // Download high-resolution PNG file
  const handleDownload = useCallback(() => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    const safeDate = dateStr.replace(/[\/\s]/g, '-');
    a.download = `lottery-summary-${safeDate}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShareStatus('บันทึกรูปภาพ (.PNG) เรียบร้อยแล้ว! 📥');
    setTimeout(() => setShareStatus(null), 3500);
  }, [imageUrl, dateStr]);

  // Comprehensive Web Share API + Capacitor Native Share
  const handleShareImage = useCallback(async () => {
    if (!canvasRef.current && !imageUrl) return;
    setIsSharing(true);
    setShareStatus('กำลังเตรียมข้อมูลรูปภาพสำหรับแชร์...');

    const safeDate = dateStr.replace(/[\/\s]/g, '-');
    const fileName = `lottery-summary-${safeDate}.png`;
    const shareText = generateSummaryText();
    const shareTitle = `${title} (${dateStr})`;

    try {
      // 1. Check if running on native Capacitor Android/iOS platform
      if (Capacitor.isNativePlatform()) {
        const base64Data = (imageUrl || canvasRef.current?.toDataURL('image/png') || '').replace(
          /^data:image\/png;base64,/,
          ''
        );

        if (base64Data) {
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });

          await Share.share({
            title: shareTitle,
            text: shareText,
            url: savedFile.uri,
            dialogTitle: 'แชร์รูปการสรุปผลหวยไปยังโซเชียลมีเดีย',
          });

          setShareStatus('แชร์รูปภาพผ่านแอปพลิเคชันสำเร็จแล้ว! 🎉');
          setIsSharing(false);
          setTimeout(() => setShareStatus(null), 3500);
          return;
        }
      }

      // 2. Web Share API (Level 2 with Files support)
      if (canvasRef.current) {
        canvasRef.current.toBlob(async (blob) => {
          if (!blob) {
            handleDownload();
            setIsSharing(false);
            return;
          }

          const file = new File([blob], fileName, { type: 'image/png' });

          // Verify if browser supports file sharing via Web Share API
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: shareTitle,
                text: shareText,
              });
              setShareStatus('แชร์รูปภาพไปยังโซเชียลมีเดียสำเร็จแล้ว! 🎉');
            } catch (shareErr: any) {
              if (shareErr.name === 'AbortError') {
                setShareStatus('ยกเลิกการแชร์');
              } else {
                console.warn('Web Share failed, fallback to copy/download:', shareErr);
                handleDownload();
              }
            }
          } else if (navigator.share) {
            // Browser supports Web Share for text/url, but not file attachments directly
            try {
              await navigator.share({
                title: shareTitle,
                text: shareText,
              });
              handleDownload();
              setShareStatus('แชร์ข้อความและบันทึกรูปภาพเรียบร้อยแล้ว! 📥');
            } catch (err: any) {
              if (err.name !== 'AbortError') handleDownload();
            }
          } else {
            // Browser doesn't support Web Share API: Copy image & download
            if (navigator.clipboard?.write) {
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({ 'image/png': blob }),
                ]);
                setCopiedImage(true);
                setTimeout(() => setCopiedImage(false), 2500);
              } catch {
                // ignore
              }
            }
            handleDownload();
            setShareStatus('เบราว์เซอร์ไม่รองรับ Web Share API โดยตรง ระบบได้ดาวน์โหลดรูปภาพและคัดลอกให้แล้ว! 📥');
          }

          setIsSharing(false);
          setTimeout(() => setShareStatus(null), 4000);
        }, 'image/png');
      } else {
        handleDownload();
        setIsSharing(false);
      }
    } catch (err: any) {
      console.error('Share error:', err);
      handleDownload();
      setIsSharing(false);
    }
  }, [dateStr, generateSummaryText, handleDownload, imageUrl, title]);

  // Render Canvas high-res image card
  useEffect(() => {
    if (!isOpen) {
      hasAutoSharedRef.current = false;
      return;
    }
    setIsRendering(true);

    const renderCard = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = 2; // 2x Retina for crisp text
      const width = 800;
      const rowHeight = 72;
      const headerHeight = 220;
      const footerHeight = 140;
      const totalHeight = headerHeight + Math.max(1, targetLotteries.length) * rowHeight + footerHeight;

      canvas.width = width * scale;
      canvas.height = totalHeight * scale;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${totalHeight}px`;

      ctx.scale(scale, scale);

      // Background - Deep Luxury Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, totalHeight);
      bgGrad.addColorStop(0, '#0f172a'); // slate-900
      bgGrad.addColorStop(0.3, '#111827'); // gray-900
      bgGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, totalHeight);

      // Decorative top border bar with amber gold gradient
      const topGold = ctx.createLinearGradient(0, 0, width, 0);
      topGold.addColorStop(0, '#f59e0b');
      topGold.addColorStop(0.5, '#fbbf24');
      topGold.addColorStop(1, '#d97706');
      ctx.fillStyle = topGold;
      ctx.fillRect(0, 0, width, 8);

      // Outer Card Frame
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(16, 16, width - 32, totalHeight - 32);

      // Subtle Corner Accents
      const drawCorner = (x: number, y: number, dx: number, dy: number) => {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + dy * 20);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * 20, y);
        ctx.stroke();
      };
      drawCorner(24, 24, 1, 1);
      drawCorner(width - 24, 24, -1, 1);
      drawCorner(24, totalHeight - 24, 1, -1);
      drawCorner(width - 24, totalHeight - 24, -1, -1);

      // HEADER SECTION
      // Badge / Tag
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1;
      const tagText = 'LOTTERY ALERT PRO • REALTIME RESULT';
      ctx.font = '600 13px system-ui, -apple-system, sans-serif';
      const tagWidth = ctx.measureText(tagText).width + 24;
      const tagX = (width - tagWidth) / 2;
      ctx.beginPath();
      ctx.roundRect(tagX, 36, tagWidth, 26, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde68a';
      ctx.fillText(tagText, tagX + 12, 53);

      // Main Title
      let emoji = '☀️';
      if (periodLabel?.includes('บ่าย')) emoji = '🌤️';
      else if (periodLabel?.includes('เย็น')) emoji = '🌆';
      else if (periodLabel?.includes('ดึก')) emoji = '🌙';
      else if (periodLabel?.includes('วัน')) emoji = '📋';

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${emoji} ${title}`, width / 2, 102);

      // Date subtitle
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(`(งวดวันที่ ${dateStr})`, width / 2, 136);

      // Total items count
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(`📋 รายงานสรุปทั้งหมด ${targetLotteries.length} รายการ`, width / 2, 168);

      // Divider line
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(40, 192);
      ctx.lineTo(width - 40, 192);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // LOTTERY ROWS
      ctx.textAlign = 'left';
      let currentY = headerHeight;

      if (targetLotteries.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ยังไม่มีข้อมูลผลหวยที่ออกรางวัลในรอบนี้', width / 2, currentY + 40);
      } else {
        targetLotteries.forEach((l, index) => {
          // Row background hover/zebra effect
          if (index % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.fillRect(40, currentY - 6, width - 80, rowHeight - 8);
          }

          // Row Index
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${index + 1}.`, 75, currentY + 36);

          // Flag and Lottery Name
          ctx.textAlign = 'left';
          ctx.font = '22px system-ui, -apple-system, sans-serif';
          ctx.fillText(l.flag || '🎯', 88, currentY + 37);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
          const nameToDraw = l.name.length > 20 ? l.name.slice(0, 19) + '…' : l.name;
          ctx.fillText(nameToDraw, 126, currentY + 36);

          // Top 3 Box
          const top3 = l.top3 || '---';
          const top3BoxX = width - 340;
          ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(top3BoxX, currentY + 12, 135, 38, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fbbf24';
          ctx.font = '600 12px system-ui, -apple-system, sans-serif';
          ctx.fillText('3 บน', top3BoxX + 10, currentY + 36);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px monospace';
          ctx.fillText(top3, top3BoxX + 60, currentY + 38);

          // Bottom 2 Box
          const bot2 = l.bottom2 || '--';
          const bot2BoxX = width - 185;
          ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(bot2BoxX, currentY + 12, 130, 38, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#34d399';
          ctx.font = '600 12px system-ui, -apple-system, sans-serif';
          ctx.fillText('2 ล่าง', bot2BoxX + 10, currentY + 36);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px monospace';
          ctx.fillText(bot2, bot2BoxX + 65, currentY + 38);

          currentY += rowHeight;
        });
      }

      // FOOTER SECTION
      const footerY = totalHeight - footerHeight + 20;

      // Divider line
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(40, footerY);
      ctx.lineTo(width - 40, footerY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.font = '600 15px system-ui, -apple-system, sans-serif';
      ctx.fillText('📢 อัปเดตเรียลไทม์ผ่าน Lottery Alert Pro', width / 2, footerY + 36);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 13px system-ui, -apple-system, sans-serif';
      ctx.fillText('#ผลหวย #หวยหุ้น #หวยฮานอย #หวยลาว #ตรวจสลาก', width / 2, footerY + 64);

      ctx.fillStyle = '#475569';
      ctx.font = '400 11px system-ui, -apple-system, sans-serif';
      const timeNow = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      ctx.fillText(`สร้างเมื่อ: ${dateStr} เวลา ${timeNow} น.`, width / 2, footerY + 88);

      // Convert to Data URL
      try {
        const url = canvas.toDataURL('image/png');
        setImageUrl(url);

        // If autoShare was requested (e.g. from direct "แชร์รูป" button click)
        if (autoShare && !hasAutoSharedRef.current) {
          hasAutoSharedRef.current = true;
          setTimeout(() => {
            handleShareImage();
          }, 200);
        }
      } catch (err) {
        console.error('Canvas export error:', err);
      } finally {
        setIsRendering(false);
      }
    };

    // Slight delay to ensure fonts/DOM ready
    const timer = setTimeout(renderCard, 80);
    return () => clearTimeout(timer);
  }, [isOpen, title, dateStr, lotteries, periodLabel, autoShare, handleShareImage]);

  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopiedImage(true);
          setShareStatus('คัดลอกรูปภาพลงคลิปบอร์ดแล้ว (วางในแชตได้ทันที) 📋');
          setTimeout(() => {
            setCopiedImage(false);
            setShareStatus(null);
          }, 3000);
        } else {
          handleDownload();
        }
      });
    } catch {
      handleDownload();
    }
  };

  const handleCopyText = async () => {
    const text = generateSummaryText();
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
      setCopiedText(true);
      setShareStatus('คัดลอกข้อความสรุปแล้ว! 📋');
      setTimeout(() => {
        setCopiedText(false);
        setShareStatus(null);
      }, 2500);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 animate-fadeIn modal-overlay overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>รูปการสรุปผลหวย</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {periodLabel || 'สรุปภาพรวม'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                รองรับ Web Share API แชร์รูปภาพไปยัง LINE, Facebook, หรือแอปโซเชียลมีเดียได้ทันที
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-5 py-3 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>งวดวันที่: <strong className="text-amber-300">{dateStr}</strong></span>
            <span className="text-slate-600">·</span>
            <span>{targetLotteries.length} รายการ</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="คัดลอกข้อความสรุปสำหรับส่งในแชต"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">คัดลอกข้อความแล้ว</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>คัดลอกข้อความ</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyImage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="คัดลอกรูปภาพลงคลิปบอร์ด"
            >
              {copiedImage ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">คัดลอกรูปแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>คัดลอกรูปภาพ</span>
                </>
              )}
            </button>

            {/* Direct Web Share API Button */}
            <button
              onClick={handleShareImage}
              disabled={isSharing || isRendering}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
              title="กดเพื่อแชร์รูปภาพไปยัง LINE, Facebook หรือโซเชียลมีเดียด้วย Web Share API"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isSharing ? 'กำลังแชร์...' : 'แชร์รูปภาพ (Web Share)'}</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={isRendering}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm disabled:opacity-50"
              title="บันทึกรูปภาพ PNG ลงเครื่อง"
            >
              <Download className="w-3.5 h-3.5" />
              <span>บันทึก PNG</span>
            </button>
          </div>
        </div>

        {/* Share Status Banner */}
        {shareStatus && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border-b border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{shareStatus}</span>
            </div>
            <button
              onClick={() => setShareStatus(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Scrollable Body - Canvas Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-950">
          {/* Hidden Canvas for High-Res Generation */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Rendered Preview Image */}
          {isRendering ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
              <p className="text-sm">กำลังสร้างรูปภาพการสรุปผลหวย...</p>
            </div>
          ) : imageUrl ? (
            <div className="w-full flex flex-col items-center">
              <div className="relative group rounded-xl overflow-hidden border border-amber-500/40 shadow-2xl max-w-full bg-slate-900">
                <img
                  src={imageUrl}
                  alt="Lottery Summary Card"
                  className="w-full max-h-[60vh] object-contain block"
                />

                {/* Floating Quick Share overlay button */}
                <div className="absolute top-3 right-3 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={handleShareImage}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>แชร์ทันที</span>
                  </button>
                </div>
              </div>

              {/* Text Template Preview Collapse */}
              <div className="mt-4 w-full p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    ข้อความสำหรับส่งในแชต LINE / Facebook
                  </span>
                  <button
                    onClick={handleCopyText}
                    className="text-amber-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    คัดลอกข้อความ
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-black/40 font-mono text-[11px] leading-relaxed text-slate-200 overflow-x-auto whitespace-pre-wrap select-all">
                  {generateSummaryText()}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-12 text-slate-400 text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p>ไม่สามารถสร้างรูปภาพได้ กรุณาลองใหม่อีกครั้ง</p>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span>Web Share API พร้อมส่งต่อภาพเข้า LINE, Telegram และโซเชียลมีเดีย</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
