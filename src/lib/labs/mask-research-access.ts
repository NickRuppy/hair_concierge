import "server-only"

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import path from "node:path"
import { z } from "zod"

import {
  maskReviewFingerprint,
  readMaskLabReviewState,
  saveMaskLabReviewState,
  withMaskReviewPersistenceRollback,
  type MaskLabProductReviewState,
  type MaskLabReviewDecision,
} from "@/lib/mask-research/review-state"

// Mask Research Lab data access. Modeled on
// src/lib/labs/leave-in-research-access.ts, but simplified: the leave-in lab
// reads one pre-built fixture file assembled by a build script. The mask
// pipeline has no such fixture yet (two classification lanes are still being
// generated), so this loader reads the frozen cohort plus one reference-key
// record per product directly, and tolerates a missing or malformed
// reference-key file by rendering that product as "Lauf ausstehend" instead
// of failing the whole page.

type Environment = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV">>

const ARTIFACT_DIRECTORY = join(process.cwd(), "data/research/mask-inci/v1.0")
const COHORT_FILE = "cohort.json"
const REFERENCE_KEY_DIR = "reference-key-v1"
const AGREEMENT_FILE = join("agreement", "agreement.json")

/* -------------------------------------------------------------------------
 * Cohort schema (data/research/mask-inci/v1.0/cohort.json) — frozen, so this
 * is close-fitting but not `.strict()`: unknown extra fields are tolerated
 * rather than rejected, since the cohort is hand-authored research output.
 * ---------------------------------------------------------------------- */

const cohortConflictSchema = z
  .object({
    type: z.string(),
    description: z.string(),
    resolution: z.string().optional(),
  })
  .passthrough()

const cohortIdentitySchema = z
  .object({
    brand: z.string(),
    productName: z.string(),
    packSize: z.string(),
    gtinEan: z.string().nullable().optional(),
    eanSourceNote: z.string().optional(),
    market: z.string(),
    gtinVerified: z.string().optional(),
  })
  .passthrough()

const cohortDirectionsSchema = z
  .object({
    text: z.string().nullable(),
    contactTimeFound: z.boolean().optional(),
    contactTimeMinutes: z.union([z.string(), z.number()]).nullable().optional(),
    source: z.string().nullable().optional(),
    confidence: z.string().nullable().optional(),
  })
  .passthrough()

const cohortFormulaSchema = z
  .object({
    rawInci: z.string(),
    source: z.unknown(),
    tier: z.string().nullable().optional(),
  })
  .passthrough()

const cohortProductSchema = z
  .object({
    id: z.string().trim().min(1),
    productNumber: z.union([z.number(), z.string()]),
    role: z.string(),
    archetypeSlots: z.array(z.string()).nullable(),
    identity: cohortIdentitySchema,
    status: z.string(),
    isReserve: z.boolean(),
    formulaOfRecord: cohortFormulaSchema,
    directions: cohortDirectionsSchema,
    claims: z.array(z.string()),
    conflicts: z.array(cohortConflictSchema),
    rawInciSha256: z.string(),
    verificationNote: z.string().optional(),
    reserveState: z.string().optional(),
  })
  .passthrough()

const cohortSchema = z
  .object({
    cohortId: z.string().trim().min(1),
    frozen: z.string().trim().min(1),
    standard: z.string().trim().min(1),
    charter: z.string(),
    approval: z.string(),
    openG0Question: z.string().optional(),
    products: z.array(cohortProductSchema).min(1),
  })
  .passthrough()

export type MaskCohort = z.infer<typeof cohortSchema>
export type MaskCohortProduct = z.infer<typeof cohortProductSchema>

/* -------------------------------------------------------------------------
 * Reference-key record schema
 * (data/research/mask-inci/v1.0/reference-key-v0/<productId>.json,
 * schema "mask-research-record-v0.1"). Tolerant on purpose: this is being
 * generated in parallel by two classification lanes, so a record that
 * doesn't parse is treated as not-yet-available, not as a hard error.
 * ---------------------------------------------------------------------- */

const evidenceListSchema = z.array(z.string()).default([])

const profileFieldSchema = z
  .object({
    // Single-value fields (e.g. conditioningLevel) carry a plain string;
    // multi-value fields (e.g. hairThicknessFit, textureFit, and an "empty
    // secondary" secondaryFocus) carry a string array instead.
    value: z.union([z.string(), z.array(z.string())]),
    confidence: z.string().nullable().optional(),
    evidenceLevel: z.string().nullable().optional(),
    evidenceScope: z.string().nullable().optional(),
    rationale: z.string().nullable().optional(),
    evidenceSignals: evidenceListSchema,
    derivation: z.string().nullable().optional(),
    thresholdReasoning: evidenceListSchema,
    counterSignals: evidenceListSchema,
    limitations: evidenceListSchema,
  })
  .passthrough()

