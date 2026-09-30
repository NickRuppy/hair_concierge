import type { QuizAnswers } from "@/lib/quiz/types"

import { SCALP_CONCERN_PRIORITY } from "./legacy-vocabulary"
import type { DiagnosticsV1 } from "./schema"

/**
 * The diagnostics facts in the answer format the iOS profile edit and the scanner's edit record
 * use (`QuizAnswers`, clean switch — scanner regression fix). Goals and concerns are handed back
 * in the quiz's own vocabulary, which that format already accepts, so nothing the facts hold is
 * translated into the older profile lists. Pure and I/O-free.
 *
 * The format cannot express three things the facts may hold; the iOS hand edit keeps the stored
 * value when the submitted answer is exactly what this function showed
 * (`buildMobileHandEditFacts`):
 *  - several scalp concerns: one `scalp_condition` shows the highest-priority one;
 *  - "natural" together with a chemical treatment: shown without "natural";
 *  - an absent array field (a partial document): shown as `[]` (`has_scalp_issue: false`).
 * A stored `volumeDirection` is handed back as the legacy goal it came from (`volume` /
 * `less_volume`, migration table M), which the edit projects back to the same direction.
 */

const SURFACE_TO_FINGERTEST = {
  smooth: "glatt",
  slightly_uneven: "leicht_uneben",
  rough: "rau",
} as const

const OILINESS_TO_SCALP_TYPE = {
  oily: "fettig",
  balanced: "ausgeglichen",
  dry: "trocken",
} as const

const SCALP_CONCERN_TO_CONDITION = {
  oily_dandruff: "schuppen",
  dry_dandruff: "trockene_schuppen",
  irritated: "gereizt",
} as const

const TREATMENT_TO_ANSWER: Readonly<Record<string, string>> = {
  natural: "natur",
  colored: "gefaerbt",
  lightened: "blondiert",
  permed: "dauerwelle",
  chemically_straightened: "chemisch_geglaettet",
}

export function diagnosticsToQuizAnswers(diagnostics: DiagnosticsV1): QuizAnswers {
  const scalpConcern = SCALP_CONCERN_PRIORITY.find((concern) =>
    diagnostics.scalpConcerns?.includes(concern),
  )
  const treatment = (diagnostics.chemicalTreatments ?? []).map(
    (value) => TREATMENT_TO_ANSWER[value] ?? value,
  )
  const concerns = [...(diagnostics.currentConcerns ?? [])]
  const goals = (diagnostics.goals ?? []).map((goal) =>
    goal === "volume_balance" && diagnostics.volumeDirection
      ? diagnostics.volumeDirection === "more"
        ? ("volume" as const)
        : ("less_volume" as const)
      : goal,
  )
  return {
    structure: diagnostics.texture,
    thickness: diagnostics.thickness,
    density: diagnostics.density,
    hair_length: diagnostics.hairLength,
    fingertest: diagnostics.hairSurface
      ? SURFACE_TO_FINGERTEST[diagnostics.hairSurface]
      : undefined,
    pulltest: diagnostics.elasticResponse,
    scalp_type: diagnostics.scalpOiliness
      ? OILINESS_TO_SCALP_TYPE[diagnostics.scalpOiliness]
      : undefined,
    has_scalp_issue: Boolean(scalpConcern),
    ...(scalpConcern ? { scalp_condition: SCALP_CONCERN_TO_CONDITION[scalpConcern] } : {}),
    treatment: treatment.length > 1 ? treatment.filter((value) => value !== "natur") : treatment,
    concerns,
    ...(diagnostics.primaryConcern && concerns.includes(diagnostics.primaryConcern)
      ? { primary_concern: diagnostics.primaryConcern }
      : {}),
    ...(diagnostics.currentConcernsOtherText
      ? { concerns_other_text: diagnostics.currentConcernsOtherText }
      : {}),
    goals,
  }
}
