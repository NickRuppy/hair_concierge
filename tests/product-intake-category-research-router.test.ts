import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"
import * as Sentry from "@sentry/node"

import {
  bindResearchJobEngine,
  categoryApprovalContract,
  normalizeResearchOutputForCategory,
  researchFailureUpdate,
  type BrandResolutionPromptContext,
} from "../scripts/product-intake/codex-research-worker"

import {
  CATEGORY_RESEARCH_REGISTRY,
  researchEngineBindingMismatch,
  researchEngineBindingVersion,
} from "../src/lib/product-intake/category-research-router"

import {
  CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD,
  conditionerFormulaFingerprintSha256,
  type ConditionerResearchEnvelope,
} from "../src/lib/conditioner-research/production-adapter"
import { validateProductIntakeApprovalPayload } from "../src/lib/product-intake/category-validators"
import { BOND_CURRENT_METHOD_PINS } from "../src/lib/bondbuilder-research/registry"
import { makeBondbuilderEnvelope, sealProfile } from "./fixtures/bondbuilder-research/profile"

type ResearchOutput = Parameters<typeof normalizeResearchOutputForCategory>[0]
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

function normalized(category: string) {
  const output: ResearchOutput = {
    summary: "Research",
    blockers: [],
    artifacts: [{ kind: "property_synthesis", payload: { engine: { state: "invented" } } }],
    researched_payload: {
      draft: { notes: "Keep the research scratchpad", engine: { state: "invented" } },
      final: {
        product: { suitable_thicknesses: ["fine"] },
        category_specs: {},
        engine: { state: "invented" },
      },
    },
  }
  return normalizeResearchOutputForCategory(output, category, brandContext, [], "submission-1")
}

for (const [category, id, methodology, adapter] of [
  ["conditioner", "conditioner-standard", "v1.6", "conditioner-production-adapter-v1"],
  ["leave_in", "leave-in-standard", "v1.1", "leave-in-production-adapter-v1"],
  ["bondbuilder", "bondbuilder-inci", "v0.5", "bondbuilder-production-adapter-v1"],
]) {
  test(`${category} records server-owned provenance even when its envelope needs research`, () => {
    const result = normalized(category!)
    assert.deepEqual(result.artifacts[0]!.payload.engine, {
      id,
      methodology,
      adapter,
      state: "active",
      input_hash: null,
      projection_hash: null,
    })
    assert.equal((result.researched_payload?.final as Record<string, unknown>).engine, undefined)
    assert.ok(result.blockers.some((reason) => reason.includes("research adapter:")))
  })
}

test("shampoo keeps its current research path and records the pending v1.6 lock", () => {
  const result = normalized("shampoo")
  assert.equal((result.researched_payload?.final as Record<string, unknown>).engine, undefined)
  assert.deepEqual((result.researched_payload?.draft as Record<string, unknown>).engine, {
    state: "pending_lock",
    id: "shampoo-standard",
    target: "v1.6",
  })
  assert.equal(result.artifacts[0]!.payload.engine, undefined)
  assert.ok(!result.blockers.some((reason) => reason.includes("research adapter:")))
  assert.equal(
    (result.researched_payload?.draft as Record<string, unknown>).notes,
    "Keep the research scratchpad",
  )
})

for (const category of [
  "mask",
  "oil",
  "dry_shampoo",
  "deep_cleansing_shampoo",
  "heat_protectant",
  "scalp_care",
]) {
  test(`${category} records that an engine is unavailable without claiming a projection`, () => {
    const result = normalized(category)
    assert.equal((result.researched_payload?.final as Record<string, unknown>).engine, undefined)
    assert.deepEqual((result.researched_payload?.draft as Record<string, unknown>).engine, {
      state: "engine_not_available",
    })
    assert.equal(result.artifacts[0]!.payload.engine, undefined)
    assert.ok(!result.blockers.some((reason) => reason.includes("research adapter:")))
  })
}

test("an engine-version mismatch blocks a job with the technical reason intact", () => {
  const update = researchFailureUpdate({
    job: {
      id: "job-1",
      stage: "rework",
      locked_by: "worker-1",
      locked_at: "2026-10-06",
      attempt_count: 1,
      max_attempts: 3,
    },
    error: new Error("engine_version_mismatch: v1.0 != v1.1"),
    promptPacketPath: "/tmp/prompt.json",
    workerId: "worker-1",
    executeCodex: true,
  })
  assert.equal(update.status, "blocked")
  assert.equal(update.lastError, "engine_version_mismatch: v1.0 != v1.1")
})

