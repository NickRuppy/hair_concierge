import assert from "node:assert/strict"
import test from "node:test"
import {
  requiredProtocolRoles,
  validateProductIntakeApprovalPayload,
  type ProductIntakeReviewCategoryKey,
} from "../src/lib/product-intake/category-validators"
import { deriveRequiredProtocolRoles } from "../src/lib/product-intake/expansion-manifest"
import {
  runProtocolStage,
  type ProtocolResearchDraft,
  type ProtocolStageResult,
  PROTOCOL_SLOT_RESEARCH_CONTRACT,
} from "../src/lib/product-intake/pipeline/protocol"

const evidence = [
  {
    sourceUrl: "https://example.test/produkt",
    sourceType: "manufacturer" as const,
    checkedAt: "2026-10-06",
    sourceText: "In die Längen geben und ausspülen.",
  },
]
const sources = [
  {
    url: evidence[0].sourceUrl,
    title: "Hersteller",
    evidence: "In die Längen geben und ausspülen.",
  },
]

function specs(category: string): Record<string, unknown> {
  switch (category) {
    case "conditioner":
      return {
        product_conditioner_specs: [{ thickness: "fine", protein_moisture_balance: "snaps" }],
        product_conditioner_rerank_specs: {
          weight: "light",
          repair_level: "medium",
          balance_direction: null,
          ingredient_flags: ["humectants"],
        },
      }
    case "mask":
      return {
        product_mask_specs: {
          weight: "medium",
          concentration: "high",
          balance_direction: "moisture",
          ingredient_flags: ["humectants"],
          repair_support_level: "medium",
          functional_benefits: ["shine"],
        },
      }
    case "leave_in":
      return {
        product_leave_in_specs: {
          format: "spray",
          weight: "light",
          roles: ["styling_prep"],
          provides_heat_protection: false,
          heat_activation_required: false,
          care_benefits: ["moisture"],
          ingredient_flags: ["polymers"],
          application_stage: ["pre_heat"],
          care_direction: "moisture",
          repair_support_level: "low",
          plan_roles: ["post_wash_leave_in"],
          functional_benefits: ["moisture_softness"],
        },
        product_leave_in_fit_specs: {
          weight: "light",
          conditioner_relationship: "booster_only",
          care_benefits: ["detangle_smooth"],
        },
        product_leave_in_eligibility: [
          { thickness: "fine", need_bucket: "moisture_anti_frizz", styling_context: "air_dry" },
        ],
      }
    case "oil":
      return {
        product_oil_specs: {
          weight: "light",
          role_support: ["dry_finish"],
          provides_heat_protection: false,
        },
        product_oil_eligibility: [
          {
            thickness: "fine",
            oil_subtype: "trocken-oel",
            oil_purpose: "light_finish",
            ingredient_flags: ["silicones"],
          },
        ],
      }
    case "shampoo":
      return { product_shampoo_specs: [shampooRow("normal")] }
    default:
      return {}
  }
}

function shampooRow(bucket: string) {
  const routes: Record<string, [string, string]> = {
    normal: ["balanced", "regular"],
    schuppen: ["dandruff", "regular"],
    irritationen: ["irritated", "gentle"],
    trocken: ["dry", "gentle"],
    "dehydriert-fettig": ["oily", "regular"],
  }
  return {
    thickness: "fine",
    shampoo_bucket: bucket,
    scalp_route: routes[bucket]?.[0],
    cleansing_intensity: routes[bucket]?.[1],
  }
}

function run(
  categoryKey: string,
  categorySpecs = specs(categoryKey),
  draft: ProtocolResearchDraft | null = { evidence },
) {
  return runProtocolStage({ categoryKey, categorySpecs, draft, sources: [] })
}

