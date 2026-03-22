import type {
  HairProfile,
  MaskDecision,
  MaskRecommendationMetadata,
  MaskSignal,
  MaskType,
} from "@/lib/types"
import type { MatchedProduct } from "@/lib/rag/product-matcher"
import type { ProductMaskSpecs } from "@/lib/mask/constants"
import { deriveMechanicalStressLevel } from "@/lib/vocabulary"

type WeightFit = "ideal" | "fallback" | "mismatch" | "blocked"
type ConcentrationFit = "ideal" | "fallback" | "last"

interface ScoreAdjustment {
  points: number
  reason: string
}

interface WeightScore {
  fit: WeightFit
  points: number
}

interface ConcentrationScore {
  fit: ConcentrationFit
  points: number
}

interface ScoredMaskProduct extends MatchedProduct {
  recommendation_meta: MaskRecommendationMetadata
  _score_debug: {
    finalScore: number
    baseScore: number
    weightPoints: number
    concentrationPoints: number
  }
}

const ACTIVE_HEAT_STYLING = new Set(["daily", "several_weekly", "once_weekly"])
const ACTIVE_CHEMICAL_TREATMENTS = new Set(["colored", "bleached"])
const ACTIVE_BALANCE_STATES = new Set(["snaps", "stretches_stays"])

function deriveMaskType(balance: HairProfile["protein_moisture_balance"] | null | undefined): MaskType | null {
  switch (balance) {
    case "snaps":
      return "moisture"
    case "stretches_stays":
      return "protein"
    case "stretches_bounces":
      return "performance"
    default:
      return null
  }
}

