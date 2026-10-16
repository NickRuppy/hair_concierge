import { readFileSync } from "node:fs"
import type { ProductIntakeSubmissionDetail } from "../../../packages/product-intake-core/src/jobs"
import {
  assertOilReviewSnapshot,
  extractOilPropertyScope,
  intakeSnapshotFingerprint,
  oilReviewFingerprint,
  oilReviewRecord,
  stableOilReviewJson,
  type OilIntakeReviewSnapshot,
} from "../../../packages/product-intake-core/src/oil-review-binding"
import { validateProductIntakeApprovalPayload } from "@/lib/product-intake/category-validators"
import {
  assertOilFinalProductIdentity,
  assertOilResearchIdentityContext,
  type OilWorkerAdmissionContext,
} from "@/lib/product-intake/oil-research-adapter"
import { OilResearchEnvelopeSchema, sha256Utf8, type OilResearchEnvelope } from "./contracts"
import { resolveOilStorage } from "./storage"
import { projectOilForProduction } from "./production-adapter"

type OilLabReviewPackageCommon = {
  packageFingerprint: string
  admissionContext: Record<string, unknown>
  admissionContextJson: string
  resolvedIdentityArtifact: Record<string, unknown>
  envelopeJson: string
  matchingSuggestions: Record<string, unknown>
  snapshotFingerprint: string
  intakeReviewSnapshot: OilIntakeReviewSnapshot
}
export type OilLegacyLabReviewPackage = OilLabReviewPackageCommon & {
  version: "oil-lab-review-bundle-v1"
}
export type OilCurrentLabReviewPackage = OilLabReviewPackageCommon & {
  version: "oil-lab-review-bundle-v2"
}
export type OilLabReviewPackage = OilLegacyLabReviewPackage | OilCurrentLabReviewPackage

/** v0.10 is lean by design; legacy packages keep their original 17-row scope. */
export const OIL_CURRENT_LAB_PROPERTY_IDS = [
  "base",
  "weight",
  "persistence_potential",
  "supported_uses",
  "provides_heat_protection",
  "provides_uv_protection",
  "ingredient_flags.silicones",
  "ingredient_flags.mineral_oil",
  "ingredient_flags.drying_alcohol",
  "ingredient_flags.fragrance",
  "ingredient_flags.scalp_active_botanicals",
  "projection",
  "matching",
] as const
export const OIL_LEGACY_LAB_PROPERTY_IDS = [
  "base",
  "named_oils",
  "weight",
  "dispenser",
  "penetration_potential",
  "provides_heat_protection",
  "provides_uv_protection",
  "supported_uses",
  "persistence_potential",
  "ingredient_flags.silicones",
  "ingredient_flags.mineral_oil",
  "ingredient_flags.drying_alcohol",
  "ingredient_flags.fragrance",
  "ingredient_flags.scalp_active_botanicals",
  "scenario_fit",
  "projection",
  "matching",
] as const
export function oilLabReviewPropertyIds(bundle: Pick<OilLabReviewPackage, "version">): string[] {
  return [
    ...(bundle.version === "oil-lab-review-bundle-v2"
      ? OIL_CURRENT_LAB_PROPERTY_IDS
      : OIL_LEGACY_LAB_PROPERTY_IDS),
  ]
}
export function packageFingerprint(
  bundle: Omit<OilLabReviewPackage, "packageFingerprint">,
): string {
  return oilReviewFingerprint(bundle)
}
export { intakeSnapshotFingerprint }

