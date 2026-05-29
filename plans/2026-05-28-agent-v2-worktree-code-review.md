# AgentV2 Worktree Code Review Plan

> **For agentic reviewers:** REQUIRED SUB-SKILL: Use `superpowers:requesting-code-review` for orchestration and `code-reviewer` for correctness/security/regression review. Use a `code-reviewer` agent with the structural prompt in Task 6 for maintainability review; do not rely on a separate subagent type existing. Review steps use checkbox (`- [ ]`) syntax for tracking. This plan is read-only unless a later fix pass is explicitly requested.

**Goal:** Thoroughly review `codex/gpt-54-responses-migration-plan` before merge/deploy, with special focus on the latest uncommitted production switch that makes AgentV2 GPT-5.4-mini + CareBalance the `/api/chat` production engine. The earlier branch review is useful prior art, but it did not cover the final production adapter, `/api/chat` import switch, AgentV2 production-state extraction, CareBalance authority contract change, debug-trace plumbing, or Compare Lab production-path cleanup now present in the worktree.

**Architecture:** Run a focused final review on the current dirty diff first, because that is the unreviewed production-risk surface. Then use the earlier Clawpatch/Amorex-style branch review as context for broader regression risks. Split human-style reviewer slices so each reviewer owns a coherent surface instead of skimming a large diff. The integration reviewer merges findings, verifies high-confidence issues locally, and separates blockers from acceptable follow-ups.

**Compatibility decision:** The new engine does not have to fake old-engine metadata to fit the old `PipelineResult` box. Preserve fields still consumed by frontend, persistence, SSE, and debugging; update callers or use truthful empty/neutral fields when old semantics no longer match. Reviewers should flag brittle compatibility shims that force AgentV2/CareBalance into stale old-engine concepts.

**Tech Stack:** Next.js 16, TypeScript, AgentV2 Responses runtime, recommendation engine, Supabase migrations, Node test runner, Compare Lab.

---

## Scope

Primary branch:

```bash
codex/gpt-54-responses-migration-plan
```

Primary final review scope for this pass:

```bash
git diff --name-only
git diff --stat
```

This is the current uncommitted production-switch implementation. It must be reviewed before commit/push because it was added after the earlier broad review.

Secondary merge review scope:

```bash
origin/main...HEAD
```

Fresh pushed tranche scope:

```bash
77cbd28..HEAD
```

Latest production-switch files to inspect first:

```text
src/app/api/chat/route.ts
src/lib/agent-v2/production/chat-pipeline.ts
src/lib/agent-v2/production/conversation-history.ts
src/lib/agent-v2/production/persisted-session-state.ts
src/lib/agent-v2/production/product-output.ts
src/lib/agent-v2/production/session-state.ts
src/lib/agent-v2/runtime/product-tool-context.ts
src/lib/agent-v2/runtime/responses-agent.ts
src/lib/agent-v2/contracts.ts
src/lib/agent-v2/tools/select-products-projection.ts
src/lib/agent/tools/care-balance-context.ts
src/lib/rag/debug-trace.ts
src/lib/rag/conversation-state.ts
src/lib/rag/conversation-state-store.ts
src/lib/types.ts
src/lib/agent/production/chat-pipeline.ts (deleted active legacy path)
src/lib/agent/legacy-production/chat-pipeline.ts (archived legacy reference only)
src/app/api/labs/agent-compare/route.ts
src/app/api/labs/agent-compare/judgments/route.ts
src/app/labs/agent-compare/page.tsx
src/components/labs/agent-compare-lab.tsx
src/lib/agent/compare/run-compare.ts
src/lib/agent/compare/types.ts
tests/agent-v2-production-chat-pipeline.spec.ts
tests/agent-production-chat-pipeline.spec.ts (deleted legacy assurance test)
tests/agent-v2-responses-runtime.spec.ts
tests/agent-compare-api.spec.ts
tests/agent-compare-product-trace.spec.ts
tests/agent-compare-runner.spec.ts
tests/agent-routine-tool.spec.ts
tests/agent-v2-manual-regression.spec.ts
data/agent-v2/evals/request-interpretation-regression.json
data/agent-v2/evals/guidance-migration-regression.json
data/agent-v2/guidance/base/general-advice.json
plans/2026-05-28-agent-v2-review-fix-pass.md
plans/2026-05-29-agent-v2-post-ship-cleanup-backlog.md
plans/2026-05-29-agent-v2-production-switch-state-alignment.md
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
- `build`: pass; the earlier Turbopack NFT tracing warning around AgentV2 guidance compiler imports has been resolved after the Compare Lab lazy-import and compiler trace-boundary cleanup
- `clawpatch:init`: pass after Clawpatch setup was ported into this branch
- `clawpatch:doctor`: pass; provider detected as `codex`, provider version `codex-cli 0.130.0`
- `clawpatch:map`: pass; 243 features mapped after the latest production-switch cleanup
- `clawpatch:summary -- --base origin/main`: pass
- `clawpatch:review -- --since origin/main --limit 3 --jobs 1`: pass; smoke batch produced 4 open findings for later triage

Last known additional verification after the production switch. If this predates the most recent adapter extraction, treat it as stale until Task 8 reruns it:

- `npm run typecheck`: pass
- `npm run lint`: pass, 0 errors and 5 existing warnings
- `npm run test:node`: pass, 288 pass and 0 fail
- `npm run test:agent`: pass, 616 pass and 0 fail
- `npm run build`: pass, with no Turbopack NFT tracing warning after the 2026-05-29 cleanup pass
- `git diff --check`: pass

Current final-review execution status, 2026-05-29:

- Done: review packet commands ran for the dirty production-switch diff, `origin/main...HEAD`, and `77cbd28..HEAD`.
- Done: Clawpatch context pass ran through `clawpatch:init`, `clawpatch:doctor`, `clawpatch:map`, and `clawpatch:summary -- --base origin/main`; broad `clawpatch:review --limit 10` remains optional unless integration review requests it.
- Done: five focused reviewers completed Task -1, Task -1B, Task 1, Task 2, and Task 6.
- Fixed before commit: AgentV2 production now treats any runtime `failure_stage` as a visible failure before exposing product cards, engine artifacts, or new prior product projections.
- Fixed before commit: AgentV2 product-card projection no longer falls back to unrelated current-turn products when the final answer references prior-only product ids that the adapter cannot render faithfully.
- Fixed before commit: low-content German confirmations such as `Ja bitte.` no longer authorize routine mutation without a matching pending routine action.
- Fixed before commit: broad first-add-on basics requests now let CareBalance `add` rows choose the category-level first add-on, instead of letting the legacy routine priority reset override the current-turn decision context.
- Fixed before commit: direct product asks using German `zu` stay direct and do not inherit stale referential product context.
- Fresh targeted verification: `npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-product-tool-context.spec.ts tests/agent-routine-tool.spec.ts` passed with 112/112 tests after the fix pass.
- Fresh broader verification: `npx tsc --noEmit` passed; `npm run test:agent` passed with 620/620 tests; `npm run test:node` passed with 288/288 tests; `npm run lint` passed with 0 errors and 5 existing warnings; `npm run build` passed with only the existing edge-runtime static-generation notice; `git diff --check` passed.
- Deferred to post-ship backlog: route-level AgentV2 persistence/SSE harness coverage, `context_signal` CareBalance mapping, shared production/Compare Lab adapter extraction, and runtime policy-layer splitting.
- Remaining before commit/push: run the integration/codex review gates required by this plan, then do manual `/chat` smoke testing.

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
git diff --shortstat
git diff --stat
git diff --name-only
git diff --shortstat origin/main...HEAD
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
git diff --shortstat 77cbd28..HEAD
git diff --stat 77cbd28..HEAD
git diff --name-only 77cbd28..HEAD
```

Expected current worktree state before this final review:

```text
## codex/gpt-54-responses-migration-plan...origin/codex/gpt-54-responses-migration-plan
 M ...
 D src/lib/agent/production/chat-pipeline.ts
 D tests/agent-production-chat-pipeline.spec.ts
?? src/lib/agent-v2/production/
?? src/lib/agent-v2/runtime/product-tool-context.ts
?? src/lib/agent/legacy-production/
?? tests/agent-v2-production-chat-pipeline.spec.ts
```