function accepted(
  category: string,
  categorySpecs: Record<string, unknown>,
  result: ProtocolStageResult,
) {
  assert.equal(result.status, "templated", JSON.stringify(result.blockers))
  assert.deepEqual(result.blockers, [])
  const category_specs = { ...categorySpecs, product_application_protocols: result.rows }
  const payload = {
    final: {
      product: {
        canonical_brand: "Fixture",
        product_line: null,
        clean_name: "Pflege",
        category_key: category,
        affiliate_link: "https://example.test/produkt",
        image_url: "https://example.test/image.jpg",
        price_eur: 9.95,
        currency: "EUR",
        purchase_link_status: "available",
        purchase_link_checked_at: "2026-10-06T12:00:00Z",
        price_checked_at: "2026-10-06T12:00:00Z",
      },
      identifiers: [],
      category_specs,
      sources,
      field_rationales: Object.fromEntries(
        [
          "product.canonical_brand",
          "product.clean_name",
          "product.category_key",
          "product.affiliate_link",
          "product.image_url",
          "product.price_eur",
          "product.purchase_link_status",
          ...Object.keys(category_specs).map((key) => `category_specs.${key}`),
        ].map((key) => [key, "Durch Herstellerquelle belegt."]),
      ),
      review: {
        manual_reviewed: true,
        reviewed_by: "reviewer",
        reviewed_at: "2026-10-06T12:00:00Z",
      },
    },
  }
  const validation = validateProductIntakeApprovalPayload(payload)
  assert.deepEqual(
    validation.missingFields.filter((field) => field.includes("product_application_protocols")),
    [],
  )
  assert.equal(validation.ok, true, JSON.stringify(validation.missingFields))
  return result.rows as Array<{
    role: string
    contact_time_seconds: number | null
    source_label: string
    source_url: string
    source_text: string | null
    guidance_payload: {
      guidanceKey: string
      scope: { productId: string }
      applicationFamily: string
      compatibleDayTypes: string[]
      protocolFacts: Record<string, unknown>
      steps: Array<{ action: string; copyTemplateDe: string }>
      evidence: unknown[]
    }
  }>
}

test("P2 conditioner stamps normative guidance despite model-written prose", () => {
  const input = {
    ...specs("conditioner"),
    product_application_protocols: [{ copy: "Auf den Ansatz geben." }],
  }
  const before = structuredClone(input)
  const result = run("conditioner", input)
  assert.deepEqual(result.templateIds, ["TPL-CONDITIONER"])
  const [row] = accepted("conditioner", input, result)
  assert.equal(row.guidance_payload.protocolFacts.applicationArea, "lengths_ends")
  assert.ok(row.guidance_payload.steps.some((step) => step.copyTemplateDe.includes("1–3 Minuten")))
  assert.equal(row.guidance_payload.scope.productId, "__PRODUCT_ID__")
  assert.equal(row.source_url, evidence[0].sourceUrl)
  assert.deepEqual(input, before)
})

for (const [name, seconds, copy, expectedSeconds, expectedCopy] of [
  ["exact minutes", 180, "3 Minuten einwirken lassen.", 180, "3 Minuten einwirken lassen."],
  ["derived minutes", null, "3 Minuten einwirken lassen.", 180, "3 Minuten einwirken lassen."],
  ["derived seconds", null, "30 Sekunden einwirken lassen.", 30, "30 Sekunden einwirken lassen."],
  ["exact seconds", 30, "30 Sekunden einwirken lassen.", 30, "30 Sekunden einwirken lassen."],
  ["range", null, "2–3 Minuten einwirken lassen.", null, "2–3 Minuten einwirken lassen."],
  [
    "maximum",
    null,
    "Bis zu 10 Minuten einwirken lassen.",
    null,
    "Bis zu 10 Minuten einwirken lassen.",
  ],
  ["missing", null, null, null, "3–5 Minuten einwirken lassen."],
  ["unparseable", null, "Kurz einwirken lassen.", null, "3–5 Minuten einwirken lassen."],
] as const) {
  test(`P5/W3 mask ${name} passes V1 and V2 intake validation`, () => {
    const input = specs("mask")
    const result = run("mask", input, {
      evidence,
      mask_contact_time_seconds: seconds,
      mask_wait_copy_de: copy,
    })
    assert.deepEqual(result.templateIds, ["TPL-MASK"])
    const [row] = accepted("mask", input, result)
    assert.deepEqual(
      result.notes,
      name === "missing" || name === "unparseable" ? ["mask_wait_fallback_w3"] : [],
    )
    assert.equal(row.contact_time_seconds, expectedSeconds)
    assert.equal(
      row.guidance_payload.steps.find((step) => step.action === "wait")?.copyTemplateDe,
      expectedCopy,
    )
    assert.equal(row.guidance_payload.protocolFacts.conditionerRelationship, "replaces_conditioner")
  })
}

