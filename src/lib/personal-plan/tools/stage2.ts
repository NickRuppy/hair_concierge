import type { ToolFamily, ToolProductType } from "./contracts"
import {
  TOOL_FAMILY_LABELS,
  TOOL_FORM_PAGES,
  TOOL_OVERVIEW_SECTIONS,
  TOOL_PRODUCT_TYPE_LABELS,
  toolImageAlt,
  toolImageSrc,
  type ToolOverviewSectionKey,
} from "./labels"
import { projectToolInventoryFromCareFacts, type ToolCareFacts } from "./facts"

/**
 * Feinschliff presentation for the Tool trip.
 *
 * The overview asks which broad sections contain something the user already
 * owns; each selected section then opens short product-form pages. Section
 * labels are presentation headers only — the persisted taxonomy stays the eight
 * product-led families.
 */

export type ToolOverviewOption = {
  value: ToolOverviewSectionKey
  label: string
  hint: string
  imageUrl: string
  imageAlt: string
}

const SECTION_HINTS: Record<ToolOverviewSectionKey, string> = {
  trocknen_stylen: "Föhn, Glätteisen, Lockenwickler",
  entwirren_fixieren: "Kämme, Bürsten, Clips",
  waschen_auftragen: "Kopfhaut-Bürste, Applikator",
  tuecher_nachtschutz: "Handtuch, Bonnet, Kissenbezug",
}

/** One recognizable form per section stands in for its image. */
const SECTION_IMAGE_FORM: Record<ToolOverviewSectionKey, ToolProductType> = {
  trocknen_stylen: "hair_dryer",
  entwirren_fixieren: "detangling_brush",
  waschen_auftragen: "scalp_brush",
  tuecher_nachtschutz: "microfiber_towel",
}

export const TOOL_OVERVIEW_OPTIONS: ToolOverviewOption[] = TOOL_OVERVIEW_SECTIONS.map(
  (section) => ({
    value: section.key,
    label: section.label,
    hint: SECTION_HINTS[section.key],
    imageUrl: toolImageSrc(SECTION_IMAGE_FORM[section.key]),
    imageAlt: toolImageAlt(SECTION_IMAGE_FORM[section.key]),
  }),
)

export const TOOL_OVERVIEW_TITLE = "Welche Bereiche nutzt du bereits?"
export const TOOL_OVERVIEW_LEAD =
  "Wähle die Bereiche, in denen du schon etwas hast. Was du auslässt, bleibt offen — wir behaupten nichts."
export const TOOL_SECTION_LABEL = "Deine Tools"
export const TOOL_NOTHING_LABEL = "Nichts davon"

export type ToolFormOption = {
  value: ToolProductType
  label: string
  imageUrl: string
  imageAlt: string
}

export type ToolFormPagePresentation = {
  pageKey: string
  family: ToolFamily
  title: string
  lead: string
  familyLabel: string
  sectionLabel: string
  pageIndex: number
  pageCount: number
  options: ToolFormOption[]
}

const FAMILY_PAGE_COUNT = TOOL_FORM_PAGES.reduce<Record<string, number>>((counts, page) => {
  counts[page.family] = (counts[page.family] ?? 0) + 1
  return counts
}, {})

export function toolFormPagePresentation(pageKey: string): ToolFormPagePresentation | null {
  const page = TOOL_FORM_PAGES.find((candidate) => candidate.pageKey === pageKey)
  if (!page) return null
  const pageIndex = TOOL_FORM_PAGES.filter(
    (candidate) => candidate.family === page.family,
  ).findIndex((candidate) => candidate.pageKey === pageKey)
  const pageCount = FAMILY_PAGE_COUNT[page.family] ?? 1
  const familyLabel = TOOL_FAMILY_LABELS[page.family]
  return {
    pageKey,
    family: page.family,
    familyLabel,
    sectionLabel: sectionLabelForFamily(page.family),
    title: `Welche ${familyLabel} nutzt du?`,
    lead:
      pageCount > 1
        ? `Mehrfachauswahl möglich. Seite ${pageIndex + 1} von ${pageCount}.`
        : "Mehrfachauswahl möglich.",
    pageIndex,
    pageCount,
    options: (page.forms as readonly ToolProductType[]).map((form) => ({
      value: form,
      label: TOOL_PRODUCT_TYPE_LABELS[form],
      imageUrl: toolImageSrc(form),
      imageAlt: toolImageAlt(form),
    })),
  }
}

function sectionLabelForFamily(family: ToolFamily): string {
  const section = TOOL_OVERVIEW_SECTIONS.find((candidate) =>
    (candidate.families as readonly string[]).includes(family),
  )
  return section?.label ?? TOOL_SECTION_LABEL
}

export function toolQuestionLabel(questionId: string): string {
  if (questionId === "tools_overview") return TOOL_SECTION_LABEL
  const presentation = toolFormPagePresentation(questionId.slice("tools:".length))
  return presentation ? presentation.familyLabel : TOOL_SECTION_LABEL
}

/**
 * Existing drying, heat, towel and Night-Protection answers preselect the trip,
 * so the user is never asked the same fact twice. Preselection is a starting
 * value the user can change — it is not an answer on its own.
 */
export function defaultToolSectionsFromCare(care: ToolCareFacts): ToolOverviewSectionKey[] {
  const reportedFamilies = new Set(
    Object.entries(projectToolInventoryFromCareFacts(care))
      .filter(([, forms]) => Array.isArray(forms) && forms.length > 0)
      .map(([family]) => family),
  )
  return TOOL_OVERVIEW_SECTIONS.filter((section) =>
    section.families.some((family) => reportedFamilies.has(family)),
  ).map((section) => section.key)
}

export function defaultToolFormsFromCare(
  care: ToolCareFacts,
): Partial<Record<ToolFamily, ToolProductType[]>> {
  const projected = projectToolInventoryFromCareFacts(care)
  const defaults: Partial<Record<ToolFamily, ToolProductType[]>> = {}
  for (const [family, forms] of Object.entries(projected)) {
    if (Array.isArray(forms) && forms.length > 0) defaults[family as ToolFamily] = [...forms]
  }
  return defaults
}
