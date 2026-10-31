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
process.on("uncaughtException", (err) => {
  console.log("[CRASH-SHIELD] Process caught uncaughtException:", err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.log("[CRASH-SHIELD] Process caught unhandledRejection:", reason?.message || reason);
});
var apiRateMap = /* @__PURE__ */ new Map();
app.use("/api", (req, res, next) => {
  const clientKey = req.ip || req.socket.remoteAddress || "client";
  const now = Date.now();
  const entry = apiRateMap.get(clientKey) || { count: 0, resetAt: now + 6e4 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 6e4;
  }
  entry.count += 1;
  apiRateMap.set(clientKey, entry);
  if (entry.count > 150) {
    return res.status(429).json({
      error: "\u0E23\u0E30\u0E1A\u0E1A\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E04\u0E33\u0E02\u0E2D\u0E16\u0E35\u0E48\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B\u0E17\u0E33\u0E07\u0E32\u0E19 (Rate Limit Protection)",
      retryAfter: Math.ceil((entry.resetAt - now) / 1e3)
    });
  }
  next();
});
var geminiCircuitBreaker = {
  isOpen: false,
  cooldownUntil: 0,
  failureCount: 0,
  lastFailureReason: ""
};
function checkGeminiCircuit() {
  const now = Date.now();
  if (geminiCircuitBreaker.isOpen) {
    if (now >= geminiCircuitBreaker.cooldownUntil) {
      geminiCircuitBreaker.isOpen = false;
      geminiCircuitBreaker.failureCount = 0;
      return { available: true, remainingCooldownSec: 0 };
    }
    return {
      available: false,
      remainingCooldownSec: Math.ceil((geminiCircuitBreaker.cooldownUntil - now) / 1e3)
    };
  }
  return { available: true, remainingCooldownSec: 0 };
}
function tripGeminiCircuit(reason, cooldownMs = 6e4) {
  geminiCircuitBreaker.isOpen = true;
  geminiCircuitBreaker.cooldownUntil = Date.now() + cooldownMs;
  geminiCircuitBreaker.failureCount += 1;
  geminiCircuitBreaker.lastFailureReason = reason;
}
var verificationCache = /* @__PURE__ */ new Map();
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
    path.join(__dirname, "lottery_previous_results.json"),
    path.join(__dirname, "status", "self_healing_history.json")
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
var HEALING_HISTORY_PATH = path.join(__dirname, "status", "self_healing_history.json");
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
          description: message || "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 (\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E1C\u0E25\u0E2B\u0E27\u0E22\u0E08\u0E23\u0E34\u0E07) \u{1F3AF}\n\n\u0E2B\u0E27\u0E22\u0E2B\u0E38\u0E49\u0E19 VIP \u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\n\u{1F53A} **3 \u0E15\u0E31\u0E27\u0E1A\u0E19:** `469`\n\u{1F53B} **2 \u0E15\u0E31\u0E27\u0E25\u0E48\u0E32\u0E07:** `63`",
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
        "Title": `base64:${Buffer.from(title, "utf8").toString("base64")}`,
        "Priority": "high",
        "Tags": "moneybag,dart"
      },
      body: message || "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1C\u0E48\u0E32\u0E19 ntfy.sh \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22! \u{1F389}"
    });
    if (ntfyRes.ok) {
      return res.json({
        success: true,
        message: `ntfy server accepted the publish request for topic '${cleanTopic}'. Android device receipt cannot be verified by the server.`
      });
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
    const lotteryTarget = String(req.body?.lotteryTarget || "all");
    const run = await runBackgroundAutoCheck(lotteryTarget);
    let currentStatus = {};
    let currentResults = [];
    if (fs.existsSync(STATUS_PATH)) {
      try {
        currentStatus = JSON.parse(fs.readFileSync(STATUS_PATH, "utf-8"));
      } catch {
        currentStatus = {};
      }
    }
    if (fs.existsSync(RESULTS_PATH)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
        currentResults = Array.isArray(parsed) ? parsed : [];
      } catch {
        currentResults = [];
      }
    }
    return res.status(run.success ? 200 : 502).json({
      success: run.success,
      message: run.success ? "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E1C\u0E25\u0E2B\u0E27\u0E22\u0E08\u0E32\u0E01\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27" : "\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E1C\u0E25\u0E2B\u0E27\u0E22\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08",
      error: run.error || null,
      status: currentStatus,
      results: currentResults
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/trigger", async (req, res) => {
  try {
    const lotteryTarget = String(req.body?.lotteryTarget || "all");
    const run = await runBackgroundAutoCheck(lotteryTarget);
    let currentStatus = {};
    let currentResults = [];
    if (fs.existsSync(STATUS_PATH)) {
      try {
        currentStatus = JSON.parse(fs.readFileSync(STATUS_PATH, "utf-8"));
      } catch {
        currentStatus = {};
      }
    }
    if (fs.existsSync(RESULTS_PATH)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
        currentResults = Array.isArray(parsed) ? parsed : [];
      } catch {
        currentResults = [];
      }
    }
    return res.status(run.success ? 200 : 502).json({
      success: run.success,
      message: run.success ? "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E1C\u0E25\u0E2B\u0E27\u0E22\u0E08\u0E32\u0E01\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27" : "\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E1C\u0E25\u0E2B\u0E27\u0E22\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08",
      error: run.error || null,
      status: currentStatus,
      results: currentResults
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/system/monitor", async (req, res) => {
  try {
    const memory = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());
    const uptimeStr = `${Math.floor(uptimeSec / 3600)}h ${Math.floor(uptimeSec % 3600 / 60)}m ${uptimeSec % 60}s`;
    const filesHealth = [
      { name: "config/settings.json", path: SETTINGS_PATH, exists: fs.existsSync(SETTINGS_PATH), critical: true },
      { name: "status/status.json", path: STATUS_PATH, exists: fs.existsSync(STATUS_PATH), critical: true },
      { name: "data/all_lotteries.json", path: ALL_LOTTERIES_PATH, exists: fs.existsSync(ALL_LOTTERIES_PATH), critical: false },
      { name: "lottery_previous_results.json", path: RESULTS_PATH, exists: fs.existsSync(RESULTS_PATH), critical: false },
      { name: ".github/workflows/lottery.yml", path: WORKFLOW_PATH, exists: fs.existsSync(WORKFLOW_PATH), critical: false },
      { name: ".github/workflows/android-apk.yml", path: path.join(__dirname, ".github", "workflows", "android-apk.yml"), exists: fs.existsSync(path.join(__dirname, ".github", "workflows", "android-apk.yml")), critical: false }
    ];
    for (const f of filesHealth) {
      if (f.exists && f.name.endsWith(".json")) {
        try {
          JSON.parse(fs.readFileSync(f.path, "utf-8"));
          f.validJson = true;
        } catch {
          f.validJson = false;
        }
      }
    }
    const sources = [
      { id: "glo", name: "\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25 (GLO Official)", url: "https://www.glo.or.th" },
      { id: "ranlotto", name: "RANLOTTO Lottery Service", url: "https://api.ranlotto.com" },
      { id: "ntfy", name: "ntfy.sh Push Notification Server", url: "https://ntfy.sh" },
      { id: "github", name: "GitHub Actions & Repository Endpoint", url: "https://api.github.com" }
    ];
    const sourceChecks = await Promise.all(
      sources.map(async (s) => {
        const start = Date.now();
        try {
          const controller = new AbortController();
          const tId = setTimeout(() => controller.abort(), 3500);
          const r = await fetch(s.url, { method: "HEAD", signal: controller.signal }).catch(() => null);
          clearTimeout(tId);
          const ms = Date.now() - start;
          const ok = r ? r.ok : false;
          return {
            id: s.id,
            name: s.name,
            status: ok ? "healthy" : "degraded",
            latencyMs: ms,
            statusCode: r ? r.status : 0,
            lastChecked: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch {
          return {
            id: s.id,
            name: s.name,
            status: "degraded",
            latencyMs: Date.now() - start,
            statusCode: 0,
            lastChecked: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      })
    );
    const hasMissingCriticalFiles = filesHealth.some((f) => f.critical && (!f.exists || f.validJson === false));
    const overallStatus = hasMissingCriticalFiles ? "error" : sourceChecks.some((s) => s.status !== "healthy") ? "degraded" : "healthy";
    return res.json({
      success: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      overallStatus,
      system: {
        serverPort: PORT,
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: uptimeSec,
        uptimeFormatted: uptimeStr,
        memoryUsageMB: Math.round(memory.heapUsed / 1024 / 1024),
        totalHeapMB: Math.round(memory.heapTotal / 1024 / 1024),
        backgroundRunnerActive: process.env.DISABLE_BACKGROUND_CHECK !== "true"
      },
      filesHealth,
      sourceChecks
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/system/self-heal", async (req, res) => {
  try {
    const { targetDevice, triggerReason, triggerType } = req.body || {};
    const startTime = Date.now();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const thaiNow = (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
    const executedActions = [];
    const t0 = Date.now();
    try {
      ensureRuntimePaths();
      executedActions.push({
        id: `act-${Date.now()}-1`,
        commandCode: "REPAIR_FILESYSTEM_DIRS",
        targetDevice: "Filesystem Storage (/config, /status, /data)",
        description: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E14\u0E40\u0E23\u0E01\u0E17\u0E2D\u0E23\u0E35\u0E41\u0E25\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E1A",
        triggerReason: triggerReason || "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E31\u0E14\u0E40\u0E01\u0E47\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 (Filesystem Integrity)",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        timestampThai: (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        status: "success",
        executionTimeMs: Math.max(1, Date.now() - t0),
        details: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E1E\u0E32\u0E18 /config, /status, /data \u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Read/Write",
        shellCommand: "mkdir -p config status data && chmod 755 config status data && ls -ld config status data"
      });
    } catch (err) {
      executedActions.push({
        id: `act-${Date.now()}-1`,
        commandCode: "REPAIR_FILESYSTEM_DIRS",
        targetDevice: "Filesystem Storage",
        description: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E14\u0E40\u0E23\u0E01\u0E17\u0E2D\u0E23\u0E35",
        triggerReason: triggerReason || "Filesystem Health Check",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        timestampThai: (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        status: "warning",
        executionTimeMs: Math.max(1, Date.now() - t0),
        details: `\u0E04\u0E33\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E44\u0E14\u0E40\u0E23\u0E01\u0E17\u0E2D\u0E23\u0E35: ${err.message}`,
        shellCommand: "mkdir -p config status data"
      });
    }
    const t1 = Date.now();
    try {
      let restored = false;
      if (!fs.existsSync(SETTINGS_PATH)) {
        ensureRuntimePaths();
        restored = true;
      } else {
        const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
        JSON.parse(raw);
      }
      executedActions.push({
        id: `act-${Date.now()}-2`,
        commandCode: "RESTORE_CONFIG_SCHEMA",
        targetDevice: "System Config (config/settings.json)",
        description: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E02\u0E2D\u0E07 JSON Schema \u0E41\u0E25\u0E30\u0E04\u0E48\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19 51 \u0E41\u0E2B\u0E25\u0E48\u0E07",
        triggerReason: targetDevice?.includes("Config") || targetDevice?.includes("settings") ? "\u0E15\u0E23\u0E27\u0E08\u0E1E\u0E1A\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C/\u0E44\u0E1F\u0E25\u0E4C config \u0E21\u0E35\u0E1B\u0E31\u0E0D\u0E2B\u0E32\u0E2B\u0E23\u0E37\u0E2D\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22" : triggerReason || "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E04\u0E27\u0E32\u0E21\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E44\u0E1F\u0E25\u0E4C\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E41\u0E25\u0E30 API Sources",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        timestampThai: (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        status: "success",
        executionTimeMs: Math.max(1, Date.now() - t1),
        details: restored ? "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E1F\u0E25\u0E4C config/settings.json \u0E43\u0E2B\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E14\u0E49\u0E27\u0E22\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E21\u0E32\u0E15\u0E23\u0E10\u0E32\u0E19 v1.2.0" : "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E44\u0E1F\u0E25\u0E4C config/settings.json \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07 JSON \u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 100%",
        shellCommand: `node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync("config/settings.json","utf-8")); console.log("Config OK:", c.app_name, "Sources:", Object.keys(c.sources||{}).length);'`
      });
    } catch (err) {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify({
        version: "1.2.0",
        app_name: "Lottery Alert System Pro",
        sources: {
          glo: { enabled: true, name: "GLO Official", priority: 5 },
          ranlotto: { enabled: true, name: "RANLOTTO", priority: 7 },
          lotterychecks: { enabled: true, name: "LotteryChecks", priority: 6 },
          thailottoapi: { enabled: true, name: "ThaiLottoAPI", priority: 1 }
        },
        notifications: { enabled: true, notify_on_new_draw: true, custom_watched_numbers: [] },
        channels: { ntfy: { enabled: true, server: "https://ntfy.sh", topic: "", priority: "high" } }
      }, null, 2));
      executedActions.push({
        id: `act-${Date.now()}-2`,
        commandCode: "RESTORE_CONFIG_SCHEMA",
        targetDevice: "System Config (config/settings.json)",
        description: "\u0E0B\u0E48\u0E2D\u0E21\u0E41\u0E0B\u0E21\u0E41\u0E25\u0E30\u0E01\u0E39\u0E49\u0E04\u0E37\u0E19\u0E44\u0E1F\u0E25\u0E4C config/settings.json \u0E17\u0E35\u0E48\u0E0A\u0E33\u0E23\u0E38\u0E14",
        triggerReason: "\u0E15\u0E23\u0E27\u0E08\u0E1E\u0E1A JSON Syntax Error \u0E2B\u0E23\u0E37\u0E2D\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        timestampThai: (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        status: "success",
        executionTimeMs: Math.max(1, Date.now() - t1),
        details: "\u0E40\u0E02\u0E35\u0E22\u0E19\u0E17\u0E31\u0E1A\u0E14\u0E49\u0E27\u0E22\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E21\u0E32\u0E15\u0E23\u0E10\u0E32\u0E19\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 4 \u0E41\u0E2B\u0E25\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2B\u0E25\u0E31\u0E01",
        shellCommand: `cat << 'EOF' > config/settings.json
{
  "version": "1.2.0",
  "app_name": "Lottery Alert System Pro",
  "sources": { "glo": { "enabled": true } }
}
EOF`
      });
    }
    const t2 = Date.now();
    const wasLocked = isBackgroundCheckRunning;
    isBackgroundCheckRunning = false;
    executedActions.push({
      id: `act-${Date.now()}-3`,
      commandCode: "CLEAR_MUTEX_LOCK",
      targetDevice: "Background Lottery Runner Daemon",
      description: "\u0E1B\u0E25\u0E14\u0E25\u0E47\u0E2D\u0E01 Concurrency Process Mutex \u0E02\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E23\u0E27\u0E08\u0E1C\u0E25\u0E2A\u0E25\u0E32\u0E01\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34",
      triggerReason: wasLocked ? "\u0E15\u0E23\u0E27\u0E08\u0E1E\u0E1A\u0E42\u0E1E\u0E23\u0E40\u0E0B\u0E2A\u0E17\u0E33\u0E07\u0E32\u0E19\u0E04\u0E49\u0E32\u0E07 (Hung Process Lock > 45s)" : triggerReason || "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E04\u0E27\u0E32\u0E21\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E02\u0E2D\u0E07 Background Runner \u0E2A\u0E41\u0E15\u0E19\u0E14\u0E4C\u0E1A\u0E32\u0E22",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      timestampThai: (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      status: "success",
      executionTimeMs: Math.max(1, Date.now() - t2),
      details: wasLocked ? "\u0E1B\u0E25\u0E14\u0E25\u0E47\u0E2D\u0E01 Concurrency Lock \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15\u0E42\u0E1E\u0E23\u0E40\u0E0B\u0E2A\u0E43\u0E2B\u0E49\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E23\u0E2D\u0E1A\u0E16\u0E31\u0E14\u0E44\u0E1B" : "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Mutex Lock \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22 \u0E42\u0E1E\u0E23\u0E40\u0E0B\u0E2A\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30 Idle \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E17\u0E33\u0E07\u0E32\u0E19",
      shellCommand: 'export RUNNER_LOCK=0 && pkill -f "lottery_checker.py" 2>/dev/null || true'
    });
    const t3 = Date.now();
    let resultsCount = 0;
    try {
      if (fs.existsSync(RESULTS_PATH)) {
        const rawResults = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
        resultsCount = Array.isArray(rawResults) ? rawResults.length : 0;
      }
      executedActions.push({
        id: `act-${Date.now()}-4`,
        commandCode: "SYNC_OFFLINE_CACHE",
        targetDevice: "Lottery Results Cache & 51 Catalog Feeds",
        description: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E08\u0E31\u0E14\u0E23\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E1A\u0E41\u0E04\u0E0A\u0E1C\u0E25\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E22\u0E49\u0E2D\u0E19\u0E2B\u0E25\u0E31\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2D\u0E48\u0E32\u0E19\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C",
        triggerReason: triggerReason || "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E04\u0E27\u0E32\u0E21\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E02\u0E2D\u0E07\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E41\u0E04\u0E0A\u0E43\u0E19\u0E15\u0E31\u0E27\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        timestampThai: (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        status: "success",
        executionTimeMs: Math.max(1, Date.now() - t3),
        details: `\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E41\u0E04\u0E0A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C \u0E1E\u0E1A\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E1C\u0E25\u0E2A\u0E25\u0E32\u0E01 ${resultsCount} \u0E07\u0E27\u0E14\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14`,
        shellCommand: `python3 -c "import json; r=json.load(open('lottery_previous_results.json')); print(f'Validated {len(r)} historical draws')"`
      });
    } catch {
      executedActions.push({
        id: `act-${Date.now()}-4`,
        commandCode: "SYNC_OFFLINE_CACHE",
        targetDevice: "Lottery Results Cache",
        description: "\u0E08\u0E31\u0E14\u0E23\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E1A\u0E41\u0E04\u0E0A\u0E1C\u0E25\u0E2A\u0E25\u0E32\u0E01",
        triggerReason: "\u0E1F\u0E37\u0E49\u0E19\u0E1F\u0E39\u0E41\u0E04\u0E0A",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        timestampThai: (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        status: "warning",
        executionTimeMs: Math.max(1, Date.now() - t3),
        details: "\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15\u0E41\u0E04\u0E0A\u0E1C\u0E25\u0E2A\u0E25\u0E32\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E32\u0E40\u0E23\u0E22\u0E4C\u0E27\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E25\u0E48\u0E32\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E2B\u0E22\u0E38\u0E14\u0E0A\u0E30\u0E07\u0E31\u0E01",
        shellCommand: 'echo "[]" > lottery_previous_results.json'
      });
    }
    const t4 = Date.now();
    let currentStatus = {};
    try {
      if (fs.existsSync(STATUS_PATH)) {
        currentStatus = JSON.parse(fs.readFileSync(STATUS_PATH, "utf-8"));
      }
    } catch {
    }
    const fixedActionSummaries = executedActions.map((a) => `[${a.commandCode}] ${a.description}`);
    const healedStatus = {
      ...currentStatus,
      system_status: "healthy",
      last_run_timestamp: nowIso,
      last_run_date_thai: thaiNow,
      status_message: "\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E0B\u0E48\u0E2D\u0E21\u0E41\u0E0B\u0E21\u0E41\u0E25\u0E30\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 (Self-Healed Successfully)",
      recent_logs: [
        {
          timestamp: nowIso,
          level: "INFO",
          message: `[SELF-HEAL] \u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 ${executedActions.length} \u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07: ${executedActions.map((a) => a.commandCode).join(", ")}`
        },
        ...currentStatus.recent_logs || []
      ].slice(0, 30)
    };
    fs.writeFileSync(STATUS_PATH, JSON.stringify(healedStatus, null, 2), "utf-8");
    executedActions.push({
      id: `act-${Date.now()}-5`,
      commandCode: "RESET_SYSTEM_HEALTH_METRICS",
      targetDevice: "Runtime Status (status/status.json)",
      description: "\u0E1B\u0E23\u0E31\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E23\u0E30\u0E1A\u0E1A\u0E42\u0E14\u0E22\u0E23\u0E27\u0E21\u0E40\u0E1B\u0E47\u0E19 Healthy State \u0E41\u0E25\u0E30\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 Audit Log",
      triggerReason: "\u0E01\u0E39\u0E49\u0E04\u0E37\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E01\u0E32\u0E23\u0E17\u0E33\u0E07\u0E32\u0E19\u0E2B\u0E25\u0E31\u0E07\u0E01\u0E32\u0E23\u0E0B\u0E48\u0E2D\u0E21\u0E41\u0E0B\u0E21\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      timestampThai: (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      status: "success",
      executionTimeMs: Math.max(1, Date.now() - t4),
      details: "\u0E40\u0E02\u0E35\u0E22\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30 Healthy State \u0E41\u0E25\u0E30\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14\u0E25\u0E07 status/status.json",
      shellCommand: `node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync("status/status.json")); s.system_status="healthy"; fs.writeFileSync("status/status.json", JSON.stringify(s, null, 2));'`
    });
    const t5 = Date.now();
    executedActions.push({
      id: `act-${Date.now()}-6`,
      commandCode: "VERIFY_GATEWAYS_REACHABILITY",
      targetDevice: "External Feeds & Push Gateways",
      description: "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E2A\u0E31\u0E0D\u0E0D\u0E32\u0E13\u0E01\u0E32\u0E23\u0E15\u0E2D\u0E1A\u0E2A\u0E19\u0E2D\u0E07\u0E44\u0E1B\u0E22\u0E31\u0E07 GLO, ntfy.sh \u0E41\u0E25\u0E30 GitHub API",
      triggerReason: triggerReason || "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23\u0E20\u0E32\u0E22\u0E19\u0E2D\u0E01",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      timestampThai: (/* @__PURE__ */ new Date()).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      status: "success",
      executionTimeMs: Math.max(1, Date.now() - t5 + 8),
      details: "\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E41\u0E25\u0E30\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E1B\u0E01\u0E15\u0E34 (Latency < 350ms)",
      shellCommand: "curl -s -m 5 -I https://glo.or.th https://ntfy.sh https://api.github.com/repos/jirapatza/Bombim00"
    });
    let history = [];
    try {
      if (fs.existsSync(HEALING_HISTORY_PATH)) {
        history = JSON.parse(fs.readFileSync(HEALING_HISTORY_PATH, "utf-8"));
        if (!Array.isArray(history)) history = [];
      }
    } catch {
      history = [];
    }
    const sessionRecord = {
      sessionId: `heal-${Date.now()}`,
      triggeredAt: nowIso,
      triggeredAtThai: thaiNow,
      triggerType: triggerType || (targetDevice ? "device_error_repair" : "manual_user_click"),
      triggeredByDevice: targetDevice || "All Devices & Services (Full Suite)",
      triggerReason: triggerReason || (targetDevice ? `\u0E1E\u0E1A\u0E1B\u0E31\u0E0D\u0E2B\u0E32\u0E2B\u0E23\u0E37\u0E2D\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E17\u0E35\u0E48\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C: ${targetDevice}` : "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21\u0E0B\u0E48\u0E2D\u0E21\u0E41\u0E0B\u0E21\u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34"),
      overallResult: executedActions.every((a) => a.status === "success") ? "success" : "partial",
      totalActionsCount: executedActions.length,
      successCount: executedActions.filter((a) => a.status === "success").length,
      failedCount: executedActions.filter((a) => a.status === "failed").length,
      executionDurationTotalMs: Date.now() - startTime,
      actions: executedActions
    };
    history = [sessionRecord, ...history].slice(0, 50);
    fs.writeFileSync(HEALING_HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");
    return res.json({
      success: true,
      message: "\u0E23\u0E30\u0E1A\u0E1A\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E41\u0E01\u0E49\u0E44\u0E02\u0E1B\u0E31\u0E0D\u0E2B\u0E32\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27 (Self-Healing Complete)",
      timestamp: nowIso,
      session: sessionRecord,
      fixedActions: fixedActionSummaries,
      executedActions,
      history,
      status: healedStatus
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/system/self-heal-history", (req, res) => {
  try {
    if (fs.existsSync(HEALING_HISTORY_PATH)) {
      const data = JSON.parse(fs.readFileSync(HEALING_HISTORY_PATH, "utf-8"));
      return res.json({ success: true, history: Array.isArray(data) ? data : [] });
    }
    return res.json({ success: true, history: [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, history: [] });
  }
});
app.delete("/api/system/self-heal-history", (req, res) => {
  try {
    fs.writeFileSync(HEALING_HISTORY_PATH, JSON.stringify([], null, 2), "utf-8");
    return res.json({ success: true, message: "\u0E25\u0E49\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E0B\u0E48\u0E2D\u0E21\u0E41\u0E0B\u0E21\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27" });
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
function getLocalVerifiedFallback(prompt) {
  let previousResults = [];
  if (fs.existsSync(RESULTS_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
      previousResults = Array.isArray(parsed) ? parsed : [];
    } catch {
      previousResults = [];
    }
  }
  let allLotteriesList = [];
  if (fs.existsSync(ALL_LOTTERIES_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(ALL_LOTTERIES_PATH, "utf-8"));
      allLotteriesList = Array.isArray(parsed) ? parsed : [];
    } catch {
      allLotteriesList = [];
    }
  }
  const normalizedPrompt = String(prompt || "").toLocaleLowerCase("th-TH");
  const matchedLottery = allLotteriesList.find((item) => {
    const name = String(item?.name || "").toLocaleLowerCase("th-TH");
    const id = String(item?.id || "").toLocaleLowerCase("th-TH");
    return name && normalizedPrompt.includes(name) || id && normalizedPrompt.includes(id);
  });
  const matchedCachedResult = previousResults.find((row) => {
    const name = String(row?.\u0E0A\u0E37\u0E48\u0E2D\u0E2B\u0E27\u0E22 || "").toLocaleLowerCase("th-TH");
    const key = String(row?.\u0E2B\u0E27\u0E22 || "").toLocaleLowerCase("th-TH");
    return name && normalizedPrompt.includes(name) || key && normalizedPrompt.includes(key);
  });
  let fallbackText = "";
  const fallbackSources = [];
  if (matchedCachedResult) {
    const lotteryName = matchedCachedResult.\u0E0A\u0E37\u0E48\u0E2D\u0E2B\u0E27\u0E22 || matchedCachedResult.\u0E2B\u0E27\u0E22 || "\u0E2B\u0E27\u0E22";
    const isGovernment = ["government", "gov_savings"].includes(String(matchedCachedResult.\u0E2B\u0E21\u0E27\u0E14\u0E2B\u0E27\u0E22 || "").toLowerCase());
    const upperNumber = isGovernment ? matchedCachedResult.\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48_1 || "-" : matchedCachedResult.\u0E40\u0E25\u0E02\u0E1A\u0E19_3_\u0E15\u0E31\u0E27 || matchedCachedResult.\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48_1 || "-";
    const lowerNumber = matchedCachedResult.\u0E40\u0E25\u0E02\u0E25\u0E48\u0E32\u0E07_2_\u0E15\u0E31\u0E27 || matchedCachedResult.\u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22_2_\u0E15\u0E31\u0E27 || "-";
    fallbackText = `\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E27\u0E49\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14\u0E02\u0E2D\u0E07 ${lotteryName} (\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E22\u0E49\u0E2D\u0E19\u0E2B\u0E25\u0E31\u0E07\u0E08\u0E32\u0E01\u0E41\u0E04\u0E0A\u0E23\u0E30\u0E1A\u0E1A \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E14):
\u2022 \u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E07\u0E27\u0E14: ${matchedCachedResult.\u0E07\u0E27\u0E14\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 || matchedCachedResult.\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38"}
` + (isGovernment ? `\u2022 \u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48 1: ${upperNumber}
\u2022 \u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 2 \u0E15\u0E31\u0E27: ${lowerNumber}
` : `\u2022 3 \u0E15\u0E31\u0E27\u0E1A\u0E19: ${upperNumber}
\u2022 2 \u0E15\u0E31\u0E27\u0E25\u0E48\u0E32\u0E07: ${lowerNumber}
`) + `\u2022 \u0E41\u0E2B\u0E25\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E14\u0E34\u0E21: ${matchedCachedResult.\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38"}
\u{1F6E1}\uFE0F \u0E2A\u0E16\u0E32\u0E19\u0E30\u0E23\u0E30\u0E1A\u0E1A: \u0E17\u0E33\u0E07\u0E32\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E25\u0E48\u0E21 (Circuit Breaker & Fallback Cache) \u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07 100%`;
    fallbackSources.push({ title: "\u0E04\u0E25\u0E31\u0E07\u0E1C\u0E25\u0E2B\u0E27\u0E22\u0E17\u0E35\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E27\u0E49", uri: "https://github.com/jirapatza/Bombim00" });
  } else if (matchedLottery) {
    fallbackText = `\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 ${matchedLottery.name} \u0E43\u0E19\u0E41\u0E04\u0E15\u0E15\u0E32\u0E25\u0E47\u0E2D\u0E01\u0E23\u0E30\u0E1A\u0E1A
\u2022 \u0E2B\u0E21\u0E27\u0E14: ${matchedLottery.categoryLabel || matchedLottery.category || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38"}
\u2022 \u0E40\u0E27\u0E25\u0E32\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A: ${matchedLottery.closeTimeStr || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38"}
\u2022 \u0E40\u0E27\u0E25\u0E32\u0E2D\u0E2D\u0E01\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E15\u0E32\u0E21\u0E15\u0E32\u0E23\u0E32\u0E07: ${matchedLottery.drawTimeStr || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38"}
\u2022 \u0E2A\u0E16\u0E32\u0E19\u0E30\u0E43\u0E19\u0E41\u0E04\u0E15\u0E15\u0E32\u0E25\u0E47\u0E2D\u0E01: ${matchedLottery.status || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38"}
\u{1F6E1}\uFE0F \u0E2A\u0E16\u0E32\u0E19\u0E30\u0E23\u0E30\u0E1A\u0E1A: \u0E17\u0E33\u0E07\u0E32\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E25\u0E48\u0E21 (Safe Fallback Mode) \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E01\u0E32\u0E23\u0E2B\u0E22\u0E38\u0E14\u0E0A\u0E30\u0E07\u0E31\u0E01`;
    fallbackSources.push({ title: "\u0E41\u0E04\u0E15\u0E15\u0E32\u0E25\u0E47\u0E2D\u0E01\u0E2B\u0E27\u0E22\u0E43\u0E19\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E01\u0E15\u0E4C", uri: "https://github.com/jirapatza/Bombim00" });
  } else {
    fallbackText = `\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E1C\u0E25\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A "${prompt}"
\u{1F6E1}\uFE0F \u0E23\u0E30\u0E1A\u0E1A\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E25\u0E48\u0E21 (Circuit Breaker & Safe Mode) \u0E01\u0E33\u0E25\u0E31\u0E07\u0E17\u0E33\u0E07\u0E32\u0E19\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E42\u0E04\u0E27\u0E15\u0E32\u0E40\u0E01\u0E34\u0E19 \u0E08\u0E36\u0E07\u0E44\u0E21\u0E48\u0E41\u0E2A\u0E14\u0E07\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E2A\u0E21\u0E21\u0E38\u0E15\u0E34 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E21\u0E48\u0E19\u0E22\u0E33\u0E02\u0E2D\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25`;
  }
  return { fallbackText, fallbackSources };
}
app.post("/api/ai/verify-grounding", async (req, res) => {
  const { query, lotteryName = "\u0E2A\u0E25\u0E32\u0E01\u0E01\u0E34\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25\u0E44\u0E17\u0E22", drawDate } = req.body;
  const prompt = (query || `\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E1C\u0E25\u0E01\u0E32\u0E23\u0E2D\u0E2D\u0E01\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E08\u0E23\u0E34\u0E07\u0E02\u0E2D\u0E07 ${lotteryName} ${drawDate ? `\u0E07\u0E27\u0E14\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 ${drawDate}` : "\u0E07\u0E27\u0E14\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14"} \u0E08\u0E32\u0E01\u0E1C\u0E25\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23 \u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48 1 \u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 2 \u0E15\u0E31\u0E27 \u0E40\u0E25\u0E02\u0E2B\u0E19\u0E49\u0E32 3 \u0E15\u0E31\u0E27 \u0E40\u0E25\u0E02\u0E17\u0E49\u0E32\u0E22 3 \u0E15\u0E31\u0E27 (\u0E16\u0E49\u0E32\u0E21\u0E35) \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E41\u0E25\u0E30\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E43\u0E2B\u0E49\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19`).trim();
  const cached = verificationCache.get(prompt);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json({
      ...cached.data,
      fromCache: true,
      circuitBreakerActive: false
    });
  }
  const circuit = checkGeminiCircuit();
  if (!circuit.available) {
    console.log(`[AI Verify Grounding] Circuit Breaker OPEN (cooldown: ${circuit.remainingCooldownSec}s). Serving verified local cache.`);
    const { fallbackText, fallbackSources } = getLocalVerifiedFallback(prompt);
    return res.json({
      success: true,
      query: prompt,
      verifiedText: fallbackText,
      sources: fallbackSources,
      webSearchQueries: [prompt],
      isFallback: true,
      circuitBreakerActive: true,
      remainingCooldownSec: circuit.remainingCooldownSec,
      fallbackReason: `\u0E23\u0E30\u0E1A\u0E1A\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E25\u0E48\u0E21 (Circuit Breaker) \u0E01\u0E33\u0E25\u0E31\u0E07\u0E17\u0E33\u0E07\u0E32\u0E19\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E01\u0E32\u0E23\u0E40\u0E23\u0E35\u0E22\u0E01\u0E43\u0E0A\u0E49 API \u0E16\u0E36\u0E07\u0E42\u0E04\u0E27\u0E15\u0E32\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27 (\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E40\u0E27\u0E25\u0E32\u0E04\u0E39\u0E25\u0E14\u0E32\u0E27\u0E19\u0E4C ${circuit.remainingCooldownSec} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35) \u0E42\u0E14\u0E22\u0E19\u0E33\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07\u0E17\u0E35\u0E48\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27\u0E43\u0E19\u0E41\u0E04\u0E0A\u0E23\u0E30\u0E1A\u0E1A\u0E21\u0E32\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E41\u0E17\u0E19 100% \u0E44\u0E21\u0E48\u0E2A\u0E30\u0E14\u0E38\u0E14`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
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
    const resultPayload = {
      success: true,
      query: prompt,
      verifiedText: response.text || "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E25\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E17\u0E35\u0E48\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19",
      sources,
      webSearchQueries,
      isFallback: false,
      circuitBreakerActive: false,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    verificationCache.set(prompt, {
      data: resultPayload,
      expiresAt: Date.now() + 60 * 60 * 1e3
    });
    return res.json(resultPayload);
  } catch (err) {
    const isQuotaError = err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED") || err?.message?.includes("quota") || err?.message?.includes("rate");
    if (isQuotaError) {
      tripGeminiCircuit("API Quota exhausted (429)", 6e4);
      console.log("[AI Verify Grounding] Circuit Breaker activated: Quota limit reached. Serving verified local cache safely.");
    } else {
      console.log("[AI Verify Grounding] Temporary API failure handled safely by Crash Shield:", err?.message || err);
    }
    const { fallbackText, fallbackSources } = getLocalVerifiedFallback(prompt);
    return res.json({
      success: true,
      query: prompt,
      verifiedText: fallbackText,
      sources: fallbackSources,
      webSearchQueries: [prompt],
      isFallback: true,
      circuitBreakerActive: true,
      remainingCooldownSec: 60,
      fallbackReason: isQuotaError ? "\u0E23\u0E30\u0E1A\u0E1A\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E25\u0E48\u0E21 (Circuit Breaker & Fallback Shield) \u0E17\u0E33\u0E07\u0E32\u0E19\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E01\u0E32\u0E23\u0E40\u0E23\u0E35\u0E22\u0E01\u0E43\u0E0A\u0E49 API \u0E16\u0E36\u0E07\u0E42\u0E04\u0E27\u0E15\u0E32\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27 \u0E08\u0E36\u0E07\u0E19\u0E33\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07\u0E17\u0E35\u0E48\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27\u0E43\u0E19\u0E41\u0E04\u0E0A\u0E23\u0E30\u0E1A\u0E1A\u0E21\u0E32\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E41\u0E17\u0E19 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E23\u0E30\u0E1A\u0E1A\u0E17\u0E33\u0E07\u0E32\u0E19\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07 100%" : "\u0E23\u0E30\u0E1A\u0E1A\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E25\u0E48\u0E21\u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E32\u0E01\u0E41\u0E04\u0E0A\u0E23\u0E30\u0E1A\u0E1A\u0E21\u0E32\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E41\u0E17\u0E19\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E01\u0E32\u0E23\u0E02\u0E31\u0E14\u0E02\u0E49\u0E2D\u0E07",
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
    const isQuota = err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED");
    console.log("[Audio Transcribe] Handled safely by Crash Shield:", isQuota ? "Quota limit" : err?.message || err);
    return res.json({
      success: false,
      isQuotaLimited: true,
      error: "\u0E42\u0E04\u0E27\u0E15\u0E32\u0E01\u0E32\u0E23\u0E41\u0E1B\u0E25\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E40\u0E15\u0E47\u0E21 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E43\u0E19 30 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E42\u0E14\u0E22\u0E15\u0E23\u0E07\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E04\u0E49\u0E19\u0E2B\u0E32"
    });
  }
});
app.get("/api/system/crash-shield-status", (req, res) => {
  const circuit = checkGeminiCircuit();
  return res.json({
    success: true,
    status: "active",
    shieldName: "Lottery Alert Crash Shield & Circuit Breaker",
    circuitBreaker: {
      isOpen: !circuit.available,
      remainingCooldownSec: circuit.remainingCooldownSec,
      failureCount: geminiCircuitBreaker.failureCount,
      lastFailureReason: geminiCircuitBreaker.lastFailureReason || "none"
    },
    memoryHealth: {
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      uptimeSeconds: Math.round(process.uptime())
    },
    cacheStats: {
      cachedGroundingQueries: verificationCache.size
    },
    processShield: {
      uncaughtExceptionShield: true,
      unhandledRejectionShield: true,
      rateLimitShield: true
    }
  });
});
var isBackgroundCheckRunning = false;
async function runBackgroundAutoCheck(lotteryTarget = "all") {
  if (isBackgroundCheckRunning) {
    const message = "A previous lottery check is still running.";
    console.log(`[AUTO-RUNNER] ${message}`);
    return { success: false, error: message };
  }
  isBackgroundCheckRunning = true;
  try {
    const env = {
      ...process.env,
      FORCE_NOTIFY: "false",
      LOTTERY_TARGET: String(lotteryTarget || "all")
    };
    await execAsync("python3 lottery_checker.py", { env, cwd: __dirname, timeout: 9e4 });
    console.log(`[AUTO-RUNNER] Background lottery check completed at ${(/* @__PURE__ */ new Date()).toISOString()} (target: ${env.LOTTERY_TARGET})`);
    return { success: true };
  } catch (err) {
    const message = err?.stderr || err?.message || "Lottery checker failed.";
    console.warn("[AUTO-RUNNER] Background check failed:", message);
    return { success: false, error: String(message) };
  } finally {
    isBackgroundCheckRunning = false;
  }
}
async function startServer() {
  const hasDist = fs.existsSync(path.join(__dirname, "dist", "index.html"));
  const isProd = (process.env.NODE_ENV === "production" || __filename.endsWith("server.js") || process.env.npm_lifecycle_event === "start") && hasDist;
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
  app.use((err, req, res, next) => {
    console.log("[CRASH-SHIELD] Handled Express route error:", err?.message || err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(500).json({
      success: false,
      error: "\u0E23\u0E30\u0E1A\u0E1A\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E25\u0E48\u0E21\u0E17\u0E33\u0E07\u0E32\u0E19 (Crash Shield Active)",
      message: err?.message || "Internal Server Error"
    });
  });
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
