# Stage 3 applied receipt

2026-10-02. Worktree `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, branch `codex/test-audit-pruning`, HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Accepted plan: `/tmp/test-audit-stage3-cutover.md`. Parent released all runner windows and assigned exactly the four test files below; existing campaign changes were retained. No prompt/Compare file, production behavior, authority policy, provider, database, Git publication or production deployment was changed.

**Applied: four assertion transfers, two F repairs, exactly five AST-selected declaration removals. Nine-file baseline 373/373, transfer-only 373/373, after 368/368; 12/12 actual-owner mutations caught, each with clean green before/after controls and byte-exact restoration. Typecheck, four-file Prettier check and git diff --check pass.** Main reported its independent no-gap preservation review at `/tmp/test-audit-stage3-preservation.md`; the final campaign coverage gate remains with main.

## Permanent changes

- Flow keeper for server-authored no-owned gaps now observes a correction callback counter through a second settled render while retaining absent review/capture screens and zero mutations. Removed the obsolete optional-click replay.
- Existing initial grouped-Oil keeper now requires all three follow-up overrides undefined on its positively required anchor. Removed the duplicate setup/render declaration.
- Existing shell markup keeper now supplies Back and asserts its accessible label and wordmark. Removed the repeated header declaration; the earlier campaign's local-save assertions remain intact.
- Real production-gateway keeper now loads literal persisted A ownership, replaces it with B, observes the actual save input and exact output, and requires one revision increment. Both duplicate-exclusive-role and empty-role rejection requests target that committed revision on the same gateway; neither may add a save. Removed the lower Shampoo replay. The multi-role Oil replacement test remains.
- Removed the exact Routine-handoff replay; its stronger adjacent keeper and separate lifecycle/recovery paths remain.
- Both Oil F tests now require a present inventoryAuthority with status not_needed, proposedOutputSnapshot null and materialDelta [], retaining the old legacy-field check as supplementary evidence. Positive scalp-purpose coverage remains unchanged.

No runtime seam was unlocked or removed. No new test declarations or quota grouping were introduced.

## Exact accounting and preserved edits

The original files for this assigned turn are backed up under `/tmp/test-audit-stage3-original/`; these include the parent's earlier campaign edits. Comparison against those copies isolates this turn from the whole branch diff. Exact AST removal receipt: `/tmp/test-audit-stage3-cuts.json`; independent before/after accounting: `/tmp/test-audit-stage3-accounting.json`.

| File | AST before | AST after | New declarations |
|---|---:|---:|---:|
| `tests/personal-plan-stage3-flow.test.tsx` | 85 | 82 | 0 |
| `tests/personal-plan-stage3-components.test.tsx` | 16 | 15 | 0 |
| `tests/personal-plan-stage3-state-machine.test.ts` | 36 | 35 | 0 |
| `tests/personal-plan/products/production-persistence-gateway.test.ts` | 59 | 59 | 0 |

The five removed names, with pre-transfer original lines:

1. Flow:3361 `global no-owned-category review suppresses duplicate confirmation while staying on server state`
2. Flow:5236 `an explicit products module completion lands on the Routine directly`
3. Flow:5767 `the anchor's own screen carries no follow-up overrides`
4. Components:92 `stage 3 shell retires the 5-stage journey bar but keeps Back and the wordmark (Task 2.7)`
5. State:1636 `atomic category replacement clears and reassigns two-product Shampoo ownership`

Prior campaign removals receive no credit here. Incremental text diff against the turn's backup is 88 added / 297 removed lines (net -209) across four test files. Production/tooling/test-support permanent change: zero lines. `/tmp/test-audit-stage3-incremental-numstat.json` has the per-file breakdown. This is line accounting, not coverage or deletion-value evidence.

## Native checks actually run

Parent's baseline was completed before this turn; I inspected its stored TAP final summary. Commands run by me:

```sh
node /tmp/test-audit-stage3-prompt.cjs transferred
node /tmp/test-audit-stage3-prompt.cjs stage3-after
node /tmp/test-audit-stage3-mutations.cjs
node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='captured weekly Oil with confirmed scalp purpose|multiple captured Oils do not inherit|captured weekly Oil without scalp or dry-finish purpose' tests/personal-plan-stage3-state-machine.test.ts
node node_modules/prettier/bin/prettier.cjs --check tests/personal-plan-stage3-flow.test.tsx tests/personal-plan-stage3-components.test.tsx tests/personal-plan-stage3-state-machine.test.ts tests/personal-plan/products/production-persistence-gateway.test.ts
npm run typecheck
git diff --check
```

The nine-file wrapper uses the parent's unchanged native Node runner through c8 (`--all`, same src/scripts/apps/packages include set, `--test-concurrency=4`), including five prompt/Compare siblings without modifying them. Each output directory stores exact expanded `command.json`, `files.json`, `tests.tap`, run.log and coverage reports:

| Receipt directory | Result |
|---|---|
| `/tmp/test-audit-stage3-prompt-complete-before` | Parent baseline: 373 passed, 0 failed/skipped |
| `/tmp/test-audit-stage3-prompt-transferred` | 373 passed, 0 failed/skipped |
| `/tmp/test-audit-stage3-prompt-stage3-after` | 368 passed, 0 failed/skipped |

Post-restoration Oil trio: 3 passed, 0 failed (`/tmp/test-audit-stage3-oil-restored.tap`). Typecheck exited 0 (`/tmp/test-audit-stage3-typecheck.log`). Prettier exited 0 with all four files already conforming; no formatting rewrite was needed. `git diff --check` exited 0. All source/test mutations were serialized outside active runner windows. The final nine-file proof preceded mutation controls; final source hashes equal that proof's original source, and no tests changed afterward.

## Actual-owner mutation controls

Script: `/tmp/test-audit-stage3-mutations.cjs`. Full machine-readable evidence: `/tmp/test-audit-stage3-mutations/receipt.json`. Each row records exact native command, timestamps/durations, source original/mutated/restored SHA-256 and separate before/red/after TAP paths. Every selected test ran once, not skipped: **before exit 0/pass 1; mutant exit 1/fail 1; restored exit 0/pass 1**. All 12 failure diagnostics were inspected; none was an import, syntax, unrelated type or setup failure.

| Mutation ID | Actual owner fault | Observed expected failure |
|---|---|---|
| c1-correction | Flow effect calls the real correction callback for known-empty ownedCategories | New counter: actual 6, expected 0, Flow test:3369 |
| c2-headingOverride | Flow supplies unexpected heading fallback to initial anchor | unexpected follow-up vs undefined, :5548 |
| c2-scopeContextLine | Same, scope prop only | unexpected follow-up vs undefined, :5549 |
| c2-primaryActionLabelOverride | Same, CTA prop only | unexpected follow-up vs undefined, :5550 |
| c3-back | Stage3Shell omits onBack when forwarding to real header | Missing aria-label=Zurück markup, Components:84 |
| c3-wordmark | Stage3Shell passes showWordmark=false | Missing chaarlie markup, Components:85 |
| c4-retain-old-owner | Reducer retains A before appending B in category replacement | Valid B request throws role shampoo_everyday already assigned in cloneWithRevision/state-machine:471, through real replaceCategoryRoleAssignments; Gateway:1864 |
| c4-permit-duplicate | Actual shampoo_everyday multiplicity policy allows multiple products | Invalid A+B proposal is accepted: Missing expected rejection, Gateway:1901 |
| f-multiple-finish | capturedLoadFacts inherits category purpose despite two Oils | Actual authority pending vs expected not_needed, State:1610 |
| f-multiple-scalp | scalpLoadFacts independently inherits purpose despite two Oils | pending vs not_needed, State:1610 |
| f-unpurposed-finish | capturedLoadFacts treats single Oil as dry-finish without that purpose | pending vs not_needed, State:1620 |
| f-unpurposed-scalp | scalpLoadFacts treats single Oil as scalp-purpose without that purpose | pending vs not_needed, State:1620 |

