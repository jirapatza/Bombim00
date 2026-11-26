import { bangkokDay, canonical, disallowed, drawDate, numbers, scheduleName, scheduled } from './domain.js';

export const rounds = {
  'lao-union': ['lao_samakki', 'ลาวสามัคคี', 'lao'],
  'hanoi-develop': ['hanoi_patthana', 'ฮานอยพัฒนา', 'hanoi'],
  'hanoi-asean': ['hanoi_asean', 'ฮานอยอาเซียน', 'hanoi'],
  'hanoi-hd': ['hanoi_hd', 'ฮานอย HD', 'hanoi'],
  'hanoi-star': ['hanoi_star', 'ฮานอย STAR', 'hanoi'],
  'hanoi-tv': ['hanoi_tv', 'ฮานอย TV', 'hanoi'],
  'lao-tv': ['lao_tv', 'ลาว TV', 'lao'],
  'lao-hd': ['lao_hd', 'ลาว HD', 'lao'],
  'lao-star': ['lao_star', 'ลาว STAR', 'lao'],
};
function row(name, id, category, date, top, bottom, source, now, extra = {}) {
  return { ชื่อหวย: name, หวย: id, หมวดหวย: category, งวดวันที่: date, วันที่จัดรูปแบบ: drawDate({ งวดวันที่: date }),
    รางวัลที่_1: top, เลขบน_3_ตัว: top, เลขล่าง_2_ตัว: bottom, เลขท้าย_2_ตัว: bottom,
    เลขหน้า_3_ตัว: [], เลขท้าย_3_ตัว: [], รางวัลข้างเคียงรางวัลที่_1: [],
    แหล่งข้อมูล: source, เวลาที่ตรวจพบ: now.toISOString(), สถานะการแจ้งเตือน: 'pending', ...extra };
}
// Rounds the API also serves, but which the worker reads only once their draw is
// due and still missing. Ids and names were confirmed against the catalog by
// comparing the API's 23 Nov numbers with the catalog row for the same draw.
export const GATED_ROUNDS = {
  'hanoi-union': ['hanoi_samakki', 'ฮานอยสามัคคี', 'vip'],
  'hanoi-redcross': ['hanoi_redcross', 'ฮานอยกาชาด', 'vip'],
  'hanoi-extra': ['hanoi_extra', 'ฮานอย EXTRA', 'vip'],
  'lao-vip': ['lao_vip', 'ลาว VIP', 'vip'],
  'lao-union-vip': ['lao_samakki_vip', 'ลาวสามัคคี VIP', 'vip'],
  'lao-star-vip': ['lao_star_vip', 'ลาว STAR VIP', 'vip'],
  'lao-asean': ['lao_asean', 'ลาวอาเซียน', 'vip'],
  'lao-redcross': ['lao_redcross', 'ลาวกาชาด', 'vip'],
  'hanoi-special': ['hanoi_special', 'ฮานอยพิเศษ', 'hanoi'],
  'hanoi-normal': ['hanoi_regular', 'ฮานอยปกติ', 'hanoi'],
  'hanoi-vip': ['hanoi_vip', 'ฮานอย VIP', 'hanoi'],
  'lao-extra': ['lao_extra', 'ลาว EXTRA', 'lao'],
};

