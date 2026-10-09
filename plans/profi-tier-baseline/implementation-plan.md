# Budget + Drogerie/Profi — implementation plan

2026-10-08 · worktree `.worktrees/profi-tier-baseline` · branch `codex/profi-tier-baseline` (base `origin/main` 5cf95d08) · controlling ledger [plan.md](./plan.md) revisions ≤ 49 · design evidence [evidence/README.md](./evidence/README.md) revision 49.

This is the executable brief. `plan.md` stays the decision ledger; where this file and older ledger text disagree, revision 48/49 entries and this file win.

## 1. Outcome

A user states one package-price budget once (Bis 5 € / Bis 15 € / Keine feste Preisgrenze, plus strict/flexible for capped answers). Every product recommendation surface — Personal Plan Stage 3, direct acceptance, early previews, consultation, call cockpit and scanner — uses it through one shared deterministic policy. Shampoo, Conditioner and Mask cards show a Drogerie/Profi badge. Nothing the user already chose or accepted is replaced without an explicit acceptance.

## 2. Chosen direction

- **Storage:** a fourth guarded facts domain `shopping_preferences` on `hair_profiles`, written only through `user_facts_save_v1`. Tier is a new required catalog column `products.market_segment`.
- **Policy:** one pure module ranks nothing itself. It takes each role's existing fit-ranked full candidate list, the saved budget and preserved choices. It returns the bounded per-role list, the default selection and display metadata. Fit evidence, ranking and authority stay unchanged and price-neutral.
- **Portfolio accounting:** runs once over all roles of a proposal: flexible exceptions, necessary gaps and the no-ceiling mix. Standalone scanner alternatives use only the per-product ordering and labels, with no routine quota.
- **Acceptance integrity:** reuse the existing re-validation at completion (`completionDecisionsRemainCurrent`, `seen_state_stale`), with the budget in the evaluation context. No catalog lock, commerce fingerprint or extra preference revision (revision 48).
- **UI:** follows the approved revision-49 mockup, rebuilt in the real components. No mockup code is promoted.

## 3. Scope and non-goals

In scope:

- facts domain and adapters (user, participant, staff)
- catalog column, backfill and admission enforcement
- policy module
- Stage-3 integration incl. budget step, cards and edit/refresh behaviour
- direct acceptance and previews
- routine-edit gate
- scanner (web + shared API, incl. native ordering)
- consultation intake and cockpit
- flags, tests and labs fixtures

Non-goals:

- new research/catalog wave (the Profi Shampoo/Conditioner/Mask list is a separate parallel lane)
- Leave-in/Oil badges
- category-by-category budgets
- total routine caps
- a new AI step
- coral CTA contrast change
- changing free-scanner masking/entitlements

Parked with Nick's acknowledgement on 2026-10-08 (see §6):

- chat-driven budget changes
- iOS badge rendering
- explicit tier-preference collection

## 4. Authoritative values (single source for all tasks)

| Item                                          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain                                        | `shopping_preferences`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Domain V1 shape                               | `{ budget?: { kind: "capped"; limitEur: 5 \| 15; allowExceptions: boolean } \| { kind: "uncapped" } }`, `.strict()`. `budget` is replaced whole (top-level merge). Absent = not collected, never uncapped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Provenance kinds (new)                        | `shopping_preferences_editor` (user/participant), `consultation_staff` (cockpit; id = enrollmentId)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Catalog column                                | `products.market_segment text CHECK (market_segment IN ('drugstore','professional'))`, and `CHECK (NOT is_chaarlie_recommended OR market_segment IS NOT NULL)` added **only in the backfill migration**, after the values are set (a `NOT VALID` check still applies to every UPDATE and would break the price-audit writer on unsegmented rows).                                                                                                                                                                                                                                                                                                                                                          |
| Badge scope                                   | `category_key IN ('shampoo','conditioner','mask')`; labels „Drogerie“ / „Profi“                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Flags (server, default off, literal `"true"`) | `SHOPPING_BUDGET_ENABLED` (collection + policy everywhere), `PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED` (badges). Two flags instead of the ledger's three: collection without policy has no user value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Inference (point 30)                          | ≥3 priceable distinct consumables, ≥2 categories, priceable coverage ≥80%, no priceable product >15 €. €5 if ≥80% ≤5 €. €15 if ≥80% in (5, 15]. Else none. Unknown/unpriced counts against coverage. Suggestion only, never saved without confirmation, never overrides a saved answer.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Strict                                        | Never auto-select above budget. ≥2 suitable affordable in the full pool → affordable only. 1 → affordable first, then over-budget. 0 → over-budget shown, ascending price, `defaultProductId = null`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Flexible                                      | `N` = unique new-purchase product IDs in the final proposal (preserved planned purchases included; owned, alternatives and empty slots excluded). `A = N === 0 ? 0 : max(1, floor(0.25·N))`. `G` = required roles with suitable candidates but none affordable. Capacity `max(A, G)`. Ordinary exceptions ≤ `max(0, A − G)`.                                                                                                                                                                                                                                                                                                                                                                               |
| Exception eligibility (point 26)              | Over-budget candidate vs. best affordable candidate of the same role, compared by **distance to the user's target** on graded comparison dimensions (`comparison-dimensions.ts`; authority criteria for conditioner/leave-in are fail-only and cannot differentiate eligible products). Need dimensions: `conditioner.weight`, `conditioner.repair_support`, `mask.weight`, `mask.repair_support`, `leave_in.weight`, `leave_in.repair_support`, `oil.weight`. Strictly closer on ≥1, not farther on any, verdict not worse, cautions not more. Overshooting the target is farther, never "more". Otherwise keep affordable. (Hair-care code review 2026-10-09; care direction excluded as weak evidence.) |
| Exception priority (27/23)                    | Gaps first. Then improvements on a dimension mapped to the stated main concern (`resolveStatedPersonalPlanConcern`): `low_volume_or_weighed_down` → the four weight dimensions; `hair_damage`, `breakage` → the three repair dimensions; all other concerns → none (not graded per product, weak evidence, cosmetic split-end repair impossible, hair loss medically adjacent). Then smaller `extraCost`. Then input order.                                                                                                                                                                                                                                                                                |
| No ceiling                                    | Target `round(0.6·N)` products >15 €. Only fit-comparable swaps; never a worse fit or an extra purchase to hit the ratio.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Manual choices                                | Always allowed and preserved, count toward `N`, never mutate preferences, never undone to repair a ratio.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Exception reason copy                         | Fixture text „Passt beim Pflegegewicht deutlich besser als die Option im Budget.“ Production renders the improved dimension's existing German label in the frame „Passt bei ‹Dimension› deutlich besser als die Option im Budget.“                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

