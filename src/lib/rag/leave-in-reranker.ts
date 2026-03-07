import type { HairProfile, LeaveInRecommendationMetadata } from "@/lib/types"
import type { MatchedProduct } from "@/lib/rag/product-matcher"
import type {
  ProductLeaveInSpecs,
  LeaveInRole,
} from "@/lib/leave-in/constants"

const ENABLE_HEAT_ACTIVATION_FALLBACK_EXCLUSION = false

type ScoredLeaveInProduct = MatchedProduct & {
  recommendation_meta: LeaveInRecommendationMetadata
  _score_debug: {
    finalScore: number
    baseScore: number
    concernOverlap: number
    modeFitCount: number
    weightFit: boolean
    matchedModes: LeaveInRole[]
  }
}

interface LeaveInContext {
  thickness: string | null
  concerns: string[]
  goals: string[]
  post_wash_actions: string[]
  current_routine_products: string[]
  routine_preference: string | null
  uses_heat_tools: boolean
  is_blow_dry_only: boolean
  needs_styling_prep: boolean
  has_frizz_concern: boolean
  has_damage_signals: boolean
}

interface ModeInference {
  primary: LeaveInRole
  secondary: LeaveInRole[]
}

interface ScoreAdjustment {
  points: number
  reason: string
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
}

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern))
}

function isNonFoenHeatTool(tool: string): boolean {
  const normalized = normalizeText(tool)
  if (includesAny(normalized, ["fohn", "blow", "diffusor", "diffuser"])) {
    return false
  }
  return includesAny(normalized, ["glatteisen", "lockenstab", "warmluft", "styler", "heat"])
}

function buildLeaveInContext(profile: HairProfile | null): LeaveInContext {
  const postWashActions = profile?.post_wash_actions ?? []
  const currentRoutineProducts = profile?.current_routine_products ?? []
  const stylingTools = profile?.styling_tools ?? []

  const hasHeatStylingAction = postWashActions.includes("heat_tool_styling")
  const hasBlowDryOnlyAction = postWashActions.includes("blow_dry_only")
  const hasNonHeatStylingAction = postWashActions.includes("non_heat_styling")
  const hasNonFoenHeatTool = stylingTools.some(isNonFoenHeatTool)

  const usesHeatTools = hasHeatStylingAction || hasNonFoenHeatTool
  const isBlowDryOnly = hasBlowDryOnlyAction && !hasHeatStylingAction
  const needsStylingPrep = usesHeatTools || hasNonHeatStylingAction

  const concerns = profile?.concerns ?? []
  const hasFrizzConcern = concerns.some((concern) =>
    normalizeText(concern).includes("frizz")
  )

  const hasDamageSignals =
    concerns.some((concern) => {
      const normalized = normalizeText(concern)
      return (
        (normalized.includes("haar") && normalized.includes("schad")) ||
        normalized.includes("spliss") ||
        normalized.includes("bruch")
      )
    }) ||
    profile?.cuticle_condition === "rau" ||
    profile?.protein_moisture_balance === "snaps" ||
    profile?.protein_moisture_balance === "stretches_stays" ||
    (profile?.chemical_treatment ?? []).includes("blondiert")

  return {
    thickness: profile?.thickness ?? null,
    concerns,
    goals: profile?.goals ?? [],
    post_wash_actions: postWashActions,
    current_routine_products: currentRoutineProducts,
    routine_preference: profile?.routine_preference ?? null,
    uses_heat_tools: usesHeatTools,
    is_blow_dry_only: isBlowDryOnly,
    needs_styling_prep: needsStylingPrep,
    has_frizz_concern: hasFrizzConcern,
    has_damage_signals: hasDamageSignals,
  }
}

