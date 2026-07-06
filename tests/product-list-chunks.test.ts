import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import test from "node:test"

import { buildProductListChunks } from "../src/lib/product-matching/product-list-chunks"
import { normalizeShampooBucketPairs } from "../src/lib/shampoo/eligibility"

test("product list chunks understand hyphenated oil subtype labels", () => {
  const chunks = buildProductListChunks([
    {
      name: "Olaplex No.7 Bonding Oil",
      brand: "Olaplex",
      category: "Öle",
      suitable_thicknesses: ["fine"],
      suitable_concerns: ["styling-oel"],
    },
  ])

  assert.equal(chunks.length, 1)
  assert.match(chunks[0]?.content ?? "", /Styling mit Oel/)
})

test("shampoo eligibility does not treat hair texture metadata as thickness", () => {
  const legacyTextureOnlyShampoo = {
    name: "Texture-only Shampoo",
    category: "Shampoo",
    suitable_hair_textures: ["fine"],
    suitable_concerns: ["normal"],
  } as Parameters<typeof normalizeShampooBucketPairs>[0]

  assert.throws(
    () => normalizeShampooBucketPairs(legacyTextureOnlyShampoo),
    /braucht explizite shampoo_bucket_pairs/,
  )
})

test("shampoo eligibility requires explicit shampoo bucket pairs", () => {
  assert.throws(
    () =>
      normalizeShampooBucketPairs({
        name: "Legacy Matrix Shampoo",
        category: "Shampoo",
        suitable_thicknesses: ["fine"],
        suitable_concerns: ["normal"],
      }),
    /braucht explizite shampoo_bucket_pairs/,
  )
})

test("shampoo eligibility accepts explicit shampoo bucket pairs", () => {
  assert.deepEqual(
    normalizeShampooBucketPairs({
      name: "Exact Matrix Shampoo",
      category: "Shampoo",
      shampoo_bucket_pairs: [
        { thickness: "normal", shampoo_bucket: "normal" },
        { thickness: "fine", concern: "schuppen" },
      ],
    }),
    [
      { thickness: "fine", shampoo_bucket: "schuppen" },
      { thickness: "normal", shampoo_bucket: "normal" },
    ],
  )
})

test("legacy product-list chunk ingestion refuses unflagged runs", () => {
  const env = { ...process.env }
  delete env.ALLOW_LEGACY_PRODUCT_LIST_CHUNKS

  const result = spawnSync("npx", ["tsx", "scripts/ingest-product-chunks.ts", "--dry-run"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /product_list content chunks are retired/)
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /products-from-excel/)
})

test("legacy product-list chunk ingestion flag proceeds past the guard", () => {
  const productDir = resolve("data/products-from-excel")
  const createdDir = !existsSync(productDir)
  const fixturePath = join(productDir, "__legacy_guard_test.json")

  try {
    mkdirSync(productDir, { recursive: true })
    writeFileSync(
      fixturePath,
      JSON.stringify([
        {
          name: "Test Oil",
          brand: "Test",
          category: "Öle",
          suitable_thicknesses: ["fine"],
          suitable_concerns: ["styling-oel"],
        },
      ]),
    )

    const result = spawnSync("npx", ["tsx", "scripts/ingest-product-chunks.ts", "--dry-run"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        ALLOW_LEGACY_PRODUCT_LIST_CHUNKS: "1",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
        OPENAI_API_KEY: "test-openai-key",
      },
    })

    assert.equal(result.status, 0)
    assert.doesNotMatch(result.stderr, /product_list content chunks are retired/)
    assert.match(result.stdout, /Generated \d+ chunks/)
    assert.match(result.stdout, /Dry run/)
  } finally {
    rmSync(fixturePath, { force: true })
    if (createdDir) {
      rmSync(productDir, { recursive: true, force: true })
    }
  }
})

test("Excel conversion emits exact shampoo bucket pairs", () => {
  const source = readFileSync("scripts/convert_sources.py", "utf8")

  assert.match(source, /is_shampoo_category = category\.strip\(\)\.lower\(\) == "shampoo"/)
  assert.match(source, /entry\["shampoo_bucket_pairs"\] = \[\]/)
  assert.match(source, /"thickness": hair_tag/)
  assert.match(source, /"shampoo_bucket": concern_tag/)
})