The worktree is expected to be dirty for this final review. Do not pause merely because it is dirty. Instead, classify the dirty changes into:

- Latest production-switch implementation: review now.
- Earlier branch work already reviewed: use as context.
- Unrelated local/generated artifacts: exclude unless they are accidentally staged or imported.

## Settled Review Posture

- Review bar: blockers plus serious maintainability. Do not turn the review into broad cleanup before this commit.
- Final action buckets: `Fix before commit`, `Post-ship cleanup backlog`, or `False positive / intentional tradeoff`. `Needs manual triage` is allowed only as a temporary reviewer state.
- Reviewers are read-only. They may propose directions but must not edit files.
- Use a two-pass review: five focused reviewers first, then integration review of the full active production call graph.
- Include Clawpatch as semantic context. Start from the existing smoke findings; run a broader Clawpatch pass only if the integration reviewer asks for fresh tool output.
- Review the full active production path, not only named files or selected tools. Start at `/api/chat` and follow dependencies through context loading, CareBalance, AgentV2 runtime, reachable tools, validation/repair, mapping, streaming, tracing, and persistence.
- Compare Lab is internal and not a production blocker. It matters only if it misleads us about what production actually runs or if production diverges from the AgentV2+CareBalance behavior that was manually tested there.
- Old logic may remain physically present as temporary archive/debug code, but there must be no active production call path or fallback into the old production tool-loop.
- Persistence correctness is in scope. Wrong database state is a blocker even if the visible answer looks fine.
- Compatibility mapping must be truthful. Do not force AgentV2/CareBalance into stale old-engine metadata just to fill old fields.
- Easy warnings/cleanup may be fixed if cheap, but non-risky cleanup belongs in the post-ship backlog.
- Manual `/chat` smoke testing happens after review/fixes; reviewers should make sure the path is traceable and testable.

Non-blocking cleanup findings must be written to:

```text
plans/2026-05-29-agent-v2-post-ship-cleanup-backlog.md
```

Do not bury cleanup-only findings in chat summaries. If an issue is not a blocker or serious pre-ship maintainability concern, log it there with enough context to tackle after this ship.

## Task -1: Latest Production Switch Review

**Reviewer type:** `code-reviewer`

This task is the most important one for the current session. It reviews the code added after the earlier broad review.

**Files to inspect first:**

- `src/app/api/chat/route.ts`
- `src/lib/agent-v2/production/chat-pipeline.ts`
- `src/lib/agent-v2/production/conversation-history.ts`
- `src/lib/agent-v2/production/persisted-session-state.ts`
- `src/lib/agent-v2/production/product-output.ts`
- `src/lib/agent-v2/production/session-state.ts`
- `src/lib/agent-v2/runtime/product-tool-context.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/contracts.ts`
- `src/lib/agent-v2/tools/select-products-projection.ts`
- `src/lib/agent/tools/care-balance-context.ts`
- `src/lib/rag/debug-trace.ts`
- `src/lib/rag/conversation-state.ts`
- `src/lib/rag/conversation-state-store.ts`
- `src/lib/types.ts`
- `src/lib/agent/production/chat-pipeline.ts` deletion diff
- `src/lib/agent/legacy-production/chat-pipeline.ts`
- `tests/agent-v2-production-chat-pipeline.spec.ts`
- `package.json`

