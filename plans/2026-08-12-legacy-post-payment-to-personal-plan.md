# Legacy post-payment transition to the Personal Plan

## 1. Outcome and source context

**Outcome:** For purchases completed from either quiz funnel, a newly qualified buyer no longer enters the legacy `/onboarding` flow automatically. Stripe and PayPal activation converge at the existing `/plan-bereit` readiness/recovery surface and then enter the five-stage Personal Plan at `/plan-start`.

**Source context:**

- Product decision: “both courses” means both quiz funnels: `leads.quiz_kind = 'legacy'` and `leads.quiz_kind = 'personal_plan'`.
- Current Personal Plan journey contract: [plans/2026-08-07-personal-plan-five-stage-product-journey.md](./2026-08-07-personal-plan-five-stage-product-journey.md).
- Current checkout routing seam: `src/lib/billing/checkout-success-redirect.ts` and `src/app/welcome/page.tsx`.
- Current readiness seam: `src/app/plan-bereit/**`.
- Current Stage-1 source and authorization seams: `src/lib/personal-plan/enrollment.ts`, `src/lib/personal-plan/journey-access-loader.ts`, and `src/lib/personal-plan/persistence/stage1-*`.

The confirmed scope is a **future-purchases-only cutover**, using the qualifying provider purchase timestamp and the existing `PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF`. Existing members and purchases before the cutoff retain their current legacy state.

## 2. Chosen direction

Use the existing Personal Plan handoff instead of creating a third transition experience:

1. Preserve the provider-owned purchase, account activation, and auth-replay flows.
2. Resolve the exact purchased lead on the server.
3. If the lead is from either supported quiz and the purchase is at or after the cutoff, send the buyer to `/plan-bereit?lead=<id>`.
4. At `/plan-bereit`, idempotently link the purchased lead to the authenticated owner, validate its diagnostic source, and expose retry/support recovery while provisioning is incomplete.
5. When ready, send the buyer to `/plan-start`, preserving Stage 1 Bedarf → Stage 2 refinement → Stage 3 exact products → Stage 4 Routine → Stage 5 Anwendung.

The legacy quiz becomes a first-class, provenance-preserving Stage-1 input. It is **not** rewritten to pretend it was the Personal Plan quiz, and missing Personal Plan-only conversion answers are not invented. The old `/onboarding` route remains available for pre-cutoff members and targeted profile/routine editing, but it is no longer the automatic completion route for post-cutoff purchases.

### Rejected approaches

- **Redirect legacy buyers straight to `/plan-start` without a source adapter:** rejected because the current journey authorization requires an attached Personal Plan artifact and would fail closed or tempt a browser-trusted bypass.
- **Synthesize a Personal Plan v3 quiz envelope with default answers:** rejected because it fabricates behavioral facts and obscures the real source.
- **Run legacy onboarding and then Personal Plan:** rejected because it duplicates product/habit questions and contradicts the requested sundown.
- **Delete `/onboarding`:** rejected because existing members, profile edit links, and legacy recovery still depend on it.

## 3. Scope and non-goals

### In scope

- New, post-cutoff Stripe and PayPal purchases initiated from either quiz result.
- Existing-account and newly-created-account activation, including password setup, magic-link return, and consumed-link replay.
- A typed legacy-quiz-to-Stage-1 diagnostic projection with explicit source provenance.
- Owner-scoped enrollment, source readiness, journey authorization, and frontier routing for the new legacy-quiz cohort.
- `/plan-bereit` ready, pending, transient-error, invalid-source, and support recovery behavior for both quiz kinds.
- Middleware and authenticated navigation behavior that treats Personal Plan frontier state—not `profiles.onboarding_completed`—as authoritative for post-cutoff Personal Plan owners.
- A reversible, server-owned cutover gate and privacy-safe transition telemetry.

### Non-goals

