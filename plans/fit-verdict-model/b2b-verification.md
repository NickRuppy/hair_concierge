# Fit-verdict B2b verification — 2026-10-12

Branch `codex/fit-verdict-model`; unchanged HEAD `c0127846216c0f4ad6c0cb66f849ea5322e11842`. No commit, publication, production write or sub-worker.

Decision coverage: confirmed by Nick’s ruled spec and the explicit B2b brief. Internal revalidation: gates, dry-shampoo additive tint/sensitivity, technology approval, trust then price, no preferred-step filtering, uniform mismatch actions. No new product decision.

Source/test content fingerprint (sorted path + SHA-256 manifest, excluding this receipt): `dd00befc855b21dacc38261532b9351b915bda463132c7f6529452421d7322a6`.

Implemented: all five remaining adapters call `evaluateFit` through `evaluateGateCriteria`; four are gates-only. Criterion objects retain `criterionId`, `label`, `result`, `explanation`; category missing-fact wire keys are preserved. Dry-shampoo targets are passed through plan, preview, web scan and mobile scan; unavailable personal tint is not guessed. No new tint UI or persistence is introduced.

The retired add-on rule lived in HEAD’s `src/lib/personal-plan/products/authority/categories/bondbuilder.ts`: relationship caution, the `relationship === "add_on" ? "supportive"` aggregation, and `validated_add_on` recommendation construction. `supportive-owned-recommendation.ts` also called that add-on builder. These are replaced by a failed standalone-role gate, candidate exclusion, and standalone-only recommendation construction. The K18 identifier remains exported for existing callers but has no ranking preference. Ranking consumers now use trust then price.

Owned mismatches across all ten categories allow `acknowledge_override` and `leave_uncovered`, plus `plan_recommendation` when a valid replacement exists. Mask and leave-in verdict logic is unchanged; their existing candidate selection is reused for replacement actions.

Action-list consumers: inspected UI comparison/flow, preview projection, direct acceptance, refinement recompute, fixture gateway, production persistence, product previews and pending recovery. Only fixture gateway action-list logic and the recompute explanation were changed; production persistence additionally receives the dry-shampoo target. Existing membership-based UI/action switching needs no change. UI labels/copy and audit files remain untouched.

Tests: table-driven category boundary coverage now includes every common gate, category role gates, required facts and wire keys, dry-shampoo 0/1/additive distance and unresolved tint, bondbuilder approval/add-on exclusion/trust-price selection, and mismatch actions with/without replacements for all ten categories. Old regressions are updated, not deleted, and cite the spec as ruled 2026-10-12. Reviewed technology fixtures replace legacy unspecified approval; trust ties replace K18/uncovered exceptions; owned companions remain visible but cannot be alternatives; explicit recompute exclusion remains uncovered; nonrecommendable research-only scans fail the lifecycle gate.

## Changed files

- `src/lib/mobile/scan-service.ts`
- `src/lib/personal-plan/product-previews.ts`
- `src/lib/personal-plan/products/authority/categories/bondbuilder.ts`
- `src/lib/personal-plan/products/authority/categories/deep-cleansing-shampoo.ts`
- `src/lib/personal-plan/products/authority/categories/dry-shampoo.ts`
- `src/lib/personal-plan/products/authority/categories/heat-protectant.ts`
- `src/lib/personal-plan/products/authority/categories/leave-in.ts`
- `src/lib/personal-plan/products/authority/categories/mask.ts`
- `src/lib/personal-plan/products/authority/categories/scalp-care.ts`
- `src/lib/personal-plan/products/authority/contracts.ts`
- `src/lib/personal-plan/products/authority/fit-criteria.ts`
- `src/lib/personal-plan/products/authority/supportive-owned-recommendation.ts`
- `src/lib/personal-plan/products/fit-comparison.ts`
- `src/lib/personal-plan/products/fixture-gateway.ts`
- `src/lib/personal-plan/products/production-persistence-gateway.ts`
- `src/lib/personal-plan/refinement-recompute/intents.ts`
- `src/lib/scan/load-scan-verdict.ts`
- `src/lib/scan/resolve-verdict.ts`
- `tests/bondbuilder-catalogue-consumers.test.ts`
- `tests/discovery-equal-options.test.ts`
- `tests/personal-plan-direct-accept-seen-state-join.test.ts`
- `tests/personal-plan/fit-verdict-categories.test.ts`
- `tests/personal-plan/product-previews.test.ts`
- `tests/personal-plan/products/production-persistence-gateway-budget.test.ts`
- `tests/personal-plan/products/stage3-authority.test.ts`
- `tests/personal-plan/products/stage3-fit-comparison.test.ts`
- `tests/personal-plan/refinement-recompute/intents.test.ts`

