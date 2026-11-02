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
provider fields are preserved. Legacy `sent` flags are also represented in a
separate global suppression table; this prevents a re-send without pretending
to know whether LINE or ntfy delivered the original message.

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

The importer sends modern `sb_secret_...` keys in the `apikey` header only; legacy service-role JWT keys are sent in both the `apikey` and server-side `Authorization: Bearer` headers. Never put the secret key in source control, browser code, logs, or chat.

## Safe staged rollout

Use shadow-write mode to keep Supabase synchronized while GitHub JSON remains
the source of truth. This avoids a stale database snapshot while the live
5-minute checker continues to run.

1. Keep `SUPABASE_STORAGE_ENABLED` and `SUPABASE_CHECKER_ENABLED` false.
2. Configure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Render and GitHub
   Actions. Set `SUPABASE_SHADOW_WRITE=true` on Render and repository variable
   `SUPABASE_SHADOW_WRITE=true` in GitHub Actions. The server and checker
   continue reading GitHub JSON but mirror writes to Supabase.
3. Wait for any currently running lottery-checker job to finish. Run the
   manual workflow **Import GitHub JSON snapshot into Supabase** against this
   branch. It shares the lottery checker's concurrency group, imports all five
   files atomically using upserts, then syncs suppression markers for every
   legacy result marked `sent`.
4. Run the manual workflow **Verify Supabase migration parity** against the
   same branch. It uses the same concurrency group and is read-only.
5. Continue only if it returns `"status": "verified"`. It compares the complete
   result fingerprint set and every JSONB payload, catalog IDs/payloads,
   settings, status, self-healing history, import SHA/counts, and legacy
   notification suppressions. Any mismatch blocks cutover; keep shadow mode
   enabled, correct/re-import, and verify again.
6. Only after parity passes, set Render `SUPABASE_STORAGE_ENABLED=true` and
   GitHub Actions repository variable `SUPABASE_CHECKER_ENABLED=true`.
   Turn `SUPABASE_SHADOW_WRITE` back off. The API and checker then read from
   Supabase; GitHub JSON remains the recovery mirror.

The importer sends modern `sb_secret_...` keys in the `apikey` header only;
legacy service-role JWT keys are sent in both the `apikey` and server-side
`Authorization: Bearer` headers. Never put the secret key in source control,
browser code, logs, or chat.

The manual workflows are available in GitHub Actions as
**Import GitHub JSON snapshot into Supabase** and
**Verify Supabase migration parity**. Choose the same branch for both and use
the two Supabase repository secrets.

## Opt-in application integration (disabled by default)

The Node API and Python checker have independent primary-read feature flags,
plus a shared shadow-write flag:

- Render: `SUPABASE_STORAGE_ENABLED=true` switches API reads to Supabase.
  `SUPABASE_SHADOW_WRITE=true` mirrors writes while GitHub JSON remains primary.
- GitHub Actions: `SUPABASE_CHECKER_ENABLED=true` switches checker reads and
  notification reservations to Supabase. `SUPABASE_SHADOW_WRITE=true` mirrors
  result/status writes while JSON remains primary.
- If a primary or shadow flag is enabled but credentials or database access
  fail, the operation fails closed; it does not silently fall back.
- The history cleanup API is blocked during either primary or shadow mode
  until a transactional maintenance RPC is available.

Apply the notification idempotency migration
`20261102000200_notification_idempotency.sql` and the legacy suppression
migration `20261102000300_legacy_notification_suppressions.sql` after the core schema. It adds
  and `20261102000400_updated_at_triggers.sql` to keep ordering accurate after upserts.
one unique reservation per result fingerprint and channel. The checker checks legacy suppressions and claims
a per-channel reservation before sending, then records sent/failed. Failed reservations
and reservations older than 10 minutes may be retried. This materially reduces
concurrent duplicate sends; no remote messaging provider can guarantee
exactly-once delivery if it accepts a message but the network response is lost.
The explicit `FORCE_NOTIFY=true` workflow input intentionally reclaims an
existing reservation and can send a duplicate by operator request. Failed
channels can be retried independently even if another channel already sent.

The GitHub JSON mirror remains the recovery copy. A failed mirror write causes
the checker run to fail rather than claiming a fully backed-up run.

## Cutover gates

Do not switch production reads/writes until all of these pass:

- The source SHA-256 and row counts are recorded.
- Every source result fingerprint exists exactly once with the same payload.
  Supabase may retain older database-only history; no rows are deleted to force
  a count match (175 source results at the last audit).
- Supabase catalog IDs and payloads match the source exactly (54 at the last audit).
- Every imported fingerprint exists exactly once.
- Every legacy result marked `sent` has a global suppression marker; no
  historical channel delivery is invented.
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
The workflow removes the plaintext dump before uploading. Configure these exact
GitHub Actions values before running **Supabase encrypted backup to private GitHub repository**:

- Repository secrets: `SUPABASE_DB_URL`, `BACKUP_REPO_TOKEN`,
  `BACKUP_ENCRYPTION_PASSPHRASE`.
- Repository variable: `BACKUP_REPOSITORY` in `owner/repository` format.

The backup token needs write access only to that private destination repository.
Keep the decryption passphrase in a password manager separate from GitHub. Never
place raw production dumps in the public application repository. Until these
values are configured and a backup plus test restore have passed, automated
database backup is not considered active.


## Restore a backup safely

1. Download a `.dump.gpg` file and its matching `.dump.gpg.sha256` file from the private backup repository.
2. Verify the encrypted file before decrypting:

```bash
sha256sum --check bombim00-YYYYMMDDTHHMMSSZ.dump.gpg.sha256
```

3. Decrypt into a protected local directory. GPG prompts for the passphrase:

```bash
gpg --output restore.dump --decrypt bombim00-YYYYMMDDTHHMMSSZ.dump.gpg
```

4. Restore to a separate test Supabase project first, never directly over production:

```bash
PGSSLMODE=require pg_restore --no-owner --no-acl --clean --if-exists --dbname "$TEST_SUPABASE_DB_URL" restore.dump
```

5. Verify table counts, latest result timestamps, settings, and notification idempotency.
   Only consider production recovery after an explicit review of the test restore.
6. Securely delete the plaintext dump after validation.

The checksum detects accidental corruption; GPG protects confidentiality. Keep the
GPG passphrase in a password manager separate from GitHub secrets and the backup
repository.
