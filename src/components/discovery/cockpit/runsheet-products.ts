import type {
  DiscoveryCockpitStepView,
  DiscoveryCockpitUnassignedView,
} from "@/lib/discovery/cockpit"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { deriveBuckets, type RunsheetUnassignedEntry } from "@/lib/discovery/runsheet"

/**
 * Phase 3 („Produkte") as the runsheet displays it: `deriveBuckets` plus the two display
 * joins the derivation deliberately leaves to the page (consult-runsheet T3).
 *
 * 1. The research join (binding ruling): an empty step whose category has a product of hers
 *    still in research is NOT „Kein Produkt angegeben" — the slot shows her product as
 *    „noch in Recherche" instead. The page must never claim she uses nothing for a step while
 *    her product for it sits in research. Display only: `view.unassigned` — which the
 *    finalize gates and the PDF redirect read — is never touched.
 * 2. Every step entry keeps its live decision control: an empty step the derivation files in
 *    no bucket (decided „Ohne Produkt weiter", or no recommendation to offer) is listed under
 *    „Tauschen oder neu" as an open step, so its choice can still be changed.
 */

export type RunsheetResearchSlot = { label: string; gtin: string | null }

export type RunsheetStepEntry = {
  kind: "owned" | "neu" | "offen"
  step: DiscoveryCockpitStepView
  /** No call decision recorded yet — the bucket is the derivation's proposal. */
  proposed: boolean
  /** Her product of this category still in research (join 1); only for empty steps. */
  research: RunsheetResearchSlot | null
}

export type RunsheetUnassignedDisplayEntry = {
  kind: "unassigned"
  unassigned: DiscoveryCockpitUnassignedView
  proposed: true
}

export type RunsheetKlaerenEntry = {
  intakeItemId: string
  reason: "research_pending" | "category_unknown"
  label: string
  category: PersonalPlanCategory | null
  gtin: string | null
}

export type RunsheetProductsDisplay = {
  klaeren: RunsheetKlaerenEntry[]
  behalten: RunsheetStepEntry[]
  weglassen: Array<RunsheetStepEntry | RunsheetUnassignedDisplayEntry>
  tauschenOderNeu: RunsheetStepEntry[]
  styling: DiscoveryCockpitUnassignedView[]
}

export function composeRunsheetProducts(input: {
  steps: DiscoveryCockpitStepView[]
  unassigned: DiscoveryCockpitUnassignedView[]
  /** Her intake rows, for the scanned barcode of a product in research. */
  researchItems?: ReadonlyArray<{ id: string; barcodeIdentifier: string | null }> | null
}): RunsheetProductsDisplay {
  const buckets = deriveBuckets({ steps: input.steps, unassigned: input.unassigned })
  const barcodes = new Map(
    (input.researchItems ?? []).map((item) => [item.id, item.barcodeIdentifier]),
  )
  const klaeren = buckets.klaeren.map((entry) => klaerenEntry(entry, barcodes))

  // First research-pending product per category — the one an empty step's slot names.
  const researchByCategory = new Map<PersonalPlanCategory, RunsheetResearchSlot>()
  for (const entry of klaeren) {
    if (
      entry.reason === "research_pending" &&
      entry.category &&
      !researchByCategory.has(entry.category)
    ) {
      researchByCategory.set(entry.category, { label: entry.label, gtin: entry.gtin })
    }
  }
  // One product fills at most ONE slot: the first empty step of its category in step order.
  // A second empty step of that category stays an ordinary open step.
  const researchByStep = new Map<string, RunsheetResearchSlot>()
  const filled = new Set<PersonalPlanCategory>()
  for (const step of input.steps) {
    const slot = researchByCategory.get(step.category)
    if (step.intakeItemId !== null || !slot || filled.has(step.category)) continue
    filled.add(step.category)
    researchByStep.set(step.decisionKey, slot)
  }
  const researchFor = (step: DiscoveryCockpitStepView): RunsheetResearchSlot | null =>
    step.intakeItemId === null ? (researchByStep.get(step.decisionKey) ?? null) : null

  const stepEntry = (
    kind: RunsheetStepEntry["kind"],
    step: DiscoveryCockpitStepView,
    proposed: boolean,
  ): RunsheetStepEntry => ({ kind, step, proposed, research: researchFor(step) })

  const tauschenOderNeu = buckets.tauschenOderNeu.map((entry) =>
    stepEntry(entry.kind, entry.step, entry.proposed),
  )
  // Join 2: empty steps no bucket holds keep their control as open steps.
  const listedEmpty = new Set(
    buckets.tauschenOderNeu.flatMap((entry) => (entry.kind === "neu" ? [entry.decisionKey] : [])),
  )
  for (const step of input.steps) {
    if (step.intakeItemId === null && !listedEmpty.has(step.decisionKey)) {
      tauschenOderNeu.push(stepEntry("offen", step, step.outcome !== "kept"))
    }
  }

  return {
    klaeren,
    behalten: buckets.behalten.map((entry) => stepEntry("owned", entry.step, entry.proposed)),
    weglassen: buckets.weglassen.map((entry) =>
      entry.kind === "owned"
        ? stepEntry("owned", entry.step, entry.proposed)
        : { kind: "unassigned", unassigned: entry.unassigned, proposed: true },
    ),
    tauschenOderNeu,
    styling: buckets.styling.map((entry) => entry.unassigned),
  }
}

