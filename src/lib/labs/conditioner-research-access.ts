import "server-only"

import { readFileSync } from "node:fs"
import path, { join } from "node:path"
import { z } from "zod"

import {
  conditionerReviewFingerprint,
  readConditionerLabReviewState,
  saveConditionerLabReviewState,
  updateConditionerReworkQueue,
  withConditionerReviewPersistenceRollback,
  type ConditionerLabProductReviewState,
  type ConditionerLabReviewDecision,
} from "@/lib/conditioner-research/review-state"
import {
  conditionerProfileFieldEvidence,
  type ConditionerProfileEvidenceBasis,
} from "@/lib/conditioner-research/profile-evidence"

type Environment = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV">>
type JsonRecord = Record<string, unknown>

const ARTIFACT_DIRECTORY = join(process.cwd(), "data/research/conditioner-inci/v1.0")

function loadArtifact(fileName: string): unknown {
  return JSON.parse(readFileSync(join(ARTIFACT_DIRECTORY, fileName), "utf8")) as unknown
}

export type ConditionerResearchProfile = {
  conditioningLevel: string
  weightPotential: string
  careDirection: string
  repairSupportLevel: string
  primaryFocus: string
  secondaryFocus: string[]
  hairThicknessFit: string[]
  damageFit: string[]
  textureFit: string[]
  uncertainFields: string[]
  assumptionNotes: string[]
}

export type ConditionerResearchQueueItem = {
  productId: string
  productName: string
  brandName: string
  market: string
  packSize: string
  statusLabel: string
  summary: string
  uncertainFields: string[]
  sourceConflict: boolean
  excluded: boolean
  formulaStatus: string
  profileStatus: string
  categoryBoundaryStatus: "eligible" | "excluded_product_form"
  formulaFingerprint: string
  profileComplete: boolean
  uncertaintyCount: number
  reviewStatus: ConditionerResearchReviewStatus
  priorityGroup: "priority" | "standard" | "boundary"
  staleReview: boolean
  lastReviewDecision: ConditionerLabReviewDecision | null
}

export type ConditionerResearchProductDetail = ConditionerResearchQueueItem & {
  conflictExplanation: string | null
  boundaryExplanation: string | null
  identity: {
    gtinEan: string | null
    market: string
    packSize: string
    formulaVersion: string
    formulaStatus: string
  }
  formula: { rawInci: string; normalizedInci: string }
  directions: {
    raw: string
    normalized: string
  }
  sources: Array<{ id: string; type: string; market: string; locator: string }>
  profile: {
    statusLabel: string
    uncertainFields: string[]
    fields: ConditionerResearchProfileField[]
  } | null
  uncertaintyNotes: string[]
  profileFingerprint: string | null
  standardVersion: string
  fieldFingerprints: Record<string, string>
  propertyStatuses: Record<string, ConditionerResearchPropertyReviewStatus>
  canApproveProduct: boolean
  canApproveBoundary: boolean
  reviewBlockers: string[]
}

export type ConditionerResearchProfileField = {
  path: string
  label: string
  value: string
  reviewStatus: string
  rationale: string
  evidenceBasis: ConditionerProfileEvidenceBasis
  evidenceSignals: string[]
  derivation: string
  thresholdReasoning: string[]
  limitations: string[]
  acceptedValue: string
  blindValue: string
  humanReviewStatus: ConditionerResearchPropertyReviewStatus
}

type ConditionerDirectProperties = {
  conditioningDepositionPotential: string
  wetSlipDetanglingPotential: string
  dryCombabilityPotential: string
  smoothingFrizzControlPotential: string
  weightDepositionPotential: string
  bodyLightnessPotential: string
  repairLubricationProtection: string
  repairSurfaceFilm: string
  bondSpecificSupport: string
  colorChemicalDamageProtection: string
  rationale: string
  routes: string[]
}

export type ConditionerResearchReviewStatus =
  | "needs_review"
  | "rework_open"
  | "approved"
  | "excluded"
export type ConditionerResearchPropertyReviewStatus = "unreviewed" | "rework_open" | "approved"

export type ConditionerResearchCalibration = {
  preAdjudication: { exactCells: number; totalCells: number }
  postAdjudication: { exactCells: number; totalCells: number }
  nonFocusAgreement: { exactCells: number; totalCells: number }
  damageFitDistribution: {
    healthyOnly: number
    healthyModerate: number
    moderateHigh: number
  }
  semanticDifferences: string[]
  remainingDifferences: string[]
  focusDecisions: string[]
  evidenceCaveats: string[]
  stress: string
}

export type ConditionerResearchLabData = {
  summary: {
    completeProfiles: number
    sourceConflicts: number
    excluded: number
    reviewCounts: {
      approved: number
      reworkOpen: number
      needsReview: number
      excluded: number
    }
  }
  queueItems: ConditionerResearchQueueItem[]
  initialDetail: ConditionerResearchProductDetail
  calibration: ConditionerResearchCalibration
}

export type ConditionerResearchReviewInput =
  | { action: "approve_property"; itemId: string; propertyPath: string; comment?: string }
  | { action: "request_rework"; itemId: string; propertyPath: string; comment: string }
  | { action: "approve_product"; itemId: string; comment?: string }
  | { action: "approve_boundary"; itemId: string; comment?: string }

export type ConditionerResearchReviewResult =
  | {
      status: "accepted"
      item: ConditionerResearchProductDetail
      reviewDecision: ConditionerLabReviewDecision
    }
  | { status: "blocked"; item: ConditionerResearchProductDetail; blockers: string[] }
  | { status: "not_found"; error: string }
  | { status: "persistence_failed"; error: string }

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`)
  return value as JsonRecord
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} must be a non-empty string`)
  return value
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`)
  return value
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} must be a number`)
  return value
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function stringArray(value: unknown, label: string): string[] {
  return arrayValue(value, label).map((entry, index) => stringValue(entry, `${label}[${index}]`))
}

function stringOrArray(value: unknown, label: string): string[] {
  return typeof value === "string" ? [stringValue(value, label)] : stringArray(value, label)
}

