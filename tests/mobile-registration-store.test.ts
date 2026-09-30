import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
const request = "11111111-1111-4111-8111-111111111111",
  user = "22222222-2222-4222-8222-222222222222",
  hash = "a".repeat(64),
  digest = "d".repeat(64)
test("intent metadata enforces immutable hash, resend generation, claim winner, owner and service-only permissions", async () => {
  const db = new PGlite()
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;create table public.profiles(id uuid primary key);",
    )
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20260917063601_mobile_registration_intents.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    )
    async function rpc<T>(sql: string, params: unknown[] = []): Promise<T> {
      return (await db.query<{ v: T }>(`select ${sql} v`, params)).rows[0].v
    }
    const start = () =>
      rpc<{ status: string; intent: { id: string; send_generation: string } }>(
        "mobile_registration_start($1,$2,$3)",
        [request, hash, "new@example.test"],
      )
    const first = await start()
    assert.equal(first.status, "ready")
    assert.equal(
      (
        await rpc<{ status: string }>("mobile_registration_start($1,$2,$3)", [
          request,
          "b".repeat(64),
          "new@example.test",
        ])
      ).status,
      "conflict",
    )
    const second = await start()
    assert.equal(second.intent.id, first.intent.id)
    assert.notEqual(second.intent.send_generation, first.intent.send_generation)
    const bind = (generation: string) =>
      rpc<boolean>("mobile_registration_bind_send($1,$2,$3,$4,$5,$6,$7)", [
        first.intent.id,
        generation,
        hash,
        "new@example.test",
        user,
        digest,
        "key",
      ])
    assert.equal(await bind(first.intent.send_generation), false)
    assert.equal(await bind(second.intent.send_generation), true)
    assert.equal(
      await rpc("mobile_registration_claim($1,$2,$3)", [
        first.intent.id,
        second.intent.send_generation,
        "e".repeat(64),
      ]),
      null,
    )
    const claim = await rpc<{ claim_id: string }>("mobile_registration_claim($1,$2,$3)", [
      first.intent.id,
      second.intent.send_generation,
      digest,
    ])
    assert.ok(claim.claim_id)
    assert.equal(
      await rpc("mobile_registration_claim($1,$2,$3)", [
        first.intent.id,
        second.intent.send_generation,
        digest,
      ]),
      null,
    )
    const finish = (owner: string) =>
      rpc<boolean>("mobile_registration_finish($1,$2,$3,$4,$5)", [
        first.intent.id,
        second.intent.send_generation,
        claim.claim_id,
        owner,
        "new@example.test",
      ])
    assert.equal(await finish(request), false)
    assert.equal(await finish(user), true)
    assert.equal(await finish(user), false)
    await db.exec("set role anon")
    await assert.rejects(db.query("select * from public.mobile_registration_intents"))
    await assert.rejects(
      db.query("select public.mobile_registration_start($1,$2,$3)", [
        request,
        hash,
        "new@example.test",
      ]),
    )
  } finally {
    await db.close()
  }
})
