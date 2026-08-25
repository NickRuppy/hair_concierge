import {
  isToolAnswerOnlyForm,
  TOOL_FAMILIES,
  TOOL_PRODUCT_TYPES_BY_FAMILY,
  TOOL_ANSWER_ONLY_FORMS_BY_FAMILY,
  TOOL_ROUTE_TARGETS,
  type ToolAnswerOnlyForm,
  type ToolChoiceGroupTarget,
  type ToolFamily,
  type ToolProductType,
  type ToolReportedForm,
  type ToolRouteTarget,
} from "./contracts"

/**
 * German user-facing copy for the parallel Tool domain. Families are the visible
 * product-category names; the four Stage-2 overview sections below are
 * presentation headers only and are never persisted.
 */

export const TOOL_FAMILY_LABELS = {
  airflow: "Haartrockner & Luftstyler",
  heated_styling: "Hitzestyling-Tools",
  heatless_styling: "Heatless Styling & Setzen",
  brushes_combs: "Bürsten & Kämme",
  securing_sectioning: "Clips, Haargummis & Fixierhilfen",
  wash_application: "Wasch- & Auftragshilfen",
  night_protection: "Nachtschutz",
  drying_textiles: "Handtücher & Trocknungsmaterialien",
} as const satisfies Record<ToolFamily, string>

export const TOOL_PRODUCT_TYPE_LABELS = {
  hair_dryer: "Föhn",
  hot_air_brush: "Warmluftbürste",
  air_multi_styler: "Air Multi-Styler",
  flat_iron: "Glätteisen",
  curling_iron: "Lockenstab",
  curling_wand: "Lockenzange",
  wave_iron: "Welleneisen",
  automatic_curler: "Automatischer Curler",
  heated_rollers: "Thermoroller",
  heated_brush: "Heizbürste",
  heated_multi_styler: "Beheizter Multi-Styler",
  heatless_curling_band: "Heatless Lockenband",
  setting_roller: "Lockenwickler",
  foam_roller: "Schaumstoffwickler",
  flexi_rod: "Flexi-Rod",
  setting_former: "Setting-Former",
  wide_tooth_comb: "Grobzinkiger Kamm",
  detangling_brush: "Detangling-Bürste",
  paddle_brush: "Paddle-Bürste",
  vent_brush: "Vent-Bürste",
  round_brush: "Rundbürste",
  // Kept identical to the legacy onboarding enum's label (`BRUSH_TYPE_LABELS`).
  boar_bristle: "Wildschweinborsten-Bürste",
  styling_brush: "Styling-/Definitionsbürste",
  hair_pick: "Afro-Pick",
  sectioning_comb: "Stiel-/Abteilkamm",
  soft_hair_tie: "Weiches Haargummi",
  scrunchie: "Scrunchie",
  claw_clip: "Claw Clip",
  sectioning_clip: "Abteilclips",
  root_volume_clip: "Ansatzvolumen-Clips",
  hair_pin: "Haarnadeln",
  headband: "Haarband",
  scalp_brush: "Kopfhaut-Bürste",
  applicator_bottle: "Applikatorflasche",
  applicator_comb: "Applikatorkamm",
  water_spray_bottle: "Sprühflasche",
  pillowcase: "Glatter Kissenbezug",
  bonnet: "Bonnet",
  length_tip_sleeve: "Längen-/Spitzenschutz",
  soft_night_tie: "Weiches Nacht-Haargummi",
  microfiber_towel: "Mikrofaser-Handtuch",
  smooth_cotton_cloth: "Glattes Baumwolltuch / T-Shirt",
  drying_wrap: "Haarturban / Wrap",
} as const satisfies Record<ToolProductType, string>

/**
 * Answer-only tokens (`D9b`). „Nur Finger" is a real answer about how the user
 * handles their hair, never a product the plan may recommend — so it carries a
 * label and a card image, but never a product-type label lookup.
 *
 * Kept identical to the legacy onboarding enum's label (`BRUSH_TYPE_LABELS`).
 */
export const TOOL_ANSWER_ONLY_FORM_LABELS = {
  fingers: "Nur Finger",
} as const satisfies Record<ToolAnswerOnlyForm, string>

/** Short clarifying line under an answer-only card. Product cards carry none. */
export const TOOL_ANSWER_ONLY_FORM_HINTS = {
  fingers: "Du entwirrst mit den Händen.",
} as const satisfies Record<ToolAnswerOnlyForm, string>

