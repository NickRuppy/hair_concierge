import {
  assembleFreshOilResearchEnvelope,
  type CurrentFreshOilResearchDraft,
  type OilResearchEnvelope,
  OilResearchInputSchema,
  sha256Utf8,
} from "@/lib/oil-research/contracts"
import { OIL_INTAKE_METHOD } from "@/lib/oil-research/registry"
import { projectOilForProduction } from "@/lib/oil-research/production-adapter"
import { createOilStorage, type OilStorage } from "@/lib/oil-research/storage"
import { oilReviewFingerprint, stableOilReviewJson } from "@chaarlie/product-intake-core"

type MutableRecord = Record<string, unknown>

type OilResearchArtifact = {
  kind: string
  payload: MutableRecord
}

export type OilResolvedIdentityContext = Pick<
  OilResearchEnvelope["identity"],
  "brand" | "product" | "market" | "variant" | "package" | "identifier" | "source_ids"
>

export type OilAuthoritativeFormulaContext = Pick<
  OilResearchEnvelope["formula"],
  "raw_inci" | "ingredients" | "source_ids" | "declaration_status" | "conflicts"
>

export type OilWorkerAdmissionContext = {
  submissionId: string
  jobId: string
  runId: string
  identity: OilResolvedIdentityContext
  formula: OilAuthoritativeFormulaContext
  /** Identity Stage's current resolved artifact, retained as a server receipt. */
  resolvedIdentityArtifact: MutableRecord
  resolvedIdentityArtifactId: string
  identityBlocker: string | null
}

export type OilAdmission = {
  submission_id: string
  job_id: string
  run_id: string
  storage: OilStorage
  input_sha256: string
  projection_sha256: string
  admission_context_sha256: string
  raw_sha256: string
  normalized_sha256: string
  method: OilResearchEnvelope["research_method"]
}

export const OIL_RESEARCH_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const OIL_PENDING_IDENTITY_ARTIFACT_ID = "pending-current-identity"
const ADAPTER_OWNED_RATIONALE_ROOT = "category_specs.product_oil_specs"

function ensureMutableRecord(parent: MutableRecord, key: string): MutableRecord {
  const value = parent[key]
  if (value && typeof value === "object" && !Array.isArray(value)) return value as MutableRecord
  const created: MutableRecord = {}
  parent[key] = created
  return created
}

function isOwnedRationale(key: string): boolean {
  return (
    key === ADAPTER_OWNED_RATIONALE_ROOT ||
    key.startsWith(`${ADAPTER_OWNED_RATIONALE_ROOT}.`) ||
    key.startsWith(`${ADAPTER_OWNED_RATIONALE_ROOT}[`)
  )
}

function adapterResult(
  blocker: string,
  warnings: string[] = [],
): { blockers: string[]; warnings: string[] } {
  return { blockers: [`oil research adapter: ${blocker}`], warnings }
}

function equal(left: unknown, right: unknown): boolean {
  // Context receipts and JSONB mirrors may reorder object keys. Arrays remain
  // ordered under the shared review fingerprint, preserving INCI rank checks.
  return oilReviewFingerprint(left) === oilReviewFingerprint(right)
}

function finalProductIdentity(final: MutableRecord): MutableRecord {
  const product = final.product
  if (!product || typeof product !== "object" || Array.isArray(product))
    throw new Error("final product identity is required for oil admission")
  const value = product as MutableRecord
  const requiredText = ["canonical_brand", "clean_name"] as const
  for (const key of requiredText)
    if (typeof value[key] !== "string" || !value[key].trim())
      throw new Error(`final product identity ${key} is required for oil admission`)
  if (typeof value.net_content_value !== "number" || value.net_content_value <= 0)
    throw new Error("final product identity net_content_value is required for oil admission")
  if (typeof value.net_content_unit !== "string" || !value.net_content_unit.trim())
    throw new Error("final product identity net_content_unit is required for oil admission")
  return {
    canonical_brand: value.canonical_brand,
    product_line: typeof value.product_line === "string" ? value.product_line : null,
    clean_name: value.clean_name,
    net_content_value: value.net_content_value,
    net_content_unit: value.net_content_unit,
  }
}

function identityName(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim()
}