- No deletion or redesign of `/onboarding`, its Zustand store, profile edit links, or `user_product_usage` compatibility data.
- No migration of pre-cutoff users or unfinished legacy onboarding drafts in this release.
- No changes to quiz questions, answer order, stored legacy values, offer layout, prices, checkout semantics, provider IDs, reactivation behavior, or field-test access.
- No redesign of the five Personal Plan stages or weakening of exact-product/fail-closed rules.
- No production migration application, deployment, environment activation, backfill, or customer communication in the implementation PR.

## 4. Target map

| Surface | Likely targets | Intended change |
| --- | --- | --- |
| Release contract | `src/lib/personal-plan/release.ts`, deployment env documentation, focused release tests | Add an independent default-off legacy-quiz cutover switch; reuse the strict UTC new-buyer cutoff and existing app rollout. |
| Source contract | `src/lib/personal-plan-quiz/offer-adapter.ts`, `src/lib/personal-plan/types.ts`, `src/lib/personal-plan/input.ts`, a small final Stage-1 bridge, `src/lib/personal-plan/compute-stage1.ts` | Reuse `adaptLegacyQuizAnswersForAssessment`; introduce a discriminated Stage-1 source union and only the final deterministic projection into the Stage-1 envelope. |
| Durable provenance | New forward-only Supabase migration; `src/lib/personal-plan/persistence/index.ts`, `stage1-service.ts`, `stage1-supabase.ts`, `stage2-refinement-supabase.ts` | Record `source_kind` and exact source ID/lead on initial need versions; keep existing prepared-artifact provenance for Personal Plan quiz sources. |
| Enrollment | `src/lib/personal-plan/enrollment.ts`, one-time purchase/consent lookup, subscription correlation, `src/lib/personal-plan/journey-access-loader.ts` | Recognize qualifying post-cutoff one-time and subscription purchases correlated to an owned legacy lead as eligible Personal Plan sources; keep pre-cutoff and uncorrelated purchases legacy. |
| Checkout/auth convergence | `src/lib/billing/checkout-success-redirect.ts`, `src/app/welcome/page.tsx`, `src/app/api/auth/set-checkout-password/route.ts`, `src/app/api/auth/send-magic-link/route.ts`, auth confirm/callback tests | Derive `/plan-bereit?lead=…` for both supported quiz kinds when the server-owned cutover contract is satisfied; never let browser query state opt in. |
| Readiness/recovery | `src/app/plan-bereit/page.tsx`, `readiness.ts`, `status/route.ts`, `personal-plan-ready-client.tsx` | Resolve only the exact checkout-bound lead for either quiz kind; link/validate idempotently from that lead; distinguish pending, missing-source-fact, invalid source, forbidden owner, and transient failure without falling through to the old routine. |
| Authenticated routing | `src/lib/auth/intake-state.ts`, `src/lib/supabase/middleware.ts`, `src/lib/personal-plan/navigation-access.ts`, route-level resolvers | Add a narrow enrollment/frontier read for eligible Personal Plan owners instead of loading the full journey in middleware; do not require legacy onboarding completion. Keep explicit `/onboarding?...` edits reachable. |
| Telemetry and proof | Existing analytics/server timing conventions, focused tests, `tests/personal-plan-stage1-5.spec.ts` | Add aggregate source-kind/outcome telemetry and a provider × quiz-kind transition matrix without identity, free text, or product identity. |

Exact filenames may move during implementation only when repository inspection shows a shared owner is more appropriate; the behaviors and acceptance checks below remain authoritative.

## 5. Designed user journey

### Primary journey: new buyer from either quiz

1. The buyer completes either the regular quiz or the Personal Plan quiz and pays through Stripe or PayPal.
2. The existing welcome/account-activation experience confirms payment and, when needed, asks the buyer to set a password or use a magic link.
3. Every successful auth return resolves the same server-owned purchased lead and navigates to `/plan-bereit?lead=<id>`.
4. The buyer sees “Wir bereiten deinen Haarplan vor” while Chaarlie verifies access, links the exact lead to the authenticated account, and validates the Stage-1 source.
5. If a historical regular-quiz result lacks a required diagnostic fact, `/plan-bereit` asks only for that missing fact (currently hair length is the observed case), records it against the exact source, and rechecks. It does not restart either quiz or guess an answer.
6. If provisioning takes longer, the page explains that payment and answers are safe and offers **Erneut prüfen**. A retry is idempotent and cannot create a second plan or attach another user’s lead.
7. When ready, the existing page changes to “Das empfehlen wir für dein Haar” with **Bedarfsplan ansehen**.
8. The CTA opens `/plan-start` at the owner’s current frontier:
   - no plan yet → Stage 1 Bedarf;
   - saved Stage 2 draft → resume Stage 2;
   - current completed refinement → Stage 3;
   - accepted Routine/Anwendung → the existing authoritative frontier rules continue to apply.
