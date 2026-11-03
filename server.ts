import express from 'express';
import { createRecentDispatchGuard } from './src/utils/recentDispatchGuard.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertNoSecretFields, commitGitHubJson, GitHubStorageError, readGitHubJson } from './server/githubStorage.ts';
import { getOverallHealth } from './server/selfHeal.ts';
import { getResultNumbers } from './src/utils/lotteryResult.ts';
import { randomUUID } from 'node:crypto';
import { installDashboardAuth } from './server/dashboardAuth.ts';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

function pruneApiRateMap() {
  const now = Date.now();
  for (const [key, value] of apiRateMap.entries()) {
    if (now > value.resetAt || now - value.resetAt > 60000) {
      apiRateMap.delete(key);
    }
  }
}

app.use(express.json({ limit: '25mb' }));

// Every dashboard page and API requires authentication; only the health probe is public.
installDashboardAuth(app, express.urlencoded({ extended: false, limit: '4kb' }));

// -------------------------------------------------------------
// ระบบป้องกันระบบล่มระดับโปรเซส (Process Crash Shield & Fault Tolerance)
// -------------------------------------------------------------
process.on('uncaughtException', (err: any) => {
  console.error('[PROCESS] Uncaught exception; exiting so Render can restart a clean process:', err?.message || err);
  process.exit(1);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('[PROCESS] Unhandled rejection; exiting so Render can restart a clean process:', reason?.message || reason);
  process.exit(1);
});

