// Keep these identities compatible with settings_loader.py and draw_schedule.py.
import weekdays from '../../data/draw_weekdays.json' with { type: 'json' };

export const bangkokDay = (now = new Date()) => new Date(+now + 7 * 3600000).toISOString().slice(0, 10);
const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const shortMonths = ['ม.ค', 'ก.พ', 'มี.ค', 'เม.ย', 'พ.ค', 'มิ.ย', 'ก.ค', 'ส.ค', 'ก.ย', 'ต.ค', 'พ.ย', 'ธ.ค'];
function memoize(fn, limit = 1024) {
  const cache = new Map();
  return key => {
    if (cache.has(key)) return cache.get(key);
    const value = fn(key);
    if (cache.size >= limit) cache.delete(cache.keys().next().value);
    cache.set(key, value); return value;
  };
}
const parseDateFields = memoize(key => computeDrawDate(JSON.parse(key)), 2048);
export function drawDate(row) {
  return parseDateFields(JSON.stringify({ งวดวันที่: row.งวดวันที่, draw_date: row.draw_date, date: row.date, วันที่จัดรูปแบบ: row.วันที่จัดรูปแบบ }));
}
function computeDrawDate(row) {
  for (const candidate of [row.งวดวันที่, row.draw_date, row.date, row.วันที่จัดรูปแบบ]) {
    const value = String(candidate || '').trim();
    let match = value.slice(0, 10).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    let year, month, day;
    if (match) [, year, month, day] = match;
    else {
      match = value.slice(0, 10).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
      if (match) [, day, month, year] = match;
      else {
        const parts = value.replaceAll(',', '').split(/\s+/);
        const label = parts[1]?.replace(/\.$/, '');
        month = Math.max(months.indexOf(label), shortMonths.indexOf(label)) + 1;
        [day, , year] = parts;
      }
    }
    year = Number(year); month = Number(month); day = Number(day);
    if (year >= 2400) year -= 543;
    if (!(year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= 31)) continue;
    const result = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (new Date(result + 'T00:00:00Z').toISOString().slice(0, 10) === result) return result;
  }
  return '';
}
export const canonical = memoize(computeCanonical);
function computeCanonical(name) {
  const s = String(name || '').trim(), lower = s.toLowerCase();
  if (!s) return 'หวยไม่ระบุชื่อ';
  if (s.includes('ฮานอย') || lower.includes('hanoi')) {
    for (const [token, name] of [['พัฒนา', 'ฮานอยพัฒนา'], ['สามัคคี', 'ฮานอยสามัคคี'],
      ['กาชาด', 'ฮานอยกาชาด'], ['อาเซียน', 'ฮานอยอาเซียน'], ['svip', 'ฮานอย SVIP'],
      ['extra', 'ฮานอย EXTRA'], ['star', 'ฮานอย STAR'], ['สตาร์', 'ฮานอย STAR'],
      ['hd', 'ฮานอย HD'], ['tv', 'ฮานอย TV'], ['ทีวี', 'ฮานอย TV']]) {
      if (lower.includes(token)) return name + (name !== 'ฮานอย SVIP' && (/(?<!s)vip/.test(lower) || s.includes('วีไอพี')) ? ' VIP' : '');
    }
    if (/พิเศษ|17[:.]30/.test(s)) return 'ฮานอยพิเศษ';
    if (/ปกติ|18[:.]30/.test(s)) return 'ฮานอยปกติ';
    if (/vip|วีไอพี|19[:.]30/i.test(s)) return 'ฮานอย VIP';
    if (s.includes('เฉพาะกิจ')) return 'ฮานอยเฉพาะกิจ';
  }
  if (s.includes('ลาว') || lower.includes('lao')) {
    const vip = /vip|วีไอพี/i.test(s);
    if (/extra|เอ็กซ์ตร้า|เอ็กตร้า/i.test(s)) return 'ลาว EXTRA';
    if (s.includes('ทีวี') || /(?<![a-z])tv(?![a-z])/.test(lower)) return 'ลาว TV' + (vip ? ' VIP' : '');
    if (/(?<![a-z])hd(?![a-z])/.test(lower)) return 'ลาว HD' + (vip ? ' VIP' : '');
    if (s.includes('สามัคคี')) return 'หวยลาวสามัคคี' + (vip ? ' VIP' : '');
    if (/สตาร์|star/i.test(s)) return 'หวยลาวสตาร์' + (vip ? ' VIP' : '');
    if (s.includes('พัฒนา') && /พิเศษ|เช้า|เที่ยง/.test(s)) return s;
    if (s.includes('พัฒนา')) return 'หวยลาวพัฒนา' + (vip ? ' VIP' : '');
    if (vip) return 'หวยลาว VIP';
  }
  if (/สลากกินแบ่งรัฐบาล|หวยรัฐบาล|รัฐบาลไทย/.test(s)) return 'สลากกินแบ่งรัฐบาล';
  if (s.includes('ออมสิน')) return 'หวยออมสิน';
  if (/ธ\.ก\.ส|ธกส/.test(s)) return 'หวย ธ.ก.ส.';
  return s;
}
export const normalize = memoize(computeNormalize);
function computeNormalize(name) {
  let s = canonical(name).toLowerCase();
  for (const [a, b] of [['นิคเคอิ', 'นิเคอิ'], ['สลากกินแบ่งรัฐบาล (ไทย)', 'สลากกินแบ่งรัฐบาล'],
    ['หวยรัฐบาลไทย', 'สลากกินแบ่งรัฐบาล'], ['หวยรัฐบาล', 'สลากกินแบ่งรัฐบาล'],
    ['หวยธกส.', 'หวย ธ.ก.ส.'], ['ธ.ก.ส.', 'หวย ธ.ก.ส.'], ['หวยหวย', 'หวย']]) s = s.replaceAll(a, b);
  return s.trim().replace(/\s+/g, ' ');
}
export const scheduleName = memoize(computeScheduleName);
function computeScheduleName(name) {
  let s = canonical(name).toLowerCase();
  const vip = /(?<!s)vip|วีไอพี/.test(s);
  s = s.replace(/(?<!s)vip|วีไอพี/g, '');
  for (const [a, b] of [['สตาร์', 'star'], ['นิคเคอิ', 'นิเคอิ'], ['หวยหุ้น', ''], ['หวย', ''], ['หุ้น', ''], ['รอบ', ''], ['(ไทย)', '']]) s = s.replaceAll(a, b);
  return s.replace(/[^a-z0-9ก-๙]/g, '') + (vip ? 'vip' : '');
}
export const disallowed = name => /LIW|ปิงปอง|PINGPONG|ยี่กี|YEEKEE/i.test(String(name || ''));
export function numbers(row) {
  function digits(keys, width) {
    for (const key of keys) {
      if (row[key] == null || row[key] === '') continue;
      const text = String(row[key]).trim();
      if (!/^[0-9]+$/.test(text)) return '';
      if (['รางวัลที่_1', 'firstPrize', 'first'].includes(key)) return [3, 5, 6].includes(text.length) ? text.slice(-3) : '';
      return text.length === width ? text : '';
    }
    return '';
  }
  return [digits(['เลขบน_3_ตัว', 'top3', 'รางวัลที่_1', 'firstPrize', 'first'], 3),
    digits(['เลขล่าง_2_ตัว', 'เลขท้าย_2_ตัว', 'bottom2', 'last2'], 2)];
}
export const rawName = row => row.ชื่อหวย || row.lottery_name || row.หวย || row.id || 'หวยไม่ระบุชื่อ';
export function fingerprint(row) {
  const [top3, last2] = numbers(row);
  let category = String(row.หมวดหวย || row.category || '').trim().toLowerCase();
  if (category === 'stock_vip') category = 'vip';
  // Sorted keys match Python's historical fingerprint, including category distinctions.
  return JSON.stringify({ category, draw_date: drawDate(row) || String(row.งวดวันที่ || row.วันที่จัดรูปแบบ || '').trim(),
    last2, lottery: normalize(rawName(row)), top3 });
}
export const drawIdentity = row => JSON.stringify([normalize(rawName(row)), drawDate(row), ...numbers(row)]);
const drawRule = item => item.drawDays.trim().replace(/\s*-\s*/g, ' - ');