function formatFieldValue(value: string | string[]): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(" · ") : "—"
  return value
}

function describeUnknown(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.map((entry) => describeUnknown(entry)).join(" · ")
  return JSON.stringify(value)
}

export const MASK_PROFILE_FIELD_KEYS = [
  "conditioningLevel",
  "weightPotential",
  "careDirection",
  "repairSupportLevel",
  "primaryFocus",
  "secondaryFocus",
  "hairThicknessFit",
  "damageFit",
  "textureFit",
] as const

export type MaskProfileFieldKey = (typeof MASK_PROFILE_FIELD_KEYS)[number]

export const MASK_PROFILE_FIELD_LABELS: Record<MaskProfileFieldKey, string> = {
  conditioningLevel: "Pflegelevel",
  weightPotential: "Gewichtspotenzial",
  careDirection: "Pflegerichtung",
  repairSupportLevel: "Reparatur-Unterstützung",
  primaryFocus: "Primärer Fokus",
  secondaryFocus: "Sekundärer Fokus",
  hairThicknessFit: "Passung Haardicke",
  damageFit: "Passung Schadenslevel",
  textureFit: "Passung Textur",
}

// The three derived profile fields (R9 "echo fields", T8 pattern) are not
// independently reviewable rows. Each is a deterministic projection of one
// or two "driving" fields and is shown as a compact annotation attached to
// its driver's row instead — see buildDerivedAnnotation below.
export const MASK_REVIEWABLE_PROFILE_FIELD_KEYS = [
  "conditioningLevel",
  "weightPotential",
  "careDirection",
  "repairSupportLevel",
  "primaryFocus",
  "secondaryFocus",
] as const

export const MASK_DERIVED_PROFILE_FIELD_KEYS = [
  "hairThicknessFit",
  "damageFit",
  "textureFit",
] as const

const DERIVED_FIELD_DRIVERS: Partial<Record<MaskProfileFieldKey, readonly MaskProfileFieldKey[]>> =
  {
    weightPotential: ["hairThicknessFit", "textureFit"],
    conditioningLevel: ["damageFit"],
  }

// damageFit is also driven by repairSupportLevel, but is only annotated once
// (under conditioningLevel) — the annotation label mentions both drivers.
const DERIVED_FIELD_ALSO_DRIVEN_BY: Partial<Record<MaskProfileFieldKey, MaskProfileFieldKey>> = {
  damageFit: "repairSupportLevel",
}

const profileSchema = z
  .object(
    Object.fromEntries(MASK_PROFILE_FIELD_KEYS.map((key) => [key, profileFieldSchema])) as Record<
      MaskProfileFieldKey,
      typeof profileFieldSchema
    >,
  )
  .passthrough()

const g0Schema = z
  .object({
    value: z.union([z.string(), z.boolean()]),
    modeScoped: z.boolean().nullable().optional(),
    multiUse: z
      .union([z.boolean(), z.record(z.string(), z.unknown())])
      .nullable()
      .optional(),
    rationale: z.string().nullable().optional(),
    evidenceSignals: evidenceListSchema,
  })
  .passthrough()

const tailMarkerSchema = z
  .object({
    ingredient: z.string().nullable().optional(),
    rank: z.number().int().positive().nullable().optional(),
    anomalyNote: z.string().nullable().optional(),
  })
  .passthrough()

const bondRouteSchema = z
  .object({
    value: z.string().nullable().optional(),
    token: z.string().nullable().optional(),
    rank: z.number().nullable().optional(),
  })
  .passthrough()

const projectedOutputsSchema = z
  .object({
    concentration: z.string().nullable().optional(),
    weight: z.string().nullable().optional(),
    balance_direction: z.string().nullable().optional(),
    repair_support_level: z.string().nullable().optional(),
    functional_benefits: z.array(z.string()).default([]),
    suitable_thicknesses: z.array(z.string()).default([]),
  })
  .passthrough()

const adjudicationPointSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string(),
    body: z.string(),
    source: z.string(),
  })
  .passthrough()