test("mixed-version rework is refused unless progress explicitly authorizes an upgrade", () => {
  const engine = CATEGORY_RESEARCH_REGISTRY.leave_in
  const job = {
    engine_key: "leave-in-standard",
    engine_version: "v1.0/leave-in-production-adapter-v1",
    progress: {},
  }
  assert.equal(
    researchEngineBindingMismatch(job, engine),
    "engine_version_mismatch: v1.0/leave-in-production-adapter-v1 != v1.1/leave-in-production-adapter-v1",
  )
  assert.equal(
    researchEngineBindingMismatch({ ...job, progress: { engine_upgrade: "true" } }, engine),
    "engine_version_mismatch: v1.0/leave-in-production-adapter-v1 != v1.1/leave-in-production-adapter-v1",
  )
  assert.equal(
    researchEngineBindingMismatch({ ...job, progress: { engine_upgrade: true } }, engine),
    null,
  )
  assert.equal(
    researchEngineBindingMismatch(
      { ...job, engine_version: researchEngineBindingVersion(engine) },
      engine,
    ),
    null,
  )
  assert.equal(researchEngineBindingMismatch({ progress: {} }, engine), null)
  assert.equal(researchEngineBindingMismatch(job, CATEGORY_RESEARCH_REGISTRY.shampoo), null)
  assert.equal(researchEngineBindingMismatch(job, CATEGORY_RESEARCH_REGISTRY.mask), null)
  assert.equal(
    researchEngineBindingMismatch({ ...job, engine_key: "conditioner-standard" }, engine),
    "engine_key_mismatch: conditioner-standard != leave-in-standard",
  )
  assert.equal(
    researchEngineBindingMismatch({ ...job, engine_key: null }, engine),
    "engine_key_mismatch: null != leave-in-standard",
  )
  assert.equal(
    researchEngineBindingMismatch({ ...job, engine_version: null }, engine),
    "engine_version_mismatch: null != v1.1/leave-in-production-adapter-v1",
  )
  assert.equal(
    researchEngineBindingMismatch(
      {
        ...job,
        engine_version: "v1.1/leave-in-production-adapter-v0",
      },
      engine,
    ),
    "engine_version_mismatch: v1.1/leave-in-production-adapter-v0 != v1.1/leave-in-production-adapter-v1",
  )
})

function researchJob(overrides: Partial<Parameters<typeof bindResearchJobEngine>[1]> = {}) {
  return {
    id: "job-1",
    submission_id: "submission-1",
    status: "running" as const,
    stage: "rework" as const,
    priority: 0,
    attempt_count: 1,
    max_attempts: 3,
    locked_by: "worker-1",
    locked_at: "2026-10-06T13:00:00.000Z",
    started_at: null,
    completed_at: null,
    next_run_at: "2026-10-06T13:00:00.000Z",
    last_error: null,
    progress: {},
    created_at: "2026-10-06T13:00:00.000Z",
    updated_at: "2026-10-06T13:00:00.000Z",
    engine_key: null,
    engine_version: null,
    ...overrides,
  }
}

test("worker persists its first engine binding under the current lease and keeps the returned job state", async () => {
  const job = researchJob()
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const result = await bindResearchJobEngine(
    {
      async rpc(name, args) {
        calls.push({ name, args })
        return {
          data: {
            ...job,
            engine_key: "leave-in-standard",
            engine_version: "v1.1/leave-in-production-adapter-v1",
            progress: {
              engine_upgrade: false,
              engine_upgrade_receipt: { version: "v1.1/leave-in-production-adapter-v1" },
            },
          },
          error: null,
        }
      },
    },
    job,
    "leave-in",
  )
  assert.deepEqual(calls, [
    {
      name: "product_intake_bind_research_job_engine",
      args: {
        target_job_id: "job-1",
        next_engine_key: "leave-in-standard",
        next_engine_version: "v1.1/leave-in-production-adapter-v1",
        expected_locked_by: "worker-1",
        expected_locked_at: job.locked_at,
      },
    },
  ])
  assert.equal(result, job, "the worker lease aliases keep the bound state")
  assert.equal(result.engine_version, "v1.1/leave-in-production-adapter-v1")
  assert.equal(result.progress.engine_upgrade, false)
  const failure = researchFailureUpdate({
    job: result,
    error: new Error("later research failure"),
    promptPacketPath: "/tmp/prompt.json",
    workerId: "worker-1",
    executeCodex: true,
  })
  assert.deepEqual(failure.progress, {
    ...result.progress,
    message: "later research failure",
    prompt_packet_path: "/tmp/prompt.json",
    worker_id: "worker-1",
    mode: "codex_cli",
  })
})