test("markdown product-list ingestion is also guarded", () => {
  const env = { ...process.env }
  delete env.ALLOW_LEGACY_PRODUCT_LIST_CHUNKS

  const result = spawnSync(
    "npx",
    ["tsx", "scripts/ingest-markdown.ts", "--dry-run", "--source", "product_list"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
    },
  )

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /product_list content chunks are retired/)
})

test("markdown guard does not block unrelated source-filtered ingestion", () => {
  const markdownDir = resolve("data/markdown-cleaned/__legacy_guard_test")
  const createdDir = !existsSync(markdownDir)
  const productListPath = join(markdownDir, "product-list.md")

  try {
    mkdirSync(markdownDir, { recursive: true })
    writeFileSync(
      productListPath,
      [
        "---",
        'source_type: "product_list"',
        "---",
        "",
        "# Legacy product list",
        "",
        "Empfohlene Test-Produkte.",
      ].join("\n"),
    )

    const env = { ...process.env }
    delete env.ALLOW_LEGACY_PRODUCT_LIST_CHUNKS

    const result = spawnSync(
      "npx",
      ["tsx", "scripts/ingest-markdown.ts", "--dry-run", "--source", "book"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env,
      },
    )

    assert.equal(result.status, 0)
    assert.doesNotMatch(result.stderr, /product_list content chunks are retired/)
  } finally {
    rmSync(productListPath, { force: true })
    if (createdDir) {
      rmSync(markdownDir, { recursive: true, force: true })
    }
  }
})

test("product ingestion validates shampoo specs before database writes", () => {
  const source = readFileSync("scripts/ingest-products.ts", "utf8")
  const preflightCall = source.indexOf("preflightProductSpecs(products)")
  const filterCall = source.indexOf("parseProductNamesFilter(process.env.PRODUCT_NAMES)")
  const firstEmbeddingCall = source.indexOf("await generateEmbedding(description)")
  const firstUpsertCall = source.indexOf(".upsert(productPayload")

  assert.ok(preflightCall > -1)
  assert.ok(filterCall > -1)
  assert.ok(firstEmbeddingCall > -1)
  assert.ok(firstUpsertCall > -1)
  assert.ok(preflightCall < filterCall)
  assert.ok(preflightCall < firstEmbeddingCall)
  assert.ok(preflightCall < firstUpsertCall)
  assert.match(source, /Shampoo source validation failed before database writes/)
  assert.match(source, /Shampoo CSV row/)
})

test("product ingestion preflight is not bypassed by PRODUCT_NAMES", () => {
  const productDir = resolve("data/products-from-excel")
  const createdDir = !existsSync(productDir)
  const fixturePath = join(productDir, "__ingest_preflight_test.json")

  try {
    mkdirSync(productDir, { recursive: true })
    writeFileSync(
      fixturePath,
      JSON.stringify([
        {
          name: "Stale Review Shampoo",
          brand: "Test",
          category: "Shampoo",
          suitable_thicknesses: ["fine"],
          suitable_concerns: ["normal"],
        },
        {
          name: "Filtered Review Conditioner",
          brand: "Test",
          category: "Conditioner",
          suitable_thicknesses: ["fine"],
          suitable_concerns: ["feuchtigkeit"],
        },
      ]),
    )

    const result = spawnSync("npx", ["tsx", "scripts/ingest-products.ts"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PRODUCT_NAMES: "Filtered Review Conditioner",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
        OPENAI_API_KEY: "test-openai-key",
      },
    })

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Shampoo source validation failed before database writes/)
    assert.match(result.stderr, /Stale Review Shampoo/)
    assert.doesNotMatch(result.stdout, /Filtered to 1 products via PRODUCT_NAMES/)
    assert.doesNotMatch(result.stdout, /Found 1 products/)
  } finally {
    rmSync(fixturePath, { force: true })
    if (createdDir) {
      rmSync(productDir, { recursive: true, force: true })
    }
  }
})
