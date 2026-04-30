# Agent v1 Production Readiness Review Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: use `branch-gate` before any edits, use `plan-grill` only if a review decision materially changes scope, use `code-reviewer` for review passes, and use `ready-check` before claiming merge readiness. This is a strict pre-merge plan for the production recommendation engine.

**Spec source:** current branch `codex/agent-v1-production-port`, user decisions in this session, and committed Agent v1 category work since `origin/main`.

**User situation:** Agent v1 now covers the major product categories: shampoo, conditioner, leave-in, oil, and mask. The branch has grown category-by-category, so the next work must verify architecture quality, code correctness, legacy RAG removal, and production merge readiness before it can become the main chat recommendation path.

**Promised end-state:** a reviewed, production-ready Agent v1 recommendation engine branch where `/api/chat` uses the bounded-agent architecture, major category logic is coherent and maintainable, legacy RAG product recommendation orchestration is removed or explicitly relocated out of the production path, and merge-to-main has no unresolved architecture, correctness, or production-readiness blockers.

---

## Current Branch Inventory

Branch/worktree:

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/agent-v1-production-port`
- Branch: `codex/agent-v1-production-port`
- Base: `origin/main`
- Relevant committed stack:
  - `54e04c7 feat(chat): port bounded agent to production chat`
  - `db7c2a6 feat(agent): add conditioner category replication`
  - `163f3d2 feat(agent): refine category recommendation routing`
  - `6e93170 fix(agent): expand mask split-end guidance`
  - `e30899e fix(agent): refine leave-in heat bonus handling`

Untracked local artifacts intentionally out of scope:

- `plans/2026-04-30-mask-compare-lab-feedback-fixes.md`
- `tmp/agent-compare-runs.jsonl`
- `tmp/leave-in-comparer-lab-findings-2026-04-29.md`
- `tmp/leave-in-feedback-analysis-2026-04-29.md`

Latest spot-check evidence at plan time:

- `npm run test:agent` passed, 114 tests
- `npx tsx --test tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts tests/agent-final-render-prompt.spec.ts` passed, 73 tests

---

## Scope

Primary production review scope:

- `/api/chat` production path
- bounded-agent route classification and route packet validation
- guidance loading and guidance packaging
- `select_products` and category-specific product projection
- recommendation-engine category decisions and reranking
- final renderer prompt and response packet contract
- persisted chat/debug trace compatibility
- tests that prove the five major category paths
- legacy RAG product recommendation orchestration removal

Major categories in scope:

- shampoo
- conditioner
- leave-in
- oil
- mask

Secondary/shared infrastructure in scope only where it affects production chat:

- memory extraction and memory context
- title generation
- Langfuse trace/debug trace persistence
- `rag_context` database compatibility
- admin conversation trace display
- eval-chat fixtures/assertions that are still used for readiness checks

Out of scope:

- agent compare lab architecture and UX, except for accidental production coupling or security exposure
- old local review notes under `tmp/`
- new product categories beyond the five major categories
- broad UI redesign
- DB schema rename from `rag_context`; compatibility can remain even if product RAG is removed

---

## Strict Merge Gate

This branch should not merge to `main` until all blocker classes below are resolved.

Blockers:

- correctness bugs in any major category
- unsupported product claims that can reach user-facing answers
- route/tool/prompt contract drift
- brittle cross-category duplication that makes the core recommendation engine hard to maintain
- old RAG product recommendation orchestration still reachable from production `/api/chat`
- legacy product-RAG modules still imported by production recommendation code without a deliberate relocation plan
- missing tests for a category behavior that the branch claims to support
- build, typecheck, or focused test failures
- production packaging failure for agent guidance files

Non-blocking only when explicitly documented:

- cosmetic naming cleanup with no behavioral or maintainability risk
- compare lab cleanup
- historical database field names such as `rag_context` when kept only for compatibility
- external docs cleanup unrelated to production chat

---

## Target File Map

Production agent front door:

- `src/app/api/chat/route.ts`
- `src/lib/agent/production/chat-pipeline.ts`

Agent orchestration:

- `src/lib/agent/contracts.ts`
- `src/lib/agent/orchestrator/model-client.ts`
- `src/lib/agent/orchestrator/prompt.ts`
- `src/lib/agent/orchestrator/route-packet.ts`
- `src/lib/agent/orchestrator/run-shadow-agent-turn.ts`
- `src/lib/agent/orchestrator/tool-definitions.ts`

Agent tools and guidance:

- `src/lib/agent/tools/get-user-context.ts`
- `src/lib/agent/tools/select-products.ts`
- `src/lib/agent/tools/build-or-fix-routine.ts`
- `src/lib/agent/guidance/catalog.ts`
- `src/lib/agent/guidance/load-guidance.ts`
- `data/agent-guidance/**`
- `next.config.ts`

Recommendation engine:

- `src/lib/recommendation-engine/categories/shampoo.ts`
- `src/lib/recommendation-engine/categories/conditioner.ts`
- `src/lib/recommendation-engine/categories/leave-in.ts`
- `src/lib/recommendation-engine/categories/oil.ts`
- `src/lib/recommendation-engine/categories/mask.ts`
- `src/lib/recommendation-engine/categories/index.ts`
- `src/lib/recommendation-engine/request-context.ts`
- `src/lib/recommendation-engine/selection.ts`
- `src/lib/recommendation-engine/types.ts`
- `src/lib/types.ts`
- category constants under `src/lib/conditioner`, `src/lib/leave-in`, `src/lib/oil`, and `src/lib/shampoo`

Legacy RAG/product orchestration audit:

- `src/lib/rag/pipeline.ts`
- `src/lib/rag/synthesizer.ts`
- `src/lib/rag/retriever.ts`
- `src/lib/rag/product-matcher.ts`
- `src/lib/rag/*-decision.ts`
- `src/lib/rag/*-reranker.ts`
- `src/lib/rag/category-engine/**`
- `src/lib/rag/selection/**`
- `src/lib/rag/router.ts`
- `src/lib/rag/intent-classifier.ts`
- `src/lib/rag/prompts.ts`
- `src/lib/recommendation-engine/selection.ts` imports from `src/lib/rag`
- `src/lib/recommendation-engine/chat.ts`
- `src/lib/routines/product-attachments.ts`
- scripts/tests importing old RAG modules

Tests:

- `tests/agent-*.spec.ts`
- `tests/recommendation-engine-categories.test.ts`
- `tests/recommendation-engine-selection.test.ts`
- `tests/chat-debug-trace.spec.ts`
- `tests/conditioner-chat-e2e.spec.ts`
- legacy RAG tests that must either be ported, deleted, or explicitly kept for non-production tooling

---

## Task 1: Freeze And Map The Review Snapshot

Goal: make the next reviews deterministic and avoid chasing stale local artifacts.

- [ ] Run `git status --short --branch`
- [ ] Run `git log --oneline origin/main..HEAD`
- [ ] Run `git diff --stat origin/main...HEAD`
- [ ] Run `git diff --name-only origin/main...HEAD`
- [ ] Confirm untracked `tmp/` and old review notes are excluded from review scope
- [ ] Produce a one-page inventory summary with:
  - category coverage
  - changed production entry points
  - changed recommendation-engine files
  - changed guidance files
  - legacy RAG files still referenced
  - verification already run

Exit criteria:

- Reviewers know exactly which committed code is in scope.
- Local note files are not treated as missing implementation.

---

## Task 2: Architecture Review

Goal: decide what should be shared, what should remain category-specific, and what must be cleaned up before merge.

Review questions:

- Is `select_products` too large, or is it currently an acceptable orchestrating projection layer?
- Which category projection concepts should be shared?
  - supported claims
  - unsupported requested signals
  - profile-deviation notices
  - fit status and fallback caveats
  - comparison facts
  - missing-info policies
- Which concepts must stay category-specific?
  - shampoo scalp-route/bucket logic
  - conditioner core-care logic
  - leave-in heat/format/conditioner-relationship logic
  - oil purpose/subtype/scalp-caution logic
  - mask balance/intensity/weight logic
- Is route-packet inference still understandable after category expansion?
- Are active profile overrides applied consistently where they should be?
- Is the runtime packet the right boundary between deterministic logic and final rendering?
- Are guidance files doing only response guidance, or are they hiding deterministic product decisions?
- Are final-render prompt rules too broad, too duplicated, or too category-specific?
- Are category tests organized so future category work can be added without duplicating large fixtures?

Suggested reviewer prompt:

```text
Review the current branch against origin/main from an architecture standpoint. Focus on the production Agent v1 recommendation engine, not compare lab. Identify shared abstractions that should exist before merge, category-specific logic that should consciously stay separate, brittle duplication, and contract boundaries between route packet, tools, recommendation engine, runtime packet, guidance, and renderer. Treat maintainability risks in the core recommendation engine as potential merge blockers.
```

Deliverable:

- [ ] Architecture findings grouped as:
  - must fix before merge
  - should fix before merge if small
  - safe follow-up
  - consciously keep separate
- [ ] Explicit decision on whether `select_products` needs pre-merge decomposition
- [ ] Explicit decision on whether route-packet helpers need pre-merge decomposition
- [ ] Explicit decision on what shared category projection helpers should exist before merge

Exit criteria:

- No unresolved architectural concern that would make the core recommendation engine hard to maintain after merge.

---

## Task 3: Thorough Code Review

Goal: find correctness bugs, contract regressions, missing tests, and unsafe category interactions.

Run review in focused passes instead of one giant review.

### Pass A: Production Chat Adapter

Scope:

- `src/app/api/chat/route.ts`
- `src/lib/agent/production/chat-pipeline.ts`
- trace/debug persistence compatibility
- SSE behavior
- guidance packaging

Review focus:

- auth/rate-limit/persistence preserved
- no old product RAG orchestration reachable
- product cards match rendered packet
- error handling and timeouts
- one-shot SSE behavior is acceptable and documented
- production build includes `data/agent-guidance/**`

### Pass B: Route Packet And Runtime Packet

Scope:

- `src/lib/agent/orchestrator/route-packet.ts`
- `src/lib/agent/orchestrator/run-shadow-agent-turn.ts`
- `src/lib/agent/orchestrator/tool-definitions.ts`

Review focus:

- category inference correctness
- product vs conceptual answer boundaries
- active signal extraction
- guidance id validation
- tool-plan determinism
- German phrasing variants in tests

### Pass C: Product Selection Projection

Scope:

- `src/lib/agent/tools/select-products.ts`
- `src/lib/recommendation-engine/request-context.ts`
- shared types

Review focus:

- unsupported claim handling
- supported claims only from structured product data
- comparison facts
- profile-deviation notices
- fallback/mismatch behavior
- missing-info behavior
- cross-category duplication that should be shared

### Pass D: Category Engines

Scope:

- shampoo
- conditioner
- leave-in
- oil
- mask
- shared category types/constants

Review focus:

- category-specific scoring/fit correctness
- conservative behavior for unsupported requests
- route/context interactions
- fit status semantics
- fallback thresholds
- no category accidentally inherits another category's rules

### Pass E: Guidance And Renderer Prompt

Scope:

- `data/agent-guidance/**`
- `src/lib/agent/orchestrator/prompt.ts`

Review focus:

- guidance supports deterministic logic instead of replacing it
- no unsupported medical/scalp or ingredient overclaims
- no hard rules based on weak evidence
- no category guidance conflicts
- final prompt does not ask the model to invent product facts

### Pass F: Tests

Scope:

- `tests/agent-*.spec.ts`
- `tests/recommendation-engine-*.test.ts`
- route/chat trace tests

Review focus:

- tests cover each major category path
- tests would fail for old-RAG fallback behavior
- tests prove unsupported requested signals
- tests prove no-product conceptual answers
- tests are not overfit to fixture names

Deliverable:

- [ ] Findings ordered by severity
- [ ] File/line references
- [ ] Missing test list
- [ ] Residual risk list
- [ ] Fix-or-defer decision for every finding

Exit criteria:

- No critical/high findings remain.
- Medium architecture or maintainability findings are either fixed or explicitly accepted by user decision.

---

## Task 4: Legacy RAG Product-Orchestration Removal

Goal: fully remove old product recommendation RAG orchestration where practical before merge, while preserving shared production infrastructure that still has a real owner.

Decision:

- Product recommendation RAG should be removed, not merely bypassed, if the dependency audit shows it is no longer used by production, tests, scripts, or admin flows that we still need.
- Shared infrastructure may survive, but should be renamed, relocated, or clearly documented so it is not mistaken for an active RAG recommendation path.

Removal audit:

- [ ] List every import from `src/lib/rag/**`
- [ ] Classify each import:
  - delete with old product RAG
  - move to `src/lib/agent` or another neutral module
  - keep temporarily for memory/title/debug compatibility
  - keep only for historical scripts/evals
- [ ] Identify production imports that must be removed or relocated before merge:
  - old `pipeline`
  - old `synthesizer`
  - old `retriever`
  - old `router` and `intent-classifier`
  - old category wrappers/rerankers
  - old product matching service if only used by legacy RAG
- [ ] Identify shared pieces that need a new home if still used:
  - `debug-trace`
  - `chat-response`
  - `memory-extractor`
  - `user-memory`
  - `title-generator`
  - `MatchedProduct` type if the new engine still imports it
  - clarification constants/helpers if still useful

Implementation shape:

- [ ] Move or duplicate small shared types/helpers out of `src/lib/rag` into neutral modules.
- [ ] Update Agent v1 and recommendation-engine imports to neutral modules.
- [ ] Delete old product recommendation RAG files after imports are gone.
- [ ] Delete or port obsolete tests that only validate the old product RAG path.
- [ ] Keep eval/admin compatibility only where it still measures the new Agent v1 path.
- [ ] Keep DB column `rag_context` unless a separate migration/rename is planned; this field can remain a compatibility storage name.
- [ ] Update comments/docs so "RAG" no longer describes production recommendation behavior.

Suggested reviewer prompt after removal patch:

```text
Review this branch for legacy RAG product orchestration removal. Verify no old RAG product recommendation pipeline, retriever, synthesizer, router, or category wrappers are reachable from production /api/chat or the Agent v1 recommendation engine. Verify retained former-rag modules are either relocated or justified as shared memory/title/debug infrastructure. Flag stale tests or scripts that still imply old RAG is the production recommendation path.
```

Exit criteria:

- Production `/api/chat` and Agent v1 category recommendation logic have no dependency on old product RAG orchestration.
- Any remaining `src/lib/rag` usage is intentionally shared compatibility infrastructure or explicitly scheduled for deletion.

---

## Task 5: Apply Review Fixes

Goal: fix all blockers and small high-value architecture cleanup before merge.

Fix policy:

- [ ] Fix every correctness blocker.
- [ ] Fix architecture duplication if it affects the maintainability of core category logic.
- [ ] Fix unsupported-claim risks immediately.
- [ ] Fix missing tests for claimed category behavior.
- [ ] Defer only cosmetic or low-risk cleanup with explicit user approval.

Recommended fix order:

1. Contract/correctness bugs
2. Unsupported product claim risks
3. Shared abstraction cleanup
4. Legacy RAG removal/relocation
5. Test cleanup
6. Docs/comments naming cleanup

Exit criteria:

- Review findings have a clear status.
- No blocker remains unresolved.

---

## Task 6: Verification Matrix

Automated checks required before merge-readiness claim:

- [ ] `npm run test:agent`
- [ ] `npx tsx --test tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts`
- [ ] `npx tsx --test tests/agent-final-render-prompt.spec.ts tests/chat-debug-trace.spec.ts`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Built trace check: `.next/server/app/api/chat/route.js.nft.json` includes `data/agent-guidance/**`

Manual or browser checks required because this is user-facing recommendation behavior:

- [ ] Run `npm run dev:worktree`
- [ ] Test one representative prompt per major category in local chat:
  - shampoo product pick
  - conditioner product pick or baseline core-care ask
  - leave-in heat/format ask
  - oil purpose ask
  - mask conceptual/product ask
- [ ] Confirm product cards match the products named in the answer
- [ ] Confirm conceptual questions do not force product cards
- [ ] Confirm unsupported ingredient/temperature/claim requests are caveated
- [ ] Confirm persisted assistant message has expected product recommendations and debug trace

Optional but recommended:

- [ ] Run eval-chat smoke set if fixtures are aligned with Agent v1
- [ ] Run `simulated-user-review` on the five-category chat flow after fixes

---

## Task 7: Production Merge Plan

Goal: turn review results into a clean merge path.

Before PR:

- [ ] Branch is clean except intentionally excluded local artifacts.
- [ ] All blocker findings resolved.
- [ ] Legacy RAG removal decision implemented.
- [ ] Verification matrix green.
- [ ] Final `code-reviewer` pass reports no blocking findings.
- [ ] PR description explicitly says:
  - Agent v1 is now the production chat recommendation front door
  - major categories covered
  - legacy product RAG orchestration removed or no longer reachable
  - verification run
  - known residual risks

Merge rules:

- [ ] Do not merge from this worktree to `main` until user explicitly approves.
- [ ] Treat merge and deployment as separate decisions.
- [ ] After merge, refresh root `main` with `git pull --ff-only`.

Post-merge cleanup:

- [ ] Delete or archive obsolete review artifacts only after user approval.
- [ ] Remove the task worktree only after PR/merge outcome is settled and no local-only files need preservation.

---

## Handoff Recommendation

Next work session should start with:

1. `branch-gate`
2. Task 1 inventory snapshot
3. Task 2 architecture review
4. Task 3 code review

Use `code-reviewer` for review execution. Use `ready-check` only after fixes and verification, before claiming this branch is merge-ready.