UI copy is defined by evidence revision 49 plus Nick's 2026-10-08 sharpening:

- question: „Was darf ein Pflegeprodukt ungefähr kosten?“
- helper: „Preis pro Packung – gilt für jedes Produkt deiner Routine.“
- answers: „Bis 5 €“, „Bis 15 €“, „Keine feste Preisgrenze“
- follow-up: „Bis 15 € für jedes Produkt?“ with „Ja, für jedes.“ („Teurere zeigen wir nur, wenn es im Budget kaum Passendes gibt.“) and „Einzelne dürfen mehr kosten.“ („Nur einzelne – wenn sie deutlich besser passen.“)
- suggestion chip: „Wie deine bisherigen Produkte“
- budget line: „Bis 5 € für jedes Produkt“ / „Bis 5 € · einzelne dürfen mehr kosten“ / „Ohne feste Preisgrenze“
- card labels: „Im Budget“ / „Empfohlen“ / „Alternative“
- badges: „Über deinem Budget“, „Drogerie“, „Profi“
- recovery strings as listed in the README

## 5. Designed journeys

1. **Personal Plan, first run.** Last capture step → (need-revision review if any) → budget question (suggestion preselected only when inference fires) → follow-up for capped answers → save → Stage-3 decisions with budget line, notices and labels.
   - Back from decisions returns to the follow-up, or to capture when the saved budget was reused.
   - Save failure keeps the answers and shows „Erneut versuchen“.
2. **Saved budget reused.** Capture → decisions directly, with no question.
3. **Budget changed mid-selection.** Chosen products are kept. Remaining roles use the new budget; the CTA reads „Weiter zur ‹Rolle›“.
4. **Existing routine, no budget.**
   - Viewing needs nothing.
   - „Produkte ändern“ or „Häufigkeit ändern“ asks the budget first („Kurz eine Frage, dann geht es mit deiner Änderung weiter.“). After a successful save the intended edit resumes. Cancel or failure leaves the routine unchanged.
   - Products accepted earlier stay. A notice counts those above the new budget and offers „Neue Vorschläge ansehen“.
   - Editing one role changes only that role.
5. **Direct acceptance.** Proposal → „Weiter“ → budget (if missing) → adjusted proposal stating how many products changed → „Routine übernehmen“. Cancel or failure never finalizes.
6. **Consultation.** Deine Produkte → budget → Deine Routine → Hitze & Styling, with the same copy and coral styling.
7. **Call cockpit.** The Phase-3 panel shows the saved budget and edits it inline (staff voice). The product table shows the euro amount over budget and the exception count. Edits are blocked after finalization.
8. **Scanner.** With a saved budget, alternatives within budget come first, with an over-budget badge and the caption „Bis 15 € zuerst“. Without a budget, the existing order applies with no budget labels. Free masking is unchanged.
9. **Stale proposal.** Completion or acceptance re-checks against current catalog and budget. If anything changed: info notice, dimmed cards, „Vorschläge neu laden“. Choices are kept.

Journey evidence: `evidence/screenshots/rev49-*`, `rev48-*`; interactive `node plans/profi-tier-baseline/evidence/server.mjs`. Nick approved 2026-10-08 („sounds fine to me, lets do it like that for now“), then the review fixes and the copy sharpening were applied.

## 6. Decision coverage

Decision coverage: **confirmed** (C7 taken as working default, see below).

**Confirmed with Nick**

- plan.md points 1–35
- revision 48: build all now, Profi products in a parallel lane, no shelf prices
- revision 49: mockup approval and copy sharpening

**Inherited from evidence or contract**

- the one-door facts contract (`user_facts_save_v1`, lock trigger)
- existing fit/authority ranking as the only fit source
- existing completion re-validation for staleness
- free scanner masking contract (`ScanMaskedAlternative` stays closed)

**Implementation defaults**

- two flags
- provenance kinds named in §4
- `facts_revision` bumps on budget writes (door semantics unchanged)
- the budget is visible in the agent's user context (read-only)
- staff edits blocked after cockpit finalization
- native API gets ordering plus optional fields
- Stage-3 budget step is a client phase, not a persisted draft pass
- the budget is read by a narrow fail-open loader on the scanner hot path

**Open consequential assumptions:** none. C7 freemium default (2026-10-09, Nick skipped the question and said „continue“): ask the same budget question right after payment (after „Alles freigeschaltet“), then build the routine with it; `purchase/complete` returns a distinct `budget_required` state instead of the retryable `routine_not_accepted`. Reversible until Task 5 starts.

**Parked out of scope (Nick acknowledged 2026-10-08)**

1. **Chat:** chat reads and respects the budget (Task 8b) but cannot change it; users are pointed to the budget screen.
2. **iOS:** the native scan API returns budget-aware ordering and optional `overBudget`/`marketSegment` fields; Swift badge rendering is a follow-up.
3. **Explicit tier preference:** not collected, stored or used in v1.

**Gates that need Nick during execution (data values, not design)**

- Approve the backfill list mapping every currently recommended product to `drugstore`/`professional` (Task 2). Tier values are catalog truth.

