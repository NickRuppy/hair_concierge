# Phase 1: Boundary Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `runPipeline()` and `/api/chat` thin by extracting category wrappers, retrieval/selection/response services, and an orchestrator module — without changing recommendation behavior.

**Architecture:** Strangler-fig migration. Build new modules alongside `pipeline.ts`, then flip `pipeline.ts` into a thin facade that delegates to the new orchestrator. Category-specific logic is grouped into per-category wrapper modules. Product matching is extracted into a selection service.

**Tech Stack:** TypeScript, Next.js, Supabase (Postgres + pgvector)

---

## Working Directory

All paths relative to worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction`

## File Map

### Files To Create

| File | Responsibility |
|------|---------------|
| `src/lib/rag/contracts.ts` | Shared request/result types (TurnRequestContext, LoadedTurnContext, PipelineParams, PipelineResult) |
| `src/lib/rag/category-engine/types.ts` | Minimal wrapper type stubs |
| `src/lib/rag/category-engine/index.ts` | Category dispatch helpers |
| `src/lib/rag/category-engine/shampoo-wrapper.ts` | Shampoo decision + clarification + filter |
| `src/lib/rag/category-engine/conditioner-wrapper.ts` | Conditioner decision + clarification |
| `src/lib/rag/category-engine/leave-in-wrapper.ts` | Leave-in decision + clarification |
| `src/lib/rag/category-engine/oil-wrapper.ts` | Oil decision + clarification + filter |
| `src/lib/rag/category-engine/mask-wrapper.ts` | Mask decision + concern search order |
| `src/lib/rag/retrieval/retrieval-service.ts` | Single retrieval entry point |
| `src/lib/rag/response/response-composer.ts` | Response synthesis wrapper |
| `src/lib/rag/selection/types.ts` | Selection service types |
| `src/lib/rag/selection/product-selection-service.ts` | Category-specific product matching |
| `src/lib/rag/orchestrator/types.ts` | Orchestrator-internal types |
| `src/lib/rag/orchestrator/conversation-orchestrator.ts` | Turn orchestration (replaces pipeline internals) |

### Files To Modify

| File | Change |
|------|--------|
| `src/lib/rag/pipeline.ts` | Replace body with thin facade over orchestrator |

### Existing Files Preserved (Not Modified)

All existing decision files (`shampoo-decision.ts`, `conditioner-decision.ts`, `leave-in-decision.ts`, `oil-decision.ts`, `mask-reranker.ts`, `mask-mapper.ts`), `product-matcher.ts`, `retriever.ts`, `synthesizer.ts`, `router.ts`, `intent-classifier.ts`, `clarification.ts`, `debug-trace.ts`, `user-memory.ts`, `title-generator.ts`, and all test files remain untouched.

---

## Reference: Current Pipeline Structure

The current `src/lib/rag/pipeline.ts` (696 lines) orchestrates everything inline. Key sections by line range:

| Lines | Concern |
|-------|---------|
| 72–92 | `PipelineParams` + `PipelineResult` type definitions |
| 94–103 | `measureAsync` helper |
| 117–151 | Parallel load: history + hair profile + memory |
| 155–176 | Intent classification + routine planning |
| 177–188 | Category decision building (one-liner per category) |
| 190–194 | Pre-compute conditioner concern code |
| 196–237 | Route evaluation + telemetry emission |
| 239–262 | Conversation creation + title generation |
| 264–371 | **Clarification branch**: minimal retrieval + synthesis + return |
| 373–406 | Normal branch: metadata filter building + full retrieval |
| 407–416 | Source building from retrieved chunks |
| 418–623 | **Product matching mega-switch** (200 lines, all categories) |
| 625–628 | Memory constraint application |
| 629–695 | Synthesis + debug trace + return |

---

### Task 1: Shared Contracts and Type Files

**Files:**
- Create: `src/lib/rag/contracts.ts`
- Create: `src/lib/rag/orchestrator/types.ts`
- Create: `src/lib/rag/category-engine/types.ts`
- Create: `src/lib/rag/selection/types.ts`

- [ ] **Step 1: Create `src/lib/rag/contracts.ts`**

This file holds the types shared across orchestrator, wrappers, services. Move `PipelineParams` and `PipelineResult` here (currently defined in `pipeline.ts` lines 72–92) so both orchestrator and pipeline facade can import them. Add `TurnRequestContext` and `LoadedTurnContext`.

```typescript
import type {
  IntentType,
  Message,
  HairProfile,
  Product,
  EnrichedCitationSource,
  RouterDecision,
  CategoryDecision,
  ClassificationResult,
  ProductCategory,
  ShampooDecision,
  ConditionerDecision,
  LeaveInDecision,
  OilDecision,
  MaskDecision,
  RoutinePlan,
} from "@/lib/types"
import type { PipelineTraceDraft } from "@/lib/rag/debug-trace"
import type { UserMemoryContext } from "@/lib/rag/user-memory"

// ── Public pipeline interface (moved from pipeline.ts) ───────────────────────

export interface PipelineParams {
  message: string
  conversationId?: string
  userId: string
  requestId: string
}

export interface PipelineResult {
  stream: ReadableStream<Uint8Array>
  conversationId: string
  intent: IntentType
  matchedProducts: Product[]
  sources: EnrichedCitationSource[]
  routerDecision: RouterDecision
  categoryDecision?: CategoryDecision
  retrievalSummary: {
    final_context_count: number
  }
  debugTrace: PipelineTraceDraft
}

// ── Internal orchestrator contracts ──────────────────────────────────────────

/** Raw request context — created before any loading happens. */
export interface TurnRequestContext {
  userId: string
  requestId: string
  message: string
  conversationId?: string
  startedAt: string
}

/** Enriched context — available after parallel profile/history/memory load. */
export interface LoadedTurnContext {
  conversationHistory: Message[]
  hairProfile: HairProfile | null
  memoryContext: UserMemoryContext
}

/** Result of intent classification + routing. */
export interface RoutingResult {
  classification: ClassificationResult
  routerDecision: RouterDecision
  intent: IntentType
  productCategory: ProductCategory
  shouldPlanRoutine: boolean
}

