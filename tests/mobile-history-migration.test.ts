import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

const owner = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"
const product = "33333333-3333-4333-8333-333333333333"
const submission = "44444444-4444-4444-8444-444444444444"
const migration = new URL(
  "../supabase/migrations/20260919130450_mobile_scan_history.sql",
  import.meta.url,
)
const favoritesMigration = new URL(
  "../supabase/migrations/20260919150936_mobile_scan_history_favorites.sql",
  import.meta.url,
)

async function fixture() {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY);
    CREATE TABLE products(id uuid PRIMARY KEY);
    CREATE TABLE product_submissions(id uuid PRIMARY KEY, user_id uuid, source text, scanned_identifier_value text, status text);
    CREATE TABLE product_identifiers(product_id uuid, canonical_gtin14 text);
    INSERT INTO profiles VALUES('${owner}'),('${other}');
    INSERT INTO products VALUES('${product}');
    INSERT INTO product_identifiers VALUES('${product}','04012345678901');
    INSERT INTO product_submissions VALUES('${submission}','${owner}','scan','4012345678901','pending_review');
    GRANT SELECT ON product_submissions,product_identifiers,products TO service_role;
  `)
  const canonicalMigration = await readFile(
    new URL(
      "../supabase/migrations/20260826142000_product_identifier_canonical_gtin_expand.sql",
      import.meta.url,
    ),
    "utf8",
  )
  await db.exec(canonicalMigration.split("ALTER TABLE public.product_identifiers")[0])
  await db.exec(await readFile(migration, "utf8"))
  await db.exec(await readFile(favoritesMigration, "utf8"))
  return db
}
async function touch(
  db: PGlite,
  barcode: string | null,
  productId: string | null = null,
  submissionId: string | null = null,
) {
  return db.query("SELECT mobile_scan_history_touch($1,$2,$3,$4) id", [
    owner,
    barcode,
    productId,
    submissionId,
  ])
}

test("history keeps one canonical barcode, merges provisional search in both orders, and preserves distinct barcodes", async () => {
  const db = await fixture()
  try {
    const first = await touch(db, null, product)
    const scan = await touch(db, "4012345678901", product)
    assert.deepEqual(first.rows, scan.rows)
    await touch(db, null, product)
    await touch(db, "4012345678901", product)
    assert.equal((await db.query("SELECT * FROM mobile_scan_history")).rows.length, 1)
    await touch(db, "4006381333931", product)
    await touch(db, null, product)
    assert.equal((await db.query("SELECT * FROM mobile_scan_history")).rows.length, 2)
    assert.equal(
      (await db.query("SELECT * FROM mobile_scan_history WHERE barcode_ean IS NULL")).rows.length,
      0,
    )
    await db.exec("DELETE FROM mobile_scan_history")
    await touch(db, "4012345678901")
    await touch(db, null, product)
    const rows = (await db.query<{ product_id: string }>("SELECT * FROM mobile_scan_history")).rows
    assert.equal(rows.length, 1)
    assert.equal(rows[0].product_id, product)
  } finally {
    await db.close()
  }
})

test("history validates owner submission, keeps confirmed research when rescanned, and clear leaves research intact", async () => {
  const db = await fixture()
  try {
    await touch(db, "4012345678901", null, submission)
    await touch(db, "4012345678901")
    assert.equal(
      (await db.query<{ submission_id: string }>("SELECT submission_id FROM mobile_scan_history"))
        .rows[0].submission_id,
      submission,
    )
    await assert.rejects(
      db.query("SELECT mobile_scan_history_touch($1,$2,$3,$4)", [
        other,
        "4012345678901",
        null,
        submission,
      ]),
      /invalid_history_submission/,
    )
    await assert.rejects(touch(db, "4006381333931", null, submission), /invalid_history_submission/)
    await db.query("SELECT mobile_scan_history_clear($1)", [owner])
    assert.equal((await db.query("SELECT * FROM mobile_scan_history")).rows.length, 0)
    assert.equal((await db.query("SELECT * FROM product_submissions")).rows.length, 1)
    await touch(db, "4012345678901")
    await db.query("DELETE FROM profiles WHERE id=$1", [owner])
    assert.equal((await db.query("SELECT * FROM mobile_scan_history")).rows.length, 0)
  } finally {
    await db.close()
  }
})

test("favorite is service-only, idempotent, owner-bound, preserves merges, and survives clear", async () => {
  const db = await fixture()
  try {
    const scan = await touch(db, "4012345678901", product)
    const entry = (scan.rows[0] as { id: string }).id
    assert.equal(
      (
        await db.query<{ mobile_scan_history_set_favorite: boolean }>(
          "SELECT mobile_scan_history_set_favorite($1,$2,$3)",
          [owner, entry, true],
        )
      ).rows[0].mobile_scan_history_set_favorite,
      true,
    )
    assert.equal(
      (
        await db.query<{ mobile_scan_history_set_favorite: boolean }>(
          "SELECT mobile_scan_history_set_favorite($1,$2,$3)",
          [owner, entry, true],
        )
      ).rows[0].mobile_scan_history_set_favorite,
      true,
    )
    await touch(db, null, product)
    assert.equal(
      (
        await db.query<{ is_favorite: boolean }>(
          "SELECT is_favorite FROM mobile_scan_history WHERE id=$1",
          [entry],
        )
      ).rows[0].is_favorite,
      true,
    )
    await db.query("SELECT mobile_scan_history_clear($1)", [owner])
    assert.equal(
      (await db.query<{ count: number }>("SELECT count(*) FROM mobile_scan_history")).rows[0].count,
      1,
    )
    await assert.rejects(
      db.query("SELECT mobile_scan_history_set_favorite($1,$2,$3)", [other, entry, false]),
      /history_entry_not_found/,
    )
    await assert.rejects(
      db.query("SELECT mobile_scan_history_set_favorite($1,$2,$3)", [owner, other, false]),
      /history_entry_not_found/,
    )
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'`)
    await assert.rejects(
      db.query("SELECT mobile_scan_history_set_favorite($1,$2,$3)", [owner, entry, false]),
      /permission denied/,
    )
    await db.exec("RESET ROLE")
    await db.exec(`DELETE FROM profiles WHERE id='${owner}'`)
    assert.equal(
      (await db.query<{ count: number }>("SELECT count(*) FROM mobile_scan_history")).rows[0].count,
      0,
    )
  } finally {
    await db.close()
  }
})

