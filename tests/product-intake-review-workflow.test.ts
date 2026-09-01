import assert from "node:assert/strict"
import test from "node:test"

import {
  parseProductIntakeResearchedPayload,
  validateProductIntakeApprovalPayload,
  type ProductIntakeReviewCategoryKey,
} from "../src/lib/product-intake/category-validators"
import { dryRunProductIntakeReadyForReview } from "../src/lib/product-intake/review-workflow"

const PRODUCT_ID_PLACEHOLDER = "__PRODUCT_ID__"

function exactProtocol(category: ProductIntakeReviewCategoryKey, role: string) {
  const semanticRoleBySourceRole: Record<string, string> = {
    shampoo_everyday: "cleanse",
    shampoo_dandruff: "cleanse",
    conditioner_rinse_out: "condition",
    intensive_conditioning_mask: "intensive_care",
    post_wash_leave_in: "leave_in",
    pre_heat_protection: "heat_protection",
    pre_wash_fibre_treatment: "intensive_care",
    leave_on_fibre_conditioning: "leave_in",
    dry_finish: "finish",
    root_refresh_bridge: "refresh",
    residue_reset: "reset_cleanse",
    mineral_reset: "reset_cleanse",
    specialized_bond_treatment: "bond_repair",
    scalp_comfort: "scalp_care",
    scalp_flake_oil_adjunct: "scalp_care",
    density_claim_tonic: "scalp_care",
    scalp_exfoliant: "scalp_care",
  }
  const familyBySourceRole: Record<string, string> = {
    shampoo_everyday: "standard_rinse_out_cleanse",
    shampoo_dandruff: "targeted_treatment_shampoo",
    conditioner_rinse_out: "standard_rinse_out_conditioning",
    intensive_conditioning_mask: "post_shampoo_rinse_out_mask",
    post_wash_leave_in: "post_wash_booster",
    pre_heat_protection: "pre_heat_damp",
    pre_wash_fibre_treatment: "pre_wash_lengths_treatment",
    leave_on_fibre_conditioning: "post_wash_damp_conditioning",
    dry_finish: "dry_finish",
    root_refresh_bridge: "aerosol_spray",
    residue_reset: "reset_cleanse",
    mineral_reset: "reset_cleanse",
    specialized_bond_treatment: "pre_shampoo_single_treatment",
    scalp_comfort: "leave_on_scalp_care",
    scalp_flake_oil_adjunct: "leave_on_scalp_care",
    density_claim_tonic: "leave_on_scalp_care",
    scalp_exfoliant: "rinse_off_scalp_care",
  }
  return {
    category,
    role,
    cadence: { kind: "fixture" },
    application_stage: "fixture_stage",
    application_state: "either",
    placement: "fixture_area",
    contact_time_seconds: null,
    rinse_action: "fixture_action",
    reapplication: "not_stated",
    instruction_modifiers: [],
    source_label: "Hersteller",
    source_url: "https://example.test/instructions",
    source_text: "Exakte Herstelleranleitung.",
    guidance_payload: {
      schemaVersion: 1,
      guidanceKey: `fixture-${category}-${role}`,
      protocolVersion: 1,
      locale: "de",
      scope: { kind: "product", category, productId: PRODUCT_ID_PLACEHOLDER },
      role: semanticRoleBySourceRole[role],
      applicationFamily: familyBySourceRole[role],
      compatibleDayTypes: ["wash_day"],
      exactGuidanceRequired: true,
      sequence: { anchor: "damp_leave_on", before: [], after: [], conflictsWith: [] },
      requirements: {
        requiredCatalogFacts: [],
        requiredProtocolFacts: [],
        requiredProfileFacts: [],
      },
      protocolFacts: {
        applicationArea: "lengths_ends",
        rinse: "leave_in",
        contactTimeSeconds: null,
        conditionerRelationship: "not_applicable",
        reapplication: "none",
        amount: null,
        cautions: [],
      },
      steps: [{ stepKey: "apply", action: "apply_product", copyTemplateDe: "Auftragen." }],
      evidence: [
        {
          sourceUrl: "https://example.test/instructions",
          sourceType: "manufacturer",
          checkedAt: "2026-08-11",
        },
      ],
    },
  }
}