/** Resolved category decisions — one field per category, all optional. */
export interface CategoryDecisions {
  shampoo?: ShampooDecision
  conditioner?: ConditionerDecision
  leaveIn?: LeaveInDecision
  oil?: OilDecision
  mask?: MaskDecision
}
```

- [ ] **Step 2: Create `src/lib/rag/orchestrator/types.ts`**

Orchestrator-internal types. Keep this minimal — just the latency breakdown type used during orchestration.

```typescript
export interface OrchestratorLatencies {
  historyLoadMs: number
  hairProfileLoadMs: number
  memoryLoadMs: number
  classificationMs: number
  routinePlanningMs: number
  routerMs: number
  conversationCreateMs: number
  retrievalMs: number
  productMatchingMs: number
}
```

- [ ] **Step 3: Create `src/lib/rag/category-engine/types.ts`**

Minimal types for the category engine layer. No shared interface — just the product category type re-export and a helper type for clarification results.

```typescript
import type {
  ShampooDecision,
  ConditionerDecision,
  LeaveInDecision,
  OilDecision,
  MaskDecision,
} from "@/lib/types"

/** Union of all category decision types. */
export type AnyCategoryDecision =
  | ShampooDecision
  | ConditionerDecision
  | LeaveInDecision
  | OilDecision
  | MaskDecision
```

- [ ] **Step 4: Create `src/lib/rag/selection/types.ts`**

Types for the product selection service.

```typescript
import type { Product } from "@/lib/types"
import type { MatchedProduct } from "@/lib/rag/product-matcher"
import type { CategoryDecisions } from "@/lib/rag/contracts"

export interface SelectionResult {
  products: MatchedProduct[]
  /** Updated decisions after matching (candidate counts, no_catalog_match). */
  updatedDecisions: Partial<CategoryDecisions>
}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction && npx tsc --noEmit`
Expected: PASS (new files have no consumers yet, only need valid syntax + imports)

- [ ] **Step 6: Commit**

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction
git add src/lib/rag/contracts.ts src/lib/rag/orchestrator/types.ts src/lib/rag/category-engine/types.ts src/lib/rag/selection/types.ts
git commit -m "refactor: add shared contracts and type files for Phase 1 boundary extraction"
```

---

### Task 2: Category Wrappers

**Files:**
- Create: `src/lib/rag/category-engine/shampoo-wrapper.ts`
- Create: `src/lib/rag/category-engine/conditioner-wrapper.ts`
- Create: `src/lib/rag/category-engine/leave-in-wrapper.ts`
- Create: `src/lib/rag/category-engine/oil-wrapper.ts`
- Create: `src/lib/rag/category-engine/mask-wrapper.ts`
- Create: `src/lib/rag/category-engine/index.ts`

Each wrapper groups the existing decision + clarification + filter functions for its category. These are re-export modules — no new logic.

- [ ] **Step 1: Create `src/lib/rag/category-engine/shampoo-wrapper.ts`**

```typescript
/**
 * Shampoo category wrapper.
 * Groups decision building, clarification, retrieval filter, and annotation.
 * All functions delegate to existing shampoo-decision.ts — no new logic.
 */
export {
  buildShampooDecision,
  buildShampooClarificationQuestions,
  buildShampooRetrievalFilter,
  annotateShampooRecommendations,
  isShampooProfileEligible,
  getShampooProfileCompleteness,
  getMissingShampooProfileFields,
} from "@/lib/rag/shampoo-decision"
```

- [ ] **Step 2: Create `src/lib/rag/category-engine/conditioner-wrapper.ts`**

```typescript
/**
 * Conditioner category wrapper.
 * Groups decision building, clarification, and reranking.
 */
export {
  buildConditionerDecision,
  buildConditionerClarificationQuestions,
  rerankConditionerProducts,
  deriveConditionerRepairLevel,
  deriveExpectedConditionerWeight,
} from "@/lib/rag/conditioner-decision"
```

- [ ] **Step 3: Create `src/lib/rag/category-engine/leave-in-wrapper.ts`**

```typescript
/**
 * Leave-in category wrapper.
 * Groups decision building, clarification, and reranking.
 */
export {
  buildLeaveInDecision,
  buildLeaveInClarificationQuestions,
  rerankLeaveInProducts,
  deriveLeaveInStylingContext,
  deriveLeaveInNeedBucket,
  deriveLeaveInConditionerRelationship,
  buildLeaveInReasonSummary,
} from "@/lib/rag/leave-in-decision"
```

- [ ] **Step 4: Create `src/lib/rag/category-engine/oil-wrapper.ts`**

```typescript
/**
 * Oil category wrapper.
 * Groups decision building, clarification, retrieval filter, and annotation.
 */
export {
  buildOilDecision,
  buildOilClarificationQuestions,
  buildOilRetrievalFilter,
  annotateOilRecommendations,
  getOilNoRecommendationMessage,
} from "@/lib/rag/oil-decision"
```

- [ ] **Step 5: Create `src/lib/rag/category-engine/mask-wrapper.ts`**

```typescript
/**
 * Mask category wrapper.
 * Groups mask decision, concern mapping, and reranking.
 */
export {
  deriveMaskDecision,
  rerankMaskProducts,
} from "@/lib/rag/mask-reranker"

export {
  buildMaskConcernSearchOrder,
  mapMaskTypeToConcernCode,
} from "@/lib/rag/mask-mapper"
```

- [ ] **Step 6: Create `src/lib/rag/category-engine/index.ts`**

Provides category dispatch helpers so the orchestrator doesn't import every wrapper directly for decision building and clarification.

