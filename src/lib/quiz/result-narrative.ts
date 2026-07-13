import type { ChemicalTreatment, Goal } from "@/lib/vocabulary"
import { getChemicalTreatmentDamageWeight } from "@/lib/profile/chemical-treatment"

import { canonicalizeQuizAnswers } from "./normalization"
import { resolveQuizNeed, type QuizConcern, type QuizNeedLane } from "./need-lane"
import type { QuizAnswers } from "./types"

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

export type QuizResultNeedsProduct = { name: string; description: string }

interface QuizResultNeedsSection {
  title: string
  mainLeverTitle: string
  mainLeverWhy: string
  mainLeverProducts: string
  products: readonly [QuizResultNeedsProduct, QuizResultNeedsProduct]
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
  heroHeadline: string
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
    after: "weichere, geschmeidige Längen",
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
    after: "kräftigere, geschützte Längen",
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

function getQuizChemicalStressWeight(answers: QuizAnswers): number {
  const treatmentMap: Record<string, ChemicalTreatment> = {
    natur: "natural",
    gefaerbt: "colored",
    blondiert: "bleached",
    dauerwelle: "permed",
    chemisch_geglaettet: "chemically_straightened",
  }

  const canonicalTreatments = (answers.treatment ?? []).map(
    (treatment) => treatmentMap[treatment] ?? treatment,
  ) as ChemicalTreatment[]

  return getChemicalTreatmentDamageWeight(canonicalTreatments)
}

function scoreToBucket(score: number): SeverityBucket {
  if (score >= 8) return "very_high"
  if (score >= 5) return "high"
  if (score >= 3) return "medium"
  if (score >= 1) return "low"
  return "very_low"
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
  structural += getQuizChemicalStressWeight(answers)
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
      before: "strapazierte Längen",
      after: "spürbar fester",
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
        ? "weich in der Hand"
        : primaryConcern === "frizz" || primaryGoal === "less_frizz"
          ? "ruhig & geordnet"
          : isDefinitionLed
            ? "Bündelung im Griff"
            : "ausgeglichen im Griff",
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

function buildHeroHeadline(lane: QuizNeedLane): string {
  if (lane === "bond_repair") return "Deine Längen brauchen gezielteren Schutz."
  if (lane === "protein") return "Mehr Struktur kann deine Längen jetzt gezielt unterstützen."
  if (lane === "deep_moisture") return "Mehr Feuchtigkeit kann deine Längen gezielt unterstützen."
  if (lane === "surface_support")
    return "Die passende Pflege kann deine Längen spürbar ruhiger machen."
  if (lane === "ends_protection") return "Mit gezieltem Spitzenschutz ist noch viel möglich."
  if (lane === "scalp_focus") return "Eine passende Pflegebasis beginnt bei deiner Kopfhaut."
  return "Deine Balance ist näher dran, als es sich gerade anfühlt."
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
  score += Math.min(getQuizChemicalStressWeight(answers), 3)
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
        before: "unpassende Pflege",
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
  lane: QuizNeedLane,
): QuizResultNeedsSection {
  const scalpAllowed = lane === "scalp_focus"

  if (
    scalpAllowed &&
    (answers.scalp_condition === "schuppen" || answers.scalp_condition === "trockene_schuppen")
  ) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Die Kopfhaut gezielter ausgleichen",
      mainLeverWhy:
        "Wenn die Kopfhaut aus dem Gleichgewicht ist, bleibt sie leichter gereizt und Schuppen kommen schneller wieder.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem passenden Anti-Schuppen-Shampoo; ein Conditioner pflegt die Längen passend dazu, ohne eine weitere Kopfhautbehandlung zu versprechen.",
      products: [
        { name: "Anti-Schuppen-Shampoo", description: "Reguliert die Kopfhaut bei jeder Wäsche." },
        { name: "Passender Conditioner", description: "Pflegt die Längen passend zur Haarwäsche." },
      ],
    }
  }

