# Stage 3 clarity: one role assignment, deterministic review, German cadence

## Outcome and source context

After selecting an Oil, the user assigns all applicable use cases once through the existing checkbox interaction. Stage 3 does not replay single-action product-role or gap outcomes as separate decision cards. Only genuine conflicts or choices interrupt the flow, consolidated by category/product. The remaining review order is deterministic after reopen/rebuild, and Stage 4 Routine renders every compiler-owned cadence as intentional German copy.

Confirmed source evidence:

- The current product flow already contains `SemanticRoleAssignment`: one product card with three Oil checkboxes and the copy `Ein Öl darf mehrere Zwecke abdecken`.
- The current role screen renders cleanly at desktop and 390px mobile widths. It is the right interaction; the later decision replay is the defect.
- Local Labs replay on `origin/main` `1b2cb614` showed three consecutive Oil gaps with identical visible text and action.
- Reopening Oil and recording it again resumed at a later category before returning to Oil.
- A minimized repro showed `deriveStage3DecisionSubjects()` emit `oil -> bondbuilder` initially but `bondbuilder -> oil` when semantically identical rebuilt Oil gaps were appended later.
- `routine-item-card.tsx` has no labels for several supported structured cadence kinds and exposes normalized internal keys through its fallback.

## Chosen direction

User correction incorporated: the checkbox role assignment is the single authoritative use-case decision.

- Rename and tighten the existing Oil screen to `Wofür nutzt du dein Öl?` with the helper `Wähle alles aus, was auf dieses Produkt zutrifft.`
- Present these three checkboxes per selected Oil: `Vor der Haarwäsche`, `Im feuchten Haar`, and `Im trockenen Haar`, with concise purpose descriptions.
- With multiple Oils, render one product card per Oil on the same screen. One Oil may cover several uses, while each use belongs to at most one Oil. Selecting a use on another product moves that role assignment instead of creating a duplicate or an error.
- On `Auswahl übernehmen`, persist selected product-role assignments and unchecked required roles exactly as today.
- In the later authority pass, automatically resolve only outcomes with exactly one permitted semantic action that is already implied by the checkbox choice: clear keep, keep pending, or leave uncovered. Do not silently choose a recommendation, override a mismatch, or make a shopping decision.
- If authority exposes multiple legitimate actions, a mismatch override, or another real decision, show all remaining Oil decisions together on one compact product/category screen. Do not replay one screen per role.
- Canonically order remaining decision subjects by `draft.orderedCategories`, category role order, and captured-product order so reopen/rebuild history never changes the sequence.
- Translate Routine cadence from `userOverride` first, otherwise the structured `recommended` target plus item role, exhaustively covering all `PlanFrequencyTarget` kinds.

## Scope and non-goals

In scope:

- checkbox-first Oil use-case copy and hierarchy in the existing role-assignment surface;
- automatic advancement through single-action authority outcomes already implied by the user's selection;
- one consolidated exception-only review for genuine Oil choices/conflicts;
- deterministic Stage 3 decision ordering;
- exhaustive German Routine cadence display;
- regression tests and local desktop/mobile browser verification.

Non-goals:

- changing category order, required roles, product authority, fit verdicts, recommendation candidates, cadence rules, decision semantics, schemas, migrations, analytics identities, or Stage ownership;
- silently planning purchases, accepting mismatches, activating pending products, or changing executable status;
- redesigning product search or the complete Stage 3 journey beyond removing the redundant decision replay;
- activation, production writes, commit, push, PR, merge, deployment, or cleanup.

## Target map

- `src/lib/personal-plan/products/contracts.ts`: canonical decision-subject ordering.
- `src/components/personal-plan-products/stage3-products-flow.tsx`: checkbox copy projection, safe single-action auto-resolution, category/product grouping, conflict recovery, and advancement.
- `src/components/personal-plan-products/index.tsx`: retain/refine `SemanticRoleAssignment` and add the compact consolidated exception presentation at the existing decision-card seam.
- `src/components/routine/personal-plan/routine-item-card.tsx` plus a small colocated copy helper if extraction is justified: exhaustive cadence presentation.
- `tests/personal-plan-stage3-contracts.test.ts`: mutation-history-independent ordering.
- `tests/personal-plan-stage3-components.test.tsx`: checkbox copy and consolidated exception rendering/accessibility.
- `tests/personal-plan-stage3-flow.test.tsx`: standard path skips redundant single-action cards; multi-action/mismatch outcomes remain explicit and grouped; reopen order is stable; conflict/retry preserves progress.
- `tests/personal-plan-stage4-ui.test.tsx`: structured cadence translations and override precedence.

