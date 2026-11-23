"""Daily repository health report.

Reads workflow runs, runtime status, open pull requests and dependency audits,
then writes a single issue. Nothing here changes code or runtime data.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

API = "https://api.github.com"
BANGKOK = timezone(timedelta(hours=7))
ISSUE_TITLE = "Repo health"
STATUS_URL = "https://raw.githubusercontent.com/{repo}/runtime-live/status/status.json"
HEARTBEAT_LIMIT_MIN = 20
PR_AGE_LIMIT_DAYS = 3
REQUIRED_CONTEXTS = ("quality", "cloudflare", "smoke", "CodeQL")
OK = "✅"
WARN = "⚠️"
UNKNOWN = "❔"


def request_json(token, path, method="GET", payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "bombim00-repo-health",
        "Content-Type": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(API + path, data=body, method=method, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read()
    return json.loads(raw) if raw else {}


def heartbeat_minutes(timestamp, now):
    """Minutes since the checker last ran, or None when the value is unusable."""
    if not timestamp:
        return None
    try:
        then = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
    except ValueError:
        return None
    if then.tzinfo is None:
        then = then.replace(tzinfo=BANGKOK)
    return int((now - then).total_seconds() // 60)


def stale_workflows(registered, present):
    """Workflows whose file left the repository and that nobody has disabled yet.

    GitHub keeps managed entries such as ``dynamic/dependabot/update-graph`` that
    never correspond to a file, and a stale entry stays useful to report only
    while it can still run, so a manually disabled one is left alone.
    """
    return sorted(
        item["path"]
        for item in registered
        if (item.get("path") or "").startswith(".github/workflows/")
        and item["path"] not in present
        and item.get("state") != "disabled_manually"
    )


def failing_checks(check_runs, ignored=()):
    """Completed check runs that did not pass, minus the ones the owner accepted."""
    prefixes = tuple(name for name in ignored if name)
    return sorted(
        f"{run.get('name')}={run.get('conclusion')}"
        for run in check_runs
        if run.get("status") == "completed"
        and run.get("conclusion") not in ("success", "skipped", "neutral")
        and not (prefixes and str(run.get("name")).startswith(prefixes))
    )


def protection_summary(payload):
    """Required checks the branch is still missing, from a protection payload."""
    contexts = (payload.get("required_status_checks") or {}).get("contexts") or []
    missing = [name for name in REQUIRED_CONTEXTS if name not in contexts]
    if missing:
        return WARN, "missing required checks: " + ", ".join(missing)
    return OK, "required: " + ", ".join(REQUIRED_CONTEXTS)


def protection_row(token, repo, branch="main"):
    """Branch protection is admin-only, so a refusal is reported, never hidden."""
    try:
        payload = request_json(token, f"/repos/{repo}/branches/{branch}/protection")
    except urllib.error.HTTPError as error:
        if error.code in (403, 404):
            return ("branch protection", UNKNOWN, f"cannot verify ({error.code}): needs an admin token")
        return ("branch protection", UNKNOWN, f"cannot read: {error}")
    except (urllib.error.URLError, ValueError) as error:
        return ("branch protection", UNKNOWN, f"cannot read: {error}")
    state, detail = protection_summary(payload)
    return ("branch protection", state, detail)


def workflow_file_row(registered, present):
    """One row about registered workflows that no longer have a file."""
    stale = stale_workflows(registered, present)
    if stale:
        return ("workflow files", WARN, "registered without a file: " + ", ".join(stale))
    leftovers = sorted(
        item["path"]
        for item in registered
        if (item.get("path") or "").startswith(".github/workflows/")
        and item["path"] not in present
    )
    if leftovers:
        return ("workflow files", OK, f"{len(leftovers)} disabled leftover(s): " + ", ".join(leftovers))
    return ("workflow files", OK, "every registered workflow has a file")


def render_report(rows, now):
    lines = [
        f"Updated {now:%Y-%m-%d %H:%M} (Asia/Bangkok).",
        "",
        "| check | state | detail |",
        "| --- | --- | --- |",
    ]
    for name, state, detail in rows:
        lines.append(f"| {name} | {state} | {detail} |")
    return "\n".join(lines)


def workflow_rows(token, repo, workflow_dir=".github/workflows"):
    rows = []
    runs = None
    try:
        runs = request_json(token, f"/repos/{repo}/actions/runs?per_page=60").get("workflow_runs") or []
    except (urllib.error.URLError, ValueError) as error:
        rows.append(("workflows", UNKNOWN, f"cannot read runs: {error}"))
    if runs is not None:
        latest = {}
        for run in runs:
            latest.setdefault(run.get("name") or "?", run)
        failing = [
            f"{name}={run.get('conclusion')}"
            for name, run in sorted(latest.items())
            if run.get("conclusion") not in ("success", "skipped", "neutral", None)
        ]
        if failing:
            rows.append(("workflows", WARN, ", ".join(failing)))
        else:
            rows.append(("workflows", OK, f"{len(latest)} tracked, all green"))
    try:
        registered = request_json(token, f"/repos/{repo}/actions/workflows").get("workflows") or []
    except (urllib.error.URLError, ValueError) as error:
        rows.append(("workflow files", UNKNOWN, f"cannot list: {error}"))
        return rows
    present = {
        f"{workflow_dir}/{name}"
        for name in os.listdir(workflow_dir)
        if name.endswith((".yml", ".yaml"))
    }
    rows.append(workflow_file_row(registered, present))
    rows.append(protection_row(token, repo))
    rows += check_run_rows(token, repo)
    return rows


def check_run_rows(token, repo, branch="main"):
    """External CI such as Workers Builds never shows up as an Actions run."""
    try:
        runs = request_json(
            token, f"/repos/{repo}/commits/{branch}/check-runs?per_page=100"
        ).get("check_runs") or []
    except (urllib.error.URLError, ValueError) as error:
        return [("check runs", UNKNOWN, f"cannot read: {error}")]
    ignored = [name for name in os.environ.get("HEALTH_IGNORED_CHECKS", "").split(",") if name]
    failing = failing_checks(runs, ignored)
    if failing:
        return [("check runs", WARN, ", ".join(failing))]
    detail = f"{len(runs)} on {branch}, all green"
    if ignored:
        detail += f" (ignored: {', '.join(ignored)})"
    return [("check runs", OK, detail)]


def status_rows(repo, now):
    try:
        with urllib.request.urlopen(STATUS_URL.format(repo=repo), timeout=30) as response:
            status = json.loads(response.read())
    except (urllib.error.URLError, ValueError) as error:
        return [("runtime status", UNKNOWN, f"cannot read: {error}")]
    rows = []
    age = heartbeat_minutes(status.get("last_run_timestamp"), now)
    if age is None:
        rows.append(("heartbeat", UNKNOWN, "no readable last_run_timestamp"))
    elif age > HEARTBEAT_LIMIT_MIN:
        rows.append(("heartbeat", WARN, f"{age} min old (limit {HEARTBEAT_LIMIT_MIN})"))
    else:
        rows.append(("heartbeat", OK, f"{age} min old"))
    state = status.get("system_status") or "?"
    errors = (status.get("source_checks") or {}).get("errors") or []
    if state == "healthy":
        rows.append(("system status", OK, "healthy"))
    else:
        detail = ", ".join(f"{item.get('source')}:{item.get('reason')}" for item in errors)
        rows.append(("system status", WARN, f"{state} ({detail or 'no error detail'})"))
    return rows


def pull_request_rows(token, repo, now):
    try:
        pull_requests = request_json(token, f"/repos/{repo}/pulls?state=open&per_page=100") or []
    except (urllib.error.URLError, ValueError) as error:
        return [("pull requests", UNKNOWN, f"cannot list: {error}")]
    if not isinstance(pull_requests, list):
        return [("pull requests", UNKNOWN, "unexpected response")]
    if not pull_requests:
        return [("pull requests", OK, "none open")]
    stale = []
    for item in pull_requests:
        created = datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
        days = (now - created).days
        if days >= PR_AGE_LIMIT_DAYS:
            stale.append(f"#{item['number']} {days}d")
    detail = f"{len(pull_requests)} open"
    if stale:
        detail += ", waiting: " + ", ".join(stale)
    return [("pull requests", WARN if stale else OK, detail)]


def dependency_rows():
    rows = []
    for label, directory in (("web deps", "."), ("worker deps", "cloudflare")):
        if not os.path.exists(os.path.join(directory, "package-lock.json")):
            rows.append((label, UNKNOWN, "no package-lock.json"))
            continue
        try:
            result = subprocess.run(
                ["npm", "audit", "--package-lock-only", "--json"],
                cwd=directory,
                capture_output=True,
                text=True,
                timeout=180,
            )
            report = json.loads(result.stdout or "{}")
            count = len(report.get("vulnerabilities") or {})
            rows.append((label, OK if count == 0 else WARN, f"{count} vulnerabilities"))
        except (subprocess.SubprocessError, ValueError, OSError) as error:
            rows.append((label, UNKNOWN, f"audit failed: {error}"))
    return rows


def update_issue(token, repo, body):
    """Keep one issue. Returns (number, changed)."""
    listing = request_json(token, f"/repos/{repo}/issues?state=open&per_page=100")
    for issue in listing if isinstance(listing, list) else []:
        if issue.get("title") != ISSUE_TITLE:
            continue
        if (issue.get("body") or "") == body:
            return issue["number"], False
        request_json(token, f"/repos/{repo}/issues/{issue['number']}", "PATCH", {"body": body})
        return issue["number"], True
    created = request_json(token, f"/repos/{repo}/issues", "POST", {"title": ISSUE_TITLE, "body": body})
    return created.get("number"), True


def main(dry_run=False):
    if os.environ.get("HEALTH_DRY_RUN") == "1":
        dry_run = True
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        raise SystemExit("GITHUB_REPOSITORY is required")
    now = datetime.now(BANGKOK)
    rows = []
    if token:
        rows += workflow_rows(token, repo)
        rows += pull_request_rows(token, repo, now)
    else:
        rows.append(("workflows", UNKNOWN, "no token in environment"))
    rows += status_rows(repo, now)
    rows += dependency_rows()
    body = render_report(rows, now)
    print(body)
    if dry_run or not token:
        return 0
    number, changed = update_issue(token, repo, body)
    print(f"issue #{number} {'updated' if changed else 'unchanged'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--dry-run" in sys.argv))