export function oilLabMatchingBlockers(bundle: OilLabReviewPackage): string[] {
  const suggestions = bundle.matchingSuggestions
  const blockers: string[] = []
  if (
    !Array.isArray(suggestions.product_oil_eligibility) ||
    suggestions.product_oil_eligibility.length === 0
  )
    blockers.push("Matching-Zeilen fehlen")
  const thicknesses = suggestions.suitable_thicknesses
  if (
    !Array.isArray(thicknesses) ||
    thicknesses.length === 0 ||
    !thicknesses.every((x) => typeof x === "string" && x.trim().length > 0)
  )
    blockers.push("Haardicken-Vorschlag fehlt")
  return blockers
}
function matchingFromScope(scope: Record<string, unknown>): Record<string, unknown> {
  const product = oilReviewRecord(scope.product)
  const specs = oilReviewRecord(scope.category_specs)
  return structuredClone({
    product_oil_eligibility: specs.product_oil_eligibility,
    suitable_thicknesses: product.suitable_thicknesses,
    field_rationales: scope.field_rationales,
  })
}
function assertAdmissionContextJson(
  context: Record<string, unknown>,
  serialized: unknown,
  expectedSha256: string,
): asserts serialized is string {
  if (typeof serialized !== "string")
    throw new Error("Oil admission context byte receipt is missing")
  const parsed = oilReviewRecord(JSON.parse(serialized))
  if (
    serialized !== stableOilReviewJson(context) ||
    oilReviewFingerprint(parsed) !== oilReviewFingerprint(context) ||
    sha256Utf8(serialized) !== expectedSha256
  )
    throw new Error("Oil admission context byte receipt mismatch")
}
function assertAdmissionContext(
  envelope: OilResearchEnvelope,
  snapshot: OilIntakeReviewSnapshot,
  context: Record<string, unknown>,
  identityArtifact: Record<string, unknown>,
): void {
  if (
    oilReviewFingerprint(context) !== snapshot.admissionContextSha256 ||
    context.submission_id !== snapshot.submissionId ||
    context.job_id !== snapshot.jobId ||
    typeof context.run_id !== "string" ||
    !context.run_id.trim()
  )
    throw new Error("Oil admission context digest or current job mismatch")
  if (
    context.resolved_identity_artifact_id !== snapshot.resolvedIdentityArtifactId ||
    identityArtifact.id !== snapshot.resolvedIdentityArtifactId ||
    identityArtifact.kind !== "identity_candidate" ||
    identityArtifact.status !== "resolved" ||
    identityArtifact.submission_id !== snapshot.submissionId ||
    identityArtifact.job_id !== snapshot.jobId
  )
    throw new Error("Oil resolved identity artifact is not current")
  const product = oilReviewRecord(snapshot.rawPropertyScope.product)
  const finalIdentity = Object.fromEntries(
    ["canonical_brand", "product_line", "clean_name", "net_content_value", "net_content_unit"].map(
      (key) => [key, product[key] ?? null],
    ),
  )
  if (oilReviewFingerprint(finalIdentity) !== oilReviewFingerprint(context.final_product_identity))
    throw new Error("Oil current final identity differs from admitted identity")
  assertOilFinalProductIdentity(
    finalIdentity,
    oilReviewRecord(context.identity) as OilWorkerAdmissionContext["identity"],
  )
  const resolvedPayload = oilReviewRecord(identityArtifact.payload)
  if (
    oilReviewFingerprint(context.resolved_identity_artifact) !==
    oilReviewFingerprint(resolvedPayload)
  )
    throw new Error("Oil admission context differs from stored resolved identity artifact")
  const brandResolution = oilReviewRecord(resolvedPayload.brand_resolution)
  if (
    brandResolution.canonical_brand !== product.canonical_brand ||
    (brandResolution.product_line ?? null) !== (product.product_line ?? null)
  )
    throw new Error("Oil final identity differs from resolved brand artifact")
  assertOilResearchIdentityContext(envelope, {
    submissionId: snapshot.submissionId,
    jobId: snapshot.jobId,
    runId: context.run_id,
    resolvedIdentityArtifactId: snapshot.resolvedIdentityArtifactId,
    resolvedIdentityArtifact: resolvedPayload,
    identityBlocker: null,
    identity: oilReviewRecord(context.identity) as OilWorkerAdmissionContext["identity"],
    formula: oilReviewRecord(context.formula) as OilWorkerAdmissionContext["formula"],
  })
}

/**
 * The generic INCI stage emits this compact receipt only after the oil
 * admission has supplied the ordered canonical declaration.  It is retained
 * separately from the expanded authoritative context so a handoff cannot
 * silently substitute a model or retailer formula for the admitted envelope.
 */
