# Personal Plan critical recovery: Stage 3 saves and Stage 4 handoff

Status: locally implemented and verified; critical transport/routing slice explicitly approved by Nick on 2026-08-11. Conflict visual redesign is deferred to the replacement UX plan. No publication or production activation has occurred.

## Outcome and source context

Restore the blocked production journey for the observed field-test account:

- a selected Stage 3 product saves exactly once instead of entering a repeated `409 revision_conflict` loop;
- the user can recover from a genuine concurrent edit without losing the visible selection;
- completing Stage 3 opens the pending Personal Plan Routine instead of redirecting an eligible field-test user to legacy `/onboarding`.

Source evidence:

- Nick's 2026-08-10 production walkthrough and attached `Speichern fehlgeschlagen` / legacy onboarding screenshots;
- read-only logs for production deployment `dpl_Ag9AJS7fNT7JjgyxduFPNYwTUzaD`, which show repeated Stage 3 `409` responses interleaved with successful writes: failed conflicts took 1.58-3.89 seconds and successful saves took 2.20-4.12 seconds, with generic journey authorization frequently the largest phase;
- read-only production state for the affected plan: active field-test enrollment and manual access, completed Stage 3 draft, pending Routine proposal, no active Routine version, and incomplete legacy onboarding;
- rendered recovery proposal: [Personal Plan refinement and products proposal](./mockups/2026-08-10-personal-plan-refinement-products-proposal.html) (reviewed and rejected as a visual direction; retained only as superseded decision evidence).

No production data was changed during diagnosis.

## Chosen direction

Treat `revision_conflict` as a normal typed compare-and-swap outcome end to end. The Stage 3 HTTP gateway must preserve the server's `latestDraft` for both mutation and completion. The existing client conflict handler then adopts that draft and asks the user to retry their last choice deliberately. The unguarded generic product-save path becomes single-flight so rapid repeated clicks cannot manufacture a same-tab conflict. We intentionally do **not** add an automatic conflict retry: after same-tab duplication is removed, a remaining conflict can represent a real edit in another tab and should not be overwritten silently. This critical slice keeps the existing conflict surface; its visual replacement will be decided with the new UX evidence.

Separately, recognize an active Personal Plan field-test enrollment as Personal Plan Routine access in the middleware's narrow legacy-intake bypass. Rename the access contract from the one-time-specific `hasActiveOneTimeEntitlement` to the truthful `hasActivePersonalPlanEntitlement`; derive it from active one-time access or from field-test metadata **and** the already-resolved active app-access result. The bypass remains conditional on a pending or active Personal Plan Routine pointer. It must not become a general subscription or Stage 5 bypass.

## Scope and non-goals

In scope:

- Stage 3 generic capture/update/finalize mutations that currently lose the `409` payload;
- duplicate-submit prevention on the currently unguarded generic save path and the existing deliberate conflict retry;
- preservation of the existing latest-draft conflict recovery semantics;
- middleware/intake routing for active field-test participants with a pending or active Personal Plan Routine;
- telemetry distinguishing recovered conflict, unresolved conflict, duplicate interaction suppression, and Routine-bypass source.

Non-goals:

- changing catalog rows, OGX identity, ranking, or recommendation authority;
- visually redesigning the conflict surface or other Stage 3 screens;
- redesigning Stage 1, Stage 2, or the full Stage 3 experience;
- changing the five-stage route order;
- granting `/anwendung` access before an active Routine exists;
- changing one-time purchase or subscription entitlements;
- deployment, feature-flag activation, or production data repair.

## Target map

- `src/lib/personal-plan/products/http-gateway.ts`: decode mutation and completion `409 revision_conflict` responses and return `latestDraft` without weakening other error handling.
- `src/components/personal-plan-products/stage3-products-flow.tsx`: retain the existing latest-draft adoption and deliberate retry semantics and guard duplicate dispatch on `saveMutation`; do not redesign the recovery surface in this slice.
- `src/app/api/personal-plan/stage-3/route.ts` and `src/app/api/personal-plan/stage-3/complete/route.ts`: keep the existing authoritative CAS response contract; change only if tests expose a contract mismatch.
- `src/lib/supabase/middleware.ts`: pass the narrow active field-test Personal Plan entitlement into legacy-intake routing.
- `src/lib/auth/intake-state.ts`: preserve the existing pointer-based `/routine` and `/anwendung` decisions; extend types only if required by the middleware seam.
- `tests/personal-plan-stage3-gateway.test.ts`, `tests/personal-plan-stage3-flow.test.tsx`, `tests/auth-intake-state.test.ts`, `tests/auth-middleware-replay.test.ts`, and the existing Personal Plan browser specs: regression proof.

