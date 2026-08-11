import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  HEAT_MIGRATION,
  SCALP_BATCH_ID,
  SCALP_COHORT_INDEX_FINGERPRINT,
  SCALP_EXPECTED_KEYS,
  SCALP_IDENTITY,
  SCALP_MIGRATION_IDENTITY_SEEDS,
  SCALP_MIGRATION,
  SCALP_PACKAGE_FINGERPRINT,
  SCALP_SCHEMA_VERSION,
  SCALP_SUPABASE_PROJECT_ID,
  applyScalp,
  buildScalpPackage,
  loadScalpManifests,
  normalizedScalpIdentifier,
  parseScalpApplyArgs,
  preflightScalp,
  scalpProjectIdFromUrl,
  sha256Bytes,
  scalpMigrationIdentitySeedBlockers,
  verifyScalpRelations,
} from "../src/lib/product-intake/catalog-enrichment/scalp"
import {
  assertScalpLinkedProjectRef,
  parseScalpLinkedMigrationState,
} from "../scripts/product-intake/catalog-enrichment/scalp-client"

const migrationSql = readFileSync(`supabase/migrations/${SCALP_MIGRATION}.sql`, "utf8")

test("approved Scalp German copy uses proper umlauts and spelling", async () => {
  const manifests = await loadScalpManifests()
  const copyFields = new Set([
    "application_instructions",
    "clean_name",
    "evidence",
    "name",
    "source_text",
  ])
  const forbidden =
    /\b(?:Klaerendes|anschliessend|ausspuelen|naechsten|Taeglich|taeglich|Waeschen|moeglich|fuer|ausfuehrliche|Spuelung|Identitaet|Verfuegbarkeit)\b/
  const defects: string[] = []
  const audit = (value: unknown, path: string): void => {
    if (!value || typeof value !== "object") return
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const nestedPath = `${path}.${key}`
      if (copyFields.has(key) && typeof nested === "string" && forbidden.test(nested)) {
        defects.push(`${nestedPath}: ${nested.match(forbidden)?.[0]}`)
      }
      audit(nested, nestedPath)
    }
  }
  for (const { manifest } of manifests) audit(manifest, manifest.product_key)
  assert.deepEqual(defects, [])
})

test("Scalp migration accepts exactly the TypeScript-approved package header", () => {
  assert.ok(
    migrationSql.includes(
      `v_approved_batch_fingerprint constant text := '${SCALP_PACKAGE_FINGERPRINT}'`,
    ),
  )
  assert.ok(
    migrationSql.includes(`v_batch->>'schema_version' IS DISTINCT FROM '${SCALP_SCHEMA_VERSION}'`),
  )
  assert.ok(migrationSql.includes(`v_batch->>'batch_id' IS DISTINCT FROM '${SCALP_BATCH_ID}'`))
  assert.ok(
    migrationSql.includes(
      `v_batch->>'cohort_index_fingerprint' IS DISTINCT FROM '${SCALP_COHORT_INDEX_FINGERPRINT}'`,
    ),
  )
})

async function appliedPreflightFixture() {
  const normalized = (value: string) =>
    value
      .toLocaleLowerCase("en")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  const identities = Object.values(SCALP_IDENTITY)
  const brands = [
    ...new Map(
      identities.map((identity) => [
        identity.brandId,
        {
          id: identity.brandId,
          canonical_name: identity.brandName,
          normalized_name: normalized(identity.brandName),
        },
      ]),
    ).values(),
  ]
  const lines = [
    ...new Map(
      identities
        .filter((identity) => identity.lineId)
        .map((identity) => [
          identity.lineId,
          {
            id: identity.lineId,
            brand_id: identity.brandId,
            canonical_name: identity.lineName,
            normalized_name: normalized(String(identity.lineName)),
          },
        ]),
    ).values(),
  ]
  const tables: Record<string, Record<string, unknown>[]> = {
    brands,
    product_lines: lines,
    product_categories: [
      { key: "scalp_care", is_catalog_supported: true, is_intake_supported: true },
    ],
    products: [],
    product_identifiers: [],
    catalog_enrichment_applied_items: [],
  }
  const read = {
    list: async (table: string, offset: number, limit: number) =>
      (tables[table] ?? []).slice(offset, offset + limit),
    object: async () => null,
    hasTables: async () => [],
    migrationState: async (migration: string) =>
      migration === HEAT_MIGRATION || migration === SCALP_MIGRATION
        ? ("applied" as const)
        : ("absent" as const),
  }
  const release = {
    reviewedHead: "a".repeat(40),
    projectId: SCALP_SUPABASE_PROJECT_ID,
    expectScalpMigration: "applied" as const,
  }
  const preflightInput = {
    read,
    gitState: async () => ({ head: release.reviewedHead, clean: true }),
    publicSupabaseUrl: `https://${SCALP_SUPABASE_PROJECT_ID}.supabase.co`,
    now: new Date("2026-08-11T12:00:00Z"),
  }
  const preflight = await preflightScalp({ ...preflightInput, release })
  assert.equal(preflight.ok, true, preflight.blockers.join("; "))
  const manifests = await loadScalpManifests()
  const images = manifests.map(({ manifest }) => {
    const image = manifest.image as Record<string, unknown>
    const bytes = new Uint8Array(readFileSync(String(image.local_asset_path)))
    return {
      path: String(image.expected_storage_path),
      bytes,
      sha256: sha256Bytes(bytes),
    }
  })
  return { preflight, preflightInput, release, tables, read, images }
}

