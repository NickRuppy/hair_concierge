# Public launch readiness hardening

## Outcome

Prepare Chaarlie for the influencer launch with contained Supabase backup tables, lower database-path latency, strict read-only health checks, and a rehearsed monitoring and rollback gate. The evidence must distinguish current health from capacity proof.

Historical PostHog envelope recorded on 2026-08-25:

- prior peak: 1,074 `/lp/haarplan` pageviews/day;
- prior peak hour: 152 landing pageviews, 61 quiz starts, and 27 leads;
- prior peak minute: 7 landing pageviews.

## Final chosen direction

1. Contain the two exposed Supabase backup tables without deleting or changing their rows.
2. Align Vercel with Node 22 and pin Functions to Dublin (`dub1`) beside Supabase `eu-west-1`.
3. Use historical traffic, unloaded production baselines, a one-iteration read-only smoke, existing monitoring, and a pre-recorded rollback target for this launch.
4. Record capacity as **not fully load-proven**. Do not run synthetic writes, deliberate limiter traffic, spike traffic, or soak traffic against production.

Supabase preview-branch creation was attempted after approval but rejected because the production organization is on the Free plan and preview branching requires Pro. No paid branch was created and no Supabase data changed during the attempt. Nick chose the simpler production path instead of upgrading or repurposing the unrelated inactive project.

Consequently, this change removes the preview-only authorization seam and every write/provider/checkout mode from the k6 harness. It does not give a Vercel preview production Supabase credentials. A materially higher influencer forecast reopens the isolated-environment decision before launch.

Accepted residual risk: database write saturation, shared-IP contention, and 2x/5x capacity are not experimentally proven. This is an explicit scope tradeoff, not a passed load-test claim.

## Scope

### In scope

- retain the already-reviewed Supabase containment migration and production receipt in its standalone PR;
- align the Vercel project runtime and repository runtime on Node 22;
- set top-level `"regions": ["dub1"]` in `vercel.json`;
- preserve the five familiar non-production profile commands while making their harness read-only and fail-closed;
- add a separate exact-status, one-iteration production smoke;
- document historical evidence, limitations, stop conditions, monitoring, and rollback ownership;
- verify that no preview load-test authorization surface remains in production routes.

### Non-goals

- a Supabase plan upgrade or second environment;
- reusing or restoring the unrelated inactive Supabase project;
- Vercel preview access to production Supabase credentials;
- production stress testing or synthetic production writes;
- Customer.io, Meta, Stripe, PayPal, or OpenAI load traffic;
- changing recommendation logic, German UI, pricing, billing semantics, or production rate limits;
- multi-region Vercel deployment or observability redesign;
- merge, production deployment, or launch activation in the code-publication step.

## Release units and evidence

### 1. Supabase containment hotfix

