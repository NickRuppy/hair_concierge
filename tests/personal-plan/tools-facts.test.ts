import assert from "node:assert/strict"
import test from "node:test"

import {
  isToolAnswerOnlyForm,
  toolProductTypesOf,
  TOOL_FAMILIES,
  TOOL_REPORTED_FORMS_BY_FAMILY,
  type ToolFamily,
  type ToolReportedForm,
} from "@/lib/personal-plan/tools/contracts"
import {
  EMPTY_TOOL_CARE_FACTS,
  TOOL_FORM_CARE_FACTS,
  careFactsFromToolInventory,
  dryingRouteOptionsFromToolInventory,
  isToolOverviewAnswerValid,
  isToolPageAnswerValid,
  projectToolInventoryFromCareFacts,
  projectToolPrefillFromCareFacts,
  reportedToolInventory,
  reportedToolInventoryFromFacts,
  resolvedToolInventory,
  toolFormsByFamily,
  type ToolCareFacts,
  type ToolInventory,
} from "@/lib/personal-plan/tools/facts"
import {
  TOOL_FORM_PAGES,
  TOOL_OVERVIEW_FAMILY_ORDER,
  TOOL_OVERVIEW_SECTIONS,
  toolFamiliesForSections,
  toolFormCareKey,
  toolImageSrc,
  toolReportedFormLabel,
} from "@/lib/personal-plan/tools/labels"
import {
  TOOL_OVERVIEW_OPTIONS,
  toolFormPagePresentation,
  toolOverviewPreselection,
  toolPagePreselection,
} from "@/lib/personal-plan/tools/stage2"
import { ADDITIONAL_HEAT_TOOLS } from "@/lib/personal-plan/refinement/types"
import { NIGHT_PROTECTIONS } from "@/lib/vocabulary/onboarding-care"

/* ── A. the wash-day regroup ─────────────────────────────────────────────── */

test("the overview has the four chronological sections with their families in page order", () => {
  assert.deepEqual(
    TOOL_OVERVIEW_SECTIONS.map((section) => [section.label, [...section.families]]),
    [
      ["Waschen & Auftragen", ["wash_application"]],
      ["Abtrocknen & Entwirren", ["drying_textiles", "brushes_combs"]],
      [
        "Trocknen & Stylen",
        ["airflow", "heated_styling", "heatless_styling", "securing_sectioning"],
      ],
      ["Nachtschutz", ["night_protection"]],
    ],
  )
  assert.deepEqual(
    TOOL_OVERVIEW_OPTIONS.map((option) => option.hint),
    [
      "Applikator, Kopfhautbürste",
      "Handtücher, Kämme, Bürsten",
      "Föhn, Glätteisen, Lockenwickler, Clips",
      "Kissenbezug, Bonnet",
    ],
  )
})

test("form pages are asked in wash-day order and two-page families keep :1 before :2", () => {
  assert.deepEqual(
    TOOL_FORM_PAGES.map((page) => page.pageKey),
    [
      "wash_application:1",
      "drying_textiles:1",
      "brushes_combs:1",
      "brushes_combs:2",
      "airflow:1",
      "heated_styling:1",
      "heatless_styling:1",
      "securing_sectioning:1",
      "securing_sectioning:2",
      "night_protection:1",
    ],
  )
  // Page order follows the section order exactly.
  assert.deepEqual(
    [...new Set(TOOL_FORM_PAGES.map((page) => page.family))],
    [...TOOL_OVERVIEW_FAMILY_ORDER],
  )
  assert.deepEqual(toolFamiliesForSections(["nachtschutz", "waschen_auftragen"]), [
    "wash_application",
    "night_protection",
  ])
  // Every form of every family is on exactly one page.
  for (const family of TOOL_FAMILIES) {
    const onPages = TOOL_FORM_PAGES.filter((page) => page.family === family).flatMap(
      (page) => [...page.forms] as string[],
    )
    assert.deepEqual([...onPages].sort(), [...TOOL_REPORTED_FORMS_BY_FAMILY[family]].sort())
  }
})

