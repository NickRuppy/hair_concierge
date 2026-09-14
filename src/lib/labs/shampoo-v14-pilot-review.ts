import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import {
  SHAMPOO_PRODUCTION_LIGHT_VERSION,
  type ShampooProductionLightReady,
} from "@/lib/shampoo/production-light-adapter"
import {
  collectShampooFocusV15EvidenceRefIds,
  ShampooFocusV15OverlaySchema,
  validateShampooFocusV15Overlay,
  type ShampooFocusV15Overlay,
} from "@/lib/shampoo/focus-v15"

export { SHAMPOO_V15_FOCUS_VALUES } from "@/lib/shampoo/focus-v15"

export const SHAMPOO_V14_PILOT_PROPERTY_KEYS = [
  "cleansingStrength",
  "conditioningLevel",
  "weightPotential",
  "focusPrimary",
  "focusSecondary",
  "usageRole",
  "scalpComfortTarget",
  "dandruffSupport",
] as const
export type ShampooV14PilotPropertyKey = (typeof SHAMPOO_V14_PILOT_PROPERTY_KEYS)[number]
export type ShampooV14ReviewAction =
  | "approve_formula"
  | "approve_property"
  | "approve_projection"
  | "request_rework"
  | "approve_product"

const PILOT_ROOT = join(
  /* turbopackIgnore: true */ process.cwd(),
  "plans/scan-db-expansion/research/shampoo-v14/pilot",
)
const REVIEW_DATASET_ROOTS = {
  pilot: PILOT_ROOT,
  "wave-01": join(/* turbopackIgnore: true */ PILOT_ROOT, "waves/wave-01"),
  "wave-02": join(/* turbopackIgnore: true */ PILOT_ROOT, "waves/wave-02"),
} as const
export type ShampooV14ReviewDatasetId = keyof typeof REVIEW_DATASET_ROOTS
const manifestVersion = "shampoo-v14-pilot-manifest-v1"
const propertySet = new Set<string>(SHAMPOO_V14_PILOT_PROPERTY_KEYS)
type Json = Record<string, unknown>
type ScopeStatus = "pending" | "approved" | "rework_requested"

type SourcePacket = {
  version: string
  status: string
  product_id: string
  identity: Json & {
    current_sources: unknown[]
    explicit_conflicts: unknown[]
  }
  formula: {
    status: string
    normalized_ordered_inci: string[]
    normalized_inci_string: string
    sha256_normalized_inci: string
    canonical_source: unknown
    version_or_reformulation_conflicts: unknown[]
  }
  post_unblind_evidence?: {
    claims_and_positioning?: unknown[]
    directions?: unknown[]
    warnings?: unknown[]
  }
  open_questions?: unknown[]
}

type ComparisonProperty = {
  laneAValue: unknown
  laneAConfidence: string
  laneBValue: unknown
  laneBConfidence: string
  exactAgreement: boolean
}

type Comparison = {
  version: string
  productId: string
  laneAProductId: string
  laneBProductId: string
  propertyComparison: Partial<Record<ShampooV14PilotPropertyKey, ComparisonProperty>>
}

type FinalProperty = {
  value: unknown
  confidence: string
  rationale: string
  formulaFacts: unknown[]
  counterSignal: string
  neighboringAlternative: unknown
  evidenceRefs: unknown[]
}

type AdjudicationDecision = {
  laneAValue: unknown
  laneBValue: unknown
  finalValue: unknown
  outcome: string
  rationale: string
}

type Adjudication = {
  version: string
  productId: string
  finalProperties: Partial<Record<ShampooV14PilotPropertyKey, FinalProperty>>
  decisions: Partial<Record<ShampooV14PilotPropertyKey, AdjudicationDecision>>
}

type AdapterInput = {
  version: string
  identity?: { productId?: string }
  formula?: { inciFingerprintSha256?: string }
}

type DeterminismReceipt = {
  version: string
  productId: string
  byteIdentical: boolean
  run1InputSha256: string
  run2InputSha256: string
  outputSha256: string
  summarySha256: string
}