export function parseRound(data, slug, today, now = new Date()) {
  const entry = rounds[slug] || GATED_ROUNDS[slug];
  if (!entry || data?.success !== true || !Array.isArray(data.data)) return [];
  const valid = [];
  for (const r of data.data) {
    if (!r || r.lottery !== slug || r.status !== 'complete' || r.drawDate !== today ||
      (r.pendingPrizes && (!Array.isArray(r.pendingPrizes) || r.pendingPrizes.length)) || !Array.isArray(r.prizes)) continue;
    const found = { '3ตัวบน': new Set(), '2ตัวล่าง': new Set() };
    for (const prize of r.prizes) {
      const name = String(prize?.name || '').replace(/\s+/g, '');
      if (!Object.hasOwn(found, name)) continue;
      if (!Array.isArray(prize.numbers) || prize.numbers.length !== 1 || typeof prize.numbers[0] !== 'string' ||
        !(name === '3ตัวบน' ? /^[0-9]{3}$/ : /^[0-9]{2}$/).test(prize.numbers[0])) return [];
      found[name].add(prize.numbers[0]);
    }
    if (Object.values(found).some(x => x.size !== 1)) continue;
    const [id, name, cat] = entry;
    valid.push(row(name, id, cat, today, [...found['3ตัวบน']][0], [...found['2ตัวล่าง']][0],
      'LotteryChecks (https://lotterychecks.com)', now, { source_family: 'lotterychecks' }));
  }
  return new Set(valid.map(x => numbers(x).join(':'))).size > 1 ? [] : valid.slice(0, 1);
}
const array3 = value => (Array.isArray(value) ? value : typeof value === 'string' ? [value] : [])
  .filter(x => /^[0-9]{3}$/.test(String(x))).map(String);
export function parseThaiApi(data, now = new Date()) {
  if (data?.ok !== true || !data.categories || Array.isArray(data.categories)) return [];
  const rows = [], categoryByKey = { thailotto: 'government', gsblotto: 'government', baaclotto: 'government',
    lpp: 'lao', laoslotto: 'lao', malaylotto: 'malay', hanoylottospecial: 'hanoi', hanoylotto: 'hanoi', hanoylottovip: 'hanoi' };
  for (const [cat, group] of Object.entries(data.categories)) {
    if (['liw', 'maekhong', 'pingpong', 'yeekee'].includes(cat.toLowerCase()) || !Array.isArray(group?.items)) continue;
    for (const item of group.items) {
      if (!item || String(item.status).toLowerCase() !== 'success') continue;
      const key = String(item.key || '').trim(), label = String(item.label || key).trim(), name = canonical(label);
      if (!key || disallowed(key) || disallowed(name)) continue;
      const date = drawDate({ งวดวันที่: item.drawDateDisplay, วันที่จัดรูปแบบ: item.drawDate });
      if (!date) continue;
      const result = String(item.result || '').trim(), combined = result.match(/^([0-9]{3})\s*[-/]\s*([0-9]{2})$/);
      const first = String(item.firstPrize || item.first_prize || '').trim();
      const [top, bottom] = numbers({ top3: item.top3 || combined?.[1] || '', bottom2: item.bottom2 || item.last2 || combined?.[2] || '',
        firstPrize: first || (/^[0-9]+$/.test(result) ? result : '') });
      if (!top || !bottom) continue;
      let category = categoryByKey[key.toLowerCase()] || cat.toLowerCase();
      if (!categoryByKey[key.toLowerCase()] && cat.toLowerCase() === 'stock') category = /vip|พิเศษ|visa/i.test(label) ? 'vip' : label.includes('ไทย') ? 'thai_stock' : 'foreign_stock';
      if (!categoryByKey[key.toLowerCase()] && cat.toLowerCase() === 'lottoforeign') category = /malay|มาเลย์/i.test(key + label) ? 'malay' : /hanoy|hanoi|ฮานอย/i.test(key + label) ? 'hanoi' : /lao|ลาว/i.test(key + label) ? 'lao' : 'foreign_stock';
      rows.push(row(name, key, category, item.drawDateDisplay || date, top, bottom, '👑เฮียฮวด พารวย', now, {
        วันที่จัดรูปแบบ: date, รางวัลที่_1: first || top,
        เลขหน้า_3_ตัว: array3(item.front3 || item.front3Digits), เลขท้าย_3_ตัว: array3(item.bottom3 || item.last3),
        source_family: 'thailottoapi',
      }));
    }
  }
  return rows;
}
function text(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, x) => {
    const n = x[0].toLowerCase() === 'x' ? parseInt(x.slice(1), 16) : Number(x);
    return n <= 0x10ffff ? String.fromCodePoint(n) : '';
  }).replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
