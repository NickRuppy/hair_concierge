import assert from "node:assert/strict"
import test from "node:test"

import {
  buildHeatActivatedProtocolRow,
  NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT,
  reviewedHeatActivatedProtocolRows,
  type HeatActivatedProtocolRowInput,
} from "../src/lib/product-intake/catalog-enrichment/heat-activated-protocols"
import { buildProductApplicationPointerV2 } from "../src/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import { normalizeApplicationRoutineProducts } from "../src/lib/personal-plan/routine/application-adapter"
import { compileApplicationViewV2 } from "../src/lib/routines/personal-plan/application/compiler-v2"
import {
  APPLICATION_DAY_TYPE_KEYS,
  applicationGuidanceProtocolSchema,
} from "../src/lib/routines/personal-plan/application/contracts"
import { productApplicationPointerV2Schema } from "../src/lib/routines/personal-plan/application/contracts-v2"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "../src/lib/routines/personal-plan/application/shared-templates-v2"

const NEQI = "42a2fe20-bd7e-49a3-a880-8ae89015a5c9"
const INPUTS: HeatActivatedProtocolRowInput[] = [
  NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT,
]

test("Q11=B excludes HEAT&GLOW from reviewed heat-activated workflows", () => {
  assert.deepEqual(reviewedHeatActivatedProtocolRows("e781ca9e-886d-40a1-bfe1-48177cfbf381"), [])
  assert.equal(reviewedHeatActivatedProtocolRows(NEQI).length, 1)
})

test("generated rows are complete product_application_protocols rows", () => {
  for (const input of INPUTS) {
    const row = buildHeatActivatedProtocolRow(input)
    const dry = input.applicationFamily === "pre_heat_dry"
    assert.deepEqual(Object.keys(row).sort(), [
      "application_stage",
      "application_state",
      "category",
      "contact_time_seconds",
      "guidance_payload",
      "guidance_payload_v2",
      "instruction_modifiers",
      "placement",
      "product_id",
      "reapplication",
      "rinse_action",
      "role",
      "source_label",
      "source_text",
      "source_url",
    ])
    assert.equal(row.product_id, input.productId)
    assert.equal(row.category, "leave_in")
    assert.equal(row.role, "pre_heat_protection")
    assert.equal(row.application_stage, dry ? "dry_pre_heat" : "damp_leave_on")
    assert.equal(row.application_state, dry ? "dry" : "damp")
    assert.equal(row.rinse_action, "leave_in")
    assert.equal(row.reapplication, "required")
    assert.equal(row.contact_time_seconds, null)
    assert.deepEqual(row.instruction_modifiers, [])
    assert.equal(row.source_url, input.sourceUrl)
    assert.equal(row.source_text, input.sourceText)
    assert.equal(row.source_label, input.sourceLabel)
  }
  assert.equal(
    buildHeatActivatedProtocolRow(NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT)
      .source_label,
    "Neqi Hersteller (neqi-hair.com)",
  )
})

test("generated rows parse under the V1 and V2 schemas and V1/V2 agree", () => {
  for (const input of INPUTS) {
    const row = buildHeatActivatedProtocolRow(input)
    const v1 = applicationGuidanceProtocolSchema.parse(row.guidance_payload)
    const v2 = productApplicationPointerV2Schema.parse(row.guidance_payload_v2)
    assert.equal(v1.protocolFacts.workflowId, "heat_activated_verified_product")
    assert.equal(v1.protocolFacts.heatActivationRequired, true)
    assert.equal(v1.exactGuidanceRequired, true)
    assert.equal(v1.applicationFamily, input.applicationFamily)
    assert.deepEqual(
      v1.compatibleDayTypes,
      input.applicationFamily === "pre_heat_dry"
        ? ["refresh_day"]
        : [
            "wash_day",
            "intensive_care_day",
            "bond_repair_day",
            "clarifying_wash_day",
            "styling_day",
          ],
    )
    assert.equal(v1.evidence[0]?.sourceType, "manufacturer")
    assert.equal(v1.evidence[0]?.sourceUrl, row.source_url)
    assert.equal(v1.evidence[1]?.sourceType, "retailer")
    // By construction: the stored V2 pointer is exactly the builder's view of the stored V1.
    assert.deepEqual(
      v2,
      buildProductApplicationPointerV2({
        sourceRole: "pre_heat_protection",
        guidancePayload: v1,
        applicationState: row.application_state,
      }),
    )
    assert.equal(v2.workflowId, "heat_activated_verified_product")
    assert.equal(v2.facts.heat?.activationRequired, true)
    assert.deepEqual(
      v2.exactSteps,
      v1.steps.map((step) => ({
        stepKey: step.stepKey,
        action: step.action,
        copyDe: step.copyTemplateDe,
      })),
    )
    assert.deepEqual(v2.evidence, v1.evidence)
  }
})

