import assert from "node:assert/strict"
import test from "node:test"
import { createHash } from "node:crypto"

import {
  applyOilResearchAdapterForWorker,
  type OilWorkerAdmissionContext,
} from "../src/lib/product-intake/oil-research-adapter"
import {
  applyCommerceStage,
  completeResearchPass,
  normalizeResearchOutputForCategory,
} from "../scripts/product-intake/codex-research-worker"
import {
  oilReviewFingerprint,
  type JsonRecord,
  type ProductIntakeResearchJob,
} from "@chaarlie/product-intake-core"
import { applyInciStage } from "../src/lib/product-intake/pipeline/inci"
import { makeCurrentOilEnvelope } from "./fixtures/oil-research/current"

const submissionId = "00000000-0000-4000-8000-000000000111"
const jobId = "00000000-0000-4000-8000-000000000112"
const runId = "00000000-0000-4000-8000-000000000113"

function fixture(): {
  final: Record<string, unknown>
  artifacts: { kind: string; payload: Record<string, unknown> }[]
  context: OilWorkerAdmissionContext
} {
  const historical = makeCurrentOilEnvelope()
  const { research_method: _method, provenance, formula, ...rest } = historical
  void _method
  const { raw_sha256: _raw, normalized_sha256: _normalized, ...draftFormula } = formula
  void _raw
  void _normalized
  const {
    import_kind: _kind,
    original_record: _record,
    original_record_sha256: _recordHash,
    field_authorities: _authorities,
    ...draftProvenance
  } = provenance
  void _kind
  void _record
  void _recordHash
  void _authorities
  const identity = {
    brand: historical.identity.brand,
    product: historical.identity.product,
    market: historical.identity.market,
    variant: historical.identity.variant,
    package: historical.identity.package,
    identifier: historical.identity.identifier,
    source_ids: historical.identity.source_ids,
  }
  return {
    final: {
      product: {
        canonical_brand: "Fixture",
        clean_name: "Hypothetical oil",
        net_content_value: 30,
        net_content_unit: "ml",
      },
      category_specs: { product_oil_specs: { weight: "rich" } },
      field_rationales: {},
    },
    artifacts: [
      {
        kind: "property_synthesis",
        payload: {
          oil_research_draft: {
            ...rest,
            formula: draftFormula,
            provenance: {
              ...draftProvenance,
              original_method: {
                ...draftProvenance.original_method,
                declared_version: "v0.10",
                unrecorded_note: null,
              },
            },
          },
        },
      },
    ],
    context: {
      submissionId,
      jobId,
      runId,
      identity,
      formula: {
        raw_inci: formula.raw_inci,
        ingredients: formula.ingredients,
        source_ids: formula.source_ids,
        declaration_status: formula.declaration_status,
        conflicts: formula.conflicts,
      },
      resolvedIdentityArtifact: {
        stage: "identity",
        brand_resolution: { canonical_brand: "Fixture" },
      },
      resolvedIdentityArtifactId: "00000000-0000-4000-8000-000000000114",
      identityBlocker: null,
    },
  }
}

test("worker admission derives a fresh stored envelope from the draft and exact server context", () => {
  const input = fixture()
  const result = applyOilResearchAdapterForWorker({
    ...input,
    expectedResearchId: submissionId,
  })
  assert.deepEqual(result.blockers, [])
  assert.equal(
    result.oilAdmission?.storage.oil_research_envelope.formula.raw_inci,
    "JOJOBA OIL, 1,2-HEXANEDIOL.",
  )
  assert.equal(
    (input.final.category_specs as Record<string, Record<string, unknown>>).product_oil_specs
      .weight,
    "light",
  )
})

test("worker admission cannot relabel a local v0.9 draft as current Intake", () => {
  const input = fixture()
  const draft = input.artifacts[0].payload.oil_research_draft as {
    provenance: { original_method: { declared_version: string } }
  }
  draft.provenance.original_method.declared_version = "v0.9"
  const before = structuredClone(input)
  const result = applyOilResearchAdapterForWorker({ ...input, expectedResearchId: submissionId })
  assert.notDeepEqual(result.blockers, [])
  assert.equal(result.oilAdmission, undefined)
  assert.deepEqual(input, before)
})