test("every page has a stable care_habits key", () => {
  assert.deepEqual(
    TOOL_FORM_PAGES.map((page) => toolFormCareKey(page.pageKey)),
    [
      "toolForms_wash_application_1",
      "toolForms_drying_textiles_1",
      "toolForms_brushes_combs_1",
      "toolForms_brushes_combs_2",
      "toolForms_airflow_1",
      "toolForms_heated_styling_1",
      "toolForms_heatless_styling_1",
      "toolForms_securing_sectioning_1",
      "toolForms_securing_sectioning_2",
      "toolForms_night_protection_1",
    ],
  )
})

/* ── C. per-page validity ────────────────────────────────────────────────── */

test("a page answer is an ordered, duplicate-free subset of that page's forms", () => {
  assert.equal(isToolPageAnswerValid("airflow:1", []), true)
  assert.equal(isToolPageAnswerValid("airflow:1", ["hair_dryer", "air_multi_styler"]), true)
  assert.equal(isToolPageAnswerValid("airflow:1", ["air_multi_styler", "hair_dryer"]), false)
  assert.equal(isToolPageAnswerValid("airflow:1", ["hair_dryer", "hair_dryer"]), false)
  // A form of the same family on the other page is not this page's answer.
  assert.equal(isToolPageAnswerValid("brushes_combs:1", ["round_brush"]), false)
  // Canonical FAMILY order, not card order: `fingers` sorts last.
  assert.equal(isToolPageAnswerValid("brushes_combs:1", ["wide_tooth_comb", "fingers"]), true)
  assert.equal(isToolPageAnswerValid("brushes_combs:1", ["fingers", "wide_tooth_comb"]), false)
  assert.equal(isToolPageAnswerValid("airflow:1", undefined), false)
  assert.equal(isToolPageAnswerValid("airflow:1", "hair_dryer"), false)
})

test("the overview answer is an ordered subset of the wash-day family order", () => {
  assert.equal(isToolOverviewAnswerValid([]), true)
  assert.equal(isToolOverviewAnswerValid(["drying_textiles", "airflow"]), true)
  assert.equal(isToolOverviewAnswerValid(["airflow", "drying_textiles"]), false)
  assert.equal(isToolOverviewAnswerValid(["airflow", "airflow"]), false)
  assert.equal(isToolOverviewAnswerValid(["trocknen_stylen"]), false)
  assert.equal(isToolOverviewAnswerValid(undefined), false)
})

/* ── C. family views over per-page answers ───────────────────────────────── */

test("toolFormsByFamily unions a family's pages in canonical order", () => {
  assert.deepEqual(
    toolFormsByFamily({
      toolForms: {
        "brushes_combs:2": ["round_brush"],
        "brushes_combs:1": ["wide_tooth_comb", "fingers"],
        "airflow:1": [],
      },
    }),
    { brushes_combs: ["wide_tooth_comb", "round_brush", "fingers"], airflow: [] },
  )
  assert.deepEqual(toolFormsByFamily({}), {})
})

test("resolvedToolInventory: unticked families are none, ticked ones need every page", () => {
  const inventory = resolvedToolInventory({
    toolFamiliesWithSomething: ["brushes_combs", "airflow"],
    toolForms: { "brushes_combs:1": ["wide_tooth_comb"], "airflow:1": ["hair_dryer"] },
  })
  assert.deepEqual(inventory.airflow, ["hair_dryer"])
  // Page 2 is still open, so the family is not resolved yet.
  assert.equal(inventory.brushes_combs, undefined)
  for (const family of TOOL_FAMILIES) {
    if (family === "brushes_combs" || family === "airflow") continue
    assert.deepEqual(inventory[family], [], `${family} is unticked → explicit none`)
  }
  // No overview answer: nothing is resolved, however many pages are stored.
  assert.deepEqual(resolvedToolInventory({ toolForms: { "airflow:1": ["hair_dryer"] } }), {})
  // An invalid page answer does not resolve its family.
  assert.equal(
    resolvedToolInventory({
      toolFamiliesWithSomething: ["airflow"],
      toolForms: { "airflow:1": ["flat_iron"] as ToolReportedForm[] },
    }).airflow,
    undefined,
  )
})

/* ── C. inventory → care facts (the derivation table) ────────────────────── */

