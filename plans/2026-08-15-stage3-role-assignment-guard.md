# Stage 3 role-assignment guard

## Outcome and source context

Stage 3 shows “Welche Aufgabe hat dein …?” only when the user must make a real product-to-role decision. A category with no final-plan roles bypasses the semantic-assignment screen without inventing an executable use. A category with one unambiguous role continues to use the existing authority-approved auto-assignment behavior. The resulting inventory review and adjacent decision states share one responsive content/action boundary.

Source evidence:

- Nick’s 2026-08-15 screenshot shows an inventory-only Conditioner on the semantic-assignment screen with no role option.
- `src/lib/personal-plan/products/stage2-entry-adapter.ts` intentionally gives inventory-only categories an empty `requiredRoles` list.
- `src/components/personal-plan-products/stage3-products-flow.tsx` auto-assigns exactly one required role but falls through to `phase === "roles"` when `requiredRoles` is empty.
- Existing findings already established that Conditioner’s sole `conditioner_rinse_out` role is auto-assigned for one or several captured products.

Confirmed root cause: `continueCapture()` has an exactly-one-role auto-assignment branch but no zero-role bypass. The generic `SemanticRoleAssignment` component then receives `roles={[]}` and renders a heading, product card, and CTA without a decision.

Rejected alternatives:

- This is not the previously fixed multi-Conditioner bug: the screenshot contains no role option, which requires zero roles rather than one sole role.
- This is not a reason to infer `conditioner_rinse_out` into an inventory-only product: inventory-only means the category has no authority to enter the final Routine.

## Chosen direction

Treat page visibility as an authority-and-cardinality decision, not a hard-coded category list.

Implementation placement: use an explicit zero-role guard in `continueCapture()` before role suggestions. Do not redefine `canAutoAssignRoles()` to treat “nothing to assign” as auto-assignment; keeping those concepts separate makes the authority boundary legible while still routing through the existing `saveRolesAndContinue({}, working)` persistence path.

| Final required roles | Captured products | Role multiplicity / prior authority | Semantic-assignment page |
| --- | ---: | --- | --- |
| 0 | one or more | any | Never; persist with no assignments and continue to inventory disposition |
| 1 | 1 | any | Never; assign the sole role automatically |
| 1 | 2+ | multiple products allowed for that role | Never; assign every product automatically |
| 1 | 2+ | only one product allowed for that role | Show; user chooses which product fills it |
| 2+ | any | no authoritative prior assignment | Show; user resolves the product-to-role mapping |
| 2+ | 1 | existing confirmed Oil purposes resolve at least one role | Preserve the existing Oil shortcut and carry uncovered roles forward explicitly |

Current category implications:

| Category | Actual Stage 3 roles | When the page should exist |
| --- | --- | --- |
| Shampoo | everyday; sometimes targeted dandruff | Two required roles, or several Shampoos competing for one required role |
| Conditioner | rinse-out only; multiple products may share it | Never |
| Leave-in | post-wash; sometimes pre-heat application | Two required roles, or several Leave-ins competing for one required role |
| Heat protection | pre-heat protection only | Only when several products compete for the role |
| Oil | pre-wash, damp leave-on, dry finish; one to three may be required | When captured products/purposes remain ambiguous; preserve confirmed-purpose shortcut |
| Mask | intensive conditioning only | Only when several products compete for the role |
| Scalp care | zero to four roles | Never for zero roles; otherwise for multiple roles or several products competing for one role |
| Dry shampoo | root refresh only | Only when several products compete for the role |
| Bondbuilder | specialized bond treatment only | Only when several products compete for the role |
| Deep-cleansing shampoo | currently residue reset; policy also reserves mineral reset | Currently only when several products compete; show if a future final plan requires both roles |
| Any inventory-only or zero-role paused category | none | Never |

This keeps the logic future-safe: new categories and future role combinations follow the same rule without adding UI exceptions.

## Scope and non-goals

In scope:

- bypass the semantic-assignment phase when the current requirement has zero roles;
- preserve the existing empty assignment payload so inventory-only and zero-role products remain non-executable;
- simplify the inventory-disposition review to one headline, one compact explanatory paragraph, the product identity card, and one Continue action;
- introduce one shared Stage 3 bottom-action wrapper so inventory review, product fit, and the revision checkpoint remain viewport-sticky at all breakpoints while aligning to the shell’s inner width;
- add a red-first regression for the exact Conditioner path;
- run the existing control cases for one-role, multi-product, and multi-role behavior.

