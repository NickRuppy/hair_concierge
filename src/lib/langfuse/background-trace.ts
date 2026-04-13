import { ensureLangfuseTracing, flushLangfuseClient, getLangfuseRelease } from "@/lib/openai/client"
import {
  getActiveSpanId,
  getActiveTraceId,
  propagateAttributes,
  startObservation,
  type LangfuseChain,
} from "@langfuse/tracing"
import { ROOT_CONTEXT, context as otelContext, trace as otelTrace } from "@opentelemetry/api"

type BackgroundTraceParams = {
  name: string
  conversationId: string
  userId?: string | null
  requestId?: string | null
  input?: unknown
  metadata?: Record<string, unknown>
  tags?: string[]
}

function toPropagatedMetadata(metadata: Record<string, unknown>): Record<string, string> {
  const propagated: Record<string, string> = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (value == null) continue
    if (typeof value === "string") {
      propagated[key] = value
      continue
    }

    try {
      propagated[key] = JSON.stringify(value)
    } catch {
      // Skip values that cannot be serialized into baggage-safe trace metadata.
    }
  }

  return propagated
}

export async function runDetachedBackgroundTrace<T>(
  params: BackgroundTraceParams,
  work: (observation: LangfuseChain) => Promise<T>,
): Promise<T> {
  ensureLangfuseTracing()

  const triggerTraceId = getActiveTraceId() ?? null
  const triggerObservationId = getActiveSpanId() ?? null
  const observationMetadata: Record<string, unknown> = {
    background_job: params.name,
    conversation_id: params.conversationId,
    ...params.metadata,
  }

  if (params.requestId) {
    observationMetadata.request_id = params.requestId
  }

  if (triggerTraceId) {
    observationMetadata.trigger_trace_id = triggerTraceId
  }

  if (triggerObservationId) {
    observationMetadata.trigger_observation_id = triggerObservationId
  }

  const propagatedMetadata = toPropagatedMetadata(observationMetadata)

  return otelContext.with(ROOT_CONTEXT, () =>
    propagateAttributes(
      {
        userId: params.userId ?? undefined,
        sessionId: params.conversationId,
        version: getLangfuseRelease(),
        traceName: params.name,
        tags: ["background-job", params.name, ...(params.tags ?? [])],
        metadata: propagatedMetadata,
      },
      async () => {
        const observation = startObservation(
          params.name,
          {
            input: params.input,
            metadata: observationMetadata,
          },
          { asType: "chain" },
        )
        const observationContext = otelTrace.setSpan(otelContext.active(), observation.otelSpan)

        try {
          return await otelContext.with(observationContext, () => work(observation))
        } catch (error) {
          observation.update({
            level: "ERROR",
            output: {
              failed: true,
            },
            metadata: {
              error: error instanceof Error ? error.message : "background_trace_failed",
            },
          })
          throw error
        } finally {
          observation.end()
          await flushLangfuseClient().catch(() => {})
        }
      },
    ),
  )
}