function reviewedPayload(
  categoryKey: ProductIntakeReviewCategoryKey | "peeling",
  categorySpecs: Record<string, unknown>,
) {
  const fieldRationales = Object.fromEntries(
    [
      "product.canonical_brand",
      "product.clean_name",
      "product.category_key",
      "product.affiliate_link",
      "product.image_url",
      "product.price_eur",
      "product.purchase_link_status",
      ...Object.keys(categorySpecs).map((key) => `category_specs.${key}`),
    ].map((key) => [key, `Reviewed evidence supports ${key}.`]),
  )

  return {
    draft: {
      notes: "kept as JSON draft context",
    },
    final: {
      product: {
        canonical_brand: "Garnier",
        product_line: null,
        clean_name: "Hair Food Aloe Maske",
        category_key: categoryKey,
        affiliate_link: "https://example.test/affiliate",
        image_url: "https://example.test/image.jpg",
        price_eur: 7.95,
        currency: "EUR",
        purchase_link_status: "available",
        purchase_link_checked_at: "2026-06-17T09:00:00.000Z",
        price_checked_at: "2026-06-17T09:00:00.000Z",
      },
      identifiers: [{ type: "barcode", value: "4006381333931" }],
      category_specs: categorySpecs,
      sources: [
        {
          url: "https://example.test/product",
          title: "Product page",
          evidence: "Brand page lists the product and relevant specs.",
        },
      ],
      field_rationales: fieldRationales,
      review: {
        manual_reviewed: true,
        reviewed_by: "reviewer@example.test",
        reviewed_at: "2026-06-17T10:00:00.000Z",
      },
    },
  }
}

function validCategorySpecs(categoryKey: ProductIntakeReviewCategoryKey): Record<string, unknown> {
  switch (categoryKey) {
    case "shampoo":
      return {
        product_shampoo_specs: [
          {
            thickness: "fine",
            shampoo_bucket: "normal",
            scalp_route: "balanced",
            cleansing_intensity: "regular",
          },
          {
            thickness: "normal",
            shampoo_bucket: "trocken",
            scalp_route: "dry",
            cleansing_intensity: "gentle",
          },
        ],
        product_application_protocols: [exactProtocol(categoryKey, "shampoo_everyday")],
      }
    case "conditioner":
      return {
        product_conditioner_specs: [
          { thickness: "fine", protein_moisture_balance: "snaps" },
          { thickness: "normal", protein_moisture_balance: "stretches_bounces" },
        ],
        product_conditioner_rerank_specs: {
          weight: "light",
          repair_level: "medium",
          balance_direction: null,
          ingredient_flags: ["humectants"],
        },
        product_application_protocols: [exactProtocol(categoryKey, "conditioner_rinse_out")],
      }
    case "mask":
      return {
        product_mask_specs: {
          weight: "medium",
          concentration: "high",
          balance_direction: "moisture",
          ingredient_flags: ["humectants", "oils"],
          repair_support_level: "medium",
          functional_benefits: ["shine"],
        },
        product_application_protocols: [exactProtocol(categoryKey, "intensive_conditioning_mask")],
      }
    case "leave_in":
      return {
        product_leave_in_specs: {
          format: "spray",
          weight: "light",
          roles: ["styling_prep"],
          provides_heat_protection: true,
          heat_protection_max_c: 220,
          heat_activation_required: false,
          care_benefits: ["moisture", "anti_frizz"],
          ingredient_flags: ["polymers"],
          application_stage: ["pre_heat"],
          care_direction: "moisture",
          repair_support_level: "low",
          plan_roles: ["post_wash_leave_in", "pre_heat_application"],
          functional_benefits: ["heat_protect"],
        },
        product_leave_in_fit_specs: {
          weight: "light",
          conditioner_relationship: "booster_only",
          care_benefits: ["heat_protect", "detangle_smooth"],
        },
        product_leave_in_eligibility: [
          { thickness: "fine", need_bucket: "heat_protect", styling_context: "heat_style" },
          { thickness: "normal", need_bucket: "moisture_anti_frizz", styling_context: "air_dry" },
        ],
        product_application_protocols: [
          exactProtocol(categoryKey, "post_wash_leave_in"),
          exactProtocol(categoryKey, "pre_heat_protection"),
        ],
      }
    case "oil":
      return {
        product_oil_specs: {
          weight: "light",
          role_support: ["dry_finish", "leave_on_fibre_conditioning"],
        },
        product_oil_eligibility: [
          {
            thickness: "fine",
            oil_subtype: "trocken-oel",
            oil_purpose: "light_finish",
            ingredient_flags: ["silicones"],
          },
          {
            thickness: "coarse",
            oil_subtype: "natuerliches-oel",
            oil_purpose: null,
            ingredient_flags: ["oils"],
          },
        ],
        product_application_protocols: [
          exactProtocol(categoryKey, "dry_finish"),
          exactProtocol(categoryKey, "leave_on_fibre_conditioning"),
        ],
      }
    case "dry_shampoo":
      return {
        product_dry_shampoo_specs: {
          primary_effect: "classic_refresh",
          hair_color_fit: "universal",
          scalp_sensitivity_fit: "sensitive_ok",
          format: "aerosol_spray",
        },
        product_application_protocols: [exactProtocol(categoryKey, "root_refresh_bridge")],
      }
    case "deep_cleansing_shampoo":
      return {
        product_deep_cleansing_shampoo_specs: {
          scalp_type_focus: "oily",
          reset_intensity: "medium",
          reset_focus: "product_sebum_buildup",
          color_treated_suitability: "suitable",
        },
        product_application_protocols: [exactProtocol(categoryKey, "residue_reset")],
      }
    case "bondbuilder":
      return {
        product_bondbuilder_specs: {
          bond_repair_intensity: "intensive",
          application_mode: "post_wash_leave_in",
          bond_repair_axis: "peptide_chain",
          treatment_mode: "leave_in",
          product_format: "leave_in_mask",
          usage_protocol: "k18_leave_in",
        },
        product_application_protocols: [exactProtocol(categoryKey, "specialized_bond_treatment")],
      }
    case "heat_protectant":
      return {
        product_heat_protectant_specs: { format: "spray", provides_heat_protection: true },
        product_application_protocols: [
          {
            category: "heat_protectant",
            role: "pre_heat_protection",
            cadence: { kind: "event" },
            application_stage: "before_heat",
            application_state: "damp",
            placement: "lengths",
            contact_time_seconds: null,
            rinse_action: "leave_in",
            reapplication: "required",
            instruction_modifiers: [],
            source_label: "Hersteller",
            source_url: "https://example.test/instructions",
            source_text: "Vor jeder Hitze anwenden.",
            guidance_payload: exactProtocol(categoryKey, "pre_heat_protection").guidance_payload,
          },
        ],
      }
    case "scalp_care":
      return {
        product_scalp_care_specs: {
          primary_role: "scalp_comfort",
          presentation_format: "serum",
          rinse_mode: "leave_on",
          application_instructions: "Auf die Kopfhaut auftragen.",
        },
        product_application_protocols: [
          {
            category: "scalp_care",
            role: "scalp_comfort",
            cadence: { kind: "as_needed" },
            application_stage: "after_washing",
            application_state: "either",
            placement: "scalp",
            contact_time_seconds: null,
            rinse_action: "leave_in",
            reapplication: "not_stated",
            instruction_modifiers: [],
            source_label: "Hersteller",
            source_url: "https://example.test/instructions",
            source_text: "Bei Bedarf anwenden.",
            guidance_payload: exactProtocol(categoryKey, "scalp_comfort").guidance_payload,
          },
        ],
      }
  }
}

