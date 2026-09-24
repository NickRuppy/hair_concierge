import type { Stage3FitComparisonDimension } from "@/lib/personal-plan/products/comparison-dimensions"
import {
  orderedAxisFitResult,
  careDirectionAxisFitResult,
  repairSupportAxisFitResult,
} from "@/lib/personal-plan/products/authority/categories/axis-fit"
import { compactCriterionSchema } from "@/lib/personal-plan/products/fit-comparison-schema"
import type {
  PersonalPlanCategory,
  Stage3CriterionResult,
} from "@/lib/personal-plan/products/contracts"
import type { PlanProductRole } from "@/lib/personal-plan/types"
import type { ScanDimension } from "@/lib/scan/types"

import type { MobileScanRow } from "./scan-contracts"

const AXIS_DEFINITIONS: Record<string, string> = {
  "conditioner.weight":
    "Wie reichhaltig eine Formel ist. Leicht legt wenig auf, reichhaltig legt mehr auf und kann feines Haar beschweren.",
  "conditioner.care_direction":
    "Ob eine Formel eher auf feuchtigkeitsbindende Stoffe oder auf Protein setzt. Ausgeglichen enthält beides.",
  "conditioner.repair_support": "Wie stark eine Formel auf strapazierte Längen ausgelegt ist.",
  "shampoo.cleansing_intensity":
    "Wie gründlich ein Shampoo reinigt. Sanft wäscht weniger stark ab, klärend entfernt mehr Rückstände.",
  "shampoo.scalp_route":
    "Für welche Kopfhaut die Formel ausgewiesen ist: fettig, ausgeglichen, trocken, mit Schuppen, mit trockenen Schuppen oder gereizt.",
  "hair.thickness": "Für welche Haardicke die Formel ausgelegt ist: fein, mittel oder dick.",
  "heat.protection": "Ob die Formel als Hitzeschutz für Föhn und Glätteisen ausgelegt ist.",
  reaction: "Deine eigene Angabe, ob du auf dieses Produkt schon einmal reagiert hast.",
}

/**
 * Reviewed glossary copy for the native result card. Axes that do not have reviewed
 * wording intentionally fall back to their contract label; the client must never infer copy.
 */
export const AXIS_STOP_MEANINGS: Record<string, Record<string, string>> = {
  "conditioner.repair_support": {
    low: "Kaum Repair-Stoffe. Nicht auf strapazierte Längen ausgelegt.",
    medium: "Etwas Repair-Anteil. Auf leicht strapazierte Längen ausgelegt.",
    high: "Deutlich auf strapazierte Längen ausgelegt, etwa nach Färben, Blondieren oder viel Hitze.",
  },
  "conditioner.weight": {
    light: "Legt wenig auf. Für feines Haar oder schnell beschwerte Längen.",
    medium: "Legt mittelstark auf. Für die meisten Haartypen ausgelegt.",
    rich: "Legt viel auf. Für dickes, trockenes oder stark strapaziertes Haar.",
  },
  "conditioner.care_direction": {
    moisture: "Setzt auf feuchtigkeitsbindende Stoffe wie Glycerin oder Panthenol.",
    balanced: "Enthält beides, ohne klaren Schwerpunkt.",
    protein: "Setzt auf hydrolysierte Proteine, etwa Keratin oder Weizenprotein.",
  },
  "shampoo.cleansing_intensity": {
    gentle: "Wäscht weniger stark ab. Für trockene Kopfhaut oder häufiges Waschen.",
    regular: "Alltagsreinigung. Stärker als sanft, milder als klärend.",
    clarifying: "Entfernt mehr Rückstände und Talg. Für fettige Kopfhaut oder Ablagerungen.",
  },
  "shampoo.scalp_route": {
    oily: "Fettet schnell nach, oft schon am nächsten Tag.",
    balanced: "Weder fettig noch trocken.",
    dry: "Fühlt sich trocken an oder spannt, ohne Schuppen.",
    dandruff: "Sichtbare, eher fettige Schuppen.",
    dry_flakes: "Feine, trockene Schüppchen ohne fettigen Glanz.",
    irritated: "Rötungen, Jucken oder Empfindlichkeit.",
  },
  "hair.thickness": {
    fine: "Dünne einzelne Haare. Werden von reichhaltigen Formeln eher beschwert.",
    normal: "Weder auffällig dünn noch dick.",
    coarse: "Kräftige einzelne Haare. Werden von reichhaltigen Formeln seltener beschwert.",
  },
  "heat.protection": {
    true: "Vom Hersteller als Hitzeschutz ausgewiesen.",
    false: "Kein ausgewiesener Hitzeschutz.",
  },
}

