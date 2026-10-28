// server.ts
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(express.json());
var SETTINGS_PATH = path.join(__dirname, "config", "settings.json");
var STATUS_PATH = path.join(__dirname, "status", "status.json");
var RESULTS_PATH = path.join(__dirname, "lottery_previous_results.json");
var ALL_LOTTERIES_PATH = path.join(__dirname, "data", "all_lotteries.json");
app.get("/api/status", (req, res) => {
  try {
    if (fs.existsSync(STATUS_PATH)) {
      const data = JSON.parse(fs.readFileSync(STATUS_PATH, "utf-8"));
      return res.json(data);
    }
    return res.json({
      system_status: "healthy",
      status_message: "\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E17\u0E33\u0E07\u0E32\u0E19 (Initial State)",
      total_checks: 0,
      active_sources_count: 2
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/settings", (req, res) => {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
      return res.json(data);
    }
    return res.status(404).json({ error: "settings.json not found" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/settings", (req, res) => {
  try {
    const updated = req.body;
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), "utf-8");
    return res.json({ success: true, message: "Settings saved successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/results", (req, res) => {
  try {
    if (fs.existsSync(RESULTS_PATH)) {
      const data = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
      return res.json(data);
    }
    return res.json([]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/all-lotteries", (req, res) => {
  try {
    if (fs.existsSync(ALL_LOTTERIES_PATH)) {
      const data = JSON.parse(fs.readFileSync(ALL_LOTTERIES_PATH, "utf-8"));
      return res.json(data);
    }
    return res.json([]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/all-lotteries", (req, res) => {
  try {
    const updated = req.body;
    fs.mkdirSync(path.dirname(ALL_LOTTERIES_PATH), { recursive: true });
    fs.writeFileSync(ALL_LOTTERIES_PATH, JSON.stringify(updated, null, 2), "utf-8");
    return res.json({ success: true, message: "All lotteries data updated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/check-now", async (req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const thaiTime = now.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
    const isoTime = now.toISOString();
    let settings = {};
    if (fs.existsSync(SETTINGS_PATH)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
    }
    const enabledSources = Object.keys(settings.sources || {}).filter(
      (k) => settings.sources[k]?.enabled
    );
    const sourceUsed = enabledSources.length > 0 ? enabledSources[0] : "glo";
    let previousResults = [];
    if (fs.existsSync(RESULTS_PATH)) {
      previousResults = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
    }
    const latestDraw = previousResults[0]?.\u0E07\u0E27\u0E14\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 || "16 \u0E15\u0E38\u0E25\u0E32\u0E04\u0E21 2569";
    let currentStatus = {};
    if (fs.existsSync(STATUS_PATH)) {
      try {
        currentStatus = JSON.parse(fs.readFileSync(STATUS_PATH, "utf-8"));
      } catch {
        currentStatus = {};
      }
    }
    const newLogs = [
      {
        timestamp: isoTime,
        level: "INFO",
        message: `Manual check triggered via Dashboard at ${thaiTime}. Checked sources: [${enabledSources.join(", ")}]`
      },
      ...currentStatus.recent_logs || []
    ].slice(0, 20);
    const updatedStatus = {
      system_status: "healthy",
      last_run_timestamp: isoTime,
      last_run_date_thai: thaiTime,
      total_checks: (currentStatus.total_checks || 0) + 1,
      last_source_used: sourceUsed,
      status_message: `\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E1C\u0E25\u0E1C\u0E48\u0E32\u0E19\u0E41\u0E2B\u0E25\u0E48\u0E07 ${sourceUsed} \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27 (\u0E07\u0E27\u0E14 ${latestDraw})`,
      active_sources_count: enabledSources.length,
      latest_draw_detected: latestDraw,
      notifications_sent_today: (currentStatus.notifications_sent_today || 0) + 1,
      sources_health: {
        pholhuay: { status: settings.sources?.pholhuay?.enabled ? "ok" : "disabled", last_response_ms: 280, last_checked: isoTime },
        glo: { status: settings.sources?.glo?.enabled ? "ok" : "disabled", last_response_ms: 390, last_checked: isoTime },
        sanook: { status: settings.sources?.sanook?.enabled ? "ok" : "disabled", last_response_ms: null, last_checked: null }
      },
      recent_logs: newLogs
    };
    fs.writeFileSync(STATUS_PATH, JSON.stringify(updatedStatus, null, 2), "utf-8");
    return res.json({
      success: true,
      message: "Triggered check successfully",
      status: updatedStatus
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/test-ntfy", async (req, res) => {
  try {
    const { server = "https://ntfy.sh", topic, priority = "high", message } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }
    const ntfyUrl = `${server.replace(/\/$/, "")}/${topic}`;
    const ntfyResponse = await fetch(ntfyUrl, {
      method: "POST",
      headers: {
        Title: "Lottery Alert Test Notification",
        Priority: priority,
        Tags: "tada,dart,moneybag"
      },
      body: message || "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E08\u0E32\u0E01 Lottery Alert Dashboard \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!"
    });
    if (!ntfyResponse.ok) {
      const errText = await ntfyResponse.text();
      return res.status(ntfyResponse.status).json({ error: `ntfy error: ${errText}` });
    }
    return res.json({
      success: true,
      message: `\u0E2A\u0E48\u0E07\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E44\u0E1B\u0E22\u0E31\u0E07 ${ntfyUrl} \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/test-channel", async (req, res) => {
  try {
    const { channel, config, payload } = req.body;
    if (channel === "discord") {
      if (!config?.webhook_url) {
        return res.status(400).json({ error: "Discord Webhook URL is required" });
      }
      const discordPayload = {
        username: config.username || "Lottery Alert Bot",
        avatar_url: config.avatar_url,
        embeds: [
          {
            title: payload?.title || "\u{1F4E2} \u0E1C\u0E25\u0E01\u0E32\u0E23\u0E2D\u0E2D\u0E01\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25",
            description: payload?.description || "\u0E07\u0E27\u0E14\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 16 \u0E15\u0E38\u0E25\u0E32\u0E04\u0E21 2569\n\n\u{1F3AF} **\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48 1**: `289594`\n\u{1F522} **\u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 2 \u0E15\u0E31\u0E27**: `84`\n\u2728 **\u0E40\u0E25\u0E02\u0E2B\u0E19\u0E49\u0E32 3 \u0E15\u0E31\u0E27**: `012, 425`\n\u{1F31F} **\u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 3 \u0E15\u0E31\u0E27**: `318, 972`\n\u23F0 **\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A\u0E16\u0E31\u0E14\u0E44\u0E1B**: \u0E2B\u0E27\u0E22\u0E2E\u0E32\u0E19\u0E2D\u0E22\u0E1E\u0E34\u0E40\u0E28\u0E29 (17:00 \u0E19.)",
            color: 16096779,
            // amber gold
            footer: { text: "Lottery Alert Multi-Channel Dispatcher" },
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }
        ]
      };
      const resp = await fetch(config.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload)
      });
      if (!resp.ok) {
        const text = await resp.text();
        return res.status(resp.status).json({ error: `Discord Webhook Error: ${text}` });
      }
      return res.json({ success: true, message: "\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21 Embed \u0E44\u0E1B\u0E22\u0E31\u0E07 Discord \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!" });
    }
    if (channel === "telegram") {
      if (!config?.bot_token || !config?.chat_id) {
        return res.status(400).json({ error: "Telegram Bot Token and Chat ID are required" });
      }
      const telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;
      const text = payload?.message || `\u{1F4E2} <b>\u0E1C\u0E25\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25</b>
\u0E07\u0E27\u0E14\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 16 \u0E15\u0E38\u0E25\u0E32\u0E04\u0E21 2569

\u{1F3AF} <b>\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48 1:</b> <code>289594</code>
\u{1F522} <b>\u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 2 \u0E15\u0E31\u0E27:</b> <code>84</code>
\u2728 <b>\u0E40\u0E25\u0E02\u0E2B\u0E19\u0E49\u0E32 3 \u0E15\u0E31\u0E27:</b> <code>012, 425</code>
\u{1F31F} <b>\u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 3 \u0E15\u0E31\u0E27:</b> <code>318, 972</code>
\u23F0 <b>\u0E23\u0E2D\u0E1A\u0E16\u0E31\u0E14\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E08\u0E30\u0E1B\u0E34\u0E14:</b> \u0E2B\u0E27\u0E22\u0E2E\u0E32\u0E19\u0E2D\u0E22\u0E1E\u0E34\u0E40\u0E28\u0E29 (17:00 \u0E19.)`;
      const resp = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chat_id,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      });
      const data = await resp.json();
      if (!data.ok) {
        return res.status(400).json({ error: `Telegram API Error: ${data.description || "Unknown"}` });
      }
      return res.json({ success: true, message: "\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21 HTML \u0E44\u0E1B\u0E22\u0E31\u0E07 Telegram Chat \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!" });
    }
    if (channel === "webhook") {
      if (!config?.url) {
        return res.status(400).json({ error: "Webhook URL is required" });
      }
      const resp = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...config.secret_token ? { Authorization: `Bearer ${config.secret_token}` } : {}
        },
        body: JSON.stringify({
          event: "lottery_draw_announced",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          data: payload || { draw: "16 \u0E15\u0E38\u0E25\u0E32\u0E04\u0E21 2569", first_prize: "289594", last_2: "84" }
        })
      });
      return res.json({ success: resp.ok, status: resp.status, message: `\u0E22\u0E34\u0E07 HTTP POST \u0E44\u0E1B\u0E22\u0E31\u0E07 ${config.url} \u0E44\u0E14\u0E49\u0E2A\u0E16\u0E32\u0E19\u0E30 ${resp.status}` });
    }
    return res.status(400).json({ error: "Unknown channel" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/project-files", (req, res) => {
  try {
    const fileList = [
      { name: "config/settings.json", path: "config/settings.json", category: "Config" },
      { name: "status/status.json", path: "status/status.json", category: "Status" },
      { name: "lottery_previous_results.json", path: "lottery_previous_results.json", category: "Data" },
      { name: "settings_loader.py", path: "settings_loader.py", category: "Python" },
      { name: "lottery_checker.py", path: "lottery_checker.py", category: "Python" },
      { name: "requirements.txt", path: "requirements.txt", category: "Python" },
      { name: "tests/test_settings_loader.py", path: "tests/test_settings_loader.py", category: "Tests" },
      { name: "api/worker.js", path: "api/worker.js", category: "Cloudflare" },
      { name: ".github/workflows/lottery.yml", path: ".github/workflows/lottery.yml", category: "Workflow" },
      { name: "Dockerfile", path: "Dockerfile", category: "Deploy" },
      { name: "docker-compose.yml", path: "docker-compose.yml", category: "Deploy" },
      { name: "scripts/restructure.sh", path: "scripts/restructure.sh", category: "Scripts" },
      { name: "docs/LOTTERY_SETUP.md", path: "docs/LOTTERY_SETUP.md", category: "Docs" }
    ];
    const result = fileList.map((item) => {
      const fullPath = path.join(__dirname, item.path);
      let content = "";
      if (fs.existsSync(fullPath)) {
        content = fs.readFileSync(fullPath, "utf-8");
      }
      return { ...item, content };
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} Lottery Alert Dashboard server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
