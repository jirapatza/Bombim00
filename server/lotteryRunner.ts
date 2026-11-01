import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
export const lotteryTargets = new Set([
  'all', 'vip', 'foreign_stock', 'hanoi', 'lao', 'thai_stock', 'government', 'malay', 'liw',
]);

export interface CheckResult {
  success: boolean;
  busy?: boolean;
  error?: string;
  stdout: string;
  stderr: string;
}

type Executor = (options: { target: string; forceNotify: boolean }) => Promise<{ stdout: string; stderr: string }>;

/** One execution gate shared by manual, local-runner and scheduled checks. */
export function createLotteryRunner(cwd: string, execute: Executor = async ({ target, forceNotify }) => {
  return executeFile('python3', ['lottery_checker.py'], {
    cwd,
    env: { ...process.env, LOTTERY_TARGET: target, FORCE_NOTIFY: String(forceNotify) },
    timeout: 90_000,
    maxBuffer: 4 * 1024 * 1024,
  });
}) {
  let running = false;
  return async (target = 'all', forceNotify = false): Promise<CheckResult> => {
    if (!lotteryTargets.has(target)) {
      return { success: false, error: 'Invalid lottery target.', stdout: '', stderr: '' };
    }
    if (running) {
      return { success: false, busy: true, error: 'A previous lottery check is still running.', stdout: '', stderr: '' };
    }
    running = true;
    try {
      const output = await execute({ target, forceNotify });
      return { success: true, ...output };
    } catch (error: any) {
      return {
        success: false,
        error: String(error?.message || 'Lottery checker failed.'),
        stdout: String(error?.stdout || ''),
        stderr: String(error?.stderr || ''),
      };
    } finally {
      running = false;
    }
  };
}
