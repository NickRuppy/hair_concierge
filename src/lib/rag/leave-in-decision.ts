import { deriveExpectedConditionerWeight } from "@/lib/rag/conditioner-decision"
import type { MatchedProduct } from "@/lib/rag/product-matcher"
import type {
  HairProfile,
  LeaveInDecision,
  LeaveInMatchedProfile,
  LeaveInProfileField,
  LeaveInRecommendationMetadata,
} from "@/lib/types"
import type {
  LeaveInConditionerRelationship,
  LeaveInNeedBucket,
  LeaveInStylingContext,
  LeaveInWeight,
  ProductLeaveInSpecs,
} from "@/lib/leave-in/constants"
import {
  LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS,
  LEAVE_IN_NEED_BUCKET_LABELS,
  LEAVE_IN_WEIGHT_LABELS,
} from "@/lib/leave-in/constants"

const LEAVE_IN_CLARIFICATION_QUESTIONS: Record<LeaveInProfileField, string> = {
  hair_texture: "Ist dein Haar eher glatt, wellig, lockig oder kraus?",
  thickness: "Ist dein Haar eher fein, mittel oder dick?",
  density: "Hast du eher wenig, mittel viele oder viele Haare?",
  care_signal:
    "Was soll deine Pflege gerade vor allem leisten - eher Frizz baendigen, Feuchtigkeit geben, reparieren, Definition geben oder Schutz vor Hitze?",
  styling_signal:
    "Was machst du nach dem Waschen meistens - lufttrocknen, ohne Hitze stylen oder mit Foehn/Hitzetools arbeiten?",
}

const LEAVE_IN_FIELD_ORDER: LeaveInProfileField[] = [
  "hair_texture",
  "thickness",
  "density",
  "care_signal",
  "styling_signal",
]

const WEIGHT_INDEX: Record<LeaveInWeight, number> = {
  light: 0,
  medium: 1,
  rich: 2,
}

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

function toBaseScore(product: MatchedProduct): number {
  if (typeof product.combined_score === "number" && Number.isFinite(product.combined_score)) {
    return product.combined_score * 100
  }
  if (typeof product.similarity === "number" && Number.isFinite(product.similarity)) {
    return product.similarity * 100
  }
  return 0
}

export function deriveLeaveInStylingContext(
  profile: HairProfile | null
): LeaveInStylingContext | null {
  const actions = profile?.post_wash_actions ?? []

  if (actions.length > 0) {
    if (actions.includes("blow_dry_only") || actions.includes("heat_tool_styling")) {
      return "heat_style"
    }
    if (actions.includes("non_heat_styling")) {
      return "non_heat_style"
    }
    if (actions.includes("air_dry")) {
      return "air_dry"
    }
    return null
  }

  if (!profile?.heat_styling || profile.heat_styling === "never") {
    return null
  }

  return "heat_style"
}

export function deriveLeaveInNeedBucket(
  profile: HairProfile | null,
  stylingContext: LeaveInStylingContext | null = deriveLeaveInStylingContext(profile),
): LeaveInNeedBucket | null {
  if (stylingContext === "heat_style") {
    return "heat_protect"
  }

  const concerns = new Set(profile?.concerns ?? [])
  const goals = new Set(profile?.goals ?? [])
  const hairTexture = profile?.hair_texture ?? null
  const cuticleCondition = profile?.cuticle_condition ?? null
  const treatments = new Set(profile?.chemical_treatment ?? [])

  if (
    goals.has("curl_definition") &&
    (hairTexture === "wavy" || hairTexture === "curly" || hairTexture === "coily")
  ) {
    return "curl_definition"
  }

  if (
    concerns.has("hair_damage") ||
    concerns.has("split_ends") ||
    cuticleCondition === "slightly_rough" ||
    cuticleCondition === "rough" ||
    treatments.has("bleached")
  ) {
    return "repair"
  }

  if (
    concerns.has("dryness") ||
    concerns.has("frizz") ||
    goals.has("moisture") ||
    goals.has("less_frizz")
  ) {
    return "moisture_anti_frizz"
  }

  if (
    concerns.has("colored") ||
    goals.has("shine") ||
    goals.has("color_protection") ||
    treatments.has("colored")
  ) {
    return "shine_protect"
  }

  return null
}

export function deriveLeaveInConditionerRelationship(
  profile: HairProfile | null
): LeaveInConditionerRelationship | null {
  if (!profile?.thickness || !profile.density) return null

  if (profile.thickness === "fine" || profile.density === "low") {
    return "replacement_capable"
  }

  return "booster_only"
}

function getMissingProfileFields(profile: HairProfile | null): LeaveInProfileField[] {
  const missing: LeaveInProfileField[] = []

  if (!profile?.hair_texture) missing.push("hair_texture")
  if (!profile?.thickness) missing.push("thickness")
  if (!profile?.density) missing.push("density")

  const stylingContext = deriveLeaveInStylingContext(profile)
  const needBucket = deriveLeaveInNeedBucket(profile, stylingContext)

  if (!needBucket) missing.push("care_signal")
  if (!stylingContext) missing.push("styling_signal")

  return missing
}

