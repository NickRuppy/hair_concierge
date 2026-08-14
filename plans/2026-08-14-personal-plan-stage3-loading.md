# Personal Plan Stage 3 loading simplification

## Outcome and source context

The Stage 3 product-selection journey should stop exposing each persistence round trip as a full-page loading screen. The initiating report is the 2026-08-14 screenshot showing `Produkte werden gespeichert.` after a product choice.

Current source and test evidence:

- `stage3-products-flow.tsx` replaces the complete content area for final-category saving, every individual fit decision, authority reloading, completion, and Routine handoff.
- `chooseFitDecision` performs a decision `PATCH`, then a canonical `GET` that reloads and recomputes review bundles before the next product appears.
- The focused current-state harness confirms that final category saving, pending-product decisions, and clear-fit decisions intentionally render `Stage3SystemState state="loading"` while their promises are unresolved.
- The production gateway and API already support validated grouped decisions through `resolveDecisions`; durable recovery already models a `decision_batch`.

## Chosen direction

Use a locally durable review session followed by one server-validated batch submission:

1. Keep non-final category captures on the existing persisted background queue.
2. Do not replace the last category with a save interstitial. Keep the stable product surface visible with an inline `Wird gespeichert` state until the server-authoritative fit review is ready.
3. During product-fit review, record each choice locally, advance immediately to the next already-loaded review bundle, and allow Back to revise choices. Do not issue a mutation per choice.
4. The last product choice is the user's confirmation. Immediately after that choice, write one durable `decision_batch` recovery intent, submit fit choices through the existing batch endpoint, acknowledge any inventory dispositions through their existing idempotent action, and keep one final `Dein Plan wird vorbereitet` screen visible while those final mutations, canonical completion, and Routine handoff finish. Do not insert a separate summary or `Plan fertigstellen` confirmation screen.
5. If final submission fails or conflicts, retain the local choices and show an actionable retry/review state. Full-page recovery checking remains valid only for an uncertain request outcome or reload recovery.

This removes repeated interruptions and also removes the current serial `PATCH` + canonical `GET` from each fit decision. It does not claim a specific millisecond improvement before a browser/network benchmark is run.

## Scope and non-goals

### In scope

- Stage 3 category-finalization feedback.
- Stage 3 individual fit-review navigation and locally durable choice state.
- Batch decision submission, canonical completion, and recovery behavior.
- Loading/error/saved copy and accessibility state for the changed transitions.
- Client/server timing evidence and a regression harness that can hold requests unresolved.

### Non-goals

- Changing Bedarf or refinement authority.
- Changing product-fit rules, allowed actions, alternatives, or recommendation truthfulness.
- Making pending, planned, mismatching, inactive, or uncovered products executable.
- Changing Routine or Anwendung content.
- Production rollout, feature-flag activation, migration, publication, merge, or deployment.
- Broad database optimization without timing evidence from the exact request path.

## Target map

- `src/components/personal-plan-products/stage3-products-flow.tsx`: review-session state, inline/final feedback, batch submission, recovery handoff.
- `src/components/personal-plan-products/use-stage3-category-capture-controller.ts`: final-category transition without a blocking interstitial; preserve persisted queue semantics.
- `src/components/personal-plan-products/product-fit-comparison.tsx`: selected/revisable local decision state and final-review CTA if required by the chosen composition.
- `src/lib/personal-plan/products/pending-recovery.ts`: reuse the existing `decision_batch` persistence and replay path; do not create a parallel local serializer.
- `src/lib/personal-plan/products/gateway.ts`, `src/lib/personal-plan/products/production-persistence-gateway.ts`, and `src/app/api/personal-plan/stage-3/route.ts`: preserve the existing batch-decision and idempotent inventory-disposition contracts; use their returned revisions in one final client-controlled sequence rather than widening the authority-intent union.
- `tests/personal-plan-stage3-flow.test.tsx`: red-capable unresolved-request tests for no repeated full-page loader, immediate next-review navigation, one batch request, retry, conflict, and duplicate suppression.
- `tests/personal-plan-stage3.spec.ts`: browser journey and network request-count assertion at the real Stage 3 surface.

## Designed user journey