export class ShampooV14PilotReviewError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 500,
    message: string,
  ) {
    super(message)
  }
}

export type ShampooV14PilotReviewItem = {
  id: string
  integrity: {
    status: "ready" | "blocked"
    hash: string
    diagnostic?: string
    previousReviewHash?: string
  }
  formula: {
    canonicalInci: string
    fingerprint: string
    status: string
    canonicalSource: unknown
    sources: unknown[]
    conflicts: unknown[]
    identity: Json
    claims: unknown[]
    directions: unknown[]
    warnings: unknown[]
    openQuestions: unknown[]
  } | null
  properties: Array<{
    key: ShampooV14PilotPropertyKey
    value: unknown
    confidence: string
    rationale: string
    formulaFacts: unknown[]
    counterSignal: string
    neighboringAlternative: unknown
    evidenceRefs: unknown[]
    laneA: { value: unknown; confidence: string }
    laneB: { value: unknown; confidence: string }
    exactAgreement: boolean
    adjudication: { outcome: string; rationale: string }
    historicalAdjudication?: { outcome: string; rationale: string }
  }>
  focusPolicy: {
    version: ShampooFocusV15Overlay["version"]
    priorV14: ShampooFocusV15Overlay["priorV14"]
    effective: ShampooFocusV15Overlay["effectiveV15"]
    careDirection: ShampooFocusV15Overlay["careDirection"]
    claimRole: ShampooFocusV15Overlay["claimRole"]
    decisionTrace: string
  } | null
  projection: {
    status: "property_lane_ready"
    outcome: ShampooProductionLightReady
    rows: unknown[]
    suitableThicknesses: unknown[]
    conditionalThicknesses: unknown[]
    requiredProtocolRoles: unknown[]
    warnings: unknown[]
    fieldRationales: Json
  } | null
  review: ReviewSnapshot
}

export type ReviewSnapshot = {
  formula: { status: ScopeStatus; comment?: string }
  properties: Record<ShampooV14PilotPropertyKey, { status: ScopeStatus; comment?: string }>
  projection: { status: ScopeStatus; comment?: string }
  product: { status: "pending" | "approved" }
  history: Array<{ action: ShampooV14ReviewAction; scope: string; comment?: string; at: string }>
  archived: Array<{
    hash: string
    archivedAt: string
    history: Array<{ action: ShampooV14ReviewAction; scope: string; comment?: string; at: string }>
  }>
}
type State = {
  version: "shampoo-v14-pilot-review-state-v1"
  products: Record<string, { hash: string; review: ReviewSnapshot }>
}
export type ReviewOptions = {
  pilotRoot?: string
  reviewStatePath?: string
  requireAllReady?: boolean
}

export function resolveShampooV14ReviewDataset(requestedId?: string | null): {
  id: ShampooV14ReviewDatasetId
  options: Required<ReviewOptions>
} {
  const id = requestedId?.trim() || "pilot"
  if (!Object.prototype.hasOwnProperty.call(REVIEW_DATASET_ROOTS, id)) {
    throw new ShampooV14PilotReviewError(404, "Unbekannter Shampoo-Research-Datensatz")
  }
  const datasetId = id as ShampooV14ReviewDatasetId
  const pilotRoot = REVIEW_DATASET_ROOTS[datasetId]
  return {
    id: datasetId,
    options: {
      pilotRoot,
      reviewStatePath: join(pilotRoot, "review-state.json"),
      requireAllReady: datasetId !== "pilot",
    },
  }
}