test("unsupported category fails approval validation", () => {
  const result = validateProductIntakeApprovalPayload(
    reviewedPayload("peeling", { product_peeling_specs: { scalp_type_focus: "oily" } }),
  )

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.product.category_key"))
})

test("approval payload rejects invalid barcode identifiers before product publish", () => {
  const payload = reviewedPayload("conditioner", validCategorySpecs("conditioner"))
  payload.final.identifiers = [{ type: "ean", value: "4006381333930" }]

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.missingFields.includes("final.identifiers.0.value"))
  }
})

test("every curated category requires its own exact canonical application protocol", () => {
  const specs = validCategorySpecs("mask")
  delete specs.product_application_protocols
  const result = validateProductIntakeApprovalPayload(reviewedPayload("mask", specs))

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.missingFields.includes("final.category_specs.product_application_protocols"))
  }
})

test("multi-role Leave-in requires an exact canonical protocol for every executable role", () => {
  const specs = validCategorySpecs("leave_in")
  specs.product_application_protocols = [exactProtocol("leave_in", "post_wash_leave_in")]

  const result = validateProductIntakeApprovalPayload(reviewedPayload("leave_in", specs))

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(
      result.missingFields.includes("final.category_specs.product_application_protocols.role"),
    )
  }
})

test("treatment-only Shampoo is complete with its derived dandruff protocol", () => {
  const specs = {
    product_shampoo_specs: [
      {
        thickness: "normal",
        shampoo_bucket: "schuppen",
        scalp_route: "dandruff",
        cleansing_intensity: "regular",
      },
    ],
    product_application_protocols: [exactProtocol("shampoo", "shampoo_dandruff")],
  }

  const result = validateProductIntakeApprovalPayload(reviewedPayload("shampoo", specs))

  assert.equal(result.ok, true)
})

