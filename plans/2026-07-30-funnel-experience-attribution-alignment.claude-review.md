I have enough grounding across the schema, RPC, destinations, dashboard, and provider metadata. Here is the review.

---

**Verdict:** Approve with revisions — one migration blocker must be fixed and four scope/shape decisions belong to you, not the executing subagent. The analytics core of the plan is well-grounded; the risk concentrates in Task 3 (the RPC signature change) and in bundling a production migration with an already-loaded branch.

---

### Lean shape

- **Irreducible goal:** make a confirmed purchase queryable in PostHog by the funnel experience that produced it, without expanding Stripe/PayPal metadata. Supabase stays authoritative.
- **The headline outcome does not need the migration.** `funnel_sessions` already stores immutable `landing_variant` and `offer_variant` (`supabase/migrations/20260711120000_funnel_attribution.sql:11-12`, preserved-on-conflict at `:212-224`), and the server purchase event already carries `funnel_session_id` + `funnel_package_key` (`src/app/api/stripe/webhook/route.ts:159-160`, `src/lib/paypal/webhook-handlers.ts:461-462`). So Task 4's enrichment and Task 5's dashboard alignment can ship on the columns that exist today. `quiz_variant` (Tasks 2/3/6) is the *only* piece that requires a migration + backfill + NOT-NULL + contributor governance.
- **`quiz_variant` is future-proofing as written.** Quiz identity is 1:1 with `landingVariant` in every current package: `landing=default` → shared legacy quiz, `landing=personal-plan-quiz` → personal-plan quiz (`src/funnels/packages.json:1-34`, `src/funnels/landing/personal-plan-quiz.tsx:1`). No package reuses one quiz across landings, and the plan explicitly ships no quiz allocator (Task 4 journey, line 162). The justification ("multiple quiz flows can run concurrently") is a hypothetical, not a current caller.
- **Two Task-1 items are near-redundant.** `docs/analytics/offer-page-tracking.md:246` already says "Do not use `offer_revision` as a schema-version substitute," and `docs/funnel-attribution.md:10` already documents landing/offer as immutable snapshots. The Task 1.3 "UTM cannot select a package" guard asserts a property that is already structurally true — no code path maps UTM → package; UTM lives only in `first_touch` (`src/lib/funnel/server.ts:368-381`).
- **Hard tradeoff the plan is avoiding:** whether the production migration (highest-risk, needs prod-write gates) should ride the same branch as the in-flight payment-option/dashboard work (16 files already modified per `git status`). The plan defers the decision ("should remain in that reviewable branch unless Nick explicitly splits it," line 324-326) instead of making it.

### Prior art

- **Add-column migration** → canonical expand→backfill→contract. Plan follows add-nullable → backfill → NOT-NULL (Task 3.1). OK. **Missing invariant:** the function-signature change. This repo's own precedent is `DROP FUNCTION IF EXISTS` before recreate whenever a function's arg list changes (`supabase/migrations/20260503143000_add_currency_to_match_products.sql:1`, `20260612120000_product_identity_normalization.sql:190`, and 6 others). Task 3 does not mention it — see Blocker 1.
- **Multi-destination analytics enrichment** → resolve at the destination, not centrally. Task 4 resolves the snapshot inside the PostHog destination (which already receives `input.supabase`, `src/lib/billing/analytics-destinations/types.ts:16`). Matches the canonical shape. Idempotency on the revenue event is preserved via `event_key` (Task 4.4). OK.
- **Snapshot-vs-race:** the session row exists from the first browser milestone, long before purchase, so the PostHog read never races the `funnel` destination's purchase write. Sound.

### Blockers (will regress as written)

1. **Adding `p_quiz_variant` via bare `CREATE OR REPLACE` breaks the RPC.** — `supabase/migrations/20260711120000_funnel_attribution.sql:99-119, 296-304`. The current function has exactly 20 positional params with a matching `REVOKE`/`GRANT`. `recordFunnelEventWithRpc` calls it with **named** args via PostgREST (`src/lib/funnel/server.ts:277-298`). Adding a 21st defaulted param does not "replace" the function — it creates a second overload, and a 20-named-arg call then becomes ambiguous → PostgREST `PGRST203 / "function is not unique"` → **all funnel event recording fails**. Fix: `DROP FUNCTION IF EXISTS public.record_funnel_event(<old 20-arg signature>)` first, recreate with 21 args, and re-issue `REVOKE`/`GRANT` for the new signature. Note the migration tests are pure text-regex (`tests/funnel-migration.test.ts:5,36-40`) and will **not** catch this — it only surfaces against a real DB.

2. **Migration-vs-code deploy ordering is unspecified and will regress.** — Task 3.2 has `recordFunnelEventWithRpc` pass `p_quiz_variant`, but Task 6.3 defers migration application to "a later shipping session." If the branch's code deploys before the migration is applied, every RPC call sends an unknown `p_quiz_variant` → error → funnel recording stops. The plan must state migration-applied-before-code (or make the caller omit the arg until the column exists). This is the classic expand/migrate/contract ordering the plan gestures at but never sequences.

