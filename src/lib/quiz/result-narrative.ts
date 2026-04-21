import type { Goal, HairTexture } from "@/lib/vocabulary"
import { GOALS } from "@/lib/vocabulary"
import { getOrderedGoals } from "@/lib/onboarding/goal-flow"

import { QUIZ_CONCERN_VALUES, canonicalizeQuizAnswers } from "./normalization"
import type { QuizAnswers } from "./types"

type QuizConcern = (typeof QUIZ_CONCERN_VALUES)[number]
export type QuizResultIconKey =
  | "droplet"
  | "shield"
  | "waves"
  | "shield-check"
  | "scissors"
  | "link-off"
  | "heart"
  | "sparkles"
  | "leaf"
  | "arrow-up"
  | "arrow-down"
  | "palette"

export type QuizResultScope =
  | "HAAR"
  | "LÄNGEN"
  | "SPITZEN"
  | "KOPFHAUT"
  | "ANSATZ"
  | "WELLEN & LOCKEN"

type SeverityBucket = "very_low" | "low" | "medium" | "high" | "very_high"

const BUCKET_TO_POSITION: Record<SeverityBucket, number> = {
  very_low: 18,
  low: 34,
  medium: 50,
  high: 66,
  very_high: 82,
}

const ROW_TARGET_POSITIONS = {
  hairFeel: 78,
  friction: 84,
  outcome: 88,
} as const

interface QuizResultRowCopy {
  before: string
  after: string
  iconKey: QuizResultIconKey
  tickBefore: string
  tickAfter: string
}

interface QuizResultNeedsSection {
  title: string
  mainLeverTitle: string
  mainLeverWhy: string
  mainLeverProducts: string
}

export interface QuizResultNarrativeRow {
  label: "Haargefühl" | "Was dich gerade ausbremst" | "Worauf wir hinarbeiten"
  scope: QuizResultScope
  before: string
  after: string
  iconKey: QuizResultIconKey
  tickBefore: string
  tickAfter: string
  currentPosition: number
  targetPosition: number
}

export interface QuizResultNarrative {
  intro: string
  rows: [QuizResultNarrativeRow, QuizResultNarrativeRow, QuizResultNarrativeRow]
  needs: QuizResultNeedsSection
  cta: {
    lead: string
    label: string
    subline: string
  }
  primaryConcern: QuizConcern | null
  primaryGoal: Goal | null
}

const CONCERN_COPY: Record<QuizConcern, QuizResultRowCopy> = {
  frizz: {
    before: "Frizz",
    after: "ruhigere, glattere Längen",
    iconKey: "sparkles",
    tickBefore: "unruhig",
    tickAfter: "glatt",
  },
  dryness: {
    before: "Trockenheit",
    after: "weichere, besser mit Feuchtigkeit versorgte Längen",
    iconKey: "droplet",
    tickBefore: "trocken",
    tickAfter: "versorgt",
  },
  breakage: {
    before: "Haarbruch",
    after: "stabilere, geschütztere Längen",
    iconKey: "shield-check",
    tickBefore: "instabil",
    tickAfter: "geschützt",
  },
  split_ends: {
    before: "Spliss",
    after: "glattere, gepflegtere Spitzen",
    iconKey: "scissors",
    tickBefore: "splissig",
    tickAfter: "gepflegt",
  },
  tangling: {
    before: "Verknotungen",
    after: "leichter entwirrbare Längen",
    iconKey: "link-off",
    tickBefore: "verhakt",
    tickAfter: "entwirrbar",
  },
  hair_damage: {
    before: "Haarschäden",
    after: "kräftiger wirkende, besser geschützte Längen",
    iconKey: "shield",
    tickBefore: "angegriffen",
    tickAfter: "geschützt",
  },
}