function withoutResolvedPrefixes(value: string, brand: string, line: string | null): string {
  let name = identityName(value)
  for (const prefix of [brand, line]) {
    if (!prefix) continue
    const normalized = identityName(prefix)
    if (name.startsWith(normalized) && /^[\s:–—-]/.test(name.slice(normalized.length)))
      name = name.slice(normalized.length).replace(/^[\s:–—-]+/, "")
  }
  return name
}

type MetricQuantity = { unit: "ml" | "g"; numerator: bigint; denominator: bigint }
function metricQuantity(text: string): MetricQuantity | null {
  const match = /^(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg)$/i.exec(text.trim())
  if (!match) return null
  const [whole, fraction = ""] = match[1]!.replace(",", ".").split(".")
  const unit = match[2]!.toLowerCase()
  const numerator = BigInt(`${whole}${fraction}`) * BigInt(unit === "l" || unit === "kg" ? 1000 : 1)
  if (numerator <= BigInt(0)) return null
  return {
    unit: unit === "l" || unit === "ml" ? "ml" : "g",
    numerator,
    denominator: BigInt(10) ** BigInt(fraction.length),
  }
}

/** Only exact source names and unambiguous package declarations cross into final identity. */
export function assertOilFinalProductIdentity(
  final: MutableRecord,
  identity: OilResolvedIdentityContext,
): void {
  const brand = final.canonical_brand as string
  const line = final.product_line as string | null
  const sourceName = withoutResolvedPrefixes(identity.product, brand, line)
  const finalName = withoutResolvedPrefixes(final.clean_name as string, brand, line)
  if (!sourceName || sourceName !== finalName)
    throw new Error(
      "final product name differs from source identity; a trusted source mapping is required",
    )

  const pack = identity.package
  const declared =
    pack.size_ml != null ? `${pack.size_ml} ml` : (pack.size_text ?? pack.combined_declaration)
  const sourcePackage = declared ? metricQuantity(declared) : null
  const finalPackage = metricQuantity(`${final.net_content_value} ${final.net_content_unit}`)
  if (!sourcePackage || !finalPackage)
    throw new Error(
      "final product package differs or source package is ambiguous; a resolved metric source declaration is required",
    )
  // Decimal cross multiplication avoids rounding an ounce conversion or a
  // nearby package into a match. Only exact metric unit conversion is admitted.
  if (
    sourcePackage.unit !== finalPackage.unit ||
    sourcePackage.numerator * finalPackage.denominator !==
      finalPackage.numerator * sourcePackage.denominator
  )
    throw new Error("final product package differs from source identity")
}

function workerFailure(blocker: string): { blockers: string[]; warnings: string[] } {
  return adapterResult(blocker)
}

/**
 * Shared admission boundary for the worker and Lab handoff. It deliberately
 * compares the resolved identity as a structured record: final.clean_name is
 * not a substitute for the researched product label.
 */
export function assertOilResearchIdentityContext(
  envelope: OilResearchEnvelope,
  context: OilWorkerAdmissionContext,
): void {
  if (context.identityBlocker) throw new Error(`identity is unresolved: ${context.identityBlocker}`)
  if (
    context.resolvedIdentityArtifact.stage !== "identity" ||
    context.resolvedIdentityArtifact.brand_resolution == null
  )
    throw new Error("resolved identity artifact is required")
  const expected = context.identity
  const actual = envelope.identity
  for (const key of ["brand", "product", "market", "variant", "identifier"] as const) {
    if (actual[key] !== expected[key])
      throw new Error(`identity ${key} differs from resolved context`)
  }
  if (!equal(actual.package, expected.package))
    throw new Error("identity package differs from resolved context")
  if (!equal(actual.source_ids, expected.source_ids))
    throw new Error("identity source_ids differ from resolved context")
  if (envelope.formula.raw_inci !== context.formula.raw_inci)
    throw new Error("formula raw_inci differs from authoritative intake formula")
  if (!equal(envelope.formula.ingredients, context.formula.ingredients))
    throw new Error("formula ranks differ from authoritative intake formula")
  for (const key of ["source_ids", "declaration_status", "conflicts"] as const) {
    if (!equal(envelope.formula[key], context.formula[key]))
      throw new Error(`formula ${key} differs from authoritative intake formula`)
  }
}

