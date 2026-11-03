import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Clock, Calendar, RefreshCw, ArrowLeft, Copy, Download } from 'lucide-react';
import type { LotteryItem } from './DailySummaryTable';
import { getResultNumbers, matchesLottery, normalizeLotteryIdentity } from '../utils/lotteryResult';
import { dayKey, thaiToday, minutes, complete, rowName, rowDate, displayDate, latestPublishedResults, todayLotteryRows, lotteryHistory } from '../utils/overviewResults';
type Row=Record<string,any>;
const labels:Record<string,string>={announced:'ออกแล้ว',waiting:'รอผล',upcoming:'ยังไม่ถึงเวลา'};
export function ResultsOverview({lotteries,results,onSettings,onRefresh,lastUpdated}: {
  lotteries:LotteryItem[];results:Row[];onSettings:()=>void;onRefresh:()=>void;lastUpdated?:string;
}) {
  const [now,setNow]=useState(new Date());const [filter,setFilter]=useState('all');
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(now);
  const rows=todayLotteryRows(lotteries,results,now);
  const currentMinutes=minutes(clock)!;
  const next=rows.find(r=>r.state==='upcoming'&&r.draw!==null&&r.time>currentMinutes)||rows.find(r=>r.state==='waiting');
  const seconds=next?.draw===null||!next?0:Math.max(0,(next.time-currentMinutes)*60-now.getSeconds());
  const countdown=[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(' : ');
  const latest=latestPublishedResults(results,lotteries,now);
  const shown=rows.filter(r=>filter==='all'||r.state===filter);
  return <div className="results-overview">
    <div className="overview-topline"><span><Calendar size={18}/>{now.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'long'})} · {clock}</span><span className="live-pill">● LIVE</span></div>
    <section className="draw-hero"><div className="panel-heading"><h2><Clock/> หวยกำลังจะออก</h2></div>
      {next?<div className="hero-content"><div><h3>{next.item.flag} {next.item.name}</h3><div className="draw-timing"><div><small>เวลาออก</small><strong>{next.item.drawTimeStr}</strong></div><div><small>เหลือเวลา</small><strong className="countdown">{next.state==='waiting'?'รอผล':countdown}</strong></div></div></div><div className="hero-prizes"><div className="prize-box">3 ตัวบน<strong>รอผล</strong></div><div className="prize-box">2 ตัวล่าง<strong>รอผล</strong></div><button onClick={onSettings}><Bell size={18}/> ตั้งค่าการแจ้งเตือน</button><button onClick={()=>document.getElementById('today-results')?.scrollIntoView({behavior:'smooth'})}>ดูตารางวันนี้</button></div></div>:<p className="empty-state">ไม่มีรอบที่กำลังรอผลในตารางวันนี้</p>}
    </section>
    <section className="results-panel"><div className="panel-heading"><h2>3 หวยที่ออกล่าสุด</h2></div><p className="updated-at">เรียงตามเวลาประกาศจริง หรือเวลาออกตามตาราง · ไม่ใช้เวลาที่ดึงข้อมูลซ้ำ</p><div className="latest-result-grid">{latest.length?latest.map(({row,item,timestamp},i)=>{const n=getResultNumbers(row);return <article className="latest-result" key={item?.id||rowName(row)}><span className="result-rank">{i+1}</span><h3>{item?.flag} {item?.name||rowName(row)}</h3><div className="number-pair"><div><strong>{n.top3}</strong><small>3 ตัวบน</small></div><div><strong>{n.bottom2}</strong><small>2 ตัวล่าง</small></div></div><p>เวลาออก {new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(timestamp))} น.</p></article>}):<p className="empty-state">ยังไม่มีผลวันนี้ที่ระบุเวลาออกได้</p>}</div></section>
    <section className="results-panel" id="today-results"><div className="panel-heading"><h2>ผลหวยวันนี้</h2><button aria-label="รีเฟรชผลวันนี้" onClick={onRefresh}><RefreshCw size={20}/></button></div><p className="updated-at">เรียงเวลาออกเช้าไปดึก · ตรวจล่าสุด {lastUpdated||'กำลังโหลด'}</p><div className="result-filters">{['all','announced','waiting','upcoming'].map(id=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{id==='all'?'ทั้งหมด':labels[id]} ({id==='all'?rows.length:rows.filter(r=>r.state===id).length})</button>)}</div>
      <div className="today-table-wrap"><table className="today-table"><thead><tr><th>เวลาออก</th><th>หวย</th><th>3 ตัวบน</th><th>2 ตัวล่าง</th><th>สถานะ</th></tr></thead><tbody>{shown.map(({item,state})=>{const n=getResultNumbers(item);return <tr key={item.id}><td>{item.drawTimeStr||'—'}</td><th scope="row">{item.flag} {item.name}<small className="row-state">{labels[state]}</small></th><td className="table-number">{n.top3||'—'}</td><td className="table-number bottom-number">{n.bottom2||'—'}</td><td><span className={`result-status ${state}`}>{labels[state]}</span></td></tr>;})}</tbody></table></div>{!shown.length&&<p className="empty-state">ไม่มีรายการในสถานะนี้</p>}
      <p className="updated-at">หวยรัฐบาล ออมสิน และ ธ.ก.ส. แสดงเฉพาะงวดที่มีผลหรือวันงวดที่ยืนยันไว้ตรงกับวันนี้</p>
    </section>
  </div>;
}

