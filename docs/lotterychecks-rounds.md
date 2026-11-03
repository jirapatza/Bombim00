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

The automated tests are synthetic contract fixtures, not recorded live responses.
Public documentation lists both slugs and the generic envelope/prize structure.
During preparation, live JSON requests from the development environment returned
HTTP 403 and the web retrieval tool could not retrieve those endpoints. Therefore
live availability and the exact prize labels for these two rounds remain
unverified. This change must not be represented as confirmed live coverage until
the endpoints are validated from the production runner. If the names differ, the
adapter will deliberately reject the result rather than guess a prize mapping.

Before final rollout verification, inspect both public responses from the runner,
confirm schema/date/prizes against the provider's corresponding result pages,
and confirm normal deduplication. No historical notification records are changed
by this patch and no test notifications are sent during verification.

Rollback: revert this PR. To stop all LotteryChecks requests immediately, disable
`sources.lotterychecks.enabled` through the existing settings mechanism.
