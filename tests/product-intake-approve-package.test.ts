import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import {
  approveResearchPackage,
  readResearchPackage,
} from "../scripts/product-intake/approve-package"
import { uploadApprovedPackageImage } from "../scripts/product-intake/upload-package-image"
import type { ReviewActionSubmission } from "../scripts/product-intake/review-actions"

function submission(overrides: Partial<ReviewActionSubmission> = {}): ReviewActionSubmission {
  return {
    id: "submission-1",
    created_at: "2026-06-26T10:00:00.000Z",
    updated_at: "2026-06-26T10:01:00.000Z",
    user_id: "user-1",
    source: "chat",
    source_conversation_id: "conversation-1",
    user_product_usage_id: "usage-1",
    intake_method: "text",
    category: "conditioner",
    brand_text: "Jean & Len",
    product_name_text: "Granatapfel Conditioner",
    frequency_range: "weekly_1x",
    front_image_path: null,
    barcode_image_path: null,
    front_image_validation_status: null,
    front_image_validation_metadata: {},
    barcode_image_validation_status: null,
    barcode_image_validation_metadata: {},
    previous_product_id: null,
    previous_product_snapshot: null,
    status: "pending_review",
    researched_payload: {},
    intake_history: [],
    reviewed_at: null,
    reviewed_by: null,
    review_notes: null,
    user_facing_resolution_reason: null,
    user_facing_next_step: null,
    user_facing_missing_fields: [],
    approved_product_id: null,
    notification_sent_at: null,
    cleanup_after: null,
    photos_deleted_at: null,
    ...overrides,
  } as ReviewActionSubmission
}

async function writePackage(params: {
  root: string
  submissionId?: string
  folderId?: string
  metadataSubmissionId?: string
  payload?: unknown
  imageFinalization?: unknown
  omitFiles?: string[]
}) {
  const submissionId = params.submissionId ?? "submission-1"
  const omitFiles = new Set(params.omitFiles ?? [])
  const dir = join(params.root, params.folderId ?? submissionId)
  await mkdir(dir, { recursive: true })
  if (!omitFiles.has("submission.json")) {
    await writeFile(
      join(dir, "submission.json"),
      `${JSON.stringify(
        {
          id: submissionId,
          category: "conditioner",
          package_metadata: {
            submission_id: params.metadataSubmissionId ?? submissionId,
          },
        },
        null,
        2,
      )}\n`,
    )
  }
  if (!omitFiles.has("payload.json")) {
    await writeFile(
      join(dir, "payload.json"),
      `${JSON.stringify(params.payload ?? { draft: { sources: [] } }, null, 2)}\n`,
    )
  }
  if (params.imageFinalization !== undefined) {
    await writeFile(
      join(dir, "image-finalization.json"),
      `${JSON.stringify(params.imageFinalization, null, 2)}\n`,
    )
  }
  for (const fileName of ["research.md", "validation.json", "approval.md"]) {
    if (omitFiles.has(fileName)) continue
    const content = fileName.endsWith(".json") ? "{}\n" : `# ${fileName}\n`
    await writeFile(join(dir, fileName), content, "utf8")
  }
  return dir
}

const chaarlieImageUrl =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake-2026-06-26/submission-1/granatapfel-conditioner-aaaaaaaaaaaa.webp"

function approvedImageFinalization(overrides: Record<string, unknown> = {}) {
  return {
    status: "approved_asset",
    storage_bucket: "product-images",
    storage_path:
      "product-intake-2026-06-26/submission-1/granatapfel-conditioner-aaaaaaaaaaaa.webp",
    public_url: chaarlieImageUrl,
    source_page_url: "https://example.com/products/granatapfel-conditioner",
    source_image_url: "https://example.com/images/granatapfel-conditioner.jpg",
    source_type: "brand",
    quality_confidence: "high",
    processing_method: "local",
    final_file: "images/final/granatapfel-conditioner.webp",
    asset_sha256: "a".repeat(64),
    user_approved: true,
    reviewed_by: "nick",
    reviewed_at: "2026-06-26T10:00:00.000Z",
    notes: "Exact product image normalized with the product-image pipeline.",
    ...overrides,
  }
}

