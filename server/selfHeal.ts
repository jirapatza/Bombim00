import fs from 'node:fs';

export type HealthState = 'healthy' | 'degraded' | 'error';

export function getOverallHealth(actions: Array<{ status: string }>): HealthState {
  if (actions.some((action) => action.status === 'failed')) return 'error';
  if (actions.some((action) => action.status === 'warning')) return 'degraded';
  return 'healthy';
}

export function preserveCorruptFile(filePath: string, timestamp = new Date()): string | null {
  if (!fs.existsSync(filePath)) return null;
  const stamp = timestamp.toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.corrupt-${stamp}.bak`;
  fs.copyFileSync(filePath, backupPath, fs.constants.COPYFILE_EXCL);
  return backupPath;
}