const PROFILE_VOCABULARY = {
  conditioningLevel: ["low", "moderate", "high"],
  weightPotential: ["low", "moderate", "high"],
  careDirection: ["protein", "moisture", "balanced"],
  repairSupportLevel: ["low", "medium", "high"],
  primaryFocus: [
    "lightness",
    "detangling",
    "smoothing",
    "repair",
    "shine",
    "curl_support",
    "color_care",
    "general",
  ],
  hairThicknessFit: ["fine", "medium", "coarse"],
  damageFit: ["healthy", "moderately_damaged", "highly_damaged"],
  textureFit: ["straight", "wavy", "curly", "coily"],
} as const

function assertVocabulary(value: string, allowed: readonly string[], label: string) {
  if (!allowed.includes(value)) throw new Error(`${label} has unsupported value ${value}`)
}

function assertCanonicalArray(value: string[], allowed: readonly string[], label: string) {
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicate values`)
  value.forEach((entry) => assertVocabulary(entry, allowed, label))
  const canonical = allowed.filter((entry) => value.includes(entry))
  if (canonical.join("|") !== value.join("|"))
    throw new Error(`${label} is not canonically ordered`)
}

function validateProfile(profile: ConditionerResearchProfile, label: string) {
  assertVocabulary(
    profile.conditioningLevel,
    PROFILE_VOCABULARY.conditioningLevel,
    `${label}.conditioning_level`,
  )
  assertVocabulary(
    profile.weightPotential,
    PROFILE_VOCABULARY.weightPotential,
    `${label}.weight_potential`,
  )
  assertVocabulary(
    profile.careDirection,
    PROFILE_VOCABULARY.careDirection,
    `${label}.care_direction`,
  )
  assertVocabulary(
    profile.repairSupportLevel,
    PROFILE_VOCABULARY.repairSupportLevel,
    `${label}.repair_support_level`,
  )
  assertVocabulary(profile.primaryFocus, PROFILE_VOCABULARY.primaryFocus, `${label}.primary_focus`)
  assertCanonicalArray(
    profile.secondaryFocus,
    PROFILE_VOCABULARY.primaryFocus,
    `${label}.secondary_focus`,
  )
  assertCanonicalArray(
    profile.hairThicknessFit,
    PROFILE_VOCABULARY.hairThicknessFit,
    `${label}.hair_thickness_fit`,
  )
  assertCanonicalArray(profile.damageFit, PROFILE_VOCABULARY.damageFit, `${label}.damage_fit`)
  assertCanonicalArray(profile.textureFit, PROFILE_VOCABULARY.textureFit, `${label}.texture_fit`)
  if (profile.secondaryFocus.length > 2)
    throw new Error(`${label}.secondary_focus has more than two values`)
  if (profile.secondaryFocus.includes(profile.primaryFocus))
    throw new Error(`${label} duplicates primary focus in secondary_focus`)
}

function canonicalize(value: string[], allowed: readonly string[]): string[] {
  return allowed.filter((entry) => value.includes(entry))
}

function profileFrom(
  value: unknown,
  label: string,
  normalizeOrder = false,
): ConditionerResearchProfile {
  const source = record(value, label)
  const profile = {
    conditioningLevel: stringValue(source.conditioning_level, `${label}.conditioning_level`),
    weightPotential: stringValue(source.weight_potential, `${label}.weight_potential`),
    careDirection: stringValue(source.care_direction, `${label}.care_direction`),
    repairSupportLevel: stringValue(source.repair_support_level, `${label}.repair_support_level`),
    primaryFocus: stringValue(source.primary_focus, `${label}.primary_focus`),
    secondaryFocus: stringArray(source.secondary_focus, `${label}.secondary_focus`),
    hairThicknessFit: stringArray(source.hair_thickness_fit, `${label}.hair_thickness_fit`),
    damageFit: stringArray(source.damage_fit, `${label}.damage_fit`),
    textureFit: stringArray(source.texture_fit, `${label}.texture_fit`),
    uncertainFields: stringArray(source.uncertain_fields, `${label}.uncertain_fields`),
    assumptionNotes: stringOrArray(source.assumption_notes, `${label}.assumption_notes`),
  }
  if (normalizeOrder) {
    profile.secondaryFocus = canonicalize(profile.secondaryFocus, PROFILE_VOCABULARY.primaryFocus)
    profile.hairThicknessFit = canonicalize(
      profile.hairThicknessFit,
      PROFILE_VOCABULARY.hairThicknessFit,
    )
    profile.damageFit = canonicalize(profile.damageFit, PROFILE_VOCABULARY.damageFit)
    profile.textureFit = canonicalize(profile.textureFit, PROFILE_VOCABULARY.textureFit)
  }
  validateProfile(profile, label)
  return profile
}

function uniqueIds(entries: unknown[], label: string): string[] {
  const ids = entries.map((entry, index) =>
    stringValue(record(entry, `${label}[${index}]`).product_id, `${label}[${index}].product_id`),
  )
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate product IDs`)
  return ids
}

const profileLabels: Record<
  keyof Omit<ConditionerResearchProfile, "uncertainFields" | "assumptionNotes">,
  string
> = {
  conditioningLevel: "conditioning_level",
  weightPotential: "weight_potential",
  careDirection: "care_direction",
  repairSupportLevel: "repair_support_level",
  primaryFocus: "primary_focus",
  secondaryFocus: "secondary_focus",
  hairThicknessFit: "hair_thickness_fit",
  damageFit: "damage_fit",
  textureFit: "texture_fit",
}

function displayValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join(" · ") : value
}