export function buildLeaveInDecision(
  profile: HairProfile | null,
  candidateCount = 0,
): LeaveInDecision {
  const missingProfileFields = getMissingProfileFields(profile)
  const stylingContext = deriveLeaveInStylingContext(profile)
  const needBucket = deriveLeaveInNeedBucket(profile, stylingContext)
  const conditionerRelationship = deriveLeaveInConditionerRelationship(profile)
  const matchedWeight = deriveExpectedConditionerWeight(profile)

  const matchedProfile: LeaveInMatchedProfile = {
    hair_texture: profile?.hair_texture ?? null,
    thickness: profile?.thickness ?? null,
    density: profile?.density ?? null,
    cuticle_condition: profile?.cuticle_condition ?? null,
    chemical_treatment: profile?.chemical_treatment ?? [],
  }

  const eligible = missingProfileFields.length === 0

  return {
    category: "leave_in",
    eligible,
    missing_profile_fields: missingProfileFields,
    matched_profile: matchedProfile,
    need_bucket: needBucket,
    styling_context: stylingContext,
    conditioner_relationship: conditionerRelationship,
    matched_weight: matchedWeight,
    candidate_count: candidateCount,
    no_catalog_match: eligible && candidateCount === 0,
  }
}

export function buildLeaveInClarificationQuestions(decision: LeaveInDecision): string[] {
  return LEAVE_IN_FIELD_ORDER
    .filter((field) => decision.missing_profile_fields.includes(field))
    .map((field) => LEAVE_IN_CLARIFICATION_QUESTIONS[field])
}

function isReplacementOnly(spec: ProductLeaveInSpecs): boolean {
  const roles = spec.roles ?? []
  return (
    roles.includes("replacement_conditioner") &&
    !roles.includes("extension_conditioner") &&
    !roles.includes("styling_prep")
  )
}

function supportsBoosterUse(spec: ProductLeaveInSpecs): boolean {
  const roles = spec.roles ?? []
  return roles.includes("extension_conditioner") || roles.includes("styling_prep")
}

function filterCandidatesByRelationship(
  candidates: MatchedProduct[],
  specsByProductId: Map<string, ProductLeaveInSpecs>,
  relationship: LeaveInConditionerRelationship | null
): MatchedProduct[] {
  return candidates.filter((candidate) => {
    const spec = specsByProductId.get(candidate.id)
    if (!spec || !candidate.is_active) return false

    if (relationship === "booster_only") {
      return supportsBoosterUse(spec)
    }

    return true
  })
}

function scoreWeightFit(
  expectedWeight: LeaveInWeight | null,
  actualWeight: LeaveInWeight
): { points: number; positive?: string; negative?: string } {
  if (!expectedWeight) return { points: 0 }

  if (expectedWeight === "light" && actualWeight === "rich") {
    return {
      points: -12,
      negative: "Dieses Leave-in ist zu schwer fuer feines Haar.",
    }
  }

  const distance = Math.abs(WEIGHT_INDEX[expectedWeight] - WEIGHT_INDEX[actualWeight])
  if (distance === 0) {
    return {
      points: 12,
      positive: `Das Gewicht passt gut zu ${LEAVE_IN_WEIGHT_LABELS[expectedWeight].toLowerCase()}er Leave-in-Pflege fuer dein Haarprofil.`,
    }
  }

  if (distance === 1) {
    return {
      points: 5,
      positive: "Das Gewicht ist fuer dein Haarprofil noch gut tragbar.",
    }
  }

  return {
    points: -7,
    negative: "Das Gewicht ist fuer dein Haarprofil eher nicht die erste Wahl.",
  }
}

function buildUsageHint(
  decision: LeaveInDecision,
  spec: ProductLeaveInSpecs
): string {
  const stages = new Set(spec.application_stage ?? [])

  if (decision.styling_context === "heat_style") {
    return "Sparsam ins handtuchtrockene Haar geben und vor dem Foehnen oder Hitzestyling sauber verteilen."
  }

  if (
    decision.conditioner_relationship === "replacement_capable" &&
    (spec.roles ?? []).includes("replacement_conditioner")
  ) {
    return "Nach dem Waschen in die Laengen geben. Bei feinem Haar oder wenig Haaren kann es den klassischen Conditioner ersetzen."
  }

  if (decision.conditioner_relationship === "booster_only") {
    return "Nach dem Conditioner sparsam in die Laengen und Spitzen geben und als zusaetzlichen Booster nutzen."
  }

  if (decision.styling_context === "non_heat_style") {
    return "Ins handtuchtrockene Haar geben und dann ohne Hitze stylen."
  }

  if (stages.has("dry_hair") || stages.has("post_style")) {
    return "Nur sparsam in Laengen und Spitzen geben und gleichmaessig verteilen."
  }

  return "Nach dem Waschen sparsam in die Laengen und Spitzen geben."
}

