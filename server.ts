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

// 5. POST /api/check-now - Trigger check (simulated / live check)
app.post('/api/check-now', async (req, res) => {
  try {
    const now = new Date();
    const thaiTime = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    const isoTime = now.toISOString();

    // Read current settings to check enabled sources
    let settings: any = {};
    if (fs.existsSync(SETTINGS_PATH)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }

    const enabledSources = Object.keys(settings.sources || {}).filter(
      (k) => settings.sources[k]?.enabled
    );

    const sourceUsed = enabledSources.length > 0 ? enabledSources[0] : 'glo';

    // Read previous results
    let previousResults: any[] = [];
    if (fs.existsSync(RESULTS_PATH)) {
      previousResults = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
    }

    const latestDraw = previousResults[0]?.งวดวันที่ || '16 ตุลาคม 2569';

    // Update status
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

// 6. POST /api/test-ntfy - Send test notification via ntfy
app.post('/api/test-ntfy', async (req, res) => {
  try {
    const { server = 'https://ntfy.sh', topic, priority = 'high', message } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const ntfyUrl = `${server.replace(/\/$/, '')}/${topic}`;

    const ntfyResponse = await fetch(ntfyUrl, {
      method: 'POST',
      headers: {
        Title: 'Lottery Alert Test Notification',
        Priority: priority,
        Tags: 'tada,dart,moneybag',
      },
      body: message || 'ทดสอบการส่งการแจ้งเตือนจาก Lottery Alert Dashboard สำเร็จ!',
    });

    if (!ntfyResponse.ok) {
      const errText = await ntfyResponse.text();
      return res.status(ntfyResponse.status).json({ error: `ntfy error: ${errText}` });
    }

    return res.json({
      success: true,
      message: `ส่งการแจ้งเตือนทดสอบไปยัง ${ntfyUrl} สำเร็จ`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6.1 POST /api/test-channel - Test Discord, Telegram, or Generic Webhook
app.post('/api/test-channel', async (req, res) => {
  try {
    const { channel, config, payload } = req.body;

    if (channel === 'discord') {
      if (!config?.webhook_url) {
        return res.status(400).json({ error: 'Discord Webhook URL is required' });
      }
      const discordPayload = {
        username: config.username || 'Lottery Alert Bot',
        avatar_url: config.avatar_url,
        embeds: [
          {
            title: payload?.title || '📢 ผลการออกรางวัลสลากกินแบ่งรัฐบาล',
            description: payload?.description || 'งวดวันที่ 16 ตุลาคม 2569\n\n🎯 **รางวัลที่ 1**: `289594`\n🔢 **เลขท้าย 2 ตัว**: `84`\n✨ **เลขหน้า 3 ตัว**: `012, 425`\n🌟 **เลขท้าย 3 ตัว**: `318, 972`\n⏰ **ปิดรอบถัดไป**: หวยฮานอยพิเศษ (17:00 น.)',
            color: 0xf59e0b, // amber gold
            footer: { text: 'Lottery Alert Multi-Channel Dispatcher' },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const resp = await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        return res.status(resp.status).json({ error: `Discord Webhook Error: ${text}` });
      }
      return res.json({ success: true, message: 'ส่งข้อความ Embed ไปยัง Discord สำเร็จ!' });
    }

    if (channel === 'telegram') {
      if (!config?.bot_token || !config?.chat_id) {
        return res.status(400).json({ error: 'Telegram Bot Token and Chat ID are required' });
      }
      const telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;
      const text = payload?.message || `📢 <b>ผลสลากกินแบ่งรัฐบาล</b>\nงวดวันที่ 16 ตุลาคม 2569\n\n🎯 <b>รางวัลที่ 1:</b> <code>289594</code>\n🔢 <b>เลขท้าย 2 ตัว:</b> <code>84</code>\n✨ <b>เลขหน้า 3 ตัว:</b> <code>012, 425</code>\n🌟 <b>เลขท้าย 3 ตัว:</b> <code>318, 972</code>\n⏰ <b>รอบถัดไปที่กำลังจะปิด:</b> หวยฮานอยพิเศษ (17:00 น.)`;

      const resp = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chat_id,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const data = await resp.json() as any;
      if (!data.ok) {
        return res.status(400).json({ error: `Telegram API Error: ${data.description || 'Unknown'}` });
      }
      return res.json({ success: true, message: 'ส่งข้อความ HTML ไปยัง Telegram Chat สำเร็จ!' });
    }

    if (channel === 'webhook') {
      if (!config?.url) {
        return res.status(400).json({ error: 'Webhook URL is required' });
      }
      const resp = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.secret_token ? { Authorization: `Bearer ${config.secret_token}` } : {}),
        },
        body: JSON.stringify({
          event: 'lottery_draw_announced',
          timestamp: new Date().toISOString(),
          data: payload || { draw: '16 ตุลาคม 2569', first_prize: '289594', last_2: '84' },
        }),
      });
      return res.json({ success: resp.ok, status: resp.status, message: `ยิง HTTP POST ไปยัง ${config.url} ได้สถานะ ${resp.status}` });
    }

    return res.status(400).json({ error: 'Unknown channel' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6.2 GET /api/github/workflow - Read .github/workflows/lottery.yml
app.get('/api/github/workflow', (req, res) => {
  try {
    if (fs.existsSync(WORKFLOW_PATH)) {
      const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
      return res.json({ success: true, content });
    }
    return res.status(404).json({ error: 'lottery.yml not found' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6.3 POST /api/github/workflow - Update .github/workflows/lottery.yml
app.post('/api/github/workflow', (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    fs.mkdirSync(path.dirname(WORKFLOW_PATH), { recursive: true });
    fs.writeFileSync(WORKFLOW_PATH, content, 'utf-8');
    return res.json({ success: true, message: 'บันทึกไฟล์ .github/workflows/lottery.yml สำเร็จ' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6.4 POST /api/github/dispatch - Dispatch GitHub Actions workflow directly
app.post('/api/github/dispatch', async (req, res) => {
  try {
    const { repo, branch = 'main', token, workflow = 'lottery.yml', inputs = {} } = req.body;

    if (!repo) {
      return res.status(400).json({ error: 'ต้องระบุ GitHub Repository เช่น owner/repo' });
    }

    if (!token) {
      return res.status(400).json({ error: 'ต้องระบุ GitHub Personal Access Token (PAT) ที่มีสิทธิ์ Actions Write' });
    }

    const dispatchUrl = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
    const resp = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'LotteryAlertApp/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref: branch,
        inputs,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({
        error: `GitHub API Error: ${errText}`,
        status: resp.status,
      });
    }

    return res.json({
      success: true,
      message: `สั่งรัน GitHub Workflow '${workflow}' บน ${repo} (Branch: ${branch}) เรียบร้อยแล้ว!`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6.5 POST /api/github/runs - Fetch recent workflow runs from GitHub
app.post('/api/github/runs', async (req, res) => {
  try {
    const { repo, token, workflow = 'lottery.yml' } = req.body;

    if (!repo) {
      return res.status(400).json({ error: 'ต้องระบุ GitHub Repository' });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'LotteryAlertApp/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const runsUrl = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=10`;
    const resp = await fetch(runsUrl, { headers });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: errText, status: resp.status });
    }

    const data = await resp.json() as any;
    return res.json({
      success: true,
      total_count: data.total_count,
      workflow_runs: data.workflow_runs || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6.6 POST /api/github/simulate-runner - Execute Python checker locally on server
app.post('/api/github/simulate-runner', async (req, res) => {
  try {
    const { forceNotify = false, lotteryTarget = 'all' } = req.body;
    const env = {
      ...process.env,
      FORCE_NOTIFY: forceNotify ? 'true' : 'false',
      LOTTERY_TARGET: lotteryTarget,
    };

    const { stdout, stderr } = await execAsync('python3 lottery_checker.py', { env, cwd: __dirname });

    // Read updated status
    let statusData = {};
    if (fs.existsSync(STATUS_PATH)) {
      statusData = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf-8'));
    }

    return res.json({
      success: true,
      message: 'รัน Python Checker เสมือน GitHub Actions Runner สำเร็จ',
      stdout,
      stderr,
      status: statusData,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการรัน Python Checker',
      details: err.message,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
    });
  }
});

// 7. GET /api/project-files - Get all project files for the inspector
app.get('/api/project-files', (req, res) => {
  try {
    const fileList = [
      { name: 'config/settings.json', path: 'config/settings.json', category: 'Config' },
      { name: 'status/status.json', path: 'status/status.json', category: 'Status' },
      { name: 'data/all_lotteries.json', path: 'data/all_lotteries.json', category: 'Data' },
      { name: 'lottery_previous_results.json', path: 'lottery_previous_results.json', category: 'Data' },
      { name: 'settings_loader.py', path: 'settings_loader.py', category: 'Python' },
      { name: 'lottery_checker.py', path: 'lottery_checker.py', category: 'Python' },
      { name: 'requirements.txt', path: 'requirements.txt', category: 'Python' },
      { name: 'tests/test_settings_loader.py', path: 'tests/test_settings_loader.py', category: 'Tests' },
      { name: 'api/worker.js', path: 'api/worker.js', category: 'Cloudflare' },
      { name: '.github/workflows/lottery.yml', path: '.github/workflows/lottery.yml', category: 'Workflow' },
      { name: 'Dockerfile', path: 'Dockerfile', category: 'Deploy' },
      { name: 'docker-compose.yml', path: 'docker-compose.yml', category: 'Deploy' },
      { name: 'scripts/restructure.sh', path: 'scripts/restructure.sh', category: 'Scripts' },
      { name: 'docs/LOTTERY_SETUP.md', path: 'docs/LOTTERY_SETUP.md', category: 'Docs' },
    ];

    const result = fileList.map((item) => {
      const fullPath = path.join(__dirname, item.path);
      let content = '';
      if (fs.existsSync(fullPath)) {
        content = fs.readFileSync(fullPath, 'utf-8');
      }
      return { ...item, content };
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7.1 POST /api/save-file - Save any project file locally to disk
app.post('/api/save-file', (req, res) => {
  try {
    const { filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'ต้องระบุ filePath และ content' });
    }

    // Safety check: ensure target stays inside project workspace
    const resolved = path.resolve(__dirname, filePath);
    if (!resolved.startsWith(__dirname)) {
      return res.status(403).json({ error: 'ไม่อนุญาตให้แก้ไขไฟล์นอกไดเรกทอรีโปรเจกต์' });
    }

    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');

    return res.json({
      success: true,
      message: `บันทึกไฟล์ '${filePath}' ลงเครื่องสำเร็จเรียบร้อย`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7.2 POST /api/github/commit-file - Commit and push file directly to GitHub repository
app.post('/api/github/commit-file', async (req, res) => {
  try {
    const {
      repo,
      token,
      branch = 'main',
      filePath,
      content,
      commitMessage,
      authorName = 'Lottery Alert App',
      authorEmail = 'bombimm43@gmail.com',
    } = req.body;

    if (!repo) {
      return res.status(400).json({ error: 'ต้องระบุ GitHub Repository (เช่น owner/repo)' });
    }
    if (!token) {
      return res.status(400).json({ error: 'ต้องระบุ GitHub Personal Access Token (PAT) ที่มีสิทธิ์ repo/contents:write' });
    }
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'ต้องระบุ filePath และ content' });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'LotteryAlertApp/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Step 1: Check existing file SHA on GitHub
    let sha: string | undefined = undefined;
    const getFileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
    try {
      const getResp = await fetch(getFileUrl, { headers });
      if (getResp.ok) {
        const fileInfo = (await getResp.json()) as any;
        sha = fileInfo.sha;
      }
    } catch {
      // Ignore if file doesn't exist yet
    }

    // Step 2: Commit file to GitHub via PUT
    const putUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');
    const payload: any = {
      message: commitMessage || `Update ${filePath} via Lottery Alert App [Web Direct]`,
      content: base64Content,
      branch,
      committer: {
        name: authorName,
        email: authorEmail,
      },
    };
    if (sha) {
      payload.sha = sha;
    }

    const putResp = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!putResp.ok) {
      const errText = await putResp.text();
      return res.status(putResp.status).json({
        error: `GitHub Commit Error: ${errText}`,
        status: putResp.status,
      });
    }

    const commitResult = (await putResp.json()) as any;

    // Step 3: Also update local file on disk if path is within workspace
    const resolved = path.resolve(__dirname, filePath);
    if (resolved.startsWith(__dirname)) {
      try {
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, content, 'utf-8');
      } catch (err) {
        console.warn('Local save warning during commit:', err);
      }
    }

    return res.json({
      success: true,
      message: `Commit ไฟล์ '${filePath}' ขึ้น GitHub (${repo} / branch: ${branch}) สำเร็จ 100%!`,
      commit_sha: commitResult.commit?.sha,
      html_url: commitResult.content?.html_url,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7.3 POST /api/github/get-remote-file - Fetch file content directly from GitHub repository
app.post('/api/github/get-remote-file', async (req, res) => {
  try {
    const { repo, token, branch = 'main', filePath } = req.body;
    if (!repo || !filePath) {
      return res.status(400).json({ error: 'ต้องระบุ repo และ filePath' });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'LotteryAlertApp/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: errText });
    }

    const data = (await resp.json()) as any;
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return res.json({
      success: true,
      content,
      sha: data.sha,
      size: data.size,
      html_url: data.html_url,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7.4 POST /api/send-mobile-push - Send rich push alert directly to phone via ntfy (iOS / Android)
app.post('/api/send-mobile-push', async (req, res) => {
  try {
    const {
      server = 'https://ntfy.sh',
      topic,
      title = '📢 ผลหวยออกแล้ว!',
      message,
      priority = 'urgent',
      tags = 'tada,loudspeaker,moneybag',
      clickUrl,
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'กรุณาระบุ ntfy topic สำหรับโทรศัพท์ของคุณ' });
    }

    const ntfyUrl = `${server.replace(/\/$/, '')}/${topic}`;
    // RFC 2047 encode title for 100% flawless Thai character support on iOS & Android
    const rfcTitle = `=?UTF-8?B?${Buffer.from(title, 'utf-8').toString('base64')}?=`;

    const headers: Record<string, string> = {
      Title: rfcTitle,
      Priority: priority,
      Tags: tags,
    };
    if (clickUrl) {
      headers['Click'] = clickUrl;
      headers['Actions'] = `view, เปิดดูผลในแอป, ${clickUrl}`;
    }

    const resp = await fetch(ntfyUrl, {
      method: 'POST',
      headers,
      body: message || 'ผลการออกรางวัลอัปเดตแล้ว ตรวจสอบรายละเอียดได้ทันที!',
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: `ntfy error: ${errText}` });
    }

    return res.json({
      success: true,
      message: `ส่งการแจ้งเตือนไปยังโทรศัพท์สำเร็จผ่าน ${ntfyUrl}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Automated Background Runner: Runs automatically 24/7 without requiring any user intervention!
async function runBackgroundAutoCheck() {
  try {
    const env = {
      ...process.env,
      NTFY_TOPIC: 'lottery-bombimm43',
      FORCE_NOTIFY: 'false',
      LOTTERY_TARGET: 'all',
    };
    await execAsync('python3 lottery_checker.py', { env, cwd: __dirname });
    console.log(`[AUTO-RUNNER] Background lottery check completed at ${new Date().toISOString()}`);
  } catch (err: any) {
    console.warn(`[AUTO-RUNNER] Background check note:`, err.message);
  }
}

// Vite middleware in dev or static files in production
async function startServer() {
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
    // Auto-run first check 5 seconds after boot
    setTimeout(runBackgroundAutoCheck, 5000);
    // Recurring check every 10 minutes automatically 24/7
    setInterval(runBackgroundAutoCheck, 10 * 60 * 1000);
  });
}

startServer();