export function parseStocks(html, now = new Date(), catalog = []) {
  const groups = { 'หวยหุ้นต่างประเทศ': 'stock', 'หวยหุ้น VIP': 'stock_vip', 'หวยหุ้นพิเศษ': 'stock_special', 'หวยหุ้น VISA': 'stock_visa' };
  // The stock page publishes display labels only, so a row used to carry its Thai
  // label in the id field and identity depended on that text. Resolve the catalog
  // id from the catalog itself; an unknown label keeps the old behaviour.
  const ids = new Map();
  for (const item of catalog) {
    const key = scheduleName(item?.name || '');
    if (key && item?.id && !ids.has(key)) ids.set(key, item.id);
  }
  let group = ''; const rows = [];
  for (const m of html.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[23]\b|$)/gi)) {
    const name = text(m[2]);
    if (m[1] === '2') { group = Object.entries(groups).find(([key]) => name.includes(key))?.[1] || ''; continue; }
    if (!group || !name.startsWith('หวยหุ้น') || /ในหน้านี้|อัปเดตเมื่อไร|ออกวันไหน|ดูย้อนหลัง/.test(name)) continue;
    const content = text(m[3]), date = content.match(/งวด\s*(?:วันที่\s*)?([0-9]{1,2}\s+[^\s]+\s+[0-9]{4})/),
      top = content.match(/3 ตัวบน\s*([0-9]{3})(?![0-9])/), bottom = content.match(/2 ตัวล่าง\s*([0-9]{2})(?![0-9])/);
    if (date && top && bottom && drawDate({ งวดวันที่: date[1] })) rows.push(row(name, ids.get(scheduleName(name)) || name, group, date[1], top[1], bottom[1], 'ผลหวย.com (หน้าหุ้นแยกหมวด)', now,
      { source_family: 'pholhuay' }));
  }
  return rows;
}
// The VIP stock draws are published as HTML pages, not by the JSON API that
// `rounds` uses, and ผลหวย.com stopped listing them (its VIP group is an empty
// heading since 10 Nov). Without these pages the VIP stock lotteries have no
// history at all, or none newer than 9 Nov.
export const CHECKS_STOCK_PAGES = {
  russia_vip: ['รัสเซีย VIP', '/stock-markets/russia-vip'],
  england_vip: ['อังกฤษ VIP', '/stock-markets/england-vip'],
  germany_vip: ['เยอรมัน VIP', '/stock-markets/germany-vip'],
  dowjones_vip: ['ดาวโจนส์ VIP', '/stock-markets/dowjones-vip'],
  dowjones_star: ['ดาวโจนส์ STAR', '/stock-markets/dowjonestar'],
  nikkei_vip_morning: ['นิเคอิเช้า VIP', '/stock-markets/nikkei-vip-morning'],
  nikkei_vip_afternoon: ['นิเคอิบ่าย VIP', '/stock-markets/nikkei-vip-afternoon'],
  china_vip_morning: ['จีนเช้า VIP', '/stock-markets/szse-vip-morning'],
  china_vip_afternoon: ['จีนบ่าย VIP', '/stock-markets/szse-vip-afternoon'],
  hangseng_vip_morning: ['ฮั่งเส็งเช้า VIP', '/stock-markets/hsi-vip-morning'],
  hangseng_vip_afternoon: ['ฮั่งเส็งบ่าย VIP', '/stock-markets/hsi-vip-afternoon'],
  taiwan_vip: ['ไต้หวัน VIP', '/stock-markets/twse-vip'],
  nikkei_morning: ['นิเคอิรอบเช้า', '/stock-markets/nikkei-morning'],
  nikkei_afternoon: ['นิเคอิรอบบ่าย', '/stock-markets/nikkei-afternoon'],
  hangseng_morning: ['ฮั่งเส็งรอบเช้า', '/stock-markets/hsi-morning'],
  hangseng_afternoon: ['ฮั่งเส็งรอบบ่าย', '/stock-markets/hsi-afternoon'],
  dowjones: ['ดาวโจนส์', '/stock-markets/dji'],
  india: ['อินเดีย', '/stock-markets/bsesn'],
  china_morning: ['จีนรอบเช้า', '/stock-markets/szse-morning'],
  china_afternoon: ['จีนรอบบ่าย', '/stock-markets/szse-afternoon'],
  taiwan: ['ไต้หวัน', '/stock-markets/twse'],
  singapore: ['สิงคโปร์', '/stock-markets/sgx'],
  england: ['อังกฤษ', '/stock-markets/ftse100'],
  germany: ['เยอรมัน', '/stock-markets/gdaxi'],
  korea: ['เกาหลี', '/stock-markets/ktop30'],
  russia: ['รัสเซีย', '/stock-markets/moexbc'],
  korea_vip: ['เกาหลี VIP', '/stock-markets/ktop30-vip'],
  singapore_vip: ['สิงคโปร์ VIP', '/stock-markets/sgx-vip'],
};
// At most this many gated reads per cycle. Each draw is read once, so the cap
// only binds when a whole evening of results is missing at the same time, and
// the next cycle picks up the rest.
export const MAX_GATED_READS = 8;
// History gaps are filled from the dated API, a couple of draws per cycle, so a
// lottery that was added today still shows a past table tomorrow.
export const BACKFILL_DAYS = 7;
export const BACKFILL_PER_CYCLE = 2;
export function parseChecksStock(html, lotteryId, today, now = new Date(), category = 'vip') {
  const entry = CHECKS_STOCK_PAGES[lotteryId];
  if (!entry || typeof html !== 'string') return [];
  const [name] = entry;
  // Read the headline block only: the page also carries older rounds further down.
  const match = text(html).match(/งวด\s*(\d{1,2}\s+\S+\s+\d{4})\s*3\s*ตัวบน\s*([0-9]{3})(?![0-9])\s*2\s*ตัวล่าง\s*([0-9]{2})(?![0-9])/);
  if (!match) return [];
  const date = drawDate({ งวดวันที่: match[1] });
  if (!date || date !== today) return [];
  return [row(name, lotteryId, category, match[1], match[2], match[3],
    'LotteryChecks (https://lotterychecks.com)', now, { source_family: 'lotterychecks' })];
}