test("worker admission rejects non-UUID runtime references while keeping the server pending identity placeholder", () => {
  for (const changed of [
    { jobId: "job-1" },
    { runId: "run-1" },
    { resolvedIdentityArtifactId: "model-identity" },
  ]) {
    const input = fixture()
    Object.assign(input.context, changed)
    const before = structuredClone(input)
    const result = applyOilResearchAdapterForWorker({ ...input, expectedResearchId: submissionId })
    assert.match(result.blockers.join(" "), /current job and run UUIDs/)
    assert.deepEqual(input, before)
  }
  const input = fixture()
  input.context.resolvedIdentityArtifactId = "pending-current-identity"
  assert.deepEqual(
    applyOilResearchAdapterForWorker({ ...input, expectedResearchId: submissionId }).blockers,
    [],
  )
})

test("worker admission refuses an identity or authoritative formula mismatch without projection mutation", () => {
  const input = fixture()
  input.context.identity.product = "Other product"
  const before = structuredClone(input)
  const result = applyOilResearchAdapterForWorker({ ...input, expectedResearchId: submissionId })
  assert.match(result.blockers.join(" "), /identity product differs/)
  assert.deepEqual(input, before)
})

test("worker admission refusal leaves both final fields and the artifact untouched when final identity is incomplete", () => {
  const input = fixture()
  delete (input.final.product as Record<string, unknown>).net_content_value
  const before = structuredClone(input)
  const result = applyOilResearchAdapterForWorker({ ...input, expectedResearchId: submissionId })
  assert.match(result.blockers.join(" "), /final product identity net_content_value/)
  assert.deepEqual(input, before)
})

test("worker refuses same-brand product or package substitution before mutation", async (t) => {
  for (const changed of [
    { clean_name: "Different oil" },
    { net_content_value: 100 },
    { net_content_unit: "g" },
  ]) {
    await t.test(JSON.stringify(changed), () => {
      const input = fixture()
      Object.assign(input.final.product as Record<string, unknown>, changed)
      const before = structuredClone(input)
      const result = applyOilResearchAdapterForWorker({
        ...input,
        expectedResearchId: submissionId,
      })
      assert.match(result.blockers.join(" "), /final product (name|package) differs/)
      assert.deepEqual(input, before)
    })
  }
})

test("worker admits exact resolved brand/line stripping and exact metric package conversion", () => {
  const input = fixture()
  const draft = input.artifacts[0]!.payload.oil_research_draft as {
    identity: {
      product: string
      package: { size_text: string | null }
      original: Record<string, unknown>
    }
  }
  draft.identity.product = "Fixture — Botanical Hypothetical oil"
  draft.identity.original.product = draft.identity.product
  input.context.identity.product = draft.identity.product
  draft.identity.package.size_text = "0.03 l"
  draft.identity.original.size = "0.03 l"
  input.context.identity.package.size_text = "0.03 l"
  Object.assign(input.final.product as Record<string, unknown>, {
    product_line: "Botanical",
    clean_name: "Hypothetical oil",
    net_content_value: 30,
    net_content_unit: "ml",
  })
  ;(
    input.context.resolvedIdentityArtifact.brand_resolution as Record<string, unknown>
  ).product_line = "Botanical"
  const result = applyOilResearchAdapterForWorker({ ...input, expectedResearchId: submissionId })
  assert.deepEqual(result.blockers, [])
})

test("worker refuses ambiguous source package descriptions rather than guessing a selected size", () => {
  const input = fixture()
  const draft = input.artifacts[0]!.payload.oil_research_draft as {
    identity: { package: { size_text: string | null }; original: Record<string, unknown> }
  }
  draft.identity.package.size_text = "30 ml or 100 ml"
  draft.identity.original.size = "30 ml or 100 ml"
  input.context.identity.package.size_text = "30 ml or 100 ml"
  const before = structuredClone(input)
  const result = applyOilResearchAdapterForWorker({ ...input, expectedResearchId: submissionId })
  assert.match(result.blockers.join(" "), /source package is ambiguous/)
  assert.deepEqual(input, before)
})

test("active oil INCI accepts only server admission and preserves a numeric-comma token", () => {
  const artifacts: Parameters<typeof applyInciStage>[1] = []
  const missing = applyInciStage(
    { final: {}, draft: { formula: { raw_inci: "Aqua, Glycerin" } } },
    artifacts,
    { state: "active", engineId: "oil-standard" },
    { retailerPacket: { ingredients_text: "Aqua, Glycerin" } },
  )
  assert.match(missing ?? "", /oil_admission_missing/)

  const admittedArtifacts: Parameters<typeof applyInciStage>[1] = []
  assert.equal(
    applyInciStage(
      { final: {}, draft: {} },
      admittedArtifacts,
      { state: "active", engineId: "oil-standard" },
      {
        oilAdmission: {
          raw_inci: "JOJOBA OIL, 1,2-HEXANEDIOL.",
          normalized_ingredients: ["JOJOBA OIL", "1,2-HEXANEDIOL"],
          normalized_sha256: "a".repeat(64),
        },
      },
    ),
    null,
  )
  assert.deepEqual(admittedArtifacts[0]!.payload.normalized_ingredients, [
    "JOJOBA OIL",
    "1,2-HEXANEDIOL",
  ])
})