Status: corrected and reconfirmed by Nick on 2026-08-14 after reviewing the shipped confirmation screen (`remove it, not needed to confirm this -> it is clear when users select it - worst case they can go back`).

1. An authenticated Personal Plan user enters **Produkte** with a current refined Bedarfsplan.
2. The user identifies products category by category. After confirming a non-final category, the next category appears immediately; the journey header briefly says `Wird gespeichert` and then `Gespeichert`.
3. After the last category, the stable category surface remains visible with its CTA disabled and inline `Wird gespeichert`. There is no dedicated `Produkte werden gespeichert` page. As soon as the authoritative review bundle is ready, the first fit review replaces it.
4. The user reviews one exact product at a time. Choosing `Passt – behalten`, an informed override, a replacement, a planned product, or an uncovered disposition records that choice locally and immediately shows the next review. The header says `Auswahl gemerkt`; Back restores the prior card and selected choice. The existing Back action is the correction path before the user makes the final choice.
5. The last product choice immediately shows the one full-page state: `Dein Plan wird vorbereitet.` There is no intervening summary or confirmation screen. The preparation state covers batch validation/save, portfolio completion, and Routine navigation rather than flashing separate save, preparation, and Routine loaders.
6. On success, Routine opens. If navigation does not occur, the existing recovery action `Routine öffnen` appears.
7. If final submission fails before a confirmed response, the reviewed choices remain available. The user sees `Deine Auswahl ist noch nicht gespeichert` with `Erneut versuchen` and `Auswahl prüfen`; no choice is silently discarded.
8. On a revision conflict, the canonical draft is loaded, invalidated choices are named for re-review, and still-valid local choices remain selected where their signed review facts are unchanged.
9. On reload during an uncertain final request, the existing pending-recovery check may use a blocking status because the product must first distinguish saved, missing, and conflicting authority.

Meaningful variants:

- A journey with no fit decisions skips the review loop and uses the single final preparation screen after category capture.
- A journey with manual/pending products still keeps those products non-executable and presents their existing pending/uncovered decisions.
- Reduced-motion users receive the same state changes without animated transitions.
- Mobile preserves the same order and one-loader contract; inline status remains visible without pushing the primary action below the fold.

## Planning evidence

- `plans/mockups/2026-08-14-personal-plan-stage3-loading.html`
  - Question: can the journey communicate safe persistence without interrupting every product choice?
  - Selected direction: inline background-save status during capture, locally remembered fit choices, and an immediate transition from the last choice to one final preparation screen. The mockup contains no separate confirmation page.
  - Evidence review: corrected and reconfirmed by Nick on 2026-08-14 after the shipped extra confirmation page was compared with the selected three-frame mockup.
  - Disposition: commit with the plan.
- User-provided current screenshot
  - Finding: the existing full-page save state dominates the surface and gives no useful progress or next action.
  - Disposition: source context only; do not copy the temporary clipboard file into the repository unless requested.

## Ordered tasks

### 1. Turn the reported interruption into a red regression harness

Add deferred gateway tests that hold final category mutation, individual choice progression, batch submission, and completion independently. Reverse the current assertions that require a full-page loader after each product decision.

Produces: a test that fails on current `main` because repeated decision loaders and per-choice requests still occur.

Completion criterion: the harness proves the exact current symptom and asserts one batch mutation plus one final blocking phase.

### 2. Reuse the durable decision-batch path for the local fit-review session

Reuse the existing `decision_batch` recovery shape, serializer, signed choice intents, and fail-closed replay validation for the normal forward journey. Retain selected alternative fingerprints, support Back/edit, and persist enough local state to survive an ordinary reload before final submission. Keep server facts and allowed actions authoritative; local state is an unsubmitted review, not an executable plan. Do not introduce a second local-state serializer.

Consumes: preloaded `Stage3DecisionReviewBundles` and current draft revision.

Produces: ordered, duplicate-free `Stage3AuthoritySemanticIntent[]` compatible with the existing batch API and recovery contract.

Completion criterion: each choice advances without a network call, Back restores it, reload restores it only for the same draft/revision/fact fingerprints, and stale choices fail closed to re-review. UI copy distinguishes `Auswahl gemerkt` (local) from `Gespeichert` (server-confirmed) and never implies durable server persistence prematurely.