test("every step's copy rests on a manufacturer sentence quoted verbatim in source_text", () => {
  for (const input of INPUTS) {
    for (const step of input.steps) {
      assert.ok(step.sourceSentences.length > 0, `${step.stepKey} has no source sentence`)
      assert.ok(
        step.sourceSentences.some((sentence) => input.sourceText.includes(sentence)),
        `${input.productId}/${step.stepKey}: no quote is in source_text`,
      )
      for (const sentence of step.sourceSentences) {
        assert.ok(
          input.sourceText.includes(sentence) || input.activationStatement.includes(sentence),
          `${input.productId}/${step.stepKey}: „${sentence}" is not a manufacturer quote`,
        )
      }
    }
    const row = buildHeatActivatedProtocolRow(input)
    assert.deepEqual(
      row.guidance_payload.steps.map((step) => step.copyTemplateDe),
      input.steps.map((step) => step.copyDe),
    )
  }
})

test("the builder refuses a step whose quote is not in the manufacturer text", () => {
  const input = structuredClone(NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT)
  input.steps[0]!.sourceSentences = ["Glätteisen nur auf trockenem Haar verwenden."]
  assert.throws(() => buildHeatActivatedProtocolRow(input), /source_sentence/)
})

test("the builder refuses a row whose source_url is not the manufacturer evidence", () => {
  const input = structuredClone(NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT)
  input.sourceUrl = "https://www.dm.de/p/d/3080142/neqi-leave-in-spray-diamond-glass-ultimate"
  assert.throws(() => buildHeatActivatedProtocolRow(input))
})

test("the builder refuses a payload the V1 contract rejects (rinse step)", () => {
  const input = structuredClone(NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT)
  input.steps.push({
    stepKey: "rinse",
    action: "rinse" as never,
    copyDe: "Ausspülen.",
    sourceSentences: ["Das Haar in Abschnitte unterteilen."],
  })
  assert.throws(() => buildHeatActivatedProtocolRow(input))
})

// ---------------------------------------------------------------------------------------------
// Rendering through the real Stage-5 V2 path: catalog rows → adapter → V2 compiler.

const SHAMPOO = "30000000-0000-4000-8000-0000000000a1"
const DRY_SHAMPOO = "30000000-0000-4000-8000-0000000000a2"

function shampooPointerRow() {
  return {
    product_id: SHAMPOO,
    category: "shampoo",
    role: "shampoo_everyday",
    guidance_payload_v2: productApplicationPointerV2Schema.parse({
      schemaVersion: 2,
      contractKind: "product_pointer",
      scope: { kind: "product", category: "shampoo", productId: SHAMPOO },
      sourceRole: "shampoo_everyday",
      role: "cleanse",
      applicationFamily: "standard_rinse_out_cleanse",
      facts: {
        applicationState: "wet_hair",
        applicationArea: "scalp_roots",
        rinse: "rinse_out",
        contactTime: null,
        amount: null,
        heat: null,
        conditionerPolicy: "not_applicable",
      },
      workflowId: null,
      requiredCompanionProductId: null,
      runtimeBlockerCode: null,
      exactSteps: [],
      cautionCodes: [],
      evidence: [
        {
          sourceUrl: "https://example.com/shampoo",
          sourceType: "manufacturer",
          checkedAt: "2026-10-09",
        },
      ],
    }),
    application_state: null,
    reapplication: null,
    source_url: "https://example.com/shampoo",
    source_text: "Shampoo",
    updated_at: "2026-10-09T00:00:00.000Z",
  }
}

function dryShampooPointerRow() {
  return {
    product_id: DRY_SHAMPOO,
    category: "dry_shampoo",
    role: "root_refresh_bridge",
    guidance_payload_v2: productApplicationPointerV2Schema.parse({
      schemaVersion: 2,
      contractKind: "product_pointer",
      scope: { kind: "product", category: "dry_shampoo", productId: DRY_SHAMPOO },
      sourceRole: "root_refresh_bridge",
      role: "refresh",
      applicationFamily: "aerosol_spray",
      facts: {
        applicationState: "dry_hair",
        applicationArea: "scalp_roots",
        rinse: "leave_in",
        contactTime: null,
        amount: null,
        heat: null,
        conditionerPolicy: "not_applicable",
      },
      workflowId: null,
      requiredCompanionProductId: null,
      runtimeBlockerCode: null,
      exactSteps: [],
      cautionCodes: [],
      evidence: [
        {
          sourceUrl: "https://example.com/dry",
          sourceType: "manufacturer",
          checkedAt: "2026-10-09",
        },
      ],
    }),
    application_state: null,
    reapplication: null,
    source_url: "https://example.com/dry",
    source_text: "Trockenshampoo",
    updated_at: "2026-10-09T00:00:00.000Z",
  }
}

type HeatEvent = {
  id: string
  tool: "hair_dryer" | "straightener"
  route: "airflow_shaping" | "direct_contact_heat"
}

