import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collect, parseRound, rounds, GATED_ROUNDS, parseExtra, parseStocks, parseThaiApi, parseGovernment, parseChecksStock, CHECKS_STOCK_PAGES, MAX_GATED_READS, PHOLHUAY_STOCK_PAGE, PHOLHUAY_EXTRA_PAGE } from '../src/providers.js';
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
  assert.deepEqual(data.errors, [{ source: 'ThaiLottoAPI', status: null, reason: 'network' }]);
  assert.ok(calls.length <= 16);
});

test('LotteryChecks dated no-result responses stay separate from HTTP and response failures', async () => {
  const settings = { sources: { lotterychecks: { enabled: true }, glo: { enabled: true } } };
  const { rows, waiting, errors } = await collect(settings, today, now, async (url, options) => {
    if (url.includes('glo.or.th')) {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['Content-Type'], 'application/json');
      return new Response(null, { status: 503 });
    }
    if (url.includes('lottery=thai-government')) return Response.json({ success: true, data: [] });
    if (url.includes('lottery=hanoi-hd')) return new Response('<html>Not found</html>', { status: 404 });
    if (url.includes('lottery=hanoi-tv')) return Response.json({ success: true, data: [{ lottery: 'hanoi-tv',
      drawDate: today, status: 'announced', pendingPrizes: ['last-two-digit'] }] });
    if (url.includes('lottery=hanoi-star')) return Response.json({ success: true, data: [{ lottery: 'hanoi-star',
      drawDate: today, status: 'complete', prizes: [] }] });
    if (url.includes('lotterychecks')) return Response.json({ success: false,
      error: 'หวยชนิดนี้ยังไม่มีผลให้แสดง' }, { status: 404 });
    return new Response('');
  });
  assert.deepEqual(rows, []);
  assert.equal(waiting.length, 7);
  assert.deepEqual(waiting.find(x => x.lottery === 'ฮานอย TV'), { source: 'LotteryChecks Lao/Hanoi', lottery: 'ฮานอย TV', status: 200 });
  assert.deepEqual(errors.find(x => x.lottery === 'ฮานอย HD'), { source: 'LotteryChecks Lao/Hanoi', lottery: 'ฮานอย HD', status: 404, reason: 'http' });
  assert.deepEqual(errors.find(x => x.lottery === 'ฮานอย STAR'), { source: 'LotteryChecks Lao/Hanoi', lottery: 'ฮานอย STAR', status: 200, reason: 'invalid_response' });
  assert.deepEqual(errors.find(x => x.source === 'glo'), { source: 'glo', lottery: 'สลากกินแบ่งรัฐบาล', status: 503, reason: 'http' });
});

test('GLO official response uses its declared draw date and named prize groups', () => {
  const prize = (...values) => ({ number: values.map((value, index) => ({ round: index + 1, value })) });
  const data = { response: { date: today, data: {
    first: prize('000007'), last2: prize('09'),
    last3f: prize('001', '002'), last3b: prize('003', '004'),
  } } };
  const [draw] = parseGovernment(data, 'glo', now);
  assert.equal(draw.งวดวันที่, today);
  assert.equal(draw.รางวัลที่_1, '000007');
  assert.equal(draw.เลขท้าย_2_ตัว, '09');
  assert.deepEqual(draw.เลขหน้า_3_ตัว, ['001', '002']);
  assert.deepEqual(draw.เลขท้าย_3_ตัว, ['003', '004']);
});
test('stock cards carry the catalog id instead of their Thai label', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../data/all_lotteries.json', import.meta.url)));
  const html = '<h2>หวยหุ้นต่างประเทศ</h2>' +
    '<h3>หวยหุ้นนิคเคอิเช้า</h3><p>งวด 3 พฤศจิกายน 2569</p><p>3 ตัวบน <b>007</b></p><p>2 ตัวล่าง 90</p>' +
    '<h3>หวยหุ้นใหม่ที่ยังไม่มีในสารบัญ</h3><p>งวด 3 พฤศจิกายน 2569</p><p>3 ตัวบน 123</p><p>2 ตัวล่าง 45</p>';
  const rows = parseStocks(html, now, catalog);
  assert.equal(rows[0].หวย, 'nikkei_morning');
  assert.equal(rows[0].ชื่อหวย, 'หวยหุ้นนิคเคอิเช้า');
  // An unknown label must still be published, keeping the previous behaviour.
  assert.equal(rows[1].หวย, 'หวยหุ้นใหม่ที่ยังไม่มีในสารบัญ');
  // Without a catalog the parser stays backward compatible.
  assert.equal(parseStocks(html, now)[0].หวย, 'หวยหุ้นนิคเคอิเช้า');
});
test('the scraped pages can be overridden and a bad override is reported', async () => {
  const requested = [];
  const settings = { sources: { pholhuay: {
    enabled: true,
    stock_page_url: 'https://example.test/stock',
    extra_page_url: 'http://insecure.test/extra',
  } } };
  const { errors } = await collect(settings, today, now, async url => {
    requested.push(url);
    return { ok: true, status: 200, text: async () => '<html></html>', body: { cancel: async () => {} } };
  });
  const override = requested.map(url => new URL(url)).find(u => u.pathname === '/stock');
  assert.equal(override?.origin, 'https://example.test');
  // http:// is refused: the built-in https page is used and the typo is reported.
  assert.ok(requested.includes(PHOLHUAY_EXTRA_PAGE));
  assert.ok(!requested.some(url => url.startsWith('http://')));
  // The stub answers HTML to every call, so only the URL typo is asserted here.
  assert.deepEqual(errors.filter(x => x.reason === 'invalid_url').map(x => x.source), ['ผลหวย.com Lao EXTRA']);
});

