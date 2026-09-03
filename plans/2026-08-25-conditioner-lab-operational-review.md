# Conditioner Lab operational review loop

Status: Tasks 1-4 implemented and verified locally; 12-product human review is open; Stage B remains separately gated

## Outcome and source context

Turn the existing development-only Conditioner Research Lab from a read-only 12-product checkpoint into the human review surface for the file-backed Conditioner research program. A researcher or worker produces exact-product artifacts; Nick can approve a field, request targeted rework, confirm an intentional G0 exclusion, or approve the complete local research analysis.

The proven interaction reference is the Shampoo Research Lab in `.worktrees/shampoo-inci-research-engine`. The Conditioner scientific authority remains `docs/research/conditioner-inci/v1.0/conditioner-classification-standard.md`; the full-cohort boundary remains the frozen 49-row cohort with 46 eligible rinse-out products and three excluded product forms.

This plan does not authorize Stage B execution yet. It makes the exact Stage B operator journey and approval semantics reviewable so Nick can decide whether to authorize implementation and the 46-product research batches.

## Chosen direction

Proposed direction: **working review loop**, not merely decorative Shampoo button parity.

1. Port the Shampoo Lab's field approval, targeted rework, full-product approval, fingerprint-bound local persistence, progress counters, and recovery behavior into Conditioner-owned code.
2. Keep research generation outside the browser. Bounded product workers write validated product artifacts; the Lab reads them and records human decisions.
3. Add a Conditioner-specific `G0-Ausschluss bestätigen` action for intentionally excluded product forms.
4. Persist rework requests as structured local decisions that the next research worker can consume. The Lab does not spawn agents or write production data.
5. When a formula, analysis, or profile fingerprint changes, prior approval becomes stale and the product returns visibly to review. Standard-level staleness binds to the declared semantic `standard_version`, which is bumped for classification-rule changes but not for copy, formatting, or typo-only edits.
6. Keep guidance synchronized: a reusable rule change updates the normative standard, quick reference, focus guide, agent context, research prompt, runbook, and rule-change log before the next batch. A product-only correction stays in that product's artifact and decision history unless it reveals a reusable rule.

Alternatives not selected:

- **Shampoo parity only:** approval/rework buttons persist decisions, but rework remains an inert note. Faster, but it does not create a dependable worker handoff.
- **All-in-one browser automation:** the Lab discovers products, starts agents, researches, approves, and publishes. This mixes orchestration, scientific review, and production authority; it is intentionally out of scope.

## Scope and non-goals

In scope:

- Local development-only Conditioner review actions.
- Nine field-level approval/rework states plus complete-analysis approval.
- G0 boundary confirmation for excluded product forms.
- Required targeted comment for rework.
- Formula + analysis/profile fingerprints plus semantic `standard_version` binding.
- Durable local review state and append-only decision history.
- A structured local rework queue/read contract for workers.
- Queue progress, blockers, next action, last decision, loading, persistence failure, and stale-approval states.
- Guidance synchronization and tests that enforce it.
- Stage B product artifacts appearing in the same queue as batches complete.

Non-goals:

- Product Intake approval, catalog publication, Supabase writes, migrations, deployment, or production activation.
- Authentication or multi-user concurrency.
- Launching Codex agents directly from a browser click.
- Finished-product performance claims beyond the approved evidence ceilings.
- Runtime recommendation or Personal Plan integration.
- A cross-category Lab abstraction before both category implementations are stable.

## Target map

- `src/lib/conditioner-research/review-state.ts` — Conditioner-owned schemas, fingerprints, atomic local persistence, stale-state handling.
- `src/lib/labs/conditioner-research-access.ts` — review status, disposition, blockers, eligibility, transitions, rework handoff, queue summaries.
- `src/app/api/labs/conditioner-research/review/route.ts` — development-only validated POST actions.
- `src/app/labs/conditioner-research/queue-audit-client.tsx` — review controls, comment validation, progress, feedback, and recovery.
- `data/research/conditioner-inci/v1.0/lab-review-state.json` — exact-version local decisions.
- `data/research/conditioner-inci/v1.0/rework-queue.json` or an equivalent validated append-only local artifact — unresolved worker handoffs.
- `docs/research/conditioner-inci/v1.0/{conditioner-classification-standard.md,03_lean-matching-quick-reference.md,04_focus-selection-decision-guide.md,02_agent-context.md,product-research-prompt.md,runbook.md,rule-changes.md}` — synchronized research/operator guidance.
- `tests/conditioner-research-{review-state,lab-access,lab-api,queue-audit}.test.*` — deterministic state, API, and UI coverage.

## Designed operator journey

