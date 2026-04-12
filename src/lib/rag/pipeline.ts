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
export async function runPipeline(params: PipelineParams): Promise<PipelineResult> {
  return orchestrateTurn(params)
}
