import assert from "node:assert/strict"
import test from "node:test"

import {
  EXPANSION_TEMPLATE_IDS,
  EXPANSION_TEMPLATE_META,
  type ExpansionTemplateId,
} from "../src/lib/product-intake/expansion-manifest"
import {
  EXPANSION_TEMPLATE_APPLICATION_FAMILY,
  buildExpansionProtocolRow,
  type ExpansionProtocolRow,
  type ExpansionTemplateSlots,
} from "../src/lib/product-intake/expansion-apply-templates"
import { applicationGuidanceProtocolSchema } from "../src/lib/routines/personal-plan/application/contracts"
import { buildProductApplicationPointerV2 } from "../src/lib/product-intake/catalog-enrichment/stage5-v2-builder"

const PRODUCT_ID = "3f0d2a5c-9b41-4e77-8d2a-1c6b9f0e4a13"

const EVIDENCE: ExpansionTemplateSlots["evidence"] = [
  {
    sourceUrl: "https://www.dm.de/produkt-p1234567890123.html",
    sourceType: "retailer",
    checkedAt: "2026-09-02",
  },
]

const MASK_TEMPLATE_ID: ExpansionTemplateId = "TPL-MASK"
const HEAT_TEMPLATE_IDS: ExpansionTemplateId[] = ["TPL-LEAVEIN-HEAT", "TPL-OIL-HEAT"]

function isHeat(templateId: ExpansionTemplateId): boolean {
  return HEAT_TEMPLATE_IDS.includes(templateId)
}

/** Default per-product slots: the mask carries a sourced exact time, heat rows are damp-only. */
function defaultSlots(templateId: ExpansionTemplateId): ExpansionTemplateSlots {
  const slots: ExpansionTemplateSlots = { productId: PRODUCT_ID, evidence: EVIDENCE }
  if (templateId === MASK_TEMPLATE_ID) {
    slots.contactTimeSeconds = 180
    slots.waitCopyDe = "3 Minuten einwirken lassen."
  }
  if (isHeat(templateId)) slots.usableOnDryHair = false
  return slots
}

function parsePayload(templateId: ExpansionTemplateId, row: ExpansionProtocolRow) {
  const result = applicationGuidanceProtocolSchema.safeParse(row.guidance_payload)
  if (!result.success) {
    assert.fail(
      `${templateId}: guidance_payload failed applicationGuidanceProtocolSchema:\n` +
        JSON.stringify(result.error.issues, null, 2),
    )
  }
  return result.data
}

test("all 12 templates produce a schema-valid, product-scoped V1 guidance payload", () => {
  assert.equal(EXPANSION_TEMPLATE_IDS.length, 12)

  for (const templateId of EXPANSION_TEMPLATE_IDS) {
    const row = buildExpansionProtocolRow(templateId, defaultSlots(templateId))
    const payload = parsePayload(templateId, row)

    // §2.1: a row is verified_complete only when the payload is scoped to this exact
    // product and category.
    assert.equal(payload.scope.kind, "product", templateId)
    assert.equal(
      payload.scope.kind === "product" ? payload.scope.productId : null,
      PRODUCT_ID,
      templateId,
    )
    assert.equal(payload.scope.category, EXPANSION_TEMPLATE_META[templateId].category, templateId)

    // Every ⟨…⟩ slot is filled.
    const serialized = JSON.stringify(row.guidance_payload)
    assert.ok(!serialized.includes("⟨"), `${templateId}: unfilled ⟨…⟩ slot remains in the payload`)
    assert.ok(!serialized.includes("⟩"), `${templateId}: unfilled ⟨…⟩ slot remains in the payload`)

    // §2.6 stable-ID convention: the key carries the real product uuid.
    assert.ok(
      payload.guidanceKey.includes(PRODUCT_ID),
      `${templateId}: guidanceKey lacks productId`,
    )

    // §2.3 shared constants.
    assert.equal(payload.schemaVersion, 1, templateId)
    assert.equal(payload.protocolVersion, 1, templateId)
    assert.equal(payload.locale, "de", templateId)
    assert.equal(payload.exactGuidanceRequired, true, templateId)
    assert.deepEqual(payload.protocolFacts.cautions, [], templateId)
    assert.deepEqual(
      payload.requirements,
      { requiredCatalogFacts: [], requiredProtocolFacts: [], requiredProfileFacts: [] },
      templateId,
    )
    assert.equal(payload.protocolFacts.workflowId, undefined, templateId)
    assert.deepEqual(payload.evidence, EVIDENCE, templateId)
  }
})