test("every reported form is mapped or explicitly none", () => {
  for (const family of TOOL_FAMILIES) {
    for (const form of TOOL_REPORTED_FORMS_BY_FAMILY[family]) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(TOOL_FORM_CARE_FACTS, form),
        `${form} needs a care-facts entry (use {} for explicitly none)`,
      )
    }
  }
  assert.deepEqual(
    Object.keys(TOOL_FORM_CARE_FACTS).sort(),
    TOOL_FAMILIES.flatMap((family) => [...TOOL_REPORTED_FORMS_BY_FAMILY[family]]).sort(),
  )
})

test("the heat-source map turns airflow and heated forms into additional heat tools", () => {
  const cases: [ToolReportedForm[], ToolReportedForm[], string[]][] = [
    [["hair_dryer"], [], []],
    [["hot_air_brush"], [], ["dryer_brush"]],
    [["air_multi_styler"], [], ["hot_air_styler"]],
    [[], ["flat_iron"], ["straightener"]],
    [[], ["heated_brush"], ["straightener"]],
    [[], ["curling_iron"], ["curling_or_wave_iron"]],
    [[], ["curling_wand"], ["curling_or_wave_iron"]],
    [[], ["wave_iron"], ["curling_or_wave_iron"]],
    [[], ["automatic_curler"], ["curling_or_wave_iron"]],
    [[], ["heated_multi_styler"], ["curling_or_wave_iron"]],
    [[], ["heated_rollers"], ["thermal_rollers"]],
    [
      ["hair_dryer", "hot_air_brush", "air_multi_styler"],
      ["flat_iron", "curling_iron", "curling_wand", "heated_rollers", "heated_brush"],
      ["dryer_brush", "hot_air_styler", "straightener", "curling_or_wave_iron", "thermal_rollers"],
    ],
  ]
  for (const [airflow, heated, expected] of cases) {
    assert.deepEqual(
      careFactsFromToolInventory({ airflow, heated_styling: heated }).additionalHeatTools,
      expected,
      `${airflow.join("+")} / ${heated.join("+")}`,
    )
  }
  // Heatless forms never become a heat tool.
  assert.deepEqual(
    careFactsFromToolInventory({
      airflow: [],
      heated_styling: [],
      heatless_styling: [...TOOL_REPORTED_FORMS_BY_FAMILY.heatless_styling],
    }).additionalHeatTools,
    [],
  )
  // Both source families must be known, otherwise nothing is derived.
  assert.equal(
    careFactsFromToolInventory({ airflow: ["hot_air_brush"] }).additionalHeatTools,
    undefined,
  )
  assert.equal(
    careFactsFromToolInventory({ airflow: null, heated_styling: [] }).additionalHeatTools,
    undefined,
  )
})

test("drying-route options follow the owned airflow forms; „Mit Diffusor“ needs the Diffusor", () => {
  assert.equal(dryingRouteOptionsFromToolInventory({}), null)
  assert.deepEqual(dryingRouteOptionsFromToolInventory({ airflow: [] }), ["air_dry"])
  assert.deepEqual(dryingRouteOptionsFromToolInventory({ airflow: ["hot_air_brush"] }), [
    "air_dry",
    "ordinary_blow_dry",
  ])
  assert.deepEqual(dryingRouteOptionsFromToolInventory({ airflow: ["hair_dryer"] }), [
    "air_dry",
    "ordinary_blow_dry",
  ])
  assert.deepEqual(dryingRouteOptionsFromToolInventory({ airflow: ["hair_dryer", "diffuser"] }), [
    "air_dry",
    "ordinary_blow_dry",
    "diffuser_or_airflow_shaping",
  ])
})