const GOAL_COPY: Record<Goal, QuizResultRowCopy & { intro: string; scope: QuizResultScope }> = {
  less_frizz: {
    intro: "ruhigeres, geschmeidigeres Haar",
    scope: "LÄNGEN",
    before: "wenig Kontrolle",
    after: "mehr Geschmeidigkeit & Kontrolle",
    iconKey: "sparkles",
    tickBefore: "unruhig",
    tickAfter: "kontrolliert",
  },
  moisture: {
    intro: "weichere, besser mit Feuchtigkeit versorgte Längen",
    scope: "LÄNGEN",
    before: "wenig Feuchtigkeit",
    after: "mehr Elastizität & Geschmeidigkeit",
    iconKey: "droplet",
    tickBefore: "trocken",
    tickAfter: "geschmeidig",
  },
  anti_breakage: {
    intro: "widerstandsfähigere, geschützte Längen",
    scope: "HAAR",
    before: "wenig Stabilität",
    after: "mehr Spannkraft & Widerstandskraft",
    iconKey: "shield-check",
    tickBefore: "instabil",
    tickAfter: "stabil",
  },
  strengthen: {
    intro: "kräftigeres, belastbareres Haar",
    scope: "HAAR",
    before: "wenig Kraft",
    after: "mehr Kraft & Belastbarkeit",
    iconKey: "shield",
    tickBefore: "schwach",
    tickAfter: "kräftig",
  },
  healthier_hair: {
    intro: "gesünder wirkendes Haar",
    scope: "HAAR",
    before: "wenig Stärke",
    after: "mehr Stärke & Schutz",
    iconKey: "shield",
    tickBefore: "angegriffen",
    tickAfter: "geschützt",
  },
  less_split_ends: {
    intro: "glattere, gepflegtere Spitzen",
    scope: "SPITZEN",
    before: "wenig Schutz",
    after: "mehr Schutz für die Spitzen",
    iconKey: "scissors",
    tickBefore: "splissig",
    tickAfter: "gepflegt",
  },
  shine: {
    intro: "glänzenderes, lebendigeres Haar",
    scope: "HAAR",
    before: "wenig Glanz",
    after: "mehr Leuchtkraft & Lebendigkeit",
    iconKey: "sparkles",
    tickBefore: "matt",
    tickAfter: "glänzend",
  },
  curl_definition: {
    intro: "definiertere Wellen oder Locken",
    scope: "WELLEN & LOCKEN",
    before: "wenig Definition",
    after: "mehr Form & Bündelung",
    iconKey: "waves",
    tickBefore: "weich",
    tickAfter: "definiert",
  },
  healthy_scalp: {
    intro: "eine ruhigere, ausgeglichenere Kopfhaut",
    scope: "KOPFHAUT",
    before: "wenig Ruhe",
    after: "mehr Ruhe & Ausgeglichenheit",
    iconKey: "leaf",
    tickBefore: "unruhig",
    tickAfter: "beruhigt",
  },
  volume: {
    intro: "fülligeres, leichteres Haar",
    scope: "HAAR",
    before: "wenig Fülle",
    after: "mehr Fülle & Leichtigkeit",
    iconKey: "arrow-up",
    tickBefore: "flach",
    tickAfter: "voluminös",
  },
  less_volume: {
    intro: "ruhigeres, kontrollierteres Haar",
    scope: "HAAR",
    before: "wenig Ruhe",
    after: "mehr Ruhe & Kontrolle",
    iconKey: "arrow-down",
    tickBefore: "wild",
    tickAfter: "ruhig",
  },
  color_protection: {
    intro: "länger lebendige Farbe",
    scope: "HAAR",
    before: "wenig Schutz",
    after: "mehr Farbglanz & Schutz",
    iconKey: "palette",
    tickBefore: "verblasst",
    tickAfter: "lebendig",
  },
}

const CONCERN_TO_GOAL_PRIORITY: Record<QuizConcern, Goal[]> = {
  frizz: ["less_frizz", "moisture", "shine"],
  dryness: ["moisture", "healthier_hair", "shine"],
  breakage: ["anti_breakage", "strengthen", "healthier_hair"],
  split_ends: ["less_split_ends", "healthier_hair", "strengthen"],
  tangling: ["less_frizz", "moisture", "healthier_hair"],
  hair_damage: ["healthier_hair", "strengthen", "anti_breakage"],
}

const BASE_CONCERN_SCORES: Record<QuizConcern, number> = {
  breakage: 60,
  dryness: 50,
  hair_damage: 40,
  tangling: 30,
  split_ends: 20,
  frizz: 10,
}

function isHairTexture(value: QuizAnswers["structure"]): value is HairTexture {
  return value === "straight" || value === "wavy" || value === "curly" || value === "coily"
}

function hasColorTreatment(answers: QuizAnswers): boolean {
  return (
    answers.treatment?.includes("gefaerbt") === true ||
    answers.treatment?.includes("blondiert") === true
  )
}