function inferModes(context: LeaveInContext): ModeInference {
  const secondary = new Set<LeaveInRole>()

  const currentRoutine = new Set(context.current_routine_products)
  const routineIsMinimal = context.routine_preference === "minimal"
  const isFineHair = context.thickness === "fine"
  const isMediumOrCoarse = context.thickness === "normal" || context.thickness === "coarse"

  const replacementCandidate =
    isFineHair &&
    routineIsMinimal &&
    !currentRoutine.has("conditioner")

  const oilReplacementCandidate =
    isFineHair &&
    context.has_frizz_concern &&
    currentRoutine.has("oil")

  const extensionCandidate = isMediumOrCoarse || context.has_damage_signals

  let primary: LeaveInRole

  if (context.needs_styling_prep) {
    primary = "styling_prep"
    if (replacementCandidate) secondary.add("replacement_conditioner")
    if (oilReplacementCandidate) secondary.add("oil_replacement")
    if (extensionCandidate) secondary.add("extension_conditioner")
  } else if (oilReplacementCandidate) {
    primary = "oil_replacement"
    if (extensionCandidate) secondary.add("extension_conditioner")
    if (replacementCandidate) secondary.add("replacement_conditioner")
  } else if (replacementCandidate) {
    primary = "replacement_conditioner"
    if (extensionCandidate) secondary.add("extension_conditioner")
  } else {
    primary = "extension_conditioner"
    if (replacementCandidate) secondary.add("replacement_conditioner")
    if (oilReplacementCandidate) secondary.add("oil_replacement")
  }

  return { primary, secondary: [...secondary] }
}

function mapConcernToBenefits(concern: string): string[] {
  const normalized = normalizeText(concern)

  if (normalized.includes("frizz")) return ["anti_frizz"]
  if (normalized.includes("trocken")) return ["moisture"]
  if (normalized.includes("spliss")) return ["repair"]
  if (normalized.includes("schad")) return ["repair", "protein"]
  if (normalized.includes("glanz")) return ["shine"]
  if (normalized.includes("volumen")) return ["volume"]
  if (normalized.includes("locken")) return ["curl_definition"]
  if (normalized.includes("haarausfall") || normalized.includes("duenner")) return ["volume"]

  return []
}

function concernOverlapRatio(concerns: string[], careBenefits: string[]): number {
  if (concerns.length === 0) return 0

  let matchedCount = 0
  for (const concern of concerns) {
    const mappedBenefits = mapConcernToBenefits(concern)
    if (mappedBenefits.length > 0 && mappedBenefits.some((benefit) => careBenefits.includes(benefit))) {
      matchedCount++
    }
  }

  return matchedCount / concerns.length
}

function buildUsageHint(spec: ProductLeaveInSpecs): string {
  const stages = new Set(spec.application_stage ?? [])

  if (stages.has("towel_dry") && stages.has("pre_heat")) {
    return "Apply on towel-dried hair before heat styling."
  }
  if (stages.has("towel_dry")) {
    return "Apply on towel-dried hair and distribute evenly through lengths."
  }
  if (stages.has("dry_hair") && stages.has("post_style")) {
    return "Use sparingly on dry hair to finish and reduce frizz."
  }
  if (stages.has("pre_heat")) {
    return "Apply before heat styling as prep/protection."
  }
  if (stages.has("post_style")) {
    return "Use after styling for smoothing and shine."
  }
  if (stages.has("dry_hair")) {
    return "Use on dry hair for touch-ups between washes."
  }
  return "Apply to clean hair as directed."
}

function buildModeMatches(mode: ModeInference, roles: LeaveInRole[]): LeaveInRole[] {
  const matches: LeaveInRole[] = []
  if (roles.includes(mode.primary)) matches.push(mode.primary)
  for (const secondaryMode of mode.secondary) {
    if (roles.includes(secondaryMode)) matches.push(secondaryMode)
  }
  return matches
}

