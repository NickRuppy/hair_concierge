# Stage 3 owned-product search overflow

## Outcome and source context

When the separate “find my existing product” search has more than eight matching catalogue products, continue returning only the eight ranked matches while clearly telling the user that more matches exist and that typing a more specific brand or product name will refine the results.

Source context:

- User report and decision on 2026-08-15: eight visible results are sufficient; implement approved mockup Variant A.
- Existing search contract: `Stage3CatalogSearchResult.totalCapped` already crosses the persistence gateway, but the Stage 3 client currently drops it.
- Planning evidence: [approved Variant A](./mockups/2026-08-15-stage3-owned-search-overflow.html) and [comparison image](./mockups/2026-08-15-stage3-owned-search-overflow.png).

## Chosen direction

Keep the existing maximum of eight search candidates. Consume the existing `totalCapped` boolean in the Stage 3 flow and pass it to the result component. When `searchStatus === "ready"` and `totalCapped` is true, render the approved contextual message immediately after the list:

- Heading: `Weitere Treffer vorhanden`
- Body: `Verfeinere deine Suche mit Marke oder Produktname.`

Do not add pagination, “load more,” a second request, an exact total, or a new interaction. A more specific query automatically replaces the current search result and its capped state.

## Scope and non-goals

In scope:

- Preserve `totalCapped` from each accepted search response in client state.
- Align the pure in-memory and Labs search implementations with the production RPC definition: capped means a ninth matching product exists, not merely that eight results were returned.
- Treat search responses as request-scoped authority: every query, category, phase, draft, gateway, or product-kind context change invalidates the previous effect generation, and both fulfilled and rejected continuations must still own current authority before changing UI state.
- Set the capped state unconditionally from every accepted response, including an empty response; reset it for a query shorter than two characters and on search failure.
- Render the approved contextual card only for a ready, capped result set.
- Add deterministic component and flow regression coverage.
- Verify the real Stage 3 surface at mobile and desktop sizes.

Non-goals:

- Changing the eight-result backend or fixture limits.
- Pagination, “load more,” exact total counts, or catalogue ranking changes.
- Changing automatic recommendation candidate breadth or logic.
- Changing manual product intake, selection, cadence, analytics, database schema, or RPC signatures.
- Commit, push, PR, merge, deployment, or production mutation.

## Target map

- `src/components/personal-plan-products/stage3-products-flow.tsx`
  - Own the accepted response’s capped state, reset it at the same boundaries as results, pass it to the capture screen, and reject late success/error continuations after any search-context transition.
- `src/components/personal-plan-products/index.tsx`
  - Add the optional capped-state prop and render Variant A in `ProductCaptureScreen` immediately after `ProductSearchResults`, without placing non-option content inside the listbox. Announce the async result with `role="status"` and `aria-live="polite"`.
- `src/app/labs/personal-plan/stage-3/lab-client.tsx`, `src/lib/personal-plan/products/fixture-gateway.ts`, and `src/lib/personal-plan/products/fixture-scenarios.ts`
  - Provide a Labs-only injectable nine-product catalogue scenario so the real browser can verify eight visible results, the overflow disclosure, and refined-query removal. Make its `totalCapped` semantics match the already-accurate production RPC.
- `src/lib/personal-plan/products/inventory-search.ts`
  - Keep eight returned candidates while deriving `totalCapped` from the full matching set, matching the production RPC at the exact-eight boundary.
- `tests/personal-plan-stage3-components.test.tsx`
  - Prove the approved copy appears only for a ready capped result set and preserves result semantics.
- `tests/personal-plan-stage3-flow.test.tsx`
  - Prove `totalCapped` crosses the gateway-to-component boundary and clears when the query becomes too short or a later response is uncapped. Use deferred promises to prove a late success cannot undo a short-query reset, a late rejection cannot overwrite a newer success, and leaving capture context invalidates an in-flight response.
- `tests/personal-plan-stage3.spec.ts`
  - Exercise the capped-state hint through the Labs-only nine-product scenario at mobile and desktop sizes; keep this layout/journey proof distinct from production-gateway semantics.
