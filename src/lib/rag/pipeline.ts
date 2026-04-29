/**
 * Pipeline compatibility facade.
 *
 * This file preserves the legacy `runPipeline()` entry point for older tooling while
 * production `/api/chat` is being moved to the bounded-agent front door.
 *
 * Remove this facade with the rest of the deprecated RAG orchestration once Agent v1
 * covers all product categories.
 */
import { orchestrateTurn } from "@/lib/rag/orchestrator/conversation-orchestrator"
import type { PipelineParams, PipelineResult } from "@/lib/rag/contracts"

// Re-export types so existing consumers (route.ts) don't need import changes yet
export type { PipelineParams, PipelineResult }

/**
 * Orchestrates the full RAG pipeline for a single user turn.
 * Delegates to the conversation orchestrator.
 */
export async function runPipeline(params: PipelineParams): Promise<PipelineResult> {
  return orchestrateTurn(params)
}