function assertCurrentCanonicalFormula(
  draft: Record<string, unknown>,
  admissionContext: Record<string, unknown>,
  envelope: OilResearchEnvelope,
): void {
  const formula = oilReviewRecord(draft.formula)
  const admittedFormula = oilReviewRecord(admissionContext.formula)
  const expectedIngredients = envelope.formula.ingredients.map(
    (ingredient) => ingredient.canonical_name,
  )
  if (
    formula.status !== "present" ||
    formula.source !== "oil_envelope" ||
    formula.raw_inci !== admittedFormula.raw_inci ||
    formula.raw_inci !== envelope.formula.raw_inci ||
    oilReviewFingerprint(formula.normalized_ingredients) !==
      oilReviewFingerprint(expectedIngredients) ||
    formula.fingerprint_sha256 !== envelope.formula.normalized_sha256
  )
    throw new Error("Oil current canonical formula differs from admission")
}
export function parseOilLabReviewPackage(input: unknown): OilLabReviewPackage {
  const value = oilReviewRecord(input)
  if (value.version !== "oil-lab-review-bundle-v1" && value.version !== "oil-lab-review-bundle-v2")
    throw new Error("Unsupported oil Lab package")
  const { packageFingerprint: claimed, ...body } = value
  if (claimed !== oilReviewFingerprint(body))
    throw new Error("Oil Lab package fingerprint mismatch")
  assertOilReviewSnapshot(value.intakeReviewSnapshot)
  const snapshot = value.intakeReviewSnapshot
  if (
    (value.version === "oil-lab-review-bundle-v2") !==
    (snapshot.version === "oil-intake-review-v2")
  )
    throw new Error("Oil Lab package and snapshot versions differ")
  if (value.snapshotFingerprint !== intakeSnapshotFingerprint(snapshot))
    throw new Error("Oil intake snapshot fingerprint mismatch")
  assertAdmissionContextJson(
    oilReviewRecord(value.admissionContext),
    value.admissionContextJson,
    snapshot.admissionContextSha256,
  )
  if (
    typeof value.envelopeJson !== "string" ||
    sha256Utf8(value.envelopeJson) !== snapshot.envelopeSha256
  )
    throw new Error("Oil Lab envelope byte mismatch")
  const envelope = OilResearchEnvelopeSchema.parse(JSON.parse(value.envelopeJson))
  if (
    envelope.research_method.purpose !== "intake_research" ||
    envelope.provenance.import_kind !== "current" ||
    envelope.submission_id !== snapshot.submissionId ||
    envelope.formula.raw_sha256 !== snapshot.rawSha256 ||
    envelope.formula.normalized_sha256 !== snapshot.normalizedSha256 ||
    oilReviewFingerprint(envelope.research_method) !== oilReviewFingerprint(snapshot.method)
  )
    throw new Error("Oil Lab package is not bound to current intake research")
  if (
    (value.version === "oil-lab-review-bundle-v2") !==
    (envelope.version === "oil-research-envelope-v2")
  )
    throw new Error("Oil Lab package and research method versions differ")
  assertAdmissionContext(
    envelope,
    snapshot,
    oilReviewRecord(value.admissionContext),
    oilReviewRecord(value.resolvedIdentityArtifact),
  )
  const projection = projectOilForProduction(envelope)
  if (
    projection.status !== "property_projection_ready" ||
    oilReviewFingerprint(
      oilReviewRecord(snapshot.rawPropertyScope.category_specs).product_oil_specs,
    ) !== oilReviewFingerprint(projection.category_specs.product_oil_specs)
  )
    throw new Error("Oil Lab projection differs from its research envelope")
  // Reconstruct only schema-required, separately reviewed image/time placeholders.
  // They never enter the review scope or claim image approval.
  const normalized = validateProductIntakeApprovalPayload({
    final: {
      ...snapshot.rawPropertyScope,
      product: {
        ...oilReviewRecord(snapshot.rawPropertyScope.product),
        image_url: null,
        purchase_link_checked_at: "2000-01-01T00:00:00Z",
        price_checked_at: "2000-01-01T00:00:00Z",
      },
      field_rationales: {
        ...oilReviewRecord(snapshot.rawPropertyScope.field_rationales),
        "product.image_url": "Separately reviewed image; excluded from oil property scope.",
      },
      review: { manual_reviewed: true },
    },
  })
  if (
    !normalized.ok ||
    oilReviewFingerprint(extractOilPropertyScope(normalized.normalizedPayload.final)) !==
      oilReviewFingerprint(snapshot.normalizedFinal) ||
    oilReviewFingerprint(normalized.targetSpecOperations) !==
      oilReviewFingerprint(snapshot.specOperations)
  )
    throw new Error("Oil Lab normalized property scope or operations mismatch")
  if (
    oilReviewFingerprint(value.matchingSuggestions) !==
    oilReviewFingerprint(matchingFromScope(snapshot.rawPropertyScope))
  )
    throw new Error("Oil Lab matching suggestions differ from intake snapshot")
  return structuredClone(value) as OilLabReviewPackage
}
export function readOilLabPackage(path: string): OilLabReviewPackage {
  return parseOilLabReviewPackage(JSON.parse(readFileSync(path, "utf8")))
}

