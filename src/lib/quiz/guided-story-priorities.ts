import type { ProfileConcern } from "@/lib/vocabulary"
import type { QuizAnswers } from "./types"
import {
  GUIDED_STORY_LEGACY_FALLBACK_PRIORITIES,
  getGuidedStoryCopy,
  type GuidedStoryPriorityFamily,
  type GuidedStoryPriorityVariantId,
} from "./guided-story-copy"
import { canonicalizeQuizAnswers } from "./normalization"

export type { GuidedStoryPriorityFamily } from "./guided-story-copy"

export type GuidedStoryPriorityTier = 1 | 2 | 3 | "positive"

export interface GuidedStoryPriority {
  family: GuidedStoryPriorityFamily
  tier: GuidedStoryPriorityTier
  variantId: string
  title: string
  finding: string
  why: string
  helps: string
  matchedConcerns: ProfileConcern[]
  matchedGoals: string[]
  isCentral: boolean
  isFallback?: boolean
  mergedVariantIds?: string[]
}

type Candidate = Omit<GuidedStoryPriority, "title" | "finding" | "why" | "helps" | "isCentral"> & {
  variantId: string
  explicitProblemCount: number
  signalScore: number
  coversScalpProblem?: boolean
  title?: string
  finding?: string
  why?: string
  helps?: string
}

const FAMILY_ORDER: readonly GuidedStoryPriorityFamily[] = [
  "scalp_flakes",
  "scalp_comfort",
  "strength_damage",
  "moisture_dryness",
  "surface_manageability",
  "ends_protection",
  "definition",
  "volume_weight",
  "color_protection",
]

const TEXTURED_STRUCTURES = new Set(["wavy", "curly", "coily"])
const COLOR_TREATMENTS = new Set(["gefaerbt", "blondiert"])
const CHEMICAL_TREATMENTS = new Set(["gefaerbt", "blondiert", "dauerwelle", "chemisch_geglaettet"])
const LONG_LENGTHS = new Set(["long", "very_long"])

function hasValue(values: readonly string[] | undefined, value: string): boolean {
  return values?.includes(value) ?? false
}

function hasAnyValue(
  values: readonly string[] | undefined,
  candidates: ReadonlySet<string>,
): boolean {
  return values?.some((value) => candidates.has(value)) ?? false
}

function matchedGoals(
  answers: QuizAnswers,
  goals: readonly string[],
  options: { includeHealthierHair?: boolean } = {},
): string[] {
  const matches = goals.filter((goal) => hasValue(answers.goals, goal))
  if (options.includeHealthierHair && hasValue(answers.goals, "healthier_hair")) {
    matches.push("healthier_hair")
  }
  return matches
}

function makeCandidate(params: {
  family: GuidedStoryPriorityFamily
  tier: GuidedStoryPriorityTier
  variantId: string
  matchedConcerns?: ProfileConcern[]
  matchedGoals?: string[]
  explicitScalpProblem?: boolean
  signalScore?: number
  isFallback?: boolean
  title?: string
  finding?: string
  why?: string
  helps?: string
  mergedVariantIds?: string[]
}): Candidate {
  return {
    family: params.family,
    tier: params.tier,
    variantId: params.variantId,
    matchedConcerns: params.matchedConcerns ?? [],
    matchedGoals: params.matchedGoals ?? [],
    explicitProblemCount:
      (params.matchedConcerns?.length ?? 0) + (params.explicitScalpProblem ? 1 : 0),
    signalScore: params.signalScore ?? 0,
    coversScalpProblem: params.explicitScalpProblem,
    isFallback: params.isFallback,
    title: params.title,
    finding: params.finding,
    why: params.why,
    helps: params.helps,
    mergedVariantIds: params.mergedVariantIds,
  }
}

function tierSortValue(tier: GuidedStoryPriorityTier): number {
  return tier === "positive" ? 4 : tier
}

