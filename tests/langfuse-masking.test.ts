import assert from "node:assert/strict"
import test from "node:test"

import { maskLangfuseExport, sanitizeLangfuseText } from "../src/lib/langfuse/masking"

test("sanitizeLangfuseText keeps normal chat text while masking direct identifiers", () => {
  assert.equal(sanitizeLangfuseText("Meine Mail ist test@example.com"), "Meine Mail ist [redacted]")
  assert.equal(sanitizeLangfuseText("Welche Spuelung passt?"), "Welche Spuelung passt?")
})

test("maskLangfuseExport redacts AgentV2 hidden system context from stringified generation input", () => {
  const payload = JSON.stringify([
    {
      role: "system",
      content:
        'Loaded Chaarlie user context. Treat this as authoritative. {"hairProfile":{"additional_notes":"secret"},"routineInventory":[{"name":"Private Produktnotiz"}]}',
    },
    {
      role: "system",
      content:
        'CareBalance product-usage context. {"rows":[{"category":"conditioner","private":"secret"}]}',
    },
    { role: "user", content: "alte Nachricht, die nicht erneut gespiegelt werden soll" },
  ])

  const masked = maskLangfuseExport({ data: payload })
  const serialized = typeof masked === "string" ? masked : JSON.stringify(masked)

  assert.doesNotMatch(serialized, /additional_notes/)
  assert.doesNotMatch(serialized, /Private Produktnotiz/)
  assert.doesNotMatch(serialized, /alte Nachricht/)
  assert.match(serialized, /redacted_agent_v2_context/)
})

test("maskLangfuseExport drops Responses API reasoning output items", () => {
  const payload = JSON.stringify([
    {
      type: "reasoning",
      encrypted_content: "encrypted-reasoning-blob",
      summary: [{ type: "summary_text", text: "private chain summary" }],
    },
    {
      type: "message",
      content: [{ type: "output_text", text: "Das ist die sichtbare Antwort." }],
    },
  ])

  const masked = maskLangfuseExport({ data: payload })
  const serialized = typeof masked === "string" ? masked : JSON.stringify(masked)

  assert.doesNotMatch(serialized, /encrypted-reasoning-blob/)
  assert.doesNotMatch(serialized, /private chain summary/)
  assert.match(serialized, /redacted_reasoning/)
  assert.match(serialized, /sichtbare Antwort/)
})

test("maskLangfuseExport preserves root trace current user message field", () => {
  const payload = JSON.stringify({
    user_message: "Welche Spuelung passt zu mir?",
    conversation_id: "conversation-1",
  })

  const masked = maskLangfuseExport({ data: payload })
  const serialized = typeof masked === "string" ? masked : JSON.stringify(masked)

  assert.match(serialized, /Welche Spuelung passt zu mir/)
  assert.match(serialized, /conversation-1/)
})

test("maskLangfuseExport preserves safe observability names and UUIDs", () => {
  const productId = "6fde3fe0-2716-4973-b9f2-ebb17eb13bad"
  const payload = JSON.stringify({
    tool_summary: {
      name: "select_products",
      valid_product_ids: [productId],
    },
    prompt: {
      name: "chaarlie-agent-v2-responses-care-balance",
    },
    user_profile: {
      name: "Nick Beispiel",
      full_name: "Nick Beispiel",
      phone: "+49 170 1234567",
    },
  })

  const masked = maskLangfuseExport({ data: payload })
  const serialized = typeof masked === "string" ? masked : JSON.stringify(masked)

  assert.match(serialized, /select_products/)
  assert.match(serialized, /chaarlie-agent-v2-responses-care-balance/)
  assert.match(serialized, new RegExp(productId))
  assert.doesNotMatch(serialized, /Nick Beispiel/)
  assert.doesNotMatch(serialized, /170 1234567/)
})
