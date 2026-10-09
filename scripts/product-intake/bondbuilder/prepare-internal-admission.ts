import { createHash, randomUUID } from "node:crypto"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { resolve, join } from "node:path"
import sharp from "sharp"
import { z } from "zod"
import { bondbuilderResearchEnvelopeSchema } from "../../../src/lib/bondbuilder-research/contracts"
import { projectBondbuilderForProduction } from "../../../src/lib/bondbuilder-research/production-adapter"
import {
  bondbuilderCatalogueIdentityMatches,
  bondbuilderInternalAdmissionSha256,
  validateBondbuilderInternalAdmission,
} from "../../../src/lib/product-intake/bondbuilder-internal-admission"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const approvalSchema = z.object({
  version: z.literal("bondbuilder-local-package-review-approval-v1"),
  status: z.literal("presented_packages_and_images_approved"),
  reviewed_by: z.literal("nick"),
  reviewed_at: z.iso.datetime({ offset: true }),
  products: z
    .array(
      z.object({
        research_key: z.string().regex(/^P[0-9]{2}$/),
        package_sha256: hash,
        profile_digest: hash,
        image_sha256: hash,
        thumbnail_sha256: hash,
        operation: z.enum([
          "existing_anchor_research_enrichment_candidate",
          "new_internal_catalogue_candidate",
        ]),
      }),
    )
    .min(1),
})
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"))

