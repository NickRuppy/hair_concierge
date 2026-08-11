import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

type Row = Record<string, unknown>

export const SCALP_IMAGE_CORRECTION_PROJECT_ID = "pqdkhefxsxkyeqelqegq" as const
export const SCALP_IMAGE_CORRECTION_MIGRATION =
  "20260811095134_catalog_enrichment_scalp_image_correction_v1" as const

const storagePrefix = `https://${SCALP_IMAGE_CORRECTION_PROJECT_ID}.supabase.co/storage/v1/object/public/product-images/`
const productKey = "the-ordinary-multi-peptide-hair-density-serum"
const assetDirectory = `catalog-enrichment/personal-plan-launch-v1/scalp/${productKey}`
const localDirectory = `ops/catalog-enrichment/personal-plan-launch-v1/scalp/${productKey}/images/final`

export const SCALP_IMAGE_CORRECTION = {
  schema_version: "personal-plan-scalp-image-correction-v1",
  correction_id: "personal-plan-scalp-the-ordinary-image-correction-v1",
  product_id: "58aa2f19-b23a-4e09-ab0f-68c359371c9e",
  product_key: productKey,
  product_name: "Multi-Peptide Serum for Hair Density",
  category_key: "scalp_care",
  source_batch_id: "personal-plan-launch-v1",
  source_apply_batch_id: "personal-plan-scalp-launch-v1",
  source_batch_fingerprint: "e6cbbe9ce2dc3d3b29655741cfe7572dd29d8b5bb5bea1a7225fd58359328e50",
  source_content_fingerprint: "10fbf543434519912f702856b25742c418df5782f5de06472be27a79d51fb6e7",
  old_asset: {
    storage_bucket: "product-images",
    storage_path: `${assetDirectory}/${productKey}-6bb9be89b327.webp`,
    public_url: `${storagePrefix}${assetDirectory}/${productKey}-6bb9be89b327.webp`,
    sha256: "6bb9be89b327984d4fe8f95c8009896bfec386f04dbf544a208e78268079dd5c",
    local_asset_path: `${localDirectory}/${productKey}-6bb9be89b327.webp`,
  },
  new_asset: {
    storage_bucket: "product-images",
    storage_path: `${assetDirectory}/${productKey}-1a79af996795.webp`,
    public_url: `${storagePrefix}${assetDirectory}/${productKey}-1a79af996795.webp`,
    sha256: "1a79af996795ea031e0a28b0220d37109950e0aed1a1175bb358e944efdbbc66",
    local_asset_path: `${localDirectory}/${productKey}-1a79af996795.webp`,
    source_page_url:
      "https://theordinary.com/de-de/multi-peptide-serum-for-hair-density-hair-scalp-treatment-100434.html",
    source_image_url:
      "https://theordinary.com/dw/image/v2/BFKJ_PRD/on/demandware.static/-/Sites-deciem-master/default/dwe085e4f9/Images/products/The%20Ordinary/rdn-multi-peptide-serum-for-hair-density-60ml.png?sw=1200&sh=1200&sm=fit",
    source_type: "brand",
    quality_confidence: "high",
    processing_method: "local",
    processing_notes: "official_alpha_source_with_deterministic_symmetric_shadow_mask",
    notes:
      "Nick approved the final shadow-free image on 2026-08-11; official alpha source with deterministic symmetric shadow mask.",
  },
} as const

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Row)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
    return `{${entries.join(",")}}`
  }
  return JSON.stringify(value)
}

export function sha256CorrectionBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}

export const SCALP_IMAGE_CORRECTION_FINGERPRINT = createHash("sha256")
  .update(stableJson(SCALP_IMAGE_CORRECTION), "utf8")
  .digest("hex")

export type ScalpImageCorrectionArgs = {
  apply: boolean
  confirm: boolean
  reviewed_by?: "nick"
  reviewed_head?: string
  expect_migration?: "absent" | "applied"
}

