import { canonical, disallowed, drawDate, numbers, scheduleName } from './domain.js';

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
export function parseRound(data, slug, today, now = new Date()) {
  if (!rounds[slug] || data?.success !== true || !Array.isArray(data.data)) return [];
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
    const [id, name, cat] = rounds[slug];
    valid.push(row(name, id, cat, today, [...found['3ตัวบน']][0], [...found['2ตัวล่าง']][0],
      'LotteryChecks (https://lotterychecks.com)', now));
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
export function parseStocks(html, now = new Date()) {
  const groups = { 'หวยหุ้นต่างประเทศ': 'stock', 'หวยหุ้น VIP': 'stock_vip', 'หวยหุ้นพิเศษ': 'stock_special', 'หวยหุ้น VISA': 'stock_visa' };
  let group = ''; const rows = [];
  for (const m of html.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[23]\b|$)/gi)) {
    const name = text(m[2]);
    if (m[1] === '2') { group = Object.entries(groups).find(([key]) => name.includes(key))?.[1] || ''; continue; }
    if (!group || !name.startsWith('หวยหุ้น') || /ในหน้านี้|อัปเดตเมื่อไร|ออกวันไหน|ดูย้อนหลัง/.test(name)) continue;
    const content = text(m[3]), date = content.match(/งวด\s*(?:วันที่\s*)?([0-9]{1,2}\s+[^\s]+\s+[0-9]{4})/),
      top = content.match(/3 ตัวบน\s*([0-9]{3})(?![0-9])/), bottom = content.match(/2 ตัวล่าง\s*([0-9]{2})(?![0-9])/);
    if (date && top && bottom && drawDate({ งวดวันที่: date[1] })) rows.push(row(name, name, group, date[1], top[1], bottom[1], 'ผลหวย.com (หน้าหุ้นแยกหมวด)', now));
  }
  return rows;
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
      rows.push(row('ลาว EXTRA', 'lao_extra', 'lao', date, top, bottom, 'ผลหวย.com (ลาว EXTRA)', now)); seen.add(date);
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
    { รางวัลที่_1: String(first), เลขหน้า_3_ตัว: array3(front), เลขท้าย_3_ตัว: array3(rear) })];
}
async function parallel(jobs, concurrency = 4) {
  const results = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (next < jobs.length) { const index = next++; results[index] = await jobs[index](); }
  }));
  return results.flat();
}
export async function collect(settings, today, now, request) {
  const errors = [], waiting = [], sources = [], cfg = settings.sources || {};
  const readSource = async (source, url, parser, { json = true, lottery, slug, method = 'GET' } = {}) => {
    let status = null, reason = 'network';
    try {
      const headers = { Accept: json ? 'application/json' : 'text/html' };
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
  const jobs = [
    () => readSource('ผลหวย.com stock groups', 'https://xn--t3cmiit.com/stock-lottery', x => parseStocks(x, now), { json: false }),
    () => readSource('ผลหวย.com Lao EXTRA', 'https://xn--t3cmiit.com/lao-lottery/extra', x => parseExtra(x, today, now), { json: false, lottery: 'ลาว EXTRA' }),
  ];
  if (cfg.thailottoapi?.enabled) {
    const url = new URL(cfg.thailottoapi.url || 'https://thailottoapi.com/api/results');
    url.searchParams.set('date', today); url.searchParams.set('sync', '1');
    // The general API has priority over overlapping stock cards, as in Python.
    jobs.unshift(() => readSource('ThaiLottoAPI', url.href, x => parseThaiApi(x, now)));
  }
  let rows = await parallel(jobs);
  const complete = rows.filter(x => drawDate(x) === today && numbers(x).every(Boolean));
  const supported = new Set(Object.values(rounds).map(x => x[0]));
  const ids = new Set(complete.filter(x => supported.has(x.หวย)).map(x => x.หวย));
  const names = new Set(complete.filter(x => !supported.has(x.หวย)).map(x => scheduleName(x.ชื่อหวย || '')));
  const fallback = [];
  if (cfg.lotterychecks?.enabled) for (const [slug, [id, name]] of Object.entries(rounds)) {
    if (!ids.has(id) && !names.has(scheduleName(name))) fallback.push(() => readSource('LotteryChecks Lao/Hanoi',
      `https://lotterychecks.com/api/public/results?lottery=${slug}&date=${today}&limit=1`, x => parseRound(x, slug, today, now),
      { lottery: name, slug }));
  }
  const needsGov = !complete.some(x => (x.หวย === 'thailotto' || normalizeGovernment(x.ชื่อหวย)) && /^[0-9]{6}$/.test(x.รางวัลที่_1));
  const gov = [];
  if (needsGov) for (const [source, url] of [
    ['pholhuay', 'https://api.pholhuay.com/v1/lottery/latest'], ['glo', 'https://www.glo.or.th/api/lottery/getLatestLottery'],
    ['lotterychecks', 'https://lotterychecks.com/api/public/results?lottery=thai-government&limit=1'],
    ['ranlotto', 'https://api.ranlotto.com/api/public/v1/lottery/result/latest'],
  ]) if (cfg[source]?.enabled) gov.push(() => readSource(source, cfg[source].url || url, x => parseGovernment(x, source, now),
    { lottery: 'สลากกินแบ่งรัฐบาล', method: source === 'glo' ? 'POST' : 'GET' }));
  const [supplement, government] = await Promise.all([parallel(fallback), parallel(gov, 2)]);
  const governmentRow = government.find(x => drawDate(x) === today);
  rows = [...(governmentRow ? [governmentRow] : []), ...rows, ...supplement];
  return { rows: rows.filter(x => drawDate(x) === today && !disallowed(x.ชื่อหวย) && !disallowed(x.หวย) && numbers(x).every(Boolean)),
    sources: [...new Set(sources)], errors, waiting };
}
const normalizeGovernment = name => canonical(name) === 'สลากกินแบ่งรัฐบาล';