function normalizeWorkerFixture(missingContext = false) {
  const input = fixture()
  const context = input.context
  if (missingContext)
    Object.assign(input.artifacts[0]!.payload, {
      oil_storage_version: "oil-research-storage-v1",
      oil_research_envelope_json: "model-authored",
      oil_admission_context: { job_id: "job-1" },
    })
  const normalized = normalizeResearchOutputForCategory(
    {
      summary: "Oil research",
      blockers: [],
      artifacts: input.artifacts as Parameters<
        typeof normalizeResearchOutputForCategory
      >[0]["artifacts"],
      researched_payload: {
        final: input.final,
        draft: missingContext
          ? {}
          : { oil_identity: context.identity, oil_authoritative_formula: context.formula },
      },
    },
    "oil",
    {
      submitted_brand_text: "Fixture",
      submitted_product_name_text: "Hypothetical oil",
      scanned_identifier: null,
      lookup_text: "Fixture Hypothetical oil",
      resolved_brand: { canonical_brand: "Fixture" },
      nearby_brand_options: [],
      catalog_summary: {},
      rules: [],
    },
    [],
    submissionId,
    {
      currentResearchRun: { jobId: context.jobId, runId: context.runId },
    },
  )
  return normalized
}

test("real normalize rejects absent independent context even when the model draft is valid", () => {
  const result = normalizeWorkerFixture(true)
  assert.match(result.blockers.join(" "), /current job, identity and formula context are required/)
  assert.match(result.blockers.join(" "), /oil_admission_missing/)
  const final = result.researched_payload!.final as JsonRecord
  assert.equal(
    (final.category_specs as Record<string, JsonRecord>).product_oil_specs.weight,
    "rich",
  )
  assert.equal(
    result.artifacts.some((artifact) => artifact.payload.oil_storage_version != null),
    false,
  )
})

async function persistNormalizedWorker(
  options: {
    interruptAfterIdentity?: boolean
    duplicate?: boolean
    mutateAfterCommerce?: JsonRecord
  } = {},
) {
  let output = normalizeWorkerFixture()
  if (options.mutateAfterCommerce) {
    output = await applyCommerceStage(output, submissionId, {
      now: () => new Date("2026-10-13T12:00:00Z"),
      dmSearch: async () => [],
      jsonLdFetch: async () => assert.fail("No purchase URL should be fetched"),
    })
    assert.ok(output.artifacts.some((artifact) => artifact.kind === "commerce_check"))
    Object.assign(
      (output.researched_payload!.final as JsonRecord).product as JsonRecord,
      options.mutateAfterCommerce,
    )
  }
  if (options.duplicate)
    output.artifacts.push(
      structuredClone(output.artifacts.find((a) => a.payload.oil_storage_version)!),
    )
  const writes: JsonRecord[] = []
  const previews: JsonRecord[] = []
  const events: string[] = []
  const job = {
    id: jobId,
    submission_id: submissionId,
    stage: "property_research",
    status: "running",
    locked_by: "worker-fixture",
    locked_at: "2026-10-13T12:00:00Z",
    progress: {},
  } as ProductIntakeResearchJob
  const client = {
    from(table: string) {
      let row: JsonRecord | null = null
      const query = {
        insert(value: JsonRecord) {
          row = structuredClone(value)
          return query
        },
        update(value: JsonRecord) {
          row = structuredClone(value)
          return query
        },
        select() {
          return query
        },
        eq() {
          return query
        },
        in() {
          return query
        },
        async maybeSingle() {
          return { data: { user_id: null }, error: null }
        },
        async single() {
          if (table === "product_intake_research_artifacts") {
            if (options.interruptAfterIdentity && writes.length === 1)
              return { data: null, error: new Error("artifact persistence interrupted") }
            const saved: JsonRecord & { id: string } = {
              ...row!,
              id: `00000000-0000-4000-8000-${String(500 + writes.length).padStart(12, "0")}`,
            }
            writes.push(saved)
            events.push(`artifact:${saved.kind}`)
            return { data: saved, error: null }
          }
          assert.equal(table, "product_submissions")
          previews.push(row!)
          events.push("preview")
          return { data: { id: submissionId, status: row!.status }, error: null }
        },
      }
      return query
    },
    async rpc(name: string, args: JsonRecord) {
      assert.equal(name, "product_intake_commit_research_pass")
      assert.equal(args.expected_locked_by, job.locked_by)
      assert.equal(args.expected_locked_at, job.locked_at)
      const preview = args.researched_payload as JsonRecord
      previews.push({ researched_payload: preview })
      events.push("completion")
      return {
        data: {
          ...job,
          status: args.next_status,
          stage: args.next_stage,
          progress: args.next_progress,
        },
        error: null,
      }
    },
  }
  const finish = () =>
    completeResearchPass({
      supabase: client as unknown as Parameters<typeof completeResearchPass>[0]["supabase"],
      job,
      category: "oil",
      submission: { id: submissionId, source: "admin", status: "researching" },
      workerId: job.locked_by!,
      promptPacketPath: "/tmp/oil-fixture-prompt.json",
      researchOutput: output,
      researchModel: "fixture",
      executeCodex: true,
      autoPrepareImages: false,
    })
  if (options.interruptAfterIdentity || options.duplicate || options.mutateAfterCommerce) {
    await assert.rejects(
      finish,
      options.duplicate
        ? /Exactly one/
        : options.mutateAfterCommerce
          ? /final product|identity changed/
          : /interrupted/,
    )
  } else await finish()
  return { writes, previews, events, output }
}