function compareCandidates(left: Candidate, right: Candidate): number {
  const tierDelta = tierSortValue(left.tier) - tierSortValue(right.tier)
  if (tierDelta !== 0) return tierDelta

  const goalDelta = Number(right.matchedGoals.length > 0) - Number(left.matchedGoals.length > 0)
  if (goalDelta !== 0) return goalDelta

  const problemDelta = right.explicitProblemCount - left.explicitProblemCount
  if (problemDelta !== 0) return problemDelta

  const signalDelta = right.signalScore - left.signalScore
  if (signalDelta !== 0) return signalDelta

  return FAMILY_ORDER.indexOf(left.family) - FAMILY_ORDER.indexOf(right.family)
}

function getCandidateCopy(candidate: Candidate): {
  title: string
  finding: string
  why: string
  helps: string
} {
  if (candidate.title && candidate.finding && candidate.why && candidate.helps) {
    return {
      title: candidate.title,
      finding: candidate.finding,
      why: candidate.why,
      helps: candidate.helps,
    }
  }

  return getGuidedStoryCopy(candidate.variantId as GuidedStoryPriorityVariantId)
}

function getStrengthCandidate(answers: QuizAnswers): Candidate | undefined {
  const concerns = (answers.concerns ?? []).filter(
    (concern): concern is "hair_damage" | "breakage" =>
      concern === "hair_damage" || concern === "breakage",
  )
  const directGoals = matchedGoals(answers, ["anti_breakage", "strengthen"])
  const abnormalPulltest = answers.pulltest === "stretches_stays" || answers.pulltest === "snaps"
  const hasChemicalTreatment = hasAnyValue(answers.treatment, CHEMICAL_TREATMENTS)
  const hasRoughSurface = answers.fingertest === "rau"
  const healthierHairSupported =
    hasValue(answers.goals, "healthier_hair") &&
    (concerns.length > 0 || abnormalPulltest || hasChemicalTreatment || hasRoughSurface)

  if (concerns.length === 0 && directGoals.length === 0 && !healthierHairSupported) {
    return undefined
  }

  let variantId: GuidedStoryPriorityVariantId = "strength_damage.haarbruch_schaden_basis"
  if (
    abnormalPulltest &&
    (concerns.length > 0 || directGoals.length > 0 || healthierHairSupported)
  ) {
    variantId = "strength_damage.auffalliger_zugtest"
  } else if (hasChemicalTreatment) {
    variantId = "strength_damage.mit_chemischer_behandlung"
  }

  return makeCandidate({
    family: "strength_damage",
    tier: concerns.length > 0 ? 1 : 3,
    variantId,
    matchedConcerns: concerns,
    matchedGoals: [...directGoals, ...(healthierHairSupported ? ["healthier_hair"] : [])],
    signalScore:
      (abnormalPulltest ? 3 : 0) +
      (hasChemicalTreatment ? 2 : 0) +
      (hasRoughSurface ? 1 : 0) +
      concerns.length,
  })
}

function getMoistureCandidate(answers: QuizAnswers): Candidate | undefined {
  const hasDrynessConcern = hasValue(answers.concerns, "dryness")
  const goals = matchedGoals(answers, ["moisture"], { includeHealthierHair: hasDrynessConcern })

  if (!hasDrynessConcern && goals.length === 0) return undefined

  const hasTreatment = hasAnyValue(answers.treatment, CHEMICAL_TREATMENTS)
  const hasRoughSurface = answers.fingertest === "rau"
  const variantId =
    hasDrynessConcern && (hasRoughSurface || hasTreatment)
      ? "moisture_dryness.trocken_rau_behandelt"
      : "moisture_dryness.trockenheit_basis"

  return makeCandidate({
    family: "moisture_dryness",
    tier: hasDrynessConcern ? 2 : 3,
    variantId,
    matchedConcerns: hasDrynessConcern ? ["dryness"] : [],
    matchedGoals: goals,
    signalScore: (hasRoughSurface ? 2 : 0) + (hasTreatment ? 1 : 0),
  })
}

