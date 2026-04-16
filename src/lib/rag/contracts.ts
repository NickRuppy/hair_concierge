import type {
  ChatCategoryDecision,
  IntentType,
  Message,
  HairProfile,
  Product,
  EnrichedCitationSource,
  RouterDecision,
  ClassificationResult,
  ProductCategory,
  ShampooDecision,
  ConditionerDecision,
  LeaveInDecision,
  OilDecision,
  MaskDecision,
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
  categoryDecision?: ChatCategoryDecision
  engineTrace?: import("@/lib/types").RecommendationEngineTrace
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