test("Frottee and Diffusor are answer-only forms sorted after Mikrofaser and Föhn", () => {
  assert.deepEqual(TOOL_REPORTED_FORMS_BY_FAMILY.drying_textiles, [
    "microfiber_towel",
    "frottee",
    "smooth_cotton_cloth",
    "drying_wrap",
  ])
  assert.deepEqual(TOOL_REPORTED_FORMS_BY_FAMILY.airflow, [
    "hair_dryer",
    "diffuser",
    "hot_air_brush",
    "air_multi_styler",
  ])
  assert.equal(TOOL_REPORTED_FORMS_BY_FAMILY.brushes_combs.at(-1), "fingers")
  for (const token of ["frottee", "diffuser", "fingers"])
    assert.equal(isToolAnswerOnlyForm(token), true)
  // Never a product: the route engine reads them away.
  assert.deepEqual(toolProductTypesOf(["microfiber_towel", "frottee"]), ["microfiber_towel"])
  assert.deepEqual(toolProductTypesOf(["hair_dryer", "diffuser"]), ["hair_dryer"])
  assert.equal(isToolPageAnswerValid("drying_textiles:1", ["microfiber_towel", "frottee"]), true)
  assert.equal(isToolPageAnswerValid("drying_textiles:1", ["frottee", "microfiber_towel"]), false)
  assert.equal(
    isToolPageAnswerValid("airflow:1", ["hair_dryer", "diffuser", "hot_air_brush"]),
    true,
  )
  assert.equal(toolReportedFormLabel("frottee"), "Frottee-Handtuch")
  assert.equal(toolReportedFormLabel("diffuser"), "Diffusor-Aufsatz")
  assert.equal(toolImageSrc("frottee"), "/images/tools/frottee.webp")
  assert.equal(toolImageSrc("diffuser"), "/images/tools/diffuser.webp")
})

test("towel material is always derived from a settled textiles page", () => {
  assert.equal(
    careFactsFromToolInventory({ drying_textiles: ["microfiber_towel"] }).towelMaterial,
    "mikrofaser",
  )
  assert.equal(
    careFactsFromToolInventory({ drying_textiles: ["smooth_cotton_cloth"] }).towelMaterial,
    "tshirt",
  )
  assert.equal(
    careFactsFromToolInventory({ drying_textiles: ["drying_wrap"] }).towelMaterial,
    "turban_mikrofaser",
  )
  assert.equal(
    careFactsFromToolInventory({ drying_textiles: ["frottee"] }).towelMaterial,
    "frottee",
  )
  // Several textiles: a suitable textile wins over Frottee, then canonical order.
  assert.equal(
    careFactsFromToolInventory({ drying_textiles: ["frottee", "drying_wrap"] }).towelMaterial,
    "turban_mikrofaser",
  )
  assert.equal(
    careFactsFromToolInventory({ drying_textiles: ["smooth_cotton_cloth", "drying_wrap"] })
      .towelMaterial,
    "tshirt",
  )
  // „Nichts davon" (or an unticked section) is „kein Handtuch".
  assert.equal(careFactsFromToolInventory({ drying_textiles: [] }).towelMaterial, "no_towel")
  // Unknown stays unknown.
  assert.equal(careFactsFromToolInventory({}).towelMaterial, undefined)
})

test("night forms map onto the existing night-protection vocabulary", () => {
  assert.deepEqual(
    careFactsFromToolInventory({
      night_protection: ["pillowcase", "bonnet", "length_tip_sleeve", "soft_night_tie"],
    }).nightProtection,
    ["silk_satin_pillow", "silk_satin_bonnet", "loose_tied", "length_tip_accessory"],
  )
  assert.deepEqual(careFactsFromToolInventory({ night_protection: [] }).nightProtection, [])
  assert.equal(careFactsFromToolInventory({}).nightProtection, undefined)
})

test("brush forms map onto the legacy brush vocabulary; the rest drop out of that slot", () => {
  assert.deepEqual(
    careFactsFromToolInventory({
      brushes_combs: [...TOOL_REPORTED_FORMS_BY_FAMILY.brushes_combs],
    }).brushesCombs,
    ["wide_tooth_comb", "detangling", "paddle", "round", "boar_bristle", "fingers"],
  )
  assert.deepEqual(
    careFactsFromToolInventory({ brushes_combs: ["vent_brush", "hair_pick"] }).brushesCombs,
    [],
  )
  assert.equal(careFactsFromToolInventory({}).brushesCombs, undefined)
})

/* ── C. round trip with the pre-fill projection ──────────────────────────── */

