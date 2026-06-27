import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import sharp from "sharp"

import { finalizeProductIntakePackageImage } from "../scripts/product-intake/finalize-package-image"
import {
  applySignedUploadUrls,
  createReviewAppServer,
  renderAppHtml,
  listReviewPackages,
  readReviewPackage,
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
  } finally {
    await rm(root, { recursive: true, force: true })
  }
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

  assert.match(html, /Bild kann hier nicht geladen werden/)
  assert.match(html, /Bildvorschlag nicht ladbar/)
  assert.match(html, /Produktbild pruefen/)
  assert.match(html, /Eigenschaften pruefen/)
  assert.match(html, /Bild passt/)
  assert.match(html, /Anderes Bild suchen/)
  assert.match(html, /Bildentscheidung/)
  assert.match(html, /Paket final freigeben/)
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

    assert.equal(
      review.decisions["category_specs.product_conditioner_rerank_specs.weight"].reviewer_value,
      "light",
    )
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