function scoreToBucket(score: number): SeverityBucket {
  if (score >= 8) return "very_high"
  if (score >= 5) return "high"
  if (score >= 3) return "medium"
  if (score >= 1) return "low"
  return "very_low"
}

function scoreConcern(concern: QuizConcern, answers: QuizAnswers): number {
  let score = BASE_CONCERN_SCORES[concern]

  if (answers.pulltest === "snaps" && (concern === "breakage" || concern === "dryness")) {
    score += 25
  }

  if (
    answers.pulltest === "stretches_stays" &&
    (concern === "breakage" || concern === "hair_damage")
  ) {
    score += 25
  }

  if (
    answers.fingertest === "rau" &&
    (concern === "hair_damage" || concern === "tangling" || concern === "split_ends")
  ) {
    score += 15
  }

  if (answers.fingertest === "rau" && concern === "frizz") {
    score += 5
  }

  if (
    hasColorTreatment(answers) &&
    (concern === "hair_damage" || concern === "breakage" || concern === "split_ends")
  ) {
    score += 15
  }

  return score
}

function buildHairFeelScores(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
): Record<"structural" | "surface" | "scalp", number> {
  let structural = 0
  let surface = 0
  let scalp = 0

  if (answers.pulltest === "stretches_stays") structural += 3
  if (answers.pulltest === "snaps") structural += 2
  if (hasColorTreatment(answers)) structural += 2
  if (primaryConcern === "breakage" || primaryConcern === "hair_damage") structural += 2
  if (primaryConcern === "split_ends") structural += 1
  if (
    primaryGoal === "anti_breakage" ||
    primaryGoal === "strengthen" ||
    primaryGoal === "healthier_hair"
  ) {
    structural += 1
  }

  if (answers.fingertest === "rau") surface += 2
  if (answers.fingertest === "leicht_uneben") surface += 1
  if (primaryConcern === "dryness" || primaryConcern === "frizz" || primaryConcern === "tangling") {
    surface += 2
  }
  if (
    answers.goals?.includes("moisture") === true ||
    answers.goals?.includes("shine") === true ||
    answers.goals?.includes("less_frizz") === true ||
    answers.goals?.includes("curl_definition") === true
  ) {
    surface += 1
  }

  if (answers.scalp_condition) scalp += 4
  if (answers.scalp_type === "fettig" || answers.scalp_type === "trocken") scalp += 2
  if (primaryGoal === "healthy_scalp") scalp += 1

  return { structural, surface, scalp }
}

function resolveDominantHairFeelAxis(scores: ReturnType<typeof buildHairFeelScores>) {
  const entries = [
    ["scalp", scores.scalp],
    ["structural", scores.structural],
    ["surface", scores.surface],
  ] as const

  return [...entries].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "surface"
}