test("the pre-fill adds Frottee and Diffusor; the engine projection stays as it was", () => {
  const care = {
    ...EMPTY_TOOL_CARE_FACTS,
    towelMaterial: "frottee" as const,
    dryingRoutes: ["diffuser_or_airflow_shaping" as const],
  }
  assert.deepEqual(projectToolPrefillFromCareFacts(care), {
    airflow: ["hair_dryer", "diffuser"],
    drying_textiles: ["frottee"],
  })
  // Fixture 21 (`D4`): the route engine still sees no drying-textile ownership for Frottee.
  assert.deepEqual(projectToolInventoryFromCareFacts(care), { airflow: ["hair_dryer"] })
  assert.deepEqual(projectToolPrefillFromCareFacts({ ...care, provenance: "assumed" }), {})
})

/** What a member's confirmed pre-fill looks like: every family answered, the pre-fill kept. */
function confirmPrefill(care: ToolCareFacts): ToolInventory {
  const projected = projectToolPrefillFromCareFacts(care)
  return Object.fromEntries(
    TOOL_FAMILIES.map((family: ToolFamily) => [family, [...(projected[family] ?? [])]]),
  )
}

test("round trip: confirming the pre-fill reproduces the stored heat tools", () => {
  for (const tool of ADDITIONAL_HEAT_TOOLS) {
    const care = { ...EMPTY_TOOL_CARE_FACTS, additionalHeatTools: [tool] }
    assert.deepEqual(careFactsFromToolInventory(confirmPrefill(care)).additionalHeatTools, [tool])
  }
  const all = { ...EMPTY_TOOL_CARE_FACTS, additionalHeatTools: [...ADDITIONAL_HEAT_TOOLS] }
  assert.deepEqual(careFactsFromToolInventory(confirmPrefill(all)).additionalHeatTools, [
    ...ADDITIONAL_HEAT_TOOLS,
  ])
})

test("round trip: confirming the pre-fill keeps every stored drying route offered", () => {
  for (const routes of [
    ["air_dry"],
    ["ordinary_blow_dry"],
    ["diffuser_or_airflow_shaping"],
    ["air_dry", "ordinary_blow_dry", "diffuser_or_airflow_shaping"],
  ] as const) {
    const care = { ...EMPTY_TOOL_CARE_FACTS, dryingRoutes: [...routes] }
    const options = dryingRouteOptionsFromToolInventory(confirmPrefill(care)) ?? []
    for (const route of routes) assert.ok(options.includes(route), `${route} stays offered`)
  }
})

test("round trip: towel material and night protection survive, with the documented losses", () => {
  for (const material of [
    "mikrofaser",
    "tshirt",
    "turban_mikrofaser",
    "frottee",
    "no_towel",
  ] as const) {
    const care = { ...EMPTY_TOOL_CARE_FACTS, towelMaterial: material }
    assert.equal(careFactsFromToolInventory(confirmPrefill(care)).towelMaterial, material)
  }
  for (const protection of NIGHT_PROTECTIONS) {
    const care = { ...EMPTY_TOOL_CARE_FACTS, nightProtection: [protection] }
    const derived = careFactsFromToolInventory(confirmPrefill(care)).nightProtection
    // `pineapple` is a technique the soft tie stands in for; it comes back as `loose_tied`.
    assert.deepEqual(derived, [protection === "pineapple" ? "loose_tied" : protection])
  }
})

/* ── C/D5. the reported-ownership oracle ─────────────────────────────────── */

test("reportedToolInventory counts only user pages and user-unticked families", () => {
  const inventory = reportedToolInventory({
    answers: {
      toolFamiliesWithSomething: ["brushes_combs", "airflow", "heated_styling"],
      toolForms: {
        "brushes_combs:1": ["wide_tooth_comb"],
        "brushes_combs:2": ["round_brush"],
        "airflow:1": ["hair_dryer"],
        "heated_styling:1": ["flat_iron"],
      },
    },
    completedQuestionIds: [
      "tools_overview",
      "tools:brushes_combs:1",
      "tools:brushes_combs:2",
      "tools:airflow:1",
      "tools:heated_styling:1",
    ],
    answerProvenance: {
      tools_overview: "user",
      "tools:brushes_combs:1": "user",
      "tools:brushes_combs:2": "assumed",
      "tools:airflow:1": "user",
      "tools:heated_styling:1": "assumed",
    },
  })
  assert.deepEqual(inventory.airflow, ["hair_dryer"])
  // A user page names what it names; the assumed sibling adds nothing.
  assert.deepEqual(inventory.brushes_combs, ["wide_tooth_comb"])
  // D5: an assumed page never counts as ownership.
  assert.equal(inventory.heated_styling, undefined)
  // Unticked by the user → explicit none.
  assert.deepEqual(inventory.night_protection, [])
})

