# AgentV2 Worktree Code Review Plan

> **For agentic reviewers:** REQUIRED SUB-SKILL: Use `request-code-review` for orchestration, `code-reviewer` for correctness/security/regression review, and `thermo-nuclear-code-quality-review` for structural maintainability. Review steps use checkbox (`- [ ]`) syntax for tracking. This plan is read-only unless a later fix pass is explicitly requested.

**Goal:** Thoroughly review `codex/gpt-54-responses-migration-plan` before merge/deploy, with special focus on AgentV2, CareBalance, product/routine grounding, compare lab, data migrations, and the 18 commits just pushed.

**Architecture:** Run Clawpatch first as a semantic feature-map/finding tracker, then run split human-style reviewer slices so each reviewer owns a coherent risk surface instead of skimming a 160+ file diff. The integration reviewer merges Clawpatch and subagent findings, verifies high-confidence issues locally, and separates blockers from acceptable follow-ups.

**Tech Stack:** Next.js 16, TypeScript, AgentV2 Responses runtime, recommendation engine, Supabase migrations, Node test runner, Compare Lab.

---

## Scope

Primary branch:

```bash
codex/gpt-54-responses-migration-plan
```

Primary merge review scope:

```bash
origin/main...HEAD
```

Fresh pushed tranche scope:

```bash
77cbd28..HEAD
```

Known verification already run before this plan was written:

```bash
npm run typecheck
npm run test:node
npm run test:agent
npm run lint
npm run build
```

Observed results:

- `typecheck`: pass
- `test:node`: 288 pass, 0 fail
- `test:agent`: 612 pass, 1 skip, 0 fail
- `lint`: 0 errors, 5 warnings
- `build`: pass, with one Turbopack NFT tracing warning around `src/app/api/labs/agent-compare/route.ts` importing AgentV2 guidance compiler context
- `clawpatch:init`: pass after Clawpatch setup was ported into this branch
- `clawpatch:doctor`: pass; provider detected as `codex`, provider version `codex-cli 0.130.0`
- `clawpatch:map`: pass; 242 features mapped
- `clawpatch:summary -- --base origin/main`: pass
- `clawpatch:review -- --since origin/main --limit 3 --jobs 1`: pass; smoke batch produced 4 open findings for later triage

Clawpatch generated state is local-only and ignored:

```text
/.clawpatch/
/clawpatch-report.md
/clawpatch-summary.md
```

## Review Packet Commands

Run these before dispatching reviewers and attach the relevant output excerpts to each reviewer prompt.

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan
git status --short --branch
git diff --shortstat origin/main...HEAD
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
git diff --shortstat 77cbd28..HEAD
git diff --stat 77cbd28..HEAD
git diff --name-only 77cbd28..HEAD
```

Expected current branch state before review:

```text
## codex/gpt-54-responses-migration-plan...origin/codex/gpt-54-responses-migration-plan
```

If the worktree is dirty, pause and classify the dirty changes before dispatching reviewers.

## Task 0: Clawpatch Semantic Review Pass

**Reviewer type:** Clawpatch CLI plus local integration reviewer

**Files and config:**

- `.github/workflows/clawpatch.yml`
- `clawpatch.config.json`
- `docs/clawpatch-code-review.md`
- `docs/codex-review-map.md`
- `scripts/ci/prepare-clawpatch.mjs`
- `scripts/ci/clawpatch-summary.mjs`
- `package.json`
- `package-lock.json`

- [ ] Initialize local Clawpatch state:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan
npm run clawpatch:init
```

Expected:

```text
Prepared Clawpatch state at .clawpatch
```

- [ ] Check the environment:

```bash
npm run clawpatch:doctor
```

Expected:

```text
state: ok
provider: codex
```

- [ ] Generate the feature map:

```bash
npm run clawpatch:map
```

Expected:

```text
features: 242
```

The exact count may change after future edits; investigate only if it drops unexpectedly or the command fails.

