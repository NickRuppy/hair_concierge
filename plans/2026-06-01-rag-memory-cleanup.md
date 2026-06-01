# RAG And Memory Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename and relocate live chat memory/state/debug/product-matching code out of the misleading `src/lib/rag` namespace, then remove the legacy retrieval/RAG orchestration code that is no longer live in production.

**Architecture:** Treat `src/lib/rag` as a temporary compatibility namespace to be emptied. First move live production survivors into explicit homes: `src/lib/chat-runtime/` for chat state, memory, traces, prompts, titles, and stream payload helpers; `src/lib/product-matching/` for reusable product matching. Then delete the old retrieval/orchestration modules and their obsolete tests, and update docs/Clawpatch slices so future reviews distinguish live memory/state from retired retrieval.

**Tech Stack:** Next.js App Router, TypeScript path aliases, Node test runner, Playwright component/contract tests, Knip, Madge, Clawpatch.

---

## Current Evidence

- Production `/api/chat` imports `@/lib/agent-v2/production/chat-pipeline`, not `@/lib/agent/legacy-production/chat-pipeline`.
- `src/lib/agent/legacy-production/chat-pipeline.ts` says it is not reachable from `/api/chat`.
- `src/lib/rag/orchestrator/conversation-orchestrator.ts` says it is a deprecated legacy RAG turn orchestrator.
- `knip --reporter compact` currently flags the legacy production pipeline and old RAG orchestration/retrieval modules as unused.
- `madge --orphans src` lists many Next route entrypoints as expected, and also flags old RAG modules and the legacy pipeline as orphaned.
- There is no standalone `rack` token in the repo; the confusing term is `RAG`.

## Target Boundaries

### Live Runtime Code After Cleanup

- `src/lib/chat-runtime/user-memory.ts`
  - Former `src/lib/rag/user-memory.ts`.
  - Owns persisted user memory CRUD, memory settings, memory constraints, and cache rebuilds.

- `src/lib/chat-runtime/memory-extractor.ts`
  - Former `src/lib/rag/memory-extractor.ts`.
  - Owns post-response memory extraction.

- `src/lib/chat-runtime/conversation-state.ts`
  - Former `src/lib/rag/conversation-state.ts`.
  - Owns conversation/session state transitions used by AgentV2 and legacy compare helpers.

- `src/lib/chat-runtime/conversation-state-store.ts`
  - Former `src/lib/rag/conversation-state-store.ts`.
  - Owns Supabase persistence for conversation state.

- `src/lib/chat-runtime/debug-trace.ts`
  - Former `src/lib/rag/debug-trace.ts`.
  - Owns app-facing trace projection and Langfuse summaries for chat turns.

- `src/lib/chat-runtime/stream-events.ts`
  - Former `src/lib/rag/chat-response.ts`.
  - Owns SSE payload helpers. Keep `buildAssistantDecisionContext` and `buildDoneEventData`; delete the stale `buildAssistantRagContext` alias.

- `src/lib/chat-runtime/title-generator.ts`
  - Former `src/lib/rag/title-generator.ts`.
  - Owns conversation title generation.

- `src/lib/chat-runtime/prompts.ts`
  - Former `src/lib/rag/prompts.ts`.
  - Owns live prompt constants still referenced by memory extraction and Langfuse prompt sync. Delete legacy prompt constants after their only tests are removed.

- `src/lib/product-matching/matcher.ts`
  - Former `src/lib/rag/product-matcher.ts`.
  - Owns reusable product matchers used by the recommendation engine and agent tools.

- `src/lib/product-matching/product-list-chunks.ts`
  - Former `src/lib/rag/product-list-chunks.ts`.
  - Owns product chunk construction used by `scripts/ingest-product-chunks.ts` and `tests/product-list-chunks.test.ts`.

### Delete After Import Migration

Decision: hard-delete retired code from `src/` and rely on Git history as the archive. Do not move dead production-path code into a repository archive folder, because archived code under the repo can still confuse static analysis, Clawpatch, and future readers.

