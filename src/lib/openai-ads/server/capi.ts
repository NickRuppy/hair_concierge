import "server-only"
import type { BillingAnalyticsOutboxRow } from "@/lib/billing/types"
import { buildOpenAIConversionEvent, type OpenAIEventContext } from "../event-payload"

export type OpenAIDeliveryResult =
  | { outcome: "accepted"; status: number }
  | {
      outcome: "skipped"
      reason: "disabled" | "not_configured" | "consent_denied" | "invalid_event"
    }
  | {
      outcome: "failed"
      reason: "http_error" | "timeout" | "context_or_transport_error"
      retryable: boolean
      status?: number
    }

export type OpenAICAPIDependencies = {
  resolveContext: (event: BillingAnalyticsOutboxRow) => Promise<OpenAIEventContext | null>
  env?: Record<string, string | undefined>
  fetch?: typeof fetch
  now?: () => number
  timeoutMs?: number
}

/** Resolve eligible context immediately before sending; release flags never supply consent. */
export async function sendOpenAIConversion(
  event: BillingAnalyticsOutboxRow,
  dependencies: OpenAICAPIDependencies,
): Promise<OpenAIDeliveryResult> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()
  try {
    const env = dependencies.env ?? process.env
    if (env.OPENAI_ADS_ENABLED !== "true") return { outcome: "skipped", reason: "disabled" }
    const pixelId = env.OPENAI_ADS_PIXEL_ID
    const key = env.OPENAI_ADS_CAPI_KEY
    if (
      !pixelId ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(pixelId) ||
      env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID !== pixelId ||
      !key?.trim()
    )
      return { outcome: "skipped", reason: "not_configured" }

    const configuredTimeout = dependencies.timeoutMs ?? 1500
    const timeoutMs = Number.isFinite(configuredTimeout)
      ? Math.max(1, Math.min(1500, configuredTimeout))
      : 1500
    const timeout = new Promise<OpenAIDeliveryResult>((resolve) => {
      timer = setTimeout(() => {
        controller.abort()
        resolve({ outcome: "failed", reason: "timeout", retryable: true })
      }, timeoutMs)
    })
    const send = async (): Promise<OpenAIDeliveryResult> => {
      const context = await dependencies.resolveContext(event)
      // A late resolver must not send after the outer timeout has returned.
      if (controller.signal.aborted)
        return { outcome: "failed", reason: "timeout", retryable: true }
      if (!context) return { outcome: "skipped", reason: "consent_denied" }
      const conversion = buildOpenAIConversionEvent(
        event,
        context,
        (dependencies.now ?? Date.now)(),
      )
      if (!conversion) return { outcome: "skipped", reason: "invalid_event" }
      const response = await (dependencies.fetch ?? fetch)(
        `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`,
        {
          method: "POST",
          redirect: "error",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ validate_only: false, events: [conversion] }),
          signal: controller.signal,
        },
      )
      if (!response.ok)
        return {
          outcome: "failed",
          reason: "http_error",
          status: response.status,
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        }
      // HTTP acceptance does not prove matching, attribution, or Ads Manager visibility.
      return { outcome: "accepted", status: response.status }
    }
    return await Promise.race([send(), timeout])
  } catch {
    return {
      outcome: "failed",
      reason: controller.signal.aborted ? "timeout" : "context_or_transport_error",
      retryable: true,
    }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