test("reportedToolInventory: an assumed overview makes no family explicit none", () => {
  const inventory = reportedToolInventory({
    answers: { toolFamiliesWithSomething: [], toolForms: {} },
    completedQuestionIds: ["tools_overview"],
    answerProvenance: { tools_overview: "assumed" },
  })
  assert.deepEqual(inventory, {})
})

test("reportedToolInventory: an all-empty family needs every page reported to be none", () => {
  const inventory = reportedToolInventory({
    answers: {
      toolFamiliesWithSomething: ["brushes_combs"],
      toolForms: { "brushes_combs:1": [], "brushes_combs:2": [] },
    },
    completedQuestionIds: ["tools_overview", "tools:brushes_combs:1", "tools:brushes_combs:2"],
    answerProvenance: {
      tools_overview: "user",
      "tools:brushes_combs:1": "user",
      "tools:brushes_combs:2": "assumed",
    },
  })
  assert.equal(inventory.brushes_combs, undefined)
})

test("reportedToolInventoryFromFacts reads the same answer from the care keys", () => {
  const inventory = reportedToolInventoryFromFacts(
    {
      toolFamiliesWithSomething: ["brushes_combs", "airflow"],
      toolForms_brushes_combs_1: ["wide_tooth_comb"],
      toolForms_brushes_combs_2: [],
      toolForms_airflow_1: ["hair_dryer"],
      toolForms_night_protection_1: [],
      additionalHeatTools: [],
    },
    {
      toolFamiliesWithSomething: "user",
      toolForms_brushes_combs_1: "user",
      toolForms_brushes_combs_2: "user",
      toolForms_airflow_1: "assumed",
      toolForms_night_protection_1: "user",
    },
  )
  assert.deepEqual(inventory.brushes_combs, ["wide_tooth_comb"])
  assert.equal(inventory.airflow, undefined, "assumed page is not ownership")
  assert.deepEqual(inventory.night_protection, [])
  // Unticked by the user with no page key stored yet → still explicit none.
  assert.deepEqual(inventory.wash_application, [])
  assert.deepEqual(reportedToolInventoryFromFacts(null, undefined), {})
})

/* ── per-page pre-fill (Task 5: the starting value shown on each tool page) ───── */

const careWith = (overrides: Partial<ToolCareFacts>): ToolCareFacts => ({
  ...EMPTY_TOOL_CARE_FACTS,
  ...overrides,
})

test("a page's pre-fill is the care-implied inventory narrowed to the forms that page offers", () => {
  const care = careWith({
    towelMaterial: "mikrofaser",
    additionalHeatTools: ["straightener", "dryer_brush"],
    nightProtection: ["silk_satin_bonnet"],
  })
  assert.deepEqual(toolPagePreselection(care, "drying_textiles:1"), ["microfiber_towel"])
  assert.deepEqual(toolPagePreselection(care, "night_protection:1"), ["bonnet"])
  const heated = toolPagePreselection(care, "heated_styling:1")
  const airflow = toolPagePreselection(care, "airflow:1")
  assert.ok(heated?.includes("flat_iron"))
  assert.ok(airflow?.includes("hot_air_brush"))
  // Every returned form belongs to its own page — never to another page of the same family.
  for (const page of TOOL_FORM_PAGES) {
    const forms = toolPagePreselection(care, page.pageKey) ?? []
    assert.ok(
      forms.every((form) => (page.forms as readonly string[]).includes(form)),
      `${page.pageKey} offers every pre-filled form`,
    )
  }
})

