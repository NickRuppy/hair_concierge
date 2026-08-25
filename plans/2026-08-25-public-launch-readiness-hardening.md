# Public launch readiness hardening

## Outcome and source context

Chaarlie can accept the upcoming influencer promotion with an evidence-backed capacity envelope, a contained Supabase exposure, lower database-path latency, and a rehearsed operator response. This plan follows the 2026-08-25 read-only launch audit and the historical PostHog baseline:

- prior peak: 1,074 `/lp/haarplan` pageviews/day;
- prior peak hour: 152 landing pageviews, 61 quiz starts, and 27 leads;
- prior peak minute: 7 landing pageviews;
- current funnel capacity is not proven because the retained k6 script targets the legacy route and write path.

## Chosen direction

Use three separate release units in this order:

1. **Supabase containment hotfix:** preserve both backup tables and their rows, revoke all `PUBLIC`, `anon`, and `authenticated` privileges, enable RLS without public policies, verify service-role recovery access, and assess historical API access separately.
2. **Dublin function-region experiment:** add the version-controlled project default `"regions": ["dub1"]` in `vercel.json`, deploy a preview, verify actual execution in `dub1`, and promote only after current-funnel and provider smoke checks pass. This co-locates functions with Supabase `eu-west-1`; static assets remain globally served by Vercel.
3. **Current-funnel capacity rehearsal:** replace the legacy VU-only proof with arrival-rate scenarios against an isolated Vercel preview and Supabase branch, with real persistence behavior but no production Customer.io, Meta, Stripe, or PayPal side effects.

Task 1 is a standalone fast-track hotfix and must not wait for the region or load-test PR. Tasks 3–5 may share a later launch-readiness PR after containment is verified.

Do not pre-emptively upgrade Vercel or Supabase. Scale only if the 5x rehearsal breaches the agreed saturation or latency gates.

## Scope and non-goals

### In scope

- lock down `public.billing_subscriptions_backup_20260822` and `public.profiles_backup_20260822`;
- retain and verify the exact 119 and 66 backup rows during containment;
- search available access evidence without reading personal row contents;
- move Vercel Functions from `iad1` to `dub1` through repository configuration;
- align the deployed Node runtime with the repository's declared runtime before the final rehearsal;
- exercise `/lp/haarplan`, funnel sessions/events, Personal Plan draft persistence, preparation, lead capture, result return, and a bounded checkout smoke;
- verify the existing monitoring and alert-delivery path rather than rebuild observability;
- record a launch-day go/no-go receipt and rollback target.

### Non-goals

- dropping either backup table during containment;
- changing recommendation logic, German UI, pricing, billing semantics, or payment-provider identifiers;
- production stress testing or high-volume production writes;
- bulk load against live Stripe, PayPal, Customer.io, Meta, OpenAI, or Supabase production data;
- relaxing production rate limits without evidence of legitimate-user 429s;
- multi-region Vercel deployment or Enterprise failover configuration;
- unrelated Supabase advisor cleanup.

## Target map

- `supabase/migrations/*_lock_down_billing_backup_tables.sql`: idempotent containment migration for the two named backup tables.
- `vercel.json`: version-controlled `dub1` default region.
- `package.json` and Vercel project runtime settings: reconcile Node 22 repository declaration with the current Vercel 24.x setting; choose one supported version and prove identical local/preview builds.
- `scripts/k6/launch-flow.js`: current journey, arrival-rate profiles, endpoint tags, per-path thresholds, safe target guards, and test summary.
- `package.json`: retained launch commands mapped to the new profiles.
- `tests/package-scripts.test.ts` plus focused load-contract tests: protect command names, production guards, and traffic-profile constants.
- current funnel seams: `src/lib/funnel/client.ts`, `src/lib/personal-plan-quiz/server-draft-client.ts`, `src/app/api/quiz/personal-plan-prepare/route.ts`, and `src/app/api/quiz/personal-plan-lead/route.ts`.
- a small server-only load-test authorization seam, only if an isolated preview cannot exercise realistic writes without it. It must require `VERCEL_ENV=preview`, an explicit server environment flag, and a secret request value; production must reject it.
- `docs/runbooks/launch-stress-testing.md` and `docs/runbooks/launch-readiness-checklist.md`: current journey, thresholds, dashboards, stop conditions, rollback, and evidence receipt.

The existing automatic Git preview path is intentionally disabled for non-`main` branches in `vercel.json`. Use an explicit manual Vercel CLI preview deployment for Tasks 3–4; do not temporarily broaden automatic Git deployments.

## Designed operator and integration journey

There is no end-user UI or copy change.