Back has two explicit meanings: inside the review sequence it moves locally to the previous review card without a request; from the first review, the existing edit-products action may still invoke revision-guarded `reopen_capture_category` and return to product capture.

Fit reviews loaded for one pass are treated as mutually independent for local navigation. Coverage-dependent gaps and every signed fingerprint are revalidated server-side when the batch is submitted; any changed authority fails closed to targeted re-review.

### 3. Reuse the final mutation contracts under one visible final state

Write the existing pending batch intent before sending, call the decision-batch gateway, acknowledge locally reviewed inventory dispositions through the existing idempotent action using the returned canonical revision, then call completion with the final mutation's returned draft revision and navigate to Routine without intermediate full-page state changes. Prevent duplicate final submission. Retain and reconcile local choices on failure/conflict.

Consumes: validated local intent array from Task 2.

Produces: saved canonical Stage 3 draft and the existing Stage 4 handoff receipt.

Completion criterion: the last decision CTA produces one continuous final preparation screen, with no intermediate confirmation page, for both ordinary fit reviews and journeys containing inventory dispositions. A journey with fit reviews and one inventory disposition produces one decision-batch request, one existing idempotent disposition-acknowledgement request, and one completion request; errors remain retryable without lost choices. The one-loader user contract does not require collapsing different server mutation families into one request.

The final submit is revision-guarded and idempotent. A network timeout, authentication interruption, or `409` preserves the reviewed local draft; retry must neither duplicate a decision nor overwrite a newer canonical plan.

The consolidated preparation state replaces all three current tail branches: `decisionSubmitStatus === "saving"`, the `phase === "decisions" && !nextSubject` preparation branch, and the `phase === "handoff"` Routine-preparation branch. They must not flash sequentially.

On a batch conflict, reload canonical review bundles and partition every local intent against its current subject, allowed action, and signed candidate fingerprint. Keep still-valid local choices selected; return focus to the first invalid choice and name only the choices that require re-review. Do not reduce this to a whole-batch boolean failure.

### 4. Remove the last-category save interstitial without weakening durability

Keep the last category surface mounted while its persisted queue command and review-bundle preparation settle. Expose `saving`, `saved`, and failure through the shared header/inline action state. Continue to disable duplicate category finalization.

Completion criterion: capture a display snapshot of the submitted last-category products before clearing mutable working state; an unresolved request keeps that snapshot plus disabled CTA and inline `Wird gespeichert` visible, never renders `Produkte werden gespeichert`, duplicate clicks still produce one command, and failure offers a truthful retry.

### 5. Verify the whole journey and request budget

Run the focused component suite and the Stage 3 browser journey with delayed requests on desktop and mobile. Record request counts and client/server transition timing for a representative multi-product case.

Completion criterion: no full-page loader appears between individual product choices, no confirmation page appears after the last choice, and only the final preparation/recovery phase can block the full surface. Against the real HTTP gateway (not the per-intent fallback), the representative fixture with three fit reviews, one replacement, and one inventory disposition has exactly one decision-batch `PATCH /api/personal-plan/stage-3`, one disposition-acknowledgement `PATCH /api/personal-plan/stage-3`, one `POST /api/personal-plan/stage-3/complete`, and zero decision `GET`/`PATCH` requests between review cards. Category-capture and search requests are asserted separately from this post-review budget.

## Verification

### Automated

- Focused `tests/personal-plan-stage3-flow.test.tsx` deferred-promise cases.
- Pending recovery and production persistence batch tests.
- Full recovery-cycle tests covering batch write, reload, resend, successful reconciliation, and revision conflict; parser-only coverage is insufficient because the forward path has not previously written `decision_batch`.
- Stage 3 API batch contract tests.
- Existing Personal Plan Stage 3 component and flow suite.

### Manual/browser

- Desktop and mobile journey with at least three fit decisions and one replacement.
- Slow-network run that makes every relevant request visibly observable.
- Back/edit, refresh-before-final, final-submit retry, conflict, and navigation-recovery cases.
- Screen-reader announcement and keyboard focus checks for inline status and final error actions.
- Routine status updates use a polite live region; validation/conflict errors use the existing alert pattern and move focus to the first affected decision.
- The final loader has a bounded recovery threshold and exposes `Erneut versuchen` plus `Auswahl prüfen` if completion cannot be confirmed. Any displayed progress reflects real stages rather than a decorative percentage.

