import type { PersonalPlanDiagnosticDimension, PersonalPlanOfferModel } from "./types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function isSegment(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3
}

function parseDiagnosticDimension(value: unknown): PersonalPlanDiagnosticDimension | null {
  if (!isRecord(value)) return null
  const id = value.id
  const title = value.title
  const todayLabel = value.todayLabel
  const potentialLabel = value.potentialLabel
  const summary = value.summary
  const todaySegments = value.todaySegments
  const potentialSegments = value.potentialSegments
  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof todayLabel !== "string" ||
    typeof potentialLabel !== "string" ||
    typeof summary !== "string" ||
    !isSegment(todaySegments) ||
    !isSegment(potentialSegments)
  ) {
    return null
  }
  return {
    id,
    potentialLabel,
    potentialSegments,
    summary,
    title,
    todayLabel,
    todaySegments,
  }
}

export function parsePersonalPlanOfferModel(raw: unknown): PersonalPlanOfferModel | null {
  if (!isRecord(raw)) return null
  const candidate =
    raw.planTitle || raw.plan_title
      ? raw
      : (raw.publicOfferModel ??
        raw.public_offer_model ??
        (isRecord(raw.preparedPlan) ? raw.preparedPlan.publicOfferModel : undefined) ??
        (isRecord(raw.prepared_plan) ? raw.prepared_plan.public_offer_model : undefined))
  if (!isRecord(candidate)) return null

  const planTitle = candidate.planTitle ?? candidate.plan_title
  const profileLine = candidate.profileLine ?? candidate.profile_line
  const planFitStatement = candidate.planFitStatement ?? candidate.plan_fit_statement
  const diagnosticRows = candidate.diagnosticRows ?? candidate.diagnostic_rows
  if (
    typeof planTitle !== "string" ||
    typeof planFitStatement !== "string" ||
    !Array.isArray(diagnosticRows) ||
    diagnosticRows.length !== 3
  ) {
    return null
  }
  const rows = diagnosticRows.map(parseDiagnosticDimension)
  if (rows.some((row) => row === null)) return null
  return {
    diagnosticRows: rows as PersonalPlanOfferModel["diagnosticRows"],
    planFitStatement,
    planTitle,
    profileLine: typeof profileLine === "string" ? profileLine : undefined,
  }
}

export const PERSONAL_PLAN_OFFER_FALLBACK_MODEL: PersonalPlanOfferModel = {
  diagnosticRows: [
    {
      id: "surface",
      potentialLabel: "ruhig & glänzend",
      potentialSegments: 3,
      summary:
        "Dein Plan bringt Reinigung, Pflege und Styling in eine Reihenfolge, die deine Oberfläche sichtbar ruhiger wirken lässt.",
      title: "Oberfläche & Glanz",
      todayLabel: "unruhig",
      todaySegments: 1,
    },
    {
      id: "moisture",
      potentialLabel: "ausgeglichen",
      potentialSegments: 3,
      summary:
        "Die Produktauswahl wird so aufgebaut, dass Längen und Spitzen genug Pflege bekommen, ohne beschwert zu wirken.",
      title: "Feuchtigkeit & Pflegebalance",
      todayLabel: "unausgeglichen",
      todaySegments: 2,
    },
    {
      id: "routine",
      potentialLabel: "klar",
      potentialSegments: 3,
      summary:
        "Du bekommst klare Schritte für Waschtag, Pflege und Styling, damit deine Routine im Alltag wieder einfacher wird.",
      title: "Routine-Sicherheit",
      todayLabel: "unklar",
      todaySegments: 1,
    },
  ],
  planFitStatement:
    "Dein Haar braucht keine kompliziertere Pflege. Es braucht eine klare Routine, die zu Textur, Kopfhaut und Alltag passt.",
  planTitle: "Dein persönlicher Haarpflegeplan",
  profileLine: "Basierend auf deiner Haaranalyse",
}
