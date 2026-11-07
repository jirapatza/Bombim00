import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/data/lotteryRepository.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { LotteryRepository: R, validateLiveData } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const row = {ชื่อหวย: 'สลากกินแบ่งรัฐบาล', งวดวันที่: '2026-11-01', รางวัลที่_1: '123456', เลขท้าย_2_ตัว: '85', เลขหน้า_3_ตัว: ['789'], เลขท้าย_3_ตัว: ['012, 345']};
R.results = [row, {...row, งวดวันที่: '2020-01-01', เลขท้าย_2_ตัว: '99'}];
const key = R.getTicketDraws()[0].key;
test('explicit draw required and old results cannot leak into chosen draw', () => {
  assert.deepEqual(R.checkTickets('99', ''), []);
  assert.equal(R.checkTickets('99', key)[0].isWin, false);
  assert.equal(R.checkTickets('85', key)[0].isWin, true);
});
test('full tickets check front and rear prizes, returning every match', () => {
  assert.equal(R.checkTickets('999985', key)[0].isWin, true);
  assert.equal(R.checkTickets('789012', key).length, 2);
  assert.equal(R.checkTickets('999345', key)[0].isWin, true);
  assert.equal(R.checkTickets('456', key)[0].isWin, false);
  assert.equal(R.checkTickets('123456', key)[0].prizeType, 'รางวัลที่ 1 เต็มใบ');
});
test('invalid input is rejected without stripping characters', () => {
  assert.equal(R.checkTickets('abc85', key)[0].isWin, false);
});
test('countdown skips weekends and irregular draws without confirmed dates', () => {
  const stock = {id:'stock', drawDays:'จันทร์ - ศุกร์', closeTimeStr:'10:00'};
  const irregular = {id:'gov', drawDays:'ตามประกาศวันงวดจริง (อาจเลื่อน)', closeTimeStr:'09:00'};
  const next = R.getNextClosingLottery([stock, irregular], new Date('2026-11-07T01:00:00Z'));
  assert.equal(next.item.id, 'stock');
  assert.equal(next.remaining, 'เหลืออีก 50 ชม. 0 นาที');
  assert.equal(R.getNextClosingLottery([irregular]), null);
});
test('malformed live rows rejected before replacing cached data', () => {
  const catalog = [{id:'test',name:'test',category:'stock',categoryLabel:'stock',period:'morning',periodLabel:'morning',flag:'',drawTimeStr:'10:00',closeTimeStr:'09:00',drawDays:'จันทร์ - ศุกร์'}];
  const status = {system_status:'healthy',last_run_timestamp:'2026-11-07T00:00:00Z',last_run_date_thai:'',status_message:'',last_source_used:'',total_checks:1};
  validateLiveData(catalog, [row], status);
  assert.throws(() => validateLiveData(catalog, [{...row, เลขหน้า_3_ตัว:'789'}], status));
  assert.throws(() => validateLiveData(catalog, [{...row, ชื่อหวย:7}], status));
});