type ScoreEntry = {
  points: number
  reason: string
}

export function rerankLeaveInProducts(
  candidates: MatchedProduct[],
  specs: ProductLeaveInSpecs[],
  decision: LeaveInDecision
): MatchedProduct[] {
  if (!decision.eligible || !decision.need_bucket || !decision.conditioner_relationship) {
    return []
  }

  const needBucket = decision.need_bucket

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const filtered = filterCandidatesByRelationship(
    candidates,
    specsByProductId,
    decision.conditioner_relationship
  )

  type ScoredLeaveInProduct = MatchedProduct & {
    _score_debug: {
      finalScore: number
      baseScore: number
    }
  }

  const scored: ScoredLeaveInProduct[] = filtered.map((product) => {
    const spec = specsByProductId.get(product.id)
    const positives: ScoreEntry[] = []
    const negatives: ScoreEntry[] = []

    if (!spec) {
      negatives.push({
        points: -5,
        reason: "Fuer dieses Leave-in fehlt noch die volle Spezifikation.",
      })
    } else {
      positives.push({
        points: 10,
        reason: `Passt gut zu deinem Fokus auf ${LEAVE_IN_NEED_BUCKET_LABELS[needBucket].toLowerCase()}.`,
      })

      if (decision.conditioner_relationship === "replacement_capable") {
        if ((spec.roles ?? []).includes("replacement_conditioner")) {
          positives.push({
            points: 8,
            reason: "Kann bei deinem Haarprofil sogar als Conditioner-Ersatz funktionieren.",
          })
        } else {
          positives.push({
            points: 3,
            reason: "Passt als leichtes zusaetzliches Leave-in zu deinem Haarprofil.",
          })
        }
      } else {
        positives.push({
          points: 8,
          reason: "Passt als zusaetzlicher Booster ueber dem Conditioner.",
        })
        if (isReplacementOnly(spec)) {
          negatives.push({
            points: -12,
            reason: "Ist eher als Conditioner-Ersatz angelegt und fuer Booster-Nutzung weniger passend.",
          })
        }
      }

      const weightScore = scoreWeightFit(decision.matched_weight, spec.weight)
      if (weightScore.positive) {
        positives.push({ points: weightScore.points, reason: weightScore.positive })
      }
      if (weightScore.negative) {
        negatives.push({ points: weightScore.points, reason: weightScore.negative })
      }

      if (decision.styling_context === "heat_style" && spec.provides_heat_protection) {
        positives.push({
          points: 8,
          reason: "Bringt den noetigen Hitzeschutz fuer dein Styling mit.",
        })
      }

      if (
        decision.styling_context === "non_heat_style" &&
        (spec.roles ?? []).includes("styling_prep")
      ) {
        positives.push({
          points: 5,
          reason: "Unterstuetzt dein Styling ohne Hitze.",
        })
      }
    }

    const baseScore = toBaseScore(product)
    const adjustmentSum =
      positives.reduce((sum, entry) => sum + entry.points, 0) +
      negatives.reduce((sum, entry) => sum + entry.points, 0)
    const finalScore = baseScore + adjustmentSum

    const recommendationMeta: LeaveInRecommendationMetadata = {
      category: "leave_in",
      score: Math.round(finalScore * 10) / 10,
      top_reasons: positives
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map((entry) => entry.reason),
      tradeoffs: negatives
        .sort((a, b) => a.points - b.points)
        .slice(0, 3)
        .map((entry) => entry.reason),
      usage_hint: buildUsageHint(decision, spec ?? {
        product_id: product.id,
        format: "lotion",
        weight: decision.matched_weight ?? "medium",
        roles: [],
        provides_heat_protection: false,
        heat_protection_max_c: null,
        heat_activation_required: false,
        care_benefits: [],
        ingredient_flags: [],
        application_stage: ["towel_dry"],
      }),
      matched_profile: decision.matched_profile,
      need_bucket: needBucket,
      styling_context: decision.styling_context,
      conditioner_relationship: decision.conditioner_relationship,
      matched_weight: decision.matched_weight,
    }

    return {
      ...product,
      recommendation_meta: recommendationMeta,
      _score_debug: {
        finalScore,
        baseScore,
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
    return clean
  })
}

export function buildLeaveInReasonSummary(decision: LeaveInDecision): string[] {
  if (!decision.matched_profile.thickness || !decision.matched_profile.density) {
    return []
  }

  return [
    `Dein Haarprofil liegt bei ${THICKNESS_REASON_LABELS[decision.matched_profile.thickness]} Haar mit ${DENSITY_REASON_LABELS[decision.matched_profile.density]}.`,
    decision.conditioner_relationship
      ? LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS[decision.conditioner_relationship]
      : "",
  ].filter(Boolean)
}