// The same page carries the last 30 rounds below the headline block, one row per
// draw: "งวดวันที่ 24 พฤศจิกายน 2569 707 75". That table is what history repair reads.
export function parseChecksStockHistory(html, lotteryId, now = new Date(), category = 'vip') {
  const entry = CHECKS_STOCK_PAGES[lotteryId];
  if (!entry || typeof html !== 'string') return [];
  const [name] = entry, found = new Map();
  for (const m of text(html).matchAll(/งวดวันที่\s*(\d{1,2}\s+\S+\s+\d{4})\s*([0-9]{3})(?![0-9])\s*([0-9]{2})(?![0-9])/g)) {
    const date = drawDate({ งวดวันที่: m[1] });
    if (!date || found.has(date)) continue;
    found.set(date, row(name, lotteryId, category, m[1], m[2], m[3],
      'LotteryChecks (https://lotterychecks.com)', now, { source_family: 'lotterychecks' }));
  }
  return [...found.values()];
}

export function parseExtra(html, today, now = new Date()) {
  if (![...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].some(m => /ลาว\s*extra/i.test(text(m[1])))) return [];
  const rows = [], seen = new Set();
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    let header = false;
    for (const tr of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => text(m[1]));
      if (!header) { header = JSON.stringify(cells) === JSON.stringify(['งวดวันที่', 'รางวัลพิเศษ', '3 ตัวบน', '2 ตัวล่าง']); continue; }
      if (cells.length !== 4) continue;
      const [label, full, top, bottom] = cells, date = drawDate({ งวดวันที่: label.replace(/^งวด(?:วันที่)?\s*/, '') });
      if (date !== today || seen.has(date) || !/^[0-9]{5}$/.test(full) || !/^[0-9]{3}$/.test(top) || !/^[0-9]{2}$/.test(bottom) || full.slice(-3) !== top) continue;
      rows.push(row('ลาว EXTRA', 'lao_extra', 'lao', date, top, bottom, 'ผลหวย.com (ลาว EXTRA)', now,
        { source_family: 'pholhuay' })); seen.add(date);
    }
  }
  return rows;
}
const gloNumbers = prize => Array.isArray(prize?.number)
  ? prize.number.map(number => typeof number === 'object' ? number?.value : number)
  : [];