No mutation was ineffective. The initially suggested deletion of only the reducer's duplicate-role throw was deliberately not used: the independent draft validator enforces the same rule/message. The shared multiplicity-policy fault makes the otherwise valid duplicate proposal reach the write path, proving the new rejection oracle. The A-retention fault fails before persistence through actual duplicate validation; it proves replacement removes the old owner, not solely a save stub's output. All four F faults reached the new authority assertion while the old productLoadResolution undefined assertion still passed.

## Restoration hashes

These five temporary owner files matched their pre-edit bytes after each respective mutation and again at final review. Full originals and hashes remain in `/tmp/test-audit-stage3-original/hashes.json`.

| Production owner | Original = final SHA-256 |
|---|---|
| `src/components/personal-plan-products/stage3-products-flow.tsx` | `56fb43ed28f9cea1b49f17788498ddea156df81642e16c9f57e64a058140120d` |
| `src/components/personal-plan-products/index.tsx` | `469b037449827d42cb3d720083cdbcc26ea1896d1697130756d26a6da43b36aa` |
| `src/lib/personal-plan/products/state-machine.ts` | `9f6180af77fcdb0decb53daa806d9f1e5330e63aa98839b2167637030ea6f6f3` |
| `src/lib/personal-plan/products/authorities.ts` | `46722afc73e14c5f10b83fd220bc4e5f82c3de001086881190cd1fb769b91e2b` |
| `src/lib/personal-plan/products/product-load-resolution.ts` | `871f29da53673db8995f477cc61b8e13a2497935d24544d2357fbf4dd09d6059` |

Final four test hashes are pinned in `/tmp/test-audit-stage3-accounting.json` so main can identify this reviewed state.

## Coverage evidence and limits

The nine-file c8 receipt reports identical covered/total lines and statements (36,285/441,041; 8.22%) and functions (2,165/5,633; 38.43%) before, transferred and after. Branches were 5,536/9,379 (59.02%) before, 5,535/9,378 (59.02%) transferred and 5,534/9,377 (59.01%) after. These are the **nine-file diagnostic under the global source include set**, not a full-suite campaign measurement. They do not establish the user's global coverage gate. Main must use the final all-suite proof and denominator/accounting policy.

The UI harness executes callbacks/element trees with its existing dispatcher; it does not prove browser lifecycle/layout or render the Oil child. C3 renders actual markup; C4 executes the real gateway/reducer with an observed fake persistence, not SQL or a database transaction. No new production authority decision was made. Main reported its independent preservation pass found no gap (`/tmp/test-audit-stage3-preservation.md`). Whole-branch integrated readiness remains with main; this worker's assigned implementation and focused proof are complete.

All runners have exited and all runner windows were explicitly released to main. This worker will start no further runner after that release.

## Current independent review disposition

Whole181 counterpart review (`/tmp/test-audit-final181-code-review.md`) found no hard defect. It read the newest diffs and ran its own typecheck/targeted lint, but did not independently rerun the native tests or mutations. Its pending full-proof wording describes dispatch time; main subsequently completed the frozen whole181 run and measured gates above. Prompt section-heading/private identifier exclusions were intentionally removed without changing actual prompt bytes or CTA values. Main does not adopt the suggested survey-orphan cleanup: the historical token/cookie-backed redemption path and storage contract remain executable and covered, documented in the retirement ledger. No current count or validity claim about issued production credentials was verified. No new feature or operator retirement is inferred. Every source import/export reference claim is limited by dynamic/operator/framework checks; a clean compiler alone is not proof of reachability.

Two proposed additional billing/static cuts were rejected and remain unchanged: the Partner source tests cover different live components; the Profile browser keeper writes configured external state and lacks the avatar/name/email observations. No deletion credit is claimed. Broader read-only ledgers and their truthful scope are linked in this directory; inventoried-only declarations are not classified from titles.
