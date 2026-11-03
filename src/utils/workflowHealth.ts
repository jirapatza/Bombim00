export interface WorkflowRunStatus {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  run_started_at?: string;
  updated_at?: string;
}

export function describeWorkflowHealth(runs: WorkflowRunStatus[], now = Date.now()) {
  const latest = runs[0];
  if (!latest) return { status: 'degraded' as const, message: 'ยังไม่มีประวัติ Workflow ให้ตรวจสอบ', ageMinutes: null };
  const lastSuccess = runs.find((r) => r.status === 'completed' && r.conclusion === 'success');
  const timestamp = Date.parse(lastSuccess?.updated_at || lastSuccess?.created_at || '');
  const ageMinutes = Number.isFinite(timestamp) ? Math.max(0, Math.floor((now - timestamp) / 60000)) : null;
  if (latest.status === 'completed' && latest.conclusion !== 'success') {
    return { status: 'error' as const, message: `Workflow ล่าสุดจบด้วยสถานะ ${latest.conclusion || 'ไม่ทราบผล'}`, ageMinutes };
  }
  if (ageMinutes === null || ageMinutes > 10) {
    return { status: 'degraded' as const, message: `รอบสำเร็จล่าสุด${ageMinutes === null ? 'ยังไม่พบ' : `ผ่านไป ${ageMinutes} นาที`} • รอบตั้งไว้ทุก 5 นาที`, ageMinutes };
  }
  if (latest.status !== 'completed') return { status: 'healthy' as const, message: `Workflow ${latest.status === 'queued' ? 'อยู่ในคิว' : 'กำลังทำงาน'} • รอบสำเร็จล่าสุด ${ageMinutes} นาทีที่แล้ว`, ageMinutes };
  return { status: 'healthy' as const, message: `Workflow ล่าสุดสำเร็จ • อัปเดต ${ageMinutes} นาทีที่แล้ว`, ageMinutes };
}

export function shouldDispatchForegroundCheck(runs: WorkflowRunStatus[], now = Date.now()) {
  if (runs.some((r) => r.status !== 'completed')) return false;
  // Any recently created run (including a failure) gets time before a retry.
  const latestCreated = Math.max(0, ...runs.map((r) => Date.parse(r.created_at)).filter(Number.isFinite));
  return now - latestCreated >= 5 * 60 * 1000;
}
