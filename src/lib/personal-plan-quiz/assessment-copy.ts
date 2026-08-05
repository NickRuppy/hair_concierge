import type {
  HairAssessment,
  HairAssessmentDimension,
  HairAssessmentDimensionId,
} from "./hair-assessment"
import { evidenceScoreToSegments } from "./hair-assessment"
import type { PersonalPlanDiagnosticInput } from "@/lib/quiz/diagnostic-input"

export type PersonalPlanExplanationPart = {
  kind: "text" | "answer"
  text: string
}

export type PersonalPlanAssessmentRow = {
  id: HairAssessmentDimensionId
  title: string
  todayLabel: string
  potentialLabel: "optimal"
  todaySegments: 1 | 2 | 3
  potentialSegments: 3
  summary: string
  explanationParts: PersonalPlanExplanationPart[]
}

const TITLES: Record<HairAssessmentDimensionId, string> = {
  scalp_balance: "Kopfhaut-Balance",
  hair_loss_thinning: "Haarausfall & dünner werdendes Haar",
  moisture_softness: "Feuchtigkeit & Geschmeidigkeit",
  surface_frizz: "Oberfläche & Frizz",
  shine: "Glanz",
  breakage_stability: "Haarbruch & Stabilität",
  split_ends: "Spliss & Spitzen",
  manageability_tangling: "Kämmbarkeit & Verknotung",
  shape_definition: "Form & Definition",
  volume_lightness: "Volumen & Leichtigkeit",
}

const text = (value: string): PersonalPlanExplanationPart => ({ kind: "text", text: value })
const answer = (value: string): PersonalPlanExplanationPart => ({ kind: "answer", text: value })

function plain(parts: readonly PersonalPlanExplanationPart[]) {
  return parts.map((part) => part.text).join("")
}

function explanationFitsContract(parts: readonly PersonalPlanExplanationPart[]) {
  const summary = plain(parts)
  const wordCount = summary.trim().split(/\s+/).length
  const sentenceCount = summary.split(/[.!?]+/).filter((value) => value.trim()).length
  const answerCount = parts.filter((part) => part.kind === "answer").length
  return wordCount <= 28 && sentenceCount <= 2 && answerCount <= 3
}

function appendIfFits(
  parts: PersonalPlanExplanationPart[],
  addition: PersonalPlanExplanationPart[],
) {
  if (explanationFitsContract([...parts, ...addition])) parts.push(...addition)
}

function assertExplanationContract(parts: readonly PersonalPlanExplanationPart[]) {
  if (!explanationFitsContract(parts)) {
    throw new Error("Public assessment explanation exceeds the reviewed copy contract")
  }
}

function treatmentLabel(answers: PersonalPlanDiagnosticInput) {
  if (answers.chemicalTreatments?.includes("lightened")) return "Blondierung"
  if (answers.chemicalTreatments?.includes("permed")) return "Eine Dauerwelle"
  if (answers.chemicalTreatments?.includes("chemically_straightened")) return "Chemische Glättung"
  return null
}

function shapeAnchor(answers: PersonalPlanDiagnosticInput) {
  if (answers.texture === "curly") return "Deine Locken verlieren schnell Definition"
  if (answers.texture === "coily") return "Die Definition deiner Coils hält nicht"
  if (answers.texture === "wavy") return "Deine Wellen verlieren schnell ihre Form"
  return "Dein Haar verliert schnell Form und Halt"
}

function volumeAnchor(answers: PersonalPlanDiagnosticInput) {
  if (answers.texture === "wavy") return "Flacher Ansatz und beschwerte Längen"
  if (answers.texture === "curly" || answers.texture === "coily")
    return "Ungleichmäßige Form oder ungleichmäßiges Volumen"
  return "Plattes oder beschwertes Haar"
}