test("dual-role Shampoo requires both ordinary and dandruff protocols", () => {
  const categorySpecs = {
    product_shampoo_specs: [
      {
        thickness: "normal",
        shampoo_bucket: "normal",
        scalp_route: "balanced",
        cleansing_intensity: "regular",
      },
      {
        thickness: "normal",
        shampoo_bucket: "schuppen",
        scalp_route: "dandruff",
        cleansing_intensity: "regular",
      },
    ],
  }
  const incomplete = validateProductIntakeApprovalPayload(
    reviewedPayload("shampoo", {
      ...categorySpecs,
      product_application_protocols: [exactProtocol("shampoo", "shampoo_dandruff")],
    }),
  )
  const complete = validateProductIntakeApprovalPayload(
    reviewedPayload("shampoo", {
      ...categorySpecs,
      product_application_protocols: [
        exactProtocol("shampoo", "shampoo_everyday"),
        exactProtocol("shampoo", "shampoo_dandruff"),
      ],
    }),
  )

  assert.equal(incomplete.ok, false)
  if (!incomplete.ok) {
    assert.ok(
      incomplete.missingFields.includes("final.category_specs.product_application_protocols.role"),
    )
  }
  assert.equal(complete.ok, true)
})

test("Shampoo rejects an extra protocol for a role unsupported by its reviewed buckets", () => {
  const specs = {
    product_shampoo_specs: [
      {
        thickness: "normal",
        shampoo_bucket: "schuppen",
        scalp_route: "dandruff",
        cleansing_intensity: "regular",
      },
    ],
    product_application_protocols: [
      exactProtocol("shampoo", "shampoo_dandruff"),
      exactProtocol("shampoo", "shampoo_everyday"),
    ],
  }

  const result = validateProductIntakeApprovalPayload(reviewedPayload("shampoo", specs))

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(
      result.missingFields.includes("final.category_specs.product_application_protocols.role"),
    )
  }
})

test("Mask and Leave-in emit every canonical v3 fact", () => {
  for (const category of ["mask", "leave_in"] as const) {
    const result = validateProductIntakeApprovalPayload(
      reviewedPayload(category, validCategorySpecs(category)),
    )
    assert.equal(result.ok, true)
    if (!result.ok) continue
    const row = result.targetSpecOperations.find(
      (operation) =>
        operation.table === (category === "mask" ? "product_mask_specs" : "product_leave_in_specs"),
    )?.rows[0] as Record<string, unknown>
    assert.ok(row.repair_support_level)
    assert.ok(Array.isArray(row.functional_benefits))
    if (category === "leave_in") {
      assert.ok(row.care_direction)
      assert.ok(Array.isArray(row.plan_roles))
    }
  }
})

test("canonical protocol validation retains the pre-insert placeholder but rejects invalid evidence", () => {
  const specs = validCategorySpecs("mask")
  const protocol = (specs.product_application_protocols as Array<Record<string, unknown>>)[0]!
  const payload = protocol.guidance_payload as Record<string, unknown>
  assert.equal((payload.scope as Record<string, unknown>).productId, PRODUCT_ID_PLACEHOLDER)
  payload.evidence = []

  const result = validateProductIntakeApprovalPayload(reviewedPayload("mask", specs))
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.missingFields.some((field) => field.includes("guidance_payload")))
  }
})

test("heat protectant requires verified tri-state capability and an exact pre-heat protocol", () => {
  const payload = reviewedPayload("heat_protectant" as ProductIntakeReviewCategoryKey, {
    product_heat_protectant_specs: {
      format: "spray",
      provides_heat_protection: null,
    },
    product_application_protocols: [
      {
        category: "heat_protectant",
        role: "pre_heat_protection",
        cadence: { kind: "event" },
        application_stage: "before_heat",
        application_state: "damp",
        placement: "lengths",
        contact_time_seconds: null,
        rinse_action: "leave_in",
        reapplication: "required",
        instruction_modifiers: [],
        source_label: "Hersteller",
        source_url: "https://example.test/instructions",
        source_text: "Vor jedem Hitzestyling anwenden.",
        guidance_payload: exactProtocol("heat_protectant", "pre_heat_protection").guidance_payload,
      },
    ],
  })

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(
    result.targetSpecOperations.map((operation) => operation.table),
    ["product_heat_protectant_specs", "product_application_protocols"],
  )
  assert.deepEqual(result.targetSpecOperations[0]?.rows, [
    { product_id: PRODUCT_ID_PLACEHOLDER, format: "spray", provides_heat_protection: null },
  ])
})

