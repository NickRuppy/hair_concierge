# Personal-plan Customer.io profile sync hardening

## Outcome and source context

Replay and adjust PR #292 at reviewed head `a2dc5f4b9c343336ccf39c79f5cd12e9bc398f50` onto refreshed `origin/main` `056f595452be0a57149cc852519965a2c975b2dc` so Personal Plan quiz profiles are projected reliably from Supabase into Customer.io, historical leads can be enriched without entering an email campaign, and future completion events are retryable without blocking quiz completion.

Nick approved these product decisions on 2026-08-01:

- backfill historical profiles but do not email them;
- keep the seven-day date as Customer.io marketing presentation logic, not persisted application state;
- accept delayed delivery while failed Customer.io calls retry durably.

## Chosen direction

Supabase remains authoritative. A dedicated `customerio_profile_sync_outbox` row references each Personal Plan lead and records retry state without duplicating profile answers or derived marketing dates. Only genuinely new leads inserted after the outbox exists are event-eligible. A consented eligible lead requests both an identify/profile delivery and one stable `personal_plan_profile_submitted` event; a later consent change from false to true can request that event once. Updates request another identify delivery but never reset an already delivered completion event. Historical backfill and later updates to historical rows remain profile-only.

Delivery reloads the lead and its canonical funnel attribution from Supabase. It sends a documented, versioned Customer.io trait projection with no free text and no server-computed `plan_expires_at`. Customer.io derives display-only plan identifiers and seven-day marketing dates from `lead_id` and `personal_plan_completed_at`.

## Scope and non-goals

In scope:

- durable lead-profile delivery and bounded retries;
- a profile-only historical backfill;
- a dedicated future-lead completion event;
- canonical Personal Plan trait names/types, consent and funnel attribution;
- migration, focused tests, data-contract documentation, retry endpoint/script;
- preserve and review the co-founder's existing early email CTA change.

Non-goals:

- no live Customer.io campaign/template mutation or activation;
- no email copy/layout changes beyond the pre-existing PR change;
- no database column or trait for `plan_expires_at`;
- no live data migration or backfill execution;
- no commit, push, PR update, merge, deployment, or production write in this implementation pass.

## Target map

- `src/lib/personal-plan-quiz/customerio.ts`: pure trait projection and Customer.io identify/event delivery.
- `src/lib/personal-plan-quiz/customerio-outbox.ts`: enqueue, claim, dispatch, retry and delivery state.
- `src/app/api/quiz/personal-plan-lead/route.ts`: defer exact-lead dispatch after authoritative persistence and attribution.
- `src/app/api/customerio/profile-sync/reconcile/route.ts` and `vercel.json`: authenticated retry worker.
- `scripts/backfill-personal-plan-customerio.ts`: enqueue historical profile-only deliveries and truthful accounting.
- `supabase/migrations/*customerio_profile_sync_outbox.sql`: durable state, RLS, trigger and service-role grants.
- `docs/customerio-data-contract.md`: exact Personal Plan fields, event and derivation boundary.
- focused tests under `tests/` for projection, route/outbox state transitions, migration safety and backfill behavior.

## Designed user journey

This is backend/integration work; no new end-user surface, email layout, copy, timing promise, or feedback state is introduced, so no mockup is required.

Confirmed integration journey:

1. A person completes the Personal Plan quiz; the lead and prepared artifact are saved in Supabase.
2. The same database transaction creates a pending profile-sync outbox row.
3. Funnel attribution is attached, then deferred work attempts the exact outbox row.
4. Customer.io receives the current structured profile and canonical attribution. It receives no raw free text and no persisted marketing-expiry date.
5. For a consented lead, Customer.io receives one stable completion event. A later consent change from false to true can request it once. Campaign configuration must additionally require `marketing_consent = true`, allow one entry, and disable re-entry as the final duplicate-email safeguard.
6. If Customer.io or the deferred task fails, the quiz response remains successful and the outbox records a retry. The authenticated worker retries due rows.
7. Historical backfill creates profile-only rows. It cannot emit the completion event and therefore cannot enter the new event-triggered campaign through this integration. Before live execution, the operator must audit active attribute- and segment-triggered campaigns and pass the explicit campaign-safety confirmation flag.
8. Customer.io computes any seven-day display date from `personal_plan_completed_at`; this does not control application access.