for (const [format, weight, explicit, dry] of [
  ["spray", "light", false, true],
  ["spray", "medium", false, true],
  ["serum", "light", false, true],
  ["serum", "medium", false, true],
  ["lotion", "light", false, true],
  ["lotion", "medium", false, false],
  ["cream", "light", false, false],
  ["spray", "rich", false, false],
  ["cream", "rich", true, true],
  ["serum", "rich", true, true],
] as const) {
  test(`R-D/W4 leave-in ${format}/${weight}/explicit=${explicit}`, () => {
    const input = specs("leave_in")
    Object.assign(input.product_leave_in_specs as object, { format, weight })
    Object.assign(input.product_leave_in_fit_specs as object, { weight })
    const result = run("leave_in", input, {
      evidence,
      leave_in_explicit_dry_use_marketing: explicit,
    })
    assert.deepEqual(
      result.templateIds,
      dry ? ["TPL-LEAVEIN-DAMP", "TPL-LEAVEIN-DRYCARE"] : ["TPL-LEAVEIN-DAMP"],
    )
    const rows = accepted("leave_in", input, result)
    assert.ok(rows.every((row) => row.role === "post_wash_leave_in"))
    assert.deepEqual(
      rows.map((row) => row.guidance_payload.applicationFamily),
      dry
        ? ["post_wash_damp_conditioning", "between_wash_dry_care"]
        : ["post_wash_damp_conditioning"],
    )
  })
}

for (const dry of [false, true]) {
  test(`P7/P9 heat-protecting leave-in dry=${dry}`, () => {
    const input = specs("leave_in")
    Object.assign(input.product_leave_in_specs as object, { provides_heat_protection: true })
    const result = run("leave_in", input, { evidence, heat_usable_on_dry_hair: dry })
    assert.deepEqual(result.templateIds, [
      "TPL-LEAVEIN-DAMP",
      "TPL-LEAVEIN-DRYCARE",
      "TPL-LEAVEIN-HEAT",
    ])
    const rows = accepted("leave_in", input, result)
    assert.equal(rows[2].role, "pre_heat_protection")
    assert.equal(
      rows[2].guidance_payload.applicationFamily,
      dry ? "either_state_protection" : "pre_heat_damp",
    )
    assert.equal(rows[2].guidance_payload.protocolFacts.reapplication, "each_separate_heat_event")
  })
}

for (const role_support of [
  ["dry_finish"],
  ["leave_on_fibre_conditioning"],
  ["pre_wash_fibre_treatment"],
  ["dry_finish", "leave_on_fibre_conditioning", "pre_wash_fibre_treatment"],
]) {
  test(`P8/O1–O5 oil roles ${role_support.join(",")}`, () => {
    const input = specs("oil")
    Object.assign(input.product_oil_specs as object, {
      role_support,
      provides_heat_protection: role_support.includes("leave_on_fibre_conditioning"),
    })
    const result = run("oil", input)
    const rows = accepted("oil", input, result)
    assert.deepEqual(
      rows.map((row) => row.role),
      role_support,
    )
    assert.equal(rows.length, role_support.length)
    for (const row of rows) {
      assert.ok(!row.guidance_payload.compatibleDayTypes.includes("refresh_day"))
      if (row.role === "leave_on_fibre_conditioning")
        assert.ok(!row.guidance_payload.compatibleDayTypes.includes("styling_day"))
      if (row.role === "pre_wash_fibre_treatment")
        assert.ok(
          row.guidance_payload.steps.some((step) => step.copyTemplateDe.includes("15–20 Minuten")),
        )
    }
  })
}

