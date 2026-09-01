import { captureSentryClientException } from "./sentry-client-runtime"
import type { Stage3BootstrapContractViolation } from "@/lib/personal-plan/products/bootstrap-response"

export type Stage3BootstrapEndpointSource = "normal_get" | "optional_entry"

export function stage3BootstrapDiagnosticError(
  source: Stage3BootstrapEndpointSource,
  violation: Stage3BootstrapContractViolation,
) {
  const error = new Error(`stage3_bootstrap_contract_violation:${source}:${violation}`)
  error.name = "Stage3BootstrapContractViolation"
  return error
}

export function captureStage3BootstrapContractViolation(
  source: Stage3BootstrapEndpointSource,
  violation: Stage3BootstrapContractViolation,
) {
  return captureSentryClientException(stage3BootstrapDiagnosticError(source, violation), "react")
}