// focusCareVerdict is a small verdict-plus-note record, not a plain string.
const focusCareVerdictSchema = z
  .object({
    value: z.string(),
    claimRole: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .passthrough()

// Each entry documents one blind-vs-final delta (or confirms "unchanged")
// with free-form before/after values, not a plain sentence.
const blindToFinalChangeSchema = z
  .object({
    field: z.string(),
    blindValue: z.unknown().optional(),
    finalValue: z.unknown().optional(),
    reason: z.string().optional(),
  })
  .passthrough()

const referenceRecordSchema = z
  .object({
    schemaVersion: z.string(),
    g0: g0Schema,
    tailMarker: tailMarkerSchema.optional(),
    profile: profileSchema.optional(),
    bondRoute: bondRouteSchema.optional(),
    focusCareVerdict: z.union([z.string(), focusCareVerdictSchema]).nullable().optional(),
    overloadCounterSignal: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .nullable()
      .optional(),
    blindToFinalChanges: z.array(z.union([z.string(), blindToFinalChangeSchema])).default([]),
    projectedOutputs: projectedOutputsSchema.optional(),
    adjudicationPoints: z.array(adjudicationPointSchema).default([]),
    uncertainFields: z.array(z.string()).default([]),
    assumptionNotes: z.array(z.string()).default([]),
  })
  .passthrough()

export type MaskReferenceRecord = z.infer<typeof referenceRecordSchema>
export type MaskAdjudicationPoint = z.infer<typeof adjudicationPointSchema>

/* -------------------------------------------------------------------------
 * Optional agreement overlay
 * (data/research/mask-inci/v1.0/agreement/agreement.json) — may not exist.
 * ---------------------------------------------------------------------- */

const agreementCellSchema = z
  .object({
    productId: z.string(),
    field: z.string(),
    key: z.string().nullable().optional(),
    blind: z.string().nullable().optional(),
    match: z.boolean().nullable().optional(),
  })
  .passthrough()

const agreementSchema = z
  .object({
    cells: z.array(agreementCellSchema).default([]),
    metrics: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough()

export type MaskAgreement = z.infer<typeof agreementSchema>
// Normalized shape actually handed to the client (findAgreementCell below
// always fills key/blind/match with `null`, never `undefined`), kept
// separate from the lenient zod-inferred parse type used internally.
export type MaskAgreementCell = {
  productId: string
  field: string
  key: string | null
  blind: string | null
  match: boolean | null
}

/* -------------------------------------------------------------------------
 * Loading — cohort and agreement are cached process-wide (dev only, and the
 * files are small); reference-key records are read per product on demand so
 * a run that lands mid-request is picked up without a server restart.
 * ---------------------------------------------------------------------- */

function loadCohort(): MaskCohort {
  const raw = JSON.parse(readFileSync(join(ARTIFACT_DIRECTORY, COHORT_FILE), "utf8")) as unknown
  const cohort = cohortSchema.parse(raw)
  const ids = cohort.products.map((product) => product.id)
  if (new Set(ids).size !== ids.length)
    throw new Error("Mask cohort contains duplicate product IDs")
  return cohort
}

let cohortCache: MaskCohort | undefined

function getCohort(): MaskCohort {
  cohortCache ??= loadCohort()
  return cohortCache
}

function loadReferenceRecord(productId: string): MaskReferenceRecord | null {
  const filePath = join(ARTIFACT_DIRECTORY, REFERENCE_KEY_DIR, `${productId}.json`)
  if (!existsSync(filePath)) return null
  try {
    return referenceRecordSchema.parse(JSON.parse(readFileSync(filePath, "utf8")))
  } catch {
    // Malformed or half-written file while a lane is still generating it —
    // treat exactly like "not yet available" rather than failing the page.
    return null
  }
}

function loadAgreement(): MaskAgreement | null {
  const filePath = join(ARTIFACT_DIRECTORY, AGREEMENT_FILE)
  if (!existsSync(filePath)) return null
  try {
    return agreementSchema.parse(JSON.parse(readFileSync(filePath, "utf8")))
  } catch {
    return null
  }
}

function findAgreementCell(
  agreement: MaskAgreement | null,
  productId: string,
  field: string,
): MaskAgreementCell | null {
  if (!agreement) return null
  const cell = agreement.cells.find(
    (entry) => entry.productId === productId && entry.field === field,
  )
  if (!cell) return null
  return {
    productId: cell.productId,
    field: cell.field,
    key: cell.key ?? null,
    blind: cell.blind ?? null,
    match: cell.match ?? null,
  }
}

export function isMaskResearchLabEnabled(environment: Environment = process.env): boolean {
  return environment.NODE_ENV === "development"
}

function reviewStatePath(): string | null {
  const override = process.env.MASK_RESEARCH_LAB_REVIEW_STATE_PATH?.trim()
  if (override) return path.resolve(override)
  if (process.env.NODE_ENV !== "development") return null
  return join(ARTIFACT_DIRECTORY, "lab-review-state.json")
}

/* -------------------------------------------------------------------------
 * Domain types
 * ---------------------------------------------------------------------- */

export type MaskRunStatus = "pending" | "completed"
export type MaskReviewStatus = "needs_review" | "rework_open" | "approved" | "excluded"
export type MaskPropertyReviewStatus = "unreviewed" | "rework_open" | "approved"
export type MaskCategoryBoundaryStatus = "eligible" | "excluded_product_form" | "pending"

// A derived profile field's value shown as an annotation on its driving
// row, not as its own reviewable row (R9 "echo fields").
export type MaskDerivedAnnotation = {
  field: MaskProfileFieldKey
  label: string
  fieldLabel: string
  value: string
  note: string | null
  disagreement: MaskAgreementCell | null
}

export type MaskProperty = {
  path: string
  kind: "g0" | "profile"
  label: string
  value: string
  confidence: string | null
  evidenceLevel: string | null
  evidenceScope: string | null
  rationale: string | null
  evidenceSignals: string[]
  derivation: string | null
  thresholdReasoning: string[]
  counterSignals: string[]
  limitations: string[]
  modeScoped: boolean | null
  multiUse: boolean | null
  disagreement: MaskAgreementCell | null
  humanReviewStatus: MaskPropertyReviewStatus
  derivedAnnotations: MaskDerivedAnnotation[]
}

export type MaskClaimNote = string

export type MaskQueueItem = {
  productId: string
  slot: number | string
  productName: string
  brandName: string
  archetypeRole: string
  archetypeSlots: string[]
  market: string
  packSize: string
  gtin: string | null
  runStatus: MaskRunStatus
  g0Value: string | null
  statusLabel: string
  uncertainFields: string[]
  excluded: boolean
  categoryBoundaryStatus: MaskCategoryBoundaryStatus
  reviewStatus: MaskReviewStatus
  openProperties: number
  propertyCount: number
  openAdjudicationIds: string[]
  staleReview: boolean
  lastReviewDecision: MaskLabReviewDecision | null
}

export type MaskProductDetail = MaskQueueItem & {
  identity: {
    gtin: string | null
    market: string
    packSize: string
    rawInci: string
    normalizedIngredients: string[]
    tailMarkerRank: number | null
    tailMarkerIngredient: string | null
    tailMarkerAnomalyNote: string | null
    directionsText: string | null
    directionsContactTime: string | null
    directionsConfidence: string | null
    claims: MaskClaimNote[]
    conflicts: Array<{ type: string; description: string; resolution?: string }>
  }
  reviewRoutingNotes: string[]
  adjudicationPoints: MaskAdjudicationPoint[]
  assumptionNotes: string[]
  properties: MaskProperty[]
  propertyStatuses: Record<string, MaskPropertyReviewStatus>
  recordFingerprint: string
  standardVersion: string
  projectedOutputs: {
    concentration: string | null
    weight: string | null
    balanceDirection: string | null
    repairSupportLevel: string | null
    functionalBenefits: string[]
    suitableThicknesses: string[]
  } | null
  canApproveProduct: boolean
  canApproveBoundary: boolean
  reviewBlockers: string[]
}

export type MaskResearchLabData = {
  meta: {
    cohortId: string
    standardVersion: string
    frozen: string
    referenceKeyVersion: string
    charter: string
    approval: string
  }
  summary: {
    products: number
    pending: number
    excluded: number
    reviewCounts: {
      approved: number
      reworkOpen: number
      needsReview: number
      excluded: number
    }
  }
  openG0Question: string | null
  openAdjudications: MaskAdjudicationPoint[]
  queueItems: MaskQueueItem[]
  initialDetail: MaskProductDetail
}

export type MaskReviewInput =
  | { action: "approve_property"; itemId: string; propertyPath: string; comment?: string }
  | { action: "request_rework"; itemId: string; propertyPath: string; comment: string }
  | { action: "approve_product"; itemId: string; comment?: string }
  | { action: "approve_boundary"; itemId: string; comment?: string }

export type MaskReviewResult =
  | { status: "accepted"; item: MaskProductDetail; reviewDecision: MaskLabReviewDecision }
  | { status: "blocked"; item: MaskProductDetail; blockers: string[] }
  | { status: "not_found"; error: string }
  | { status: "persistence_failed"; error: string }

/* -------------------------------------------------------------------------
 * Building queue items / detail records
 * ---------------------------------------------------------------------- */

function statusLabelFor(
  reviewStatus: MaskReviewStatus,
  runStatus: MaskRunStatus,
  excluded: boolean,
  staleReview: boolean,
): string {
  if (runStatus === "pending") return "Lauf ausstehend"
  if (reviewStatus === "approved") return "freigegeben"
  if (reviewStatus === "rework_open") return "in Nacharbeit"
  if (reviewStatus === "excluded") return "G0 bestätigt"
  if (staleReview) return "erneut prüfen"
  return excluded ? "G0 (ungeprüft)" : "offen"
}

function buildDerivedAnnotation(
  derivedKey: MaskProfileFieldKey,
  profile: NonNullable<MaskReferenceRecord["profile"]>,
  agreement: MaskAgreement | null,
  productId: string,
): MaskDerivedAnnotation {
  const field = profile[derivedKey]
  const fieldLabel = MASK_PROFILE_FIELD_LABELS[derivedKey]
  const alsoDrivenBy = DERIVED_FIELD_ALSO_DRIVEN_BY[derivedKey]
  const label = alsoDrivenBy
    ? `${fieldLabel} (auch getrieben von ${MASK_PROFILE_FIELD_LABELS[alsoDrivenBy]})`
    : fieldLabel
  return {
    field: derivedKey,
    label,
    fieldLabel,
    value: formatFieldValue(field.value),
    note: field.derivation ?? field.rationale ?? null,
    disagreement: findAgreementCell(agreement, productId, derivedKey),
  }
}

function buildProperties(
  record: MaskReferenceRecord,
  agreement: MaskAgreement | null,
  productId: string,
  stored: MaskLabProductReviewState | undefined,
  staleReview: boolean,
): MaskProperty[] {
  const statusFor = (path: string): MaskPropertyReviewStatus =>
    !staleReview && stored ? (stored.propertyStatuses[path] ?? "unreviewed") : "unreviewed"

  const properties: MaskProperty[] = [
    {
      path: "g0",
      kind: "g0",
      label: "G0 — Produktform-Gate",
      value: String(record.g0.value),
      confidence: null,
      evidenceLevel: null,
      evidenceScope: null,
      rationale: record.g0.rationale ?? null,
      evidenceSignals: record.g0.evidenceSignals,
      derivation: null,
      thresholdReasoning: [],
      counterSignals: [],
      limitations: [],
      modeScoped: record.g0.modeScoped ?? null,
      multiUse: record.g0.multiUse == null ? null : Boolean(record.g0.multiUse),
      disagreement: findAgreementCell(agreement, productId, "g0"),
      humanReviewStatus: statusFor("g0"),
      derivedAnnotations: [],
    },
  ]

  if (record.profile) {
    const profile = record.profile
    for (const key of MASK_REVIEWABLE_PROFILE_FIELD_KEYS) {
      const field = profile[key]
      const path = `profile.${key}`
      const derivedKeys = DERIVED_FIELD_DRIVERS[key] ?? []
      properties.push({
        path,
        kind: "profile",
        label: MASK_PROFILE_FIELD_LABELS[key],
        value: formatFieldValue(field.value),
        confidence: field.confidence ?? null,
        evidenceLevel: field.evidenceLevel ?? null,
        evidenceScope: field.evidenceScope ?? null,
        rationale: field.rationale ?? null,
        evidenceSignals: field.evidenceSignals,
        derivation: field.derivation ?? null,
        thresholdReasoning: field.thresholdReasoning,
        counterSignals: field.counterSignals,
        limitations: field.limitations,
        modeScoped: null,
        multiUse: null,
        disagreement: findAgreementCell(agreement, productId, key),
        humanReviewStatus: statusFor(path),
        derivedAnnotations: derivedKeys.map((derivedKey) =>
          buildDerivedAnnotation(derivedKey, profile, agreement, productId),
        ),
      })
    }
  }

  return properties
}

function buildDetail(
  cohort: MaskCohort,
  product: MaskCohortProduct,
  record: MaskReferenceRecord | null,
  agreement: MaskAgreement | null,
  stored: MaskLabProductReviewState | undefined,
): MaskProductDetail {
  const runStatus: MaskRunStatus = record ? "completed" : "pending"
  const excluded = record !== null && record.profile === undefined
  const categoryBoundaryStatus: MaskCategoryBoundaryStatus =
    runStatus === "pending" ? "pending" : excluded ? "excluded_product_form" : "eligible"

  const recordFingerprint = maskReviewFingerprint({ product, record })
  const staleReview = stored
    ? !(
        stored.recordFingerprint === recordFingerprint && stored.standardVersion === cohort.standard
      )
    : false

  const properties = record
    ? buildProperties(record, agreement, product.id, stored, staleReview)
    : []
  const propertyStatuses = Object.fromEntries(
    properties.map((property) => [property.path, property.humanReviewStatus]),
  )

  const statusValues = Object.values(propertyStatuses)
  const hasOpenRework = statusValues.includes("rework_open")
  const allApproved = properties.length > 0 && statusValues.every((status) => status === "approved")

  let reviewStatus: MaskReviewStatus = "needs_review"
  if (stored && !staleReview && stored.reviewStatus === "excluded" && excluded)
    reviewStatus = "excluded"
  else if (stored && !staleReview && stored.reviewStatus === "approved" && allApproved)
    reviewStatus = "approved"
  else if (hasOpenRework) reviewStatus = "rework_open"

  const openProperties = statusValues.filter((status) => status !== "approved").length
  const reviewBlockers: string[] = []
  if (hasOpenRework)
    reviewBlockers.push(
      "Mindestens eine Eigenschaft ist in Nacharbeit. Erst lösen oder freigeben, dann das Produkt freigeben.",
    )
  if (runStatus === "pending")
    reviewBlockers.push("Der Klassifizierungslauf für dieses Produkt steht noch aus.")

  const adjudicationPoints = record?.adjudicationPoints ?? []
  const openAdjudicationIds = adjudicationPoints.map((entry) => entry.id)

  const rawInci = product.formulaOfRecord.rawInci
  const normalizedIngredients = rawInci
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  const conflicts = product.conflicts.map((entry) => ({
    type: entry.type,
    description: entry.description,
    resolution: entry.resolution,
  }))

  const focusCareVerdict = record?.focusCareVerdict ?? null
  const focusCareVerdictNote =
    focusCareVerdict === null
      ? null
      : typeof focusCareVerdict === "string"
        ? `Fokus-Pflege-Urteil: ${focusCareVerdict}`
        : `Fokus-Pflege-Urteil: ${focusCareVerdict.value}${focusCareVerdict.note ? ` — ${focusCareVerdict.note}` : ""}`

  const reviewRoutingNotes: string[] = [
    ...conflicts.map((entry) => `${entry.type}: ${entry.description}`),
    ...(record?.blindToFinalChanges.map((entry) =>
      typeof entry === "string"
        ? `Blind-/Key-Lane-Abgleich: ${entry}`
        : `Blind-/Key-Lane-Abgleich (${entry.field}): ${describeUnknown(entry.blindValue)} → ${describeUnknown(entry.finalValue)}${entry.reason ? ` — ${entry.reason}` : ""}`,
    ) ?? []),
    ...(focusCareVerdictNote ? [focusCareVerdictNote] : []),
    ...(record?.overloadCounterSignal
      ? [
          `Overload-Gegensignal: ${
            typeof record.overloadCounterSignal === "string"
              ? record.overloadCounterSignal
              : JSON.stringify(record.overloadCounterSignal)
          }`,
        ]
      : []),
    ...(product.verificationNote ? [product.verificationNote] : []),
  ]

  const projectedOutputs = record?.projectedOutputs
    ? {
        concentration: record.projectedOutputs.concentration ?? null,
        weight: record.projectedOutputs.weight ?? null,
        balanceDirection: record.projectedOutputs.balance_direction ?? null,
        repairSupportLevel: record.projectedOutputs.repair_support_level ?? null,
        functionalBenefits: record.projectedOutputs.functional_benefits,
        suitableThicknesses: record.projectedOutputs.suitable_thicknesses,
      }
    : null

  const queue: MaskQueueItem = {
    productId: product.id,
    slot: product.productNumber,
    productName: product.identity.productName,
    brandName: product.identity.brand,
    archetypeRole: product.role,
    archetypeSlots: product.archetypeSlots ?? [],
    market: product.identity.market,
    packSize: product.identity.packSize,
    gtin: product.identity.gtinEan ?? null,
    runStatus,
    g0Value: record ? String(record.g0.value) : null,
    statusLabel: statusLabelFor(reviewStatus, runStatus, excluded, staleReview),
    uncertainFields: record?.uncertainFields ?? [],
    excluded,
    categoryBoundaryStatus,
    reviewStatus,
    openProperties,
    propertyCount: properties.length,
    openAdjudicationIds,
    staleReview,
    lastReviewDecision: stored?.decisions.at(-1) ?? null,
  }

  return {
    ...queue,
    identity: {
      gtin: product.identity.gtinEan ?? null,
      market: product.identity.market,
      packSize: product.identity.packSize,
      rawInci,
      normalizedIngredients,
      tailMarkerRank: record?.tailMarker?.rank ?? null,
      tailMarkerIngredient: record?.tailMarker?.ingredient ?? null,
      tailMarkerAnomalyNote: record?.tailMarker?.anomalyNote ?? null,
      directionsText: product.directions.text,
      directionsContactTime:
        product.directions.contactTimeMinutes !== undefined &&
        product.directions.contactTimeMinutes !== null
          ? String(product.directions.contactTimeMinutes)
          : null,
      directionsConfidence: product.directions.confidence ?? null,
      claims: product.claims,
      conflicts,
    },
    reviewRoutingNotes,
    adjudicationPoints,
    assumptionNotes: record?.assumptionNotes ?? [],
    properties,
    propertyStatuses,
    recordFingerprint,
    standardVersion: cohort.standard,
    projectedOutputs,
    canApproveProduct:
      runStatus === "completed" && !excluded && reviewStatus !== "approved" && !hasOpenRework,
    canApproveBoundary: runStatus === "completed" && excluded && reviewStatus !== "excluded",
    reviewBlockers,
  }
}

function reviewedDetails(): MaskProductDetail[] {
  const cohort = getCohort()
  const agreement = loadAgreement()
  const statePath = reviewStatePath()
  const stored = statePath ? readMaskLabReviewState(statePath) : null
  return cohort.products
    .filter((product) => !product.isReserve)
    .map((product) =>
      buildDetail(
        cohort,
        product,
        loadReferenceRecord(product.id),
        agreement,
        stored?.products.find((entry) => entry.productId === product.id),
      ),
    )
}

function queueItemFromDetail(detail: MaskProductDetail): MaskQueueItem {
  return {
    productId: detail.productId,
    slot: detail.slot,
    productName: detail.productName,
    brandName: detail.brandName,
    archetypeRole: detail.archetypeRole,
    archetypeSlots: [...detail.archetypeSlots],
    market: detail.market,
    packSize: detail.packSize,
    gtin: detail.gtin,
    runStatus: detail.runStatus,
    g0Value: detail.g0Value,
    statusLabel: detail.statusLabel,
    uncertainFields: [...detail.uncertainFields],
    excluded: detail.excluded,
    categoryBoundaryStatus: detail.categoryBoundaryStatus,
    reviewStatus: detail.reviewStatus,
    openProperties: detail.openProperties,
    propertyCount: detail.propertyCount,
    openAdjudicationIds: [...detail.openAdjudicationIds],
    staleReview: detail.staleReview,
    lastReviewDecision: detail.lastReviewDecision,
  }
}

export function getMaskResearchLabData(): MaskResearchLabData {
  const cohort = getCohort()
  const details = reviewedDetails()
  const initialDetail = details[0]
  if (!initialDetail) throw new Error("Mask cohort contains no primary products")

  const openAdjudications = details.flatMap((detail) => detail.adjudicationPoints)
  const seen = new Set<string>()
  const dedupedAdjudications = openAdjudications.filter((entry) => {
    if (seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  })

  return {
    meta: {
      cohortId: cohort.cohortId,
      standardVersion: "mask-inci-v0.3 (Kohorte eingefroren unter v0.1-draft)",
      frozen: cohort.frozen,
      referenceKeyVersion: REFERENCE_KEY_DIR,
      charter: cohort.charter,
      approval: cohort.approval,
    },
    summary: {
      products: details.length,
      pending: details.filter((detail) => detail.runStatus === "pending").length,
      excluded: details.filter((detail) => detail.excluded).length,
      reviewCounts: {
        approved: details.filter((detail) => detail.reviewStatus === "approved").length,
        reworkOpen: details.filter((detail) => detail.reviewStatus === "rework_open").length,
        needsReview: details.filter((detail) => detail.reviewStatus === "needs_review").length,
        excluded: details.filter((detail) => detail.reviewStatus === "excluded").length,
      },
    },
    openG0Question: cohort.openG0Question
      ? `${cohort.openG0Question} — BEANTWORTET (R1, 2026-09-14): eligible, mode-scoped; Charter korrigiert. Siehe Produkt 12.`
      : null,
    openAdjudications: dedupedAdjudications,
    queueItems: details.map(queueItemFromDetail),
    initialDetail,
  }
}

export function getMaskResearchProductDetail(productId: string): MaskProductDetail | null {
  return reviewedDetails().find((detail) => detail.productId === productId) ?? null
}

export const maskResearchReviewRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("approve_property"),
      itemId: z.string().trim().min(1),
      propertyPath: z.string().trim().min(1),
      comment: z.string().trim().min(1).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("request_rework"),
      itemId: z.string().trim().min(1),
      propertyPath: z.string().trim().min(1),
      comment: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve_product"),
      itemId: z.string().trim().min(1),
      comment: z.string().trim().min(1).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve_boundary"),
      itemId: z.string().trim().min(1),
      comment: z.string().trim().min(1).optional(),
    })
    .strict(),
])

function reviewSnapshot(
  item: MaskProductDetail,
  reviewStatus: MaskReviewStatus,
  propertyStatuses: Record<string, MaskPropertyReviewStatus>,
) {
  return {
    productId: item.productId,
    recordFingerprint: item.recordFingerprint,
    standardVersion: item.standardVersion,
    boundary: item.categoryBoundaryStatus,
    reviewStatus,
    propertyStatuses,
  }
}

export function reviewMaskResearchItem(input: MaskReviewInput): MaskReviewResult {
  const item = getMaskResearchProductDetail(input.itemId)
  if (!item) return { status: "not_found", error: "Mask-Research-Eintrag nicht gefunden." }

  if (item.runStatus === "pending") {
    return {
      status: "blocked",
      item,
      blockers: ["Der Klassifizierungslauf für dieses Produkt steht noch aus."],
    }
  }
  if (input.action === "approve_boundary" && !item.canApproveBoundary) {
    return {
      status: "blocked",
      item,
      blockers: item.excluded
        ? ["Dieser G0-Ausschluss ist bereits bestätigt."]
        : ["Nur ein G0-Produktform-Ausschluss kann bestätigt werden."],
    }
  }
  if (input.action === "approve_product" && !item.canApproveProduct) {
    return {
      status: "blocked",
      item,
      blockers: item.excluded
        ? ["Ein ausgeschlossenes Produkt wird über die G0-Bestätigung abgeschlossen."]
        : item.reviewBlockers.length > 0
          ? item.reviewBlockers
          : ["Dieses Produkt ist bereits freigegeben."],
    }
  }
  if (input.action === "approve_property" || input.action === "request_rework") {
    if (!item.properties.some((property) => property.path === input.propertyPath))
      return { status: "not_found", error: "Mask-Eigenschaft nicht gefunden." }
    if (
      input.action === "approve_property" &&
      item.propertyStatuses[input.propertyPath] === "approved"
    )
      return { status: "blocked", item, blockers: ["Diese Eigenschaft ist bereits freigegeben."] }
  }

  let reviewStatus: MaskReviewStatus = item.reviewStatus
  let propertyStatuses = { ...item.propertyStatuses }
  if (input.action === "approve_product") {
    propertyStatuses = Object.fromEntries(
      item.properties.map((property) => [property.path, "approved" as const]),
    )
    reviewStatus = "approved"
  } else if (input.action === "approve_boundary") {
    propertyStatuses.g0 = "approved"
    reviewStatus = "excluded"
  } else if (input.action === "request_rework") {
    propertyStatuses[input.propertyPath] = "rework_open"
    reviewStatus = "rework_open"
  } else {
    propertyStatuses[input.propertyPath] = "approved"
    reviewStatus = Object.values(propertyStatuses).includes("rework_open")
      ? "rework_open"
      : "needs_review"
  }

  const statePath = reviewStatePath()
  if (!statePath)
    return {
      status: "persistence_failed",
      error: "Die Review-Entscheidung ist nur im lokalen Development-Lab speicherbar.",
    }

  try {
    return withMaskReviewPersistenceRollback([statePath], () => {
      const decision = saveMaskLabReviewState({
        filePath: statePath,
        snapshot: reviewSnapshot(item, reviewStatus, propertyStatuses),
        decision: {
          action: input.action,
          propertyPath: "propertyPath" in input ? input.propertyPath : null,
          comment: input.comment?.trim() || null,
        },
      })
      const persisted = getMaskResearchProductDetail(item.productId)
      if (!persisted)
        throw new Error("Gespeicherter Review-Eintrag konnte nicht neu geladen werden.")
      return { status: "accepted", item: persisted, reviewDecision: decision }
    })
  } catch (error) {
    return {
      status: "persistence_failed",
      error:
        error instanceof Error
          ? `Review konnte nicht dauerhaft gespeichert werden: ${error.message}`
          : "Review konnte nicht dauerhaft gespeichert werden.",
    }
  }
}