export function parseGovernment(data, source, now = new Date()) {
  let first, bottom, date, front = [], rear = [];
  if (source === 'lotterychecks') {
    if (data?.success !== true || !Array.isArray(data.data)) return [];
    const r = data.data[0];
    if (!r || r.lottery !== 'thai-government' || r.status !== 'complete' || r.pendingPrizes?.length || !Array.isArray(r.prizes)) return [];
    const prizes = Object.fromEntries(r.prizes.filter(x => x && Array.isArray(x.numbers)).map(x => [x.slug, x.numbers]));
    first = prizes['first-prize']?.[0]; bottom = prizes['last-two-digit']?.[0]; date = r.drawDate;
    front = prizes['first-three-digit']; rear = prizes['last-three-digit'];
  } else if (source === 'glo') {
    const r = data?.response || data?.data || data, prizes = r?.data || r;
    first = gloNumbers(prizes?.first)[0] ?? r?.firstPrize;
    bottom = gloNumbers(prizes?.last2)[0] ?? r?.last2;
    date = r?.date || r?.drawDate;
    front = gloNumbers(prizes?.last3f ?? prizes?.first3);
    rear = gloNumbers(prizes?.last3b ?? prizes?.last3);
  } else if (source === 'ranlotto') {
    if (data?.success === false) return [];
    const r = data?.data, prizes = r?.result;
    if (r?.state && !['published', 'complete', 'completed'].includes(String(r.state).toLowerCase())) return [];
    first = prizes?.first_prize || prizes?.firstPrize || r?.first_prize;
    bottom = prizes?.last_two || prizes?.last2 || prizes?.last_two_digits || r?.last_two;
    date = r?.date || data?.facts?.date; front = prizes?.front_three || prizes?.front3; rear = prizes?.last_three || prizes?.last3;
  } else if (source === 'pholhuay') {
    first = data?.first || data?.first_prize; bottom = data?.last2 || data?.two_digits;
    date = data?.date; front = data?.front3; rear = data?.rear3;
  }
  if (!/^[0-9]{6}$/.test(String(first ?? '')) || !/^[0-9]{2}$/.test(String(bottom ?? '')) || !drawDate({ งวดวันที่: date })) return [];
  return [row('สลากกินแบ่งรัฐบาล', 'thailotto', 'government', date, String(first).slice(-3), String(bottom), source, now,
    { รางวัลที่_1: String(first), เลขหน้า_3_ตัว: array3(front), เลขท้าย_3_ตัว: array3(rear), source_family: source })];
}
async function parallel(jobs, concurrency = 4) {
  const results = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (next < jobs.length) { const index = next++; results[index] = await jobs[index](); }
  }));
  return results.flat();
}
export const PHOLHUAY_STOCK_PAGE = 'https://xn--t3cmiit.com/stock-lottery';
export const PHOLHUAY_EXTRA_PAGE = 'https://xn--t3cmiit.com/lao-lottery/extra';

// An operator override must be an absolute https URL. Anything else keeps the
// built-in page and is reported, so a typo cannot silently scrape the wrong host.
function configuredUrl(value, fallback) {
  if (value === undefined || value === null || value === '') return { url: fallback, invalid: false };
  try {
    const url = new URL(String(value).trim());
    if (url.protocol === 'https:' && url.hostname) return { url: url.href, invalid: false };
  } catch { /* reported below */ }
  return { url: fallback, invalid: true };
}