function profileValuesMatch(left: string | string[], right: string | string[]) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function directPropertiesFrom(value: unknown, label: string): ConditionerDirectProperties {
  const source = record(value, label)
  const values = record(source.values, `${label}.values`)
  return {
    conditioningDepositionPotential: stringValue(
      values.conditioning_deposition_potential,
      `${label}.values.conditioning_deposition_potential`,
    ),
    wetSlipDetanglingPotential: stringValue(
      values.wet_slip_detangling_potential,
      `${label}.values.wet_slip_detangling_potential`,
    ),
    dryCombabilityPotential: stringValue(
      values.dry_combability_potential,
      `${label}.values.dry_combability_potential`,
    ),
    smoothingFrizzControlPotential: stringValue(
      values.smoothing_frizz_control_potential,
      `${label}.values.smoothing_frizz_control_potential`,
    ),
    weightDepositionPotential: stringValue(
      values.weight_deposition_potential,
      `${label}.values.weight_deposition_potential`,
    ),
    bodyLightnessPotential: stringValue(
      values.body_lightness_potential,
      `${label}.values.body_lightness_potential`,
    ),
    repairLubricationProtection: stringValue(
      values.repair_lubrication_protection,
      `${label}.values.repair_lubrication_protection`,
    ),
    repairSurfaceFilm: stringValue(
      values.repair_surface_film,
      `${label}.values.repair_surface_film`,
    ),
    bondSpecificSupport: stringValue(
      values.bond_specific_support,
      `${label}.values.bond_specific_support`,
    ),
    colorChemicalDamageProtection: stringValue(
      values.color_chemical_damage_protection,
      `${label}.values.color_chemical_damage_protection`,
    ),
    rationale: stringValue(source.rationale, `${label}.rationale`),
    routes: stringArray(source.routes, `${label}.routes`),
  }
}

function agreementValue(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join(" + ") : String(value)
}

const GERMAN_DIFFERENCE_REASONS: Record<string, string> = {
  "d8ac8909-91a1-46b3-9fa6-2ff66b78fb66:primary_focus":
    "High-Slip, reichhaltige Architektur und exakte Curl-/Coily-Positionierung erfüllen die Curl-Support-Schwelle; Smoothing bleibt unterstützt.",
  "d8ac8909-91a1-46b3-9fa6-2ff66b78fb66:secondary_focus":
    "Polyester-11 bleibt ein Formel-Filmkandidat, macht Repair ohne Schadenskontext aber nicht zum nützlichen Produktzweck.",
  "4f67cb6d-4b28-490b-9817-e8fc8e91b010:secondary_focus":
    "Color-Glow-Positionierung und der optische Schutzkandidat machen Shine neben Color Care nützlich; Anti-Fade bleibt unbewiesen.",
  "8182ee3f-cfe9-4a31-8b2f-a6a52c7e7abe:primary_focus":
    "High-Slip, reichhaltige Architektur und exakte Curl-Positionierung erfüllen die Curl-Support-Schwelle; Smoothing bleibt unterstützt.",
  "8182ee3f-cfe9-4a31-8b2f-a6a52c7e7abe:secondary_focus":
    "Curl Support ist bereits primär; Detangling und Smoothing bleiben nützliche unterstützte Endpunkte.",
}

function formatAgreementDifference(entry: JsonRecord): string {
  const key = `${String(entry.product_id)}:${String(entry.field)}`
  const reason = GERMAN_DIFFERENCE_REASONS[key] ?? String(entry.reason)
  return `${String(entry.exact_name)} · ${String(entry.field)}: akzeptiert ${agreementValue(entry.accepted)}; Blind-Review ${agreementValue(entry.reviewer_f)}. ${reason}`
}

