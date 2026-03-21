# Archived Plans

These plan and spec files have been archived because they are either **fully implemented**, **superseded** by category-specific logic, or **blocked** on prerequisites that aren't met.

Git history is preserved — use `git log --follow` on any file to trace its full history.

## Archived Files

| File | Reason |
|------|--------|
| `ws1-rule-engine.md` | Superseded by category-specific decision logic (shampoo/conditioner/leave-in/mask) |
| `ws2-deterministic-scoring.md` | Superseded by per-category rerankers |
| `ws5-semantic-caching.md` | Premature at current scale |
| `ws6-knowledge-graph.md` | Blocked on product data enrichment; strict-matrix matching is more precise |
| `00-master-workplan.md` | Architecture described no longer reflects reality |
| `leave-in-recommendation-spec.md` | Fully implemented in `leave-in-decision.ts` + `leave-in-reranker.ts` |
| `rollout-prds/01-phase-1-hybrid-rerank-prd.md` | Fully implemented in `retriever.ts` |
| `rollout-prds/02-phase-2-router-clarification-prd.md` | Fully implemented in `router.ts` + `clarification.ts` |
| `rollout-prds/03-phase-3-kg-sidecar-prd.md` | Blocked on Phase 3a prerequisites |

Archived: 2026-03-20
