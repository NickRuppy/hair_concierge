import assert from "node:assert/strict"
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import test from "node:test"
import { validateBondbuilderInternalAdmission } from "../src/lib/product-intake/bondbuilder-internal-admission"
import { prepareBondbuilderCataloguePackages } from "../scripts/product-intake/bondbuilder/prepare-internal-admission"

const ROOT = new URL("../", import.meta.url)
async function request() {
  const envelope = JSON.parse(
    await readFile(
      new URL(
        "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/source-amendment-02/lane-b/P04.json",
        ROOT,
      ),
      "utf8",
    ),
  )
  const digest = envelope.profile.review.profile_sha256
  return {
    version: "bondbuilder-internal-admission-v1",
    product: {
      canonical_brand: "L'Oréal Paris",
      product_line: "Elvital Bond Repair Plus",
      clean_name: "Keratin-Festigendes Pre-Shampoo",
      affiliate_link: "https://www.mueller.de/p/elvital-pre-shampoo-bond-repair-2868614/",
      image_url: `https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/product-intake/test/pre-shampoo-${"a".repeat(12)}.webp`,
      canonical_image_sha256: "a".repeat(64),
      thumbnail_image_url: `https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/thumbnails/search-v1/${"a".repeat(64)}.webp`,
      price_eur: 8.95,
      currency: "EUR",
      purchase_link_status: "available",
      purchase_link_checked_at: "2026-10-03T13:00:00Z",
      price_checked_at: "2026-10-03T13:00:00Z",
      net_content_value: 200,
      net_content_unit: "ml",
    },
    identifiers: [{ type: "gtin", value: "3600524074517", source: "Müller DE exact pack" }],
    category_specs: {
      product_bondbuilder_specs: {
        technology_family: "acid_calcium_management",
        claim_trust_level: "medium",
        trust_basis: "owner_calibration",
        research_profile: envelope.profile,
        application_mode: "pre_shampoo",
        treatment_mode: "rinse_out",
      },
    },
    image: {
      source_page_url: "https://www.loreal-paris.de/",
      source_image_url: "https://www.loreal-paris.de/source.png",
      source_type: "brand",
      processing_method: "local",
    },
    review: {
      reviewed_by: "nick",
      package_sha256: "b".repeat(64),
      profile_sha256: digest,
      image_sha256: "a".repeat(64),
      thumbnail_sha256: "c".repeat(64),
    },
  }
}

test("approved canonical P04 presentation admits unchanged research, without invented fit or protocol", async () => {
  const result = validateBondbuilderInternalAdmission(await request())
  assert.equal(result.success, true, result.success ? undefined : result.errors.join("; "))
})

test("internal preparation rejects unreviewed, mismatched, malformed and publication-authority input", async () => {
  const mutations: Array<[string, (p: any) => void]> = [
    ["activation", (p) => (p.product.is_active = true)],
    ["recommendation", (p) => (p.product.is_chaarlie_recommended = true)],
    ["fit", (p) => (p.product.suitable_thicknesses = ["fine"])],
    ["protocol", (p) => (p.protocols = [])],
    ["fake submission", (p) => (p.submission_id = "synthetic")],
    ["non-owner review", (p) => (p.review.reviewed_by = "codex")],
    ["profile review mismatch", (p) => (p.review.profile_sha256 = "f".repeat(64))],
    ["image review mismatch", (p) => (p.review.image_sha256 = "f".repeat(64))],
    [
      "broken thumbnail binding",
      (p) => (p.product.thumbnail_image_url = p.product.thumbnail_image_url.replace(/a/g, "f")),
    ],
    ["unknown product", (p) => (p.product.clean_name = "Different Treatment")],
    [
      "invented mapping",
      (p) => (p.category_specs.product_bondbuilder_specs.product_format = "cream_treatment"),
    ],
    ["invalid GTIN", (p) => (p.identifiers[0].value = "3600524074518")],
    ["partial net content", (p) => (p.product.net_content_unit = null)],
    ["invalid price", (p) => (p.product.price_eur = -1)],
    ["silently rounded price", (p) => (p.product.price_eur = 8.951)],
    ["invalid timestamp", (p) => (p.product.price_checked_at = "2026-02-30T13:00:00Z")],
    [
      "invalid profile",
      (p) =>
        (p.category_specs.product_bondbuilder_specs.research_profile.evidence.summary = "changed"),
    ],
  ]
  for (const [label, mutate] of mutations) {
    const input = await request()
    mutate(input)
    assert.equal(validateBondbuilderInternalAdmission(input).success, false, label)
  }
})