test("scalp care requires an exact role, cosmetic format and product protocol", () => {
  const payload = reviewedPayload("scalp_care" as ProductIntakeReviewCategoryKey, {
    product_scalp_care_specs: {
      primary_role: "scalp_comfort",
      presentation_format: "serum",
      rinse_mode: "leave_on",
      application_instructions: "Scheitelweise auf die Kopfhaut geben.",
    },
    product_application_protocols: [
      {
        category: "scalp_care",
        role: "scalp_comfort",
        cadence: { kind: "as_needed" },
        application_stage: "after_washing",
        application_state: "either",
        placement: "scalp",
        contact_time_seconds: null,
        rinse_action: "leave_in",
        reapplication: "not_stated",
        instruction_modifiers: ["cosmetic_only"],
        source_label: "Hersteller",
        source_url: "https://example.test/instructions",
        source_text: "Bei Bedarf anwenden.",
        guidance_payload: exactProtocol("scalp_care", "scalp_comfort").guidance_payload,
      },
    ],
  })

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(
    result.targetSpecOperations.map((operation) => operation.table),
    ["product_scalp_care_specs", "product_application_protocols"],
  )
  assert.deepEqual(result.targetSpecOperations[0]?.rows, [
    {
      product_id: PRODUCT_ID_PLACEHOLDER,
      primary_role: "scalp_comfort",
      presentation_format: "serum",
      rinse_mode: "leave_on",
      application_instructions: "Scheitelweise auf die Kopfhaut geben.",
    },
  ])
})

test("missing base product fields fail approval validation", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  delete (payload.final.product as Record<string, unknown>).clean_name

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.product.clean_name"))
})

test("missing source evidence fails approval validation", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.sources = []

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.sources"))
})

test("unsupported identifier types fail before approval writes", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.identifiers = [{ type: "upc", value: "123456789012" }]

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.identifiers.0.type"))
})

test("identifiers are optional when reviewed source evidence is complete", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.identifiers = []

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.normalizedPayload.final.identifiers, [])
})

test("null image URL is allowed for an explicit reviewed no-image approval path", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.product.image_url = null as never
  payload.final.field_rationales["product.image_url"] =
    "Reviewer explicitly approved this product without a final image for now."

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.normalizedPayload.final.product.image_url, null)
})

test("barcode-like identifiers are canonicalized before approval writes", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.identifiers = [{ type: "EAN", value: "4006-3813 33931" }]

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.normalizedPayload.final.identifiers, [
    { type: "ean", value: "4006381333931" },
  ])
})

test("field rationales must cover product and category spec conclusions", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  delete payload.final.field_rationales["category_specs.product_mask_specs"]

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(
    result.missingFields.includes("final.field_rationales.category_specs.product_mask_specs"),
  )
})

test("manual review flag is required before approval", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.review.manual_reviewed = false

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.review.manual_reviewed"))
})

test("researched payload parser keeps draft and final JSON payloads", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))

  const parsed = parseProductIntakeResearchedPayload(payload)
  const validated = validateProductIntakeApprovalPayload(payload)

  assert.ok(parsed.ok)
  assert.deepEqual(parsed.payload.draft, payload.draft)
  assert.ok(validated.ok)
  assert.deepEqual(validated.normalizedPayload.draft, payload.draft)
})