## Designed user journey

Actor and entry condition: an authenticated Personal Plan participant has completed refinement, declared a product category as owned, and is selecting the exact product in Stage 3.

1. The user selects a product or cadence. The choice appears selected immediately and its action becomes single-flight.
2. The client sends the current draft revision once.
3. On success, the returned draft becomes the only local authority and the user continues normally.
4. If another accepted write advanced the revision, the existing conflict handler consumes `latestDraft` and explains that the last choice must be tried again. Unlike the production defect, the conflict is no longer misclassified as temporary unavailability.
5. When the user chooses `Erneut versuchen`, the request uses the newly adopted revision. If it succeeds, the normal saved state returns.
6. If the deliberate retry conflicts again or the network fails, recovery remains available and continuing/finalizing stays blocked until the write is confirmed. The exact visual treatment is deferred to the replacement UX plan.
7. When Stage 3 completion has produced a pending Routine proposal, the user proceeds to `/routine`.
8. An active field-test participant with incomplete legacy onboarding is allowed through to that pending Personal Plan Routine. They are not sent to `/onboarding`.
9. `/anwendung` remains unavailable until an active Routine exists; an unrelated user without qualifying Personal Plan access still follows the existing onboarding rules.

Completion: the product draft is durably saved once, the pending Routine is visible, and no legacy onboarding state is overwritten.

## Planning evidence

This slice introduces no new surface, copy, timing contract, or product decision. It restores the server's existing conflict payload to the existing client handler, suppresses duplicate dispatch, and corrects routing to the already-built Routine. Nick explicitly approved fixing both critical defects on 2026-08-11. The rejected refinement/products mockup is not implementation evidence for this slice; replacement visual evidence is being created separately.

Designed integration journey sign-off: confirmed for Stage 3 save recovery and direct eligible field-test handoff to Routine. Conflict-surface redesign remains pending and out of scope.

## Ordered tasks

1. Preserve the CAS conflict payload at the Stage 3 mutation and completion gateway.
   - Consumes: server response `{ error: "revision_conflict", latestDraft }` with HTTP 409.
   - Produces: a typed gateway conflict result containing the validated latest draft; other non-OK responses retain their existing error mapping.
   - Add red `tests/personal-plan-stage3-gateway.test.ts` cases for `createHttpStage3ProductsGateway().mutate()` and `.complete()`, each proving the current HTTP gateway loses the payload, then make them pass. Do not confuse these with the fixture-gateway conflict tests or existing `stale_refined_source` coverage.
   - Completion criterion: 409 mutation and completion responses are distinguishable from temporary unavailability and expose their exact latest revision.

2. Make the unguarded generic Stage 3 save path single-flight and prove the existing conflict recovery.
   - Consumes: the typed conflict result from task 1.
   - Produces: an in-flight guard around `saveMutation`; existing completion/finalize/decision guards and the latest-draft/retry semantics in `handleConflict` remain canonical.
   - Add red flow tests for rapid repeated clicks and HTTP conflict -> latest-draft adoption -> deliberate retry with refreshed revision.
   - Completion criterion: rapid repeated input produces one initial request; the recovery request uses the refreshed revision; a stale revision never loops; a failed save never silently disappears.

3. Correct the field-test Routine bypass without widening entitlements.
   - Consumes: active field-test status plus pending/active Routine pointers already available to server-side access logic.
   - Produces: a renamed `hasActivePersonalPlanEntitlement` contract. The middleware sets it only for active one-time access or `fieldTestGuest && activeAppAccess`; `canBypassLegacyOnboardingForPersonalPlanRoutine` consumes that truthful field.
   - Add red middleware/intake tests for: field-test + pending proposal -> `/routine`; field-test + no Routine pointer -> existing onboarding behavior; field-test + pending proposal + `/anwendung` -> existing pre-active handling; unrelated access types unchanged.
   - Completion criterion: the exact observed production state resolves to `/routine`, while negative entitlement and pointer cases remain blocked.