function getSurfaceCandidate(answers: QuizAnswers): Candidate | undefined {
  const hasFrizzConcern = hasValue(answers.concerns, "frizz")
  const hasTanglingConcern = hasValue(answers.concerns, "tangling")
  const goals = matchedGoals(answers, ["less_frizz", "shine"])
  const smoothEnoughForShineOnly =
    answers.fingertest === undefined ||
    answers.fingertest === "glatt" ||
    answers.fingertest === "leicht_uneben"

  if (!hasFrizzConcern && !hasTanglingConcern && goals.length === 0) return undefined
  if (
    !hasFrizzConcern &&
    !hasTanglingConcern &&
    hasValue(answers.goals, "shine") &&
    !hasValue(answers.goals, "less_frizz") &&
    !smoothEnoughForShineOnly
  ) {
    return undefined
  }

  let variantId: GuidedStoryPriorityVariantId = "surface_manageability.frizz"
  if (hasFrizzConcern && hasTanglingConcern) {
    variantId = "surface_manageability.frizz_knoten_glanz"
  } else if (hasTanglingConcern) {
    variantId = "surface_manageability.verknotungen"
  } else if (
    !hasFrizzConcern &&
    hasValue(answers.goals, "shine") &&
    !hasValue(answers.goals, "less_frizz")
  ) {
    variantId = "surface_manageability.nur_glanz_ziel"
  }

  const concerns: ProfileConcern[] = []
  if (hasFrizzConcern) concerns.push("frizz")
  if (hasTanglingConcern) concerns.push("tangling")

  return makeCandidate({
    family: "surface_manageability",
    tier: concerns.length > 0 ? 2 : 3,
    variantId,
    matchedConcerns: concerns,
    matchedGoals: goals,
    signalScore:
      (answers.fingertest === "rau" ? 2 : 0) +
      (TEXTURED_STRUCTURES.has(answers.structure ?? "") ? 1 : 0) +
      concerns.length,
  })
}

function getEndsCandidate(answers: QuizAnswers): Candidate | undefined {
  const hasSplitEndsConcern = hasValue(answers.concerns, "split_ends")
  const goals = matchedGoals(answers, ["less_split_ends"], {
    includeHealthierHair: hasSplitEndsConcern,
  })

  if (!hasSplitEndsConcern && goals.length === 0) return undefined

  return makeCandidate({
    family: "ends_protection",
    tier: hasSplitEndsConcern ? 2 : 3,
    variantId: "ends_protection.spliss_lange_spitzen",
    matchedConcerns: hasSplitEndsConcern ? ["split_ends"] : [],
    matchedGoals: goals,
    signalScore:
      (LONG_LENGTHS.has(answers.hair_length ?? "") ? 1 : 0) +
      (answers.fingertest === "rau" ? 1 : 0) +
      (hasAnyValue(answers.treatment, CHEMICAL_TREATMENTS) ? 1 : 0),
  })
}

function getDefinitionCandidate(answers: QuizAnswers): Candidate | undefined {
  const goals = matchedGoals(answers, ["curl_definition"])
  if (goals.length === 0) return undefined

  const isTextured = TEXTURED_STRUCTURES.has(answers.structure ?? "")
  if (!isTextured && answers.structure !== "straight") return undefined

  return makeCandidate({
    family: "definition",
    tier: 3,
    variantId: isTextured
      ? "definition.wellig_lockig_oder_coily"
      : "definition.glattes_haar_definitions_ziel",
    matchedGoals: goals,
    signalScore:
      (isTextured ? 2 : 0) +
      (hasValue(answers.concerns, "frizz") ? 1 : 0) +
      (hasValue(answers.concerns, "dryness") ? 1 : 0),
  })
}

