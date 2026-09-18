import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

const owner = "11111111-1111-4111-8111-111111111111"
const submission = "33333333-3333-4333-8333-333333333333"
const installation = "44444444-4444-4444-8444-444444444444"
const product = "66666666-6666-4666-8666-666666666666"
const migrations = [
  "20260918191038_mobile_research_delivery_intent.sql",
  "20260918192304_mobile_push_installations.sql",
  "20260918192915_mobile_research_delivery_outbox.sql",
]

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
    INSERT INTO profiles VALUES('${owner}');
    INSERT INTO product_submissions VALUES('${submission}','${owner}','scan','4012345678901','approved','${product}');
  `)
  for (const name of migrations)
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"),
    )
  await db.query("SELECT mobile_research_request_result($1,$2)", [owner, submission])
  await db.query("SELECT mobile_push_installation_register($1,$2,$3,$4,$5)", [
    owner,
    installation,
    "ab".repeat(32),
    "sandbox",
    "de.chaarlie.scanner.pilot",
  ])
  return db
}

type Candidate = { submission_id: string; lease_token: string }
type Delivery = { id: string; channel: string; lease_token: string; send_attempts: number }
async function claimCandidate(db: PGlite) {
  const result = await db.query<{ rows: Candidate[] }>(
    "SELECT claim_mobile_research_delivery_candidates(1) AS rows",
  )
  return result.rows[0].rows[0]
}
async function claim(db: PGlite, channel: string) {
  const result = await db.query<{ rows: Delivery[] }>(
    "SELECT claim_mobile_research_deliveries($1,1) AS rows",
    [channel],
  )
  return result.rows[0].rows
}

test("one candidate atomically produces independent email and current-device push", async () => {
  const db = await fixture()
  try {
    await db.exec("SET ROLE service_role")
    const candidate = await claimCandidate(db)
    assert.equal(candidate.submission_id, submission)
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "SELECT materialize_mobile_research_deliveries($1,$2) AS ok",
          [submission, candidate.lease_token],
        )
      ).rows[0].ok,
      true,
    )
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "SELECT materialize_mobile_research_deliveries($1,$2) AS ok",
          [submission, candidate.lease_token],
        )
      ).rows[0].ok,
      false,
    )
    const rows = await db.query<{ channel: string; installation_id: string | null }>(
      "SELECT channel,installation_id FROM private.mobile_research_deliveries ORDER BY channel",
    )
    assert.deepEqual(rows.rows, [
      { channel: "email", installation_id: null },
      { channel: "push", installation_id: installation },
    ])
    await db.exec("RESET ROLE")
    await db.exec("SET ROLE authenticated")
    await assert.rejects(
      db.query("SELECT * FROM private.mobile_research_deliveries"),
      /permission denied/,
    )
  } finally {
    await db.close()
  }
})

test("unknown result is held; pre-send expired processing can be reclaimed", async () => {
  const db = await fixture()
  try {
    const candidate = await claimCandidate(db)
    await db.query("SELECT materialize_mobile_research_deliveries($1,$2)", [
      submission,
      candidate.lease_token,
    ])
    const [email] = await claim(db, "email")
    const [push] = await claim(db, "push")
    assert.ok(email && push)
    assert.deepEqual(await claim(db, "email"), [])
    await assert.rejects(
      db.query("SELECT finish_mobile_research_delivery($1,$2,'queued')", [
        email.id,
        email.lease_token,
      ]),
      /invalid mobile delivery transition/,
    )
    await db.query(
      "UPDATE private.mobile_research_deliveries SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
      [push.id],
    )
    const [reclaimed] = await claim(db, "push")
    assert.notEqual(reclaimed.lease_token, push.lease_token)
    assert.equal(
      (
        await db.query<{ ok: boolean }>("SELECT begin_mobile_research_delivery_send($1,$2) AS ok", [
          push.id,
          push.lease_token,
        ])
      ).rows[0].ok,
      false,
    )
    assert.equal(
      (
        await db.query<{ ok: boolean }>("SELECT begin_mobile_research_delivery_send($1,$2) AS ok", [
          email.id,
          email.lease_token,
        ])
      ).rows[0].ok,
      true,
    )
    await db.query(
      "SELECT finish_mobile_research_delivery($1,$2,'unknown',NULL,NULL,NULL,'transport_unknown')",
      [email.id, email.lease_token],
    )
    assert.deepEqual(await claim(db, "email"), [])
    assert.equal(
      (
        await db.query<{ status: string }>(
          "SELECT status FROM private.mobile_research_deliveries WHERE id=$1",
          [email.id],
        )
      ).rows[0].status,
      "unknown",
    )
  } finally {
    await db.close()
  }
})

test("account deletion removes candidate, device and channel receipts", async () => {
  const db = await fixture()
  try {
    const candidate = await claimCandidate(db)
    await db.query("SELECT materialize_mobile_research_deliveries($1,$2)", [
      submission,
      candidate.lease_token,
    ])
    await db.query("DELETE FROM profiles WHERE id=$1", [owner])
    for (const table of [
      "private.mobile_research_delivery_candidates",
      "private.mobile_research_deliveries",
      "private.mobile_push_installations",
    ])
      assert.equal(
        (await db.query<{ n: number }>(`SELECT count(*)::integer AS n FROM ${table}`)).rows[0].n,
        0,
      )
  } finally {
    await db.close()
  }
})

test("push lookup is service-only and invalidation preserves a rotated token", async () => {
  const db = await fixture()
  try {
    await db.exec("SET ROLE authenticated")
    await assert.rejects(
      db.query("SELECT mobile_research_push_installation($1,$2)", [owner, installation]),
      /permission denied/,
    )
    await assert.rejects(
      db.query("SELECT mobile_research_invalidate_push_token($1,$2,$3,$4)", [
        owner,
        installation,
        "ab".repeat(32),
        "55555555-5555-4555-8555-555555555555",
      ]),
      /permission denied/,
    )
    await db.exec("RESET ROLE")
    await db.exec("SET ROLE service_role")
    const initial = await db.query<{ binding: { token: string; bindingVersion: string } }>(
      "SELECT mobile_research_push_installation($1,$2) AS binding",
      [owner, installation],
    )
    assert.equal(initial.rows[0].binding.token, "ab".repeat(32))
    await db.query("SELECT mobile_push_installation_register($1,$2,$3,$4,$5)", [
      owner,
      installation,
      "cd".repeat(32),
      "sandbox",
      "de.chaarlie.scanner.pilot",
    ])
    const stale = await db.query<{ invalidated: boolean }>(
      "SELECT mobile_research_invalidate_push_token($1,$2,$3,$4) AS invalidated",
      [owner, installation, "ab".repeat(32), initial.rows[0].binding.bindingVersion],
    )
    assert.equal(stale.rows[0].invalidated, false)
    const current = await db.query<{ binding: { token: string; bindingVersion: string } }>(
      "SELECT mobile_research_push_installation($1,$2) AS binding",
      [owner, installation],
    )
    assert.equal(current.rows[0].binding.token, "cd".repeat(32))
    await db.query("SELECT mobile_push_installation_register($1,$2,$3,$4,$5)", [
      owner,
      installation,
      "cd".repeat(32),
      "sandbox",
      "de.chaarlie.scanner.pilot",
    ])
    const refreshed = await db.query<{ binding: { token: string; bindingVersion: string } }>(
      "SELECT mobile_research_push_installation($1,$2) AS binding",
      [owner, installation],
    )
    assert.notEqual(
      refreshed.rows[0].binding.bindingVersion,
      current.rows[0].binding.bindingVersion,
    )
    const staleSameToken = await db.query<{ invalidated: boolean }>(
      "SELECT mobile_research_invalidate_push_token($1,$2,$3,$4) AS invalidated",
      [owner, installation, "cd".repeat(32), current.rows[0].binding.bindingVersion],
    )
    assert.equal(staleSameToken.rows[0].invalidated, false)
    const removed = await db.query<{ invalidated: boolean }>(
      "SELECT mobile_research_invalidate_push_token($1,$2,$3,$4) AS invalidated",
      [owner, installation, "cd".repeat(32), refreshed.rows[0].binding.bindingVersion],
    )
    assert.equal(removed.rows[0].invalidated, true)
    const missing = await db.query<{ binding: null }>(
      "SELECT mobile_research_push_installation($1,$2) AS binding",
      [owner, installation],
    )
    assert.equal(missing.rows[0].binding, null)
  } finally {
    await db.close()
  }
})
