import { createHash } from "node:crypto"

import { canonicalizeGtin } from "@/lib/product-identity/normalize"
import { catalogEnrichmentFingerprint } from "@/lib/product-intake/catalog-enrichment"

export const SCANNER_IDENTIFIER_BACKFILL_SCHEMA_VERSION =
  "scanner-existing-identifier-backfill-v1" as const
export const SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID = "pqdkhefxsxkyeqelqegq" as const
export const SCANNER_IDENTIFIER_BACKFILL_REVIEWER = "nick" as const
export const SCANNER_IDENTIFIER_BACKFILL_BRANCH = "codex/scanner-catalog-coverage-plan" as const
export const SCANNER_IDENTIFIER_BACKFILL_MAX_PRODUCTS = 25
export const SCANNER_IDENTIFIER_BACKFILL_MIGRATIONS = [
  "20260826142000",
  "20260826142100",
  "20260826142200",
  "20260826143000",
] as const

export type ScannerIdentifierBackfillBatch = "E1" | "E2"
export const SCANNER_IDENTIFIER_BACKFILL_APPROVED_FINGERPRINTS = {
  E1: "2f4ad01a094e3e9ae46a0f8e3dcdd492fa4f8656cc19092749b4b3619258ba04",
  E2: "289f684d92aeea79166efe739ebc2d8a081b1509725261ce6a9fdbb36fe8829f",
} as const satisfies Record<ScannerIdentifierBackfillBatch, string | null>

export type ScannerIdentifierType = "ean" | "gtin" | "barcode"
export type ScannerIdentifierBackfillItem = {
  item_key: string
  product_id: string
  expected_product: {
    name: string
    brand: string | null
    category_key: string
    is_active: boolean
    lifecycle_status: string
  }
  identifiers: Array<{
    type: ScannerIdentifierType
    value: string
    source_url: string
    canonical_gtin14: string
    [key: string]: unknown
  }>
  content_fingerprint: string
  [key: string]: unknown
}
export type ScannerIdentifierBackfillManifest = {
  schema_version: typeof SCANNER_IDENTIFIER_BACKFILL_SCHEMA_VERSION
  batch_id: string
  batch: ScannerIdentifierBackfillBatch
  items: ScannerIdentifierBackfillItem[]
  canonical_gtins: string[]
  raw_manifest: string
  batch_fingerprint: string
}
export type ScannerIdentifierBackfillArgs = {
  apply: boolean
  manifest?: string
  confirm_project?: string
  approved_fingerprint?: string
  reviewed_head?: string
  reviewer?: string
}
export type ScannerBackfillProductRow = {
  id: string
  name: string
  brand: string | null
  category_key: string
  is_active: boolean
  lifecycle_status: string
}
export type ScannerBackfillIdentifierRow = {
  product_id: string
  identifier_type: string
  identifier_value: string
  canonical_gtin14: string | null
  source?: string
}
export type ScannerBackfillBatchLedgerRow = {
  batch_id: string
  batch_fingerprint: string
  reviewed_head: string
  reviewed_by: string
  product_count: number
  gtin_count: number
}
export type ScannerBackfillItemLedgerRow = {
  batch_id: string
  item_key: string
  content_fingerprint: string
  product_id: string
  identifier_count: number
}
export type ScannerIdentifierBackfillReadAdapter = {
  listProducts(productIds: readonly string[]): Promise<ScannerBackfillProductRow[]>
  listIdentifiers(canonicalGtins: readonly string[]): Promise<ScannerBackfillIdentifierRow[]>
  listBatchLedger(batchId: string): Promise<ScannerBackfillBatchLedgerRow[]>
  listItemLedger(batchId: string): Promise<ScannerBackfillItemLedgerRow[]>
  migrationState(version: string): Promise<"absent" | "applied">
}
export type ScannerIdentifierBackfillWriteAdapter = {
  apply(args: {
    p_batch_json: string
    p_expected_batch_fingerprint: string
    p_reviewed_head: string
    p_reviewed_by: typeof SCANNER_IDENTIFIER_BACKFILL_REVIEWER
    p_execution_enabled: true
  }): Promise<unknown>
}
export type ScannerIdentifierBackfillGitState = { head: string; branch: string; clean: boolean }