/**
 * Current-worker-only admission. Unlike the historical helper below, this
 * consumes a draft, derives its receipts server-side, and binds it to the
 * exact job/run/identity/formula context before touching final fields.
 */
export function applyOilResearchAdapterForWorker(input: {
  final: MutableRecord
  artifacts: OilResearchArtifact[]
  expectedResearchId: string
  context: OilWorkerAdmissionContext
}): { blockers: string[]; warnings: string[]; oilAdmission?: OilAdmission } {
  if (
    !OIL_RESEARCH_UUID_PATTERN.test(input.expectedResearchId) ||
    input.expectedResearchId !== input.context.submissionId
  )
    return workerFailure("submission context must match a UUID Product Intake submission")
  if (
    !OIL_RESEARCH_UUID_PATTERN.test(input.context.jobId) ||
    !OIL_RESEARCH_UUID_PATTERN.test(input.context.runId) ||
    (input.context.resolvedIdentityArtifactId !== OIL_PENDING_IDENTITY_ARTIFACT_ID &&
      !OIL_RESEARCH_UUID_PATTERN.test(input.context.resolvedIdentityArtifactId))
  )
    return workerFailure("current job and run UUIDs and a resolved identity reference are required")
  const candidates = input.artifacts.filter(
    (artifact) =>
      artifact.kind === "property_synthesis" && artifact.payload.oil_research_draft != null,
  )
  if (candidates.length !== 1)
    return workerFailure("exactly one property_synthesis.oil_research_draft is required")
  try {
    const draft = candidates[0]!.payload.oil_research_draft as CurrentFreshOilResearchDraft
    if (draft.version !== "oil-research-envelope-v2")
      throw new Error(
        "fresh worker admission requires the current v0.10 oil-research-envelope-v2 draft",
      )
    const envelope = assembleFreshOilResearchEnvelope({
      ...draft,
      submission_id: input.expectedResearchId,
    })
    assertOilResearchIdentityContext(envelope, input.context)
    const finalIdentity = finalProductIdentity(input.final)
    const brandResolution = input.context.resolvedIdentityArtifact.brand_resolution as MutableRecord
    if (
      finalIdentity.canonical_brand !== input.context.identity.brand ||
      brandResolution.canonical_brand !== finalIdentity.canonical_brand ||
      (brandResolution.product_line ?? null) !== finalIdentity.product_line
    )
      throw new Error("final product identity differs from resolved brand context")
    assertOilFinalProductIdentity(finalIdentity, input.context.identity)
    const storage = createOilStorage(envelope)
    const outcome = projectOilForProduction(envelope)
    if (outcome.status !== "property_projection_ready")
      return {
        blockers: outcome.issues.map((issue) => `oil research adapter: ${issue}`),
        warnings: outcome.warnings,
      }
    const admissionContext = {
      submission_id: input.context.submissionId,
      job_id: input.context.jobId,
      run_id: input.context.runId,
      resolved_identity_artifact_id: input.context.resolvedIdentityArtifactId,
      resolved_identity_artifact: structuredClone(input.context.resolvedIdentityArtifact),
      identity: structuredClone(input.context.identity),
      formula: structuredClone(input.context.formula),
      final_product_identity: finalIdentity,
    }
    const admissionContextJson = stableOilReviewJson(admissionContext)
    const admissionContextSha256 = sha256Utf8(admissionContextJson)
    const categorySpecs = ensureMutableRecord(input.final, "category_specs")
    const fieldRationales = ensureMutableRecord(input.final, "field_rationales")
    categorySpecs.product_oil_specs = structuredClone(outcome.category_specs.product_oil_specs)
    for (const key of Object.keys(fieldRationales))
      if (isOwnedRationale(key)) delete fieldRationales[key]
    Object.assign(fieldRationales, structuredClone(outcome.field_rationales))
    const artifact = candidates[0]!
    // Storage fields stay at the artifact root so the Lab and future JSONB
    // readers consume the same wrapper without a worker-only nesting rule.
    Object.assign(artifact.payload, storage as unknown as MutableRecord)
    artifact.payload.oil_research_envelope = structuredClone(envelope) as unknown as MutableRecord
    artifact.payload.oil_admission_context = admissionContext as unknown as MutableRecord
    // Persist exact bytes alongside the readable JSONB mirror. SQL verifies
    // this string's UTF-8 digest without reproducing JavaScript serialization.
    artifact.payload.oil_admission_context_json = admissionContextJson
    artifact.payload.oil_admission_context_sha256 = admissionContextSha256
    artifact.payload.oil_production_projection = structuredClone(outcome.category_specs)
    artifact.payload.oil_projection_sha256 = sha256Utf8(JSON.stringify(outcome.category_specs))
    const admission: OilAdmission = {
      submission_id: input.context.submissionId,
      job_id: input.context.jobId,
      run_id: input.context.runId,
      storage,
      raw_sha256: envelope.formula.raw_sha256,
      normalized_sha256: envelope.formula.normalized_sha256,
      method: envelope.research_method,
      input_sha256: storage.oil_research_envelope_sha256,
      projection_sha256: artifact.payload.oil_projection_sha256 as string,
      admission_context_sha256: admissionContextSha256,
    }
    return { blockers: [], warnings: outcome.warnings, oilAdmission: admission }
  } catch (error) {
    return workerFailure(
      error instanceof Error ? error.message : "invalid current oil research draft",
    )
  }
}

