# Personal Plan Stage 3 uncovered-product choices

Status: approved for implementation
Evidence review: confirmed — variant B plus reconciled supportive/zero-candidate states
Designed user-journey sign-off: confirmed by Nick on 2026-08-14 (`ok implement with workers and explorers`)

## 1. Outcome and source context

When the final Bedarfsplan requires a product role that the user does not already own, Stage 3 supplies the exact product bridge. The normal supported state presents three server-verified products: Chaarlie's best recommendation and two alternatives. The user compares and chooses one; Stage 3 does not make the user invent a recommendation through `Produkt suchen`.

Observed production-shaped state supplied by Nick on 2026-08-14:

- `Du hast noch kein Leave-in`
- `Noch keine streng passende Produktempfehlung im verifizierten Katalog.`
- primary CTA `Produkt suchen`

Verified repository cause:

- Leave-in and Conditioner uncovered-role authority accept the best `ideal` candidate or, when no ideal exists, the best `supportive` candidate.
- `selectedComparisonCandidateAssessments()` later applies an uncovered-role-only `ideal` filter, discarding every supportive recommendation from the comparison allowlist.
- `UncoveredRecommendationReview` then receives zero cards; the component promotes `onSearch` to the primary CTA.
- The uncovered presentation also hard-codes displayed candidate verdicts as `ideal`, so simply removing the filter would misrepresent supportive candidates.

This proves a code path that produces the reported class of dead end. It does not prove which candidate facts were present in Nick's exact production request because that request/response payload was not captured.

Blast-radius audit: Leave-in and Conditioner are the only current adapters whose uncovered branch can authorize a `supportive` recommendation. Shampoo, Mask, Oil, Deep Cleansing Shampoo, Bondbuilder, Heat Protectant, Scalp Care, and Dry Shampoo require their category-specific verified ideal/equivalent candidate contract; removing the global filter is therefore behavior-changing only for Leave-in and Conditioner under current adapters. The implementation matrix still locks all ten categories so a future adapter change cannot silently widen the set.

Source contracts retained from the existing journey:

- final Bedarfsplan authority determines required categories and roles;
- Stage 3 resolves exact products before Routine;
- selectable alternatives are bounded, server-authored, fingerprinted, and revalidated on save and completion;
- selected additions remain `Noch kaufen` and non-executable until acquired;
- at most three alternatives are exposed in a review bundle.

Planning evidence: [three compared variants](mockups/2026-08-14-uncovered-product-choices.html).

## 2. Chosen direction

Use reviewed variant B: keep Chaarlie's best recommendation fixed in the first card and show one alternative beside it. Arrows rotate the second card through the remaining alternatives. With three candidates the control reads `Alternative 1 von 2` or `Alternative 2 von 2`; the set is three products total, not three alternatives in addition to the recommendation.

Candidate policy remains server-authoritative:

1. Load only active, active-lifecycle, Chaarlie-recommended catalog products with normalized category facts and the required application protocol.
2. Evaluate each candidate independently against the exact signed role target.
3. Exclude `mismatch`, `unknown`, unsafe, inactive, incomplete-protocol, wrong-role, and non-recommendable candidates.
4. Admit `ideal` and `supportive` candidates only when the existing category adapter can produce a valid recommendation for that detached candidate. This does not weaken category-specific authority rules.
5. Rank the current authority recommendation first, then `ideal` before `supportive`, then deterministic catalog order and product ID.
6. Return at most three exact candidates with their current fact fingerprints.

The extra uncovered-role `ideal`-only filter is removed. Each card and evidence row renders the candidate's own verdict and relation. A supportive option is described as a suitable alternative with its documented trade-off; it is never styled or described as an ideal match. When the first-ranked candidate is ideal its card label is `Beste Passung`; when every eligible candidate is supportive the label becomes `Beste verfügbare Option` so ranking does not overstate fit.

Selection remains presentation-only until the user presses `Dieses Produkt einplanen`. The submitted intent contains the exact selected product ID and fact fingerprint and continues through existing `select_replacement` validation, planned-product persistence, conflict recovery, and completion revalidation.

`Produkt suchen` is removed only from the uncovered-role decision screen. Search remains available in Stage 3 Pass 1 when the user is identifying a product they actually own. `Vorerst ohne Produkt fortfahren` remains a quiet secondary action when server-authorized.

Catalog coverage rule:

- The supported launch matrix is expected to yield three selectable candidates for every uncovered role that requires a new exact product.
- Implementation includes a read-only coverage audit over production-shaped fixtures. If any supported target yields fewer than three candidates, the product code still renders every safe available candidate honestly, but release stops and the missing catalog coverage is handed to the separate `product-intake` workflow.
- The UI never pads the set with a mismatch or unknown product. Catalog enrichment, approval, publication, and production data changes are not authorized by this plan.

## 3. Scope and non-goals

### In scope

- correct uncovered-role candidate selection and deterministic ordering;
- selected variant B for one, two, and three eligible candidates;
- truthful ideal/supportive card and evidence presentation;
- remove self-directed search from the uncovered decision state;
- exact-candidate save, conflict-recovery, completion-revalidation, and planned-purchase regressions;
- category/role coverage audit and release evidence;
- mobile and desktop browser proof for the chosen state and its degraded/error variants.

### Non-goals

- changing Bedarf or refinement logic;
- inventing a category, role, target, or recommendation outside the signed Bedarfsplan authority;
- weakening category safety, strict mismatch, missing-fact, or protocol gates;
- changing product search while the user records owned inventory;
- product research, intake approval, catalog publication, migrations, or production writes;
- changing Routine or Anwendung behavior beyond proving the selected product retains the existing planned/acquired lifecycle;
- deployment, feature activation, publication, merge, or cleanup.

## 4. Target map

| Surface | Planned responsibility |
| --- | --- |
| `src/lib/personal-plan/products/fit-comparison.ts` | Remove the contradictory uncovered-role ideal-only filter; preserve detached evaluation, recommendation authorization, bounds, ordering, and fingerprints. |
| `src/lib/personal-plan/products/authority/categories/deep-cleansing-shampoo.ts` | Preserve the exact requested reset role when authoring an uncovered recommendation; the coverage audit found `mineral_reset` was incorrectly labeled `residue_reset` and then rejected by the exact-role boundary. |
| `src/components/personal-plan-products/product-fit-comparison.tsx` and `stage3-product-copy.ts` | Implement the grammatically correct category-specific `Wähle …` heading, reviewed variant B cards/navigation, conditional top-card label, candidate-relative verdict/evidence, short selection CTA, zero-candidate retry, and no uncovered search action. |
| `src/lib/personal-plan/products/fixture-scenarios.ts` | Own the Labs-only uncovered Conditioner entry context without pushing the existing fixture gateway past 1,000 lines. |
| `tests/personal-plan/products/stage3-fit-comparison.test.ts` | Red regressions for uncovered ideal/supportive selection, exclusion rules, ranking, candidate bounds, fingerprints, and one/two/three/zero candidate sets. |
| `tests/personal-plan-product-fit-comparison.test.tsx` | Variant B presentation, navigation, selection-vs-browsing, supportive truthfulness, short CTA, no search, quiet uncovered action, and degraded states. |
| `tests/personal-plan-stage3-flow.test.tsx` | Exact selected candidate intent, retry/conflict preservation, transition to next review, and no route back to self-directed search from an uncovered decision. |
| `tests/personal-plan/products/production-persistence-gateway.test.ts` | Forged/stale candidate rejection, planned-purchase persistence, completion revalidation, and selected supportive candidate coverage. |
| `tests/personal-plan-stage3.spec.ts` and Stage 3 Labs route | Browser proof at mobile and desktop for the three-product carousel and lifecycle handoff. Search assertions for inventory capture remain separate. |

No response schema or database migration is required: `Stage3SelectedComparisonCandidate.verdict` already expresses `ideal | supportive`, and the comparison already carries candidate-relative criteria/evidence.

Implementation discovery: the launch-matrix fixture audit initially failed only for `deep_cleansing_shampoo/mineral_reset` with zero selectable candidates. The adapter evaluated the candidate against `mineral_reset` but authored the returned recommendation with a hard-coded `residue_reset` role. The implementation now carries `input.role` into both the recommendation role and its stable ID; the matrix test locks three exact candidates for every currently supported category/role fixture.

## 5. Designed user journey

### Entry condition

The final Bedarfsplan requires a category/role, such as `Leave-in · Pflege im feuchten Haar`, and the user has confirmed that they do not own a product for it. The signed authority snapshot is current and Stage 3 has loaded the bounded recommendation bundle.

### Normal three-product state

