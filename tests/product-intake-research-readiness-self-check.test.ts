import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  completeResearchPass,
  normalizeResearchOutputForCategory,
  type BrandResolutionPromptContext,
} from "../scripts/product-intake/codex-research-worker"
import { checkResearchReadiness } from "../src/lib/product-intake/research-readiness-self-check"
import { dryRunProductIntakeReadyForReview } from "../src/lib/product-intake/review-workflow"
import {
  makeBondbuilderProfile,
  sealProfile,
  unknownFact,
} from "./fixtures/bondbuilder-research/profile"
import { BOND_DEFAULT_POLICY } from "../src/lib/bondbuilder-research/registry"
import type { JsonRecord, ProductIntakeResearchJob } from "@chaarlie/product-intake-core"

function completePayload() {
  const specs = {
    product_mask_specs: {
      weight: "medium",
      concentration: "high",
      balance_direction: "moisture",
      ingredient_flags: ["humectants"],
      repair_support_level: "medium",
      functional_benefits: ["shine"],
    },
    product_application_protocols: [
      {
        category: "mask",
        role: "intensive_conditioning_mask",
        cadence: null,
        application_stage: "after_shampoo",
        application_state: "damp",
        placement: "lengths_ends",
        contact_time_seconds: 180,
        rinse_action: "rinse_out",
        reapplication: "not_stated",
        instruction_modifiers: [],
        source_label: "Hersteller",
        source_url: "https://example.test/product",
        source_text: "In die Längen geben, drei Minuten einwirken lassen und ausspülen.",
        guidance_payload: {
          schemaVersion: 1,
          guidanceKey: "fixture-mask",
          protocolVersion: 1,
          locale: "de",
          scope: { kind: "product", category: "mask", productId: "__PRODUCT_ID__" },
          role: "intensive_care",
          applicationFamily: "post_shampoo_rinse_out_mask",
          compatibleDayTypes: ["wash_day"],
          exactGuidanceRequired: true,
          sequence: { anchor: "post_cleanse_rinse_off", before: [], after: [], conflictsWith: [] },
          requirements: {
            requiredCatalogFacts: [],
            requiredProtocolFacts: [],
            requiredProfileFacts: [],
          },
          protocolFacts: {
            applicationArea: "lengths_ends",
            rinse: "rinse_out",
            contactTimeSeconds: 180,
            conditionerRelationship: "replaces_conditioner",
            reapplication: "none",
            amount: null,
            cautions: [],
          },
          steps: [
            { stepKey: "apply", action: "apply_product", copyTemplateDe: "In die Längen geben." },
            { stepKey: "wait", action: "wait", copyTemplateDe: "Drei Minuten einwirken lassen." },
            { stepKey: "rinse", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
          ],
          evidence: [
            {
              sourceUrl: "https://example.test/product",
              sourceType: "manufacturer",
              checkedAt: "2026-10-05",
            },
          ],
        },
      },
    ],
  }
  return {
    final: {
      product: {
        canonical_brand: "Fixture",
        clean_name: "Pflegemaske",
        category_key: "mask",
        affiliate_link: "https://example.test/product",
        image_url: null,
        price_eur: 9.95,
        currency: "EUR",
        purchase_link_status: "available",
        purchase_link_checked_at: "2026-10-05T12:00:00Z",
        price_checked_at: "2026-10-05T12:00:00Z",
      },
      category_specs: specs as JsonRecord,
      sources: [
        { url: "https://example.test/product", title: "Hersteller", evidence: "Anleitung." },
      ],
      field_rationales: Object.fromEntries(
        [
          "product.canonical_brand",
          "product.clean_name",
          "product.category_key",
          "product.affiliate_link",
          "product.image_url",
          "product.price_eur",
          "product.purchase_link_status",
          ...Object.keys(specs).map((table) => `category_specs.${table}`),
        ].map((path) => [path, "Durch Herstellerquelle belegt."]),
      ),
      review: { manual_reviewed: false },
    },
  }
}

test("manual approval and final image metadata do not hide empty category specs", () => {
  const payload = completePayload()
  payload.final.category_specs = {}
  Object.assign(payload.final.product, {
    image_url: "upload-pending",
    canonical_image_sha256: "pending",
    thumbnail_image_url: "pending",
  })
  Object.assign(payload.final.review, { reviewed_by: "", reviewed_at: "pending", notes: "" })
  const result = checkResearchReadiness(payload, "mask")
  assert.equal(result.ok, false)
  assert.deepEqual(result.researchGaps, [
    "final.category_specs.product_mask_specs",
    "final.category_specs.product_application_protocols",
  ])
  for (const path of [
    "final.review.manual_reviewed",
    "final.review.reviewed_by",
    "final.review.reviewed_at",
    "final.review.notes",
    "final.product.image_url",
    "final.product.canonical_image_sha256",
    "final.product.thumbnail_image_url",
  ])
    assert.ok(result.humanGateFields.includes(path), path)
})

test("research-ready payload may await the entire review block and final image upload without mutation", () => {
  const payload: JsonRecord = completePayload()
  const final = payload.final as JsonRecord
  delete final.review
  delete (final.product as JsonRecord).image_url
  const before = structuredClone(payload)
  const result = checkResearchReadiness(payload, "mask")
  assert.equal(result.ok, true, result.researchGaps.join(", "))
  assert.deepEqual(result.researchGaps, [])
  assert.deepEqual(result.humanGateFields, ["final.product.image_url", "final.review"])
  assert.deepEqual(payload, before)
})

test("commerce, source evidence, category identity and rationales remain research responsibilities", () => {
  const minimal = checkResearchReadiness({ final: { product: {}, category_specs: {} } }, "mask")
  for (const path of [
    "final.product.price_eur",
    "final.product.affiliate_link",
    "final.sources",
    "final.field_rationales",
  ])
    assert.ok(minimal.researchGaps.includes(path), path)
  assert.ok(!minimal.researchGaps.some((path) => path.startsWith("final.review")))

  const payload = completePayload()
  delete payload.final.field_rationales["product.image_url"]
  assert.deepEqual(checkResearchReadiness(payload, "mask").researchGaps, [
    "final.field_rationales.product.image_url",
  ])
  assert.ok(
    checkResearchReadiness(completePayload(), "oil").researchGaps.includes(
      "final.product.category_key",
    ),
  )
})

test("draft engine markers are provenance, while strict final markers and protocol shape errors remain gaps", () => {
  for (const state of ["pending_lock", "engine_not_available"]) {
    const payload = completePayload()
    Object.assign(payload, { draft: { engine: { state } } })
    assert.equal(checkResearchReadiness(payload, "mask").ok, true)
    const invalidFinal = structuredClone(payload)
    Object.assign(invalidFinal.final, { engine: { state } })
    assert.deepEqual(checkResearchReadiness(invalidFinal, "mask").researchGaps, ["final"])
    const protocols = payload.final.category_specs.product_application_protocols as JsonRecord[]
    protocols[0]!.contact_time_seconds = { min: 180, max: 300 }
    assert.ok(
      checkResearchReadiness(payload, "mask").researchGaps.includes(
        "final.category_specs.product_application_protocols.0.contact_time_seconds",
      ),
    )
  }
})

function job(stage: ProductIntakeResearchJob["stage"]): ProductIntakeResearchJob {
  return {
    id: "job-readiness",
    submission_id: "submission-readiness",
    status: "running",
    stage,
    priority: 0,
    attempt_count: 1,
    max_attempts: 3,
    next_run_at: "2026-10-05T12:00:00Z",
    started_at: "2026-10-05T12:00:00Z",
    completed_at: null,
    locked_by: "worker-readiness",
    locked_at: "2026-10-05T12:00:00Z",
    last_error: null,
    progress: {
      engine_key: "preserved",
      readiness_check: "passed",
      readiness_missing_fields: ["stale"],
    },
    created_at: "2026-10-05T12:00:00Z",
    updated_at: "2026-10-05T12:00:00Z",
  }
}

async function finish(
  payload: JsonRecord,
  options: {
    stage?: ProductIntakeResearchJob["stage"]
    blockers?: string[]
    autoPrepareImages?: boolean
    submission?: {
      id: string
      user_id: string | null
      source: string
      status: string
      category: "mask" | "shampoo" | "bondbuilder"
    }
    progress?: JsonRecord
    refreshDuringEvaluation?: boolean
  } = {},
) {
  const initialJob = job(options.stage ?? "property_research")
  if (options.progress) initialJob.progress = { ...initialJob.progress, ...options.progress }
  const submission = options.submission ?? {
    id: initialJob.submission_id,
    user_id: null,
    source: "admin",
    status: "researching",
    category: "mask",
  }
  initialJob.submission_id = submission.id
  const submissionWrites: JsonRecord[] = []
  const jobWrites: JsonRecord[] = []
  const client = {
    from: (table: string) => {
      assert.ok(["product_submissions", "product_intake_review_decisions"].includes(table), table)
      const query = {
        update: (write: JsonRecord) => {
          if (table === "product_submissions") submissionWrites.push(write)
          return query
        },
        eq: () => query,
        in: () => query,
        is: () => query,
        select: () => query,
        single: async () => ({
          data: { id: initialJob.submission_id, status: submissionWrites.at(-1)!.status },
          error: null,
        }),
        maybeSingle: async () => ({ data: { user_id: submission.user_id }, error: null }),
        then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
      }
      return query
    },
    rpc: async (name: string, args: JsonRecord) => {
      assert.equal(name, "product_intake_update_research_job")
      jobWrites.push(args)
      return {
        data: {
          ...initialJob,
          status: args.next_status,
          stage: args.next_stage,
          progress: args.next_progress,
          last_error: args.next_last_error,
        },
        error: null,
      }
    },
  }
  const output = await completeResearchPass({
    supabase: client as unknown as Parameters<typeof completeResearchPass>[0]["supabase"],
    job: initialJob,
    category: submission.category,
    submission,
    workerId: initialJob.locked_by!,
    promptPacketPath: "/tmp/packet.json",
    researchOutput: {
      summary: "Recherche fertig",
      artifacts: [],
      blockers: options.blockers ?? [],
      researched_payload: payload,
    },
    researchModel: "fixture",
    executeCodex: true,
    autoPrepareImages: options.autoPrepareImages ?? false,
    ...(options.refreshDuringEvaluation
      ? {
          beforeCompletion: async () => {
            initialJob.progress.message = "Lease refreshed after optional evaluation"
            return {
              job: initialJob,
              modelEvaluation: {
                status: "disabled" as const,
                successfulJudgments: 0,
                targetSuccessfulJudgments: 0,
              },
            }
          },
        }
      : {}),
  })
  return { output, submissionWrites, jobWrites }
}

test("research and rework with empty specs block the job and keep the submission researching", async () => {
  for (const stage of ["property_research", "rework"] as const) {
    const payload = completePayload()
    payload.final.category_specs = { product_mask_specs: [], product_application_protocols: [] }
    const { output, submissionWrites, jobWrites } = await finish(payload, { stage })
    assert.equal(output.status, "blocked", stage)
    assert.equal(
      output.last_error,
      "Katalog-Prüfung: 2 Pflichtfelder fehlen: final.category_specs.product_mask_specs, final.category_specs.product_application_protocols",
    )
    assert.equal(output.progress?.readiness_check, "failed")
    assert.deepEqual(output.progress?.readiness_missing_fields, [
      "final.category_specs.product_mask_specs",
      "final.category_specs.product_application_protocols",
    ])
    assert.equal(submissionWrites[0]!.status, "researching")
    assert.deepEqual(submissionWrites[0]!.researched_payload, payload)
    assert.equal(jobWrites[0]!.expected_locked_by, "worker-readiness")
    assert.equal(jobWrites[0]!.expected_locked_at, "2026-10-05T12:00:00Z")
    assert.equal(output.progress?.engine_key, "preserved")
  }
})

test("complete research proceeds to review with passed readiness and clears stale gaps", async () => {
  const { output, submissionWrites } = await finish(completePayload())
  assert.equal(output.status, "waiting_for_review")
  assert.equal(output.last_error, null)
  assert.equal(output.progress?.readiness_check, "passed")
  assert.deepEqual(output.progress?.readiness_missing_fields, [])
  assert.equal(submissionWrites[0]!.status, "ready_for_review")
})

test("model blockers keep their existing error and status without a readiness verdict", async () => {
  const payload = completePayload()
  payload.final.category_specs = {}
  const { output, submissionWrites } = await finish(payload, {
    blockers: ["Quellen widersprechen sich."],
  })
  assert.equal(output.status, "blocked")
  assert.equal(output.last_error, "Quellen widersprechen sich.")
  assert.equal(output.progress?.readiness_check, undefined)
  assert.equal(output.progress?.readiness_missing_fields, undefined)
  assert.equal(submissionWrites[0]!.status, "researching")
})

function ownerBondbuilderPayload(): JsonRecord {
  const profile = makeBondbuilderProfile()
  profile.identity.product_name = "Fixture Source-bound Treatment"
  profile.identity.brand = "Fixture"
  profile.assessment.claim_trust_level = "low"
  profile.assessment.trust_basis = "owner_default"
  profile.assessment.policy_reference = BOND_DEFAULT_POLICY
  profile.application.application_area = unknownFact()
  profile.holds.protocol = [
    {
      code: "missing_application_area",
      reason: "Producer does not specify application area.",
      field: "application.application_area",
      source_ids: [],
    },
  ]
  sealProfile(profile)
  const payload = completePayload()
  Object.assign(payload.final.product, {
    category_key: "bondbuilder",
    clean_name: "Source-bound Treatment",
  })
  payload.final.category_specs = {
    product_bondbuilder_specs: {
      technology_family: profile.assessment.technology_family,
      claim_trust_level: "low",
      trust_basis: "owner_default",
      research_profile: profile,
      usage_protocol: null,
    },
  }
  payload.final.sources = profile.sources.map((source) => ({
    url: source.url,
    title: "Inspected producer source",
    evidence: source.observation,
  }))
  payload.final.field_rationales = Object.fromEntries(
    [
      "product.canonical_brand",
      "product.clean_name",
      "product.category_key",
      "product.affiliate_link",
      "product.image_url",
      "product.price_eur",
      "product.purchase_link_status",
      "category_specs.product_bondbuilder_specs",
    ].map((key) => [key, "Supported by selected producer evidence."]),
  )
  return payload
}

test("owner-held Bondbuilder readiness uses stored ownership and agrees with the review flow", async () => {
  for (const source of ["personal_plan", "chat"]) {
    const submission = {
      id: "50000000-0000-4000-8000-000000000001",
      user_id: "50000000-0000-4000-8000-000000000002",
      source,
      status: "researching",
      category: "bondbuilder" as const,
    }
    const payload = ownerBondbuilderPayload()
    const reviewed = structuredClone(payload)
    Object.assign((reviewed.final as JsonRecord).review as JsonRecord, { manual_reviewed: true })
    assert.equal(
      dryRunProductIntakeReadyForReview({ ...submission, researched_payload: reviewed }).ok,
      true,
    )
    const before = structuredClone(payload)
    const selfCheck = checkResearchReadiness(payload, "bondbuilder", submission)
    assert.equal(selfCheck.ok, true, selfCheck.researchGaps.join(", "))
    assert.ok(selfCheck.humanGateFields.includes("final.review.manual_reviewed"))
    assert.deepEqual(payload, before)
    const { output, submissionWrites } = await finish(payload, { submission })
    assert.equal(output.status, "waiting_for_review")
    assert.equal(submissionWrites[0]!.status, "ready_for_review")
    for (const denied of [
      { ...submission, user_id: null },
      { ...submission, user_id: "not-an-owner-uuid" },
      { ...submission, source: "admin" },
      { ...submission, status: "approved" },
    ]) {
      assert.equal(
        dryRunProductIntakeReadyForReview({ ...denied, researched_payload: reviewed }).ok,
        false,
      )
      const { output } = await finish(payload, { submission: denied })
      assert.equal(output.status, "blocked", JSON.stringify(denied))
      assert.equal(output.progress?.readiness_check, "failed")
    }
  }
})

const brandContext: BrandResolutionPromptContext = {
  submitted_brand_text: null,
  submitted_product_name_text: null,
  scanned_identifier: null,
  lookup_text: "",
  resolved_brand: null,
  nearby_brand_options: [],
  catalog_summary: {},
  rules: [],
}

test("persisted pending-lock Shampoo and unavailable Mask payloads pass the strict review entry point", async () => {
  for (const category of ["shampoo", "mask"] as const) {
    const payload = completePayload()
    Object.assign(payload.final.product, {
      category_key: category,
      suitable_thicknesses: ["fine"],
      image_url: "https://example.test/product.jpg",
    })
    if (category === "shampoo") {
      payload.final.category_specs = {
        product_shampoo_specs: [
          {
            thickness: "fine",
            shampoo_bucket: "normal",
            scalp_route: "balanced",
            cleansing_intensity: "regular",
          },
        ],
        product_application_protocols: [
          {
            category: "shampoo",
            role: "shampoo_everyday",
            cadence: null,
            application_stage: "fixture_stage",
            application_state: "either",
            placement: "fixture_area",
            contact_time_seconds: null,
            rinse_action: "fixture_action",
            reapplication: "not_stated",
            instruction_modifiers: [],
            source_label: "Hersteller",
            source_url: "https://example.test/product",
            source_text: "Exakte Herstelleranleitung.",
            guidance_payload: {
              schemaVersion: 1,
              guidanceKey: "fixture-shampoo",
              protocolVersion: 1,
              locale: "de",
              scope: { kind: "product", category: "shampoo", productId: "__PRODUCT_ID__" },
              role: "cleanse",
              applicationFamily: "standard_rinse_out_cleanse",
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
                  sourceUrl: "https://example.test/product",
                  sourceType: "manufacturer",
                  checkedAt: "2026-10-05",
                },
              ],
            },
          },
        ],
      }
      delete payload.final.field_rationales["category_specs.product_mask_specs"]
      payload.final.field_rationales["category_specs.product_shampoo_specs"] =
        "Durch Herstellerquelle belegt."
    }
    // Templated categories get Chaarlie-stamped protocol rows from sourced draft slots.
    ;(payload as JsonRecord).draft = {
      protocol: {
        evidence: [
          {
            sourceText: "In die Längen geben und ausspülen.",
            sourceUrl: "https://example.test/product",
            sourceType: "manufacturer",
            checkedAt: "2026-10-05",
          },
        ],
      },
    }
    const normalized = normalizeResearchOutputForCategory(
      {
        summary: "Recherche fertig",
        blockers: [],
        artifacts: [],
        researched_payload: payload,
      },
      category,
      brandContext,
      [],
      "submission-readiness",
    )
    assert.deepEqual(normalized.blockers, [])
    const submission = {
      id: "submission-readiness",
      user_id: null,
      source: "admin",
      status: "researching",
      category,
    }
    const { submissionWrites } = await finish(normalized.researched_payload!, { submission })
    const persisted = structuredClone(submissionWrites[0]!.researched_payload) as JsonRecord
    Object.assign((persisted.final as JsonRecord).review as JsonRecord, { manual_reviewed: true })
    const reviewed = dryRunProductIntakeReadyForReview({
      ...submission,
      researched_payload: persisted,
    })
    assert.equal(reviewed.ok, true, `${category}: ${reviewed.missingFields.join(", ")}`)
  }
})