Nick explicitly confirmed this journey on 2026-08-01.

## Mockup evidence

Not required. The implementation changes integration behavior only. The existing result-email CTA added by the co-founder is preserved as pre-existing PR scope and will be covered by the whole-branch review and existing template tests.

## Ordered tasks

1. Add failing focused tests for canonical traits, absence of derived expiry, stable identify/event IDs, profile-only backfill, and retry state transitions. Complete when old PR behavior fails the new guards for the intended reasons.
2. Add the outbox migration and trigger. Complete when new Personal Plan lead inserts enqueue event-capable rows, later updates do not reset a delivered event, and service-role/RLS boundaries are explicit.
3. Implement pure trait projection and outbox delivery. Complete when delivery reloads Supabase truth, identifies before event delivery, records success/failure, retries safely, and excludes free text and derived expiry.
4. Wire the lead route and retry surfaces. Complete when the route defers exact-lead dispatch without making Customer.io availability part of quiz success, and the authenticated reconcile endpoint plus CLI can process due rows.
5. Replace the direct-write backfill with profile-only enqueueing and accurate results. Complete when dry-run writes nothing, live mode never requests an event, failed database operations are counted, and reruns are idempotent.
6. Update the Customer.io data contract and focused fixtures. Complete when the documented fields/events/derivations match emitted payloads and campaign consent/backfill safeguards are explicit.

## Verification

Automated:

- focused Personal Plan Customer.io projection/outbox/backfill/migration/route tests;
- existing Personal Plan persistence tests;
- existing Customer.io server and template tests;
- TypeScript and repository quality gates required by `ready-check`.

Manual/read-only:

- inspect the exact `origin/main...HEAD` diff and canonical content fingerprint;
- confirm no `plan_expires_at` application persistence or trait remains;
- confirm the backfill path cannot create or reset completion-event delivery;
- confirm no live Customer.io, Supabase, deployment or email send occurs.

## Review and handoff

- Worktree: `.worktrees/pr292-customerio-adjustments-main`
- Branch: `codex/pr292-customerio-adjustments-main`, based on refreshed `origin/main` `0d29b871` with the three PR #292 changes replayed as task-owned working-tree content.
- Mockup review: not applicable for backend-only adjustments.
- Integration-journey sign-off: confirmed 2026-08-01.
- Required gates: counterpart plan review, `ready-check`, whole-branch `request-code-review`, including structural review because this adds durable workflow state.
- Artifacts: plan, code, migration, docs and tests are intended for commit; transient counterpart output is discarded from the repository.
- Stop point: verified local review-ready branch, before commit or push.

## Verification receipt

- Final ship refresh moved the branch onto `origin/main` `056f595452be0a57149cc852519965a2c975b2dc` on 2026-08-01 after PR #294 merged; its payment-observability files did not overlap this task's implementation files.
- Focused integration, middleware, template and persistence suite: 61 tests passed.
- Full Node suite: 2,351 tests passed, 0 failed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run lint`: passed with four pre-existing warnings and no errors.
- `npm run build`: passed, including TypeScript and all 93 static pages; the reconciliation route is present in the route manifest.
- `git diff --check`: passed.
- Mobile-width email preview: the co-founder's early text CTA is visible before the diagnostic cards without overflow; the local preview could not resolve the production-root comparison-image path, so image content was not revalidated in that preview.
- Structural review fixes incorporated: protected-cron middleware exemption, optimistic delivery finalization for concurrent profile changes, revisioned identify message IDs, one-entry campaign guidance, and an explicit campaign-safety gate for live backfill.
- Migration SQL received static contract review and migration safety tests. It was not executed locally because Docker/Supabase local services were unavailable; normal migration-environment validation remains required before production application.
- The required Claude counterpart plan/review lane was attempted read-only but unavailable because the local Claude account had reached its session limit. No counterpart verdict is claimed.
- Customer.io release dependency: replace the existing `quiz_kind` / Segment 21 automation entry with `personal_plan_profile_submitted`; the old and new entry paths must not be active together for new leads.
- Vercel release adjustment: normal delivery remains immediate best-effort, while the fallback retry cron runs once daily (`30 3 * * *`) to stay within the current Hobby plan. A manual retry command remains available for urgent recovery.
