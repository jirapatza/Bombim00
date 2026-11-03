import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, minutes, complete, rowName } from '../src/utils/overviewResults.ts';

test('normalizes actual provider dates including postponed and Buddhist calendar dates', () => {
  assert.equal(dayKey('17.11.2026'), '2026-11-17');
  assert.equal(dayKey('2/11/2569'), '2026-11-02');
  assert.equal(dayKey('2026-11-03T00:10:00+07:00'), '2026-11-03');
  assert.equal(dayKey('3 พฤศจิกายน 2569'), '2026-11-03');
  assert.equal(dayKey('ไม่ระบุ'), '');
});
test('a draw requires both published numbers, preserving real leading zeros', () => {
  assert.equal(complete({top3:'007',bottom2:'00'}), true);
  assert.equal(complete({top3:'007',bottom2:''}), false);
  assert.equal(complete({top3:'',bottom2:'00'}), false);
  assert.equal(complete({status:'announced'}), false);
});
test('schedule parsing handles midnight without fabricating missing times', () => {
  assert.equal(minutes('00:30 น.'), 30);
  assert.equal(minutes('23:55'), 1435);
  assert.equal(minutes('รอประกาศ'), null);
  assert.equal(rowName({ชื่อหวย:'ลาว VIP'}), 'ลาว VIP');
});

import { latestPublishedResults, todayLotteryRows, lotteryHistory, publishedTime } from '../src/utils/overviewResults.ts';
import { matchesLottery } from '../src/utils/lotteryResult.ts';
const catalog=[
 {id:'lao_extra',name:'ลาว EXTRA',category:'lao',drawDays:'ทุกวัน',drawTimeStr:'08:30 น.'},
 {id:'nikkei_vip_morning',name:'นิเคอิเช้า VIP',category:'vip',drawTimeStr:'09:05 น.'},
 {id:'hanoi_vip',name:'ฮานอย VIP',category:'hanoi',drawTimeStr:'19:30 น.'},
 {id:'lao_patthana',name:'ลาวพัฒนา',category:'lao',drawTimeStr:'20:30 น.'},
 {id:'lao_samakki',name:'ลาวสามัคคี',category:'lao',drawTimeStr:'20:30 น.'},
 {id:'thai_gov',name:'สลากกินแบ่งรัฐบาล (ไทย)',category:'gov_savings',drawTimeStr:'16:00 น.'},
];
const result=(name,date='03.11.2026',extra={})=>({ชื่อหวย:name,งวดวันที่:date,top3:'007',bottom2:'00',...extra});
const now=new Date('2026-11-03T21:00:00+07:00');
test('last three follow draw chronology, not a refreshed morning detection timestamp',()=>{
 const rows=[result('ลาว EXTRA',undefined,{เวลาที่ตรวจพบ:'2026-11-03T22:00:00+07:00'}),result('หวยหุ้นนิคเคอิ VIP เช้า'),result('ฮานอย VIP'),result('หวยลาวพัฒนา'),result('ลาวสามัคคี')];
 const latest=latestPublishedResults(rows,catalog,now);
 assert.deepEqual(new Set(latest.map(x=>x.item.id)),new Set(['lao_patthana','lao_samakki','hanoi_vip']));
 assert.equal(matchesLottery(catalog[1],rows[1]),true);
 assert.equal(matchesLottery(catalog[1],result('นิเคอิรอบเช้า')),false);
 assert.equal(matchesLottery(catalog[3],result('ลาวพัฒนาพิเศษ')),false);
 assert.equal(latestPublishedResults([result('ไม่มีเวลา',undefined,{เวลาที่ตรวจพบ:now.toISOString()})],catalog,now).length,0);
});
test('today table stays ascending regardless of state; old government draws do not appear',()=>{
 const rows=todayLotteryRows(catalog,[result('ลาวพัฒนา'),result('สลากกินแบ่งรัฐบาล','01.11.2026')],now);
 assert.deepEqual(rows.map(x=>x.item.id),['lao_extra','nikkei_vip_morning','hanoi_vip','lao_patthana','lao_samakki']);
 assert.equal(rows.find(x=>x.item.id==='lao_patthana').item.top3,'007');
 const postponed=todayLotteryRows(catalog,[result('สลากกินแบ่งรัฐบาล','17.11.2026')],new Date('2026-11-17T17:00:00+07:00'));
 assert.equal(postponed.some(x=>x.item.id==='thai_gov'),true);
 assert.equal(todayLotteryRows(catalog,[],new Date('2026-11-01T10:00:00+07:00')).some(x=>x.item.id==='thai_gov'),false,'never infer government draw date from day 1');
});
test('history matches aliases and deduplicates dates without mixing rounds or losing zeroes',()=>{
 const rows=[result('ฮานอย VIP','02.11.2026'),result('ฮานอยปกติ','03.11.2026'),{หวย:'hanoylottovip',งวดวันที่:'2 พฤศจิกายน 2569',top3:'007',bottom2:'00'},result('ฮานอย VIP','01.11.2026')];
 const history=lotteryHistory(catalog[2],rows,10);
 assert.equal(history.length,2);assert.equal(history[0].top3,'007');
 assert.equal(dayKey('31.02.2026'),'');assert.equal(dayKey('3 พ.ย. 2569'),'2026-11-03');
 assert.ok(Number.isNaN(publishedTime(result('unknown'))));
});

test('a recognized provider code overrides a conflicting legacy display name',()=>{
 const old={หวย:'hanoi_patthana',ชื่อหวย:'ฮานอย VIP',งวดวันที่:'03.11.2026',top3:'007',bottom2:'00'};
 assert.equal(matchesLottery({id:'hanoi_vip',name:'ฮานอย VIP'},old),false);
 assert.equal(matchesLottery({id:'hanoi_patthana',name:'ฮานอยพัฒนา'},old),true);
});