4. Extend recovery telemetry and add end-to-end regression proof.
   - Consumes: the final conflict and routing states from tasks 2 and 3.
   - Produces: a bounded extension of the existing `personal_plan_stage3_save_outcome` taxonomy for recovered/unrecovered conflicts plus field-test Routine-bypass telemetry, without product search terms or user identifiers. Do not introduce a parallel save-outcome event family.
   - Extend the authenticated Personal Plan browser harness with the full Stage 3 save -> pending Routine handoff, including one injected 409.
   - Completion criterion: the browser journey reaches Routine after a recovered conflict and the relevant server/client tests pass.

## Verification

Automated:

- targeted Node tests for the Stage 3 gateway, flow, middleware, intake state, and field-test access;
- `npm run check:personal-plan` or the repository's narrower Personal Plan gate if it includes all changed surfaces;
- lint and TypeScript checks for the changed files;
- existing Stage 1-5 route and Personal Plan browser harness regressions.

Manual/browser:

- local authenticated field-test fixture: rapid product clicks do not duplicate a write; injected stale revision recovers once; unrecovered conflict preserves selection;
- desktop and mobile walkthrough from Stage 3 product selection to pending Routine;
- negative walkthrough for a user without Personal Plan Routine entitlement;
- verify `/anwendung` remains gated before Routine activation.

Live-state checks before any publication claim:

- read-only confirmation that the production API contract still returns `latestDraft` on 409;
- authenticated applied-database smoke in the task environment or explicitly authorized production-safe account;
- no catalog mutation, enrollment mutation, Routine resolution, deployment, or flag activation as part of this plan.

## Review and handoff

- Worktree: `.worktrees/personal-plan-debug-polish` on `codex/personal-plan-debug-polish`.
- Authorization: Nick explicitly approved implementing the critical save and onboarding-redirect fixes on 2026-08-11. Replacement UX evidence remains a separate gate for any visual recovery change.
- Implementation uses `implementation-loop`, then its nested `ready-check` and `request-code-review` gates.
- Claude plan review verdict was `Approve with revisions`; its verified findings (completion 409 coverage, existing manual retry semantics, the single unguarded save path, and truthful entitlement semantics) are incorporated above. Repository inspection shows the current conflict UI replaces the Stage 3 body; changing that is intentionally deferred. Whole-branch counterpart review remains required before publication.
- Rollback for both runtime changes is a normal code revert; no new feature flag is justified for these narrowly scoped defects.
- Publication stops before commit/push/draft PR unless Nick explicitly says `ship it`; merge, deployment, migrations, data correction, and activation remain separate.
- Artifact disposition: this plan is `commit`; the rejected first-series mockup remains outside this slice pending final archive/discard choice; counterpart-review and read-only production query/log output stay outside the repository and are `discard` after evidence is summarized.

## Local implementation receipt — 2026-08-11

- Stage 3 HTTP mutation and completion gateways validate and preserve `latestDraft` on `409 revision_conflict`.
- Generic product saves are single-flight, visibly disable competing capture controls while pending, and retry from the adopted draft revision. Decision retries also use the adopted draft as their source.
- Field-test Routine access is derived only from field-test metadata plus current active app access; ordinary app access does not become a Personal Plan entitlement. Pending Routine permits `/routine`; `/anwendung` still requires an active Routine.
- Fresh proof: 1,042/1,042 Personal Plan tests and 15/15 Stage 1-3 browser scenarios pass on the combined tree, alongside scoped ESLint, Prettier, TypeScript, database pgTAP, and `git diff --check`.
- Independent whole-tree review found two stale-refined-source recovery gaps and clickable capture controls during a save. Create/load and completion now return the typed `stale_refined_source` restart instead of retrying an obsolete draft, all competing product controls disable during persistence, and the fixes were reverified.
- A new `createUpdateSession` dependency seam exercises the actual middleware ordering with realistic in-memory Supabase chains: field-test/current access + pending proposal reaches `/routine`; `/anwendung` still redirects until active; access and plan-read failures remain fail-closed. Combined focused recovery/auth coverage is green.
- Remaining publication gate: authenticated applied-database smoke through the deployed cookie/session boundary and pending Routine handoff. No deployment, enrollment/catalog write, migration, flag action, commit, push, or PR occurred.