1. The operator fingerprints both backup tables: existence, row counts, ACLs, RLS state, and service-role access.
2. After Nick approves the exact SQL, the operator applies only the containment migration. No rows are read, changed, copied, or dropped.
3. Verification proves row counts remain 119 and 66, `anon` and `authenticated` have no table privilege, RLS is enabled with no public policies, service-role recovery access remains, and the two critical advisor errors disappear.
4. The operator inspects the available API access window for the two table names. Absence of matching logs is recorded only for the observable period, never as proof that historical access did not occur.
5. A preview deployment runs functions in Dublin against a disposable Supabase branch. The ordinary Personal Plan journey behaves identically; if Dublin or a provider interaction regresses, the preview is discarded and production stays in `iad1`.
6. The operator runs smoke, 1x, 2x, 5x spike, and soak profiles. Normal users see no load-test traffic because the target is isolated. Provider adapters are absent, mocked, or in provider test mode; no real lead email, Meta conversion, or paid checkout is created.
7. A bounded production smoke confirms the promoted deployment and real mobile journey at human volume. Any threshold breach stops the launch and the recorded Vercel deployment is rolled back.
8. During promotion, the named operator watches the existing Vercel, Supabase, Sentry, PostHog, payment, and delivery signals. The promotion proceeds while gates remain green; otherwise the pre-agreed rollback or funnel pause is used.

Operator-journey sign-off: confirmed by Nick on 2026-08-25 with authorization to start implementation. Production apply, publication, and launch gates remain separate.

## Planning evidence

This is backend and operator-only work. No user-facing mockup is required because page hierarchy, copy, states, pricing, and interaction are unchanged. Evidence consists of live metadata, historical traffic, preview-region receipts, load summaries, and a manual production smoke.

Current containment fingerprint:

| Table                                   | Rows | RLS | `anon` ACL            | `authenticated` ACL   | `service_role` read |
| --------------------------------------- | ---: | --- | --------------------- | --------------------- | ------------------- |
| `billing_subscriptions_backup_20260822` |  119 | off | full table privileges | full table privileges | yes                 |
| `profiles_backup_20260822`              |   66 | off | full table privileges | full table privileges | yes                 |

No matching table-name request appeared in the Supabase API log window inspected on 2026-08-25; that connector exposed only the most recent 24 hours.

## Ordered tasks

### Task 1 — Contain the backup-table exposure

**Consumes:** the exact table names and fingerprint above.

Generate a migration through `supabase migration new`, then implement an idempotent guarded block that acts only when each exact relation exists. The approved production statements are semantically equivalent to:

```sql
revoke all privileges on table public.billing_subscriptions_backup_20260822
  from public, anon, authenticated;
alter table public.billing_subscriptions_backup_20260822 enable row level security;

revoke all privileges on table public.profiles_backup_20260822
  from public, anon, authenticated;
alter table public.profiles_backup_20260822 enable row level security;
```

Do not create public policies. Do not revoke `postgres` or `service_role`. Do not drop, truncate, update, or copy rows.

Add a static migration regression that proves both targets, all three revocations, RLS enablement, and the absence of row mutation/drop statements. Apply to production only after Nick explicitly approves the exact generated migration and fingerprint.

**Produces:** a repository migration plus a production receipt containing the before/after ACLs, RLS states, row counts, advisor result, executor, timestamp, and project ID.

**Completion criterion:** both row counts are unchanged; `has_table_privilege` is false for every table privilege for `PUBLIC`, `anon`, and `authenticated`; RLS is on; service-role read remains true; real anon Data API access is denied; the two `rls_disabled_in_public` errors are gone.

If the post-apply service-role verification unexpectedly fails, use the owner/postgres path to restore only the required `service_role` privilege and investigate. Never restore `PUBLIC`, `anon`, or `authenticated` access as rollback.

Task 1 production receipt (2026-08-25):

- Project: `pqdkhefxsxkyeqelqegq`; executor: Supabase migration API; recorded migration: `20260825082621_lock_down_billing_backup_tables`.
- Approved SQL SHA-256: `45ac69f192c4390c37dcf0c6bd418830a69cfc566a528b6c208e2ca776291736`; applied successfully before verification at `2026-08-25 08:26:40 UTC`.
- Rows remained `119` and `66`; RLS is enabled with zero policies; `PUBLIC`, `anon`, and `authenticated` have no CRUD privileges; `service_role` retained full CRUD privileges and read both exact counts under `SET LOCAL ROLE service_role`.
- Anonymous REST reads now return HTTP `401` / PostgreSQL `42501` for both tables. Security advisors report zero `ERROR` findings for the project; the two targets remain informational `rls_enabled_no_policy` entries by design.

### Task 2 — Bound the exposure assessment

**Consumes:** Task 1 containment timestamp and table names.

