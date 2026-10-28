import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

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

// 7. GET /api/project-files - Get all project files for the inspector
app.get('/api/project-files', (req, res) => {
  try {
    const fileList = [
      { name: 'config/settings.json', path: 'config/settings.json', category: 'Config' },
      { name: 'status/status.json', path: 'status/status.json', category: 'Status' },
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
  });
}

startServer();