function createDetail(input: {
  formula: JsonRecord
  direction: JsonRecord
  productId: string
  profile: ConditionerResearchProfile | null
  blindProfile: ConditionerResearchProfile | null
  boundary: JsonRecord | null
  sourceConflict: boolean
  semanticDifferences: JsonRecord[]
  remainingDifferences: JsonRecord[]
  formulaVersion: string
  standardVersion: string
  direct: ConditionerDirectProperties | null
}): ConditionerResearchProductDetail {
  const {
    formula,
    direction,
    productId,
    profile,
    blindProfile,
    boundary,
    sourceConflict,
    formulaVersion,
    standardVersion,
    direct,
  } = input
  const source = record(formula.source, `formula ${productId}.source`)
  const identifiers = arrayValue(formula.identifiers, `formula ${productId}.identifiers`)
  const gtin = identifiers
    .map((entry) => record(entry, "identifier"))
    .find((entry) => entry.type === "gtin")
  const conflicts = stringArray(direction.conflicts, `direction ${productId}.conflicts`)
  const uncertainFields = profile?.uncertainFields ?? []
  const categoryBoundaryStatus = stringValue(
    formula.category_boundary_status,
    `formula ${productId}.category_boundary_status`,
  )
  if (categoryBoundaryStatus !== "eligible" && categoryBoundaryStatus !== "excluded_product_form") {
    throw new Error(`Unsupported category boundary status for ${productId}`)
  }
  if (profile && !direct) throw new Error(`Missing direct properties for ${productId}`)
  const fieldEvidence =
    profile && direct
      ? conditionerProfileFieldEvidence({
          productId,
          rawInci: stringValue(formula.raw_inci, `formula ${productId}.raw_inci`),
          profile,
          direct,
        })
      : null
  const fields: ConditionerResearchProfileField[] = profile
    ? (Object.keys(profileLabels) as Array<keyof typeof profileLabels>).map((key) => {
        const path = profileLabels[key]
        const evidence = fieldEvidence?.[path]
        if (!evidence) throw new Error(`Missing profile evidence for ${productId}.${path}`)
        return {
          path,
          label: path,
          value: displayValue(profile[key]),
          reviewStatus: uncertainFields.includes(path) ? "Vorläufig" : "vollständig",
          ...evidence,
          acceptedValue: displayValue(profile[key]),
          blindValue: blindProfile ? displayValue(blindProfile[key]) : "",
          humanReviewStatus: "unreviewed",
        }
      })
    : []
  const excluded = profile === null
  const formulaStatus = sourceConflict
    ? "konflikt"
    : stringValue(formula.formula_status, `formula ${productId}.formula_status`)
  const formulaFingerprint = stringValue(
    formula.formula_fingerprint,
    `formula ${productId}.formula_fingerprint`,
  )
  const profileFingerprint = profile
    ? conditionerReviewFingerprint({
        productId,
        formulaFingerprint,
        standardVersion,
        values: Object.fromEntries(fields.map((field) => [field.path, field.value])),
        uncertainFields,
        assumptionNotes: profile.assumptionNotes,
      })
    : null
  const fieldFingerprints = Object.fromEntries(
    fields.map((field) => [
      field.path,
      conditionerProfileFieldFingerprint({
        productId,
        formulaFingerprint,
        field,
      }),
    ]),
  )
  const reviewBlockers = sourceConflict
    ? ["Ein aktiver Quellenkonflikt blockiert die vollständige Freigabe."]
    : []
  const propertyStatuses = Object.fromEntries(
    fields.map((field) => [field.path, "unreviewed" as const]),
  )
  return {
    productId,
    productName: stringValue(formula.exact_name, `formula ${productId}.exact_name`),
    brandName: stringValue(formula.brand, `formula ${productId}.brand`),
    market: stringValue(formula.market, `formula ${productId}.market`),
    packSize: stringValue(formula.pack_size, `formula ${productId}.pack_size`),
    statusLabel: excluded
      ? "Ausgeschlossen"
      : sourceConflict
        ? "Quellenkonflikt"
        : uncertainFields.length > 0
          ? uncertainFields.some(
              (field) => field === "primary_focus" || field === "secondary_focus",
            )
            ? "Fokus prüfen"
            : "Eigenschaft prüfen"
          : "Vollständig",
    summary: excluded
      ? "Leave-in-Produkt; Gate G0 stoppt die Conditioner-Klassifikation."
      : sourceConflict
        ? conflicts.join(" ")
        : "Vollständiges Pilotprofil",
    uncertainFields,
    sourceConflict,
    excluded,
    formulaStatus,
    profileStatus: excluded
      ? "kein Profil"
      : uncertainFields.length
        ? `${uncertainFields.length} vorläufige Felder`
        : "vollständig",
    categoryBoundaryStatus,
    formulaFingerprint,
    profileComplete: !excluded,
    uncertaintyCount: uncertainFields.length,
    reviewStatus: "needs_review",
    priorityGroup: excluded ? "boundary" : uncertainFields.length > 0 ? "priority" : "standard",
    staleReview: false,
    lastReviewDecision: null,
    conflictExplanation: conflicts.length ? conflicts.join(" ") : null,
    boundaryExplanation: boundary
      ? stringValue(boundary.reason, `boundary ${productId}.reason`)
      : null,
    identity: {
      gtinEan: gtin ? stringValue(gtin.value, "gtin") : null,
      market: stringValue(formula.market, "market"),
      packSize: stringValue(formula.pack_size, "pack size"),
      formulaVersion,
      formulaStatus,
    },
    formula: {
      rawInci: stringValue(formula.raw_inci, "raw INCI"),
      normalizedInci: stringValue(formula.normalized_inci, "normalized INCI"),
    },
    directions: {
      raw: stringValue(direction.directions_summary, "directions summary"),
      normalized: `${booleanValue(direction.rinse_out, "rinse out") ? "Rinse-out" : "Leave-in"} · ${stringValue(direction.application_area, "application area")}`,
    },
    sources: Array.from(
      new Map(
        [
          source,
          ...arrayValue(direction.sources, "direction sources").map((entry) =>
            record(entry, "direction source"),
          ),
        ].map((entry, index) => {
          const locator = typeof entry.url === "string" ? entry.url : ""
          const sourceId = typeof entry.source_id === "string" ? entry.source_id : "source"
          const sourceType = typeof entry.source_type === "string" ? entry.source_type : "source"
          const sourceMarket = typeof entry.market === "string" ? entry.market : "DE"
          return [
            locator || `${sourceId}:${sourceType}:${sourceMarket}:${index}`,
            {
              id: sourceId === "source" ? locator || sourceId : sourceId,
              type: sourceType,
              market: sourceMarket,
              locator,
            },
          ]
        }),
      ).values(),
    ),
    profile: profile ? { statusLabel: "vollständig", uncertainFields, fields } : null,
    uncertaintyNotes:
      profile?.assumptionNotes ??
      (boundary ? [stringValue(boundary.reason, "boundary reason")] : []),
    profileFingerprint,
    standardVersion,
    fieldFingerprints,
    propertyStatuses,
    canApproveProduct: !excluded && reviewBlockers.length === 0,
    canApproveBoundary: excluded,
    reviewBlockers,
  }
}

function conditionerProfileFieldFingerprint(input: {
  productId: string
  formulaFingerprint: string
  field: ConditionerResearchProfileField
  legacyStandardVersion?: string
}) {
  const { productId, formulaFingerprint, field, legacyStandardVersion } = input
  return conditionerReviewFingerprint({
    productId,
    formulaFingerprint,
    ...(legacyStandardVersion ? { standardVersion: legacyStandardVersion } : {}),
    path: field.path,
    value: field.value,
    rationale: field.rationale,
    evidenceBasis: field.evidenceBasis,
    evidenceSignals: field.evidenceSignals,
    derivation: field.derivation,
    thresholdReasoning: field.thresholdReasoning,
    limitations: field.limitations,
  })
}