test("favorite migration retains the clear void signature and no client update grant", async () => {
  const db = await fixture()
  try {
    assert.equal(
      (
        await db.query<{ result: string }>(
          "SELECT pg_get_function_result('public.mobile_scan_history_clear(uuid)'::regprocedure) result",
        )
      ).rows[0].result,
      "void",
    )
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'`)
    await assert.rejects(
      db.exec("UPDATE mobile_scan_history SET is_favorite=true"),
      /permission denied/,
    )
  } finally {
    await db.close()
  }
})

test("touch OR-preserves favorites at both deduplication deletes", async () => {
  const db = await fixture()
  try {
    const scanned = await touch(db, "4012345678901", product)
    const barcodeEntry = (scanned.rows[0] as { id: string }).id
    await db.exec(
      `INSERT INTO mobile_scan_history(user_id,product_id,is_favorite) VALUES('${owner}','${product}',true)`,
    )
    await touch(db, "4012345678901", product)
    assert.equal(
      (
        await db.query<{ is_favorite: boolean }>(
          "SELECT is_favorite FROM mobile_scan_history WHERE id=$1",
          [barcodeEntry],
        )
      ).rows[0].is_favorite,
      true,
    )

    await db.exec("DELETE FROM mobile_scan_history; DROP INDEX mobile_scan_history_product_key")
    await db.exec(`
      INSERT INTO mobile_scan_history(user_id,product_id,is_favorite) VALUES
        ('${owner}','${product}',false),('${owner}','${product}',true)
    `)
    await touch(db, null, product)
    const rows = await db.query<{ is_favorite: boolean }>(
      "SELECT is_favorite FROM mobile_scan_history WHERE user_id=$1",
      [owner],
    )
    assert.deepEqual(rows.rows, [{ is_favorite: true }])
  } finally {
    await db.close()
  }
})

test("history owner read/delete only, no anon access or direct client writes/RPCs", async () => {
  const db = await fixture()
  try {
    await touch(db, "4012345678901")
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${other}'`)
    assert.equal((await db.query("SELECT * FROM mobile_scan_history")).rows.length, 0)
    await db.exec("DELETE FROM mobile_scan_history")
    await assert.rejects(touch(db, "4012345678901"), /permission denied/)
    await assert.rejects(
      db.query("SELECT mobile_scan_history_clear($1)", [owner]),
      /permission denied/,
    )
    await db.exec(`SET request.jwt.claim.sub='${owner}'`)
    assert.equal((await db.query("SELECT * FROM mobile_scan_history")).rows.length, 1)
    await assert.rejects(
      db.exec("UPDATE mobile_scan_history SET last_seen_at=now()"),
      /permission denied/,
    )
    await assert.rejects(
      db.exec(
        `INSERT INTO mobile_scan_history(user_id,barcode_ean) VALUES('${owner}','4012345678901')`,
      ),
      /permission denied/,
    )
    await db.exec("SET ROLE anon")
    await assert.rejects(db.exec("SELECT * FROM mobile_scan_history"), /permission denied/)
    await assert.rejects(db.exec("DELETE FROM mobile_scan_history"), /permission denied/)
    await assert.rejects(
      db.exec("UPDATE mobile_scan_history SET last_seen_at=now()"),
      /permission denied/,
    )
    await assert.rejects(
      db.exec(
        `INSERT INTO mobile_scan_history(user_id,barcode_ean) VALUES('${owner}','4012345678901')`,
      ),
      /permission denied/,
    )
    await db.exec(
      `SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; DELETE FROM mobile_scan_history`,
    )
    assert.equal((await db.query("SELECT * FROM mobile_scan_history")).rows.length, 0)
  } finally {
    await db.close()
  }
})