async function writeApprovedImageFile(dir: string, content = "final image bytes") {
  await mkdir(join(dir, "images", "final"), { recursive: true })
  const file = join(dir, "images", "final", "granatapfel-conditioner.webp")
  await writeFile(file, content)
  const assetSha256 = createHash("sha256")
    .update(await readFile(file))
    .digest("hex")
  return { file, assetSha256 }
}

function fakeStorageClient() {
  const objects = new Map<string, Buffer>()
  const calls: string[] = []
  const client = {
    storage: {
      from(bucketName: string) {
        return {
          async download(path: string) {
            calls.push(`download:${bucketName}:${path}`)
            const data = objects.get(path)
            return data
              ? { data: new Blob([new Uint8Array(data)]), error: null }
              : { data: null, error: { message: "not found" } }
          },
          async upload(
            path: string,
            bytes: Buffer,
            options: { contentType?: string; upsert?: boolean },
          ) {
            calls.push(
              `upload:${bucketName}:${path}:${options.contentType ?? ""}:${String(options.upsert)}`,
            )
            objects.set(path, Buffer.from(bytes))
            return { data: { path }, error: null }
          },
        }
      },
    },
  }

  return { client, calls, objects }
}

function noImageFinalization() {
  return {
    status: "no_image_approved_for_now",
    reason: "not_needed_for_v1",
    notes: "Nick approved this product without a final image for now.",
    reviewed_by: "nick",
    reviewed_at: "2026-06-26T10:00:00.000Z",
  }
}

function readyPayload(imageUrl: string | null = chaarlieImageUrl) {
  return {
    final: {
      product: {
        canonical_brand: "Jean & Len",
        product_line: null,
        clean_name: "Granatapfel Conditioner",
        category_key: "conditioner",
        affiliate_link: "https://example.com/products/granatapfel-conditioner",
        image_url: imageUrl,
        price_eur: 4.99,
        currency: "EUR",
        purchase_link_status: "available",
        purchase_link_checked_at: "2026-06-26T10:00:00.000Z",
        price_checked_at: "2026-06-26T10:00:00.000Z",
      },
      identifiers: [],
      category_specs: {
        product_conditioner_specs: [
          {
            thickness: "fine",
            protein_moisture_balance: "stretches_bounces",
          },
        ],
        product_conditioner_rerank_specs: {
          weight: "medium",
          repair_level: "low",
          balance_direction: null,
          ingredient_flags: [],
        },
      },
      sources: [
        {
          url: "https://example.com/products/granatapfel-conditioner",
          title: "Jean & Len Granatapfel Conditioner",
          evidence: "Reviewed product page with matching brand, product name, and category.",
        },
      ],
      field_rationales: {
        "product.canonical_brand": "Brand matches the submitted product.",
        "product.clean_name": "Clean product name matches the submitted product.",
        "product.category_key": "Category is conditioner in the submitted usage.",
        "product.affiliate_link": "Reviewed source provides a stable product page.",
        "product.image_url": "Reviewed source provides a product image.",
        "product.price_eur": "Reviewed source provides a current price.",
        "product.purchase_link_status": "Reviewed source confirms availability.",
        "category_specs.product_conditioner_specs":
          "Conditioner specs are reviewed for test approval.",
        "category_specs.product_conditioner_rerank_specs":
          "Conditioner rerank specs are reviewed for test approval.",
      },
      review: {
        manual_reviewed: true,
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T10:00:00.000Z",
      },
    },
  }
}

test("readResearchPackage rejects package folders whose id differs from submission id", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({ root, submissionId: "submission-1", folderId: "other-id" })

  await assert.rejects(
    () => readResearchPackage(dir),
    /folder id other-id does not match submission submission-1/,
  )
})

test("readResearchPackage rejects incomplete package folders and metadata mismatches", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const incompleteDir = await writePackage({
    root,
    folderId: "incomplete",
    omitFiles: ["approval.md"],
  })

  await assert.rejects(
    () => readResearchPackage(incompleteDir),
    /missing required files: approval\.md/,
  )

  const metadataMismatchDir = await writePackage({
    root,
    submissionId: "submission-1",
    metadataSubmissionId: "other-submission",
  })

  await assert.rejects(
    () => readResearchPackage(metadataMismatchDir),
    /metadata submission other-submission does not match submission submission-1/,
  )
})