function makeFixtureData(): {
  data: ConditionerResearchLabData
  detailsById: Map<string, ConditionerResearchProductDetail>
} {
  const formulasFixture = loadArtifact("calibration-pilot-formulas.json")
  const directionsFixture = loadArtifact("calibration-pilot-directions.json")
  const acceptedKeyFixture = loadArtifact("calibration-full-profile-key.json")
  const directPropertiesFixture = loadArtifact("calibration-key.json")
  const blindReviewFixture = loadArtifact("calibration-full-profile-reviewer-g.json")
  const agreementFixture = loadArtifact("calibration-full-profile-agreement.json")
  const stressTestsFixture = loadArtifact("stress-tests.json")

  const formulas = arrayValue(
    record(formulasFixture, "formulas fixture").products,
    "formulas fixture.products",
  )
  const directions = arrayValue(
    record(directionsFixture, "directions fixture").products,
    "directions fixture.products",
  )
  const acceptedKey = record(acceptedKeyFixture, "accepted key fixture")
  const directProperties = arrayValue(
    record(directPropertiesFixture, "direct properties fixture").products,
    "direct properties fixture.products",
  )
  const formulaVersion = stringValue(acceptedKey.version, "accepted key.version")
  const standardVersion = stringValue(acceptedKey.standard_version, "accepted key.standard_version")
  const acceptedProfiles = arrayValue(acceptedKey.profiles, "accepted key.profiles")
  const acceptedExcluded = arrayValue(
    acceptedKey.excluded_products,
    "accepted key.excluded_products",
  )
  const blind = record(blindReviewFixture, "blind review fixture")
  const blindProfiles = arrayValue(blind.profiles, "blind review.profiles")
  const blindExcluded =
    blind.excluded_products === undefined
      ? acceptedExcluded
      : arrayValue(blind.excluded_products, "blind review.excluded_products")

  if (formulas.length !== 12 || directions.length !== 12)
    throw new Error("Pilot must contain exactly 12 formula and direction records")
  const formulaIds = uniqueIds(formulas, "formula records")
  const directionIds = uniqueIds(directions, "direction records")
  if (formulaIds.join("|") !== directionIds.join("|"))
    throw new Error("Formula and direction packet order or IDs differ")
  const profileIds = uniqueIds(acceptedProfiles, "accepted profiles")
  const excludedIds = uniqueIds(acceptedExcluded, "accepted exclusions")
  if (profileIds.length !== 11 || excludedIds.length !== 1)
    throw new Error("Pilot must have 11 profiles and one exclusion")
  if (new Set([...profileIds, ...excludedIds]).size !== formulas.length)
    throw new Error("Accepted profile IDs do not partition the pilot")
  if (!formulaIds.every((id) => profileIds.includes(id) || excludedIds.includes(id)))
    throw new Error("Accepted key contains mismatched product IDs")
  if (uniqueIds(blindProfiles, "blind profiles").join("|") !== profileIds.join("|"))
    throw new Error("Blind review profile IDs differ from accepted key")
  if (uniqueIds(blindExcluded, "blind exclusions").join("|") !== excludedIds.join("|"))
    throw new Error("Blind review exclusions differ from accepted key")

  const profilesById = new Map(
    acceptedProfiles.map((entry) => {
      const item = record(entry, "accepted profile")
      return [
        stringValue(item.product_id, "accepted profile.product_id"),
        { source: item, profile: profileFrom(item, "accepted profile") },
      ]
    }),
  )
  const blindById = new Map(
    blindProfiles.map((entry) => {
      const item = record(entry, "blind profile")
      return [
        stringValue(item.product_id, "blind profile.product_id"),
        profileFrom(item, "blind profile", true),
      ]
    }),
  )
  const directionsById = new Map(
    directions.map((entry) => {
      const item = record(entry, "direction")
      return [stringValue(item.product_id, "direction.product_id"), item]
    }),
  )
  const acceptedExclusionsById = new Map(
    acceptedExcluded.map((entry) => {
      const item = record(entry, "accepted exclusion")
      return [stringValue(item.product_id, "accepted exclusion.product_id"), item]
    }),
  )
  const directById = new Map(
    directProperties.map((entry, index) => {
      const item = record(entry, `direct property[${index}]`)
      const productId = stringValue(item.product_id, `direct property[${index}].product_id`)
      return [
        productId,
        item.boundary === "eligible"
          ? directPropertiesFrom(item, `direct property ${productId}`)
          : null,
      ]
    }),
  )
  if (uniqueIds(directProperties, "direct properties").join("|") !== formulaIds.join("|"))
    throw new Error("Direct property IDs differ from formula packet")

  const agreement = record(agreementFixture, "agreement fixture")
  const pre = record(agreement.pre_adjudication, "pre adjudication")
  const post = record(agreement.post_adjudication, "post adjudication")
  const blindSemanticDifferences = arrayValue(pre.semantic_differences, "semantic differences").map(
    (entry) => record(entry, "semantic difference"),
  )
  const humanPolicyOverrides = arrayValue(
    agreement.human_policy_overrides,
    "human policy overrides",
  ).map((entry) => record(entry, "human policy override"))
  const semanticDifferences = [...blindSemanticDifferences, ...humanPolicyOverrides]
  const remainingDifferences = arrayValue(post.remaining_differences, "remaining differences").map(
    (entry) => record(entry, "remaining difference"),
  )
  const preExactCells = numberValue(pre.exact_cells, "pre exact cells")
  const postExactCells = numberValue(post.exact_cells, "post exact cells")
  if (
    numberValue(pre.total_cells, "pre total cells") !== 99 ||
    preExactCells !== 94 ||
    blindSemanticDifferences.length !== 5 ||
    humanPolicyOverrides.length !== 9
  )
    throw new Error("Pre-adjudication nine-field calibration invariant failed")
  if (
    numberValue(post.total_cells, "post total cells") !== 99 ||
    postExactCells !== 85 ||
    remainingDifferences.length !== 14 ||
    numberValue(post.non_focus_exact_cells, "non-focus exact cells") !== 68 ||
    numberValue(post.non_focus_total_cells, "non-focus total cells") !== 77
  )
    throw new Error("Post-adjudication nine-field calibration invariant failed")

  const computedPostExact = profileIds.reduce((total, productId) => {
    const acceptedProfile = profilesById.get(productId)?.profile
    const blindProfile = blindById.get(productId)
    if (!acceptedProfile || !blindProfile)
      throw new Error(`Missing accepted or blind profile for ${productId}`)
    return (
      total +
      (Object.keys(profileLabels) as Array<keyof typeof profileLabels>).filter((key) =>
        profileValuesMatch(acceptedProfile[key], blindProfile[key]),
      ).length
    )
  }, 0)
  if (computedPostExact !== postExactCells)
    throw new Error("Post-adjudication profile comparison does not match the agreement artifact")

  const stressTests = record(stressTestsFixture, "stress tests fixture")
  const stressCases = arrayValue(stressTests.cases, "stress test cases").map((entry, index) =>
    record(entry, `stress test case[${index}]`),
  )
  const stressSummary = record(stressTests.summary, "stress tests summary")
  if (
    numberValue(stressSummary.passed, "stress passed") !== 5 ||
    numberValue(stressSummary.case_count, "stress case count") !== 5
  )
    throw new Error("Stress test invariant failed")
  if (
    stressCases.length !== 5 ||
    stressCases.some(
      (entry, index) =>
        stringValue(entry.verdict, `stress test case[${index}].verdict`) !== "pass" ||
        stringValue(
          entry.full_profile_assertion,
          `stress test case[${index}].full_profile_assertion`,
        ).length === 0,
    )
  )
    throw new Error("Stress test cases are incomplete or not all passing")

  const details = formulas.map((formulaEntry, index) => {
    const formula = record(formulaEntry, `formula[${index}]`)
    const productId = formulaIds[index]!
    const direction = directionsById.get(productId)
    if (!direction) throw new Error(`Missing directions for ${productId}`)
    const profileEntry = profilesById.get(productId)
    const profile = profileEntry?.profile ?? null
    const boundary = acceptedExclusionsById.get(productId)
    const categoryBoundaryStatus = stringValue(
      formula.category_boundary_status,
      `formula[${index}].category_boundary_status`,
    )
    if ((profile === null) !== (categoryBoundaryStatus === "excluded_product_form"))
      throw new Error(`Illegal profile completeness for ${productId}`)
    if (
      profileEntry &&
      stringValue(
        profileEntry.source.formula_fingerprint,
        `profile ${productId}.formula_fingerprint`,
      ) !== stringValue(formula.formula_fingerprint, `formula ${productId}.formula_fingerprint`)
    )
      throw new Error(`Formula fingerprint mismatch for ${productId}`)
    const conflicts = stringArray(direction.conflicts, `direction ${productId}.conflicts`)
    const sourceConflict = conflicts.length > 0
    return createDetail({
      formula,
      direction,
      productId,
      profile,
      blindProfile: blindById.get(productId) ?? null,
      boundary: boundary ?? null,
      sourceConflict,
      semanticDifferences: semanticDifferences.filter((entry) => entry.product_id === productId),
      remainingDifferences: remainingDifferences.filter((entry) => entry.product_id === productId),
      formulaVersion,
      standardVersion,
      direct: directById.get(productId) ?? null,
    })
  })
  const queueItems = details.map(
    (detail): ConditionerResearchQueueItem => ({
      productId: detail.productId,
      productName: detail.productName,
      brandName: detail.brandName,
      market: detail.market,
      packSize: detail.packSize,
      statusLabel: detail.statusLabel,
      summary: detail.summary,
      uncertainFields: detail.uncertainFields,
      sourceConflict: detail.sourceConflict,
      excluded: detail.excluded,
      formulaStatus: detail.formulaStatus,
      profileStatus: detail.profileStatus,
      categoryBoundaryStatus: detail.categoryBoundaryStatus,
      formulaFingerprint: detail.formulaFingerprint,
      profileComplete: detail.profileComplete,
      uncertaintyCount: detail.uncertaintyCount,
      reviewStatus: detail.reviewStatus,
      priorityGroup: detail.priorityGroup,
      staleReview: detail.staleReview,
      lastReviewDecision: detail.lastReviewDecision,
    }),
  )
  const completeProfiles = details.filter((detail) => detail.profile !== null).length
  const damageFitDistribution = details.reduce(
    (distribution, detail) => {
      const value = detail.profile?.fields.find((field) => field.path === "damage_fit")?.value
      if (value === "healthy") distribution.healthyOnly += 1
      else if (value === "healthy · moderately_damaged") distribution.healthyModerate += 1
      else if (value === "moderately_damaged · highly_damaged") distribution.moderateHigh += 1
      return distribution
    },
    { healthyOnly: 0, healthyModerate: 0, moderateHigh: 0 },
  )
  if (
    damageFitDistribution.healthyOnly !== 0 ||
    damageFitDistribution.healthyModerate !== 8 ||
    damageFitDistribution.moderateHigh !== 3
  )
    throw new Error("Damage Fit distribution invariant failed")
  const summary = {
    completeProfiles,
    sourceConflicts: details.filter((detail) => detail.sourceConflict).length,
    excluded: details.filter((detail) => detail.profile === null).length,
    reviewCounts: {
      approved: 0,
      reworkOpen: 0,
      needsReview: details.length,
      excluded: 0,
    },
  }
  if (summary.completeProfiles !== 11 || summary.sourceConflicts !== 0 || summary.excluded !== 1)
    throw new Error("Pilot summary invariant failed")
  const calibrationCaveatProductIds = new Set([
    "952a4834-e451-4dc3-ba19-ebb8927eb5e4",
    "9f8da740-87b6-45e0-ab86-d77d63f2e22b",
  ])
  const evidenceCaveats = details
    .filter((detail) => calibrationCaveatProductIds.has(detail.productId))
    .flatMap((detail) =>
      detail.uncertaintyNotes.map((note) => `${detail.brandName} ${detail.productName} · ${note}`),
    )
  if (evidenceCaveats.length !== 3)
    throw new Error("Calibration evidence-caveat artifact invariant failed")
  return {
    data: {
      summary,
      queueItems,
      initialDetail: details[0]!,
      calibration: {
        preAdjudication: { exactCells: preExactCells, totalCells: 99 },
        postAdjudication: { exactCells: postExactCells, totalCells: 99 },
        nonFocusAgreement: { exactCells: 68, totalCells: 77 },
        damageFitDistribution,
        semanticDifferences: semanticDifferences.map(formatAgreementDifference),
        remainingDifferences: remainingDifferences.map((entry) => {
          const fullDifference = semanticDifferences.find(
            (difference) =>
              difference.product_id === entry.product_id && difference.field === entry.field,
          )
          return fullDifference
            ? formatAgreementDifference(fullDifference)
            : `${String(entry.exact_name)} · ${String(entry.field)}`
        }),
        focusDecisions: [
          "Basisregel: Eine normale kationische Conditioner-Basis belegt Pflege und Wet-Slip, macht Detangling aber nicht automatisch zum Hauptzweck.",
          "Smoothing gewinnt, wenn trockene Oberflächenkontrolle durch Silikon-, Polymer- oder substanzielles Lipid-/Emollient-Support über die Basis hinaus differenziert.",
          "Repair braucht eine eigene R5/R7-Route oder exakte Produkt-Endpunkt-Evidenz. Silikon, Panthenol, Öle, Ceramide oder ein Repair-Name allein reichen nicht.",
          "Bestätigt: Cantu und Bali behalten Curl-Support primär, weil Formelarchitektur und exakte Curl-Positionierung zusammenpassen.",
          "Bestätigt: Colorglow behält Shine sekundär; ein späteres tieferes Color-Modell bleibt separat.",
          "Volume Victory und Biotin & Collagen: Smoothing primär, temporärer Repair-Film nur sekundär; diese Grenze ist evidenzkonsistent, R5/R7 sind interne Routennamen.",
          "Guhl Panthenol 2in1: General primär; Detangling und Smoothing sind unterstützte Fähigkeiten, die Multi-Use-Frage bleibt vertagt.",
          "John Frieda: Smoothing primär, Detangling sekundär; Shine würde denselben Glättungsweg doppelt zählen.",
          "Bali: Herstellerformel und exakte EAN-Bestätigung lösen den früheren Konflikt auf.",
        ],
        evidenceCaveats,
        stress: "5/5",
      },
    },
    detailsById: new Map(details.map((detail) => [detail.productId, detail])),
  }
}