/** Short purpose line under the product type. Never replaces the category name. */
export const TOOL_ROUTE_PURPOSE_COPY = {
  drying_standard: "Zum Trocknen deiner Haare mit Luft",
  drying_diffused: "Damit dein Muster beim Trocknen erhalten bleibt",
  air_shaping_volume: "Um beim Trocknen Form und Ansatzvolumen zu geben",
  heated_volume_set: "Um Volumen oder eine Form mit Hitze zu setzen",
  heatless_volume_set: "Um Volumen oder eine Form ohne Hitze zu setzen",
  detangling_foundation: "Zum sanften Entwirren und Verteilen von Produkt",
  specialized_brush_job: "Für das Formen oder Abteilen beim Styling",
  manual_air_shaping: "Um mit Föhn und Rundbürste Form und Ansatzvolumen zu geben",
  definition_brush_job: "Um dein Muster beim Stylen zu definieren",
  pick_job: "Um das Haar am Ansatz locker anzuheben",
  dry_styling_brush: "Zum Stylen im trockenen Haar",
  securing_support: "Zum Abteilen und lockeren Fixieren",
  wash_application_support: "Um Produkt gezielt aufzutragen und zu verteilen",
  scalp_brush_use: "Um die Kopfhaut beim Waschen sanft zu bearbeiten",
  night_protection: "Für weniger Reibung über Nacht",
  drying_textile_upgrade: "Um Wasser sanft aufzunehmen",
  drying_textile_use: "Um Wasser sanft aufzunehmen",
  textile_plop: "Damit dein Muster beim Antrocknen erhalten bleibt",
  gentle_towel_handling: "Sanft ausdrücken statt rubbeln",
} as const satisfies Record<ToolRouteTarget, string>

/** Four presentation-only Stage-2 overview sections. Not a persisted taxonomy. */
export const TOOL_OVERVIEW_SECTIONS = [
  {
    key: "trocknen_stylen",
    label: "Trocknen & Stylen",
    families: ["airflow", "heated_styling", "heatless_styling"],
  },
  {
    key: "entwirren_fixieren",
    label: "Entwirren & Fixieren",
    families: ["brushes_combs", "securing_sectioning"],
  },
  { key: "waschen_auftragen", label: "Waschen & Auftragen", families: ["wash_application"] },
  {
    key: "tuecher_nachtschutz",
    label: "Tücher & Nachtschutz",
    families: ["drying_textiles", "night_protection"],
  },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  families: readonly ToolFamily[]
}>

export type ToolOverviewSectionKey = (typeof TOOL_OVERVIEW_SECTIONS)[number]["key"]

/**
 * Stable image slot per product type.
 *
 * The files currently in `public/images/personal-plan/tools/` are coherent local
 * placeholders pending visual approval — see the README there. Replacing them
 * with the approved photo/cut-out set needs no code change: the slot, filename
 * and alt text stay identical.
 */
export function toolImageSrc(form: ToolReportedForm): string {
  return `/images/personal-plan/tools/${form}.svg`
}

/** The card label for anything a reported answer may contain (`D9b`). */
export function toolReportedFormLabel(form: ToolReportedForm): string {
  return isToolAnswerOnlyForm(form)
    ? TOOL_ANSWER_ONLY_FORM_LABELS[form]
    : TOOL_PRODUCT_TYPE_LABELS[form]
}

/** German alt text: recognizable form plus its family, never a marketing claim. */
export function toolImageAlt(form: ToolReportedForm): string {
  const label = toolReportedFormLabel(form)
  const family = TOOL_FAMILIES.find(
    (candidate) =>
      (TOOL_PRODUCT_TYPES_BY_FAMILY[candidate] as readonly string[]).includes(form) ||
      (TOOL_ANSWER_ONLY_FORMS_BY_FAMILY[candidate] ?? []).includes(form as ToolAnswerOnlyForm),
  )
  return family ? `${label} – ${TOOL_FAMILY_LABELS[family]}` : label
}

/**
 * German copy for the first-class choice groups (`D5`, ruled 2026-08-24). One
 * card per need; the members are listed neutrally and one covered member fulfils
 * the whole group.
 *
 * Drying textiles are the confirmed neutral case (fixtures 104 and 113): a
 * 2026-08-21 evidence pass found microfiber-vs-terry has only a plausible
 * mechanism and one weak study, and microfiber-vs-smooth-cotton-jersey is
 * unmeasured at every tier. AAD treats towel and T-shirt as interchangeable and
 * ranks technique instead.
 */
export const TOOL_CHOICE_GROUP_LABELS = {
  // The group spans all three volume-set members — airflow, heated AND heatless
  // (`TOOL_CHOICE_GROUP_MEMBERS.volume_set`) — so the neutral card must not name
  // airflow forms only. Queued for the pre-ship copy-review screenshot pass.
  volume_set:
    "Eine davon reicht: Warmluftbürste, Air Multi-Styler, Lockenwickler oder Föhn mit Rundbürste",
  drying_textile: "Mikrofaser-Handtuch, Baumwolltuch oder Haarturban",
} as const satisfies Record<ToolChoiceGroupTarget, string>

export const TOOL_CHOICE_GROUP_NOTES: Partial<Record<ToolChoiceGroupTarget, string>> = {
  drying_textile:
    "Entscheidend ist die Technik, nicht das Material: sanft ausdrücken statt rubbeln.",
}

