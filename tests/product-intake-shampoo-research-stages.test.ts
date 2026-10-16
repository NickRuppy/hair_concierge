import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { promisify } from "node:util"

import {
  runShampooResearchStages,
  validateShampooStageProof,
  type ShampooStageModelRequest,
} from "../src/lib/product-intake/shampoo-research-stages"

type JsonRecord = Record<string, unknown>
const submissionId = "b359ed76-5ab8-4550-928f-a0ead4ad7450"
const reviewCycleId = "e8082fb1-cc8a-4f1f-9915-6d8a05689dc7"
const canonicalInci = [
  "Aqua (Water, Eau)",
  "Sodium Laureth Sulfate",
  "Cocamidopropyl Betaine",
  "Sodium Chloride",
  "Parfum",
]
// Independent locked-rule oracle (not the owner helper and not generic uppercase intake hash).
const fingerprint = createHash("sha256")
  .update("aqua (water, eau)|sodium laureth sulfate|cocamidopropyl betaine|sodium chloride|parfum")
  .digest("hex")
function source() {
  return {
    freeze_packet: {
      slot: "single",
      productId: submissionId,
      name: "Quellora Hydra Repair",
      brand: "Quellora",
      packSize: "250 ml Quellora 4066447965414",
      gtins: ["4066447965414"],
      sources: [
        {
          url: "https://quellora.de/product/hydra",
          retrievedAt: "2026-10-16T08:00:00Z",
          sourceType: "manufacturer",
          sourceKind: "manufacturer_de",
          gtinShown: "4066447965414",
          inciVerbatim: canonicalInci.join(", "),
          claimsVerbatim: "Intensive Reparatur",
          directionsVerbatim: "Ins nasse Haar einmassieren und ausspülen.",
        },
      ],
      conflicts: [],
      canonicalInci,
      canonicalReason: "Current exact DE manufacturer source.",
      inciFingerprintSha256: fingerprint,
      normalization: "CANARY_IDENTITY_NOTE_Quellora",
      identityConfidence: "high",
      formulaCompleteness: "complete",
      formulaSourceTier: 2,
      status: "frozen",
      blockReason: null,
      notes: "Identity note Quellora",
    },
    intake_draft: {
      directions: "Ins nasse Haar einmassieren und ausspülen.",
      secret: "CANARY_REVEAL_ONLY",
    },
  }
}
function formulaPacket(request: ShampooStageModelRequest): JsonRecord {
  return JSON.parse(request.prompt.split("\nFORMULA\n")[1].split("\nSTANDARD\n")[0])
}
function blind(request: ShampooStageModelRequest): JsonRecord {
  const a = formulaPacket(request)
  return {
    blindId: a.blindId,
    inciFingerprintSha256: a.inciFingerprintSha256,
    formulaFacts: { surfactants: ["Sodium Laureth Sulfate @2", "Cocamidopropyl Betaine @3"] },
    unresolvedMaterialIngredients: [],
    directProperties: Object.fromEntries(
      Object.entries({
        cleansingStrength: "moderate",
        conditioningLevel: "low",
        weightPotential: "low",
        focusPrimary: "general",
        focusSecondary: [],
        usageRole: "regular",
        scalpComfortTarget: "not_targeted",
        dandruffSupport: "not_supported",
      }).map(([key, value]) => [
        key,
        {
          value,
          confidence: "high",
          rationale: "Formula-only provisional assessment.",
          ruleIds: ["C1"],
        },
      ]),
    ),
  }
}
function finalOutput(): JsonRecord {
  return {
    summary: "Prepared for review",
    blockers: [],
    researched_payload: {
      draft: {},
      final: {
        product: { clean_name: "Hydra Repair" },
        category_specs: {},
        review: { manual_reviewed: true, image_approved: true, publish_approved: true },
      },
    },
    artifacts: [
      {
        kind: "property_synthesis",
        payload: {
          shampoo_research_envelope: {
            directProperties: { cleansingStrength: { value: "moderate" } },
            selfCheck: ["Formula frozen before claims."],
            uncertainties: [],
            blindToFinalChanges: [],
          },
        },
      },
    ],
  }
}
function params() {
  return {
    submissionId,
    reviewCycleId,
    packet: {
      submission_id: submissionId,
      product: { brand: "Quellora", product_name: "Hydra Repair" },
      generic_prompt: "CANARY_GENERIC_PROMPT",
    },
    reservedModelRuns: 0,
  }
}
function fakeModel(observe?: (request: ShampooStageModelRequest, output: JsonRecord) => void) {
  return async (request: ShampooStageModelRequest) => {
    const output =
      request.stage === "source_freeze"
        ? source()
        : request.stage === "blind_formula"
          ? blind(request)
          : finalOutput()
    observe?.(request, output)
    return output
  }
}
function native(output: JsonRecord): JsonRecord {
  return ((output.artifacts as JsonRecord[])[0].payload as JsonRecord)
    .shampoo_research_envelope as JsonRecord
}

