import type { PlanProductRole } from "@/lib/personal-plan/types"

import type { PersonalPlanCategory, Stage3CriterionResult } from "./contracts"
import type { Stage3AuthorityInput, Stage3CategoryProductFacts } from "./authority/contracts"
import { maskAcceptedCareDirections } from "./authority/categories/axis-fit"
import { expectedShampooSpecTarget } from "./authority/categories/shampoo-spec-target"
import { compactCriterionSchema } from "./fit-comparison-schema"
import { BUDGET_NEED_DIMENSIONS, type BudgetCandidateView } from "./budget-policy"

export type Stage3FitComparisonPresentationKind = "ordered" | "set" | "binary" | "categorical"

export type Stage3FitComparisonStop = {
  stopId: string
  label: string
}

export type Stage3FitComparisonPosition =
  | { kind: "position"; stopId: string }
  | { kind: "supported_stops"; stopIds: string[] }
  | { kind: "unknown" }

export type Stage3FitComparisonProduct = {
  productId: string
  displayName: string
  presentationImageUrl?: string | null
  presentation?: {
    priceLabel: string | null
    netContentLabel: string | null
    /** Budget fields: present only on budgeted alternatives, absent (not null) otherwise. */
    packagePriceEur?: number | null
    overBudget?: boolean
    labelKind?: BudgetCandidateView["label"]
    /** Drogerie/Profi badge: shampoo/conditioner/mask behind the display flag only, else absent. */
    marketSegment?: "drugstore" | "professional"
  }
  category: PersonalPlanCategory
  role: PlanProductRole | null
  source: "current" | "alternative"
}

export type Stage3FitComparisonDimension = {
  dimensionId: string
  label: string
  presentationKind: Stage3FitComparisonPresentationKind
  stops: Stage3FitComparisonStop[]
  targetPosition: Stage3FitComparisonPosition | null
  productPositions: Array<{
    productId: string
    position: Stage3FitComparisonPosition
  }>
  reason: string
}

export type ComparisonProductEntry = {
  product: Stage3FitComparisonProduct
  facts: Stage3CategoryProductFacts
}

export const STAGE3_RENDERED_DIMENSION_CAP = 4

export function renderedDimensions(
  dimensions: readonly Stage3FitComparisonDimension[],
): Stage3FitComparisonDimension[] {
  return dimensions.slice(0, STAGE3_RENDERED_DIMENSION_CAP)
}

function singleCandidateEntry(
  input: Stage3AuthorityInput,
  candidate: Stage3CategoryProductFacts,
): ComparisonProductEntry {
  return {
    product: {
      productId: candidate.productId,
      displayName: candidate.displayName,
      category: candidate.category,
      role: input.role,
      source: "alternative",
    },
    facts: candidate,
  }
}

export function candidateDimensionCoverage(
  input: Stage3AuthorityInput,
  candidate: Stage3CategoryProductFacts,
  criteria: readonly Stage3CriterionResult[],
): { matches: number; total: number } {
  const entry = singleCandidateEntry(input, candidate)
  const dimensions = renderedDimensions(comparisonDimensions(input, [entry]))
  if (dimensions.length > 0 || input.category === "bondbuilder") {
    const targetDimensions = dimensions.filter(
      (dimension) => dimension.targetPosition && dimension.targetPosition.kind !== "unknown",
    )
    // The application row is displayed outside the axis model. Keep verified Bondbuilders
    // selectable after removing diameter; do not substitute an invisible fit criterion.
    const applicationMatches =
      input.category === "bondbuilder" &&
      criteria.some(
        (criterion) =>
          criterion.criterionId === "bondbuilder.protocol" && criterion.result === "pass",
      )
        ? 1
        : 0
    return {
      total: targetDimensions.length + (input.category === "bondbuilder" ? 1 : 0),
      matches:
        applicationMatches +
        targetDimensions.filter((dimension) => {
          const position = dimension.productPositions[0]?.position ?? { kind: "unknown" as const }
          return positionsOverlap(position, dimension.targetPosition!)
        }).length,
    }
  }

  const schema = compactCriterionSchema(input.category, input.role)
  return {
    total: schema.length,
    matches: schema.filter(
      ({ criterionId }) =>
        criteria.find((criterion) => criterion.criterionId === criterionId)?.result === "pass",
    ).length,
  }
}