- [ ] Generate the branch summary:

```bash
npm run clawpatch:summary -- --output clawpatch-summary.md --base origin/main
```

Expected: `clawpatch-summary.md` exists locally and lists touched slices including recommendation engine, Agentic chat/tools, Supabase schema, and review tooling.

- [ ] Run a broad Clawpatch review batch:

```bash
npm run clawpatch:review -- --since origin/main --limit 10 --jobs 3
```

Expected: command exits 0 and writes `.clawpatch/findings/` plus a run report under `.clawpatch/reports/`.

- [ ] Generate a readable report:

```bash
npm run clawpatch:report -- --output clawpatch-report.md
```

- [ ] Triage Clawpatch output before subagent dispatch:
  - Findings in files touched by this branch: include in the relevant reviewer prompt.
  - Findings outside this branch's scope: list as separate backlog candidates unless they can block deployment.
  - Weak semantic findings: mark `uncertain` or `false positive`; do not turn them into churn.
  - Clawpatch patch/fix commands are not allowed in this review pass unless the user explicitly asks for fixes.

Smoke findings already observed from `--limit 3`:

- `medium` delayed onboarding auto-advance can override back navigation.
- `medium` `ci:verify` does not run project test suites.
- `medium` profile goals save clears `desired_volume`.
- `low` subscription portal button can remain loading after failed request.

These are not automatically accepted. The integration reviewer must verify whether each finding is branch-relevant, pre-existing, and worth fixing before merge/deploy.

## Reviewer Output Contract

Each reviewer must return:

```markdown
### Findings

- [severity] Title - file path + line reference, concrete failure mode, user/runtime impact, and proposed direction.

### Open Questions / Assumptions

- Only questions that change confidence or merge readiness.

### Verification / Gaps

- Tests inspected, commands not run, and manual cases still needed.

### Bottom Line

- Ready / needs fixes / needs deeper investigation for this slice.
```

Severity:

- `Critical`: likely runtime breakage, security exposure, data loss, or irreversible bad state.
- `High`: strong chance of user-facing regression, broken edge case, or contract mismatch.
- `Medium`: meaningful maintainability or test gap with plausible failure path.
- `Low`: non-blocking risk worth fixing soon.

Do not report style-only nits unless they hide a real defect or a concrete maintenance risk.

## Task 1: AgentV2 Runtime, Contracts, And Validators

**Reviewer type:** `code-reviewer`

**Files to inspect first:**

- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/contracts.ts`
- `src/lib/agent-v2/tools/tool-definitions.ts`
- `src/lib/agent-v2/tools/routine-projection.ts`
- `src/lib/agent-v2/tools/select-products-projection.ts`
- `src/lib/agent-v2/validation/final-answer-validator.ts`
- `src/lib/agent-v2/validation/user-facing-language.ts`
- `tests/agent-v2-responses-runtime.spec.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-contracts.spec.ts`
- `tests/agent-v2-tool-projections.spec.ts`

- [ ] Check tool-call authorization boundaries: `select_products`, `build_or_fix_routine`, guidance loading, safety mode, product detail, and routine mutation flows.
- [ ] Check that validators block only contract/safety/grounding failures and do not over-police answer style after the closure-polish changes.
- [ ] Check routine-thread context semantics: `action`, `necessity`, `already_in_current_routine`, `return_path`, and product-recommendation follow-ups.
- [ ] Check repair behavior: bounded repairs should not mask persistent invalid model/tool behavior or erase useful context.
- [ ] Check that terminal contracts match tool calls and product/routine IDs.
- [ ] Confirm tests cover the key regressions: category-level routine mutation, first-add-on, routine permission, current-care fact handling, closure validator behavior.

Suggested reviewer prompt:

```text
Review the AgentV2 runtime/validator slice of branch `codex/gpt-54-responses-migration-plan` against `origin/main...HEAD`, with a second lens on `77cbd28..HEAD`.