```typescript
import type {
  HairProfile,
  ProductCategory,
  ShampooDecision,
  ConditionerDecision,
  LeaveInDecision,
  OilDecision,
} from "@/lib/types"
import type { CategoryDecisions } from "@/lib/rag/contracts"
import { buildShampooDecision, buildShampooClarificationQuestions, buildShampooRetrievalFilter } from "./shampoo-wrapper"
import { buildConditionerDecision, buildConditionerClarificationQuestions } from "./conditioner-wrapper"
import { buildLeaveInDecision, buildLeaveInClarificationQuestions } from "./leave-in-wrapper"
import { buildOilDecision, buildOilClarificationQuestions, buildOilRetrievalFilter } from "./oil-wrapper"
import { deriveMaskDecision } from "./mask-wrapper"
import { buildClarificationQuestions } from "@/lib/rag/clarification"
import type { RoutinePlan } from "@/lib/types"

/**
 * Build the initial category decisions from the hair profile.
 * Returns all applicable decisions; the orchestrator picks the one matching the routed category.
 */
export function buildInitialDecisions(
  productCategory: ProductCategory,
  hairProfile: HairProfile | null,
  message: string,
): CategoryDecisions {
  const decisions: CategoryDecisions = {}

  if (productCategory === "shampoo") {
    decisions.shampoo = buildShampooDecision(hairProfile)
  }
  if (productCategory === "conditioner") {
    decisions.conditioner = buildConditionerDecision(hairProfile)
  }
  if (productCategory === "leave_in") {
    decisions.leaveIn = buildLeaveInDecision(hairProfile)
  }
  if (productCategory === "oil") {
    decisions.oil = buildOilDecision(hairProfile, message)
  }

  return decisions
}

/**
 * Build clarification questions for the given category decision.
 * Falls back to generic slot-based clarification if no category-specific handler applies.
 */
export function buildCategoryClarificationQuestions(
  productCategory: ProductCategory,
  decisions: CategoryDecisions,
  shouldPlanRoutine: boolean,
  routineClarificationQuestions: string[] | undefined,
  classification: { normalized_filters: Record<string, string | string[] | null> },
  hairProfile: HairProfile | null,
): string[] {
  if (shouldPlanRoutine && routineClarificationQuestions) {
    return routineClarificationQuestions
  }

  if (productCategory === "shampoo" && decisions.shampoo && !decisions.shampoo.eligible) {
    return buildShampooClarificationQuestions(decisions.shampoo)
  }
  if (productCategory === "conditioner" && decisions.conditioner && !decisions.conditioner.eligible) {
    return buildConditionerClarificationQuestions(decisions.conditioner)
  }
  if (productCategory === "leave_in" && decisions.leaveIn && !decisions.leaveIn.eligible) {
    return buildLeaveInClarificationQuestions(decisions.leaveIn)
  }
  if (productCategory === "oil" && decisions.oil && !decisions.oil.eligible) {
    return buildOilClarificationQuestions(decisions.oil)
  }

  return buildClarificationQuestions(
    classification.normalized_filters,
    productCategory,
    hairProfile,
  )
}

/**
 * Build the metadata filter for retrieval based on category decisions.
 * Returns undefined if no category-specific filter applies.
 */
export function buildCategoryRetrievalFilter(
  intent: string,
  productCategory: ProductCategory,
  decisions: CategoryDecisions,
  hairProfile: HairProfile | null,
): Record<string, string> | undefined {
  const shampooFilter = buildShampooRetrievalFilter(
    intent as Parameters<typeof buildShampooRetrievalFilter>[0],
    productCategory,
    decisions.shampoo,
  )
  if (shampooFilter) return shampooFilter

  const oilFilter = buildOilRetrievalFilter(
    intent as Parameters<typeof buildOilRetrievalFilter>[0],
    productCategory,
    decisions.oil,
  )
  if (oilFilter) return oilFilter

  // Conditioner concern code filter
  const conditionerConcern = productCategory === "conditioner"
    ? decisions.conditioner?.matched_concern_code
    : null

  if (intent === "product_recommendation") {
    if (hairProfile?.thickness) {
      const filter: Record<string, string> = { thickness: hairProfile.thickness }
      if (conditionerConcern) {
        filter.concern = conditionerConcern
      }
      return filter
    }
  }

  return undefined
}

/**
 * Get the primary category decision for trace/synthesis purposes.
 */
export function getPrimaryCategoryDecision(
  decisions: CategoryDecisions,
) {
  return decisions.shampoo ?? decisions.conditioner ?? decisions.leaveIn ?? decisions.oil
}
```

- [ ] **Step 7: Verify typecheck passes**

Run: `cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction
git add src/lib/rag/category-engine/
git commit -m "refactor: add category wrappers grouping decision/clarification/filter per category"
```

---

### Task 3: Retrieval Service and Response Composer

**Files:**
- Create: `src/lib/rag/retrieval/retrieval-service.ts`
- Create: `src/lib/rag/response/response-composer.ts`

- [ ] **Step 1: Create `src/lib/rag/retrieval/retrieval-service.ts`**

Thin entry point around `retrieveContext()`. Adds source building (currently inline in `pipeline.ts` lines 296–304 and 407–416).

```typescript
import { retrieveContext } from "@/lib/rag/retriever"
import type { RetrieveOptions, RetrieveContextResult } from "@/lib/rag/retriever"
import { SOURCE_TYPE_LABELS } from "@/lib/vocabulary"
import { formatSourceName } from "@/lib/rag/source-names"
import type { EnrichedCitationSource } from "@/lib/types"
import type { RetrievedChunk } from "@/lib/rag/retriever"

export type { RetrieveOptions, RetrieveContextResult }

/**
 * Retrieve context chunks via hybrid search.
 * Delegates to the existing retriever — this wrapper exists so the orchestrator
 * has a single import for retrieval concerns.
 */
export async function retrieve(
  query: string,
  options: RetrieveOptions = {},
): Promise<RetrieveContextResult> {
  return retrieveContext(query, options)
}

/**
 * Build enriched citation sources from retrieved chunks.
 * Extracted from pipeline.ts where this was inline.
 */
export function buildSources(chunks: RetrievedChunk[]): EnrichedCitationSource[] {
  return chunks.map((chunk, i) => ({
    index: i + 1,
    source_type: chunk.source_type,
    label: SOURCE_TYPE_LABELS[chunk.source_type] ?? chunk.source_type,
    source_name: chunk.source_name ? formatSourceName(chunk.source_name) : null,
    snippet: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),
    confidence: chunk.weighted_similarity,
    retrieval_path: chunk.retrieval_path,
  }))
}
```

- [ ] **Step 2: Create `src/lib/rag/response/response-composer.ts`**

Thin entry point around `synthesizeResponse()`. Synthesizer internals are out of scope.

```typescript
import { synthesizeResponse } from "@/lib/rag/synthesizer"
import type { SynthesizeParams, SynthesisResult } from "@/lib/rag/synthesizer"

export type { SynthesizeParams, SynthesisResult }

/**
 * Compose the streaming response via the synthesizer.
 * Delegates to the existing synthesizer — this wrapper exists so the orchestrator
 * has a single import for response composition.
 */
export async function composeResponse(
  params: SynthesizeParams,
): Promise<SynthesisResult> {
  return synthesizeResponse(params)
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction
git add src/lib/rag/retrieval/ src/lib/rag/response/
git commit -m "refactor: add retrieval service and response composer wrappers"
```

---

### Task 4: Product Selection Service

**Files:**
- Create: `src/lib/rag/selection/product-selection-service.ts`