/**
 * Distance to the user's target per graded need dimension (`BUDGET_NEED_DIMENSIONS`) for one
 * candidate: 0 when the product's position overlaps the target, otherwise the smallest number of
 * ordered stops between them. Overshooting the target counts like any other distance. A
 * dimension whose target or product position is unknown is omitted (unknown, not "far").
 */
export function budgetNeedDistances(
  input: Stage3AuthorityInput,
  candidate: Stage3CategoryProductFacts,
): Record<string, number> {
  const distances: Record<string, number> = {}
  for (const dimension of comparisonDimensions(input, [singleCandidateEntry(input, candidate)])) {
    if (!BUDGET_NEED_DIMENSIONS.has(dimension.dimensionId)) continue
    const target = dimension.targetPosition
    const position = dimension.productPositions[0]?.position
    if (!target || !position) continue
    const distance = positionDistance(position, target, dimension.stops)
    if (distance !== null) distances[dimension.dimensionId] = distance
  }
  return distances
}

function positionDistance(
  product: Stage3FitComparisonPosition,
  target: Stage3FitComparisonPosition,
  stops: readonly Stage3FitComparisonStop[],
): number | null {
  if (product.kind === "unknown" || target.kind === "unknown") return null
  if (positionsOverlap(product, target)) return 0
  const stopIndex = new Map(stops.map((stop, index) => [stop.stopId, index]))
  const indexes = (position: Exclude<Stage3FitComparisonPosition, { kind: "unknown" }>) =>
    (position.kind === "position" ? [position.stopId] : position.stopIds).flatMap((stopId) => {
      const index = stopIndex.get(stopId)
      return index === undefined ? [] : [index]
    })
  const productIndexes = indexes(product)
  const targetIndexes = indexes(target)
  if (productIndexes.length === 0 || targetIndexes.length === 0) return null
  return Math.min(
    ...productIndexes.flatMap((left) => targetIndexes.map((right) => Math.abs(left - right))),
  )
}

export function comparisonDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  if (entries.length === 0) return []
  switch (input.category) {
    case "shampoo":
      if (input.role === "shampoo_dandruff") return []
      return shampooDimensions(input, entries)
    case "conditioner":
      return conditionerDimensions(input, entries)
    case "leave_in":
      return leaveInDimensions(input, entries)
    case "mask":
      return maskDimensions(input, entries)
    case "oil":
      return oilDimensions(input, entries)
    case "bondbuilder":
      return bondbuilderDimensions(entries)
    case "heat_protectant":
    case "scalp_care":
    case "dry_shampoo":
    case "deep_cleansing_shampoo":
      return []
  }
}

function shampooDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  const completeTarget =
    target?.category === "shampoo" ? expectedShampooSpecTarget({ role: input.role, target }) : null
  const scalpRouteStops = [
    { stopId: "oily", label: "fettig" },
    { stopId: "balanced", label: "ausgeglichen" },
    { stopId: "dry", label: "trocken" },
    { stopId: "dandruff", label: "Schuppen" },
    { stopId: "dry_flakes", label: "trockene Schuppen" },
    { stopId: "irritated", label: "gereizt" },
  ]
  return [
    dimension(
      "shampoo.cleansing_intensity",
      "Reinigungsintensität",
      "ordered",
      [
        { stopId: "gentle", label: "sanft" },
        { stopId: "regular", label: "regulär" },
        { stopId: "clarifying", label: "klärend" },
      ],
      completeTarget?.cleansingIntensity ?? null,
      entries,
      (facts) =>
        facts.category === "shampoo"
          ? (facts.comparisonObservations?.cleansingIntensity ?? facts.spec.cleansingIntensity)
          : null,
      "Shampoo V1 zeigt gespeicherte Produktwerte ohne erfundenen Zielkorridor.",
    ),
    dimension(
      "shampoo.scalp_route",
      "Kopfhaut-Fokus",
      "set",
      scalpRouteStops,
      completeTarget?.scalpRoute ?? (target?.category === "shampoo" ? target.scalpRoute : null),
      entries,
      (facts) =>
        facts.category === "shampoo"
          ? facts.comparisonObservations?.supportedScalpRoutes.length
            ? facts.comparisonObservations.supportedScalpRoutes
            : facts.spec.scalpRoute
          : null,
      "Der Kopfhaut-Fokus kommt aus dem bestätigten Shampoo-Ziel.",
    ),
    dimension(
      "shampoo.suitable_thicknesses",
      "Geeignete Haardicke",
      "set",
      THICKNESS_STOPS,
      input.hairThickness ?? null,
      entries,
      (facts) => facts.suitableThicknesses,
      "Die Haardicken-Eignung nutzt nur gespeicherte Katalogwerte.",
    ),
  ]
}

function conditionerDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  return [
    dimension(
      "conditioner.weight",
      "Pflegegewicht",
      "ordered",
      WEIGHT_STOPS,
      target?.category === "conditioner" ? target.weight : null,
      entries,
      (facts) => (facts.category === "conditioner" ? facts.spec.weight : null),
      "Das Pflegegewicht wird mit dem bestätigten Conditioner-Ziel abgeglichen.",
    ),
    dimension(
      "conditioner.care_direction",
      "Pflegerichtung",
      "categorical",
      CARE_DIRECTION_STOPS,
      target?.category === "conditioner" ? target.careDirection : null,
      entries,
      // The comparison rail intentionally uses the rerank observation. Authority continues to
      // evaluate proteinMoistureBalance against the selected target; these are separate facts.
      (facts) =>
        facts.category === "conditioner"
          ? canonicalCareDirection(facts.spec.balanceDirection)
          : null,
      "Die Pflegerichtung kommt aus Zielprofil und exakten Produktfakten.",
    ),
    dimension(
      "conditioner.repair_support",
      "Repair-Unterstützung",
      "ordered",
      REPAIR_STOPS,
      target?.category === "conditioner" ? target.repairSupportLevel : null,
      entries,
      (facts) => (facts.category === "conditioner" ? facts.spec.repairSupportLevel : null),
      "Die Repair-Unterstützung bleibt eine explizite Katalogachse.",
    ),
    dimension(
      "conditioner.suitable_thicknesses",
      "Geeignete Haardicke",
      "set",
      THICKNESS_STOPS,
      input.hairThickness ?? null,
      entries,
      (facts) => facts.suitableThicknesses,
      "Die Haardicken-Eignung nutzt nur gespeicherte Katalogwerte.",
    ),
  ]
}

function canonicalCareDirection(value: string | null): "moisture" | "balanced" | "protein" | null {
  if (value === "moisture" || value === "snaps") return "moisture"
  if (value === "balanced" || value === "stretches_bounces") return "balanced"
  if (value === "protein" || value === "stretches_stays") return "protein"
  return null
}

function leaveInDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  const includeHeatDimension = input.role === "pre_heat_application"
  const third = includeHeatDimension
    ? dimension(
        "leave_in.heat_protection",
        "Hitzeschutz",
        "binary",
        BINARY_STOPS,
        true,
        entries,
        (facts) => (facts.category === "leave_in" ? facts.spec.providesHeatProtection : null),
        "Hitzeschutz wird nur gezeigt, wenn die Hitzerolle tatsächlich gefordert ist.",
      )
    : dimension(
        "leave_in.repair_support",
        "Repair-Unterstützung",
        "ordered",
        REPAIR_STOPS,
        target?.category === "leave_in" ? target.repairSupportLevel : null,
        entries,
        (facts) => (facts.category === "leave_in" ? facts.spec.repairSupportLevel : null),
        "Die Repair-Unterstützung bleibt eine explizite Katalogachse.",
      )
  return [
    dimension(
      "leave_in.weight",
      "Pflegegewicht",
      "ordered",
      WEIGHT_STOPS,
      target?.category === "leave_in" ? target.weight : null,
      entries,
      (facts) => (facts.category === "leave_in" ? facts.spec.weight : null),
      "Das Pflegegewicht wird mit dem bestätigten Leave-in-Ziel abgeglichen.",
    ),
    dimension(
      "leave_in.care_direction",
      "Pflegerichtung",
      "categorical",
      CARE_DIRECTION_STOPS,
      target?.category === "leave_in" ? target.careDirection : null,
      entries,
      (facts) => (facts.category === "leave_in" ? facts.spec.careDirection : null),
      "Die Pflegerichtung kommt aus Zielprofil und exakten Produktfakten.",
    ),
    third,
  ]
}

function maskDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  return [
    dimension(
      "mask.weight",
      "Pflegegewicht",
      "ordered",
      WEIGHT_STOPS,
      target?.category === "mask" ? target.weight : null,
      entries,
      (facts) => (facts.category === "mask" ? facts.spec.weight : null),
      "Das Pflegegewicht wird mit dem bestätigten Masken-Ziel abgeglichen.",
    ),
    dimension(
      "mask.care_direction",
      "Pflegerichtung",
      "categorical",
      CARE_DIRECTION_STOPS,
      // R12: the target carries every direction the mask authority accepts, primary first.
      target?.category === "mask" ? maskAcceptedCareDirections(target) : null,
      entries,
      (facts) => (facts.category === "mask" ? facts.spec.careDirection : null),
      "Die Pflegerichtung kommt aus Zielprofil und exakten Produktfakten.",
    ),
    dimension(
      "mask.repair_support",
      "Repair-Unterstützung",
      "ordered",
      REPAIR_STOPS,
      target?.category === "mask" ? target.repairSupportLevel : null,
      entries,
      (facts) => (facts.category === "mask" ? facts.spec.repairSupportLevel : null),
      "Die Repair-Unterstützung bleibt eine explizite Katalogachse.",
    ),
  ]
}

function oilDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  const roleTarget =
    target?.category === "oil"
      ? (target.roleTargets.find((item) => item.role === input.role) ?? null)
      : null
  const application = dimension(
    "oil.role_support",
    "Unterstützte Einsätze",
    "binary",
    BINARY_STOPS,
    true,
    entries,
    (facts) => (facts.category === "oil" ? (facts.spec.roleSupport[input.role] ?? null) : null),
    "Die Rollenunterstützung bleibt ein expliziter Katalogwert.",
  )
  const thickness = dimension(
    "oil.suitable_thicknesses",
    "Geeignete Haardicke",
    "set",
    THICKNESS_STOPS,
    input.hairThickness ?? null,
    entries,
    (facts) => facts.suitableThicknesses,
    "Die Haardicken-Eignung nutzt nur gespeicherte Katalogwerte.",
  )
  if (input.role === "pre_wash_fibre_treatment") {
    return [application, thickness]
  }
  const heatCapability =
    input.role === "leave_on_fibre_conditioning" &&
    input.coverage.some((fact) => fact.job === "heat_protection")
      ? dimension(
          "oil.heat_protection",
          "Hitzeschutz",
          "binary",
          BINARY_STOPS,
          true,
          entries,
          (facts) => (facts.category === "oil" ? facts.spec.providesHeatProtection : null),
          "Hitzeschutz bleibt eine unabhängig bestätigte Produkteigenschaft.",
        )
      : null
  return [
    application,
    ...(heatCapability ? [heatCapability] : []),
    dimension(
      "oil.weight",
      "Pflegegewicht",
      "ordered",
      WEIGHT_STOPS,
      roleTarget?.weight ?? null,
      entries,
      (facts) => (facts.category === "oil" ? facts.spec.weight : null),
      "Das Öl-Gewicht wird nur für Leave-on-Rollen als Zielachse genutzt.",
    ),
    thickness,
  ]
}

function bondbuilderDimensions(
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  // The standalone axis only earns a row when it actually separates the displayed products.
  const showsRelationship = entries.some(
    (entry) => entry.facts.category === "bondbuilder" && entry.facts.spec.relationship === "add_on",
  )
  if (!showsRelationship) return []
  return [
    dimension(
      "bondbuilder.relationship",
      "Wirkt eigenständig",
      "categorical",
      BONDBUILDER_RELATIONSHIP_STOPS,
      "standalone",
      entries,
      (facts) => (facts.category === "bondbuilder" ? facts.spec.relationship : null),
      "Die Rollenbeziehung bleibt ein expliziter Katalogwert.",
    ),
  ]
}

function dimension(
  dimensionId: string,
  label: string,
  presentationKind: Stage3FitComparisonPresentationKind,
  stops: readonly Stage3FitComparisonStop[],
  target: string | boolean | readonly string[] | null,
  entries: readonly ComparisonProductEntry[],
  valueFor: (facts: Stage3CategoryProductFacts) => string | boolean | readonly string[] | null,
  reason: string,
): Stage3FitComparisonDimension {
  return {
    dimensionId,
    label,
    presentationKind,
    stops: stops.map((stop) => ({ ...stop })),
    targetPosition:
      target === null
        ? null
        : isStopIdList(target)
          ? target.length > 1 || presentationKind === "set"
            ? setPosition(target, stops)
            : scalarPosition(target[0], stops)
          : presentationKind === "set"
            ? setPosition([String(target)], stops)
            : scalarPosition(target, stops),
    productPositions: entries.map((entry) => ({
      productId: entry.product.productId,
      position: positionForValue(valueFor(entry.facts), presentationKind, stops),
    })),
    reason,
  }
}