function buildHairFeelRow(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
): QuizResultNarrativeRow {
  const scores = buildHairFeelScores(answers, primaryConcern, primaryGoal)
  const dominantAxis = resolveDominantHairFeelAxis(scores)

  if (dominantAxis === "scalp") {
    const isGreasy = answers.scalp_type === "fettig"
    const isDry = answers.scalp_type === "trocken"
    const isIrritated = answers.scalp_condition === "gereizt"

    return {
      label: "Haargefühl",
      scope: "KOPFHAUT",
      before: isIrritated ? "unruhig" : isGreasy ? "fettig" : isDry ? "trocken" : "unruhig",
      after: "ruhiger",
      iconKey: isIrritated ? "heart" : isGreasy || isDry ? "droplet" : "leaf",
      tickBefore: isGreasy ? "unausgeglichen" : isDry ? "trocken" : "unruhig",
      tickAfter: "ausgeglichen",
      currentPosition: BUCKET_TO_POSITION[scoreToBucket(scores.scalp)],
      targetPosition: ROW_TARGET_POSITIONS.hairFeel,
    }
  }

  if (dominantAxis === "structural") {
    return {
      label: "Haargefühl",
      scope: "HAAR",
      before: "geschwächt & strapaziert",
      after: "kräftiger & geschützter",
      iconKey: "shield",
      tickBefore: "strapaziert",
      tickAfter: "geschützt",
      currentPosition: BUCKET_TO_POSITION[scoreToBucket(scores.structural)],
      targetPosition: ROW_TARGET_POSITIONS.hairFeel,
    }
  }

  const isDefinitionLed =
    primaryGoal === "curl_definition" &&
    (answers.structure === "wavy" || answers.structure === "curly" || answers.structure === "coily")
  const isBoostedSurface =
    primaryConcern === "frizz" ||
    primaryConcern === "tangling" ||
    answers.goals?.includes("less_frizz") === true ||
    answers.goals?.includes("shine") === true ||
    isDefinitionLed
  const surfacePosition =
    primaryConcern === "dryness" || primaryGoal === "moisture"
      ? BUCKET_TO_POSITION.low
      : isBoostedSurface
        ? BUCKET_TO_POSITION.high
        : BUCKET_TO_POSITION[scoreToBucket(scores.surface)]

  return {
    label: "Haargefühl",
    scope: isDefinitionLed ? "WELLEN & LOCKEN" : "LÄNGEN",
    before:
      primaryConcern === "dryness" || primaryGoal === "moisture"
        ? "trocken & spröde"
        : primaryConcern === "frizz" || primaryGoal === "less_frizz"
          ? "stumpf & unruhig"
          : isDefinitionLed
            ? "wenig Definition"
            : "rau & unruhig",
    after:
      primaryConcern === "dryness" || primaryGoal === "moisture"
        ? "weicher & geschmeidiger"
        : primaryConcern === "frizz" || primaryGoal === "less_frizz"
          ? "ruhiger & glänzender"
          : isDefinitionLed
            ? "mehr Form & Bündelung"
            : "ruhiger & glänzender",
    iconKey:
      primaryConcern === "dryness" || primaryGoal === "moisture"
        ? "droplet"
        : isDefinitionLed
          ? "waves"
          : "sparkles",
    tickBefore:
      primaryConcern === "dryness" || primaryGoal === "moisture"
        ? "trocken"
        : primaryConcern === "frizz" || primaryGoal === "less_frizz"
          ? "unruhig"
          : isDefinitionLed
            ? "weich"
            : "rau",
    tickAfter:
      primaryConcern === "dryness" || primaryGoal === "moisture"
        ? "geschmeidig"
        : primaryConcern === "frizz" || primaryGoal === "less_frizz"
          ? "glänzend"
          : isDefinitionLed
            ? "definiert"
            : "glänzend",
    currentPosition: surfacePosition,
    targetPosition: ROW_TARGET_POSITIONS.hairFeel,
  }
}

function resolvePrimaryConcern(answers: QuizAnswers): QuizConcern | null {
  const concerns = (answers.concerns ?? []).filter((concern): concern is QuizConcern =>
    QUIZ_CONCERN_VALUES.includes(concern as QuizConcern),
  )

  if (concerns.length === 0) {
    return null
  }

  return (
    [...concerns].sort((left, right) => {
      const scoreDelta = scoreConcern(right, answers) - scoreConcern(left, answers)
      if (scoreDelta !== 0) {
        return scoreDelta
      }

      return QUIZ_CONCERN_VALUES.indexOf(left) - QUIZ_CONCERN_VALUES.indexOf(right)
    })[0] ?? null
  )
}

function getOrderedSelectedGoals(answers: QuizAnswers): Goal[] {
  const selectedGoals = new Set(
    (answers.goals ?? []).filter((goal): goal is Goal => GOALS.includes(goal as Goal)),
  )

  if (selectedGoals.size === 0) {
    return []
  }

  if (isHairTexture(answers.structure)) {
    return getOrderedGoals(answers.structure).filter((goal) => selectedGoals.has(goal))
  }

  return GOALS.filter((goal) => selectedGoals.has(goal))
}

function resolvePrimaryGoal(answers: QuizAnswers, primaryConcern: QuizConcern | null): Goal | null {
  const selectedGoals = getOrderedSelectedGoals(answers)

  if (selectedGoals.length === 0) {
    return null
  }

  if (primaryConcern) {
    for (const goal of CONCERN_TO_GOAL_PRIORITY[primaryConcern]) {
      if (selectedGoals.includes(goal)) {
        return goal
      }
    }
  }

  return selectedGoals[0] ?? null
}