/** Offline only: no client, fetch, upload, mutation or manufactured submission. */
export async function prepareBondbuilderCataloguePackages(packageRoot: string) {
  const root = resolve(packageRoot)
  const approval = approvalSchema.parse(await json(join(root, "nick-review-approval.json")))
  if (new Set(approval.products.map((p) => p.research_key)).size !== approval.products.length)
    throw new Error("duplicate approval key")
  const cutouts = await json(join(root, "prepared-cutouts.json"))
  const prepared = []
  for (const reviewed of approval.products) {
    const key = reviewed.research_key
    const packageBytes = await readFile(join(root, key, "catalogue-package.json"))
    if (sha256(packageBytes) !== reviewed.package_sha256)
      throw new Error(`${key}: approved package bytes changed`)
    const pkg = JSON.parse(packageBytes.toString("utf8"))
    if (pkg.research_key !== key || pkg.operation !== reviewed.operation)
      throw new Error(`${key}: approval operation mismatch`)
    const original = await readFile(pkg.original_research_profile_file)
    if (sha256(original) !== pkg.original_envelope_sha256)
      throw new Error(`${key}: frozen envelope bytes changed`)
    const envelope = bondbuilderResearchEnvelopeSchema.parse(JSON.parse(original.toString("utf8")))
    if (
      envelope.submission_id !== null ||
      envelope.profile.identity.research_key !== key ||
      envelope.profile.review.profile_sha256 !== reviewed.profile_digest ||
      pkg.research_profile_digest !== reviewed.profile_digest
    )
      throw new Error(`${key}: profile approval mismatch`)
    const projection = projectBondbuilderForProduction(envelope)
    if (!projection.productionProjection) throw new Error(`${key}: ${projection.errors.join("; ")}`)
    const image = await readFile(pkg.image.final_file),
      thumbnail = await readFile(pkg.image.thumbnail_file)
    if (
      sha256(image) !== reviewed.image_sha256 ||
      pkg.image.sha256 !== reviewed.image_sha256 ||
      sha256(thumbnail) !== reviewed.thumbnail_sha256 ||
      pkg.image.thumbnail_sha256 !== reviewed.thumbnail_sha256
    )
      throw new Error(`${key}: approved image or thumbnail bytes changed`)
    const imageInfo = await sharp(image).metadata(),
      thumbInfo = await sharp(thumbnail).metadata()
    if (
      image.length > 2097152 ||
      imageInfo.format !== "webp" ||
      imageInfo.width !== 1200 ||
      imageInfo.height !== 1200 ||
      thumbInfo.format !== "webp" ||
      thumbInfo.width !== 144 ||
      thumbInfo.height !== 144
    )
      throw new Error(`${key}: image dimensions/format gate failed`)
    const capture = pkg.commercial_evidence
    const captureBytes = capture.capture ? await readFile(capture.capture) : null
    if (captureBytes && sha256(captureBytes) !== capture.capture_sha256)
      throw new Error(`${key}: commercial capture bytes changed`)

    if (reviewed.operation === "existing_anchor_research_enrichment_candidate") {
      const id = z.string().uuid().parse(pkg.target_product_id)
      const existing = pkg.existing_preimage?.product
      if (
        existing?.id !== id ||
        existing.category_key !== "bondbuilder" ||
        !bondbuilderCatalogueIdentityMatches(envelope.profile, existing.name, existing.brand)
      )
        throw new Error(`${key}: existing anchor identity mismatch`)
      prepared.push({
        research_key: key,
        operation: "existing_anchor_research_enrichment_intent",
        target_product_id: id,
        reviewed_package_sha256: reviewed.package_sha256,
        reviewed_profile_sha256: reviewed.profile_digest,
        rpc: "bondbuilder_research_enrich_v1",
        prepared_arguments: {
          p_product_id: id,
          p_profile: envelope.profile,
          p_request_id: randomUUID(),
          p_reviewed_by: "nick",
        },
        missing_arguments: ["p_expected_preimage"],
        preimage_policy:
          "Fetch the exact server RPC preimage immediately before authorized apply. The saved commercial snapshot is not an executable CAS preimage.",
        preserves: [
          "product spine",
          "commercial fields",
          "identifiers",
          "images",
          "legacy specs",
          "origin and visibility",
          "fit",
          "protocols",
          "recommendation approval",
        ],
        readiness: {
          local_preparation_ready: true,
          catalog_intake_ready: false,
          global_recommendation_ready: false,
          publish_ready: false,
        },
        blockers: [
          "storage and admission migration lineage not deployed/verified",
          "fresh server preimage and explicit apply authorization required",
        ],
      })
      continue
    }
    if (pkg.target_product_id !== null || pkg.real_submission_id !== null)
      throw new Error(
        `${key}: internal new row must not impersonate an existing product or owner submission`,
      )
    const candidate = pkg.product_spine_candidate
    if (candidate.category_key !== "bondbuilder" || candidate.suitable_thicknesses.length !== 0)
      throw new Error(`${key}: new-row eligibility cannot be invented`)
    const { category_key: _category, suitable_thicknesses: _fit, ...product } = candidate
    const storage = pkg.image.proposed_storage_only
    if (!storage) throw new Error(`${key}: planned storage binding missing`)
    product.image_url = storage.image_url
    product.thumbnail_image_url = storage.thumbnail_url
    const provenance = cutouts[key]
    if (!provenance?.source_image_url || !provenance.source_type)
      throw new Error(`${key}: image provenance missing`)
    if (sha256(await readFile(pkg.image.source_file)) !== pkg.image.source_sha256)
      throw new Error(`${key}: original image source bytes changed`)
    const sourcePage =
      provenance.source_type === "brand"
        ? envelope.profile.sources.find((s) =>
            s.url.startsWith(
              key === "P04" ? "https://www.loreal-paris.de/" : "https://www.aveda.de/",
            ),
          )?.url
        : capture.url
    if (!sourcePage) throw new Error(`${key}: exact source-page provenance missing`)
    const historicalDraft = await json(join(root, key, "candidate-payload.json"))
    // Candidate snapshots are not approval authority. Every proposed identifier
    // must still be an exact observation in the package's hash-bound primary capture.
    const identifiers = z
      .array(
        z
          .object({
            type: z.enum(["gtin", "retailer_url", "manufacturer_sku"]),
            value: z.string().min(1),
            source: z.string().min(1),
          })
          .strict(),
      )
      .min(1)
      .parse(historicalDraft.draft.identifiers)
    if (
      !captureBytes ||
      identifiers.filter((id) => id.type === "retailer_url").length !== 1 ||
      identifiers.filter((id) => id.type !== "retailer_url").length > 1 ||
      identifiers.some((id) =>
        id.type === "retailer_url"
          ? id.value !== capture.url || id.source !== capture.source
          : !captureBytes.toString("utf8").includes(id.value) ||
            (id.type === "gtin"
              ? id.source !==
                `${capture.source}; exact pack binding retained in commercial research`
              : id.source !== capture.url),
      )
    )
      throw new Error(`${key}: identifier is not bound to the approved primary capture`)
    const input = {
      version: "bondbuilder-internal-admission-v1",
      product,
      identifiers,
      category_specs: projection.productionProjection.category_specs,
      image: {
        source_page_url: sourcePage,
        source_image_url: provenance.source_image_url,
        source_type: provenance.source_type,
        processing_method: "local",
      },
      review: {
        reviewed_by: "nick",
        package_sha256: reviewed.package_sha256,
        profile_sha256: reviewed.profile_digest,
        image_sha256: reviewed.image_sha256,
        thumbnail_sha256: reviewed.thumbnail_sha256,
      },
    }
    const valid = validateBondbuilderInternalAdmission(input)
    if (!valid.success) throw new Error(`${key}: ${valid.errors.join("; ")}`)
    prepared.push({
      research_key: key,
      operation: "new_internal_staged_admission_request",
      request: valid.request,
      rpc: "bondbuilder_internal_admit_v1",
      expected_request_sha256: bondbuilderInternalAdmissionSha256(valid.request),
      request_id: randomUUID(),
      reviewed_by: "nick",
      asset_files: { image: pkg.image.final_file, thumbnail: pkg.image.thumbnail_file },
      resulting_visibility: {
        is_active: false,
        lifecycle_status: "active",
        origin: "curated",
        is_chaarlie_recommended: false,
        suitable_thicknesses: [],
        protocols: [],
      },
      readiness: {
        local_preparation_ready: true,
        catalog_intake_ready: false,
        global_recommendation_ready: false,
        publish_ready: false,
      },
      blockers: [
        "storage and admission migration lineage not deployed/verified",
        "planned images not uploaded; verify uploaded bytes before any admission",
        "fresh duplicate/identity preflight and explicit apply authorization required",
        "separate fit/executable-protocol eligibility and activation gates remain held",
      ],
    })
  }
  return {
    version: "bondbuilder-offline-admission-preparation-v1",
    mode: "offline-no-apply",
    reviewed_at: approval.reviewed_at,
    prepared,
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some((arg) => !arg.startsWith("--package-root=") && !arg.startsWith("--out=")))
    throw new Error(
      "Only --package-root=<directory> and optional --out=<new-directory> are supported; no apply/upload mode",
    )
  const root = args.find((arg) => arg.startsWith("--package-root="))?.slice(15)
  if (!root) throw new Error("--package-root=<directory> is required")
  const result = await prepareBondbuilderCataloguePackages(root)
  const out = args.find((arg) => arg.startsWith("--out="))?.slice(6)
  if (out) {
    const directory = resolve(out)
    await mkdir(directory) // Create-only: never overwrite a prior preparation or approval.
    for (const item of result.prepared)
      await writeFile(
        join(directory, `${item.research_key}.json`),
        `${JSON.stringify(item, null, 2)}\n`,
        { flag: "wx" },
      )
    await writeFile(
      join(directory, "summary.json"),
      `${JSON.stringify({ ...result, prepared: result.prepared.map(({ research_key, operation, readiness, blockers }) => ({ research_key, operation, readiness, blockers })) }, null, 2)}\n`,
      { flag: "wx" },
    )
  }
  process.stdout.write(
    `${JSON.stringify({ mode: result.mode, count: result.prepared.length, output: out ?? null, operations: result.prepared.map((p) => ({ key: p.research_key, operation: p.operation, readiness: p.readiness })) }, null, 2)}\n`,
  )
}
if (process.argv[1]?.endsWith("prepare-internal-admission.ts"))
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
