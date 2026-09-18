import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

const owner = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"
const installation = "33333333-3333-4333-8333-333333333333"
const otherInstallation = "44444444-4444-4444-8444-444444444444"
const token = "ab".repeat(32)
const rotatedToken = "cd".repeat(32)
const migration = new URL(
  "../supabase/migrations/20260918192304_mobile_push_installations.sql",
  import.meta.url,
)

async function fixture() {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private; GRANT USAGE ON SCHEMA private TO service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    INSERT INTO public.profiles VALUES ('${owner}'), ('${other}');
  `)
  await db.exec(await readFile(migration, "utf8"))
  return db
}

test("push installation is service-only, owner-scoped and survives an idempotent revoke", async () => {
  const db = await fixture()
  try {
    await db.exec("SET ROLE authenticated")
    await assert.rejects(
      db.query("SELECT mobile_push_installation_register($1,$2,$3,'sandbox','de.chaarlie.app')", [
        owner,
        installation,
        token,
      ]),
      /permission denied/,
    )
    await assert.rejects(
      db.query("SELECT * FROM private.mobile_push_installations"),
      /permission denied/,
    )
    await db.exec("SET ROLE service_role")
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "SELECT mobile_push_installation_register($1,$2,$3,'sandbox','de.chaarlie.app') AS ok",
          [owner, installation, token],
        )
      ).rows[0].ok,
      true,
    )
    assert.equal(
      (
        await db.query<{ ok: boolean }>("SELECT mobile_push_installation_revoke($1,$2) AS ok", [
          other,
          installation,
        ])
      ).rows[0].ok,
      true,
    )
    assert.equal(
      (
        await db.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM private.mobile_push_installations",
        )
      ).rows[0].count,
      1,
    )
    await db.query("SELECT mobile_push_installation_revoke($1,$2)", [owner, installation])
    await db.query("SELECT mobile_push_installation_revoke($1,$2)", [owner, installation])
    assert.equal(
      (
        await db.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM private.mobile_push_installations",
        )
      ).rows[0].count,
      0,
    )
    await db.exec("RESET ROLE")
  } finally {
    await db.close()
  }
})

test("the same APNs token atomically rebinds to the latest authenticated account", async () => {
  const db = await fixture()
  try {
    await db.exec("SET ROLE service_role")
    await db.query(
      "SELECT mobile_push_installation_register($1,$2,$3,'sandbox','de.chaarlie.app')",
      [owner, installation, token],
    )
    await db.query(
      "SELECT mobile_push_installation_register($1,$2,$3,'production','de.chaarlie.app')",
      [other, otherInstallation, token],
    )
    const rows = await db.query<{
      user_id: string
      installation_id: string
      environment: string
      lease_expires_at: string
    }>(
      "SELECT user_id,installation_id,environment,lease_expires_at FROM private.mobile_push_installations",
    )
    assert.equal(rows.rows.length, 1)
    assert.deepEqual(rows.rows[0], {
      user_id: other,
      installation_id: otherInstallation,
      environment: "production",
      lease_expires_at: rows.rows[0].lease_expires_at,
    })
    assert.ok(new Date(rows.rows[0].lease_expires_at).getTime() > Date.now())
    await db.query("SELECT mobile_push_installation_revoke($1,$2)", [owner, installation])
    assert.equal(
      (await db.query<{ user_id: string }>("SELECT user_id FROM private.mobile_push_installations"))
        .rows[0].user_id,
      other,
    )
    await db.exec("RESET ROLE")
    await db.query("DELETE FROM public.profiles WHERE id=$1", [other])
    assert.equal(
      (
        await db.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM private.mobile_push_installations",
        )
      ).rows[0].count,
      0,
    )
  } finally {
    await db.close()
  }
})

test("a stable installation can rebind across an account switch and APNs token rotation", async () => {
  const db = await fixture()
  try {
    await db.exec("SET ROLE service_role")
    await db.query(
      "SELECT mobile_push_installation_register($1,$2,$3,'sandbox','de.chaarlie.app')",
      [owner, installation, token],
    )
    await db.query(
      "SELECT mobile_push_installation_register($1,$2,$3,'production','de.chaarlie.app')",
      [other, installation, rotatedToken],
    )
    const rows = await db.query<{ user_id: string; installation_id: string; apns_token: string }>(
      "SELECT user_id,installation_id,apns_token FROM private.mobile_push_installations",
    )
    assert.deepEqual(rows.rows, [
      { user_id: other, installation_id: installation, apns_token: rotatedToken },
    ])
    await db.exec("RESET ROLE")
  } finally {
    await db.close()
  }
})