for (const [buckets, claim, ids] of [
  [["normal"], false, ["TPL-SHAMPOO-STD"]],
  [["normal"], true, ["TPL-SHAMPOO-TARGETED"]],
  [["trocken"], false, ["TPL-SHAMPOO-STD"]],
  [["trocken"], true, ["TPL-SHAMPOO-TARGETED"]],
  [["irritationen"], false, ["TPL-SHAMPOO-STD"]],
  [["irritationen"], true, ["TPL-SHAMPOO-TARGETED"]],
  [["dehydriert-fettig"], false, ["TPL-SHAMPOO-STD"]],
  [["dehydriert-fettig"], true, ["TPL-SHAMPOO-TARGETED"]],
  [["schuppen"], false, ["TPL-SHAMPOO-DANDRUFF"]],
  [["normal", "schuppen"], false, ["TPL-SHAMPOO-STD", "TPL-SHAMPOO-DANDRUFF"]],
] as const) {
  test(`P1/P3/P4 shampoo ${buckets.join(",")}/claim=${claim}`, () => {
    const input = {
      product_shampoo_specs: buckets.map((bucket, index) => ({
        ...shampooRow(bucket),
        thickness: index ? "normal" : "fine",
      })),
    }
    const result = run("shampoo", input, { evidence, shampoo_scalp_condition_claim: claim })
    assert.deepEqual(result.templateIds, ids)
    const rows = accepted("shampoo", input, result)
    assert.ok(
      rows.every((row) => row.guidance_payload.protocolFacts.applicationArea === "scalp_roots"),
    )
    assert.equal(
      rows[0].guidance_payload.steps.some((step) => step.action === "wait"),
      ids[0] !== "TPL-SHAMPOO-STD",
    )
  })
}

test("real validator and expansion role derivation agree for valid specs", () => {
  for (const category of ["shampoo", "conditioner", "mask", "leave_in", "oil"] as const) {
    assert.deepEqual(
      requiredProtocolRoles(category, specs(category)),
      deriveRequiredProtocolRoles(category, specs(category)),
    )
  }
  const invalid = { product_oil_specs: { role_support: ["dry_finish", "pre_heat_protection"] } }
  assert.deepEqual(requiredProtocolRoles("oil", invalid), ["dry_finish", "pre_heat_protection"])
  assert.deepEqual(deriveRequiredProtocolRoles("oil", invalid), ["dry_finish"])
  assert.equal(run("oil", invalid).status, "blocked")
})

test("evidence fallback respects source provenance and uses its actual source text", () => {
  const input = specs("conditioner")
  const result = runProtocolStage({
    categoryKey: "conditioner",
    categorySpecs: input,
    draft: null,
    sources: [
      { ...sources[0], evidence: "Geprüft am 2026-10-06: In die Längen geben und ausspülen." },
    ],
  })
  const [row] = accepted("conditioner", input, result)
  assert.deepEqual(
    row.guidance_payload.evidence,
    evidence.map(({ sourceText, ...entry }) => entry),
  )
  assert.equal(row.source_label, "Hersteller")
  assert.equal(row.source_text, "Geprüft am 2026-10-06: In die Längen geben und ausspülen.")
})

test("draft evidence wins over fallback and binds a real product UUID", () => {
  const input = specs("conditioner")
  const ownEvidence = [
    {
      ...evidence[0],
      sourceUrl: "https://example.test/authority",
      sourceType: "professional_authority" as const,
    },
  ]
  const productId = "00000000-0000-4000-8000-000000000007"
  const result = runProtocolStage({
    categoryKey: "conditioner",
    categorySpecs: input,
    draft: { evidence: ownEvidence },
    sources,
    productId,
  })
  const [row] = accepted("conditioner", input, result)
  assert.deepEqual(
    row.guidance_payload.evidence,
    ownEvidence.map(({ sourceText, ...entry }) => entry),
  )
  assert.equal(row.guidance_payload.scope.productId, productId)
  assert.equal(row.guidance_payload.guidanceKey, `product-conditioner-${productId}`)
  assert.equal(row.source_url, ownEvidence[0].sourceUrl)
  assert.equal(row.source_text, ownEvidence[0].sourceText)
})

