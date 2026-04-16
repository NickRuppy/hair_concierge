# Recommendation Engine V1 Code Review Plan

## Goal

Review the full Recommendation Engine V1 worktree thoroughly with `$code-reviewer` before any PR prep.

Current state at planning time:
- worktree: `codex/recommendation-engine-v1`
- base alignment: branch tip matches `origin/main`
- review surface is mostly the current working tree, not branch history
- tracked diff vs `HEAD`: 36 files, about 1577 insertions and 1445 deletions
- additional untracked files include the new `src/lib/recommendation-engine/` module, support-category constants, migrations, scripts, tests, and planning docs

## Approach Options

| Approach | Complexity | Effort | Tradeoffs | Best when... |
|----------|-----------|--------|-----------|--------------|
| A: Single full-diff review | Low | ~1-2 hrs | Fast, but easy to miss cross-file contract regressions in a rewrite this large | we only want a quick risk scan |
| B: Layered subsystem review on one frozen snapshot | Medium | ~3-5 hrs | Best balance of depth and focus; requires a little setup to stabilize scope | one large rewrite needs a serious pre-PR review |
| C: Split into a commit stack, then review each slice | High | ~5-8 hrs | Highest clarity, but adds restructuring overhead before review even starts | we already know we want multiple commits or stacked PRs |

Recommended approach: `B`

Why:
- the implementation is large and cross-cutting
- the branch itself is not the review boundary yet
- we want thoroughness before PR, without first spending hours re-cutting history

## Review Scope

Primary scope:
- current diff in `/Users/nick/AI_work/hair_conscierge/.worktrees/recommendation-engine-v1` against `HEAD`
- all untracked files intended to ship with the rewrite

Specific review buckets:
1. Engine foundation and contracts
2. Chat integration and legacy-engine cutover
3. Admin, product-spec, validator, and persistence plumbing
4. Migrations and backfill scripts
5. Tests, traceability, and verification coverage

Files that should be explicitly classified early:
- `supabase/.temp/*` local artifacts
- deleted-and-replaced migrations with nearby timestamp changes
- planning docs that inform intent but should not dilute the code review

## Plan

### 1. Freeze the review snapshot

Goal:
- make the review deterministic before we start filing findings

Actions:
- run:
  - `git status --short --branch`
  - `git diff --stat HEAD`
  - `git diff --name-only HEAD`
  - `git ls-files --others --exclude-standard`
- classify untracked files into:
  - intended product/code changes
  - test-only additions
  - local noise
- prefer one stable anchor before review:
  - either stage all intended files, or
  - create a local WIP commit with no PR yet

Exit criteria:
- we know exactly what is in scope
- reviewers are not chasing a moving target

### 2. Build the review map

Split the work into these review passes:

| Pass | Scope | Main risk focus |
|------|-------|-----------------|
| 1 | `src/lib/recommendation-engine/**`, `src/lib/types.ts`, `src/lib/validators/index.ts`, category constants | contract drift, runtime correctness, conservative fallbacks, trace completeness |
| 2 | `src/lib/rag/**`, `src/app/api/chat/route.ts`, `src/lib/routines/**` | chat regressions, legacy-cutover gaps, bad routing, missing decision context |
| 3 | admin pages/routes, product APIs, product-spec plumbing | schema/UI mismatch, invalid hydration, broken save/update paths |
| 4 | `supabase/migrations/**`, `scripts/backfill-*.ts`, `scripts/export-*.ts` | migration ordering, destructive changes, backfill safety, idempotency |
| 5 | `tests/**` affected by the rewrite | missing scenario coverage, false-positive tests, unsupported assumptions |

### 3. Run `$code-reviewer` pass by pass

Use the skill on each pass separately, not one giant prompt.

Suggested prompts:

1. Engine core
   `Use $code-reviewer to review the current diff against HEAD for runtime correctness, contract regressions, conservative recommendation behavior, and missing tests. Focus on src/lib/recommendation-engine/** plus any touched shared types and validators.`

2. Integration and cutover
   `Use $code-reviewer to review the current diff against HEAD for chat regressions and contract mismatches. Focus on src/lib/rag/**, src/app/api/chat/route.ts, and src/lib/routines/**.`

3. Admin and persistence plumbing
   `Use $code-reviewer to review the current diff against HEAD for schema drift, admin save/hydration regressions, and data integrity risks. Focus on admin product pages/routes, product-spec plumbing, and shared types.`

4. Migrations and scripts
   `Use $code-reviewer to review the current diff against HEAD for migration safety, timestamp/order issues, destructive schema changes, and backfill script risk. Focus on supabase/migrations/** and scripts/backfill-*.ts.`

5. Test review
   `Use $code-reviewer to review the changed and new tests against the implementation for missing coverage, invalid assumptions, and untested regression paths.`

Review habit for every pass:
- start from the actual diff
- read changed files in surrounding context
- inspect nearby tests, helpers, and call sites before finalizing a finding
- keep findings limited to real production or maintenance risk

### 4. Consolidate findings into one ship gate

For each pass, capture:
- findings ordered by severity
- open questions that materially affect confidence
- residual risks or missing verification

Then merge the outputs into one pre-PR review summary with these gates:
- no critical or high findings left unresolved
- no unexplained migration deletion/rename/order changes
- no ambiguous contract drift between engine output, chat response, and persisted trace
- support-category no-data behavior is explicitly verified
- local artifact files are removed, ignored, or intentionally kept with a reason

### 5. Verify after fixes

After addressing review findings, rerun:
- `npm run typecheck`
- `npx tsx --test tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-planner.test.ts tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts tests/recommendation-engine-routine.test.ts tests/admin-product-support-specs.test.ts`
- `npx playwright test tests/chat-debug-trace.spec.ts tests/conditioner-reranker.spec.ts tests/shampoo-flow.spec.ts --reporter=line`

Recommended broader check before PR if time permits:
- `npm run lint`
- `npm run build`

### 6. Final pre-PR review pass

Once fixes are in and targeted verification is green:
- run one final `$code-reviewer` pass on the remaining diff
- ask only for blocking findings and residual risks
- use that output as the final go/no-go signal for PR prep

## Expected Outcomes

By the end of this plan we should have:
- a stable review scope
- subsystem-level findings instead of one noisy mega-review
- explicit answers on migration safety, traceability, and engine-to-chat contract integrity
- a clear decision on whether the branch is ready for PR preparation

## Notes For This Worktree

Extra attention is warranted for:
- engine-only cutover behavior in the chat path
- routine planning and product attachment changes that removed legacy decision helpers
- newly added support-category plumbing for `bondbuilder`, `deep_cleansing_shampoo`, `dry_shampoo`, and `peeling`
- migrations that appear to replace earlier timestamped files rather than only append new ones