test("seals a real isolated lane before reveal, uses locked fingerprint and cleans only its owned stage directory", async () => {
  const requests: ShampooStageModelRequest[] = []
  let frozenBlindBytes = ""
  let rawFinal: JsonRecord | undefined
  const result = await runShampooResearchStages({
    ...params(),
    model: fakeModel((request, output) => {
      requests.push(request)
      assert.ok(existsSync(request.cwd))
      if (request.stage === "source_freeze") {
        // Same ingredient as the canonical parenthetical spelling, including
        // slash-separated label synonyms; the fingerprint stays canonical.
        ;((output.freeze_packet as JsonRecord).sources as JsonRecord[])[0].inciVerbatim = [
          "Aqua/Water/Eau",
          ...canonicalInci.slice(1),
        ].join(", ")
      }
      if (request.stage === "blind_formula") {
        for (const forbidden of [
          "Quellora",
          "Hydra Repair",
          submissionId,
          "4066447965414",
          "quellora.de",
          "CANARY_REVEAL_ONLY",
          "CANARY_GENERIC_PROMPT",
          "CANARY_IDENTITY_NOTE",
        ])
          assert.ok(!request.prompt.includes(forbidden), forbidden)
        assert.equal(formulaPacket(request).packSize, "250 ml")
        assert.deepEqual(readdirSync(request.cwd).sort(), [
          "classification-standard.md",
          "formula",
          "out",
        ])
        assert.ok(!existsSync(path.join(request.cwd, "reveal")))
      }
      if (request.stage === "revealed_final") {
        rawFinal = output
        const blindRequest = requests.find((r) => r.stage === "blind_formula")!
        const id = formulaPacket(blindRequest).blindId as string
        frozenBlindBytes = readFileSync(
          path.join(blindRequest.cwd, "out/formula-pass", `${id}.json`),
          "utf8",
        )
        assert.ok(existsSync(path.join(blindRequest.cwd, "reveal", `${id}.json`)))
        assert.ok(request.prompt.includes("CANARY_REVEAL_ONLY"))
        assert.ok(request.prompt.includes(frozenBlindBytes))
        assert.notEqual(request.cwd, blindRequest.cwd)
      }
    }),
  })
  assert.deepEqual(
    requests.map((r) => [r.stage, r.webSearch]),
    [
      ["source_freeze", "live"],
      ["blind_formula", "disabled"],
      ["revealed_final", "disabled"],
    ],
  )
  const final = (result.output.researched_payload as JsonRecord).final as JsonRecord
  assert.deepEqual(final.review, { manual_reviewed: false })
  assert.deepEqual(((rawFinal!.researched_payload as JsonRecord).final as JsonRecord).review, {
    manual_reviewed: true,
    image_approved: true,
    publish_approved: true,
  })
  const frozenOutput = JSON.parse((result.proof!.revealed as JsonRecord).bytes as string)
  assert.deepEqual(frozenOutput.researched_payload.final.review, { manual_reviewed: false })
  assert.equal(result.formula?.formulaFingerprintSha256, fingerprint)
  assert.equal((result.proof?.blind as JsonRecord).bytes, frozenBlindBytes)
  assert.equal(
    (result.proof?.blind as JsonRecord).sha256,
    createHash("sha256").update(frozenBlindBytes).digest("hex"),
  )
  assert.deepEqual(
    validateShampooStageProof(result.proof, {
      submissionId,
      reviewCycleId,
      envelope: native(result.output),
    }),
    { ok: true, formulaFingerprintSha256: fingerprint },
  )
  for (const request of requests) assert.ok(!existsSync(request.cwd))
})

