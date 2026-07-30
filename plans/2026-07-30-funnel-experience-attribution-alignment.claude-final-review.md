I have thorough grounding across the schema, RPC, caller, dashboard, destination, provider metadata, package contract, generator, docs, and test harness. Here is the verdict.

---

**Verdict:** Approve with revisions. This plan is a *revised* version that has already absorbed the two blockers and all high-confidence issues from the earlier `.claude-review.md` — I verified each against code and they check out. What remains is one hand-off gap, two small freshness/behavior callouts, and three decisions that belong to you, not the executing subagent. (The `.claude-final-review.md` alongside it is empty.)

---

### What the plan already fixed (verified resolved — do not re-raise)

- **RPC overload ambiguity** → Task 3.1 now drops the exact 20-arg signature before recreate + re-issues `REVOKE`/`GRANT`. Grounded: the function is called with **named** args via PostgREST (`src/lib/funnel/server.ts:277-298`), the current signature is exactly 20 positional params with matching grants (`supabase/migrations/20260711120000_funnel_attribution.sql:99-119, 296-304`), and **no later migration alters it** (only file matching `record_funnel_event`). ✓
- **Migration-before-code ordering** → Task 3.4 (expand-first) + Task 6.3 + non-goal line 116. ✓
- **Backfill CASE cannot read `packages.json`** → Task 3.1 hardcodes the CASE and aborts on any unmapped live key; Task 6.2 finalizes it only after the preflight. ✓
- **Historical purchases silently dropped** → Task 5.5 now makes canonical variants additive, never a hard filter. Confirmed in the shipped dashboard: `purchase_completed` is exempted from the `offer_revision` guard and counted by session membership + package key (`scripts/analytics/personal-plan-offer-dashboard.ts:37, 211`). ✓
- **UTM on the purchase event** → cut (non-goal line 119). ✓

### Lean shape

- **Irreducible goal:** make a confirmed purchase queryable in PostHog by the funnel experience that produced it, without expanding Stripe/PayPal metadata; Supabase stays authoritative.
- **The headline outcome ships without any of slice 2.** The purchase event **already** carries `funnel_session_id` + `funnel_package_key` (`src/app/api/stripe/webhook/route.ts:159-160`, `src/lib/paypal/webhook-handlers.ts:461-462`), and `posthog-server.ts:14-23` spreads `...input.event.payload` — so the dashboard's purchase counting (`funnel_package_key='meta_personal_plan_v1'` + session membership) works on the existing schema today. Tasks 4 (variant enrichment) and 2/3/6 (`quiz_variant`) are separable follow-ups, not prerequisites for Task 5.
- **`quiz_variant` is future-proofing as written.** It is 1:1 with `landing_variant` in every current package — 3 packages `landing=default` → `legacy-quiz-v1`, 1 package `landing=personal-plan-quiz` → `personal-plan-quiz-v1` (`src/funnels/packages.json`). The `personal-plan-quiz` landing name already encodes the quiz, and the plan ships no quiz allocator. Zero added query power until a second quiz reuse exists.
- **Task 1 is near-redundant.** `docs/funnel-attribution.md:10` already states landing/offer are immutable snapshots + "Do not rename a key after traffic"; `docs/analytics/offer-page-tracking.md:246` already says "Do not use `offer_revision` as a schema-version substitute"; and no code maps UTM → package (UTM lives only in `first_touch`, `src/lib/funnel/server.ts:368-381`). Keep Task 1 as a light doc-consolidation, not its own phase.
- **Hard tradeoff the plan half-makes:** whether the production migration rides a fast-follow or is genuinely deferred. The two-worktree split is the right instinct; the plan should commit to which.

### Prior art

- **Add-column migration** → expand→backfill→contract: matches (Task 3.1). ✓
- **Function-signature change** → DROP-before-recreate: matches repo precedent, now in the plan. ✓
- **Multi-destination analytics enrichment** → resolve at the destination, not centrally: Task 4 resolves inside `posthog-server.ts`, which already receives `input.supabase` (`src/lib/billing/analytics-destinations/types.ts:16`). Idempotency preserved via `event_key` (Task 4.4). ✓
- **Snapshot-vs-race:** the session row exists from the first browser milestone, long before purchase, so the PostHog read never races the `funnel` destination's purchase write. ✓

### Hard technical defects / hand-off gaps (not preference)

