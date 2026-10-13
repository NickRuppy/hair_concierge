import assert from "node:assert/strict"
import test from "node:test"

import { normalizeApplicationRoutineProducts } from "../src/lib/personal-plan/routine/application-adapter"
import { compileApplicationViewV2 } from "../src/lib/routines/personal-plan/application/compiler-v2"
import { APPLICATION_DAY_TYPE_KEYS } from "../src/lib/routines/personal-plan/application/contracts"
import {
  productApplicationPointerV2Schema,
  protocolSourceRoleForRoutineRole,
} from "../src/lib/routines/personal-plan/application/contracts-v2"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "../src/lib/routines/personal-plan/application/shared-templates-v2"

/**
 * Stage 4 files a Leave-in's heat slot as the plan role `pre_heat_application`;
 * the catalogue's protocol rows carry the protocol role `pre_heat_protection`
 * (the same mapping the curated gate and the catalog-facts loader use). V2 must
 * bind them for every heat-protecting Leave-in, not only heat-activated ones.
 * Fixture: the live Gliss Ultimate Repair rows (5dc2fae3, read 2026-10-11).
 */

const GLISS = "5dc2fae3-a0ca-4e6c-9c30-02dd192772f0"
const GLISS_URL =
  "https://www.schwarzkopf.ch/de/marken/haarpflege/gliss/ultimate-repair/ultimate-repair-express-repair-spuelung-200-ml.html"

function glissPointer(
  sourceRole: "post_wash_leave_in" | "pre_heat_protection",
  family: "post_wash_damp_conditioning" | "either_state_protection",
) {
  const heat = sourceRole === "pre_heat_protection"
  return productApplicationPointerV2Schema.parse({
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: { kind: "product", category: "leave_in", productId: GLISS },
    sourceRole,
    role: heat ? "heat_protection" : "leave_in",
    applicationFamily: family,
    facts: {
      applicationState: heat ? "damp_or_dry_hair" : "damp_hair",
      applicationArea: "hair_lengths_ends",
      rinse: "leave_in",
      contactTime: null,
      amount: null,
      heat: heat
        ? {
            supportedStates: ["damp_hair", "dry_hair"],
            activationRequired: false,
            maximumClaimedTemperatureC: 230,
            reapplication: "none",
          }
        : null,
      conditionerPolicy: "not_applicable",
    },
    workflowId: null,
    requiredCompanionProductId: null,
    runtimeBlockerCode: null,
    exactSteps: [],
    cautionCodes: [],
    evidence: [{ sourceUrl: GLISS_URL, sourceType: "manufacturer", checkedAt: "2026-08-11" }],
  })
}

function protocolRow(pointer: ReturnType<typeof glissPointer>) {
  const heat = pointer.sourceRole === "pre_heat_protection"
  return {
    product_id: GLISS,
    category: "leave_in",
    role: pointer.sourceRole,
    guidance_payload_v2: pointer,
    application_state: "either",
    reapplication: heat ? "not_stated" : "not_stated",
    source_url: GLISS_URL,
    source_text:
      "Shake, spray after each wash into towel-dried or dry hair, do not rinse. Heat protection up to 230°C.",
    updated_at: "2026-08-11T00:00:00.000Z",
  }
}

const SHAMPOO = "30000000-0000-4000-8000-0000000000b1"
const SHAMPOO_ROW = {
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

function compile(routineRole: "post_wash_leave_in" | "pre_heat_application", rows: unknown[]) {
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
        itemId: `item-gliss-${routineRole}`,
        applicationInstanceKey: `assign-gliss-${routineRole}`,
        routineOrder: 1,
        category: "leave_in",
        routineRole,
        productId: GLISS,
        productName: "Gliss Ultimate Repair Sprüh-Conditioner",
        kind: "planned",
        executable: true,
        effectiveCadenceDe: "Nach jeder Wäsche",
      },
    ],
    products: new Map([
      [
        SHAMPOO,
        {
          id: SHAMPOO,
          image_url: null,
          category: "shampoo",
          category_key: "shampoo",
          is_active: true,
          lifecycle_status: "active",
          is_chaarlie_recommended: true,
        },
      ],
      [
        GLISS,
        {
          id: GLISS,
          image_url: null,
          category: "leave_in",
          category_key: "leave_in",
          is_active: true,
          lifecycle_status: "active",
          is_chaarlie_recommended: true,
          product_leave_in_specs: {
            format: "spray",
            roles: ["replacement_conditioner"],
            provides_heat_protection: true,
            heat_activation_required: false,
            application_stage: ["towel_dry", "dry_hair"],
          },
        },
      ],
    ]) as never,
    protocolRows: [SHAMPOO_ROW, ...rows] as never,
  })
  return compileApplicationViewV2({
    input: {
      routineItems: normalized.routineItems,
      unresolvedRoutineItems: [],
      profile: { heatEvents: [{ id: "dryer", tool: "hair_dryer", route: "airflow_shaping" }] },
      dayTypes: APPLICATION_DAY_TYPE_KEYS.map((key, index) => ({ key, sortOrder: index + 1 })),
    },
    familyTemplates: SHARED_APPLICATION_TEMPLATES_V2,
    productPointers: normalized.applicationPointersV2,
  })
}

const BOTH_ROWS = [
  protocolRow(glissPointer("post_wash_leave_in", "post_wash_damp_conditioning")),
  protocolRow(glissPointer("pre_heat_protection", "either_state_protection")),
]

const glissSteps = (result: ReturnType<typeof compile>, day: string) =>
  result.days
    .find((entry) => entry.key === day)
    ?.productBlocks.filter((block) => block.productId === GLISS)
    .flatMap((block) => block.steps.map((step) => step.copyDe)) ?? []

const PRE_HEAT_COPY =
  "Gleichmäßig auf handtuchtrockenem Haar verteilen. Erst danach föhnen oder stylen."

test("a non-activated heat-protecting Leave-in in the pre-heat slot binds its pre_heat_protection row", () => {
  const result = compile("pre_heat_application", BOTH_ROWS)
  assert.deepEqual(result.pointerIssues, [])
  assert.deepEqual(glissSteps(result, "wash_day"), [PRE_HEAT_COPY])
})

test("role binding stays strict: post-wash binds only its own rows, and the mapping is explicit", () => {
  const postWash = compile("post_wash_leave_in", BOTH_ROWS)
  assert.deepEqual(postWash.pointerIssues, [])
  const postWashSteps = glissSteps(postWash, "wash_day")
  assert.ok(postWashSteps.length > 0)
  assert.ok(!postWashSteps.includes(PRE_HEAT_COPY), "post-wash never renders the heat row")
  // Without its own row the post-wash slot does not borrow the heat row …
  const heatOnly = compile("post_wash_leave_in", [BOTH_ROWS[1]])
  assert.ok(heatOnly.pointerIssues.some((issue) => issue.reason === "missing_pointer"))
  // … and the pre-heat slot does not borrow the post-wash row.
  const postWashOnly = compile("pre_heat_application", [BOTH_ROWS[0]])
  assert.ok(postWashOnly.pointerIssues.some((issue) => issue.reason === "missing_pointer"))
  assert.equal(protocolSourceRoleForRoutineRole("pre_heat_application"), "pre_heat_protection")
  for (const role of [
    "post_wash_leave_in",
    "pre_heat_protection",
    "leave_on_fibre_conditioning",
    "shampoo_everyday",
  ])
    assert.equal(protocolSourceRoleForRoutineRole(role), role)
})