test("row role/category come from EXPANSION_TEMPLATE_META, not the payload's semantic role", () => {
  for (const templateId of EXPANSION_TEMPLATE_IDS) {
    const row = buildExpansionProtocolRow(templateId, defaultSlots(templateId))
    const meta = EXPANSION_TEMPLATE_META[templateId]
    assert.equal(row.role, meta.role, templateId)
    assert.equal(row.category, meta.category, templateId)
  }

  // The two vocabularies genuinely differ — the mask row is `intensive_conditioning_mask`
  // while its payload keeps the markdown's semantic `intensive_care`.
  const maskRow = buildExpansionProtocolRow(MASK_TEMPLATE_ID, defaultSlots(MASK_TEMPLATE_ID))
  assert.equal(maskRow.role, "intensive_conditioning_mask")
  assert.equal((maskRow.guidance_payload as { role: string }).role, "intensive_care")
})

test("§2.4 column ↔ payload invariants hold for all 12 templates", () => {
  for (const templateId of EXPANSION_TEMPLATE_IDS) {
    const row = buildExpansionProtocolRow(templateId, defaultSlots(templateId))
    const payload = parsePayload(templateId, row)

    assert.equal(row.contact_time_seconds, payload.protocolFacts.contactTimeSeconds, templateId)
    assert.equal(row.placement, payload.protocolFacts.applicationArea, templateId)

    if (templateId === "TPL-OIL-PREWASH") {
      // The one documented exception: washed out with shampoo, not rinsed with water.
      assert.equal(row.rinse_action, "shampoo_out", templateId)
      assert.equal(payload.protocolFacts.rinse, "rinse_out", templateId)
    } else {
      assert.equal(row.rinse_action, payload.protocolFacts.rinse, templateId)
    }

    // No `do_not_rinse` anywhere — §2.4 standardizes the no-rinse code on `leave_in`.
    assert.notEqual(row.rinse_action, "do_not_rinse", templateId)
    assert.ok(
      ["rinse_out", "leave_in", "shampoo_out"].includes(row.rinse_action as string),
      `${templateId}: unexpected rinse_action ${String(row.rinse_action)}`,
    )

    // Generated columns are never written, and the caller owns the sources.
    const rowKeys = Object.keys(row)
    for (const forbidden of [
      "application_family",
      "category_key",
      "source_label",
      "source_url",
      "source_text",
    ]) {
      assert.ok(!rowKeys.includes(forbidden), `${templateId}: row must not emit ${forbidden}`)
    }
    assert.equal(row.cadence, null, templateId)
    assert.deepEqual(row.instruction_modifiers, [], templateId)

    // P7: heat protection is always reapplied before each separate heat session.
    if (isHeat(templateId)) {
      assert.equal(row.reapplication, "required", templateId)
      assert.equal(payload.protocolFacts.reapplication, "each_separate_heat_event", templateId)
    } else {
      assert.equal(row.reapplication, "not_stated", templateId)
      assert.equal(payload.protocolFacts.reapplication, "none", templateId)
    }
  }
})

test("stamped rows build a V2 pointer whose applicationFamily matches the template map", () => {
  for (const templateId of EXPANSION_TEMPLATE_IDS) {
    const row = buildExpansionProtocolRow(templateId, defaultSlots(templateId))
    const pointer = buildProductApplicationPointerV2({
      sourceRole: row.role,
      guidancePayload: row.guidance_payload,
      applicationState: row.application_state,
    })

    assert.equal(
      pointer.applicationFamily,
      EXPANSION_TEMPLATE_APPLICATION_FAMILY[templateId],
      `${templateId}: V2 applicationFamily drifted from EXPANSION_TEMPLATE_APPLICATION_FAMILY`,
    )
    // §2.2: when both payloads are written they must agree, or the generated column
    // will not match the V1 template.
    assert.equal(
      pointer.applicationFamily,
      (row.guidance_payload as { applicationFamily: string }).applicationFamily,
      `${templateId}: V1 and V2 families disagree`,
    )
    assert.equal(pointer.scope.productId, PRODUCT_ID, templateId)
    assert.equal(pointer.sourceRole, EXPANSION_TEMPLATE_META[templateId].role, templateId)
  }
})

