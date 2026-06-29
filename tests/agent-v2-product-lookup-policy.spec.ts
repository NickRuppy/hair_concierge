import { test } from "node:test"
import assert from "node:assert/strict"

import {
  agentV2ProductLookupStatusBlocksProductSpecificAnswer,
  agentV2ProductLookupStatusHasClarificationCard,
  agentV2ProductLookupStatusHasPendingCard,
  enrichAgentV2ProductLookupResultForAssistant,
  getAgentV2ProductLookupAssistantGuidance,
  isAgentV2ProductLookupUnresolvedStatus,
} from "@/lib/agent-v2/product-lookup-policy"

test("Agent V2 product lookup policy maps found products to answerable catalog results", () => {
  assert.deepEqual(getAgentV2ProductLookupAssistantGuidance("found_exact"), {
    pending_ui_action: "none",
    assistant_instruction_de:
      "Das Produkt wurde eindeutig in der Datenbank gefunden. Du darfst es anhand der hinterlegten Produkteigenschaften beantworten.",
  })
  assert.equal(isAgentV2ProductLookupUnresolvedStatus("found_exact"), false)
  assert.equal(agentV2ProductLookupStatusBlocksProductSpecificAnswer("found_exact"), false)
  assert.equal(agentV2ProductLookupStatusHasPendingCard("found_exact"), false)
})

test("Agent V2 product lookup policy maps not_found to intake-card handoff", () => {
  assert.deepEqual(getAgentV2ProductLookupAssistantGuidance("not_found"), {
    pending_ui_action: "product_intake_card",
    assistant_instruction_de:
      "Dieses Produkt ist noch nicht in der Datenbank. Erkläre kurz und natürlich, dass es zur Prüfung hinzugefügt werden kann, ohne es fachlich zu bewerten.",
  })
  assert.equal(isAgentV2ProductLookupUnresolvedStatus("not_found"), true)
  assert.equal(agentV2ProductLookupStatusBlocksProductSpecificAnswer("not_found"), true)
  assert.equal(agentV2ProductLookupStatusHasPendingCard("not_found"), true)
  assert.equal(agentV2ProductLookupStatusHasClarificationCard("not_found"), false)
})

test("Agent V2 product lookup policy maps variant and category conflicts to clarification cards", () => {
  for (const status of ["ambiguous", "needs_variant_selection", "category_mismatch"]) {
    const guidance = getAgentV2ProductLookupAssistantGuidance(status)
    assert.equal(guidance.pending_ui_action, "product_lookup_clarification_card")
    assert.equal(isAgentV2ProductLookupUnresolvedStatus(status), true)
    assert.equal(agentV2ProductLookupStatusBlocksProductSpecificAnswer(status), true)
    assert.equal(agentV2ProductLookupStatusHasPendingCard(status), true)
    assert.equal(agentV2ProductLookupStatusHasClarificationCard(status), true)
  }
})

test("Agent V2 enriches pure product lookup results with model-visible guidance", () => {
  assert.deepEqual(
    enrichAgentV2ProductLookupResultForAssistant({
      status: "needs_variant_selection",
      product: null,
      candidates: [],
    }),
    {
      status: "needs_variant_selection",
      product: null,
      candidates: [],
      assistant_guidance: {
        pending_ui_action: "product_lookup_clarification_card",
        assistant_instruction_de:
          "Es gibt mehrere mögliche Treffer. Bitte den Nutzer kurz bitten, die passende Variante in der Karte auszuwählen; die ursprüngliche Produktfrage noch nicht beantworten.",
      },
    },
  )
})

test("Agent V2 leaves non-lookup tool outputs untouched", () => {
  const output = { visible_steps: [] }
  assert.equal(enrichAgentV2ProductLookupResultForAssistant(output), output)
  assert.equal(enrichAgentV2ProductLookupResultForAssistant(null), null)
})