export function buildOilLabReviewPackage(
  detail: ProductIntakeSubmissionDetail,
): OilLabReviewPackage {
  if (detail.category !== "oil" || detail.status !== "ready_for_review")
    throw new Error("Oil intake must be ready_for_review")
  const payload = oilReviewRecord(detail.payload)
  const binding = oilReviewRecord(oilReviewRecord(payload.draft).oil_research_binding)
  const artifact = detail.artifacts.find((row) => row.id === binding.artifact_id)
  if (
    !artifact ||
    artifact.kind !== "property_synthesis" ||
    artifact.submission_id !== detail.id ||
    artifact.job_id !== binding.job_id ||
    !detail.job ||
    detail.job.id !== binding.job_id ||
    detail.job.status !== "waiting_for_review"
  )
    throw new Error("Current oil artifact/job pointer is stale or missing")
  const admissionContext = oilReviewRecord(artifact.payload.oil_admission_context)
  const identityArtifact = detail.artifacts.find(
    (row) => row.id === admissionContext.resolved_identity_artifact_id,
  )
  if (!identityArtifact) throw new Error("Current resolved identity artifact is missing")
  const resolvedIdentityArtifact = {
    id: identityArtifact.id,
    submission_id: identityArtifact.submission_id,
    job_id: identityArtifact.job_id,
    kind: identityArtifact.kind,
    status: identityArtifact.status,
    payload: identityArtifact.payload,
  }
  const envelope = resolveOilStorage(artifact.payload, { requireFresh: true })
  if (
    envelope.submission_id !== detail.id ||
    binding.envelope_sha256 !== artifact.payload.oil_research_envelope_sha256 ||
    binding.raw_sha256 !== envelope.formula.raw_sha256 ||
    binding.normalized_sha256 !== envelope.formula.normalized_sha256 ||
    oilReviewFingerprint(binding.method) !== oilReviewFingerprint(envelope.research_method)
  )
    throw new Error("Oil intake binding differs from stored research")
  if (binding.admission_context_sha256 !== artifact.payload.oil_admission_context_sha256)
    throw new Error("Oil admission context binding mismatch")
  const admissionContextJson = artifact.payload.oil_admission_context_json
  try {
    assertAdmissionContextJson(
      admissionContext,
      admissionContextJson,
      String(artifact.payload.oil_admission_context_sha256),
    )
  } catch (error) {
    throw new Error(
      `Oil admission context storage bytes differ from current receipt: ${
        error instanceof Error ? error.message : "invalid receipt"
      }`,
    )
  }
  const draft = oilReviewRecord(payload.draft)
  const currentFormula = oilReviewRecord(draft.oil_authoritative_formula)
  if (oilReviewFingerprint(currentFormula) !== oilReviewFingerprint(admissionContext.formula))
    throw new Error("Oil current authoritative formula source differs from admission")
  assertCurrentCanonicalFormula(draft, admissionContext, envelope)
  const final = oilReviewRecord(payload.final)
  const projection = projectOilForProduction(envelope)
  if (
    projection.status !== "property_projection_ready" ||
    oilReviewFingerprint(oilReviewRecord(final.category_specs).product_oil_specs) !==
      oilReviewFingerprint(projection.category_specs.product_oil_specs)
  )
    throw new Error("Oil projected properties differ from current research")
  // Validate draft shape without persisting or asserting a human approval.
  const validation = validateProductIntakeApprovalPayload({
    final: { ...final, review: { manual_reviewed: true } },
  })
  if (!validation.ok)
    throw new Error(`Oil draft is incomplete: ${validation.missingFields.join(", ")}`)
  const current = envelope.version === "oil-research-envelope-v2"
  const snapshot: OilIntakeReviewSnapshot = {
    version: current ? "oil-intake-review-v2" : "oil-intake-review-v1",
    submissionId: detail.id,
    jobId: artifact.job_id!,
    artifactId: artifact.id,
    admissionContextSha256: String(artifact.payload.oil_admission_context_sha256),
    resolvedIdentityArtifactId: identityArtifact.id,
    envelopeSha256: String(artifact.payload.oil_research_envelope_sha256),
    method: structuredClone(envelope.research_method),
    rawSha256: envelope.formula.raw_sha256,
    normalizedSha256: envelope.formula.normalized_sha256,
    rawPropertyScope: extractOilPropertyScope(final),
    normalizedFinal: extractOilPropertyScope(validation.normalizedPayload.final),
    specOperations: structuredClone(validation.targetSpecOperations),
  }
  assertOilReviewSnapshot(snapshot)
  const body = {
    version: current
      ? ("oil-lab-review-bundle-v2" as const)
      : ("oil-lab-review-bundle-v1" as const),
    admissionContext,
    admissionContextJson,
    resolvedIdentityArtifact,
    envelopeJson: String(artifact.payload.oil_research_envelope_json),
    matchingSuggestions: matchingFromScope(snapshot.rawPropertyScope),
    snapshotFingerprint: intakeSnapshotFingerprint(snapshot),
    intakeReviewSnapshot: snapshot,
  }
  return parseOilLabReviewPackage({ ...body, packageFingerprint: packageFingerprint(body) })
}