function buildIntro(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
): string {
  const goalOutcome = primaryGoal ? GOAL_COPY[primaryGoal].intro : null
  const goalLead = (answers.goals?.length ?? 0) > 1 ? "unter anderem " : ""

  if (primaryConcern && goalOutcome) {
    return `Du hast gesagt, dass dich vor allem ${CONCERN_COPY[primaryConcern].before} stört und dass du dir ${goalLead}${goalOutcome} wünschst.`
  }

  if (goalOutcome) {
    return `Du hast gesagt, dass du dir ${goalLead}${goalOutcome} wünschst und wir sehen schon, was dein Haar gerade noch ausbremst.`
  }

  return "Wir sehen schon, was dein Haar gerade noch ausbremst und in welche Richtung wir dein Haar jetzt weiterentwickeln."
}

function buildFrictionScore(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
): number {
  const canUseScalpFallback = !primaryConcern

  if (canUseScalpFallback && answers.scalp_condition) {
    let score = 4
    if (answers.scalp_type === "fettig" || answers.scalp_type === "trocken") {
      score += 1
    }
    if (primaryGoal === "healthy_scalp") {
      score += 1
    }
    return score
  }

  if (
    canUseScalpFallback &&
    (answers.scalp_type === "fettig" || answers.scalp_type === "trocken")
  ) {
    let score = 3
    if (primaryGoal === "healthy_scalp") {
      score += 1
    }
    return score
  }

  let score = 0

  if (primaryConcern === "hair_damage" || primaryConcern === "breakage") score += 3
  if (primaryConcern === "split_ends") score += 2
  if (primaryConcern === "dryness" || primaryConcern === "frizz" || primaryConcern === "tangling") {
    score += 2
  }

  if (answers.pulltest === "stretches_stays") score += 3
  if (answers.pulltest === "snaps") score += 2
  if (hasColorTreatment(answers)) score += 2
  if (answers.fingertest === "rau") score += 2

  if (primaryGoal === "healthy_scalp") score += 1
  if (
    primaryGoal === "anti_breakage" ||
    primaryGoal === "strengthen" ||
    primaryGoal === "healthier_hair"
  ) {
    score += 1
  }
  if (
    primaryGoal === "moisture" ||
    primaryGoal === "shine" ||
    primaryGoal === "less_frizz" ||
    primaryGoal === "curl_definition"
  ) {
    score += 1
  }

  return score
}

function resolveFrictionScope(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
): QuizResultScope {
  const canUseScalpFallback = !primaryConcern

  if (canUseScalpFallback && answers.scalp_condition) {
    return "KOPFHAUT"
  }

  if (
    canUseScalpFallback &&
    (answers.scalp_type === "fettig" || answers.scalp_type === "trocken")
  ) {
    return "ANSATZ"
  }

  if (primaryConcern === "split_ends" || primaryGoal === "less_split_ends") {
    return "SPITZEN"
  }

  if (primaryConcern === "hair_damage" || primaryConcern === "breakage") {
    return "HAAR"
  }

  if (primaryGoal === "curl_definition") {
    return "WELLEN & LOCKEN"
  }

  return "LÄNGEN"
}

