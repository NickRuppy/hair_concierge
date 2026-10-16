import assert from "node:assert/strict"
import { after, test } from "node:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createOilLabCandidatePackage } from "../src/lib/oil-research/candidate-package"
import { OilResearchEnvelopeSchema } from "../src/lib/oil-research/contracts"
import { OIL_LOCAL_RESEARCH_METHOD } from "../src/lib/oil-research/registry"
import { getOilLabSource, oilLabSources } from "../src/lib/labs/oil-research-access"
import { readOilReviewState } from "../src/lib/oil-research/review-state"
import { oilReviewFingerprint } from "@chaarlie/product-intake-core"
import { makeOilEnvelope } from "./fixtures/oil-research/fixture"

const temporary = mkdtempSync(join(tmpdir(), "oil-candidate-lab-"))
const candidateDirectory = join(temporary, "candidates")
const prior = {
  NODE_ENV: process.env.NODE_ENV,
  OIL_RESEARCH_LAB_REVIEW_STATE_PATH: process.env.OIL_RESEARCH_LAB_REVIEW_STATE_PATH,
  OIL_RESEARCH_LAB_CANDIDATE_DIR: process.env.OIL_RESEARCH_LAB_CANDIDATE_DIR,
}
Object.assign(process.env, {
  NODE_ENV: "development",
  OIL_RESEARCH_LAB_REVIEW_STATE_PATH: join(temporary, "review-state.json"),
  OIL_RESEARCH_LAB_CANDIDATE_DIR: candidateDirectory,
})
mkdirSync(candidateDirectory)

function localEnvelope() {
  const envelope = makeOilEnvelope()
  envelope.research_method = OIL_LOCAL_RESEARCH_METHOD as typeof envelope.research_method
  envelope.submission_id = null
  envelope.provenance.import_kind = "local"
  envelope.provenance.original_method = {
    ...envelope.provenance.original_method,
    declared_version: "v0.9",
    unrecorded_note: null,
  }
  return OilResearchEnvelopeSchema.parse(envelope)
}

function writeCandidate(index: number) {
  const candidate = createOilLabCandidatePackage({
    envelope: localEnvelope(),
    matchingSuggestions: {
      product_oil_eligibility: [
        {
          thickness: "fine",
          oil_subtype: "styling-oel",
          oil_purpose: "light_finish",
          ingredient_flags: ["oils"],
        },
      ],
      suitable_thicknesses: ["fine"],
      field_rationales: { matching: "Lokaler Entwurf; nur manuell freigeben." },
    },
    sourceManifest: {
      records: [{ path: `source-unblind/pc0${index}.json`, sha256: String(index).repeat(64) }],
    },
  })
  writeFileSync(join(candidateDirectory, `pc0${index}.json`), JSON.stringify(candidate))
  return candidate
}

for (const index of [1, 2, 3, 4]) writeCandidate(index)

const routes = Promise.all([
  import("../src/app/api/labs/research/queue/route"),
  import("../src/app/api/labs/research/review/route"),
])

after(() => {
  for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  rmSync(temporary, { recursive: true, force: true })
})

async function candidateData(itemId?: string) {
  const [queue] = await routes
  const query = new URLSearchParams({ category: "oil", dataset: "candidate" })
  if (itemId) query.set("itemId", itemId)
  const response = await queue.GET(
    new Request(`http://localhost/api/labs/research/queue?${query.toString()}`),
  )
  assert.equal(response.status, 200)
  return (await response.json()).data as import("../src/lib/labs/research/model").ResearchLabData
}

test("four local v0.9 candidates are reviewable with matching drafts and no Intake handoff", async () => {
  const data = await candidateData()
  assert.equal(data.standard, "Öl-Standard v0.9")
  assert.equal(data.queue.length, 4)
  assert.equal(
    data.detail.properties.find((property) => property.id === "matching")?.status,
    "open",
  )
  assert.ok(data.detail.properties.find((property) => property.id === "matching")?.actions.length)
  assert.match(data.detail.notices.join(" "), /Lab-Freigabe veröffentlicht kein Produkt/)

  const [, review] = await routes
  const response = await review.POST(
    new Request("http://localhost/api/labs/research/review", {
      method: "POST",
      body: JSON.stringify({
        category: "oil",
        dataset: "candidate",
        itemId: data.detail.id,
        displayFingerprint: data.detail.displayFingerprint,
        actionId: "complete",
      }),
    }),
  )
  assert.equal(response.status, 200)
  const source = getOilLabSource("candidate", data.detail.id)
  assert.equal(readOilReviewState(source).completedAt === null, false)
  assert.equal(readOilReviewState(source).handoff, undefined)
})

test("one malformed local candidate is isolated and does not hide neighbouring profiles", async () => {
  writeFileSync(join(candidateDirectory, "broken.json"), "{not json")
  try {
    const malformed = oilLabSources("candidate").find((source) => source.malformedPackage)
    assert.ok(malformed)
    const data = await candidateData(malformed.id)
    assert.equal(data.detail.status, "blocked")
    assert.match(data.detail.notices.join(" "), /lokale Forschungspaket/i)
    assert.equal(data.detail.actions.length, 0)
    assert.equal(data.queue.filter((entry) => entry.status !== "blocked").length, 4)
  } finally {
    rmSync(join(candidateDirectory, "broken.json"), { force: true })
  }
})

test("the immutable historical Lab set remains separate and does not require matching", () => {
  const historical = oilLabSources("default")
  assert.equal(historical.length, 37)
  assert.ok(historical.every((source) => !source.candidate))
  assert.ok(historical.every((source) => !source.requiredPropertyIds.includes("matching")))
})

test("a rehashed historical envelope is isolated from local candidates", async () => {
  const candidate = writeCandidate(9)
  candidate.envelopeJson = JSON.stringify(makeOilEnvelope())
  const { packageFingerprint: _old, ...body } = candidate
  void _old
  candidate.packageFingerprint = oilReviewFingerprint(body)
  writeFileSync(join(candidateDirectory, "pc09.json"), JSON.stringify(candidate))
  try {
    const malformed = oilLabSources("candidate").find((source) =>
      source.filePath.endsWith("pc09.json"),
    )
    assert.ok(malformed?.malformedPackage)
    assert.equal(malformed.envelope, null)
    const data = await candidateData(malformed.id)
    assert.equal(data.detail.status, "blocked")
    assert.equal(data.detail.actions.length, 0)
    assert.equal(data.queue.filter((entry) => entry.status !== "blocked").length, 4)
  } finally {
    rmSync(join(candidateDirectory, "pc09.json"), { force: true })
  }
})

test("candidate is rejected for non-oil categories before dataset loading", async () => {
  const [queue, review] = await routes
  assert.equal(
    (
      await queue.GET(
        new Request("http://localhost/api/labs/research/queue?category=shampoo&dataset=candidate"),
      )
    ).status,
    400,
  )
  const response = await review.POST(
    new Request("http://localhost/api/labs/research/review", {
      method: "POST",
      body: JSON.stringify({
        category: "shampoo",
        dataset: "candidate",
        itemId: "unavailable",
        displayFingerprint: "a".repeat(64),
        actionId: "complete",
      }),
    }),
  )
  assert.equal(response.status, 400)
})
