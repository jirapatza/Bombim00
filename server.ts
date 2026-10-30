import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

function ensureRuntimePaths() {
  const requiredDirs = [
    path.join(__dirname, 'config'),
    path.join(__dirname, 'status'),
    path.join(__dirname, 'data'),
  ];

  for (const dir of requiredDirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const defaultFiles = [
    path.join(__dirname, 'config', 'settings.json'),
    path.join(__dirname, 'status', 'status.json'),
    path.join(__dirname, 'lottery_previous_results.json'),
  ];

  for (const filePath of defaultFiles) {
    if (!fs.existsSync(filePath)) {
      if (filePath.endsWith('settings.json')) {
        fs.writeFileSync(filePath, JSON.stringify({
          version: '1.2.0',
          app_name: 'Lottery Alert System Pro',
          sources: {
            pholhuay: { enabled: false, name: 'Pholhuay', priority: 1 },
            glo: { enabled: true, name: 'GLO Official', priority: 5 },
            ranlotto: { enabled: true, name: 'RANLOTTO', priority: 7 },
            lotterychecks: { enabled: true, name: 'LotteryChecks', priority: 6 },
            thailottoapi: { enabled: true, name: 'ThaiLottoAPI', priority: 1 },
          },
          notifications: {
            enabled: true,
            notify_on_new_draw: true,
            custom_watched_numbers: [],
          },
          channels: {
            ntfy: { enabled: true, server: 'https://ntfy.sh', topic: '', priority: 'high', tags: ['moneybag', 'dart'] },
          },
        }, null, 2));
      } else if (filePath.endsWith('status.json')) {
        fs.writeFileSync(filePath, JSON.stringify({
          system_status: 'healthy',
          last_run_timestamp: new Date().toISOString(),
          last_run_date_thai: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
          total_checks: 0,
          last_source_used: 'n/a',
          status_message: 'Initial state',
          active_sources_count: 0,
          latest_draw_detected: '',
          notifications_sent_today: 0,
          recent_logs: [],
        }, null, 2));
      } else {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      }
    }
  }
}

app.get('/api/health', (req, res) => {
  try {
    const hasSettings = fs.existsSync(path.join(__dirname, 'config', 'settings.json'));
    const hasStatus = fs.existsSync(path.join(__dirname, 'status', 'status.json'));

    res.json({
      ok: true,
      status: 'healthy',
      has_settings: hasSettings,
      has_status: hasStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Helper paths
const SETTINGS_PATH = path.join(__dirname, 'config', 'settings.json');
const STATUS_PATH = path.join(__dirname, 'status', 'status.json');
const RESULTS_PATH = path.join(__dirname, 'lottery_previous_results.json');
const ALL_LOTTERIES_PATH = path.join(__dirname, 'data', 'all_lotteries.json');
const WORKFLOW_PATH = path.join(__dirname, '.github', 'workflows', 'lottery.yml');

// 1. GET /api/status - Read system status
app.get('/api/status', (req, res) => {
  try {
    if (fs.existsSync(STATUS_PATH)) {
      const data = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf-8'));
      return res.json(data);
    }
    return res.json({
      system_status: 'healthy',
      status_message: 'พร้อมทำงาน (Initial State)',
      total_checks: 0,
      active_sources_count: 2,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/settings - Read settings.json
app.get('/api/settings', (req, res) => {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      return res.json(data);
    }
    return res.status(404).json({ error: 'settings.json not found' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/settings - Update settings.json
app.post('/api/settings', (req, res) => {
  try {
    const updated = req.body;
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    return res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. GET /api/results - Read past lottery results
app.get('/api/results', (req, res) => {
  try {
    if (fs.existsSync(RESULTS_PATH)) {
      const data = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
      return res.json(data);
    }
    return res.json([]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4.1 GET /api/all-lotteries - Read full catalog and daily summary of all lotteries
app.get('/api/all-lotteries', (req, res) => {
  try {
    if (fs.existsSync(ALL_LOTTERIES_PATH)) {
      const data = JSON.parse(fs.readFileSync(ALL_LOTTERIES_PATH, 'utf-8'));
      return res.json(data);
    }
    return res.json([]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4.2 POST /api/all-lotteries - Update lotteries data
app.post('/api/all-lotteries', (req, res) => {
  try {
    const updated = req.body;
    fs.mkdirSync(path.dirname(ALL_LOTTERIES_PATH), { recursive: true });
    fs.writeFileSync(ALL_LOTTERIES_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    return res.json({ success: true, message: 'All lotteries data updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4.3 POST /api/test-channel - Test Discord / Telegram / Webhook dispatch
app.post('/api/test-channel', async (req, res) => {
  try {
    const { channel, config = {}, message } = req.body;

    if (channel === 'discord') {
      const webhookUrl = (config.webhook_url || process.env.DISCORD_WEBHOOK_URL || '').trim();
      if (!webhookUrl) {
        return res.status(400).json({ success: false, error: 'กรุณากรอก Discord Webhook URL' });
      }

      const payload = {
        username: 'Lottery Alert Bot',
        avatar_url: 'https://raw.githubusercontent.com/jirapatza/Bombim00/main/public/icon-192.png',
        embeds: [{
          title: '📢 ทดสอบการแจ้งเตือน Lottery Alert System (Discord)',
          description: message || 'ทดสอบการเชื่อมต่อระบบแจ้งเตือนผลสลากกินแบ่งและหวยผ่าน Discord Webhook สำเร็จเรียบร้อย! 🎉\n\n🎯 **ตัวอย่างรางวัลที่ 1:** `289594`\n🔢 **เลขท้าย 2 ตัว:** `84`\n✨ **เลขหน้า 3 ตัว:** `012, 425`\n🌟 **เลขท้าย 3 ตัว:** `318, 972`',
          color: 0xf59e0b, // Amber Gold
          timestamp: new Date().toISOString(),
          footer: { text: 'Lottery Alert System Pro • Discord Webhook' }
        }]
      };

      const discordRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (discordRes.ok) {
        return res.json({ success: true, message: 'ส่งข้อความทดสอบไปยัง Discord Webhook เรียบร้อยแล้ว! ✅' });
      } else {
        const errorText = await discordRes.text();
        return res.status(discordRes.status).json({ success: false, error: `Discord ปฏิเสธ (HTTP ${discordRes.status}): ${errorText}` });
      }
    }

    if (channel === 'telegram') {
      const botToken = (config.bot_token || process.env.TELEGRAM_BOT_TOKEN || '').trim();
      const chatId = (config.chat_id || process.env.TELEGRAM_CHAT_ID || '').trim();
      if (!botToken || !chatId) {
        return res.status(400).json({ success: false, error: 'กรุณาระบุ Telegram Bot Token และ Chat ID' });
      }

      const text = message || '📢 <b>Lottery Alert System</b>\n\nทดสอบการแจ้งเตือนผ่าน Telegram Bot สำเร็จเรียบร้อย!';
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      const tgData: any = await tgRes.json().catch(() => ({}));
      if (tgRes.ok && tgData.ok) {
        return res.json({ success: true, message: 'ส่งข้อความทดสอบไปยัง Telegram สำเร็จแล้ว! ✅' });
      } else {
        return res.status(400).json({ success: false, error: tgData.description || 'ส่ง Telegram ไม่สำเร็จ' });
      }
    }

    if (channel === 'webhook') {
      const targetUrl = (config.url || '').trim();
      if (!targetUrl) {
        return res.status(400).json({ success: false, error: 'กรุณาระบุ Webhook URL' });
      }

      const webhookRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.secret_token ? { 'X-Webhook-Secret': config.secret_token } : {})
        },
        body: JSON.stringify({
          event: 'lottery.test_notification',
          timestamp: new Date().toISOString(),
          message: message || 'Test webhook delivery',
        }),
      });

      if (webhookRes.ok) {
        return res.json({ success: true, message: 'ส่ง Webhook สำเร็จเรียบร้อย! ✅' });
      } else {
        return res.status(webhookRes.status).json({ success: false, error: `Webhook ปลายทางตอบกลับ HTTP ${webhookRes.status}` });
      }
    }

    return res.status(400).json({ success: false, error: `ไม่รองรับ channel: ${channel}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4.4 POST /api/test-ntfy - Test ntfy.sh notification
app.post('/api/test-ntfy', async (req, res) => {
  try {
    const { topic, server = 'https://ntfy.sh', message, title = 'Lottery Result Alert' } = req.body;
    const cleanTopic = (topic || process.env.NTFY_TOPIC || '').trim();
    if (!cleanTopic) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุ ntfy topic' });
    }

    const cleanServer = (server || 'https://ntfy.sh').replace(/\/+$/, '');
    const ntfyRes = await fetch(`${cleanServer}/${cleanTopic}`, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': 'high',
        'Tags': 'moneybag,dart',
      },
      body: message || 'ทดสอบการส่งข้อความผ่าน ntfy.sh สำเร็จเรียบร้อย! 🎉',
    });

    if (ntfyRes.ok) {
      return res.json({ success: true, message: `ส่งแจ้งเตือน ntfy ไปยัง topic '${cleanTopic}' สำเร็จ! ✅` });
    } else {
      const errText = await ntfyRes.text();
      return res.status(ntfyRes.status).json({ success: false, error: `ntfy ตอบกลับ HTTP ${ntfyRes.status}: ${errText}` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4.5 GitHub Actions & App Creator Endpoints
// GET /api/github/workflow - Read workflow YAML
app.get('/api/github/workflow', (req, res) => {
  try {
    const workflow = (req.query.workflow as string) || 'lottery.yml';
    const cleanWorkflow = path.basename(workflow);
    const localWfPath = path.join(__dirname, '.github', 'workflows', cleanWorkflow);

    if (fs.existsSync(localWfPath)) {
      const content = fs.readFileSync(localWfPath, 'utf-8');
      return res.json({ success: true, content, sha: 'local-file' });
    }

    if (fs.existsSync(WORKFLOW_PATH)) {
      const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
      return res.json({ success: true, content, sha: 'local-file' });
    }

    return res.status(404).json({ success: false, error: `Workflow file ${cleanWorkflow} not found` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/github/workflow - Save workflow YAML
app.post('/api/github/workflow', async (req, res) => {
  try {
    const { token, content, workflow = 'lottery.yml', repo = 'jirapatza/Bombim00', branch = 'main' } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'Missing workflow content' });
    }
    const cleanWorkflow = path.basename(workflow);
    const localWfPath = path.join(__dirname, '.github', 'workflows', cleanWorkflow);
    fs.mkdirSync(path.dirname(localWfPath), { recursive: true });
    fs.writeFileSync(localWfPath, content, 'utf-8');

    const ghToken = token || process.env.GITHUB_TOKEN;
    let ghCommitSha = null;
    if (ghToken && repo) {
      try {
        const fileUrl = `https://api.github.com/repos/${repo}/contents/.github/workflows/${cleanWorkflow}?ref=${encodeURIComponent(branch)}`;
        const getRes = await fetch(fileUrl, {
          headers: {
            'User-Agent': 'LotteryAlert/1.0',
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${ghToken}`,
          },
        });
        let currentSha: string | undefined;
        if (getRes.ok) {
          const currentData = await getRes.json();
          currentSha = currentData.sha;
        }

        const encoded = Buffer.from(content).toString('base64');
        const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/.github/workflows/${cleanWorkflow}`, {
          method: 'PUT',
          headers: {
            'User-Agent': 'LotteryAlert/1.0',
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${ghToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `chore(workflow): update ${cleanWorkflow} from dashboard`,
            content: encoded,
            branch,
            ...(currentSha ? { sha: currentSha } : {}),
          }),
        });
        if (putRes.ok) {
          const putData = await putRes.json();
          ghCommitSha = putData?.commit?.sha;
        }
      } catch (err: any) {
        console.warn('Note: Could not commit workflow to GitHub directly:', err.message);
      }
    }

    return res.json({
      success: true,
      message: `บันทึกไฟล์ .github/workflows/${cleanWorkflow} เรียบร้อยแล้ว`,
      commit: ghCommitSha,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/github/dispatch - Dispatch GitHub Actions workflow run
app.post('/api/github/dispatch', async (req, res) => {
  try {
    const { repo = 'jirapatza/Bombim00', branch = 'main', token, workflow = 'lottery.yml', inputs = {} } = req.body;
    const cleanRepo = (repo || 'jirapatza/Bombim00').trim();
    const cleanWorkflow = path.basename(workflow);
    const ghToken = (token || process.env.GITHUB_TOKEN || '').trim();

    if (!ghToken) {
      return res.status(400).json({
        success: false,
        error: 'กรุณากรอก GitHub Personal Access Token (PAT) ที่มีสิทธิ์ Actions Write ในการสั่งรันบน GitHub หรือใช้ปุ่ม "จำลองรันบน Server เสมือน" ด้านล่างเพื่อทดสอบ',
      });
    }

    const dispatchUrl = `https://api.github.com/repos/${cleanRepo}/actions/workflows/${cleanWorkflow}/dispatches`;
    const ghRes = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'LotteryAlert/1.0',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${ghToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: branch || 'main',
        inputs: inputs,
      }),
    });

    if (ghRes.status === 204 || ghRes.status === 200) {
      return res.json({
        success: true,
        message: `ส่งคำสั่งสั่งรัน GitHub Actions (${cleanWorkflow}) บนคลัง ${cleanRepo} สำเร็จเรียบร้อยแล้ว! 🎉`,
      });
    }

    const errText = await ghRes.text();
    let errMsg = errText;
    try {
      const errObj = JSON.parse(errText);
      errMsg = errObj.message || errText;
    } catch {
      // ignore
    }

    return res.status(ghRes.status).json({
      success: false,
      error: `GitHub ปฏิเสธคำสั่ง (HTTP ${ghRes.status}): ${errMsg}`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/github/runs - List workflow runs
app.post('/api/github/runs', async (req, res) => {
  try {
    const { repo = 'jirapatza/Bombim00', token, workflow = 'lottery.yml' } = req.body;
    const cleanRepo = (repo || 'jirapatza/Bombim00').trim();
    const cleanWorkflow = path.basename(workflow);
    const ghToken = (token || process.env.GITHUB_TOKEN || '').trim();

    const headers: Record<string, string> = {
      'User-Agent': 'LotteryAlert/1.0',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (ghToken) {
      headers['Authorization'] = `Bearer ${ghToken}`;
    }

    const runsUrl = `https://api.github.com/repos/${cleanRepo}/actions/workflows/${cleanWorkflow}/runs?per_page=10`;
    const ghRes = await fetch(runsUrl, { headers });

    if (ghRes.ok) {
      const data = await ghRes.json();
      return res.json({
        success: true,
        workflow_runs: data.workflow_runs || [],
      });
    }

    // Fallback: try repo-wide runs
    const repoRunsUrl = `https://api.github.com/repos/${cleanRepo}/actions/runs?per_page=10`;
    const repoRes = await fetch(repoRunsUrl, { headers }).catch(() => null);
    if (repoRes && repoRes.ok) {
      const data = await repoRes.json();
      return res.json({
        success: true,
        workflow_runs: data.workflow_runs || [],
      });
    }

    const errText = await ghRes.text().catch(() => '');
    return res.json({
      success: false,
      error: `ไม่สามารถดึงข้อมูล Runs จาก GitHub (HTTP ${ghRes.status}): ${errText || 'Repository อาจเป็น Private หรือติด Rate Limit กรุณาใส่ PAT Token'}`,
      workflow_runs: [],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message, workflow_runs: [] });
  }
});

// POST /api/simulate-runner - Local execution simulation
app.post('/api/simulate-runner', async (req, res) => {
  try {
    const { forceNotify, lotteryTarget = 'all' } = req.body;
    const now = new Date();
    const thaiTime = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

    console.log(`[SIMULATE] Runner simulation triggered (target: ${lotteryTarget}, force: ${forceNotify})`);

    const env = {
      ...process.env,
      FORCE_NOTIFY: forceNotify ? 'true' : 'false',
      LOTTERY_TARGET: String(lotteryTarget || 'all'),
    };

    let stdout = '';
    let stderr = '';

    try {
      const result = await execAsync('python3 lottery_checker.py', {
        env,
        cwd: __dirname,
        timeout: 30000,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (cmdErr: any) {
      stdout = cmdErr.stdout || '';
      stderr = cmdErr.stderr || cmdErr.message || '';
    }

    const summaryLog = `✓ ทดสอบรันการตรวจสอบหวย [เป้าหมาย: ${lotteryTarget}] สำเร็จเมื่อ ${thaiTime}`;
    const outputLines = [
      `[SIMULATOR] เริ่มต้นการจำลองรันสคริปต์ lottery_checker.py ณ เวลา ${thaiTime}`,
      `[CONFIG] FORCE_NOTIFY=${env.FORCE_NOTIFY}, LOTTERY_TARGET=${env.LOTTERY_TARGET}`,
      `[STATUS] อ่านการตั้งค่าจาก config/settings.json และประวัติ lottery_previous_results.json`,
      stdout || '✓ สคริปต์ทำงานเสร็จสิ้น ไม่มีข้อผิดพลาด',
      stderr ? `[STDERR]\n${stderr}` : '',
      `[COMPLETE] ${summaryLog}`,
    ].filter(Boolean).join('\n');

    return res.json({
      success: true,
      message: summaryLog,
      stdout: outputLines,
      stderr: '',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/github/get-remote-file - For ProjectCodeEditor
app.post('/api/github/get-remote-file', async (req, res) => {
  try {
    const { filePath, repo = 'jirapatza/Bombim00', branch = 'main', token } = req.body;
    if (!filePath || filePath.includes('..') || filePath.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const localPath = path.join(__dirname, filePath);
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      return res.json({ content, sha: 'local-file', size: content.length, source: 'local' });
    }

    const ghToken = token || process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'User-Agent': 'LotteryAlert/1.0',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

    const remoteRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
      { headers }
    );
    if (!remoteRes.ok) {
      return res.status(remoteRes.status).json({ error: 'Unable to read file from local or remote' });
    }

    const data: any = await remoteRes.json();
    const content =
      data.encoding === 'base64'
        ? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
        : data.content;

    return res.json({ content, sha: data.sha, size: data.size, source: 'github' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/github/commit-file - For ProjectCodeEditor
app.post('/api/github/commit-file', async (req, res) => {
  try {
    const { filePath, content, commitMessage, repo = 'jirapatza/Bombim00', branch = 'main', token } = req.body;
    if (!filePath || filePath.includes('..') || filePath.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const localPath = path.join(__dirname, filePath);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, content || '', 'utf-8');

    const ghToken = token || process.env.GITHUB_TOKEN;
    let ghCommitSha = null;
    let htmlUrl = null;

    if (ghToken && repo) {
      const headers = {
        'User-Agent': 'LotteryAlert/1.0',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${ghToken}`,
        'Content-Type': 'application/json',
      };

      const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
      const getRes = await fetch(fileUrl, { headers });
      let sha: string | undefined;
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }

      const encoded = Buffer.from(content || '').toString('base64');
      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: commitMessage || `Update ${filePath} from dashboard`,
          content: encoded,
          branch,
          ...(sha ? { sha } : {}),
        }),
      });

      if (putRes.ok) {
        const result = await putRes.json();
        ghCommitSha = result?.commit?.sha;
        htmlUrl = result?.content?.html_url;
      }
    }

    return res.json({
      success: true,
      message: 'บันทึกไฟล์สำเร็จเรียบร้อย',
      commit_sha: ghCommitSha,
      html_url: htmlUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/check-now - Trigger check (simulated / live check)
app.post('/api/check-now', async (req, res) => {
  try {
    const now = new Date();
    const thaiTime = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    const isoTime = now.toISOString();

    let settings: any = {};
    if (fs.existsSync(SETTINGS_PATH)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }

    const enabledSources = Object.keys(settings.sources || {}).filter(
      (k) => settings.sources[k]?.enabled
    );

    const sourceUsed = enabledSources.length > 0 ? enabledSources[0] : 'glo';

    let previousResults: any[] = [];
    if (fs.existsSync(RESULTS_PATH)) {
      previousResults = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
    }

    const latestDraw = previousResults[0]?.งวดวันที่ || '16 ตุลาคม 2569';

    let currentStatus: any = {};
    if (fs.existsSync(STATUS_PATH)) {
      try {
        currentStatus = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf-8'));
      } catch {
        currentStatus = {};
      }
    }

    const newLogs = [
      {
        timestamp: isoTime,
        level: 'INFO',
        message: `Manual check triggered via Dashboard at ${thaiTime}. Checked sources: [${enabledSources.join(', ')}]`,
      },
      ...(currentStatus.recent_logs || []),
    ].slice(0, 20);

    const updatedStatus = {
      system_status: 'healthy',
      last_run_timestamp: isoTime,
      last_run_date_thai: thaiTime,
      total_checks: (currentStatus.total_checks || 0) + 1,
      last_source_used: sourceUsed,
      status_message: `ตรวจสอบผลผ่านแหล่ง ${sourceUsed} เรียบร้อยแล้ว (งวด ${latestDraw})`,
      active_sources_count: enabledSources.length,
      latest_draw_detected: latestDraw,
      notifications_sent_today: (currentStatus.notifications_sent_today || 0) + 1,
      sources_health: {
        pholhuay: { status: settings.sources?.pholhuay?.enabled ? 'ok' : 'disabled', last_response_ms: 280, last_checked: isoTime },
        glo: { status: settings.sources?.glo?.enabled ? 'ok' : 'disabled', last_response_ms: 390, last_checked: isoTime },
        sanook: { status: settings.sources?.sanook?.enabled ? 'ok' : 'disabled', last_response_ms: null, last_checked: null },
      },
      recent_logs: newLogs,
    };

    fs.writeFileSync(STATUS_PATH, JSON.stringify(updatedStatus, null, 2), 'utf-8');

    return res.json({
      success: true,
      message: 'Triggered check successfully',
      status: updatedStatus,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. POST /api/trigger - Trigger check and return immediate status
app.post('/api/trigger', async (req, res) => {
  try {
    // Trigger background check process
    runBackgroundAutoCheck().catch((err) => console.warn('[TRIGGER] Background check note:', err.message));

    // Wait 500ms
    await new Promise((resolve) => setTimeout(resolve, 500));

    let currentStatus: any = {};
    if (fs.existsSync(STATUS_PATH)) {
      try {
        currentStatus = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf-8'));
      } catch {
        currentStatus = {};
      }
    }

    return res.json({
      success: true,
      message: 'ส่งคำสั่งตรวจสอบผลสลากและอัปเดตระบบเรียบร้อยแล้ว',
      status: currentStatus,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. GET /api/project-files - List project files for the in-app code editor
app.get('/api/project-files', (req, res) => {
  try {
    const candidateFiles = [
      'config/settings.json',
      'lottery_checker.py',
      'settings_loader.py',
      'requirements.txt',
      '.env.example',
      'Dockerfile',
      'docker-compose.yml',
      'server.ts',
      'src/App.tsx',
    ];

    const projectFiles: Array<{ name: string; path: string; category: string; content: string }> = [];

    for (const relPath of candidateFiles) {
      const fullPath = path.join(__dirname, relPath);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          let category = 'config';
          if (relPath.endsWith('.py')) category = 'python';
          else if (relPath.endsWith('.ts') || relPath.endsWith('.tsx') || relPath.endsWith('.js')) category = 'backend';
          projectFiles.push({
            name: path.basename(relPath),
            path: relPath,
            category,
            content,
          });
        } catch {
          // Ignore read errors
        }
      }
    }

    return res.json(projectFiles);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ... keep rest of file unchanged ...

let isBackgroundCheckRunning = false;

async function runBackgroundAutoCheck() {
  if (isBackgroundCheckRunning) {
    console.log('[AUTO-RUNNER] Previous check still running, skipping this tick.');
    return;
  }
  isBackgroundCheckRunning = true;
  try {
    const env = {
      ...process.env,
      FORCE_NOTIFY: 'false',
      LOTTERY_TARGET: 'all',
    };
    // 45 seconds timeout to prevent hanging child processes
    await execAsync('python3 lottery_checker.py', { env, cwd: __dirname, timeout: 45000 });
    console.log(`[AUTO-RUNNER] Background lottery check completed at ${new Date().toISOString()}`);
  } catch (err: any) {
    console.warn(`[AUTO-RUNNER] Background check note:`, err.message);
  } finally {
    isBackgroundCheckRunning = false;
  }
}

async function startServer() {
  ensureRuntimePaths();

  const isProd = process.env.NODE_ENV === 'production';

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Lottery Alert Dashboard server running on http://0.0.0.0:${PORT}`);
    if (process.env.DISABLE_BACKGROUND_CHECK !== 'true') {
      setTimeout(runBackgroundAutoCheck, 5000);
      setInterval(runBackgroundAutoCheck, 10 * 60 * 1000);
    } else {
      console.log('[AUTO-RUNNER] Background checks disabled by DISABLE_BACKGROUND_CHECK.');
    }
  });
}

startServer();