- `src/lib/agent/legacy-production/chat-pipeline.ts`
- `src/lib/rag/orchestrator/conversation-orchestrator.ts`
- `src/lib/rag/response/response-composer.ts`
- `src/lib/rag/retrieval/retrieval-service.ts`
- `src/lib/rag/selection/product-selection-service.ts`
- `src/lib/rag/selection/types.ts`
- `src/lib/rag/clarification.ts`
- `src/lib/rag/intent-classifier.ts`
- `src/lib/rag/reranker.ts`
- `src/lib/rag/retrieval-telemetry.ts`
- `src/lib/rag/retriever.ts`
- `src/lib/rag/router.ts`
- `src/lib/rag/source-names.ts`
- `src/lib/rag/subquery-decomposer.ts`
- `src/lib/rag/synthesizer.ts`
- Old RAG-only category decision files if still only referenced by obsolete tests:
  - `src/lib/rag/shampoo-decision.ts`
  - `src/lib/rag/conditioner-decision.ts`
  - `src/lib/rag/leave-in-decision.ts`
  - `src/lib/rag/leave-in-mapper.ts`
  - `src/lib/rag/leave-in-reranker.ts`
  - `src/lib/rag/mask-mapper.ts`
  - `src/lib/rag/mask-reranker.ts`
  - `src/lib/rag/scalp-mapper.ts`

### Tests Expected To Be Removed Or Rewritten

- Remove old RAG product-flow contract tests:
  - `tests/shampoo-flow.spec.ts`
  - `tests/conditioner-reranker.spec.ts`
  - `tests/leave-in-decision.spec.ts`
  - `tests/mask-flow.spec.ts`
- Rewrite any still-useful assertion from `tests/routine-signal-consumers.test.ts` to target the current recommendation engine or routine planner directly.
- Keep and update:
  - `tests/user-memory.spec.ts`
  - `tests/conversation-state.spec.ts`
  - `tests/chat-debug-trace.spec.ts`
  - `tests/agent-v2-production-chat-pipeline.spec.ts`
  - `tests/product-matcher.spec.ts`
  - `tests/product-list-chunks.test.ts`
  - `tests/recommendation-engine-selection.test.ts`
  - `tests/agent-select-products-tool.spec.ts`

---

## Task 0: Create The Implementation Worktree

**Files:**
- No source edits in the root checkout.
- Worktree path: `.worktrees/rag-memory-cleanup`
- Branch: `codex/rag-memory-cleanup`

- [ ] **Step 1: Confirm root status before starting**

Run:

```bash
git status --short --branch
```

Expected: root `main` may be dirty with unrelated local docs/temp files. Do not clean or revert them.

- [ ] **Step 2: Create a fresh task worktree**

Run from `/Users/nick/AI_work/hair_concierge`:

```bash
npm run worktree:new -- rag-memory-cleanup
```

Expected: `.worktrees/rag-memory-cleanup` exists on branch `codex/rag-memory-cleanup`, bootstrapped from `origin/main`.

- [ ] **Step 3: Enter the worktree and verify baseline**

Run:

```bash
cd .worktrees/rag-memory-cleanup
git status --short --branch
npm run typecheck
```

Expected: branch is `codex/rag-memory-cleanup`; typecheck passes before cleanup edits.

---

## Task 1: Move Live Chat Runtime Survivors Out Of `src/lib/rag`

**Files:**
- Move: `src/lib/rag/user-memory.ts` -> `src/lib/chat-runtime/user-memory.ts`
- Move: `src/lib/rag/memory-extractor.ts` -> `src/lib/chat-runtime/memory-extractor.ts`
- Move: `src/lib/rag/conversation-state.ts` -> `src/lib/chat-runtime/conversation-state.ts`
- Move: `src/lib/rag/conversation-state-store.ts` -> `src/lib/chat-runtime/conversation-state-store.ts`
- Move: `src/lib/rag/debug-trace.ts` -> `src/lib/chat-runtime/debug-trace.ts`
- Move: `src/lib/rag/chat-response.ts` -> `src/lib/chat-runtime/stream-events.ts`
- Move: `src/lib/rag/title-generator.ts` -> `src/lib/chat-runtime/title-generator.ts`
- Move: `src/lib/rag/prompts.ts` -> `src/lib/chat-runtime/prompts.ts`
- Modify imports in `src/app/api/chat/route.ts`
- Modify imports in `src/app/api/chat/[id]/route.ts`
- Modify imports in `src/app/api/memory/route.ts`
- Modify imports in `src/app/api/memory/[id]/route.ts`
- Modify imports in `src/app/profile/page.tsx`
- Modify imports in `src/lib/agent-v2/**`
- Modify imports in `src/lib/agent/**`
- Modify imports in `src/lib/langfuse/prompts.ts`
- Modify imports in tests that target memory/state/debug/title/stream helpers

