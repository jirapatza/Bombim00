import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Clock, Layers, CheckCircle2, Calendar, RefreshCw } from 'lucide-react';
import type { LotteryItem } from './DailySummaryTable';
import { getResultNumbers, normalizeLotteryIdentity } from '../utils/lotteryResult';
import { filterLotteriesForDrawDate, isGovernmentLottery } from '../utils/lotterySchedule';

import { dayKey, thaiToday, minutes, complete, rowName, rowDate } from '../utils/overviewResults';
type Row = Record<string, any>;

export function ResultsOverview({ lotteries, results, onSettings, onRefresh, lastUpdated }: {
  lotteries: LotteryItem[]; results: Row[]; onSettings: () => void; onRefresh: () => void; lastUpdated?: string;
}) {
  const [now, setNow] = useState(new Date());
  const [filter, setFilter] = useState('all');
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const today = thaiToday();
  const clock = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(now);
  const currentMinutes = minutes(clock)!;
  const rows = filterLotteriesForDrawDate(lotteries).map(item => {
    const confirmed = dayKey(item.date) === today && complete(item);
    const draw = minutes(item.drawTimeStr);
    const waiting = !confirmed && !isGovernmentLottery(item) && draw !== null && draw <= currentMinutes;
    return { item, state: confirmed ? 'announced' : waiting ? 'waiting' : 'upcoming', draw };
  });
  const pending = rows.filter(r => r.state !== 'announced' && r.draw !== null && !isGovernmentLottery(r.item));
  const next = [...pending].sort((a,b) => ((a.draw! - currentMinutes + 1440)%1440) - ((b.draw! - currentMinutes + 1440)%1440))[0];
  const seconds = next ? Math.max(0, ((next.draw! - currentMinutes + 1440)%1440)*60 - now.getSeconds()) : 0;
  const countdown = [Math.floor(seconds/3600), Math.floor(seconds%3600/60), seconds%60].map(n=>String(n).padStart(2,'0')).join(' : ');
  const actual = results.filter(r => dayKey(rowDate(r)) === today && complete(r));
  const detected = (r: Row) => Date.parse(r.เวลาประกาศผล || r.announcedAt || r.เวลาที่ตรวจพบ || r.detectedAt || '') || 0;
  const latest = [...actual].sort((a,b)=>detected(b)-detected(a)).filter((r,i,a)=>a.findIndex(x=>normalizeLotteryIdentity(rowName(x))===normalizeLotteryIdentity(rowName(r)))===i).slice(0,3);
  const labels: Record<string,string> = {announced:'ประกาศผลแล้ว',waiting:'กำลังรอผล',upcoming:'ยังไม่ถึงเวลา'};
  const displayRows = rows.filter(r=>filter==='all'||r.state===filter).sort((a,b)=> {
    if(a.state==='announced' && b.state!=='announced') return -1;
    if(b.state==='announced' && a.state!=='announced') return 1;
    return a.state==='announced' ? (b.draw??0)-(a.draw??0) : (a.draw??9999)-(b.draw??9999);
  });
  return <div className="results-overview">
    <div className="overview-topline"><span><Calendar size={18}/> {now.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'long'})} · {clock}</span><span className="live-pill">● LIVE</span></div>
    <section className="draw-hero" aria-labelledby="next-draw-title">
      <div className="panel-heading"><h2 id="next-draw-title"><Clock/> รายการกำลังจะออกถัดไป</h2><span className="live-pill">อัปเดตอัตโนมัติ</span></div>
      {next ? <div className="hero-content"><div><h3><span className="lottery-flag">{next.item.flag}</span>{next.item.name}</h3><p>{next.item.categoryLabel}</p><div className="draw-timing"><div><small>ประกาศผล</small><strong>{next.item.drawTimeStr}</strong></div><div><small>เหลือเวลา</small><strong className="countdown">{next.state==='waiting'?'รอผลจริง':countdown}</strong><small>เวลาไทย · ชั่วโมง : นาที : วินาที</small></div></div></div><div className="hero-prizes"><div className="prize-box">ผล 3 ตัว<strong>⌛ รอผล</strong></div><div className="prize-box">ผล 2 ตัว<strong>⌛ รอผล</strong></div><button onClick={onSettings}><Bell size={18}/> แจ้งเตือนก่อนออกผล</button><button onClick={()=>document.getElementById('today-results')?.scrollIntoView({behavior:'smooth'})}>ดูรายการทั้งหมด ↓</button></div></div> : <p className="empty-state">กำลังรอข้อมูลรอบถัดไปจากแหล่งข้อมูล</p>}
    </section>
    <div className="overview-counts">{[{id:'all',label:'รายการทั้งหมด',icon:Layers},{id:'announced',label:labels.announced,icon:CheckCircle2},{id:'waiting',label:labels.waiting,icon:Clock},{id:'upcoming',label:labels.upcoming,icon:Calendar}].map(({id,label,icon:Icon})=><button key={id} onClick={()=>{setFilter(id);document.getElementById('today-results')?.scrollIntoView({behavior:'smooth'});}} className={`count-card ${id}`}><Icon/><span>{label}<strong>{id==='all'?rows.length:rows.filter(r=>r.state===id).length}</strong><small>รายการ</small></span></button>)}</div>
    <section className="results-panel"><div className="panel-heading"><h2>3 รายการที่ออกล่าสุด</h2><span className="live-pill">ผลจริงวันนี้</span></div><div className="latest-result-grid">{latest.length ? latest.map((r,i)=>{const n=getResultNumbers(r); const item=lotteries.find(l=>normalizeLotteryIdentity(l.name)===normalizeLotteryIdentity(rowName(r)));return <article className="latest-result" key={`${rowName(r)}-${rowDate(r)}`}><span className="result-rank">{i+1}</span><h3>{item?.flag} {rowName(r)}</h3><div className="number-pair"><div><strong>{n.top3}</strong><small>ผล 3 ตัว</small></div><div><strong>{n.bottom2}</strong><small>ผล 2 ตัว</small></div></div><p>{rowDate(r)} {r.เวลาที่ตรวจพบ ? '· ตรวจพบ '+new Date(r.เวลาที่ตรวจพบ).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok'}) : ''}</p></article>}) : <p className="empty-state">ยังไม่มีผลที่ยืนยันแล้วของวันนี้</p>}</div></section>
    <section className="results-panel" id="today-results"><div className="panel-heading"><h2>สรุปผลประจำวันนี้ <span className="live-pill">วันนี้</span></h2><button aria-label="รีเฟรชผลวันนี้" onClick={onRefresh}><RefreshCw size={18}/></button></div><p className="updated-at">ตรวจล่าสุด {lastUpdated || 'กำลังเชื่อมต่อข้อมูล'}</p><div className="result-filters">{['all','announced','waiting','upcoming'].map(id=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{id==='all'?'ทั้งหมด':labels[id]}</button>)}</div><div className="today-table-wrap"><table className="today-table"><thead><tr><th>เวลาออก</th><th>รายการ</th><th>ประเภท</th><th>ผล 3 ตัว</th><th>ผล 2 ตัว</th><th>สถานะ</th></tr></thead><tbody>{displayRows.map(({item,state})=>{const n=state==='announced'?getResultNumbers(item):{top3:'',bottom2:''};return <tr key={item.id}><td>{isGovernmentLottery(item)&&state!=='announced'?'รอวันงวด':item.drawTimeStr}</td><th scope="row">{item.flag} {item.name}</th><td>{item.categoryLabel}</td><td className="table-number">{n.top3||'—'}</td><td className="table-number bottom-number">{n.bottom2||'—'}</td><td><span className={`result-status ${state}`}>{labels[state]}</span></td></tr>})}</tbody></table></div>{!displayRows.length&&<p className="empty-state">ไม่มีรายการในสถานะนี้</p>}</section>
  </div>;
}

export function IndividualHistory({lotteries,results}: {lotteries:LotteryItem[];results:Row[]}) {
  const [selected,setSelected]=useState(''); const [query,setQuery]=useState(''); const [limit,setLimit]=useState(10);
  const names=useMemo(()=>Array.from(new Map([...lotteries.map(l=>l.name),...results.map(rowName)].filter(Boolean).reverse().map(name=>[normalizeLotteryIdentity(name),name])).values()).sort((a,b)=>a.localeCompare(b,'th')),[lotteries,results]);
  const history=useMemo(()=> {
    const matches=results.filter(r=>normalizeLotteryIdentity(rowName(r))===normalizeLotteryIdentity(selected)&&complete(r));
    const catalog=lotteries.find(l=>normalizeLotteryIdentity(l.name)===normalizeLotteryIdentity(selected));
    const combined=[...matches,...(catalog?.history||[]).map(h=>({...h,ชื่อหวย:selected,งวดวันที่:h.date}))];
    return combined.filter(r=>dayKey(rowDate(r))).sort((a,b)=>dayKey(rowDate(b)).localeCompare(dayKey(rowDate(a)))).filter((r,i,a)=>a.findIndex(x=>dayKey(rowDate(x))===dayKey(rowDate(r)))===i).slice(0,limit);
  },[selected,results,lotteries,limit]);
  return <section className="results-panel individual-history"><h2>ประวัติผลย้อนหลัง</h2><p>เลือกหวยรายตัวเพื่อดูผลเป็นชุด เรียงงวดใหม่ไปเก่า</p><div className="history-controls"><label>ค้นหาชื่อหวย<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="พิมพ์ชื่อหวย"/></label><label>เลือกหวย<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">เลือกหวยที่ต้องการ</option>{names.filter(n=>n.includes(query)).map(n=><option key={n}>{n}</option>)}</select></label><label>จำนวนงวด<select value={limit} onChange={e=>setLimit(Number(e.target.value))}>{[10,20,30].map(n=><option key={n} value={n}>{n} งวด</option>)}</select></label></div>{selected&&<h3>{selected} · {history.length} งวด</h3>}<div className="history-draw-grid">{history.map((r,i)=>{const n=getResultNumbers(r);return <article className="latest-result" key={rowDate(r)}><p>งวดที่ {i+1} · {rowDate(r)}</p><div className="number-pair"><div><strong>{n.top3}</strong><small>3 ตัวบน</small></div><div><strong>{n.bottom2}</strong><small>2 ตัวล่าง</small></div></div></article>})}</div>{!history.length&&<p className="empty-state">{selected?'ยังไม่มีประวัติผลที่ยืนยันแล้วสำหรับหวยนี้':'เลือกชื่อหวยด้านบนเพื่อดูผลย้อนหลัง'}</p>}{selected&&history.length>0&&history.length<limit&&<p>มีข้อมูลจริง {history.length} งวดจาก {limit} งวดที่เลือก</p>}</section>;
}