1. The review opens at the top with the category, role, and progress: for example `Leave-in · Pflege im feuchten Haar · Produkt 3 von 5`.
2. The heading says `Wähle dein Leave-in` and explains that Chaarlie has selected three checked products for this need.
3. The first card is fixed and labeled `Beste Passung` when ideal. If the best available candidate is supportive, it says `Beste verfügbare Option` and shows its documented trade-off. The second card shows `Alternative 1`.
4. The product cards show complete product identity and the compact decision-relevant difference. They do not claim the absent owned product fits or fails.
5. If the displayed option is supportive, its own documented trade-off is visible. An ideal sibling does not lend its status to that option.
6. Arrows change the second card between `Alternative 1 von 2` and `Alternative 2 von 2`. Browsing does not save or silently change the selected product.
7. Tapping either visible card marks that exact product as selected. The evidence updates to the selected comparison without saving.
8. The sticky primary CTA says `Dieses Produkt einplanen`. Pressing it submits the selected product ID and current fact fingerprint.
9. During save the choice is disabled and the existing concise pending feedback remains visible. A successful save advances to the next unresolved Stage 3 review.
10. The selected product becomes a planned purchase. Routine labels it `Noch kaufen`; it remains non-executable until the user records acquisition through the existing lifecycle.

### One or two eligible products

- With two products, both cards are visible and no alternative arrows appear.
- With one product, one complete recommendation card appears without an empty second slot or carousel.
- The same explicit selection CTA is used. The UI does not invent products or reopen search.
- These states are honest runtime degradation, but a supported launch-matrix count below three blocks release pending catalog coverage work.

### Zero eligible products

- This is an authority/catalog-availability failure, not a normal shopping task.
- The user sees a compact complete state: `Gerade ist keine geprüfte Empfehlung verfügbar.` It says their saved Bedarf remains intact.
- The primary recovery is `Erneut prüfen` when reload is available. `Vorerst ohne Produkt fortfahren` remains secondary only when authorized.
- `Produkt suchen` is absent. No generic product can be planned without passing authority.
- The state is logged through the existing privacy-safe Stage 3 error/availability seam; it does not expose profile or catalog facts in the client error.

### Conflict, stale facts, and request recovery

- Duplicate presses remain blocked.
- A revision conflict loads the canonical latest draft and requires explicit user action; it does not resubmit a stale candidate.
- If the candidate or fingerprint changed, canonical reload rebuilds the cards and clears any selection that is no longer in the allowlist.
- A lost response uses the existing bounded pending-recovery path. Completion revalidates the exact candidate and fingerprint before Routine compilation.

### Other choices and completion

- `Vorerst ohne Produkt fortfahren` remains inside `Andere Möglichkeit` only when `leave_uncovered` is authorized.
- Back navigation retains the existing Stage 3 review behavior.
- After the final successful decision, Stage 3 opens Routine directly. No selected planned product is treated as owned or executable.

## 6. Planning evidence

Artifact: [rendered three-variant comparison](mockups/2026-08-14-uncovered-product-choices.html).

Question answered: how should three authoritative choices be presented on mobile without returning the user to self-directed search?

Compared directions:

- A: all three complete cards visible;
- B: fixed best recommendation plus one alternative card, with arrows for the second alternative;
- C: one dominant recommendation plus two compact alternatives.

Selected direction: B.

Feedback incorporated: Nick selected B on 2026-08-14. The plan therefore uses three total products, preserves the familiar side-by-side comparison, and makes the second alternative reachable through the existing navigation pattern. Counterpart reconciliation added two bounded B variants to the same artifact: `Beste verfügbare Option` when all candidates are supportive, and `Erneut prüfen` without search when no authoritative candidate is available.

Evidence-review status: confirmed. Nick's implementation authorization followed the final walkthrough containing the reconciled supportive and zero-candidate variants.

Prototype: not required. The choice was information hierarchy and responsive density; the rendered static artifact made the consequential difference reviewable. Existing tested controls already establish the card-selection and carousel interaction model.

Artifact disposition: commit the HTML mockup with the plan. The rendered PNG is transient preview output and remains ignored/discardable.

## 7. Ordered tasks

### Task 1 — Lock the corrected candidate contract with red tests

Add fit-comparison fixtures for uncovered Leave-in and Conditioner roles where the authority recommendation is supportive and no ideal product exists. Prove that the current code returns zero comparison candidates, then require the supportive candidate to appear with its own verdict, fingerprint, and recommendation.

