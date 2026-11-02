import { apiFetch } from './api';

export interface TrackedWorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  display_title?: string;
  html_url?: string;
  event?: string;
}

export type WorkflowProgress = 'waiting_for_run' | 'queued' | 'in_progress';

interface TrackingOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (progress: WorkflowProgress, run?: TrackedWorkflowRun) => void;
}

const POLL_INTERVAL_MS = 4000;
const DEFAULT_TIMEOUT_MS = 180000;

function delay(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, POLL_INTERVAL_MS);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Track only the manually dispatched run bearing our server-generated request ID.
 * Never treat a different scheduled or manually dispatched workflow as this request.
 */
export async function waitForDispatchedWorkflow(
  requestId: string,
  options: TrackingOptions = {},
): Promise<TrackedWorkflowRun | null> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error('GitHub ไม่ส่งรหัสติดตามงานที่ถูกต้องกลับมา');
  }

  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const expectedTitle = 'Dashboard check ' + requestId;
  let consecutiveFailures = 0;
  let lastProgress: WorkflowProgress | null = null;

  const reportProgress = (progress: WorkflowProgress, run?: TrackedWorkflowRun) => {
    if (progress !== lastProgress) {
      lastProgress = progress;
      options.onProgress?.(progress, run);
    }
  };

  reportProgress('waiting_for_run');

  while (Date.now() < deadline && !options.signal?.aborted) {
    try {
      const response = await apiFetch('/api/github/runs', {
        cache: 'no-store',
        signal: options.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success !== true || !Array.isArray(data.workflow_runs)) {
        throw new Error(data.error || 'ไม่สามารถอ่านสถานะงานจาก GitHub ได้');
      }
      consecutiveFailures = 0;
      const matched = (data.workflow_runs as TrackedWorkflowRun[]).find((run) =>
        run.event === 'workflow_dispatch' && run.display_title === expectedTitle,
      );
      if (matched) {
        if (matched.status === 'completed') return matched;
        reportProgress(matched.status === 'in_progress' ? 'in_progress' : 'queued', matched);
      }
    } catch (error) {
      if (options.signal?.aborted) return null;
      consecutiveFailures += 1;
      if (consecutiveFailures >= 3) {
        throw new Error('ติดตาม GitHub Actions ไม่สำเร็จ: ' + (error instanceof Error ? error.message : 'การเชื่อมต่อขัดข้อง'));
      }
    }
    await delay(options.signal);
  }

  return null;
}