The standalone containment PR is [#464](https://github.com/NickRuppy/hair_concierge/pull/464). It preserves both backup tables, revokes `PUBLIC`, `anon`, and `authenticated` privileges, enables RLS without public policies, and retains owner/service-role recovery access.

Production receipt from 2026-08-25:

- project `pqdkhefxsxkyeqelqegq`;
- migration `20260825082621_lock_down_billing_backup_tables`;
- SQL SHA-256 `45ac69f192c4390c37dcf0c6bd418830a69cfc566a528b6c208e2ca776291736`;
- rows remained 119 and 66;
- RLS enabled with zero policies;
- `PUBLIC`, `anon`, and `authenticated` lost CRUD privileges;
- `service_role` retained access and verified both counts;
- anonymous REST reads return HTTP 401 / PostgreSQL 42501;
- zero Supabase security-advisor `ERROR` findings after apply.

The inspected Supabase API-log window covered only the most recent 24 hours and contained no matching table-name request. That is not proof of no earlier access.

### 2. Runtime and region hardening

The Vercel project was changed from Node 24.x to Node 22.x, matching `.nvmrc` and the repository engine contract; project inspection confirmed Node 22.x. This setting change did not deploy a release.

`vercel.json` adds the pending Dublin default. Actual `dub1` execution can be proven only after the reviewed configuration is deployed. Deployment and promotion are separate gates.

The first draft-PR push exposed that Vercel's existing `"*": false` rule did not match the namespaced `codex/...` branch. The resulting Preview was SSO-protected, received no authenticated application traffic, and proved its functions were built in `dub1`, but it inherited Preview-scoped production service variables and is not an eligible staging target. Replace the branch fallback with `"**": false`, verify the next namespaced push is skipped, and remove that exact Preview deployment after recording the receipt.

Twenty sequential production read-only samples established an unloaded comparison point:

| Target                                       | Status         |    p50 |    p95 |      p99 |
| -------------------------------------------- | -------------- | -----: | -----: | -------: |
| `/lp/haarplan`                               | 20/20 HTTP 200 | 207 ms | 356 ms | 1,140 ms |
| nonexistent `/result/<uuid>` database lookup | 20/20 HTTP 404 | 401 ms | 664 ms | 1,313 ms |

These samples prove route health and provide a latency reference; they do not prove concurrent capacity.

### 3. Read-only traffic tooling

`scripts/k6/launch-flow.js`:

- requires an explicit HTTPS non-production target and exact acknowledgement;
- refuses `chaarlie.de`, `www.chaarlie.de`, and all `*.chaarlie.de` aliases;
- uses `constant-arrival-rate` profiles for GET-only `/lp/haarplan` traffic;
- contains no POST, load secret, authorization header, provider mode, or application write path.

The retained command names model 1/minute smoke, historical 152/hour, 2x, 5x, and sustained 2x landing reads. They are future non-production tools, not required launch receipts, because no eligible isolated target currently exists.

`scripts/k6/production-smoke.js` is separate: one iteration, read-only, exact expected statuses, and an explicit human-volume acknowledgement. It cannot select the non-production profiles.

### 4. Launch-day gate

Before GO, record:

- primary and backup operator;
- influencer publication window and forecast;
- reviewed production Git SHA and Vercel deployment;
- verified rollback deployment;
- visibility of Vercel, Supabase, Sentry, PostHog, payment, and Customer.io signals;
- one safe Sentry alert-delivery proof;
- one human-volume mobile golden journey;
- explicit acceptance that write capacity and 2x/5x capacity are not load-proven.

Run the one-iteration production smoke once before launch and once after the reviewed Dublin deployment. Verify actual function execution in `dub1` after deployment. Stop and roll back on the runbook conditions; production data repair is never implied by rollback.

## Verification contract

### Before code publication

- focused test proves `vercel.json` pins `dub1`;
- focused test proves the non-production harness has no production default, POST, write flags, load authorization, write endpoints, or provider modes;
- focused test proves all three Personal Plan write routes contain no preview load-test authorization seam;
- focused test proves production smoke is read-only and uses exact expected statuses;
- package-script test protects the five retained profile commands and separate production smoke;
- `k6 inspect` succeeds for all read-only non-production profiles against a fake safe host;
- fail-closed inspection rejects missing target, missing acknowledgement, and production aliases;
- current production one-iteration smoke passes as a pre-deployment health check;
- relevant route regression tests, typecheck, lint, and production build pass;
- a high-effort whole-tree Claude review finds no unresolved blocker.

### After later production deployment

- reviewed SHA matches the deployed SHA;
- Node 22 and actual `dub1` execution are observed;
- exact production smoke and one manual mobile golden journey pass;
- rollback deployment and all operator fields are complete;
- Nick explicitly records GO.

## Stop and reopen conditions

Do not launch on this reduced proof if the forecast materially exceeds the historical envelope, the golden journey fails, dashboards or alert delivery are unavailable, or the rollback target is not verified. Reopen isolated staging/load work if forecast, product scope, or live monitoring suggests higher write-path risk.

## Review and publication boundaries

- Task 1 branch: `codex/public-launch-readiness`, draft PR #464.
- Runtime/runbook branch: `codex/public-launch-load-readiness`, currently stacked on the reviewed Task 1 commit until PR #464 merges.
- Nick approved implementation and later selected the simpler production path.
- Counterpart plan review at high effort initially approved the isolated design with hardening suggestions; the final pivot review required full removal of the superseded write-load machinery. That removal is incorporated here.
- `ship-it` means commit, push, and draft PR only. Merge, deployment, post-deploy verification, and launch GO remain separate approvals/gates.