let fixtureCache: ReturnType<typeof makeFixtureData> | undefined

function getFixture() {
  fixtureCache ??= makeFixtureData()
  return fixtureCache
}

export function isConditionerResearchLabEnabled(environment: Environment = process.env): boolean {
  return environment.NODE_ENV === "development"
}

function reviewStatePath(): string | null {
  const override = process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH?.trim()
  if (override) return path.resolve(override)
  if (process.env.NODE_ENV !== "development") return null
  return join(ARTIFACT_DIRECTORY, "lab-review-state.json")
}

function reworkQueuePath(): string | null {
  const override = process.env.CONDITIONER_RESEARCH_LAB_REWORK_QUEUE_PATH?.trim()
  if (override) return path.resolve(override)
  const reviewOverride = process.env.CONDITIONER_RESEARCH_LAB_REVIEW_STATE_PATH?.trim()
  if (reviewOverride) return join(path.dirname(path.resolve(reviewOverride)), "rework-queue.json")
  if (process.env.NODE_ENV !== "development") return null
  return join(ARTIFACT_DIRECTORY, "rework-queue.json")
}

function cloneDetail(detail: ConditionerResearchProductDetail): ConditionerResearchProductDetail {
  return {
    ...detail,
    uncertainFields: [...detail.uncertainFields],
    lastReviewDecision: detail.lastReviewDecision ? { ...detail.lastReviewDecision } : null,
    identity: { ...detail.identity },
    formula: { ...detail.formula },
    directions: { ...detail.directions },
    sources: detail.sources.map((source) => ({ ...source })),
    profile: detail.profile
      ? {
          ...detail.profile,
          uncertainFields: [...detail.profile.uncertainFields],
          fields: detail.profile.fields.map((field) => ({ ...field })),
        }
      : null,
    uncertaintyNotes: [...detail.uncertaintyNotes],
    fieldFingerprints: { ...detail.fieldFingerprints },
    propertyStatuses: { ...detail.propertyStatuses },
    reviewBlockers: [...detail.reviewBlockers],
  }
}

