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


def test_importer_uses_correct_auth_headers_for_modern_secret(monkeypatch):
    import scripts.migrate_legacy_to_supabase as migration

    seen = {}
    class FakeResponse:
        def __enter__(self):
            return self
        def __exit__(self, *_args):
            return False
        def read(self):
            return b'{"status":"imported"}'

    def fake_urlopen(request, timeout):
        seen["headers"] = {key.lower(): value for key, value in request.header_items()}
        seen["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_example")
    monkeypatch.setattr(migration.urllib.request, "urlopen", fake_urlopen)
    assert migration.import_snapshot({}, "a" * 64) == {"status": "imported"}
    assert seen["headers"]["apikey"] == "sb_secret_example"
    assert "authorization" not in seen["headers"]


def test_importer_adds_bearer_for_legacy_service_role_jwt(monkeypatch):
    import scripts.migrate_legacy_to_supabase as migration

    seen = {}
    class FakeResponse:
        def __enter__(self):
            return self
        def __exit__(self, *_args):
            return False
        def read(self):
            return b'{"status":"imported"}'

    def fake_urlopen(request, timeout):
        seen["headers"] = {key.lower(): value for key, value in request.header_items()}
        return FakeResponse()

    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "legacy-service-role-jwt")
    monkeypatch.setattr(migration.urllib.request, "urlopen", fake_urlopen)
    assert migration.import_snapshot({}, "b" * 64) == {"status": "imported"}
    assert seen["headers"]["apikey"] == "legacy-service-role-jwt"
    assert seen["headers"]["authorization"] == "Bearer legacy-service-role-jwt"
