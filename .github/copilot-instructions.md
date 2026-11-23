# Working in this repository

`AGENTS.md` is the authoritative rulebook. Read it first; this file only adds the
details an assistant needs to start work without guessing.

## What runs where

| Part | Location | Role |
| --- | --- | --- |
| Dashboard | `src/` | React 19 + TypeScript + Vite + Tailwind |
| Checker and notifier | `cloudflare/src/` | Cloudflare Worker, D1, Web Push — this is production |
| Legacy checker | `lottery_checker.py` | PR tests only (`legacy_workflow: pr-only`), never production |
| Reviewed code | `main` | Source of truth for code |
| Live data | `runtime-live` | JSON data only; never execute code from it |

## Before editing

1. Read the files involved. Do not infer behaviour from a name or a comment.
2. Prove the defect exists. If the behaviour turns out to be correct, report it
   and change nothing — several "bugs" here are deliberate (for example a 404 from
   a results API means "no draw for that date yet", not a broken endpoint).
3. Change the smallest amount that fixes the request. No drive-by refactors.

## Merging

`AGENTS.md` → `## Merge policy` defines the two categories. In short:
documentation, tests, lint and dependency changes may merge once CI is green;
everything under `cloudflare/src/`, the Python entry points, `.github/workflows/`,
`config/settings.json`, runtime data and the guard files waits for owner approval.

## Verification commands

```bash
npm run lint                 # tsc --noEmit
npm test                     # web tests
npm run build                # tsc + vite build
(cd cloudflare && npm test)  # worker tests
python -m pytest -q          # python tests
npm run preview -- --host 127.0.0.1 &   # browser smoke needs a server
npm run test:browser
```

Report real numbers from these commands. Never describe a change as done while a
test is failing.

## Non-negotiables

- Never push to `main`; every task starts on a new branch.
- Never merge with red CI, and never remove a check to make a run pass.
- Never fabricate lottery results, rewrite notification history, or weaken auth.
- Never write runtime data outside the allowlist in `AGENTS.md`.
- Never put credentials, tokens or private keys in source, logs or pull requests.

## Writing style

- Answer in Thai when the user writes Thai.
- Lead with the conclusion, then the detail.
- Use a table when comparing several items.
- State plainly what was done, what is blocked by permissions, and what the owner
  must do in a dashboard. A 403 or 404 from an API is a permission answer, not a
  reason to guess.