1. **Task 3.5's real-DB "Complete when" has no automated harness — a subagent can mark Task 3 green while the RPC change is unproven.** Verified: no `supabase start` / pg-mem / testcontainers / `DATABASE_URL` in `package.json`; `tests/funnel-migration.test.ts` is pure `readFileSync` + regex (`:5, :36-40`); `test:node` and `ci:verify` never touch a database. `supabase/config.toml` exists so a subagent *can* `supabase db reset` locally, and `supabase/manual-test-backfills/` is the precedent for hand-run exercise SQL — but nothing wires it into CI. **Fix:** make Task 3's "Complete when" explicitly state the RPC verification is a *manual local-Supabase step outside CI* and name the mechanism (`supabase db reset` + an exercise script modeled on `manual-test-backfills/`), so "regex tests pass" is never mistaken for "RPC proven."

2. **The DROP signature must be re-derived at slice-2 start, not copied from the plan.** Verified true *today* (20-arg, single definition), but slice 2 branches from a *later* `origin/main`. The plan already says "recheck the next unused migration timestamp"; add "re-confirm the current `record_funnel_event` signature + grants before authoring the DROP." A stale copied DROP silently no-ops and reintroduces the exact overload ambiguity it exists to prevent.

3. **Task 5.2 adding `offer_variant` to the eligibility CTE changes the currently-passing dashboard and its contract test.** The shipped dashboard seeds eligibility on `offer_revision='personal_plan_v1'` **only** (`personal-plan-offer-dashboard.ts:15-22`). The double-seed is *safe* — the browser event does carry `offer_variant='personal-plan-v1'` (`src/components/personal-plan-offer/personal-plan-offer.tsx:183`, `src/lib/analytics/destinations/posthog.ts:25`) — but it is a behavior + test change the plan mandates silently. The real residual danger is the underscore/hyphen transposition (`offer_revision='personal_plan_v1'` vs `offer_variant='personal-plan-v1'`), which the plan does flag.

### Decisions for you (tradeoffs the plan makes without surfacing)

1. **Build `quiz_variant` now, or defer until a second quiz reuse exists?** Now = clean model before the need, at the cost of a production migration + backfill + NOT-NULL + contributor-governance churn. Defer = the headline purchase-attribution outcome (Tasks 4 landing/offer + Task 5) still ships with **no migration and no production-write gate**. *Your call: build-now vs defer.*
2. **Is slice 2 a fast-follow or a true deferral?** Task 5's dashboard is fully functional on slice 1 alone (purchase carries package+session via existing payload). Only Tasks 2/3/6 need production-write gates; Task 4 needs the migration. *Your call: ship the analytics outcome now and make `quiz_variant`+migration a separate PR, or bundle.*
3. **Eligible-cohort identity: keep `offer_revision`-only seeding, or add/switch to `offer_variant` (Task 5.2)?** Either is defensible; the existing contract test (`tests/posthog-personal-plan-offer-dashboard.test.ts`) encodes the `offer_revision`-only contract and will need to change accordingly. *Your call, so the test change is intentional not incidental.*

### Smaller / nice-to-haves

- The dashboard buckets purchases on the **provider's** `funnel_package_key` (from Stripe/PayPal checkout metadata), not Task 4's resolved/stored package. Task 4's "verify provider package against stored package" guard is good, but a provider/stored mismatch would still be counted under the provider key. Very low probability; worth a one-line note that dashboard cohorting trusts provider metadata, not the resolved snapshot.
- Task 3's "Complete when" implies the RPC works, but automated coverage is regex-only until Task 6's post-application reconciliation. Make that dependency explicit (see defect 1).

### Could not verify

The live-production aggregate (Task 6.1: 1,578 rows, six historical offer variants under `default_organic`) — the Supabase MCP requires auth in this non-interactive session. Not load-bearing for the findings above, **but** the backfill CASE's correctness depends entirely on that preflight, so it must be re-run against prod before the CASE is finalized (the plan already requires this in Tasks 6.1–6.2).

### Bottom line

Technically shippable to a subagent after three small edits: (1) mark Task 3.5's real-DB verification as an explicit manual local-Supabase step outside CI and name the mechanism; (2) add "re-confirm the current RPC signature before authoring the DROP" to slice-2 preflight; (3) note that Task 5.2's `offer_variant` seed is a deliberate dashboard + test change. Then get your call on the three decisions — especially whether `quiz_variant` + its migration belong in this effort at all, since Tasks 4–5 deliver the stated goal on the existing schema with no production-write gate.

Want me to spec the deferred-`quiz_variant` counter-proposal (Tasks 4–5 on the existing schema, no migration) so you can compare it side-by-side with the full plan?
