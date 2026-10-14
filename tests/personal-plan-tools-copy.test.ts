import assert from "node:assert/strict"
import test from "node:test"

import { TOOL_FAMILIES, type ToolReportedForm } from "../src/lib/personal-plan/tools/contracts"
import {
  TOOL_CARD_LABELS,
  TOOL_FAMILY_LABELS,
  TOOL_FAMILY_PAGE_TITLES,
  TOOL_FAMILY_SHORT_LABELS,
  TOOL_FORM_PAGES,
  TOOL_PRODUCT_TYPE_LABELS,
  toolReportedFormLabel,
} from "../src/lib/personal-plan/tools/labels"
import { buildProfileToolsBlock } from "../src/lib/personal-plan/tools/profile-block"
import { toolFormPagePresentation } from "../src/lib/personal-plan/tools/stage2"

/**
 * Hair Tools port, Task 12: the copy that replaced the template title and the long family names
 * on the compact surfaces. Snapshot-style: a wording change is a deliberate edit of this file.
 */

test("every photo page asks its own, grammatical question", () => {
  assert.deepEqual(TOOL_FAMILY_PAGE_TITLES, {
    wash_application: "Was nutzt du beim Waschen und Auftragen?",
    drying_textiles: "Welche Handtücher oder Tücher nutzt du?",
    brushes_combs: "Welche Bürsten und Kämme nutzt du?",
    airflow: "Welche Haartrockner & Luftstyler nutzt du?",
    heated_styling: "Welche Hitzestyling-Tools nutzt du?",
    heatless_styling: "Welche Heatless-Styling-Tools nutzt du?",
    securing_sectioning: "Was nutzt du zum Fixieren und Abteilen?",
    night_protection: "Was nutzt du nachts?",
  })
  for (const page of TOOL_FORM_PAGES) {
    const presentation = toolFormPagePresentation(page.pageKey)
    assert.equal(presentation?.title, TOOL_FAMILY_PAGE_TITLES[page.family], page.pageKey)
  }
})

test("a two-page family keeps its question and says which page it is on", () => {
  assert.equal(
    toolFormPagePresentation("brushes_combs:1")?.title,
    toolFormPagePresentation("brushes_combs:2")?.title,
  )
  assert.equal(
    toolFormPagePresentation("brushes_combs:2")?.lead,
    "Wähle alles aus, was du nutzt. Mehrfachauswahl möglich. Seite 2 von 2.",
  )
  assert.equal(
    toolFormPagePresentation("night_protection:1")?.lead,
    "Wähle alles aus, was du nutzt. Mehrfachauswahl möglich.",
  )
})

test("the families the template got wrong no longer use it", () => {
  // „Haartrockner & Luftstyler" and „Hitzestyling-Tools" read fine in „Welche … nutzt du?".
  const templateWasFine = new Set(["airflow", "heated_styling"])
  for (const family of TOOL_FAMILIES.filter((candidate) => !templateWasFine.has(candidate))) {
    assert.notEqual(
      TOOL_FAMILY_PAGE_TITLES[family],
      `Welche ${TOOL_FAMILY_LABELS[family]} nutzt du?`,
      family,
    )
  }
})

test("the compact surfaces use the approved short group names", () => {
  assert.deepEqual(TOOL_FAMILY_SHORT_LABELS, {
    wash_application: "Waschen & Auftragen",
    drying_textiles: "Handtücher",
    brushes_combs: "Bürsten & Kämme",
    airflow: "Haartrockner & Luftstyler",
    heated_styling: "Hitzestyling-Tools",
    heatless_styling: "Heatless-Styling",
    securing_sectioning: "Fixieren & Clips",
    night_protection: "Nachtschutz",
  })
})

test("the Profil tool tiles and the checkpoint read the same short names", () => {
  const block = buildProfileToolsBlock({
    drying_textiles: ["microfiber_towel"],
    heatless_styling: ["flexi_rod"],
    securing_sectioning: ["claw_clip"],
    wash_application: ["scalp_brush"],
  })
  assert.deepEqual(
    block?.groups.map((group) => group.label),
    ["Waschen & Auftragen", "Handtücher", "Heatless-Styling", "Fixieren & Clips"],
  )
})

test("the night page names its forms the way people know them (polish 2026-10-12)", () => {
  assert.deepEqual(
    toolFormPagePresentation("night_protection:1")?.options.map((option) => option.label),
    [
      "Glatter Kissenbezug (z.\u00A0B. Seide, Satin)",
      "Bonnet",
      "Spitzen-Schoner",
      "Scrunchie / weiches Haargummi",
    ],
  )
  // `N03`: the materials are examples of a smooth surface, never the claim itself.
  // „z. B." never splits across lines: the label carries a no-break space.
  assert.match(TOOL_PRODUCT_TYPE_LABELS.pillowcase, /z\.\u00A0B\. Seide, Satin/)
})

/** A card form with its break hints removed: soft hyphen and no-break hyphen. */
function plain(cardLabel: string): string {
  return cardLabel.replace(/\u00AD/g, "").replace(/\u2011/g, "-")
}

test("every line-break-ready card label reads exactly as its plain label", () => {
  for (const [form, cardLabel] of Object.entries(TOOL_CARD_LABELS)) {
    assert.equal(plain(cardLabel!), toolReportedFormLabel(form as ToolReportedForm), form)
  }
})

test("long compounds break at the compound boundary, never mid-stem", () => {
  assert.equal(TOOL_CARD_LABELS.applicator_bottle, "Applikator\u00ADflasche")
  assert.equal(TOOL_CARD_LABELS.applicator_comb, "Applikator\u00ADkamm")
  const washPage = toolFormPagePresentation("wash_application:1")
  const bottle = washPage?.options.find((option) => option.value === "applicator_bottle")
  // The answer keeps the plain name; only the card text carries the soft hyphen.
  assert.equal(bottle?.label, "Applikatorflasche")
  assert.equal(bottle?.cardLabel, "Applikator\u00ADflasche")
  // Every card label without a break-ready form is short enough or hyphen-free on purpose.
  for (const page of TOOL_FORM_PAGES) {
    for (const option of toolFormPagePresentation(page.pageKey)?.options ?? []) {
      const words = option.label.split(/[\s/-]+/)
      const longWord = words.find((word) => word.length > 13)
      if (longWord && !option.label.includes("-/")) {
        assert.ok(option.cardLabel, `${option.value}: „${longWord}" needs a break-ready card label`)
      }
    }
  }
})