test('without overrides the built-in pages are used', async () => {
  const requested = [];
  await collect({ sources: { pholhuay: { enabled: true } } }, today, now, async url => {
    requested.push(url);
    return { ok: true, status: 200, text: async () => '<html></html>', body: { cancel: async () => {} } };
  });
  assert.ok(requested.includes(PHOLHUAY_STOCK_PAGE));
  assert.ok(requested.includes(PHOLHUAY_EXTRA_PAGE));
});

test('ThaiLottoAPI is polled without sync so it answers inside the per-call cap', async () => {
  const calls = [];
  await collect({ sources: { thailottoapi: { enabled: true } } }, today, now, async url => {
    calls.push(url);
    return Response.json({ ok: true, date: today, categories: {} });
  });
  const api = calls.find(url => url.includes('thailottoapi'));
  assert.ok(api, 'ThaiLottoAPI was requested');
  const parsed = new URL(api);
  assert.equal(parsed.searchParams.get('sync'), null, 'sync=1 takes 6-45s upstream');
  assert.equal(parsed.searchParams.get('date'), today);
});

test('a VIP stock page yields one row for today and nothing for another date', () => {
  const html = '<h1>หวยหุ้นรัสเซีย VIP</h1><p>งวด 3 พฤศจิกายน 2569</p><p>3 ตัวบน <b>021</b></p><p>2 ตัวล่าง 04</p>';
  const rows = parseChecksStock(html, 'russia_vip', today, now);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].หวย, rows[0].ชื่อหวย, rows[0].หมวดหวย], ['russia_vip', 'รัสเซีย VIP', 'vip']);
  assert.deepEqual(numbers(rows[0]), ['021', '04']);
  assert.equal(rows[0].source_family, 'lotterychecks');
  assert.deepEqual(parseChecksStock(html, 'russia_vip', '2026-11-04', now), []);
  assert.deepEqual(parseChecksStock('<p>no headline</p>', 'russia_vip', today, now), []);
  assert.deepEqual(parseChecksStock(html, 'unknown_vip', today, now), []);
});

test('the VIP page is read only after its close and only while the draw is missing', async () => {
  const catalog = [{ id: 'russia_vip', name: 'รัสเซีย VIP', closeTimeStr: '23:40 น.' }];
  const settings = { sources: { lotterychecks: { enabled: true } } };
  const page = '<p>งวด 3 พฤศจิกายน 2569 3 ตัวบน 021 2 ตัวล่าง 04</p>';
  const calls = [];
  const request = async url => { calls.push(url); return new Response(url.includes('stock-markets') ? page : '{}'); };

  // 15:00 Bangkok: the draw has not closed yet.
  await collect(settings, today, now, request, catalog, new Set(), []);
  assert.deepEqual(calls.filter(x => x.includes('stock-markets')), []);

  // 23:41 Bangkok: due, so the page is read and the row comes back.
  const late = new Date(`${today}T23:41:00+07:00`);
  const first = await collect(settings, today, late, request, catalog, new Set(), []);
  assert.deepEqual(calls.filter(x => x.includes('stock-markets')), ['https://lotterychecks.com/stock-markets/russia-vip']);
  assert.deepEqual(first.rows.map(x => x.หวย), ['russia_vip']);

  // Once today's row is stored the page is not requested again.
  calls.length = 0;
  await collect(settings, today, late, request, catalog, new Set(), [first.rows[0]]);
  assert.deepEqual(calls.filter(x => x.includes('stock-markets')), []);
});

