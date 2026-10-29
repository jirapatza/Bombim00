import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Share2, Sparkles, Clock, Calendar, MessageSquare, Send } from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

interface SocialPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  lotteries: LotteryItem[];
  nextClosing?: { name: string; closeTimeStr: string; remainingText: string } | null;
}

export const SocialPostModal: React.FC<SocialPostModalProps> = ({
  isOpen,
  onClose,
  lotteries,
  nextClosing,
}) => {
  const [activeTab, setActiveTab] = useState<'morning' | 'afternoon' | 'evening' | 'night' | 'closing' | 'all'>('morning');
  const [copied, setCopied] = useState(false);

  const todayThai = useMemo(() => {
    return new Date().toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  const generatedText = useMemo(() => {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    if (activeTab === 'closing') {
      const targetName = nextClosing?.name || 'หวยรอบถัดไป';
      const closeTime = nextClosing?.closeTimeStr || 'กำลังจะปิดรับ';
      const remaining = nextClosing?.remainingText || 'ใกล้หมดเวลา';
      return `🚨 แจ้งเตือนปิดรับแทงรอบถัดไป!\n${divider}\n🎯 หวย: ${targetName}\n⏰ เวลาปิดรับแทง: ${closeTime}\n⏳ สถานะ: ${remaining}\n${divider}\n⚠️ สมาชิกท่านใดยังไม่ส่งโพย รีบตัดรอบด่วนครับ!\n✨ ตรวจผลสดได้ที่ Lottery Alert Pro`;
    }

    let targetItems: LotteryItem[] = [];
    let periodTitle = '';
    let emoji = '';

    if (activeTab === 'morning') {
      targetItems = lotteries.filter((l) => l.period === 'morning');
      periodTitle = 'สรุปผลหวยรอบเช้า';
      emoji = '☀️';
    } else if (activeTab === 'afternoon') {
      targetItems = lotteries.filter((l) => l.period === 'afternoon');
      periodTitle = 'สรุปผลหวยรอบบ่าย';
      emoji = '🌤️';
    } else if (activeTab === 'evening') {
      targetItems = lotteries.filter((l) => l.period === 'evening');
      periodTitle = 'สรุปผลหวยรอบเย็น';
      emoji = '🌇';
    } else if (activeTab === 'night') {
      targetItems = lotteries.filter((l) => l.period === 'night');
      periodTitle = 'สรุปผลหวยรอบดึก';
      emoji = '🌌';
    } else {
      targetItems = lotteries;
      periodTitle = 'สรุปผลหวยประจำวันทั้งหมด';
      emoji = '🌟';
    }

    let text = `${emoji} ${periodTitle} (${todayThai})\n`;
    text += `📋 ทั้งหมด ${targetItems.length} รายการ\n`;
    text += `${divider}\n`;

    targetItems.forEach((item, index) => {
      const flag = item.flag || '🎯';
      if (item.status === 'announced' && item.top3 && item.bottom2) {
        text += `${index + 1}. ${flag} ${item.name} (${item.drawTimeStr})\n   👉 3 บน: [ ${item.top3} ] • 2 ล่าง: [ ${item.bottom2} ]\n`;
      } else {
        text += `${index + 1}. ${flag} ${item.name} (${item.drawTimeStr})\n   ⏳ ยังไม่ออกผล (ปิดรับ ${item.closeTimeStr})\n`;
      }
    });

    text += `${divider}\n`;
    text += `📢 อัปเดตเรียลไทม์ผ่าน Lottery Alert Pro\n#ผลหวย #หวยหุ้น #หวยฮานอย #หวยลาว`;
    return text;
  }, [activeTab, lotteries, nextClosing, todayThai]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                สร้างแคปชั่นส่งเข้ากลุ่ม LINE / Facebook / Telegram
              </h3>
              <p className="text-xs text-slate-400">
                เลือกช่วงเวลาที่ต้องการ แล้วกดคัดลอกข้อความนำไปโพสต์ได้ทันที 1 คลิก
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex space-x-2 p-3 bg-slate-950 border-b border-slate-800 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('morning')}
            className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'morning'
                ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            ☀️ สรุปหวยเช้า ({lotteries.filter((l) => l.period === 'morning').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('afternoon')}
            className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'afternoon'
                ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-300'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌤️ สรุปหวยบ่าย ({lotteries.filter((l) => l.period === 'afternoon').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evening')}
            className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'evening'
                ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-300'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌇 สรุปหวยเย็น ({lotteries.filter((l) => l.period === 'evening').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('night')}
            className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'night'
                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌌 สรุปหวยดึก ({lotteries.filter((l) => l.period === 'night').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('closing')}
            className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'closing'
                ? 'bg-red-500 text-white shadow-md ring-2 ring-red-300'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🚨 เตือนปิดรับรอบถัดไป
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌟 รวมทุกหวย ({lotteries.length})
          </button>
        </div>

        {/* Text Area Preview */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 font-mono text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
            {generatedText}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            คัดลอกแล้วสามารถนำไปวางใน LINE, กลุ่ม Facebook หรือ Telegram ได้ทันที
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg transition ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> คัดลอกสำเร็จแล้ว!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> คัดลอกแคปชั่นนี้
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
