export function validateRanlottoResponse(body: unknown) {
  const value = body as any;
  if (!value || typeof value !== 'object' || value.success === false) return false;
  const payload = value.data;
  if (!payload || typeof payload !== 'object') return false;
  const result = payload.result || {};
  const top = result.first_prize ?? result.firstPrize ?? payload.first_prize;
  const bottom = result.last_two ?? result.last2 ?? result.last_two_digits ?? payload.last_two;
  const date = String(payload.date || value.facts?.date || '');
  const state = String(payload.state || '').toLowerCase();
  const parsedDate = Date.parse(date);
  return /^\d{6}$/.test(String(top ?? '')) && /^\d{2}$/.test(String(bottom ?? ''))
    && /^\d{4}-\d{2}-\d{2}/.test(date) && Number.isFinite(parsedDate)
    && new Date(parsedDate).toISOString().slice(0, 10) === date.slice(0, 10)
    && (!state || ['published', 'complete', 'completed'].includes(state));
}
