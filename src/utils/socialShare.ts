import { LotteryCatalogItem } from '../types/lottery';

export async function generateSummaryCanvas(
  title: string,
  dateText: string,
  periodLabel: string,
  items: LotteryCatalogItem[]
): Promise<HTMLCanvasElement> {
  const width = 1080;
  const headerHeight = 280;
  const rowHeight = 90;
  const footerHeight = 120;
  const totalHeight = Math.max(headerHeight + items.length * rowHeight + footerHeight, 600);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');

  // Background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, width, totalHeight);

  // Header Gradient Banner
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#B45309');
  gradient.addColorStop(0.5, '#F59E0B');
  gradient.addColorStop(1, '#D97706');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, headerHeight);

  // Header Title
  ctx.fillStyle = '#020617';
  ctx.font = 'bold 50px Prompt, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 90);

  // Period & Date Badge
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 36px Prompt, sans-serif';
  ctx.fillText(`${periodLabel} • ${dateText}`, width / 2, 155);

  // Table Column Header in banner
  ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
  ctx.fillRect(40, 195, width - 80, 65);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 30px Prompt, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('รายการหวย', 70, 240);

  ctx.textAlign = 'center';
  ctx.fillText('3 ตัว / รางวัลที่ 1', 680, 240, 230);
  ctx.fillText('2 ตัวล่าง', 920, 240);

  // Draw Items
  let currentY = headerHeight + 20;

  items.forEach((item, index) => {
    const rowTop = currentY;
    const rowBottom = rowTop + rowHeight;

    // Alternating row background
    if (index % 2 === 1) {
      ctx.fillStyle = '#141E33';
      ctx.fillRect(40, rowTop - 10, width - 80, rowHeight);
    }

    // Flag & Name
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 32px Prompt, sans-serif';
    ctx.fillText(`${item.flag} ${item.name}`, 60, rowTop + 45);

    // Close time subtitle
    ctx.fillStyle = '#94A3B8';
    ctx.font = '22px Prompt, sans-serif';
    ctx.fillText(`ปิด ${item.closeTimeStr}`, 60, rowTop + 72);

    const isDrawn =
      item.status === 'drawn' ||
      Boolean(item.top3?.trim()) ||
      Boolean(item.bottom2?.trim()) ||
      Boolean(item.firstPrize?.trim());

    // Top 3 Badge
    const isFirstPrize = Boolean(item.firstPrize?.trim());
    const top3Text = (isFirstPrize ? item.firstPrize : item.top3)?.trim() || (isDrawn ? '---' : 'รอผล');
    drawRoundedRect(ctx, 590, rowTop + 8, 180, 60, 14, '#F59E0B');
    ctx.fillStyle = '#020617';
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px Prompt, sans-serif';
    ctx.fillText(isFirstPrize ? 'รางวัลที่ 1' : '3 ตัว', 680, rowTop + 27);
    ctx.font = `bold ${isFirstPrize ? 29 : 32}px "JetBrains Mono", monospace`;
    ctx.fillText(top3Text, 680, rowTop + 57, 170);

    // Bottom 2 Badge
    const bottom2Text = item.bottom2?.trim() || (isDrawn ? '--' : 'รอผล');
    drawRoundedRect(ctx, 830, rowTop + 8, 180, 60, 14, '#10B981');
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(bottom2Text, 920, rowTop + 50);

    // Row divider
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, rowBottom - 10);
    ctx.lineTo(width - 40, rowBottom - 10);
    ctx.stroke();

    currentY += rowHeight;
  });

  // Footer Branding
  ctx.fillStyle = '#64748B';
  ctx.font = '28px Prompt, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦ BOMBI M00 • ระบบแจ้งเตือนผลหวยอัตโนมัติ ✦', width / 2, totalHeight - 45);

  return canvas;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.restore();
}

export function downloadCanvasAsImage(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function shareCanvasImage(canvas: HTMLCanvasElement, title: string) {
  try {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value =>
      value ? resolve(value) : reject(new Error('สร้างไฟล์รูปภาพไม่สำเร็จ')), 'image/png'));
    const file = new File([blob], 'lottery_summary.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, text: title, files: [file] });
    } else downloadCanvasAsImage(canvas, 'lottery_summary.png');
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      downloadCanvasAsImage(canvas, 'lottery_summary.png');
    }
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