function buildFrictionRow(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
): QuizResultNarrativeRow {
  const canUseScalpFallback = !primaryConcern
  const scope = resolveFrictionScope(answers, primaryConcern, primaryGoal)

  if (canUseScalpFallback && answers.scalp_condition === "gereizt") {
    return {
      label: "Was dich gerade ausbremst",
      scope,
      before: "gereizt",
      after: "mehr Ruhe",
      iconKey: "heart",
      tickBefore: "gereizt",
      tickAfter: "beruhigt",
      currentPosition:
        BUCKET_TO_POSITION[scoreToBucket(buildFrictionScore(answers, primaryConcern, primaryGoal))],
      targetPosition: ROW_TARGET_POSITIONS.friction,
    }
  }

  if (canUseScalpFallback && answers.scalp_condition === "schuppen") {
    return {
      label: "Was dich gerade ausbremst",
      scope,
      before: "Schuppen",
      after: "mehr Ruhe",
      iconKey: "leaf",
      tickBefore: "unruhig",
      tickAfter: "ausgeglichen",
      currentPosition:
        BUCKET_TO_POSITION[scoreToBucket(buildFrictionScore(answers, primaryConcern, primaryGoal))],
      targetPosition: ROW_TARGET_POSITIONS.friction,
    }
  }

  if (canUseScalpFallback && answers.scalp_condition === "trockene_schuppen") {
    return {
      label: "Was dich gerade ausbremst",
      scope,
      before: "trockene Schuppen",
      after: "mehr Balance",
      iconKey: "droplet",
      tickBefore: "trocken",
      tickAfter: "ausgeglichen",
      currentPosition:
        BUCKET_TO_POSITION[scoreToBucket(buildFrictionScore(answers, primaryConcern, primaryGoal))],
      targetPosition: ROW_TARGET_POSITIONS.friction,
    }
  }

  if (canUseScalpFallback && answers.scalp_type === "fettig") {
    return {
      label: "Was dich gerade ausbremst",
      scope,
      before: "fettig",
      after: "mehr Balance",
      iconKey: "droplet",
      tickBefore: "unausgeglichen",
      tickAfter: "ausgeglichen",
      currentPosition:
        BUCKET_TO_POSITION[scoreToBucket(buildFrictionScore(answers, primaryConcern, primaryGoal))],
      targetPosition: ROW_TARGET_POSITIONS.friction,
    }
  }

  if (canUseScalpFallback && answers.scalp_type === "trocken") {
    return {
      label: "Was dich gerade ausbremst",
      scope,
      before: "trocken",
      after: "mehr Balance",
      iconKey: "droplet",
      tickBefore: "trocken",
      tickAfter: "ausgeglichen",
      currentPosition:
        BUCKET_TO_POSITION[scoreToBucket(buildFrictionScore(answers, primaryConcern, primaryGoal))],
      targetPosition: ROW_TARGET_POSITIONS.friction,
    }
  }

  const copy = primaryConcern
    ? CONCERN_COPY[primaryConcern]
    : {
        before: "Pflege, die noch nicht richtig zu deinem Haar passt",
        after: "mehr Ruhe, Glanz & Ausgewogenheit",
        iconKey: "sparkles" as const,
        tickBefore: "unstimmig",
        tickAfter: "passend",
      }

  return {
    label: "Was dich gerade ausbremst",
    scope,
    before: copy.before,
    after: copy.after,
    iconKey: copy.iconKey,
    tickBefore: copy.tickBefore,
    tickAfter: copy.tickAfter,
    currentPosition:
      BUCKET_TO_POSITION[scoreToBucket(buildFrictionScore(answers, primaryConcern, primaryGoal))],
    targetPosition: ROW_TARGET_POSITIONS.friction,
  }
}

function buildGoalScore(primaryGoal: Goal | null): number {
  if (!primaryGoal) {
    return 0
  }

  switch (primaryGoal) {
    case "less_frizz":
    case "anti_breakage":
    case "strengthen":
    case "healthy_scalp":
      return 4
    case "healthier_hair":
    case "less_split_ends":
    case "curl_definition":
      return 3
    case "moisture":
    case "shine":
    case "volume":
    case "less_volume":
    case "color_protection":
      return 2
    default:
      return 0
  }
}

function resolveGoalScope(primaryGoal: Goal | null): QuizResultScope {
  if (!primaryGoal) {
    return "LÄNGEN"
  }

  switch (primaryGoal) {
    case "healthy_scalp":
      return "KOPFHAUT"
    case "less_split_ends":
      return "SPITZEN"
    case "curl_definition":
      return "WELLEN & LOCKEN"
    case "shine":
    case "color_protection":
    case "volume":
    case "less_volume":
    case "healthier_hair":
    case "anti_breakage":
    case "strengthen":
      return "HAAR"
    case "less_frizz":
    case "moisture":
      return "LÄNGEN"
    default:
      return "LÄNGEN"
  }
}

function buildOutcomeRow(primaryGoal: Goal | null): QuizResultNarrativeRow {
  const copy = primaryGoal ? GOAL_COPY[primaryGoal] : GOAL_COPY.moisture
  const score = buildGoalScore(primaryGoal)

  return {
    label: "Worauf wir hinarbeiten",
    scope: resolveGoalScope(primaryGoal),
    before: copy.before,
    after: copy.after,
    iconKey: copy.iconKey,
    tickBefore: copy.tickBefore,
    tickAfter: copy.tickAfter,
    currentPosition: BUCKET_TO_POSITION[scoreToBucket(score)],
    targetPosition: ROW_TARGET_POSITIONS.outcome,
  }
}