## Checks

- Red proof: original category implementation passed 154 and failed 39 of 193 cases (`/tmp/b2b-red.log`).
- Required category + mobile scan command: **207 passed, 0 failed** (`/tmp/b2b-authority-mobile-final.log`); category suite alone has 199 cases.
- Affected consumer regressions: **282 passed, 0 failed** (`/tmp/b2b-consumers-last.log`).
- TypeScript: exactly two expected TS2353 errors, both in the untouched `tests/audit-bondbuilder-leavein-oil-rules.test.ts`, lines 120 and 323 (`/tmp/b2b-tsc-final.log`).
- `git diff --check`: passed.
- `npm run test:personal-plan`: final run unfinished at the time limit; 2,508 emitted passes, no emitted failures (`/tmp/b2b-personal-plan-last.log`). Budget-only and trust-filtered budget runs were also unfinished. This is a remaining verification gate, not a pass.

## Full Node run

Final rerun: # tests 11307; # pass 11228; # fail 64; # skipped 15; # duration_ms 608358.834834. Log: `/tmp/b2b-node-final.log`.

Every non-audit failure:

- not ok 1920 - every map key is a real shared string (drift guard) — pre-existing Phase C copy drift. location: '/Users/nick/AI_work/hair_conscierge/.worktrees/fit-verdict-model/tests/discovery-cockpit-copy.test.ts:2:5772'
- not ok 7776 - review app serves package-local image files and blocks traversal — sandbox listener EPERM. location: '/Users/nick/AI_work/hair_conscierge/.worktrees/fit-verdict-model/tests/product-intake-review-app.test.ts:10:777'
- not ok 7777 - review app can process an approved image candidate into a finalization draft — sandbox listener EPERM. location: '/Users/nick/AI_work/hair_conscierge/.worktrees/fit-verdict-model/tests/product-intake-review-app.test.ts:10:2577'
- not ok 7778 - review app can request a targeted replacement image search — sandbox listener EPERM. location: '/Users/nick/AI_work/hair_conscierge/.worktrees/fit-verdict-model/tests/product-intake-review-app.test.ts:12:1043'
- not ok 7779 - review app searches source pages and attaches a replacement image candidate — sandbox listener EPERM. location: '/Users/nick/AI_work/hair_conscierge/.worktrees/fit-verdict-model/tests/product-intake-review-app.test.ts:12:3020'
- not ok 7968 - legacy product-list chunk ingestion refuses unflagged runs — sandbox IPC EPERM. location: '/Users/nick/AI_work/hair_conscierge/.worktrees/fit-verdict-model/tests/product-list-chunks.test.ts:2:2771'
- not ok 7969 - legacy product-list chunk ingestion flag proceeds past the guard — subprocess exit assertion; IPC environment remains unverified. location: '/Users/nick/AI_work/hair_conscierge/.worktrees/fit-verdict-model/tests/product-list-chunks.test.ts:3:72'
- not ok 7971 - markdown product-list ingestion is also guarded — sandbox IPC EPERM. location: '/Users/nick/AI_work/hair_conscierge/.worktrees/fit-verdict-model/tests/product-list-chunks.test.ts:3:1856'
- not ok 7972 - markdown guard does not block unrelated source-filtered ingestion — subprocess exit assertion; IPC environment remains unverified. location: '/Users/nick/AI_work/hair_conscierge/.worktrees/fit-verdict-model/tests/product-list-chunks.test.ts:3:2321'
- not ok 7974 - product ingestion preflight is not bypassed by PRODUCT_NAMES — sandbox IPC EPERM. location: '/Users/nick/AI_work/hair_conscierge/.worktrees/fit-verdict-model/tests/product-list-chunks.test.ts:3:4380'

The cockpit-copy drift assertion references a retired conditioner sentence. Its test, copy map and conditioner source are byte-identical to HEAD; fixing presentation/copy is outside B2b.

Unverified: completion of Personal Plan/budget checks; browser/live production behavior; external counterpart whole-branch review (no push requested). No full-green readiness claim. Keep all task changes uncommitted for review.

Completed first `npm run test:node` run: # tests 11307; # pass 11225; # fail 67; # skipped 15; # duration_ms 466399.458625. This earlier run had three additional B2b failures (research-only Bondbuilder scan and two equal-option fixtures); those were fixed and passed in the 282-case consumer rerun. The latest full rerun completed with none of those three failures. Its ten non-audit failures are listed above.
