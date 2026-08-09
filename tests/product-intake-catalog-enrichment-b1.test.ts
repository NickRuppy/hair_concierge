import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  B1_B0_INDEX_FINGERPRINT,
  B1_EXPECTED_KEYS,
  B1_IDENTITY,
  applyB1,
  assertB1BatchSelection,
  parseB1ApplyArgs,
  preflightB1,
  sha256Bytes,
  verifyB1Relations,
} from "../src/lib/product-intake/catalog-enrichment/b1"

const ROOT = "data/catalog-enrichment/personal-plan-launch-v1"
const PUBLIC = "https://pqdkhefxsxkyeqelqegq.supabase.co"
type Row = Record<string, unknown>

async function manifests() {
  const groups = ["heat", "scalp"] as const
  return Promise.all(
    groups.flatMap((group) =>
      B1_EXPECTED_KEYS[group].map(async (key) => {
        const path = `${ROOT}/${group}/${key}.json`
        try {
          return JSON.parse(await readFile(path, "utf8")) as Row
        } catch {
          return null
        }
      }),
    ),
  ).then((items) => items.filter((item): item is Row => item !== null))
}

async function fixture() {
  const rows = await manifests()
  assert.equal(rows.length, 15)
  const objects = new Map<string, Uint8Array>()
  for (const item of rows) {
    const image = item.image as Row
    objects.set(String(image.expected_storage_path), await readFile(String(image.local_asset_path)))
  }
  const brands = Object.values(B1_IDENTITY).reduce<Row[]>(
    (all, identity) =>
      all.some((row) => row.id === identity.brandId)
        ? all
        : [...all, { id: identity.brandId, canonical_name: identity.brandName }],
    [],
  )
  const lines = Object.values(B1_IDENTITY).reduce<Row[]>(
    (all, identity) =>
      !identity.lineId || all.some((row) => row.id === identity.lineId)
        ? all
        : [
            ...all,
            { id: identity.lineId, brand_id: identity.brandId, canonical_name: identity.lineName },
          ],
    [],
  )
  const categories = [
    { key: "heat_protectant", is_catalog_supported: true, is_intake_supported: true },
    { key: "scalp_care", is_catalog_supported: true, is_intake_supported: true },
  ]
  const pages: Record<string, Row[]> = {
    products: [],
    product_identifiers: [],
    brands,
    product_lines: lines,
    product_categories: categories,
  }
  return {
    rows,
    objects,
    pages,
    read: {
      list: async (table: string, offset: number, limit: number) =>
        (pages[table] ?? []).slice(offset, offset + limit),
      object: async (_bucket: string, path: string) => objects.get(path) ?? null,
      hasTables: async () => [],
    },
  }
}

test("real 15 B0 manifests produce the frozen canonical package and 13/2 recommendation state", async () => {
  const f = await fixture()
  const result = await preflightB1({
    read: f.read,
    publicSupabaseUrl: PUBLIC,
    now: new Date("2026-08-10T00:00:00Z"),
  })
  assert.equal(result.ok, true, result.blockers.join("\n"))
  assert.equal(result.b0_index_fingerprint, B1_B0_INDEX_FINGERPRINT)
  assert.equal(result.package?.package.products.length, 15)
  assert.equal(
    result.package?.package.products.filter((item) => item.product.is_chaarlie_recommended === true)
      .length,
    13,
  )
  assert.match(String(result.package?.fingerprint), /^[a-f0-9]{64}$/)
})

