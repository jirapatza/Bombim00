import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collect, parseRound, rounds, parseExtra, parseStocks, parseThaiApi, parseGovernment } from '../src/providers.js';
import { numbers, scheduled, bangkokDay } from '../src/domain.js';

const today = '2026-11-03', now = new Date(today + 'T10:00:00Z');
function envelope(slug = 'lao-union') {
  return { success: true, data: [{ lottery: slug, drawDate: today, status: 'complete', pendingPrizes: [], prizes: [
    { name: '3 ตัวบน', numbers: ['007'] }, { name: '2 ตัวล่าง', numbers: ['90'] },
  ] }] };
}
test('captured upstream responses match the pre-port Python regression prizes', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/lotterychecks-2026-11-03.json', import.meta.url)));
  for (const [slug, expected] of [['lao-union', ['853', '08']], ['hanoi-develop', ['910', '09']]]) {
    assert.deepEqual(numbers(parseRound(fixture.responses[slug], slug, today, now)[0]), expected);
  }
});
test('all nine rounds require the right date, round identity, complete state and explicit lower prize', () => {
  for (const slug of Object.keys(rounds)) {
    assert.deepEqual(numbers(parseRound(envelope(slug), slug, today, now)[0]), ['007', '90']);
    for (const change of [{ lottery: 'wrong-round-vip' }, { drawDate: '2026-11-02' }, { drawDate: '2026-11-04' },
      { status: 'pending' }, { pendingPrizes: ['bottom'] }, { prizes: [{ name: 'รางวัลพิเศษ', numbers: ['90007'] }] },
      { prizes: [{ name: '3 ตัวบน', numbers: [7] }, { name: '2 ตัวล่าง', numbers: ['90'] }] }]) {
      const data = envelope(slug); Object.assign(data.data[0], change);
      assert.deepEqual(parseRound(data, slug, today, now), []);
    }
  }
  const data = envelope(); data.data.push(structuredClone(data.data[0])); data.data[1].prizes[1].numbers = ['91'];
  assert.deepEqual(parseRound(data, 'lao-union', today, now), []);
});
test('stock headings keep normal/VIP/special/VISA separate, FAQ and cross-group leakage rejected', () => {
  const html = ['หวยหุ้นต่างประเทศ', 'หวยหุ้น VIP', 'หวยหุ้นพิเศษ', 'หวยหุ้น VISA'].map((group, i) =>
    `<h2>${group}</h2><h3>หวยหุ้นทดสอบ ${i}</h3><p>งวด 3 พฤศจิกายน 2569</p><p>3 ตัวบน <b>007</b></p><p>2 ตัวล่าง 90</p>`).join('') +
    '<h2>ไม่ใช่กลุ่มผล</h2><h3>หวยหุ้นหลอก</h3><p>งวด 3 พฤศจิกายน 2569 3 ตัวบน 999 2 ตัวล่าง 99</p>';
  const rows = parseStocks(html, now);
  assert.deepEqual(rows.map(x => x.หมวดหวย), ['stock', 'stock_vip', 'stock_special', 'stock_visa']);
  assert.deepEqual(numbers(rows[0]), ['007', '90']);
});
test('Lao EXTRA requires explicit prize table, matching five-digit tail and today', () => {
  const html = '<h1>หวยลาว EXTRA</h1><table><tr><th>งวดวันที่</th><th>รางวัลพิเศษ</th><th>3 ตัวบน</th><th>2 ตัวล่าง</th></tr>' +
    '<tr><td>3 พฤศจิกายน 2569</td><td>90007</td><td>007</td><td>90</td></tr></table>';
  assert.deepEqual(numbers(parseExtra(html, today, now)[0]), ['007', '90']);
  assert.deepEqual(parseExtra(html.replace('90007', '90008'), today, now), []);
  assert.deepEqual(parseExtra(html, '2026-11-04', now), []);
  assert.deepEqual(parseExtra(html.replace('2 ตัวล่าง', 'ไม่ระบุ'), today, now), []);
});
test('ThaiLottoAPI never derives lower-two from first prize, rejects rogue and unfinished items', () => {
  const item = { key: 'hanoylotto', label: 'ฮานอยปกติ', drawDate: today, status: 'success', result: '007-90' };
  const parse = x => parseThaiApi({ ok: true, categories: { lottoforeign: { items: [x] } } }, now);
  assert.deepEqual(numbers(parse(item)[0]), ['007', '90']);
  assert.deepEqual(parse({ ...item, result: '90007' }), []);
  assert.deepEqual(parse({ ...item, status: 'waiting' }), []);
  assert.deepEqual(parse({ ...item, label: 'LIW' }), []);
  const gov = parse({ ...item, key: 'thailotto', label: 'สลากกินแบ่งรัฐบาล', firstPrize: '900007', result: '', bottom2: '90' });
  assert.equal(gov[0].รางวัลที่_1, '900007');
});
test('government feed cannot invent digits, and accepts moved dates only from full dated results', () => {
  const data = { success: true, data: { state: 'published', date: '2026-11-17', result: { first_prize: '900007', last_two: '90' } } };
  const row = parseGovernment(data, 'ranlotto', now)[0]; assert.equal(row.รางวัลที่_1, '900007');
  data.data.result.last_two = '9'; assert.deepEqual(parseGovernment(data, 'ranlotto', now), []);
  const catalog = [{ id: 'thai_gov', name: 'สลากกินแบ่งรัฐบาล', drawDays: 'ตามประกาศวันงวดจริง (อาจเลื่อน)' }];
  assert.equal(scheduled(row, catalog, '2026-11-17'), true);
  assert.equal(bangkokDay(new Date('2026-11-03T17:00:00Z')), '2026-11-04');
});
test('collection includes independent fallbacks after failures, preserves API order and host-safe requests', async () => {
  const calls = [], settings = { sources: { thailottoapi: { enabled: true }, lotterychecks: { enabled: true } } };
  const data = await collect(settings, today, now, async url => {
    calls.push(url);
    if (url.includes('thailottoapi')) throw new Error('source down');
    if (url.includes('lottery=hanoi-asean')) return Response.json(envelope('hanoi-asean'));
    if (url.includes('lotterychecks')) return Response.json({ success: true, data: [] });
    return new Response('');
  });
  assert.deepEqual(data.rows.map(x => x.หวย), ['hanoi_asean']);
  assert.deepEqual(data.errors, ['ThaiLottoAPI']); assert.ok(calls.length <= 16);
});