- `tests/personal-plan-stage3-gateway.test.ts` and `tests/personal-plan/products/inventory-search-contracts.test.ts`
  - Prove exactly eight matches are not marked capped and nine matches return eight candidates with `totalCapped: true`.
- `plans/mockups/2026-08-15-stage3-owned-search-overflow.{html,png}`
  - Commit as approved design evidence.
- `plans/receipts/`
  - Commit final readiness/review receipts and the retained mobile/desktop/refined browser captures; discard the setup-only cookie-banner capture and transient counterpart output.

## Designed user journey

Actor: a Personal Plan user identifying an existing product in Stage 3.

Entry condition: the user is on a category capture screen and has not yet selected the desired product.

1. The user types at least two characters into `Produkt suchen`.
2. The system searches the current canonical category and displays at most eight ranked matches.
3. If all matching products fit inside those results, the screen remains unchanged and shows no overflow message.
4. If more matching products exist, the system displays the approved contextual card directly below the eight results: `Weitere Treffer vorhanden` / `Verfeinere deine Suche mit Marke oder Produktname.`
5. The user can select any visible product, type more letters in the same field to narrow the results, or use the existing `Nicht dabei? Produkt hinzufügen` path.
6. On a refined query, the old results and old capped signal are replaced only by the accepted latest response. If the refined result is no longer capped, the contextual card disappears.
7. If the query becomes shorter than two characters, results and the contextual card clear and the existing minimum-character guidance returns.
8. If search fails, the contextual card is removed and the existing retry/manual-intake error state remains authoritative.
9. If an older request settles after the query or search context has changed, neither its success nor its failure may alter the current results, capped signal, or status.

Completion: the user either selects the correct catalogue product and continues with cadence, or enters the existing manual-intake path. No additional save or pagination boundary is introduced.

Meaningful variants:

- Uncapped ready results: no contextual card.
- Capped ready results: contextual card after the listbox.
- Loading: existing loading message; no stale contextual card.
- Empty/error/short query: existing state-specific message; no contextual card.
- Late/stale response: existing request-token guard prevents it from replacing the current query’s results or capped signal.

User-journey sign-off: **confirmed 2026-08-15**. Nick reviewed the three contextual variants and explicitly chose Variant A while confirming that eight visible results are sufficient because users can refine by typing more letters.

## Planning evidence

- [Rendered HTML comparison](./mockups/2026-08-15-stage3-owned-search-overflow.html): compared a contextual card, compact status line, and action card inside the current Stage 3 search hierarchy.
- [Rendered comparison image](./mockups/2026-08-15-stage3-owned-search-overflow.png): showed all eight results, the overflow state, and the existing manual-add action together.
- Decision answered: how to disclose capped results without pagination or a new interaction.
- Selected direction: Variant A, a calm contextual card after the result list.
- Feedback incorporated: preserve the eight-result limit; users refine by typing more characters; the message exists as an assurance, not an invitation to browse more.
- Evidence review: **confirmed 2026-08-15**.
- Prototype: not used; the behavior is a static conditional state on an existing controlled search field.

## Ordered tasks

### 1. Add the regression guards for capped-state propagation and rendering

Consumes: existing `Stage3CatalogSearchResult.totalCapped` and approved exact German copy.

Produces: failing component and flow tests that demonstrate the currently dropped signal.

- Add a component assertion that ready capped results render the heading/body after the listbox and uncapped results do not.
- Add a flow assertion that a gateway response with `totalCapped: true` reaches `ProductCaptureScreen`, then clears for a short query or accepted uncapped response.
- Add deferred-promise flow assertions for short-query reset versus late success, newer success versus late old rejection, and capture-context exit versus late success.

Completion criterion: the focused tests fail for the missing production behavior for the expected reason before implementation.

### 2. Preserve and present the existing capped-state signal

Consumes: the failing tests and `totalCapped` from the accepted request-token response.

Produces: a `searchTotalCapped` client state and optional component prop used only by the approved ready-state card.