test("preflight fails closed on freshness, schema, identity, category, duplicate, and Storage drift", async () => {
  const f = await fixture()
  const stale = await preflightB1({
    read: f.read,
    publicSupabaseUrl: PUBLIC,
    now: new Date("2026-09-01T00:00:00Z"),
  })
  assert.equal(stale.ok, false)
  assert.ok(stale.blockers.some((item) => item.startsWith("stale commercial observation")))
  const missingSchema = await preflightB1({
    read: { ...f.read, hasTables: async () => ["catalog_enrichment_applied_items"] },
    publicSupabaseUrl: PUBLIC,
    now: new Date("2026-08-10T00:00:00Z"),
  })
  assert.ok(
    missingSchema.blockers.some((item) => item.includes("catalog_enrichment_applied_items")),
  )
  const badIdentity = await preflightB1({
    read: {
      ...f.read,
      list: async (table, offset, limit) =>
        table === "brands" ? [] : (f.pages[table] ?? []).slice(offset, offset + limit),
    },
    publicSupabaseUrl: PUBLIC,
    now: new Date("2026-08-10T00:00:00Z"),
  })
  assert.ok(badIdentity.blockers.some((item) => item.includes("canonical brand identity mismatch")))
  const duplicate = {
    brand_id: Object.values(B1_IDENTITY)[0]!.brandId,
    name: "Hitzeschutzspray 2 Phasen",
    category_key: "heat_protectant",
  }
  const duplicateResult = await preflightB1({
    read: {
      ...f.read,
      list: async (table, offset, limit) =>
        (table === "products" ? [duplicate] : (f.pages[table] ?? [])).slice(offset, offset + limit),
    },
    publicSupabaseUrl: PUBLIC,
    now: new Date("2026-08-10T00:00:00Z"),
  })
  assert.ok(duplicateResult.blockers.some((item) => item.startsWith("exact product duplicate")))
  const first = f.rows[0]!.image as Row
  f.objects.set(String(first.expected_storage_path), new Uint8Array([0]))
  const storage = await preflightB1({
    read: f.read,
    publicSupabaseUrl: PUBLIC,
    now: new Date("2026-08-10T00:00:00Z"),
  })
  assert.ok(storage.blockers.some((item) => item.startsWith("Storage object SHA mismatch")))
})

test("preflight completes paginated reads and detects identifiers in inactive catalog rows", async () => {
  const f = await fixture()
  const first = f.rows[0]!.identity as Row
  const id = (first.identifiers as Row[])[0]!
  const firstPage: Row[] = Array.from({ length: 100 }, (_, index) => ({
    identifier_type: "ean",
    identifier_value: `ignored-${index}`,
  }))
  f.pages.product_identifiers = [
    ...firstPage,
    { identifier_type: id.type, identifier_value: id.value, is_active: false },
  ]
  const result = await preflightB1({
    read: f.read,
    publicSupabaseUrl: PUBLIC,
    now: new Date("2026-08-10T00:00:00Z"),
  })
  assert.ok(result.blockers.some((item) => item.startsWith("identifier duplicate")))

  const eucerin = f.rows.find(
    (row) => row.product_key === "eucerin-dermocapillaire-urea-intensive-tonic",
  )!
  const barcode = ((eucerin.product_payload as Row).final as Row).identifiers as Row[]
  const pzn = barcode.find((identifier) => identifier.type === "barcode")!
  f.pages.product_identifiers = [
    { identifier_type: "barcode", identifier_value: String(pzn.value).replaceAll(":", "") },
  ]
  const normalizedCollision = await preflightB1({
    read: f.read,
    publicSupabaseUrl: PUBLIC,
    now: new Date("2026-08-10T00:00:00Z"),
  })
  assert.ok(
    normalizedCollision.blockers.includes(
      "identifier duplicate: eucerin-dermocapillaire-urea-intensive-tonic",
    ),
  )
})

