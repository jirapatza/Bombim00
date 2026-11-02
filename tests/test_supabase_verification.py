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
        "batches": [{"source_sha256": "a" * 64}],
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
        "batches": [{"source_sha256": "b" * 64}],
    }
    with pytest.raises(ValueError, match="payload"):
        compare_snapshot(snapshot, "a" * 64, actual)