test('a gated round is parsed with its catalog id, name and category', () => {
  const payload = { success: true, data: [{ lottery: 'lao-union-vip', drawDate: today, status: 'complete', pendingPrizes: [],
    prizes: [{ name: 'รางวัลพิเศษ', numbers: ['48605'] }, { name: '3 ตัวบน', numbers: ['605'] }, { name: '2 ตัวล่าง', numbers: ['86'] }] }] };
  const rows = parseRound(payload, 'lao-union-vip', today, now);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].หวย, rows[0].ชื่อหวย, rows[0].หมวดหวย], ['lao_samakki_vip', 'ลาวสามัคคี VIP', 'vip']);
  assert.deepEqual(numbers(rows[0]), ['605', '86']);
  assert.deepEqual(parseRound(payload, 'not-a-round', today, now), []);
});

test('gated rounds are read only after their close and only while missing', async () => {
  const catalog = Object.values(GATED_ROUNDS).map(([id, name]) => ({ id, name, closeTimeStr: '20:45 น.' }));
  const settings = { sources: { lotterychecks: { enabled: true } } };
  const calls = [];
  const request = async url => { calls.push(url); return new Response('{}'); };
  const gated = () => calls.filter(x => x.includes(`date=${today}`) && x.includes('lottery=') &&
    !x.includes('thai-government') && !rounds[x.split('lottery=')[1].split('&')[0]]);

  await collect(settings, today, now, request, catalog, new Set(), []);
  assert.deepEqual(gated(), [], 'nothing is read before the close');

  const late = new Date(`${today}T21:00:00+07:00`);
  calls.length = 0;
  await collect(settings, today, late, request, catalog, new Set(), []);
  // A cycle serves up to the cap; the queue rotates the rest in later.
  assert.equal(gated().length, Math.min(MAX_GATED_READS, Object.keys(GATED_ROUNDS).length), 'due draws are read up to the cap');

  calls.length = 0;
  const stored = Object.keys(GATED_ROUNDS).map(slug => ({ หวย: GATED_ROUNDS[slug][0], งวดวันที่: today,
    เลขบน_3_ตัว: '605', เลขล่าง_2_ตัว: '86' }));
  await collect(settings, today, late, request, catalog, new Set(), stored);
  assert.deepEqual(gated(), [], 'a stored draw is not read again');
});

test('a capped cycle serves the earliest deadlines first and never exceeds the cap', async () => {
  const ids = Object.keys(CHECKS_STOCK_PAGES);
  const catalog = ids.map((id, i) => ({ id, name: id, closeTimeStr: `${String(10 + i).padStart(2, '0')}:00 น.` }));
  const calls = [];
  const request = async url => { calls.push(url); return new Response('{}'); };
  await collect({ sources: { lotterychecks: { enabled: true } } }, today, new Date(`${today}T23:59:00+07:00`),
    request, catalog, new Set(), []);
  const stock = calls.filter(x => x.includes('/stock-markets/'));
  assert.equal(stock.length, 8, 'the cap keeps one cycle inside the subrequest budget');
  assert.deepEqual([...new Set(stock)].length, 8);
  const earliest = ids.slice(0, 8).map(id => `https://lotterychecks.com${CHECKS_STOCK_PAGES[id][1]}`);
  assert.deepEqual(stock.sort(), earliest.sort(), 'the earliest closes are read first');
});

test('the GLO request carries the origin headers its API requires', async () => {
  const seen = [];
  const request = async (url, options) => { seen.push({ url, options }); return new Response('{}'); };
  await collect({ sources: { glo: { enabled: true } } }, today, now, request, [], new Set(), []);
  const glo = seen.find(x => x.url.includes('glo.or.th'));
  assert.ok(glo, 'the GLO endpoint was called');
  assert.equal(glo.options.method, 'POST');
  assert.equal(glo.options.headers.Referer, 'https://www.glo.or.th/');
  assert.equal(glo.options.headers.Origin, 'https://www.glo.or.th');
});

