# Agent v1 Production Readiness Findings

Date: 2026-04-30
Branch: `codex/agent-v1-production-port`

## Merge Gate

Agent v1 should not merge to `main` until the items in **Must Fix** are closed or explicitly downgraded with a written reason.

## Must Fix

1. Route packet drops classifier-only active profile signals.
   - `mergeActiveProfileSignals` keeps classifier signals only when the deterministic regex extractor found the same `field:value`.
   - Impact: current-turn overrides such as `thickness:fine` can be lost, so selection may use stale stored profile values.

2. Route packet fallback inference misses clear conditioner and oil asks.
   - If the classifier returns `product_category: null`, clear asks like "Welche Spuelung passt zu mir?" or "Welches Haaroel passt zu mir?" can skip `select_products`.

3. Oil no-recommendation states are projected as `no_catalog_match`.
   - Oil category decisions can intentionally suppress products for scalp-treatment, growth/loss, better non-oil category, or overload cases.
   - Projection currently turns the empty product result into a catalog failure, losing redirect/suppression semantics.

4. Blocking missing-info policy only runs when no products are returned.
   - Conditioner, leave-in, mask, and oil can return generic candidates while required profile fields are absent, bypassing `needs_more_info`.

5. `supported_claims` uses profile values as product-spec evidence.
   - Conditioner, leave-in, and oil expose `matched_profile.thickness` as a `product_spec` claim.
   - Product claims must come from structured product data or explicit category decision facts, not copied user profile values.

6. Active override/deviation coverage is incomplete.
   - Conditioner/mask/oil override only thickness.
   - Leave-in misses density and hair texture.
   - Shampoo/oil profile-basis output lacks consistent deviation notices.

7. Production chat needs route-level contract coverage.
   - Existing tests cover helper mappings, not `POST /api/chat`, dynamic production pipeline routing, SSE event order, persistence payloads, product cards, `rag_context`, or turn traces.

8. Runtime guidance packaging needs a build-artifact check.
   - Current test checks `next.config.ts`, but `loadGuidance` depends on traced markdown files being present in the production build artifact.

9. Legacy RAG namespace needs removal or neutral relocation.
   - Old product RAG turn flow is not reachable from `/api/chat`, but compare lab still compiles it.
   - Shared survivors should move out of `src/lib/rag`: product matcher, memory helpers, title/memory generation, chat contracts, debug trace, response context.

## Should Fix Before Main Merge

1. Decompose `src/lib/agent/tools/select-products.ts`.
   - It currently owns projection, product policies, missing info, supported claims, category dispatch, ingredient caveats, comparison facts, and active overrides.

2. Split `src/lib/recommendation-engine/selection.ts` by category or introduce category-owned selector modules.
   - Category decision files are separated, but selection remains one large cross-category blast radius.

3. Make final-render prompt policy thinner.
   - Deterministic category/product rules should be represented in runtime packets and tool projections. The prompt should render those decisions, not duplicate them.

4. Avoid broad production imports through the recommendation-engine barrel where it keeps legacy chat/RAG helpers reachable.

## Explicitly Out Of Scope

- Agent compare lab UX and internal evaluation workflows, except where they keep legacy RAG compiled or production-reachable.
- Database schema migrations for renaming stored `rag_context`; compatibility names can remain for this branch.
