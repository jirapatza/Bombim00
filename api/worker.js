/**
 * api/worker.js - Cloudflare Worker Proxy for Lottery Alert Dashboard
 * 
 * Manages GitHub API interactions securely without exposing GITHUB_TOKEN to the client browser.
 * 
 * Required Secrets (wrangler secret put <NAME>):
 *   - GITHUB_TOKEN: Fine-grained Personal Access Token (Permissions: Contents: Read/Write, Actions: Read/Write)
 *   - DASH_PASSWORD: Secret password for dashboard authorization
 * 
 * Required Vars (wrangler.toml [vars]):
 *   - REPO: "username/lottery-alert" (e.g., owner/repo)
 *   - BRANCH: "main"
 *   - WORKFLOW: "lottery.yml"
 *   - ALLOW_ORIGIN: "*" (or your GitHub Pages / frontend domain)
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    const allowOrigin = env.ALLOW_ORIGIN || "*";

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowOrigin === "*" ? origin : allowOrigin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Dashboard-Password",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowOrigin === "*" ? origin : allowOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Content-Type": "application/json; charset=utf-8",
    };

    const url = new URL(request.url);
    const path = url.pathname;

    // Helper: Verify Dashboard Password
    const authHeader = request.headers.get("Authorization") || "";
    const customHeader = request.headers.get("X-Dashboard-Password") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const clientPassword = bearer || customHeader;

    let incomingBody = {};
    if (request.method !== "GET" && request.method !== "OPTIONS") {
      try { incomingBody = await request.clone().json(); } catch { incomingBody = {}; }
    }
    const requestToken = incomingBody.token || "";
    const isAuthed = env.DASH_PASSWORD ? clientPassword === env.DASH_PASSWORD : Boolean(requestToken);

    // Writes require either the configured dashboard password or a GitHub token
    // supplied for this request. The token is never stored by this Worker.
    const isWriteMethod = ["POST", "PUT", "DELETE"].includes(request.method);

    if (isWriteMethod && !isAuthed) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Invalid or missing DASH_PASSWORD." }),
        { status: 401, headers: corsHeaders }
      );
    }

    const repo = env.REPO || "user/lottery-alert";
    const branch = env.BRANCH || "main";
    const workflow = env.WORKFLOW || "lottery.yml";
    const ghToken = env.GITHUB_TOKEN || requestToken;

    const ghHeaders = {
      "User-Agent": "LotteryAlert-Worker/1.0",
      "Accept": "application/vnd.github.v3+json",
      ...(ghToken ? { "Authorization": `Bearer ${ghToken}` } : {}),
    };

    try {
      if (path === "/api/simulate-runner" && request.method === "POST") {
        return new Response(JSON.stringify({ message: "โหมดจำลองทำงานในแอปเท่านั้น ไม่ได้สั่งรัน GitHub Actions จริง", stdout: "✓ เชื่อมต่อ Cloudflare Worker แล้ว\\n✓ อ่านคำสั่งจำลองสำเร็จ\\nℹ️ หากต้องการรันจริง ให้ใช้ปุ่มสั่งรัน GitHub Actions" }), { status: 200, headers: corsHeaders });
      }

      // Android editor: pull a file from the configured repository.
      if (path === "/api/github/get-remote-file" && request.method === "POST") {
        const body = incomingBody;
        const filePath = String(body.filePath || "");
        if (!filePath || filePath.includes("..") || filePath.startsWith("/") || filePath.startsWith(".env")) return new Response(JSON.stringify({ error: "Invalid file path" }), { status: 400, headers: corsHeaders });
        const remote = await fetch("https://api.github.com/repos/" + repo + "/contents/" + filePath + "?ref=" + encodeURIComponent(branch), { headers: ghHeaders });
        if (!remote.ok) return new Response(JSON.stringify({ error: "Unable to read remote file", details: await remote.text() }), { status: remote.status, headers: corsHeaders });
        const file = await remote.json();
        const content = file.encoding === "base64" ? decodeURIComponent(escape(atob(file.content.replace(/\\n/g, "")))) : file.content;
        return new Response(JSON.stringify({ content, sha: file.sha, size: file.size }), { status: 200, headers: corsHeaders });
      }

      // Android editor: create or update a repository file.
      if (path === "/api/github/commit-file" && request.method === "POST") {
        if (!ghToken) return new Response(JSON.stringify({ error: "GitHub token is required to write repository files" }), { status: 503, headers: corsHeaders });
        const body = incomingBody;
        const filePath = String(body.filePath || "");
        if (!filePath || filePath.includes("..") || filePath.startsWith("/") || filePath.startsWith(".env")) return new Response(JSON.stringify({ error: "Invalid or blocked file path" }), { status: 400, headers: corsHeaders });
        const fileUrl = "https://api.github.com/repos/" + repo + "/contents/" + filePath + "?ref=" + encodeURIComponent(branch);
        const currentRes = await fetch(fileUrl, { headers: ghHeaders });
        let sha;
        if (currentRes.ok) sha = (await currentRes.json()).sha;
        else if (currentRes.status !== 404) return new Response(JSON.stringify({ error: "Unable to inspect current file", details: await currentRes.text() }), { status: currentRes.status, headers: corsHeaders });
        const encoded = btoa(unescape(encodeURIComponent(String(body.content || ""))));
        const saved = await fetch("https://api.github.com/repos/" + repo + "/contents/" + filePath, { method: "PUT", headers: { ...ghHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ message: String(body.commitMessage || ("Update " + filePath)), content: encoded, branch, ...(sha ? { sha } : {}) }) });
        const result = await saved.json();
        if (!saved.ok) return new Response(JSON.stringify({ error: result.message || "GitHub commit failed" }), { status: saved.status, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true, message: "บันทึกไฟล์ขึ้น GitHub สำเร็จ", commit_sha: result.commit && result.commit.sha, html_url: result.content && result.content.html_url }), { status: 200, headers: corsHeaders });
      }

      // Workflow builder and Actions controls.
      if (path === "/api/github/workflow" && request.method === "GET") {
        const r = await fetch("https://api.github.com/repos/" + repo + "/contents/.github/workflows/" + workflow + "?ref=" + encodeURIComponent(branch), { headers: ghHeaders });
        if (!r.ok) return new Response(JSON.stringify({ error: "Unable to load workflow YAML" }), { status: r.status, headers: corsHeaders });
        const f = await r.json();
        return new Response(JSON.stringify({ content: decodeURIComponent(escape(atob(f.content.replace(/\\n/g, "")))), sha: f.sha }), { status: 200, headers: corsHeaders });
      }
      if (path === "/api/github/workflow" && request.method === "POST") {
        if (!ghToken) return new Response(JSON.stringify({ error: "GitHub token is required to update workflow" }), { status: 503, headers: corsHeaders });
        const filePath = ".github/workflows/" + workflow;
        const r = await fetch("https://api.github.com/repos/" + repo + "/contents/" + filePath + "?ref=" + encodeURIComponent(branch), { headers: ghHeaders });
        if (!r.ok) return new Response(JSON.stringify({ error: "Unable to read workflow before update" }), { status: r.status, headers: corsHeaders });
        const f = await r.json();
        const encoded = btoa(unescape(encodeURIComponent(String(incomingBody.content || ""))));
        const saved = await fetch("https://api.github.com/repos/" + repo + "/contents/" + filePath, { method: "PUT", headers: { ...ghHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ message: "chore: update workflow from app", content: encoded, branch, sha: f.sha }) });
        const result = await saved.json();
        if (!saved.ok) return new Response(JSON.stringify({ error: result.message || "Workflow update failed" }), { status: saved.status, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true, commit: result.commit && result.commit.sha }), { status: 200, headers: corsHeaders });
      }
      if (path === "/api/github/dispatch" && request.method === "POST") {
        if (!ghToken) return new Response(JSON.stringify({ error: "GitHub token is required to dispatch workflow" }), { status: 503, headers: corsHeaders });
        const selectedWorkflow = String(incomingBody.workflow || workflow);
        const r = await fetch("https://api.github.com/repos/" + repo + "/actions/workflows/" + selectedWorkflow + "/dispatches", { method: "POST", headers: ghHeaders, body: JSON.stringify({ ref: branch, inputs: incomingBody.inputs || {} }) });
        if (!r.ok) return new Response(JSON.stringify({ error: "Workflow dispatch failed", details: await r.text() }), { status: r.status, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true, message: "สั่งรัน GitHub Actions แล้ว" }), { status: 200, headers: corsHeaders });
      }
      if (path === "/api/github/runs" && request.method === "POST") {
        const selectedWorkflow = String(incomingBody.workflow || workflow);
        const r = await fetch("https://api.github.com/repos/" + repo + "/actions/workflows/" + selectedWorkflow + "/runs?per_page=10", { headers: ghHeaders });
        const data = await r.json();
        if (!r.ok) return new Response(JSON.stringify({ error: data.message || "Unable to fetch workflow runs" }), { status: r.status, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true, workflow_runs: data.workflow_runs || [] }), { status: 200, headers: corsHeaders });
      }

      // 1. GET /api/status - Read status/status.json
      if (path === "/api/status" && request.method === "GET") {
        const ghUrl = `https://raw.githubusercontent.com/${repo}/${branch}/status/status.json?cache_bust=${Date.now()}`;
        const res = await fetch(ghUrl);
        if (!res.ok) {
          return new Response(JSON.stringify({ error: "Failed to fetch status from repository" }), { status: res.status, headers: corsHeaders });
        }
        const data = await res.json();
        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
      }

      // 2. GET /api/settings - Read config/settings.json
      if (path === "/api/settings" && request.method === "GET") {
        const ghUrl = `https://raw.githubusercontent.com/${repo}/${branch}/config/settings.json?cache_bust=${Date.now()}`;
        const res = await fetch(ghUrl);
        if (!res.ok) {
          return new Response(JSON.stringify({ error: "Failed to fetch settings from repository" }), { status: res.status, headers: corsHeaders });
        }
        const data = await res.json();
        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
      }

      // 3. POST /api/settings - Write and commit config/settings.json to GitHub
      if (path === "/api/settings" && request.method === "POST") {
        if (!ghToken) {
          return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured on Worker" }), { status: 500, headers: corsHeaders });
        }

        const newSettings = await request.json();
        const contentStr = JSON.stringify(newSettings, null, 2);
        const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));

        // Get current file sha first
        const getFileUrl = `https://api.github.com/repos/${repo}/contents/config/settings.json?ref=${branch}`;
        const currentFileRes = await fetch(getFileUrl, { headers: ghHeaders });
        let sha = null;
        if (currentFileRes.ok) {
          const currentFileData = await currentFileRes.json();
          sha = currentFileData.sha;
        }

        // Commit update via GitHub Contents API
        const putFileUrl = `https://api.github.com/repos/${repo}/contents/config/settings.json`;
        const commitRes = await fetch(putFileUrl, {
          method: "PUT",
          headers: ghHeaders,
          body: JSON.stringify({
            message: "chore: update config/settings.json via Lottery Dashboard",
            content: contentBase64,
            branch: branch,
            ...(sha ? { sha } : {}),
          }),
        });

        if (!commitRes.ok) {
          const errData = await commitRes.json();
          return new Response(JSON.stringify({ error: "GitHub commit error", details: errData }), { status: commitRes.status, headers: corsHeaders });
        }

        const result = await commitRes.json();
        return new Response(JSON.stringify({ success: true, message: "Settings updated on GitHub successfully", commit: result.commit?.sha }), { status: 200, headers: corsHeaders });
      }

      // 4. GET /api/results - Read lottery_previous_results.json
      if (path === "/api/results" && request.method === "GET") {
        const ghUrl = `https://raw.githubusercontent.com/${repo}/${branch}/lottery_previous_results.json?cache_bust=${Date.now()}`;
        const res = await fetch(ghUrl);
        if (!res.ok) {
          return new Response(JSON.stringify({ error: "Failed to fetch previous results" }), { status: res.status, headers: corsHeaders });
        }
        const data = await res.json();
        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
      }

      // 5. GET /api/all-lotteries - Read the lottery catalog used by the dashboard
      if (path === "/api/all-lotteries" && request.method === "GET") {
        const ghUrl = `https://raw.githubusercontent.com/${repo}/${branch}/data/all_lotteries.json?cache_bust=${Date.now()}`;
        const res = await fetch(ghUrl);
        if (!res.ok) {
          return new Response(JSON.stringify({ error: "Failed to fetch lottery catalog" }), { status: res.status, headers: corsHeaders });
        }
        const data = await res.json();
        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
      }

      // 6. GET /api/project-files - Read-only project file browser (public repository)
      if (path === "/api/project-files" && request.method === "GET") {
        const treeUrl = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
        const treeRes = await fetch(treeUrl, { headers: ghHeaders });
        if (!treeRes.ok) {
          return new Response(JSON.stringify({ error: "Failed to list repository files" }), { status: treeRes.status, headers: corsHeaders });
        }
        const treeData = await treeRes.json();
        const allowed = /\.(py|js|mjs|cjs|ts|tsx|json|ya?ml|toml|md)$/i;
        const blocked = /(^|\/)(node_modules|dist|build|\.git)(\/|$)|(^|\/)\.env/i;
        const files = (treeData.tree || [])
          .filter((item) => item.type === "blob" && allowed.test(item.path) && !blocked.test(item.path))
          .slice(0, 40);
        const projectFiles = await Promise.all(files.map(async (item) => {
          const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${item.path}`;
          const fileRes = await fetch(rawUrl);
          if (!fileRes.ok) return null;
          const content = await fileRes.text();
          if (content.length > 200000) return null;
          const parts = item.path.split("/");
          const ext = item.path.split(".").pop() || "text";
          return {
            name: parts[parts.length - 1],
            path: item.path,
            category: parts.length > 1 ? parts[0] : ext.toUpperCase(),
            content
          };
        }));
        return new Response(JSON.stringify(projectFiles.filter(Boolean)), { status: 200, headers: corsHeaders });
      }

      // 7. POST /api/all-lotteries - Update the public lottery catalog in GitHub
      if (path === "/api/all-lotteries" && request.method === "POST") {
        if (!ghToken) {
          return new Response(JSON.stringify({ error: "Write disabled: GitHub token is not configured. Public read-only mode remains available." }), { status: 503, headers: corsHeaders });
        }
        const updatedCatalog = await request.json();
        const contentStr = JSON.stringify(updatedCatalog, null, 2);
        const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));
        const fileUrl = `https://api.github.com/repos/${repo}/contents/data/all_lotteries.json?ref=${branch}`;
        const currentRes = await fetch(fileUrl, { headers: ghHeaders });
        if (!currentRes.ok) {
          return new Response(JSON.stringify({ error: "Unable to read current lottery catalog", details: await currentRes.text() }), { status: currentRes.status, headers: corsHeaders });
        }
        const current = await currentRes.json();
        const commitRes = await fetch(`https://api.github.com/repos/${repo}/contents/data/all_lotteries.json`, {
          method: "PUT",
          headers: ghHeaders,
          body: JSON.stringify({
            message: "chore: update lottery catalog via dashboard",
            content: contentBase64,
            branch,
            sha: current.sha
          })
        });
        if (!commitRes.ok) {
          return new Response(JSON.stringify({ error: "GitHub catalog update failed", details: await commitRes.text() }), { status: commitRes.status, headers: corsHeaders });
        }
        const result = await commitRes.json();
        return new Response(JSON.stringify({ success: true, message: "Lottery catalog saved to GitHub", commit: result.commit?.sha }), { status: 200, headers: corsHeaders });
      }

      // 8. POST /api/trigger - Trigger GitHub Action workflow manually
      if (path === "/api/trigger" && request.method === "POST") {
        if (!ghToken) {
          return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured on Worker" }), { status: 500, headers: corsHeaders });
        }

        const dispatchUrl = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
        const dispatchRes = await fetch(dispatchUrl, {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({ ref: branch }),
        });

        if (!dispatchRes.ok) {
          const err = await dispatchRes.text();
          return new Response(JSON.stringify({ error: "Failed to trigger workflow dispatch", details: err }), { status: dispatchRes.status, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: true, message: `Workflow '${workflow}' dispatched successfully on branch '${branch}'.` }), { status: 200, headers: corsHeaders });
      }

      // 9. GET /api/runs - Get workflow execution runs
      if (path === "/api/runs" && request.method === "GET") {
        const runsUrl = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=5`;
        const runsRes = await fetch(runsUrl, { headers: ghHeaders });
        if (!runsRes.ok) {
          return new Response(JSON.stringify({ runs: [] }), { status: 200, headers: corsHeaders });
        }
        const runsData = await runsRes.json();
        return new Response(JSON.stringify(runsData), { status: 200, headers: corsHeaders });
      }

      // 10. POST /api/test-ntfy - Send test notification to ntfy
      if (path === "/api/test-ntfy" && request.method === "POST") {
        const body = await request.json();
        const server = (body.server || "https://ntfy.sh").replace(/\/$/, "");
        const topic = body.topic;
        if (!topic) {
          return new Response(JSON.stringify({ error: "Missing topic parameter" }), { status: 400, headers: corsHeaders });
        }

        const ntfyRes = await fetch(`${server}/${topic}`, {
          method: "POST",
          headers: {
            "Title": "🔔 ทดสอบระบบแจ้งเตือน Lottery Alert",
            "Priority": body.priority || "high",
            "Tags": "tada,sparkles,dart",
          },
          body: body.message || "การทดสอบเชื่อมต่อจาก Lottery Alert Dashboard สำเร็จเรียบร้อย!",
        });

        if (!ntfyRes.ok) {
          return new Response(JSON.stringify({ error: "Failed to send ntfy alert" }), { status: ntfyRes.status, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: true, message: `Test alert sent to ${server}/${topic}` }), { status: 200, headers: corsHeaders });
      }

      // Default Health Check
      return new Response(
        JSON.stringify({
          service: "Lottery Alert Cloudflare Worker Proxy",
          status: "running",
          repo: repo,
          branch: branch,
          authRequired: Boolean(env.DASH_PASSWORD),
        }),
        { status: 200, headers: corsHeaders }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  },
};