- [ ] Check that `/api/chat` always routes to AgentV2 GPT-5.4-mini + CareBalance and never silently falls back to the old production tool-loop.
- [ ] Review the full active production call graph for a real chat turn, not only the files listed here. Start at `/api/chat` and follow every production dependency needed to answer, tool, validate, map, stream, trace, and persist the turn.
- [ ] Check that the new production adapter preserves the existing route contract: streaming, product cards, sources, router decision, conversation state transition, trace persistence, visible failure behavior, and assistant-message persistence.
- [ ] Check production persistence side effects end to end: user message insert, assistant message insert, conversation state transition persistence, turn trace persistence, streamed product/source metadata, and any routine-tool persistence or saved-routine mutation path. Wrong database state is a blocker even if the visible answer looks good.
- [ ] Check compatibility fields critically: do not require AgentV2 to mimic old-engine metadata where the concept changed. Fields still consumed by the app must be truthful; stale old-box fields should be empty/neutral or trigger a caller/frontend update decision rather than brittle fake mapping.
- [ ] Check that the adapter does not reintroduce old planner logic or product truth outside the catalog/product tools.
- [ ] Check CareBalance is present for every production turn and is scoped correctly: authoritative for current-turn category decisions and soft ranking hints, not product truth or saved routine storage.
- [ ] Check that product IDs surfaced in the final answer map to grounded selected products before becoming product cards.
- [ ] Check every active AgentV2 production tool path reachable from the runtime, including product, routine, and guidance tools. Verify tool inputs receive the right production context, tool outputs are projected without inventing facts, and blocked/failed tool calls cannot be treated as successful.
- [ ] Check the split production adapter boundaries: `chat-pipeline.ts` should orchestrate, `persisted-session-state.ts` should own V2 state normalization/promotion, `session-state.ts` should own turn-to-turn AgentV2 memory/routine/product state, `product-output.ts` should own legacy route-compatible product/category projections, `conversation-history.ts` should only load bounded recent history, and `runtime/product-tool-context.ts` should only enrich referential product follow-ups. Flag duplicated policy or stale copies across these modules.
- [ ] Check routine-tool output and routine-thread state are preserved without claiming saved routine mutations that did not run.
- [ ] Check privacy/debug behavior concretely: inspect `ChatPromptSnapshot`, `AgentV2Trace`, persisted conversation turn trace fields, and Langfuse summaries. List any field containing raw user message text; for each one, confirm the persistence/logging path is intended.
- [ ] Check production failure modes: model/runtime/tool errors should result in controlled visible failure or route error behavior, not hanging streams or malformed SSE.
- [ ] Check test coverage for the production switch. Do not claim tests catch a reverted `/api/chat` import unless there is a route-level integration/static assertion for that exact import; otherwise classify the gap.
- [ ] Confirm rollback procedure is documented and viable after the archive move: change the dynamic import in `src/app/api/chat/route.ts` from `@/lib/agent-v2/production/chat-pipeline` to `@/lib/agent/legacy-production/chat-pipeline`, restore the destructured/called symbol from `runAgentV2ProductionPipeline` to the legacy `runProductionAgentPipeline`, and note that old active-path tests were deleted so rollback would need targeted smoke/test restoration before deploy.
- [ ] Check whether the adapter extraction is coherent enough for this ship. Default decision is keep the current split if correct and isolated; require more extraction before commit only if module boundaries create a concrete bug/fork/grounding/privacy/failure-mode risk or make required test coverage impractical.

Suggested reviewer prompt:

```text
Review only the current dirty production-switch diff in worktree `/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan`.

This latest diff makes AgentV2 GPT-5.4-mini + CareBalance the production `/api/chat` engine. The earlier broad review did not cover this exact adapter and route switch.

Focus on:
- the complete active production call graph from `/api/chat` through AgentV2 runtime/tools/final answer mapping
- production adapter route-contract compatibility
- the new split adapter modules and whether state/product/history/context responsibilities are cleanly owned
- production persistence side effects and database state correctness
- whether compatibility mapping truthfully preserves still-used fields instead of forcing AgentV2 into stale old-engine metadata
- product/routine/guidance tool grounding and state persistence
- CareBalance authority scope
- trace/privacy behavior
- failure modes and test coverage

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`. Do not edit files.
```

## Task -1B: Production Persistence, Trace, And SSE Review

**Reviewer type:** `code-reviewer`

This is a dedicated persistence/DB reviewer so database state correctness does not get buried inside the adapter review.

**Files to inspect first:**

- `src/app/api/chat/route.ts`
- `src/lib/agent-v2/production/chat-pipeline.ts`
- `src/lib/agent-v2/production/conversation-history.ts`
- `src/lib/agent-v2/production/persisted-session-state.ts`
- `src/lib/agent-v2/production/product-output.ts`
- `src/lib/agent-v2/production/session-state.ts`
- `src/lib/rag/debug-trace.ts`
- `src/lib/rag/conversation-state.ts`
- `src/lib/rag/conversation-state-store.ts`
- `src/lib/rag/chat-response.ts`
- `src/lib/rag/contracts.ts`
- `src/lib/types.ts`
- `tests/agent-v2-production-chat-pipeline.spec.ts`
- `tests/agent-production-chat-pipeline.spec.ts` deletion diff

Use the deleted `tests/agent-production-chat-pipeline.spec.ts` diff/history as a comparison point for old production persistence behavior, not as proof that the new production path is covered.

- [ ] Trace all production persistence side effects for a successful turn.
- [ ] Trace all production persistence side effects for model/tool/runtime failure.
- [ ] Verify user messages, assistant messages, turn traces, Langfuse trace references, conversation state transitions, streamed product/source metadata, and visible failure behavior are preserved or intentionally updated.
- [ ] Verify the new adapter does not persist fake old-engine metadata or lose AgentV2/CareBalance trace evidence needed for debugging.
- [ ] Verify `persisted-session-state.ts` accepts legacy flat AgentV2 fields, rejects malformed projections safely, and writes the V2 envelope without letting old V1 behavioral fields steer AgentV2.
- [ ] Verify `session-state.ts` preserves visible routine steps, prior grounded product projections, accepted session memory, and visible-failure state without mutating on failure.
- [ ] Verify `product-output.ts` cannot surface unmatched or ungrounded products as cards through legacy route compatibility mapping.
- [ ] Verify routine-tool outcomes do not claim or persist saved routine changes unless the actual routine tool/runtime path supports it.
- [ ] Check whether tests would catch wrong `engine_variant`, missing `agent_v2_trace`, missing product cards, or wrong assistant-message persistence.

Suggested reviewer prompt:

```text
Review the production persistence, trace, and SSE surface of the current dirty production-switch diff in worktree `/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan`.

Start from `/api/chat` and follow successful and failed turns through message persistence, stream events, trace persistence, conversation-state persistence, product/source metadata, and visible failure handling.

Focus on database state correctness and truthful production traces. Wrong persisted state is a blocker even if the visible answer looks correct. Do not edit files.

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`.
```

## Task 0: Clawpatch Semantic Context Pass

**Reviewer type:** Clawpatch CLI plus local integration reviewer

This is now a secondary broad review context step. Do not let it distract from Task -1 unless it reports a finding in the latest production-switch files. Reuse the existing `--limit 3` smoke findings first; run a fresh broad Clawpatch review only if Task 7 explicitly asks for more tool coverage.

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
features: 243
```

The exact count may change after future edits; investigate only if it drops unexpectedly or the command fails.

- [ ] Generate the branch summary:

```bash
npm run clawpatch:summary -- --output clawpatch-summary.md --base origin/main
```

Expected: `clawpatch-summary.md` exists locally and lists touched slices including recommendation engine, Agentic chat/tools, Supabase schema, and review tooling.

- [ ] Optional only if Task 7 asks for fresh tool output: run a broad Clawpatch review batch:

```bash
npm run clawpatch:review -- --since origin/main --limit 10 --jobs 3
```

Expected if run: command exits 0 and writes `.clawpatch/findings/` plus a run report under `.clawpatch/reports/`.

- [ ] Optional only if a fresh broad review ran: generate a readable report:

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

Action buckets:

- `Fix before commit`: production blockers, serious pre-ship maintainability risks, wrong engine/path wiring, wrong persistence behavior, grounding/tool contract failures, privacy/debug leakage, or compatibility shims that would make the new main path brittle immediately.
- `Post-ship cleanup backlog`: useful cleanup that should not block this commit, including legacy deletion, adapter extraction, naming cleanup, warning cleanup, old test cleanup, and Compare Lab usability polish.
- `Needs manual triage`: temporary reviewer state for plausible issues that need main-session/user judgment before they can be placed into one of the two action buckets.

Do not leave `Needs manual triage` unresolved in the final report. If it matters before this switch is committed, classify it as `Fix before commit`; otherwise add it to `plans/2026-05-29-agent-v2-post-ship-cleanup-backlog.md`.

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
- `src/lib/agent-v2/runtime/product-tool-context.ts`
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
- [ ] Check referential product follow-up context: `runtime/product-tool-context.ts` should help "welches davon / welches Produkt passt" turns without turning direct named-product questions into stale prior-context searches.
- [ ] Check that terminal contracts match tool calls and product/routine IDs.
- [ ] Confirm tests cover the key regressions: category-level routine mutation, first-add-on, routine permission, current-care fact handling, closure validator behavior.

Suggested reviewer prompt:

```text
Review the AgentV2 runtime/validator slice of branch `codex/gpt-54-responses-migration-plan`, prioritizing the current dirty diff first and using `origin/main...HEAD` as broader context.