9. A regular-quiz buyer sees the same Personal Plan stages. Stage 1 uses only their real diagnostic answers; Stage 2 gathers current products, cadence, heat, and habit details it already owns. No Personal Plan-only quiz answer is silently inferred.
10. After Stage 3 the buyer enters the new Routine, then Anwendung when that stage is allowed. They do not see the legacy celebration modal or land in the legacy routine as part of this purchase.

### Meaningful variants and recovery

- **Personal Plan quiz:** existing attached-artifact preparation and fail-closed rules remain unchanged.
- **Regular quiz:** quiz provenance is `legacy_quiz`; incomplete diagnostics request only the missing required facts inside `/plan-bereit`; unsupported diagnostics produce support recovery. Neither case invents values or silently falls back to the legacy routine.
- **Existing authenticated account:** the purchased Personal Plan destination wins even when `profiles.onboarding_completed = true`; reactivation without a new qualifying quiz purchase retains its existing return destination.
- **Paid but fulfillment pending:** middleware and `/plan-bereit` keep the buyer in paid-pending recovery; they are never sent to pricing or asked to pay again.
- **Wrong account/foreign lead:** respond forbidden and show safe support guidance; never reveal whether another user owns the lead.
- **Transient database/provider failure:** keep `/plan-bereit`, show retry, log a privacy-safe failure code, and do not advance authorization state.
- **Cutover switch off, invalid cutoff, pre-cutoff purchase, or user outside rollout:** current behavior remains unchanged.
- **Explicit old-flow edit:** a pre-cutoff member or an explicit profile/routine edit link may still open `/onboarding`; completion returns to its explicit safe `returnTo` destination.

### Completion state

The new buyer’s durable completion state is the Personal Plan frontier, not `profiles.onboarding_completed`. The old boolean remains compatibility state for the retained legacy experience.

**User-journey sign-off:** approved by Nick on 2026-08-12 for the direct `/plan-bereit` handoff and focused missing-fact recovery shown in the planning evidence.

## 6. Planning evidence

- [Rendered transition comparison](./evidence/2026-08-12-post-payment-transition-mockup.html) and [PNG capture](./evidence/2026-08-12-post-payment-transition-mockup.png): compares the current legacy celebration/routine handoff with the proposed reuse of `/plan-bereit` and direct Stage-1 entry.
- [Current Personal Plan Stage-1 capture](./evidence/2026-08-12-personal-plan-entry-current.png): verifies the target visual language and first user-visible Personal Plan state.

**Question answered:** whether the cutover needs a new bridge screen. The selected planning direction is to reuse `/plan-bereit` for readiness/recovery and proceed directly to Stage 1.

**Feedback incorporated:** both quiz funnels are in scope; the old flow remains available but is removed from the automatic post-payment path.

**Evidence review status:** confirmed by Nick on 2026-08-12.

### Read-only production cohort evidence (2026-08-12)

Privacy-safe aggregate inspection found:

| Cohort | Leads | Missing hair length | Missing goals |
| --- | ---: | ---: | ---: |
| All legacy leads | 1,268 | 480 | 33 |
| Legacy leads from the last 90 days | 1,108 | 320 | 0 |
| Non-test legacy leads with a completed funnel purchase | 6 | 0 | 0 |

This supports direct entry as the normal path, but it does not justify assuming every historical unpaid result is complete. The plan therefore keeps an exact-source missing-fact recovery inside `/plan-bereit`; it does not backfill or infer historical answers.

