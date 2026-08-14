# Personal Plan uncovered-product choices — code-review receipt

## Review identity

- Scope: the complete uncommitted task tree, including 15 fingerprinted implementation, test, plan, and mockup files plus task-owned readiness artifacts.
- Branch: `codex/personal-plan-uncovered-product-choices`
- Branch point: `6ca24b64196d1d9414aa9ea1d25e5b9cf8e1a825`
- Current local/origin `main`: `8f349e7cef518575d0c7148bcbf9da0e15dd61f5`, two non-overlapping CI-timeout and Routine-card commits ahead. That upstream delta is not part of this task review.
- Reviewed canonical content fingerprint: `66c5dfe25175d5b22e33fcc06e3a281d171f8021e9f85242945abeee8451e37a`
- Review lanes: normal correctness/contracts plus strict structural maintainability. Structural review was required because the change spans more than four source files, exceeds 150 changed lines, and initially pushed a 960-line shared fixture gateway above 1,000 lines.
- Counterpart: one read-only Claude Opus 4.8 code review at `high`; the main session verified every material finding against the tree and tests.

## Findings and rulings

No blocking findings remain.

Resolved findings:

1. `onSearch` remained as a dead public prop and a silent no-op caller after uncovered search was removed. The prop, caller wiring, and obsolete test callbacks are deleted; owned-product capture search remains unchanged in its own surface.
2. The generic title produced `Wähle dein Conditioner`. Category-specific selection headings now live in the canonical Stage 3 copy map, including `Wähle deinen Conditioner`, `Wähle deine Maske`, and `Wähle dein Leave-in`.
3. Adding one Labs scenario directly to `fixture-gateway.ts` pushed it from 960 to 1,019 lines. Scenario entry contexts now live in the focused 63-line `fixture-scenarios.ts`; the shared gateway remains at 960 lines.
4. The coverage-audit fix preserved Deep Cleansing's requested role but initially left recommendation IDs role-agnostic. The ID now includes the exact reset role, avoiding collisions when one product supports both `residue_reset` and `mineral_reset`.

Accepted tradeoff:

- Browsing the rotating secondary card is intentionally presentation-only. Until a card is selected, the visibly selected fixed best recommendation remains the CTA target. The generic short CTA does not name the product, but the selected outline stays visible and the component regression explicitly proves that browsing alone does not change the saved exact ID/fingerprint. This matches the reviewed Variant B contract.

Rejected/inapplicable counterpart note:

- The counterpart described local `main` as behind the task head. The refs show the opposite: the task branch point is `6ca24b64`, while local/origin `main` is two later non-overlapping commits at `8f349e7c`. The upstream commits change CI timeout behavior and the separate Routine-card surface; neither overlaps this task's fingerprinted files.

## Correctness and structural conclusions

- Removing the duplicate uncovered `ideal` filter preserves the category adapter as the single authorization boundary; mismatch, unknown, unsafe, inactive, wrong-role, incomplete-protocol, and non-recommendable candidates remain excluded.
- Candidate ranking, cap, exact fingerprints, explicit selection, persistence, completion revalidation, and `planned_purchase` lifecycle remain server-authoritative.
- The Deep Cleansing role correction is bounded and test-first: the matrix red proof identified `mineral_reset`, and the exact role plus stable ID are locked.
- Labs-only behavior remains behind the existing gate and does not add network, auth, privacy, migration, or production-data surface.
- The review delta removes dead API surface and restores the shared fixture file below the structural threshold; no new abstraction or branching concern remains.

## Verification considered

- `npm run test:personal-plan` — 1484/1484 passed after review fixes.
- `npm run test:playwright:personal-plan-stage3` — 16/16 passed after review fixes.
- Focused post-review component, fit-comparison, and Stage 3 flow set — 123/123 passed.
- `npm run ci:verify` — typecheck, lint with zero errors/four unrelated existing warnings, and production build with 126 routes passed after review fixes.
- Focused changed-source ESLint with `--max-warnings=0` — passed.
- `git diff --check` — passed.
- The commit hook's formatting-only delta was reviewed, the branch was rebased onto `8f349e7c`, and the complete Personal Plan, browser, and repository verification gates passed on the refreshed fingerprint.

## Artifact disposition and residual risk

- Commit later if explicitly authorized: implementation, tests, approved plan, HTML mockup, manifest, and both receipts.
- Transient counterpart output and local screenshots remain outside the repository.
- The original production request/response payload was not captured, so verification proves the reproduced class of dead end and the exact deterministic authority/persistence/browser paths, not a byte-for-byte replay of Nick's original request.
- The task branch is two non-overlapping commits behind current `main`; publication should refresh/rebase and rerun the guarded ship gate when authorized.
- No stage, commit, push, PR, merge, deployment, migration, feature activation, catalog publication, or production write occurred.

## Bottom line

No blocking findings. The fingerprinted tree clears correctness and structural review and is ready for a separate explicit publication gate.