### Live-state and measurement

- No migration or production write is planned.
- Compare exact request count and `personal_plan_transition_performance` timings before/after; distinguish fixture/browser proof from production runtime proof.

## Review and handoff

- Branch/worktree: `codex/personal-plan-stage3-loading` at `.worktrees/personal-plan-stage3-loading`.
- Evidence review: confirmed by Nick on 2026-08-14.
- Designed user journey sign-off: confirmed by Nick on 2026-08-14.
- Counterpart review: Claude Opus 4.8 at `high` returned `Approve with revisions` twice on 2026-08-14 and confirmed the core shape. Accepted: reuse existing batch/recovery machinery, define dual Back semantics, consolidate three loader branches, partition valid/invalid local choices after conflicts, exercise the latent batch recovery end to end, thread returned revisions into completion, retain a submitted-category display snapshot, assert the request budget against the HTTP gateway, and resolve the disk blocker. Tradeoff resolved: preserve the existing disposition request inside the same final visual state rather than widening the authority contract solely for a hidden request reduction.
- Publication, merge, deployment, and production activation: not authorized.
- Artifact disposition: plan and selected mockup commit with implementation; transient screenshots may be discarded after review unless needed in the PR.
- Implementation starts only through `implementation-loop` after explicit mockup review and journey sign-off.
- Rollout choice: no temporary feature flag; the change is guarded by existing Stage 3 flags and uses revert-only rollback to avoid a second behavior path.

Residual risks:

- Review bundles can become stale while choices are local; submission must validate signed fact fingerprints and fail closed.
- Inventory-disposition acknowledgement remains a separate idempotent API action inside the one final visual state; a journey with several dispositions may perform more than two hidden mutation requests, but never reintroduces per-choice blocking screens.
- One final visual loader can still be long if completion is slow; timing evidence should decide whether the completion response needs backend optimization after the interaction fix.
- The failed 307 MB task-local dependency install was removed and the worktree now reuses the root checkout's matching dependencies; approximately 1.7 GiB was available after cleanup. Recheck disk space before browser verification.

## Counterpart findings ledger

| ID  | Type     | Evidence                                                                                  | Decision                                                                                                                              | Plan change                                                              | Revalidation                                               |
| --- | -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| CR1 | defect   | Existing batch/recovery path already serializes signed decisions                          | accepted                                                                                                                              | Tasks 2–3 now explicitly reuse it and prohibit a parallel serializer     | Refreshed counterpart review + focused recovery tests      |
| CR2 | tradeoff | Inventory dispositions use a separate acknowledgement request                             | accepted: preserve the existing idempotent action inside the same final visual state; one loader matters more than one hidden request | Task 3 and request-budget criteria updated; no authority-intent widening | Existing acknowledgement tests + browser network assertion |
| CR3 | defect   | Current Back reopens server capture, while mockup promises local previous-card navigation | accepted                                                                                                                              | Dual Back semantics recorded                                             | Component/browser Back tests                               |
| CR4 | defect   | Three render branches could still flash sequential loaders                                | accepted                                                                                                                              | All three branches named for consolidation                               | Deferred-request render test                               |
| CR5 | tradeoff | No temporary rollout flag was specified                                                   | accepted: existing Stage 3 flags plus revert-only rollback                                                                            | Explicit rollout choice recorded                                         | Whole-branch review                                        |
| CR6 | defect   | `ENOSPC` blocked test execution                                                           | accepted and resolved                                                                                                                 | Failed generated install removed; shared matching dependencies linked    | Focused red harness execution                              |
| CR7 | defect   | Whole-batch conflict cannot directly name invalid subjects                                | accepted                                                                                                                              | Reload bundles and partition local intents by current action/fingerprint | Mixed valid/stale conflict test                            |
| CR8 | defect   | `decision_batch` recovery was latent rather than exercised end to end                     | accepted                                                                                                                              | Require write/reload/resend/conflict coverage                            | Full recovery-cycle test                                   |
