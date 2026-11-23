from datetime import datetime, timedelta, timezone

from scripts.repo_health import (
    OK,
    UNKNOWN,
    WARN,
    failing_checks,
    heartbeat_minutes,
    render_report,
    stale_paths,
)

BANGKOK = timezone(timedelta(hours=7))
NOW = datetime(2026, 11, 23, 12, 0, tzinfo=BANGKOK)


def test_heartbeat_reads_offset_timestamp():
    assert heartbeat_minutes("2026-11-23T11:45:00+07:00", NOW) == 15


def test_heartbeat_reads_utc_timestamp():
    assert heartbeat_minutes("2026-11-23T05:00:00Z", NOW) == 0


def test_heartbeat_treats_naive_timestamp_as_bangkok():
    assert heartbeat_minutes("2026-11-23T11:30:00", NOW) == 30


def test_heartbeat_returns_none_for_garbage():
    assert heartbeat_minutes("", NOW) is None
    assert heartbeat_minutes("not a date", NOW) is None
    assert heartbeat_minutes(None, NOW) is None


def test_stale_paths_lists_only_missing_files():
    registered = [".github/workflows/a.yml", ".github/workflows/b.yml"]
    assert stale_paths(registered, {".github/workflows/a.yml"}) == [".github/workflows/b.yml"]


def test_stale_paths_ignores_github_managed_entries():
    registered = ["dynamic/dependabot/update-graph", "dynamic/agents/github-advanced-security"]
    assert stale_paths(registered, set()) == []


def test_stale_paths_is_empty_when_all_files_exist():
    assert stale_paths([".github/workflows/a.yml"], {".github/workflows/a.yml"}) == []


def test_failing_checks_reports_completed_failures_only():
    runs = [
        {"name": "quality", "status": "completed", "conclusion": "success"},
        {"name": "smoke", "status": "in_progress", "conclusion": None},
        {"name": "deploy", "status": "completed", "conclusion": "failure"},
    ]
    assert failing_checks(runs) == ["deploy=failure"]


def test_failing_checks_skips_accepted_prefixes():
    runs = [
        {"name": "Workers Builds: bombim00-v2-watchdog-test", "status": "completed", "conclusion": "failure"},
        {"name": "quality", "status": "completed", "conclusion": "failure"},
    ]
    assert failing_checks(runs, ["Workers Builds:"]) == ["quality=failure"]


def test_render_report_has_a_row_per_check():
    body = render_report([("workflows", WARN, "Deploy=startup_failure"), ("heartbeat", OK, "3 min old")], NOW)
    assert "| workflows | " + WARN + " | Deploy=startup_failure |" in body
    assert "| heartbeat | " + OK + " | 3 min old |" in body
    assert body.startswith("Updated 2026-11-23 12:00 (Asia/Bangkok).")


def test_render_report_keeps_unknown_state_visible():
    body = render_report([("web deps", UNKNOWN, "audit failed")], NOW)
    assert UNKNOWN in body
