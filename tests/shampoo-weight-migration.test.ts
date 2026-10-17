import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const migration = readFileSync("supabase/migrations/20261013170000_shampoo_weight.sql", "utf8")
const researchRoot = "data/research/shampoo-inci/v1.6-track-a/run-2-v1.6.2"
type Weight = "light" | "moderate" | "heavy"
type ResearchRow = { thickness: string; shampoo_bucket: string; weight: Weight }
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"))

// Independent oracle: sealed lane intersection + conservative max, never migration VALUES.
function sealedWeights(): Map<string, Weight> {
  const weights = new Map<string, Weight>()
  const order: Weight[] = ["light", "moderate", "heavy"]
  for (const batch of ["W1", "W2", "W3", "W4"]) {
    const kit = `${researchRoot}/kit-${batch}`
    for (const mapping of readJson(`${kit}/blind-mapping.json`) as Array<{
      blindId: string
      productId: string
    }>) {
      const lane = (name: string): ResearchRow[] =>
        readJson(`${kit}/${name}/out/${mapping.blindId}.json`).projection.rows
      const a = lane("lane-a")
      const b = lane("lane-b")
      const merged = new Set<Weight>()
      for (const row of a) {
        const other = b.find(
          (candidate) =>
            candidate.thickness === row.thickness &&
            candidate.shampoo_bucket === row.shampoo_bucket,
        )
        if (other)
          merged.add(order[Math.max(order.indexOf(row.weight), order.indexOf(other.weight))])
      }
      assert.equal(merged.size, 1, `One product weight: ${mapping.productId}`)
      assert.equal(weights.has(mapping.productId), false)
      weights.set(mapping.productId, [...merged][0])
    }
  }
  return weights
}
const expected = sealedWeights()
const outsider = "00000000-0000-4000-8000-000000000001"

async function database(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`
    CREATE TABLE public.products (id uuid PRIMARY KEY, category_key text);
    CREATE TABLE public.product_shampoo_specs (
      product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
      category_key text, thickness text, shampoo_bucket text,
      PRIMARY KEY (product_id, thickness, shampoo_bucket)
    );
  `)
  for (const id of [...expected.keys(), outsider]) {
    await pg.query("INSERT INTO public.products VALUES ($1, 'shampoo')", [id])
    // Two contextual rows expose incomplete single-row updates.
    await pg.query(
      `INSERT INTO public.product_shampoo_specs VALUES
      ($1, 'shampoo', 'fine', 'normal'), ($1, 'shampoo', 'coarse', 'schuppen')`,
      [id],
    )
  }
  return pg
}

test("T7 migration: all 73 Track A products plus A50 receive conservative sealed weights; outsiders stay NULL", async (t) => {
  const pg = await database(t)
  const applyTargets = Object.keys(
    readJson("plans/shampoo-v16-rollout/track-a/apply/apply-plan.json").target,
  )
  assert.equal(applyTargets.length, 73)
  assert.deepEqual(
    new Set(expected.keys()),
    new Set([...applyTargets, "7e95671b-41a7-4f5c-9188-e535e46678ba"]),
  )
  await pg.exec(migration)
  const { rows } = await pg.query<{ product_id: string; weight: Weight | null }>(
    "SELECT product_id, weight FROM public.product_shampoo_specs",
  )
  assert.equal(rows.length, 150)
  for (const row of rows)
    assert.equal(row.weight, expected.get(row.product_id) ?? null, row.product_id)
  assert.equal(rows.filter((row) => row.weight === "light").length, 82)
  assert.equal(rows.filter((row) => row.weight === "moderate").length, 60)
  assert.equal(rows.filter((row) => row.weight === "heavy").length, 6)
  await assert.rejects(
    pg.query("UPDATE public.product_shampoo_specs SET weight = 'rich' WHERE product_id = $1", [
      outsider,
    ]),
    /product_shampoo_specs_weight_check/,
  )
  await pg.query("UPDATE public.product_shampoo_specs SET weight = NULL WHERE product_id = $1", [
    outsider,
  ])
})

for (const scenario of [
  "missing product",
  "wrong product category",
  "missing specs",
  "wrong spec category",
] as const) {
  test(`T7 migration guard: ${scenario} aborts and rolls back the column and weights`, async (t) => {
    const pg = await database(t)
    const id = expected.keys().next().value!
    if (scenario === "missing product")
      await pg.query("DELETE FROM public.products WHERE id = $1", [id])
    if (scenario === "wrong product category")
      await pg.query("UPDATE public.products SET category_key = 'conditioner' WHERE id = $1", [id])
    if (scenario === "missing specs")
      await pg.query("DELETE FROM public.product_shampoo_specs WHERE product_id = $1", [id])
    if (scenario === "wrong spec category")
      await pg.query(
        "UPDATE public.product_shampoo_specs SET category_key = 'conditioner' WHERE product_id = $1",
        [id],
      )
    await assert.rejects(
      pg.exec(migration),
      /shampoo weight: target (product|specs) missing or category is not shampoo/,
    )
    await pg.exec("ROLLBACK")
    const { rows } = await pg.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'product_shampoo_specs' AND column_name = 'weight'",
    )
    assert.deepEqual(rows, [])
    assert.equal(
      (
        await pg.query("SELECT * FROM public.product_shampoo_specs WHERE product_id = $1", [
          outsider,
        ])
      ).rows.length,
      2,
    )
  })
}
