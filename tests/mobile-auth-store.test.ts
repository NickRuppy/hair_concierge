import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

test("auth attempt persistence binds resend, caps verification, rejects expiry and public access", async () => {
  const db = new PGlite()
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;")
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20260916175229_hosted_mobile_auth_attempts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    )
    const start = async (email: string) =>
      (await db.query<{ id: string }>("select public.mobile_start_auth_attempt($1) id", [email]))
        .rows[0].id
    const first = await start("one@example.test")
    assert.equal(await start("one@example.test"), first)
    const other = await start("two@example.test")
    assert.notEqual(first, other)
    for (let i = 0; i < 8; i++)
      assert.equal(
        (
          await db.query<{ email: string }>(
            "select public.mobile_claim_auth_verification($1) email",
            [first],
          )
        ).rows[0].email,
        "one@example.test",
      )
    assert.equal(
      (
        await db.query<{ email: string | null }>(
          "select public.mobile_claim_auth_verification($1) email",
          [first],
        )
      ).rows[0].email,
      null,
    )
    const fresh = await start("one@example.test")
    assert.notEqual(fresh, first)
    await db.query("update public.mobile_auth_attempts set consumed=true where id=$1", [fresh])
    assert.equal(
      (
        await db.query<{ email: string | null }>(
          "select public.mobile_claim_auth_verification($1) email",
          [fresh],
        )
      ).rows[0].email,
      null,
    )
    await db.query(
      "update public.mobile_auth_attempts set expires_at=now()-interval '1 second' where id=$1",
      [other],
    )
    assert.equal(
      (
        await db.query<{ email: string | null }>(
          "select public.mobile_claim_auth_verification($1) email",
          [other],
        )
      ).rows[0].email,
      null,
    )
    await db.exec("set role authenticated")
    await assert.rejects(db.query("select * from public.mobile_auth_attempts"), /permission denied/)
    await assert.rejects(
      db.query("select public.mobile_claim_auth_verification($1)", [fresh]),
      /permission denied/,
    )
    await assert.rejects(
      db.query("select public.mobile_start_auth_attempt('forged@example.test')"),
      /permission denied/,
    )
  } finally {
    await db.close()
  }
})
