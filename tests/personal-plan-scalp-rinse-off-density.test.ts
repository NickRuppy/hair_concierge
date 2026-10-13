import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildProductApplicationPointerV2 } from "../src/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import { composeProductApplicationProtocolsV2 } from "../src/lib/routines/personal-plan/application/compiler-v2"
import { applicationGuidanceProtocolSchema } from "../src/lib/routines/personal-plan/application/contracts"
import {
  SHARED_APPLICATION_TEMPLATE_BY_KEY_V2,
  SHARED_APPLICATION_TEMPLATES_AT_ARTIFACT_FREEZE_V2,
  SHARED_APPLICATION_TEMPLATES_V2,
} from "../src/lib/routines/personal-plan/application/shared-templates-v2"

/**
 * F03 (catalogue completeness Slice 1): a density_claim_tonic product whose
 * manufacturer directions are a pre-wash scalp treatment (apply, massage,
 * leave at least 10 minutes, wash out with shampoo) uses the rinse-off scalp
 * family in V1 and V2, and the shared rinse-off template renders exactly that.
 * The Neqi payload is the reviewed Slice 1 input the migration generator stamps.
 */
const NEQI = JSON.parse(
  readFileSync(
    new URL(
      "../plans/catalog-completeness-fill/slice1/inputs/neqi-rosemary-scalp-care.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  product_id: string
  protocol: { role: string; guidance_payload: unknown; contact_time_seconds: number }
}

const CLAIM_ECHO = /wachstum|wachsen|durchblutung|minoxidil|peptid|haarausfall|haarverlust/i

function neqiPointer() {
  return buildProductApplicationPointerV2({
    sourceRole: NEQI.protocol.role,
    guidancePayload: NEQI.protocol.guidance_payload,
  })
}

test("density_claim_tonic keeps a rinse-off scalp family in V2 when V1 states it", () => {
  const v1 = applicationGuidanceProtocolSchema.parse(NEQI.protocol.guidance_payload)
  const pointer = neqiPointer()

  assert.equal(v1.applicationFamily, "rinse_off_scalp_care")
  assert.equal(pointer.applicationFamily, v1.applicationFamily, "V1/V2 family agreement")
  assert.equal(pointer.sourceRole, "density_claim_tonic")
  assert.equal(pointer.role, "scalp_care")
  assert.deepEqual(pointer.facts.contactTime, { kind: "minimum_seconds", minimumSeconds: 600 })
  assert.equal(pointer.facts.applicationArea, "scalp_roots")
  assert.equal(pointer.facts.rinse, "rinse_out")
  assert.deepEqual(pointer.cautionCodes, ["cosmetic_claim_only"])
})

test("density_claim_tonic still defaults to leave-on and refuses unrelated families", () => {
  const v1 = applicationGuidanceProtocolSchema.parse(NEQI.protocol.guidance_payload)
  const leaveOn = buildProductApplicationPointerV2({
    sourceRole: "density_claim_tonic",
    guidancePayload: { ...v1, applicationFamily: "leave_on_scalp_care" },
  })
  assert.equal(leaveOn.applicationFamily, "leave_on_scalp_care")

  const unrelated = buildProductApplicationPointerV2({
    sourceRole: "density_claim_tonic",
    guidancePayload: { ...v1, applicationFamily: "post_wash_damp_conditioning" },
  })
  assert.equal(unrelated.applicationFamily, "leave_on_scalp_care")
})

test("the rinse-off scalp template renders the Neqi directions in short German", () => {
  const composed = composeProductApplicationProtocolsV2(
    neqiPointer(),
    SHARED_APPLICATION_TEMPLATES_V2,
  )
  assert.equal(composed.status, "resolved")
  if (composed.status !== "resolved") return
  assert.equal(composed.protocols.length, 1)
  const protocol = composed.protocols[0]!

  assert.deepEqual(
    protocol.steps.map((step) => step.copyTemplateDe),
    [
      "Scheitelweise auf die Kopfhaut geben und sanft einmassieren.",
      "Mindestens 10 Minuten einwirken lassen.",
      "Anschließend mit Shampoo auswaschen.",
      "Die Anwendung ist kosmetische Pflege und keine medizinische Behandlung.",
    ],
  )
  assert.equal(protocol.applicationFamily, "rinse_off_scalp_care")
  assert.equal(protocol.sequence.anchor, "pre_wash")
  assert.deepEqual(protocol.compatibleDayTypes, ["wash_day"])
  assert.doesNotMatch(JSON.stringify(protocol.steps), CLAIM_ECHO)
  assert.doesNotMatch(JSON.stringify(NEQI.protocol.guidance_payload), CLAIM_ECHO)
})

test("existing rinse-off scalp peelings keep their exact contact time and now wash out with shampoo", () => {
  const v1 = applicationGuidanceProtocolSchema.parse(NEQI.protocol.guidance_payload)
  const peeling = buildProductApplicationPointerV2({
    sourceRole: "scalp_exfoliant",
    guidancePayload: {
      ...v1,
      protocolFacts: {
        ...v1.protocolFacts,
        contactTimeSeconds: 900,
        contactTime: undefined,
        cautionCodes: [],
      },
    },
  })
  const composed = composeProductApplicationProtocolsV2(peeling, SHARED_APPLICATION_TEMPLATES_V2)
  assert.equal(composed.status, "resolved")
  if (composed.status !== "resolved") return
  assert.deepEqual(
    composed.protocols[0]!.steps.map((step) => step.copyTemplateDe),
    [
      "Scheitelweise auf die Kopfhaut geben und sanft einmassieren.",
      "15 Minuten einwirken lassen.",
      "Anschließend mit Shampoo auswaschen.",
    ],
  )
})

test("the frozen Stage 5 V2 artifact registry keeps the superseded rinse-off scalp template", () => {
  const live = SHARED_APPLICATION_TEMPLATE_BY_KEY_V2.get("scalp.rinse-off.v2")
  const frozen = SHARED_APPLICATION_TEMPLATES_AT_ARTIFACT_FREEZE_V2.find(
    (template) => template.guidanceKey === "scalp.rinse-off.v2",
  )
  assert.ok(live && frozen)
  assert.equal(live.protocolVersion, 3)
  assert.equal(frozen.protocolVersion, 2)
  assert.deepEqual(
    frozen.steps.map((step) => step.copyTemplateDe),
    [
      "Scheitelweise auf die Kopfhaut geben und sanft verteilen.",
      "{{contact_time_de}} einwirken lassen.",
      "Gründlich ausspülen.",
    ],
  )
  assert.equal(
    SHARED_APPLICATION_TEMPLATES_AT_ARTIFACT_FREEZE_V2.length,
    SHARED_APPLICATION_TEMPLATES_V2.length,
  )
})