export function parseScalpImageCorrectionArgs(argv: readonly string[]): ScalpImageCorrectionArgs {
  const flags: Record<string, string | boolean> = {}
  const allowed = new Set(["apply", "confirm", "reviewed-by", "reviewed-head", "expect-migration"])
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index]!
    if (!raw.startsWith("--")) throw new Error(`Unexpected Scalp image correction value: ${raw}`)
    const equals = raw.indexOf("=")
    const key = raw.slice(2, equals < 0 ? undefined : equals)
    if (!allowed.has(key)) throw new Error(`Unknown Scalp image correction argument: --${key}`)
    flags[key] =
      equals < 0
        ? argv[index + 1] && !argv[index + 1]!.startsWith("--")
          ? argv[++index]!
          : true
        : raw.slice(equals + 1)
  }
  const args: ScalpImageCorrectionArgs = {
    apply: flags.apply === true,
    confirm: flags.confirm === true,
  }
  if (flags["reviewed-by"] === "nick") args.reviewed_by = "nick"
  if (typeof flags["reviewed-head"] === "string") args.reviewed_head = flags["reviewed-head"]
  if (flags["expect-migration"] === "absent" || flags["expect-migration"] === "applied")
    args.expect_migration = flags["expect-migration"]
  if (args.apply) {
    if (!args.confirm) throw new Error("Scalp image correction apply requires --confirm")
    if (args.reviewed_by !== "nick")
      throw new Error("Scalp image correction apply requires --reviewed-by=nick")
    if (!args.reviewed_head || !/^[a-f0-9]{40}$/.test(args.reviewed_head))
      throw new Error("Scalp image correction apply requires --reviewed-head=<40-char-sha>")
    if (args.expect_migration !== "applied")
      throw new Error("Scalp image correction apply requires --expect-migration=applied")
  }
  return args
}

export type ScalpImageCorrectionRead = {
  list: (table: string, offset: number, limit: number) => Promise<Row[]>
  object: (bucket: string, path: string) => Promise<Uint8Array | null>
  hasTables: (tables: readonly string[]) => Promise<string[]>
  migrationState: (migration: string) => Promise<"absent" | "applied">
}

type Release = {
  reviewedHead: string
  projectId: string
  expectMigration: "absent" | "applied"
}

export type ScalpImageCorrectionPreflightInput = {
  read: ScalpImageCorrectionRead
  release: Release
  gitState: () => Promise<{ head: string; clean: boolean }>
  mode?: "pre_apply" | "apply" | "post_apply"
}

