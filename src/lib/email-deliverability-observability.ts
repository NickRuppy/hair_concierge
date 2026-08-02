import * as Sentry from "@sentry/nextjs"

import type { EmailDeliverability } from "@/lib/email-deliverability"

export type EmailDeliverabilityJourney = "personal_plan" | "legacy"

export function recordEmailDeliverabilityOutcome(
  journey: EmailDeliverabilityJourney,
  deliverability: EmailDeliverability,
  countMetric?: typeof Sentry.metrics.count,
) {
  try {
    const emitMetric = countMetric ?? Sentry.metrics?.count
    if (!emitMetric) return
    const attributes = deliverability.ok
      ? { journey, outcome: deliverability.outcome }
      : {
          journey,
          outcome: "rejected" as const,
          reason: deliverability.reason,
          suggestion_present: Boolean(deliverability.suggestion),
        }
    emitMetric("quiz.email_deliverability.check", 1, { attributes })
  } catch (error) {
    // Observability must never turn an accepted address into a lost lead.
    console.warn(
      "[deliverability] Sentry metric failed",
      error instanceof Error ? error.message : String(error),
    )
  }
}