export function mobileRowsFromScanDimensions(
  dimensions: readonly ScanDimension[],
  categoryFit: string | null,
  _verdict: "ideal" | "supportive" | "mismatch" | "unknown" = "unknown",
  sourceDimensions: readonly Stage3FitComparisonDimension[] = [],
  criteria: readonly Stage3CriterionResult[] = [],
): MobileScanRow[] {
  // Kept for adapter-call compatibility; a product-wide verdict never colors a row.
  void _verdict
  return dimensions.map((rawDimension) => {
    const dimension = validatedDimension(rawDimension)
    const source = sourceDimensions.find((entry) => entry.dimensionId === dimension.dimensionId)
    const axisKind = source?.presentationKind ?? inferAxisKind(dimension)
    return {
      dimensionId: dimension.dimensionId,
      label: labelFor(dimension.dimensionId, dimension.label),
      axisKind,
      definition: definitionFor(dimension.dimensionId),
      categoryFit,
      targetValue: valueLabel(dimension, dimension.targetStopIds),
      productValue:
        axisKind === "set" && dimension.state === "in_target"
          ? dimension.stops.every((stop) => dimension.productStopIds.includes(stop.stopId))
            ? "jede"
            : valueLabel(
                dimension,
                dimension.productStopIds.filter((id) => dimension.targetStopIds.includes(id)),
              )
          : valueLabel(dimension, dimension.productStopIds),
      targetStopIds: [...dimension.targetStopIds],
      productStopIds: [...dimension.productStopIds],
      state: dimension.state,
      displayStatus: displayStatus(dimension, criteria),
      stops: dimension.stops.map((stop) => ({
        id: stop.stopId,
        label: stop.label,
        meaning: stopMeaningFor(dimension.dimensionId, stop.stopId, stop.label),
      })),
    }
  })
}

export function scanDimensionsForProduct(
  dimensions: readonly Stage3FitComparisonDimension[],
  productId: string,
): ScanDimension[] {
  return dimensions.map((dimension) => {
    const position = dimension.productPositions.find(
      (entry) => entry.productId === productId,
    )?.position
    const ids = (value: typeof position | null): string[] =>
      !value || value.kind === "unknown"
        ? []
        : value.kind === "position"
          ? [value.stopId]
          : value.stopIds
    const target = ids(dimension.targetPosition)
    const product = ids(position)
    return {
      dimensionId: dimension.dimensionId,
      label: dimension.label,
      stops: dimension.stops.map((stop) => ({ stopId: stop.stopId, label: stop.label })),
      targetStopIds: target,
      productStopIds: product,
      state:
        target.length === 0
          ? "no_target"
          : product.length === 0
            ? "unknown"
            : product.some((id) => target.includes(id))
              ? "in_target"
              : "outside_target",
    }
  })
}

// Row semantics reuse the category authority, never the product-wide verdict.
function displayStatus(
  dimension: ScanDimension,
  criteria: readonly Stage3CriterionResult[],
): MobileScanRow["displayStatus"] {
  if (dimension.state === "unknown" || dimension.state === "no_target") return "neutral"
  const id = dimension.dimensionId
  const criterionId = CRITERION_BINDINGS[id] ?? id
  const criterion = criteria.find((entry) => entry.criterionId === criterionId)
  if (criterion) return statusForCriterion(criterion.result)
  const product = dimension.productStopIds[0]
  const target = dimension.targetStopIds[0]
  if (!KNOWN_DIMENSIONS.has(id)) return "neutral"
  if (dimension.state === "in_target") return "green"
  if (["conditioner.weight", "leave_in.weight"].includes(id))
    return statusForCriterion(orderedAxisFitResult(product, target, ["light", "medium", "rich"]))
  if (["conditioner.repair_support", "leave_in.repair_support"].includes(id))
    return statusForCriterion(
      repairSupportAxisFitResult(product, target, ["low", "medium", "high"]),
    )
  if (["conditioner.care_direction", "leave_in.care_direction"].includes(id))
    return statusForCriterion(careDirectionAxisFitResult(product, target))
  if (["shampoo.cleansing_intensity", "oil.weight"].includes(id)) return "amber"
  // Mask compatibility is only available from its evaluated criteria, not generic distances.
  if (id.startsWith("mask.")) return "neutral"
  if (
    id.endsWith(".suitable_thicknesses") ||
    [
      "shampoo.scalp_route",
      "oil.role_support",
      "oil.heat_protection",
      "leave_in.heat_protection",
      "bondbuilder.relationship",
    ].includes(id)
  )
    return "red"
  return "neutral"
}

