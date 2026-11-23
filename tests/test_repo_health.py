from datetime import datetime, timedelta, timezone

from scripts.repo_health import (
    OK,
    UNKNOWN,
    WARN,
    failing_checks,
    heartbeat_minutes,
    protection_summary,
    render_report,
    stale_workflows,
    workflow_file_row,
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


def workflow(path, state="active"):
    return {"path": path, "state": state}


def test_stale_workflows_lists_only_missing_files():
    registered = [workflow(".github/workflows/a.yml"), workflow(".github/workflows/b.yml")]
    assert stale_workflows(registered, {".github/workflows/a.yml"}) == [".github/workflows/b.yml"]


def test_stale_workflows_ignores_github_managed_entries():
    registered = [workflow("dynamic/dependabot/update-graph"), workflow("dynamic/agents/github-advanced-security")]
    assert stale_workflows(registered, set()) == []


def test_stale_workflows_ignores_disabled_ones():
    registered = [workflow(".github/workflows/gone.yml", "disabled_manually")]
    assert stale_workflows(registered, set()) == []


def test_stale_workflows_is_empty_when_all_files_exist():
    assert stale_workflows([workflow(".github/workflows/a.yml")], {".github/workflows/a.yml"}) == []


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


def test_workflow_file_row_warns_about_an_active_stale_entry():
    row = workflow_file_row([workflow(".github/workflows/gone.yml")], set())
    assert row[1] == WARN and "gone.yml" in row[2]


def test_workflow_file_row_notes_a_disabled_leftover():
    row = workflow_file_row([workflow(".github/workflows/gone.yml", "disabled_manually")], set())
    assert row[1] == OK and "disabled leftover" in row[2]


def test_workflow_file_row_is_clean_when_every_file_exists():
    row = workflow_file_row([workflow(".github/workflows/a.yml")], {".github/workflows/a.yml"})
    assert row == ("workflow files", OK, "every registered workflow has a file")


def test_protection_summary_flags_missing_checks():
    payload = {"required_status_checks": {"contexts": ["quality", "smoke"]}}
    state, detail = protection_summary(payload)
    assert state == WARN and "cloudflare" in detail and "CodeQL" in detail


def test_protection_summary_is_clean_when_all_required_checks_are_set():
    payload = {"required_status_checks": {"contexts": ["quality", "cloudflare", "smoke", "CodeQL", "extra"]}}
    state, detail = protection_summary(payload)
    assert state == OK and detail.startswith("required: ")


def test_protection_summary_handles_a_branch_without_checks():
    state, detail = protection_summary({})
    assert state == WARN and "quality" in detail