test("approveResearchPackage dry-run does not save or approve", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({ root })
  const calls: string[] = []

  const result = await approveResearchPackage({
    packageDir: dir,
    reviewedBy: "nick",
    reviewNotes: null,
    apply: false,
    confirm: false,
    deps: {
      createSupabaseClient: () => ({}) as never,
      loadSubmissionById: async () => {
        calls.push("load")
        return submission()
      },
      savePayload: async () => {
        calls.push("save")
        throw new Error("should not save in dry-run")
      },
      approveById: async () => {
        calls.push("approve")
        throw new Error("should not approve in dry-run")
      },
    },
  })

  assert.equal(result.mode, "dry_run")
  assert.deepEqual(calls, ["load"])
  assert.equal(result.approval.will_reload_submission_after_research_save, true)
  assert.equal(result.image_upload.will_upload_or_verify_before_db_approval, false)
})

test("approveResearchPackage requires confirm before write mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({ root })

  await assert.rejects(
    () =>
      approveResearchPackage({
        packageDir: dir,
        reviewedBy: "nick",
        reviewNotes: null,
        apply: true,
        confirm: false,
        deps: {
          createSupabaseClient: () => ({}) as never,
          loadSubmissionById: async () => submission(),
        },
      }),
    /Approve-package writes require --confirm/,
  )
})

test("approveResearchPackage refuses to write incomplete payloads", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({ root })
  const calls: string[] = []

  await assert.rejects(
    () =>
      approveResearchPackage({
        packageDir: dir,
        reviewedBy: "nick",
        reviewNotes: null,
        apply: true,
        confirm: true,
        deps: {
          createSupabaseClient: () => ({}) as never,
          loadSubmissionById: async () => {
            calls.push("load")
            return submission()
          },
          savePayload: async () => {
            calls.push("save")
            throw new Error("should not save invalid package")
          },
          approveById: async () => {
            calls.push("approve")
            throw new Error("should not approve invalid package")
          },
        },
      }),
    /requires a complete ready_for_review payload/,
  )
  assert.deepEqual(calls, ["load"])
})

test("approveResearchPackage refuses to write when package only has a raw remote image URL", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({
    root,
    payload: readyPayload("https://example.com/images/granatapfel-conditioner.jpg"),
  })
  const calls: string[] = []

  await assert.rejects(
    () =>
      approveResearchPackage({
        packageDir: dir,
        reviewedBy: "nick",
        reviewNotes: null,
        apply: true,
        confirm: true,
        deps: {
          createSupabaseClient: () => ({}) as never,
          loadSubmissionById: async () => {
            calls.push("load")
            return submission()
          },
          savePayload: async () => {
            calls.push("save")
            throw new Error("should not save without final image decision")
          },
          approveById: async () => {
            calls.push("approve")
            throw new Error("should not approve without final image decision")
          },
        },
      }),
    /requires approved product image finalization/,
  )
  assert.deepEqual(calls, ["load"])
})

test("approveResearchPackage refuses to write when approved image metadata does not match payload image_url", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({
    root,
    payload: readyPayload("https://example.com/images/granatapfel-conditioner.jpg"),
    imageFinalization: approvedImageFinalization(),
  })

  await assert.rejects(
    () =>
      approveResearchPackage({
        packageDir: dir,
        reviewedBy: "nick",
        reviewNotes: null,
        apply: true,
        confirm: true,
        deps: {
          createSupabaseClient: () => ({}) as never,
          loadSubmissionById: async () => submission(),
        },
      }),
    /does not match final.product.image_url/,
  )
})

test("approveResearchPackage can write with explicit no-image reviewer decision", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({
    root,
    payload: readyPayload(null),
    imageFinalization: noImageFinalization(),
  })
  const calls: string[] = []

  const result = await approveResearchPackage({
    packageDir: dir,
    reviewedBy: "nick",
    reviewNotes: "no image approved",
    apply: true,
    confirm: true,
    deps: {
      createSupabaseClient: () => ({}) as never,
      loadSubmissionById: async () => {
        calls.push("load")
        return submission()
      },
      savePayload: async () => {
        calls.push("save")
        return {
          submission_id: "submission-1",
          status: "pending_review",
          next_status: "ready_for_review",
          dry_run: { ok: true, missingFields: [], normalizedPayload: {}, targetSpecOperations: [] },
          researched_payload: {},
        } as never
      },
      approveById: async () => {
        calls.push("approve")
        return { product_id: "product-1" } as never
      },
    },
  })

  assert.equal(result.mode, "applied")
  assert.deepEqual(calls, ["load", "save", "approve"])
})