Focus only on correctness, regressions, safety, data/contract integrity, and missing tests. Do not edit files.

Prioritize:
- tool-call authorization and safety mode
- product grounding and routine grounding
- routine-thread context semantics
- validator strictness versus model autonomy
- repair-loop behavior
- current-care facts and CareBalance context as consumed by AgentV2
- any interaction between runtime repair/validation and the new production AgentV2 adapter

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
Review the CareBalance and recommendation-engine slice of branch `codex/gpt-54-responses-migration-plan`, prioritizing the current dirty diff first and using `origin/main...HEAD` as broader context.

Focus on whether the new production CareBalance/effective-care context creates coherent category decisions and does not conflict with stored routine inventory, current user message facts, or product grounding. In particular, verify that the new scoped authority contract is truthful in both runtime data and AgentV2 prompt wording.

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`.
```

## Optional Task 3: Compare Lab Evidence Path And Test Harness

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
- [ ] Check that the previous build warning stays resolved: Compare Lab runners should remain development-only/lazy-loaded, and production bundles should not trace the AgentV2 compare runner through the lab route.
- [ ] Do not block on Compare Lab usability polish. Block only if Compare Lab evidence misrepresents what production runs, or if its runner divergence invalidates the manual testing evidence used for this production switch.

Suggested reviewer prompt:

```text
Review the Compare Lab evidence path and compare-runner slice of branch `codex/gpt-54-responses-migration-plan`, prioritizing the current dirty diff first and using `origin/main...HEAD` as broader context.

Focus on whether Compare Lab still truthfully represents the AgentV2+CareBalance behavior used as manual evidence for the production switch. Do not report internal usability polish unless it makes us misunderstand production behavior. Confirm the previous Turbopack NFT tracing warning remains resolved rather than treating it as an active finding.

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`.
```

## Optional Task 4: Data, Migrations, Admin Product Support, And Vocabulary

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

This task is part of the broader branch review context. It is not one of the five focused production-switch reviewers unless the integration reviewer needs a fresh check here.

## Optional Task 5: Guidance, Documentation, And Archived Plans

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

This task is part of the broader branch review context. It is not one of the five focused production-switch reviewers unless the integration reviewer needs a fresh check here.

## Task 6: Thermo Structural Review

**Reviewer type:** `code-reviewer` with strict structural-maintainability prompt

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
- [ ] Check whether the new production module split reduced risk or merely moved complexity across files. Focus on duplicated policy, circular ownership, stale copied helpers, and whether any additional extraction is required before merge.
- [ ] Distinguish “fix before merge” from “future cleanup”; do not demand broad rewrites unless there is a concrete failure path.

Suggested reviewer prompt:

```text
Run a strict structural maintainability review of branch `codex/gpt-54-responses-migration-plan`, prioritizing the current dirty production-switch diff first and using `origin/main...HEAD` as broader context.

Focus on architecture, coupling, policy layering, fallback complexity, validator/model/tool boundaries, production adapter shape, legacy-path disconnection, and maintainability risks. This is not a style review. Report only issues with a concrete failure or maintenance-cost path.

