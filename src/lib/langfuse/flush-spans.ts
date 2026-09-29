import { getLangfuseTracerProvider } from "@langfuse/tracing"

type FlushableProvider = { forceFlush?: () => Promise<void>; getDelegate?: () => unknown }

/**
 * Waits until every ended Langfuse span has been exported. `flushLangfuseClient` only drains
 * the API client (scores, prompts) — the OpenAI generation spans from `getObservedOpenAI` sit
 * in the OTel span processor, whose export is a fire-and-forget fetch even in `immediate`
 * mode. A serverless route that returns before that fetch settles can lose the trace, so
 * request-scoped LLM routes await this before responding. Never throws.
 */
export async function flushLangfuseSpans(): Promise<void> {
  try {
    const provider = getLangfuseTracerProvider() as FlushableProvider
    // The global provider is OTel's ProxyTracerProvider; the SDK's real one is its delegate.
    const delegate = (provider.getDelegate?.() ?? provider) as FlushableProvider
    await delegate.forceFlush?.()
  } catch (error) {
    console.error("[langfuse] span flush failed:", error)
  }
}