Non-goals:

- no role-policy, recommendation, category, target, or Routine-authority changes;
- no new inferred role for inventory-only or paused categories;
- no animation, loading, navigation, image, or inventory-disposition behavior redesign beyond the reviewed copy/hierarchy and shared action-containment correction;
- no spacing changes outside the Stage 3 product shell and its existing bottom-action states;
- no migration, production data write, feature-flag change, deployment, or publication.
- no new kill switch; this bounded production-surface correction reuses the already-shipped category replacement path and remains ordinarily revertible.

## Target map

- `src/components/personal-plan-products/stage3-sticky-action.tsx`: own the shared Stage 3 viewport-sticky action wrapper, using full-width mobile treatment with `20px` horizontal padding and a centered desktop width matching the shell’s `640px` inner content area.
- `src/components/personal-plan-products/index.tsx`: expose the shared action wrapper alongside the other Stage 3 UI building blocks.
- `src/components/personal-plan-products/stage3-products-flow.tsx`: add the zero-role continuation guard, simplify `Stage3InventoryDispositionReview`, and use the shared action wrapper for inventory review and need-revision actions.
- `src/components/personal-plan-products/product-fit-comparison.tsx`: replace its divergent viewport-wide desktop footer classes with the shared centered sticky action wrapper.
- `src/app/labs/personal-plan/stage-3/lab-client.tsx` and `src/lib/personal-plan/products/fixture-scenarios.ts`: add a Labs-only zero-role Conditioner path for real browser transition coverage.
- `tests/personal-plan-stage3-flow.test.tsx` and `tests/personal-plan-stage3.spec.ts`: preserve the exact failure as an integration regression, update inventory-disposition copy/layout assertions, and reuse the surrounding controls.
- `artifacts/personal-plan-stage3-role-assignment-guard/role-assignment-decision.html`: durable rendered planning evidence.
- `artifacts/personal-plan-stage3-role-assignment-guard/role-assignment-decision.png`: reviewed screenshot of the current/proposed transition.

## Designed user journey

Actor: a Stage 3 user who has identified at least one owned product and selected its frequency.

1. The user selects “Weiter” after product capture.
2. The system reads the current final-plan requirement and captured-product count.
3. If the category has no required roles, the system saves the products with no role assignments and does not show “Welche Aufgabe hat dein …?”.
4. For an inventory-only product, the next user-visible state is the shortened “Nicht in deiner Routine” review. One paragraph explains that the product category is not currently planned and the product remains under “Meine Produkte”; the product card and “Weiter” are the only other content sections.
5. The body starts at the same horizontal origin as adjacent Stage 3 states. On mobile it uses the shell’s `20px` padding and scrolls behind a viewport-sticky bottom action. On desktop it uses the centered `720px` card and `40px` inner padding; the action remains viewport-sticky but is horizontally constrained to the card’s `640px` inner content width.
6. If the category has one unambiguous role, the system assigns it automatically under the existing multiplicity rules and continues.
7. Only if products and roles still permit more than one valid mapping does the system show the semantic-assignment page.
8. Existing save, retry, conflict, pending-analysis, Back, inventory acknowledgement, comparison, and completion behavior remains unchanged.

Meaningful variants:

- Conditioner in the final Idealplan: `conditioner_rinse_out` is auto-assigned for one or several products.
- Conditioner present only in owned inventory: no role is invented; the empty page is skipped and the product is reviewed as not in the Routine.
- Two Shampoos for one single-product role: the assignment page remains so the user chooses one.
- Multi-role Oil with no resolved prior purpose: the assignment page remains.
- A zero-role paused/safety state: the page is skipped and no executable role is created.

Completion: every captured product is either assigned to an authoritative final-plan role or reaches the existing non-executable inventory disposition; the user never sees a role page without a decision.

User-journey sign-off: **confirmed by Nick on 2026-08-16**. Confirmed corrections: Leave-in exclusivity is per role rather than per product; a single Leave-in may cover both roles, while two Leave-ins cannot simultaneously occupy the same role. Primary actions remain viewport-sticky on mobile and desktop, with desktop width centered to the Stage 3 card’s inner content width.