Add category/role fixtures covering:

- three eligible candidates ordered recommendation-first, ideal before supportive, then stable catalog order;
- reversed input producing the same result;
- exclusion of mismatch, unknown, unsafe/known-reaction, inactive, retired, incomplete-protocol, wrong-role, and non-recommendable products;
- candidate limits of zero, one, two, and three;
- the current blast radius explicitly: supportive uncovered recommendations appear for Leave-in and Conditioner, while Shampoo, Mask, Oil, Deep Cleansing Shampoo, Bondbuilder, Heat Protectant, Scalp Care, and Dry Shampoo retain their stricter category-specific eligibility;
- no candidate created from absent or unsigned authority.

Completion: the supportive uncovered-role regression fails on current `main`; all exclusions and deterministic-order fixtures state the existing safety boundary explicitly.

### Task 2 — Reconcile candidates and presentation as one atomic slice

Consumes: signed `Stage3AuthorityInput`, normalized recommendation candidates, detached category evaluations, adapter-produced recommendation, and fact fingerprints.

Change the comparison projection so an uncovered role no longer applies a second universal `ideal`-only gate after the category adapter has already authorized the detached candidate. Continue to require a detached `ideal` or `supportive` verdict and a valid adapter-produced recommendation for the exact candidate/role.

Preserve the maximum of three, deterministic order, candidate-relative criteria, current recommendation priority, and exact fingerprint. Do not add `select_replacement` to adapter `allowedActions`; the current comparison bundle remains the selection allowlist.

In the same atomic implementation slice, update `UncoveredRecommendationReview` to:

- replace `Du hast noch kein …` with the explicit `Wähle dein …` heading;
- render the first ranked ideal candidate as `Beste Passung`, or the first-ranked all-supportive candidate as `Beste verfügbare Option`, with one browsable alternative beside it;
- label navigation as alternatives out of the remaining count (`1 von 2` for three total candidates);
- preserve presentation-only browsing separately from explicit card selection;
- render candidate-relative verdict/evidence instead of hard-coded `ideal`;
- use `Dieses Produkt einplanen` as the short sticky CTA;
- remove `Produkt suchen` from normal, degraded, and zero-candidate uncovered decision states;
- wire the already-supplied `onRetry` callback to an `Erneut prüfen` primary action in the zero-candidate uncovered state;
- preserve `Vorerst ohne Produkt fortfahren` only as a server-authorized quiet action;
- show deliberate one-card, two-card, and no-candidate layouts with no empty slots.

Keep `Produkt suchen` unchanged in the owned-product capture surface.

This projection and component work must not land separately: returning supportive candidates while retaining the current hard-coded `ideal` card verdict would create a temporary truthful-authority regression.

Produces: a bounded comparison consistent with category authority plus the reviewed Stage 3 presentation and unchanged semantic intent payload.

Completion: Task 1 and component tests pass; forged, mismatching, unknown, incomplete, or stale candidates remain absent; all visible states, conditional top-card labels, arrow semantics, retry, exact selection, keyboard/accessible names, and absence of uncovered search are proved; no persisted schema changes.

### Task 3 — Prove persistence, recovery, and lifecycle integrity

Consumes: selected exact product ID/fingerprint and the existing `select_replacement` mutation path.

Extend flow and production-gateway coverage to prove:

- selecting either the best recommendation or either alternative saves that exact product;
- the resulting decision is `planned_purchase`, not owned/executable;
- stale or forged candidates fail closed;
- conflict and pending-recovery reload canonical candidates and never silently substitute another product;
- completion revalidates the selected fingerprint;
- Routine retains `Noch kaufen` until the existing acquisition action succeeds.

Completion: focused flow/gateway/portfolio/Routine tests pass with all three choices and with a supportive selection.

### Task 4 — Close browser and catalog-coverage evidence

Add or update the Stage 3 Lab fixture for an uncovered Leave-in with one ideal and two safe alternatives. At `375px`, `400px`, and desktop, prove category/progress, two adjacent product cards, alternative `1 von 2` navigation, exact selection, short sticky CTA, quiet secondary action, and no document/CTA overflow. Prove the selected planned product appears as `Noch kaufen` in Routine.

Run a read-only production-shaped coverage audit across the supported final-Bedarfsplan category/role/profile fixture matrix. Record candidate counts and exact failing target keys without customer data. Do not modify catalog data.