// Anti-flood / Rate limiting protection for API endpoints
const apiRateMap = new Map<string, { count: number; resetAt: number }>();
app.use('/api', (req, res, next) => {
  pruneApiRateMap();
  const clientKey = req.ip || req.socket.remoteAddress || 'client';
  const now = Date.now();
  const entry = apiRateMap.get(clientKey) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60000;
  }
  entry.count += 1;
  apiRateMap.set(clientKey, entry);
  if (entry.count > 150) {
    return res.status(429).json({
      error: 'ระบบป้องกันคำขอถี่เกินไปทำงาน (Rate Limit Protection)',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }
  next();
});

// Circuit Breaker for Gemini AI API
interface GeminiCircuitBreaker {
  isOpen: boolean;
  cooldownUntil: number;
  failureCount: number;
  lastFailureReason: string;
}

const geminiCircuitBreaker: GeminiCircuitBreaker = {
  isOpen: false,
  cooldownUntil: 0,
  failureCount: 0,
  lastFailureReason: '',
};

function checkGeminiCircuit(): { available: boolean; remainingCooldownSec: number } {
  const now = Date.now();
  if (geminiCircuitBreaker.isOpen) {
    if (now >= geminiCircuitBreaker.cooldownUntil) {
      geminiCircuitBreaker.isOpen = false;
      geminiCircuitBreaker.failureCount = 0;
      return { available: true, remainingCooldownSec: 0 };
    }
    return {
      available: false,
      remainingCooldownSec: Math.ceil((geminiCircuitBreaker.cooldownUntil - now) / 1000),
    };
  }
  return { available: true, remainingCooldownSec: 0 };
}

function tripGeminiCircuit(reason: string, cooldownMs = 60000) {
  geminiCircuitBreaker.isOpen = true;
  geminiCircuitBreaker.cooldownUntil = Date.now() + cooldownMs;
  geminiCircuitBreaker.failureCount += 1;
  geminiCircuitBreaker.lastFailureReason = reason;
}

// In-memory verification cache (TTL: 1 hour)
const verificationCache = new Map<string, { data: any; expiresAt: number }>();

const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
const ai = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;


app.get('/api/health', (req, res) => {
  try {
    res.json({
      ok: true,
      status: 'healthy',
      storage: process.env.GITHUB_TOKEN ? 'configured' : 'read_only',
      writesEnabled: Boolean(process.env.GITHUB_TOKEN),
      githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN),
      dashboardAuthConfigured: Boolean(process.env.DASH_PASSWORD),
      geminiConfigured: Boolean(geminiApiKey),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Helper paths

// 1. GET /api/status - Read the latest status written by GitHub Actions.
app.get('/api/status', async (req, res) => {
  try {
    const data = await readGitHubJson<Record<string, any>>('status/status.json');
    return res.json(data);
  } catch (err: any) {
    const status = err instanceof GitHubStorageError ? err.status : 502;
    return res.status(status).json({ success: false, error: err.message, code: err.code || 'STATUS_READ_FAILED' });
  }
});

// 2. GET /api/settings - Read the canonical, durable settings file from GitHub.
app.get('/api/settings', async (req, res) => {
  try {
    const data = await readGitHubJson<Record<string, any>>('config/settings.json');
    return res.json(data);
  } catch (err: any) {
    const status = err instanceof GitHubStorageError ? err.status : 502;
    return res.status(status).json({ success: false, error: err.message, code: err.code || 'SETTINGS_READ_FAILED' });
  }
});

// 3. POST /api/settings - Commit settings to GitHub so they survive Render restarts.
app.post('/api/settings', async (req, res) => {
  try {
    const updated = req.body;
    if (!updated || typeof updated !== 'object' || Array.isArray(updated)) {
      return res.status(400).json({ success: false, error: 'Settings must be a JSON object.' });
    }
    assertNoSecretFields(updated);
    const commit = await commitGitHubJson(
      'config/settings.json',
      updated,
      'chore(settings): update dashboard settings [skip ci]',
    );
    // Keep this running instance in sync; GitHub remains the durable source of truth.
    return res.json({ success: true, message: 'Settings saved to GitHub successfully.', commit });
  } catch (err: any) {
    const status = err instanceof GitHubStorageError ? err.status : 502;
    return res.status(status).json({ success: false, error: err.message, code: err.code || 'SETTINGS_WRITE_FAILED' });
  }
});

// 4. GET /api/results - Read the latest results committed by GitHub Actions.
app.get('/api/results', async (req, res) => {
  try {
    const data = await readGitHubJson<any[]>('lottery_previous_results.json');
    return res.json(data);
  } catch (err: any) {
    const status = err instanceof GitHubStorageError ? err.status : 502;
    return res.status(status).json({ success: false, error: err.message, code: err.code || 'RESULTS_READ_FAILED' });
  }
});

// 4.0 POST /api/lotteries/cleanup-history - Purge unrequested LIW/pingpong and duplicate entries
app.post('/api/lotteries/cleanup-history', async (req, res) => {
  try {
    const raw = await readGitHubJson<any[]>('lottery_previous_results.json');
    if (!Array.isArray(raw)) {
      return res.json({ success: true, removedCount: 0, totalAfter: 0 });
    }
    const totalBefore = raw.length;
    const filtered = raw.filter((d: any) => {
      const name = String(d?.ชื่อหวย || '').toLowerCase();
      const code = String(d?.หวย || '').toLowerCase();
      const cat = String(d?.หมวดหวย || '').toLowerCase();
      if (name.includes('liw') || code.includes('liw') || cat.includes('liw')) return false;
      if (name.includes('pingpong') || name.includes('ปิงปอง') || name.includes('ยี่กี')) return false;
      return name.trim().length > 0;
    });

    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const d of filtered) {
      const name = String(d?.ชื่อหวย || '').replace(/หวยหุ้น/g, '').replace(/หวย/g, '').trim().toLowerCase();
      const date = String(d?.งวดวันที่ || d?.วันที่จัดรูปแบบ || '').trim();
      const top3 = String(d?.เลขบน_3_ตัว || d?.รางวัลที่_1 || '').trim();
      const bot2 = String(d?.เลขล่าง_2_ตัว || d?.เลขท้าย_2_ตัว || '').trim();
      const key = `${name}::${date}::${top3.slice(-3)}::${bot2.slice(-2)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(d);
      }
    }

    const commit = await commitGitHubJson(
      'lottery_previous_results.json',
      deduped,
      'chore(results): clean duplicate and unsupported history [skip ci]',
    );
    const removedCount = totalBefore - deduped.length;
    return res.json({
      success: true,
      message: `ล้างประวัติหวย LIW และรายการแจ้งซ้ำออกเรียบร้อย (ลบไป ${removedCount} รายการ)`,
      totalBefore,
      totalAfter: deduped.length,
      removedCount,
      commit,
    });
  } catch (err: any) {
    const status = err instanceof GitHubStorageError ? err.status : 502;
    return res.status(status).json({ success: false, error: err.message, code: err.code || 'RESULTS_WRITE_FAILED' });
  }
});

// 4.1 GET /api/all-lotteries - Read the canonical lottery catalog from GitHub.
app.get('/api/all-lotteries', async (req, res) => {
  try {
    const data = await readGitHubJson<any[]>('data/all_lotteries.json');
    return res.json(data);
  } catch (err: any) {
    const status = err instanceof GitHubStorageError ? err.status : 502;
    return res.status(status).json({ success: false, error: err.message, code: err.code || 'CATALOG_READ_FAILED' });
  }
});

// 4.2 POST /api/all-lotteries - Persist lottery catalog changes in GitHub.
app.post('/api/all-lotteries', async (req, res) => {
  try {
    const updated = req.body;
    if (!Array.isArray(updated)) {
      return res.status(400).json({ success: false, error: 'Lottery catalog must be a JSON array.' });
    }
    const commit = await commitGitHubJson(
      'data/all_lotteries.json',
      updated,
      'chore(catalog): update lottery catalog [skip ci]',
    );
    return res.json({ success: true, message: 'Lottery catalog saved to GitHub.', commit });
  } catch (err: any) {
    const status = err instanceof GitHubStorageError ? err.status : 502;
    return res.status(status).json({ success: false, error: err.message, code: err.code || 'CATALOG_WRITE_FAILED' });
  }
});

// Test LINE Messaging API push using server-side secrets only.
app.post('/api/test-line', async (req, res) => {
  try {
    const channelAccessToken = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
    const targetId = (process.env.LINE_TARGET_ID || '').trim();
    if (!channelAccessToken || !targetId) {
      return res.status(503).json({ success: false, error: 'ต้องตั้งค่า LINE_CHANNEL_ACCESS_TOKEN และ LINE_TARGET_ID ใน Environment ก่อน' });
    }
    const message = String(req.body?.message || 'ทดสอบการแจ้งเตือน Bombim00 ผ่าน LINE Messaging API').trim();
    if (!message || message.length > 5000) {
      return res.status(400).json({ success: false, error: 'ข้อความต้องมีความยาว 1–5000 ตัวอักษร' });
    }
    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + channelAccessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: targetId, messages: [{ type: 'text', text: message }] }),
      signal: AbortSignal.timeout(10000),
    });
    if (lineRes.ok) return res.json({ success: true, message: 'ส่งข้อความทดสอบผ่าน LINE Messaging API แล้ว' });
    const detail = await lineRes.text().catch(() => '');
    return res.status(502).json({ success: false, error: 'LINE Messaging API ปฏิเสธคำขอ (HTTP ' + lineRes.status + '): ' + detail.slice(0, 300) });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message || 'ส่งข้อความ LINE ไม่สำเร็จ' });
  }
});

// Test ntfy push. Destination host is server-configured to prevent arbitrary URL/SSRF requests.
app.post('/api/test-ntfy', async (req, res) => {
  try {
    const cleanTopic = String(req.body?.topic || process.env.NTFY_TOPIC || '').trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(cleanTopic)) {
      return res.status(400).json({ success: false, error: 'ntfy topic ต้องเป็น a-z, A-Z, 0-9, _ หรือ - ไม่เกิน 64 ตัว' });
    }

    const serverValue = (process.env.NTFY_SERVER || 'https://ntfy.sh').trim();
    let serverUrl: URL;
    try {
      serverUrl = new URL(serverValue);
    } catch {
      return res.status(503).json({ success: false, error: 'ตั้งค่า NTFY_SERVER ไม่ถูกต้อง' });
    }
    if (serverUrl.protocol !== 'https:' || serverUrl.username || serverUrl.password || serverUrl.pathname !== '/' || serverUrl.search || serverUrl.hash) {
      return res.status(503).json({ success: false, error: 'NTFY_SERVER ต้องเป็น HTTPS origin ที่ถูกต้อง' });
    }

    const title = String(req.body?.title || '📢 แจ้งเตือนผลสลากและหวยสด').trim();
    const message = String(req.body?.message || 'ทดสอบแจ้งเตือน Bombim00').trim();
    if (!title || title.length > 100 || !message || message.length > 4000) {
      return res.status(400).json({ success: false, error: 'หัวข้อต้องไม่เกิน 100 และข้อความต้องไม่เกิน 4,000 ตัวอักษร' });
    }

    const ntfyRes = await fetch(serverUrl.origin + '/' + encodeURIComponent(cleanTopic), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        title,
        message,
        priority: 4,
        tags: ['loudspeaker', 'dart'],
        click: process.env.APP_URL || 'https://bombim00.onrender.com',
      }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    if (ntfyRes.ok) {
      return res.json({ success: true, message: 'ส่งคำขอแจ้งเตือนไปยัง ntfy server แล้ว' });
    }
    const detail = (await ntfyRes.text().catch(() => '')).slice(0, 300);
    return res.status(502).json({ success: false, error: 'ntfy ตอบกลับ HTTP ' + ntfyRes.status + ': ' + detail });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.name === 'TimeoutError' ? 'ntfy ตอบกลับช้าเกินกำหนด' : (err?.message || 'ส่ง ntfy ไม่สำเร็จ') });
  }
});

// 4.5 GitHub Actions Integration Endpoints
// GitHub Actions is the only lottery execution environment for this deployment.
const LOTTERY_WORKFLOW = 'lottery.yml';
const LOTTERY_REPOSITORY = 'jirapatza/Bombim00';
const LOTTERY_BRANCH = 'main';
const LOTTERY_TARGETS = new Set(['all', 'vip', 'foreign_stock', 'hanoi', 'lao', 'thai_stock', 'government', 'malay']);
let lotteryDispatchInFlight = false;
// Suppress accidental sequential double-clicks for the same dispatch inputs.
// This is deliberately short so an operator can retry a failed/manual run promptly.
const recentLotteryDispatches = createRecentDispatchGuard(8000);

app.post('/api/github/dispatch', async (req, res) => {
  let acquiredDispatchLock = false;
  try {
    const ghToken = (process.env.GITHUB_TOKEN || '').trim();
    if (!ghToken) {
      return res.status(503).json({ success: false, error: 'ยังไม่ได้ตั้งค่า GITHUB_TOKEN ใน Render Environment' });
    }
    const inputs = req.body?.inputs || {};
    const target = String(inputs.lottery_target || 'all');
    const forceNotify = String(inputs.force_notify || 'false');
    if (!LOTTERY_TARGETS.has(target) || !['true', 'false'].includes(forceNotify)) {
      return res.status(400).json({ success: false, error: 'ค่ากลุ่มหวยหรือ Force Notify ไม่ถูกต้อง' });
    }
    // Suppress rapid retries of an identical dispatch after GitHub accepted it.
    const dispatchFingerprint = JSON.stringify([target, forceNotify]);
    if (recentLotteryDispatches.isDuplicate(dispatchFingerprint)) {
      return res.status(409).json({
        success: false,
        queued: false,
        code: 'DISPATCH_RECENTLY_ACCEPTED',
        retryAfterMs: recentLotteryDispatches.remainingMs(dispatchFingerprint),
        error: 'คำสั่งชุดเดียวกันเพิ่งถูกส่งไปแล้ว กรุณารอสักครู่ก่อนส่งซ้ำ',
      });
    }
    // Both dashboard entry points share this server-side lock. This closes the
    // race that separate component-level loading flags cannot prevent.
    if (lotteryDispatchInFlight) {
      return res.status(409).json({
        success: false,
        queued: false,
        code: 'DISPATCH_ALREADY_IN_FLIGHT',
        error: 'มีคำสั่งตรวจผลกำลังส่งไป GitHub อยู่ กรุณารอสักครู่',
      });
    }
    lotteryDispatchInFlight = true;
    acquiredDispatchLock = true;

    const requestId = randomUUID();
    const dispatchUrl = 'https://api.github.com/repos/' + LOTTERY_REPOSITORY + '/actions/workflows/' + LOTTERY_WORKFLOW + '/dispatches';
    const ghRes = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Bombim00-Render/1.0',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': 'Bearer ' + ghToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: LOTTERY_BRANCH, inputs: { lottery_target: target, force_notify: forceNotify, request_id: requestId } }),
      signal: AbortSignal.timeout(10000),
    });
    if (ghRes.status === 204 || ghRes.status === 200) {
      recentLotteryDispatches.markAccepted(dispatchFingerprint);
      return res.json({ success: true, queued: true, workflow_dispatched: true, request_id: requestId, message: 'ส่งคำสั่งตรวจผลไปยัง GitHub Actions แล้ว' });
    }
    const detail = await ghRes.text().catch(() => '');
    return res.status(502).json({ success: false, error: 'GitHub ปฏิเสธคำสั่ง (HTTP ' + ghRes.status + '): ' + detail.slice(0, 300) });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.name === 'TimeoutError' ? 'GitHub ตอบกลับช้าเกินกำหนด' : err.message });
  } finally {
    if (acquiredDispatchLock) lotteryDispatchInFlight = false;
  }
});

app.get('/api/github/runs', async (_req, res) => {
  try {
    const ghToken = (process.env.GITHUB_TOKEN || '').trim();
    const headers: Record<string, string> = {
      'User-Agent': 'Bombim00-Render/1.0',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (ghToken) headers.Authorization = 'Bearer ' + ghToken;
    const runsUrl = 'https://api.github.com/repos/' + LOTTERY_REPOSITORY + '/actions/workflows/' + LOTTERY_WORKFLOW + '/runs?per_page=30';
    const ghRes = await fetch(runsUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!ghRes.ok) {
      const detail = await ghRes.text().catch(() => '');
      return res.status(502).json({ success: false, error: 'อ่านประวัติ GitHub Actions ไม่สำเร็จ (HTTP ' + ghRes.status + '): ' + detail.slice(0, 300), workflow_runs: [] });
    }
    const data = await ghRes.json() as { workflow_runs?: unknown[] };
    return res.json({ success: true, workflow_runs: data.workflow_runs || [] });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message || 'อ่านประวัติการทำงานไม่สำเร็จ', workflow_runs: [] });
  }
});

// Lottery checks run only in GitHub Actions; this service never starts a second checker.

// 6.1 System monitor reads the canonical repository data, never the ephemeral container disk.
const monitoredFiles = [
  { name: 'config/settings.json', path: 'config/settings.json', critical: true },
  { name: 'status/status.json', path: 'status/status.json', critical: true },
  { name: 'data/all_lotteries.json', path: 'data/all_lotteries.json', critical: false },
  { name: 'lottery_previous_results.json', path: 'lottery_previous_results.json', critical: false },
  { name: 'status/self_healing_history.json', path: 'status/self_healing_history.json', critical: false },
];

const monitoredSources = [
  { id: 'glo', name: 'สำนักงานสลากกินแบ่งรัฐบาล (GLO Official)', url: 'https://www.glo.or.th' },
  { id: 'ranlotto', name: 'RANLOTTO Lottery Service', url: 'https://api.ranlotto.com' },
  { id: 'ntfy', name: 'ntfy.sh Push Notification Server', url: 'https://ntfy.sh' },
  { id: 'github', name: 'GitHub API', url: 'https://api.github.com' },
];

async function checkExternalSource(source: { id: string; name: string; url: string }) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(source.url, {
      method: 'HEAD',
      redirect: 'error',
      signal: controller.signal,
    });
    return {
      id: source.id,
      name: source.name,
      status: response.ok ? 'healthy' : 'degraded',
      latencyMs: Date.now() - startedAt,
      statusCode: response.status,
      lastChecked: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      id: source.id,
      name: source.name,
      status: 'degraded',
      latencyMs: Date.now() - startedAt,
      statusCode: 0,
      lastChecked: new Date().toISOString(),
      error: err?.name === 'AbortError' ? 'Request timed out' : (err?.message || 'Request failed'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/api/system/monitor', async (_req, res) => {
  try {
    const memory = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());
    const uptimeStr = Math.floor(uptimeSec / 3600) + 'h ' +
      Math.floor((uptimeSec % 3600) / 60) + 'm ' + (uptimeSec % 60) + 's';

    const filesHealth = await Promise.all(monitoredFiles.map(async (file) => {
      try {
        const value = await readGitHubJson<unknown>(file.path);
        return {
          name: file.name,
          path: file.path,
          exists: true,
          critical: file.critical,
          validJson: true,
          itemCount: Array.isArray(value) ? value.length : undefined,
        };
      } catch (err: any) {
        return {
          name: file.name,
          path: file.path,
          exists: false,
          critical: file.critical,
          validJson: false,
          error: err?.message || 'Unable to read repository data',
        };
      }
    }));

    const sourceChecks = await Promise.all(monitoredSources.map(checkExternalSource));
    const hasMissingCriticalFiles = filesHealth.some((file) => file.critical && (!file.exists || !file.validJson));
    const overallStatus = hasMissingCriticalFiles
      ? 'error'
      : sourceChecks.some((source) => source.status !== 'healthy') ? 'degraded' : 'healthy';

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      overallStatus,
      system: {
        serverPort: PORT,
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: uptimeSec,
        uptimeFormatted: uptimeStr,
        memoryUsageMB: Math.round(memory.heapUsed / 1024 / 1024),
        totalHeapMB: Math.round(memory.heapTotal / 1024 / 1024),
        backgroundRunnerActive: false,
        lotteryRunner: 'GitHub Actions only',
        durableStorage: 'GitHub repository JSON',
      },
      filesHealth,
      sourceChecks,
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message || 'System monitor failed' });
  }
});

// Self-heal is deliberately diagnostic-only: it must not rewrite bot-owned results or claim to repair Render.
app.post('/api/system/self-heal', async (req, res) => {
  if (!process.env.GITHUB_TOKEN?.trim()) {
    return res.status(503).json({
      success: false,
      error: 'ยังไม่ได้ตั้งค่า GITHUB_TOKEN ใน Render Environment จึงไม่สามารถบันทึกประวัติการตรวจสอบได้',
    });
  }
  const startedAt = Date.now();
  const now = new Date();
  const nowIso = now.toISOString();
  const nowThai = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const { targetDevice, triggerReason, triggerType } = req.body || {};
  try {
    const actions: Array<{
      id: string;
      commandCode: string;
      targetDevice: string;
      description: string;
      triggerReason: string;
      timestamp: string;
      timestampThai: string;
      status: 'success' | 'warning' | 'failed';
      executionTimeMs: number;
      details: string;
      shellCommand: string;
    }> = [];

    const dataChecks = await Promise.all(monitoredFiles.slice(0, 4).map(async (file) => {
      const actionStarted = Date.now();
      try {
        const value = await readGitHubJson<unknown>(file.path);
        return {
          id: 'act-' + Date.now() + '-' + file.name,
          commandCode: 'VERIFY_REPOSITORY_DATA',
          targetDevice: file.name,
          description: 'ตรวจสอบไฟล์ข้อมูลหลักจาก GitHub repository',
          triggerReason: triggerReason || 'ตรวจสอบความสมบูรณ์ของข้อมูลที่จัดเก็บถาวร',
          timestamp: new Date().toISOString(),
          timestampThai: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
          status: 'success' as const,
          executionTimeMs: Math.max(1, Date.now() - actionStarted),
          details: 'อ่านข้อมูลสำเร็จ' + (Array.isArray(value) ? '; จำนวน ' + value.length + ' รายการ' : ''),
          shellCommand: '',
        };
      } catch (err: any) {
        return {
          id: 'act-' + Date.now() + '-' + file.name,
          commandCode: 'VERIFY_REPOSITORY_DATA',
          targetDevice: file.name,
          description: 'ตรวจสอบไฟล์ข้อมูลหลักจาก GitHub repository',
          triggerReason: triggerReason || 'ตรวจสอบความสมบูรณ์ของข้อมูลที่จัดเก็บถาวร',
          timestamp: new Date().toISOString(),
          timestampThai: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
          status: file.critical ? 'failed' as const : 'warning' as const,
          executionTimeMs: Math.max(1, Date.now() - actionStarted),
          details: err?.message || 'อ่านข้อมูลไม่สำเร็จ',
          shellCommand: '',
        };
      }
    }));
    actions.push(...dataChecks);

    const gatewayStarted = Date.now();
    const gatewayChecks = await Promise.all(monitoredSources.map(checkExternalSource));
    actions.push({
      id: 'act-' + Date.now() + '-gateways',
      commandCode: 'VERIFY_GATEWAYS_REACHABILITY',
      targetDevice: 'External Feeds & Notification Gateways',
      description: 'ตรวจสอบการตอบสนองของบริการภายนอกด้วยคำขอจริง',
      triggerReason: triggerReason || 'ตรวจสอบการเชื่อมต่อไปยังบริการภายนอก',
      timestamp: new Date().toISOString(),
      timestampThai: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      status: gatewayChecks.every((item) => item.status === 'healthy') ? 'success' : 'warning',
      executionTimeMs: Math.max(1, Date.now() - gatewayStarted),
      details: JSON.stringify(gatewayChecks),
      shellCommand: '',
    });

    const health = getOverallHealth(actions);
    const session = {
      sessionId: 'audit-' + Date.now(),
      triggeredAt: nowIso,
      triggeredAtThai: nowThai,
      triggerType: triggerType || 'manual_user_click',
      triggeredByDevice: targetDevice || 'All Services',
      triggerReason: triggerReason || 'ผู้ใช้สั่งตรวจสอบระบบทั้งหมด',
      overallResult: health === 'healthy' ? 'success' : health === 'error' ? 'failed' : 'partial',
      totalActionsCount: actions.length,
      successCount: actions.filter((item) => item.status === 'success').length,
      warningCount: actions.filter((item) => item.status === 'warning').length,
      failedCount: actions.filter((item) => item.status === 'failed').length,
      executionDurationTotalMs: Date.now() - startedAt,
      actions,
    };

    const previous = await readGitHubJson<any[]>('status/self_healing_history.json').catch(() => []);
    const history = [session, ...(Array.isArray(previous) ? previous : [])].slice(0, 50);
    const commit = await commitGitHubJson(
      'status/self_healing_history.json',
      history,
      'chore(health): save verified system audit [skip ci]',
    );

    return res.json({
      success: true,
      message: session.overallResult === 'success'
        ? 'ตรวจสอบเสร็จ ทุกข้อมูลและ gateway ที่ทดสอบผ่าน'
        : 'ตรวจสอบเสร็จ แต่ยังมีรายการที่ต้องตรวจสอบเพิ่มเติม',
      timestamp: nowIso,
      session,
      fixedActions: actions.map((item) => '[' + item.commandCode + '] ' + item.description),
      executedActions: actions,
      history,
      storageCommit: commit,
      note: 'การทำงานนี้เป็นการตรวจสอบเท่านั้น ไม่ได้เขียนทับข้อมูลผลหวยหรือไฟล์ในเครื่อง Render',
    });
  } catch (err: any) {
    const status = err instanceof GitHubStorageError ? err.status : 502;
    return res.status(status).json({ success: false, error: err?.message || 'System audit failed' });
  }
});

app.get('/api/system/self-heal-history', async (_req, res) => {
  try {
    const history = await readGitHubJson<any[]>('status/self_healing_history.json');
    return res.json({ success: true, history: Array.isArray(history) ? history : [] });
  } catch (err: any) {
    if (err instanceof GitHubStorageError && err.status === 404) {
      return res.json({ success: true, history: [] });
    }
    const status = err instanceof GitHubStorageError ? err.status : 502;
    return res.status(status).json({ success: false, error: err?.message || 'Unable to read audit history', history: [] });
  }
});

app.delete('/api/system/self-heal-history', async (_req, res) => {
  try {
    const commit = await commitGitHubJson(
      'status/self_healing_history.json',
      [],
      'chore(health): clear system audit history [skip ci]',
    );
    return res.json({ success: true, message: 'ล้างประวัติการตรวจสอบเรียบร้อยแล้ว', commit });
  } catch (err: any) {
    const status = err instanceof GitHubStorageError ? err.status : 502;
    return res.status(status).json({ success: false, error: err?.message || 'Unable to clear audit history' });
  }
});

// Project-file editing endpoints are intentionally not exposed by the dashboard.

// 8. AI Endpoints (Google Search Grounding & Audio Transcription with Crash Shield & Circuit Breaker)

// Helper to generate verified local fallback data without crashing
async function getLocalVerifiedFallback(prompt: string) {
  let previousResults: any[] = [];
  try {
    previousResults = await readGitHubJson<any[]>('lottery_previous_results.json');
  } catch {
    previousResults = [];
  }

  let allLotteriesList: any[] = [];
  try { allLotteriesList = await readGitHubJson<any[]>('data/all_lotteries.json'); } catch { allLotteriesList = []; }

  const normalizedPrompt = String(prompt || '').toLocaleLowerCase('th-TH');
  const matchedLottery = allLotteriesList.find((item: any) => {
    const name = String(item?.name || '').toLocaleLowerCase('th-TH');
    const id = String(item?.id || '').toLocaleLowerCase('th-TH');
    return (name && normalizedPrompt.includes(name)) || (id && normalizedPrompt.includes(id));
  });

  const matchedCachedResult = previousResults.find((row: any) => {
    const name = String(row?.ชื่อหวย || '').toLocaleLowerCase('th-TH');
    const key = String(row?.หวย || '').toLocaleLowerCase('th-TH');
    return (name && normalizedPrompt.includes(name)) || (key && normalizedPrompt.includes(key));
  });

  let fallbackText = '';
  const fallbackSources: Array<{ title: string; uri: string }> = [];

  if (matchedCachedResult) {
    const lotteryName = matchedCachedResult.ชื่อหวย || matchedCachedResult.หวย || 'หวย';
    const { top3, bottom2 } = getResultNumbers(matchedCachedResult);
    fallbackText = `ข้อมูลที่บันทึกไว้ล่าสุดของ ${lotteryName} (ข้อมูลย้อนหลังจากแคชระบบ ไว้เป็นข้อมูลสำรอง)\n` +
      `• วันที่งวด: ${matchedCachedResult.งวดวันที่ || matchedCachedResult.วันที่จัดรูปแบบ || 'ไม่ระบุ'}\n` +
      `• ${top3 || '---'} - ${bottom2 || '--'}\n` +
      `• แหล่งข้อมูลเดิม: ${matchedCachedResult.แหล่งข้อมูล || 'ไม่ระบุ'}\n` +
      `🛡️ สถานะระบบ: ทำงานผ่านระบบป้องกันระบบล่ม (Circuit Breaker & Fallback Cache) แสดงผลข้อมูลจากแคชระบบเป็นไปอย่างปลอดภัย`;
    fallbackSources.push({ title: 'คลังผลหวยที่ระบบบันทึกไว้', uri: 'https://github.com/jirapatza/Bombim00' });
  } else if (matchedLottery) {
    fallbackText = `พบรายการ ${matchedLottery.name} ในแคตตาล็อกระบบ\n` +
      `• หมวด: ${matchedLottery.categoryLabel || matchedLottery.category || 'ไม่ระบุ'}\n` +
      `• เวลาปิดรับ: ${matchedLottery.closeTimeStr || 'ไม่ระบุ'}\n` +
      `• เวลาออกรางวัลตามตาราง: ${matchedLottery.drawTimeStr || 'ไม่ระบุ'}\n` +
      `• สถานะในแคตตาล็อก: ${matchedLottery.status || 'ไม่ระบุ'}\n` +
      `🛡️ สถานะระบบ: ทำงานผ่านระบบป้องกันระบบล่ม (Safe Fallback Mode) เพื่อป้องกันการสร้างข้อมูลเท็จ`;
    fallbackSources.push({ title: 'แคตตาล็อกหวยในโปรเจกต์', uri: 'https://github.com/jirapatza/Bombim00' });
  } else {
    fallbackText = `ค้นหาผลรางวัลสำหรับ "${prompt}"\n` +
      `🛡️ ระบบป้องกันระบบล่ม (Circuit Breaker & Safe Mode) กำลังทำงานเพื่อป้องกันโควตาเกิน หรือการล้มเหลวจากแหล่งภายนอก`;
  }

  return { fallbackText, fallbackSources };
}

// 8.1 POST /api/ai/verify-grounding - Verify lottery results using Google Search Grounding with Circuit Breaker Protection
app.post('/api/ai/verify-grounding', async (req, res) => {
  const { query, lotteryName = 'สลากกินแบ่งรัฐบาลไทย', drawDate } = req.body;
  const prompt = (query || `ตรวจสอบผลการออกรางวัลจริงของ ${lotteryName} ${drawDate ? `งวดวันที่ ${drawDate}` : 'งวดล่าสุด'}`).trim();

  // 1. Check in-memory verification cache first (1-hour cache to save quota and ensure speed)
  const cached = verificationCache.get(prompt);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json({
      ...cached.data,
      fromCache: true,
      circuitBreakerActive: false,
    });
  }

  // 2. Check Circuit Breaker status
  const circuit = checkGeminiCircuit();
  if (!circuit.available) {
    console.log(`[AI Verify Grounding] Circuit Breaker OPEN (cooldown: ${circuit.remainingCooldownSec}s). Serving verified local cache.`);
    const { fallbackText, fallbackSources } = await getLocalVerifiedFallback(prompt);
    return res.json({
      success: true,
      query: prompt,
      verifiedText: fallbackText,
      sources: fallbackSources,
      webSearchQueries: [prompt],
      isFallback: true,
      circuitBreakerActive: true,
      remainingCooldownSec: circuit.remainingCooldownSec,
      fallbackReason: `ระบบป้องกันระบบล่ม (Circuit Breaker) กำลังทำงานอัตโนมัติเนื่องจากอัตราคำขอใกล้เกินโควตา`,
      timestamp: new Date().toISOString(),
    });
  }

  // Do not call the Gemini SDK when its server-side key is absent.
  if (!ai) {
    const { fallbackText, fallbackSources } = await getLocalVerifiedFallback(prompt);
    return res.json({
      success: true,
      query: prompt,
      verifiedText: fallbackText,
      sources: fallbackSources,
      webSearchQueries: [prompt],
      isFallback: true,
      circuitBreakerActive: false,
      geminiConfigured: false,
      fallbackReason: 'ยังไม่ได้ตั้งค่า Gemini API Key จึงใช้ข้อมูลสำรองที่ตรวจสอบในระบบ',
      timestamp: new Date().toISOString(),
    });
  }

  // 3. Attempt live Gemini API call
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'แสดงผลทุกหวยรวมถึงหวยรัฐบาลเฉพาะชื่อหวย วันงวดจริงตามประกาศ และผลรูปแบบ 782 - 57 (สามตัวบน - สองตัวล่าง) เท่านั้น สามตัวบนของหวยรัฐบาลคือสามหลักท้ายของรางวัลที่หนึ่ง ห้ามแสดงเลขหกหลักหรือรางวัลอื่น ห้ามเดาวันงวดเป็นวันที่ 1 หรือ 16 และห้ามเติมเลขเมื่อไม่มีข้อมูล ให้ระบุว่ายังไม่พบผลยืนยัน',
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingChunks = (response.candidates?.[0]?.groundingMetadata as any)?.groundingChunks || [];
    const webSearchQueries = (response.candidates?.[0]?.groundingMetadata as any)?.webSearchQueries || [];
    const sources = groundingChunks
      .map((chunk: any) => ({
        title: chunk.web?.title || 'แหล่งอ้างอิงข้อมูล',
        uri: chunk.web?.uri || '',
      }))
      .filter((s: any) => Boolean(s.uri));

    const resultPayload = {
      success: true,
      query: prompt,
      verifiedText: response.text || 'ไม่พบข้อมูลผลรางวัลที่ชัดเจน',
      sources,
      webSearchQueries,
      isFallback: false,
      circuitBreakerActive: false,
      timestamp: new Date().toISOString(),
    };

    verificationCache.set(prompt, {
      data: resultPayload,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    return res.json(resultPayload);
  } catch (err: any) {
    const isQuotaError = err?.message?.includes('429') ||
      err?.message?.includes('RESOURCE_EXHAUSTED') ||
      err?.message?.includes('quota') ||
      err?.message?.includes('rate');

    if (isQuotaError) {
      tripGeminiCircuit('API Quota exhausted (429)', 60000);
      console.log('[AI Verify Grounding] Circuit Breaker activated: Quota limit reached. Serving verified local cache safely.');
    } else {
      console.log('[AI Verify Grounding] Temporary API failure handled safely by Crash Shield:', err?.message || err);
    }

    const { fallbackText, fallbackSources } = await getLocalVerifiedFallback(prompt);

    return res.json({
      success: true,
      query: prompt,
      verifiedText: fallbackText,
      sources: fallbackSources,
      webSearchQueries: [prompt],
      isFallback: true,
      circuitBreakerActive: true,
      remainingCooldownSec: 60,
      fallbackReason: isQuotaError
        ? 'ระบบป้องกันระบบล่ม (Circuit Breaker & Fallback Shield) ทำงานอัตโนมัติเนื่องจากอัตราการร้องขอเกินโควตา'
        : 'ระบบป้องกันระบบล่มดึงข้อมูลจากแคชระบบมาแสดงผลแทนอัตโนมัติ เพื่อป้องกันความล้มเหลวจาก API ภายนอก',
      timestamp: new Date().toISOString(),
    });
  }
});

// 8.2 POST /api/ai/transcribe - Transcribe voice audio to text with Crash Shield
app.post('/api/ai/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ success: false, error: 'กรุณาส่งข้อมูลเสียง (audioBase64)' });
    }

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
    if (!ai) {
      return res.status(503).json({
        success: false,
        geminiConfigured: false,
        error: 'ยังไม่ได้ตั้งค่า Gemini API Key สำหรับถอดเสียง',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: cleanBase64,
            },
          },
          {
            text: 'ถอดความเสียงนี้เป็นข้อความภาษาไทยอย่างแม่นยำ เขียนเลขที่ผู้พูดระบุเป็นตัวเลขอารบิก โดยคงเลขศูนย์นำหน้าและแยกแต่ละชุดเลขสองหลักหรือสามหลัก ห้ามแต่งเลขเพิ่ม',
          },
        ],
      },
    });

    const transcript = response.text?.trim() || '';
    const digitMatches = transcript.match(/(?<!\d)\d{2,3}(?!\d)/g) || [];

    return res.json({
      success: true,
      transcript,
      detectedDigits: digitMatches,
    });
  } catch (err: any) {
    const isQuota = err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
    console.log('[Audio Transcribe] Handled safely by Crash Shield:', isQuota ? 'Quota limit' : err?.message || err);
    return res.json({ 
      success: false, 
      isQuotaLimited: true,
      error: 'โควตาการแปลงเสียงชั่วคราวเต็ม กรุณาลองให้อีกครั้งใน 30 วินาที หรือใช้ข้อความแทน',
    });
  }
});

// 8.3 GET /api/system/crash-shield-status - Crash Shield & Circuit Breaker status
app.get('/api/system/crash-shield-status', (req, res) => {
  const circuit = checkGeminiCircuit();
  return res.json({
    success: true,
    status: 'active',
    geminiConfigured: Boolean(geminiApiKey),
    shieldName: 'Lottery Alert Crash Shield & Circuit Breaker',
    circuitBreaker: {
      isOpen: !circuit.available,
      remainingCooldownSec: circuit.remainingCooldownSec,
      failureCount: geminiCircuitBreaker.failureCount,
      lastFailureReason: geminiCircuitBreaker.lastFailureReason || 'none',
    },
    memoryHealth: {
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      uptimeSeconds: Math.round(process.uptime()),
    },
    cacheStats: {
      cachedGroundingQueries: verificationCache.size,
    },
    processShield: {
      uncaughtExceptionShield: true,
      unhandledRejectionShield: true,
      rateLimitShield: true,
    },
  });
});

async function startServer() {
  const hasDist = fs.existsSync(path.join(__dirname, 'dist', 'index.html'));
  const isProd = (process.env.NODE_ENV === 'production' || __filename.endsWith('server.js') || process.env.npm_lifecycle_event === 'start') && hasDist;

  // Unknown APIs must return JSON, never the SPA HTML fallback.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  // Crash Shield global express error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log('[CRASH-SHIELD] Handled Express route error:', err?.message || err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(500).json({
      success: false,
      error: 'ระบบป้องกันระบบล่มทำงาน (Crash Shield Active)',
      message: err?.message || 'Internal Server Error',
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Lottery Alert Dashboard server running on http://0.0.0.0:${PORT}`);
    console.log('[RUNNER] Lottery checks are executed only by GitHub Actions.');
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exitCode = 1;
});