1. Nick opens `/labs/conditioner-research` and sees the complete current cohort, never only an attention subset. Products are grouped into `Zuerst prüfen`, `Standardprüfung`, `Rework offen`, `Freigegeben`, and `G0-Grenzfall`; the counts distinguish research completeness from human review status.
2. He clicks one product in the research queue. The detail begins with a plain review task, the exact formula/version boundary, and all seven comparative profile fields. `Zuerst prüfen` highlights the one or two consequential decisions and any downstream fit effect, but never hides the other researched properties.
3. For a clean eligible product, he can click `Gesamtes Produkt freigeben`. The Lab explains before the click that this atomically accepts seven fields plus the local analysis for the exact fingerprints and semantic standard version and is **not** catalog approval. There is no separate `approve_analysis` action in this first Conditioner workflow.
4. If one field is wrong or insufficiently supported, he writes a specific `Reviewer-Kommentar` and clicks that row's `Rework anfordern`. A comment is mandatory; the field and product become `Rework offen`, the decision persists, and a worker-readable rework entry is created.
5. He may approve individual unaffected fields while rework is open. The product cannot become fully approved until all required fields, identity/formula gates, and the current analysis version pass.
6. After a worker returns corrected evidence, the changed fingerprints make stale approvals visible. Unchanged field decisions may be retained only if their field evidence fingerprint is unchanged; otherwise they reopen. A semantic classification-rule change bumps `standard_version` and reopens affected research; a copy-only guidance edit does not.
7. For an excluded leave-in/mask form, no fake Conditioner profile appears. Nick reviews identity and boundary evidence, then selects `G0-Ausschluss bestätigen` or requests boundary rework.
8. Source conflict, missing exact formula, invalid artifact, or persistence failure prevents final approval and shows the exact recovery action without hiding the rest of the queue.
9. When a decision changes a reusable rule, the standard version and synchronized guidance set are refreshed before the next authorized batch. Product-only corrections update only the product artifact and decision log. Automatic batch-refusal tooling is deferred to the separately authorized Stage B executor.
10. Completion is a fully reviewed local research cohort: every starting row is approved, rework-open, blocked with one precise reason, or intentionally excluded. No catalog or production state changes.

Operator variants and recovery:

- **Clean product:** full approval in one action.
- **One disputed field:** targeted comment + rework; other fields remain reviewable.
- **Attention product:** the critical field is surfaced first, followed by the same complete seven-field profile as every eligible product.
- **Formula/source conflict:** final approval disabled; source rule and required evidence shown.
- **Changed formula or standard:** previous decision shown as stale; re-review required.
- **Excluded product form:** boundary confirmation, never profile approval.
- **Save failure:** UI keeps prior server state and shows retry guidance; no optimistic approval remains.
- **Empty/new batch:** queue explains that workers must produce validated artifacts before review.

User-journey sign-off: **confirmed by Nick on 2026-08-26**. Nick asked to restore the working Lab so he can process all 12 pilot products before continuing with the remaining cohort.

## Planning evidence

- Existing Shampoo controls and persistence were mapped in `.worktrees/shampoo-inci-research-engine/src/app/labs/shampoo-research/queue-audit-client.tsx`, `src/app/api/labs/shampoo-research/review/route.ts`, `src/lib/labs/shampoo-research-access.ts`, and `src/lib/shampoo-research/review-state.ts`.
- Current Conditioner evidence shows a read-only client/API and a test that explicitly forbids approve/rework controls.
- Proposed rendered mockup: `docs/research/conditioner-inci/v1.0/planning-evidence/conditioner-lab-operational-review.html`.
- Decision answered by the mockup: where full approval, field approval, targeted rework, and local-versus-catalog boundaries should appear in the existing Conditioner layout, while making clear that the full cohort and all seven comparative properties remain visible even when only a few decisions are prioritized.
- Evidence-review status: **confirmed by Nick on 2026-08-26** after the mockup was corrected to show the complete 12-product queue and full profile for the selected product. The later v1.4 calibration removed two non-comparative fields without changing this interaction decision.

## Ordered tasks

### Task 1 — Add fingerprint-bound Conditioner review state

Consumes: current formula/profile artifacts and approved Conditioner vocabulary.

Produces: strict review-state and rework-entry schemas, formula/profile fingerprints, semantic `standard_version`, atomic file persistence, cold-load restoration, and stale-state rules. Product keys are the exact catalog UUIDs already required by the Conditioner standard and frozen cohort.

Use test-first red proofs for malformed state, changed fingerprints, write failure, and append-only history.

Complete when: a saved decision survives restart only for the exact validated authority bytes and cannot mutate in-memory state after a failed write.

### Task 2 — Add Conditioner review transitions and API

Consumes: Task 1 state contract.

Produces: `approve_property`, `request_rework`, `approve_product`, and `approve_boundary` actions; review eligibility, blockers, next action, and development-only POST route. Reuse the existing `isConditionerResearchLabEnabled` gate and the queue route's local-not-found behavior.

Rules:

- `request_rework` requires a non-empty targeted comment.
- `approve_product` atomically accepts all seven fields plus analysis only when identity/formula/boundary/validation gates pass.
- `approve_boundary` applies only to excluded product forms.
- No action can publish or touch Product Intake/Supabase.

Complete when: API tests prove 400/404/409/500 behavior, valid transitions, exact-version persistence, and no production availability.

### Task 3 — Add the review controls to the existing Conditioner Lab

Consumes: Task 2 API and the reviewed mockup.

Produces: progress counts, field/product/boundary actions, required comment feedback, pending state, last-decision receipt, stale state, and clear local-only language.