Undiscussed consequential assumptions affecting this handoff: none.

Coverage acknowledgement: Nick, 2026-10-07: „review and then lets clarify all open points so we can then go onto implementation“. Then 2026-10-08: „sounds fine to me, lets do it like that for now“.

Internal revalidation: code seams re-mapped at 5cf95d08 by three read-only explorers on 2026-10-08 (facts domain, Stage-3/direct acceptance, scanner/consultation/catalog).

## 7. Ordered tasks

Each task lands green on its own: tests first for the pure logic, then `npm run ci:verify` plus the named tests.

### Task 1 — Facts domain `shopping_preferences`

**Produces:** the column, the guarded door branch, the TS schema/save/read, and the route `POST /api/profile/shopping-preferences`.

- **Migration** `supabase/migrations/<ts > 20261007120000>_user_facts_shopping_preferences.sql`, one file:
  - `ADD COLUMN shopping_preferences jsonb`, an object CHECK and a COMMENT.
  - `CREATE OR REPLACE` `hair_profiles_fact_column_defaults_v1()` and `hair_profiles_reject_fact_write_outside_door()` with 27 keys, `"diagnostics": null` first, `"shopping_preferences": null` added to both literals.
  - `CREATE OR REPLACE user_facts_save_v1`, copied from `20261006180000_user_facts_assumed_never_replaces_real.sql` with:
    - domain list (L48) + `'shopping_preferences'`
    - old-doc CASE (L139-143) + a `WHEN 'shopping_preferences'` branch
    - a new `ELSIF p_domain = 'shopping_preferences'` UPDATE before the final branch
    - the final `ELSE` turned into an explicit `ELSIF p_domain = 'quiz_context'` + `ELSE RAISE`
    - COMMENT, REVOKE/GRANT and search_path restated
    - a function-body diff reviewed line by line
  - A DO-block re-check of the column classification.
- **TS:**
  - `src/lib/user-facts/schema.ts`: domain const, `shoppingPreferencesV1Schema`, patch schema, provenance kinds, `factsProvenanceSchema` key.
  - `save.ts`: union arm and `PATCH_SCHEMAS` entry.
  - `read.ts`: select string, type and parse.
  - `src/lib/types.ts` `HairProfile`.
- **Route** modelled on `src/lib/hair-profile/onboarding-care-route.ts`: session user, strict body, CAS on stored revision, 409 `profile_conflict`, 503 on other errors. It must never call `syncPlanWithFacts` or `recomputeRoutine*`. The same route serves Personal Plan and `/beratung` participants (same user).
- **Harnesses:**
  - `tests/personal-plan-pglite-migration.fixtures.ts`: two explicit modes — _historical_ (old lock only; readers select only pre-existing columns, so `user-facts-save-v1-migration.test.ts:425-439` keeps working unlocked) and _current_ (old lock, then the shopping migration). `applyUserFactsLock` keeps the historical behaviour; a new `applyCurrentUserFacts` applies both in order. `HairProfileRow`/`readHairProfile` read `shopping_preferences` only in current mode.
  - `scripts/mobile/proof-database.ts:134-137`.
  - `tests/mobile-profile-facts-pglite.fixtures.ts:76`.
- **Tests:**
  - `tests/user-facts-lock-postgres.test.ts`: count 26→27; a new literal test against the new migration; an outside-door write of `shopping_preferences` is rejected.
  - `tests/user-facts-save-v1-migration.test.ts`: a shopping write touches no derived columns and no `quiz_context`; unknown domain still rejected.
  - schema/save unit tests.
  - a route test: never invokes sync or recompute; conflict → 409.
- **Done when:** these tests and `npm run test:node` are green, and a legacy quiz relink (`account-link.ts`) leaves `shopping_preferences` untouched (assert in the existing account-link test).

### Task 2 — Catalog `market_segment` + backfill gate

**Consumes:** nothing. **Produces:** the column, the facts field `marketSegment`, and enforcement at admission.

- **Migration:** column + value CHECK only. The `recommended ⇒ segment` CHECK ships with the backfill migration (written after Nick approves `market-segment-proposal.csv`), never earlier: even `NOT VALID` checks every UPDATE.
- **Backfill:**
  - Generate a CSV with `scripts/catalog/propose-market-segment.ts`: read-only, every `is_chaarlie_recommended` row with brand, name and the proposed segment by brand rule. Nick approves it.
  - An apply migration then sets the values and runs `VALIDATE CONSTRAINT`.
  - Neither migration is applied to production in this task.