function renderThroughV2(
  productId: string,
  inputs: readonly HeatActivatedProtocolRowInput[],
  heatEvents: HeatEvent[],
  { withDryShampoo = true }: { withDryShampoo?: boolean } = {},
) {
  const heatRows = inputs.map((input) => ({
    ...buildHeatActivatedProtocolRow(input),
    updated_at: "2026-10-11T00:00:00.000Z",
  }))
  const leaveInSpec = {
    format: productId === NEQI ? "spray" : "cream",
    roles: ["styling_prep"],
    provides_heat_protection: true,
    heat_activation_required: true,
    heat_activation_route: "airflow_shaping",
    application_stage: ["towel_dry", "pre_heat"],
  }
  const productRow = (id: string, category: string, extra: Record<string, unknown> = {}) => ({
    id,
    image_url: null,
    category,
    category_key: category,
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    ...extra,
  })
  const normalized = normalizeApplicationRoutineProducts({
    contractVersion: 2,
    candidates: [
      {
        itemId: "item-shampoo",
        applicationInstanceKey: "assign-shampoo",
        routineOrder: 0,
        category: "shampoo",
        routineRole: "shampoo_everyday",
        productId: SHAMPOO,
        productName: "Shampoo",
        kind: "owned",
        executable: true,
        effectiveCadenceDe: "Bei jeder Wäsche",
      },
      {
        itemId: "item-heat",
        applicationInstanceKey: "assign-heat",
        routineOrder: 1,
        category: "leave_in",
        routineRole: "pre_heat_application",
        productId,
        productName: "Neqi Diamond Glass Ultimate",
        kind: "owned",
        executable: true,
        effectiveCadenceDe: "Vor dem Föhnen",
      },
      ...(withDryShampoo
        ? [
            {
              itemId: "item-dry-shampoo",
              applicationInstanceKey: "assign-dry-shampoo",
              routineOrder: 2,
              category: "dry_shampoo",
              routineRole: "root_refresh_bridge",
              productId: DRY_SHAMPOO,
              productName: "Trockenshampoo",
              kind: "owned",
              executable: true,
              effectiveCadenceDe: "Zwischen den Wäschen",
            } as const,
          ]
        : []),
    ],
    products: new Map([
      [SHAMPOO, productRow(SHAMPOO, "shampoo")],
      [productId, productRow(productId, "leave_in", { product_leave_in_specs: leaveInSpec })],
      [
        DRY_SHAMPOO,
        productRow(DRY_SHAMPOO, "dry_shampoo", {
          product_dry_shampoo_specs: { format: "aerosol_spray" },
        }),
      ],
    ]) as never,
    protocolRows: [
      shampooPointerRow(),
      ...(withDryShampoo ? [dryShampooPointerRow()] : []),
      ...heatRows,
    ],
  })
  const result = compileApplicationViewV2({
    input: {
      routineItems: normalized.routineItems,
      unresolvedRoutineItems: [],
      profile: { heatEvents },
      dayTypes: APPLICATION_DAY_TYPE_KEYS.map((key, index) => ({ key, sortOrder: index + 1 })),
    },
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: normalized.applicationPointersV2,
  })
  const stepsOn = (day: string) =>
    result.days
      .find((entry) => entry.key === day)
      ?.productBlocks.filter((block) => block.productId === productId)
      .map((block) => block.steps.map((step) => step.copyDe))
  return { result, stepsOn }
}

const HAIR_DRYER: HeatEvent = { id: "dryer", tool: "hair_dryer", route: "airflow_shaping" }
const STRAIGHTENER: HeatEvent = { id: "iron", tool: "straightener", route: "direct_contact_heat" }

test("Neqi renders its three manufacturer steps on a wash day with a hair-dryer event", () => {
  const { result, stepsOn } = renderThroughV2(
    NEQI,
    [NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT],
    [HAIR_DRYER],
  )
  assert.deepEqual(result.pointerIssues, [])
  assert.deepEqual(stepsOn("wash_day"), [
    [
      "Das handtuchtrockene Haar in Partien teilen – es sollte nicht mehr nass sein.",
      "Das Spray großzügig und gleichmäßig auf jede Partie sprühen.",
      "Jede Partie mit Hitze und unter Spannung föhnen. Erst die Wärme aktiviert das Spray.",
    ],
  ])
  assert.equal(stepsOn("refresh_day")?.length ?? 0, 0)
})

test("a straightener-only profile renders no heat-activated occurrence", () => {
  for (const [productId, inputs] of [
    [NEQI, [NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT]],
  ] as const) {
    const { result } = renderThroughV2(productId, inputs, [STRAIGHTENER])
    assert.equal(
      result.days.some((day) =>
        day.outerSequence.some(
          (entry) =>
            (entry.kind === "product" || entry.kind === "unresolved_product") &&
            entry.block.productId === productId,
        ),
      ),
      false,
    )
  }
})