test("Scalp package is confined to the eight reviewed manifests", async () => {
  const manifests = await loadScalpManifests()
  assert.equal(manifests.length, 8)
  assert.deepEqual(
    manifests.map(({ manifest }) => manifest.product_key).sort(),
    [...SCALP_EXPECTED_KEYS.scalp].sort(),
  )
  assert.equal(SCALP_BATCH_ID, "personal-plan-scalp-launch-v1")
})

test("Scalp package rejects a Heat key, non-recommended product, and unreviewed role", () => {
  const base = {
    product_key: SCALP_EXPECTED_KEYS.scalp[0],
    content_fingerprint: "a".repeat(64),
    category_key: "scalp_care" as const,
    product: { is_chaarlie_recommended: true },
    image_asset: {},
    identifiers: [{ source: "dm" }],
    scalp_spec: { primary_role: "scalp_comfort" },
    protocols: [{ category: "scalp_care", role: "scalp_comfort" }],
  }
  const products = SCALP_EXPECTED_KEYS.scalp.map((product_key, index) => ({
    ...base,
    product_key,
    content_fingerprint: `${index}`.padStart(64, "a"),
  }))
  assert.throws(
    () =>
      buildScalpPackage({
        batch_id: SCALP_BATCH_ID,
        cohort_index_fingerprint: SCALP_COHORT_INDEX_FINGERPRINT,
        products: [...products.slice(0, 7), { ...base, product_key: "balea-ultralight-200ml" }],
      }),
    /exact 8/,
  )
  assert.throws(
    () =>
      buildScalpPackage({
        batch_id: SCALP_BATCH_ID,
        cohort_index_fingerprint: SCALP_COHORT_INDEX_FINGERPRINT,
        products: products.map((product, index) =>
          index === 0 ? { ...product, product: { is_chaarlie_recommended: false } } : product,
        ),
      }),
    /recommendation mismatch/,
  )
  assert.throws(
    () =>
      buildScalpPackage({
        batch_id: SCALP_BATCH_ID,
        cohort_index_fingerprint: SCALP_COHORT_INDEX_FINGERPRINT,
        products: products.map((product, index) =>
          index === 0
            ? {
                ...product,
                scalp_spec: { primary_role: "not_reviewed" },
                protocols: [{ category: "scalp_care", role: "not_reviewed" }],
              }
            : product,
        ),
      }),
    /protocol role mismatch/,
  )
  assert.throws(
    () =>
      buildScalpPackage({
        batch_id: SCALP_BATCH_ID,
        cohort_index_fingerprint: SCALP_COHORT_INDEX_FINGERPRINT,
        products: products.map((product, index) =>
          index === 0
            ? { ...product, protocols: [...product.protocols, ...product.protocols] }
            : product,
        ),
      }),
    /protocol role mismatch/,
  )
})

