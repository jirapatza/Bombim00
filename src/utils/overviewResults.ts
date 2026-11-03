import { getResultNumbers, matchesLottery } from './lotteryResult.ts';
import { filterLotteriesForDrawDate, isGovernmentLottery } from './lotterySchedule.ts';
type Row = Record<string, any>;
export const dayKey = (value: string): string => {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  let y=0,m=0,d=0;
  if(iso) [y,m,d]=iso.slice(1).map(Number);
  else if(dmy) [d,m,y]=dmy.slice(1).map(Number);
  else {
    const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const short=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    m=months.findIndex((name,i)=>raw.includes(name)||raw.includes(short[i]))+1;
    const n=raw.match(/\d+/g); if(n&&n.length>=2) [d,y]=n.map(Number);
  }
  if(y>=2400)y-=543;
  const date=new Date(Date.UTC(y,m-1,d));
  return y>1900&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d
    ? `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` : '';
};
export const thaiToday = (date=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const minutes = (s: string) => {const m=s?.match(/(\d{1,2})[:.](\d{2})/);return m&&Number(m[1])<24&&Number(m[2])<60?Number(m[1])*60+Number(m[2]):null;};
export const timelineMinutes = (s:string) => {const n=minutes(s);return n===null?Number.POSITIVE_INFINITY:n<7*60?n+1440:n;};
export const complete = (r:Row) => {const n=getResultNumbers(r);return Boolean(n.top3&&n.bottom2);};
export const rowName = (r:Row) => String(r.ชื่อหวย||r.lotteryName||r.name||r.หวย||'');
export const rowDate = (r:Row) => [r.งวดวันที่,r.วันที่จัดรูปแบบ,r.drawDate,r.date].map(v=>String(v||'')).find(v=>dayKey(v))||'';
export const displayDate = (value:string) => {const d=dayKey(value);return d?d.split('-').reverse().join('-'):value;};
export function publishedTime(row:Row,item?:Row):number {
  const raw=row.เวลาประกาศผล||row.announcedAt||row.publishedAt;
  if(raw){const text=String(raw);const t=Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+'+07:00');if(Number.isFinite(t))return t;}
  const day=dayKey(rowDate(row));const time=minutes(item?.drawTimeStr||'');
  if(!day||time===null)return NaN;
  return Date.parse(day+'T00:00:00+07:00')+timelineMinutes(item!.drawTimeStr)*60000;
}
export function latestPublishedResults(results:Row[],catalog:Row[],now=new Date()) {
  const today=thaiToday(now);const seen=new Set<string>();
  return results.filter(complete).map(row=>{const item=catalog.find(item=>matchesLottery(item,row));return {row,item,timestamp:publishedTime(row,item)};})
    .filter(r=>Number.isFinite(r.timestamp)&&r.timestamp<=now.getTime()&&thaiToday(new Date(r.timestamp))===today)
    .sort((a,b)=>b.timestamp-a.timestamp||String(a.item?.id||rowName(a.row)).localeCompare(String(b.item?.id||rowName(b.row))))
    .filter(r=>{const id=r.item?.id||rowName(r.row);if(seen.has(id))return false;seen.add(id);return true;}).slice(0,3);
}
export function todayLotteryRows(catalog:Row[],results:Row[],now=new Date()) {
  const today=thaiToday(now);const clock=minutes(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now))!;
  const scheduled=filterLotteriesForDrawDate(catalog,now);
  return catalog.flatMap(item=>{
    const actual=results.find(row=>matchesLottery(item,row)&&dayKey(rowDate(row))===today&&complete(row));
    const own=dayKey(item.date)===today&&complete(item)?item:null;
    const result=actual||own;
    if(isGovernmentLottery(item)&&!result&&dayKey(item.nextDrawDate||item.drawDate||'')!==today)return [];
    if(!result&&!scheduled.includes(item))return [];
    const draw=minutes(item.drawTimeStr);const time=timelineMinutes(item.drawTimeStr);
    const state=result?'announced':draw!==null&&draw>=7*60&&draw<=clock?'waiting':'upcoming';
    return [{item:{...item,...(result?getResultNumbers(result):{top3:'',bottom2:''}),date:result?rowDate(result):'',firstPrize:'',status:state} as Row,state,draw,time}];
  }).sort((a,b)=>a.time-b.time||String(a.item.name).localeCompare(String(b.item.name),'th'));
}
export function lotteryHistory(item:Row,results:Row[],limit=10) {
  const history=[...results.filter(row=>matchesLottery(item,row)),...(item.history||[]).map((r:Row)=>({...r,ชื่อหวย:item.name,งวดวันที่:r.date}))];
  const seen=new Set<string>();
  return history.filter(r=>complete(r)&&dayKey(rowDate(r))).sort((a,b)=>dayKey(rowDate(b)).localeCompare(dayKey(rowDate(a))))
    .filter(r=>{const day=dayKey(rowDate(r));if(seen.has(day))return false;seen.add(day);return true;}).slice(0,limit);
}