test("the ruled contact windows survive the V2 builder's German copy parsing (§2.5)", () => {
  const contactTimeFor = (templateId: ExpansionTemplateId) => {
    const row = buildExpansionProtocolRow(templateId, defaultSlots(templateId))
    return buildProductApplicationPointerV2({
      sourceRole: row.role,
      guidancePayload: row.guidance_payload,
      applicationState: row.application_state,
    }).facts.contactTime
  }

  // Standard shampoo: no wait step at all (P1/P4).
  assert.equal(contactTimeFor("TPL-SHAMPOO-STD"), null)
  // Targeted + dandruff shampoo: 2–3 min range.
  assert.deepEqual(contactTimeFor("TPL-SHAMPOO-TARGETED"), {
    kind: "range_seconds",
    minimumSeconds: 120,
    maximumSeconds: 180,
  })
  assert.deepEqual(contactTimeFor("TPL-SHAMPOO-DANDRUFF"), {
    kind: "range_seconds",
    minimumSeconds: 120,
    maximumSeconds: 180,
  })
  // Conditioner: 1–3 min, and it only reaches V2 because sharedTemplateContactTime is "include".
  assert.deepEqual(contactTimeFor("TPL-CONDITIONER"), {
    kind: "range_seconds",
    minimumSeconds: 60,
    maximumSeconds: 180,
  })
  const conditionerRow = buildExpansionProtocolRow(
    "TPL-CONDITIONER",
    defaultSlots("TPL-CONDITIONER"),
  )
  assert.equal(
    parsePayload("TPL-CONDITIONER", conditionerRow).protocolFacts.sharedTemplateContactTime,
    "include",
  )
  // Pre-wash oil: the ruled 15–20 min window (P8).
  assert.deepEqual(contactTimeFor("TPL-OIL-PREWASH"), {
    kind: "range_seconds",
    minimumSeconds: 900,
    maximumSeconds: 1200,
  })
  // Mask: the sourced exact time wins.
  assert.deepEqual(contactTimeFor("TPL-MASK"), { kind: "seconds", seconds: 180 })
})

test("TPL-MASK accepts a sourced range/maximum with contactTimeSeconds null", () => {
  for (const [copy, expected] of [
    [
      "5–10 Minuten einwirken lassen.",
      { kind: "range_seconds", minimumSeconds: 300, maximumSeconds: 600 },
    ],
    ["Bis zu 10 Minuten einwirken lassen.", { kind: "maximum_seconds", maximumSeconds: 600 }],
  ] as const) {
    const row = buildExpansionProtocolRow(MASK_TEMPLATE_ID, {
      productId: PRODUCT_ID,
      evidence: EVIDENCE,
      contactTimeSeconds: null,
      waitCopyDe: copy,
    })
    parsePayload(MASK_TEMPLATE_ID, row)
    assert.equal(row.contact_time_seconds, null, copy)
    const pointer = buildProductApplicationPointerV2({
      sourceRole: row.role,
      guidancePayload: row.guidance_payload,
      applicationState: row.application_state,
    })
    assert.deepEqual(pointer.facts.contactTime, expected, copy)
  }
})

test("heat templates switch family/stage/state on the researched damp-or-dry fact (P9)", () => {
  for (const templateId of HEAT_TEMPLATE_IDS) {
    const dampRow = buildExpansionProtocolRow(templateId, {
      productId: PRODUCT_ID,
      evidence: EVIDENCE,
      usableOnDryHair: false,
    })
    const dampPayload = parsePayload(templateId, dampRow)
    assert.equal(dampPayload.applicationFamily, "pre_heat_damp", templateId)
    assert.equal(dampPayload.sequence.anchor, "damp_leave_on", templateId)
    assert.equal(dampRow.application_stage, "damp_leave_on", templateId)
    assert.equal(dampRow.application_state, "damp", templateId)

    const eitherRow = buildExpansionProtocolRow(templateId, {
      productId: PRODUCT_ID,
      evidence: EVIDENCE,
      usableOnDryHair: true,
    })
    const eitherPayload = parsePayload(templateId, eitherRow)
    assert.equal(eitherPayload.applicationFamily, "either_state_protection", templateId)
    assert.equal(eitherPayload.sequence.anchor, "dry_pre_heat", templateId)
    assert.equal(eitherRow.application_stage, "dry_pre_heat", templateId)
    assert.equal(eitherRow.application_state, "either", templateId)
    assert.ok(
      !JSON.stringify(eitherRow.guidance_payload).includes("⟨"),
      `${templateId}: either-state copy left a slot unfilled`,
    )

    const eitherPointer = buildProductApplicationPointerV2({
      sourceRole: eitherRow.role,
      guidancePayload: eitherRow.guidance_payload,
      applicationState: eitherRow.application_state,
    })
    assert.equal(eitherPointer.applicationFamily, "either_state_protection", templateId)
    assert.equal(eitherPointer.facts.applicationState, "damp_or_dry_hair", templateId)
    assert.deepEqual(
      eitherPointer.facts.heat,
      {
        supportedStates: ["damp_hair", "dry_hair"],
        activationRequired: false,
        maximumClaimedTemperatureC: null,
        reapplication: "each_separate_heat_event",
      },
      templateId,
    )
  }
})

