import { getResultNumbers } from './lotteryResult.ts';
type Row = Record<string, any>;
export const dayKey = (value: string): string => {
  const raw = String(value || '');
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (iso || dmy) {
    const [y, m, d] = iso ? [Number(iso[1]), iso[2], iso[3]] : [Number(dmy![3]), dmy![2], dmy![1]];
    return `${y > 2400 ? y - 543 : y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const month = months.findIndex(m => raw.includes(m));
  const nums = raw.match(/\d+/g);
  if (month >= 0 && nums && nums.length >= 2) {
    const y = Number(nums[1]);
    return `${y > 2400 ? y - 543 : y}-${String(month + 1).padStart(2, '0')}-${nums[0].padStart(2, '0')}`;
  }
  return '';
};
export const thaiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const minutes = (s: string) => { const m = s?.match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
export const complete = (r: Row) => { const n = getResultNumbers(r); return !!(n.top3 && n.bottom2); };
export const rowName = (r: Row) => String(r.ชื่อหวย || r.หวย || r.lotteryName || r.name || '');
export const rowDate = (r: Row) => String(r.งวดวันที่ || r.date || '');

