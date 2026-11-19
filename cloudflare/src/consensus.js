import { drawDate, numbers, rawName, scheduleName } from './domain.js';

const SOURCE_FAMILIES = new Set(['thailottoapi', 'pholhuay', 'lotterychecks', 'glo', 'ranlotto']);

function catalogIndex(catalog) {
  const ids = new Map(), names = new Map();
  for (const item of catalog) {
    if (item?.id && !ids.has(item.id)) ids.set(item.id, item);
    const name = scheduleName(item?.name || '');
    if (name && !names.has(name)) names.set(name, item);
  }
  return { ids, names };
}
function sourceFamily(row) {
  const explicit = String(row.source_family || '').trim().toLowerCase();
  if (explicit) return SOURCE_FAMILIES.has(explicit) ? explicit : '';
  const label = String(row.แหล่งข้อมูล || '').toLowerCase();
  if (label.includes('lotterychecks')) return 'lotterychecks';
  if (label.includes('ผลหวย.com')) return 'pholhuay';
  if (label.includes('เฮียฮวด') || label.includes('thailotto')) return 'thailottoapi';
  if (label === 'glo' || label.includes('สลากกินแบ่ง')) return 'glo';
  if (label.includes('ranlotto')) return 'ranlotto';
  return '';
}

function groupKey(item, date) {
  return JSON.stringify([item.id, date]);
}

export function evaluateConsensus(rows, catalog, minSources = 2) {
  if (!Number.isInteger(minSources) || minSources < 2 || minSources > 5) throw new Error('invalid_min_sources');
  const index = catalogIndex(catalog), grouped = new Map(), unmapped = [];
  for (const candidate of rows) {
    const date = drawDate(candidate), family = sourceFamily(candidate), [top3, bottom2] = numbers(candidate);
    const item = index.ids.get(candidate.หวย) || index.names.get(scheduleName(rawName(candidate)));
    if (!item || !date || !family || !top3 || !bottom2) {
      unmapped.push({ row: candidate, reason: !item ? 'catalog' : !family ? 'source_family' : 'result' });
      continue;
    }
    const key = groupKey(item, date);
    if (!grouped.has(key)) grouped.set(key, { key, item, date, candidates: [] });
    grouped.get(key).candidates.push({ row: candidate, family, top3, bottom2 });
  }

  const verified = [], pending = [], conflicts = [], evidence = [];
  for (const group of grouped.values()) {
    const perFamily = new Map();
    for (const candidate of group.candidates) {
      const pair = `${candidate.top3}:${candidate.bottom2}`;
      if (!perFamily.has(candidate.family)) perFamily.set(candidate.family, new Map());
      perFamily.get(candidate.family).set(pair, candidate);
      evidence.push({ drawKey: group.key, lotteryId: group.item.id, drawDate: group.date,
        sourceFamily: candidate.family, top3: candidate.top3, bottom2: candidate.bottom2,
        observedAt: candidate.row.เวลาที่ตรวจพบ || null });
    }
    const familyConflict = [...perFamily.values()].some(values => values.size !== 1);
    const pairs = new Map();
    for (const [family, values] of perFamily) for (const [pair, candidate] of values) {
      if (!pairs.has(pair)) pairs.set(pair, { families: new Set(), candidate });
      pairs.get(pair).families.add(family);
    }
    if (familyConflict || pairs.size !== 1) {
      conflicts.push({ ...group, sourceFamilies: [...perFamily.keys()].sort(), values: [...pairs.keys()].sort() });
      continue;
    }
    const match = [...pairs.values()][0], families = [...match.families].sort();
    const representative = structuredClone(match.candidate.row);
    representative.catalog_id = group.item.id;
    representative.verification_status = families.length >= minSources ? 'verified' : 'waiting_for_evidence';
    representative.verification_sources = families;
    representative.verification_source_count = families.length;
    const result = { ...group, row: representative, sourceFamilies: families };
    if (families.length >= minSources) verified.push(result);
    else pending.push(result);
  }
  return { verified, pending, conflicts, evidence, unmapped };
}

export function consensusRows(report, mode = 'shadow') {
  if (!['shadow', 'enforce'].includes(mode)) throw new Error('invalid_verification_mode');
  if (mode === 'enforce') return report.verified.map(x => x.row);
  return [...report.verified, ...report.pending].map(x => x.row);
}