const KNOWN_DIMENSIONS = new Set([
  "shampoo.cleansing_intensity",
  "shampoo.scalp_route",
  "shampoo.suitable_thicknesses",
  "conditioner.weight",
  "conditioner.care_direction",
  "conditioner.repair_support",
  "conditioner.suitable_thicknesses",
  "leave_in.weight",
  "leave_in.care_direction",
  "leave_in.repair_support",
  "leave_in.heat_protection",
  "mask.weight",
  "mask.care_direction",
  "mask.repair_support",
  "oil.role_support",
  "oil.weight",
  "oil.suitable_thicknesses",
  "oil.heat_protection",
  "bondbuilder.suitable_thicknesses",
  "bondbuilder.relationship",
])

const CRITERION_BINDINGS: Record<string, string> = {
  "conditioner.care_direction": "conditioner.balance",
  "conditioner.repair_support": "conditioner.repair",
  "conditioner.suitable_thicknesses": "conditioner.thickness",
  "shampoo.suitable_thicknesses": "shampoo.thickness",
  "leave_in.heat_protection": "leave_in.heat",
}

function statusForCriterion(
  result: Stage3CriterionResult["result"],
): MobileScanRow["displayStatus"] {
  return ({ pass: "green", caution: "amber", fail: "red", unknown: "neutral" } as const)[result]
}

function labelFor(id: string, fallback: string): string {
  return (
    (
      {
        weight: "Pflegegewicht",
        care_direction: "Pflegerichtung",
        repair_support: "Repair-Pflege",
        suitable_thicknesses: "Haardicke",
        cleansing_intensity: "Reinigung",
        scalp_route: "Kopfhaut",
        heat_protection: "Hitzeschutz",
        safety: "Verträglichkeit",
      } as Record<string, string>
    )[id.split(".").slice(1).join(".")] ?? fallback
  )
}

function definitionFor(id: string): string {
  const property = id.split(".").slice(1).join(".")
  const canonical = (
    {
      weight: "conditioner.weight",
      care_direction: "conditioner.care_direction",
      repair_support: "conditioner.repair_support",
      suitable_thicknesses: "hair.thickness",
      heat_protection: "heat.protection",
      safety: "reaction",
    } as Record<string, string>
  )[property]
  return (
    AXIS_DEFINITIONS[id] ??
    AXIS_DEFINITIONS[canonical] ??
    (
      {
        "oil.role_support": "Ob das Öl für den vorgesehenen Einsatz ausgewiesen ist.",
        "bondbuilder.relationship":
          "Ob das Produkt eigenständig oder nur zusammen mit einem weiteren Produkt eingesetzt werden kann.",
      } as Record<string, string>
    )[id] ??
    "Ob diese Anforderung für das Produkt bestätigt ist."
  )
}

function validatedDimension(dimension: ScanDimension): ScanDimension {
  const valid = (ids: readonly string[]) =>
    ids.length > 0 && ids.every((id) => dimension.stops.some((stop) => stop.stopId === id))
  const targetStopIds = valid(dimension.targetStopIds) ? dimension.targetStopIds : []
  const productStopIds = valid(dimension.productStopIds) ? dimension.productStopIds : []
  return {
    ...dimension,
    targetStopIds,
    productStopIds,
    state:
      targetStopIds.length === 0
        ? "no_target"
        : productStopIds.length === 0
          ? "unknown"
          : productStopIds.some((id) => targetStopIds.includes(id))
            ? "in_target"
            : "outside_target",
  }
}

/** Compact categories expose the complete evaluated criteria, including rows beyond the web cap. */
export function mobileCriterionRows(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  criteria: readonly Stage3CriterionResult[],
  categoryFit: string | null,
): MobileScanRow[] {
  const schema = compactCriterionSchema(category, role)
  const ids = [
    ...new Set([
      ...schema.map((row) => row.criterionId),
      ...criteria.map((row) => row.criterionId),
    ]),
  ]
  return ids.map((id) => {
    const criterion = criteria.find((row) => row.criterionId === id)
    const result = criterion?.result ?? "unknown"
    const labels = {
      pass: "erfüllt",
      caution: "teilweise",
      fail: "nicht erfüllt",
      unknown: "nicht bestätigt",
    }
    return {
      dimensionId: id,
      label: schema.find((row) => row.criterionId === id)?.label ?? criterion!.label,
      axisKind: "categorical",
      definition:
        id === "heat_protectant.capability"
          ? AXIS_DEFINITIONS["heat.protection"]
          : id.endsWith(".safety")
            ? AXIS_DEFINITIONS.reaction
            : (criterion?.explanation ?? "Ob diese Anforderung für das Produkt bestätigt ist."),
      categoryFit,
      targetValue: "erfüllt",
      productValue: result === "unknown" ? null : labels[result],
      targetStopIds: ["pass"],
      productStopIds: result === "unknown" ? [] : [result],
      state: result === "unknown" ? "unknown" : result === "pass" ? "in_target" : "outside_target",
      displayStatus: statusForCriterion(result),
      stops: ["pass", "caution", "fail"].map((stopId) => {
        const label = labels[stopId as keyof typeof labels]
        return { id: stopId, label, meaning: stopMeaningFor(id, stopId, label) }
      }),
    }
  })
}