This extracts the 200-line product matching mega-switch from `pipeline.ts` (lines 418–622) into a dedicated service. Each category gets its own selection function. A dispatcher routes by category.

- [ ] **Step 1: Create `src/lib/rag/selection/product-selection-service.ts`**

Extract the per-category matching flows from `pipeline.ts`. Each function encapsulates the full matching + reranking/annotation flow for its category. The dispatcher function calls the right one.

**Important:** The code in each `select*` function below is extracted directly from `pipeline.ts` with these changes:
- Each function creates its own `supabase` client via `createAdminClient()`
- Each function takes explicit typed parameters instead of reading from pipeline closure
- Each function returns `SelectionResult` with updated decisions

```typescript
import { createAdminClient } from "@/lib/supabase/admin"
import {
  matchProducts,
  matchShampooProducts,
  matchConditionerProducts,
  matchLeaveInProducts,
  matchOilProducts,
} from "@/lib/rag/product-matcher"
import type { MatchedProduct } from "@/lib/rag/product-matcher"
import {
  buildShampooDecision,
  annotateShampooRecommendations,
} from "@/lib/rag/category-engine/shampoo-wrapper"
import {
  buildConditionerDecision,
  rerankConditionerProducts,
} from "@/lib/rag/category-engine/conditioner-wrapper"
import {
  buildLeaveInDecision,
  rerankLeaveInProducts,
} from "@/lib/rag/category-engine/leave-in-wrapper"
import {
  buildOilDecision,
  annotateOilRecommendations,
} from "@/lib/rag/category-engine/oil-wrapper"
import {
  deriveMaskDecision,
  rerankMaskProducts,
  buildMaskConcernSearchOrder,
} from "@/lib/rag/category-engine/mask-wrapper"
import { applyProductMemoryConstraints } from "@/lib/rag/user-memory"
import type { CategoryDecisions } from "@/lib/rag/contracts"
import type { SelectionResult } from "@/lib/rag/selection/types"
import type {
  HairProfile,
  ProductCategory,
  ShampooDecision,
  ConditionerDecision,
  LeaveInDecision,
  OilDecision,
  MaskDecision,
  RoutinePlan,
} from "@/lib/types"
import type { UserMemoryContext } from "@/lib/rag/user-memory"
import type { ProductConditionerSpecs } from "@/lib/conditioner/constants"
import type { ProductLeaveInSpecs } from "@/lib/leave-in/constants"
import type { ProductMaskSpecs } from "@/lib/mask/constants"

// ── Per-category selection functions ─────────────────────────────────────────
// Each is extracted from pipeline.ts with the same logic, no behavior changes.

async function selectShampoo(
  message: string,
  hairProfile: HairProfile | null,
  decision: ShampooDecision,
): Promise<SelectionResult> {
  if (!decision.eligible || !hairProfile?.thickness) {
    return { products: [], updatedDecisions: { shampoo: decision } }
  }
  if (!decision.matched_bucket) {
    return { products: [], updatedDecisions: { shampoo: decision } }
  }

  const shampooCandidates = await matchShampooProducts({
    query: message,
    thickness: hairProfile.thickness,
    shampooBucket: decision.matched_bucket,
    count: decision.secondary_bucket ? 2 : 3,
  })

  // Dandruff rotation: fetch 1 product from the secondary (scalp-type) bucket
  let secondaryCandidates: Awaited<ReturnType<typeof matchShampooProducts>> = []
  if (decision.secondary_bucket && decision.secondary_bucket !== decision.matched_bucket) {
    secondaryCandidates = await matchShampooProducts({
      query: message,
      thickness: hairProfile.thickness,
      shampooBucket: decision.secondary_bucket,
      count: 1,
    })
    for (const product of secondaryCandidates) {
      (product as unknown as Record<string, unknown>).shampoo_role = "daily"
    }
    for (const product of shampooCandidates) {
      (product as unknown as Record<string, unknown>).shampoo_role = "treatment"
    }
  }

  const allCandidates = [...shampooCandidates, ...secondaryCandidates]
  const updatedDecision = buildShampooDecision(hairProfile, allCandidates.length)
  const products = annotateShampooRecommendations(allCandidates, updatedDecision)

  return { products, updatedDecisions: { shampoo: updatedDecision } }
}

async function selectConditioner(
  message: string,
  hairProfile: HairProfile | null,
  decision: ConditionerDecision,
): Promise<SelectionResult> {
  if (!decision.eligible || !hairProfile?.thickness || !hairProfile?.protein_moisture_balance) {
    return { products: [], updatedDecisions: { conditioner: decision } }
  }

  const candidates = await matchConditionerProducts({
    query: message,
    thickness: hairProfile.thickness,
    proteinMoistureBalance: hairProfile.protein_moisture_balance,
    count: 10,
  })

  const updatedDecision = buildConditionerDecision(hairProfile, candidates.length)

  if (candidates.length === 0) {
    return { products: [], updatedDecisions: { conditioner: updatedDecision } }
  }

  const supabase = createAdminClient()
  const { data: specs, error: specsError } = await supabase
    .from("product_conditioner_rerank_specs")
    .select("*")
    .in("product_id", candidates.map((c) => c.id))

  if (specsError) {
    console.error("Failed to load conditioner specs for reranking:", specsError)
  }

  const products = rerankConditionerProducts(
    candidates,
    (specs ?? []) as ProductConditionerSpecs[],
    updatedDecision,
  ).slice(0, 3)

  return { products, updatedDecisions: { conditioner: updatedDecision } }
}

async function selectLeaveIn(
  message: string,
  hairProfile: HairProfile | null,
  decision: LeaveInDecision,
): Promise<SelectionResult> {
  if (
    !decision.eligible ||
    !hairProfile?.thickness ||
    !decision.need_bucket ||
    !decision.styling_context
  ) {
    return { products: [], updatedDecisions: { leaveIn: decision } }
  }

  const candidates = await matchLeaveInProducts({
    query: message,
    thickness: hairProfile.thickness,
    needBucket: decision.need_bucket,
    stylingContext: decision.styling_context,
    count: 10,
  })

  if (candidates.length === 0) {
    const updatedDecision = buildLeaveInDecision(hairProfile, 0)
    return { products: [], updatedDecisions: { leaveIn: updatedDecision } }
  }

  const supabase = createAdminClient()
  const { data: specs, error: specsError } = await supabase
    .from("product_leave_in_specs")
    .select("*")
    .in("product_id", candidates.map((c) => c.id))

  if (specsError) {
    console.error("Failed to load leave-in specs for reranking:", specsError)
    const updatedDecision = buildLeaveInDecision(hairProfile, 0)
    return { products: [], updatedDecisions: { leaveIn: updatedDecision } }
  }

  const reranked = rerankLeaveInProducts(
    candidates,
    (specs ?? []) as ProductLeaveInSpecs[],
    decision,
  )

  const updatedDecision = buildLeaveInDecision(hairProfile, reranked.length)
  return { products: reranked.slice(0, 3), updatedDecisions: { leaveIn: updatedDecision } }
}

async function selectOil(
  message: string,
  hairProfile: HairProfile | null,
  decision: OilDecision,
): Promise<SelectionResult> {
  if (
    !decision.eligible ||
    !hairProfile?.thickness ||
    !decision.matched_subtype ||
    decision.no_recommendation
  ) {
    return { products: [], updatedDecisions: { oil: decision } }
  }

  const candidates = await matchOilProducts({
    query: message,
    thickness: hairProfile.thickness,
    oilSubtype: decision.matched_subtype,
    count: 10,
  })

  const updatedDecision = buildOilDecision(hairProfile, message, candidates.length)
  const products = annotateOilRecommendations(candidates.slice(0, 3), updatedDecision)

  return { products, updatedDecisions: { oil: updatedDecision } }
}

async function selectMask(
  message: string,
  hairProfile: HairProfile | null,
  decision: MaskDecision,
): Promise<SelectionResult> {
  if (!decision.needs_mask || !decision.mask_type) {
    return { products: [], updatedDecisions: { mask: decision } }
  }

  const concernSearchOrder = buildMaskConcernSearchOrder(decision.mask_type)
  let products: MatchedProduct[] = []

  for (const concernCode of concernSearchOrder) {
    const candidates = await matchProducts({
      query: message,
      thickness: hairProfile?.thickness ?? undefined,
      concerns: [concernCode],
      category: "mask",
      count: 10,
    })

    if (candidates.length === 0) continue

    const prioritized = candidates.filter((c) =>
      c.suitable_concerns.includes(concernCode),
    )
    if (prioritized.length === 0) continue

    const supabase = createAdminClient()
    const { data: specs, error: specsError } = await supabase
      .from("product_mask_specs")
      .select("*")
      .in("product_id", prioritized.map((c) => c.id))

    if (specsError) {
      console.error("Failed to load mask specs for reranking:", specsError)
      products = prioritized.slice(0, 3) as MatchedProduct[]
      break
    }

    const reranked = rerankMaskProducts(
      prioritized,
      (specs ?? []) as ProductMaskSpecs[],
      hairProfile,
      decision,
    )

    if (reranked.length > 0) {
      products = reranked
      break
    }
  }

  return { products, updatedDecisions: { mask: decision } }
}

async function selectGeneric(message: string, hairProfile: HairProfile | null): Promise<SelectionResult> {
  const products = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: [],
    count: 3,
  })
  return { products, updatedDecisions: {} }
}

// ── Public dispatcher ────────────────────────────────────────────────────────

/**
 * Select products for the given category.
 * Dispatches to category-specific selection logic.
 * Memory constraints (downranking) are applied after selection.
 */
export async function selectProducts(params: {
  category: ProductCategory
  message: string
  hairProfile: HairProfile | null
  decisions: CategoryDecisions
  memoryContext: UserMemoryContext
  shouldPlanRoutine: boolean
}): Promise<SelectionResult> {
  const { category, message, hairProfile, decisions, memoryContext, shouldPlanRoutine } = params

  // Routine selection is handled separately by the orchestrator (uses product-attachments.ts)
  if (shouldPlanRoutine) {
    return { products: [], updatedDecisions: {} }
  }

  let result: SelectionResult

  switch (category) {
    case "shampoo":
      result = decisions.shampoo
        ? await selectShampoo(message, hairProfile, decisions.shampoo)
        : { products: [], updatedDecisions: {} }
      break
    case "conditioner":
      result = decisions.conditioner
        ? await selectConditioner(message, hairProfile, decisions.conditioner)
        : { products: [], updatedDecisions: {} }
      break
    case "leave_in":
      result = decisions.leaveIn
        ? await selectLeaveIn(message, hairProfile, decisions.leaveIn)
        : { products: [], updatedDecisions: {} }
      break
    case "oil":
      result = decisions.oil
        ? await selectOil(message, hairProfile, decisions.oil)
        : { products: [], updatedDecisions: {} }
      break
    case "mask": {
      const maskDecision = decisions.mask ?? deriveMaskDecision(hairProfile)
      result = await selectMask(message, hairProfile, maskDecision)
      break
    }
    default:
      result = await selectGeneric(message, hairProfile)
      break
  }

  // Apply memory constraints (downranking disliked products)
  result.products = applyProductMemoryConstraints(result.products, memoryContext)

  return result
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction
git add src/lib/rag/selection/
git commit -m "refactor: extract product selection service from pipeline mega-switch"
```

