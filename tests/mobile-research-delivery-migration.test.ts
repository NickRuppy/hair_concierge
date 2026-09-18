import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

const owner = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"
const beforeApproval = "33333333-3333-4333-8333-333333333333"
const afterApproval = "44444444-4444-4444-8444-444444444444"
const webOnly = "55555555-5555-4555-8555-555555555555"
const product = "66666666-6666-4666-8666-666666666666"
const migration = new URL(
  "../supabase/migrations/20260918191038_mobile_research_delivery_intent.sql",
  import.meta.url,
)

async function fixture() {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private; GRANT USAGE ON SCHEMA private TO service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.product_submissions(
      id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      source text NOT NULL, scanned_identifier_value text, status text NOT NULL,
      approved_product_id uuid
    );
    GRANT SELECT, UPDATE ON public.product_submissions TO service_role;
    INSERT INTO public.profiles VALUES ('${owner}'), ('${other}');
    INSERT INTO public.product_submissions VALUES
      ('${beforeApproval}','${owner}','scan','4012345678901','pending_review',NULL),
      ('${afterApproval}','${owner}','scan','4006381333931','approved','${product}'),
      ('${webOnly}','${owner}','scan','4006381333932','approved','${product}');
  `)
  await db.exec(await readFile(migration, "utf8"))
  return db
}

test("mobile intent enqueues once in either status/intent ordering, not old web scans", async () => {
  const db = await fixture()
  try {
    assert.equal(
      (
        await db.query<{ ok: boolean }>("SELECT mobile_research_request_result($1,$2) AS ok", [
          owner,
          beforeApproval,
        ])
      ).rows[0].ok,
      true,
    )
    await db.query(
      "UPDATE product_submissions SET status='approved', approved_product_id=$1 WHERE id=$2",
      [product, beforeApproval],
    )
    await db.query("SELECT mobile_research_request_result($1,$2)", [owner, beforeApproval])
    await db.query("SELECT mobile_research_request_result($1,$2)", [owner, afterApproval])
    await db.query("UPDATE product_submissions SET status='approved' WHERE id=$1", [afterApproval])
    const queued = await db.query<{ submission_id: string }>(
      "SELECT submission_id FROM private.mobile_research_delivery_candidates ORDER BY submission_id",
    )
    assert.deepEqual(
      queued.rows.map((row) => row.submission_id),
      [beforeApproval, afterApproval],
    )
    assert.equal(
      (
        await db.query<{ mobile_result_requested_at: string | null }>(
          "SELECT mobile_result_requested_at FROM product_submissions WHERE id=$1",
          [webOnly],
        )
      ).rows[0].mobile_result_requested_at,
      null,
    )
  } finally {
    await db.close()
  }
})

test("intent is owner-checked and candidate survives unrelated history deletion", async () => {
  const db = await fixture()
  try {
    assert.equal(
      (
        await db.query<{ ok: boolean }>("SELECT mobile_research_request_result($1,$2) AS ok", [
          other,
          afterApproval,
        ])
      ).rows[0].ok,
      false,
    )
    await db.query("SELECT mobile_research_request_result($1,$2)", [owner, afterApproval])
    await db.exec("CREATE TABLE mobile_scan_history(id uuid PRIMARY KEY, user_id uuid)")
    await db.exec(
      `INSERT INTO mobile_scan_history VALUES ('77777777-7777-4777-8777-777777777777','${owner}')`,
    )
    await db.exec("DELETE FROM mobile_scan_history")
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::integer AS n FROM private.mobile_research_delivery_candidates",
        )
      ).rows[0].n,
      1,
    )
    await db.query("DELETE FROM profiles WHERE id=$1", [owner])
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::integer AS n FROM private.mobile_research_delivery_candidates",
        )
      ).rows[0].n,
      0,
    )
  } finally {
    await db.close()
  }
})

test("service-only claim is lease guarded and client roles cannot write intent", async () => {
  const db = await fixture()
  try {
    await db.query("SELECT mobile_research_request_result($1,$2)", [owner, afterApproval])
    await db.exec("SET ROLE authenticated")
    await assert.rejects(
      db.query("SELECT mobile_research_request_result($1,$2)", [owner, beforeApproval]),
      /permission denied/,
    )
    await assert.rejects(
      db.query("SELECT * FROM private.mobile_research_delivery_candidates"),
      /permission denied/,
    )
    await db.exec("SET ROLE service_role")
    const first = await db.query<{ claimed: { submission_id: string; lease_token: string }[] }>(
      "SELECT claim_mobile_research_delivery_candidates(1) AS claimed",
    )
    const token = first.rows[0].claimed[0].lease_token
    assert.equal(first.rows[0].claimed[0].submission_id, afterApproval)
    assert.deepEqual(
      (
        await db.query<{ claimed: unknown[] }>(
          "SELECT claim_mobile_research_delivery_candidates(1) AS claimed",
        )
      ).rows[0].claimed,
      [],
    )
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "SELECT finish_mobile_research_delivery_candidate($1,$2,'complete') AS ok",
          [afterApproval, "88888888-8888-4888-8888-888888888888"],
        )
      ).rows[0].ok,
      false,
    )
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "SELECT finish_mobile_research_delivery_candidate($1,$2,'complete') AS ok",
          [afterApproval, token],
        )
      ).rows[0].ok,
      true,
    )
    await db.exec("RESET ROLE")
  } finally {
    await db.close()
  }
})
