import json
import subprocess
import sys
from pathlib import Path


def test_legacy_migration_defaults_to_dry_run():
    root = Path(__file__).resolve().parents[1]
    completed = subprocess.run(
        [sys.executable, "scripts/migrate_legacy_to_supabase.py"],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    summary = json.loads(completed.stdout.split("DRY RUN ONLY:")[0])
    assert summary["results"] > 0
    assert summary["catalog"] > 0
    assert len(summary["source_sha256"]) == 64
    assert "no data was sent" in completed.stdout


def test_migration_requires_all_legacy_sources():
    # This test verifies the checked-in migration sources exist before CI runs.
    root = Path(__file__).resolve().parents[1]
    for relative in (
        "lottery_previous_results.json",
        "data/all_lotteries.json",
        "config/settings.json",
        "status/status.json",
        "status/self_healing_history.json",
    ):
        assert (root / relative).is_file()
