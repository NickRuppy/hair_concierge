import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
const C = "11111111-1111-4111-8111-111111111111",
  S = "22222222-2222-4222-8222-222222222222",
  V = "33333333-3333-4333-8333-333333333333"
async function setup(t: { after(fn: () => Promise<void>): void }) {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(
    `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE public.funnel_sessions(id uuid PRIMARY KEY,visitor_id uuid); GRANT SELECT ON public.funnel_sessions TO service_role;`,
  )
  await db.exec(
    readFileSync("supabase/migrations/20260915141251_openai_ads_consent_context.sql", "utf8"),
  )
  await db.query("INSERT INTO funnel_sessions VALUES($1,$2)", [S, V])
  return db
}
async function action(
  db: PGlite,
  action: string,
  rev = 0,
  marketing: boolean | null = null,
  request = crypto.randomUUID(),
  consent = C,
  visitor = V,
  ref = "raw%2Btoken",
) {
  const result = await db.query<{
    state: { revision: number; marketing: boolean; conflict: boolean }
  }>(
    `SELECT manage_openai_ads_context($1,clock_timestamp()+interval '89 days',$2,$3,$4,$5,$6,$7,'https://chaarlie.de/result',$8,NULL) AS state`,
    [consent, action, request, rev, marketing, S, visitor, ref],
  )
  return result.rows[0].state
}
test("grant/revoke/regrant cannot revive history; stale grant conflicts and stale denial wins; refs cleared", async (t) => {
  const db = await setup(t)
  assert.equal((await action(db, "get")).revision, 0)
  const first = crypto.randomUUID()
  assert.equal((await action(db, "choice", 0, true, first)).revision, 1)
  assert.equal((await action(db, "choice", 0, true, first)).revision, 1)
  const before = (await db.query<{ at: string }>("SELECT clock_timestamp()::text at")).rows[0].at
  let read = await db.query<{ value: unknown }>(
    "SELECT read_openai_ads_event_context($1,$2) value",
    [S, before],
  )
  assert.ok(read.rows[0].value)
  assert.equal(
    (await action(db, "context", 1, null, crypto.randomUUID(), C, V, "later-click")).marketing,
    true,
  )
  const ref = (await db.query<{ oppref: string }>("SELECT oppref FROM private.openai_ads_contexts"))
    .rows[0].oppref
  assert.equal(ref, "raw%2Btoken")
  assert.equal((await action(db, "choice", 0, false)).revision, 2)
  assert.equal((await action(db, "choice", 0, true, first)).conflict, true)
  assert.equal(
    (await db.query<{ oppref: null }>("SELECT oppref FROM private.openai_ads_contexts")).rows[0]
      .oppref,
    null,
  )
  assert.equal((await action(db, "choice", 2, true)).revision, 3)
  read = await db.query("SELECT read_openai_ads_event_context($1,$2) value", [S, before])
  assert.equal(read.rows[0].value, null)
  assert.equal((await action(db, "choice", 0, false)).marketing, false)
})
test("wrong signed visitor and competing consent identity cannot steal exact session attribution", async (t) => {
  const db = await setup(t)
  assert.equal((await action(db, "choice", 0, true, crypto.randomUUID(), C, C)).conflict, true)
  assert.equal((await db.query("SELECT * FROM private.openai_ads_contexts")).rows.length, 0)
  assert.equal((await action(db, "context", 1)).conflict, false)
  assert.equal((await action(db, "choice", 0, true, crypto.randomUUID(), V)).conflict, true)
  assert.equal(
    (await db.query<{ consent_id: string }>("SELECT consent_id FROM private.openai_ads_contexts"))
      .rows[0].consent_id,
    C,
  )
})
test("public roles cannot read or execute; service role allowed; expiry denies and cleanup removes", async (t) => {
  const db = await setup(t)
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`)
    await assert.rejects(db.query("SELECT * FROM private.openai_ads_consents"), /permission denied/)
    await assert.rejects(db.query("SELECT cleanup_openai_ads_context()"), /permission denied/)
    await db.exec("RESET ROLE")
  }
  await db.exec("SET ROLE service_role")
  assert.equal((await action(db, "choice", 0, true)).marketing, true)
  await db.exec("RESET ROLE")
  await db.exec(
    "UPDATE private.openai_ads_consents SET expires_at=clock_timestamp()-interval '1 second'",
  )
  assert.equal((await action(db, "get")).marketing, false)
  assert.equal((await action(db, "choice", 1, true)).conflict, true)
  assert.equal(
    (
      await db.query<{ value: unknown }>(
        "SELECT read_openai_ads_event_context($1,clock_timestamp()) value",
        [S],
      )
    ).rows[0].value,
    null,
  )
  assert.equal(
    (await db.query<{ count: number }>("SELECT cleanup_openai_ads_context() count")).rows[0].count,
    1,
  )
})