/** German alternative line for families that legitimately lead with one form. */
export function toolAlternativeNote(alternatives: readonly ToolProductType[]): string | null {
  if (alternatives.length === 0) return null
  const [first] = alternatives
  return `Alternative: ${TOOL_PRODUCT_TYPE_LABELS[first]}, wenn diese Form besser zu dir passt`
}

export const TOOL_PRESENTATION_STATE_LABELS = {
  use_yours: "Nutze deins",
  check_in_refinement: "Im Feinschliff abgleichen",
  catalog_gap: "Konkretes Produkt folgt",
  planned_generic: "Neu einplanen",
} as const

export const ALL_TOOL_ROUTE_TARGETS: readonly ToolRouteTarget[] = TOOL_ROUTE_TARGETS

/**
 * Product-form capture pages.
 *
 * A page shows a small set of large visual options; a family with more
 * recognizable forms is split across ordered pages rather than compressed into
 * a dense row. `brushes_combs:1` is the one page that carries six: the WS4
 * mockup that was reviewed and signed off on 2026-08-25
 * (`plans/mockups/ws4-2026-08-25/brushes-page-new-cards-viewport.png`) places
 * „Wildschweinborsten-Bürste" (`R3`) and „Nur Finger" (`D9b`) on the first
 * Bürsten page, next to the four foundation forms, so a fingers-only user can
 * say so without paging past brushes they do not own.
 *
 * Pages need NOT follow the canonical family order: the persisted answer is
 * sorted into `TOOL_REPORTED_FORMS_BY_FAMILY` order when it is written.
 */
export const TOOL_FORM_PAGES = [
  {
    pageKey: "airflow:1",
    family: "airflow",
    forms: ["hair_dryer", "hot_air_brush", "air_multi_styler"],
  },
  {
    pageKey: "heated_styling:1",
    family: "heated_styling",
    forms: ["flat_iron", "curling_iron", "curling_wand", "wave_iron"],
  },
  {
    pageKey: "heated_styling:2",
    family: "heated_styling",
    forms: ["automatic_curler", "heated_rollers", "heated_brush", "heated_multi_styler"],
  },
  {
    pageKey: "heatless_styling:1",
    family: "heatless_styling",
    forms: ["heatless_curling_band", "setting_roller", "foam_roller"],
  },
  {
    pageKey: "heatless_styling:2",
    family: "heatless_styling",
    forms: ["flexi_rod", "setting_former"],
  },
  {
    pageKey: "brushes_combs:1",
    family: "brushes_combs",
    forms: [
      "wide_tooth_comb",
      "detangling_brush",
      "paddle_brush",
      "vent_brush",
      "boar_bristle",
      "fingers",
    ],
  },
  {
    pageKey: "brushes_combs:2",
    family: "brushes_combs",
    forms: ["round_brush", "styling_brush", "hair_pick", "sectioning_comb"],
  },
  {
    pageKey: "securing_sectioning:1",
    family: "securing_sectioning",
    forms: ["soft_hair_tie", "scrunchie", "claw_clip", "sectioning_clip"],
  },
  {
    pageKey: "securing_sectioning:2",
    family: "securing_sectioning",
    forms: ["root_volume_clip", "hair_pin", "headband"],
  },
  {
    pageKey: "wash_application:1",
    family: "wash_application",
    forms: ["scalp_brush", "applicator_bottle", "applicator_comb", "water_spray_bottle"],
  },
  {
    pageKey: "night_protection:1",
    family: "night_protection",
    forms: ["pillowcase", "bonnet", "length_tip_sleeve", "soft_night_tie"],
  },
  {
    pageKey: "drying_textiles:1",
    family: "drying_textiles",
    forms: ["microfiber_towel", "smooth_cotton_cloth", "drying_wrap"],
  },
] as const satisfies ReadonlyArray<{
  pageKey: string
  family: ToolFamily
  forms: readonly ToolReportedForm[]
}>

export type ToolFormPageKey = (typeof TOOL_FORM_PAGES)[number]["pageKey"]

/** Six on the ratified Bürsten page (see `TOOL_FORM_PAGES`), four everywhere else. */
export const TOOL_MAX_OPTIONS_PER_PAGE = 6

export function toolFormPagesForFamilies(
  families: readonly ToolFamily[],
): (typeof TOOL_FORM_PAGES)[number][] {
  const selected = new Set(families)
  return TOOL_FORM_PAGES.filter((page) => selected.has(page.family))
}

/** A section is shown as selected when any of its families is reported. */
export function toolSectionsForFamilies(families: readonly ToolFamily[]): ToolOverviewSectionKey[] {
  const reported = new Set<string>(families)
  return TOOL_OVERVIEW_SECTIONS.filter((section) =>
    section.families.some((family) => reported.has(family)),
  ).map((section) => section.key)
}

export function toolFamiliesForSections(sections: readonly ToolOverviewSectionKey[]): ToolFamily[] {
  const chosen = new Set<string>(sections)
  return TOOL_OVERVIEW_SECTIONS.filter((section) => chosen.has(section.key)).flatMap((section) => [
    ...section.families,
  ])
}