test("worker refuses a locally mixed engine before running research and retains authoritative RPC errors", async () => {
  const job = researchJob({
    engine_key: "leave-in-standard",
    engine_version: "v1.0/leave-in-production-adapter-v1",
  })
  let calls = 0
  const client = {
    async rpc() {
      calls++
      return { data: null, error: { message: "engine_version_mismatch: v1.0 != v1.1" } }
    },
  }
  await assert.rejects(
    bindResearchJobEngine(client, job, "leave_in"),
    /engine_version_mismatch: v1.0\/leave-in-production-adapter-v1 != v1.1\/leave-in-production-adapter-v1/,
  )
  assert.equal(calls, 0)
  await assert.rejects(
    bindResearchJobEngine(client, researchJob(), "leave_in"),
    /engine_version_mismatch: v1.0 != v1.1/,
  )
  assert.equal(calls, 1)
  assert.equal(job.engine_version, "v1.0/leave-in-production-adapter-v1")
  await assert.rejects(
    bindResearchJobEngine(client, { ...job, progress: { engine_upgrade: true } }, "leave_in"),
    /engine_version_mismatch: v1.0 != v1.1/,
  )
  assert.equal(calls, 2, "an approved upgrade still goes through the authoritative RPC")
})

test("categories without an active engine do not bind or contact the RPC", async () => {
  const client = {
    async rpc() {
      assert.fail("inactive category must not bind")
    },
  }
  const job = researchJob()
  for (const category of ["shampoo", "mask", "unrecognized", null]) {
    assert.equal(await bindResearchJobEngine(client, job, category), job)
  }
})

test("a missing engine-binding RPC logs infrastructure failure and continues unbound with Sentry telemetry", async (t) => {
  const diagnostics: unknown[][] = []
  t.mock.method(console, "error", (...args: unknown[]) => diagnostics.push(args))
  const envelopes: unknown[] = []
  Sentry.init({
    dsn: "https://public@example.test/1",
    defaultIntegrations: false,
    transport: () => ({
      send: async (envelope) => {
        envelopes.push(envelope)
        return { statusCode: 200 }
      },
      flush: async () => true,
    }),
  })
  t.after(async () => {
    await Sentry.close()
  })
  for (const error of [
    { code: "PGRST202", message: "Schema cache has no matching RPC" },
    {
      message:
        "Could not find the function public.product_intake_bind_research_job_engine in the schema cache",
    },
  ]) {
    const job = researchJob()
    const before = structuredClone(job)
    let calls = 0
    const result = await bindResearchJobEngine(
      {
        async rpc() {
          calls++
          return { data: null, error }
        },
      },
      job,
      "leave_in",
    )
    assert.equal(result, job)
    assert.equal(calls, 1)
    assert.deepEqual(result, before, "continue with the original lease and no invented binding")
  }
  await Sentry.flush()
  assert.equal(diagnostics.length, 2)
  for (const diagnostic of diagnostics) {
    assert.match(diagnostic.join(" "), /product_intake_bind_research_job_engine/)
    assert.match(diagnostic.join(" "), /continuing without binding/i)
  }
  assert.equal(
    envelopes.length,
    2,
    "each missing RPC is captured by the initialized local transport",
  )
})

test("unrelated RPC failures still fail closed instead of using the deploy fallback", async () => {
  for (const error of [
    { code: "42501", message: "permission denied" },
    { code: "PGRST203", message: "ambiguous function" },
    { message: "stale research job lease" },
  ]) {
    await assert.rejects(
      bindResearchJobEngine(
        {
          async rpc() {
            return { data: null, error }
          },
        },
        researchJob(),
        "leave_in",
      ),
      new RegExp(error.message),
    )
  }
})