- [ ] **Step 1: Move files without editing contents**

Run:

```bash
mkdir -p src/lib/chat-runtime
git mv src/lib/rag/user-memory.ts src/lib/chat-runtime/user-memory.ts
git mv src/lib/rag/memory-extractor.ts src/lib/chat-runtime/memory-extractor.ts
git mv src/lib/rag/conversation-state.ts src/lib/chat-runtime/conversation-state.ts
git mv src/lib/rag/conversation-state-store.ts src/lib/chat-runtime/conversation-state-store.ts
git mv src/lib/rag/debug-trace.ts src/lib/chat-runtime/debug-trace.ts
git mv src/lib/rag/chat-response.ts src/lib/chat-runtime/stream-events.ts
git mv src/lib/rag/title-generator.ts src/lib/chat-runtime/title-generator.ts
git mv src/lib/rag/prompts.ts src/lib/chat-runtime/prompts.ts
```

Expected: files are staged as renames by Git.

- [ ] **Step 2: Rewrite imports from old live paths to new paths**

Run:

```bash
perl -pi -e 's#@/lib/rag/user-memory#@/lib/chat-runtime/user-memory#g; s#../src/lib/rag/user-memory#../src/lib/chat-runtime/user-memory#g; s#@/lib/rag/memory-extractor#@/lib/chat-runtime/memory-extractor#g; s#../src/lib/rag/memory-extractor#../src/lib/chat-runtime/memory-extractor#g; s#@/lib/rag/conversation-state-store#@/lib/chat-runtime/conversation-state-store#g; s#../src/lib/rag/conversation-state-store#../src/lib/chat-runtime/conversation-state-store#g; s#@/lib/rag/conversation-state#@/lib/chat-runtime/conversation-state#g; s#../src/lib/rag/conversation-state#../src/lib/chat-runtime/conversation-state#g; s#@/lib/rag/debug-trace#@/lib/chat-runtime/debug-trace#g; s#../src/lib/rag/debug-trace#../src/lib/chat-runtime/debug-trace#g; s#@/lib/rag/chat-response#@/lib/chat-runtime/stream-events#g; s#../src/lib/rag/chat-response#../src/lib/chat-runtime/stream-events#g; s#@/lib/rag/title-generator#@/lib/chat-runtime/title-generator#g; s#../src/lib/rag/title-generator#../src/lib/chat-runtime/title-generator#g; s#@/lib/rag/prompts#@/lib/chat-runtime/prompts#g; s#../src/lib/rag/prompts#../src/lib/chat-runtime/prompts#g' $(rg -l 'lib/rag/(user-memory|memory-extractor|conversation-state|conversation-state-store|debug-trace|chat-response|title-generator|prompts)' src tests scripts)
```

Expected: no source or test files still import those old live paths.

- [ ] **Step 3: Delete the stale stream helper alias**

Modify `src/lib/chat-runtime/stream-events.ts`:

```ts
import type {
  ChatCategoryDecision,
  IntentType,
  MessageRagContext,
  RecommendationEngineTrace,
  ResponseMode,
  RouterDecision,
  CitationSource,
} from "@/lib/types"

export function buildAssistantDecisionContext(
  sources: CitationSource[],
  categoryDecision?: ChatCategoryDecision,
  engineTrace?: RecommendationEngineTrace | null,
  responseMode?: ResponseMode,
): MessageRagContext | null {
  if (sources.length === 0 && !categoryDecision && !engineTrace && !responseMode) {
    return null
  }

  return {
    sources,
    category_decision: categoryDecision ?? null,
    engine_trace: engineTrace ?? null,
    response_mode: responseMode ?? null,
  }
}

export function buildDoneEventData(params: {
  intent: IntentType
  retrievalSummary: { final_context_count: number }
  routerDecision: RouterDecision
  categoryDecision?: ChatCategoryDecision
}): Record<string, unknown> {
  const { intent, retrievalSummary, routerDecision, categoryDecision } = params

  return {
    intent,
    ...retrievalSummary,
    router_confidence: routerDecision.confidence,
    retrieval_mode: routerDecision.retrieval_mode,
    response_mode: routerDecision.response_mode,
    needs_clarification: routerDecision.response_mode === "clarify_only",
    policy_overrides: routerDecision.policy_overrides,
    category_decision: categoryDecision ?? null,
  }
}
```

