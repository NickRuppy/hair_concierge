# Agent v1 Production Readiness Inventory

Snapshot date: 2026-04-30

Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/agent-v1-production-port`

Branch: `codex/agent-v1-production-port`

Base: `origin/main`

## Branch State

Committed Agent v1 stack:

- `54e04c7 feat(chat): port bounded agent to production chat`
- `db7c2a6 feat(agent): add conditioner category replication`
- `163f3d2 feat(agent): refine category recommendation routing`
- `6e93170 fix(agent): expand mask split-end guidance`
- `e30899e fix(agent): refine leave-in heat bonus handling`

Current local-only files intentionally excluded from review scope:

- `plans/2026-04-30-mask-compare-lab-feedback-fixes.md`
- `tmp/agent-compare-runs.jsonl`
- `tmp/leave-in-comparer-lab-findings-2026-04-29.md`
- `tmp/leave-in-feedback-analysis-2026-04-29.md`

New review/readiness docs created in this session:

- `plans/2026-04-30-agent-v1-production-readiness-review.md`
- `plans/2026-04-30-agent-v1-production-readiness-inventory.md`

## Diff Summary

`origin/main...HEAD` currently changes 118 files with about 18k insertions.

Primary production areas changed:

- `/api/chat` production front door
- bounded-agent orchestration under `src/lib/agent/**`
- guidance corpus under `data/agent-guidance/**`
- recommendation-engine categories for shampoo, conditioner, leave-in, oil, and mask
- product selection projection and request-context logic
- category regression tests and agent tests

Compare lab files also exist in the branch, but are out of architecture/code-review scope except for accidental production coupling/security exposure.

## Category Coverage

Major categories represented in committed production logic:

- shampoo
- conditioner
- leave-in
- oil
- mask

Core files:

- `src/lib/agent/tools/select-products.ts`
- `src/lib/agent/orchestrator/route-packet.ts`
- `src/lib/recommendation-engine/request-context.ts`
- `src/lib/recommendation-engine/selection.ts`
- `src/lib/recommendation-engine/categories/shampoo.ts`
- `src/lib/recommendation-engine/categories/conditioner.ts`
- `src/lib/recommendation-engine/categories/leave-in.ts`
- `src/lib/recommendation-engine/categories/oil.ts`
- `src/lib/recommendation-engine/categories/mask.ts`

## Production Entry Points

Primary production entry point:

- `src/app/api/chat/route.ts`

Agent production adapter:

- `src/lib/agent/production/chat-pipeline.ts`

Compatibility dependencies still imported by `/api/chat`:

- `src/lib/rag/chat-response.ts`
- `src/lib/rag/memory-extractor.ts`
- `src/lib/rag/debug-trace.ts`
- `src/lib/rag/title-generator.ts`

Agent adapter still imports former-RAG shared modules:

- `src/lib/rag/debug-trace.ts`
- `src/lib/rag/contracts.ts`
- `src/lib/rag/user-memory.ts`

## Legacy RAG Reference Map

Production Agent v1 still imports from `src/lib/rag` for shared compatibility:

- `src/lib/agent/production/chat-pipeline.ts`
- `src/lib/agent/tools/get-user-context.ts`
- `src/lib/agent/tools/select-products.ts`
- `src/lib/recommendation-engine/selection.ts`
- `src/lib/routines/product-attachments.ts`
- `/api/chat`, `/api/chat/[id]`, and `/api/memory` routes

Old product-RAG orchestration files still present:

- `src/lib/rag/pipeline.ts`
- `src/lib/rag/orchestrator/conversation-orchestrator.ts`
- `src/lib/rag/synthesizer.ts`
- `src/lib/rag/retriever.ts`
- `src/lib/rag/response/response-composer.ts`
- `src/lib/rag/retrieval/retrieval-service.ts`
- `src/lib/rag/selection/product-selection-service.ts`
- `src/lib/rag/router.ts`
- `src/lib/rag/intent-classifier.ts`
- `src/lib/rag/category-engine/**`
- legacy category decisions/rerankers under `src/lib/rag/*-decision.ts` and `src/lib/rag/*-reranker.ts`

RAG removal is a strict pre-merge workstream, but deletion should follow an import classification so shared memory/title/debug infrastructure is not removed blindly.

## Verification Already Run

Latest known green checks:

- `npm run test:agent` passed, 114 tests
- `npx tsx --test tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts tests/agent-final-render-prompt.spec.ts` passed, 73 tests

Verification still required before merge readiness:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- built chat trace includes `data/agent-guidance/**`
- local chat smoke pass across shampoo, conditioner, leave-in, oil, and mask
- final code review after fixes
