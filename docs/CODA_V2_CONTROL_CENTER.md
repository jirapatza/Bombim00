# Bombim00 V2 Control Center (Coda)

Coda is an optional control and evidence surface. It is not a lottery provider,
does not hold push subscriptions, and is never allowed to edit result numbers,
credentials, or delivery history. If Coda is unavailable, the Worker retains the
last applied controls and continues its normal checker cycle.

## Document schema

Create one private document named `Bombim00 V2 Control Center` and invite only
the owner and a dedicated service account. The column names below are part of
the Worker contract and must be exact.

### Lotteries

| Column | Type |
| --- | --- |
| Lottery ID | Text, unique |
| Name | Text |
| Draw Date | Date |
| Status | Select: verified, waiting_for_evidence, conflict |
| Source Count | Number |
| Sources | Text |
| Top 3 | Text |
| Bottom 2 | Text |
| Updated At | Date/time |

### Verification Runs

| Column | Type |
| --- | --- |
| Draw Key | Text, unique |
| Lottery ID | Text |
| Draw Date | Date |
| Status | Select: verified, waiting_for_evidence, conflict |
| Source Count | Number |
| Sources | Text |
| Updated At | Date/time |

### Control Requests

| Column | Type |
| --- | --- |
| Action | Select using the allowlist below |
| Target | Text |
| Desired Value | Text |
| Evidence | Text |
| Status | Select: requested, applied, rejected |
| Requested At | Date/time |
| Expires At | Date/time |
| Result | Text |

Every button adds a new row with `Status=requested`, `Requested At=Now()` and
`Expires At=Now()+Minutes(5)`. The Coda row ID is the idempotency key. Never
reuse an old row by changing its Status back to requested.

Allowed actions:

- `pause_all`, `resume_all`
- `quarantine_lottery`, `unquarantine_lottery`
- `disable_source`, `enable_source`
- `run_probe`, `send_test_push`
- `retry_failed_delivery`
- `resolve_uncertain_sent`, `resolve_uncertain_failed`

Uncertain-resolution buttons must remain disabled until Evidence contains at
least five characters. The Worker still checks this rule and rejects unsafe
requests. There is intentionally no force-send, result-edit, secret-edit,
history-delete, or bypass-consensus action.

### Incidents

| Column | Type |
| --- | --- |
| Incident Key | Text, unique |
| Type | Select: result_conflict, unmapped_evidence |
| Lottery ID | Text |
| Draw Date | Date |
| Details | Text |
| Status | Select: open, resolved |
| Updated At | Date/time |

## Worker configuration

Apply migration `0003_v2_control_evidence_receipts.sql` before deploying the
code. Create a dedicated Coda API token for the service account; do not reuse
the Codex/Coda connector credential. Store these values as Worker secrets:

```text
CODA_API_TOKEN
CODA_DOC_ID
CODA_CONTROL_TABLE_ID
CODA_LOTTERIES_TABLE_ID
CODA_VERIFICATION_TABLE_ID
CODA_INCIDENTS_TABLE_ID
WEB_PUSH_RECEIPT_SECRET
```

`WEB_PUSH_RECEIPT_SECRET` must be a random value of at least 32 characters.
Never put any value above in Coda rows, Git, logs, screenshots, or `/health`.

The Worker reads at most five new control rows per cycle and syncs the three
dashboard tables at most once every five minutes. A failed acknowledgement does
not reapply a command because D1 is authoritative. Coda API failures appear as
a degraded sync status while result collection continues.

## Safe rollout

1. Deploy with `verification.mode=shadow`; apply the D1 migration and receipt
   secret, but leave all Coda IDs unset.
2. Verify `/health`, D1 usage, receipt acknowledgements, and source coverage.
3. Configure the private Coda document and IDs. Test `pause_all`, then
   `resume_all`, one lottery quarantine, and one test push.
4. Keep shadow mode until every catalog item has two genuinely independent
   providers. Same-provider mirrors do not count twice.
5. Change runtime settings to `verification.mode=enforce` only after owner
   approval. Results with one source or any conflict then remain unsent.

Rollback by removing the Coda IDs (disables sync), returning verification to
shadow, and reverting the reviewed PR. Do not delete D1 tables or rewrite old
uncertain delivery records.
