import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { readReviewPackage } from "../scripts/product-intake/review-app"

import {
  validateProductIntakeApprovalPayload,
  type ProductIntakeReviewCategoryKey,
} from "../src/lib/product-intake/category-validators"
import { dryRunProductIntakeReadyForReview } from "../src/lib/product-intake/review-workflow"
import { validateBondbuilderOwnerSubmissionApproval } from "../src/lib/product-intake/review-workflow"
import {
  approveReviewedSubmission,
  dryRunResearchedPayload,
  saveResearchedPayload,
  validateSubmissionReady,
} from "../scripts/product-intake/review-actions"
import {
  makeBondbuilderProfile,
  sealProfile,
  unknownFact,
} from "./fixtures/bondbuilder-research/profile"
import { BOND_DEFAULT_POLICY } from "../src/lib/bondbuilder-research/registry"
import type { ProductSubmission } from "../src/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

const PRODUCT_ID_PLACEHOLDER = "__PRODUCT_ID__"

test("review preview derives held owner readiness from stored submission context", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "owner-bondbuilder-preview-"))
  try {
    const submission = ownerBondbuilderSubmission()
    const packagePath = join(rootDir, "ops", "product-intake-research", "2026-10-02", submission.id)
    await mkdir(packagePath, { recursive: true })
    await writeFile(
      join(packagePath, "payload.json"),
      JSON.stringify(submission.researched_payload),
    )
    await writeFile(join(packagePath, "submission.json"), JSON.stringify(submission))
    const ready = await readReviewPackage({ rootDir, packagePath })
    assert.equal((ready.validation as { ok: boolean }).ok, true)
    await writeFile(
      join(packagePath, "submission.json"),
      JSON.stringify({ ...submission, source: "admin" }),
    )
    const denied = await readReviewPackage({ rootDir, packagePath })
    assert.equal((denied.validation as { ok: boolean }).ok, false)
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
})

function ownerBondbuilderSubmission() {
  const profile = makeBondbuilderProfile()
  profile.identity.product_name = "Fixture Brand Source-bound Treatment"
  profile.identity.brand = "Fixture Brand"
  profile.assessment.claim_trust_level = "low"
  profile.assessment.trust_basis = "owner_default"
  profile.assessment.policy_reference = BOND_DEFAULT_POLICY
  profile.application.application_area = unknownFact()
  profile.holds.protocol = [
    {
      code: "missing_application_area",
      reason: "Selected producer source does not specify application area.",
      field: "application.application_area",
      source_ids: [],
    },
  ]
  sealProfile(profile)
  const payload = reviewedPayload("bondbuilder", {
    product_bondbuilder_specs: {
      technology_family: profile.assessment.technology_family,
      claim_trust_level: "low",
      trust_basis: "owner_default",
      research_profile: profile,
      usage_protocol: null,
    },
  })
  payload.final.product.canonical_brand = profile.identity.brand
  payload.final.product.clean_name = "Source-bound Treatment"
  payload.final.product.image_url = null as never
  payload.final.sources = profile.sources.map((source) => ({
    url: source.url,
    title: "Selected inspected producer source",
    evidence: source.observation,
  }))
  return {
    id: "50000000-0000-4000-8000-000000000001",
    user_id: "50000000-0000-4000-8000-000000000002",
    source: "chat",
    category: "bondbuilder",
    status: "researching",
    researched_payload: payload,
    updated_at: "2026-10-02T12:00:00Z",
  } as unknown as ProductSubmission
}