function bangkokMinutes(date) {
  const [hour, minute] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(date).split(':').map(Number);
  return hour * 60 + minute;
}

export async function collect(settings, today, now, request, catalog = [], parked = new Set(), history = []) {
  const errors = [], waiting = [], sources = [], cfg = settings.sources || {};
  const readSource = async (source, url, parser, { json = true, lottery, slug, method = 'GET', headers: extraHeaders } = {}) => {
    // Parked after repeated failures: asking again every cycle only deepens the outage.
    if (parked.has(source)) return [];
    let status = null, reason = 'network';
    try {
      const headers = { Accept: json ? 'application/json' : 'text/html', ...extraHeaders };
      if (method === 'POST') headers['Content-Type'] = 'application/json';
      const response = await request(url, { method, headers });
      status = response.status;
      const datedRound = Boolean(slug);
      if (!response.ok && !(datedRound && status === 404)) {
        reason = 'http';
        await response.body?.cancel().catch(() => {});
        throw new Error(reason);
      }
      reason = response.ok ? 'invalid_response' : 'http';
      const content = await response.text();
      if (content.length > 2_000_000) throw new Error('source_size');
      const data = json ? JSON.parse(content) : content;
      if (datedRound && status === 404) {
        if (data?.success !== false || data.error !== 'หวยชนิดนี้ยังไม่มีผลให้แสดง') throw new Error(reason);
        waiting.push({ source, lottery, status });
        return [];
      }
      const rows = parser(data);
      if (datedRound && !rows.length) {
        const entries = data?.data;
        if (data?.success !== true || !Array.isArray(entries) || !entries.every(row =>
          row?.lottery === slug && row.drawDate === today && row.status === 'announced')) throw new Error(reason);
        waiting.push({ source, lottery, status });
      }
      if (rows.length) sources.push(source);
      return rows;
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') reason = 'timeout';
      if (error?.message === 'request_budget') reason = 'request_budget';
      errors.push({ source, ...(lottery ? { lottery } : {}), status, reason });
      return [];
    }
  };
  const pholhuay = cfg.pholhuay || {};
  const stockPage = configuredUrl(pholhuay.stock_page_url, PHOLHUAY_STOCK_PAGE);
  const extraPage = configuredUrl(pholhuay.extra_page_url, PHOLHUAY_EXTRA_PAGE);
  // The switch was ignored before: both pages were fetched every cycle even with
  // `enabled: false`, which is why ผลหวย.com appeared as an active source while
  // the settings said it was off.
  const jobs = [];
  if (pholhuay.enabled) {
    if (stockPage.invalid) errors.push({ source: 'ผลหวย.com stock groups', status: null, reason: 'invalid_url' });
    if (extraPage.invalid) errors.push({ source: 'ผลหวย.com Lao EXTRA', status: null, reason: 'invalid_url' });
    jobs.push(
      () => readSource('ผลหวย.com stock groups', stockPage.url, x => parseStocks(x, now, catalog), { json: false }),
      () => readSource('ผลหวย.com Lao EXTRA', extraPage.url, x => parseExtra(x, today, now), { json: false, lottery: 'ลาว EXTRA' }),
    );
  }
  if (cfg.thailottoapi?.enabled) {
    const url = new URL(cfg.thailottoapi.url || 'https://thailottoapi.com/api/results');
    // No sync=1: it makes the origin refresh upstream before answering, which
    // measured 6-45s against a 12s per-call cap, so the source timed out every
    // minute and its rows never arrived. The cached payload is identical and the
    // worker polls again in a minute anyway.
    url.searchParams.set('date', today);
    // The general API has priority over overlapping stock cards, as in Python.
    jobs.unshift(() => readSource('ThaiLottoAPI', url.href, x => parseThaiApi(x, now)));
  }
  let rows = await parallel(jobs);
  const fallback = [];
  // Evidence collection needs independent providers even when a preferred source
  // already returned a result. Notification gating decides whether they agree.
  if (cfg.lotterychecks?.enabled) for (const [slug, [, name]] of Object.entries(rounds)) {
    fallback.push(() => readSource('LotteryChecks Lao/Hanoi',
      `https://lotterychecks.com/api/public/results?lottery=${slug}&date=${today}&limit=1`, x => parseRound(x, slug, today, now),
      { lottery: name, slug }));
  }
  const minutes = bangkokMinutes(now);
  const storedToday = new Set(history.filter(x => drawDate(x) === today).map(x => x.หวย));
  // Read a draw only once it should exist and only while its result is still
  // missing: before the close the source still shows yesterday's numbers, and
  // re-reading a stored draw every minute would eat the request budget.
  const closeMinutes = id => {
    const close = String(catalog.find(x => x?.id === id)?.closeTimeStr || '').match(/(\d{1,2})[:.](\d{2})/);
    return close ? Number(close[1]) * 60 + Number(close[2]) : Number.MAX_SAFE_INTEGER;
  };
  const due = id => !storedToday.has(id) && minutes >= closeMinutes(id);
  const gatedJobs = [];
  if (cfg.lotterychecks?.enabled) {
    for (const [slug, [id, name]] of Object.entries(GATED_ROUNDS)) {
      if (due(id)) gatedJobs.push({ id, close: closeMinutes(id), job: () => readSource('LotteryChecks Lao/Hanoi',
        `https://lotterychecks.com/api/public/results?lottery=${slug}&date=${today}&limit=1`,
        x => parseRound(x, slug, today, now), { lottery: name, slug }) });
    }
    for (const [id, [name, path]] of Object.entries(CHECKS_STOCK_PAGES)) {
      const category = catalog.find(x => x?.id === id)?.category || 'vip';
      if (due(id)) gatedJobs.push({ id, close: closeMinutes(id), job: () => readSource('LotteryChecks VIP stock',
        `https://lotterychecks.com${path}`, x => parseChecksStock(x, id, today, now, category), { lottery: name, json: false }) });
    }
  }
  // ไทยเย็น is published only by ผลหวย.com and ThaiLottoAPI, and the API
  // throttles us, so its page is read even when the aggregate pholhuay switch
  // is off. `sources.pholhuay.thai_evening: false` turns it back off.
  if (cfg.pholhuay?.thai_evening !== false && !stockPage.invalid && due('thai_stock_evening')) {
    gatedJobs.push({ id: 'thai_stock_evening', close: closeMinutes('thai_stock_evening'), job: () =>
      readSource('ผลหวย.com stock groups', stockPage.url,
        x => parseStocks(x, now, catalog).filter(r => r.หวย === 'thai_stock_evening' && drawDate(r) === today),
        { lottery: 'ไทยเย็น', json: false }) });
  }
  // Oldest deadline first, so a capped cycle still serves every draw in turn.
  gatedJobs.sort((a, b) => a.close - b.close || a.id.localeCompare(b.id));
  for (const { job } of gatedJobs.slice(0, MAX_GATED_READS)) fallback.push(job);
  const backfillJobs = [];
  if (cfg.lotterychecks?.enabled) {
    const storedDraws = new Set(history.map(x => `${x.หวย}|${drawDate(x)}`));
    const gaps = [];
    for (const [slug, [id, name]] of Object.entries(GATED_ROUNDS)) {
      if (!catalog.find(x => x?.id === id)?.drawDays) continue;
      for (let age = 1; age <= BACKFILL_DAYS; age++) {
        const date = bangkokDay(new Date(now.getTime() - age * 86_400_000));
        if (!scheduled({ หวย: id, งวดวันที่: date }, catalog, date)) continue;
        if (!storedDraws.has(`${id}|${date}`)) gaps.push({ slug, id, name, date, age });
        break;
      }
    }
    // Most recent gap first, but rotating per cycle: a lottery whose source has
    // no row for that date would otherwise hold the same two slots forever.
    gaps.sort((a, b) => a.age - b.age || a.id.localeCompare(b.id));
    const start = Math.floor(now.getTime() / 300_000) % Math.max(gaps.length, 1);
    const picks = gaps.length <= BACKFILL_PER_CYCLE ? gaps
      : Array.from({ length: BACKFILL_PER_CYCLE }, (_, i) => gaps[(start + i) % gaps.length]);
    for (const gap of picks) backfillJobs.push(async () => {
      const rows = await readSource('LotteryChecks backfill',
        `https://lotterychecks.com/api/public/results?lottery=${gap.slug}&date=${gap.date}&limit=1`,
        x => parseRound(x, gap.slug, gap.date, now), { lottery: gap.name, slug: gap.slug });
      return rows.filter(x => drawDate(x) === gap.date).map(x => ({ ...x, สถานะการแจ้งเตือน: 'backfilled' }));
    });
    // One stock page per cycle: it carries 30 rounds, so a single read repairs a
    // whole week for that lottery. The page with the most missing draws goes first.
    const stockGaps = [];
    for (const [id, [name, path]] of Object.entries(CHECKS_STOCK_PAGES)) {
      const item = catalog.find(x => x?.id === id);
      if (!item?.drawDays) continue;
      const missing = new Set();
      for (let age = 1; age <= BACKFILL_DAYS; age++) {
        const date = bangkokDay(new Date(now.getTime() - age * 86_400_000));
        if (scheduled({ หวย: id, งวดวันที่: date }, catalog, date) && !storedDraws.has(`${id}|${date}`)) missing.add(date);
      }
      if (missing.size) stockGaps.push({ id, name, path, category: item.category || 'vip', missing });
    }
    stockGaps.sort((a, b) => b.missing.size - a.missing.size || a.id.localeCompare(b.id));
    if (stockGaps.length) {
      const pick = stockGaps[Math.floor(now.getTime() / 300_000) % stockGaps.length];
      backfillJobs.push(async () => {
        const rows = await readSource('LotteryChecks stock history', `https://lotterychecks.com${pick.path}`,
          x => parseChecksStockHistory(x, pick.id, now, pick.category).filter(r => pick.missing.has(drawDate(r))),
          { lottery: pick.name, json: false });
        return rows.map(x => ({ ...x, สถานะการแจ้งเตือน: 'backfilled' }));
      });
    }
  }
  const gov = [];
  for (const [source, url] of [
    ['pholhuay', 'https://api.pholhuay.com/v1/lottery/latest'], ['glo', 'https://www.glo.or.th/api/lottery/getLatestLottery'],
    ['lotterychecks', 'https://lotterychecks.com/api/public/results?lottery=thai-government&limit=1'],
    ['ranlotto', 'https://api.ranlotto.com/api/public/v1/lottery/result/latest'],
  ]) if (cfg[source]?.enabled) gov.push(() => readSource(source, cfg[source].url || url, x => parseGovernment(x, source, now),
    // GLO answers 503 to a bare POST; the origin must look like its own site.
    { lottery: 'สลากกินแบ่งรัฐบาล', method: source === 'glo' ? 'POST' : 'GET',
      ...(source === 'glo' ? { headers: { Referer: 'https://www.glo.or.th/', Origin: 'https://www.glo.or.th' } } : {}) }));
  const [supplement, government, backfill] = await Promise.all([parallel(fallback), parallel(gov, 2), parallel(backfillJobs)]);
  rows = [...government.filter(x => drawDate(x) === today), ...rows, ...supplement];
  return { rows: rows.filter(x => drawDate(x) === today && !disallowed(x.ชื่อหวย) && !disallowed(x.หวย) && numbers(x).every(Boolean)),
    backfill: backfill.flat(), sources: [...new Set(sources)], errors, waiting, skipped: [...parked] };
}