export function mobileAssessmentRows(
  category: PersonalPlanCategory,
  role: PlanProductRole,
  productId: string,
  dimensions: readonly Stage3FitComparisonDimension[],
  criteria: readonly Stage3CriterionResult[],
  categoryFit: string | null,
): MobileScanRow[] {
  if (dimensions.length === 0) return mobileCriterionRows(category, role, criteria, categoryFit)
  const rows = mobileRowsFromScanDimensions(
    scanDimensionsForProduct(dimensions, productId),
    categoryFit,
    "unknown",
    dimensions,
    criteria,
  )
  // Early-return authority failures (e.g. safety or role) must not disappear behind otherwise matching rails.
  const mapped = new Set(
    dimensions.map((row) => CRITERION_BINDINGS[row.dimensionId] ?? row.dimensionId),
  )
  return [
    ...rows,
    ...mobileCriterionRows(
      category,
      role,
      criteria.filter(
        (row) =>
          (row.result === "fail" || row.result === "caution") &&
          !mapped.has(row.criterionId) &&
          !row.criterionId.endsWith(".fit"),
      ),
      categoryFit,
    ),
  ]
}

export function mobileVerdictTitle(
  verdict: "ideal" | "supportive" | "mismatch",
  rows: readonly MobileScanRow[],
): string {
  if (verdict === "ideal") return "Passt zu deinem Haar"
  if (verdict === "supportive") return "Passt mit Einschränkung"
  return rows.some(
    (row) => row.dimensionId === "shampoo.scalp_route" && row.displayStatus === "red",
  )
    ? "Passt nicht zu deiner Kopfhaut"
    : "Passt nicht zu deinem Haar"
}

/** One off-target row as „<Eigenschaft>: <Produktwert> statt <Zielwert>". */
export function mobileRowDifferenceText(row: MobileScanRow): string {
  return `${row.label}: ${
    row.stops
      .filter((stop) => row.productStopIds.includes(stop.id))
      .map((stop) => stop.label)
      .join(", ") ||
    row.productValue ||
    "Keine Angabe"
  } statt ${row.targetValue ?? "kein Ziel"}`
}

export function mobileMismatchSummary(rows: readonly MobileScanRow[]): string {
  const differences = rows
    .filter((row) => row.displayStatus === "amber" || row.displayStatus === "red")
    .map(mobileRowDifferenceText)
  if (differences.length > 0) return differences.join(" · ")
  return rows.length === 0 || rows.some((row) => row.displayStatus === "neutral")
    ? "Noch nicht vollständig einschätzbar."
    : "Alles im Ziel."
}

function inferAxisKind(dimension: ScanDimension): MobileScanRow["axisKind"] {
  if (
    dimension.dimensionId.endsWith(".care_direction") ||
    dimension.dimensionId.endsWith(".relationship")
  )
    return "categorical"
  if (
    dimension.dimensionId.endsWith(".suitable_thicknesses") ||
    dimension.dimensionId === "shampoo.scalp_route"
  )
    return "set"
  if (
    dimension.dimensionId.includes("heat") ||
    dimension.dimensionId.includes("reaction") ||
    dimension.dimensionId === "oil.role_support"
  )
    return "binary"
  return dimension.productStopIds.length > 1 || dimension.targetStopIds.length > 1
    ? "set"
    : "ordered"
}

function stopMeaningFor(dimensionId: string, stopId: string, label: string): string {
  const property = dimensionId.split(".").slice(1).join(".")
  const canonical =
    (
      {
        weight: "conditioner.weight",
        care_direction: "conditioner.care_direction",
        repair_support: "conditioner.repair_support",
        suitable_thicknesses: "hair.thickness",
        heat_protection: "heat.protection",
      } as Record<string, string>
    )[property] ?? dimensionId
  const key = KNOWN_DIMENSIONS.has(dimensionId) ? canonical : dimensionId
  const meaning = AXIS_STOP_MEANINGS[key]?.[stopId]
  return typeof meaning === "string" ? meaning : label
}

function valueLabel(dimension: ScanDimension, ids: readonly string[]): string | null {
  if (ids.length === 0) return null
  const labels = dimension.stops
    .filter((stop) => ids.includes(stop.stopId))
    .map((stop) => stop.label)
  return labels.length > 0 ? labels.join(", ") : null
}