---

### Task 5: Conversation Orchestrator

**Files:**
- Create: `src/lib/rag/orchestrator/conversation-orchestrator.ts`

This is the core of the refactor. Extract the full `runPipeline()` flow from `pipeline.ts` into a clean orchestrator that delegates to the new modules. The logic is identical — only the organization changes.

- [ ] **Step 1: Create `src/lib/rag/orchestrator/conversation-orchestrator.ts`**

This file reimplements `runPipeline()` using the new modules. Read through `pipeline.ts` and verify each section is accounted for.

**Structure:**
- `orchestrateTurn()` — main entry point (equivalent to `runPipeline()`)
- `loadContext()` — parallel load of history + profile + memory (pipeline lines 127–153)
- `classifyAndRoute()` — classification + routing + telemetry (pipeline lines 155–237)
- `ensureConversation()` — conversation creation + title gen (pipeline lines 239–262)
- `handleClarification()` — clarification branch (pipeline lines 264–371)
- `handleNormalTurn()` — normal branch: retrieval + selection + synthesis (pipeline lines 373–695)

```typescript
import { createAdminClient } from "@/lib/supabase/admin"
import { classifyIntent } from "@/lib/rag/intent-classifier"
import { evaluateRoute } from "@/lib/rag/router"
import { emitRouterEvent } from "@/lib/rag/retrieval-telemetry"
import { generateConversationTitle } from "@/lib/rag/title-generator"
import { PRODUCT_INTENTS } from "@/lib/rag/retrieval-constants"
import {
  buildPipelineTraceDraft,
  type PipelineTraceDraft,
} from "@/lib/rag/debug-trace"
import {
  buildRoutineClarificationQuestions,
  buildRoutinePlan,
  buildRoutineRetrievalSubqueries,
} from "@/lib/routines/planner"
import { attachProductsToRoutinePlan } from "@/lib/routines/product-attachments"
import { loadUserMemoryContext } from "@/lib/rag/user-memory"
import { retrieve, buildSources } from "@/lib/rag/retrieval/retrieval-service"
import { composeResponse } from "@/lib/rag/response/response-composer"
import { selectProducts } from "@/lib/rag/selection/product-selection-service"
import {
  buildInitialDecisions,
  buildCategoryClarificationQuestions,
  buildCategoryRetrievalFilter,
  getPrimaryCategoryDecision,
} from "@/lib/rag/category-engine"
import { deriveMaskDecision } from "@/lib/rag/category-engine/mask-wrapper"
import type {
  TurnRequestContext,
  LoadedTurnContext,
  CategoryDecisions,
  PipelineResult,
  PipelineParams,
} from "@/lib/rag/contracts"
import type {
  IntentType,
  Message,
  HairProfile,
  Product,
  RouterDecision,
  RoutinePlan,
  MaskDecision,
} from "@/lib/types"
import type { UserMemoryContext } from "@/lib/rag/user-memory"

// ── Helpers ──────────────────────────────────────────────────────────────────

async function measureAsync<T>(
  work: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await work()
  return { result, durationMs: Math.round(performance.now() - start) }
}

// ── Context Loading ──────────────────────────────────────────────────────────

async function loadContext(
  request: TurnRequestContext,
): Promise<{
  loaded: LoadedTurnContext
  historyLoadMs: number
  hairProfileLoadMs: number
  memoryLoadMs: number
}> {
  const supabase = createAdminClient()

  const [
    { result: conversationData, durationMs: historyLoadMs },
    { result: hairProfileResult, durationMs: hairProfileLoadMs },
    { result: memoryContext, durationMs: memoryLoadMs },
  ] = await Promise.all([
    measureAsync(async () =>
      request.conversationId
        ? await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", request.conversationId)
            .order("created_at", { ascending: true })
            .limit(10)
            .then(({ data }) => data)
        : null,
    ),
    measureAsync(async () =>
      await supabase
        .from("hair_profiles")
        .select("*")
        .eq("user_id", request.userId)
        .single(),
    ),
    measureAsync(() => loadUserMemoryContext(request.userId, supabase)),
  ])

  return {
    loaded: {
      conversationHistory: (conversationData as Message[]) ?? [],
      hairProfile: hairProfileResult.data ?? null,
      memoryContext,
    },
    historyLoadMs,
    hairProfileLoadMs,
    memoryLoadMs,
  }
}

// ── Classification + Routing ──────────────────────────────��──────────────────

async function classifyAndRoute(
  message: string,
  conversationHistory: Message[],
  hairProfile: HairProfile | null,
  conversationId: string | undefined,
) {
  // Classify intent
  const { result: classification, durationMs: classificationMs } = await measureAsync(() =>
    classifyIntent(message, conversationHistory),
  )
  const { intent, product_category: productCategory } = classification
  const shouldPlanRoutine = intent === "routine_help" || productCategory === "routine"

  // Evaluate routing decision
  const routerStart = performance.now()
  const routerDecision = evaluateRoute(classification, conversationHistory, hairProfile, message)
  const routerMs = Math.round(performance.now() - routerStart)

  // Emit telemetry
  emitRouterEvent({
    event: "router_classified",
    conversation_id: conversationId,
    intent,
    retrieval_mode: routerDecision.retrieval_mode,
    router_confidence: routerDecision.confidence,
    needs_clarification: routerDecision.needs_clarification,
    slot_completeness: routerDecision.slot_completeness,
    policy_overrides: routerDecision.policy_overrides,
    stage_latency_ms: routerMs,
  })

  if (routerDecision.policy_overrides.length > 0) {
    emitRouterEvent({
      event: "router_policy_override_applied",
      conversation_id: conversationId,
      intent,
      retrieval_mode: routerDecision.retrieval_mode,
      router_confidence: routerDecision.confidence,
      needs_clarification: routerDecision.needs_clarification,
      policy_overrides: routerDecision.policy_overrides,
      stage_latency_ms: 0,
    })
  }

  if (routerDecision.needs_clarification) {
    emitRouterEvent({
      event: "router_clarification_triggered",
      conversation_id: conversationId,
      intent,
      retrieval_mode: routerDecision.retrieval_mode,
      router_confidence: routerDecision.confidence,
      needs_clarification: true,
      slot_completeness: routerDecision.slot_completeness,
      stage_latency_ms: 0,
    })
  }

  return {
    classification,
    routerDecision,
    intent,
    productCategory,
    shouldPlanRoutine,
    classificationMs,
    routerMs,
  }
}

// ── Conversation Creation ────────────────────────────────────────────────────

async function ensureConversation(
  conversationId: string | undefined,
  message: string,
): Promise<{ conversationId: string; conversationCreateMs: number }> {
  if (conversationId) {
    return { conversationId, conversationCreateMs: 0 }
  }

  const supabase = createAdminClient()
  const { result, durationMs } = await measureAsync(async () =>
    supabase
      .from("conversations")
      .insert({
        user_id: undefined, // Will be set by RLS or explicitly
        title: null,
        is_active: true,
      })
      .select("id")
      .single(),
  )

  const { data: newConversation, error: convError } = result
  if (convError || !newConversation) {
    throw new Error(`Failed to create conversation: ${convError?.message}`)
  }

  generateConversationTitle(newConversation.id, message).catch(() => {})

  return { conversationId: newConversation.id, conversationCreateMs: durationMs }
}

// ── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Orchestrates a single user turn through the full RAG pipeline.
 * This is the replacement for the `runPipeline()` body in pipeline.ts.
 *
 * The public interface (PipelineParams → PipelineResult) is unchanged.
 */
export async function orchestrateTurn(
  params: PipelineParams,
): Promise<PipelineResult> {
  const { message, userId, requestId } = params
  let conversationId = params.conversationId
  const startedAt = new Date().toISOString()

  // ── Step 1: Load context in parallel ─────────────────────────���─────────
  const { loaded, historyLoadMs, hairProfileLoadMs, memoryLoadMs } = await loadContext({
    userId,
    requestId,
    message,
    conversationId,
    startedAt,
  })
  const { conversationHistory, hairProfile, memoryContext } = loaded

  // ── Step 2: Classify intent + evaluate route ───────────────────────────
  const routing = await classifyAndRoute(
    message,
    conversationHistory,
    hairProfile,
    conversationId,
  )
  const { classification, routerDecision, intent, productCategory, shouldPlanRoutine } = routing

  // ── Step 3: Routine planning (if applicable) ───────────────────────────
  let routinePlan: RoutinePlan | undefined
  let routinePlanningMs = 0
  if (shouldPlanRoutine) {
    const supabase = createAdminClient()
    const routinePlanning = await measureAsync(async () => {
      const bondBuilderUsage = await supabase
        .from("user_product_usage")
        .select("id")
        .eq("user_id", userId)
        .eq("category", "bondbuilder")
        .limit(1)
      const usesBondBuilder = (bondBuilderUsage.data?.length ?? 0) > 0
      return buildRoutinePlan(hairProfile, message, { usesBondBuilder })
    })
    routinePlan = routinePlanning.result
    routinePlanningMs = routinePlanning.durationMs
  }

  // ── Step 4: Build category decisions ───────────────────────────────────
  const decisions: CategoryDecisions = buildInitialDecisions(productCategory, hairProfile, message)
  // Mask decision is built separately (different type)
  if (productCategory === "mask") {
    decisions.mask = deriveMaskDecision(hairProfile)
  }

  // ── Step 5: Create conversation if needed ─────────────────────────────��
  let conversationCreateMs = 0
  if (!conversationId) {
    const supabase = createAdminClient()
    const conversationCreate = await measureAsync(async () =>
      supabase
        .from("conversations")
        .insert({
          user_id: userId,
          title: null,
          is_active: true,
        })
        .select("id")
        .single(),
    )
    const { data: newConversation, error: convError } = conversationCreate.result
    conversationCreateMs = conversationCreate.durationMs

    if (convError || !newConversation) {
      throw new Error(`Failed to create conversation: ${convError?.message}`)
    }

    conversationId = newConversation.id
    generateConversationTitle(newConversation.id, message).catch(() => {})
  }

  // ── Step 6: Clarification branch ───────────────────────────────────────
  if (routerDecision.needs_clarification) {
    const clarificationQuestions = buildCategoryClarificationQuestions(
      productCategory,
      decisions,
      shouldPlanRoutine,
      shouldPlanRoutine ? buildRoutineClarificationQuestions(hairProfile, message) : undefined,
      classification,
      hairProfile,
    )

    const clarificationRetrievalCount = 3
    const retrievalStart = performance.now()
    const { chunks: ragChunks, debug: retrievalDebug } = await retrieve(message, {
      intent,
      hairProfile,
      shampooConcern: decisions.shampoo?.matched_concern_code ?? null,
      count: clarificationRetrievalCount,
      subqueries: routinePlan ? buildRoutineRetrievalSubqueries(message, routinePlan) : undefined,
      userId,
    })
    const retrievalMs = Math.round(performance.now() - retrievalStart)

    const sources = buildSources(ragChunks)

    const synthesisResult = await composeResponse({
      userMessage: message,
      conversationHistory,
      hairProfile,
      ragChunks,
      intent,
      productCategory,
      shampooDecision: decisions.shampoo,
      conditionerDecision: decisions.conditioner,
      leaveInDecision: decisions.leaveIn,
      oilDecision: decisions.oil,
      memoryContext: memoryContext.promptContext,
      clarificationQuestions,
    })

    const categoryDecision = getPrimaryCategoryDecision(decisions)
    const debugTrace = buildPipelineTraceDraft({
      request_id: requestId,
      started_at: startedAt,
      user_message: message,
      conversation_id: conversationId ?? null,
      intent,
      product_category: productCategory,
      conversation_history_count: conversationHistory.length,
      classification,
      router_decision: routerDecision,
      clarification_questions: clarificationQuestions,
      hair_profile_snapshot: hairProfile,
      memory_context: memoryContext.promptContext,
      retrieval_debug: retrievalDebug,
      retrieval_count: clarificationRetrievalCount,
      retrieved_chunks: ragChunks,
      should_plan_routine: shouldPlanRoutine,
      routine_plan: routinePlan,
      category_decision: categoryDecision,
      matched_products: [],
      prompt: synthesisResult.debug.prompt,
      latencies_ms: {
        classification_ms: routing.classificationMs,
        hair_profile_load_ms: hairProfileLoadMs,
        memory_load_ms: memoryLoadMs,
        routine_planning_ms: routinePlanningMs,
        history_load_ms: historyLoadMs,
        router_ms: routing.routerMs,
        conversation_create_ms: conversationCreateMs,
        retrieval_ms: retrievalMs,
        product_matching_ms: 0,
        prompt_build_ms: synthesisResult.debug.prompt_build_ms,
        stream_setup_ms: synthesisResult.debug.stream_setup_ms,
      },
    })

    return {
      stream: synthesisResult.stream,
      conversationId: conversationId!,
      intent,
      matchedProducts: [],
      sources,
      routerDecision,
      categoryDecision,
      retrievalSummary: { final_context_count: ragChunks.length },
      debugTrace,
    }
  }

  // ── Step 7: Normal branch — retrieval ──────────────────────────────────
  const metadataFilter = buildCategoryRetrievalFilter(intent, productCategory, decisions, hairProfile)
  const retrievalCount = routerDecision.retrieval_mode === "faq" ? 3 : 5

  const retrievalStart = performance.now()
  const { chunks: ragChunks, debug: retrievalDebug } = await retrieve(message, {
    intent,
    hairProfile,
    metadataFilter,
    shampooConcern: decisions.shampoo?.matched_concern_code ?? null,
    count: retrievalCount,
    subqueries: routinePlan ? buildRoutineRetrievalSubqueries(message, routinePlan) : undefined,
    userId,
  })
  const retrievalMs = Math.round(performance.now() - retrievalStart)

  const sources = buildSources(ragChunks)

  // ── Step 8: Product matching ───────────────────────────────────────────
  let matchedProducts: Product[] | undefined
  const productMatchingStart = performance.now()

  if (shouldPlanRoutine && routinePlan) {
    // Routine selection — handled by product-attachments, not the selection service
    const routineResult = await attachProductsToRoutinePlan({
      plan: routinePlan,
      hairProfile,
      memoryContext,
      supabase: createAdminClient(),
    })
    routinePlan = routineResult.plan
    matchedProducts = routineResult.matchedProducts
  } else if (PRODUCT_INTENTS.includes(intent)) {
    const selectionResult = await selectProducts({
      category: productCategory,
      message,
      hairProfile,
      decisions,
      memoryContext,
      shouldPlanRoutine: false,
    })
    matchedProducts = selectionResult.products

    // Merge updated decisions back
    if (selectionResult.updatedDecisions.shampoo) decisions.shampoo = selectionResult.updatedDecisions.shampoo
    if (selectionResult.updatedDecisions.conditioner) decisions.conditioner = selectionResult.updatedDecisions.conditioner
    if (selectionResult.updatedDecisions.leaveIn) decisions.leaveIn = selectionResult.updatedDecisions.leaveIn
    if (selectionResult.updatedDecisions.oil) decisions.oil = selectionResult.updatedDecisions.oil
    if (selectionResult.updatedDecisions.mask) decisions.mask = selectionResult.updatedDecisions.mask
  }

  const productMatchingMs = Math.round(performance.now() - productMatchingStart)

  // ── Step 9: Synthesize response ────────────────────────────────────────
  const synthesisResult = await composeResponse({
    userMessage: message,
    conversationHistory,
    hairProfile,
    ragChunks,
    products: matchedProducts,
    intent,
    productCategory,
    maskDecision: productCategory === "mask" ? decisions.mask : undefined,
    shampooDecision: decisions.shampoo,
    conditionerDecision: decisions.conditioner,
    leaveInDecision: decisions.leaveIn,
    oilDecision: decisions.oil,
    routinePlan,
    memoryContext: memoryContext.promptContext,
  })

  const categoryDecision = getPrimaryCategoryDecision(decisions)
  const debugTrace = buildPipelineTraceDraft({
    request_id: requestId,
    started_at: startedAt,
    user_message: message,
    conversation_id: conversationId ?? null,
    intent,
    product_category: productCategory,
    conversation_history_count: conversationHistory.length,
    classification,
    router_decision: routerDecision,
    hair_profile_snapshot: hairProfile,
    memory_context: memoryContext.promptContext,
    retrieval_debug: retrievalDebug,
    retrieval_count: retrievalCount,
    retrieved_chunks: ragChunks,
    should_plan_routine: shouldPlanRoutine,
    routine_plan: routinePlan,
    category_decision: categoryDecision,
    matched_products: matchedProducts ?? [],
    prompt: synthesisResult.debug.prompt,
    latencies_ms: {
      classification_ms: routing.classificationMs,
      hair_profile_load_ms: hairProfileLoadMs,
      memory_load_ms: memoryLoadMs,
      routine_planning_ms: routinePlanningMs,
      history_load_ms: historyLoadMs,
      router_ms: routing.routerMs,
      conversation_create_ms: conversationCreateMs,
      retrieval_ms: retrievalMs,
      product_matching_ms: productMatchingMs,
      prompt_build_ms: synthesisResult.debug.prompt_build_ms,
      stream_setup_ms: synthesisResult.debug.stream_setup_ms,
    },
  })

  return {
    stream: synthesisResult.stream,
    conversationId: conversationId!,
    intent,
    matchedProducts: matchedProducts ?? [],
    sources,
    routerDecision,
    categoryDecision,
    retrievalSummary: { final_context_count: ragChunks.length },
    debugTrace,
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction && npx tsc --noEmit`
Expected: PASS (orchestrator is not yet wired in — nothing calls it)