function sha(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex")
}
function readJson<T = Json>(path: string): T {
  try {
    return JSON.parse(readFileSync(/* turbopackIgnore: true */ path, "utf8")) as T
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : "invalid JSON"}`)
  }
}
function requireValue(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
function paths(root: string, segment: string) {
  const base = join(/* turbopackIgnore: true */ root, segment)
  return [
    "source-packet.json",
    "comparison.json",
    "adjudication.json",
    "adapter-input.json",
    "adapter-artifacts-run-1/production-light.json",
    "adapter-artifacts-run-2/production-light.json",
    "adapter-artifacts-run-1/production-light-summary.md",
    "adapter-artifacts-run-2/production-light-summary.md",
    "adapter-determinism-receipt.json",
    // Append-only: the nine entries above are position-sensitive receipt inputs.
    "focus-v15.json",
  ].map((file) => join(/* turbopackIgnore: true */ base, file))
}
function blankReview(): ReviewSnapshot {
  return {
    formula: { status: "pending" },
    properties: Object.fromEntries(
      SHAMPOO_V14_PILOT_PROPERTY_KEYS.map((key) => [key, { status: "pending" }]),
    ) as ReviewSnapshot["properties"],
    projection: { status: "pending" },
    product: { status: "pending" },
    history: [],
    archived: [],
  }
}
function statePath(options: ReviewOptions) {
  return (
    options.reviewStatePath ??
    join(/* turbopackIgnore: true */ options.pilotRoot ?? PILOT_ROOT, "review-state.json")
  )
}
function readState(path: string): State {
  if (!existsSync(path)) return { version: "shampoo-v14-pilot-review-state-v1", products: {} }
  const value = readJson(path)
  if (
    value.version !== "shampoo-v14-pilot-review-state-v1" ||
    !value.products ||
    typeof value.products !== "object"
  )
    throw new ShampooV14PilotReviewError(500, "Ungültiger lokaler Review-Status")
  return value as State
}
function atomicWrite(path: string, value: State) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  renameSync(temporary, path)
}
function isCurrentApproved(review: ReviewSnapshot) {
  return (
    review.formula.status === "approved" &&
    review.projection.status === "approved" &&
    SHAMPOO_V14_PILOT_PROPERTY_KEYS.every((key) => review.properties[key].status === "approved")
  )
}
function normalizeProductStatus(review: ReviewSnapshot) {
  if (!isCurrentApproved(review)) review.product = { status: "pending" }
}
function currentReview(state: State, id: string, hash: string) {
  const prior = state.products[id]
  if (!prior || prior.hash !== hash) return blankReview()
  return prior.review
}

function validateItem(
  root: string,
  id: string,
  segment: string,
  options: ReviewOptions,
): ShampooV14PilotReviewItem {
  requireValue(
    /^[a-z0-9][a-z0-9-]*$/.test(segment),
    "pilot manifest contains an unsafe product path",
  )
  const artifactPaths = paths(root, segment)
  const files = artifactPaths.map((path) => ({
    path,
    bytes: readFileSync(/* turbopackIgnore: true */ path),
    json: path.endsWith(".json") ? readJson(path) : undefined,
  }))
  const [
    sourceFile,
    comparisonFile,
    adjudicationFile,
    inputFile,
    run1File,
    run2File,
    summary1File,
    summary2File,
    receiptFile,
    focusV15File,
  ] = files
  const source = sourceFile.json as SourcePacket
  const comparison = comparisonFile.json as Comparison
  const adjudication = adjudicationFile.json as Adjudication
  const input = inputFile.json as AdapterInput
  const production = run1File.json as unknown as ShampooProductionLightReady
  const receipt = receiptFile.json as DeterminismReceipt
  requireValue(
    source.version === "shampoo-v14-source-packet-v1" && source.status === "formula_packet_ready",
    "source packet is not formula-packet-ready",
  )
  requireValue(comparison.version === "shampoo-v14-comparison-v1", "comparison version is invalid")
  requireValue(
    adjudication.version === "shampoo-v14-adjudication-v1",
    "adjudication version is invalid",
  )
  requireValue(
    input.version === SHAMPOO_PRODUCTION_LIGHT_VERSION,
    "adapter input version is invalid",
  )
  requireValue(
    production.version === SHAMPOO_PRODUCTION_LIGHT_VERSION &&
      production.status === "property_lane_ready",
    "Production Light is not property_lane_ready",
  )
  requireValue(
    receipt.version === "shampoo-v14-adapter-determinism-receipt-v1" &&
      receipt.byteIdentical === true,
    "adapter determinism receipt is invalid",
  )
  for (const productId of [
    source.product_id,
    comparison.productId,
    comparison.laneAProductId,
    comparison.laneBProductId,
    adjudication.productId,
    input.identity?.productId,
    production.summary?.productId,
    receipt.productId,
  ])
    requireValue(productId === id, `product ID join failed: expected ${id}`)
  requireValue(
    typeof source.formula?.sha256_normalized_inci === "string" &&
      source.formula.sha256_normalized_inci === input.formula?.inciFingerprintSha256,
    "canonical formula fingerprint mismatch",
  )
  requireValue(
    source.formula.sha256_normalized_inci === sha(source.formula.normalized_inci_string),
    "source packet canonical formula hash mismatch",
  )
  requireValue(
    receipt.run1InputSha256 === sha(inputFile.bytes) &&
      receipt.run2InputSha256 === sha(inputFile.bytes),
    "determinism input receipt mismatch",
  )
  requireValue(
    receipt.outputSha256 === sha(run1File.bytes) && sha(run1File.bytes) === sha(run2File.bytes),
    "determinism output receipt mismatch",
  )
  requireValue(
    receipt.summarySha256 === sha(summary1File.bytes) &&
      sha(summary1File.bytes) === sha(summary2File.bytes),
    "determinism summary receipt mismatch",
  )
  const finalProperties = adjudication.finalProperties
  const decisions = adjudication.decisions
  const compared = comparison.propertyComparison
  for (const key of SHAMPOO_V14_PILOT_PROPERTY_KEYS) {
    requireValue(
      finalProperties?.[key] && decisions?.[key] && compared?.[key],
      `missing ${key} evidence`,
    )
    requireValue(
      JSON.stringify(finalProperties[key]!.value) === JSON.stringify(decisions[key]!.finalValue),
      `${key} final value mismatch`,
    )
    requireValue(
      JSON.stringify(compared[key]!.laneAValue) === JSON.stringify(decisions[key]!.laneAValue) &&
        JSON.stringify(compared[key]!.laneBValue) === JSON.stringify(decisions[key]!.laneBValue),
      `${key} lane value mismatch`,
    )
    requireValue(
      compared[key]!.exactAgreement ===
        (JSON.stringify(compared[key]!.laneAValue) === JSON.stringify(compared[key]!.laneBValue)),
      `${key} agreement mismatch`,
    )
    requireValue(
      production.payload?.field_rationales?.[`research.properties.${key}`]?.rationale ===
        finalProperties[key].rationale,
      `${key} Production Light rationale mismatch`,
    )
  }
  const focusValidation = validateShampooFocusV15Overlay(focusV15File.json, {
    productId: id,
    formulaFingerprintSha256: source.formula.sha256_normalized_inci,
    canonicalInci: source.formula.normalized_inci_string,
    canonicalOrderedInci: source.formula.normalized_ordered_inci,
    adjudicationBytes: adjudicationFile.bytes,
    priorV14: {
      primary: finalProperties.focusPrimary!.value,
      secondary: finalProperties.focusSecondary!.value,
    },
    evidenceRefIds: collectShampooFocusV15EvidenceRefIds(source, adjudication),
  })
  if (!focusValidation.ok) {
    throw new Error(`focus v1.5 overlay is invalid: ${focusValidation.errors.join("; ")}`)
  }
  const focusV15 = ShampooFocusV15OverlaySchema.parse(focusV15File.json)
  const effectiveFocus = focusV15.effectiveV15
  const hash = sha(Buffer.concat(files.map(({ bytes }) => bytes)))
  const state = readState(statePath(options))
  const review = currentReview(state, id, hash)
  const properties = SHAMPOO_V14_PILOT_PROPERTY_KEYS.map((key) => {
    const isPrimaryFocus = key === "focusPrimary"
    const isSecondaryFocus = key === "focusSecondary"
    const isFocus = isPrimaryFocus || isSecondaryFocus
    const v15Value = isPrimaryFocus ? effectiveFocus.primary : effectiveFocus.secondary
    const changed =
      JSON.stringify(isPrimaryFocus ? focusV15.priorV14.primary : focusV15.priorV14.secondary) !==
      JSON.stringify(v15Value)
    return {
      key,
      value: isFocus ? v15Value : finalProperties[key]!.value,
      confidence: isFocus ? effectiveFocus.confidence : finalProperties[key]!.confidence,
      rationale: isFocus ? effectiveFocus.rationale : finalProperties[key]!.rationale,
      formulaFacts: isFocus ? effectiveFocus.formulaFacts : finalProperties[key]!.formulaFacts,
      counterSignal: isFocus ? effectiveFocus.counterSignal : finalProperties[key]!.counterSignal,
      neighboringAlternative: isFocus
        ? isPrimaryFocus
          ? effectiveFocus.neighboringAlternative
          : []
        : finalProperties[key]!.neighboringAlternative,
      evidenceRefs: isFocus
        ? effectiveFocus.evidenceRefs
        : (finalProperties[key]!.evidenceRefs ?? []),
      laneA: { value: compared[key]!.laneAValue, confidence: compared[key]!.laneAConfidence },
      laneB: { value: compared[key]!.laneBValue, confidence: compared[key]!.laneBConfidence },
      exactAgreement: compared[key]!.exactAgreement,
      adjudication: isFocus
        ? {
            outcome: changed ? "policy_update" : "policy_confirmed",
            rationale: focusV15.decisionTrace,
          }
        : { outcome: decisions[key]!.outcome, rationale: decisions[key]!.rationale },
      ...(isFocus
        ? {
            historicalAdjudication: {
              outcome: decisions[key]!.outcome,
              rationale: decisions[key]!.rationale,
            },
          }
        : {}),
    }
  })
  const previousReviewHash = state.products[id]?.hash
  return {
    id,
    integrity: {
      status: "ready",
      hash,
      ...(previousReviewHash && previousReviewHash !== hash ? { previousReviewHash } : {}),
    },
    formula: {
      canonicalInci: source.formula.normalized_inci_string,
      fingerprint: source.formula.sha256_normalized_inci,
      status: source.formula.status,
      canonicalSource: source.formula.canonical_source,
      sources: source.identity.current_sources,
      conflicts: [
        ...source.formula.version_or_reformulation_conflicts,
        ...source.identity.explicit_conflicts,
      ],
      identity: source.identity,
      claims: source.post_unblind_evidence?.claims_and_positioning ?? [],
      directions: source.post_unblind_evidence?.directions ?? [],
      warnings: source.post_unblind_evidence?.warnings ?? [],
      openQuestions: source.open_questions ?? [],
    },
    properties,
    focusPolicy: {
      version: focusV15.version,
      priorV14: focusV15.priorV14,
      effective: focusV15.effectiveV15,
      careDirection: focusV15.careDirection,
      claimRole: focusV15.claimRole,
      decisionTrace: focusV15.decisionTrace,
    },
    projection: {
      status: "property_lane_ready",
      outcome: production,
      rows: production.payload.category_specs.product_shampoo_specs,
      suitableThicknesses: production.payload.suitable_thicknesses,
      conditionalThicknesses: production.summary.conditionalThicknesses,
      requiredProtocolRoles: production.payload.required_protocol_roles,
      warnings: production.warnings,
      fieldRationales: production.payload.field_rationales,
    },
    review,
  }
}

export function loadShampooV14PilotReviewItems(
  options: ReviewOptions = {},
): ShampooV14PilotReviewItem[] {
  const root = options.pilotRoot ?? PILOT_ROOT
  const manifest = readJson(join(/* turbopackIgnore: true */ root, "pilot-manifest.json"))
  if (manifest.version !== manifestVersion || !Array.isArray(manifest.products))
    throw new ShampooV14PilotReviewError(500, "Ungültiges Pilot-Manifest")
  const items = manifest.products.map(({ id, path }: { id: string; path: string }) => {
    try {
      return validateItem(root, id, path, options)
    } catch (error) {
      return {
        id,
        integrity: {
          status: "blocked",
          hash: "",
          diagnostic: error instanceof Error ? error.message : "Unbekannter Artefaktfehler",
        },
        formula: null,
        properties: [],
        focusPolicy: null,
        projection: null,
        review: blankReview(),
      } as unknown as ShampooV14PilotReviewItem
    }
  })
  if (options.requireAllReady && items.some((item) => item.integrity.status !== "ready")) {
    throw new ShampooV14PilotReviewError(
      404,
      "Shampoo-Research-Datensatz ist noch nicht reviewbereit",
    )
  }
  return items
}

export type ShampooV14PilotReviewActionInput = {
  action: ShampooV14ReviewAction
  productId: string
  expectedHash: string
  property?: ShampooV14PilotPropertyKey
  scope?: "formula" | "projection" | ShampooV14PilotPropertyKey
  comment?: string
}
export function applyShampooV14PilotReviewAction(
  input: ShampooV14PilotReviewActionInput,
  options: ReviewOptions = {},
) {
  const item = loadShampooV14PilotReviewItems(options).find(({ id }) => id === input.productId)
  if (!item) throw new ShampooV14PilotReviewError(404, "Pilotprodukt nicht gefunden")
  if (item.integrity.status !== "ready")
    throw new ShampooV14PilotReviewError(
      409,
      item.integrity.diagnostic ?? "Pilotprodukt ist blockiert",
    )
  if (input.expectedHash !== item.integrity.hash)
    throw new ShampooV14PilotReviewError(409, "Review-Anfrage ist veraltet; bitte neu laden")
  if (input.action === "approve_property" && (!input.property || !propertySet.has(input.property)))
    throw new ShampooV14PilotReviewError(400, "Eine gültige Eigenschaft ist erforderlich")
  if (
    input.action === "request_rework" &&
    (!input.scope ||
      !input.comment?.trim() ||
      (input.scope !== "formula" && input.scope !== "projection" && !propertySet.has(input.scope)))
  )
    throw new ShampooV14PilotReviewError(400, "Rework benötigt Bereich und Kommentar")
  const path = statePath(options),
    state = readState(path),
    previous = state.products[item.id]
  const review = currentReview(state, item.id, item.integrity.hash)
  if (previous && previous.hash !== item.integrity.hash)
    review.archived.push(...previous.review.archived, {
      hash: previous.hash,
      archivedAt: new Date().toISOString(),
      history: previous.review.history,
    })
  const at = new Date().toISOString()
  const set = (
    scope: "formula" | "projection" | ShampooV14PilotPropertyKey,
    status: ScopeStatus,
    comment?: string,
  ) => {
    if (scope === "formula") review.formula = { status, ...(comment ? { comment } : {}) }
    else if (scope === "projection") review.projection = { status, ...(comment ? { comment } : {}) }
    else review.properties[scope] = { status, ...(comment ? { comment } : {}) }
    review.history.push({ action: input.action, scope, ...(comment ? { comment } : {}), at })
  }
  if (input.action === "approve_formula") set("formula", "approved")
  if (input.action === "approve_property") set(input.property!, "approved")
  if (input.action === "approve_projection") set("projection", "approved")
  if (input.action === "request_rework")
    set(input.scope!, "rework_requested", input.comment!.trim())
  if (input.action === "approve_product") {
    if (!isCurrentApproved(review))
      throw new ShampooV14PilotReviewError(
        409,
        "Formel, acht Eigenschaften und Projektion müssen zuerst freigegeben sein",
      )
    review.product = { status: "approved" }
    review.history.push({ action: input.action, scope: "product", at })
  }
  normalizeProductStatus(review)
  state.products[item.id] = { hash: item.integrity.hash, review }
  atomicWrite(path, state)
  return { item: { ...item, review }, review }
}