test("failed research clears the previous readiness verdict but preserves rework ownership metadata", () => {
  for (const error of [
    new Error("research failed"),
    new Error("engine_key_mismatch: old != new"),
  ]) {
    const job = researchJob({
      progress: {
        engine_key: "preserved",
        readiness_check: "passed",
        readiness_missing_fields: ["stale"],
        requested_by: "reviewer",
        requested_at: "2026-10-06",
        rework_type: "property",
        message: "Fix the source",
      },
    })
    const before = structuredClone(job)
    const update = researchFailureUpdate({
      job,
      error,
      workerId: "worker-1",
      promptPacketPath: "/tmp/prompt.json",
      executeCodex: true,
    })
    const progress: Record<string, unknown> = update.progress
    assert.equal(progress.readiness_check, undefined)
    assert.equal(progress.readiness_missing_fields, undefined)
    assert.equal(progress.engine_key, "preserved")
    assert.equal(progress.requested_by, "reviewer")
    assert.equal(progress.requested_at, "2026-10-06")
    assert.equal(progress.rework_type, "property")
    assert.deepEqual(job, before)
  }
})

test("an active engine leaves a provenance artifact when model output omitted property_synthesis", () => {
  const result = normalizeResearchOutputForCategory(
    {
      summary: "Incomplete research",
      blockers: [],
      artifacts: [],
      researched_payload: { final: { product: {}, category_specs: {} } },
    },
    "conditioner",
    brandContext,
    [],
    "submission-1",
  )
  assert.deepEqual(
    result.artifacts.filter((artifact) => artifact.kind === "property_synthesis"),
    [
      {
        kind: "property_synthesis",
        status: "needs_research",
        payload: {
          engine: {
            id: "conditioner-standard",
            methodology: "v1.6",
            adapter: "conditioner-production-adapter-v1",
            state: "active",
            input_hash: null,
            projection_hash: null,
          },
        },
      },
    ],
  )
  assert.ok(
    result.blockers.some(
      (reason) =>
        reason ===
        "conditioner research adapter: property_synthesis.conditioner_research_envelope is required",
    ),
  )
})

function conditionerEnvelope(): ConditionerResearchEnvelope {
  const evidence = <T>(value: T) => ({
    value,
    confidence: "high" as const,
    rationale: "Formula-specific evidence.",
    evidenceSignals: ["Cetearyl Alcohol at INCI #2"],
    derivation: "Standard v1.6.",
    thresholdReasoning: ["Chosen band is supported.", "Adjacent band is not supported."],
    limitations: ["Formula potential only."],
  })
  const rawInci = "Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin"
  return {
    version: "conditioner-research-envelope-v1.6",
    researchMethod: { ...CONDITIONER_PRODUCTION_ADAPTER_RESEARCH_METHOD },
    identity: {
      researchId: "submission-1",
      market: "DE/EU",
      exactProductName: "Synthetic Conditioner",
      categoryBoundaryStatus: "eligible",
      confidence: "high",
      sourceIds: ["manufacturer:product"],
    },
    formula: {
      status: "verified",
      rawInci,
      normalizedIngredients: rawInci.split(",").map((item) => item.trim()),
      formulaFingerprintSha256: conditionerFormulaFingerprintSha256(rawInci),
      rawInciSha256: createHash("sha256").update(rawInci).digest("hex"),
      sourceIds: ["manufacturer:product"],
    },
    profile: {
      conditioningLevel: evidence("moderate"),
      weightPotential: evidence("low"),
      careDirection: evidence("moisture"),
      repairSupportLevel: evidence("low"),
      primaryFocus: evidence("general"),
      secondaryFocus: evidence(["detangling"]),
      hairThicknessFit: evidence(["fine", "medium"]),
      damageFit: evidence(["healthy", "moderately_damaged"]),
      textureFit: evidence(["straight", "wavy"]),
      uncertainFields: [],
      assumptionNotes: [],
    },
  }
}