Search Supabase API/log-drain evidence for REST or GraphQL access to either table for the maximum retained window. Record the available time range, query terms, matching request metadata, and limitations. Do not query or export backup rows. Escalate only if access evidence exists or audit coverage is insufficient for the chosen incident threshold.

**Produces:** a private incident-assessment receipt; do not commit request metadata containing IPs or user identifiers.

**Completion criterion:** the observable period and result are explicit, and “no matches” is not presented as proof of no historical access.

### Task 3 — Co-locate functions with the database

**Consumes:** production `iad1`/Supabase `eu-west-1` evidence and Task 1 completion.

Capture at least 20 low-volume baseline samples for the dynamic landing and representative database-backed steps. Add top-level `"regions": ["dub1"]` to `vercel.json`; this is preferred over brittle per-route mapping because the landing render, funnel APIs, draft, prepare, lead, checkout, webhooks, and crons all depend materially on the same EU database. Align Node runtime settings so repository and Vercel builds use one supported major version.

Deploy a preview manually with the Vercel CLI and verify function execution reports `dub1`; automatic branch previews remain disabled. Run the current mobile happy path plus Stripe test-mode and PayPal sandbox preparation, webhook fixture tests, Customer.io no-op/test behavior, Meta no-op/test behavior, cron authentication, and database writes. Compare p50/p95 and error evidence to the baseline. Do not promote the region change until Task 4 passes.

**Produces:** a preview deployment receipt with reviewed SHA, observed region, baseline/comparison measurements, provider checks, and rollback deployment.

**Completion criterion:** actual execution is in Dublin; no current journey or integration regression appears; representative database-backed latency does not regress; rollback is one verified deployment promotion away.

### Task 4 — Rebuild the capacity proof around the current funnel

**Consumes:** the Dublin preview, isolated Supabase branch, historical arrival rates, and current endpoint contracts.

Keep the existing command names and map them exactly as follows:

| Command/profile              | Workload                       |
| ---------------------------- | ------------------------------ |
| `stress:smoke` / `smoke`     | one low-volume contract pass   |
| `stress:average` / `average` | historical 1x arrival rate     |
| `stress:spike` / `spike`     | sudden 2x burst                |
| `stress:safety` / `safety`   | 5x ceiling profile             |
| `stress:soak` / `soak`       | sustained 2x for 30–60 minutes |

Use arrival-rate executors and separate scenarios/tags:

- landing/session arrival;
- quiz milestones and realistic draft saves;
- prepare plus lead conversion;
- result return;
- bounded checkout preparation smoke.

The historical 1x target is 152 landing arrivals/hour with a 7/minute burst, 61 quiz starts/hour, and 27 leads/hour. Derive 2x and 5x directly from those values. Replace these values if the influencer supplies a higher credible forecast.

The current shared 20/hour per-IP bucket is consumed by both prepare and lead, so the current contract permits roughly ten full conversions per IP/hour. Do not weaken it merely for the test. Run writes against an isolated preview using a preview-only authenticated load seam or a runner topology that does not mistake one generator IP for all users. Add a separate same-IP legitimate-cohort check to make the carrier/office NAT tradeoff visible and an abuse scenario that proves production rate limiting still returns 429/503 as designed. Keep the production limit unchanged unless this evidence and the influencer traffic shape show a credible legitimate-user failure.

The rebuilt harness must fail closed when `K6_BASE_URL` is missing, when the target resolves to `chaarlie.de` or another production alias, or when the isolated-target acknowledgement is absent. Production supports only a separate human-volume smoke command/path that cannot enable writes. If a preview-only load authorization seam is required, all gates are AND-combined and default-off: `VERCEL_ENV=preview`, an explicit server flag, and a secret request value. Add named tests proving production rejects the seam and ordinary production rate limiting remains active.

Use endpoint-specific thresholds and abort conditions:

- zero lost or duplicate leads and zero unintended external side effects;
- critical checks at 100%; ordinary critical-path 5xx below 0.1%, abort above 1% for one minute;
- no 429 during ordinary modeled journeys; expected 429 in the abuse scenario;
- dynamic landing and critical APIs have recorded p50/p95/p99 separately, with no material p95 regression from the unloaded preview baseline;
- database connections remain below 75% of the verified target-environment ceiling; record production's currently observed 60-connection setting separately from the disposable branch's actual limit, with no sustained CPU/IO warning, lock wait, timeout, or PostgREST saturation;
- no Vercel function throttle, timeout, or unexpected firewall mitigation.

Run in order: smoke once, 1x twice, 2x twice, 5x spike twice, and a 30–60 minute 2x soak. Inspect Vercel, Supabase, Sentry, and PostHog between profiles. Stop on the first correctness or side-effect failure.

