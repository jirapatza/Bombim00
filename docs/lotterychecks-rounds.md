# LotteryChecks missing-round fallback

Provider documentation: https://lotterychecks.com/developers
Attribution: [LotteryChecks](https://lotterychecks.com).

The existing government-only adapter remains unchanged. A separate fallback now
queries `lao-union` (catalogue `lao_samakki`) and `hanoi-develop`
(`hanoi_patthana`) independently of whether other lottery feeds returned results.
It follows the existing `sources.lotterychecks.enabled` setting. Disabling that
setting disables both LotteryChecks adapters.

Each request uses `/api/public/results?lottery=SLUG&date=YYYY-MM-DD&limit=1` with
the current Asia/Bangkok date. At most two requests run concurrently, each with a
10-second timeout. A complete existing result for that round/date has priority.
The provider documents a 120 request/minute/IP limit and a 300-second CDN cache;
this fallback does not guarantee immediate notification or bypass Actions delays.

Accepted data must have `success: true`, the exact requested `lottery` slug,
today's `drawDate`, `status: complete`, no pending prizes, and explicit named
`3 ตัวบน` and `2 ตัวล่าง` prize entries with exactly one string of three and two
ASCII digits respectively. The numbers are never derived from a full prize.
Unknown prize labels/schema, partial draws, older/future dates, conflicting
records, request failures and invalid JSON leave the round missing and log a
warning. One failing request does not erase another round's valid result.

## Verification boundary

Initial development-environment requests returned HTTP 403, so a separate
read-only GitHub Actions contract probe was added. On 2026-11-03 at 22:36 Bangkok,
[run 41665575560](https://github.com/jirapatza/Bombim00/actions/runs/41665575560)
received HTTP 200 for both endpoints, each with today's date, complete status,
explicit `three-digit-top` / `two-digit-bottom` prizes named `3 ตัวบน` /
`2 ตัวล่าง`, and no pending prizes. Both responses passed the production parser.
The reported results were Lao Samakki 853 / 08 and Hanoi development 910 / 09.
These are provider-reported values, not independently certified official results.
The public responses are saved as a regression fixture alongside synthetic
edge-case tests; the fixture is never loaded into runtime history.

The probe workflow runs only for relevant pull-request changes or a manual
request. It has read-only repository permissions, no notification credentials,
and does not dispatch alerts, deploy code, or write runtime data. An unavailable
endpoint or invalid contract fails the check rather than silently passing.
Subsequent probe runs request the latest draw so a legitimate pre-draw lack of
today's results does not create a false failure. The probe reports whether that
draw is today's; the production fetcher continues to reject all older dates.

After owner approval and deployment, verify the regular checker ingests both
rounds and preserves delivery deduplication. That production rollout check is
separate from the successful read-only API contract check. No historical
notification records are changed by this patch and no test notifications are sent
during verification.

Rollback: revert this PR. To stop all LotteryChecks requests immediately, disable
`sources.lotterychecks.enabled` through the existing settings mechanism.
