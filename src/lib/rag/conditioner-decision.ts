import {
  CONDITIONER_REPAIR_LEVEL_LABELS,
  type ConditionerRepairLevel,
  type ConditionerWeight,
  type ProductConditionerSpecs,
} from "@/lib/conditioner/constants"
import { mapProteinMoistureToConcernCode } from "@/lib/rag/conditioner-mapper"
import type {
  ConditionerBalanceNeed,
  ConditionerDecision,
  ConditionerMatchedProfile,
  ConditionerProfileField,
  ConditionerRecommendationMetadata,
  HairProfile,
} from "@/lib/types"
import type { MatchedProduct } from "@/lib/rag/product-matcher"

const CONDITIONER_CLARIFICATION_QUESTIONS: Record<ConditionerProfileField, string> = {
  thickness: "Ist dein Haar eher fein, mittel oder dick?",
  protein_moisture_balance:
    "Hast du mal den Zugtest gemacht? Einzelnes Haar ziehen - bricht es direkt, dehnt es sich, oder federt es zurueck?",
}

const CONDITIONER_FIELD_ORDER: ConditionerProfileField[] = [
  "thickness",
  "protein_moisture_balance",
]

const THICKNESS_REASON_LABELS = {
  fine: "feinem",
  normal: "mittelstarkem",
  coarse: "dickem",
} as const

const DENSITY_REASON_LABELS = {
  low: "geringer Dichte",
  medium: "mittlerer Dichte",
  high: "hoher Dichte",
} as const

const BALANCE_NEED_LABELS: Record<ConditionerBalanceNeed, string> = {
  moisture: "Feuchtigkeit",
  balanced: "ausgewogene Pflege",
  protein: "Protein",
}

const WEIGHT_INDEX: Record<ConditionerWeight, number> = {
  light: 0,
  medium: 1,
  rich: 2,
}

const REPAIR_INDEX: Record<ConditionerRepairLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
}

function getMissingProfileFields(profile: HairProfile | null): ConditionerProfileField[] {
  const missing: ConditionerProfileField[] = []

  if (!profile?.thickness) missing.push("thickness")
  if (!profile?.protein_moisture_balance) missing.push("protein_moisture_balance")

  return missing
}

function toBaseScore(product: MatchedProduct): number {
  if (typeof product.combined_score === "number" && Number.isFinite(product.combined_score)) {
    return product.combined_score * 100
  }
  if (typeof product.similarity === "number" && Number.isFinite(product.similarity)) {
    return product.similarity * 100
  }
  return 0
}

function deriveBalanceNeed(profile: HairProfile | null): ConditionerBalanceNeed | null {
  switch (profile?.protein_moisture_balance) {
    case "snaps":
      return "moisture"
    case "stretches_stays":
      return "protein"
    case "stretches_bounces":
      return "balanced"
    default:
      return null
  }
}

function maxRepairLevel(
  current: ConditionerRepairLevel | null,
  next: ConditionerRepairLevel | null,
): ConditionerRepairLevel | null {
  if (!current) return next
  if (!next) return current
  return REPAIR_INDEX[next] > REPAIR_INDEX[current] ? next : current
}

export function deriveConditionerRepairLevel(
  profile: HairProfile | null,
): ConditionerRepairLevel | null {
  let level: ConditionerRepairLevel | null = null

  switch (profile?.cuticle_condition) {
    case "smooth":
      level = maxRepairLevel(level, "low")
      break
    case "slightly_rough":
      level = maxRepairLevel(level, "medium")
      break
    case "rough":
      level = maxRepairLevel(level, "high")
      break
  }

  const treatments = profile?.chemical_treatment ?? []
  if (treatments.includes("colored")) {
    level = maxRepairLevel(level, "medium")
  }
  if (treatments.includes("bleached")) {
    level = maxRepairLevel(level, "high")
  }
  if (!level && treatments.includes("natural")) {
    level = "low"
  }

  return level
}

export function deriveExpectedConditionerWeight(
  profile: HairProfile | null,
): ConditionerWeight | null {
  if (!profile?.thickness || !profile.density) return null

  if (profile.thickness === "fine") {
    return profile.density === "low" ? "light" : "medium"
  }

  if (profile.thickness === "normal") {
    if (profile.density === "low") return "light"
    if (profile.density === "medium") return "medium"
    return "rich"
  }

  if (profile.density === "low") return "medium"
  return "rich"
}