function getVolumeCandidate(answers: QuizAnswers): Candidate | undefined {
  const wantsVolume = hasValue(answers.goals, "volume")
  const wantsLessVolume = hasValue(answers.goals, "less_volume")
  if (!wantsVolume && !wantsLessVolume) return undefined

  if (wantsVolume) {
    const hasFineOrLowDensity = answers.thickness === "fine" || answers.density === "low"
    return makeCandidate({
      family: "volume_weight",
      tier: 3,
      variantId: hasFineOrLowDensity
        ? "volume_weight.mehr_volumen_fein_niedrige_dichte"
        : "volume_weight.mehr_volumen_allgemein",
      matchedGoals: ["volume"],
      signalScore: hasFineOrLowDensity ? 2 : 0,
    })
  }

  const hasHighControlSignal =
    answers.density === "high" ||
    answers.thickness === "coarse" ||
    TEXTURED_STRUCTURES.has(answers.structure ?? "")

  return makeCandidate({
    family: "volume_weight",
    tier: 3,
    variantId: hasHighControlSignal
      ? "volume_weight.weniger_volumen_viel_kraftig_texturiert"
      : "volume_weight.weniger_volumen_allgemein",
    matchedGoals: ["less_volume"],
    signalScore: hasHighControlSignal ? 2 : 0,
  })
}

function getColorCandidate(answers: QuizAnswers): Candidate | undefined {
  const goals = matchedGoals(answers, ["color_protection"])
  if (goals.length === 0) return undefined

  const hasColorTreatment = hasAnyValue(answers.treatment, COLOR_TREATMENTS)
  return makeCandidate({
    family: "color_protection",
    tier: 3,
    variantId: hasColorTreatment
      ? "color_protection.gefarbt_blondiert"
      : "color_protection.naturhaar_farbschutz_ziel",
    matchedGoals: goals,
    signalScore: hasColorTreatment ? 2 : 0,
  })
}

function hasStructuredGuidedStorySignal(answers: QuizAnswers): boolean {
  return Boolean(
    answers.structure ||
    answers.thickness ||
    answers.density ||
    answers.hair_length ||
    answers.fingertest ||
    answers.pulltest ||
    answers.scalp_type ||
    answers.has_scalp_issue !== undefined ||
    answers.scalp_condition ||
    (answers.concerns?.length ?? 0) > 0 ||
    (answers.treatment?.length ?? 0) > 0 ||
    (answers.goals?.length ?? 0) > 0,
  )
}