### Counterpart review findings ledger

| Finding | Disposition in this plan |
| --- | --- |
| A third legacy mapper would duplicate `adaptLegacyQuizAnswersForAssessment`. | Accepted: Task 1 reuses the existing adapter and adds only the final Stage-1 source bridge. |
| `PersonalPlanEnrollment.sourceKind` already describes payment access. | Accepted: payment keeps `sourceKind`; quiz provenance is named `quizSourceKind` or `stage1SourceKind`. |
| The cutover must cover one-time and subscription access explicitly. | Accepted: Task 2 specifies both paths and their exact correlation evidence. |
| Full journey loading in middleware is an avoidable hot-path risk. | Accepted: Task 5 requires a narrow query, a latency budget, and no product/portfolio payloads. |
| Current readiness hardcodes `personal_plan` in exact and fallback lead queries. | Accepted: Task 4 uses only the exact checkout/enrollment-bound lead; it does not choose “latest” across quiz kinds. |
| `hair_profiles` and lead answers could become competing readiness sources. | Accepted: readiness validates the exact lead snapshot that Stage 1 will consume; profile persistence is an output, not the source authority. |
| Historical legacy leads may lack hair length or goals. | Resolved from aggregate evidence: completed legacy purchases are complete, while older unpaid results can be incomplete; targeted missing-fact recovery remains required. |
| The legacy fingertest could be described as literal porosity. | Accepted: it remains a surface-feel observation only; no porosity claim is introduced. |
| The mockup’s ready copy might diverge from production. | Rejected after source verification: the mockup uses the current `/plan-bereit` ready strings. |

## 7. Ordered tasks

### Task 1 — Add a truthful legacy quiz Stage-1 source contract

**Consumes:** normalized `QuizAnswers` from an owned `leads.quiz_kind = 'legacy'` row.

**Produces:** a discriminated, versioned Stage-1 source snapshot with `stage1SourceKind = 'legacy_quiz'`, the exact lead ID, and only known diagnostic facts. `PersonalPlanEnrollment.sourceKind` remains reserved for `one_time | launch_subscription | field_test`.

- Reuse `adaptLegacyQuizAnswersForAssessment` as the sole legacy factual mapper for texture, thickness, density, length, surface feel, elasticity, chemical treatment, scalp oiliness/concerns, goals, and concerns. Add only a small pure bridge from its `PersonalPlanDiagnosticInput` result to the versioned Stage-1 source envelope.
- Extend Stage-1 parsing/profile construction to accept `personal_plan_quiz` and `legacy_quiz` source variants while preserving current v2/v3 Personal Plan compatibility.
- Classify incomplete required diagnostics with stable reason codes compatible with existing `needs_clarification` semantics; route user-answerable omissions to Task 4 recovery and unsupported shapes to support. Do not supply defaults.
- Ensure the resulting Stage-1 snapshot and hash are deterministic regardless of legacy array order.
- Keep quiz source kind/version visible in the immutable snapshot so downstream debugging never has to infer provenance from shape. Treat the fingertest strictly as surface feel, not a literal porosity measurement.

**Tests:** add table-driven adapter/parser/Stage-1 fixtures for both quiz kinds, historical aliases, array canonicalization, missing density/surface/scalp/treatment, and source-hash separation.

**Complete when:** identical semantic legacy answers yield the same Stage-1 output/hash, unsupported inputs fail closed, and all existing Personal Plan Stage-1 fixtures remain unchanged.

### Task 2 — Persist source provenance and accept the qualifying regular-quiz enrollment

**Consumes:** Task 1 source contract, correlated provider purchase facts, exact user/lead ownership, app rollout, cutover switch, and strict cutoff.

**Produces:** one owner-scoped `PersonalPlanEnrollment` and one immutable initial need version whose source kind and source ID can be audited.