test("incomplete or mismatched source and blind evidence never reaches reveal", async () => {
  for (const scenario of [
    "source_conflict",
    "source_wrong_id",
    "source_wrong_formula",
    "source_gtin",
    "source_foreign",
    "blind_missing_property",
    "blind_material_unknown",
    "blind_wrong_hash",
  ]) {
    const stages: string[] = []
    const input = params()
    if (scenario === "source_gtin")
      Object.assign(input.packet, {
        brand_resolution_context: { scanned_identifier: { type: "ean", value: "4006381333931" } },
      })
    const result = await runShampooResearchStages({
      ...input,
      model: fakeModel((request, output) => {
        stages.push(request.stage)
        const freeze = output.freeze_packet as JsonRecord | undefined
        if (freeze) {
          if (scenario === "source_conflict") freeze.conflicts = ["Other formula"]
          if (scenario === "source_wrong_id") freeze.productId = "other"
          if (scenario === "source_wrong_formula") freeze.canonicalInci = ["Aqua", "Other"]
          if (scenario === "source_foreign")
            (freeze.sources as JsonRecord[])[0].sourceKind = "manufacturer_foreign"
        }
        if (request.stage === "blind_formula") {
          if (scenario === "blind_missing_property")
            delete (output.directProperties as JsonRecord).focusSecondary
          if (scenario === "blind_material_unknown")
            output.unresolvedMaterialIngredients = ["Unknown polymer"]
          if (scenario === "blind_wrong_hash") output.inciFingerprintSha256 = "0".repeat(64)
        }
      }),
    })
    assert.equal(result.output.researched_payload, null, scenario)
    assert.ok((result.output.blockers as string[]).length, scenario)
    assert.ok(!stages.includes("revealed_final"), scenario)
  }
})

test(
  "source validation returns promptly for adversarial water-synonym input",
  { timeout: 15_000 },
  async (t) => {
    const root = mkdtempSync(path.join(tmpdir(), "shampoo-source-redos-"))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    const evidence = source()
    const attack = `eau(eau${"\t(eau".repeat(40)}${")".repeat(41)}X`
    evidence.freeze_packet.canonicalInci = [attack, "Parfum"]
    evidence.freeze_packet.sources[0].inciVerbatim = `${attack}, Parfum`
    evidence.freeze_packet.inciFingerprintSha256 = createHash("sha256")
      .update(`${attack.toLowerCase().replace(/\s+/g, " ")}|parfum`)
      .digest("hex")
    const script = path.join(root, "probe.mjs")
    writeFileSync(
      script,
      `
    import { runShampooResearchStages } from ${JSON.stringify(new URL("../src/lib/product-intake/shampoo-research-stages.ts", import.meta.url).href)};
    let calls = 0;
    const result = await runShampooResearchStages({
      ...${JSON.stringify(params())},
      model: async request => { calls++; return request.stage === "source_freeze" ? ${JSON.stringify(evidence)} : {}; }
    });
    console.log(JSON.stringify({ calls, blocked: result.output.researched_payload === null }));
  `,
    )
    // A child timeout can interrupt a synchronous regex; a node:test timeout cannot.
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", script],
      { timeout: 8_000, env: { ...process.env, TMPDIR: root } },
    )
    assert.deepEqual(JSON.parse(stdout), { calls: 2, blocked: true })
  },
)