const SHA256 = /^[a-f0-9]{64}$/
const SHA1 = /^[a-f0-9]{40}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_KEY = /^[a-z0-9][a-z0-9-]*$/
const EXPECTED_SHAPES = {
  E1: { products: 20, gtins: 22 },
  E2: { products: 23, gtins: 26 },
} as const

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}
function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a string`)
  return value
}
function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`)
  return value
}

export function scannerIdentifierBackfillFingerprint(rawManifest: string): string {
  return createHash("sha256").update(rawManifest, "utf8").digest("hex")
}

export function parseScannerIdentifierBackfillManifest(
  rawManifest: string,
): ScannerIdentifierBackfillManifest {
  let decoded: unknown
  try {
    decoded = JSON.parse(rawManifest)
  } catch {
    throw new Error("scanner identifier manifest is invalid JSON")
  }
  const root = record(decoded, "manifest")
  if (root.schema_version !== SCANNER_IDENTIFIER_BACKFILL_SCHEMA_VERSION)
    throw new Error("scanner identifier manifest schema_version is invalid")
  if (root.batch !== "E1" && root.batch !== "E2")
    throw new Error("scanner identifier manifest batch must be E1 or E2")
  const batch = root.batch
  const batchId = requiredString(root.batch_id, "manifest.batch_id")
  if (!SAFE_KEY.test(batchId)) throw new Error("manifest.batch_id must be a safe key")
  if (!Array.isArray(root.items)) throw new Error("manifest.items must be an array")
  if (root.items.length > SCANNER_IDENTIFIER_BACKFILL_MAX_PRODUCTS)
    throw new Error(
      `scanner identifier batch may contain at most ${SCANNER_IDENTIFIER_BACKFILL_MAX_PRODUCTS} products`,
    )
  const expectedShape = EXPECTED_SHAPES[batch]
  if (root.items.length !== expectedShape.products)
    throw new Error(`${batch} must contain exactly ${expectedShape.products} products`)

  const itemKeys = new Set<string>()
  const productIds = new Set<string>()
  const canonicalGtins = new Set<string>()
  const items = root.items.map((rawItem, index): ScannerIdentifierBackfillItem => {
    const item = record(rawItem, `items[${index}]`)
    const itemKey = requiredString(item.item_key, `items[${index}].item_key`)
    if (!SAFE_KEY.test(itemKey) || itemKeys.has(itemKey))
      throw new Error(`items[${index}].item_key is invalid or duplicated`)
    itemKeys.add(itemKey)
    const productId = requiredString(item.product_id, `items[${index}].product_id`)
    if (!UUID.test(productId) || productIds.has(productId))
      throw new Error(`items[${index}].product_id is invalid or duplicated`)
    productIds.add(productId)
    const expected = record(item.expected_product, `items[${index}].expected_product`)
    const expectedProduct = {
      name: requiredString(expected.name, `items[${index}].expected_product.name`),
      brand:
        expected.brand === null
          ? null
          : requiredString(expected.brand, `items[${index}].expected_product.brand`),
      category_key: requiredString(
        expected.category_key,
        `items[${index}].expected_product.category_key`,
      ),
      is_active: requiredBoolean(expected.is_active, `items[${index}].expected_product.is_active`),
      lifecycle_status: requiredString(
        expected.lifecycle_status,
        `items[${index}].expected_product.lifecycle_status`,
      ),
    }
    if (!Array.isArray(item.identifiers) || item.identifiers.length === 0)
      throw new Error(`items[${index}].identifiers must be a non-empty array`)
    const identifiers = item.identifiers.map((rawIdentifier, identifierIndex) => {
      const identifier = record(rawIdentifier, `items[${index}].identifiers[${identifierIndex}]`)
      if (!(["ean", "gtin", "barcode"] as unknown[]).includes(identifier.type))
        throw new Error(`items[${index}].identifiers[${identifierIndex}].type is invalid`)
      const value = requiredString(
        identifier.value,
        `items[${index}].identifiers[${identifierIndex}].value`,
      )
      const canonical = canonicalizeGtin(value)
      if (!canonical)
        throw new Error(
          `items[${index}].identifiers[${identifierIndex}] must have a valid GS1 checksum`,
        )
      if (canonicalGtins.has(canonical))
        throw new Error(`canonical GTIN ${canonical} is duplicated in the selected batch`)
      canonicalGtins.add(canonical)
      const sourceUrl = requiredString(
        identifier.source_url,
        `items[${index}].identifiers[${identifierIndex}].source_url`,
      )
      let parsedUrl: URL
      try {
        parsedUrl = new URL(sourceUrl)
      } catch {
        throw new Error(`items[${index}].identifiers[${identifierIndex}].source_url is invalid`)
      }
      if (parsedUrl.protocol !== "https:")
        throw new Error(`items[${index}].identifiers[${identifierIndex}].source_url must use HTTPS`)
      if (identifier.canonical_gtin14 !== undefined && identifier.canonical_gtin14 !== canonical)
        throw new Error(`items[${index}].identifiers[${identifierIndex}].canonical_gtin14 mismatch`)
      if (identifier.raw_gtin !== undefined && identifier.raw_gtin !== value)
        throw new Error(`items[${index}].identifiers[${identifierIndex}].raw_gtin mismatch`)
      return {
        ...identifier,
        type: identifier.type as ScannerIdentifierType,
        value,
        source_url: sourceUrl,
        canonical_gtin14: canonical,
      }
    })
    const contentFingerprint = requiredString(
      item.content_fingerprint,
      `items[${index}].content_fingerprint`,
    )
    if (!SHA256.test(contentFingerprint))
      throw new Error(`items[${index}].content_fingerprint must be lowercase sha256`)
    const fingerprintPayload = { ...item }
    delete fingerprintPayload.content_fingerprint
    const expectedFingerprint = catalogEnrichmentFingerprint(fingerprintPayload)
    if (contentFingerprint !== expectedFingerprint)
      throw new Error(`items[${index}].content_fingerprint mismatch`)
    return {
      ...item,
      item_key: itemKey,
      product_id: productId,
      expected_product: expectedProduct,
      identifiers,
      content_fingerprint: contentFingerprint,
    }
  })
  if (canonicalGtins.size !== expectedShape.gtins)
    throw new Error(`${batch} must contain exactly ${expectedShape.gtins} unique canonical GTINs`)
  return {
    schema_version: SCANNER_IDENTIFIER_BACKFILL_SCHEMA_VERSION,
    batch_id: batchId,
    batch,
    items,
    canonical_gtins: [...canonicalGtins].sort(),
    raw_manifest: rawManifest,
    batch_fingerprint: scannerIdentifierBackfillFingerprint(rawManifest),
  }
}