test("missing or invalid required per-product slots throw", () => {
  // TPL-MASK without a sourced contact time (P5).
  assert.throws(
    () =>
      buildExpansionProtocolRow(MASK_TEMPLATE_ID, {
        productId: PRODUCT_ID,
        evidence: EVIDENCE,
        waitCopyDe: "3 Minuten einwirken lassen.",
      }),
    /TPL-MASK requires slots\.contactTimeSeconds/,
  )
  assert.throws(
    () =>
      buildExpansionProtocolRow(MASK_TEMPLATE_ID, {
        productId: PRODUCT_ID,
        evidence: EVIDENCE,
        contactTimeSeconds: 180,
      }),
    /TPL-MASK requires slots\.waitCopyDe/,
  )
  // "Kurz einwirken lassen." is explicitly not a stampable mask fill.
  assert.throws(
    () =>
      buildExpansionProtocolRow(MASK_TEMPLATE_ID, {
        productId: PRODUCT_ID,
        evidence: EVIDENCE,
        contactTimeSeconds: null,
        waitCopyDe: "Kurz einwirken lassen.",
      }),
    /must name a time/,
  )
  // An exact digit form with contactTimeSeconds null loses the time in V2 (§2.5).
  assert.throws(
    () =>
      buildExpansionProtocolRow(MASK_TEMPLATE_ID, {
        productId: PRODUCT_ID,
        evidence: EVIDENCE,
        contactTimeSeconds: null,
        waitCopyDe: "Zehn Minuten einwirken lassen.",
      }),
    /must name a time/,
  )

  // Heat templates without the researched damp/either fact.
  for (const templateId of HEAT_TEMPLATE_IDS) {
    assert.throws(
      () => buildExpansionProtocolRow(templateId, { productId: PRODUCT_ID, evidence: EVIDENCE }),
      /require slots\.usableOnDryHair/,
      templateId,
    )
  }

  // Evidence is never optional (F-06).
  for (const templateId of EXPANSION_TEMPLATE_IDS) {
    const slots = { ...defaultSlots(templateId), evidence: [] }
    assert.throws(
      () => buildExpansionProtocolRow(templateId, slots),
      /slots\.evidence requires at least one/,
      templateId,
    )
  }

  // A payload not scoped to the real product uuid silently degrades to
  // verified_incomplete (§2.1), so reject it up front.
  assert.throws(
    () => buildExpansionProtocolRow("TPL-SHAMPOO-STD", { productId: "", evidence: EVIDENCE }),
    /slots\.productId is required/,
  )
  assert.throws(
    () =>
      buildExpansionProtocolRow("TPL-SHAMPOO-STD", { productId: "not-a-uuid", evidence: EVIDENCE }),
    /must be a uuid/,
  )

  // Slots that belong to a different template are rejected rather than ignored.
  assert.throws(
    () =>
      buildExpansionProtocolRow("TPL-CONDITIONER", {
        productId: PRODUCT_ID,
        evidence: EVIDENCE,
        contactTimeSeconds: 120,
      }),
    /only valid for TPL-MASK/,
  )
  assert.throws(
    () =>
      buildExpansionProtocolRow("TPL-LEAVEIN-DAMP", {
        productId: PRODUCT_ID,
        evidence: EVIDENCE,
        usableOnDryHair: true,
      }),
    /only valid for TPL-LEAVEIN-HEAT/,
  )

  assert.throws(
    () =>
      buildExpansionProtocolRow("TPL-SHAMPOO-STD", {
        productId: PRODUCT_ID,
        evidence: [
          { sourceUrl: "https://example.com", sourceType: "blog", checkedAt: "2026-09-02" },
        ],
      } as unknown as ExpansionTemplateSlots),
    /sourceType must be one of/,
  )
  assert.throws(
    () =>
      buildExpansionProtocolRow("TPL-SHAMPOO-STD", {
        productId: PRODUCT_ID,
        evidence: [
          { sourceUrl: "https://example.com", sourceType: "retailer", checkedAt: "02.09.2026" },
        ],
      }),
    /checkedAt must be YYYY-MM-DD/,
  )
})

test("unknown template ids throw instead of silently stamping nothing", () => {
  assert.throws(
    () =>
      buildExpansionProtocolRow("TPL-NOT-A-TEMPLATE" as ExpansionTemplateId, {
        productId: PRODUCT_ID,
        evidence: EVIDENCE,
      }),
    /unknown expansion template id/,
  )
})