function buildCandidates(answers: QuizAnswers): Candidate[] {
  const candidates: Candidate[] = []

  if (answers.has_scalp_issue && answers.scalp_condition === "schuppen") {
    candidates.push(
      makeCandidate({
        family: "scalp_flakes",
        tier: 1,
        variantId: "scalp_flakes.schuppen",
        matchedGoals: matchedGoals(answers, ["healthy_scalp"]),
        explicitScalpProblem: true,
        signalScore: answers.scalp_type === "fettig" ? 2 : 1,
      }),
    )
  } else if (answers.has_scalp_issue && answers.scalp_condition === "trockene_schuppen") {
    candidates.push(
      makeCandidate({
        family: "scalp_flakes",
        tier: 1,
        variantId: "scalp_flakes.trockene_schuppen",
        matchedGoals: matchedGoals(answers, ["healthy_scalp"]),
        explicitScalpProblem: true,
        signalScore: answers.scalp_type === "trocken" ? 2 : 1,
      }),
    )
  } else if (answers.has_scalp_issue && answers.scalp_condition === "gereizt") {
    candidates.push(
      makeCandidate({
        family: "scalp_comfort",
        tier: 1,
        variantId: "scalp_comfort.gereizte_kopfhaut",
        matchedGoals: matchedGoals(answers, ["healthy_scalp"]),
        explicitScalpProblem: true,
        signalScore: 2,
      }),
    )
  } else if (answers.has_scalp_issue !== true && answers.scalp_type === "fettig") {
    candidates.push(
      makeCandidate({
        family: "scalp_comfort",
        tier: 2,
        variantId: "scalp_comfort.fettige_kopfhaut",
        matchedGoals: matchedGoals(answers, ["healthy_scalp"]),
        signalScore: 1,
      }),
    )
  } else if (answers.has_scalp_issue !== true && answers.scalp_type === "trocken") {
    candidates.push(
      makeCandidate({
        family: "scalp_comfort",
        tier: 2,
        variantId: "scalp_comfort.trockene_kopfhaut",
        matchedGoals: matchedGoals(answers, ["healthy_scalp"]),
        signalScore: 1,
      }),
    )
  } else if (answers.has_scalp_issue !== true && answers.scalp_type === "ausgeglichen") {
    candidates.push(
      makeCandidate({
        family: "scalp_comfort",
        tier: "positive",
        variantId: "scalp_comfort.ausgeglichene_kopfhaut",
        matchedGoals: matchedGoals(answers, ["healthy_scalp"]),
        isFallback: true,
      }),
    )
  }

  const familyCandidates = [
    getStrengthCandidate(answers),
    getMoistureCandidate(answers),
    getSurfaceCandidate(answers),
    getEndsCandidate(answers),
    getDefinitionCandidate(answers),
    getVolumeCandidate(answers),
    getColorCandidate(answers),
  ].filter((candidate): candidate is Candidate => candidate !== undefined)

  candidates.push(...familyCandidates)

  if (
    hasStructuredGuidedStorySignal(answers) &&
    (answers.concerns?.length ?? 0) === 0 &&
    !answers.has_scalp_issue
  ) {
    candidates.push(
      makeCandidate({
        family: "scalp_comfort",
        tier: "positive",
        variantId: "special.keine_konkrete_sorge",
        isFallback: true,
      }),
    )
  }

  return candidates
}

const CLOSE_NEIGHBOR_MERGES: readonly (readonly [
  GuidedStoryPriorityFamily,
  GuidedStoryPriorityFamily,
])[] = [
  ["strength_damage", "ends_protection"],
  ["moisture_dryness", "surface_manageability"],
  ["scalp_flakes", "scalp_comfort"],
  ["definition", "surface_manageability"],
  ["color_protection", "strength_damage"],
]

function requiredCoverageKeys(candidates: readonly Candidate[]): Set<string> {
  const keys = new Set<string>()
  for (const candidate of candidates) {
    for (const concern of candidate.matchedConcerns) {
      keys.add(`concern:${concern}`)
    }
    if (candidate.coversScalpProblem) {
      keys.add("scalp:condition")
    }
  }
  return keys
}

function coveredKeys(candidates: readonly Candidate[]): Set<string> {
  return requiredCoverageKeys(candidates)
}

function coversAllRequired(
  candidates: readonly Candidate[],
  required: ReadonlySet<string>,
): boolean {
  const covered = coveredKeys(candidates)
  for (const key of required) {
    if (!covered.has(key)) return false
  }
  return true
}

function mergeCandidates(primary: Candidate, secondary: Candidate): Candidate {
  const primaryCopy = getCandidateCopy(primary)
  const secondaryCopy = getCandidateCopy(secondary)
  const matchedConcerns = [...new Set([...primary.matchedConcerns, ...secondary.matchedConcerns])]
  const matchedGoals = [...new Set([...primary.matchedGoals, ...secondary.matchedGoals])]
  const mergedVariantIds = [
    ...(primary.mergedVariantIds ?? [primary.variantId]),
    ...(secondary.mergedVariantIds ?? [secondary.variantId]),
  ]

  return {
    ...primary,
    title: `${primaryCopy.title} · ${secondaryCopy.title}`,
    finding: primaryCopy.finding,
    why: primaryCopy.why,
    helps: primaryCopy.helps,
    matchedConcerns,
    matchedGoals,
    explicitProblemCount: primary.explicitProblemCount + secondary.explicitProblemCount,
    signalScore: primary.signalScore + secondary.signalScore,
    coversScalpProblem: primary.coversScalpProblem || secondary.coversScalpProblem,
    mergedVariantIds,
  }
}