Fix any type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction
git add src/lib/rag/orchestrator/
git commit -m "refactor: add conversation orchestrator replacing pipeline internals"
```

---

### Task 6: Pipeline Compatibility Facade

**Files:**
- Modify: `src/lib/rag/pipeline.ts`

Replace the 696-line body with a thin facade that delegates to the orchestrator. Keep the same public API — `runPipeline()` with `PipelineParams` → `PipelineResult`.

- [ ] **Step 1: Replace `src/lib/rag/pipeline.ts` with facade**

Replace the **entire file** with:

```typescript
/**
 * Pipeline compatibility facade.
 *
 * This file preserves the `runPipeline()` entry point that `/api/chat/route.ts` depends on.
 * All orchestration logic has moved to `orchestrator/conversation-orchestrator.ts`.
 *
 * This facade will be removed once route.ts imports the orchestrator directly.
 */
import { orchestrateTurn } from "@/lib/rag/orchestrator/conversation-orchestrator"
import type { PipelineParams, PipelineResult } from "@/lib/rag/contracts"

// Re-export types so existing consumers (route.ts) don't need import changes yet
export type { PipelineParams, PipelineResult }

/**
 * Orchestrates the full RAG pipeline for a single user turn.
 * Delegates to the conversation orchestrator.
 */