async function listAll(read: ScalpImageCorrectionRead, table: string): Promise<Row[]> {
  const rows: Row[] = []
  for (let offset = 0; ; offset += 1000) {
    const page = await read.list(table, offset, 1000)
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

function exactRows(rows: Row[], key: string, value: string): Row[] {
  return rows.filter((row) => row[key] === value)
}

async function storageBlockers(read: ScalpImageCorrectionRead, requireNew: boolean) {
  const blockers: string[] = []
  const oldBytes = await read.object(
    SCALP_IMAGE_CORRECTION.old_asset.storage_bucket,
    SCALP_IMAGE_CORRECTION.old_asset.storage_path,
  )
  if (!oldBytes || sha256CorrectionBytes(oldBytes) !== SCALP_IMAGE_CORRECTION.old_asset.sha256)
    blockers.push("old immutable Storage object hash mismatch")
  const newBytes = await read.object(
    SCALP_IMAGE_CORRECTION.new_asset.storage_bucket,
    SCALP_IMAGE_CORRECTION.new_asset.storage_path,
  )
  if (newBytes && sha256CorrectionBytes(newBytes) !== SCALP_IMAGE_CORRECTION.new_asset.sha256)
    blockers.push("new immutable Storage object hash mismatch")
  if (requireNew && !newBytes) blockers.push("new immutable Storage object is missing")
  return blockers
}

export async function preflightScalpImageCorrection(input: ScalpImageCorrectionPreflightInput) {
  const blockers: string[] = []
  const { read, release } = input
  if (!/^[a-f0-9]{40}$/.test(release.reviewedHead)) blockers.push("reviewed Git head is invalid")
  if (release.projectId !== SCALP_IMAGE_CORRECTION_PROJECT_ID)
    blockers.push("linked Supabase project mismatch")
  const git = await input.gitState()
  if (git.head !== release.reviewedHead)
    blockers.push("current Git head differs from reviewed head")
  if (!git.clean) blockers.push("worktree is not clean")
  const migrationState = await read.migrationState(SCALP_IMAGE_CORRECTION_MIGRATION)
  if (migrationState !== release.expectMigration)
    blockers.push("correction migration state mismatch")

  const requiredTables = ["products", "product_image_assets", "catalog_enrichment_applied_items"]
  if (migrationState === "applied") requiredTables.push("catalog_enrichment_image_corrections")
  const missing = await read.hasTables(requiredTables)
  if (missing.length) blockers.push(`missing required tables: ${missing.join(", ")}`)

  const products = exactRows(
    await listAll(read, "products"),
    "id",
    SCALP_IMAGE_CORRECTION.product_id,
  )
  const assets = exactRows(
    await listAll(read, "product_image_assets"),
    "product_id",
    SCALP_IMAGE_CORRECTION.product_id,
  )
  const sourceReceipts = exactRows(
    await listAll(read, "catalog_enrichment_applied_items"),
    "product_id",
    SCALP_IMAGE_CORRECTION.product_id,
  ).filter(
    (row) =>
      row.batch_id === SCALP_IMAGE_CORRECTION.source_apply_batch_id &&
      row.product_key === SCALP_IMAGE_CORRECTION.product_key,
  )
  const receipts =
    migrationState === "applied"
      ? exactRows(
          await listAll(read, "catalog_enrichment_image_corrections"),
          "correction_id",
          SCALP_IMAGE_CORRECTION.correction_id,
        )
      : []
  if (products.length !== 1) blockers.push("expected exactly one allowlisted product row")
  if (assets.length !== 1) blockers.push("expected exactly one allowlisted image provenance row")
  if (sourceReceipts.length !== 1) blockers.push("expected exactly one frozen Scalp launch receipt")
  else {
    const sourceReceipt = sourceReceipts[0]
    if (
      sourceReceipt.batch_fingerprint !== SCALP_IMAGE_CORRECTION.source_batch_fingerprint ||
      sourceReceipt.content_fingerprint !== SCALP_IMAGE_CORRECTION.source_content_fingerprint ||
      sourceReceipt.reviewed_by !== "nick"
    )
      blockers.push("frozen Scalp launch receipt is divergent")
  }

  const postApply =
    input.mode === "post_apply" ||
    (input.mode === "apply" &&
      products[0]?.image_url === SCALP_IMAGE_CORRECTION.new_asset.public_url)
  const expected = postApply ? SCALP_IMAGE_CORRECTION.new_asset : SCALP_IMAGE_CORRECTION.old_asset
  const product = products[0]
  const asset = assets[0]
  if (product && product.image_url !== expected.public_url)
    blockers.push(`${postApply ? "new" : "old"} image URL does not match exact expected state`)
  if (product && product.name !== SCALP_IMAGE_CORRECTION.product_name)
    blockers.push("allowlisted product name mismatch")
  if (product && product.category_key !== SCALP_IMAGE_CORRECTION.category_key)
    blockers.push("allowlisted product category mismatch")
  if (
    asset &&
    (asset.storage_bucket !== expected.storage_bucket ||
      asset.storage_path !== expected.storage_path ||
      asset.public_url !== expected.public_url ||
      asset.asset_sha256 !== expected.sha256)
  )
    blockers.push(`${postApply ? "new" : "old"} image provenance does not match exact state`)
  if (!postApply && receipts.length)
    blockers.push("correction ledger already contains this correction")
  if (postApply) {
    if (receipts.length !== 1) blockers.push("expected exactly one correction ledger receipt")
    else if (receipts[0].correction_fingerprint !== SCALP_IMAGE_CORRECTION_FINGERPRINT)
      blockers.push("correction ledger fingerprint mismatch")
  }
  blockers.push(...(await storageBlockers(read, postApply)))

  const local = new Uint8Array(await readFile(SCALP_IMAGE_CORRECTION.new_asset.local_asset_path))
  if (sha256CorrectionBytes(local) !== SCALP_IMAGE_CORRECTION.new_asset.sha256)
    blockers.push("reviewed local replacement hash mismatch")
  return {
    ok: blockers.length === 0,
    blockers,
    correction_id: SCALP_IMAGE_CORRECTION.correction_id,
    correction_fingerprint: SCALP_IMAGE_CORRECTION_FINGERPRINT,
    migration_state: migrationState,
    state: postApply ? ("already_applied" as const) : ("pending" as const),
  }
}

type Write = {
  upload: (bucket: string, path: string, bytes: Uint8Array) => Promise<unknown>
  object: (bucket: string, path: string) => Promise<Uint8Array | null>
  rpc: (
    name: "apply_catalog_enrichment_scalp_image_correction_v1",
    args: {
      p_expected_correction_fingerprint: string
      p_reviewed_by: "nick"
    },
  ) => Promise<unknown>
}

export async function applyScalpImageCorrection(input: {
  args: ScalpImageCorrectionArgs
  preflight: Awaited<ReturnType<typeof preflightScalpImageCorrection>>
  preflightInput: ScalpImageCorrectionPreflightInput
  image: { bytes: Uint8Array }
  write: Write
}) {
  if (!input.args.apply || !input.args.confirm || input.args.reviewed_by !== "nick")
    throw new Error("Scalp image correction write confirmation is incomplete")
  if (!input.preflight.ok)
    throw new Error(
      `Scalp image correction preflight blocked: ${input.preflight.blockers.join("; ")}`,
    )
  const rerun = await preflightScalpImageCorrection(input.preflightInput)
  if (!rerun.ok)
    throw new Error(`Scalp image correction preflight rerun blocked: ${rerun.blockers.join("; ")}`)
  if (sha256CorrectionBytes(input.image.bytes) !== SCALP_IMAGE_CORRECTION.new_asset.sha256)
    throw new Error("replacement image bytes do not match approved hash")

  const { storage_bucket: bucket, storage_path: path } = SCALP_IMAGE_CORRECTION.new_asset
  const existing = await input.write.object(bucket, path)
  let uploaded = false
  if (existing) {
    if (sha256CorrectionBytes(existing) !== SCALP_IMAGE_CORRECTION.new_asset.sha256)
      throw new Error("refusing to overwrite mismatched immutable replacement object")
  } else {
    await input.write.upload(bucket, path, input.image.bytes)
    uploaded = true
  }
  const verified = await input.write.object(bucket, path)
  if (!verified || sha256CorrectionBytes(verified) !== SCALP_IMAGE_CORRECTION.new_asset.sha256)
    throw new Error(`uploaded replacement failed hash verification; orphan candidate: ${path}`)
  try {
    await input.write.rpc("apply_catalog_enrichment_scalp_image_correction_v1", {
      p_expected_correction_fingerprint: SCALP_IMAGE_CORRECTION_FINGERPRINT,
      p_reviewed_by: "nick",
    })
  } catch (error) {
    const suffix = uploaded ? `; orphan object requires review: ${path}` : ""
    throw new Error(`Scalp image correction RPC failed: ${(error as Error).message}${suffix}`)
  }
  return { applied: true, uploaded, correction_id: SCALP_IMAGE_CORRECTION.correction_id }
}

export async function verifyScalpImageCorrection(read: ScalpImageCorrectionRead) {
  const blockers: string[] = []
  const products = exactRows(
    await listAll(read, "products"),
    "id",
    SCALP_IMAGE_CORRECTION.product_id,
  )
  const assets = exactRows(
    await listAll(read, "product_image_assets"),
    "product_id",
    SCALP_IMAGE_CORRECTION.product_id,
  )
  const receipts = exactRows(
    await listAll(read, "catalog_enrichment_image_corrections"),
    "correction_id",
    SCALP_IMAGE_CORRECTION.correction_id,
  )
  if (
    products.length !== 1 ||
    products[0].image_url !== SCALP_IMAGE_CORRECTION.new_asset.public_url
  )
    blockers.push("product does not reference the reviewed replacement URL")
  if (assets.length !== 1) blockers.push("expected exactly one image provenance row")
  else {
    const asset = assets[0]
    for (const [key, expected] of Object.entries({
      storage_bucket: SCALP_IMAGE_CORRECTION.new_asset.storage_bucket,
      storage_path: SCALP_IMAGE_CORRECTION.new_asset.storage_path,
      public_url: SCALP_IMAGE_CORRECTION.new_asset.public_url,
      asset_sha256: SCALP_IMAGE_CORRECTION.new_asset.sha256,
      source_page_url: SCALP_IMAGE_CORRECTION.new_asset.source_page_url,
      source_image_url: SCALP_IMAGE_CORRECTION.new_asset.source_image_url,
      source_type: SCALP_IMAGE_CORRECTION.new_asset.source_type,
      quality_confidence: SCALP_IMAGE_CORRECTION.new_asset.quality_confidence,
      processing_method: SCALP_IMAGE_CORRECTION.new_asset.processing_method,
      manifest_batch_id: SCALP_IMAGE_CORRECTION.correction_id,
      user_approved: true,
    })) {
      if (asset[key] !== expected) blockers.push(`image provenance ${key} mismatch`)
    }
  }
  if (receipts.length !== 1) blockers.push("expected exactly one correction ledger receipt")
  else {
    const receipt = receipts[0]
    if (receipt.correction_fingerprint !== SCALP_IMAGE_CORRECTION_FINGERPRINT)
      blockers.push("correction ledger fingerprint mismatch")
    if (receipt.product_id !== SCALP_IMAGE_CORRECTION.product_id)
      blockers.push("correction ledger product mismatch")
    if (receipt.old_asset_sha256 !== SCALP_IMAGE_CORRECTION.old_asset.sha256)
      blockers.push("correction ledger old hash mismatch")
    if (receipt.new_asset_sha256 !== SCALP_IMAGE_CORRECTION.new_asset.sha256)
      blockers.push("correction ledger new hash mismatch")
    if (receipt.reviewed_by !== "nick") blockers.push("correction ledger reviewer mismatch")
  }
  blockers.push(...(await storageBlockers(read, true)))
  return { ok: blockers.length === 0, blockers }
}