test("real normalize and persistence bind the stored oil artifact to the returned identity UUID before atomically completing the research pass", async () => {
  const { writes, previews, events, output } = await persistNormalizedWorker()
  const identity = writes[0]!
  assert.equal(identity.kind, "identity_candidate")
  const oil = writes.find((row) => (row.payload as JsonRecord).oil_storage_version)!
  const payload = oil.payload as JsonRecord
  const context = payload.oil_admission_context as JsonRecord
  assert.equal(context.resolved_identity_artifact_id, identity.id)
  assert.notEqual(context.resolved_identity_artifact_id, "pending-current-identity")
  assert.deepEqual(context.resolved_identity_artifact, identity.payload)
  assert.equal(typeof payload.oil_admission_context_json, "string")
  const contextBytes = payload.oil_admission_context_json as string
  assert.deepEqual(JSON.parse(contextBytes), context)
  assert.equal(
    payload.oil_admission_context_sha256,
    createHash("sha256").update(contextBytes, "utf8").digest("hex"),
  )
  assert.equal(payload.oil_admission_context_sha256, oilReviewFingerprint(context))
  assert.equal((payload.engine as JsonRecord).input_hash, payload.oil_admission_context_sha256)
  const draft = (previews[0]!.researched_payload as JsonRecord).draft as JsonRecord
  const binding = draft.oil_research_binding as JsonRecord
  assert.equal(binding.artifact_id, oil.id)
  assert.equal(binding.admission_context_sha256, payload.oil_admission_context_sha256)
  assert.deepEqual(draft.formula, {
    status: "present",
    source: "oil_envelope",
    raw_inci: "JOJOBA OIL, 1,2-HEXANEDIOL.",
    normalized_ingredients: ["JOJOBA OIL", "1,2-HEXANEDIOL"],
    fingerprint_sha256: "13b1ad6c12a02f105b39aad4193be45a5edbefe60ade413032010034c4ce66e6",
  })
  assert.deepEqual(draft.oil_authoritative_formula, fixture().context.formula)
  assert.equal(events.at(-1), "completion")
  assert.equal(writes.length, output.artifacts.length, "each artifact is inserted only once")
})

test("interrupted persistence leaves only unreferenced history and never saves a preview", async () => {
  const { writes, previews, events } = await persistNormalizedWorker({
    interruptAfterIdentity: true,
  })
  assert.equal(writes.length, 1)
  assert.equal(writes[0]!.kind, "identity_candidate")
  assert.deepEqual(previews, [])
  assert.deepEqual(events, ["artifact:identity_candidate"])
})

test("duplicate current oil artifacts are refused before any persistence", async () => {
  const { writes, previews } = await persistNormalizedWorker({ duplicate: true })
  assert.deepEqual(writes, [])
  assert.deepEqual(previews, [])
})

test("persistence rejects post-commerce identity changes before inserting any artifact or saving preview", async (t) => {
  for (const change of [
    { clean_name: "Different oil" },
    { net_content_value: 100 },
    { canonical_brand: "Other" },
  ]) {
    await t.test(JSON.stringify(change), async () => {
      const { writes, previews, events } = await persistNormalizedWorker({
        mutateAfterCommerce: change,
      })
      assert.deepEqual(writes, [])
      assert.deepEqual(previews, [])
      assert.deepEqual(events, [])
    })
  }
})