function exportHistoryPng(name:string,flag:string,history:Row[]) {
  const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');if(!ctx)throw new Error('อุปกรณ์ไม่รองรับการสร้างรูป');
  canvas.width=1000;canvas.height=240+history.length*86;
  ctx.fillStyle='#650d12';ctx.fillRect(0,0,1000,canvas.height);
  const gold=ctx.createLinearGradient(0,0,0,160);gold.addColorStop(0,'#fff0a8');gold.addColorStop(1,'#c78b00');ctx.fillStyle=gold;ctx.fillRect(0,0,1000,160);
  ctx.textAlign='center';ctx.fillStyle='#352000';ctx.font='bold 42px sans-serif';ctx.fillText(`${flag} ${name}`,500,67);ctx.font='28px sans-serif';ctx.fillText(`ผลย้อนหลัง ${history.length} งวด`,500,115);
  ctx.fillStyle='#ffe792';ctx.font='bold 27px sans-serif';['งวดวันที่','3 ตัวบน','2 ตัวล่าง'].forEach((s,i)=>ctx.fillText(s,[210,580,825][i],211));
  history.forEach((row,i)=>{const y=240+i*86;ctx.fillStyle=i%2?'#790f15':'#950f18';ctx.fillRect(18,y,964,80);ctx.fillStyle='#fff2bf';ctx.font='30px sans-serif';ctx.fillText(displayDate(rowDate(row)),210,y+52);ctx.font='bold 42px sans-serif';const n=getResultNumbers(row);ctx.fillText(n.top3,580,y+54);ctx.fillText(n.bottom2,825,y+54);});
  const link=document.createElement('a');link.download=`history-${name}-${history.length}.png`;link.href=canvas.toDataURL('image/png');link.click();
}
export function IndividualHistory({lotteries,results,showStats=false,initialLotteryId=''}:{lotteries:LotteryItem[];results:Row[];showStats?:boolean;initialLotteryId?:string}) {
  const [selected,setSelected]=useState(initialLotteryId);const [query,setQuery]=useState('');const [limit,setLimit]=useState(10);const [notice,setNotice]=useState('');const [stats,setStats]=useState(showStats);
  const catalog=useMemo(()=>{
    const items:Row[]=[...lotteries];
    for(const row of results){if(!complete(row)||items.some(item=>matchesLottery(item,row)))continue;const name=rowName(row);if(!name||/LIW|ปิงปอง|ยี่กี/i.test(name))continue;items.push({id:normalizeLotteryIdentity(name),name,flag:'',drawTimeStr:''});}
    return items.sort((a,b)=>a.name.localeCompare(b.name,'th'));
  },[lotteries,results]);
  const item=catalog.find(item=>item.id===selected);
  const history=useMemo(()=>item?lotteryHistory(item,results,limit):[],[item,results,limit]);
  const summaryText=item?`${item.name}\nวันที่ | 3 ตัวบน | 2 ตัวล่าง\n`+history.map(row=>{const n=getResultNumbers(row);return `${displayDate(rowDate(row))} | ${n.top3} | ${n.bottom2}`;}).join('\n'):'';
  const copy=async()=>{try{await navigator.clipboard.writeText(summaryText);setNotice('คัดลอกผลแล้ว');}catch{setNotice('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความสรุปด้านล่างเพื่อคัดลอกได้');}};
  const counts=new Map<string,number>();for(const row of history){const value=getResultNumbers(row).bottom2;counts.set(value,(counts.get(value)||0)+1);}
  return <section className="results-panel individual-history">
    {!item?<><h2>เลือกหวยเพื่อดูผลย้อนหลัง</h2><p>แยกรายหวยและรอบ ไม่มีการรวมลาวหรือหุ้นไว้เป็นผลเดียว</p><label className="history-search">ค้นหาชื่อหวย<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="เช่น ลาวพัฒนา หรือ ฮานอย VIP"/></label><div className="lottery-directory">{catalog.filter(item=>item.name.toLowerCase().includes(query.toLowerCase())).map(item=>{const latest=lotteryHistory(item,results,1)[0];const n=getResultNumbers(latest);return <button key={item.id} onClick={()=>{setSelected(item.id);setNotice('');}}><span>{item.flag} {item.name}<small>{item.drawTimeStr||'เวลาออกยังไม่ยืนยัน'}</small></span><strong>{latest?`${n.top3} – ${n.bottom2}`:'ยังไม่มีผล'}<small>{latest?displayDate(rowDate(latest)):'ดูรายละเอียด'}</small></strong></button>;})}</div></>:
    <><button className="history-back" onClick={()=>{setSelected('');setNotice('');}}><ArrowLeft size={18}/> เลือกหวยอื่น</button><div className="history-title"><span>{item.flag}</span><h2>{item.name}</h2><p>ผลย้อนหลัง เรียงงวดใหม่ไปเก่า</p></div><div className="result-filters">{[10,20,30].map(n=><button key={n} aria-pressed={limit===n} onClick={()=>setLimit(n)}>{n} งวด</button>)}<button aria-pressed={stats} onClick={()=>setStats(!stats)}>สถิติ 2 ตัวล่าง</button></div>
    <div className="history-sheet"><table><thead><tr><th>งวดวันที่</th><th>3 ตัวบน</th><th>2 ตัวล่าง</th></tr></thead><tbody>{history.map(row=>{const n=getResultNumbers(row);return <tr key={dayKey(rowDate(row))}><td>{displayDate(rowDate(row))}</td><td>{n.top3}</td><td>{n.bottom2}</td></tr>;})}</tbody></table></div>
    {!history.length?<p className="empty-state">ยังไม่มีผลที่ยืนยันแล้วสำหรับหวยนี้</p>:<><p className="updated-at">มีข้อมูลจริง {history.length} จาก {limit} งวดที่เลือก</p><div className="history-actions"><button onClick={copy}><Copy size={18}/> คัดลอกผล</button><button onClick={()=>{try{exportHistoryPng(item.name,item.flag||'',history);}catch{setNotice('สร้างรูปไม่สำเร็จ กรุณาลองใหม่');}}}><Download size={18}/> ดาวน์โหลดรูป PNG</button></div><details><summary>ข้อความสำหรับคัดลอกและส่งต่อ</summary><pre className="copyable-results">{summaryText}</pre></details></>}
    {stats&&history.length>0&&<section className="simple-statistics"><h3>จำนวนครั้งที่ออก · 2 ตัวล่าง</h3><p>คำนวณจาก {history.length} งวดที่แสดง ไม่ใช่การทำนาย</p><div>{[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([number,count])=><span key={number}><strong>{number}</strong> {count} ครั้ง</span>)}</div></section>}
    {notice&&<p role="status">{notice}</p>}</>}
  </section>;
}