function scheduleTime(value, today) {
  const match = typeof value === 'string' && value.trim().match(/^(\d{1,2})[:.](\d{2})(?:\s*น\.?)?$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  const clock = `${match[1].padStart(2, '0')}:${match[2]}`;
  return { clock, at: Date.parse(`${today}T${clock}:00+07:00`) };
}

export function dueScheduleAlerts(catalog, today, now) {
  if (bangkokDay(now) !== today) return [];
  const weekday = new Date(today + 'T00:00:00Z').getUTCDay();
  const alerts = [];
  for (const item of catalog) {
    // Irregular draws lack a verified upcoming date in the catalog.
    if (!item.id || !item.name.trim() || disallowed(item.name) || !weekdays[drawRule(item)]?.includes(weekday)) continue;
    const draw = scheduleTime(item.drawTimeStr, today);
    const close = scheduleTime(item.closeTimeStr, today);
    const windows = [
      ['closing', close && (!draw || close.at <= draw.at) ? close : null, 10],
      ['upcoming', draw, 5],
    ];
    for (const [kind, time, minutes] of windows) {
      if (!time || +now < time.at - minutes * 60000 || +now >= time.at) continue;
      alerts.push({ kind, key: JSON.stringify([kind, item.id, today]), name: item.name, ...time });
    }
  }
  return alerts.sort((a, b) => a.at - b.at);
}

const catalogIndexes = new WeakMap();
export function scheduled(row, catalog, today) {
  if (drawDate(row) !== today) return false;
  let index = catalogIndexes.get(catalog);
  if (!index) {
    index = { ids: new Map(), names: new Map() };
    for (const item of catalog) {
      if (!index.ids.has(item.id)) index.ids.set(item.id, item);
      const name = scheduleName(item.name);
      if (!index.names.has(name)) index.names.set(name, item);
    }
    catalogIndexes.set(catalog, index);
  }
  const item = index.ids.get(row.หวย) || index.names.get(scheduleName(rawName(row)));
  if (!item) return false;
  const rule = drawRule(item);
  if (rule === 'ตามประกาศวันงวดจริง (อาจเลื่อน)') return numbers(row).every(Boolean) && (item.id !== 'thai_gov' || /^[0-9]{6}$/.test(row.รางวัลที่_1 || ''));
  return (weekdays[rule] || []).includes(new Date(today + 'T00:00:00Z').getUTCDay());
}
export function previousChannels(row, history) {
  const result = {};
  for (const old of history) {
    const exact = fingerprint(row) === fingerprint(old);
    const cat = String(row.หมวดหวย || row.category || '').toLowerCase();
    const oldCat = String(old.หมวดหวย || old.category || '').toLowerCase();
    const loose = old.สถานะการแจ้งเตือน === 'sent' && !(cat && oldCat && cat !== oldCat) &&
      normalize(rawName(row)) === normalize(rawName(old)) && drawDate(row) && drawDate(row) === drawDate(old) &&
      String(row.เลขบน_3_ตัว || row.top3 || '').trim() &&
      String(row.เลขบน_3_ตัว || row.top3 || '').trim() === String(old.เลขบน_3_ตัว || old.top3 || '').trim() &&
      String(row.เลขท้าย_2_ตัว || row.เลขล่าง_2_ตัว || row.bottom2 || '').trim() ===
      String(old.เลขท้าย_2_ตัว || old.เลขล่าง_2_ตัว || old.bottom2 || '').trim();
    if (!exact && !loose) continue;
    if (old.notification_channels && typeof old.notification_channels === 'object' && !Array.isArray(old.notification_channels)) {
      for (const [key, value] of Object.entries(old.notification_channels)) if (value === 'sent') result[key] = 'sent';
    } else if (old.สถานะการแจ้งเตือน === 'sent') result.ntfy = 'sent';
  }
  return result;
}
export function eligible(settings, row) {
  const n = settings.notifications || {};
  if (n.enabled === false || disallowed(rawName(row)) || row.สถานะการแจ้งเตือน === 'sent' || !numbers(row).every(Boolean)) return false;
  if (n.notify_on_new_draw !== false) return true;
  if (n.notify_on_prize_match === false) return false;
  const p = n.notify_prizes || {}, [top, bottom] = numbers(row), candidates = [];
  if ((p.top3 ?? p.first_prize ?? true)) candidates.push(top);
  if ((p.bottom2 ?? p.last_2 ?? true)) candidates.push(bottom);
  return (n.custom_watched_numbers || []).some(x => /^[0-9]{2,3}$/.test(String(x).trim()) && candidates.includes(String(x).trim()));
}
export function mergeRows(rows, history) {
  const merged = [], seen = new Set();
  for (const row of [...rows, ...history]) {
    const key = fingerprint(row);
    if (!seen.has(key)) { seen.add(key); merged.push(row); }
  }
  return merged;
}