test("retailer fallback requires a checked date and rejects unqualified sources", () => {
  const input = specs("conditioner")
  const retailerSources = [
    {
      url: "https://www.dm.de/produkt",
      title: "Retailer",
      evidence: "Checked 2026-10-06: Anleitung.",
    },
  ]
  const result = runProtocolStage({
    categoryKey: "conditioner",
    categorySpecs: input,
    draft: { evidence: [] },
    sources: retailerSources,
  })
  const [row] = accepted("conditioner", input, result)
  assert.deepEqual(row.guidance_payload.evidence, [
    { sourceUrl: retailerSources[0].url, sourceType: "retailer", checkedAt: "2026-10-06" },
  ])
  for (const fallback of [
    null,
    {},
    [],
    [{ ...sources[0], evidence: "Anleitung." }],
    [{ ...sources[0], title: "Forum" }],
  ]) {
    const blocked = runProtocolStage({
      categoryKey: "conditioner",
      categorySpecs: input,
      draft: null,
      sources: fallback,
    })
    assert.deepEqual(blocked.blockers, ["protocol_evidence_missing"])
    assert.deepEqual(blocked.rows, [])
  }
})

test("structural deviations, parked uses and missing heat slots fail closed", () => {
  const heatSpecs = specs("leave_in")
  Object.assign(heatSpecs.product_leave_in_specs as object, { provides_heat_protection: true })
  const oilSpecs = specs("oil")
  // Spray is a sourced draft fact, not a canonical oil-spec column.
  for (const [category, input, draft, blocker] of [
    [
      "conditioner",
      specs("conditioner"),
      {
        evidence,
        structural_deviation: { reason: "overnight leave-on", packaging_text: "Nicht ausspülen" },
      },
      "protocol_structural_deviation: overnight leave-on",
    ],
    [
      "leave_in",
      specs("leave_in"),
      { evidence, leave_in_post_style_finish: true },
      "protocol_parked_post_style: leave-in positioned as after-styling finish — needs Nick (P6)",
    ],
    ["leave_in", heatSpecs, { evidence }, "protocol_slot_missing: heat_usable_on_dry_hair"],
    ["oil", oilSpecs, { evidence, oil_spray_format: true }, "protocol_parked_spray_oil (X6)"],
    ["oil", { product_oil_specs: { role_support: [] } }, { evidence }, "protocol_roles_missing"],
    ["shampoo", { product_shampoo_specs: [] }, { evidence }, "protocol_roles_missing"],
  ] as const) {
    const result = run(category, input, draft)
    assert.equal(result.status, "blocked")
    assert.ok(result.blockers.includes(blocker), JSON.stringify(result.blockers))
    assert.deepEqual(result.rows, [])
  }
})

test("bad mask slots, provenance and product IDs return blockers rather than throw", () => {
  for (const draft of [
    { evidence, mask_contact_time_seconds: -1, mask_wait_copy_de: "3 Minuten einwirken lassen." },
    { evidence, mask_contact_time_seconds: 180, mask_wait_copy_de: "Kurz einwirken lassen." },
    { evidence, mask_contact_time_seconds: 180, mask_wait_copy_de: "5 Minuten einwirken lassen." },
    { evidence: [{ ...evidence[0], sourceUrl: "invalid" }] },
    { evidence: [{ ...evidence[0], checkedAt: "not-a-date" }] },
  ]) {
    const result = run("mask", specs("mask"), draft)
    assert.equal(result.status, "blocked")
    assert.ok(result.blockers.some((blocker) => blocker.startsWith("protocol_slot_invalid: ")))
    assert.deepEqual(result.rows, [])
  }
  const result = runProtocolStage({
    categoryKey: "conditioner",
    categorySpecs: specs("conditioner"),
    draft: { evidence },
    sources,
    productId: "invalid",
  })
  assert.equal(result.status, "blocked")
  assert.ok(result.blockers[0].startsWith("protocol_slot_invalid: "))
})

for (const category of [
  "bondbuilder",
  "heat_protectant",
  "scalp_care",
  "dry_shampoo",
  "deep_cleansing_shampoo",
  "other",
]) {
  test(`untemplated ${category} preserves the model rows without applying gates`, () => {
    const rows = [
      {
        category,
        source_text: "Model-written exact instructions",
        guidance_payload: { existing: true },
      },
    ]
    const result = run(
      category,
      { product_application_protocols: rows },
      { structural_deviation: { reason: "keep", packaging_text: "keep" } },
    )
    assert.equal(result.status, "not_templated")
    assert.strictEqual(result.rows, rows)
    assert.deepEqual(result.templateIds, [])
    assert.deepEqual(result.blockers, [])
  })
}