test("repair reuses the immutable frozen assessment with one model call, including missing final schema", async () => {
  const first = await runShampooResearchStages({
    ...params(),
    model: fakeModel((_request, output) => {
      if (output.summary) output.artifacts = [] // Missing final schema is repairable; freeze/blind remains usable.
    }),
  })
  const before = structuredClone(first.proof)
  function jsonbRoundTrip(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(jsonbRoundTrip)
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, jsonbRoundTrip(entry)]),
      )
    return value
  }
  const requests: ShampooStageModelRequest[] = []
  const repaired = await runShampooResearchStages({
    ...params(),
    reservedModelRuns: 4,
    priorProof: jsonbRoundTrip(first.proof),
    model: fakeModel((request) => requests.push(request)),
  })
  assert.deepEqual(
    requests.map((r) => [r.stage, r.webSearch]),
    [["revealed_repair", "disabled"]],
  )
  assert.deepEqual(first.proof, before)
  for (const key of ["freeze", "stageA", "blind", "context", "revealed"])
    assert.deepEqual(repaired.proof?.[key], first.proof?.[key])
  assert.equal((repaired.proof?.repairs as unknown[]).length, 1)
  assert.ok(
    validateShampooStageProof(repaired.proof, {
      submissionId,
      reviewCycleId,
      envelope: native(repaired.output),
    }).ok,
  )
})

test("proof tampering, changed identity/formula/cycle, missing evidence or exhausted budget deny repair without launching", async () => {
  const first = await runShampooResearchStages({ ...params(), model: fakeModel() })
  for (const scenario of [
    "tamper",
    "cycle",
    "identity",
    "formula",
    "nested_formula",
    "missing",
    "budget",
  ]) {
    const input: Omit<Parameters<typeof runShampooResearchStages>[0], "model"> = {
      ...params(),
      reservedModelRuns: 4,
      priorProof: structuredClone(first.proof),
    }
    if (scenario === "tamper")
      (input.priorProof as JsonRecord).formulaFingerprintSha256 = "0".repeat(64)
    if (scenario === "cycle") input.reviewCycleId = "other-cycle"
    if (scenario === "identity") input.packet.product = { brand: "Different" }
    if (scenario === "formula") input.packet.formula = { raw_inci: "Aqua, Other" }
    if (scenario === "nested_formula")
      input.packet.current_payload = {
        researched_payload: { draft: { formula: { raw_inci: "Aqua, Other" } } },
      }
    if (scenario === "missing") input.priorProof = undefined
    if (scenario === "budget") input.reservedModelRuns = 5
    let calls = 0
    const result = await runShampooResearchStages({
      ...input,
      model: async () => {
        calls++
        return finalOutput()
      },
    })
    assert.equal(calls, 0, scenario)
    assert.equal(result.output.researched_payload, null, scenario)
  }
  const changedEnvelope = structuredClone(native(first.output))
  changedEnvelope.directProperties = { cleansingStrength: { value: "strong" } }
  assert.equal(
    validateShampooStageProof(first.proof, {
      submissionId,
      reviewCycleId,
      envelope: changedEnvelope,
    }).ok,
    false,
  )
})

test("conflicting supplied native bindings block rather than being silently replaced", async () => {
  for (const mismatch of ["productId", "formulaFingerprintSha256", "method"]) {
    const result = await runShampooResearchStages({
      ...params(),
      model: fakeModel((request, output) => {
        if (request.stage !== "revealed_final") return
        const record = native(output)
        if (mismatch === "method") record.researchMethod = { policyId: "old" }
        else record.identity = { [mismatch]: "wrong" }
      }),
    })
    assert.equal(result.output.researched_payload, null, mismatch)
    assert.match((result.output.blockers as string[])[0], /^identity_conflict:/)
  }
})

test("reservation and auth failures propagate to the shared worker and still clean temporary directories", async () => {
  const failure = new Error("infra_auth")
  let cwd = ""
  await assert.rejects(
    runShampooResearchStages({
      ...params(),
      model: async (request) => {
        cwd = request.cwd
        throw failure
      },
    }),
    (error) => error === failure,
  )
  assert.ok(cwd)
  assert.ok(!existsSync(cwd))
})
