import { synthesizeResponse } from "@/lib/rag/synthesizer"
import type { SynthesizeParams, SynthesisResult } from "@/lib/rag/synthesizer"

export type { SynthesizeParams, SynthesisResult }

/**
 * Compose the streaming response via the synthesizer.
 * Delegates to the existing synthesizer — this wrapper exists so the orchestrator
 * has a single import for response composition.
 */
export async function composeResponse(params: SynthesizeParams): Promise<SynthesisResult> {
  return synthesizeResponse(params)
}