function mergeCloseNeighborsForCoverage(candidates: Candidate[]): Candidate[] {
  const sorted = [...candidates].sort(compareCandidates)
  if (sorted.length <= 3) return sorted

  const required = requiredCoverageKeys(sorted)
  if (coversAllRequired(sorted.slice(0, 3), required)) return sorted

  for (const [firstFamily, secondFamily] of CLOSE_NEIGHBOR_MERGES) {
    const first = sorted.find((candidate) => candidate.family === firstFamily)
    const second = sorted.find((candidate) => candidate.family === secondFamily)
    if (!first || !second) continue

    const [primary, secondary] =
      compareCandidates(first, second) <= 0 ? [first, second] : [second, first]
    const merged = mergeCandidates(primary, secondary)
    const mergedCandidates = sorted
      .filter((candidate) => candidate !== first && candidate !== second)
      .concat(merged)
      .sort(compareCandidates)

    if (coversAllRequired(mergedCandidates.slice(0, 3), required)) {
      return mergedCandidates
    }
  }

  return sorted
}

function legacyFallbackCandidates(): Candidate[] {
  return GUIDED_STORY_LEGACY_FALLBACK_PRIORITIES.map((fallback) =>
    makeCandidate({
      family: fallback.family,
      tier: "positive",
      variantId: fallback.variantId,
      title: fallback.title,
      finding: fallback.finding,
      why: fallback.why,
      helps: fallback.helps,
      isFallback: true,
    }),
  )
}

function withCopy(candidate: Candidate, isCentral: boolean): GuidedStoryPriority {
  const copy = getCandidateCopy(candidate)
  return {
    family: candidate.family,
    tier: candidate.tier,
    variantId: candidate.variantId,
    title: copy.title,
    finding: copy.finding,
    why: copy.why,
    helps: copy.helps,
    matchedConcerns: candidate.matchedConcerns,
    matchedGoals: candidate.matchedGoals,
    isCentral,
    ...(candidate.isFallback ? { isFallback: true } : {}),
    ...(candidate.mergedVariantIds ? { mergedVariantIds: candidate.mergedVariantIds } : {}),
  }
}

export function rankGuidedStoryPriorities(rawAnswers: QuizAnswers): GuidedStoryPriority[] {
  const answers = canonicalizeQuizAnswers(rawAnswers)
  const candidates = buildCandidates(answers)
  const selected: Candidate[] = []

  const takeCandidate = (candidate: Candidate | undefined) => {
    if (!candidate) return
    if (selected.length >= 3) return
    if (selected.some((existing) => existing.family === candidate.family)) {
      return
    }
    if (selected.some((existing) => existing.variantId === candidate.variantId)) return
    selected.push(candidate)
  }

  const activeCandidates = mergeCloseNeighborsForCoverage(
    candidates.filter((candidate) => candidate.tier !== "positive"),
  )
  const positiveCandidates = candidates
    .filter((candidate) => candidate.tier === "positive")
    .sort(compareCandidates)

  takeCandidate(activeCandidates[0] ?? positiveCandidates[0])

  const remainingActive = activeCandidates.filter((candidate) => !selected.includes(candidate))
  for (const candidate of remainingActive
    .filter((item) => item.explicitProblemCount > 0)
    .sort(compareCandidates)) {
    takeCandidate(candidate)
  }

  for (const candidate of remainingActive
    .filter((item) => item.explicitProblemCount === 0)
    .sort(compareCandidates)) {
    takeCandidate(candidate)
  }

  for (const candidate of positiveCandidates) {
    takeCandidate(candidate)
  }

  for (const candidate of legacyFallbackCandidates()) {
    takeCandidate(candidate)
  }

  return selected.map((candidate, index) => withCopy(candidate, index === 0))
}