### High-confidence issues (correctness, not preference)

- **The SQL backfill cannot read `packages.json`.** Task 3.1's "backfill from package identity" must be a hardcoded `CASE` in the migration covering *every distinct `package_key` present in production*, including `placeholder`/`archived` keys, or the NOT-NULL apply fails. Task 6's preflight is what validates the key set — but it runs *after* Task 3 authors the migration, so the CASE can't be finalized until the preflight runs. Call out this coupling and gate the NOT-NULL step on the preflight result.
- **Task 5.5 can silently drop historical purchases.** The current dashboard attributes purchase purely by session membership (`scripts/analytics/personal-plan-offer-dashboard.ts:32,35,38` — no `offer_revision`/`offer_variant` guard on purchase, already correct). Task 5.5 ("join purchase through resolved canonical package/landing/quiz/offer properties") is ambiguous: if a subagent reads it as a hard `offer_variant = 'personal-plan-v1'` filter on `purchase_completed`, every purchase recorded *before* Task 4 enrichment ships lacks that property and disappears from the dashboard. The plan forbids filtering purchase by `offer_revision` (Task 5.7) but is silent on `offer_variant`. State explicitly: purchase stays joined by session membership; canonical props are additive, never a hard filter on purchase rows.
- **Naming transposition risk.** `offer_revision = 'personal_plan_v1'` (underscore, `src/components/personal-plan-offer/personal-plan-offer.tsx:31`) vs `offer_variant = 'personal-plan-v1'` (kebab, `src/funnels/packages.json:32`). Task 5.2/5.3 move query semantics between these two look-alike values; a single wrong separator in a ClickHouse string literal silently returns zero rows. Worth an explicit callout in the task.

### Smaller / nice-to-haves

- **Task 4.1 UTM allowlist is a fuzzy conditional** ("allowlisted UTM reporting fields … *if they are included in the PostHog contract*"). Underspecified — a reasoning subagent will either skip it or invent the field list. Decide the field set up front or cut it.
- **Verification gap:** Task 3's "Complete when" implies the RPC works, but the only automated coverage is text-regex against the SQL file. The signature/grant change is not truly verified until Task 6's post-application reconciliation. Make that dependency explicit so "Task 3 green" isn't mistaken for "RPC proven."
- **Task 4's enrichment value is mostly for multi-variant packages** (e.g., the guided-story experiment arms under `default_organic`), not the single-variant personal-plan package Task 5 targets. Fine to keep, but it means Task 4 and Task 5 are serving different cohorts — worth noting so the "same fix" framing doesn't hide it.

### Decisions for you (tradeoffs the plan silently makes)

1. **Ship `quiz_variant` now, or defer it?** Building it now buys clean modeling before a second quiz exists; deferring removes a production migration, a backfill, NOT-NULL risk, and contributor-governance churn from this branch, and the headline purchase-attribution outcome still ships. *Decision: build-now vs defer-until-a-second-quiz-reuse-case.*
2. **Split the migration from the analytics work and/or from the in-flight branch?** The migration/backfill (Tasks 2/3/6) is the only piece needing production-write gates; Tasks 4/5 are pure analytics on existing columns. *Decision: one bundled branch vs migration-on-its-own-PR.*
3. **Should `purchase_completed` carry UTM at all (Task 4.1)?** *Decision: include allowlisted UTM on the server purchase event, or keep UTM strictly acquisition-side in `first_touch`.*
4. **Eligible-cohort identity: keep `offer_revision` seeding or move to `offer_variant`?** The existing dashboard + its contract test seed eligibility on `offer_revision = 'personal_plan_v1'` (`tests/posthog-personal-plan-offer-dashboard.test.ts:12`). Task 5.2 introduces `offer_variant` as the "durable identity" — decide whether the eligible CTE switches or stays, since the test will need to change accordingly.

### Bottom line

The analytics half of this plan (Tasks 4–5) is well-grounded and close to shippable, and the plan's factual claims about UTM, package immutability, provider metadata, and `offer_revision` all check out against the code. Before handing to a subagent: (1) fix Blocker 1 (DROP + re-GRANT the RPC) and Blocker 2 (migration-before-code ordering) — these will hard-break funnel recording otherwise; (2) disambiguate Task 5.5 so historical purchases aren't filtered out; (3) get your call on the four decisions above, especially whether `quiz_variant` and its migration belong in this branch at all. If you defer `quiz_variant`, Tasks 4–5 can ship on the existing schema with no migration and no production-write gate — the smallest shape that hits the stated goal.

I could not verify the plan's live-production claim (line 22-24, "historical sessions retain several offer variants under `default_organic`") — the Supabase MCP requires auth in this non-interactive session. It isn't load-bearing for the technical findings above.

Want me to spec the deferred-`quiz_variant` counter-proposal (Tasks 4–5 only, no migration) so you can compare it side-by-side with the full plan?