/**
 * Applies only the three current-schema oil properties after the full research
 * envelope has passed the same strict schema as the offline projector. This is
 * version-bound to the current intake engine. Historical envelopes remain readable offline.
 */
export function applyOilResearchAdapter(input: {
  final: MutableRecord
  artifacts: OilResearchArtifact[]
  expectedResearchId: string
}): { blockers: string[]; warnings: string[] } {
  if (!OIL_RESEARCH_UUID_PATTERN.test(input.expectedResearchId)) {
    return adapterResult("expectedResearchId must be a UUID")
  }

  const matchingArtifacts = input.artifacts.filter(
    (artifact) =>
      artifact.kind === "property_synthesis" &&
      Object.prototype.hasOwnProperty.call(artifact.payload, "oil_research_envelope"),
  )
  if (matchingArtifacts.length !== 1) {
    return adapterResult("exactly one property_synthesis.oil_research_envelope is required")
  }
  const artifact = matchingArtifacts[0]!
  const envelope = artifact.payload.oil_research_envelope
  const parsed = OilResearchInputSchema.safeParse(envelope)
  if (!parsed.success || parsed.data.version === "oil-scope-exclusion-v1") {
    return adapterResult("invalid admitted oil research envelope")
  }
  if (
    parsed.data.version !== "oil-research-envelope-v2" ||
    parsed.data.research_method.purpose !== "intake_research" ||
    parsed.data.provenance.import_kind !== "current" ||
    !equal(parsed.data.research_method, OIL_INTAKE_METHOD)
  ) {
    return adapterResult("only the exact v0.10 current-intake research method is admissible")
  }
  if (parsed.data.submission_id !== input.expectedResearchId) {
    return adapterResult(
      `submission_id must match Product Intake submission ${input.expectedResearchId}`,
    )
  }

  const outcome = projectOilForProduction(parsed.data)
  if (outcome.status !== "property_projection_ready") {
    return {
      blockers: outcome.issues.map((issue) => `oil research adapter: ${issue}`),
      warnings: [...outcome.warnings],
    }
  }

  // Every rejection above occurs before either input is changed.
  const categorySpecs = ensureMutableRecord(input.final, "category_specs")
  const fieldRationales = ensureMutableRecord(input.final, "field_rationales")
  categorySpecs.product_oil_specs = structuredClone(outcome.category_specs.product_oil_specs)
  for (const key of Object.keys(fieldRationales)) {
    if (isOwnedRationale(key)) delete fieldRationales[key]
  }
  Object.assign(fieldRationales, structuredClone(outcome.field_rationales))

  // The exact submitted envelope remains the durable source record. Adjacent
  // projection data cannot substitute for its formula, contexts or evidence.
  artifact.payload.oil_production_projection = structuredClone(outcome.category_specs)
  artifact.payload.oil_retained_only_coverage = structuredClone(outcome.retained_only_fields)
  artifact.payload.adapter_warnings = [...outcome.warnings]
  artifact.payload.required_protocol_roles = structuredClone(outcome.required_protocol_roles)
  artifact.payload.manual_review_required = structuredClone(outcome.manual_review_required)

  return { blockers: [], warnings: [...outcome.warnings] }
}
