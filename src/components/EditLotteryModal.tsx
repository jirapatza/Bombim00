import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, Clock, Tag, Flag, Calendar, Hash, Globe } from 'lucide-react';
import { LotteryItem } from './DailySummaryTable';

interface EditLotteryModalProps {
  isOpen: boolean;
  onClose: () => void;
  lottery: LotteryItem | null; // null means adding a new lottery
  onSave: (lottery: LotteryItem) => void;
  onDelete?: (id: string) => void;
}

export const EditLotteryModal: React.FC<EditLotteryModalProps> = ({
  isOpen,
  onClose,
  lottery,
  onSave,
  onDelete,
}) => {
  const isEditing = lottery !== null;

  const [name, setName] = useState('');
  const [closeTimeStr, setCloseTimeStr] = useState('12:00 น.');
  const [drawTimeStr, setDrawTimeStr] = useState('12:30 น.');
  const [period, setPeriod] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');
  const [category, setCategory] = useState<'foreign_stock' | 'thai_stock' | 'hanoi' | 'lao' | 'vip' | 'gov_savings'>('vip');
  const [categoryLabel, setCategoryLabel] = useState('หวย VIP');
  const [flag, setFlag] = useState('🎯');
  const [drawDays, setDrawDays] = useState('ทุกวัน');
  const [top3, setTop3] = useState('');
  const [bottom2, setBottom2] = useState('');
  const [source, setSource] = useState('Market / Official');

  useEffect(() => {
    if (lottery) {
      setName(lottery.name || '');
      setCloseTimeStr(lottery.closeTimeStr || '');
      setDrawTimeStr(lottery.drawTimeStr || '');
      setPeriod(lottery.period || 'morning');
      setCategory(lottery.category as any || 'vip');
      setCategoryLabel(lottery.categoryLabel || 'หวย VIP');
      setFlag(lottery.flag || '🎯');
      setDrawDays(lottery.drawDays || 'ทุกวัน');
      setTop3(lottery.top3 || '');
      setBottom2(lottery.bottom2 || '');
      setSource(lottery.source || 'Official');
    } else {
      setName('');
      setCloseTimeStr('12:05 น.');
      setDrawTimeStr('12:30 น.');
      setPeriod('afternoon');
      setCategory('vip');
      setCategoryLabel('หวย VIP');
      setFlag('🎯');
      setDrawDays('ทุกวัน');
      setTop3('');
      setBottom2('');
      setSource('Official / Live');
    }
  }, [lottery, isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: any) => {
    setCategory(newCat);
    switch (newCat) {
      case 'vip':
        setCategoryLabel('หวย VIP');
        break;
      case 'foreign_stock':
        setCategoryLabel('หวยหุ้นต่างประเทศ');
        break;
      case 'thai_stock':
        setCategoryLabel('หวยหุ้นไทย');
        break;
      case 'hanoi':
        setCategoryLabel('หวยฮานอย');
        break;
      case 'lao':
        setCategoryLabel('หวยลาว');
        break;
      case 'gov_savings':
        setCategoryLabel('หวยรัฐบาล & ออมสิน/ธกส');
        break;
      default:
        setCategoryLabel('หวยทั่วไป');
    }
  };

  const handlePeriodChange = (newPeriod: 'morning' | 'afternoon' | 'evening' | 'night') => {
    setPeriod(newPeriod);
  };

  const getPeriodLabel = (p: string) => {
    switch (p) {
      case 'morning':
        return 'หวยเช้า';
      case 'afternoon':
        return 'หวยบ่าย';
      case 'evening':
        return 'หวยเย็น';
      case 'night':
        return 'หวยดึก';
      default:
        return 'หวยทั่วไป';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = lottery ? lottery.id : `custom_${Date.now()}`;
    const status = top3.trim() && bottom2.trim() ? 'announced' : (lottery?.status || 'waiting');

    const updatedItem: LotteryItem = {
      id,
      name: name.trim(),
      closeTimeStr: closeTimeStr.includes('น.') ? closeTimeStr.trim() : `${closeTimeStr.trim()} น.`,
      drawTimeStr: drawTimeStr.includes('น.') ? drawTimeStr.trim() : `${drawTimeStr.trim()} น.`,
      period,
      periodLabel: getPeriodLabel(period),
      category,
      categoryLabel,
      flag: flag.trim() || '🎯',
      drawDays: drawDays.trim() || 'ทุกวัน',
      status: status as any,
      top3: top3.trim(),
      bottom2: bottom2.trim(),
      date: lottery?.date || 'วันนี้',
      source: source.trim() || 'Official Live',
      firstPrize: lottery?.firstPrize || (top3 && bottom2 ? `${top3}${bottom2}` : undefined),
    };

    onSave(updatedItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fadeIn modal-overlay">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              {isEditing ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {isEditing ? `แก้ไขข้อมูล: ${lottery.name}` : 'เพิ่มหวยรายการใหม่ในระบบ'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditing ? 'ปรับแต่งเวลาปิดรับ เวลาออกผล หรือผลรางวัล' : 'กรอกรายละเอียดรอบหวยเพื่อเพิ่มเข้าตาราง'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Row 1: Name and Flag */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-slate-300 font-semibold block">ชื่อหวย *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ฮานอยอาเซียน, นิเคอิเช้า VIP"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">ธง / อีโมจิ</label>
              <input
                type="text"
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                placeholder="🇱🇦, 🇻🇳, 🇯🇵"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-center text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Row 2: Close Time & Draw Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> เวลาปิดรับแทง *
              </label>
              <input
                type="text"
                required
                value={closeTimeStr}
                onChange={(e) => setCloseTimeStr(e.target.value)}
                placeholder="เช่น 08:20 น."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> เวลาออกผลรางวัล *
              </label>
              <input
                type="text"
                required
                value={drawTimeStr}
                onChange={(e) => setDrawTimeStr(e.target.value)}
                placeholder="เช่น 08:30 น."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>
          </div>

          {/* Row 3: Period & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">ช่วงเวลา (Period)</label>
              <select
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-400 text-xs"
              >
                <option value="morning">☀️ หวยเช้า (08:20 - 11:35)</option>
                <option value="afternoon">🌤️ หวยบ่าย (12:05 - 17:05)</option>
                <option value="evening">🌇 หวยเย็น (17:05 - 21:30)</option>
                <option value="night">🌌 หวยดึก (21:40 - 04:00)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">หมวดหมู่หวย</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-400 text-xs"
              >
                <option value="vip">หวย VIP & พิเศษ</option>
                <option value="foreign_stock">หวยหุ้นต่างประเทศ</option>
                <option value="thai_stock">หวยหุ้นไทย</option>
                <option value="hanoi">หวยฮานอย</option>
                <option value="lao">หวยลาว</option>
                <option value="gov_savings">หวยรัฐบาล & ออมสิน/ธกส</option>
              </select>
            </div>
          </div>

          {/* Row 4: Draw Days & Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">วันที่ออกรางวัล</label>
              <input
                type="text"
                value={drawDays}
                onChange={(e) => setDrawDays(e.target.value)}
                placeholder="เช่น จันทร์ - ศุกร์ หรือ ทุกวัน"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">แหล่งข้อมูล / ตลาด</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="เช่น Nikkei 225, Lao Live"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>
          </div>

          {/* Row 5: Results (3 digits, 2 digits) */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
            <span className="text-xs text-amber-400 font-bold block">
              ผลรางวัลล่าสุด (หากออกผลแล้ว)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-400 text-[11px] block">3 ตัวบน</label>
                <input
                  type="text"
                  maxLength={3}
                  value={top3}
                  onChange={(e) => setTop3(e.target.value)}
                  placeholder="เช่น 731"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 font-mono font-bold text-center text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 text-[11px] block">2 ตัวล่าง</label>
                <input
                  type="text"
                  maxLength={2}
                  value={bottom2}
                  onChange={(e) => setBottom2(e.target.value)}
                  placeholder="เช่น 42"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-300 font-mono font-bold text-center text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`คุณต้องการลบหวย "${lottery.name}" ออกจากระบบใช่หรือไม่?`)) {
                    onDelete(lottery.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 rounded-xl text-rose-400 hover:text-white hover:bg-rose-600/30 transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> ลบหวยนี้
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition"
              >
                <Save className="w-3.5 h-3.5" /> บันทึกข้อมูล
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