## Planning evidence

- [`role-assignment-decision.png`](../artifacts/personal-plan-stage3-role-assignment-guard/role-assignment-decision.png) answers: “What replaces the empty Conditioner assignment page?” Selected direction: bypass it and show a shortened inventory-disposition review with the headline “Nicht in deiner Routine”, one two-sentence explanation, the product card, and “Weiter”.
- [`role-assignment-decision.html`](../artifacts/personal-plan-stage3-role-assignment-guard/role-assignment-decision.html) is the deterministic source for the rendered comparison.
- [`inventory-disposition-responsive-alignment.png`](../artifacts/personal-plan-stage3-role-assignment-guard/inventory-disposition-responsive-alignment.png) answers: “How does the shortened state align with the screens before and after it?” Selected direction: reuse the centered Stage 3 shell, `20px` mobile / `40px` desktop content padding, and a viewport-sticky action centered to the shell’s inner width at desktop.
- [`inventory-disposition-responsive-alignment.html`](../artifacts/personal-plan-stage3-role-assignment-guard/inventory-disposition-responsive-alignment.html) is the deterministic responsive source.

Feedback incorporated: replace “Dieses Produkt bleibt erfasst”, remove the eyebrow, inner status box, separate saved row, follow-up paragraph, and long CTA.

Evidence-review status: **confirmed by Nick on 2026-08-16** for the concise inventory screen and responsive alignment artifact.

## Ordered tasks

1. **Preserve the exact failure as a red integration regression.** Use the real `createAuthorityTestGateway()` state-machine fixture, add an inventory-only Conditioner requirement with `requiredRoles: []`, capture a catalog-search product, and continue through the actual capture-finalize transition. Make the primary red assertion `SemanticRoleAssignment === null`; on the unmodified implementation it fails by finding the empty role page. After the fix, additionally assert the observable contract: no captured product carries a role and zero uncovered roles are enqueued. Keep the existing pre-seeded inventory-disposition test as the destination-screen contract because the lightweight fixture does not synthesize the production inventory-authority envelope. Completion: red fails specifically on the empty page; green proves the non-executable category replacement without coupling to `{}` versus `{ [productKey]: [] }` representation.
2. **Bypass zero-role semantic assignment.** At the capture-to-role boundary, persist the working products through the existing category replacement with an empty assignment map and return before role suggestions or phase transition. Completion: the red regression passes and no product receives an invented role.
3. **Create one shared Stage 3 sticky-action boundary.** Extract the repeated footer treatment into a small wrapper used by inventory review, need-revision checkpoint, and product fit. Preserve viewport stickiness on mobile and desktop; constrain desktop width to the `720px` shell’s `640px` inner content area instead of spanning the viewport. Preserve single- and two-button layouts and safe-area/cookie clearance. Completion: all three states share the same horizontal bounds without making long comparison actions require end-of-page scrolling.
4. **Reduce the inventory-disposition hierarchy.** Replace the existing eyebrow, “Dieses Produkt bleibt erfasst” headline, explanatory paragraph, regular-use subline, status panel, separate saved confirmation, follow-up paragraph, and “Verstanden, weiter” CTA with the reviewed headline, one reason-aware compact paragraph, the existing product identity card, and “Weiter”. Preserve both disposition reasons and accessible Back/action behavior. Completion: the rendered component matches the reviewed evidence and tests assert the concise meaning rather than removed duplication.
5. **Revalidate the role-page and responsive-layout matrix.** Run the exact new regression plus existing controls for one-product/one-role auto-assignment, multiple Conditioner auto-assignment, two-product Shampoo selection, and multi-role Oil assignment. Capture inventory review and adjacent decision states at mobile and desktop widths. Completion: the zero-role page is absent, every real ambiguity screen remains present, and bottom actions follow the reviewed bounds.

## Verification

Automated:

- run the new exact regression red before implementation and green after implementation;
- run the focused Stage 3 flow test file;
- run the relevant Personal Plan test command selected by `ready-check`;
- run scoped lint/type verification for changed TypeScript files.

Manual/rendered:

- compare the implemented zero-role transition with the reviewed evidence;
- verify no empty role screen appears and the existing inventory-disposition review retains the product name and non-Routine explanation;
- verify the ambiguous Shampoo and Oil controls still render role options.
- compare inventory review, need-revision checkpoint, and fit comparison at a representative mobile viewport and `1440×1000`; verify shared content origin, `20px`/`40px` padding, scroll clearance, centered desktop width, and persistent viewport stickiness on a fit comparison taller than the viewport.
- confirm zero-role bypasses emit no `role_assignment` viewed event, matching the existing one-role auto-assignment path because no such page was shown.

Migration/live state: none.

## Review and handoff

- Branch: `codex/stage3-role-assignment-guard` in `.worktrees/stage3-role-assignment-guard`; initially based on `f214e3a0` and cleanly rebased for merge onto fresh `origin/main` at `ff888a55` with no overlapping files.
- Plan, HTML evidence, PNG evidence, regression, and focused fix: commit candidates.
- Counterpart plan review: complete; revisions incorporated with no blocker.
- Evidence review: confirmed by Nick on 2026-08-16.
- User-journey sign-off: confirmed on 2026-08-16 after the role-assignment and responsive-layout walkthrough.
- Implementation uses `implementation-loop`, including `ready-check` and `request-code-review`.
- Stop before commit, push, PR, merge, deploy, production writes, or cleanup unless separately authorized.

Counterpart findings ledger:

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | Existing inventory UI test is pre-seeded and does not exercise capture → continue | accepted | Pin the real gateway/state-machine fixture and primary red assertion | Confirm red fails on `SemanticRoleAssignment` presence |
| C2 | defect | Literal empty-map assertion could couple to `{}` vs keyed empty arrays | accepted | Assert no product roles and zero uncovered roles | Inspect emitted category replacement and final disposition |
| C3 | tradeoff | Guard could live explicitly or inside `canAutoAssignRoles` | accepted: explicit guard | Record placement in chosen direction | Code review verifies one roles-phase entry point |
| C4 | tradeoff | No feature kill switch on a production surface | accepted | Record ordinary revert and unchanged persistence path | Ready-check plus focused journey proof |
| C5 | defect | Reviewer could not resolve repo skill names from its environment | rejected | None; all named skills exist under `.agents/skills` in this worktree | Local skill files inspected |
| C6 | tradeoff | Guard-only fix versus bundled copy/layout correction | accepted: bundled | Nick explicitly requested the shorter destination screen and adjacent-screen alignment in the same task | Revised evidence plus focused whole-flow verification |
| C7 | tradeoff | Desktop fit action could become card-absolute and require scrolling | rejected | Keep all three primary action surfaces viewport-sticky; center desktop action to the shell inner width | Tall fit-comparison browser check |

Counterpart review status: **complete; approve with revisions, no blocker**. Transient report remains outside the repository and will be discarded.

## Implementation verification receipt

- Exact red proof: the new zero-role Conditioner integration test failed on the unmodified flow because `SemanticRoleAssignment` rendered with `roles: []`; it passes after the explicit guard.
- Focused flow: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage3-flow.test.tsx` — 60/60 passed after the final copy-branch assertion.
- Relevant suite: `npm run test:personal-plan` — 1,627/1,627 passed.
- Browser: full `tests/personal-plan-stage3.spec.ts` Chromium project against the task worktree — 6/6 passed, including the zero-role Conditioner bypass and the tall fit-comparison sticky action at mobile and desktop widths.
- Static quality: `npm run typecheck` passed; `npm run lint` passed with zero errors and four pre-existing warnings outside this task.
- Simulated-user review: pass for concise German, clear next action, and reduced duplicate explanation. Limitation: the Labs gateway proves the zero-role transition but does not synthesize the production inventory-authority envelope; both disposition reasons and the destination screen are therefore pinned by the real component/state-contract test and the reviewed responsive artifact.
- Final code review: no blocking findings. One missing assertion for `not_assigned_to_final_role` copy was accepted and added; the full Stage 3 flow test and typecheck passed afterward. The desktop fixed behavior is intentional per the signed-off journey, and the direct sticky-wrapper import in ProductFitComparison avoids importing through its component barrel.
- Artifact disposition: plan plus HTML/PNG mockup evidence are task-owned commit candidates. The PNG files are intentionally ignored by default and will require explicit forced staging only if Nick later authorizes shipment. Claude reports remain transient outside the repository and are discarded.
- Skipped: no migration, live data, deployment, production write, or authenticated production journey applies to this bounded client transition and layout change.
