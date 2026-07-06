import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import sharp from "sharp"

import {
  REQUIRED_RESEARCH_PACKAGE_FILES,
  buildResearchPackagePath,
  prepareResearchPackages,
  validateResearchPackage,
} from "../scripts/product-intake/prepare-research"
import {
  buildResearchQueueResult,
  runAutomatedImageSearchesForPackages,
} from "../scripts/product-intake/research-queue"
import type { ProductIntakeQueueRow } from "../scripts/product-intake/queue-reporting"

function pendingRow(overrides: Partial<ProductIntakeQueueRow> = {}): ProductIntakeQueueRow {
  return {
    id: "submission-123",
    created_at: "2026-06-26T07:00:00.000Z",
    updated_at: "2026-06-26T08:00:00.000Z",
    user_id: "user-123",
    source: "chat",
    category: "shampoo",
    brand_text: "Brand",
    product_name_text: "Product",
    front_image_path: "front/path.jpg",
    barcode_image_path: null,
    status: "pending_review",
    researched_payload: null,
    ...overrides,
  }
}

test("buildResearchPackagePath creates date and submission scoped package paths", () => {
  assert.equal(
    buildResearchPackagePath({
      rootDir: "/repo",
      now: new Date("2026-06-26T10:30:00.000Z"),
      submissionId: "submission-123",
    }),
    "/repo/ops/product-intake-research/2026-06-26/submission-123",
  )
})

test("prepareResearchPackages creates the required read-only research package files", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "product-intake-research-"))
  try {
    const result = await prepareResearchPackages({
      rootDir,
      now: new Date("2026-06-26T10:30:00.000Z"),
      rows: [pendingRow()],
      imageMetadataBySubmissionId: {
        "submission-123": {
          front_image_signed_url: "https://signed.example/front",
          barcode_image_signed_url: null,
          signed_url_expires_at: "2026-06-26T11:30:00.000Z",
        },
      },
    })

    assert.equal(result.created.length, 1)
    assert.equal(result.skipped.length, 0)
    for (const fileName of REQUIRED_RESEARCH_PACKAGE_FILES) {
      assert.equal(existsSync(join(result.created[0].packagePath, fileName)), true, fileName)
    }
    assert.equal(existsSync(join(result.created[0].packagePath, "image-finalization.json")), true)

    const submission = JSON.parse(
      await readFile(join(result.created[0].packagePath, "submission.json"), "utf8"),
    ) as Record<string, unknown>
    const validation = JSON.parse(
      await readFile(join(result.created[0].packagePath, "validation.json"), "utf8"),
    ) as Record<string, unknown>
    const approval = await readFile(join(result.created[0].packagePath, "approval.md"), "utf8")

    assert.equal(submission.id, "submission-123")
    assert.deepEqual(submission.image_review, {
      front_image_signed_url: "https://signed.example/front",
      barcode_image_signed_url: null,
      signed_url_expires_at: "2026-06-26T11:30:00.000Z",
    })
    assert.equal(validation.ok, false)
    assert.match(approval, /submission-123/)
    assert.match(approval, /image-finalization\.json/)
    assert.match(approval, /Chaarlie-hosted/)
    assert.match(approval, /products:intake:approve-package/)
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
})

test("prepareResearchPackages skips existing package folders by default", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "product-intake-research-"))
  try {
    const first = await prepareResearchPackages({
      rootDir,
      now: new Date("2026-06-26T10:30:00.000Z"),
      rows: [pendingRow()],
    })
    await writeFile(join(first.created[0].packagePath, "research.md"), "keep me")

    const second = await prepareResearchPackages({
      rootDir,
      now: new Date("2026-06-26T10:30:00.000Z"),
      rows: [pendingRow()],
    })

    assert.equal(second.created.length, 0)
    assert.equal(second.skipped.length, 1)
    assert.equal(
      await readFile(join(first.created[0].packagePath, "research.md"), "utf8"),
      "keep me",
    )
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
})

test("research queue worklist reuses existing packages and marks draft shells for research", () => {
  const rows = [
    pendingRow({
      id: "submission-existing",
      brand_text: "Syoss",
      product_name_text: "Intense Fullness Shampoo",
    }),
    pendingRow({
      id: "submission-created",
      brand_text: "Codex Smoke",
      product_name_text: "Mango Conditioner",
      category: "conditioner",
    }),
  ]

  const result = buildResearchQueueResult({
    rows,
    createdPackageIds: new Set(["submission-created"]),
    hashUser: (userId) => `hash-${userId}`,
    packages: [
      {
        package_path: "/repo/ops/product-intake-research/2026-06-29/submission-existing",
        submission_id: "submission-existing",
        category: "shampoo",
        brand_text: "Syoss",
        product_name_text: "Intense Fullness Shampoo",
        validation_ok: false,
        image_status: "pending",
        image_candidate_status: "missing",
        package_state: "package_needs_research",
        package_state_reason: "No final researched payload yet",
      },
      {
        package_path: "/repo/ops/product-intake-research/2026-06-29/submission-created",
        submission_id: "submission-created",
        category: "conditioner",
        brand_text: "Codex Smoke",
        product_name_text: "Mango Conditioner",
        validation_ok: false,
        image_status: "pending",
        image_candidate_status: "missing",
        package_state: "package_needs_research",
        package_state_reason: "No final researched payload yet",
      },
    ],
  })

  assert.equal(result.total_pending, 2)
  assert.equal(result.created_packages, 1)
  assert.equal(result.existing_packages, 1)
  assert.deepEqual(
    result.items.map((item) => ({
      id: item.submission_id,
      state: item.package_state,
      created: item.created_package,
      next: item.next_step,
    })),
    [
      {
        id: "submission-existing",
        state: "package_needs_research",
        created: false,
        next: "Codex research needed before Nick review",
      },
      {
        id: "submission-created",
        state: "package_needs_research",
        created: true,
        next: "Codex research needed before Nick review",
      },
    ],
  )
  assert.match(
    result.items[0].commands.join("\n"),
    /products:intake:research -- --submission-id submission-existing/,
  )
})