- Initialize false.
- Set from the accepted search response alongside results/status.
- Set from every accepted response unconditionally so a capped-ready to empty transition cannot retain stale state.
- Clear at short-query and error boundaries; the loading state must not display the ready-state card.
- Allocate request authority for every search-effect generation, deactivate it during cleanup, and require the local token plus echoed gateway token for success; require the local current token for failure.
- Render Variant A in `ProductCaptureScreen` after, not inside, the result listbox, using `role="status"` and `aria-live="polite"`.
- Do not change the production RPC, limits, ranking, selection, or analytics contracts. Align pure and Labs implementations to the RPC's existing `matched_count > limit` meaning.

Completion criterion: the focused component and flow tests pass, including capped-to-uncapped and reset transitions.

### 3. Verify the user-visible quality improvement and complete review

Consumes: the final implementation and approved journey.

Produces: browser evidence and matching readiness/review receipts for the exact content fingerprint.

- Run focused Stage 3 component, flow, gateway, API, analytics, and inventory-search contract tests.
- Run `npm run typecheck`, `npm run lint`, and focused test commands plus the repository checks selected by the Codex `ready-check` gate; record the concrete commands in its receipt.
- Verify at 375x844 and 1440x900: card appears only for capped ready results, remains contained, follows the eighth result, and disappears after a sufficiently refined uncapped query.
- Keep fixture browser proof distinct from production-gateway proof; use focused production-gateway tests for the latter.
- Run the required whole-branch counterpart review through `request-code-review`, verify findings locally, and refresh affected checks/receipts after any code change.
- The Codex session is the executor; `ready-check` and `request-code-review` are repo workflow gates, not npm script names.

Completion criterion: no blocking verified finding remains; readiness and review receipts share the same canonical content fingerprint; the branch is review-ready without publication.

## Verification

Automated:

- Red-first focused component and flow regressions.
- Stage 3 component/flow/API/gateway/search-contract suites.
- Typecheck and lint.
- Any additional risk-proportional checks required by `ready-check`.

Manual/browser:

- Mobile 375x844 and desktop 1440x900.
- Broad capped query, refined uncapped query, selection, and manual-add adjacency.
- No horizontal overflow and no non-option content inside the listbox.

Live-state:

- No migration or production write is required.
- Later production quality verification is a separate release gate: after deployment authorization, replay a known category/query with more than eight matches and confirm the hint, then refine until the desired candidate appears and the hint clears. Do not claim production proof from Labs fixtures.
- Production uses the RPC's accurate `matched_count > limit` definition. The pure in-memory and Labs implementations now share that definition, with exact-eight and ninth-match regression coverage. Later factual production proof must still use the production gateway rather than treating fixture layout proof as live-state evidence.

Evidence-sensitive review:

- Confirm exact German copy and Variant A hierarchy against the approved artifact.
- Confirm no implication that automatic recommendations are limited to eight.

## Review and handoff

- Worktree: `.worktrees/stage3-owned-search-overflow`
- Branch: `codex/stage3-owned-search-overflow`, based on fresh `origin/main` at `23626d7d`.
- Execution: sequential because the state, component, and tests are tightly coupled.
- Plan review: **approved with minor revisions 2026-08-15** by the required Claude Opus 4.8 read-only lane. No blocker; accepted recommendations were unconditional accepted-response assignment, explicit live-region semantics, and documentation of the fixture boundary. A later whole-branch review correctly identified the pure/Labs exact-eight divergence; its production characterization was rejected after verifying that the live RPC already uses `matched_count > limit`, while the supported contract-alignment finding was fixed and regression-tested. Transient reports will be discarded.
- Publication stop: verified local branch only.
- Rollout risk: a stale capped hint if reset/accepted-response boundaries diverge from result state; guarded explicitly in flow tests.
- Review correction: the final integration pass found that fulfilled searches were token-guarded only against newer valid searches, while short/context resets did not advance authority and rejection was unguarded. Deferred-promise regressions reproduced both failures before the lifecycle-authority fix.
- Artifact disposition:
  - Commit: this plan, approved HTML/PNG mockup, renderer, production code, Labs-only browser scenario, tests, retained browser captures, and final receipts.
  - Discard: setup-only cookie-banner capture and transient Claude reports in the system temporary directory.
  - Archive: none.