test("Scalp identity keeps the current Gliss and L'Oréal Paris spelling", () => {
  assert.equal(SCALP_IDENTITY["gliss-scalp-balance-clarifying-serum"].brandName, "Gliss")
  assert.equal(
    SCALP_IDENTITY["loreal-elvital-fiber-booster-scalp-serum"].brandName,
    "L'Oréal Paris",
  )
  assert.equal(normalizedScalpIdentifier("barcode", "PZN:09508065"), "pzn09508065")
  assert.equal(
    normalizedScalpIdentifier("manufacturer_sku", "NART:69658-00000-26"),
    "nart:69658-00000-26",
  )
})

test("Scalp The Ordinary commercial source uses the current official manufacturer PDP", async () => {
  const manifest = (await loadScalpManifests()).find(
    ({ manifest: item }) => item.product_key === "the-ordinary-multi-peptide-hair-density-serum",
  )?.manifest as Record<string, unknown> | undefined
  assert.ok(manifest)
  const officialUrl =
    "https://theordinary.com/de-de/multi-peptide-serum-for-hair-density-hair-scalp-treatment-100434.html"
  assert.deepEqual(manifest.sources, [
    { label: "The Ordinary DE Produktseite", type: "manufacturer", url: officialUrl },
  ])
  assert.deepEqual(manifest.commercial, {
    purchase_url: officialUrl,
    status: "available",
    price_eur: 26.5,
    currency: "EUR",
    checked_at: "2026-08-11T08:26:31Z",
    availability_blocker: null,
  })
  const final = (manifest.product_payload as Record<string, unknown>).final as Record<
    string,
    unknown
  >
  const product = final.product as Record<string, unknown>
  assert.equal(product.affiliate_link, officialUrl)
  assert.equal(product.purchase_link_checked_at, "2026-08-11T08:26:31Z")
  assert.equal(product.price_checked_at, "2026-08-11T08:26:31Z")
})

test("Scalp project URL parsing accepts only a direct Supabase project host", () => {
  assert.equal(
    scalpProjectIdFromUrl(`https://${SCALP_SUPABASE_PROJECT_ID}.supabase.co`),
    SCALP_SUPABASE_PROJECT_ID,
  )
  assert.equal(scalpProjectIdFromUrl("https://supabase.co.example.com"), null)
  assert.equal(scalpProjectIdFromUrl("not a URL"), null)
})

test("Scalp linked project and migration state come from local CLI evidence", () => {
  assert.doesNotThrow(() => assertScalpLinkedProjectRef(SCALP_SUPABASE_PROJECT_ID))
  assert.throws(() => assertScalpLinkedProjectRef("wrong-project"), /does not target/)
  assert.equal(
    parseScalpLinkedMigrationState(
      "      LOCAL      │     REMOTE     │     TIME (UTC)\n  20260811055932 │                │ 2026-08-11 05:59:32\n",
    ),
    "absent",
  )
  assert.equal(
    parseScalpLinkedMigrationState(
      "      LOCAL      |     REMOTE     |     TIME (UTC)\n  20260811055932 | 20260811055932 | 2026-08-11 05:59:32\n",
    ),
    "applied",
  )
  assert.throws(
    () =>
      parseScalpLinkedMigrationState(
        "  20260811055932 |                | 2026-08-11 05:59:32\n  20260811055932 | 20260811055932 | 2026-08-11 05:59:32\n",
      ),
    /duplicate/,
  )
  assert.throws(() => parseScalpLinkedMigrationState("no migration rows\n"), /omitted/)
})

test("Scalp parses Supabase CLI JSON migration output and fails closed on ambiguous rows", () => {
  assert.equal(
    parseScalpLinkedMigrationState(
      JSON.stringify({
        migrations: [
          { local: "00001", remote: "00001", time: "2020-01-01T00:00:00Z" },
          { local: "20260409", remote: "20260409", time: "2026-04-09T00:00:00Z" },
          { local: "20260811055932", remote: "", time: "2026-08-11T05:59:32Z" },
        ],
        message: "untrusted",
      }),
    ),
    "absent",
  )
  assert.equal(
    parseScalpLinkedMigrationState(
      JSON.stringify({
        migrations: [
          { local: "20260811055932", remote: "20260811055932", time: "2026-08-11T05:59:32Z" },
        ],
      }),
    ),
    "applied",
  )
  for (const output of [
    '{"migrations":',
    JSON.stringify({ migrations: {} }),
    JSON.stringify({ migrations: [{ local: "20260409", remote: "20260409" }] }),
    JSON.stringify({ migrations: [{ local: "20260811055932" }] }),
    JSON.stringify({ migrations: [{ local: "20260811055932", remote: "20260811055933" }] }),
    JSON.stringify({
      migrations: [
        { local: "20260811055932", remote: "" },
        { local: "20260811055932", remote: "20260811055932" },
      ],
    }),
  ]) {
    assert.throws(() => parseScalpLinkedMigrationState(output))
  }
})

