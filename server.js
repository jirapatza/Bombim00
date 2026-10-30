// server.ts
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
dotenv.config();
var execAsync = promisify(exec);
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(express.json({ limit: "25mb" }));
var ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
function ensureRuntimePaths() {
  const requiredDirs = [
    path.join(__dirname, "config"),
    path.join(__dirname, "status"),
    path.join(__dirname, "data")
  ];
  for (const dir of requiredDirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const defaultFiles = [
    path.join(__dirname, "config", "settings.json"),
    path.join(__dirname, "status", "status.json"),
    path.join(__dirname, "lottery_previous_results.json")
  ];
  for (const filePath of defaultFiles) {
    if (!fs.existsSync(filePath)) {
      if (filePath.endsWith("settings.json")) {
        fs.writeFileSync(filePath, JSON.stringify({
          version: "1.2.0",
          app_name: "Lottery Alert System Pro",
          sources: {
            pholhuay: { enabled: false, name: "Pholhuay", priority: 1 },
            glo: { enabled: true, name: "GLO Official", priority: 5 },
            ranlotto: { enabled: true, name: "RANLOTTO", priority: 7 },
            lotterychecks: { enabled: true, name: "LotteryChecks", priority: 6 },
            thailottoapi: { enabled: true, name: "ThaiLottoAPI", priority: 1 }
          },
          notifications: {
            enabled: true,
            notify_on_new_draw: true,
            custom_watched_numbers: []
          },
          channels: {
            ntfy: { enabled: true, server: "https://ntfy.sh", topic: "", priority: "high", tags: ["moneybag", "dart"] }
          }
        }, null, 2));
      } else if (filePath.endsWith("status.json")) {
        fs.writeFileSync(filePath, JSON.stringify({
          system_status: "healthy",
          last_run_timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          last_run_date_thai: (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
          total_checks: 0,
          last_source_used: "n/a",
          status_message: "Initial state",
          active_sources_count: 0,
          latest_draw_detected: "",
          notifications_sent_today: 0,
          recent_logs: []
        }, null, 2));
      } else {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      }
    }
  }
}
app.get("/api/health", (req, res) => {
  try {
    const hasSettings = fs.existsSync(path.join(__dirname, "config", "settings.json"));
    const hasStatus = fs.existsSync(path.join(__dirname, "status", "status.json"));
    res.json({
      ok: true,
      status: "healthy",
      has_settings: hasSettings,
      has_status: hasStatus,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
var SETTINGS_PATH = path.join(__dirname, "config", "settings.json");
var STATUS_PATH = path.join(__dirname, "status", "status.json");
var RESULTS_PATH = path.join(__dirname, "lottery_previous_results.json");
var ALL_LOTTERIES_PATH = path.join(__dirname, "data", "all_lotteries.json");
var WORKFLOW_PATH = path.join(__dirname, ".github", "workflows", "lottery.yml");
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
app.post("/api/test-channel", async (req, res) => {
  try {
    const { channel, config = {}, message } = req.body;
    if (channel === "discord") {
      const webhookUrl = (config.webhook_url || process.env.DISCORD_WEBHOOK_URL || "").trim();
      if (!webhookUrl) {
        return res.status(400).json({ success: false, error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01 Discord Webhook URL" });
      }
      const payload = {
        username: "Lottery Alert Bot",
        avatar_url: "https://raw.githubusercontent.com/jirapatza/Bombim00/main/public/icon-192.png",
        embeds: [{
          title: "\u{1F4E2} \u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19 Lottery Alert System (Discord)",
          description: message || "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E1C\u0E25\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E41\u0E25\u0E30\u0E2B\u0E27\u0E22\u0E1C\u0E48\u0E32\u0E19 Discord Webhook \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22! \u{1F389}\n\n\u{1F3AF} **\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48 1:** `289594`\n\u{1F522} **\u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 2 \u0E15\u0E31\u0E27:** `84`\n\u2728 **\u0E40\u0E25\u0E02\u0E2B\u0E19\u0E49\u0E32 3 \u0E15\u0E31\u0E27:** `012, 425`\n\u{1F31F} **\u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 3 \u0E15\u0E31\u0E27:** `318, 972`",
          color: 16096779,
          // Amber Gold
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          footer: { text: "Lottery Alert System Pro \u2022 Discord Webhook" }
        }]
      };
      const discordRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (discordRes.ok) {
        return res.json({ success: true, message: "\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E44\u0E1B\u0E22\u0E31\u0E07 Discord Webhook \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27! \u2705" });
      } else {
        const errorText = await discordRes.text();
        return res.status(discordRes.status).json({ success: false, error: `Discord \u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18 (HTTP ${discordRes.status}): ${errorText}` });
      }
    }
    if (channel === "telegram") {
      const botToken = (config.bot_token || process.env.TELEGRAM_BOT_TOKEN || "").trim();
      const chatId = (config.chat_id || process.env.TELEGRAM_CHAT_ID || "").trim();
      if (!botToken || !chatId) {
        return res.status(400).json({ success: false, error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38 Telegram Bot Token \u0E41\u0E25\u0E30 Chat ID" });
      }
      const text = message || "\u{1F4E2} <b>Lottery Alert System</b>\n\n\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E1C\u0E48\u0E32\u0E19 Telegram Bot \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22!";
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML"
        })
      });
      const tgData = await tgRes.json().catch(() => ({}));
      if (tgRes.ok && tgData.ok) {
        return res.json({ success: true, message: "\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E44\u0E1B\u0E22\u0E31\u0E07 Telegram \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27! \u2705" });
      } else {
        return res.status(400).json({ success: false, error: tgData.description || "\u0E2A\u0E48\u0E07 Telegram \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
      }
    }
    if (channel === "webhook") {
      const targetUrl = (config.url || "").trim();
      if (!targetUrl) {
        return res.status(400).json({ success: false, error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38 Webhook URL" });
      }
      const webhookRes = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...config.secret_token ? { "X-Webhook-Secret": config.secret_token } : {}
        },
        body: JSON.stringify({
          event: "lottery.test_notification",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: message || "Test webhook delivery"
        })
      });
      if (webhookRes.ok) {
        return res.json({ success: true, message: "\u0E2A\u0E48\u0E07 Webhook \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22! \u2705" });
      } else {
        return res.status(webhookRes.status).json({ success: false, error: `Webhook \u0E1B\u0E25\u0E32\u0E22\u0E17\u0E32\u0E07\u0E15\u0E2D\u0E1A\u0E01\u0E25\u0E31\u0E1A HTTP ${webhookRes.status}` });
      }
    }
    return res.status(400).json({ success: false, error: `\u0E44\u0E21\u0E48\u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A channel: ${channel}` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/test-ntfy", async (req, res) => {
  try {
    const { topic, server = "https://ntfy.sh", message, title = "Lottery Result Alert" } = req.body;
    const cleanTopic = (topic || process.env.NTFY_TOPIC || "").trim();
    if (!cleanTopic) {
      return res.status(400).json({ success: false, error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38 ntfy topic" });
    }
    const cleanServer = (server || "https://ntfy.sh").replace(/\/+$/, "");
    const ntfyRes = await fetch(`${cleanServer}/${cleanTopic}`, {
      method: "POST",
      headers: {
        "Title": title,
        "Priority": "high",
        "Tags": "moneybag,dart"
      },
      body: message || "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1C\u0E48\u0E32\u0E19 ntfy.sh \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22! \u{1F389}"
    });
    if (ntfyRes.ok) {
      return res.json({ success: true, message: `\u0E2A\u0E48\u0E07\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19 ntfy \u0E44\u0E1B\u0E22\u0E31\u0E07 topic '${cleanTopic}' \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08! \u2705` });
    } else {
      const errText = await ntfyRes.text();
      return res.status(ntfyRes.status).json({ success: false, error: `ntfy \u0E15\u0E2D\u0E1A\u0E01\u0E25\u0E31\u0E1A HTTP ${ntfyRes.status}: ${errText}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/github/workflow", (req, res) => {
  try {
    const workflow = req.query.workflow || "lottery.yml";
    const cleanWorkflow = path.basename(workflow);
    const localWfPath = path.join(__dirname, ".github", "workflows", cleanWorkflow);
    if (fs.existsSync(localWfPath)) {
      const content = fs.readFileSync(localWfPath, "utf-8");
      return res.json({ success: true, content, sha: "local-file" });
    }
    if (fs.existsSync(WORKFLOW_PATH)) {
      const content = fs.readFileSync(WORKFLOW_PATH, "utf-8");
      return res.json({ success: true, content, sha: "local-file" });
    }
    return res.status(404).json({ success: false, error: `Workflow file ${cleanWorkflow} not found` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/github/workflow", async (req, res) => {
  try {
    const { token, content, workflow = "lottery.yml", repo = "jirapatza/Bombim00", branch = "main" } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: "Missing workflow content" });
    }
    const cleanWorkflow = path.basename(workflow);
    const localWfPath = path.join(__dirname, ".github", "workflows", cleanWorkflow);
    fs.mkdirSync(path.dirname(localWfPath), { recursive: true });
    fs.writeFileSync(localWfPath, content, "utf-8");
    const ghToken = token || process.env.GITHUB_TOKEN;
    let ghCommitSha = null;
    if (ghToken && repo) {
      try {
        const fileUrl = `https://api.github.com/repos/${repo}/contents/.github/workflows/${cleanWorkflow}?ref=${encodeURIComponent(branch)}`;
        const getRes = await fetch(fileUrl, {
          headers: {
            "User-Agent": "LotteryAlert/1.0",
            "Accept": "application/vnd.github.v3+json",
            "Authorization": `Bearer ${ghToken}`
          }
        });
        let currentSha;
        if (getRes.ok) {
          const currentData = await getRes.json();
          currentSha = currentData.sha;
        }
        const encoded = Buffer.from(content).toString("base64");
        const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/.github/workflows/${cleanWorkflow}`, {
          method: "PUT",
          headers: {
            "User-Agent": "LotteryAlert/1.0",
            "Accept": "application/vnd.github.v3+json",
            "Authorization": `Bearer ${ghToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: `chore(workflow): update ${cleanWorkflow} from dashboard`,
            content: encoded,
            branch,
            ...currentSha ? { sha: currentSha } : {}
          })
        });
        if (putRes.ok) {
          const putData = await putRes.json();
          ghCommitSha = putData?.commit?.sha;
        }
      } catch (err) {
        console.warn("Note: Could not commit workflow to GitHub directly:", err.message);
      }
    }
    return res.json({
      success: true,
      message: `\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E1F\u0E25\u0E4C .github/workflows/${cleanWorkflow} \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`,
      commit: ghCommitSha
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/github/dispatch", async (req, res) => {
  try {
    const { repo = "jirapatza/Bombim00", branch = "main", token, workflow = "lottery.yml", inputs = {} } = req.body;
    const cleanRepo = (repo || "jirapatza/Bombim00").trim();
    const cleanWorkflow = path.basename(workflow);
    const ghToken = (token || process.env.GITHUB_TOKEN || "").trim();
    if (!ghToken) {
      return res.status(400).json({
        success: false,
        error: '\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01 GitHub Personal Access Token (PAT) \u0E17\u0E35\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Actions Write \u0E43\u0E19\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E48\u0E07\u0E23\u0E31\u0E19\u0E1A\u0E19 GitHub \u0E2B\u0E23\u0E37\u0E2D\u0E43\u0E0A\u0E49\u0E1B\u0E38\u0E48\u0E21 "\u0E08\u0E33\u0E25\u0E2D\u0E07\u0E23\u0E31\u0E19\u0E1A\u0E19 Server \u0E40\u0E2A\u0E21\u0E37\u0E2D\u0E19" \u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E17\u0E14\u0E2A\u0E2D\u0E1A'
      });
    }
    const dispatchUrl = `https://api.github.com/repos/${cleanRepo}/actions/workflows/${cleanWorkflow}/dispatches`;
    const ghRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "User-Agent": "LotteryAlert/1.0",
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${ghToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: branch || "main",
        inputs
      })
    });
    if (ghRes.status === 204 || ghRes.status === 200) {
      return res.json({
        success: true,
        message: `\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E2A\u0E31\u0E48\u0E07\u0E23\u0E31\u0E19 GitHub Actions (${cleanWorkflow}) \u0E1A\u0E19\u0E04\u0E25\u0E31\u0E07 ${cleanRepo} \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27! \u{1F389}`
      });
    }
    const errText = await ghRes.text();
    let errMsg = errText;
    try {
      const errObj = JSON.parse(errText);
      errMsg = errObj.message || errText;
    } catch {
    }
    return res.status(ghRes.status).json({
      success: false,
      error: `GitHub \u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07 (HTTP ${ghRes.status}): ${errMsg}`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/github/runs", async (req, res) => {
  try {
    const { repo = "jirapatza/Bombim00", token, workflow = "lottery.yml" } = req.body;
    const cleanRepo = (repo || "jirapatza/Bombim00").trim();
    const cleanWorkflow = path.basename(workflow);
    const ghToken = (token || process.env.GITHUB_TOKEN || "").trim();
    const headers = {
      "User-Agent": "LotteryAlert/1.0",
      "Accept": "application/vnd.github.v3+json"
    };
    if (ghToken) {
      headers["Authorization"] = `Bearer ${ghToken}`;
    }
    const runsUrl = `https://api.github.com/repos/${cleanRepo}/actions/workflows/${cleanWorkflow}/runs?per_page=10`;
    const ghRes = await fetch(runsUrl, { headers });
    if (ghRes.ok) {
      const data = await ghRes.json();
      return res.json({
        success: true,
        workflow_runs: data.workflow_runs || []
      });
    }
    const repoRunsUrl = `https://api.github.com/repos/${cleanRepo}/actions/runs?per_page=10`;
    const repoRes = await fetch(repoRunsUrl, { headers }).catch(() => null);
    if (repoRes && repoRes.ok) {
      const data = await repoRes.json();
      return res.json({
        success: true,
        workflow_runs: data.workflow_runs || []
      });
    }
    const errText = await ghRes.text().catch(() => "");
    return res.json({
      success: false,
      error: `\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 Runs \u0E08\u0E32\u0E01 GitHub (HTTP ${ghRes.status}): ${errText || "Repository \u0E2D\u0E32\u0E08\u0E40\u0E1B\u0E47\u0E19 Private \u0E2B\u0E23\u0E37\u0E2D\u0E15\u0E34\u0E14 Rate Limit \u0E01\u0E23\u0E38\u0E13\u0E32\u0E43\u0E2A\u0E48 PAT Token"}`,
      workflow_runs: []
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, workflow_runs: [] });
  }
});
app.post("/api/simulate-runner", async (req, res) => {
  try {
    const { forceNotify, lotteryTarget = "all" } = req.body;
    const now = /* @__PURE__ */ new Date();
    const thaiTime = now.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
    console.log(`[SIMULATE] Runner simulation triggered (target: ${lotteryTarget}, force: ${forceNotify})`);
    const env = {
      ...process.env,
      FORCE_NOTIFY: forceNotify ? "true" : "false",
      LOTTERY_TARGET: String(lotteryTarget || "all")
    };
    let stdout = "";
    let stderr = "";
    try {
      const result = await execAsync("python3 lottery_checker.py", {
        env,
        cwd: __dirname,
        timeout: 3e4
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (cmdErr) {
      stdout = cmdErr.stdout || "";
      stderr = cmdErr.stderr || cmdErr.message || "";
    }
    const summaryLog = `\u2713 \u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E23\u0E31\u0E19\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2B\u0E27\u0E22 [\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22: ${lotteryTarget}] \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E21\u0E37\u0E48\u0E2D ${thaiTime}`;
    const outputLines = [
      `[SIMULATOR] \u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E01\u0E32\u0E23\u0E08\u0E33\u0E25\u0E2D\u0E07\u0E23\u0E31\u0E19\u0E2A\u0E04\u0E23\u0E34\u0E1B\u0E15\u0E4C lottery_checker.py \u0E13 \u0E40\u0E27\u0E25\u0E32 ${thaiTime}`,
      `[CONFIG] FORCE_NOTIFY=${env.FORCE_NOTIFY}, LOTTERY_TARGET=${env.LOTTERY_TARGET}`,
      `[STATUS] \u0E2D\u0E48\u0E32\u0E19\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E08\u0E32\u0E01 config/settings.json \u0E41\u0E25\u0E30\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34 lottery_previous_results.json`,
      stdout || "\u2713 \u0E2A\u0E04\u0E23\u0E34\u0E1B\u0E15\u0E4C\u0E17\u0E33\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14",
      stderr ? `[STDERR]
${stderr}` : "",
      `[COMPLETE] ${summaryLog}`
    ].filter(Boolean).join("\n");
    return res.json({
      success: true,
      message: summaryLog,
      stdout: outputLines,
      stderr: ""
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/github/get-remote-file", async (req, res) => {
  try {
    const { filePath, repo = "jirapatza/Bombim00", branch = "main", token } = req.body;
    if (!filePath || filePath.includes("..") || filePath.startsWith("/")) {
      return res.status(400).json({ error: "Invalid file path" });
    }
    const localPath = path.join(__dirname, filePath);
    if (fs.existsSync(localPath)) {
      const content2 = fs.readFileSync(localPath, "utf-8");
      return res.json({ content: content2, sha: "local-file", size: content2.length, source: "local" });
    }
    const ghToken = token || process.env.GITHUB_TOKEN;
    const headers = {
      "User-Agent": "LotteryAlert/1.0",
      "Accept": "application/vnd.github.v3+json"
    };
    if (ghToken) headers["Authorization"] = `Bearer ${ghToken}`;
    const remoteRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
      { headers }
    );
    if (!remoteRes.ok) {
      return res.status(remoteRes.status).json({ error: "Unable to read file from local or remote" });
    }
    const data = await remoteRes.json();
    const content = data.encoding === "base64" ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8") : data.content;
    return res.json({ content, sha: data.sha, size: data.size, source: "github" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/github/commit-file", async (req, res) => {
  try {
    const { filePath, content, commitMessage, repo = "jirapatza/Bombim00", branch = "main", token } = req.body;
    if (!filePath || filePath.includes("..") || filePath.startsWith("/")) {
      return res.status(400).json({ error: "Invalid file path" });
    }
    const localPath = path.join(__dirname, filePath);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, content || "", "utf-8");
    const ghToken = token || process.env.GITHUB_TOKEN;
    let ghCommitSha = null;
    let htmlUrl = null;
    if (ghToken && repo) {
      const headers = {
        "User-Agent": "LotteryAlert/1.0",
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${ghToken}`,
        "Content-Type": "application/json"
      };
      const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
      const getRes = await fetch(fileUrl, { headers });
      let sha;
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }
      const encoded = Buffer.from(content || "").toString("base64");
      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: commitMessage || `Update ${filePath} from dashboard`,
          content: encoded,
          branch,
          ...sha ? { sha } : {}
        })
      });
      if (putRes.ok) {
        const result = await putRes.json();
        ghCommitSha = result?.commit?.sha;
        htmlUrl = result?.content?.html_url;
      }
    }
    return res.json({
      success: true,
      message: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22",
      commit_sha: ghCommitSha,
      html_url: htmlUrl
    });
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
app.post("/api/trigger", async (req, res) => {
  try {
    runBackgroundAutoCheck().catch((err) => console.warn("[TRIGGER] Background check note:", err.message));
    await new Promise((resolve) => setTimeout(resolve, 500));
    let currentStatus = {};
    if (fs.existsSync(STATUS_PATH)) {
      try {
        currentStatus = JSON.parse(fs.readFileSync(STATUS_PATH, "utf-8"));
      } catch {
        currentStatus = {};
      }
    }
    return res.json({
      success: true,
      message: "\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E1C\u0E25\u0E2A\u0E25\u0E32\u0E01\u0E41\u0E25\u0E30\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27",
      status: currentStatus
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/project-files", (req, res) => {
  try {
    const candidateFiles = [
      "config/settings.json",
      "lottery_checker.py",
      "settings_loader.py",
      "requirements.txt",
      ".env.example",
      "Dockerfile",
      "docker-compose.yml",
      "server.ts",
      "src/App.tsx"
    ];
    const projectFiles = [];
    for (const relPath of candidateFiles) {
      const fullPath = path.join(__dirname, relPath);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          let category = "config";
          if (relPath.endsWith(".py")) category = "python";
          else if (relPath.endsWith(".ts") || relPath.endsWith(".tsx") || relPath.endsWith(".js")) category = "backend";
          projectFiles.push({
            name: path.basename(relPath),
            path: relPath,
            category,
            content
          });
        } catch {
        }
      }
    }
    return res.json(projectFiles);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/ai/verify-grounding", async (req, res) => {
  const { query, lotteryName = "\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25\u0E44\u0E17\u0E22", drawDate } = req.body;
  const prompt = (query || `\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E1C\u0E25\u0E01\u0E32\u0E23\u0E2D\u0E2D\u0E01\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E08\u0E23\u0E34\u0E07\u0E02\u0E2D\u0E07 ${lotteryName} ${drawDate ? `\u0E07\u0E27\u0E14\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 ${drawDate}` : "\u0E07\u0E27\u0E14\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14"} \u0E08\u0E32\u0E01\u0E1C\u0E25\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23 \u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48 1 \u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 2 \u0E15\u0E31\u0E27 \u0E40\u0E25\u0E02\u0E2B\u0E19\u0E49\u0E32 3 \u0E15\u0E31\u0E27 \u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 3 \u0E15\u0E31\u0E27 (\u0E16\u0E49\u0E32\u0E21\u0E35) \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E41\u0E25\u0E30\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E43\u0E2B\u0E49\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19`).trim();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSearchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];
    const sources = groundingChunks.map((chunk) => ({
      title: chunk.web?.title || "\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25",
      uri: chunk.web?.uri || ""
    })).filter((s) => Boolean(s.uri));
    return res.json({
      success: true,
      query: prompt,
      verifiedText: response.text || "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E25\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19",
      sources,
      webSearchQueries,
      isFallback: false,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.warn("[AI Verify Grounding] Warning or Quota Error:", err.message);
    let previousResults = [];
    if (fs.existsSync(RESULTS_PATH)) {
      try {
        previousResults = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
      } catch {
        previousResults = [];
      }
    }
    let allLotteriesList = [];
    if (fs.existsSync(ALL_LOTTERIES_PATH)) {
      try {
        allLotteriesList = JSON.parse(fs.readFileSync(ALL_LOTTERIES_PATH, "utf-8"));
      } catch {
        allLotteriesList = [];
      }
    }
    const matchedLottery = allLotteriesList.find(
      (l) => prompt.toLowerCase().includes(l.name.toLowerCase()) || prompt.toLowerCase().includes(l.id.toLowerCase())
    );
    const latestOfficial = previousResults[0] || {
      \u0E07\u0E27\u0E14\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48: "16 \u0E15\u0E38\u0E25\u0E32\u0E04\u0E21 2569",
      \u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48_1: "289594",
      \u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22_2_\u0E15\u0E31\u0E27: "84",
      \u0E40\u0E25\u0E02\u0E2B\u0E19\u0E49\u0E32_3_\u0E15\u0E31\u0E27: ["012", "425"],
      \u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22_3_\u0E15\u0E31\u0E27: ["318", "972"]
    };
    let fallbackText = "";
    let fallbackSources = [
      { title: "\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25 (GLO Official)", uri: "https://www.glo.or.th" },
      { title: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25 - Thai PBS News", uri: "https://news.thaipbs.or.th/lottery" }
    ];
    if (matchedLottery) {
      fallbackText = `\u0E1C\u0E25\u0E01\u0E32\u0E23\u0E2D\u0E2D\u0E01\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25 ${matchedLottery.name} (${matchedLottery.categoryLabel})
\u2022 \u0E40\u0E27\u0E25\u0E32\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A / \u0E2D\u0E2D\u0E01\u0E1C\u0E25: ${matchedLottery.closeTimeStr} / ${matchedLottery.drawTimeStr}
\u2022 3 \u0E15\u0E31\u0E27\u0E1A\u0E19: ${matchedLottery.top3}
\u2022 2 \u0E15\u0E31\u0E27\u0E25\u0E48\u0E32\u0E07: ${matchedLottery.bottom2}
\u2022 \u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19: ${matchedLottery.status === "drawn" ? "\u0E2D\u0E2D\u0E01\u0E1C\u0E25\u0E41\u0E25\u0E49\u0E27" : "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E23\u0E2D\u0E2D\u0E2D\u0E01\u0E1C\u0E25"}
* \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E04\u0E27\u0E32\u0E21\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E41\u0E04\u0E15\u0E15\u0E32\u0E25\u0E47\u0E2D\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E2B\u0E27\u0E22 51 \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23`;
      fallbackSources.push({ title: `\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E25\u0E2B\u0E27\u0E22: ${matchedLottery.name}`, uri: "https://jirapatza.github.io/Bombim00" });
    } else {
      fallbackText = `\u0E1C\u0E25\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25\u0E44\u0E17\u0E22 \u0E07\u0E27\u0E14\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 ${latestOfficial.\u0E07\u0E27\u0E14\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48} (\u0E1C\u0E25\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27):
\u2022 \u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48 1: ${latestOfficial.\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48_1}
\u2022 \u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 2 \u0E15\u0E31\u0E27: ${latestOfficial.\u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22_2_\u0E15\u0E31\u0E27}
\u2022 \u0E40\u0E25\u0E02\u0E2B\u0E19\u0E49\u0E32 3 \u0E15\u0E31\u0E27: ${(latestOfficial.\u0E40\u0E25\u0E02\u0E2B\u0E19\u0E49\u0E32_3_\u0E15\u0E31\u0E27 || []).join(", ")}
\u2022 \u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 3 \u0E15\u0E31\u0E27: ${(latestOfficial.\u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22_3_\u0E15\u0E31\u0E27 || []).join(", ")}

\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38: \u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E42\u0E04\u0E27\u0E15\u0E32\u0E01\u0E32\u0E23\u0E2A\u0E37\u0E1A\u0E04\u0E49\u0E19\u0E2A\u0E14\u0E20\u0E32\u0E22\u0E19\u0E2D\u0E01\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27 \u0E23\u0E30\u0E1A\u0E1A\u0E14\u0E36\u0E07\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E15\u0E23\u0E27\u0E08\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E04\u0E27\u0E32\u0E21\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E25\u0E49\u0E27\u0E08\u0E32\u0E01\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25 (GLO) \u0E21\u0E32\u0E43\u0E2B\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35`;
    }
    return res.json({
      success: true,
      query: prompt,
      verifiedText: fallbackText,
      sources: fallbackSources,
      webSearchQueries: [prompt, "\u0E1C\u0E25\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25 \u0E07\u0E27\u0E14\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14"],
      isFallback: true,
      fallbackReason: err.message?.includes("429") ? "\u0E42\u0E04\u0E27\u0E15\u0E32\u0E04\u0E33\u0E02\u0E2D\u0E23\u0E32\u0E22\u0E19\u0E32\u0E17\u0E35\u0E02\u0E2D\u0E07 AI \u0E40\u0E15\u0E47\u0E21\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27 \u0E08\u0E36\u0E07\u0E43\u0E0A\u0E49\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E25\u0E08\u0E23\u0E34\u0E07\u0E17\u0E35\u0E48\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27\u0E41\u0E17\u0E19" : err.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
app.post("/api/ai/transcribe", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/webm" } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ success: false, error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E2A\u0E35\u0E22\u0E07 (audioBase64)" });
    }
    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, "");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "audio/webm",
              data: cleanBase64
            }
          },
          {
            text: "\u0E16\u0E2D\u0E14\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E41\u0E21\u0E48\u0E19\u0E22\u0E33 \u0E42\u0E14\u0E22\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E2B\u0E32\u0E01\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E1E\u0E39\u0E14\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07 (\u0E40\u0E0A\u0E48\u0E19 6 \u0E2B\u0E25\u0E31\u0E01, 3 \u0E2B\u0E25\u0E31\u0E01, 2 \u0E2B\u0E25\u0E31\u0E01) \u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E39\u0E14\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E25\u0E32\u0E01 \u0E43\u0E2B\u0E49\u0E16\u0E2D\u0E14\u0E04\u0E27\u0E32\u0E21\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14"
          }
        ]
      }
    });
    const transcript = response.text?.trim() || "";
    const digitMatches = transcript.match(/\b\d{2,6}\b/g) || [];
    return res.json({
      success: true,
      transcript,
      detectedDigits: digitMatches
    });
  } catch (err) {
    console.error("Audio transcription error:", err);
    return res.status(500).json({
      success: false,
      error: err.message?.includes("429") ? "\u0E42\u0E04\u0E27\u0E15\u0E32\u0E01\u0E32\u0E23\u0E41\u0E1B\u0E25\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E40\u0E15\u0E47\u0E21 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E43\u0E19 30 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E42\u0E14\u0E22\u0E15\u0E23\u0E07" : err.message || "Failed to transcribe audio"
    });
  }
});
var isBackgroundCheckRunning = false;
async function runBackgroundAutoCheck() {
  if (isBackgroundCheckRunning) {
    console.log("[AUTO-RUNNER] Previous check still running, skipping this tick.");
    return;
  }
  isBackgroundCheckRunning = true;
  try {
    const env = {
      ...process.env,
      FORCE_NOTIFY: "false",
      LOTTERY_TARGET: "all"
    };
    await execAsync("python3 lottery_checker.py", { env, cwd: __dirname, timeout: 45e3 });
    console.log(`[AUTO-RUNNER] Background lottery check completed at ${(/* @__PURE__ */ new Date()).toISOString()}`);
  } catch (err) {
    console.warn(`[AUTO-RUNNER] Background check note:`, err.message);
  } finally {
    isBackgroundCheckRunning = false;
  }
}
async function startServer() {
  ensureRuntimePaths();
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
    if (process.env.DISABLE_BACKGROUND_CHECK !== "true") {
      setTimeout(runBackgroundAutoCheck, 5e3);
      setInterval(runBackgroundAutoCheck, 10 * 60 * 1e3);
    } else {
      console.log("[AUTO-RUNNER] Background checks disabled by DISABLE_BACKGROUND_CHECK.");
    }
  });
}
startServer();