Then update production and kept tests to import/use `buildAssistantDecisionContext`.

Expected after the final update:

```bash
rg -n "buildAssistantRagContext" src tests
```

prints no matches, except in deleted old tests if this task has not reached Task 5 yet.

- [ ] **Step 4: Fix moved file internal imports**

Run:

```bash
rg -n "@/lib/rag/(user-memory|memory-extractor|conversation-state|conversation-state-store|debug-trace|chat-response|title-generator|prompts)|../src/lib/rag/(user-memory|memory-extractor|conversation-state|conversation-state-store|debug-trace|chat-response|title-generator|prompts)" src tests scripts
```

Expected: no matches.

- [ ] **Step 5: Verify the live runtime move**

Run:

```bash
npm run typecheck
npx tsx --test tests/user-memory.spec.ts tests/conversation-state.spec.ts tests/chat-debug-trace.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: typecheck passes and the targeted tests pass.

- [ ] **Step 6: Commit the live chat-runtime move**

Run:

```bash
git add src tests
git commit -m "refactor(chat): move live runtime helpers out of rag"
```

Expected: commit succeeds.

---

## Task 2: Move Product Matching Out Of `src/lib/rag`

**Files:**
- Move: `src/lib/rag/product-matcher.ts` -> `src/lib/product-matching/matcher.ts`
- Move: `src/lib/rag/product-list-chunks.ts` -> `src/lib/product-matching/product-list-chunks.ts`
- Modify: `src/lib/recommendation-engine/selection.ts`
- Modify: `src/lib/agent/tools/select-products.ts`
- Modify: `scripts/ingest-product-chunks.ts`
- Modify tests importing `product-matcher` or `product-list-chunks`

- [ ] **Step 1: Move the product matching files**

Run:

```bash
mkdir -p src/lib/product-matching
git mv src/lib/rag/product-matcher.ts src/lib/product-matching/matcher.ts
git mv src/lib/rag/product-list-chunks.ts src/lib/product-matching/product-list-chunks.ts
```

Expected: files are staged as renames.

- [ ] **Step 2: Rewrite imports**

Run:

```bash
perl -pi -e 's#@/lib/rag/product-matcher#@/lib/product-matching/matcher#g; s#../src/lib/rag/product-matcher#../src/lib/product-matching/matcher#g; s#@/lib/rag/product-list-chunks#@/lib/product-matching/product-list-chunks#g; s#../src/lib/rag/product-list-chunks#../src/lib/product-matching/product-list-chunks#g' $(rg -l 'lib/rag/(product-matcher|product-list-chunks)' src tests scripts)
```

Expected:

```bash
rg -n "lib/rag/(product-matcher|product-list-chunks)" src tests scripts
```

prints no matches.

- [ ] **Step 3: Verify product matching still works**

Run:

```bash
npm run typecheck
npx tsx --test tests/product-matcher.spec.ts tests/product-list-chunks.test.ts tests/recommendation-engine-selection.test.ts tests/agent-select-products-tool.spec.ts
```

Expected: typecheck passes and targeted tests pass.

- [ ] **Step 4: Commit the product matching move**

Run:

```bash
git add src tests scripts
git commit -m "refactor(recommendations): move product matching out of rag"
```

Expected: commit succeeds.

---

## Task 3: Delete Legacy Production Agent Pipeline

**Files:**
- Delete: `src/lib/agent/legacy-production/chat-pipeline.ts`
- Modify: docs that mention rollback through `runProductionAgentPipeline`
- Keep: current AgentV2 production route and tests

- [ ] **Step 1: Confirm no production imports remain**

Run:

```bash
rg -n "@/lib/agent/legacy-production|runProductionAgentPipeline" src tests scripts
```

Expected: only `src/lib/agent/legacy-production/chat-pipeline.ts` and historical docs/plans match. No live source import should match.

- [ ] **Step 2: Delete the legacy pipeline**

Run:

```bash
git rm src/lib/agent/legacy-production/chat-pipeline.ts
rmdir src/lib/agent/legacy-production 2>/dev/null || true
```

Expected: file is removed.

- [ ] **Step 3: Verify route guard test still asserts AgentV2 production**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: passes, including the assertions that `/api/chat` imports AgentV2 and does not import legacy production.

- [ ] **Step 4: Commit the legacy pipeline deletion**

Run:

```bash
git add src tests
git commit -m "refactor(agent): remove archived legacy chat pipeline"
```

Expected: commit succeeds.

---

## Task 4: Delete Old RAG Retrieval And Orchestration Modules

**Files:**
- Delete: old `src/lib/rag/**` files listed in Target Boundaries after Tasks 1-2 have moved live survivors.
- Modify: `scripts/ci/path-rules.mjs`
- Modify: `scripts/ci/clawpatch-summary.mjs`
- Modify: `docs/codex-review-map.md`
- Modify: `docs/clawpatch-code-review.md`

- [ ] **Step 1: Inspect what remains in `src/lib/rag`**

Run:

```bash
find src/lib/rag -type f | sort
```

Expected: only old RAG retrieval/orchestration/category-decision files remain. If a live file remains, move it before continuing.

- [ ] **Step 2: Remove old retrieval/orchestration files**

Run:

```bash
git rm -r src/lib/rag/orchestrator src/lib/rag/response src/lib/rag/retrieval src/lib/rag/selection
git rm src/lib/rag/clarification.ts src/lib/rag/intent-classifier.ts src/lib/rag/reranker.ts src/lib/rag/retrieval-telemetry.ts src/lib/rag/retriever.ts src/lib/rag/router.ts src/lib/rag/source-names.ts src/lib/rag/subquery-decomposer.ts src/lib/rag/synthesizer.ts
```

Expected: deleted files are staged.

- [ ] **Step 3: Remove old category-decision helpers if they are no longer imported by live source**

Run:

```bash
rg -n "@/lib/rag/(shampoo-decision|conditioner-decision|leave-in-decision|leave-in-mapper|leave-in-reranker|mask-mapper|mask-reranker|scalp-mapper)|../src/lib/rag/(shampoo-decision|conditioner-decision|leave-in-decision|leave-in-mapper|leave-in-reranker|mask-mapper|mask-reranker|scalp-mapper)" src tests scripts
```

Expected before deleting tests: matches are limited to old tests and internal references among old category helpers.

Then run:

```bash
git rm src/lib/rag/shampoo-decision.ts src/lib/rag/conditioner-decision.ts src/lib/rag/leave-in-decision.ts src/lib/rag/leave-in-mapper.ts src/lib/rag/leave-in-reranker.ts src/lib/rag/mask-mapper.ts src/lib/rag/mask-reranker.ts src/lib/rag/scalp-mapper.ts
rmdir src/lib/rag 2>/dev/null || true
```

Expected: `src/lib/rag` is gone or empty.

- [ ] **Step 4: Update CI path rules**

Modify `scripts/ci/path-rules.mjs` so chat/retrieval-like changes no longer point at `src/lib/rag/`:

```js
const CHAT_PREFIXES = [
  "src/lib/agent/",
  "src/lib/agent-v2/",
  "src/lib/chat-runtime/",
  "src/lib/langfuse/",
  "src/lib/openai/",
  "src/lib/product-matching/",
  "src/lib/recommendation-engine/",
  "src/lib/routines/",
  "src/app/api/chat/",
  "data/agent-guidance/",
  "data/agent-v2/",
  "scripts/eval-chat/",
]

const RETRIEVAL_PREFIXES = [
  "src/lib/product-matching/product-list-chunks.ts",
  "scripts/ingest-",
  "scripts/eval-retrieval.ts",
  "supabase/migrations/",
]
```

Keep the rest of the file unchanged.

- [ ] **Step 5: Update Clawpatch summary slices**

Modify `scripts/ci/clawpatch-summary.mjs`:

```js
{
  name: "Chat memory, state, and traces",
  patterns: [
    "src/lib/chat-runtime",
    "src/app/api/memory",
    "src/app/api/chat",
    "tests/user-memory.spec.ts",
    "tests/conversation-state.spec.ts",
    "tests/chat-debug-trace.spec.ts",
  ],
},
{
  name: "Product matching and catalog chunks",
  patterns: [
    "src/lib/product-matching",
    "scripts/ingest-product-chunks.ts",
    "scripts/eval-retrieval.ts",
    "tests/product-matcher.spec.ts",
    "tests/product-list-chunks.test.ts",
  ],
},
```

Remove the old slice named `RAG and memory`.

- [ ] **Step 6: Verify no `src/lib/rag` references remain in live code**

Run:

```bash
rg -n "src/lib/rag|@/lib/rag|../src/lib/rag|lib/rag" src tests scripts package.json .github
```

Expected: no matches in live code/scripts/tests. Historical docs/plans can still mention `src/lib/rag` only when describing removed history.

- [ ] **Step 7: Commit the legacy RAG deletion**

Run:

```bash
git add src scripts docs tests package.json
git commit -m "refactor(chat): remove legacy rag retrieval path"
```

Expected: commit succeeds.

---

## Task 5: Remove Or Rewrite Obsolete RAG Tests

**Files:**
- Delete: `tests/shampoo-flow.spec.ts`
- Delete: `tests/conditioner-reranker.spec.ts`
- Delete: `tests/leave-in-decision.spec.ts`
- Delete: `tests/mask-flow.spec.ts`
- Modify: `tests/routine-signal-consumers.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Delete old product-RAG contract tests**

Run:

```bash
git rm tests/shampoo-flow.spec.ts tests/conditioner-reranker.spec.ts tests/leave-in-decision.spec.ts tests/mask-flow.spec.ts
```

Expected: old tests are removed.

- [ ] **Step 2: Rewrite routine signal test away from old leave-in helper**

Modify `tests/routine-signal-consumers.test.ts` to remove:

```ts
import { deriveLeaveInNeedBucket } from "../src/lib/rag/leave-in-decision"
```

Delete the test named:

```ts
test("breakage feeds the strict leave-in flow as a repair signal", () => {
  const profile = createProfile({
    concerns: ["breakage"],
  })

  assert.equal(deriveLeaveInNeedBucket(profile), "repair")
})
```

Keep the routine planner test. If a replacement is desired in the same file, add this production-owned assertion:

```ts
test("breakage remains visible in the current routine plan", () => {
  const plan = buildRoutinePlan(
    createProfile({
      concerns: ["breakage"],
    }),
    "Meine Spitzen brechen gerade schnell ab.",
  )

  assert.equal(
    plan.sections.some((section) =>
      section.slots.some((slot) => /bruch|repair|reparatur/i.test(`${slot.reason} ${slot.label}`)),
    ),
    true,
  )
})
```

If the assertion is too brittle against German wording, prefer deleting the old test rather than reintroducing a legacy helper just for coverage.

- [ ] **Step 3: Remove deleted tests from `package.json`**

Modify the `test:playwright:contracts` script so it no longer includes:

```text
tests/conditioner-reranker.spec.ts
tests/leave-in-decision.spec.ts
tests/mask-flow.spec.ts
tests/shampoo-flow.spec.ts
```

Keep:

```text
tests/chat-debug-trace.spec.ts
tests/conversation-state.spec.ts
tests/routine-planner.spec.ts
tests/stripe-gating.spec.ts
tests/stripe-intervals.spec.ts
tests/stripe-webhook-handlers.spec.ts
tests/user-memory.spec.ts
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm run typecheck
npx tsx --test tests/routine-signal-consumers.test.ts tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts tests/recommendation-engine-routine.test.ts
npm run test:agent
```

Expected: typecheck and targeted tests pass.

- [ ] **Step 5: Commit test cleanup**

Run:

```bash
git add tests package.json package-lock.json
git commit -m "test(chat): remove obsolete rag flow coverage"
```

Expected: commit succeeds.

---

## Task 6: Update Docs And Review Maps To Current Production Reality

**Files:**
- Modify: `OVERVIEW.md`
- Modify: `docs/codex-review-map.md`
- Modify: `docs/clawpatch-code-review.md`
- Modify: `docs/langfuse-quality-loop.md`
- Modify: `docs/excel-ingestion.md`
- Modify: any docs still claiming old RAG is the production recommendation path

- [ ] **Step 1: Update `OVERVIEW.md` library map**

Replace the old lib section:

```text
│   ├── agent/              # Production agent routing + tools
│   ├── rag/                # Legacy chat helpers + compatibility traces
```

with:

```text
│   ├── agent/              # Shared agent tools and compare helpers
│   ├── agent-v2/           # Production AgentV2 chat pipeline
│   ├── chat-runtime/       # Memory, state, trace, and chat stream helpers
│   ├── product-matching/   # Product matcher and product chunk builders
```

- [ ] **Step 2: Update `docs/langfuse-quality-loop.md`**

Replace the stale production description:

```text
The production chat route runs `runProductionAgentPipeline`, which uses the
`tool_loop` engine.
```

with:

```text
The production chat route runs `runAgentV2ProductionPipeline`, which uses the
AgentV2 Responses runtime plus CareBalance-backed product tools.
```

Replace old generation names with the current names used by AgentV2, including `agent-v2-responses-step`.

- [ ] **Step 3: Update `docs/excel-ingestion.md`**

Replace:

```text
- `src/lib/rag/retriever.ts` — passes `metadataFilter` to RPC
- `src/lib/rag/pipeline.ts` — applies hair_texture filter for product intents
```

with:

```text
- `src/lib/product-matching/product-list-chunks.ts` — builds product-list chunks for ingestion
- `scripts/eval-retrieval.ts` — evaluates retrieval metrics against Supabase RPCs
```

- [ ] **Step 4: Update `docs/codex-review-map.md`**

Rename the old review slice from `RAG and memory` to `Chat memory, state, and traces`.

Use this row:

```md
| Chat memory, state, and traces | `src/lib/chat-runtime/`, `src/app/api/memory/`, `src/app/api/chat/` | Memory isolation, conversation-state migration, trace redaction, title/memory extraction side effects | `tests/user-memory.spec.ts`, `tests/conversation-state.spec.ts`, `tests/chat-debug-trace.spec.ts`, `tests/agent-v2-production-chat-pipeline.spec.ts` |
```

Add this row:

```md
| Product matching and catalog chunks | `src/lib/product-matching/`, `scripts/ingest-product-chunks.ts`, `scripts/eval-retrieval.ts` | Product matching determinism, chunk metadata, retrieval eval regressions | `tests/product-matcher.spec.ts`, `tests/product-list-chunks.test.ts`, `npm run test:retrieval:ci` |
```

- [ ] **Step 5: Update Clawpatch docs**

In `docs/clawpatch-code-review.md`, replace references to `RAG and memory` with `Chat memory, state, and traces` unless the text is explicitly historical.

- [ ] **Step 6: Scan docs for stale production claims**

Run:

```bash
rg -n "runProductionAgentPipeline|tool_loop engine|src/lib/rag/pipeline|RAG and memory|production recommendation.*RAG|RAG/product engine" OVERVIEW.md docs plans
```

Expected: matches are either removed or clearly historical in old plans. Current docs must not describe old RAG as live production behavior.

- [ ] **Step 7: Commit doc cleanup**

Run:

```bash
git add OVERVIEW.md docs scripts/ci/clawpatch-summary.mjs scripts/ci/path-rules.mjs
git commit -m "docs(chat): describe memory and matching without rag"
```

Expected: commit succeeds.

---

## Task 7: Dependency And Static Analysis Cleanup

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Possibly delete dependency imports if old code removal made them unused

- [ ] **Step 1: Re-run Knip**

Run:

```bash
npx -y knip@latest --reporter compact
```

Expected: `src/lib/rag/**` and `src/lib/agent/legacy-production/chat-pipeline.ts` no longer appear.

- [ ] **Step 2: Remove `cohere-ai` if only the deleted reranker used it**

Run:

```bash
rg -n "from [\"']cohere-ai|require\\([\"']cohere-ai|CohereClient" src scripts tests
```

Expected: no matches after `src/lib/rag/reranker.ts` is deleted.

Then run:

```bash
npm uninstall cohere-ai
```

Expected: `cohere-ai` is removed from `package.json` and `package-lock.json`.

- [ ] **Step 3: Remove `pdf-parse` only if no archived script still imports it**

Run:

```bash
rg -n "pdf-parse" src scripts tests docs package.json
```

Expected: if the only runtime import is `scripts/archive/ingest-book.ts`, keep `pdf-parse` until a separate archive-script cleanup removes that script. Do not uninstall it in this plan unless the archived script is also deleted.

- [ ] **Step 4: Keep `clawpatch`, `supabase`, and `k6` despite Knip noise**

Confirm they are script/CI tools:

```bash
rg -n "clawpatch|supabase|k6" package.json .github scripts docs/runbooks tests/package-scripts.test.ts
```

Expected: matches show `clawpatch` is CI/review tooling, `supabase` is CLI/dev tooling, and `k6` is a system binary referenced by stress scripts.

- [ ] **Step 5: Commit dependency cleanup**

Run:

```bash
git add package.json package-lock.json
git commit -m "chore(deps): drop retired rag reranker dependency"
```

Expected: commit succeeds if `cohere-ai` was removed. Skip this commit if no dependency changed.

---

## Task 8: Final Verification

**Files:**
- No new files.
- Verify all changed code and docs.

- [ ] **Step 1: Verify no live `src/lib/rag` remains**

Run:

```bash
test ! -e src/lib/rag
rg -n "src/lib/rag|@/lib/rag|../src/lib/rag|lib/rag" src tests scripts package.json .github
```

Expected: `test ! -e src/lib/rag` exits 0; `rg` prints no live code/test/script matches.

- [ ] **Step 2: Run core checks**

Run:

```bash
npm run typecheck
npm run lint
npm run test:node
npm run test:agent
```

Expected: all pass.

- [ ] **Step 3: Run contract tests still listed in package scripts**

Run:

```bash
npm run test:playwright:contracts
```

Expected: passes with the updated test list.

- [ ] **Step 4: Rebuild Clawpatch map and summary**

Run:

```bash
npm run clawpatch:init
npm run clawpatch:doctor
npm run clawpatch:map
npm run clawpatch:summary -- --output clawpatch-summary.md --base origin/main
```

Expected: `clawpatch-summary.md` no longer contains a `RAG and memory` slice and instead lists `Chat memory, state, and traces` plus `Product matching and catalog chunks`.

- [ ] **Step 5: Run final static audits**

Run:

```bash
npx -y knip@latest --reporter compact
npx -y madge@latest --ts-config tsconfig.json --extensions ts,tsx --orphans src
```

Expected: no deleted legacy RAG modules or legacy production pipeline are reported. Remaining Next route entrypoints and intentionally manual scripts may still appear.

- [ ] **Step 6: Final status**

Run:

```bash
git status --short --branch
git log --oneline --max-count=8
```

Expected: branch contains the cleanup commits and no unexpected untracked files. Generated `.clawpatch/` and `clawpatch-summary.md` remain ignored local artifacts.

---

## Non-Goals

- Do not redesign AgentV2 behavior.
- Do not change recommendation rules.
- Do not delete user memory, profile, or conversation-state database tables.
- Do not remove `/api/memory`; it is live profile functionality.
- Do not clean the entire scripts/docs archive surface in this branch. Only touch stale docs/scripts directly tied to old RAG naming and production-path confusion.
- Do not commit generated `.clawpatch/` state or `clawpatch-summary.md`.
- Do not move retired source code into `docs/archive/` or `scripts/archive/`; delete it from live source paths after reachability checks pass.

## Open Risks

- Some old RAG tests may still encode useful deterministic recommendation expectations. Before deleting a test, check whether the current recommendation-engine suite already covers the same behavior. If not, port the expectation to `tests/recommendation-engine-*.test.ts` instead of keeping the legacy helper alive.
- Historical docs/plans will still mention RAG. That is acceptable when they are clearly historical; it is not acceptable in current review maps, runbooks, or overview docs.
- `scripts/eval-retrieval.ts` may remain useful as a retrieval metric gate for content chunks even after old production RAG deletion. Keep it unless product direction explicitly retires retrieval evaluation.

## Self-Review Checklist

- [ ] The plan chooses Approach B and does not include the full repo hygiene sweep from Approach C.
- [ ] The plan preserves live memory/profile behavior.
- [ ] The plan removes the misleading `src/lib/rag` namespace from live code.
- [ ] The plan updates Clawpatch/review-map slices so future audits do not reintroduce the confusion.
- [ ] The plan has a separate verification phase with typecheck, lint, tests, Clawpatch, Knip, and Madge.
