export type HealthState = 'healthy' | 'degraded' | 'error';

export function getOverallHealth(actions: Array<{ status: string }>): HealthState {
  if (actions.some((action) => action.status === 'failed')) return 'error';
  if (actions.some((action) => action.status === 'warning')) return 'degraded';
  return 'healthy';
}