function explanationFor(
  dimension: HairAssessmentDimension,
  answers: PersonalPlanDiagnosticInput,
  owns: (evidenceId: string) => boolean,
): PersonalPlanExplanationPart[] {
  const has = (id: string) => dimension.evidence.some((evidence) => evidence.id === id) && owns(id)
  const treatment = has("chemical_stress") ? treatmentLabel(answers) : null

  if (dimension.id === "scalp_balance") {
    if (dimension.positiveEligible)
      return [
        text("Du beschreibst deine Kopfhaut als "),
        answer("ausgeglichen"),
        text(" und nennst keine Beschwerden. Diese Balance möchten wir erhalten."),
      ]
    const oiliness = has("scalp_oily")
      ? "Fettige Kopfhaut"
      : has("scalp_dry")
        ? "Trockene Kopfhaut"
        : null
    const concern = has("scalp_irritated")
      ? "Jucken, Rötung oder Brennen"
      : has("scalp_oily_dandruff")
        ? "fettige Schuppen"
        : has("scalp_dry_dandruff")
          ? "trockene Schuppen"
          : null
    if (oiliness && concern === "Jucken, Rötung oder Brennen")
      return [
        answer(`${oiliness} und ${concern}`),
        text(
          oiliness.startsWith("Fettige")
            ? " machen Verträglichkeit wichtiger: Talg lösen, ohne die gereizte Kopfhaut zusätzlich zu belasten."
            : " machen Verträglichkeit wichtiger als zusätzliche Entfettung.",
        ),
      ]
    if (oiliness && concern)
      return [
        answer(`${oiliness} und ${concern}`),
        text(
          oiliness.startsWith("Fettige")
            ? " verlangen Balance: Talg lösen, ohne die Kopfhaut unnötig zu reizen."
            : " sprechen für milde Reinigung statt zusätzlicher Entfettung.",
        ),
      ]
    if (concern === "Jucken, Rötung oder Brennen")
      return [
        answer(concern),
        text(" machen Verträglichkeit wichtiger als möglichst intensive Reinigung."),
      ]
    if (concern)
      return [
        answer(concern),
        text(" brauchen eine Reinigung, die Flocken löst, ohne unnötig zu reizen."),
      ]
    return [
      answer(oiliness ?? "Deine Kopfhaut"),
      text(
        oiliness?.startsWith("Fettige")
          ? " braucht gründliche Reinigung, aber nicht automatisch stärkere Entfettung."
          : " passt besser zu milder Reinigung als zu zusätzlicher Entfettung.",
      ),
    ]
  }

  if (dimension.id === "hair_loss_thinning") {
    return [
      text("Schonende Pflege schützt bei "),
      answer("Haarausfall und dünner werdendem Haar"),
      text(
        " vor zusätzlichem Haarbruch, Zug und Reibung. Medizinische Behandlungen können Haarausfall bremsen oder neues Wachstum unterstützen.",
      ),
    ]
  }

  if (dimension.id === "moisture_softness") {
    const parts: PersonalPlanExplanationPart[] = [
      answer("Trockene oder strohige Längen"),
      text(" fühlen sich weniger geschmeidig an."),
    ]
    if (treatment)
      appendIfFits(parts, [
        text(" "),
        answer(treatment),
        text(
          treatment === "Blondierung"
            ? " kann die Haarfaser poröser machen, sodass sie leichter Glätte verliert."
            : treatment === "Eine Dauerwelle"
              ? " formt die Haarfaser chemisch um und kann ihre Geschmeidigkeit zusätzlich beanspruchen."
              : " verändert die Haarfaser und kann ihre Geschmeidigkeit zusätzlich beanspruchen.",
        ),
      ])
    else if (has("surface_rough"))
      appendIfFits(parts, [
        text(" Eine "),
        answer("raue Oberfläche"),
        text(" erhöht zusätzlich die Reibung."),
      ])
    return parts
  }

  if (dimension.id === "surface_frizz") {
    if (dimension.positiveEligible)
      return [
        text("Du beschreibst deine Haaroberfläche als "),
        answer("glatt"),
        text(". Dieses ruhige Haargefühl möchten wir erhalten."),
      ]
    if (has("frizz_flyaways") && has("surface_rough"))
      return [
        answer("Frizz oder abstehende Haare"),
        text(" liegen weniger gleichmäßig in der Gesamtform. Eine "),
        answer("raue Oberfläche"),
        text(" erhöht zusätzlich die Reibung."),
      ]
    if (has("frizz_flyaways"))
      return [
        answer("Frizz oder abstehende Haare"),
        text(
          " sind nicht automatisch Haarbruch: Einzelne Fasern liegen weniger gleichmäßig in der Gesamtform.",
        ),
      ]
    if (has("surface_rough"))
      return [
        answer("Eine raue Haaroberfläche"),
        text(" erhöht Reibung und kann Frizz sowie Verknotung verstärken."),
      ]
    return [
      answer("Eine leicht unebene Haaroberfläche"),
      text(
        " erzeugt etwas mehr Reibung, auch wenn sich die Längen noch nicht deutlich rau anfühlen.",
      ),
    ]
  }

  if (dimension.id === "shine") {
    if (has("surface_smooth_context"))
      return [
        text("Du nennst "),
        answer("wenig Glanz"),
        text(", obwohl sich dein Haar "),
        answer("glatt"),
        text(" anfühlt. Glätte beschreibt das Haargefühl, Glanz den sichtbaren Lichtreflex."),
      ]
    if (has("surface_rough"))
      return [
        answer("Wenig Glanz"),
        text(" beschreibt den sichtbaren Lichtreflex. Eine "),
        answer("raue Oberfläche"),
        text(" kann Licht ungleichmäßiger zurückwerfen und den matten Eindruck verstärken."),
      ]
    return [
      answer("Wenig Glanz"),
      text(
        " beschreibt den sichtbaren Lichtreflex – nicht automatisch Trockenheit oder eine raue Oberfläche.",
      ),
    ]
  }

  if (dimension.id === "breakage_stability") {
    if (dimension.positiveEligible)
      return [
        text("Dein Haar ging nach sanftem Dehnen "),
        answer("wieder in seine Form zurück"),
        text(". Das spricht für eine aktuell flexible Ausgangslage."),
      ]
    if (!has("breakage") && !has("hair_damage") && has("elastic_stays"))
      return [
        text("Beim sanften Dehnen "),
        answer("blieb dein Haar gedehnt"),
        text(". Das spricht dafür, dass es sich unter Zug aktuell weniger gut zurückformt."),
      ]
    const parts: PersonalPlanExplanationPart[] = has("breakage")
      ? [
          answer("Haarbruch in den Längen"),
          text(" beginnt oberhalb der Spitzen und braucht mehr als reine Spitzenpflege."),
        ]
      : has("hair_damage")
        ? [
            answer("Strapazierte oder geschädigte Längen"),
            text(" brauchen eine Routine, die Belastung reduziert und die Faser gezielt schützt."),
          ]
        : [
            text("Beim sanften Dehnen ist dein Haar "),
            answer("schnell gerissen"),
            text(" – ein Hinweis darauf, dass es Zug aktuell weniger gut standhält."),
          ]
    if (treatment)
      appendIfFits(parts, [
        text(" "),
        answer(treatment),
        text(" kann die Faser zusätzlich poröser und weniger belastbar machen."),
      ])
    return parts
  }

  if (dimension.id === "split_ends") {
    const parts: PersonalPlanExplanationPart[] = [
      answer("Sichtbar gespaltene Spitzen"),
      text(" sind bereits längs aufgefasert; Pflege kann sie nicht dauerhaft wieder verbinden."),
    ]
    if (has("long_lengths"))
      appendIfFits(parts, [
        text(" "),
        answer("Lange Haare"),
        text(" setzen ältere Enden länger alltäglicher Reibung aus."),
      ])
    else if (treatment)
      appendIfFits(parts, [
        text(" "),
        answer(treatment),
        text(" kann weiteres Auffasern begünstigen."),
      ])
    return parts
  }

  if (dimension.id === "manageability_tangling") {
    const parts: PersonalPlanExplanationPart[] = [
      answer("Schnelles Verknoten"),
      text(" bringt beim Entwirren mehr Zug auf die Längen."),
    ]
    if (has("surface_rough"))
      appendIfFits(parts, [text(" Eine "), answer("raue Oberfläche"), text(" erhöht die Reibung.")])
    if (has("long_lengths"))
      appendIfFits(parts, [
        text(" "),
        answer("Lange Haare"),
        text(" bieten mehr Stellen zum Verhaken."),
      ])
    return parts
  }

  if (dimension.id === "shape_definition") {
    const parts: PersonalPlanExplanationPart[] = [
      answer(shapeAnchor(answers)),
      text(
        ". Mehr Pflege allein löst das nicht: Leichtigkeit und Styling-Halt müssen zusammenpassen.",
      ),
    ]
    if (has("frizz_flyaways"))
      appendIfFits(parts, [
        text(" "),
        answer("Frizz"),
        text(" unterbricht zusätzlich klare Konturen."),
      ])
    return parts
  }

  return [
    answer(volumeAnchor(answers)),
    text(
      answers.texture === "curly" || answers.texture === "coily"
        ? " bedeutet nicht automatisch geringe Haardichte: Pflegegewicht und Definition beeinflussen die sichtbare Verteilung."
        : " braucht nicht automatisch weniger Pflege, sondern eine leichtere Dosierung und Verteilung.",
    ),
  ]
}