export function deriveMaskDecision(profile: HairProfile | null): MaskDecision {
  if (!profile) {
    return {
      needs_mask: false,
      need_strength: 0,
      mask_type: null,
      active_signals: [],
    }
  }

  const activeSignals: MaskSignal[] = []
  const signalWeights: Record<string, number> = {}
  let totalWeight = 0

  const treatments = profile.chemical_treatment ?? []
  if (treatments.some((entry) => ACTIVE_CHEMICAL_TREATMENTS.has(entry))) {
    activeSignals.push("chemical_treatment")
    const chemWeight = treatments.includes("bleached") ? 3 : 2
    signalWeights.chemical_treatment = chemWeight
    totalWeight += chemWeight
  }

  if (profile.protein_moisture_balance && ACTIVE_BALANCE_STATES.has(profile.protein_moisture_balance)) {
    activeSignals.push("protein_moisture_balance")
    signalWeights.protein_moisture_balance = 2
    totalWeight += 2
  }

  if (profile.heat_styling && ACTIVE_HEAT_STYLING.has(profile.heat_styling)) {
    activeSignals.push("heat_styling")
    signalWeights.heat_styling = 1
    totalWeight += 1
  }

  const stressLevel = deriveMechanicalStressLevel(profile.mechanical_stress_factors ?? [])
  if (stressLevel !== "low") {
    activeSignals.push("mechanical_stress")
    const stressWeight = stressLevel === "high" ? 2 : 1
    signalWeights.mechanical_stress = stressWeight
    totalWeight += stressWeight
  }

  const needStrength: MaskDecision["need_strength"] =
    totalWeight === 0 ? 0
    : totalWeight <= 2 ? 1
    : totalWeight <= 4 ? 2
    : 3

  return {
    needs_mask: totalWeight > 0,
    need_strength: needStrength,
    mask_type: deriveMaskType(profile.protein_moisture_balance),
    active_signals: activeSignals,
    signal_weights: activeSignals.length > 0
      ? signalWeights as Record<MaskSignal, number>
      : undefined,
  }
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

function scoreWeightFit(thickness: string | null, weight: ProductMaskSpecs["weight"]): WeightScore {
  switch (thickness) {
    case "fine":
      if (weight === "light") return { fit: "ideal", points: 12 }
      if (weight === "medium") return { fit: "fallback", points: 5 }
      return { fit: "blocked", points: -1000 }
    case "normal":
      if (weight === "medium") return { fit: "ideal", points: 12 }
      if (weight === "light") return { fit: "fallback", points: 4 }
      return { fit: "mismatch", points: -4 }
    case "coarse":
      if (weight === "rich") return { fit: "ideal", points: 12 }
      if (weight === "medium") return { fit: "fallback", points: 7 }
      return { fit: "mismatch", points: -6 }
    default:
      return { fit: "fallback", points: 0 }
  }
}

function scoreConcentrationFit(
  needStrength: MaskDecision["need_strength"],
  concentration: ProductMaskSpecs["concentration"]
): ConcentrationScore {
  if (needStrength <= 0) {
    return { fit: "last", points: 0 }
  }

  const preferenceByStrength: Record<1 | 2 | 3, ProductMaskSpecs["concentration"][]> = {
    1: ["low", "medium", "high"],
    2: ["medium", "low", "high"],
    3: ["high", "medium", "low"],
  }

  const strengthKey = needStrength as 1 | 2 | 3
  const preference = preferenceByStrength[strengthKey]
  const rank = preference.indexOf(concentration)

  if (rank === 0) return { fit: "ideal", points: 10 }
  if (rank === 1) return { fit: "fallback", points: 6 }
  return { fit: "last", points: 2 }
}

function buildUsageHint(spec: ProductMaskSpecs): string {
  return [
    "Nach dem Shampoo in die Laengen und Spitzen geben (nicht auf die Kopfhaut),",
    `${spec.leave_on_minutes} Minuten einwirken lassen, ausspuelen und danach Conditioner verwenden.`,
    "Etwa alle 3-5 Waeschen.",
  ].join(" ")
}

function buildMaskTypeReason(maskType: MaskType): ScoreAdjustment {
  switch (maskType) {
    case "protein":
      return {
        points: 14,
        reason: "Der Proteinfokus passt gut zu deinem aktuellen Haarbedarf.",
      }
    case "moisture":
      return {
        points: 14,
        reason: "Der Feuchtigkeitsfokus passt gut zu deinem aktuellen Haarbedarf.",
      }
    case "performance":
      return {
        points: 14,
        reason: "Der neutrale Pflegefokus passt gut zu einem ausgeglichenen Zugtest.",
      }
  }
}

export function rerankMaskProducts(
  candidates: MatchedProduct[],
  specs: ProductMaskSpecs[],
  hairProfile: HairProfile | null,
  decision: MaskDecision = deriveMaskDecision(hairProfile)
): MatchedProduct[] {
  if (!decision.needs_mask || !decision.mask_type) {
    return []
  }

  const specByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const thickness = hairProfile?.thickness ?? null

  const viable = candidates.filter((candidate) => {
    if (!candidate.is_active) return false
    const spec = specByProductId.get(candidate.id)
    if (!spec) return false
    return scoreWeightFit(thickness, spec.weight).fit !== "blocked"
  })

  const scored: ScoredMaskProduct[] = []

  for (const product of viable) {
    const spec = specByProductId.get(product.id)
    if (!spec) continue

    const positives: ScoreAdjustment[] = []
    const negatives: ScoreAdjustment[] = []
    let adjustmentSum = 0

    const maskTypeReason = buildMaskTypeReason(decision.mask_type)
    positives.push(maskTypeReason)
    adjustmentSum += maskTypeReason.points

    const weightScore = scoreWeightFit(thickness, spec.weight)
    if (weightScore.fit === "ideal") {
      positives.push({
        points: weightScore.points,
        reason: "Das Gewicht passt sehr gut zu deiner Haardicke.",
      })
      adjustmentSum += weightScore.points
    } else if (weightScore.fit === "fallback") {
      positives.push({
        points: weightScore.points,
        reason: "Das Gewicht ist fuer deine Haardicke noch gut tragbar.",
      })
      adjustmentSum += weightScore.points
    } else if (weightScore.fit === "mismatch") {
      negatives.push({
        points: weightScore.points,
        reason: "Das Gewicht ist fuer deine Haardicke eher nicht ideal.",
      })
      adjustmentSum += weightScore.points
    }

    const concentrationScore = scoreConcentrationFit(decision.need_strength, spec.concentration)
    if (concentrationScore.fit === "ideal") {
      positives.push({
        points: concentrationScore.points,
        reason: "Die Intensitaet passt gut zu deinem aktuellen Maskenbedarf.",
      })
      adjustmentSum += concentrationScore.points
    } else if (concentrationScore.fit === "fallback") {
      positives.push({
        points: concentrationScore.points,
        reason: "Die Intensitaet ist eine gute Ausweichoption fuer deinen aktuellen Maskenbedarf.",
      })
      adjustmentSum += concentrationScore.points
    } else if (decision.need_strength >= 1) {
      negatives.push({
        points: -4,
        reason: "Die Intensitaet ist nicht die erste Wahl fuer deinen aktuellen Maskenbedarf.",
      })
      adjustmentSum -= 4
    }

    const baseScore = toBaseScore(product)
    const finalScore = baseScore + adjustmentSum

    scored.push({
      ...product,
      recommendation_meta: {
        category: "mask",
        score: Math.round(finalScore * 10) / 10,
        top_reasons: positives
          .sort((a, b) => b.points - a.points)
          .slice(0, 3)
          .map((entry) => entry.reason),
        tradeoffs: negatives
          .sort((a, b) => a.points - b.points)
          .slice(0, 3)
          .map((entry) => entry.reason),
        usage_hint: buildUsageHint(spec),
        mask_type: decision.mask_type,
        need_strength: decision.need_strength === 0 ? 1 : decision.need_strength,
      },
      _score_debug: {
        finalScore,
        baseScore,
        weightPoints: weightScore.points,
        concentrationPoints: concentrationScore.points,
      },
    })
  }

  scored.sort((a, b) => {
    if (b._score_debug.finalScore !== a._score_debug.finalScore) {
      return b._score_debug.finalScore - a._score_debug.finalScore
    }
    if (b._score_debug.weightPoints !== a._score_debug.weightPoints) {
      return b._score_debug.weightPoints - a._score_debug.weightPoints
    }
    if (b._score_debug.concentrationPoints !== a._score_debug.concentrationPoints) {
      return b._score_debug.concentrationPoints - a._score_debug.concentrationPoints
    }
    const aPrice = typeof a.price_eur === "number" ? a.price_eur : Number.MAX_SAFE_INTEGER
    const bPrice = typeof b.price_eur === "number" ? b.price_eur : Number.MAX_SAFE_INTEGER
    return aPrice - bPrice
  })

  console.log(
    JSON.stringify({
      _type: "mask_rerank",
      timestamp: new Date().toISOString(),
      needs_mask: decision.needs_mask,
      need_strength: decision.need_strength,
      mask_type: decision.mask_type,
      active_signals: decision.active_signals,
      candidate_count: candidates.length,
      viable_count: viable.length,
      returned_count: scored.length,
      top_factors: scored[0]?.recommendation_meta.top_reasons ?? [],
      top_tradeoffs: scored[0]?.recommendation_meta.tradeoffs ?? [],
    })
  )

  return scored.slice(0, 3).map((product) => {
    const clean = { ...product }
    Reflect.deleteProperty(clean, "_score_debug")
    return clean
  })
}