**Produces:** versioned test code and a transient run bundle. Commit the harness and updated runbook; archive the selected summary receipt outside the repository unless the PR intentionally includes a concise sanitized result.

**Completion criterion:** every profile is repeatable; 5x and soak pass without correctness errors or saturation; a failed threshold exits non-zero; the summary names the deployment, region, Supabase branch, rates, endpoint percentiles, errors, 429s, connections, and side effects.

### Task 5 — Rehearse the launch gate

**Consumes:** Tasks 1–4 receipts and the existing monitoring stack.

Verify rather than redesign monitoring: trigger one safe test notification through the actual Sentry/alert-delivery route, confirm Vercel firewall/runtime visibility, confirm Supabase database metrics and backup/PITR state, and confirm payment and Customer.io dashboards. Record one primary operator, one backup, the influencer publication window, the production deployment SHA, rollback deployment, and stop conditions.

Run one human-volume production mobile journey after deployment. Do not run production spike or soak profiles.

**Produces:** a dated go/no-go receipt and launch-day runbook.

**Completion criterion:** every dashboard and alert route is reachable, rollback is verified, the golden journey passes, no new high-volume error cluster exists, and Nick explicitly records go.

## Verification

### Automated

- focused migration-content regression;
- package-script contract test;
- focused route/unit tests for any preview-only load authorization seam, including a named proof that production rejects every bypass attempt;
- existing Personal Plan draft, prepare, lead, funnel, result-return, checkout, webhook, and rate-limit suites;
- typecheck, lint, production build, and repo-ready checks;
- k6 threshold exit status for every profile.

### Manual and browser

- mobile `/lp/haarplan` entry through result and offer on the Dublin preview;
- interrupted/resumed quiz draft;
- invalid email, prepare retry, lead failure, 429, and recovery behavior;
- one Stripe test-mode and PayPal sandbox preparation journey;
- one bounded production golden journey after promotion of the reviewed deployment.

### Migration and live-state

- exact pre/post row counts, ACLs, RLS, policies, service-role access, and security advisors;
- real anon Data API denial without displaying row contents;
- maximum-available log search receipt;
- production backup/PITR status and rollback deployment recorded.

### Evidence-sensitive review

- compare preview latency and capacity by deployment SHA and region;
- distinguish lab/load evidence from production field traffic;
- do not call missing logs evidence of no access;
- do not infer a required plan upgrade unless resource thresholds fail.

## Review and handoff

- Worktree: `.worktrees/public-launch-readiness` on `codex/public-launch-readiness`.
- Required sequence: counterpart plan review, Nick operator-journey sign-off, `implementation-loop`, `ready-check`, `request-code-review`, then explicit `ship-it` authorization.
- Production containment requires separate approval of the exact migration and fingerprint before apply.
- Task 1 containment ships as its own fast-track hotfix PR and production receipt. The region, harness, and runbook changes follow separately.
- Region deployment, production smoke, and launch go are separate gates from code merge.
- Artifacts: commit the plan, migration, harness, tests, and runbooks; keep sensitive access assessment private; archive selected sanitized test receipts; discard raw load output after extracting the reviewed summary.
- Stop point: this plan authorizes no production mutation, deployment, stress test, commit, push, PR, merge, or launch activation.

## Counterpart findings ledger

| ID  | Type     | Evidence                                                         | Decision             | Plan change                                                                | Revalidation                                         |
| --- | -------- | ---------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| C1  | defect   | non-`main` automatic previews are disabled in `vercel.json`      | accepted             | require a manual Vercel CLI preview                                        | verify preview URL and `dub1` execution              |
| C2  | defect   | package-script tests pin five legacy profile names               | accepted             | map those names to smoke/1x/2x/5x/soak exactly                             | package-script contract test                         |
| C3  | defect   | current harness defaults to production                           | accepted             | hard refuse production targets and missing target acknowledgement          | named fail-closed harness tests                      |
| C4  | defect   | preview bypass could become a production authorization surface   | accepted             | triple AND gate, default-off, production-rejection test                    | focused route/unit tests                             |
| C5  | tradeoff | Task 1 could be delayed behind the larger branch                 | accepted             | standalone fast-track containment PR                                       | separate receipt before Tasks 3–5                    |
| C6  | tradeoff | shared per-IP bucket allows about ten full conversions/hour/IP   | deferred to evidence | same-IP legitimate cohort plus abuse scenario; no pre-emptive limit change | review 429 evidence against influencer traffic shape |
| C7  | defect   | branch connection limit may differ from production's observed 60 | accepted             | discover and record each target ceiling                                    | threshold receipt names actual limit                 |