test("Scalp migration-owned identity seeds are absent-safe but fail closed after apply", () => {
  assert.deepEqual(
    scalpMigrationIdentitySeedBlockers({
      brands: [],
      lines: [],
      migrationState: "absent",
      migrationSql,
    }),
    [],
  )
  const appliedMissing = scalpMigrationIdentitySeedBlockers({
    brands: [],
    lines: [],
    migrationState: "applied",
    migrationSql,
  })
  assert.ok(appliedMissing.includes("Scalp identity seed missing after migration: brand Eucerin"))
  assert.ok(
    appliedMissing.includes("Scalp identity seed missing after migration: line Derma X Pro"),
  )
})

test("Scalp migration seed collisions and partial rows fail closed", () => {
  const eucerin = SCALP_MIGRATION_IDENTITY_SEEDS.brands[0]
  const dermo = SCALP_MIGRATION_IDENTITY_SEEDS.lines[0]
  const collision = scalpMigrationIdentitySeedBlockers({
    brands: [{ ...eucerin, id: "ffffffff-ffff-4fff-8fff-ffffffffffff" }],
    lines: [{ ...dermo, id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }],
    migrationState: "absent",
    migrationSql,
  })
  assert.ok(collision.includes("Scalp identity seed collision: brand Eucerin"))
  assert.ok(collision.includes("Scalp identity seed collision: line DermoCapillaire Urea"))
  const partial = scalpMigrationIdentitySeedBlockers({
    brands: [],
    lines: [{ ...dermo }],
    migrationState: "absent",
    migrationSql,
  })
  assert.ok(
    partial.includes("Scalp identity seed partial state: line DermoCapillaire Urea has no parent"),
  )
})

test("Scalp migration and TypeScript seed definitions are fingerprint-bound", () => {
  const blockers = scalpMigrationIdentitySeedBlockers({
    brands: [],
    lines: [],
    migrationState: "absent",
    migrationSql: migrationSql.replace("Head & Shoulders", "Head and Shoulders"),
  })
  assert.ok(blockers.includes("Scalp migration identity seed block drift"))
})

test("Scalp preflight requires Heat and ledger, but permits the Scalp migration to be absent with zero Scalp rows", async () => {
  const identities = Object.values(SCALP_IDENTITY)
  const result = await preflightScalp({
    read: {
      list: async (table) => {
        if (table === "brands")
          return [
            ...new Map(
              identities.map((identity) => [
                identity.brandId,
                { id: identity.brandId, canonical_name: identity.brandName },
              ]),
            ).values(),
          ]
        if (table === "product_lines")
          return identities
            .filter((identity) => identity.lineId)
            .map((identity) => ({
              id: identity.lineId,
              brand_id: identity.brandId,
              canonical_name: identity.lineName,
            }))
        if (table === "product_categories")
          return [{ key: "scalp_care", is_catalog_supported: true, is_intake_supported: true }]
        return []
      },
      object: async () => null,
      hasTables: async () => [],
      migrationState: async (migration) =>
        migration === HEAT_MIGRATION
          ? "applied"
          : migration === SCALP_MIGRATION
            ? "absent"
            : "absent",
    },
    release: {
      reviewedHead: "a".repeat(40),
      projectId: SCALP_SUPABASE_PROJECT_ID,
      expectScalpMigration: "absent",
    },
    gitState: async () => ({ head: "a".repeat(40), clean: true }),
    publicSupabaseUrl: `https://${SCALP_SUPABASE_PROJECT_ID}.supabase.co`,
    now: new Date("2026-08-11T12:00:00Z"),
  })
  assert.equal(result.blockers.includes("Heat migration must already be applied"), false)
  assert.equal(
    result.blockers.includes("Scalp batch ledger must have zero rows before apply"),
    false,
  )
  assert.equal(
    result.blockers.some((blocker) => blocker.includes("Scalp migration state mismatch")),
    false,
  )
})