## Designed user journey

Status: **confirmed by Nick on 2026-08-10** after review of the corrected single- and multiple-Oil mockup.

1. The user selects an Oil and its frequency on the existing product-capture screen.
2. Stage 3 shows one screen titled `Wofür nutzt du dein Öl?`, or `Wofür nutzt du deine Öle?` when several were captured. Each selected Oil has its own product card with the three checkboxes `Vor der Haarwäsche`, `Im feuchten Haar`, and `Im trockenen Haar`.
3. One Oil can hold several checked uses, but each use can belong to only one Oil. Selecting an already assigned use under another Oil moves the checkmark and assignment there; it never creates two active Oils for the same purpose.
4. The user checks every use case that applies and chooses `Auswahl übernehmen`. An unchecked role means only that this Oil does not perform that role; it does not silently schedule a purchase or activate another product.
5. Stage 3 saves the exact assignments and moves on. A clear fit, a pending product that can only remain pending, or an uncovered role that can only remain open is resolved without asking the user to reconfirm the same implication.
6. If all Oil outcomes have one safe action, there is no later Oil decision screen at all.
7. If at least one Oil outcome requires a real choice—such as `Empfehlung einplanen` versus `Offen lassen`, or `Trotzdem dafür nutzen` versus `Nicht dafür nutzen`—Stage 3 shows one consolidated Oil screen containing only those open rows. The user resolves them there rather than paging through role cards.
8. If the user reopens Oil, Stage 3 returns to its checkbox assignment. After resubmission, any remaining exception review stays with Oil and later categories cannot appear between Oil decisions because of append history.
9. Existing save/loading/conflict/retry behavior remains visible. A revision conflict reloads the authoritative draft and preserves the canonical next decision rather than duplicating or skipping a choice.
10. In Routine, the user sees a German rhythm specific to the stored cadence, such as `Etwa alle 2 Wochen` for a biweekly Mask or `Als Finish nach jeder passenden Haarwäsche` for Oil. Explicit user overrides continue to win.
11. Completion remains the existing Stage 3 handoff to the persistent Routine; no new stage or production activation is introduced.

## Planning evidence

- Current checkbox surface: transient desktop/mobile screenshots from the local Labs route.
- Corrected rendered journey: [`plans/evidence/2026-08-10-stage3-clarity-mockup.html`](./evidence/2026-08-10-stage3-clarity-mockup.html)
- Question answered: how to make Oil use-case capture simple without silently making recommendation, override, or shopping choices.
- Selected direction: one authoritative checkbox step; skip single-action replay; consolidate exception-only decisions.
- User feedback incorporated: the rejected per-role progress-card proposal has been removed rather than retained as an alternative.
- Evidence review: **confirmed by Nick on 2026-08-10**. Feedback incorporated: replace the per-role card proposal with one checkbox assignment; include multiple Oils on the same screen with exclusive role transfer.
- Artifact disposition: rendered HTML **commit** if implemented; transient screenshots **discard**.

## Ordered tasks

1. **Make decision-subject order canonical.**
   - Consumes: `Stage3ProductDraft.orderedCategories`, category authority role order, and captured-product order.
   - Add a failing regression in `tests/personal-plan-stage3-contracts.test.ts` using semantically identical initial and reopened/rebuilt drafts.
   - Sort derived subjects without mutating draft arrays.
   - Produces: stable inputs for authority evaluation, UI grouping, completion, and portfolio compilation.
   - Complete when both histories return the same exact category/role/product sequence and surrounding contract/state tests pass.

2. **Make the checkbox submission the only ordinary Oil role decision.**
   - Consumes: the existing `SemanticRoleAssignment`, `finalize_category_assignments` mutation, authority evaluations, and semantic actions.
   - Add component/flow tests first for the revised German copy, single- and multiple-Oil layouts, multi-select behavior, exclusive role transfer between Oils, selected/unchecked persistence, and no repeated card when every unresolved outcome has exactly one allowed action.
   - Implement a narrow classifier that marks only one-action evaluations as safe to auto-resolve. Preserve all existing semantic intents; do not invent client-side fit logic.
   - Auto-resolve those intents with existing CAS/conflict handling, then advance.
   - Produces: the common path `select product -> tick uses -> continue` with no redundant Oil loop.
   - Complete when a three-role Oil fixture reaches the next category without rendering three gap cards, while persisted resolutions remain identical to individually choosing their sole actions.

