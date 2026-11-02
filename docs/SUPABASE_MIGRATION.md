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

The importer sends modern `sb_secret_...` keys in the `apikey` header only; legacy service-role JWT keys are sent in both the `apikey` and server-side `Authorization: Bearer` headers. Never put the secret key in source control, browser code, logs, or chat.

## Read-only source parity verification

After the import, run the verifier from the repository root using the same
server-only Supabase environment variables:

```bash
python scripts/verify_supabase_migration.py
```

It compares the complete result fingerprint set and every JSONB payload,
catalog IDs and payloads, settings, system status, self-healing history, and
the import-batch SHA-256/counts. It is read-only and exits non-zero on any
mismatch. Do not enable either runtime feature flag unless this verifier
returns `"status": "verified"`. The same read-only check is available as the
manual GitHub Actions workflow **Verify Supabase migration parity**; run it
against this branch with the two Supabase secrets configured.

## Opt-in application integration (disabled by default)

The server adapter and Python checker now support Supabase behind separate,
explicit feature flags. Neither flag is enabled by this PR.

- Render: set `SUPABASE_STORAGE_ENABLED=true` only after the database import
  and validation gates pass. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
  as private Render environment variables. The API then reads results,
  catalog, settings, and status from Supabase; settings/catalog writes are
  committed to Supabase first and mirrored to GitHub JSON.
- GitHub Actions: set repository variable `SUPABASE_CHECKER_ENABLED=true`
  only after the same validation gates pass. Add `SUPABASE_URL` and
  `SUPABASE_SECRET_KEY` as Actions secrets. The checker reads settings and
  prior results from Supabase, writes results/status to Supabase, and retains
  the JSON files as a GitHub backup mirror.
- Both flags must remain false until the exact same project has the validated
  legacy import and the SQL migrations have been applied. If enabled but
  credentials or database access fail, the checker fails closed; it does not
  silently fall back to JSON and send duplicate alerts.
- The history cleanup API is deliberately blocked while Supabase is primary
  until a transactional maintenance RPC is available.

Apply the notification idempotency migration
`20261102000200_notification_idempotency.sql` after the core schema. It adds
one unique reservation per result fingerprint and channel. The checker claims
the reservation before sending, then records sent/failed. Failed reservations
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