test("completed rework retires its request metadata and retains a receipt for ready and blocked outcomes", async () => {
  const request = {
    requested_by: "reviewer",
    requested_at: "2026-10-06T12:00:00Z",
    rework_type: "property",
    message: "Fix source evidence",
  }
  for (const blockers of [[], ["Still missing a source"]]) {
    const { output } = await finish(completePayload(), {
      stage: "rework",
      progress: request,
      blockers,
    })
    for (const key of ["requested_by", "requested_at", "rework_type"])
      assert.equal(output.progress?.[key], undefined, key)
    assert.notEqual(output.progress?.message, request.message)
    assert.deepEqual(output.progress?.last_rework_request, request)
    assert.equal(output.progress?.engine_key, "preserved")
  }
})

test("completed rework receipts keep the consumed reviewer message across a lease refresh", async () => {
  const request = {
    requested_by: "reviewer",
    requested_at: "2026-10-06T12:00:00Z",
    rework_type: "property",
    message: "Fix source evidence",
  }
  const { output } = await finish(completePayload(), {
    stage: "rework",
    progress: request,
    refreshDuringEvaluation: true,
  })
  assert.deepEqual(output.progress?.last_rework_request, request)
})

test("catalog gaps block auto image preparation; complete research still queues images", async () => {
  const payload = completePayload()
  payload.final.category_specs = {}
  assert.equal((await finish(payload, { autoPrepareImages: true })).output.status, "blocked")
  Object.assign(payload.final.product, { image_url: "https://example.test/packshot.jpg" })
  payload.final.category_specs = completePayload().final.category_specs
  const { output } = await finish(payload, { autoPrepareImages: true })
  assert.equal(output.status, "queued")
  assert.equal(output.stage, "image_judging")
  assert.equal(output.progress?.readiness_check, "passed")
})

test("captured ready mask with legacy protocol produces bounded German summary and full diagnostics", async () => {
  const captures = JSON.parse(
    readFileSync(
      new URL("./fixtures/product-intake-router/real-production-outputs.json", import.meta.url),
      "utf8",
    ),
  ) as {
    cases: Array<{
      category: string
      output: { blockers: string[]; researched_payload: JsonRecord }
    }>
  }
  const capture = captures.cases.find(
    (entry) => entry.category === "mask" && entry.output.blockers.length === 0,
  )
  assert.ok(capture, "real ready mask capture")
  const { output } = await finish(capture.output.researched_payload)
  assert.equal(output.status, "blocked")
  const gaps = output.progress?.readiness_missing_fields as string[]
  assert.ok(gaps.length > 5, gaps.join(", "))
  assert.equal(
    output.last_error,
    `Katalog-Prüfung: ${gaps.length} Pflichtfelder fehlen: ${gaps.slice(0, 5).join(", ")}…`,
  )
  assert.ok(gaps.some((path) => path.includes("guidance_payload")))
})