function applyStoredReviewState(
  base: ConditionerResearchProductDetail,
  stored: ConditionerLabProductReviewState | undefined,
): ConditionerResearchProductDetail {
  const detail = cloneDetail(base)
  if (!stored) return detail
  const exactFormula = stored.formulaFingerprint === detail.formulaFingerprint
  const exactProfile = stored.profileFingerprint === detail.profileFingerprint
  const exactStandard = stored.standardVersion === detail.standardVersion
  const exactBoundary = stored.boundary === detail.categoryBoundaryStatus
  const staleReview = !(exactFormula && exactProfile && exactStandard && exactBoundary)

  if (detail.profile) {
    const propertyStatuses = Object.fromEntries(
      detail.profile.fields.map((field) => {
        const storedFingerprint = stored.fieldFingerprints[field.path]
        const currentFingerprint = detail.fieldFingerprints[field.path]
        const legacyFingerprint = conditionerProfileFieldFingerprint({
          productId: detail.productId,
          formulaFingerprint: detail.formulaFingerprint,
          field,
          legacyStandardVersion: stored.standardVersion,
        })
        const fingerprintMatches =
          storedFingerprint === currentFingerprint || storedFingerprint === legacyFingerprint
        return [
          field.path,
          fingerprintMatches ? (stored.propertyStatuses[field.path] ?? "unreviewed") : "unreviewed",
        ]
      }),
    ) as Record<string, ConditionerResearchPropertyReviewStatus>
    detail.propertyStatuses = propertyStatuses
    detail.profile.fields = detail.profile.fields.map((field) => ({
      ...field,
      humanReviewStatus: propertyStatuses[field.path] ?? "unreviewed",
    }))
    const hasRework = Object.values(propertyStatuses).includes("rework_open")
    const allApproved = Object.values(propertyStatuses).every((status) => status === "approved")
    detail.reviewStatus =
      !staleReview && stored.reviewStatus === "approved" && allApproved
        ? "approved"
        : hasRework
          ? "rework_open"
          : "needs_review"
  } else {
    detail.reviewStatus =
      !staleReview && stored.reviewStatus === "excluded" ? "excluded" : "needs_review"
  }
  detail.staleReview = staleReview
  detail.lastReviewDecision = stored.decisions.at(-1) ?? null
  const hasOpenRework = Object.values(detail.propertyStatuses).includes("rework_open")
  if (hasOpenRework) {
    detail.reviewBlockers = [
      ...detail.reviewBlockers,
      "Mindestens eine Eigenschaft hat offenen Rework. Löse oder bestätige sie einzeln, bevor das gesamte Produkt freigegeben wird.",
    ]
  }
  detail.canApproveProduct =
    detail.categoryBoundaryStatus === "eligible" &&
    detail.reviewStatus !== "approved" &&
    !hasOpenRework &&
    detail.reviewBlockers.length === 0
  detail.canApproveBoundary =
    detail.categoryBoundaryStatus === "excluded_product_form" && detail.reviewStatus !== "excluded"
  detail.statusLabel =
    detail.reviewStatus === "approved"
      ? "Freigegeben"
      : detail.reviewStatus === "rework_open"
        ? "Rework offen"
        : detail.reviewStatus === "excluded"
          ? "Ausschluss bestätigt"
          : staleReview
            ? "Erneut prüfen"
            : detail.statusLabel
  return detail
}

function reviewedDetails(): ConditionerResearchProductDetail[] {
  const statePath = reviewStatePath()
  const stored = statePath ? readConditionerLabReviewState(statePath) : null
  return Array.from(getFixture().detailsById.values()).map((base) =>
    applyStoredReviewState(
      base,
      stored?.products.find((product) => product.productId === base.productId),
    ),
  )
}