function option(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`
  const equals = argv.find((arg) => arg.startsWith(prefix))
  if (equals) return equals.slice(prefix.length)
  const at = argv.indexOf(`--${name}`)
  return at >= 0 ? argv[at + 1] : undefined
}

export function parseScannerIdentifierBackfillArgs(
  argv: readonly string[],
): ScannerIdentifierBackfillArgs {
  const args: ScannerIdentifierBackfillArgs = {
    apply: argv.includes("--apply"),
    manifest: option(argv, "manifest"),
    confirm_project: option(argv, "confirm-project"),
    approved_fingerprint: option(argv, "approved-fingerprint"),
    reviewed_head: option(argv, "reviewed-head"),
    reviewer: option(argv, "reviewer"),
  }
  if (args.apply) {
    if (args.confirm_project !== SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID)
      throw new Error(`apply requires --confirm-project=${SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID}`)
    if (!args.approved_fingerprint || !SHA256.test(args.approved_fingerprint))
      throw new Error("apply requires --approved-fingerprint=<lowercase-sha256>")
    if (!args.reviewed_head || !SHA1.test(args.reviewed_head))
      throw new Error("apply requires --reviewed-head=<40-char-sha>")
    if (args.reviewer !== SCANNER_IDENTIFIER_BACKFILL_REVIEWER)
      throw new Error(`apply requires --reviewer=${SCANNER_IDENTIFIER_BACKFILL_REVIEWER}`)
  }
  return args
}

function productMatches(
  expected: ScannerIdentifierBackfillItem,
  actual: ScannerBackfillProductRow,
) {
  const product = expected.expected_product
  return (
    actual.id === expected.product_id &&
    actual.name === product.name &&
    actual.brand === product.brand &&
    actual.category_key === product.category_key &&
    actual.is_active === product.is_active &&
    actual.lifecycle_status === product.lifecycle_status
  )
}

export async function preflightScannerIdentifierBackfill(input: {
  manifest: ScannerIdentifierBackfillManifest
  args: ScannerIdentifierBackfillArgs
  read: ScannerIdentifierBackfillReadAdapter
  gitState: () => Promise<ScannerIdentifierBackfillGitState>
  projectId: string
}): Promise<{ ok: boolean; blockers: string[]; replay: boolean }> {
  const { manifest, args, read } = input
  const blockers: string[] = []
  const approved = SCANNER_IDENTIFIER_BACKFILL_APPROVED_FINGERPRINTS[manifest.batch]
  if (!approved) blockers.push(`${manifest.batch} approved manifest fingerprint is pending`)
  if (approved && approved !== manifest.batch_fingerprint)
    blockers.push(`${manifest.batch} raw manifest fingerprint is not approved`)
  if (args.approved_fingerprint && args.approved_fingerprint !== manifest.batch_fingerprint)
    blockers.push("provided approved fingerprint does not match raw manifest")
  if (input.projectId !== SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID)
    blockers.push(`Supabase project must be ${SCANNER_IDENTIFIER_BACKFILL_PROJECT_ID}`)
  const git = await input.gitState()
  if (!git.clean) blockers.push("git worktree must be clean")
  if (git.branch !== SCANNER_IDENTIFIER_BACKFILL_BRANCH)
    blockers.push(`git branch must be exactly ${SCANNER_IDENTIFIER_BACKFILL_BRANCH}`)
  if (!args.reviewed_head || git.head !== args.reviewed_head)
    blockers.push("git HEAD must equal --reviewed-head")
  let missingMigration = false
  for (const migration of SCANNER_IDENTIFIER_BACKFILL_MIGRATIONS) {
    if ((await read.migrationState(migration)) !== "applied") {
      blockers.push(`required migration ${migration} is not applied`)
      missingMigration = true
    }
  }
  // canonical_gtin14 and both ledger tables are introduced by these migrations.
  // Report the release blockers without issuing queries against absent schema.
  if (missingMigration) return { ok: false, blockers, replay: false }
  const products = await read.listProducts(manifest.items.map((item) => item.product_id))
  const productsById = new Map(products.map((product) => [product.id, product]))
  for (const item of manifest.items) {
    const actual = productsById.get(item.product_id)
    if (!actual) blockers.push(`expected product is missing: ${item.item_key}`)
    else if (!productMatches(item, actual))
      blockers.push(`exact product identity drift: ${item.item_key}`)
  }
  const identifiers = await read.listIdentifiers(manifest.canonical_gtins)
  for (const identifier of identifiers) {
    if (!identifier.canonical_gtin14) continue
    const expected = manifest.items.find((item) =>
      item.identifiers.some(
        (candidate) => candidate.canonical_gtin14 === identifier.canonical_gtin14,
      ),
    )
    if (!expected || identifier.product_id !== expected.product_id)
      blockers.push(`global canonical GTIN owner collision: ${identifier.canonical_gtin14}`)
  }
  const batches = await read.listBatchLedger(manifest.batch_id)
  const ledger = await read.listItemLedger(manifest.batch_id)
  let replay = false
  if (batches.length > 1 || ledger.length > manifest.items.length)
    blockers.push("conflicting scanner identifier ledger state")
  else if (batches.length === 0 && ledger.length !== 0)
    blockers.push("partial scanner identifier ledger state")
  else if (batches.length === 1) {
    const batch = batches[0]
    replay = true
    if (
      batch.batch_fingerprint !== manifest.batch_fingerprint ||
      batch.reviewed_head !== args.reviewed_head ||
      batch.reviewed_by !== SCANNER_IDENTIFIER_BACKFILL_REVIEWER ||
      batch.product_count !== manifest.items.length ||
      batch.gtin_count !== manifest.canonical_gtins.length ||
      ledger.length !== manifest.items.length
    )
      blockers.push("conflicting or partial scanner identifier replay")
    for (const item of manifest.items) {
      const applied = ledger.find((row) => row.item_key === item.item_key)
      if (
        !applied ||
        applied.content_fingerprint !== item.content_fingerprint ||
        applied.product_id !== item.product_id ||
        applied.identifier_count !== item.identifiers.length
      )
        blockers.push(`conflicting scanner identifier replay: ${item.item_key}`)
    }
  }
  return { ok: blockers.length === 0, blockers, replay }
}

export async function applyScannerIdentifierBackfill(input: {
  manifest: ScannerIdentifierBackfillManifest
  args: ScannerIdentifierBackfillArgs
  preflight: { ok: boolean; blockers: string[] }
  write: ScannerIdentifierBackfillWriteAdapter
  executionEnabled: string | undefined
}) {
  if (!input.args.apply) return { mode: "dry-run" as const, applied: false }
  if (!input.preflight.ok)
    throw new Error(`scanner identifier apply blocked: ${input.preflight.blockers.join("; ")}`)
  if (input.executionEnabled !== "true")
    throw new Error("scanner identifier backfill kill switch is disabled")
  const approved = SCANNER_IDENTIFIER_BACKFILL_APPROVED_FINGERPRINTS[input.manifest.batch]
  if (!approved || approved !== input.manifest.batch_fingerprint)
    throw new Error("scanner identifier manifest fingerprint is not pinned and approved")
  await input.write.apply({
    p_batch_json: input.manifest.raw_manifest,
    p_expected_batch_fingerprint: input.manifest.batch_fingerprint,
    p_reviewed_head: input.args.reviewed_head!,
    p_reviewed_by: SCANNER_IDENTIFIER_BACKFILL_REVIEWER,
    p_execution_enabled: true,
  })
  return { mode: "apply" as const, applied: true, batch: input.manifest.batch }
}

export async function verifyScannerIdentifierBackfill(input: {
  manifest: ScannerIdentifierBackfillManifest
  read: ScannerIdentifierBackfillReadAdapter
}) {
  const products = await input.read.listProducts(
    input.manifest.items.map((item) => item.product_id),
  )
  const identifiers = await input.read.listIdentifiers(input.manifest.canonical_gtins)
  const batches = await input.read.listBatchLedger(input.manifest.batch_id)
  const ledger = await input.read.listItemLedger(input.manifest.batch_id)
  const errors: string[] = []
  for (const item of input.manifest.items) {
    const product = products.find((row) => row.id === item.product_id)
    if (!product || !productMatches(item, product)) errors.push(`product drift: ${item.item_key}`)
    for (const expected of item.identifiers) {
      const owner = identifiers.find((row) => row.canonical_gtin14 === expected.canonical_gtin14)
      if (!owner || owner.product_id !== item.product_id)
        errors.push(`identifier ownership mismatch: ${expected.canonical_gtin14}`)
    }
  }
  if (
    batches.length !== 1 ||
    batches[0].batch_fingerprint !== input.manifest.batch_fingerprint ||
    ledger.length !== input.manifest.items.length
  )
    errors.push("batch ledger readback mismatch")
  return {
    ok: errors.length === 0,
    errors,
    product_count: products.length,
    gtin_count: identifiers.length,
    batch_fingerprint: input.manifest.batch_fingerprint,
  }
}