Focus only on correctness, regressions, safety, data/contract integrity, and missing tests. Do not edit files.

Prioritize:
- tool-call authorization and safety mode
- product grounding and routine grounding
- routine-thread context semantics
- validator strictness versus model autonomy
- repair-loop behavior
- current-care facts and CareBalance context as consumed by AgentV2

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`.
```

## Task 2: CareBalance And Recommendation Engine

**Reviewer type:** `code-reviewer`

**Files to inspect first:**

- `src/lib/recommendation-engine/care-balance/index.ts`
- `src/lib/recommendation-engine/care-balance/evaluators.ts`
- `src/lib/recommendation-engine/care-balance/shared.ts`
- `src/lib/recommendation-engine/effective-care-context.ts`
- `src/lib/recommendation-engine/request-context.ts`
- `src/lib/recommendation-engine/selection.ts`
- `src/lib/recommendation-engine/runtime.ts`
- `src/lib/recommendation-engine/planner/intervention.ts`
- `src/lib/agent/tools/care-balance-context.ts`
- `src/lib/agent/tools/build-or-fix-routine.ts`
- `src/lib/agent/tools/select-products.ts`
- `tests/recommendation-engine-care-balance.test.ts`
- `tests/recommendation-engine-care-balance-comparison.test.ts`
- `tests/recommendation-engine-selection.test.ts`
- `tests/recommendation-engine-categories.test.ts`
- `tests/agent-v2-current-care-context.spec.ts`

- [ ] Check current routine inventory authority: stored routine, latest user message, generated routine plan, and CareBalance rows must not contradict each other silently.
- [ ] Check `action`, `necessity`, `status`, `current_frequency`, and `possibly already in routine`-style semantics for category recommendations.
- [ ] Check that CareBalance context improves selection without becoming a hidden product database.
- [ ] Check category-specific edge cases: conditioner baseline, leave-in booster, mask optional extra, oil overload, heat protectant, deep cleansing reset, bondbuilder structural cases.
- [ ] Check that explicit user requests are honored with caveats instead of blocked or sycophantically praised.
- [ ] Check tests for the previously observed failures: first-add-on confusion, existing shampoo+conditioner next lever, oil overload, deep-cleansing reset focus.

Suggested reviewer prompt:

```text
Review the CareBalance and recommendation-engine slice of branch `codex/gpt-54-responses-migration-plan` against `origin/main...HEAD`, with special attention to `77cbd28..HEAD`.

Focus on whether the new CareBalance/effective-care context creates coherent category decisions and does not conflict with stored routine inventory, current user message facts, or product grounding.

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`.
```

## Task 3: Compare Lab And Test Harness

**Reviewer type:** `code-reviewer`

**Files to inspect first:**

- `src/components/labs/agent-compare-lab.tsx`
- `src/app/api/labs/agent-compare/route.ts`
- `src/app/api/labs/agent-compare/judgments/route.ts`
- `src/lib/agent/compare/run-compare.ts`
- `src/lib/agent/compare/run-agentic-tool-loop.ts`
- `src/lib/agent/compare/scenarios.ts`
- `src/lib/agent/compare/tool-loop-variants.ts`
- `src/lib/agent/compare/types.ts`
- `src/lib/agent-v2/compare/run-agent-v2.ts`
- `tests/agent-compare-api.spec.ts`
- `tests/agent-compare-product-trace.spec.ts`
- `tests/agent-compare-runner.spec.ts`
- `tests/agent-v2-compare-runner.spec.ts`
- `tests/agent-compare-test-users.spec.ts`

- [ ] Check that Compare Lab labels accurately distinguish AgentV2 baseline from AgentV2 + CareBalance.
- [ ] Check that real test users remain available and that result saving cannot mix stale results with a changed selected user.
- [ ] Check that analysis snapshots and CareBalance traces are truthful and do not show product-tool-local context as if it were the whole turn.
- [ ] Check blinded mode, AgentV2-only mode, multi-turn mode, and empty prompt rejection.
- [ ] Check that development-only route guards remain intact.
- [ ] Check the build warning import path for practical risk: compare-lab route importing guidance compiler context should not unintentionally trace the project in production bundles beyond the non-blocking warning.

Suggested reviewer prompt:

```text
Review the Compare Lab and compare-runner slice of branch `codex/gpt-54-responses-migration-plan` against `origin/main...HEAD`.