test("uploadApprovedPackageImage dry-run reports approved target without writing", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({ root, imageFinalization: noImageFinalization() })
  const image = await writeApprovedImageFile(dir)
  const finalization = approvedImageFinalization({ asset_sha256: image.assetSha256 })
  const storage = fakeStorageClient()

  const result = await uploadApprovedPackageImage({
    supabase: storage.client as never,
    packageDir: dir,
    imageFinalization: finalization,
    apply: false,
    confirm: false,
  })

  assert.equal(result.status, "dry_run")
  assert.equal(result.content_type, "image/webp")
  assert.deepEqual(storage.calls, [])
})

test("uploadApprovedPackageImage uploads and verifies an approved final asset", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({ root, imageFinalization: noImageFinalization() })
  const image = await writeApprovedImageFile(dir)
  const finalization = approvedImageFinalization({ asset_sha256: image.assetSha256 })
  const storage = fakeStorageClient()

  const result = await uploadApprovedPackageImage({
    supabase: storage.client as never,
    packageDir: dir,
    imageFinalization: finalization,
    apply: true,
    confirm: true,
  })

  assert.equal(result.status, "uploaded")
  assert.deepEqual(storage.calls, [
    "download:product-images:product-intake-2026-06-26/submission-1/granatapfel-conditioner-aaaaaaaaaaaa.webp",
    "upload:product-images:product-intake-2026-06-26/submission-1/granatapfel-conditioner-aaaaaaaaaaaa.webp:image/webp:false",
    "download:product-images:product-intake-2026-06-26/submission-1/granatapfel-conditioner-aaaaaaaaaaaa.webp",
  ])
})

test("uploadApprovedPackageImage refuses a final asset whose checksum changed", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({ root, imageFinalization: noImageFinalization() })
  await writeApprovedImageFile(dir, "different bytes")

  await assert.rejects(
    () =>
      uploadApprovedPackageImage({
        supabase: fakeStorageClient().client as never,
        packageDir: dir,
        imageFinalization: approvedImageFinalization({ asset_sha256: "a".repeat(64) }),
        apply: true,
        confirm: true,
      }),
    /Local final image SHA-256 does not match image-finalization\.json/,
  )
})

test("approveResearchPackage apply saves payload before using existing approval path", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-package-"))
  const dir = await writePackage({
    root,
    payload: readyPayload(),
    imageFinalization: approvedImageFinalization(),
  })
  const calls: string[] = []

  const result = await approveResearchPackage({
    packageDir: dir,
    reviewedBy: "nick",
    reviewNotes: "looks good",
    apply: true,
    confirm: true,
    deps: {
      createSupabaseClient: () => ({}) as never,
      loadSubmissionById: async () => {
        calls.push("load")
        return submission()
      },
      savePayload: async () => {
        calls.push("save")
        return {
          submission_id: "submission-1",
          status: "pending_review",
          next_status: "ready_for_review",
          dry_run: { ok: true, missingFields: [], normalizedPayload: {}, targetSpecOperations: [] },
          researched_payload: {},
        } as never
      },
      approveById: async (params) => {
        calls.push(`approve:${params.submissionId}:${params.reviewedBy}:${params.reviewNotes}`)
        return { product_id: "product-1" } as never
      },
      uploadFinalImage: async () => {
        calls.push("upload-image")
        return {
          status: "uploaded",
          bucket: "product-images",
          storage_path:
            "product-intake-2026-06-26/submission-1/granatapfel-conditioner-aaaaaaaaaaaa.webp",
          public_url: chaarlieImageUrl,
          local_file: "images/final/granatapfel-conditioner.webp",
          content_type: "image/webp",
          asset_sha256: "a".repeat(64),
        }
      },
    },
  })

  assert.equal(result.mode, "applied")
  assert.deepEqual(calls, ["load", "upload-image", "save", "approve:submission-1:nick:looks good"])
  assert.equal(result.image_upload.status, "uploaded")
})