test("research queue automatically searches missing package image candidates", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "product-intake-research-"))
  const originalFetch = globalThis.fetch
  try {
    const prepared = await prepareResearchPackages({
      rootDir,
      now: new Date("2026-06-30T08:00:00.000Z"),
      rows: [
        pendingRow({
          id: "submission-image-search",
          brand_text: "Balea Professional",
          product_name_text: "Hair Sealer Leave-in",
          category: "leave_in",
        }),
      ],
    })
    const packagePath = prepared.created[0].packagePath
    const productPng = await sharp({
      create: {
        width: 720,
        height: 960,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .composite([
        {
          input: await sharp({
            create: {
              width: 240,
              height: 700,
              channels: 4,
              background: { r: 247, g: 214, b: 84, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          left: 240,
          top: 130,
        },
      ])
      .toBuffer()
    const sourceImageUrl =
      "https://products.dm-static.com/images/f_auto,q_auto,c_fit,h_1000,w_1000/v1755022300/assets/pas/images/example/balea-professional-hair-sealer"

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith("https://product-search.services.dmtech.com/de/search/crawl")) {
        return new Response(
          JSON.stringify({
            products: [
              {
                tileData: {
                  self: "/p/d/3062765/balea-professional-hair-sealer",
                  images: [
                    {
                      tileSrc:
                        "https://products.dm-static.com/images/f_auto,q_auto,c_fit,h_320,w_320/v1755022300/assets/pas/images/example/balea-professional-hair-sealer",
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }
      if (url === sourceImageUrl) {
        return new Response(new Uint8Array(productPng), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      }
      return new Response("not found", { status: 404 })
    }) as typeof fetch

    const searches = await runAutomatedImageSearchesForPackages({
      rootDir,
      now: new Date("2026-06-30T08:30:00.000Z"),
      packages: [
        {
          package_path: packagePath,
          submission_id: "submission-image-search",
          category: "leave_in",
          brand_text: "Balea Professional",
          product_name_text: "Hair Sealer Leave-in",
          validation_ok: false,
          image_status: "pending",
          image_candidate_status: "missing",
          package_state: "package_needs_research",
          package_state_reason: "No product image candidate in package",
        },
      ],
    })

    assert.equal(searches.length, 1)
    assert.equal(searches[0].status, "candidate_found")
    assert.equal(searches[0].source_image_url, sourceImageUrl)
    assert.match(searches[0].local_file ?? "", /^images\/source\/replacement-.+\.png$/)

    const candidates = JSON.parse(
      await readFile(join(packagePath, "image-candidates.json"), "utf8"),
    )
    assert.equal(candidates.candidates[0].source_image_url, sourceImageUrl)
    assert.equal(existsSync(join(packagePath, candidates.candidates[0].local_file)), true)

    const imageReview = JSON.parse(await readFile(join(packagePath, "image-review.json"), "utf8"))
    assert.equal(imageReview.status, "comment")
    assert.match(imageReview.notes, /Neue Rohbild-Quelle gefunden/)
  } finally {
    globalThis.fetch = originalFetch
    await rm(rootDir, { recursive: true, force: true })
  }
})

test("validateResearchPackage rejects packages missing required files", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "product-intake-research-"))
  try {
    await writeFile(join(rootDir, "submission.json"), "{}")

    const validation = await validateResearchPackage(rootDir)

    assert.equal(validation.ok, false)
    assert.deepEqual(validation.missingFiles.sort(), [
      "approval.md",
      "payload.json",
      "research.md",
      "validation.json",
    ])
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
})

test("prepare research script has no apply flags or Supabase write/RPC calls", () => {
  const source = readFileSync("scripts/product-intake/prepare-research.ts", "utf8")

  assert.doesNotMatch(source, /flagBool\(args,\s*["']apply["']/)
  assert.doesNotMatch(source, /\.update\(/)
  assert.doesNotMatch(source, /\.insert\(/)
  assert.doesNotMatch(source, /\.upsert\(/)
  assert.doesNotMatch(source, /\.delete\(/)
  assert.doesNotMatch(source, /\.rpc\(/)
  assert.doesNotMatch(source, /--apply/)
})
