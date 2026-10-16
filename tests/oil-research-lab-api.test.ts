import assert from "node:assert/strict"
import { after, test } from "node:test"
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { getOilLabSource, oilLabSources } from "../src/lib/labs/oil-research-access"
import { mutateOilReview, readOilReviewState } from "../src/lib/oil-research/review-state"

const temp = mkdtempSync(join(tmpdir(), "oil-lab-api-"))
const corpus = join(temp, "corpus")
cpSync(
  join(process.cwd(), "data/research/oil-inci/v1.0/record-resolution-v0.1/envelopes"),
  corpus,
  { recursive: true },
)
const previous = {
  NODE_ENV: process.env.NODE_ENV,
  OIL_RESEARCH_LAB_REVIEW_STATE_PATH: process.env.OIL_RESEARCH_LAB_REVIEW_STATE_PATH,
  OIL_RESEARCH_LAB_CORPUS_DIR: process.env.OIL_RESEARCH_LAB_CORPUS_DIR,
  OIL_RESEARCH_LAB_BUNDLE_DIR: process.env.OIL_RESEARCH_LAB_BUNDLE_DIR,
}
Object.assign(process.env, {
  NODE_ENV: "development",
  OIL_RESEARCH_LAB_REVIEW_STATE_PATH: join(temp, "state.json"),
  OIL_RESEARCH_LAB_CORPUS_DIR: corpus,
  OIL_RESEARCH_LAB_BUNDLE_DIR: join(temp, "bundles"),
})
const routes = Promise.all([
  import("../src/app/api/labs/research/queue/route"),
  import("../src/app/api/labs/research/review/route"),
  import("../src/app/api/labs/oil-research/review/route"),
])
after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  rmSync(temp, { recursive: true, force: true })
})
async function read(id = "oil-persistence-06") {
  const [queue] = await routes
  const res = await queue.GET(
    new Request(
      `http://localhost/api/labs/research/queue?category=oil&dataset=default&itemId=${id}`,
    ),
  )
  assert.equal(res.status, 200)
  return (await res.json()).data as import("../src/lib/labs/research/model").ResearchLabData
}
async function post(data: Awaited<ReturnType<typeof read>>, actionId: string, comment?: string) {
  const [, route] = await routes
  return route.POST(
    new Request("http://localhost/api/labs/research/review", {
      method: "POST",
      body: JSON.stringify({
        category: "oil",
        dataset: "default",
        itemId: data.detail.id,
        displayFingerprint: data.detail.displayFingerprint,
        actionId,
        ...(comment ? { comment } : {}),
      }),
    }),
  )
}