function queueItemFromDetail(
  detail: ConditionerResearchProductDetail,
): ConditionerResearchQueueItem {
  return {
    productId: detail.productId,
    productName: detail.productName,
    brandName: detail.brandName,
    market: detail.market,
    packSize: detail.packSize,
    statusLabel: detail.statusLabel,
    summary: detail.summary,
    uncertainFields: [...detail.uncertainFields],
    sourceConflict: detail.sourceConflict,
    excluded: detail.excluded,
    formulaStatus: detail.formulaStatus,
    profileStatus: detail.profileStatus,
    categoryBoundaryStatus: detail.categoryBoundaryStatus,
    formulaFingerprint: detail.formulaFingerprint,
    profileComplete: detail.profileComplete,
    uncertaintyCount: detail.uncertaintyCount,
    reviewStatus: detail.reviewStatus,
    priorityGroup: detail.priorityGroup,
    staleReview: detail.staleReview,
    lastReviewDecision: detail.lastReviewDecision,
  }
}

export function getConditionerResearchLabData(): ConditionerResearchLabData {
  const details = reviewedDetails()
  const base = getFixture().data
  return {
    ...base,
    summary: {
      ...base.summary,
      reviewCounts: {
        approved: details.filter((detail) => detail.reviewStatus === "approved").length,
        reworkOpen: details.filter((detail) => detail.reviewStatus === "rework_open").length,
        needsReview: details.filter((detail) => detail.reviewStatus === "needs_review").length,
        excluded: details.filter((detail) => detail.reviewStatus === "excluded").length,
      },
    },
    queueItems: details.map(queueItemFromDetail),
    initialDetail: details[0] ?? base.initialDetail,
  }
}

export function getConditionerResearchProductDetail(
  productId: string,
): ConditionerResearchProductDetail | null {
  return reviewedDetails().find((detail) => detail.productId === productId) ?? null
}

export const conditionerResearchReviewRequestSchema = z.discriminatedUnion("action", [
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
  item: ConditionerResearchProductDetail,
  reviewStatus: ConditionerResearchReviewStatus,
  propertyStatuses: Record<string, ConditionerResearchPropertyReviewStatus>,
) {
  return {
    productId: item.productId,
    formulaFingerprint: item.formulaFingerprint,
    profileFingerprint: item.profileFingerprint,
    standardVersion: item.standardVersion,
    boundary: item.categoryBoundaryStatus,
    reviewStatus,
    propertyStatuses,
    fieldFingerprints: item.fieldFingerprints,
  }
}

export function reviewConditionerResearchItem(
  input: ConditionerResearchReviewInput,
): ConditionerResearchReviewResult {
  const item = getConditionerResearchProductDetail(input.itemId)
  if (!item) return { status: "not_found", error: "Conditioner-Research-Eintrag nicht gefunden." }

  if (input.action === "approve_boundary") {
    if (!item.canApproveBoundary || item.categoryBoundaryStatus !== "excluded_product_form") {
      return {
        status: "blocked",
        item,
        blockers: ["Nur ein G0-Produktform-Ausschluss kann bestätigt werden."],
      }
    }
  } else if (!item.profile || item.categoryBoundaryStatus !== "eligible") {
    return {
      status: "blocked",
      item,
      blockers: ["Für diesen G0-Grenzfall ist kein Conditioner-Profil freigebbar."],
    }
  }

  if (input.action === "approve_product" && !item.canApproveProduct) {
    return {
      status: "blocked",
      item,
      blockers:
        item.reviewBlockers.length > 0
          ? item.reviewBlockers
          : ["Dieses Produkt ist bereits freigegeben."],
    }
  }
  if (
    (input.action === "approve_property" || input.action === "request_rework") &&
    !item.profile?.fields.some((field) => field.path === input.propertyPath)
  ) {
    return { status: "not_found", error: "Conditioner-Profilfeld nicht gefunden." }
  }
  if (
    input.action === "approve_property" &&
    item.propertyStatuses[input.propertyPath] === "approved"
  ) {
    return {
      status: "blocked",
      item,
      blockers: ["Diese Eigenschaft ist bereits freigegeben."],
    }
  }

  let reviewStatus: ConditionerResearchReviewStatus = item.reviewStatus
  let propertyStatuses = { ...item.propertyStatuses }
  if (input.action === "approve_product") {
    propertyStatuses = Object.fromEntries(
      item.profile!.fields.map((field) => [field.path, "approved" as const]),
    )
    reviewStatus = "approved"
  } else if (input.action === "approve_boundary") {
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
  if (!statePath) {
    return {
      status: "persistence_failed",
      error: "Die Review-Entscheidung ist nur im lokalen Development-Lab speicherbar.",
    }
  }
  try {
    const queuePath = reworkQueuePath()
    return withConditionerReviewPersistenceRollback(
      [statePath, ...(queuePath ? [queuePath] : [])],
      () => {
        const decision = saveConditionerLabReviewState({
          filePath: statePath,
          snapshot: reviewSnapshot(item, reviewStatus, propertyStatuses),
          decision: {
            action: input.action,
            propertyPath: "propertyPath" in input ? input.propertyPath : null,
            comment: input.comment?.trim() || null,
          },
        })
        if (queuePath && input.action === "request_rework") {
          updateConditionerReworkQueue({
            filePath: queuePath,
            operation: "open",
            entry: {
              productId: item.productId,
              productName: item.productName,
              propertyPath: input.propertyPath,
              comment: input.comment,
              formulaFingerprint: item.formulaFingerprint,
              profileFingerprint: item.profileFingerprint!,
              fieldFingerprint: item.fieldFingerprints[input.propertyPath]!,
              standardVersion: item.standardVersion,
            },
          })
        } else if (queuePath && input.action === "approve_property") {
          updateConditionerReworkQueue({
            filePath: queuePath,
            operation: "resolve",
            productId: item.productId,
            propertyPath: input.propertyPath,
          })
        } else if (queuePath && input.action === "approve_product") {
          updateConditionerReworkQueue({
            filePath: queuePath,
            operation: "resolve",
            productId: item.productId,
          })
        }
        const persisted = getConditionerResearchProductDetail(item.productId)
        if (!persisted)
          throw new Error("Gespeicherter Review-Eintrag konnte nicht neu geladen werden.")
        return { status: "accepted", item: persisted, reviewDecision: decision }
      },
    )
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