Complete when: component and browser checks cover clean approval, targeted rework, blocked conflict, exclusion confirmation, save failure, and responsive layout without changing the calibration tab's scientific content.

### Task 4 — Make the worker rework handoff executable and document guidance synchronization

Consumes: Task 1 rework artifact and the existing product research prompt/runbook.

Produces: a documented command/worker input that lists unresolved rework entries, exact product/field/comment/fingerprints, and semantic standard version. The runbook states the guidance-synchronization gate, but automatic manifest/batch-refusal machinery is deferred to Task 5 after Stage B authorization.

Complete when: one targeted rework can be handed to a bounded worker, returned as a new versioned artifact, and reopened in the Lab with correct stale-decision behavior; product-only corrections do not unnecessarily version the general standard. No inert rework note remains without a documented worker-consumption path.

### Task 5 — Authorize and process the Stage B cohort separately

Consumes: verified operational Lab and a separate explicit Nick authorization for Stage B.

Produces: the 46 eligible products in batches of at most eight plus three explicit boundary dispositions, using the existing full-cohort plan.

The batch size is inherited from the approved Stage A checkpoint and full-cohort Task 7. Task 5 also defines the guidance manifest and automatic refusal rule before the first full-cohort batch runs.

Complete when: all 49 frozen rows have one reproducible local research disposition and Nick can review every result in the Lab. This task stops before catalog graduation.

## Verification

Automated:

- Strict review-state/rework schemas and canonical fingerprint tests.
- Cold-reload, malformed-state, stale-formula, stale-profile, semantic-standard-version, copy-only guidance edit, and atomic-write-failure tests.
- Property approval, rework, full approval, and G0 boundary transitions.
- Dev-only API gate and 400/404/409/500 responses.
- UI controls, required comment, pending/feedback, progress recount, last decision, and local-only copy.
- Existing 12-product queue, calibration metrics, Bali authority, NEQI fallback, and rinseability-removal regressions.
- Replace the current queue-audit assertions that deliberately forbid `freigeben`, `Rework`, and POST controls with positive action/recovery assertions. Preserve the genuinely stable read-only evidence assertions rather than requiring the obsolete no-controls contract to remain green.
- `npm run typecheck` and repository verification through `ready-check` after implementation.

Manual/browser:

- Review desktop and mobile mockup before implementation.
- Walk one clean approval, one single-field rework, one stale approval after changed evidence, one source block, one G0 exclusion, and one persistence failure.
- Restart the local server and prove decisions persist for matching fingerprints.
- Confirm no Product Intake/catalog/Supabase action is exposed.

## Review and handoff

- Branch/worktree: `codex/conditioner-inci-research-plan` in `.worktrees/conditioner-inci-research-plan`.
- Counterpart plan review: completed at high effort on 2026-08-25. Accepted: invert the obsolete no-controls tests, use semantic standard-version staleness, make `approve_product` the only whole-record approval, reuse the existing dev gate, and defer automatic guidance-manifest refusal to Stage B. Rejected as factually outdated: the review said the eight-product batch size was new, but the Stage A checkpoint and full-cohort Task 7 already specify batches of at most eight.
- Evidence-review status: confirmed on 2026-08-26.
- User-journey sign-off: confirmed on 2026-08-26 for Tasks 1-4 and the 12-product pilot review journey.
- Implementation stop: before commit, push, PR, Stage B batch execution, database write, deployment, or activation.
- Artifact disposition: commit the plan, approved mockup, implementation, tests, synchronized guidance, and receipts; discard transient screenshots/logs unless intentionally retained as review evidence.
- Local verification: 23 focused tests passed, full `ci:verify` passed, desktop/mobile browser flows passed, and exact-version cross-file rollback was covered on 2026-08-26. See `docs/research/conditioner-inci/v1.0/operational-lab-verification-receipt.md`.
- Review-feedback refinement: on 2026-08-26 Nick rejected generic property rationales. The Lab now requires and displays exact ingredient/formula or directions signals, the explicit projection rule, and the evidence ceiling for every one of the nine fields; the reusable research guidance carries the same contract.
- Threshold-reasoning refinement: after comparing the Shampoo Lab, Nick requested the missing transfer step. Each field now explains why the exact product pattern reaches the selected value and why it does not stop at the adjacent lower class or qualify for the adjacent higher/categorical alternative. This explanation is fingerprinted review evidence, not a change to the accepted property values.
- Shampoo-navigation parity refinement: Nick explicitly selected the Shampoo Lab as the interaction reference after finding the Conditioner queue clunky. The Conditioner Lab now uses the same overview-first journey: work-lane filters reduce the visible queue, the selected product opens with a compact seven-field classification table and top-level whole-product action, and the complete ingredient evidence remains available below. Conditioner-specific G0 and evidence semantics remain unchanged.
- English threshold-visibility refinement: the compact overview now shows each field's exact selected-versus-adjacent-class reasoning instead of a generic rationale. All evidence prose is English, and the Aqua Hyaluron moderate versus Balea Med high conditioning comparison is the regression anchor: one coherent base without an additional supported deposition route versus a base plus cationic-polymer and emollient routes.