test("a page's pre-fill is undefined — never an empty answer — when the care answers imply nothing", () => {
  assert.equal(toolPagePreselection(EMPTY_TOOL_CARE_FACTS, "drying_textiles:1"), undefined)
  assert.equal(
    toolPagePreselection(careWith({ nightProtection: [] }), "night_protection:1"),
    undefined,
  )
  assert.equal(
    toolPagePreselection(careWith({ towelMaterial: "mikrofaser" }), "airflow:1"),
    undefined,
  )
  assert.equal(toolPagePreselection(EMPTY_TOOL_CARE_FACTS, "not_a_page"), undefined)
})

test("two pages of one family split the family pre-fill instead of repeating it", () => {
  // A brush-family pre-fill comes from the engine projection; whatever it implies lands on
  // exactly one of the two brush pages.
  const care = careWith({ dryingRoutes: ["ordinary_blow_dry"] })
  const first = toolPagePreselection(care, "airflow:1")
  assert.ok(first?.includes("hair_dryer"))
  for (const family of ["brushes_combs", "securing_sectioning"] as const) {
    const pages = TOOL_FORM_PAGES.filter((page) => page.family === family)
    assert.equal(pages.length, 2)
    const [a, b] = pages.map((page) => toolPagePreselection(care, page.pageKey) ?? [])
    assert.deepEqual(
      a!.filter((form) => b!.includes(form)),
      [],
    )
  }
})

test("Frottee and Diffusor answers pre-fill their answer-only cards on their own pages", () => {
  assert.deepEqual(
    toolPagePreselection(careWith({ towelMaterial: "frottee" }), "drying_textiles:1"),
    ["frottee"],
  )
  const diffuser = toolPagePreselection(
    careWith({ dryingRoutes: ["diffuser_or_airflow_shaping"] }),
    "airflow:1",
  )
  assert.ok(diffuser?.includes("diffuser"))
})

test("direct acceptance's assumed defaults pre-fill nothing on any page or on the overview", () => {
  const assumed = careWith({
    provenance: "assumed",
    towelMaterial: "mikrofaser",
    dryingRoutes: ["air_dry"],
    nightProtection: [],
    additionalHeatTools: [],
  })
  for (const page of TOOL_FORM_PAGES)
    assert.equal(toolPagePreselection(assumed, page.pageKey), undefined)
  assert.equal(toolOverviewPreselection(assumed), undefined)
})

test("the overview pre-fill ticks every section holding a care-implied family, in section order", () => {
  const care = careWith({ towelMaterial: "mikrofaser", nightProtection: ["pineapple"] })
  assert.deepEqual(toolOverviewPreselection(care), ["abtrocknen_entwirren", "nachtschutz"])
  assert.equal(toolOverviewPreselection(EMPTY_TOOL_CARE_FACTS), undefined)
})

test("every tool page presents its own forms with photo cards and a Mehrfachauswahl lead", () => {
  for (const page of TOOL_FORM_PAGES) {
    const presentation = toolFormPagePresentation(page.pageKey)
    assert.ok(presentation, page.pageKey)
    assert.deepEqual(
      presentation!.options.map((option) => option.value),
      [...page.forms],
    )
    assert.match(presentation!.lead, /^Mehrfachauswahl möglich\./)
    assert.ok(presentation!.options.every((option) => option.imageUrl.endsWith(".webp")))
  }
  assert.equal(toolFormPagePresentation("nope"), null)
})

test("a per-field assumed care fact projects no ownership; the other fields still do", () => {
  const care: ToolCareFacts = {
    ...EMPTY_TOOL_CARE_FACTS,
    dryingRoutes: ["ordinary_blow_dry"],
    towelMaterial: "frottee",
    nightProtection: ["silk_satin_pillow"],
    assumedFields: ["nightProtection", "towelMaterial"],
  }
  assert.deepEqual(projectToolInventoryFromCareFacts(care), { airflow: ["hair_dryer"] })
  // The pre-fill follows the same rule: an assumed Frottee ticks nothing.
  assert.deepEqual(projectToolPrefillFromCareFacts(care), { airflow: ["hair_dryer"] })
  const { assumedFields: _assumed, ...allReported } = care
  void _assumed
  assert.deepEqual(projectToolInventoryFromCareFacts(allReported), {
    airflow: ["hair_dryer"],
    night_protection: ["pillowcase"],
  })
})
