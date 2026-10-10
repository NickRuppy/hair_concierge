import assert from "node:assert/strict"
import test from "node:test"

import { TOOL_FAMILIES } from "../src/lib/personal-plan/tools/contracts"
import {
  TOOL_FAMILY_LABELS,
  TOOL_FAMILY_PAGE_TITLES,
  TOOL_FAMILY_SHORT_LABELS,
  TOOL_FORM_PAGES,
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
    "Mehrfachauswahl möglich. Seite 2 von 2.",
  )
  assert.equal(toolFormPagePresentation("night_protection:1")?.lead, "Mehrfachauswahl möglich.")
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
