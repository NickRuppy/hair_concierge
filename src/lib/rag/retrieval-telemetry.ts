import type { IntentType, RetrievalMode } from "@/lib/types"

/**
 * Structured retrieval telemetry events.
 * Emitted as JSON to console for log aggregation.
 * Ref: PRD Section 8, NFRs
 */

export type RetrievalEventType =
  | "retrieval_dense_completed"
  | "retrieval_lexical_completed"
  | "retrieval_fused"
  | "retrieval_reranked"
  | "retrieval_fallback_dense_only"

export interface RetrievalEvent {
  event: RetrievalEventType
  conversation_id?: string
  intent?: IntentType
  candidate_count: number
  stage_latency_ms: number
  top_source_types?: string[]
  subquery_count?: number
}

/**
 * Emits a structured retrieval telemetry event to console (JSON format).
 * No raw PII is included — only aggregate counts, latencies, and source types.
 */
export function emitRetrievalEvent(event: RetrievalEvent): void {
  console.log(
    JSON.stringify({
      _type: "retrieval_telemetry",
      timestamp: new Date().toISOString(),
      ...event,
    }),
  )
}

// ── Router telemetry (Phase 2) ──────────────────────────────────────────────

export type RouterEventType =
  | "router_classified"
  | "router_policy_override_applied"
  | "router_clarification_triggered"
  | "router_fallback_default_mode"

export interface RouterEvent {
  event: RouterEventType
  conversation_id?: string
  intent?: IntentType
  retrieval_mode: RetrievalMode
  router_confidence: number
  response_mode: string
  slot_completeness?: number
  policy_overrides?: string[]
  stage_latency_ms: number
}

/**
 * Emits a structured router telemetry event to console (JSON format).
 * Same pattern as emitRetrievalEvent — no PII, only aggregate data.
 */
export function emitRouterEvent(event: RouterEvent): void {
  console.log(
    JSON.stringify({
      _type: "router_telemetry",
      timestamp: new Date().toISOString(),
      ...event,
    }),
  )
}

/**
 * Extracts the top N most common source types from a list of chunks.
 */
export function topSourceTypes(chunks: { source_type: string }[], n = 3): string[] {
  const counts = new Map<string, number>()
  for (const c of chunks) {
    counts.set(c.source_type, (counts.get(c.source_type) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([type]) => type)
}