3. **Group real exceptions into one Oil review.**
   - Consumes: canonical unresolved subjects from Task 1 and non-single-action evaluations left by Task 2.
   - Add component/flow tests first for mixed recommendation/mismatch rows, independent actions, accessible names, retry, and completion only after every open row is resolved.
   - Group by adjacent category and captured product without changing authority actions or their server validation.
   - Produces: one exception-only Oil screen; no per-role pagination.
   - Complete when multi-action choices stay explicit, single-action rows stay absent, and a failed/conflicted row can be retried without replaying completed rows.

4. **Translate structured Routine cadence exhaustively.**
   - Consumes: `item.cadence.userOverride`, `item.cadence.recommended`, `item.cadence.displayKey`, and `item.role`.
   - Add table-driven UI regressions first for every `PlanFrequencyTarget` discriminant plus override precedence.
   - Implement one exhaustive presentation function; supported Personal Plan targets must never fall through to internal-key text.
   - Produces: specific German cadence copy with interval/role details preserved.
   - Complete when Mask/Oil examples and all other target kinds match the evidence matrix and no supported `personal_plan.cadence.*` key reaches visible or accessible text.

## Verification

Automated after sign-off and implementation:

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage3-contracts.test.ts`
- `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage3-components.test.tsx tests/personal-plan-stage3-flow.test.tsx`
- `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage4-ui.test.tsx`
- relevant Stage 3 state-machine, authority, portfolio, Routine compiler, and Routine interaction tests touched by the final diff;
- scoped ESLint and TypeScript checks.

Manual/browser after sign-off and implementation:

- select one Oil and verify multi-checkbox use-case assignment at desktop and 390px mobile;
- select several Oils and verify they render together, one Oil can cover several uses, and moving a use removes it from the previous Oil;
- verify an all-single-action fixture advances without later Oil cards;
- verify mixed recommendation/mismatch decisions appear once on a consolidated Oil screen;
- reopen Oil, resubmit, and verify Oil remains contiguous before later categories;
- render Mask/Oil Routine cards and confirm German cadence in visible and accessible text;
- verify save/loading/conflict/retry and Stage 3-to-Routine completion.

No migration or live-state checks are required because this slice changes no persistence schema or production data.

## Implementation receipt

Status: **implemented and verified locally; uncommitted; no activation**.

- Red evidence: the first focused run failed the new ordering, checkbox copy, consolidated-choice, automatic-advance, and cadence assertions against `origin/main` behavior.
- Focused green: 47/47 tests across Stage 3 contracts/components/flow and Stage 4 UI.
- Broader green: 916/916 Personal Plan tests, TypeScript, production build, Prettier, and ESLint with only four unrelated pre-existing warnings.
- Browser green: the guarded Stage 3 Labs route rendered at 1280px and 390px without console errors, error overlays, or horizontal overflow. The Oil screen showed the approved labels, and an unchecked three-role Oil submission advanced from the Conditioner decision directly to Kopfhautprodukt without replaying Oil gap cards.
- Environment note: the worktree-local build initially lacked Supabase variables; exporting the root checkout's existing `.env.local` produced a clean build. No external state or production data was changed.
- Retained evidence: this plan and the reviewed HTML mockup. Runtime screenshots remain transient outside the repository.

## Review and handoff

- Branch/worktree: `codex/stage3-clarity` at `/Users/nick/AI_work/hair_conscierge/.worktrees/stage3-clarity`, based on `origin/main` `1b2cb614`.
- Counterpart/Claude review: intentionally omitted by explicit user instruction.
- Evidence review: **confirmed**.
- User-journey sign-off: **confirmed by Nick on 2026-08-10**.
- Implementation state: **authorized to proceed locally through verification and review-ready handoff**.
- Artifact disposition: plan and corrected rendered mockup **commit** if implemented; transient screenshots **discard**.
- Stop point: verified local working tree. Do not commit, push, create a PR, merge, deploy, write production data, activate flags, or clean up.