const WEIGHT_STOPS = [
  { stopId: "light", label: "leicht" },
  { stopId: "medium", label: "mittel" },
  { stopId: "rich", label: "reichhaltig" },
] as const

const CARE_DIRECTION_STOPS = [
  { stopId: "moisture", label: "Feuchtigkeit" },
  { stopId: "balanced", label: "ausgeglichen" },
  { stopId: "protein", label: "Protein" },
] as const

const REPAIR_STOPS = [
  { stopId: "low", label: "niedrig" },
  { stopId: "medium", label: "mittel" },
  { stopId: "high", label: "hoch" },
] as const

const THICKNESS_STOPS = [
  { stopId: "fine", label: "fein" },
  { stopId: "normal", label: "mittel" },
  { stopId: "coarse", label: "dick" },
] as const

const BONDBUILDER_RELATIONSHIP_STOPS = [
  { stopId: "standalone", label: "eigenständig" },
  { stopId: "add_on", label: "nur ergänzend" },
] as const

const BINARY_STOPS = [
  { stopId: "true", label: "ja" },
  { stopId: "false", label: "nein" },
] as const

// Array.isArray does not narrow readonly arrays out of a union; a guard keeps the target cast-free.
function isStopIdList(value: string | boolean | readonly string[]): value is readonly string[] {
  return Array.isArray(value)
}

function positionForValue(
  value: string | boolean | readonly string[] | null,
  presentationKind: Stage3FitComparisonPresentationKind,
  stops: readonly Stage3FitComparisonStop[],
): Stage3FitComparisonPosition {
  if (value === null) return { kind: "unknown" }
  if (presentationKind === "set") {
    return Array.isArray(value) ? setPosition(value, stops) : setPosition([String(value)], stops)
  }
  if (Array.isArray(value)) return { kind: "unknown" }
  return scalarPosition(value as string | boolean, stops)
}

function scalarPosition(
  value: string | boolean,
  stops: readonly Stage3FitComparisonStop[],
): Stage3FitComparisonPosition {
  const stopId = String(value)
  return stops.some((stop) => stop.stopId === stopId)
    ? { kind: "position", stopId }
    : { kind: "unknown" }
}

function setPosition(
  values: readonly string[],
  stops: readonly Stage3FitComparisonStop[],
): Stage3FitComparisonPosition {
  const knownStopIds = new Set(stops.map((stop) => stop.stopId))
  const stopIds = values.filter((value) => knownStopIds.has(value))
  return stopIds.length > 0 ? { kind: "supported_stops", stopIds } : { kind: "unknown" }
}

export function positionsOverlap(
  left: Stage3FitComparisonPosition,
  right: Stage3FitComparisonPosition,
): boolean {
  if (left.kind === "unknown" || right.kind === "unknown") return false
  const leftStops = left.kind === "position" ? [left.stopId] : left.stopIds
  const rightStops = new Set(right.kind === "position" ? [right.stopId] : right.stopIds)
  return leftStops.some((stopId) => rightStops.has(stopId))
}

/** An accepted categorical set reads primary first: „Feuchtigkeit · ausgeglichen ok“. */
export function acceptedSetLabel(labels: readonly string[]): string {
  const [primary, ...accepted] = labels
  return [primary, ...accepted.map((label) => `${label} ok`)].join(" · ")
}

/** Target label: categorical targets with several accepted stops name the whole accepted set. */
export function targetPositionLabel(
  position: Stage3FitComparisonPosition,
  stops: readonly Stage3FitComparisonStop[],
  presentationKind: Stage3FitComparisonPresentationKind,
): string {
  if (presentationKind !== "categorical" || position.kind !== "supported_stops")
    return positionLabel(position, stops)
  return acceptedSetLabel(
    position.stopIds.map((id) => stops.find((stop) => stop.stopId === id)?.label ?? id),
  )
}

export function positionLabel(
  position: Stage3FitComparisonPosition,
  stops: readonly Stage3FitComparisonStop[],
): string {
  if (position.kind === "unknown") return "nicht bestätigt"
  const ids = position.kind === "position" ? [position.stopId] : position.stopIds
  const labels = ids.map((id) => stops.find((stop) => stop.stopId === id)?.label ?? id)
  return labels.join(", ")
}
