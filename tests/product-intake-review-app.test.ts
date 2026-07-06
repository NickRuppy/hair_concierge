import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import sharp from "sharp"

import { finalizeProductIntakePackageImage } from "../scripts/product-intake/finalize-package-image"
import {
  applySignedUploadUrls,
  classifyReviewPackageState,
  createReviewAppServer,
  renderAppHtml,
  listReviewPackages,
  readReviewPackage,
  requestReplacementImageSearch,
  saveImageCandidateReview,
  saveImageFinalizationDecision,
  savePackageApprovalDecision,
  savePropertyReviewDecision,
} from "../scripts/product-intake/review-app"

const publicUrl =
  "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-06-26/submission-1/granatapfel-aaaaaaaaaaaa.webp"

function approvedImageDecision() {
  return {
    status: "approved_asset" as const,
    storage_bucket: "product-images" as const,
    storage_path: "product-intake/2026-06-26/submission-1/granatapfel-aaaaaaaaaaaa.webp",
    public_url: publicUrl,
    source_page_url: "https://www.jeanlen.de/product",
    source_image_url: "https://www.jeanlen.de/source.jpg",
    source_type: "brand" as const,
    quality_confidence: "high" as const,
    processing_method: "local" as const,
    final_file: "images/final/granatapfel.webp",
    asset_sha256: "a".repeat(64),
    user_approved: true as const,
    reviewed_by: "nick",
    reviewed_at: "2026-06-26T12:00:00.000Z",
    notes: "Exact normalized image approved.",
  }
}

async function writePackage(root: string, submissionId = "submission-1") {
  const dir = join(root, "ops", "product-intake-research", "2026-06-26", submissionId)
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, "submission.json"),
    `${JSON.stringify(
      {
        id: submissionId,
        category: "conditioner",
        brand_text: "Jean & Len",
        product_name_text: "Granatapfel Conditioner",
        front_image_path: "front/path.jpg",
        barcode_image_path: "barcode/path.jpg",
        image_review: {
          front_image_signed_url: "https://signed.example/front",
          barcode_image_signed_url: null,
          signed_url_expires_at: "2026-06-26T12:00:00.000Z",
        },
        package_metadata: { submission_id: submissionId },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    join(dir, "payload.json"),
    `${JSON.stringify(
      {
        final: {
          product: {
            canonical_brand: "Jean&Len",
            clean_name: "Granatapfel Rose Conditioner",
            category_key: "conditioner",
            affiliate_link: "https://example.com/product",
            image_url: "https://www.jeanlen.de/source.jpg",
            price_eur: 4.95,
            currency: "EUR",
            purchase_link_status: "available",
            purchase_link_checked_at: "2026-06-26T12:00:00.000Z",
            price_checked_at: "2026-06-26T12:00:00.000Z",
          },
          identifiers: [
            {
              type: "gtin",
              value: "4262401738883",
              source: "dm product listing",
            },
          ],
          sources: [{ url: "https://example.com", title: "Source", evidence: "Evidence" }],
          field_rationales: {
            "product.canonical_brand": "Official and retailer pages identify the brand.",
            "product.clean_name": "Official and retailer pages identify the product name.",
            "product.category_key": "The product is submitted and researched as a conditioner.",
            "product.affiliate_link": "Reviewer source product page.",
            "product.image_url": "Source image before normalization.",
            "product.price_eur": "Reviewer source product page lists the current price.",
            "product.purchase_link_status": "Reviewer source product page is available.",
            "category_specs.product_conditioner_specs":
              "Conditioner suitability rows are based on the source positioning.",
            "identifiers[0]": "GTIN confirmed by retailer listing.",
            "category_specs.product_conditioner_specs[0]":
              "For fine hair the conditioner has a balanced slip profile.",
            "category_specs.product_conditioner_rerank_specs":
              "Rerank properties are based on product positioning and ingredients.",
            "category_specs.product_conditioner_rerank_specs.weight":
              "Medium because it is a classic conditioner but not an intensive mask.",
          },
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
              balance_direction: "moisture",
              ingredient_flags: ["humectants", "oils"],
            },
          },
          review: {
            manual_reviewed: true,
            reviewed_by: "nick",
            reviewed_at: "2026-06-26T12:00:00.000Z",
          },
        },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(join(dir, "research.md"), "# Research\n")
  await writeFile(join(dir, "validation.json"), `${JSON.stringify({ ok: true }, null, 2)}\n`)
  await writeFile(join(dir, "approval.md"), "# Approval\n")
  await writeFile(
    join(dir, "image-finalization.json"),
    `${JSON.stringify({ status: "pending" })}\n`,
  )
  return dir
}

test("review app lists product-intake research packages", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    await writePackage(root)

    const packages = await listReviewPackages({ rootDir: root })

    assert.equal(packages.length, 1)
    assert.equal(packages[0].submission_id, "submission-1")
    assert.equal(packages[0].category, "conditioner")
    assert.equal(packages[0].image_status, "pending")
    assert.equal(packages[0].image_candidate_status, "missing")
    assert.equal(packages[0].package_state, "package_needs_research")
    assert.equal(packages[0].package_state_reason, "No product image candidate in package")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app keeps researched packages in progress only after a local image candidate exists", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    await mkdir(join(dir, "images", "source"), { recursive: true })
    await writeFile(join(dir, "images", "source", "product.png"), "image")
    await writeFile(
      join(dir, "image-candidates.json"),
      `${JSON.stringify(
        {
          candidates: [
            {
              label: "Local product image",
              source_page_url: "https://example.com/product",
              source_image_url: "https://example.com/product.png",
              local_file: "images/source/product.png",
              source_type: "retailer",
            },
          ],
        },
        null,
        2,
      )}\n`,
    )

    const packages = await listReviewPackages({ rootDir: root })
    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })

    assert.equal(packages[0].image_candidate_status, "ready")
    assert.equal(packages[0].package_state, "package_in_progress")
    assert.equal(packages[0].package_state_reason, "image decision is not finalized")
    assert.equal(detail.image_candidate_status, "ready")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app classifies prepared draft shells as not researched", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    await writeFile(
      join(dir, "payload.json"),
      `${JSON.stringify(
        {
          draft: {
            product: {
              canonical_brand: "Syoss",
              clean_name: "Intense Fullness Shampoo",
              category_key: "shampoo",
            },
            sources: [],
            field_rationales: {},
          },
        },
        null,
        2,
      )}\n`,
    )
    await writeFile(
      join(dir, "validation.json"),
      `${JSON.stringify({ ok: false, missingFields: ["final"] }, null, 2)}\n`,
    )

    const packages = await listReviewPackages({ rootDir: root })
    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })

    assert.equal(packages[0].package_state, "package_needs_research")
    assert.equal(packages[0].package_state_reason, "No final researched payload yet")
    assert.equal(detail.package_state, "package_needs_research")
    assert.equal(detail.property_rows.length, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app classifies validation-ready packages with approved image decisions as ready", async () => {
  const result = classifyReviewPackageState({
    payload: { final: { product: { clean_name: "Ready" } } },
    validation: { ok: true },
    imageFinalization: { status: "approved_asset" },
  })

  assert.deepEqual(result, {
    package_state: "package_ready_for_review",
    package_state_reason: "Product data and image decision are ready for Nick review",
  })
})