- **Selects:** `catalog-facts.ts` (186, 238, 345, 581) and `assembleProductFacts` (`marketSegment` in common facts, plus `omitPresentationFields` so fit fingerprints don't change); `scan/presentation-rows.ts:79`; `mobile/scan-service.ts:460`; the `Product` type.
- **Eligibility:** no app-level `recommendable` change. The DB CHECK enforces "recommended ⇒ segment" once validated after backfill; an app gate before backfill would hide every unsegmented product.
- **Bondbuilder receipts:** `bondbuilder_internal_admission_readback_v1` (`20261003141320:109`), the readiness/activation-replay comparisons (`20261005121710:107,222`) and `bondbuilder_research_preimage_v1` serialize `to_jsonb(p)`. The column migration re-creates them with `to_jsonb(p) - 'market_segment'` so historical receipts still compare equal. Test: an existing receipt replays as `already_applied` after column add and after backfill.
- **Writers:**
  - `src/lib/validators/index.ts` `productSchema` (required when recommended)
  - the admin product form/API, keeping the Bondbuilder preimage key equality (`[id]/route.ts:74-110`)
  - `scripts/product-intake/promote.ts` sets `market_segment` together with `is_chaarlie_recommended = true` (value from the reviewed package) and refuses without one. The approval INSERT (`20260627122500:112`) stays untouched; intake rows are unrecommended until promotion.
  - catalog-enrichment writers (`scalp.ts`, `heat.ts`, `index.ts`) and seed scripts
  - `reviewedProductSchema` gets optional `market_segment`. Its rationale is required only when the field is present (`category-validators.ts:427` rationale list becomes conditional for this key).
- **Legacy labels:** the „Shampoo Profi“ / „Conditioner (Drogerie)“ aliases stay (category aliases, orthogonal). Add a code comment at `src/lib/product-identity/index.ts` so nobody reads them as tier.
- **Done when:** catalog-facts/pool tests show `marketSegment`; admin/promote tests reject a missing segment; the Bondbuilder receipt replay tests pass after column add and backfill; a PGlite test shows the CHECK rejects a recommended row without a segment after `VALIDATE`.

### Task 3 — Pure budget policy (TDD, rule-ID fixtures)

**Produces:** `src/lib/personal-plan/products/budget-policy.ts`:

- `inferBudgetSuggestion(ownedConsumables)`
- `orderRoleCandidates(rankedFull, budget, preservedIds)`
- `allocateBudgetPortfolio(roles, budget, context)` returning per-role `{ candidates ≤3, defaultProductId | null, labels, overBudget, exceptionReasonCriterionId?, notice }` plus `{ N, A, G, exceptionsUsed }`
- `CONCERN_DIMENSIONS` / `BUDGET_NEED_DIMENSIONS` (finite tables)

Inputs are plain data: rankings come from the existing `selectedComparisonCandidateAssessments` output (which already uses price only as a late tie-break; that comparator is not changed), prices from `priceEur` with `purchaseLinkStatus === "available"` only, and missing/invalid prices are never affordable.

- **Tests first** in `tests/personal-plan/products/budget-policy.test.ts`. Each case is named with a rule ID (B-INF-_, B-STR-_, B-FLX-_, B-GAP-_, B-OPEN-_, B-MAN-_) and independently computed expectations:
  - N = 0/1/2/3/4/8
  - G below / equal / above A
  - cross-role duplicate product counted once
  - affordable candidate beyond the old rank 12
  - strict 2+/1/0
  - equal-fit expensive rejected
  - a supported 70 € exception
  - main concern beats a cheaper secondary gain
  - cost tie-break
  - no-ceiling 60/40 with a non-comparable high option (target not forced)
  - manual over-budget preserved and counted
  - preserved choice kept in the list after a budget change
  - inference examples 8/10/14 → 15, 3/4/5 → 5, 4/4/25 → none, coverage < 80% → none
- **Done when:** all green, and an adversarial reviewer lane (the Codex plan/branch review) checks the fixtures against §4, since the author's own green tests are not evidence (memory rule).

### Task 4 — Stage 3 integration

**Consumes:** Tasks 1–3.

**Server — one allocation per proposal, consumed by every review:**

- `Stage3EvaluationContext` gains `budget` (`authority/contracts.ts:231`). It is loaded in `loadEvaluationContext` (`production-persistence-gateway.ts:500-535`) through a new `Stage3ProductionPersistence.loadShoppingPreferences`.
- New gateway-internal `proposalAllocation(draft, context, pendingIntents?)`, memoized per request by draft identity + revision + budget + pending intents:
  - evaluates every `authorityDecisionSubjects(draft)` subject once with the existing price-neutral `authoritativeReview` logic (renamed `rawAuthoritativeReview`);
  - collects preserved choices from `draft.decisions` and `pendingIntents`;
  - calls `allocateBudgetPortfolio` once.
- `authoritativeReview(draft, subject, context)` becomes raw review + that subject's allocation slice when a budget exists:
  - `evaluation.recommendation` is replaced by the allocated default (must be one of the evaluation's recommendable candidates) or `null` (strict zero), so `plan_recommendation` validation (`:1374`) and writing (`:1425`) use the budgeted pick;
  - `fitComparison.alternatives` is the allocated order (≤3 web / ≤5 native), with preserved chosen products always included;
  - `fitComparison.defaultProductId` is set.
- Because every path goes through `authoritativeReview`, review, preview (`:1189`), projected Heat (`:1247`, the allocation is recomputed for the projected draft), resolve, `evaluateDecisions`, completion (`completionDecisionsRemainCurrent`, `:571`), refinement recompute and direct acceptance all see the same allocation. No separate change in `reviewDecisionBundles`/`previewDecisionBundles`.
- Without a budget (flag off or unknown) `proposalAllocation` is not called: no new fields emitted (optional fields omitted, not `null`), same order, same bytes. Test: existing `stage3-fit-comparison` and gateway snapshots unchanged.
- `presentation` gains optional `packagePriceEur`, `marketSegment` (badge scope + display flag only), `overBudget` and `labelKind`, emitted only with a budget/flag.
- Bootstrap: a typed envelope `{ status: "budget_required" }` across `stage3-bootstrap-response-server.ts:28` composition, `bootstrap-response.ts:83` parsing, the entry routes and client bootstrap handling; bundles are skipped when the flag is on and the budget is missing.

**Client:**

- New `budget` flow phase gated in `prepareDecisionPhase` (`stage3-products-flow.tsx:1646`). It covers `flowPhaseForDraft`, `progressForPhase` and all `setPhase("decisions")` sites. After saving, the bundles reload.
- Budget change mid-selection: the client sends all pending local intents (`stage3-products-flow.tsx:2908`) through `previewDecisionBundles` and reconciles every returned role bundle — not only Oil/Heat (`stage3-preview-projection.ts:42`, `stage3-products-flow.tsx:2974` today keep only projected Heat).
- New `stage3-budget-step.tsx` uses the Stage-3 shell. The question options mirror the refinement option cards. The suggestion comes from `inferBudgetSuggestion` over captured items.
- `product-fit-comparison.tsx`: honor `defaultProductId` (lines 93-112, 717, 1651-1673); budget-aware labels replace „Beste Passung“ when the budget reorders; badges; budget line with „Ändern“; notices; a dock action falling back to „Ohne neues … weiter“ / „Mein … behalten“.

**Labs:** `fixture-gateway.ts` gets budget scenarios matching the mockup toolbar (strict 2+/1/0, flex exception/gap, open, stale).

**Tests:** stage3-fit-comparison (byte-identical without a budget), production-persistence-gateway, bootstrap-response, stage3-flow, product-fit-comparison, state-machine resume.

**Done when:** the labs walk matches `rev49` screenshots at 390 and 1280 px.

### Task 5 — Direct acceptance + previews

- Previews: `computeStage1ProductExamplePreviews` (`product-previews.ts:99-139`) first evaluates every role, then calls `allocateBudgetPortfolio` once for the whole proposal and maps each role's allocated default into its preview (one flexible allowance and one 60/40 mix per proposal, same as direct acceptance). Consultation inherits this through `load-ideal-routine.ts:308`. Without a budget: unchanged, no affordability claim.
- Preview transport carries optional `marketSegment` and `overBudget` (`product-preview-contract.ts:30`), mapped by the card adapter (`snapshot-adapter.ts:241`) and rendered as badges in the Stage-1 cards (`need-card.tsx`, `product-detail-sheet.tsx`) under the display flag.
- `accept.ts`: an injected `loadShoppingPreferences`. When the flag is on and the budget is missing → `budget_required` (409) before `completeSyntheticRefinement`. Intents use the budget-allocated default rather than raw `evaluation.recommendation`.
- `server_recommended` (freemium post-purchase provisioning): without a budget, `acceptInitialRoutine` returns `budget_required`; `plan-provisioning.ts:223` propagates it; `purchase/complete` (`route.ts:426-437`) answers `{status:"budget_required"}` (not retryable); the premium sheet (`premium-sheet.tsx`) shows the budget step, saves via the Task-1 route, then re-calls completion, which now accepts the routine. The Stripe webhook lane classifies `budget_required` as terminal-for-now, not a retry.
- Client: `acceptIdealPlanDirectly` (`plan-start-flow.tsx:1072`) runs the budget step first. The CTA reads „Weiter“ while no budget exists. The adjusted proposal note counts swaps. `interpretAcceptIdealPlanResponse` maps `budget_required`. `refreshSeenRoles` shows the updated proposal.
- **Tests:** personal-plan-direct-acceptance, seen-state-join, accept-ideal-plan, freemium-plan-provisioning, product-previews.

### Task 6 — Routine-edit gate

- Client: `personal-plan-routine-client.tsx` `openEditor`, the product change and the cadence edit check the budget, show the step, and resume the pending operation after a successful save.
- Server: `POST /api/personal-plan/routine/proposals` returns `budget_required` when the flag is on, the budget is missing and the operation changes routine content. Background recompute is exempt.
- Summary: accepted products above a new budget get the count notice and „Neue Vorschläge ansehen“, with no per-row warning for products accepted before a budget existed.
- **Tests:** routine proposal route; `personal-plan-routine-editor.spec.ts` extension.

### Task 7 — Scanner

- `load-scan-verdict.ts:84-95` receives `budget`, passed from resolve (L429-446), reveal (L126-151), discovery verdicts and `mobile/scan-service.ts:355-367`, via a narrow fail-open loader and an `isShoppingBudgetEnabled` dep.
- `buildStage3FitComparison` takes an `affordability` option: within-budget first, applied before the web slice **and** inside native final ordering (`fit-comparison.ts:364`, `compareNativePresentationCandidates` keeps its no-budget order; with a budget, affordability is the first key, then the existing comparator). No routine quota.
- New metadata is carried explicitly through every projection: `resolve-verdict.ts:311` (`alternativesFrom`), `product-presentation.ts:82` (web serialization), `mobile/scan-service.ts:204` (native alternatives). Tests assert the emitted JSON contains it.
- `ScanAlternative` gains `overBudget` and `marketSegment`. `ScanMaskedAlternative` is not changed.
- UI (`scan-verdict-sections.tsx`): caption „Bis 15 € zuerst“, over-budget badge, tier badge.
- Mobile contract: optional fields in `scan-contracts.ts`; zod must not strip them.
- **Tests:** resolve/reveal ordering with and without budget; the masked payload keeps its closed field set (`masked-alternative.ts:61`, no price/tier/overBudget keys) — its order may follow the budget; no-budget responses unchanged byte-for-byte; mobile contract parse keeps the optional fields.

### Task 8 — Consultation + cockpit

- **Intake:** `DiscoveryIntakeChecklist` adds a `budget` screen after products and before routine, with coral styling via `ui-classes.ts`. It saves through the Task-1 route.
- **Cockpit:**
  - `loadDiscoveryCockpitModel` loads the budget once and passes it to `loadIdealRoutine` and `loadVerdicts`.
  - A new `DiscoveryBudgetPanel` slot in Phase 3 (`discovery-call-cockpit.tsx:586`) uses inline radios in staff voice.
  - `PUT /api/admin/beratung/[enrollmentId]/shopping-preferences` follows the `items/[itemId]/frequency/route.ts` pattern: same-origin check, `guardDiscoveryCockpitRequest`, `refuseFinalizedIntake`, `saveUserFacts` with provenance `consultation_staff`.
  - The product table shows the over-budget euro amount and „Ausnahmen: x von y genutzt“.
- **Tests:** intake flow component test, admin route test (guard, finalized refusal), cockpit model test.

### Task 8b — Chat reads and respects the budget

- Context: use `profile.shopping_preferences` from the existing typed profile in `get-user-context.ts:287` (no extra projection).
- Deterministic selection: the chat category engine (`select-products.ts:3604` → `runCategoryEngine` → `recommendation-engine/selection.ts`) applies the standalone per-product ordering from Task 3 (within budget first, over-budget labelled; no routine quota). Owned-product assessments are unchanged.
- One agent instruction: respect the saved per-package budget; never claim affordability without one; if asked to change it, point to the budget setting (no write tool).
- **Tests:** selection test with a €5 strict profile (affordable first) and without a budget (unchanged); one `npm run test:chat` fixture.
- **Done when:** both pass.

### Task 9 — Ready + review

- `npm run ci:verify`, `npm run test:node`, `npm run test:personal-plan:nested`, `npm run test:playwright:personal-plan-stage3:journey`.
- Browser walk of journeys 1–9 on the local dev server (`docs/local-qa-access.md`: labs + dev login), mobile and desktop, with screenshots.
- One Codex whole-branch review (`codex:codex-rescue`, read-only, `--effort high`) before push.
- **Stop point:** no migration apply, flag flip, backfill apply or deploy without Nick's separate go.

## 7a. Counterpart review ledger (Codex, 2026-10-08)

| ID      | Type                   | Evidence (verified)                                                                                                                       | Decision      | Plan change                                                                           |
| ------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------- |
| C1      | defect                 | readers select new columns; app eligibility gate before backfill                                                                          | accepted      | migrations before deploy; no app gate (Task 2, §8)                                    |
| C2/C5   | defect                 | `authoritativeReview` per subject at `gateway:571,1189,1247`; `plan_recommendation` writes raw `evaluation.recommendation` (`:1374,1425`) | accepted      | one memoized `proposalAllocation` inside `authoritativeReview` (Task 4)               |
| C3      | defect                 | previews loop roles independently (`product-previews.ts:128`)                                                                             | accepted      | allocate once per proposal (Task 5)                                                   |
| C4      | defect                 | pending choices client-local; projection Heat/Oil only                                                                                    | accepted      | send all pending intents, reconcile all bundles (Task 4)                              |
| C6      | defect                 | bootstrap requires complete reviews                                                                                                       | accepted      | typed `budget_required` envelope (Task 4)                                             |
| C7      | scope/product decision | freemium provisioning → `routine_not_accepted` retry loop (`plan-provisioning.ts:223`, `purchase/complete:436`)                           | default taken | ask budget right after payment (§6)                                                   |
| C8      | defect                 | Bondbuilder receipts use `to_jsonb(p)`                                                                                                    | accepted      | `- 'market_segment'` in re-created receipt functions (Task 2)                         |
| C9      | defect                 | approval INSERT has no segment; unconditional rationales                                                                                  | accepted      | promotion sets segment; conditional rationale (Task 2)                                |
| C10     | defect                 | chat selection via category engine                                                                                                        | accepted      | standalone ordering in chat selection (Task 8b)                                       |
| C11/C12 | defect                 | explicit projections strip fields; native comparator re-sorts                                                                             | accepted      | carry fields; affordability inside native ordering (Task 7)                           |
| C13     | defect                 | unlocked historical test reads `hair_profiles`                                                                                            | accepted      | historical/current harness modes (Task 1)                                             |
| C14     | defect                 | unconditional fields change bytes; masking order                                                                                          | accepted      | optional fields omitted without budget; masking tested by field contract (Tasks 4, 7) |
| C15     | defect                 | Stage-1 cards lack tier transport                                                                                                         | accepted      | preview transport + card badges (Task 5)                                              |
| C16     | over-engineering       | profile already typed in user context                                                                                                     | accepted      | dropped extra projection (Task 8b)                                                    |

## 8. Rollout (after merge, each step separately authorized)

1. Apply the additive migrations first (Task-1 facts column + door, Task-2 column + receipt-preserving re-creates). Old code ignores the new columns.
2. Deploy code with both flags off. New readers find the columns; no behaviour change.
3. Nick approves the backfill CSV; apply the backfill migration (values + the recommended ⇒ segment CHECK).
4. Turn on `SHOPPING_BUDGET_ENABLED`.
5. Once Profi products are admitted, turn on `PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED`.

Rollback is a flag off. Saved preferences and accepted routines stay; nothing deletes facts or recategorizes products.

## 9. Execution routing

- Main session: architecture and Task 3 test design. Task 3 is implemented by Opus (judgment) to green.
- Tasks 1–2 and 7–8: Sonnet workers with disjoint write scopes. Task 1 owns `src/lib/user-facts/*` + migrations; Task 2 owns catalog/intake.
- Tasks 4–6 touch the shared Stage-3 flow, so they run sequentially in one Opus lane.
- Every handback is verified by diff read plus the named tests.

## 10. Artifact disposition

- **Commit with the task PR:** plan.md, this file, technical-handoff.md, evidence (README, prototype source, rev48/49 screenshots; PNGs need `git add -f` because of `.gitignore:92`) and the handover.
- **Archive outside the repo:** `oct7-archive/` and the earlier review transcripts.
- **Never rerun:** the availability-corrections SQL; keep it as a historical receipt.

## 11. Execution log

- 2026-10-09 Task 3 done: `budget-policy.ts`, 42/42 rule-ID tests (switched to distance-to-target after hair-care code review; conservative concern mapping). Adversarial check pending in final review.
- 2026-10-09 Task 1 done: migration `20261009100000_user_facts_shopping_preferences.sql`, schema/save/read, `POST /api/profile/shopping-preferences`, historical/current PGlite harness modes; 151 focused tests + `test:node` + typecheck green.
- 2026-10-09 Task 2 done: migration `20261009110000_products_market_segment.sql` (column + value check; Bondbuilder readback/preimage re-created with `- 'market_segment'`, byte-identical otherwise), catalog selects/facts (fingerprint-neutral), admin/promote/intake writers; 217 focused tests incl. all Bondbuilder Postgres suites green. Backfill + recommended⇒segment CHECK wait for Nick's CSV approval.
- 2026-10-09 Task 4a done: one memoized proposal allocation inside `authoritativeReview` (all review/preview/resolve/completion/writer paths), distance helper, optional budget fields on comparisons, bootstrap envelope `budget_required{suggestion}` | `saved{value}`, `loadShoppingContext` (budget + stated main concern), optional-tier roles never gaps; 287 focused + 1008 nested green.
- 2026-10-09 Task 7 done: fail-open budget read on resolve/reveal/native, standalone ordering via synthetic allocation, `overBudget`/`budgetLimitEur`/`marketSegment` carried through all projections, masked payload key set pinned unchanged; 162 scan/mobile tests green.
- 2026-10-09 Task 4b done: Stage-3 budget phase (all phase sites), `stage3-budget-step.tsx`, budget-aware labels/default/notices/badge/fallback CTA, six labs scenarios; main session added the missing bootstrap pass-through in `stage2-entry-adapter.ts` (+ regression test) and made the labs flex-improvement evidence consistent; 187 focused green.
- 2026-10-09 Task 8b done: standalone ordering in chat selection (owned products protected), tool fields `budget`/`over_budget`/`budget_note`, flag-gated system guidance, eval fixture `shampoo-saved-budget-strict` (not run: needs API + migration); 306 agent tests green.
- 2026-10-09 Main session: `POST /api/profile/shopping-preferences` returns 404 while `SHOPPING_BUDGET_ENABLED` is off.
- 2026-10-09 Task 5 done: whole-proposal preview allocation (+ overBudget/marketSegment transport and card badges), direct-acceptance `budget_required` (409; already-accepted plans win and are never asked), plan-start budget-first CTA „Weiter“ + swap-count note, freemium `budget_required`/`awaiting_budget` outcomes (no retry loop) with the budget question in the premium sheet, shared `src/components/budget/budget-question.tsx`; 203 focused green.
- 2026-10-09 Task 6 done: routine page budget projection (flag on), `openEditor` single gate + resume, proposals route 409 `budget_required` safety net (one resubmit), over-budget notice for planned (not owned) products; main session re-pointed „Neue Vorschläge ansehen“ to `/plan-start?refine=products` (the editor only offers products already in the routine); 76 routine tests green.
- 2026-10-09 Task 8 done: intake budget screen (Produkte → Budget → Routine → Hitze; skipped when saved; coral `tone="consultation"` on the shared question), cockpit model reads budget once for ideal routine + verdicts, `DiscoveryBudgetPanel` inline staff edit, staff `PUT …/shopping-preferences` (origin, guard, flag 404, finalized 409, CAS, provenance `consultation_staff`), „+X € über Budget“ pill; main session fixed „Noch was ergänzen“ to always return to products; 251 discovery tests green. Not built: cockpit exception count line (pill only).
- 2026-10-09 Task 9 ready-check: `npm run ci:verify` green (5 pre-existing lint warnings in untouched files), `npm run test:node` 11081 / 11066 pass / 0 fail, `npm run test:personal-plan:nested` 1018/1018; browser walk of `/labs/personal-plan/stage-3?scenario=budget-required` at 390 px (budget step → follow-up → strict-zero decisions, no console errors). Codex whole-branch review running.

## 12. Whole-branch review ledger (Codex, 2026-10-09)

| ID  | Severity | Finding                                                                             | Decision | Fix lane                                                       |
| --- | -------- | ----------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| R1  | High     | Premium-sheet refresh unmounts the paid budget continuation on `/routine`           | accepted | refresh only after save + completion                           |
| R2  | High     | Stage-3 resolve/complete persist budget-blind picks when flag on and budget missing | accepted | server `budget_required` (409) on new-purchase writes          |
| R3  | High     | `leave_uncovered` roles count as purchases and take exceptions                      | accepted | skipped roles are non-purchases                                |
| R4  | High     | Pending choices don't re-allocate other roles' bundles                              | accepted | project all pending intents, reconcile all bundles (budget on) |
| R5  | High     | Failed post-save reload can't recover via unchanged answer                          | accepted | retry bundle load before shortcut                              |
| R6  | Medium   | Admin create / promotion require `market_segment` with flags off                    | accepted | optional until backfill (DB CHECK enforces later)              |
| R7  | Medium   | Chat budget ordering after engine truncation                                        | accepted | order before the engine limit                                  |
| R8  | Medium   | Shopping-preferences POST without origin guard                                      | accepted | same-origin + JSON content type                                |
| R9  | Medium   | Uncapped target frozen before duplicate-merging swaps                               | accepted | recompute target per distinct N                                |
| R10 | Medium   | Stage-3 presentation never emits `marketSegment`                                    | accepted | emit scoped under display flag                                 |

Review fixes (2026-10-09): R2/R3/R9/R10 fixed (lane A; `budget_required` 409 on new-purchase resolve/complete; skipped roles are non-purchases; uncapped target per distinct N; scoped `marketSegment` presentation). Main session: gateway option `requireBudgetForNewPurchases` (default true) — the background refinement recompute opts out so legacy users without a budget keep the unknown-budget ranking instead of a stalled recompute (+ test). R1/R6/R7/R8 fixed (lane C; no refresh until budget save + completion; `market_segment` optional until backfill; engine-level budget ordering before the cut; same-origin + JSON on the budget POST). R4/R5 fixed (lane B; with a budget every pending choice re-projects all bundles; post-save reload retry before the unchanged-answer shortcut; `budget_required` → budget step with choices kept). Main session: `budget_required` added to the HTTP gateway allow-list, `Stage3ProductsGatewayErrorCode` and pending-recovery classification (+ test), otherwise it would have surfaced as `temporarily_unavailable`.

Re-verification after review fixes (2026-10-09): `npm run ci:verify` green (0 lint errors), `npm run test:node` 11091 / 11076 pass / 0 fail, `npm run test:personal-plan:nested` 1030/1030. Targeted Codex re-review of R1–R10 running.

Targeted re-review (Codex, 2026-10-09): R1–R3, R5, R6, R8–R10 closed; flags-off replay matched baseline in 178 comparison/engine/gateway calls; no R2 retry loop in direct acceptance, freemium or routine proposals. Open → fixing: R4/N1 (failed budget preview must keep decisions blocked with retry), R7 remainder (Bondbuilder engine path must apply the budget order before its cut).

Final fixes (2026-10-09): N1 closed (failed budget preview keeps decisions blocked behind the existing „Erneut prüfen“ retry; conflicts reconcile once then retry screen), R7 remainder closed (Bondbuilder engine applies the budget order before its cut; dual-lane guarantee kept, single-lane soft preference may yield to budget).

Final verification on the complete tree (2026-10-09): `npm run ci:verify` green (0 lint errors), `npm run test:node` 11095 / 11080 pass / 0 fail, `npm run test:personal-plan:nested` 1030/1030, `npm run test:agent` 919/919. Browser walk: Stage-3 labs at 390 px. Not browser-walked (DOM/route tests only): consultation intake, cockpit panel, direct acceptance, premium-sheet budget step, routine-edit gate. Not run: paid chat eval fixture `shampoo-saved-budget-strict` (needs flag + applied migration). Not built: cockpit exception-count line.

Ready for: `/ship` (commit, push, draft PR). Separate go-aheads after merge: apply migrations `20261009100000`, `20261009110000` → deploy (flags off) → Nick approves `market-segment-proposal.csv` → backfill migration with the recommended⇒segment CHECK → `SHOPPING_BUDGET_ENABLED` → `PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED` once Profi products exist.

Artifact disposition: commit with the PR — plan.md, implementation-plan.md, technical-handoff.md, handover-2026-10-07.md, market-segment-proposal.csv, evidence/ (README, prototype source, screenshots incl. PNGs via `git add -f`); archive outside the repo — evidence/oct7-archive/; keep but never rerun — availability-corrections SQL/receipts.

## 13. Decisions 2026-10-09 (after the build)

- **Exception basis confirmed (Nick):** a pricier product may only be an automatic exception where the app measures a better fit — weight and repair distance; never frizz/shine/dry lengths/tangling/split ends.
- **Bondbuilders ranked by trust level (Nick):** `claim_trust_level` high > medium > low, in chat AND Personal Plan; type (`bond_repair_axis`) and intensity no longer influence ranking. With a budget the comparison pair is „most trusted within budget" + „most trusted overall". Orchestrator defaults: K18 house default still breaks equal-trust ties; trust never creates an automatic flexible exception; fit verdict always outranks trust. Implementation in progress.
- **Intensity retirement (Nick):** separate cleanup after merge (task chip created), not in this release.

Trust-level change done (2026-10-09): Stage-3 tie among most-trusted ideal candidates (K18 default), trust ordering within verdict, `trust_pair` display mode for bondbuilder roles, chat bondbuilder rerank by fit bucket → trust → K18 → relevance (lane bonus/intensity fit removed). Resulting orders: chat no budget [K18, OLAPLEX]; chat Bis 15 € [L'Oréal, K18]; Stage 3 no budget recommendation K18; Stage 3 Bis 15 € strict [L'Oréal, K18 (über Budget), OLAPLEX]; Stage 3 Bis 5 € strict nothing preselected [K18, OLAPLEX, Epres]. Authority version not bumped (recommendation unchanged: K18). Verification: ci:verify green, test:node 11101 / 11086 / 0 fail, nested 1047/1047, agent 921/921. Targeted Codex review running.

Targeted Codex review of the trust change (2026-10-09), both fixed:
- **P1 stored choices:** a saved `select_replacement` pushed off the three-item shortlist by trust ranking (e.g. OGX) failed completion. Completion now revalidates stored choices against the full eligible ranking + fact fingerprint (new picks stay limited to what was shown); the price-neutral review keeps the stored choice in the last shortlist slot so the card still shows it. Tests B-INT-TRUST-STORED (fails without fix; changed fingerprint → `not_ready`).
- **P2 uncapped default:** `trust_pair` roles start from the preserved choice or the most trusted candidate regardless of price (B-TRUST-UNCAPPED-UNPRICED).
- **Residual (accepted, not changed):** the background refinement recompute only re-plans a previously chosen alternative that is still on the shortlist; otherwise that role becomes a visible gap (pre-existing R5 behaviour, now more likely for Bondbuilders). Fixing it needs a server-only full-ranking channel into the recompute.
Verification after these fixes (2026-10-09): `npm run ci:verify` green (0 errors, 5 pre-existing warnings), `npm run test:node` 11101 / 11086 / 0 fail, `npm run test:personal-plan:nested` 1050/1050, `npm run test:agent` 921/921 (needs `.env.local` loaded — the chat tool creates an admin client, as on main).

Equal-trust tie under a cap (Nick, 2026-10-09): Olaplex and K18 share the top trust level, so with a budget the comparison shows the cheaper one. Rule: under a cap, equally trusted products of the same fit verdict are ordered cheaper first (unpriced last in their run); without a cap K18 stays the house default. Same in Personal Plan and chat (chat reads the engine's trust rank before its cut). Resulting orders: Bis 15 € [L'Oréal (default), Olaplex, Epres]; Bis 5 € strict nothing preselected [Olaplex, Epres, K18]; Bis 5 € flexible gap fill Olaplex; chat Bis 15 € [L'Oréal, Olaplex]; uncapped / no budget unchanged (K18). Tests: B-TRUST-1..4/8, B-INT-TRUST, engine budget tests updated.
Final-delta Codex review (2026-10-09): CLEAN (keepCandidateId slot, completion revalidation, capped equal-trust cheaper-first, chat trust rank). Verification on this tree: `ci:verify` green, `test:node` 11101 / 11086 / 0 fail (CI env, without `.env.local`), nested 1050/1050, agent 921/921 (with `.env.local`). `evidence/oct7-archive/` archived to `~/AI_work/archive/profi-tier-baseline/`.