test("protocol uses quoted draft source text and exact evidence URL for publication gates", () => {
  const result = run("conditioner")
  const [row] = accepted("conditioner", specs("conditioner"), result)
  assert.equal(row.source_text, evidence[0].sourceText)
  assert.ok(
    (row.guidance_payload.evidence as Array<{ sourceUrl: string }>).some(
      (entry) => entry.sourceUrl === row.source_url,
    ),
  )
})

test("protocol source-text fallback matches normalized URLs but keeps gate URL equality", () => {
  const sourceUrl = "https://WWW.Example.test/produkt/#anwendung"
  const result = runProtocolStage({
    categoryKey: "conditioner",
    categorySpecs: specs("conditioner"),
    draft: { evidence: [{ ...evidence[0], sourceUrl, sourceText: " " }] },
    sources,
  })
  const [row] = accepted("conditioner", specs("conditioner"), result)
  assert.equal(row.source_text, sources[0].evidence)
  assert.equal(row.source_url, sourceUrl)
  assert.equal((row.guidance_payload.evidence[0] as { sourceUrl: string }).sourceUrl, sourceUrl)
  const missing = run("conditioner", specs("conditioner"), {
    evidence: [{ ...evidence[0], sourceText: " " }],
  })
  assert.equal(missing.status, "blocked")
  assert.deepEqual(missing.blockers, ["protocol_source_text_missing"])
})

for (const weight of ["light", "medium", "rich"]) {
  test(`oil ${weight} corrects placement and pre-wash dosing in column and payload`, () => {
    const input = specs("oil")
    Object.assign(input.product_oil_specs as object, {
      weight,
      role_support: ["dry_finish", "leave_on_fibre_conditioning", "pre_wash_fibre_treatment"],
    })
    const rows = accepted("oil", input, run("oil", input))
    for (const row of rows) {
      assert.equal(
        (row as unknown as { placement: string }).placement,
        weight === "rich" ? "ends" : "lengths_ends",
      )
      assert.equal(
        row.guidance_payload.protocolFacts.applicationArea,
        weight === "rich" ? "ends" : "lengths_ends",
      )
      if (row.role === "pre_wash_fibre_treatment") {
        const copy =
          weight === "rich"
            ? "Fein: mit 1 Tropfen starten; normal: 1 Tropfen; kräftig: 2 Tropfen. Vollständig zwischen den Handflächen anwärmen und sehr dünn verteilen."
            : "Fein: mit 1 Tropfen starten; normal: 2 Tropfen; kräftig: 3 Tropfen. Nur so viel ergänzen, dass ein sehr dünner Film entsteht."
        assert.equal((row.guidance_payload.protocolFacts.amount as { copyDe: string }).copyDe, copy)
        assert.equal(
          row.guidance_payload.steps.find(
            (step) => (step as unknown as { stepKey: string }).stepKey === "dose-pre-wash",
          )?.copyTemplateDe,
          copy,
        )
      }
    }
  })
}

for (const role_support of [
  ["dry_finish"],
  ["pre_wash_fibre_treatment"],
  ["dry_finish", "pre_wash_fibre_treatment"],
]) {
  test(`heat-protecting oil requires leave-on authority with roles ${role_support.join(",")}`, () => {
    const input = specs("oil")
    Object.assign(input.product_oil_specs as object, {
      role_support,
      provides_heat_protection: true,
    })
    const result = run("oil", input)
    assert.deepEqual(result.blockers, ["protocol_oil_heat_without_leave_on"])
    assert.deepEqual(result.rows, [])
  })
}

test("mask research contract uses complete German wait steps accepted by stamping", () => {
  const copySlot = (PROTOCOL_SLOT_RESEARCH_CONTRACT.slots as Record<string, string>)
    .mask_wait_copy_de
  assert.match(copySlot, /3 Minuten einwirken lassen\./)
  assert.match(copySlot, /2–3 Minuten einwirken lassen\./)
  assert.match(copySlot, /Bis zu 10 Minuten einwirken lassen\./)
})