- Add a forward-only migration that generalizes initial-need provenance without rewriting existing rows: existing rows remain `personal_plan_artifact`; new regular-quiz rows record `legacy_quiz_lead` plus the exact lead ID. Add a constraint that admits only the correct column combination for each source kind.
- Update the create-or-reuse RPC to validate the selected source contract atomically and preserve enrollment mismatch, immutability, idempotency, and current-head behavior.
- Extend one-time enrollment resolution so its consent-bound lead is checked for exact ownership, quiz kind, paid timestamp, cutoff, app rollout, and legacy cutover switch; preserve current Personal Plan one-time behavior when the legacy switch is off.
- Extend subscription enrollment resolution only when its provider reference maps to one funnel session, one owned lead, a matching provider, a post-cutoff `purchase_completed_at`, and the enabled rollout. Accept both supported lead kinds without weakening the existing launch catalog correlation.
- Add a default-off `PERSONAL_PLAN_LEGACY_QUIZ_CUTOVER_ENABLED` reader so the legacy-funnel cutover can roll back without disabling existing Personal Plan customers.
- Keep membership reactivation, missing/invalid cutoff, uncorrelated subscriptions, foreign leads, and pre-cutoff purchases outside the new cohort.

**Tests:** migration pgTAP/transition-harness cases; enrollment matrix across provider, quiz kind, cutoff boundary, rollout, reactivation, ownership, and missing correlation; create/reuse idempotency and cross-user rejection.

**Complete when:** the database can prove where every initial need came from, a qualifying regular-quiz purchase resolves one eligible enrollment, and all legacy/pre-cutoff cases remain byte-for-byte on their current branch.

### Task 3 — Converge checkout and auth returns at `/plan-bereit`

**Consumes:** Task 2 enrollment eligibility and the exact checkout-bound lead ID.

**Produces:** a server-derived first-time destination for both quiz kinds, shared by Stripe, PayPal, password setup, magic link, and consumed-link replay.

- Replace the current `quiz_kind === 'personal_plan'` destination fork with a resolver that combines supported lead kind, purchase context, cutover eligibility, and readiness.
- Preserve direct `/plan-start` only when the owner/source is already proven ready; otherwise use `/plan-bereit?lead=<encoded id>`.
- Keep `membership_reactivation` and its allowlisted return destination separate from first-time purchase activation.
- Preserve the existing signed/allowlisted auth replay boundary; extend its tests only for the now-valid regular-quiz `/plan-bereit` handoff.
- Ensure failure to load routing facts fails closed to a recoverable activation path and does not silently select `/onboarding` for a known qualifying paid purchase.

**Tests:** focused route-contract tests plus a complete `Stripe | PayPal × legacy | personal_plan × new account | existing account` destination table and consumed-link replay cases.

**Complete when:** every qualifying provider/auth branch resolves the same canonical readiness URL and no browser-controlled quiz kind or lead can opt into Personal Plan access.

### Task 4 — Generalize readiness and remove legacy onboarding as the automatic next step

**Consumes:** Task 3 canonical readiness URL and Task 1/2 source rules.

**Produces:** one `/plan-bereit` state machine for both quiz sources and a ready CTA to `/plan-start`.

- Generalize the exact-lead lookup from Personal Plan-only to the purchased supported quiz lead while retaining direct owner and field-test protections. Remove the owned “latest Personal Plan lead” fallback from the purchase handoff; when auth replay lacks a lead query parameter, recover the canonical lead from the exact enrollment/purchase correlation.
- On POST, idempotently link the exact lead/profile and validate the same lead snapshot Stage 1 will consume. For Personal Plan quiz leads, preserve attached-artifact requirements; for legacy leads, validate normalized diagnostics and enrollment correlation. `hair_profiles` may be updated as an output but must not independently decide readiness.
- Replace the Boolean ready/pending response with a narrow typed state contract: `checking | paid_pending | source_pending | missing_source_facts | ready | invalid_source | forbidden | transient_error` (exact names may be refined but meanings may not be collapsed).
- Keep current loading/ready copy. For `missing_source_facts`, show only the required German question(s), persist them through an owner-scoped server action against the exact lead/source version, then revalidate. Add retry for transient/pending and support for invalid/forbidden. Do not add another success interstitial or restart the quiz.
- Remove `/onboarding?returnTo=/routine` as the post-cutoff ready CTA fallback. A qualifying paid buyer either proceeds to Personal Plan or remains on explicit recovery.