function buildNeedsSection(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
): QuizResultNeedsSection {
  const hasScalpSignals =
    answers.scalp_condition === "schuppen" ||
    answers.scalp_condition === "trockene_schuppen" ||
    answers.scalp_condition === "gereizt" ||
    answers.scalp_type === "fettig" ||
    answers.scalp_type === "trocken" ||
    primaryGoal === "healthy_scalp"

  if (primaryGoal === "healthy_scalp" || (!primaryConcern && hasScalpSignals)) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Die Kopfhaut gezielter ausgleichen",
      mainLeverWhy:
        "Wenn die Kopfhaut aus dem Gleichgewicht ist, bleibt sie leichter gereizt und Schuppen kommen schneller wieder.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem passenden Anti-Schuppen-Shampoo; zusätzlich kann ein beruhigendes Kopfhautserum helfen, die Kopfhaut zwischen den Haarwäschen ruhiger zu halten.",
    }
  }

  const needsStructuralRepair =
    primaryConcern === "breakage" ||
    primaryConcern === "hair_damage" ||
    hasColorTreatment(answers) ||
    answers.pulltest === "stretches_stays"

  if (needsStructuralRepair) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Mehr Stabilität in die Längen bringen",
      mainLeverWhy:
        "Wenn die Längen geschwächt sind, geben sie schneller nach und Spliss oder Haarbruch werden leichter weiter begünstigt.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem Bondbuilder; zusätzlich kann eine stärkende Maske helfen, die Längen belastbarer zu halten.",
    }
  }

  const needsSurfaceSupport =
    primaryConcern === "frizz" ||
    primaryConcern === "dryness" ||
    primaryConcern === "tangling" ||
    primaryGoal === "less_frizz" ||
    primaryGoal === "moisture" ||
    primaryGoal === "shine" ||
    primaryGoal === "curl_definition"

  if (needsSurfaceSupport) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Mehr Schutz für Oberfläche und Längen aufbauen",
      mainLeverWhy:
        "Wenn die Oberfläche aufraut, fallen die Längen schneller unruhig und lassen sich schwerer kontrollieren.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem passenden Conditioner; zusätzlich kann ein Leave-in helfen, die Längen zwischen den Wäschen ruhiger zu halten.",
    }
  }

  if (primaryConcern === "split_ends" || primaryGoal === "less_split_ends") {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Die Spitzen gezielt schützen",
      mainLeverWhy:
        "Wenn die Spitzen ausfransen, fühlen sie sich schneller trocken an und fallen weniger glatt.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem leichten Haaröl; zusätzlich kann ein Leave-in helfen, die Spitzen geschmeidiger und besser geschützt zu halten.",
    }
  }

  return {
    title: "Was dein Haar jetzt braucht",
    mainLeverTitle: "Die Pflegebasis besser auf dein Haar abstimmen",
    mainLeverWhy:
      "Wenn die Pflegebasis besser passt, wirkt dein Haar insgesamt ruhiger und stimmiger.",
    mainLeverProducts:
      "Am meisten erreichen wir hier mit einem passenden Conditioner; zusätzlich kann ein leichtes Leave-in helfen, die Wirkung in den Längen zu halten.",
  }
}

export function buildQuizResultNarrative(rawAnswers: QuizAnswers): QuizResultNarrative {
  const answers = canonicalizeQuizAnswers(rawAnswers)
  const primaryConcern = resolvePrimaryConcern(answers)
  const primaryGoal = resolvePrimaryGoal(answers, primaryConcern)

  const hairFeelRow = buildHairFeelRow(answers, primaryConcern, primaryGoal)
  const frictionRow = buildFrictionRow(answers, primaryConcern, primaryGoal)
  const outcomeRow = buildOutcomeRow(primaryGoal)

  return {
    intro: buildIntro(answers, primaryConcern, primaryGoal),
    rows: [hairFeelRow, frictionRow, outcomeRow],
    needs: buildNeedsSection(answers, primaryConcern, primaryGoal),
    cta: {
      lead: "Als Nächstes: dein persönlicher Plan",
      label: "MEINE ROUTINE STARTEN",
      subline: "Mit passenden Produkten, Reihenfolge und Anwendung.",
    },
    primaryConcern,
    primaryGoal,
  }
}

export const buildResultNarrative = buildQuizResultNarrative