export function buildPersonalPlanAssessmentRows(
  assessment: HairAssessment,
  answers: PersonalPlanDiagnosticInput,
): [PersonalPlanAssessmentRow, PersonalPlanAssessmentRow, PersonalPlanAssessmentRow] {
  const selected = assessment.selectedDimensionIds.map((id) => {
    const found = assessment.dimensions.find((dimension) => dimension.id === id)
    if (!found) throw new Error(`Missing selected assessment dimension: ${id}`)
    return found
  })
  if (selected.length !== 3) throw new Error("Assessment could not produce three public rows")

  const ownerByEvidence = new Map<string, HairAssessmentDimensionId>()
  const evidenceIds = new Set(
    selected.flatMap((dimension) => dimension.evidence.map((item) => item.id)),
  )
  for (const evidenceId of evidenceIds) {
    const candidates = selected.filter((dimension) =>
      dimension.evidence.some((item) => item.id === evidenceId),
    )
    const primary = candidates.find((dimension) =>
      dimension.evidence.some(
        (item) =>
          item.id === evidenceId && (item.kind === "primary" || item.kind === "observation"),
      ),
    )
    ownerByEvidence.set(evidenceId, (primary ?? candidates[0]).id)
  }

  return selected.map((dimension) => {
    const todaySegments = evidenceScoreToSegments(dimension.evidenceScore)
    const explanationParts = explanationFor(
      dimension,
      answers,
      (evidenceId) => ownerByEvidence.get(evidenceId) === dimension.id,
    )
    assertExplanationContract(explanationParts)
    return {
      id: dimension.id,
      title:
        dimension.id === "breakage_stability"
          ? !dimension.explicitConcern
            ? "Stabilität"
            : dimension.evidence.some((item) => item.id === "hair_damage") &&
                !dimension.evidence.some((item) => item.id === "breakage")
              ? "Struktur & Stabilität"
              : TITLES[dimension.id]
          : TITLES[dimension.id],
      todayLabel:
        todaySegments === 1 ? "viel Potenzial" : todaySegments === 2 ? "gute Basis" : "optimal",
      potentialLabel: "optimal",
      todaySegments,
      potentialSegments: 3,
      summary: plain(explanationParts),
      explanationParts,
    }
  }) as [PersonalPlanAssessmentRow, PersonalPlanAssessmentRow, PersonalPlanAssessmentRow]
}