test('ไทยเย็น is read from its own page once the draw closes, and only then', async () => {
  const catalog = [{ id: 'thai_stock_evening', name: 'ไทยเย็น', closeTimeStr: '16:00 น.' }];
  const calls = [];
  const request = async url => { calls.push(url); return new Response('<html></html>'); };
  const settings = { sources: { pholhuay: { enabled: false } } };

  const at = hour => new Date(`${today}T${hour}:00+07:00`);
  await collect(settings, today, at('15:00'), request, catalog, new Set(), []);
  assert.deepEqual(calls.filter(x => x.includes('stock-lottery')), [], 'not read before the close');

  await collect(settings, today, at('17:00'), request, catalog, new Set(), []);
  assert.equal(calls.filter(x => x.includes('stock-lottery')).length, 1, 'read once the draw is due');

  calls.length = 0;
  const stored = [{ หวย: 'thai_stock_evening', งวดวันที่: today, เลขบน_3_ตัว: '265', เลขล่าง_2_ตัว: '84' }];
  await collect(settings, today, at('17:00'), request, catalog, new Set(), stored);
  assert.deepEqual(calls.filter(x => x.includes('stock-lottery')), [], 'a stored draw is not read again');

  calls.length = 0;
  await collect({ sources: { pholhuay: { enabled: false, thai_evening: false } } }, today,
    at('17:00'), request, catalog, new Set(), []);
  assert.deepEqual(calls.filter(x => x.includes('stock-lottery')), [], 'the explicit switch turns it off');
});

test('a missing past draw is backfilled from the dated API, newest first and capped', async () => {
  const catalog = [['hanoi_vip', 'ฮานอย VIP'], ['lao_vip', 'ลาว VIP'], ['lao_extra', 'ลาว EXTRA']]
    .map(([id, name]) => ({ id, name, closeTimeStr: '19:05 น.', drawDays: 'ทุกวัน (จันทร์ - อาทิตย์)' }));
  const settings = { sources: { lotterychecks: { enabled: true } } };
  const calls = [];
  const request = async url => {
    calls.push(url);
    const lottery = new URL(url).searchParams.get('lottery'), date = new URL(url).searchParams.get('date');
    return Response.json({ success: true, data: [{ lottery, drawDate: date, status: 'complete', pendingPrizes: [],
      prizes: [{ name: '3 ตัวบน', numbers: ['123'] }, { name: '2 ตัวล่าง', numbers: ['45'] }] }] });
  };
  const late = new Date(`${today}T21:00:00+07:00`);
  const { backfill } = await collect(settings, today, late, request, catalog, new Set(), []);
  const dates = [...new Set(backfill.map(x => x.งวดวันที่))];

  assert.equal(backfill.length, 2, 'the per-cycle cap is honoured');
  assert.equal(dates.length, 1, 'one draw is filled per lottery');
  assert.ok(!dates.includes(today), 'today is never backfilled');
  assert.ok(backfill.every(x => x.สถานะการแจ้งเตือน === 'backfilled'), 'backfilled rows are marked so they are never pushed');
  assert.equal(backfill[0].เลขบน_3_ตัว, '123');
  assert.equal(backfill[0].เลขล่าง_2_ตัว, '45');

  const newest = bangkokDay(new Date(late.getTime() - 86_400_000));
  const stored = backfill.map(x => ({ หวย: x.หวย, งวดวันที่: x.งวดวันที่, เลขบน_3_ตัว: '1', เลขล่าง_2_ตัว: '2' }));
  calls.length = 0;
  const next = await collect(settings, today, late, request, catalog, new Set(), stored);
  assert.ok(next.backfill.every(x => !stored.some(s => s.หวย === x.หวย && s.งวดวันที่ === x.งวดวันที่)), 'a filled draw is not refetched');
  assert.ok(!calls.some(x => x.includes(`date=${newest}`) && x.includes('lottery=hanoi-vip') && stored.some(s => s.หวย === 'hanoi_vip')), 'stored dates are skipped');
});