export function buildConditionerDecision(
  profile: HairProfile | null,
  candidateCount = 0,
): ConditionerDecision {
  const missingProfileFields = getMissingProfileFields(profile)
  const matchedProfile: ConditionerMatchedProfile = {
    thickness: profile?.thickness ?? null,
    density: profile?.density ?? null,
    protein_moisture_balance: profile?.protein_moisture_balance ?? null,
    cuticle_condition: profile?.cuticle_condition ?? null,
    chemical_treatment: profile?.chemical_treatment ?? [],
  }
  const eligible = missingProfileFields.length === 0
  const matchedConcernCode = mapProteinMoistureToConcernCode(profile?.protein_moisture_balance)
  const matchedBalanceNeed = deriveBalanceNeed(profile)
  const matchedRepairLevel = deriveConditionerRepairLevel(profile)
  const matchedWeight = deriveExpectedConditionerWeight(profile)

  return {
    category: "conditioner",
    eligible,
    missing_profile_fields: missingProfileFields,
    matched_profile: matchedProfile,
    matched_concern_code: matchedConcernCode,
    matched_weight: matchedWeight,
    matched_repair_level: matchedRepairLevel,
    matched_balance_need: matchedBalanceNeed,
    candidate_count: candidateCount,
    no_catalog_match: eligible && candidateCount === 0,
    used_density: Boolean(profile?.density),
  }
}

export function buildConditionerClarificationQuestions(decision: ConditionerDecision): string[] {
  return CONDITIONER_FIELD_ORDER
    .filter((field) => decision.missing_profile_fields.includes(field))
    .map((field) => CONDITIONER_CLARIFICATION_QUESTIONS[field])
}

type ScoreEntry = {
  points: number
  reason: string
}

function scoreWeightFit(
  decision: ConditionerDecision,
  spec: ProductConditionerSpecs | null,
): { points: number; positive?: string; negative?: string } {
  if (!decision.matched_weight || !spec) return { points: 0 }

  if (
    decision.matched_profile.thickness === "fine" &&
    decision.matched_profile.density === "low" &&
    spec.weight === "rich"
  ) {
    return {
      points: -12,
      negative: "Fuer feines Haar mit geringer Dichte wahrscheinlich zu reichhaltig.",
    }
  }

  const distance = Math.abs(WEIGHT_INDEX[decision.matched_weight] - WEIGHT_INDEX[spec.weight])
  if (distance === 0) {
    const densityLabel = decision.matched_profile.density
      ? DENSITY_REASON_LABELS[decision.matched_profile.density]
      : "deiner Dichte"
    return {
      points: 12,
      positive: `Das Gewicht passt gut zu ${THICKNESS_REASON_LABELS[decision.matched_profile.thickness ?? "normal"]} Haar mit ${densityLabel}.`,
    }
  }

  if (distance === 1) {
    return {
      points: 5,
      positive: "Das Gewicht ist eine brauchbare Naeheoption fuer dein Haarprofil.",
    }
  }

  return {
    points: -7,
    negative: "Das Gewicht ist fuer dein Haarprofil eher nicht die erste Wahl.",
  }
}

function scoreRepairFit(
  decision: ConditionerDecision,
  spec: ProductConditionerSpecs | null,
): { points: number; positive?: string; negative?: string } {
  if (!decision.matched_repair_level || !spec) return { points: 0 }

  const expectedIndex = REPAIR_INDEX[decision.matched_repair_level]
  const actualIndex = REPAIR_INDEX[spec.repair_level]
  const distance = Math.abs(expectedIndex - actualIndex)

  if (distance === 0) {
    return {
      points: 10,
      positive: `Das Repair-Level passt gut zu deinem aktuellen Bedarf (${CONDITIONER_REPAIR_LEVEL_LABELS[decision.matched_repair_level]}).`,
    }
  }

  if (distance === 1) {
    if (actualIndex > expectedIndex) {
      return {
        points: -3,
        negative: "Pflegt reparierender als aktuell noetig.",
      }
    }
    return {
      points: -5,
      negative: "Koennte fuer deinen aktuellen Reparaturbedarf etwas zu leicht sein.",
    }
  }

  if (actualIndex > expectedIndex) {
    return {
      points: -6,
      negative: "Fuer dein Profil wahrscheinlich reparierender als noetig.",
    }
  }

  return {
    points: -9,
    negative: "Fuer deinen aktuellen Reparaturbedarf wahrscheinlich nicht intensiv genug.",
  }
}