test("Scalp preflight blocks project, git, Heat, ledger, freshness, and category drift", async () => {
  const fixture = await appliedPreflightFixture()
  const driftedRead = {
    ...fixture.read,
    list: async (table: string, offset: number, limit: number) => {
      if (table === "catalog_enrichment_applied_items")
        return offset === 0 ? [{ batch_id: SCALP_BATCH_ID }] : []
      if (table === "product_categories")
        return offset === 0
          ? [{ key: "scalp_care", is_catalog_supported: false, is_intake_supported: true }]
          : []
      return fixture.read.list(table, offset, limit)
    },
    migrationState: async (migration: string) =>
      migration === HEAT_MIGRATION ? ("absent" as const) : ("applied" as const),
  }
  const result = await preflightScalp({
    ...fixture.preflightInput,
    read: driftedRead,
    release: { ...fixture.release, projectId: "wrong-project" },
    gitState: async () => ({ head: "b".repeat(40), clean: false }),
    now: new Date("2026-08-20T12:00:00Z"),
  })
  assert.ok(result.blockers.includes("Supabase project mismatch"))
  assert.ok(result.blockers.includes("reviewed head does not equal current git HEAD"))
  assert.ok(result.blockers.includes("Heat migration must already be applied"))
  assert.ok(result.blockers.includes("Scalp batch ledger must have zero rows before apply"))
  assert.ok(result.blockers.some((blocker) => blocker.startsWith("stale commercial observation:")))
  assert.ok(result.blockers.includes("category readiness missing or disabled: scalp_care"))
})

test("Scalp apply is dry-run unless every generated approval guard exists", async () => {
  const dry = await applyScalp({
    args: parseScalpApplyArgs(["--batch", SCALP_BATCH_ID]),
    preflight: {
      ok: false,
      blockers: [],
      release_context: {
        reviewedHead: "a".repeat(40),
        projectId: SCALP_SUPABASE_PROJECT_ID,
        expectScalpMigration: "absent",
      },
    },
    preflightInput: {} as never,
    images: [],
    write: {} as never,
  })
  assert.deepEqual(dry, { applied: false, reason: "dry-run", uploaded_paths: [] })
  assert.throws(
    () => parseScalpApplyArgs(["--apply", "--confirm", "--confirm-batch", SCALP_BATCH_ID]),
    /requires --apply --confirm/,
  )
})

test("Scalp apply verifies immutable Storage bytes and reports uploaded orphans on RPC failure", async () => {
  const fixture = await appliedPreflightFixture()
  assert.ok(fixture.preflight.package)
  const args = parseScalpApplyArgs([
    "--apply",
    "--confirm",
    "--confirm-batch",
    SCALP_BATCH_ID,
    "--reviewed-by",
    "nick",
    "--reviewed-head",
    fixture.release.reviewedHead,
    "--expect-scalp-migration=applied",
    "--expected-batch-fingerprint",
    fixture.preflight.package.fingerprint,
    "--expected-content-fingerprint",
    SCALP_COHORT_INDEX_FINGERPRINT,
  ])
  await assert.rejects(
    applyScalp({
      args,
      preflight: fixture.preflight,
      preflightInput: fixture.preflightInput,
      images: fixture.images,
      write: {
        object: async () => new TextEncoder().encode("wrong-existing-bytes"),
        upload: async () => assert.fail("mismatched existing object must not be overwritten"),
        rpc: async () => assert.fail("RPC must not run after a Storage mismatch"),
      },
    }),
    /existing Storage object SHA mismatch/,
  )

  const stored = new Map<string, Uint8Array>()
  await assert.rejects(
    applyScalp({
      args,
      preflight: fixture.preflight,
      preflightInput: fixture.preflightInput,
      images: fixture.images,
      write: {
        object: async (_bucket, path) => stored.get(path) ?? null,
        upload: async (_bucket, path, bytes) => {
          stored.set(path, bytes)
        },
        rpc: async () => {
          throw new Error("transaction rejected")
        },
      },
    }),
    (error: unknown) => {
      assert.match(String(error), /Newly uploaded unreferenced paths:/)
      assert.equal(stored.size, 8)
      return true
    },
  )

  const reused = await applyScalp({
    args,
    preflight: fixture.preflight,
    preflightInput: fixture.preflightInput,
    images: fixture.images,
    write: {
      object: async (_bucket, path) => stored.get(path) ?? null,
      upload: async () => assert.fail("matching immutable objects must be reused"),
      rpc: async () => undefined,
    },
  })
  assert.deepEqual(reused, { applied: true, uploaded_paths: [] })
  assert.deepEqual(
    [
      ...new Set(
        fixture.preflight.package.package.products.flatMap((item) =>
          item.identifiers.map((identifier) => identifier.source),
        ),
      ),
    ].sort(),
    ["dm", "dm-med", "eucerin", "flaconi", "rossmann", "the-ordinary"],
  )
})