**Tests:** readiness resolver/status route/component tests for both source kinds, retries, duplicate POST, delayed fulfillment, foreign lead, incomplete legacy source, and rollout-off behavior.

**Complete when:** both quiz cohorts see the reviewed readiness → Stage-1 journey, retries are safe, and no qualifying purchase falls through to the legacy routine.

### Task 5 — Make the Personal Plan frontier authoritative for authenticated routing

**Consumes:** Task 2 enrollment/source and the existing `PersonalPlanJourneyAccess` frontier.

**Produces:** consistent middleware, navigation, and direct-route behavior independent of legacy onboarding completion for the new cohort.

- Add a narrow server-only routing resolver that returns only enrollment eligibility and frontier destination. It may use exact indexed IDs and minimal plan/version columns; it must not load products, portfolio, routines, or full Stage payloads into middleware.
- Teach the full journey access loader to resolve `stage1SourceKind = 'legacy_quiz'` and retain current prepared-artifact checks for Personal Plan quiz owners.
- For eligible post-cutoff owners, route `/auth`, `/chat`, premature `/routine`, and premature `/anwendung` from the Personal Plan frontier rather than `resolveIntakeState(profile.onboarding_completed, ...)`.
- Keep legacy middleware behavior for non-enrolled/pre-cutoff users.
- Keep explicit `/onboarding?...` pages reachable for retained edits; do not set `onboarding_completed = true` merely to bypass middleware.
- Ensure routine/application pages never substitute legacy output after a Personal Plan has begun; unavailable source/frontier reads remain explicit recovery states.
- Set and verify a middleware overhead budget during implementation: the added routing read should stay within 100 ms p95 in production-shaped local timing, with server timing recorded separately from route rendering. If the budget is missed, move the check out of global middleware into the smallest authenticated route boundary before rollout.

**Tests:** middleware and page-resolver matrix for source kind, onboarding flag true/false, Stage 1–5 frontier, app/legacy navigation, direct URLs, and explicit onboarding edit URLs.

**Complete when:** a new regular-quiz buyer cannot be bounced back into old onboarding by auth or middleware, while an existing legacy member’s navigation remains unchanged.

### Task 6 — Add end-to-end proof, telemetry, and release gates

**Consumes:** Tasks 1–5 integrated behavior.

**Produces:** a release-ready but default-off implementation receipt; no production activation.

- Add privacy-safe aggregate outcomes keyed only by quiz source kind, provider, transition state, and reason code. Do not include email, lead/user IDs, free text, exact product identity, or quiz answers.
- Extend the local production-shaped Personal Plan journey fixture with a regular-quiz purchase source and run both providers where local provider fixtures exist.
- Browser-verify mobile and desktop for loading, ready, delayed/retry, invalid-source/support, and Stage-1 entry. Verify back/reload/resume and that explicit legacy edit links still work.
- Run schema drift/transition harness, focused Node tests, relevant Playwright journeys, typecheck, lint, build with flags off, and `ci:verify` as owned by `implementation-loop`/`ready-check`.
- Record the exact tested commit, migration fingerprint, flags-off proof, provider × quiz matrix, screenshots, and residual gaps in the release receipt.
- Prepare separate later activation steps: apply migration; deploy code with cutover flag off; smoke Personal Plan and legacy paths; set a future cutoff; enable internal rollout; run authenticated provider smokes; only then request explicit customer rollout authorization.

**Complete when:** the branch is review-ready with default-off behavior, all required evidence is attached, and activation remains a separate explicit gate.

## 8. Verification

### Automated checks