function getEquivalentCareHeatOptionExists(
  allSpecs: ProductLeaveInSpecs[],
  currentProductId: string
): boolean {
  return allSpecs.some((spec) =>
    spec.product_id !== currentProductId &&
    spec.provides_heat_protection &&
    (spec.care_benefits?.length ?? 0) > 0
  )
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

function isReplacementOnly(spec: ProductLeaveInSpecs): boolean {
  const roles = spec.roles ?? []
  return (
    roles.includes("replacement_conditioner") &&
    !roles.includes("extension_conditioner") &&
    !roles.includes("styling_prep")
  )
}

function isPureHeatProtectantProfile(spec: ProductLeaveInSpecs): boolean {
  return (
    spec.provides_heat_protection &&
    (spec.care_benefits?.length ?? 0) === 0 &&
    (spec.roles ?? []).every((role) => role === "styling_prep")
  )
}

export function rerankLeaveInProducts(
  candidates: MatchedProduct[],
  specs: ProductLeaveInSpecs[],
  hairProfile: HairProfile | null
): MatchedProduct[] {
  const context = buildLeaveInContext(hairProfile)
  const mode = inferModes(context)

  const specByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))

  const viable = candidates.filter((candidate) => {
    if (!candidate.is_active) return false
    return specByProductId.has(candidate.id)
  })

  const heatActivationAlternatives = viable.filter((candidate) => {
    const spec = specByProductId.get(candidate.id)
    return spec && (!spec.heat_activation_required || context.uses_heat_tools)
  })
  const shouldExcludeHeatActivationMismatch =
    ENABLE_HEAT_ACTIVATION_FALLBACK_EXCLUSION &&
    !context.uses_heat_tools &&
    heatActivationAlternatives.length >= 3

  const scored: ScoredLeaveInProduct[] = []

  for (const product of viable) {
    const spec = specByProductId.get(product.id)
    if (!spec) continue

    if (shouldExcludeHeatActivationMismatch && spec.heat_activation_required) {
      continue
    }

    const positives: ScoreAdjustment[] = []
    const negatives: ScoreAdjustment[] = []
    let adjustmentSum = 0

    const roles = spec.roles ?? []
    const matchedModes = buildModeMatches(mode, roles)
    const modeFitCount = matchedModes.length

    if (roles.includes(mode.primary)) {
      positives.push({ points: 15, reason: "Matches your primary leave-in use mode." })
      adjustmentSum += 15
    }

    if (mode.secondary.some((secondaryMode) => roles.includes(secondaryMode))) {
      positives.push({ points: 8, reason: "Supports a secondary routine mode you likely need." })
      adjustmentSum += 8
    }

    if (context.needs_styling_prep && roles.includes("styling_prep")) {
      positives.push({ points: 10, reason: "Strong fit for your post-wash styling routine." })
      adjustmentSum += 10
    }

    if (context.uses_heat_tools && spec.provides_heat_protection) {
      positives.push({ points: 12, reason: "Provides heat protection for your heat styling habits." })
      adjustmentSum += 12
    }

    const overlapRatio = concernOverlapRatio(context.concerns, spec.care_benefits ?? [])
    if (overlapRatio > 0) {
      const points = 10 * overlapRatio
      positives.push({
        points,
        reason: "Addresses your current top hair concerns.",
      })
      adjustmentSum += points
    }

    const expectedWeight = context.thickness === "fine"
      ? "light"
      : context.thickness === "normal"
        ? "medium"
        : context.thickness === "coarse"
          ? "rich"
          : null
    const hasWeightFit = expectedWeight !== null && spec.weight === expectedWeight
    if (hasWeightFit) {
      positives.push({ points: 8, reason: "Weight matches your hair thickness." })
      adjustmentSum += 8
    }

    if (
      context.routine_preference === "minimal" &&
      roles.includes("replacement_conditioner")
    ) {
      positives.push({
        points: 6,
        reason: "Supports a minimal routine as a conditioner replacement option.",
      })
      adjustmentSum += 6
    }

    const isMediumOrCoarse = context.thickness === "normal" || context.thickness === "coarse"
    if ((isMediumOrCoarse || context.has_damage_signals) && roles.includes("extension_conditioner")) {
      positives.push({
        points: 6,
        reason: "Offers stronger supportive care for your hair profile.",
      })
      adjustmentSum += 6
    }

    if (
      context.has_frizz_concern &&
      roles.includes("oil_replacement") &&
      (spec.weight === "light" || spec.weight === "medium")
    ) {
      positives.push({
        points: 4,
        reason: "Lighter anti-frizz alternative to heavier oils.",
      })
      adjustmentSum += 4
    }

    if (context.uses_heat_tools && !spec.provides_heat_protection) {
      negatives.push({
        points: -8,
        reason: "No built-in heat protection despite your heat tool usage.",
      })
      adjustmentSum -= 8
    }

    if (spec.heat_activation_required && !context.uses_heat_tools) {
      negatives.push({
        points: -20,
        reason: "Heat-activated formula but you usually do not heat-style.",
      })
      adjustmentSum -= 20
    }

    if (context.thickness === "fine" && spec.weight === "rich") {
      negatives.push({
        points: -8,
        reason: "May feel too heavy for fine hair.",
      })
      adjustmentSum -= 8
    }

    if (isMediumOrCoarse && isReplacementOnly(spec)) {
      negatives.push({
        points: -6,
        reason: "Replacement-only profile is less ideal for medium/coarse hair.",
      })
      adjustmentSum -= 6
    }

    if (
      context.uses_heat_tools &&
      isPureHeatProtectantProfile(spec) &&
      getEquivalentCareHeatOptionExists(specs, spec.product_id)
    ) {
      negatives.push({
        points: -4,
        reason: "More care-oriented heat-protective leave-ins are available.",
      })
      adjustmentSum -= 4
    }

    const baseScore = toBaseScore(product)
    const finalScore = baseScore + adjustmentSum

    const topReasons = positives
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map((entry) => entry.reason)

    const tradeoffs = negatives
      .sort((a, b) => a.points - b.points)
      .slice(0, 3)
      .map((entry) => entry.reason)

    scored.push({
      ...product,
      recommendation_meta: {
        category: "leave_in",
        score: Math.round(finalScore * 10) / 10,
        top_reasons: topReasons,
        tradeoffs,
        mode_match: matchedModes,
        usage_hint: buildUsageHint(spec),
      },
      _score_debug: {
        finalScore,
        baseScore,
        concernOverlap: overlapRatio,
        modeFitCount,
        weightFit: hasWeightFit,
        matchedModes,
      },
    })
  }

  scored.sort((a, b) => {
    if (b._score_debug.finalScore !== a._score_debug.finalScore) {
      return b._score_debug.finalScore - a._score_debug.finalScore
    }
    if (b._score_debug.concernOverlap !== a._score_debug.concernOverlap) {
      return b._score_debug.concernOverlap - a._score_debug.concernOverlap
    }
    if (b._score_debug.modeFitCount !== a._score_debug.modeFitCount) {
      return b._score_debug.modeFitCount - a._score_debug.modeFitCount
    }
    if (a._score_debug.weightFit !== b._score_debug.weightFit) {
      return a._score_debug.weightFit ? -1 : 1
    }
    const aSort = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER
    const bSort = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER
    return aSort - bSort
  })

  console.log(
    JSON.stringify({
      _type: "leave_in_rerank",
      timestamp: new Date().toISOString(),
      inferred_mode_primary: mode.primary,
      inferred_mode_secondary: mode.secondary,
      uses_heat_tools: context.uses_heat_tools,
      is_blow_dry_only: context.is_blow_dry_only,
      needs_styling_prep: context.needs_styling_prep,
      candidate_count: candidates.length,
      viable_count: viable.length,
      returned_count: scored.length,
      top_factors: scored[0]?.recommendation_meta.top_reasons ?? [],
      top_tradeoffs: scored[0]?.recommendation_meta.tradeoffs ?? [],
    })
  )

  return scored.map((product) => {
    const clean = { ...product }
    Reflect.deleteProperty(clean, "_score_debug")
    return clean
  })
}
