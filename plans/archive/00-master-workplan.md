# TomBot Recommendation Engine Upgrade — Master Workplan

## Context

TomBot's current RAG pipeline (intent classification -> vector retrieval -> product matching -> GPT-4o synthesis) has three pain points at the 10K+ user target scale:

1. **Inconsistency** — Same question can produce different recommendations across sessions because the LLM decides both *what* to recommend and *how* to present it
2. **Hard rules ignored** — The LLM sometimes recommends products incompatible with a user's hair texture or violates known constraints (e.g., sulfates for color-treated hair)
3. **Not personalized enough** — Recommendations feel generic; the full user profile isn't leveraged effectively

**Core architectural shift:** Move product/routine *selection* into deterministic logic. The LLM becomes a *presentation layer* (Tom's voice, explanations, contextual advice) — not a *decision layer* for what to recommend.

---

## Workstream Overview

| # | Workstream | Spec File | Pain Points Fixed | Dependencies | Complexity |
|---|-----------|-----------|-------------------|--------------|------------|
| 1 | Rule Engine Pre-Filter | `ws1-rule-engine.md` | Hard rules ignored | None | Medium |
| 2 | Deterministic Scoring & Ranking | `ws2-deterministic-scoring.md` | Inconsistency | WS1 (optional) | Medium |
| 3 | Structured Outputs + Post-Validation | `ws3-structured-outputs.md` | Hard rules, Inconsistency | None | Medium |
| 4 | Enhanced Profile Injection | `ws4-enhanced-profiles.md` | Not personalized enough | None | Low-Medium |
| 5 | Semantic Caching Layer | `ws5-semantic-caching.md` | Inconsistency, Cost | WS2 | Medium-High |
| 6 | Knowledge Graph (Relational) | `ws6-knowledge-graph.md` | Personalization, Multi-hop | WS1 | High |

## Implementation Phases

```
Phase 1 (Pipeline Refactor) — Ship together
├── WS1: Rule Engine Pre-Filter
├── WS2: Deterministic Scoring
└── WS3: Structured Outputs + Post-Validation

Phase 2 (Personalization) — Independent
└── WS4: Enhanced Profile Injection

Phase 3 (Scale) — Independent, after Phase 1
└── WS5: Semantic Caching

Phase 4 (Future) — Independent, after Phase 1
└── WS6: Knowledge Graph
```

## Current Pipeline Architecture (Before)

```
User Message
  |
  v
POST /api/chat (src/app/api/chat/route.ts)
  |
  v
runPipeline() (src/lib/rag/pipeline.ts)
  ├── Step 1: classifyIntent() + load hair_profiles (parallel)
  ├── Step 2: retrieveContext() — vector search + metadata filter + rerank
  ├── Step 3: Load last 10 messages
  ├── Step 4: Create conversation if needed
  ├── Step 5: matchProducts() — vector search + profile scoring
  └── Step 6: synthesizeResponse() — GPT-4o streaming
  |
  v
SSE Stream → useChat hook → ChatMessage component
```

## Target Pipeline Architecture (After Phase 1)

```
User Message
  |
  v
POST /api/chat
  |
  v
runPipeline()
  ├── Step 1: classifyIntent() + load hair_profiles (parallel)
  ├── Step 2: retrieveContext() — vector search + metadata filter
  ├── Step 2.5: filterByRules() — deterministic constraint enforcement  [WS1]
  ├── Step 3: scoreAndRank() — deterministic scoring, same input = same output  [WS2]
  ├── Step 4: Load last 10 messages + Create conversation
  ├── Step 5: matchProducts() + filterByRules()  [WS1]
  ├── Step 5.5: scoreAndRank() products  [WS2]
  ├── Step 6: synthesizeResponse()  [WS3]
  │     ├── Product intents: Structured Output (strict:true) + progress events
  │     └── Other intents: SSE streaming (unchanged)
  └── Step 7: validateResponse() — post-LLM safety net  [WS3]
  |
  v
SSE Stream (with new "status" events for structured path)
```

## Key Files Reference

| File | Role | Modified In |
|------|------|-------------|
| `src/lib/rag/pipeline.ts` | Main orchestrator | WS1, WS2, WS3, WS5 |
| `src/lib/rag/retriever.ts` | Content retrieval + reranking | WS1, WS2 |
| `src/lib/rag/product-matcher.ts` | Product matching | WS1, WS2 |
| `src/lib/rag/synthesizer.ts` | LLM response generation | WS2, WS3, WS4 |
| `src/lib/rag/prompts.ts` | System prompt templates | WS2, WS3, WS4 |
| `src/lib/rag/memory-extractor.ts` | Cross-session memory | WS4 |
| `src/app/api/chat/route.ts` | SSE endpoint | WS3, WS4, WS5 |
| `src/hooks/use-chat.ts` | Client-side SSE handler | WS3 |
| `src/components/chat/chat-message.tsx` | Message rendering | WS3 |
| `src/lib/types.ts` | TypeScript types | WS1-WS5 |
| `src/lib/validators/index.ts` | Zod schemas | WS3 |

## New Files Created (All Workstreams)

| File | Workstream |
|------|-----------|
| `src/lib/rag/rule-engine.ts` | WS1 |
| `src/lib/rag/scorer.ts` | WS2 |
| `src/lib/rag/response-schema.ts` | WS3 |
| `src/lib/rag/post-validator.ts` | WS3 |
| `src/lib/rag/cache.ts` | WS5 |
| `src/lib/rag/knowledge-graph.ts` | WS6 |
| `scripts/populate-knowledge-graph.ts` | WS6 |

## New Database Tables (All Workstreams)

| Table | Workstream | Purpose |
|-------|-----------|---------|
| `recommendation_rules` | WS1 | Admin-editable business rules (JSONB) |
| `recommendation_audit_log` | WS3 | Validation issue tracking |
| `recommendation_cache` | WS5 | Semantic response cache |
| `graph_nodes` | WS6 | Knowledge graph entities |
| `graph_edges` | WS6 | Knowledge graph relationships |

## New Dependencies

| Package | Workstream | Purpose |
|---------|-----------|---------|
| `json-rules-engine` | WS1 | JSON-declarative rule engine |

## Verification Strategy (End-to-End)

After each workstream:
1. `npx tsc --noEmit` — zero TypeScript errors
2. `npm run build` — successful Next.js build
3. Run existing Playwright QA tests: `npm run test:qa`
4. Manual smoke test: Open chat, test product recommendation flow for each hair texture (fein/mittel/dick)
5. Verify SSE streaming still works correctly (no regressions in chat UX)

## Supabase Project
- Project ID: `pqdkhefxsxkyeqelqegq`
- Migrations live in: `supabase/migrations/`
- 7 existing migrations (latest: `20260214000000_add_community_qa_weight.sql`)