test("Scalp verifier rejects product, image, spec, and per-protocol relation drift", async () => {
  const bytes = new TextEncoder().encode("approved-image")
  const products = SCALP_EXPECTED_KEYS.scalp.map((product_key, index) => {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
    return {
      product_key,
      content_fingerprint: `${index}`.padStart(64, "a"),
      category_key: "scalp_care" as const,
      product: {
        name: `Scalp ${index}`,
        brand_id: `brand-${index}`,
        category_key: "scalp_care",
        affiliate_link: `https://example.com/${index}`,
        is_chaarlie_recommended: true,
      },
      image_asset: {
        storage_bucket: "product-images",
        storage_path: `scalp/${index}.webp`,
        asset_sha256: sha256Bytes(bytes),
      },
      identifiers: [{ type: "gtin", value: `000${index}`, source: "dm" }],
      scalp_spec: { primary_role: "scalp_comfort", presentation_format: "serum" },
      protocols: [
        { category: "scalp_care", role: "scalp_comfort", application_stage: "after_wash" },
      ],
      id,
    }
  })
  const expected = {
    package: {
      schema_version: "personal-plan-catalog-enrichment-scalp-v1",
      batch_id: SCALP_BATCH_ID,
      cohort_index_fingerprint: SCALP_COHORT_INDEX_FINGERPRINT,
      products: products.map(({ id: _id, ...product }) => product),
    },
    canonical_json: "fixture",
    fingerprint: "b".repeat(64),
  } as ReturnType<typeof buildScalpPackage>
  const tableRows = {
    products: products.map(({ id, product }) => ({ id, ...product })),
    product_image_assets: products.map(({ id, image_asset }) => ({
      product_id: id,
      ...image_asset,
    })),
    product_identifiers: products.map(({ id, identifiers }) => ({
      product_id: id,
      identifier_type: identifiers[0]?.type,
      identifier_value: identifiers[0]?.value,
      source: identifiers[0]?.source,
    })),
    product_scalp_care_specs: products.map(({ id, scalp_spec }) => ({
      product_id: id,
      ...scalp_spec,
    })),
    product_application_protocols: products.map(({ id, protocols }) => ({
      product_id: id,
      ...protocols[0],
    })),
    catalog_enrichment_applied_items: products.map(({ id, product_key, content_fingerprint }) => ({
      batch_id: SCALP_BATCH_ID,
      product_key,
      product_id: id,
      batch_fingerprint: expected.fingerprint,
      content_fingerprint,
      reviewed_by: "nick",
    })),
  }
  const read = {
    list: async (table: string) => tableRows[table as keyof typeof tableRows] ?? [],
    object: async () => bytes,
  }
  assert.equal((await verifyScalpRelations(read, expected)).ok, true)
  tableRows.products[0]!.affiliate_link = "https://example.com/drift"
  tableRows.product_image_assets[1]!.storage_path = "scalp/drift.webp"
  tableRows.product_scalp_care_specs[2]!.presentation_format = "tonic"
  tableRows.product_application_protocols[3]!.application_stage = "before_wash"
  const drift = await verifyScalpRelations(read, expected)
  assert.equal(drift.ok, false)
  assert.ok(drift.errors.includes(`product relation mismatch: ${products[0]?.product_key}`))
  assert.ok(drift.errors.includes(`image asset relation mismatch: ${products[1]?.product_key}`))
  assert.ok(drift.errors.includes(`scalp spec relation mismatch: ${products[2]?.product_key}`))
  assert.ok(drift.errors.includes(`protocol relation mismatch: ${products[3]?.product_key}`))
})