const leaveInEnvelope = JSON.parse(
  readFileSync(
    new URL(
      "../data/research/leave-in-inci/v1.1/calibration-envelopes/slot-01.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Record<string, unknown>
const bondEnvelope = {
  ...makeBondbuilderEnvelope(),
  submission_id: "00000000-0000-4000-8000-000000000111",
}
Object.assign(bondEnvelope.profile.method, BOND_CURRENT_METHOD_PINS)
sealProfile(bondEnvelope.profile)

for (const [category, envelopeKey, envelope, researchId, specsKey, expected] of [
  [
    "conditioner",
    "conditioner_research_envelope",
    conditionerEnvelope(),
    "submission-1",
    "product_conditioner_specs",
    [
      { thickness: "fine", protein_moisture_balance: "snaps" },
      { thickness: "normal", protein_moisture_balance: "snaps" },
    ],
  ],
  [
    "leave_in",
    "leave_in_research_envelope",
    leaveInEnvelope,
    "leave-in-gold-set-slot-01",
    "product_leave_in_specs",
    { application_stage: ["towel_dry", "dry_hair"], care_direction: "moisture" },
  ],
  [
    "bondbuilder",
    "bondbuilder_research_envelope",
    bondEnvelope,
    bondEnvelope.submission_id,
    "product_bondbuilder_specs",
    { technology_family: "maleate_ester", claim_trust_level: "high" },
  ],
] as const) {
  test(`${category} dispatch projects a complete envelope and keeps exact-submission binding`, () => {
    const input: ResearchOutput = {
      summary: "Research",
      blockers: [],
      artifacts: [
        {
          kind: "property_synthesis",
          payload: {
            [envelopeKey]: structuredClone(envelope),
            [`${category}_production_projection`]: {
              research_input_sha256: "invented",
              projection_sha256: "invented",
            },
          },
        },
        {
          kind: "property_synthesis",
          payload: {
            [`${category}_production_projection`]: {
              research_input_sha256: "unowned",
              projection_sha256: "unowned",
            },
          },
        },
      ],
      researched_payload: {
        final: {
          product: { suitable_thicknesses: ["coarse"] },
          category_specs: {},
          field_rationales: {},
        },
      },
    }
    const result = normalizeResearchOutputForCategory(
      structuredClone(input),
      category,
      brandContext,
      [],
      researchId!,
    )
    assert.deepEqual(
      result.blockers.filter((reason) => reason.includes("research adapter:")),
      [],
    )
    const final = result.researched_payload?.final as Record<string, unknown>
    const specs = (final.category_specs as Record<string, unknown>)[specsKey]
    if (Array.isArray(expected)) assert.deepEqual(specs, expected)
    else
      for (const [key, value] of Object.entries(expected)) {
        assert.deepEqual((specs as Record<string, unknown>)[key], value)
      }
    assert.deepEqual(result.artifacts[0]!.payload[envelopeKey], envelope)
    assert.ok(
      Object.keys(result.artifacts[0]!.payload).some((key) =>
        key.endsWith("production_projection"),
      ),
    )
    assert.deepEqual(
      [
        (result.artifacts[1]!.payload.engine as Record<string, unknown>).input_hash,
        (result.artifacts[1]!.payload.engine as Record<string, unknown>).projection_hash,
      ],
      [null, null],
    )
    const payload = result.artifacts[0]!.payload
    const projection = payload[`${category}_production_projection`] as Record<string, unknown>
    const provenance = payload.engine as Record<string, unknown>
    if (category === "bondbuilder") {
      assert.equal(provenance.input_hash, bondEnvelope.profile.method.output_sha256)
      assert.equal(provenance.projection_hash, bondEnvelope.profile.review.profile_sha256)
    } else {
      assert.match(String(provenance.input_hash), /^[a-f0-9]{64}$/)
      assert.match(String(provenance.projection_hash), /^[a-f0-9]{64}$/)
      assert.equal(provenance.input_hash, projection.research_input_sha256)
      assert.equal(provenance.projection_hash, projection.projection_sha256)
    }
    assert.ok(Array.isArray(result.artifacts[0]!.payload.adapter_warnings))
    const refused = normalizeResearchOutputForCategory(
      structuredClone(input),
      category,
      brandContext,
      [],
      "different-submission",
    )
    assert.deepEqual(
      [
        (refused.artifacts[0]!.payload.engine as Record<string, unknown>).input_hash,
        (refused.artifacts[0]!.payload.engine as Record<string, unknown>).projection_hash,
      ],
      [null, null],
    )
    assert.ok(
      refused.blockers.some((reason) => /must match Product Intake submission/.test(reason)),
    )
    assert.equal(
      (refused.researched_payload?.final as Record<string, Record<string, unknown>>).category_specs[
        specsKey
      ],
      undefined,
    )
  })
}

for (const category of Object.keys(CATEGORY_RESEARCH_REGISTRY)) {
  test(`${category} requests exact German-market INCI outside strict final fields`, () => {
    const contract = categoryApprovalContract(category)
    const formula = contract.canonical_inci as Record<string, unknown>
    assert.equal(formula.output_path, "researched_payload.draft.formula")
    assert.deepEqual(formula.fields, { raw_inci: "string or null", source_url: "string or null" })
    assert.match(String(formula.instruction), /never invent/i)
  })
}

const protocolEvidence = [
  {
    sourceUrl: "https://example.test/conditioner",
    sourceType: "manufacturer",
    checkedAt: "2026-10-06",
  },
]

function protocolInput(category: string): ResearchOutput {
  return {
    summary: "Research",
    blockers: [],
    artifacts: [
      {
        kind: "property_synthesis",
        payload: {
          ...(category === "conditioner"
            ? { conditioner_research_envelope: conditionerEnvelope() }
            : {}),
        },
      },
    ],
    researched_payload: {
      draft: { protocol: { evidence: protocolEvidence } },
      final: {
        product: { category_key: category },
        category_specs: { product_application_protocols: [{ copy: "Model instructions" }] },
        sources: [
          {
            url: protocolEvidence[0]!.sourceUrl,
            title: "Hersteller",
            evidence: "Ansatz behandeln.",
          },
        ],
      },
    },
  }
}

test("worker replaces model conditioner protocols with TPL-CONDITIONER and a single template receipt", () => {
  const input = protocolInput("conditioner")
  input.artifacts.push({ kind: "protocol_template", status: "stale", payload: {} })
  const result = normalizeResearchOutputForCategory(
    input,
    "conditioner",
    brandContext,
    [],
    "submission-1",
  )
  const final = result.researched_payload!.final as Record<string, unknown>
  const specs = final.category_specs as Record<string, unknown>
  const rows = specs.product_application_protocols as Array<Record<string, unknown>>
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.role, "conditioner_rinse_out")
  const guidance = rows[0]!.guidance_payload as {
    protocolFacts: Record<string, unknown>
    steps: Array<{ copyTemplateDe: string }>
  }
  assert.equal(guidance.protocolFacts.applicationArea, "lengths_ends")
  assert.ok(guidance.steps.some((step) => step.copyTemplateDe.includes("Ansatz aussparen")))
  const validation = validateProductIntakeApprovalPayload(result.researched_payload)
  assert.deepEqual(
    validation.missingFields.filter((field) => field.includes("product_application_protocols")),
    [],
  )
  assert.deepEqual(
    result.artifacts.filter((artifact) => artifact.kind === "protocol_template"),
    [
      {
        kind: "protocol_template",
        status: "templated",
        payload: {
          stage: "protocol",
          status: "templated",
          template_ids: ["TPL-CONDITIONER"],
          blockers: [],
        },
      },
    ],
  )
})

test("worker reads projected leave-in heat specs and clears model protocols when the dry-use slot is missing", () => {
  const input = protocolInput("leave_in")
  // The projected specs replace this non-heat object; protocol must read the replacement.
  const envelope = structuredClone(leaveInEnvelope)
  const profile = envelope.profile as Record<string, Record<string, unknown>>
  const specialistFunctions = profile.specialistFunctions!.value as Record<string, unknown>
  specialistFunctions.providesHeatProtection = true
  input.artifacts[0]!.payload.leave_in_research_envelope = envelope
  const finalInput = input.researched_payload!.final as Record<string, Record<string, unknown>>
  finalInput.category_specs!.product_leave_in_specs = { provides_heat_protection: false }
  const result = normalizeResearchOutputForCategory(
    input,
    "leave_in",
    brandContext,
    [],
    "leave-in-gold-set-slot-01",
  )
  const final = result.researched_payload!.final as Record<string, Record<string, unknown>>
  assert.equal(
    (final.category_specs!.product_leave_in_specs as Record<string, unknown>)
      .provides_heat_protection,
    true,
  )
  assert.deepEqual(final.category_specs!.product_application_protocols, [])
  assert.ok(result.blockers.includes("protocol_slot_missing: heat_usable_on_dry_hair"))
  assert.equal(
    result.artifacts.find((artifact) => artifact.kind === "protocol_template")!.status,
    "blocked",
  )
})

test("worker keeps bondbuilder model protocols untouched and records the untemplated stage", () => {
  const input = protocolInput("bondbuilder")
  const before = structuredClone(
    (input.researched_payload!.final as Record<string, Record<string, unknown>>).category_specs!
      .product_application_protocols,
  )
  const result = normalizeResearchOutputForCategory(
    input,
    "bondbuilder",
    brandContext,
    [],
    "submission-1",
  )
  assert.deepEqual(
    (result.researched_payload!.final as Record<string, Record<string, unknown>>).category_specs!
      .product_application_protocols,
    before,
  )
  assert.equal(
    result.artifacts.find((artifact) => artifact.kind === "protocol_template")!.status,
    "not_templated",
  )
})
