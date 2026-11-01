import React, { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  Sparkles,
  QrCode,
  Palette,
  Image as ImageIcon,
} from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

export type SummaryThemeKey = 'gold' | 'neon' | 'midnight' | 'emerald';

interface SummaryImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  dateStr: string;
  lotteries: LotteryItem[];
  periodLabel?: string;
  autoShare?: boolean;
}

interface ThemeConfig {
  name: string;
  bgGradTop: string;
  bgGradMid: string;
  bgGradBot: string;
  accentColor: string;
  topBarGrad: [string, string, string];
  cardBorder: string;
  cornerColor: string;
  tagBg: string;
  tagBorder: string;
  tagText: string;
  titleColor: string;
  dateColor: string;
  dividerColor: string;
  rowZebraBg: string;
  rowTextColor: string;
  top3BoxBg: string;
  top3BoxBorder: string;
  top3LabelColor: string;
  top3TextColor: string;
  bot2BoxBg: string;
  bot2BoxBorder: string;
  bot2LabelColor: string;
  bot2TextColor: string;
  footerTextColor: string;
  qrBorderColor: string;
}

const THEMES: Record<SummaryThemeKey, ThemeConfig> = {
  gold: {
    name: 'ทองคำหรูหรา (Gold Luxury)',
    bgGradTop: '#0f172a',
    bgGradMid: '#111827',
    bgGradBot: '#080c14',
    accentColor: '#f59e0b',
    topBarGrad: ['#f59e0b', '#fde047', '#d97706'],
    cardBorder: 'rgba(245, 158, 11, 0.3)',
    cornerColor: '#fbbf24',
    tagBg: 'rgba(245, 158, 11, 0.15)',
    tagBorder: 'rgba(245, 158, 11, 0.45)',
    tagText: '#fde68a',
    titleColor: '#ffffff',
    dateColor: '#fbbf24',
    dividerColor: 'rgba(245, 158, 11, 0.4)',
    rowZebraBg: 'rgba(255, 255, 255, 0.02)',
    rowTextColor: '#f8fafc',
    top3BoxBg: 'rgba(245, 158, 11, 0.12)',
    top3BoxBorder: 'rgba(245, 158, 11, 0.65)',
    top3LabelColor: '#fbbf24',
    top3TextColor: '#ffffff',
    bot2BoxBg: 'rgba(16, 185, 129, 0.12)',
    bot2BoxBorder: 'rgba(16, 185, 129, 0.65)',
    bot2LabelColor: '#34d399',
    bot2TextColor: '#ffffff',
    footerTextColor: '#fbbf24',
    qrBorderColor: '#fbbf24',
  },
  neon: {
    name: 'นีออนไซเบอร์ (Cyber Neon)',
    bgGradTop: '#090d16',
    bgGradMid: '#0f172a',
    bgGradBot: '#1e1035',
    accentColor: '#06b6d4',
    topBarGrad: ['#06b6d4', '#a855f7', '#ec4899'],
    cardBorder: 'rgba(6, 182, 212, 0.4)',
    cornerColor: '#22d3ee',
    tagBg: 'rgba(6, 182, 212, 0.15)',
    tagBorder: 'rgba(6, 182, 212, 0.5)',
    tagText: '#67e8f9',
    titleColor: '#ffffff',
    dateColor: '#a855f7',
    dividerColor: 'rgba(168, 85, 247, 0.45)',
    rowZebraBg: 'rgba(6, 182, 212, 0.03)',
    rowTextColor: '#f1f5f9',
    top3BoxBg: 'rgba(168, 85, 247, 0.15)',
    top3BoxBorder: 'rgba(168, 85, 247, 0.7)',
    top3LabelColor: '#c084fc',
    top3TextColor: '#ffffff',
    bot2BoxBg: 'rgba(6, 182, 212, 0.15)',
    bot2BoxBorder: 'rgba(6, 182, 212, 0.7)',
    bot2LabelColor: '#22d3ee',
    bot2TextColor: '#ffffff',
    footerTextColor: '#22d3ee',
    qrBorderColor: '#a855f7',
  },
  midnight: {
    name: 'ดำมิดไนท์ (Midnight Platinum)',
    bgGradTop: '#020617',
    bgGradMid: '#090d16',
    bgGradBot: '#000000',
    accentColor: '#e2e8f0',
    topBarGrad: ['#94a3b8', '#f8fafc', '#64748b'],
    cardBorder: 'rgba(255, 255, 255, 0.25)',
    cornerColor: '#cbd5e1',
    tagBg: 'rgba(255, 255, 255, 0.1)',
    tagBorder: 'rgba(255, 255, 255, 0.3)',
    tagText: '#f8fafc',
    titleColor: '#ffffff',
    dateColor: '#cbd5e1',
    dividerColor: 'rgba(255, 255, 255, 0.25)',
    rowZebraBg: 'rgba(255, 255, 255, 0.03)',
    rowTextColor: '#f8fafc',
    top3BoxBg: 'rgba(255, 255, 255, 0.08)',
    top3BoxBorder: 'rgba(255, 255, 255, 0.5)',
    top3LabelColor: '#e2e8f0',
    top3TextColor: '#ffffff',
    bot2BoxBg: 'rgba(148, 163, 184, 0.12)',
    bot2BoxBorder: 'rgba(148, 163, 184, 0.6)',
    bot2LabelColor: '#94a3b8',
    bot2TextColor: '#ffffff',
    footerTextColor: '#cbd5e1',
    qrBorderColor: '#e2e8f0',
  },
  emerald: {
    name: 'มรกตพรีเมียม (Emerald VIP)',
    bgGradTop: '#022c22',
    bgGradMid: '#064e3b',
    bgGradBot: '#021f18',
    accentColor: '#10b981',
    topBarGrad: ['#10b981', '#34d399', '#059669'],
    cardBorder: 'rgba(16, 185, 129, 0.35)',
    cornerColor: '#34d399',
    tagBg: 'rgba(16, 185, 129, 0.15)',
    tagBorder: 'rgba(16, 185, 129, 0.5)',
    tagText: '#a7f3d0',
    titleColor: '#ffffff',
    dateColor: '#34d399',
    dividerColor: 'rgba(16, 185, 129, 0.4)',
    rowZebraBg: 'rgba(16, 185, 129, 0.03)',
    rowTextColor: '#f0fdf4',
    top3BoxBg: 'rgba(245, 158, 11, 0.15)',
    top3BoxBorder: 'rgba(245, 158, 11, 0.7)',
    top3LabelColor: '#fbbf24',
    top3TextColor: '#ffffff',
    bot2BoxBg: 'rgba(16, 185, 129, 0.2)',
    bot2BoxBorder: 'rgba(52, 211, 153, 0.7)',
    bot2LabelColor: '#6ee7b7',
    bot2TextColor: '#ffffff',
    footerTextColor: '#34d399',
    qrBorderColor: '#34d399',
  },
};

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
  const [selectedTheme, setSelectedTheme] = useState<SummaryThemeKey>('gold');
  const [includeQr, setIncludeQr] = useState<boolean>(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const hasAutoSharedRef = useRef(false);

  // Filter announced or valid lotteries
  const displayLotteries = lotteries.filter(
    (l) => l.status === 'announced' || (l.top3 && l.bottom2)
  );
  const targetLotteries = displayLotteries.length > 0 ? displayLotteries : lotteries.slice(0, 15);

  const appShareUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-qiphuob5ntzos2dco2lbsq-675247792549.asia-southeast1.run.app';

  // Generate plain text summary for social sharing
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
      text += `${index + 1}. ${l.flag || '🎯'} ${l.name}\n`;
      text += ` 👉 3 บน: ${top3} • 2 ล่าง: ${bot2}\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📡 ตรวจผลสลากเรียลไทม์: ${appShareUrl}\n`;
    text += `#ผลหวย #หวยหุ้น #หวยฮานอย #หวยลาว #LotteryAlert`;
    return text;
  }, [periodLabel, title, dateStr, targetLotteries, appShareUrl]);

  // Download high-resolution PNG
  const handleDownload = useCallback(() => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    const safeDate = dateStr.replace(/[\/\s]/g, '-');
    a.download = `lottery-summary-${selectedTheme}-${safeDate}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShareStatus('บันทึกรูปภาพ (.PNG) เรียบร้อยแล้ว! 📥');
    setTimeout(() => setShareStatus(null), 3500);
  }, [imageUrl, dateStr, selectedTheme]);

  // Web Share API
  const handleShareImage = useCallback(async () => {
    if (!canvasRef.current && !imageUrl) return;
    setIsSharing(true);
    setShareStatus('กำลังเตรียมข้อมูลสำหรับแชร์...');

    const safeDate = dateStr.replace(/[\/\s]/g, '-');
    const fileName = `lottery-summary-${safeDate}.png`;
    const shareText = generateSummaryText();
    const shareTitle = `${title} (${dateStr})`;

    try {
      if (canvasRef.current) {
        canvasRef.current.toBlob(async (blob) => {
          if (!blob) {
            handleDownload();
            setIsSharing(false);
            return;
          }

          const file = new File([blob], fileName, { type: 'image/png' });

          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: shareTitle,
                text: shareText,
              });
              setShareStatus('แชร์รูปภาพสำเร็จแล้ว! 🎉');
            } catch (shareErr: any) {
              if (shareErr.name !== 'AbortError') {
                handleDownload();
              }
            }
          } else if (navigator.share) {
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
            handleDownload();
            setShareStatus('ดาวน์โหลดรูปภาพเรียบร้อยแล้ว! 📥');
          }

          setIsSharing(false);
          setTimeout(() => setShareStatus(null), 4000);
        }, 'image/png');
      } else {
        handleDownload();
        setIsSharing(false);
      }
    } catch {
      handleDownload();
      setIsSharing(false);
    }
  }, [dateStr, generateSummaryText, handleDownload, imageUrl, title]);

  // Main Canvas Render Effect
  useEffect(() => {
    if (!isOpen) {
      hasAutoSharedRef.current = false;
      return;
    }
    setIsRendering(true);

    const renderCard = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const theme = THEMES[selectedTheme];
      const scale = 2; // 2x Retina
      const width = 800;
      const rowHeight = 72;
      const headerHeight = 220;
      const footerHeight = includeQr ? 210 : 140;
      const totalHeight = headerHeight + Math.max(1, targetLotteries.length) * rowHeight + footerHeight;

      canvas.width = width * scale;
      canvas.height = totalHeight * scale;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${totalHeight}px`;

      ctx.scale(scale, scale);

      // Safe cross-browser rounded rect helper
      const safeRoundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        if (typeof (c as any).roundRect === 'function') {
          (c as any).roundRect(x, y, w, h, r);
        } else {
          c.moveTo(x + r, y);
          c.lineTo(x + w - r, y);
          c.quadraticCurveTo(x + w, y, x + w, y + r);
          c.lineTo(x + w, y + h - r);
          c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          c.lineTo(x + r, y + h);
          c.quadraticCurveTo(x, y + h, x, y + h - r);
          c.lineTo(x, y + r);
          c.quadraticCurveTo(x, y, x + r, y);
        }
      };

      // 1. Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, totalHeight);
      bgGrad.addColorStop(0, theme.bgGradTop);
      bgGrad.addColorStop(0.4, theme.bgGradMid);
      bgGrad.addColorStop(1, theme.bgGradBot);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, totalHeight);

      // 2. Decorative Top Bar
      const topBar = ctx.createLinearGradient(0, 0, width, 0);
      topBar.addColorStop(0, theme.topBarGrad[0]);
      topBar.addColorStop(0.5, theme.topBarGrad[1]);
      topBar.addColorStop(1, theme.topBarGrad[2]);
      ctx.fillStyle = topBar;
      ctx.fillRect(0, 0, width, 8);

      // 3. Card Frame
      ctx.strokeStyle = theme.cardBorder;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(16, 16, width - 32, totalHeight - 32);

      // Corner Accents
      const drawCorner = (x: number, y: number, dx: number, dy: number) => {
        ctx.strokeStyle = theme.cornerColor;
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

      // 4. HEADER SECTION
      ctx.fillStyle = theme.tagBg;
      ctx.strokeStyle = theme.tagBorder;
      ctx.lineWidth = 1;
      const tagText = 'LOTTERY ALERT PRO • REALTIME RESULT';
      ctx.font = '600 13px system-ui, -apple-system, sans-serif';
      const tagWidth = ctx.measureText(tagText).width + 24;
      const tagX = (width - tagWidth) / 2;
      ctx.beginPath();
      safeRoundRect(ctx, tagX, 36, tagWidth, 26, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.tagText;
      ctx.fillText(tagText, tagX + 12, 53);

      let emoji = '☀️';
      if (periodLabel?.includes('บ่าย')) emoji = '🌤️';
      else if (periodLabel?.includes('เย็น')) emoji = '🌆';
      else if (periodLabel?.includes('ดึก')) emoji = '🌙';
      else if (periodLabel?.includes('วัน')) emoji = '📋';

      ctx.fillStyle = theme.titleColor;
      ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${emoji} ${title}`, width / 2, 102);

      ctx.fillStyle = theme.dateColor;
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(`(งวดวันที่ ${dateStr})`, width / 2, 136);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(`📋 รายงานสรุปทั้งหมด ${targetLotteries.length} รายการ`, width / 2, 168);

      ctx.strokeStyle = theme.dividerColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(40, 192);
      ctx.lineTo(width - 40, 192);
      ctx.stroke();
      ctx.setLineDash([]);

      // 5. LOTTERY ROWS
      ctx.textAlign = 'left';
      let currentY = headerHeight;

      if (targetLotteries.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ยังไม่มีข้อมูลผลหวยที่ออกรางวัลในรอบนี้', width / 2, currentY + 40);
      } else {
        targetLotteries.forEach((l, index) => {
          if (index % 2 === 0) {
            ctx.fillStyle = theme.rowZebraBg;
            ctx.fillRect(40, currentY - 6, width - 80, rowHeight - 8);
          }

          ctx.fillStyle = theme.accentColor;
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${index + 1}.`, 75, currentY + 36);

          ctx.textAlign = 'left';
          ctx.font = '22px system-ui, -apple-system, sans-serif';
          ctx.fillText(l.flag || '🎯', 88, currentY + 37);

          ctx.fillStyle = theme.rowTextColor;
          ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
          const nameToDraw = l.name.length > 20 ? l.name.slice(0, 19) + '…' : l.name;
          ctx.fillText(nameToDraw, 126, currentY + 36);

          // Check if lottery is Government
          const isGov =
            l.category === 'gov_savings' ||
            l.id === 'thai_gov' ||
            l.id === 'gsb' ||
            l.id === 'baac' ||
            /สลากกินแบ่ง|รัฐบาลไทย|ออมสิน|ธ\.?ก\.?ส/i.test(l.name);

          // Top 3 / 1st Prize Box
          const topValue = (isGov && l.firstPrize) ? l.firstPrize : (l.top3 || '---');
          const top3BoxX = width - 340;
          ctx.fillStyle = theme.top3BoxBg;
          ctx.strokeStyle = theme.top3BoxBorder;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          safeRoundRect(ctx, top3BoxX, currentY + 12, 135, 38, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = theme.top3LabelColor;
          ctx.font = '600 11px system-ui, -apple-system, sans-serif';
          ctx.fillText(isGov ? 'รางวัล 1' : '3 บน', top3BoxX + 8, currentY + 36);

          ctx.fillStyle = theme.top3TextColor;
          ctx.font = 'bold 18px monospace';
          ctx.fillText(topValue, top3BoxX + 60, currentY + 38);

          // Bottom 2 Box
          const bot2 = l.bottom2 || '--';
          const bot2BoxX = width - 185;
          ctx.fillStyle = theme.bot2BoxBg;
          ctx.strokeStyle = theme.bot2BoxBorder;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          safeRoundRect(ctx, bot2BoxX, currentY + 12, 130, 38, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = theme.bot2LabelColor;
          ctx.font = '600 11px system-ui, -apple-system, sans-serif';
          ctx.fillText(isGov ? 'เลขท้าย 2' : '2 ล่าง', bot2BoxX + 8, currentY + 36);

          ctx.fillStyle = theme.bot2TextColor;
          ctx.font = 'bold 18px monospace';
          ctx.fillText(bot2, bot2BoxX + 65, currentY + 38);

          currentY += rowHeight;
        });
      }

      // 6. FOOTER SECTION
      const footerY = totalHeight - footerHeight + 15;

      ctx.strokeStyle = theme.dividerColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(40, footerY);
      ctx.lineTo(width - 40, footerY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (includeQr) {
        // Embed QR Code
        try {
          const qrDataUrl = await QRCode.toDataURL(appShareUrl, {
            width: 160,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
          });
          const qrImg = new Image();
          await new Promise<void>((resolve, reject) => {
            qrImg.onload = () => resolve();
            qrImg.onerror = reject;
            qrImg.src = qrDataUrl;
          });

          const qrSize = 90;
          const qrX = 55;
          const qrY = footerY + 20;

          // Draw QR background box
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8);
          ctx.strokeStyle = theme.qrBorderColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8);
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

          // QR Text Label
          ctx.textAlign = 'left';
          ctx.fillStyle = theme.footerTextColor;
          ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
          ctx.fillText('📱 สแกนตรวจผลสดบนมือถือ', qrX + qrSize + 20, qrY + 28);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '500 13px system-ui, -apple-system, sans-serif';
          ctx.fillText('อัปเดตเรียลไทม์ทุกงวด • สรุปผลแม่นยำ', qrX + qrSize + 20, qrY + 52);

          const timeNow = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
          ctx.fillStyle = '#64748b';
          ctx.font = '400 11px system-ui, -apple-system, sans-serif';
          ctx.fillText(`สร้างเมื่อ: ${dateStr} เวลา ${timeNow} น.`, qrX + qrSize + 20, qrY + 76);
        } catch (qrErr) {
          console.warn('QR generation error in canvas:', qrErr);
        }
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.footerTextColor;
        ctx.font = '600 15px system-ui, -apple-system, sans-serif';
        ctx.fillText('📢 อัปเดตเรียลไทม์ผ่าน Lottery Alert Pro', width / 2, footerY + 36);

        ctx.fillStyle = '#64748b';
        ctx.font = '500 13px system-ui, -apple-system, sans-serif';
        ctx.fillText('#ผลหวย #หวยหุ้น #หวยฮานอย #หวยลาว #ตรวจสลาก', width / 2, footerY + 64);

        const timeNow = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        ctx.fillStyle = '#475569';
        ctx.font = '400 11px system-ui, -apple-system, sans-serif';
        ctx.fillText(`สร้างเมื่อ: ${dateStr} เวลา ${timeNow} น.`, width / 2, footerY + 88);
      }

      try {
        const url = canvas.toDataURL('image/png');
        setImageUrl(url);

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

    const timer = setTimeout(renderCard, 80);
    return () => clearTimeout(timer);
  }, [isOpen, title, dateStr, targetLotteries, periodLabel, autoShare, selectedTheme, includeQr, appShareUrl, handleShareImage]);

  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
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
        document.body.removeChild(ta);
      }
      setCopiedText(true);
      setShareStatus('คัดลอกข้อความสรุปผลเรียบร้อยแล้ว 📋');
      setTimeout(() => {
        setCopiedText(false);
        setShareStatus(null);
      }, 3000);
    } catch {
      setShareStatus('คัดลอกข้อความไม่สำเร็จ');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                สร้างการ์ดรูปภาพสรุปผล (Pro Summary Card)
              </h2>
              <p className="text-xs text-slate-400">
                พร้อมฝัง QR Code สแกนตรวจผลสด และ 4 ธีมหรูหรา
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Theme and QR Controls Bar */}
        <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Theme Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
              <Palette className="w-3.5 h-3.5" /> ธีมสี:
            </span>
            {(['gold', 'neon', 'midnight', 'emerald'] as SummaryThemeKey[]).map((tKey) => {
              const th = THEMES[tKey];
              const isSelected = selectedTheme === tKey;
              return (
                <button
                  key={tKey}
                  type="button"
                  onClick={() => setSelectedTheme(tKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-slate-800 text-white border-amber-500/60 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: th.accentColor }}
                  />
                  <span>{tKey === 'gold' ? 'ทองคำ' : tKey === 'neon' ? 'นีออน' : tKey === 'midnight' ? 'มิดไนท์' : 'มรกต'}</span>
                </button>
              );
            })}
          </div>

          {/* Toggle QR code */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium select-none">
            <input
              type="checkbox"
              checked={includeQr}
              onChange={(e) => setIncludeQr(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
            />
            <QrCode className="w-3.5 h-3.5 text-amber-400" />
            <span>ฝัง QR Code</span>
          </label>
        </div>

        {/* Status Notification Toast */}
        {shareStatus && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-300 text-center font-bold animate-fadeIn">
            {shareStatus}
          </div>
        )}

        {/* Image Preview Canvas Area */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-950/40">
          <canvas ref={canvasRef} className="hidden" />

          {isRendering ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">กำลังสร้างรูปภาพความละเอียดสูงระดับ 2x Retina...</span>
            </div>
          ) : imageUrl ? (
            <div className="max-w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
              <img
                src={imageUrl}
                alt="Lottery Summary Card"
                className="max-h-[55vh] w-auto object-contain rounded-2xl mx-auto"
              />
            </div>
          ) : (
            <div className="py-12 text-slate-400 text-xs">ไม่สามารถสร้างรูปภาพได้</div>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? 'คัดลอกข้อความแล้ว' : 'คัดลอกข้อความ'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyImage}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ImageIcon className="w-3.5 h-3.5" />}
              <span>{copiedImage ? 'คัดลอกรูปแล้ว' : 'คัดลอกรูปภาพ'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleShareImage}
              disabled={isSharing}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isSharing ? 'กำลังแชร์...' : 'แชร์รูปภาพ'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลดรูปสรุป (.PNG)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
