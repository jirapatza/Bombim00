import { LiveLotteryData } from '../types/lottery';

const LIVE_API_BASE_URL = (import.meta.env.VITE_LOTTERY_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

export function isLiveDataConfigured(): boolean {
  return LIVE_API_BASE_URL.length > 0;
}

export async function fetchLiveLotteryData(signal?: AbortSignal): Promise<LiveLotteryData> {
  if (!LIVE_API_BASE_URL) {
    throw new Error('Live Data API is not configured');
  }

  const response = await fetch(`${LIVE_API_BASE_URL}/api/live-data`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Live Data API request failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') {
    throw new Error('Live Data API returned an invalid payload');
  }

  const data = payload as Partial<LiveLotteryData>;
  if (
    !Array.isArray(data.catalog) ||
    !Array.isArray(data.results) ||
    !data.status ||
    typeof data.status !== 'object'
  ) {
    throw new Error('Live Data API response is missing required data');
  }

  return {
    catalog: data.catalog,
    results: data.results,
    status: data.status,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}