Return findings first using the review output contract in `plans/2026-05-28-agent-v2-worktree-code-review.md`.
```

## Task 7: Integration Review

**Owner:** main reviewer in this session

Required focused reviewer inputs:

1. `Task -1`: Latest Production Switch Review
2. `Task -1B`: Production Persistence, Trace, And SSE Review
3. `Task 1`: AgentV2 Runtime, Contracts, And Validators
4. `Task 2`: CareBalance And Recommendation Engine
5. `Task 6`: Thermo Structural Review

Required context input:

- `Task 0`: Clawpatch Semantic Context Pass

Optional context input:

- `Task 3`: Compare Lab Evidence Path And Test Harness, if there is any doubt about Compare Lab versus production behavior.
- `Task 4` and `Task 5`, if a reviewer or Clawpatch finding points back into data/guidance/docs.

- [ ] Collect all reviewer outputs.
- [ ] Merge duplicate findings.
- [ ] Locally verify each `Critical`, `High`, and plausible `Medium` finding by reading the cited code and, if necessary, running a minimal command.
- [ ] Classify findings:
  - `Fix before commit`
  - `Needs manual triage`
  - `Post-ship cleanup backlog`
  - `False positive / intentional tradeoff`
- [ ] Produce one final findings-first report with file references.
- [ ] Do not edit files during this step unless the user explicitly asks for fixes.

Final report shape:

```markdown
### Review Scope

- Branch/base:
- Latest dirty diff reviewed:
- Subagents used:
- Thermo lane:
- Verification already available:

### Findings

- [severity] ...

### Post-Ship Cleanup Backlog Updates

- Items added to `plans/2026-05-29-agent-v2-post-ship-cleanup-backlog.md`:

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

- [ ] Run one manual production `/chat` smoke check for the key routine/CareBalance case:

Before using the named test user, confirm the user exists in the real local production `/chat` test context. If not, replace with an equivalent real saved test user and record the replacement in the final report.

```text
Test user: Dan Meier · straight · coarse
Turn 1: Ich will meine Routine einfacher machen.
Turn 2: Welches Produkt passt für den ersten Zusatz?
Expected: first add-on resolves to Conditioner, not Leave-in / Finish or optional reset.
```

- [ ] Run one mirror production `/chat` smoke check:

Before using the named test user, confirm the user exists in the real local production `/chat` test context. If not, replace with an equivalent real saved test user and record the replacement in the final report.

```text
Test user: Phil Dörrenhaus · curly · normal
Turn 1: Ich habe Shampoo und Conditioner. Was sollte ich als naechstes ergaenzen?
Turn 2: Warum nicht direkt Maske oder Oel?
Turn 3: Okay, zeig mir dann ein passendes Produkt fuer den ersten Hebel.
Expected: AgentV2 + CareBalance resolves first lever to Leave-in, not Conditioner.
```

- [ ] Confirm rollback note is present in the final report:

```text
Rollback path: in src/app/api/chat/route.ts, change the dynamic import from @/lib/agent-v2/production/chat-pipeline back to @/lib/agent/legacy-production/chat-pipeline and restore the destructured/called symbol from runAgentV2ProductionPipeline to runProductionAgentPipeline. Restore or replace targeted legacy smoke coverage, then rerun production route/pipeline smoke tests before deploy.
```

The old active production test was deleted in this branch, so do not claim rollback is verified by the current AgentV2 production test alone.

- [ ] Confirm final git state:

```bash
git status --short --branch
```

Expected:

```text
## codex/gpt-54-responses-migration-plan...origin/codex/gpt-54-responses-migration-plan
```

## Task 8B: Whole-Branch Codex Rescue Review

Run after Task 7 findings are addressed and before push.

- [ ] Run the project-standard whole-branch Codex review on `git diff main...HEAD`.

Preferred invocation:

```text
Agent({ subagent_type: "codex:codex-rescue", prompt: "Whole-branch review of git diff main...HEAD for codex/gpt-54-responses-migration-plan. Focus on integration-level issues in the AgentV2+CareBalance production switch, /api/chat wiring, persistence, grounding, rollback, and cross-file regressions. Return findings only; do not edit files." })
```

If the `codex:codex-rescue` agent is unavailable in this session, run the closest available whole-branch `code-reviewer` pass and record the fallback in the final report. Do not use a stalled command invocation as proof of review.

- [ ] Triage findings into the same action buckets:
  - `Fix before commit`
  - `Needs manual triage`
  - `Post-ship cleanup backlog`
  - `False positive / intentional tradeoff`

- [ ] Address all `Fix before commit` findings before push.

- [ ] If codex-rescue findings require code changes, rerun Task 8 verification after those changes.
