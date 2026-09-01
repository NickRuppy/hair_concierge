import assert from "node:assert/strict"
import test from "node:test"

import { stage3BootstrapDiagnosticError } from "../src/lib/observability/personal-plan-stage3"

test("Stage 3 contract diagnostics contain only fixed source and violation values", () => {
  const error = stage3BootstrapDiagnosticError("optional_entry", "missing_authority_evaluations")
  assert.equal(error.name, "Stage3BootstrapContractViolation")
  assert.equal(
    error.message,
    "stage3_bootstrap_contract_violation:optional_entry:missing_authority_evaluations",
  )
  assert.doesNotMatch(error.message, /plan-|refined-|draft-|product-|owner-/)
})