test("apply requires exact 15 image paths, reuses matching objects, and never RPCs in dry run", async () => {
  assert.doesNotThrow(() => assertB1BatchSelection(["--batch", "personal-plan-launch-v1"]))
  assert.throws(() => assertB1BatchSelection(["--batch", "other-batch"]), /requires --batch/)
  const f = await fixture()
  const preflight = await preflightB1({
    read: f.read,
    publicSupabaseUrl: PUBLIC,
    now: new Date("2026-08-10T00:00:00Z"),
  })
  assert.equal(preflight.ok, true)
  const images = preflight.package!.package.products.map((item) => ({
    path: String(item.image_asset.storage_path),
    bytes: f.objects.get(String(item.image_asset.storage_path))!,
    sha256: String(item.image_asset.asset_sha256),
  }))
  const applyArgs = parseB1ApplyArgs([
    "--apply",
    "--confirm",
    "--confirm-batch",
    "personal-plan-launch-v1",
    "--reviewed-by",
    "nick",
    "--expected-batch-fingerprint",
    preflight.package!.fingerprint,
    "--expected-content-fingerprint",
    preflight.b0_index_fingerprint!,
  ])
  let rpc = 0
  let uploads = 0
  const write = {
    object: async (_bucket: string, path: string) => f.objects.get(path) ?? null,
    upload: async () => {
      uploads += 1
    },
    rpc: async () => {
      rpc += 1
    },
  }
  const dry = await applyB1({ args: parseB1ApplyArgs([]), preflight, images: [], write })
  assert.equal(dry.applied, false)
  assert.equal(rpc, 0)
  await assert.rejects(
    applyB1({ args: applyArgs, preflight, images: images.slice(1), write }),
    /exactly match/,
  )
  await applyB1({ args: applyArgs, preflight, images, write })
  assert.equal(uploads, 0)
  assert.equal(rpc, 1)

  const mismatchObjects = new Map(f.objects)
  mismatchObjects.set(images[0]!.path, new Uint8Array([0]))
  await assert.rejects(
    applyB1({
      args: applyArgs,
      preflight,
      images,
      write: { ...write, object: async (_bucket, path) => mismatchObjects.get(path) ?? null },
    }),
    /existing Storage object SHA mismatch/,
  )

  const uploaded = new Map<string, Uint8Array>()
  let uploadedRpc = 0
  const uploadResult = await applyB1({
    args: applyArgs,
    preflight,
    images,
    write: {
      object: async (_bucket, path) => uploaded.get(path) ?? null,
      upload: async (_bucket, path, bytes) => {
        uploaded.set(path, bytes)
      },
      rpc: async () => {
        uploadedRpc += 1
      },
    },
  })
  assert.equal(uploadResult.uploaded_paths.length, 15)
  assert.equal(uploadedRpc, 1)

  const orphaned = new Map<string, Uint8Array>()
  await assert.rejects(
    applyB1({
      args: applyArgs,
      preflight,
      images,
      write: {
        object: async (_bucket, path) => orphaned.get(path) ?? null,
        upload: async (_bucket, path, bytes) => {
          orphaned.set(path, bytes)
        },
        rpc: async () => {
          throw new Error("db unavailable")
        },
      },
    }),
    /Newly uploaded unreferenced paths:/,
  )
})

test("post-apply verifier accepts exact relations and rejects a product-value mismatch", async () => {
  const f = await fixture()
  const preflight = await preflightB1({
    read: f.read,
    publicSupabaseUrl: PUBLIC,
    now: new Date("2026-08-10T00:00:00Z"),
  })
  assert.equal(preflight.ok, true)
  const pkg = preflight.package!
  const products: Row[] = pkg.package.products.map((item, index) => ({
    id: `p-${index}`,
    ...item.product,
  }))
  const byKey = new Map(pkg.package.products.map((item, index) => [item.product_key, `p-${index}`]))
  const list = async (table: string) => {
    if (table === "products") return products
    if (table === "product_image_assets")
      return pkg.package.products.map((item, index) => ({
        product_id: `p-${index}`,
        ...item.image_asset,
      }))
    if (table === "product_identifiers")
      return pkg.package.products.flatMap((item, index) =>
        item.identifiers.map((identifier) => ({
          product_id: `p-${index}`,
          identifier_type: identifier.type,
          identifier_value: identifier.value,
          ...(identifier.source === undefined ? {} : { source: identifier.source }),
        })),
      )
    if (table === "product_heat_protectant_specs")
      return pkg.package.products.flatMap((item, index) =>
        item.heat_spec ? [{ product_id: `p-${index}`, ...item.heat_spec }] : [],
      )
    if (table === "product_scalp_care_specs")
      return pkg.package.products.flatMap((item, index) =>
        item.scalp_spec ? [{ product_id: `p-${index}`, ...item.scalp_spec }] : [],
      )
    if (table === "product_application_protocols")
      return pkg.package.products.flatMap((item, index) =>
        item.protocols.map((protocol) => ({ product_id: `p-${index}`, ...protocol })),
      )
    if (table === "catalog_enrichment_applied_items")
      return pkg.package.products.map((item) => ({
        batch_id: "personal-plan-launch-v1",
        product_key: item.product_key,
        product_id: byKey.get(item.product_key),
        batch_fingerprint: pkg.fingerprint,
        content_fingerprint: item.content_fingerprint,
        reviewed_by: "nick",
      }))
    return []
  }
  const read = {
    list: async (table: string, offset: number, limit: number) =>
      (await list(table)).slice(offset, offset + limit),
    object: async (_bucket: string, path: string) => f.objects.get(path) ?? null,
  }
  const verified = await verifyB1Relations(read, pkg)
  assert.equal(verified.ok, true, verified.errors.join("\n"))
  products[0]!.price_eur = 999
  const mismatch = await verifyB1Relations(read, pkg)
  assert.equal(mismatch.ok, false)
  assert.ok(mismatch.errors.some((item) => item.includes("price_eur")))
})