Focus on truthful lab UX, correct AgentV2-vs-AgentV2+CareBalance wiring, saved judgment integrity, trace accuracy, and dev-route containment. Include the build warning about Turbopack NFT tracing in your risk assessment.

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`.
```

## Task 4: Data, Migrations, Admin Product Support, And Vocabulary

**Reviewer type:** `code-reviewer`

**Files to inspect first:**

- `scripts/seed-deep-cleansing-products.ts`
- `supabase/migrations/20260526120000_rename_deep_cleansing_reset_focus_values.sql`
- `supabase/migrations/20260528110000_add_thermal_rollers_styling_tool.sql`
- `supabase/migrations/20260528192000_reapply_deep_cleansing_reset_focus_values.sql`
- `src/lib/deep-cleansing-shampoo/constants.ts`
- `src/lib/recommendation-engine/categories/deep-cleansing-shampoo.ts`
- `src/lib/recommendation-engine/assessments/reset.ts`
- `src/components/onboarding/screens/heat-tools-screen.tsx`
- `src/components/ui/icon.tsx`
- `src/lib/types.ts`
- `src/lib/vocabulary/profile-labels.ts`
- `src/app/admin/products/page.tsx`
- `tests/seed-deep-cleansing-products.test.ts`
- `tests/admin-product-support-specs.test.ts`
- `tests/heat-tools-vocabulary.test.tsx`

- [ ] Check migration ordering, reversibility expectations, and whether enum/value changes are compatible with existing rows.
- [ ] Check seed safety: expected project confirmation, idempotence, no accidental broad updates, catalog lifecycle assumptions.
- [ ] Check deep-cleansing reset focus values are consistent across DB, product specs, admin UI, and recommendation engine.
- [ ] Check thermal rollers are correctly accepted in profile validation, labels, onboarding UI, and heat exposure logic.
- [ ] Check product support spec validation does not allow incomplete deep-cleansing products or unsupported claims.

Suggested reviewer prompt:

```text
Review the data/migration/vocabulary slice of branch `codex/gpt-54-responses-migration-plan` against `origin/main...HEAD`.

Focus on Supabase migration safety, product seed idempotence, deep-cleansing product spec integrity, and thermal rollers compatibility across profile, onboarding, labels, and recommendation logic.

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`.
```

## Task 5: Guidance, Documentation, And Archived Plans

**Reviewer type:** `code-reviewer`

**Files to inspect first:**

- `data/agent-v2/guidance/base/product-recommendation.md`
- `data/agent-v2/guidance/base/product-recommendation.json`
- `docs/agent-v2-guidance-migration/**`
- `docs/superpowers/specs/2026-05-20-agent-v2-category-guidance-standardization-design.md`
- `docs/superpowers/specs/2026-05-21-agent-v2-routine-first-regression-fixes-design.md`
- `docs/superpowers/specs/2026-05-27-agent-v2-conversation-closure-polish-design.md`
- `plans/archive/**`
- `tests/agent-v2-guidance-compiler.spec.ts`
- `tests/agent-v2-manual-regression.spec.ts`

- [ ] Check guidance metadata and markdown are paired and not contradictory.
- [ ] Check product recommendation guidance does not reintroduce infeasible or generic closers.
- [ ] Check archived docs/plans are intentional and do not remove active implementation context needed by future sessions.
- [ ] Check guidance compiler tests assert durable metadata/rubrics rather than brittle prose when possible.
- [ ] Check manual regression cases cover the actually changed behaviors, not only the exact historic prompts.

Suggested reviewer prompt:

```text
Review the guidance/docs/plans slice of branch `codex/gpt-54-responses-migration-plan` against `origin/main...HEAD`.

Focus on guidance consistency, product recommendation closure behavior, category/routine grounding rules, archived-doc intent, and whether tests protect durable behavior rather than one-off prompt wording.

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`.
```

## Task 6: Thermo Structural Review

**Reviewer type:** `thermo-nuclear-code-quality-review`

Run this because the branch crosses the thermo gate:

- 160+ files changed against `origin/main`
- Agent runtime and validator changes
- recommendation engine state/context changes
- API route and compare lab changes
- migrations and product seeding
- many new tests and helper paths

- [ ] Look for architectural drift, duplicated policy layers, excessive deterministic gates, hidden coupling between planner/projection/model/validator, and fragile fallback logic.
- [ ] Check whether CareBalance sits at the right architectural layer or leaks into product selection/routine tooling in a way that will be hard to maintain.
- [ ] Check whether compare-lab-only code is isolated from production chat/runtime paths.
- [ ] Check whether large files became harder to reason about and whether a small extraction is warranted before merge.
- [ ] Distinguish “fix before merge” from “future cleanup”; do not demand broad rewrites unless there is a concrete failure path.

Suggested reviewer prompt:

```text
Run a strict structural maintainability review of branch `codex/gpt-54-responses-migration-plan` against `origin/main...HEAD`.

Focus on architecture, coupling, policy layering, fallback complexity, validator/model/tool boundaries, and maintainability risks. This is not a style review. Report only issues with a concrete failure or maintenance-cost path.

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`.
```

## Task 7: Integration Review

**Owner:** main reviewer in this session

- [ ] Collect all reviewer outputs.
- [ ] Merge duplicate findings.
- [ ] Locally verify each `Critical`, `High`, and plausible `Medium` finding by reading the cited code and, if necessary, running a minimal command.
- [ ] Classify findings:
  - `Block before merge`
  - `Fix before deploy`
  - `Follow-up acceptable`
  - `False positive / intentional tradeoff`
- [ ] Produce one final findings-first report with file references.
- [ ] Do not edit files during this step unless the user explicitly asks for fixes.

Final report shape:

```markdown
### Review Scope

- Branch/base:
- Subagents used:
- Thermo lane:
- Verification already available:

### Findings

- [severity] ...

### Open Questions / Assumptions

- ...

### Verification / Residual Risk

- ...

### Bottom Line

- ...
```

## Task 8: Post-Fix Verification Gate

Run only after review findings are addressed.

- [ ] Run:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan
npm run typecheck
npm run lint
npm run test:node
npm run test:agent
npm run build
```

- [ ] Run one manual Compare Lab smoke check for the key routine/CareBalance case:

```text
Test user: Dan Meier · straight · coarse
Turn 1: Ich will meine Routine einfacher machen.
Turn 2: Welches Produkt passt für den ersten Zusatz?
Expected: first add-on resolves to Conditioner, not Leave-in / Finish or optional reset.
```

- [ ] Run one mirror Compare Lab smoke check:

```text
Test user: Phil Dörrenhaus · curly · normal
Turn 1: Ich habe Shampoo und Conditioner. Was sollte ich als naechstes ergaenzen?
Turn 2: Warum nicht direkt Maske oder Oel?
Turn 3: Okay, zeig mir dann ein passendes Produkt fuer den ersten Hebel.
Expected: AgentV2 + CareBalance resolves first lever to Leave-in, not Conditioner.
```

- [ ] Confirm final git state:

```bash
git status --short --branch
```

Expected:

```text
## codex/gpt-54-responses-migration-plan...origin/codex/gpt-54-responses-migration-plan
```