test("offline package preparation verifies approval bytes and capture-bound identifiers, without executable apply authority", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "bondbuilder-admission-test-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, "P04"))
  const input = await request()
  const envelopeBytes = await readFile(
    new URL(
      "data/research/bondbuilder-inci/v1.0/replay-2026-10-03-v0.5-r3/source-amendment-02/lane-b/P04.json",
      ROOT,
    ),
  )
  const digest = (v: Buffer) => createHash("sha256").update(v).digest("hex")
  const image = await sharp({
    create: { width: 1200, height: 1200, channels: 3, background: "white" },
  })
    .webp()
    .toBuffer()
  const thumbnail = await sharp(image).resize(144, 144).webp().toBuffer()
  const capture = Buffer.from(
    '<script type="application/ld+json">{"gtin13":"3600524074517"}</script>',
  )
  const files = {
    envelope: join(directory, "profile.json"),
    image: join(directory, "image.webp"),
    thumbnail: join(directory, "thumbnail.webp"),
    capture: join(directory, "capture.html"),
  }
  for (const [key, bytes] of Object.entries({ envelope: envelopeBytes, image, thumbnail, capture }))
    await writeFile(files[key as keyof typeof files], bytes)
  const product = {
    ...input.product,
    category_key: "bondbuilder",
    suitable_thicknesses: [],
    image_url: null,
    thumbnail_image_url: null,
    canonical_image_sha256: digest(image),
  }
  const pkg = {
    research_key: "P04",
    operation: "new_internal_catalogue_candidate",
    target_product_id: null,
    real_submission_id: null,
    original_research_profile_file: files.envelope,
    original_envelope_sha256: digest(envelopeBytes),
    research_profile_digest: input.review.profile_sha256,
    product_spine_candidate: product,
    image: {
      final_file: files.image,
      thumbnail_file: files.thumbnail,
      sha256: digest(image),
      thumbnail_sha256: digest(thumbnail),
      source_file: files.image,
      source_sha256: digest(image),
      proposed_storage_only: {
        image_url: `https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/test/fixture-${digest(image).slice(0, 12)}.webp`,
        thumbnail_url: `https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/thumbnails/search-v1/${digest(image)}.webp`,
      },
    },
    commercial_evidence: {
      capture: files.capture,
      capture_sha256: digest(capture),
      url: product.affiliate_link,
      source: "Fixture retailer",
    },
  }
  const packageFile = join(directory, "P04/catalogue-package.json"),
    packageBytes = Buffer.from(JSON.stringify(pkg))
  await writeFile(packageFile, packageBytes)
  const candidateFile = join(directory, "P04/candidate-payload.json")
  const candidate = {
    draft: {
      identifiers: [
        { type: "retailer_url", value: product.affiliate_link, source: "Fixture retailer" },
        {
          type: "gtin",
          value: "3600524074517",
          source: "Fixture retailer; exact pack binding retained in commercial research",
        },
      ],
    },
  }
  await writeFile(candidateFile, JSON.stringify(candidate))
  await writeFile(
    join(directory, "prepared-cutouts.json"),
    JSON.stringify({
      P04: { source_type: "brand", source_image_url: "https://www.loreal-paris.de/source.png" },
    }),
  )
  await writeFile(
    join(directory, "nick-review-approval.json"),
    JSON.stringify({
      version: "bondbuilder-local-package-review-approval-v1",
      status: "presented_packages_and_images_approved",
      reviewed_by: "nick",
      reviewed_at: "2026-10-03T13:00:00Z",
      products: [
        {
          research_key: "P04",
          operation: pkg.operation,
          package_sha256: digest(packageBytes),
          profile_digest: input.review.profile_sha256,
          image_sha256: digest(image),
          thumbnail_sha256: digest(thumbnail),
        },
      ],
    }),
  )
  const result = await prepareBondbuilderCataloguePackages(directory)
  assert.equal(result.mode, "offline-no-apply")
  assert.equal(result.prepared.length, 1)
  assert.deepEqual(result.prepared[0].resulting_visibility, {
    is_active: false,
    lifecycle_status: "active",
    origin: "curated",
    is_chaarlie_recommended: false,
    suitable_thicknesses: [],
    protocols: [],
  })
  assert.equal(result.prepared[0].readiness.publish_ready, false)

  await writeFile(packageFile, `${packageBytes.toString("utf8")} `)
  await assert.rejects(
    prepareBondbuilderCataloguePackages(directory),
    /approved package bytes changed/,
  )
  await writeFile(packageFile, packageBytes)
  await writeFile(files.thumbnail, Buffer.from("changed"))
  await assert.rejects(
    prepareBondbuilderCataloguePackages(directory),
    /approved image or thumbnail bytes changed/,
  )
  await writeFile(files.thumbnail, thumbnail)
  await writeFile(files.envelope, `${envelopeBytes.toString("utf8")} `)
  await assert.rejects(
    prepareBondbuilderCataloguePackages(directory),
    /frozen envelope bytes changed/,
  )
  await writeFile(files.envelope, envelopeBytes)
  candidate.draft.identifiers[1].value = "3474637196684"
  await writeFile(candidateFile, JSON.stringify(candidate))
  await assert.rejects(
    prepareBondbuilderCataloguePackages(directory),
    /identifier is not bound to the approved primary capture/,
  )
  const anchorId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  const anchor = {
    ...pkg,
    operation: "existing_anchor_research_enrichment_candidate",
    target_product_id: anchorId,
    existing_preimage: {
      product: {
        id: anchorId,
        category_key: "bondbuilder",
        name: "L'Oréal Paris Elvital Bond Repair Plus Keratin-Festigendes Pre-Shampoo",
        brand: "L'Oréal Paris",
      },
    },
  }
  const anchorBytes = Buffer.from(JSON.stringify(anchor))
  await writeFile(packageFile, anchorBytes)
  const approvalFile = join(directory, "nick-review-approval.json")
  const approval = JSON.parse(await readFile(approvalFile, "utf8"))
  approval.products[0].operation = anchor.operation
  approval.products[0].package_sha256 = digest(anchorBytes)
  await writeFile(approvalFile, JSON.stringify(approval))
  const anchorIntent = (await prepareBondbuilderCataloguePackages(directory)).prepared[0]
  assert.equal(anchorIntent.rpc, "bondbuilder_research_enrich_v1")
  assert.equal(anchorIntent.prepared_arguments?.p_product_id, anchorId)
  assert.deepEqual(anchorIntent.missing_arguments, ["p_expected_preimage"])
  assert.equal(anchorIntent.request, undefined)
  assert.equal(anchorIntent.readiness.publish_ready, false)
  anchor.existing_preimage.product.id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
  const mismatchedBytes = Buffer.from(JSON.stringify(anchor))
  await writeFile(packageFile, mismatchedBytes)
  approval.products[0].package_sha256 = digest(mismatchedBytes)
  await writeFile(approvalFile, JSON.stringify(approval))
  await assert.rejects(
    prepareBondbuilderCataloguePackages(directory),
    /existing anchor identity mismatch/,
  )
})
