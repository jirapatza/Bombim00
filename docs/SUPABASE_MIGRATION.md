# Bombim00: Supabase migration and recovery plan

## Current source of truth

Before cutover, GitHub JSON remains authoritative. The migration must not delete,
rename, or overwrite these legacy files:

- `lottery_previous_results.json`
- `data/all_lotteries.json`
- `config/settings.json`
- `status/status.json`
- `status/self_healing_history.json`

The checked-in importer is dry-run by default and computes a SHA-256 digest over
all five exact source files. It rejects missing files, invalid JSON, duplicate
result fingerprints, and duplicate catalog IDs before making any network call.

## Target data model

Apply `supabase/migrations/20261102000100_bombim00_core.sql` first. The RPC
`import_bombim00_legacy_snapshot` imports one complete snapshot in a single
PostgreSQL transaction. It uses upserts and never deletes existing rows.
Legacy result payloads are retained as JSONB so Thai field names and unknown
provider fields are preserved. The legacy `sent` status stays inside each
payload; no unverified historical notification channel events are fabricated.

## Dry run

From the repository root:

```bash
python scripts/migrate_legacy_to_supabase.py
```

Expected output includes the source digest and source row counts. This mode
does not connect to Supabase.

## Actual import (only after provisioning Supabase)

1. Apply the SQL migration to the intended Supabase project.
2. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in a trusted server environment.
3. Run:

```bash
python scripts/migrate_legacy_to_supabase.py --apply
```

Never put the secret key in source control, browser code, logs, or chat.

## Cutover gates

Do not switch production reads/writes until all of these pass:

- The source SHA-256 and row counts are recorded.
- Supabase result count equals the source result count (175 at the last audit).
- Supabase catalog count equals the source catalog count (54 at the last audit).
- Every imported fingerprint exists exactly once.
- Settings, system status, and self-healing history match the source JSON exactly.
- A test write/read and a repeat import are successful.
- The result checker uses Supabase for both reading and writing; no mixed GitHub/Supabase
  deduplication path remains.
- Notification idempotency is tested before enabling live sends.

## Rollback

Keep GitHub JSON read-only and intact for at least 30 days after cutover. If any
validation or runtime check fails, disable the new Supabase path and restore
GitHub JSON reads. Never restore a database by blindly overwriting current data;
use a verified snapshot and compare fingerprints first.

## Backup destination

Use a separate **private** GitHub repository for GPG AES-256 encrypted database dumps.
The workflow removes the plaintext dump before uploading. Keep the decryption passphrase
in a password manager separate from GitHub. Never place raw production dumps in the
public application repository.