test("oil shared API faithfully exposes 37 historical profiles and manual matching stays absent", async () => {
  const data = await read()
  assert.equal(data.queue.length, 37)
  assert.equal(data.detail.properties.find((p) => p.id === "weight")?.value, "Mittel")
  assert.match(
    data.detail.properties.find((p) => p.id === "provides_uv_protection")!.reasoning!,
    /filter AND accepted exact-product/,
  )
  assert.equal(data.detail.properties.find((p) => p.id === "matching")?.actions.length, 0)
  assert.equal(data.detail.properties.find((p) => p.id === "matching")?.lanes.length, 0)
  assert.equal(data.detail.properties.find((p) => p.id === "weight")?.lanes.length, 1)
  assert.match(data.detail.notices.join(" "), /nur lokal/)
  assert.equal(data.detail.displayFingerprint, (await read()).detail.displayFingerprint)
})
test("native and shared mutation guards preserve source bindings and stale review revision", async () => {
  const data = await read()
  const nativeBody = data.detail.properties.find((p) => p.id === "weight")!.actions[0].nativeBody
  assert.equal((await post(data, "approve:weight")).status, 200)
  const current = await read()
  assert.equal(current.detail.properties.find((p) => p.id === "weight")?.status, "approved")
  assert.equal((await post(data, "approve:base")).status, 409)
  const [, , native] = await routes
  assert.equal(
    (await native.handleOilResearchReviewRequest({ body: { ...nativeBody, propertyPath: "base" } }))
      .status,
    409,
  )
  assert.equal(
    (
      await native.handleOilResearchReviewRequest({
        body: { ...current.detail.actions[0].nativeBody, packageFingerprint: "0".repeat(64) },
      })
    ).status,
    409,
  )
  const file = getOilLabSource("default", data.detail.id).filePath
  const bytes = readFileSync(file, "utf8")
  writeFileSync(file, `${bytes}\n`)
  assert.equal((await post(current, "approve:base")).status, 409)
  writeFileSync(file, bytes)
})
test("targeted rework persists comments and blocks bulk or direct same-source approval", async () => {
  const data = await read()
  assert.equal(
    (await post(data, "rework:base", "Bitte Trägersystem anhand der INCI prüfen.")).status,
    200,
  )
  const current = await read()
  assert.equal(current.detail.properties.find((p) => p.id === "base")?.status, "rework")
  assert.match(
    current.detail.properties.find((p) => p.id === "base")!.annotations.join(" "),
    /Trägersystem/,
  )
  assert.equal((await post(current, "complete")).status, 409)
  const source = getOilLabSource("default", current.detail.id)
  const state = readOilReviewState(source)
  await assert.rejects(
    mutateOilReview({
      loadSource: () => source,
      packageFingerprint: source.packageFingerprint,
      reviewRevision: state.revision,
      action: "approve_property",
      propertyPath: "base",
    }),
    /Nacharbeit braucht/,
  )
})
test("native disk lock rejects a competing process without claiming a save", async () => {
  const source = getOilLabSource("default", "oil-persistence-07")
  const state = readOilReviewState(source)
  const body = {
    dataset: "default",
    itemId: source.id,
    packageFingerprint: source.packageFingerprint,
    reviewRevision: state.revision,
    action: "approve_property",
    propertyPath: "weight",
  }
  const lock = `${process.env.OIL_RESEARCH_LAB_REVIEW_STATE_PATH}.lock`
  writeFileSync(lock, "held by other process")
  const script = `import native from './src/app/api/labs/oil-research/review/route.ts'; const r=await native.handleOilResearchReviewRequest({body:${JSON.stringify(body)}}); process.stdout.write(String(r.status));`
  const status = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "./tests/server-only-register.cjs",
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        script,
      ],
      { env: process.env },
    )
    let out = "",
      err = ""
    child.stdout.on("data", (chunk) => (out += chunk))
    child.stderr.on("data", (chunk) => (err += chunk))
    child.on("error", reject)
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err))))
  })
  rmSync(lock)
  assert.equal(status, "409")
  assert.equal(readOilReviewState(source).revision, 0)
})
test("unsupported category/dataset pairs reject before loading and production routes remain closed", async () => {
  const [queue, shared, native] = await routes
  assert.equal(
    (
      await queue.GET(
        new Request("http://localhost/api/labs/research/queue?category=mask&dataset=intake"),
      )
    ).status,
    400,
  )
  assert.equal(
    (
      await queue.GET(
        new Request("http://localhost/api/labs/research/queue?category=oil&dataset=pilot"),
      )
    ).status,
    400,
  )
  Object.assign(process.env, { NODE_ENV: "production" })
  try {
    assert.equal(
      (await queue.GET(new Request("http://localhost/api/labs/research/queue?category=oil")))
        .status,
      404,
    )
    assert.equal(
      (await shared.POST(new Request("http://localhost", { method: "POST", body: "{}" }))).status,
      404,
    )
    assert.equal(
      (await native.POST(new Request("http://localhost", { method: "POST", body: "{}" }))).status,
      404,
    )
  } finally {
    Object.assign(process.env, { NODE_ENV: "development" })
  }
})

test("intake matching is explicit, missing drafts block completion, and revised matching reopens review", async () => {
  const { buildOilLabReviewPackage, packageFingerprint, intakeSnapshotFingerprint } =
    await import("../src/lib/oil-research/lab-package")
  const { detailFixture } = await import("./oil-lab-handoff-fixture")
  const { mkdirSync } = await import("node:fs")
  const dir = process.env.OIL_RESEARCH_LAB_BUNDLE_DIR!
  mkdirSync(dir, { recursive: true })
  const valid = buildOilLabReviewPackage(detailFixture())
  const file = join(dir, "current.json")
  writeFileSync(file, JSON.stringify(valid))
  const [queue, shared, native] = await routes
  async function dataFor() {
    const response = await queue.GET(
      new Request("http://localhost/api/labs/research/queue?category=oil&dataset=intake"),
    )
    assert.equal(response.status, 200)
    return (await response.json()).data as import("../src/lib/labs/research/model").ResearchLabData
  }
  const data = await dataFor()
  assert.match(data.detail.properties.find((p) => p.id === "matching")!.value, /natuerliches-oel/)
  const response = await shared.POST(
    new Request("http://localhost/api/labs/research/review", {
      method: "POST",
      body: JSON.stringify({
        category: "oil",
        dataset: "intake",
        itemId: data.detail.id,
        displayFingerprint: data.detail.displayFingerprint,
        actionId: "complete",
      }),
    }),
  )
  assert.equal(response.status, 200)
  const approved = await dataFor()
  assert.equal(approved.detail.status, "approved")
  assert.equal(approved.detail.properties.find((p) => p.id === "matching")?.status, "approved")
  const incomplete = structuredClone(valid)
  delete (incomplete.intakeReviewSnapshot.rawPropertyScope.product as Record<string, unknown>)
    .suitable_thicknesses
  delete (incomplete.intakeReviewSnapshot.normalizedFinal.product as Record<string, unknown>)
    .suitable_thicknesses
  delete incomplete.matchingSuggestions.suitable_thicknesses
  incomplete.snapshotFingerprint = intakeSnapshotFingerprint(incomplete.intakeReviewSnapshot)
  const { packageFingerprint: _, ...body } = incomplete
  incomplete.packageFingerprint = packageFingerprint(body)
  writeFileSync(file, JSON.stringify(incomplete))
  const reopened = await dataFor()
  assert.notEqual(reopened.detail.id, approved.detail.id)
  assert.equal(reopened.detail.status, "blocked")
  assert.equal(reopened.detail.properties.find((p) => p.id === "matching")?.status, "blocked")
  assert.equal(
    (await native.handleOilResearchReviewRequest({ body: reopened.detail.actions[0].nativeBody }))
      .status,
    409,
  )
  writeFileSync(file, JSON.stringify(valid))
})

