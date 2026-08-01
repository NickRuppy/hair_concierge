import type { PersonalPlanQuizAnswers } from "./types"

export type PersonalPlanProfileSummaryRow = {
  label: "Haarprofil" | "Pflegefokus" | "Kopfhaut" | "Plan-Stil"
  value: string
}

const textureLabels = { straight: "Glatt", wavy: "Wellig", curly: "Lockig", coily: "Kraus" }
const thicknessLabels = { fine: "fein", normal: "mittel", coarse: "dick" }
const densityLabels = { low: "wenige Haare", medium: "mittlere Dichte", high: "viele Haare" }
const styleLabels = {
  simple_reliable: "Einfach & verlässlich",
  intentional_caring: "Bewusst & pflegend",
  flexible_versatile: "Flexibel & vielseitig",
  precise_goal_oriented: "Präzise & zielgerichtet",
}
const momentLabels = {
  everyday: "für deinen Alltag",
  work: "für Arbeit & Auftreten",
  social: "für gemeinsame Momente",
  going_out: "zum Ausgehen",
  special_occasions: "für besondere Anlässe",
}

function careFocus(answers: PersonalPlanQuizAnswers): string {
  const focus: string[] = []
  const concerns = new Set(answers.currentConcerns)
  const goals = new Set(answers.goals)

  if (
    concerns.has("breakage") ||
    concerns.has("split_ends") ||
    answers.chemicalTreatments?.includes("lightened") ||
    answers.elasticResponse === "snaps" ||
    goals.has("strength_ends")
  ) {
    focus.push("Stärkung der Längen")
  }
  if (
    concerns.has("dry_lengths") ||
    concerns.has("frizz_flyaways") ||
    goals.has("moisture") ||
    goals.has("frizz_surface")
  ) {
    focus.push("Feuchtigkeit & Geschmeidigkeit")
  }
  if (concerns.has("lost_shape") || goals.has("shape_definition")) {
    focus.push("Form & Definition")
  }
  if (concerns.has("low_volume_or_weighed_down") || goals.has("volume_balance")) {
    focus.push("Leichtigkeit & Volumen")
  }
  if (
    answers.scalpOiliness !== "balanced" ||
    answers.scalpConcerns?.length ||
    goals.has("scalp_balance")
  ) {
    focus.push("Kopfhaut-Balance")
  }

  return focus.slice(0, 2).join(" · ") || "Deine ausgewählten Ziele"
}

function scalpSummary(answers: PersonalPlanQuizAnswers): string {
  const parts: string[] = []
  if (answers.scalpOiliness === "oily") parts.push("eher fettend")
  if (answers.scalpOiliness === "balanced") parts.push("eher ausgeglichen")
  if (answers.scalpOiliness === "dry") parts.push("eher trocken")
  const scalpConcerns = new Set(answers.scalpConcerns)
  if (scalpConcerns.has("oily_dandruff")) parts.push("mit fettigen Schuppen")
  if (scalpConcerns.has("dry_dandruff")) parts.push("mit trockenen Schuppen")
  if (scalpConcerns.has("irritated")) parts.push("gereizt oder empfindlich")
  return parts.join(" · ") || "wird noch eingeordnet"
}

function planStyle(answers: PersonalPlanQuizAnswers): string {
  const parts = [
    answers.routineStyle && styleLabels[answers.routineStyle],
    answers.meaningfulMoment && momentLabels[answers.meaningfulMoment],
  ].filter(Boolean)
  return parts.join(" · ") || "wird an deinen Alltag angepasst"
}

export function derivePersonalPlanProfileSummary(
  answers: PersonalPlanQuizAnswers,
): PersonalPlanProfileSummaryRow[] {
  const hairProfile =
    [
      answers.texture && textureLabels[answers.texture],
      answers.thickness && thicknessLabels[answers.thickness],
      answers.density && densityLabels[answers.density],
    ]
      .filter(Boolean)
      .join(" · ") || "wird noch eingeordnet"

  return [
    { label: "Haarprofil", value: hairProfile },
    { label: "Pflegefokus", value: careFocus(answers) },
    { label: "Kopfhaut", value: scalpSummary(answers) },
    { label: "Plan-Stil", value: planStyle(answers) },
  ]
}