test("review app reads package detail with submission, payload, and image decision", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)

    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })

    assert.equal(detail.submission.id, "submission-1")
    assert.equal(detail.payload.final.product.clean_name, "Granatapfel Rose Conditioner")
    assert.ok(detail.image_finalization)
    assert.equal(detail.image_finalization.status, "pending")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app exposes reviewer source and image evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)

    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })

    assert.deepEqual(detail.source_links, [
      {
        label: "Source",
        url: "https://example.com",
        evidence: "Evidence",
      },
    ])
    assert.deepEqual(detail.image_assets, [
      {
        label: "Vorderseite vom User",
        url: "https://signed.example/front",
        kind: "user_front",
      },
      {
        label: "Kandidat fuer Produktbild",
        url: "https://www.jeanlen.de/source.jpg",
        kind: "candidate_product_image",
        source_image_url: "https://www.jeanlen.de/source.jpg",
      },
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app prefers package-local image candidates over brittle remote product images", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    await mkdir(join(dir, "images", "source"), { recursive: true })
    await writeFile(join(dir, "images", "source", "product.png"), "fake image bytes")
    await writeFile(
      join(dir, "image-candidates.json"),
      `${JSON.stringify(
        {
          candidates: [
            {
              label: "Jean&Len offizielles Produktbild",
              source_page_url: "https://www.jeanlen.de/product",
              source_image_url: "https://www.jeanlen.de/live-product.png",
              local_file: "images/source/product.png",
              source_type: "brand",
              notes: "Official product image cached for review.",
            },
          ],
        },
        null,
        2,
      )}\n`,
    )

    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })
    const candidate = detail.image_assets.find((asset) => asset.kind === "candidate_product_image")

    assert.equal(candidate?.label, "Jean&Len offizielles Produktbild")
    assert.equal(
      candidate?.url,
      `/api/package/file?path=${encodeURIComponent(dir)}&file=${encodeURIComponent(
        "images/source/product.png",
      )}`,
    )
    assert.equal(candidate?.source_image_url, "https://www.jeanlen.de/live-product.png")
    assert.equal(candidate?.local_file, "images/source/product.png")
    assert.notEqual(candidate?.url, "https://www.jeanlen.de/source.jpg")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app serves package-local image files and blocks traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  const server = createReviewAppServer({ rootDir: root })
  try {
    const dir = await writePackage(root)
    await mkdir(join(dir, "images", "source"), { recursive: true })
    await writeFile(join(dir, "images", "source", "product.png"), "fake image bytes")

    await new Promise<void>((resolveListen) => {
      server.listen(0, "127.0.0.1", resolveListen)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const baseUrl = `http://127.0.0.1:${address.port}`

    const good = await fetch(
      `${baseUrl}/api/package/file?path=${encodeURIComponent(dir)}&file=${encodeURIComponent(
        "images/source/product.png",
      )}`,
    )
    assert.equal(good.status, 200)
    assert.equal(await good.text(), "fake image bytes")

    const bad = await fetch(
      `${baseUrl}/api/package/file?path=${encodeURIComponent(dir)}&file=${encodeURIComponent(
        "../payload.json",
      )}`,
    )
    assert.equal(bad.status, 400)

    await writeFile(join(root, "outside.png"), "outside image bytes")
    await symlink(join(root, "outside.png"), join(dir, "images", "source", "linked.png"))
    const symlinkEscape = await fetch(
      `${baseUrl}/api/package/file?path=${encodeURIComponent(dir)}&file=${encodeURIComponent(
        "images/source/linked.png",
      )}`,
    )
    assert.equal(symlinkEscape.status, 400)
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
    await rm(root, { recursive: true, force: true })
  }
})

test("review app can process an approved image candidate into a finalization draft", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  const server = createReviewAppServer({ rootDir: root })
  try {
    const dir = await writePackage(root)
    await mkdir(join(dir, "images", "source"), { recursive: true })
    await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="180" height="260"><rect x="30" y="10" width="120" height="240" rx="20" fill="#f5cc22"/></svg>',
          ),
          left: 70,
          top: 30,
        },
      ])
      .png()
      .toFile(join(dir, "images", "source", "product.png"))
    await writeFile(
      join(dir, "image-candidates.json"),
      `${JSON.stringify(
        {
          candidates: [
            {
              label: "Official product image",
              source_page_url: "https://example.com/product",
              source_image_url: "https://example.com/source.png",
              local_file: "images/source/product.png",
              source_type: "brand",
            },
          ],
        },
        null,
        2,
      )}\n`,
    )
    await writeFile(
      join(dir, "image-review.json"),
      `${JSON.stringify(
        {
          status: "candidate_approved",
          candidate_url: "/api/package/file?file=images/source/product.png",
          notes: "",
          reviewed_by: "nick",
          reviewed_at: "2026-06-26T12:00:00.000Z",
        },
        null,
        2,
      )}\n`,
    )

    await new Promise<void>((resolveListen) => {
      server.listen(0, "127.0.0.1", resolveListen)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const baseUrl = `http://127.0.0.1:${address.port}`

    const response = await fetch(`${baseUrl}/api/package/process-image`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packagePath: dir }),
    })

    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.ok, true)
    assert.equal(result.image_finalization.status, "pending")
    assert.equal(result.image_finalization.selected_source_file, "images/source/product.png")
    assert.match(result.image_finalization.final_file, /^images\/final\/.+\.webp$/)
    assert.match(result.image_finalization.qa_file, /^images\/qa\/.+\.webp$/)
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
    await rm(root, { recursive: true, force: true })
  }
})