function buildUsageHint(decision: ConditionerDecision): string {
  if (decision.matched_repair_level === "high") {
    return "In die Laengen und Spitzen geben, 2-3 Minuten einwirken lassen und gruendlich ausspuelen."
  }

  return "In die Laengen und Spitzen geben, kurz einarbeiten und gruendlich ausspuelen."
}

export function rerankConditionerProducts(
  candidates: MatchedProduct[],
  specs: ProductConditionerSpecs[],
  decision: ConditionerDecision,
): MatchedProduct[] {
  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  type ScoredConditionerProduct = MatchedProduct & {
    conditioner_specs?: ProductConditionerSpecs | null
    _score_debug: {
      finalScore: number
      baseScore: number
    }
  }

  const scored: ScoredConditionerProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const positives: ScoreEntry[] = []
    const negatives: ScoreEntry[] = []

    if (decision.matched_balance_need) {
      positives.push({
        points: 8,
        reason: `Passt zu deinem aktuellen Bedarf an ${BALANCE_NEED_LABELS[decision.matched_balance_need]}.`,
      })
    }

    if (decision.matched_profile.thickness) {
      positives.push({
        points: 6,
        reason: `Ist fuer ${THICKNESS_REASON_LABELS[decision.matched_profile.thickness]} Haar eingeordnet.`,
      })
    }

    const weightScore = scoreWeightFit(decision, spec)
    if (weightScore.positive) {
      positives.push({ points: weightScore.points, reason: weightScore.positive })
    }
    if (weightScore.negative) {
      negatives.push({ points: weightScore.points, reason: weightScore.negative })
    }

    const repairScore = scoreRepairFit(decision, spec)
    if (repairScore.positive) {
      positives.push({ points: repairScore.points, reason: repairScore.positive })
    }
    if (repairScore.negative) {
      negatives.push({ points: repairScore.points, reason: repairScore.negative })
    }

    if (!spec) {
      negatives.push({
        points: 0,
        reason: "Fuer dieses Produkt fehlt noch die volle Conditioner-Spezifikation.",
      })
    }

    const adjustmentSum = [...positives, ...negatives].reduce((sum, entry) => sum + entry.points, 0)
    const finalScore = toBaseScore(product) + adjustmentSum

    const recommendationMeta: ConditionerRecommendationMetadata = {
      category: "conditioner",
      score: Math.round(finalScore * 10) / 10,
      top_reasons: positives
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map((entry) => entry.reason),
      tradeoffs: negatives
        .sort((a, b) => a.points - b.points)
        .slice(0, 3)
        .map((entry) => entry.reason),
      usage_hint: buildUsageHint(decision),
      matched_profile: decision.matched_profile,
      matched_weight: decision.matched_weight,
      matched_repair_level: decision.matched_repair_level,
      matched_balance_need: decision.matched_balance_need,
    }

    return {
      ...product,
      conditioner_specs: spec,
      recommendation_meta: recommendationMeta,
      _score_debug: {
        finalScore,
        baseScore: toBaseScore(product),
      },
    }
  })

  scored.sort((a, b) => {
    if (b._score_debug.finalScore !== a._score_debug.finalScore) {
      return b._score_debug.finalScore - a._score_debug.finalScore
    }
    const aPrice = typeof a.price_eur === "number" ? a.price_eur : Number.MAX_SAFE_INTEGER
    const bPrice = typeof b.price_eur === "number" ? b.price_eur : Number.MAX_SAFE_INTEGER
    return aPrice - bPrice
  })

  return scored.map((product) => {
    const clean = { ...product }
    Reflect.deleteProperty(clean, "_score_debug")
    return clean as MatchedProduct
  })
}