test("held low Bondbuilder research becomes owner-ready and routes only its validated payload to the owner RPC", async () => {
  const submission = ownerBondbuilderSubmission()
  const normal = dryRunProductIntakeReadyForReview({
    id: submission.id,
    category: "bondbuilder",
    researched_payload: submission.researched_payload,
  })
  const research = dryRunResearchedPayload({
    submission,
    researchedPayload: submission.researched_payload as never,
    markReady: true,
  })
  assert.equal(research.next_status, "ready_for_review")
  const updates: unknown[] = []
  const filters: unknown[] = []
  const query = {
    update: (value: unknown) => {
      updates.push(value)
      return query
    },
    eq: (key: string, value: unknown) => {
      filters.push([key, value])
      return query
    },
    in: (key: string, value: unknown) => {
      filters.push([key, value])
      return query
    },
    select: () => query,
    single: async () => ({ data: { id: submission.id }, error: null }),
  }
  await saveResearchedPayload({
    supabase: {
      from: (table: string) => {
        assert.equal(table, "product_submissions")
        return query
      },
    } as unknown as SupabaseClient,
    submission,
    researchedPayload: submission.researched_payload as never,
    markReady: true,
    now: () => new Date("2026-10-02T12:01:00Z"),
  })
  assert.deepEqual(updates, [
    {
      researched_payload: submission.researched_payload,
      status: "ready_for_review",
      updated_at: "2026-10-02T12:01:00.000Z",
    },
  ])
  assert.ok(
    filters.some(
      (value) => JSON.stringify(value) === JSON.stringify(["updated_at", submission.updated_at]),
    ),
  )
  const ready = { ...submission, status: "ready_for_review" as const }
  const selected = validateSubmissionReady(ready)
  assert.equal(selected.ok, true)
  if (!selected.ok) return
  const admission = validateBondbuilderOwnerSubmissionApproval(ready)
  if (admission.ok) assert.equal(admission.global_recommendation_ready, false)
  assert.deepEqual(
    selected.targetSpecOperations.map((op) => op.table),
    ["product_bondbuilder_specs"],
  )
  const calls: Array<{ name: string; args: unknown }> = []
  const supabase = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args })
      return { data: { product_id: "created-product" }, error: null }
    },
  } as unknown as SupabaseClient
  const params = {
    supabase,
    submission: ready,
    finalPayload: selected.normalizedPayload.final,
    specOperations: selected.targetSpecOperations,
    reviewedBy: "reviewer",
    reviewedAt: "2026-10-02T12:30:00Z",
    reviewNotes: null,
  }
  await approveReviewedSubmission(params)
  assert.equal(calls[0]?.name, "product_intake_approve_bondbuilder_owner_v1")
  assert.equal(admission.ok, true)
  assert.equal(
    normal.ok,
    false,
    "No stored owner context must retain ordinary protocol requirements",
  )
  assert.deepEqual(calls[0]?.args, {
    p_submission_id: ready.id,
    p_owner_user_id: ready.user_id,
    p_final_payload: selected.normalizedPayload.final,
    p_spec_operations: selected.targetSpecOperations,
    p_reviewed_by: params.reviewedBy,
    p_reviewed_at: params.reviewedAt,
    p_review_notes: null,
  })
  await assert.rejects(
    approveReviewedSubmission({
      ...params,
      finalPayload: {
        ...params.finalPayload,
        product: { ...params.finalPayload.product, clean_name: "Caller replacement" },
      },
    }),
    /mismatch|does not match/i,
  )
  await assert.rejects(
    approveReviewedSubmission({ ...params, specOperations: [] }),
    /mismatch|does not match/i,
  )
  assert.equal(calls.length, 1)
})

test("owner readiness rejects missing owners, unrelated sources, high grades, forged profiles and executable selectors", () => {
  for (const mutate of [
    (s: ProductSubmission) => {
      Object.assign(s, { user_id: null })
    },
    (s: ProductSubmission) => {
      s.source = "admin" as never
    },
    (s: ProductSubmission) => {
      s.status = "approved"
    },
    (s: ProductSubmission) => {
      const specs = (s.researched_payload as ReturnType<typeof reviewedPayload>).final
        .category_specs.product_bondbuilder_specs as Record<string, unknown>
      specs.claim_trust_level = "high"
    },
    (s: ProductSubmission) => {
      const p = (
        (s.researched_payload as ReturnType<typeof reviewedPayload>).final.category_specs
          .product_bondbuilder_specs as {
          research_profile: ReturnType<typeof makeBondbuilderProfile>
        }
      ).research_profile
      p.explanations_de.concise = "Unsealed replacement"
    },
    (s: ProductSubmission) => {
      ;(
        (s.researched_payload as ReturnType<typeof reviewedPayload>).final.category_specs
          .product_bondbuilder_specs as Record<string, unknown>
      ).usage_protocol = "verified_product_protocol"
    },
    (s: ProductSubmission) => {
      ;(s.researched_payload as ReturnType<typeof reviewedPayload>).final.sources = []
    },
  ]) {
    const submission = ownerBondbuilderSubmission()
    submission.status = "ready_for_review"
    mutate(submission)
    assert.equal(
      dryRunResearchedPayload({
        submission,
        researchedPayload: submission.researched_payload as never,
        markReady: true,
      }).next_status,
      "researching",
    )
    assert.equal(validateBondbuilderOwnerSubmissionApproval(submission).ok, false)
  }
})

test("missing exact protocol remains explicit even when researcher omitted a redundant holds entry", () => {
  const submission = ownerBondbuilderSubmission()
  const profile = (
    (submission.researched_payload as ReturnType<typeof reviewedPayload>).final.category_specs
      .product_bondbuilder_specs as { research_profile: ReturnType<typeof makeBondbuilderProfile> }
  ).research_profile
  profile.holds.protocol = []
  sealProfile(profile)
  assert.equal(
    dryRunResearchedPayload({
      submission,
      researchedPayload: submission.researched_payload as never,
      markReady: true,
    }).next_status,
    "ready_for_review",
  )
  const admission = validateBondbuilderOwnerSubmissionApproval({
    ...submission,
    status: "ready_for_review",
  })
  assert.equal(admission.ok, true)
  if (admission.ok) assert.equal(admission.protocolHold, "exact_product_protocol_unavailable")
})