test("each supported category emits expected target table operation shapes", () => {
  const expectedTablesByCategory: Record<ProductIntakeReviewCategoryKey, string[]> = {
    shampoo: ["product_shampoo_specs", "product_application_protocols"],
    conditioner: [
      "product_conditioner_specs",
      "product_conditioner_rerank_specs",
      "product_application_protocols",
    ],
    mask: ["product_mask_specs", "product_application_protocols"],
    leave_in: [
      "product_leave_in_specs",
      "product_leave_in_fit_specs",
      "product_leave_in_eligibility",
      "product_application_protocols",
    ],
    oil: ["product_oil_specs", "product_oil_eligibility", "product_application_protocols"],
    dry_shampoo: ["product_dry_shampoo_specs", "product_application_protocols"],
    deep_cleansing_shampoo: [
      "product_deep_cleansing_shampoo_specs",
      "product_application_protocols",
    ],
    bondbuilder: ["product_bondbuilder_specs", "product_application_protocols"],
    heat_protectant: ["product_heat_protectant_specs", "product_application_protocols"],
    scalp_care: ["product_scalp_care_specs", "product_application_protocols"],
  }

  for (const [categoryKey, expectedTables] of Object.entries(expectedTablesByCategory) as Array<
    [ProductIntakeReviewCategoryKey, string[]]
  >) {
    const result = validateProductIntakeApprovalPayload(
      reviewedPayload(categoryKey, validCategorySpecs(categoryKey)),
    )

    assert.equal(result.ok, true, categoryKey)
    assert.deepEqual(
      result.targetSpecOperations.map((operation) => operation.table),
      expectedTables,
    )
    for (const operation of result.targetSpecOperations) {
      assert.equal(operation.type, "upsert")
      assert.ok(operation.rows.length > 0)
      assert.ok(operation.rows.every((row) => row.product_id === PRODUCT_ID_PLACEHOLDER))
      if (operation.table === "product_application_protocols") {
        for (const row of operation.rows) {
          const pointer = row.guidance_payload_v2 as {
            schemaVersion?: unknown
            scope?: { productId?: unknown; category?: unknown }
            sourceRole?: unknown
          }
          assert.equal(pointer.schemaVersion, 2, categoryKey)
          assert.equal(pointer.scope?.productId, PRODUCT_ID_PLACEHOLDER, categoryKey)
          assert.equal(pointer.scope?.category, categoryKey, categoryKey)
          assert.equal(pointer.sourceRole, row.role, categoryKey)
        }
      }
    }
  }
})

test("shampoo rows are emitted without Cartesian guessing", () => {
  const result = validateProductIntakeApprovalPayload(
    reviewedPayload("shampoo", validCategorySpecs("shampoo")),
  )

  assert.equal(result.ok, true)
  assert.deepEqual(result.targetSpecOperations[0]?.rows, [
    {
      product_id: PRODUCT_ID_PLACEHOLDER,
      thickness: "fine",
      shampoo_bucket: "normal",
      scalp_route: "balanced",
      cleansing_intensity: "regular",
    },
    {
      product_id: PRODUCT_ID_PLACEHOLDER,
      thickness: "normal",
      shampoo_bucket: "trocken",
      scalp_route: "dry",
      cleansing_intensity: "gentle",
    },
  ])
})

test("bondbuilder product relationships are optional and do not block approval", () => {
  const specs = {
    ...validCategorySpecs("bondbuilder"),
    product_relationships: [],
  }

  const result = validateProductIntakeApprovalPayload(reviewedPayload("bondbuilder", specs))

  assert.equal(result.ok, true)
  assert.deepEqual(
    result.targetSpecOperations.map((operation) => operation.table),
    ["product_bondbuilder_specs", "product_application_protocols"],
  )
})

test("incomplete multi-row category specs fail", () => {
  const cases = [
    reviewedPayload("shampoo", { product_shampoo_specs: [{ thickness: "fine" }] }),
    reviewedPayload("oil", { product_oil_eligibility: [{ thickness: "fine" }] }),
    reviewedPayload("leave_in", {
      ...validCategorySpecs("leave_in"),
      product_leave_in_eligibility: [{ thickness: "fine", need_bucket: "heat_protect" }],
    }),
  ]

  for (const payload of cases) {
    const result = validateProductIntakeApprovalPayload(payload)
    assert.equal(result.ok, false)
    assert.ok(result.missingFields.some((field) => field.startsWith("final.category_specs.")))
  }
})

test("ready-for-review dry run only passes when approval validator passes", () => {
  const valid = dryRunProductIntakeReadyForReview({
    id: "submission-1",
    category: "dry_shampoo",
    researched_payload: reviewedPayload("dry_shampoo", validCategorySpecs("dry_shampoo")),
  })

  assert.equal(valid.ok, true)
  assert.equal(valid.status, "ready_for_review")

  const invalid = dryRunProductIntakeReadyForReview({
    id: "submission-2",
    category: "dry_shampoo",
    researched_payload: reviewedPayload("dry_shampoo", {}),
  })

  assert.equal(invalid.ok, false)
  assert.equal(invalid.status, "needs_more_info")
})