- Pure source adapter/parser/Stage-1 tests for legacy and Personal Plan quiz inputs.
- Existing Personal Plan Stage 1–5 suites remain green; snapshots for existing Personal Plan quiz inputs do not change unexpectedly.
- Enrollment/cutoff/rollout tests at `cutoff - 1 ms`, exact cutoff, and `cutoff + 1 ms`.
- Provider/auth destination matrix for Stripe and PayPal, new and existing account, both quiz kinds, and reactivation.
- `/plan-bereit` state-machine tests including idempotent POST and cross-user denial.
- Middleware/frontier tests across onboarding flags and Stage 1–5, including a query-count assertion that prevents full journey/product loading.
- Migration transition harness from the production schema baseline; RPC ownership, provenance constraint, immutability, duplicate retry, and rollback-by-flag tests.
- Scoped lint/typecheck, production build with all Personal Plan/cutover flags absent, then repository verification.

### Manual/browser checks

- Mobile and desktop: both quiz purchases → welcome/auth → `/plan-bereit` loading → ready → `/plan-start` Stage 1.
- Delayed activation: reload and **Erneut prüfen** preserve the canonical lead and never show pricing.
- Historical regular source missing hair length: one focused German question, safe reload/retry, then Stage 1; unsupported source: support action, no fabricated plan and no legacy-routine fallback.
- Existing account with `onboarding_completed = true`: still enters the newly purchased Personal Plan.
- Existing pre-cutoff member: unchanged legacy destination/navigation.
- Back, reload, expired/consumed auth link, and resume return to the canonical frontier.
- Explicit profile and legacy routine edit links continue to open the retained onboarding screens and return safely.

### Migration/live-state checks

- Implementation may create and test a migration locally only. Applying it to production is a separate authorization.
- Before any later activation, inspect current flags, strict cutoff, migration presence, provider correlations, and active error/support baselines from production read-only sources. Explicitly require `count(*) = 0` for existing `personal_plan_need_versions` rows where `kind = 'initial'` and `prepared_artifact_source_id IS NULL` before applying the provenance constraint (read-only preflight on 2026-08-12: 8 initial rows, 0 missing sources).
- Activate through an internal cohort first. A customer cutover requires a separate explicit environment change and authenticated smoke for both quiz kinds and both providers.
- Rollback changes only the new legacy-quiz cutover flag; existing Personal Plan quiz customers and their plans stay available.

### Evidence-sensitive review

- Confirm that the legacy projection uses only facts actually captured in the current regular quiz.
- Confirm that the old onboarding remains reachable but is absent from every qualifying post-payment branch.
- Confirm no product or medically adjacent claim changes are introduced; no external hair-care research is required for this routing/data transition.

## 9. Review and handoff

- **Worktree:** `/Users/nick/AI_work/hair_conscierge/.worktrees/legacy-post-payment-transition-plan`
- **Branch:** `codex/legacy-post-payment-transition-plan`
- **Implementation start:** planning gates are satisfied; implementation still requires an explicit implementation request and then uses `implementation-loop` in this task worktree.
- **Review gates:** plan self-review, one Claude plan review, user evidence review, and explicit user-journey sign-off are complete. Implementation later owns `ready-check` and `request-code-review`.
- **Publication gates:** commit/push/draft PR require “ship it”; migration apply, deployment, environment activation, customer rollout, merge, and cleanup each remain separate.
- **Residual risks:** historical unpaid legacy results may require targeted fact recovery; standard-subscription correlation may differ between provider generations; the old onboarding and new Personal Plan will temporarily remain two editable data systems; authenticated real-provider smoke is required before rollout.

### Current sign-off status

- Both quiz funnels in scope: **confirmed**.
- Future-purchases-only cutover: **confirmed**.
- Direct `/plan-bereit` → Stage 1 evidence direction: **confirmed**.
- Focused missing-fact recovery inside `/plan-bereit`: **confirmed**.
- Designed user journey: **approved on 2026-08-12**.

### Artifact disposition

- This plan: **commit** with the eventual implementation PR.
- Rendered HTML and PNG planning evidence: **commit** with the eventual implementation PR.
- Current Personal Plan Stage-1 capture: **commit** with the eventual implementation PR.
- Counterpart review output: **discard after findings are reconciled** unless a material decision requires retention.