  if (scalpAllowed && answers.scalp_condition === "gereizt") {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Die Kopfhaut beruhigen",
      mainLeverWhy:
        "Wenn die Kopfhaut gereizt ist, fällt das ganze Haarbild stumpfer und uneinheitlicher aus.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem beruhigenden Shampoo; zusätzlich kann ein leichtes Leave-in helfen, die Längen zu pflegen, ohne die Kopfhaut zu belasten.",
      products: [
        {
          name: "Beruhigendes Shampoo",
          description: "Mildert die Kopfhautreizung bei jeder Wäsche.",
        },
        {
          name: "Leichtes Leave-in",
          description: "Pflegt die Längen, ohne die Kopfhaut zu belasten.",
        },
      ],
    }
  }

  if (scalpAllowed) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Die Kopfhaut in Balance bringen",
      mainLeverWhy:
        "Wenn die Kopfhaut zu schnell fettet oder austrocknet, verliert das Haar Frische und Volumen schon nach kurzer Zeit.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem Balance-Shampoo; zusätzlich kann ein leichter Conditioner die Längen pflegen, ohne die Kopfhaut zu belasten.",
      products: [
        {
          name: "Balance-Shampoo",
          description: "Bringt die Kopfhaut in Balance, ohne sie auszutrocknen.",
        },
        {
          name: "Leichter Conditioner",
          description: "Pflegt die Längen, ohne die Kopfhaut zu belasten.",
        },
      ],
    }
  }

  if (lane === "bond_repair") {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Mehr Stabilität in die Längen bringen",
      mainLeverWhy:
        "Wenn die Längen geschwächt sind, geben sie schneller nach und Spliss oder Haarbruch werden leichter weiter begünstigt.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem Bondbuilder; zusätzlich kann eine stärkende Maske helfen, die Längen belastbarer zu halten.",
      products: [
        { name: "Bondbuilder", description: "Stabilisiert die Längen von innen." },
        { name: "Stärkende Maske", description: "Macht die Längen wieder belastbar." },
      ],
    }
  }

  if (lane === "protein") {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Überdehnten Längen wieder Struktur geben",
      mainLeverWhy:
        "Wenn die Längen überdehnt sind und langsam zurückspringen, fehlt ihnen Struktur — nicht unbedingt Feuchtigkeit.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einer Protein-Maske; zusätzlich kann ein Conditioner für strapaziertes Haar helfen, die Längen zwischen den Wäschen zu stützen.",
      products: [
        { name: "Protein-Maske", description: "Gibt überdehnten Längen wieder Struktur." },
        {
          name: "Conditioner für strapaziertes Haar",
          description: "Stützt die Längen zwischen den Masken.",
        },
      ],
    }
  }

  if (lane === "deep_moisture") {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Den Längen mehr Feuchtigkeit zurückgeben",
      mainLeverWhy:
        "Wenn die Längen schnell brechen statt nachzugeben, fehlt ihnen Feuchtigkeit — nicht mehr Protein.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einer Feuchtigkeitsmaske; zusätzlich kann ein Conditioner für trockenes Haar helfen, die Längen zwischen den Masken geschmeidig zu halten.",
      products: [
        {
          name: "Feuchtigkeitsmaske",
          description: "Versorgt trockene Längen tief mit Feuchtigkeit.",
        },
        {
          name: "Conditioner für trockenes Haar",
          description: "Hält die Längen geschmeidig zwischen den Masken.",
        },
      ],
    }
  }

  // Curl definition — fires when curl is the user's clean goal and there's no concern to address first.
  const hasTexture =
    answers.structure === "wavy" || answers.structure === "curly" || answers.structure === "coily"
  const hasDefinitionShapeContext = hasTexture

  if (
    lane === "surface_support" &&
    primaryGoal === "curl_definition" &&
    hasDefinitionShapeContext &&
    !primaryConcern
  ) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Wellen und Locken besser definieren",
      mainLeverWhy:
        "Wenn die Locken sich verlieren, fehlt es selten an Pflege — sondern an einem Produkt, das die Bündelung hält.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem Curl-Leave-in; zusätzlich kann ein pflegender Conditioner helfen, die Locken weich und beweglich zu halten.",
      products: [
        { name: "Curl-Leave-in", description: "Definiert Wellen und Locken zwischen den Wäschen." },
        { name: "Pflegender Conditioner", description: "Hält die Locken weich und beweglich." },
      ],
    }
  }

  // Shine — fires when shine is the user's clean goal and there's no concern to address first.
  if (lane === "ends_protection" && primaryGoal === "shine" && !primaryConcern) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Mehr Glanz in die Längen bringen",
      mainLeverWhy:
        "Wenn die Oberfläche stumpf wirkt, reflektiert das Licht nicht — eine kleine Versiegelung reicht oft schon.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem Glanz-Leave-in; zusätzlich kann ein leichtes Haaröl helfen, die Oberfläche zu versiegeln.",
      products: [
        { name: "Glanz-Leave-in", description: "Bringt Glanz zurück in die Längen." },
        { name: "Leichtes Haaröl", description: "Versiegelt die Oberfläche und betont den Glanz." },
      ],
    }
  }

  if (lane === "surface_support") {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Mehr Schutz für Oberfläche und Längen aufbauen",
      mainLeverWhy:
        "Wenn die Oberfläche aufraut, fallen die Längen schneller unruhig und lassen sich schwerer kontrollieren.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem passenden Conditioner; zusätzlich kann ein Leave-in helfen, die Längen zwischen den Wäschen ruhiger zu halten.",
      products: [
        { name: "Conditioner", description: "Stabilisiert die Oberfläche der Längen." },
        { name: "Leave-in", description: "Hält die Wirkung zwischen den Wäschen." },
      ],
    }
  }

  if (lane === "ends_protection") {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Die Spitzen gezielt schützen",
      mainLeverWhy:
        "Wenn die Spitzen ausfransen, fühlen sie sich schneller trocken an und fallen weniger glatt.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem leichten Haaröl; zusätzlich kann ein Leave-in helfen, die Spitzen geschmeidiger und besser geschützt zu halten.",
      products: [
        { name: "Leichtes Haaröl", description: "Schützt und glättet die Spitzen." },
        { name: "Leave-in", description: "Hält die Spitzen geschmeidig." },
      ],
    }
  }

  return {
    title: "Was dein Haar jetzt braucht",
    mainLeverTitle: "Die Pflegebasis besser auf dein Haar abstimmen",
    mainLeverWhy:
      "Wenn die Pflegebasis besser passt, wirkt dein Haar insgesamt ruhiger und stimmiger.",
    mainLeverProducts:
      "Am meisten erreichen wir hier mit einem passenden Conditioner; zusätzlich kann ein leichtes Leave-in helfen, die Wirkung in den Längen zu halten.",
    products: [
      { name: "Conditioner", description: "Stimmt die Pflegebasis ab." },
      { name: "Leichtes Leave-in", description: "Hält die Wirkung in den Längen." },
    ],
  }
}

export function buildQuizResultNarrative(rawAnswers: QuizAnswers): QuizResultNarrative {
  const answers = canonicalizeQuizAnswers(rawAnswers)
  const { lane, primaryConcern, primaryGoal } = resolveQuizNeed(answers)

  const hairFeelRow = buildHairFeelRow(answers, primaryConcern, primaryGoal)
  const frictionRow = buildFrictionRow(answers, primaryConcern, primaryGoal)
  const outcomeRow = buildOutcomeRow(primaryGoal)

  return {
    heroHeadline: buildHeroHeadline(lane),
    intro: buildIntro(answers, primaryConcern, primaryGoal),
    rows: [hairFeelRow, frictionRow, outcomeRow],
    needs: buildNeedsSection(answers, primaryConcern, primaryGoal, lane),
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