test("review app can request a targeted replacement image search", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  const server = createReviewAppServer({ rootDir: root })
  try {
    const dir = await writePackage(root)

    await new Promise<void>((resolveListen) => {
      server.listen(0, "127.0.0.1", resolveListen)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const baseUrl = `http://127.0.0.1:${address.port}`

    const response = await fetch(`${baseUrl}/api/package/request-image-search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packagePath: dir, notes: "Dark background failed QA." }),
    })

    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.ok, true)
    assert.equal(result.image_search_request.status, "requested")
    assert.match(result.image_search_request.query, /Jean&Len Granatapfel Rose Conditioner/)
    assert.match(result.image_search_request.requirements.join(" "), /exact product/i)
    assert.match(result.image_search_request.requirements.join(" "), /front-facing/i)
    assert.match(result.image_search_request.requirements.join(" "), /transparent or plain light/i)
    assert.match(result.image_search_request.reject.join(" "), /lifestyle/i)
    assert.match(result.image_search_request.reject.join(" "), /dark/i)
    assert.equal(result.detail.image_candidate_review.status, "needs_new_candidate")

    const saved = JSON.parse(await readFile(join(dir, "image-search-request.json"), "utf8"))
    assert.equal(saved.notes, "Dark background failed QA.")
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
    await rm(root, { recursive: true, force: true })
  }
})

test("review app searches source pages and attaches a replacement image candidate", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  const reviewServer = createReviewAppServer({ rootDir: root })
  const transparentProductPng = await sharp({
    create: {
      width: 640,
      height: 900,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .composite([
      {
        input: await sharp({
          create: {
            width: 220,
            height: 680,
            channels: 4,
            background: { r: 32, g: 24, b: 36, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
        left: 210,
        top: 110,
      },
    ])
    .toBuffer()
  const sourceServer = createServer((request, response) => {
    const host = request.headers.host
    if (request.url === "/product") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      response.end(`
        <html>
          <head>
            <meta property="og:image" content="http://${host}/images/exact-packshot.png">
          </head>
          <body>
            <img src="http://${host}/images/exact-packshot.png" alt="Jean&Len Granatapfel Rose Conditioner front packshot">
          </body>
        </html>
      `)
      return
    }
    if (request.url === "/images/exact-packshot.png") {
      response.writeHead(200, { "content-type": "image/png" })
      response.end(transparentProductPng)
      return
    }
    response.writeHead(404)
    response.end()
  })

  try {
    const dir = await writePackage(root)
    await new Promise<void>((resolveListen) => {
      sourceServer.listen(0, "127.0.0.1", resolveListen)
    })
    const sourceAddress = sourceServer.address()
    assert.ok(sourceAddress && typeof sourceAddress === "object")
    const sourceBaseUrl = `http://127.0.0.1:${sourceAddress.port}`
    const payload = JSON.parse(await readFile(join(dir, "payload.json"), "utf8"))
    payload.final.sources = [
      {
        url: `${sourceBaseUrl}/product`,
        title: "Brand source",
        evidence: "Exact source page.",
      },
    ]
    payload.final.product.affiliate_link = `${sourceBaseUrl}/product`
    payload.final.product.image_url = "https://example.com/old-dark-image.jpg"
    await writeFile(join(dir, "payload.json"), `${JSON.stringify(payload, null, 2)}\n`)

    await new Promise<void>((resolveListen) => {
      reviewServer.listen(0, "127.0.0.1", resolveListen)
    })
    const reviewAddress = reviewServer.address()
    assert.ok(reviewAddress && typeof reviewAddress === "object")
    const reviewBaseUrl = `http://127.0.0.1:${reviewAddress.port}`

    const response = await fetch(`${reviewBaseUrl}/api/package/request-image-search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packagePath: dir, notes: "Dark background failed QA." }),
    })

    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.ok, true)
    assert.equal(result.image_search_result.status, "candidate_found")
    assert.match(result.image_search_result.local_file, /^images\/source\/.+\.png$/)
    assert.equal(result.detail.image_assets.at(-1).kind, "candidate_product_image")
    assert.equal(result.detail.image_assets.at(-1).source_page_url, `${sourceBaseUrl}/product`)

    const candidates = JSON.parse(await readFile(join(dir, "image-candidates.json"), "utf8"))
    assert.equal(candidates.candidates.length, 1)
    assert.equal(
      candidates.candidates[0].source_image_url,
      `${sourceBaseUrl}/images/exact-packshot.png`,
    )
  } finally {
    await new Promise<void>((resolveClose) => reviewServer.close(() => resolveClose()))
    await new Promise<void>((resolveClose) => sourceServer.close(() => resolveClose()))
    await rm(root, { recursive: true, force: true })
  }
})

test("review app falls back to dm product search for JS-backed product images", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  const originalFetch = globalThis.fetch
  try {
    const dir = await writePackage(root)
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
              width: 260,
              height: 720,
              channels: 4,
              background: { r: 238, g: 214, b: 78, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          left: 230,
          top: 120,
        },
      ])
      .toBuffer()

    const payload = JSON.parse(await readFile(join(dir, "payload.json"), "utf8"))
    payload.final.product.canonical_brand = "Balea Professional"
    payload.final.product.product_line = "Brilliant Blond"
    payload.final.product.clean_name = "Hair Sealer Leave-in"
    payload.final.product.affiliate_link =
      "https://www.dm.de/balea-professional-leave-in-haarpflege-brilliant-blond-hair-sealer-p4066447574091.html"
    payload.final.product.image_url = null
    payload.final.sources = [
      {
        url: payload.final.product.affiliate_link,
        title: "dm product listing",
        evidence: "dm identifies the researched product.",
      },
    ]
    await writeFile(join(dir, "payload.json"), `${JSON.stringify(payload, null, 2)}\n`)

    const dmImageUrl =
      "https://products.dm-static.com/images/f_auto,q_auto,c_fit,h_1000,w_1000/v1755022300/assets/pas/images/example/balea-professional-leave-in-serum-brilliant-blond-hair-sealer"
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith("https://www.dm.de/")) {
        return new Response("<html><body>Shell without product image tags</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      }
      if (url.startsWith("https://product-search.services.dmtech.com/de/search/crawl")) {
        return new Response(
          JSON.stringify({
            products: [
              {
                dan: 3062765,
                gtin: 4067796154160,
                tileData: {
                  self: "/p/d/3062765/balea-professional-leave-in-serum-brilliant-blond-hair-sealer",
                  images: [
                    {
                      tileSrc:
                        "https://products.dm-static.com/images/f_auto,q_auto,c_fit,h_320,w_320/v1755022300/assets/pas/images/example/balea-professional-leave-in-serum-brilliant-blond-hair-sealer",
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }
      if (url === dmImageUrl) {
        return new Response(new Uint8Array(productPng), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      }
      return new Response("not found", { status: 404 })
    }) as typeof fetch

    const result = await requestReplacementImageSearch({
      rootDir: root,
      packagePath: dir,
      notes: "Wrong third-party packshot.",
      requestedBy: "nick",
      requestedAt: "2026-06-30T08:30:00.000Z",
    })

    assert.equal(result.image_search_result.status, "candidate_found")
    assert.equal(result.image_search_result.source_image_url, dmImageUrl)
    assert.equal(
      result.image_search_result.source_page_url,
      "https://www.dm.de/p/d/3062765/balea-professional-leave-in-serum-brilliant-blond-hair-sealer",
    )
    assert.match(
      result.image_search_result.local_file ?? "",
      /^images\/source\/replacement-.+\.png$/,
    )

    const candidates = JSON.parse(await readFile(join(dir, "image-candidates.json"), "utf8"))
    assert.equal(candidates.candidates.length, 1)
    assert.equal(candidates.candidates[0].source_image_url, dmImageUrl)
    assert.equal(candidates.candidates[0].source_provenance, "review_app_source_search")
  } finally {
    globalThis.fetch = originalFetch
    await rm(root, { recursive: true, force: true })
  }
})

test("review app rejects unrelated retailer image-search results", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  const originalFetch = globalThis.fetch
  try {
    const dir = await writePackage(root)
    const payload = JSON.parse(await readFile(join(dir, "payload.json"), "utf8"))
    payload.final.product.canonical_brand = "Codex Smoke"
    payload.final.product.product_line = null
    payload.final.product.clean_name = "Mango Conditioner"
    payload.final.product.affiliate_link = null
    payload.final.product.image_url = null
    payload.final.sources = []
    await writeFile(join(dir, "payload.json"), `${JSON.stringify(payload, null, 2)}\n`)

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith("https://product-search.services.dmtech.com/de/search/crawl")) {
        return new Response(
          JSON.stringify({
            products: [
              {
                tileData: {
                  self: "/p/d/3096822/otto-kern-gentlemans-code-black-eau-de-toilette",
                  images: [
                    {
                      tileSrc:
                        "https://products.dm-static.com/images/f_auto,q_auto,c_fit,h_320,w_320/v1763074995/assets/pas/images/example/otto-kern-gentlemans-code-black-eau-de-toilette",
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }
      return new Response("not found", { status: 404 })
    }) as typeof fetch

    const result = await requestReplacementImageSearch({
      rootDir: root,
      packagePath: dir,
      notes: "Wrong third-party packshot.",
      requestedBy: "nick",
      requestedAt: "2026-06-30T08:30:00.000Z",
    })

    assert.equal(result.image_search_result.status, "no_candidate_found")
    assert.equal(result.image_search_result.local_file, null)
    assert.match(
      result.image_search_result.rejected.map((entry) => entry.reason).join("\n"),
      /does not match enough product tokens/,
    )
  } finally {
    globalThis.fetch = originalFetch
    await rm(root, { recursive: true, force: true })
  }
})

test("review app excludes unsafe source and image urls from reviewer evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    await writeFile(
      join(dir, "submission.json"),
      `${JSON.stringify(
        {
          id: "submission-1",
          category: "conditioner",
          brand_text: "Jean & Len",
          product_name_text: "Granatapfel Conditioner",
          image_review: {
            front_image_signed_url: "javascript:alert('front')",
            barcode_image_signed_url: "data:text/html,<script>alert(1)</script>",
          },
        },
        null,
        2,
      )}\n`,
    )
    await writeFile(
      join(dir, "payload.json"),
      `${JSON.stringify(
        {
          final: {
            product: {
              canonical_brand: "Jean&Len",
              clean_name: "Granatapfel Rose Conditioner",
              category_key: "conditioner",
              image_url: "javascript:alert('image')",
            },
            sources: [{ url: "javascript:alert('source')", title: "Bad Source" }],
          },
        },
        null,
        2,
      )}\n`,
    )

    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })

    assert.deepEqual(detail.source_links, [])
    assert.deepEqual(detail.image_assets, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app exposes property rows with values, rationales, and sources", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)

    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })

    assert.deepEqual(
      detail.property_rows.find((row) => row.path === "product.clean_name"),
      {
        path: "product.clean_name",
        label: "Produktname",
        value: "Granatapfel Rose Conditioner",
        rationale: "Official and retailer pages identify the product name.",
        sources: detail.source_links,
        review: null,
      },
    )
    assert.deepEqual(
      detail.property_rows.find((row) => row.path === "identifiers[0]"),
      {
        path: "identifiers[0]",
        label: "Kennung 1",
        value: "type: gtin · value: 4262401738883 · source: dm product listing",
        rationale: "GTIN confirmed by retailer listing.",
        sources: detail.source_links,
        review: null,
      },
    )
    assert.deepEqual(
      detail.property_rows.find(
        (row) => row.path === "category_specs.product_conditioner_specs[0]",
      ),
      {
        path: "category_specs.product_conditioner_specs[0]",
        label: "Conditioner-Eignung 1",
        value: "thickness: fine · protein_moisture_balance: stretches_bounces",
        rationale:
          "Conditioner suitability rows are based on the source positioning.\n\nFor fine hair the conditioner has a balanced slip profile.",
        sources: detail.source_links,
        review: null,
      },
    )
    assert.deepEqual(
      detail.property_rows.find(
        (row) => row.path === "category_specs.product_conditioner_rerank_specs.weight",
      ),
      {
        path: "category_specs.product_conditioner_rerank_specs.weight",
        label: "Gewichtung",
        value: "medium",
        rationale: "Medium because it is a classic conditioner but not an intensive mask.",
        sources: detail.source_links,
        review: null,
      },
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app explains grouped property rows with child-level rationales", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    const payload = JSON.parse(await readFile(join(dir, "payload.json"), "utf8"))
    delete payload.final.field_rationales["category_specs.product_conditioner_specs[0]"]
    payload.final.field_rationales["category_specs.product_conditioner_specs"] =
      "Overall conditioner suitability is based on a light slip profile."
    payload.final.field_rationales["category_specs.product_conditioner_specs[0].thickness"] =
      "Fine hair is included because the product is not positioned as a heavy mask."
    payload.final.field_rationales[
      "category_specs.product_conditioner_specs[0].protein_moisture_balance"
    ] =
      "Stretches/bounces is used because the sources point to moisture and slip, not protein repair."
    await writeFile(join(dir, "payload.json"), `${JSON.stringify(payload, null, 2)}\n`)

    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })
    const row = detail.property_rows.find(
      (item) => item.path === "category_specs.product_conditioner_specs[0]",
    )

    assert.ok(row)
    assert.match(row.rationale ?? "", /Overall conditioner suitability/)
    assert.match(row.rationale ?? "", /thickness: Fine hair is included/)
    assert.match(row.rationale ?? "", /protein moisture balance: Stretches\/bounces/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app uses live validation status when stored validation is stale", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    await writeFile(
      join(dir, "validation.json"),
      `${JSON.stringify({ ok: false, missingFields: ["final"] }, null, 2)}\n`,
    )

    const packages = await listReviewPackages({ rootDir: root })
    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })

    assert.equal(packages[0].validation_ok, true)
    assert.deepEqual(detail.stored_validation, { ok: false, missingFields: ["final"] })
    assert.equal(
      detail.validation && typeof detail.validation === "object" && "ok" in detail.validation
        ? detail.validation.ok
        : null,
      true,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app explains broken images and final image metadata", () => {
  const html = renderAppHtml()

  assert.match(html, /Noch nicht recherchiert/)
  assert.match(html, /Noch nicht reviewbar/)
  assert.match(html, /Bild kann hier nicht geladen werden/)
  assert.match(html, /Bildvorschlag nicht ladbar/)
  assert.match(html, /1\. Rohbild-Kandidat auswaehlen/)
  assert.match(html, /Rohbild-Kandidat aus der Quelle/)
  assert.match(html, /2\. Finalbild nach Verarbeitung pruefen/)
  assert.match(html, /Eigenschaften pruefen/)
  assert.match(html, /Bild passt/)
  assert.match(html, /Bildverarbeitung/)
  assert.match(html, /processing-feedback/)
  assert.match(html, /processing-progress-fill/)
  assert.match(html, /Bild wird verarbeitet/)
  assert.match(html, /Finalbild ist bereit zur Review/)
  assert.match(html, /Bildsuche/)
  assert.match(html, /search-feedback/)
  assert.match(html, /Bildsuche laeuft/)
  assert.match(html, /Bildsuche abgeschlossen: kein besseres Bild gefunden/)
  assert.match(html, /keine Suche aktiv/)
  assert.match(html, /Naechster Schritt: Codex\/Web-Recherche/)
  assert.match(html, /Bitte auf dieser Ansicht bleiben/)
  assert.match(html, /Exaktes Produkt/)
  assert.match(html, /frontale Packshot-Ansicht/)
  assert.match(html, /Kein Lifestyle/)
  assert.match(html, /Anderes Bild suchen/)
  assert.match(html, /Bildentscheidung/)
  assert.match(html, /Supabase-Import/)
  assert.match(html, /Supabase-Import abgeschlossen/)
  assert.match(html, /Supabase-Import fehlgeschlagen/)
  assert.match(html, /Import-Dry-Run/)
  assert.match(html, /Freigabe-Entscheidung speichern/)
  assert.doesNotMatch(html, /applyToSupabase/)
  assert.match(html, /Freigabe-Entscheidung speichern\?/)
  assert.match(html, /approve-package -- --apply --confirm/)
  assert.match(html, /Alle Eigenschaften passen/)
  assert.match(html, /Groessenvergleich mit bestehenden DB-Bildern/)
  assert.match(html, /Olaplex No\.7 Bonding Oil/)
  assert.match(html, /Syoss Intense Curls/)
})

test("review app renders property review as a compact table", () => {
  const html = renderAppHtml()

  assert.match(html, /property-table-wrap/)
  assert.match(html, /property-review-table/)
  assert.match(html, /<th>Eigenschaft<\/th>/)
  assert.match(html, /<th>Entscheidung<\/th>/)
  assert.match(html, /Aenderung anfordern/)
  assert.match(html, /Codex diese Eigenschaft ueberarbeitet/)
  assert.doesNotMatch(html, /property-card/)
})

test("review app saves image candidate review decisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)

    await saveImageCandidateReview({
      rootDir: root,
      packagePath: dir,
      decision: {
        status: "needs_new_candidate",
        candidate_url: "https://www.jeanlen.de/source.jpg",
        notes: "Candidate does not load; find another brand or retailer image.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })

    const decision = JSON.parse(await readFile(join(dir, "image-review.json"), "utf8"))

    assert.equal(decision.status, "needs_new_candidate")
    assert.equal(decision.notes, "Candidate does not load; find another brand or retailer image.")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app saves approved image candidate review decisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)

    await saveImageCandidateReview({
      rootDir: root,
      packagePath: dir,
      decision: {
        status: "candidate_approved",
        candidate_url: "https://www.jeanlen.de/source.jpg",
        notes: "Candidate visually matches the user upload.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })

    const decision = JSON.parse(await readFile(join(dir, "image-review.json"), "utf8"))

    assert.equal(decision.status, "candidate_approved")
    assert.equal(decision.candidate_url, "https://www.jeanlen.de/source.jpg")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app saves per-property review decisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)

    await savePropertyReviewDecision({
      rootDir: root,
      packagePath: dir,
      decision: {
        path: "category_specs.product_conditioner_rerank_specs.weight",
        status: "change_requested",
        proposed_value: "medium",
        reviewer_value: "light",
        notes: "Looks lighter than medium based on source copy.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })

    const review = JSON.parse(await readFile(join(dir, "property-review.json"), "utf8"))
    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })

    assert.equal(
      review.decisions["category_specs.product_conditioner_rerank_specs.weight"].reviewer_value,
      "light",
    )
    assert.equal(detail.package_state, "package_rework_requested")
    assert.match(detail.package_state_reason, /property changes/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app preserves existing property decisions when another property is saved", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)

    await savePropertyReviewDecision({
      rootDir: root,
      packagePath: dir,
      decision: {
        path: "product.clean_name",
        status: "approved",
        proposed_value: "Granatapfel Rose Conditioner",
        notes: "",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })
    await savePropertyReviewDecision({
      rootDir: root,
      packagePath: dir,
      decision: {
        path: "category_specs.product_conditioner_rerank_specs.weight",
        status: "change_requested",
        proposed_value: "medium",
        reviewer_value: "light",
        notes: "Looks lighter than medium based on source copy.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:01:00.000Z",
      },
    })

    const review = JSON.parse(await readFile(join(dir, "property-review.json"), "utf8"))

    assert.equal(review.decisions["product.clean_name"].status, "approved")
    assert.equal(
      review.decisions["category_specs.product_conditioner_rerank_specs.weight"].reviewer_value,
      "light",
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app can bulk approve all properties", () => {
  const html = renderAppHtml()

  assert.match(html, /saveAllPropertiesApproved/)
  assert.match(html, /Alle Eigenschaften passen/)
})

test("review app rejects final package approval until image and properties are approved", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)

    await assert.rejects(
      () =>
        savePackageApprovalDecision({
          rootDir: root,
          packagePath: dir,
          decision: {
            status: "approved_for_import",
            notes: "Looks good.",
            reviewed_by: "nick",
            reviewed_at: "2026-06-26T12:00:00.000Z",
          },
        }),
      /image candidate must be approved/i,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app treats property approvals as stale when reviewed values change", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    await saveImageCandidateReview({
      rootDir: root,
      packagePath: dir,
      decision: {
        status: "candidate_approved",
        candidate_url: "https://www.jeanlen.de/source.jpg",
        notes: "Candidate visually matches the product.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })
    await saveImageFinalizationDecision({
      rootDir: root,
      packagePath: dir,
      decision: approvedImageDecision(),
    })
    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })
    for (const row of detail.property_rows) {
      await savePropertyReviewDecision({
        rootDir: root,
        packagePath: dir,
        decision: {
          path: row.path,
          status: "approved",
          proposed_value: row.value,
          notes: "",
          reviewed_by: "nick",
          reviewed_at: "2026-06-26T12:00:00.000Z",
        },
      })
    }

    const payload = JSON.parse(await readFile(join(dir, "payload.json"), "utf8"))
    payload.final.category_specs.product_conditioner_rerank_specs.weight = "light"
    await writeFile(join(dir, "payload.json"), `${JSON.stringify(payload, null, 2)}\n`)

    const refreshed = await readReviewPackage({ rootDir: root, packagePath: dir })
    const weight = refreshed.property_rows.find(
      (row) => row.path === "category_specs.product_conditioner_rerank_specs.weight",
    )
    assert.equal(weight?.review, null)

    await assert.rejects(
      () =>
        savePackageApprovalDecision({
          rootDir: root,
          packagePath: dir,
          decision: {
            status: "approved_for_import",
            notes: "Ready for import.",
            reviewed_by: "nick",
            reviewed_at: "2026-06-26T12:00:00.000Z",
          },
        }),
      /all properties must be approved/i,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app saves final package approval after image and all properties are approved", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    await saveImageCandidateReview({
      rootDir: root,
      packagePath: dir,
      decision: {
        status: "candidate_approved",
        candidate_url: "https://www.jeanlen.de/source.jpg",
        notes: "Candidate visually matches the product.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })
    await assert.rejects(
      () =>
        savePackageApprovalDecision({
          rootDir: root,
          packagePath: dir,
          decision: {
            status: "approved_for_import",
            notes: "Ready for import.",
            reviewed_by: "nick",
            reviewed_at: "2026-06-26T12:00:00.000Z",
          },
        }),
      /image finalization/i,
    )
    await saveImageFinalizationDecision({
      rootDir: root,
      packagePath: dir,
      decision: approvedImageDecision(),
    })
    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })
    for (const row of detail.property_rows) {
      await savePropertyReviewDecision({
        rootDir: root,
        packagePath: dir,
        decision: {
          path: row.path,
          status: "approved",
          proposed_value: row.value,
          notes: "",
          reviewed_by: "nick",
          reviewed_at: "2026-06-26T12:00:00.000Z",
        },
      })
    }

    await savePackageApprovalDecision({
      rootDir: root,
      packagePath: dir,
      decision: {
        status: "approved_for_import",
        notes: "Ready for import.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })

    const approval = JSON.parse(await readFile(join(dir, "package-approval.json"), "utf8"))

    assert.equal(approval.status, "approved_for_import")
    assert.equal(approval.notes, "Ready for import.")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app keeps package approval unblocked when final image updates image url after property review", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    await saveImageCandidateReview({
      rootDir: root,
      packagePath: dir,
      decision: {
        status: "candidate_approved",
        candidate_url: "https://www.jeanlen.de/source.jpg",
        notes: "Candidate visually matches the product.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })
    let detail = await readReviewPackage({ rootDir: root, packagePath: dir })
    for (const row of detail.property_rows) {
      await savePropertyReviewDecision({
        rootDir: root,
        packagePath: dir,
        decision: {
          path: row.path,
          status: "approved",
          proposed_value: row.value,
          notes: "",
          reviewed_by: "nick",
          reviewed_at: "2026-06-26T12:00:00.000Z",
        },
      })
    }
    await saveImageFinalizationDecision({
      rootDir: root,
      packagePath: dir,
      decision: approvedImageDecision(),
    })

    detail = await savePackageApprovalDecision({
      rootDir: root,
      packagePath: dir,
      decision: {
        status: "approved_for_import",
        notes: "Ready for import.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })

    assert.equal(detail.package_approval?.status, "approved_for_import")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app can refresh signed user upload urls from stored paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })

    const refreshed = await applySignedUploadUrls({
      detail,
      signUrl: async (path) => `https://signed.example/refreshed/${path}`,
    })

    assert.equal(
      refreshed.image_assets.find((asset) => asset.kind === "user_front")?.url,
      "https://signed.example/refreshed/front/path.jpg",
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app rejects package paths outside research root", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    await assert.rejects(
      () => readReviewPackage({ rootDir: root, packagePath: "/tmp/outside-package" }),
      /outside ops\/product-intake-research/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app saves approved image decision and patches payload image url", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)

    await saveImageFinalizationDecision({
      rootDir: root,
      packagePath: dir,
      decision: approvedImageDecision(),
    })

    const payload = JSON.parse(await readFile(join(dir, "payload.json"), "utf8"))
    const imageDecision = JSON.parse(await readFile(join(dir, "image-finalization.json"), "utf8"))

    assert.equal(payload.final.product.image_url, publicUrl)
    assert.equal(imageDecision.status, "approved_asset")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("finalize image script creates reviewable final asset metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-final-image-"))
  try {
    const dir = await writePackage(root)
    await mkdir(join(dir, "images", "source"), { recursive: true })
    const sourceFile = join(dir, "images", "source", "granatapfel.png")
    await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="180" height="260"><rect x="30" y="10" width="120" height="240" rx="20" fill="#d85f80"/></svg>',
          ),
          left: 70,
          top: 30,
        },
      ])
      .png()
      .toFile(sourceFile)
    await writeFile(
      join(dir, "image-candidates.json"),
      `${JSON.stringify(
        {
          candidates: [
            {
              label: "Jean&Len offizielles Produktbild",
              source_page_url: "https://www.jeanlen.de/product",
              source_image_url: "https://www.jeanlen.de/source.png",
              local_file: "images/source/granatapfel.png",
              source_type: "brand",
            },
          ],
        },
        null,
        2,
      )}\n`,
    )
    await writeFile(
      join(dir, "image-review.json"),
      `${JSON.stringify(
        {
          status: "candidate_approved",
          candidate_url: "/api/package/file?file=images/source/granatapfel.png",
          notes: "",
          reviewed_by: "nick",
          reviewed_at: "2026-06-26T12:00:00.000Z",
        },
        null,
        2,
      )}\n`,
    )

    const result = await finalizeProductIntakePackageImage({ packageDir: dir })
    const finalMeta = await sharp(result.finalFile).metadata()
    const decision = JSON.parse(await readFile(join(dir, "image-finalization.json"), "utf8"))
    const detail = await readReviewPackage({ rootDir: root, packagePath: dir })

    assert.equal(finalMeta.width, 1200)
    assert.equal(finalMeta.height, 1200)
    assert.equal(decision.status, "pending")
    assert.equal(decision.final_file, `images/final/${result.finalFile.split("/").pop()}`)
    assert.equal(decision.asset_sha256, result.sha256)
    assert.equal(decision.public_url, result.publicUrl)
    assert.equal(
      detail.image_assets.some((asset) => asset.kind === "final_product_image"),
      true,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("finalize image script uses the specifically approved image candidate", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-final-image-"))
  try {
    const dir = await writePackage(root)
    await mkdir(join(dir, "images", "source"), { recursive: true })
    const rejectedFile = join(dir, "images", "source", "wrong.png")
    const approvedFile = join(dir, "images", "source", "right.png")
    await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="40" height="40"><rect width="40" height="40" fill="#111"/></svg>',
          ),
          left: 140,
          top: 140,
        },
      ])
      .png()
      .toFile(rejectedFile)
    await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="180" height="260"><rect x="30" y="10" width="120" height="240" rx="20" fill="#d85f80"/></svg>',
          ),
          left: 70,
          top: 30,
        },
      ])
      .png()
      .toFile(approvedFile)
    await writeFile(
      join(dir, "image-candidates.json"),
      `${JSON.stringify(
        {
          candidates: [
            {
              label: "Wrong product",
              source_page_url: "https://example.com/wrong",
              source_image_url: "https://example.com/wrong.png",
              local_file: "images/source/wrong.png",
              source_type: "retailer",
            },
            {
              label: "Right product",
              source_page_url: "https://example.com/right",
              source_image_url: "https://example.com/right.png",
              local_file: "images/source/right.png",
              source_type: "brand",
            },
          ],
        },
        null,
        2,
      )}\n`,
    )
    await writeFile(
      join(dir, "image-review.json"),
      `${JSON.stringify(
        {
          status: "candidate_approved",
          candidate_url: "/api/package/file?file=images/source/right.png",
          notes: "",
          reviewed_by: "nick",
          reviewed_at: "2026-06-26T12:00:00.000Z",
        },
        null,
        2,
      )}\n`,
    )

    await finalizeProductIntakePackageImage({ packageDir: dir })

    const decision = JSON.parse(await readFile(join(dir, "image-finalization.json"), "utf8"))
    assert.equal(decision.selected_source_file, "images/source/right.png")
    assert.equal(decision.source_page_url, "https://example.com/right")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("finalize image script fails closed when cutout still contains a dark reflection tail", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-final-image-"))
  try {
    const dir = await writePackage(root)
    await mkdir(join(dir, "images", "source"), { recursive: true })
    const sourceFile = join(dir, "images", "source", "dark-reflection.png")
    await sharp({
      create: {
        width: 320,
        height: 360,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="160" height="320"><rect x="35" y="20" width="90" height="220" rx="18" fill="#111"/><rect x="35" y="245" width="90" height="70" fill="#111" opacity=".9"/></svg>',
          ),
          left: 80,
          top: 20,
        },
      ])
      .png()
      .toFile(sourceFile)
    await writeFile(
      join(dir, "image-candidates.json"),
      `${JSON.stringify(
        {
          candidates: [
            {
              label: "Bad dark marketing packshot",
              source_page_url: "https://example.com/product",
              source_image_url: "https://example.com/source.png",
              local_file: "images/source/dark-reflection.png",
              source_type: "brand",
            },
          ],
        },
        null,
        2,
      )}\n`,
    )
    await writeFile(
      join(dir, "image-review.json"),
      `${JSON.stringify(
        {
          status: "candidate_approved",
          candidate_url: "/api/package/file?file=images/source/dark-reflection.png",
          notes: "",
          reviewed_by: "nick",
          reviewed_at: "2026-06-26T12:00:00.000Z",
        },
        null,
        2,
      )}\n`,
    )

    await finalizeProductIntakePackageImage({ packageDir: dir })

    const decision = JSON.parse(await readFile(join(dir, "image-finalization.json"), "utf8"))
    assert.equal(decision.status, "needs_image_work")
    assert.match(decision.notes, /reflection|background/i)
    assert.equal(decision.user_approved, false)
    await assert.rejects(
      () =>
        saveImageFinalizationDecision({
          rootDir: root,
          packagePath: dir,
          decision: {
            ...decision,
            status: "approved_asset",
            user_approved: true,
            reviewed_by: "nick",
            reviewed_at: "2026-06-26T12:00:00.000Z",
          },
        }),
      /quality gate is needs_image_work/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("finalize image script ignores a destructive prepared cutout when the alpha source is usable", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-final-image-"))
  try {
    const dir = await writePackage(root)
    await mkdir(join(dir, "images", "source"), { recursive: true })
    await mkdir(join(dir, "images", "selected-nobg"), { recursive: true })
    const sourceFile = join(dir, "images", "source", "useful-alpha.png")
    await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="180" height="260"><rect x="30" y="10" width="120" height="240" rx="20" fill="#f5cc22"/></svg>',
          ),
          left: 70,
          top: 30,
        },
      ])
      .png()
      .toFile(sourceFile)
    await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="60" height="80"><rect width="60" height="80" fill="#f5cc22"/></svg>',
          ),
          left: 130,
          top: 120,
        },
      ])
      .png()
      .toFile(join(dir, "images", "selected-nobg", "useful-alpha.png"))
    await writeFile(
      join(dir, "image-candidates.json"),
      `${JSON.stringify(
        {
          candidates: [
            {
              label: "Useful alpha source",
              source_page_url: "https://example.com/product",
              source_image_url: "https://example.com/source.png",
              local_file: "images/source/useful-alpha.png",
              source_type: "brand",
            },
          ],
        },
        null,
        2,
      )}\n`,
    )
    await writeFile(
      join(dir, "image-review.json"),
      `${JSON.stringify(
        {
          status: "candidate_approved",
          candidate_url: "/api/package/file?file=images/source/useful-alpha.png",
          notes: "",
          reviewed_by: "nick",
          reviewed_at: "2026-06-26T12:00:00.000Z",
        },
        null,
        2,
      )}\n`,
    )

    await finalizeProductIntakePackageImage({ packageDir: dir })

    const decision = JSON.parse(await readFile(join(dir, "image-finalization.json"), "utf8"))
    assert.equal(decision.status, "pending")
    assert.equal(decision.selected_source_file, "images/source/useful-alpha.png")
    assert.equal(decision.quality_gate.status, "pass")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app saves no-image decision and patches payload image url to null", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)

    await saveImageFinalizationDecision({
      rootDir: root,
      packagePath: dir,
      decision: {
        status: "no_image_approved_for_now",
        reason: "not_needed_for_v1",
        notes: "Approved without image for now.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })

    const payload = JSON.parse(await readFile(join(dir, "payload.json"), "utf8"))
    const imageDecision = JSON.parse(await readFile(join(dir, "image-finalization.json"), "utf8"))

    assert.equal(payload.final.product.image_url, null)
    assert.equal(imageDecision.status, "no_image_approved_for_now")
    assert.equal(
      payload.final.field_rationales["product.image_url"],
      "Approved without image for now.",
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app normalizes review-app image search provenance before final approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    const publicUrl =
      "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/2026-06-26/submission-1/replacement.webp"

    await saveImageFinalizationDecision({
      rootDir: root,
      packagePath: dir,
      decision: {
        status: "approved_asset",
        storage_bucket: "product-images",
        storage_path: "product-intake/2026-06-26/submission-1/replacement.webp",
        public_url: publicUrl,
        source_page_url: "https://www.jeanlen.de/product",
        source_image_url: "https://www.jeanlen.de/source.jpg",
        source_type: "review_app_source_search" as any,
        quality_confidence: "high",
        processing_method: "local",
        final_file: "images/final/replacement.webp",
        asset_sha256: "a".repeat(64),
        user_approved: true,
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
        notes: "Found by review app source search.",
      },
    })

    const payload = JSON.parse(await readFile(join(dir, "payload.json"), "utf8"))
    const imageDecision = JSON.parse(await readFile(join(dir, "image-finalization.json"), "utf8"))

    assert.equal(payload.final.product.image_url, publicUrl)
    assert.equal(imageDecision.status, "approved_asset")
    assert.equal(imageDecision.source_type, "search_result")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app saves needs-image-work without injecting final payload fields", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    await writeFile(
      join(dir, "payload.json"),
      `${JSON.stringify(
        {
          draft: {
            product: {
              canonical_brand: "Jean&Len",
              clean_name: "Granatapfel Rose Conditioner",
              category_key: "conditioner",
            },
          },
        },
        null,
        2,
      )}\n`,
    )

    await saveImageFinalizationDecision({
      rootDir: root,
      packagePath: dir,
      decision: {
        status: "needs_image_work",
        notes: "Image source still needs review.",
        reviewed_by: "nick",
        reviewed_at: "2026-06-26T12:00:00.000Z",
      },
    })

    const payload = JSON.parse(await readFile(join(dir, "payload.json"), "utf8"))
    const imageDecision = JSON.parse(await readFile(join(dir, "image-finalization.json"), "utf8"))

    assert.equal(payload.final, undefined)
    assert.equal(imageDecision.status, "needs_image_work")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("review app rejects invalid approved image metadata before writing", async () => {
  const root = await mkdtemp(join(tmpdir(), "product-intake-review-app-"))
  try {
    const dir = await writePackage(root)
    const beforePayload = await readFile(join(dir, "payload.json"), "utf8")

    await assert.rejects(
      () =>
        saveImageFinalizationDecision({
          rootDir: root,
          packagePath: dir,
          decision: {
            status: "approved_asset",
            storage_bucket: "product-images",
            storage_path: "product-intake/2026-06-26/submission-1/granatapfel.webp",
            public_url: "https://example.com/not-our-bucket.webp",
            source_page_url: "https://www.jeanlen.de/product",
            source_image_url: "https://www.jeanlen.de/source.jpg",
            source_type: "brand",
            quality_confidence: "high",
            processing_method: "local",
            final_file: "images/final/granatapfel.webp",
            asset_sha256: "a".repeat(64),
            user_approved: true,
            reviewed_by: "nick",
            reviewed_at: "2026-06-26T12:00:00.000Z",
            notes: "Invalid host should fail.",
          },
        }),
      /must be a Chaarlie product-images URL/,
    )

    assert.equal(await readFile(join(dir, "payload.json"), "utf8"), beforePayload)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
