import * as Sentry from "@sentry/nextjs"

export interface OfferExperimentAssignmentFailureDetails {
  experimentId: string
  revision: number
  intendedVariant: string
  fallbackVariant: string
  packageKey: string | null | undefined
}

export interface OfferExperimentSentryPayload {
  fingerprint: string[]
  tags: Record<string, string>
  context: Record<string, unknown>
}

interface OfferExperimentScope {
  setContext(name: string, context: Record<string, unknown>): void
  setFingerprint(value: string[]): void
  setLevel(level: "error"): void
  setTag(key: string, value: string): void
}

interface OfferExperimentSentrySink {
  captureException(error: unknown): void
  withScope(callback: (scope: OfferExperimentScope) => void): void
}

export function buildOfferExperimentSentryPayload(
  details: OfferExperimentAssignmentFailureDetails,
): OfferExperimentSentryPayload {
  const tags = {
    "offer_experiment.id": details.experimentId,
    "offer_experiment.revision": String(details.revision),
    "offer_experiment.stage": "assignment_persistence",
    "offer_experiment.intended_variant": details.intendedVariant,
    "offer_experiment.fallback_variant": details.fallbackVariant,
    "offer_experiment.package_key": details.packageKey ?? "unknown",
  }
  return {
    fingerprint: ["offer-experiment-assignment-persistence-failed"],
    tags,
    context: {
      experiment_id: details.experimentId,
      revision: details.revision,
      stage: "assignment_persistence",
      intended_variant: details.intendedVariant,
      fallback_variant: details.fallbackVariant,
      package_key: details.packageKey ?? "unknown",
    },
  }
}

export function captureOfferExperimentAssignmentFailure(
  error: unknown,
  details: OfferExperimentAssignmentFailureDetails,
  sink: OfferExperimentSentrySink = Sentry,
) {
  const payload = buildOfferExperimentSentryPayload(details)
  sink.withScope((scope) => {
    for (const [key, value] of Object.entries(payload.tags)) scope.setTag(key, value)
    scope.setFingerprint(payload.fingerprint)
    scope.setContext("offer_experiment", payload.context)
    scope.setLevel("error")
    sink.captureException(error)
  })
}
