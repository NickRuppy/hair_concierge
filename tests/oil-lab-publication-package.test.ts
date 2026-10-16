import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { approveResearchPackage } from "../scripts/product-intake/approve-package"
import { publicationImage } from "./oil-lab-publication-fixture"
import { detailFixture } from "./oil-lab-handoff-fixture"
import type { ReviewActionSubmission } from "../scripts/product-intake/review-actions"

test("oil package rejects changed properties and stale DB binding before upload or payload replacement", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "oil-publication-package-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const detail = detailFixture(),
    payload = structuredClone(detail.payload) as any
  payload.final.review.manual_reviewed = true
  Object.assign(payload.final.product, {
    image_url: publicationImage.planned_public_url,
    canonical_image_sha256: publicationImage.asset_sha256,
    thumbnail_image_url: publicationImage.thumbnail_public_url,
  })
  const dir = join(root, detail.id)
  await mkdir(dir)
  for (const [name, value] of Object.entries({
    "submission.json": { id: detail.id },
    "payload.json": payload,
    "validation.json": {},
  }))
    await writeFile(join(dir, name), JSON.stringify(value))
  for (const name of ["research.md", "approval.md"]) await writeFile(join(dir, name), "fixture")
  const calls: string[] = []
  const submission = {
    id: detail.id,
    category: "oil",
    status: "ready_for_review",
    researched_payload: structuredClone(payload),
  } as ReviewActionSubmission
  const imageDecision = {
    status: "approved_asset",
    storage_bucket: "product-images",
    storage_path: "oil-fixture.png",
    public_url: publicationImage.planned_public_url,
    source_page_url: "https://example.com/product",
    source_type: "brand",
    quality_confidence: "high",
    processing_method: "local",
    final_file: "/fixture/final.png",
    asset_sha256: publicationImage.asset_sha256,
    thumbnail_storage_path: "thumbnails/search-v1/" + publicationImage.asset_sha256 + ".webp",
    thumbnail_public_url: publicationImage.thumbnail_public_url,
    thumbnail_final_file: "/fixture/thumb.webp",
    thumbnail_asset_sha256: "b".repeat(64),
    user_approved: true,
  }
  await writeFile(join(dir, "image-finalization.json"), JSON.stringify(imageDecision))
  // Only the current receipt read is permitted before the Oil guard. Other
  // queries or RPCs would mean this negative control reached another boundary.
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: null, error: null }),
  }
  const deps = {
    createSupabaseClient: () =>
      ({
        from: (table: string) => {
          assert.equal(table, "product_intake_publication_receipts")
          return query
        },
        rpc: async (name: string) => {
          calls.push(name)
          assert.equal(name, "product_intake_oil_publication_preflight")
          return { data: null, error: new Error("Current oil Lab approval required") }
        },
      }) as any,
    loadSubmissionById: async () => submission,
    savePayload: async () => {
      calls.push("replace")
      throw new Error("unexpected payload mutation")
    },
  }
  payload.final.product.price_eur = 11
  await writeFile(join(dir, "payload.json"), JSON.stringify(payload))
  await assert.rejects(
    approveResearchPackage({
      packageDir: dir,
      reviewedBy: "nick",
      reviewNotes: null,
      apply: true,
      confirm: true,
      deps,
    }),
    /package is stale/,
  )
  assert.deepEqual(calls, [])
  payload.final.product.price_eur = 10
  await writeFile(join(dir, "payload.json"), JSON.stringify(payload))
  await assert.rejects(
    approveResearchPackage({
      packageDir: dir,
      reviewedBy: "nick",
      reviewNotes: null,
      apply: true,
      confirm: true,
      deps,
    }),
    /Current oil Lab approval required/,
  )
  assert.deepEqual(calls, ["product_intake_oil_publication_preflight"])
  calls.length = 0
  const current = submission.researched_payload as any
  const binding = current.draft.oil_research_binding
  current.draft.oil_research_binding = {
    ...binding,
    artifact_id: "00000000-0000-4000-8000-000000000099",
  }
  await assert.rejects(
    approveResearchPackage({
      packageDir: dir,
      reviewedBy: "nick",
      reviewNotes: null,
      apply: true,
      confirm: true,
      deps,
    }),
    /package is stale/,
  )
  assert.deepEqual(calls, [])
  current.draft.oil_research_binding = binding
  // Generic package tests own byte/image publication success; this owner guards
  // Oil-specific stale payload/binding rejection before any mutation.
  const originalCurrent = submission.researched_payload
  Reflect.set(submission, "researched_payload", null)
  await assert.rejects(
    approveResearchPackage({
      packageDir: dir,
      reviewedBy: "nick",
      reviewNotes: null,
      apply: true,
      confirm: true,
      deps,
    }),
    /current payload is missing/,
  )
  submission.researched_payload = originalCurrent
  delete (submission.researched_payload as any).draft.oil_research_binding
  delete payload.draft.oil_research_binding
  await writeFile(join(dir, "payload.json"), JSON.stringify(payload))
  await assert.rejects(
    approveResearchPackage({
      packageDir: dir,
      reviewedBy: "nick",
      reviewNotes: null,
      apply: true,
      confirm: true,
      deps,
    }),
    /research binding is missing/,
  )
  assert.deepEqual(calls, [], "missing bindings must never compare equal and advance")
})