Completion: browser checks pass; every supported uncovered role yields three selectable candidates. Any smaller count blocks release and is handed to product intake as a separate approval-gated catalog task.

## 8. Verification

### Automated

- focused Stage 3 authority, fit-comparison, component, flow, gateway, portfolio, and Routine tests;
- API/schema compatibility tests to prove no transport migration is required;
- TypeScript, lint, and `git diff --check` through `ready-check`;
- `npm run ci:verify` when the repository gate requires the full build lane;
- exact focused browser spec for the Labs fixture at mobile and desktop.

### Manual/browser

- compare the implemented surface to selected mockup B at `375px`, `400px`, and desktop;
- inspect long German product names, price/content presence and absence, card selection, arrow focus, sticky CTA, and `Andere Möglichkeit` containment;
- verify one-, two-, three-, and zero-candidate states;
- verify keyboard traversal and live/focus feedback when the alternative changes or the next review opens.

### Catalog/live-state

- read-only candidate-count audit only;
- no Supabase migration, product mutation, publication, activation, or deployment;
- if live verification is later authorized, validate current schema columns first and keep production-gateway proof distinct from the Labs fixture.

### Evidence-sensitive review

- confirm supportive copy describes the actual candidate-relative trade-off and does not imply a failed safety/strict gate;
- confirm absent-owned-product screens make no verdict about a product the user does not have;
- confirm the exact-product bridge remains derived solely from signed Bedarfsplan authority.

## 9. Review and handoff

Worktree: `.worktrees/personal-plan-uncovered-product-choices`

Branch: `codex/personal-plan-uncovered-product-choices`

Required gates:

1. Claude plan review and reconciled findings ledger;
2. Nick's explicit designed-user-journey sign-off after the reconciled walkthrough;
3. `implementation-loop`, which owns test-first execution, `ready-check`, and `request-code-review`;
4. separate explicit `ship it` authorization before commit/push/draft PR;
5. separate merge, deployment, production-write, product-intake, and cleanup authorization.

Artifact disposition:

- commit: this plan and selected HTML mockup;
- discard/ignore: rendered PNG and transient Claude review output;
- no unresolved task artifact may be silently deleted.

Stop point: planning ends after counterpart findings are reconciled and Nick explicitly confirms the designed journey. Do not begin implementation before that confirmation.

Implementation preflight risk: the current data volume has only about 117 MiB free and reports 100% capacity. `implementation-loop` must recheck disk space before installing, building, or running browser tests and stop for explicit cleanup direction if still constrained; this plan authorizes no deletion.

## 10. Counterpart findings ledger

Claude Opus 4.8 reviewed the plan read-only at `high` effort on 2026-08-14. Its transient report remains outside the repository.

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | The global uncovered `ideal` filter affects any adapter that can authorize supportive recommendations. | accepted | Audited all ten adapters; Task 1 now names Leave-in and Conditioner as supportive-capable and locks the other eight stricter contracts. | Local adapter inspection completed. |
| C2 | scope/product decision | `Beste Passung` can overstate an all-supportive shortlist. | accepted | Use `Beste Passung` only for an ideal top candidate; use `Beste verfügbare Option` when all candidates are supportive. | Journey and Task 2 updated. |
| C3 | defect | Removing search would leave the known/unknown zero-candidate branch without the planned retry action. | accepted | Task 2 now explicitly wires existing `onRetry` to `Erneut prüfen` for the uncovered zero state. | Current component wiring verified locally. |
| C4 | defect | Planned heading/card copy differed from current strings but was not explicit in tasks. | accepted | Target map and Task 2 now name `Wähle dein …`, top-card labels, and CTA changes exactly. | `git diff --check` and plan consistency scan passed. |
| C5 | tradeoff | A schema-change hedge was unnecessary because candidate verdict/evidence already exists. | accepted | Removed the hedge and recorded that no response-schema change is required. | Existing types inspected locally. |
| C6 | tradeoff | `stage3-products-flow.tsx` might not require a production edit because the component can suppress search and already receives `onRetry`. | accepted | Removed it from the production target map; flow coverage remains for recovery and intent behavior. | Existing prop wiring inspected locally. |
| C7 | defect | Claude encountered `ENOSPC`; implementation tests may fail independently of code. | accepted | Added a non-destructive disk-space preflight and explicit cleanup stop. | `df` confirmed about 117 MiB free; no cleanup performed. |