export type RunsheetOutsideRoutine = {
  /** „benutze ich nicht" categories — „— benutzt sie nicht. Keine Entscheidung nötig." */
  declined: PersonalPlanCategory[]
  /** Categories she never answered — „Nicht angegeben: … — im Call fragen." */
  unanswered: PersonalPlanCategory[]
}

/**
 * „Nicht in der Idealroutine" (consult-runsheet T4 c): only categories nothing above
 * already names. A category is left out when it is a step in the Idealroutine (the step
 * says for itself what she has) or when one of her products of it sits in a bucket, the
 * Klären banner or the styling line — `deriveBuckets` files every `unassigned` entry into
 * exactly one of those, so the projection's categories are the represented ones. Products
 * are never listed here: no-step products stand under „Weglassen", research and open
 * categories under „Klären", styling on its own line.
 *
 * Unanswered categories count only once she has submitted — before that they are simply
 * not done yet.
 */
export function composeRunsheetOutsideRoutine(input: {
  steps: ReadonlyArray<{ category: PersonalPlanCategory }>
  unassigned: ReadonlyArray<{ category: PersonalPlanCategory | null }>
  declinedCategories: readonly PersonalPlanCategory[]
  unansweredCategories: readonly PersonalPlanCategory[]
  submitted: boolean
}): RunsheetOutsideRoutine {
  const namedAbove = new Set<PersonalPlanCategory>([
    ...input.steps.map((step) => step.category),
    ...input.unassigned.flatMap((entry) => (entry.category ? [entry.category] : [])),
  ])
  const unused = (category: PersonalPlanCategory) => !namedAbove.has(category)
  return {
    declined: input.declinedCategories.filter(unused),
    unanswered: input.submitted ? input.unansweredCategories.filter(unused) : [],
  }
}

function klaerenEntry(
  entry: RunsheetUnassignedEntry,
  barcodes: ReadonlyMap<string, string | null>,
): RunsheetKlaerenEntry {
  const barcode = barcodes.get(entry.intakeItemId) ?? null
  return {
    intakeItemId: entry.intakeItemId,
    reason: entry.reason === "category_unknown" ? "category_unknown" : "research_pending",
    label: entry.unassigned.label,
    category: entry.category,
    // A scanned unknown already reads „Gescanntes Produkt · <code>" — never twice.
    gtin: barcode && !entry.unassigned.label.includes(barcode) ? barcode : null,
  }
}
