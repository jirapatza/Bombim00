from scripts.verify_supabase_migration import compare_snapshot


def test_source_parity_verifier_accepts_exact_snapshot():
    snapshot = {
        "results": [{"fingerprint": "fp-1", "payload": {"ชื่อหวย": "ฮานอย"}}],
        "catalog": [{"id": "hanoi", "name": "ฮานอย"}],
        "settings": {"enabled": True},
        "status": {"system_status": "healthy"},
        "self_healing_history": [{"sessionId": "one"}],
    }
    actual = {
        "results": [{"fingerprint": "fp-1", "payload": {"ชื่อหวย": "ฮานอย"}}],
        "catalog": [{"lottery_id": "hanoi", "payload": {"id": "hanoi", "name": "ฮานอย"}}],
        "settings": {"enabled": True},
        "status": {"system_status": "healthy"},
        "history": [{"sessionId": "one"}],
        "suppressions": [],
        "batches": [{"source_sha256": "a" * 64, "results_count": 1, "catalog_count": 1, "history_count": 1}],
    }
    report = compare_snapshot(snapshot, "a" * 64, actual)
    assert report["status"] == "verified"
    assert report["source_counts"]["results"] == 1


def test_source_parity_verifier_rejects_payload_or_digest_mismatch():
    import pytest

    snapshot = {
        "results": [{"fingerprint": "fp-1", "payload": {"เลข": "123"}}],
        "catalog": [],
        "settings": {},
        "status": {},
        "self_healing_history": [],
    }
    actual = {
        "results": [{"fingerprint": "fp-1", "payload": {"เลข": "999"}}],
        "catalog": [],
        "settings": {},
        "status": {},
        "history": [],
        "suppressions": [],
        "batches": [{"source_sha256": "b" * 64, "results_count": 1, "catalog_count": 0, "history_count": 0}],
    }
    with pytest.raises(ValueError, match="payload"):
        compare_snapshot(snapshot, "a" * 64, actual)


def test_source_parity_verifier_requires_suppression_for_legacy_sent_results():
    import pytest

    snapshot = {
        "results": [{"fingerprint": "fp-sent", "payload": {"สถานะการแจ้งเตือน": "sent"}}],
        "catalog": [],
        "settings": {},
        "status": {},
        "self_healing_history": [],
    }
    actual = {
        "results": [{"fingerprint": "fp-sent", "payload": {"สถานะการแจ้งเตือน": "sent"}}],
        "catalog": [],
        "settings": {},
        "status": {},
        "history": [],
        "suppressions": [],
        "batches": [{"source_sha256": "c" * 64, "results_count": 1, "catalog_count": 0, "history_count": 0}],
    }
    with pytest.raises(ValueError, match="suppression"):
        compare_snapshot(snapshot, "c" * 64, actual)


def test_source_parity_allows_retained_older_database_history():
    snapshot = {
        "results": [{"fingerprint": "current", "payload": {"status": "sent"}}],
        "catalog": [],
        "settings": {},
        "status": {},
        "self_healing_history": [],
    }
    actual = {
        "results": [
            {"fingerprint": "current", "payload": {"status": "sent"}},
            {"fingerprint": "older-retained", "payload": {"status": "sent"}},
        ],
        "catalog": [],
        "settings": {},
        "status": {},
        "history": [],
        "suppressions": [
            {"fingerprint": "current"},
            {"fingerprint": "older-retained"},
        ],
        "batches": [{"source_sha256": "d" * 64, "results_count": 1, "catalog_count": 0, "history_count": 0}],
    }
    report = compare_snapshot(snapshot, "d" * 64, actual)
    assert report["status"] == "verified"
    assert report["database_counts"]["retained_extra_results"] == 1