test("malformed and duplicate intake files do not hide valid neighbouring bundles", async () => {
  const dir = process.env.OIL_RESEARCH_LAB_BUNDLE_DIR!
  const malformedPath = join(dir, "broken-export.json")
  const duplicatePath = join(dir, "current (1).json")
  writeFileSync(malformedPath, "{not valid JSON")
  cpSync(join(dir, "current.json"), duplicatePath)
  try {
    const malformed = oilLabSources("intake").find((source) => source.malformedPackage)
    assert.ok(malformed)
    const [queue] = await routes
    const response = await queue.GET(
      new Request(
        `http://localhost/api/labs/research/queue?category=oil&dataset=intake&itemId=${malformed.id}`,
      ),
    )
    assert.equal(response.status, 200)
    const data = (await response.json())
      .data as import("../src/lib/labs/research/model").ResearchLabData
    assert.ok(data.queue.some((entry) => entry.status === "open" || entry.status === "approved"))
    assert.equal(new Set(data.queue.map((entry) => entry.id)).size, data.queue.length)
    assert.equal(data.detail.status, "blocked")
    assert.equal(data.detail.actions.length, 0)
    assert.match(data.detail.blockers.join(" "), /konnte nicht gelesen werden/i)
  } finally {
    unlinkSync(malformedPath)
    unlinkSync(duplicatePath)
  }
})

test("local rework revokes handoff, pending transfer holds lock and remains read-only after unknown result", async () => {
  const { readOilLabPackage } = await import("../src/lib/oil-research/lab-package")
  const { withOilReviewHandoff } = await import("../src/lib/oil-research/review-state")
  const bundlePath = join(process.env.OIL_RESEARCH_LAB_BUNDLE_DIR!, "current.json")
  const bundle = readOilLabPackage(bundlePath)
  const source = getOilLabSource("intake", bundle.packageFingerprint)
  const [, , native] = await routes
  const options = { bundlePath, packageFingerprint: bundle.packageFingerprint }
  const previous = readOilReviewState(source)
  const nativeBody = {
    dataset: "intake",
    itemId: source.id,
    packageFingerprint: source.packageFingerprint,
    reviewRevision: previous.revision,
    action: "request_rework",
    propertyPath: "matching",
    comment: "Bitte Haardicke nochmals prüfen.",
  }
  assert.equal((await native.handleOilResearchReviewRequest({ body: nativeBody })).status, 200)
  let callbackCalled = false
  await assert.rejects(
    withOilReviewHandoff(options, async () => {
      callbackCalled = true
    }),
    /vollständig geprüfte/,
  )
  assert.equal(callbackCalled, false)
  // A new immutable revision is required after rework; use an isolated store for this current package.
  const storePath = join(temp, "pending-state.json")
  await mutateOilReview({
    loadSource: () => source,
    packageFingerprint: source.packageFingerprint,
    reviewRevision: 0,
    action: "approve_product",
    storePath,
  })
  let receiptId: string | undefined
  await assert.rejects(
    withOilReviewHandoff({ ...options, storePath }, async (receipt) => {
      receiptId = receipt.receiptId
      assert.equal(readOilReviewState(source, storePath).handoff?.status, "handoff_pending")
      await assert.rejects(
        mutateOilReview({
          loadSource: () => source,
          packageFingerprint: source.packageFingerprint,
          reviewRevision: 1,
          action: "request_rework",
          propertyPath: "matching",
          comment: "Concurrent revoke",
          storePath,
        }),
        /andere Öl-Prüfung/,
      )
      throw new Error("RPC outcome unknown")
    }),
    /RPC outcome unknown/,
  )
  assert.equal(readOilReviewState(source, storePath).handoff?.status, "handoff_pending")
  await assert.rejects(
    mutateOilReview({
      loadSource: () => source,
      packageFingerprint: source.packageFingerprint,
      reviewRevision: 1,
      action: "request_rework",
      propertyPath: "matching",
      comment: "Revoke after timeout",
      storePath,
    }),
    /Übergabe gesperrt/,
  )
  await withOilReviewHandoff({ ...options, storePath }, async (receipt) => {
    assert.equal(receipt.receiptId, receiptId)
  })
  assert.equal(readOilReviewState(source, storePath).handoff?.status, "handed_off")
  await assert.rejects(
    mutateOilReview({
      loadSource: () => source,
      packageFingerprint: source.packageFingerprint,
      reviewRevision: 1,
      action: "request_rework",
      propertyPath: "matching",
      comment: "Revoke after import",
      storePath,
    }),
    /Übergabe gesperrt/,
  )
})
