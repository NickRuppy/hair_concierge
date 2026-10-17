/** Offline generator. Run with the same server-only shim used by npm test scripts:
 * node --import ./tests/server-only-register.cjs --import tsx scripts/shampoo-research/generate-v162-followups-protocol.ts
 */
import assert from "node:assert/strict"
import { mkdirSync, writeFileSync } from "node:fs"
import { buildExpansionProtocolRow } from "@/lib/product-intake/expansion-apply-templates"
import { buildProductApplicationPointerV2 } from "@/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import { applicationGuidanceProtocolSchema } from "@/lib/routines/personal-plan/application/contracts"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "@/lib/routines/personal-plan/application/shared-templates-v2"

const productId = "7e95671b-41a7-4f5c-9188-e535e46678ba"
const row = buildExpansionProtocolRow("TPL-SHAMPOO-DANDRUFF", {
  productId,
  evidence: [
    {
      sourceUrl: "https://sebamed.de/de/p/antischuppen-shampoo-plus/",
      sourceType: "manufacturer",
      checkedAt: "2026-10-13",
    },
  ],
})
const guidance_payload = applicationGuidanceProtocolSchema.parse(row.guidance_payload)
const guidance_payload_v2 = buildProductApplicationPointerV2({
  sourceRole: row.role,
  guidancePayload: row.guidance_payload,
  applicationState: row.application_state,
})
assert.equal(guidance_payload.scope.productId, productId)
assert.equal(guidance_payload_v2.scope.productId, productId)
assert.equal(row.role, "shampoo_dandruff")
assert.equal(guidance_payload.applicationFamily, "targeted_treatment_shampoo")
assert.equal(guidance_payload_v2.applicationFamily, guidance_payload.applicationFamily)
assert.equal(guidance_payload_v2.runtimeBlockerCode, null)
assert.ok(
  SHARED_APPLICATION_TEMPLATES_V2.some(
    (template) =>
      template.guidanceKey === "shampoo.targeted-scalp-cleanse.v2" &&
      template.scope.category === guidance_payload_v2.scope.category &&
      template.applicationFamily === guidance_payload_v2.applicationFamily,
  ),
)

const output = {
  ...row,
  cadence: { kind: "label_schedule", copy_de: "Täglich oder 2-3x pro Woche anwenden." },
  source_label: "Herstelleranleitung",
  source_url: "https://sebamed.de/de/p/antischuppen-shampoo-plus/",
  source_text:
    'Herstelleranleitung sebamed.de (abgerufen 2026-10-13): "Shampoo in der Handinnenfläche aufschäumen und unter leichtem Massieren auf die Kopfhaut auftragen. Ausspülen. Täglich oder 2-3x pro Woche anwenden." Wirkstoff Piroctone Olamine.',
  // Embed the unmodified template output; the parsed V1 above only validates it.
  guidance_payload: row.guidance_payload,
  guidance_payload_v2,
}
const directory = "plans/shampoo-v162-followups"
mkdirSync(directory, { recursive: true })
writeFileSync(`${directory}/a50-protocol.json`, `${JSON.stringify(output, null, 2)}\n`)
console.log(
  JSON.stringify(
    {
      productId,
      output: `${directory}/a50-protocol.json`,
      payloadBytes: {
        v1: Buffer.byteLength(JSON.stringify(output.guidance_payload)),
        v2: Buffer.byteLength(JSON.stringify(output.guidance_payload_v2)),
      },
    },
    null,
    2,
  ),
)