export async function runPipeline(
  params: PipelineParams,
): Promise<PipelineResult> {
  return orchestrateTurn(params)
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction && npx tsc --noEmit`
Expected: PASS — route.ts imports `runPipeline` and `PipelineResult` from pipeline.ts, which still exports both.

- [ ] **Step 3: Commit**

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction
git add src/lib/rag/pipeline.ts
git commit -m "refactor: replace pipeline.ts with thin facade over conversation orchestrator"
```

---

### Task 7: Verification

- [ ] **Step 1: Run full typecheck**

Run: `cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction && npx tsc --noEmit`
Expected: PASS with zero errors.

- [ ] **Step 2: Run lint**

Run: `cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction && npx next lint`
Expected: PASS (or only pre-existing warnings).

- [ ] **Step 3: Run existing test suite**

Run: `cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction && npm run ci:verify`
Expected: PASS — all existing tests pass unchanged.

- [ ] **Step 4: Run build**

Run: `cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction && npm run build`
Expected: PASS — production build succeeds.

- [ ] **Step 5: Verify acceptance criteria**

Manually confirm:
1. `pipeline.ts` is now a thin facade (~20 lines)
2. `route.ts` is unchanged
3. Orchestrator has no inline category branching for decisions or clarification (delegated to category-engine)
4. Product matching branching is in `product-selection-service.ts`, not the orchestrator
5. Retrieval and response are behind service wrappers
6. No existing files were modified except `pipeline.ts`
7. All category decision files are untouched

- [ ] **Step 6: Final commit if any fixes were needed**

Only if previous steps required fixes:
```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/phase1-boundary-extraction
git add -A
git commit -m "fix: resolve type/lint issues from Phase 1 boundary extraction"
```