test("all trusted owner sources support open research while a valid high owner profile cannot use the exception", () => {
  for (const source of ["chat", "onboarding", "personal_plan"] as const) {
    for (const status of [
      "pending_review",
      "researching",
      "needs_more_info",
      "ready_for_review",
    ] as const) {
      const submission = { ...ownerBondbuilderSubmission(), source, status }
      assert.equal(
        dryRunResearchedPayload({
          submission,
          researchedPayload: submission.researched_payload as never,
          markReady: true,
        }).next_status,
        "ready_for_review",
        source + ":" + status,
      )
    }
  }
  const submission = ownerBondbuilderSubmission()
  const payload = submission.researched_payload as ReturnType<typeof reviewedPayload>
  const high = makeBondbuilderProfile()
  payload.final.category_specs.product_bondbuilder_specs = {
    technology_family: high.assessment.technology_family,
    claim_trust_level: high.assessment.claim_trust_level,
    trust_basis: high.assessment.trust_basis,
    research_profile: high,
    usage_protocol: null,
  }
  payload.final.product.canonical_brand = high.identity.brand
  payload.final.product.clean_name = high.identity.product_name
    .slice(high.identity.brand.length)
    .trim()
  assert.equal(
    dryRunResearchedPayload({ submission, researchedPayload: payload, markReady: true })
      .next_status,
    "researching",
  )
  assert.equal(
    validateBondbuilderOwnerSubmissionApproval({ ...submission, status: "ready_for_review" }).ok,
    false,
  )
})

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
          provides_heat_protection: false,
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

test("heat-capable Oil keeps heat as a binary and requires only its leave-on protocol", () => {
  const specs = validCategorySpecs("oil")
  const oilSpecs = specs.product_oil_specs as {
    provides_heat_protection: boolean
    role_support: string[]
  }
  oilSpecs.provides_heat_protection = true
  oilSpecs.role_support = ["leave_on_fibre_conditioning"]
  specs.product_application_protocols = [exactProtocol("oil", "leave_on_fibre_conditioning")]

  const result = validateProductIntakeApprovalPayload(reviewedPayload("oil", specs))

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(
    result.targetSpecOperations.find((operation) => operation.table === "product_oil_specs")
      ?.rows[0],
    {
      product_id: PRODUCT_ID_PLACEHOLDER,
      weight: "light",
      role_support: ["leave_on_fibre_conditioning"],
      provides_heat_protection: true,
    },
  )
  assert.deepEqual(
    result.targetSpecOperations
      .find((operation) => operation.table === "product_application_protocols")
      ?.rows.map((row) => (row as { role: string }).role),
    ["leave_on_fibre_conditioning"],
  )
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
    const payload = reviewedPayload(category, validCategorySpecs(category))
    const result = validateProductIntakeApprovalPayload(payload)
    assert.equal(result.ok, true)
    if (!result.ok) continue
    if (category === "mask") {
      assert.deepEqual(result.normalizedPayload.draft, payload.draft)
    }
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

test("market segment is optional in the reviewed package and needs a rationale only when present", () => {
  const without = validateProductIntakeApprovalPayload(
    reviewedPayload("mask", validCategorySpecs("mask")),
  )
  assert.equal(without.ok, true)

  const withSegment = reviewedPayload("mask", validCategorySpecs("mask"))
  ;(withSegment.final.product as Record<string, unknown>).market_segment = "professional"
  const missingRationale = validateProductIntakeApprovalPayload(withSegment)
  assert.equal(missingRationale.ok, false)
  assert.deepEqual(missingRationale.missingFields, [
    "final.field_rationales.product.market_segment",
  ])

  withSegment.final.field_rationales["product.market_segment"] =
    "Sold through professional salon channels only."
  const accepted = validateProductIntakeApprovalPayload(withSegment)
  assert.equal(accepted.ok, true)
  if (!accepted.ok) return
  assert.equal(accepted.normalizedPayload.final.product.market_segment, "professional")

  const invalid = reviewedPayload("mask", validCategorySpecs("mask"))
  ;(invalid.final.product as Record<string, unknown>).market_segment = "luxury"
  assert.equal(validateProductIntakeApprovalPayload(invalid).ok, false)
})

test("manual review flag is required before approval", () => {
  const payload = reviewedPayload("mask", validCategorySpecs("mask"))
  payload.final.review.manual_reviewed = false

  const result = validateProductIntakeApprovalPayload(payload)

  assert.equal(result.ok, false)
  assert.ok(result.missingFields.includes("final.review.manual_reviewed"))
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
