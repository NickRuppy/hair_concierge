import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

const migrationPath =
  "supabase/migrations/20260902120000_personal_plan_quiz_draft_idempotent_replay.sql"
const legacyMigrationPath = "supabase/migrations/20260731124000_add_personal_plan_quiz_drafts.sql"
const draftId = "11111111-1111-4111-8111-111111111111"
const funnelSessionId = "22222222-2222-4222-8222-222222222222"

async function database(
  t: { after: (fn: () => Promise<void>) => void },
  {
    applyForward = true,
    polluteLegacyExecute = false,
  }: { applyForward?: boolean; polluteLegacyExecute?: boolean } = {},
) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE TABLE public.funnel_sessions (id uuid PRIMARY KEY);
  `)
  await pg.exec(await readFile(legacyMigrationPath, "utf8"))
  if (polluteLegacyExecute)
    await pg.exec(
      "GRANT EXECUTE ON FUNCTION public.update_personal_plan_quiz_draft(uuid, integer, integer, jsonb, boolean) TO PUBLIC, anon, authenticated",
    )
  if (applyForward) await pg.exec(await readFile(migrationPath, "utf8"))
  await pg.query("INSERT INTO public.funnel_sessions (id) VALUES ($1)", [funnelSessionId])
  await pg.query(
    `INSERT INTO public.personal_plan_quiz_drafts
      (id, resume_token_hash, funnel_session_id, browser_generation, revision, draft, status, created_at, updated_at, expires_at)
     VALUES ($1, repeat('a', 64), $2, 1, 5, $3::jsonb, 'active', now() - interval '1 hour', now(), now() + interval '2 hours')`,
    [draftId, funnelSessionId, JSON.stringify({ screen: "goals", answers: { texture: "wavy" } })],
  )
  return pg
}

async function update(
  pg: PGlite,
  {
    generation = 1,
    expectedRevision = 5,
    draft = { screen: "goals", answers: { texture: "wavy" } },
    allowRevisionCatchup = false,
  }: {
    generation?: number
    expectedRevision?: number
    draft?: object
    allowRevisionCatchup?: boolean
  } = {},
) {
  return pg.query<{ revision: number; browser_generation: number; expires_at: string }>(
    `SELECT * FROM public.update_personal_plan_quiz_draft($1, $2, $3, $4::jsonb, $5)`,
    [draftId, generation, expectedRevision, JSON.stringify(draft), allowRevisionCatchup],
  )
}

async function stored(pg: PGlite) {
  const result = await pg.query<{
    revision: number
    draft: object
    updated_at: string
    expires_at: string
  }>(
    "SELECT revision, draft, updated_at, expires_at FROM public.personal_plan_quiz_drafts WHERE id = $1",
    [draftId],
  )
  assert.equal(result.rows.length, 1)
  return result.rows[0]
}

test("quiz draft RPC makes only identical +1 replays idempotent", async (t) => {
  const pg = await database(t)
  const exact = await update(pg, { draft: { screen: "thickness", answers: { texture: "wavy" } } })
  assert.equal(exact.rows.length, 1)
  assert.equal(exact.rows[0].revision, 6)

  const beforeReplay = await stored(pg)
  const replay = await update(pg, {
    expectedRevision: 5,
    draft: { answers: { texture: "wavy" }, screen: "thickness" },
  })
  const afterReplay = await stored(pg)
  assert.equal(replay.rows.length, 1)
  assert.equal(replay.rows[0].revision, 6)
  assert.equal(
    new Date(replay.rows[0].expires_at).toISOString(),
    new Date(beforeReplay.expires_at).toISOString(),
  )
  assert.deepEqual(afterReplay, beforeReplay)

  const beforeDifferentNormal = await stored(pg)
  const differentNormal = await update(pg, {
    expectedRevision: 5,
    draft: { screen: "goals", answers: { texture: "straight" } },
  })
  assert.equal(differentNormal.rows.length, 0)
  assert.deepEqual(await stored(pg), beforeDifferentNormal)

  const catchup = await update(pg, {
    expectedRevision: 5,
    draft: { screen: "goals", answers: { texture: "straight" } },
    allowRevisionCatchup: true,
  })
  assert.equal(catchup.rows.length, 1)
  assert.equal(catchup.rows[0].revision, 7)
  assert.deepEqual((await stored(pg)).draft, {
    screen: "goals",
    answers: { texture: "straight" },
  })

  assert.equal((await update(pg, { generation: 2, expectedRevision: 7 })).rows.length, 0)
  await pg.query("UPDATE public.personal_plan_quiz_drafts SET status = 'completed' WHERE id = $1", [
    draftId,
  ])
  assert.equal((await update(pg, { expectedRevision: 7 })).rows.length, 0)
  await pg.query(
    "UPDATE public.personal_plan_quiz_drafts SET status = 'active', expires_at = now() - interval '1 second' WHERE id = $1",
    [draftId],
  )
  assert.equal((await update(pg, { expectedRevision: 7 })).rows.length, 0)
})

test("quiz draft RPC rejects revision gaps of two or more", async (t) => {
  const pg = await database(t)
  await pg.query("UPDATE public.personal_plan_quiz_drafts SET revision = 7 WHERE id = $1", [
    draftId,
  ])
  assert.equal((await update(pg, { expectedRevision: 5 })).rows.length, 0)
  assert.equal(
    (await update(pg, { expectedRevision: 5, allowRevisionCatchup: true })).rows.length,
    0,
  )
})

test("quiz draft RPC rejects the largest stored revision without overflow", async (t) => {
  const pg = await database(t)
  await pg.query(
    "UPDATE public.personal_plan_quiz_drafts SET revision = 2147483647 WHERE id = $1",
    [draftId],
  )
  const result = await update(pg, { expectedRevision: 2_147_483_647 })
  assert.equal(result.rows.length, 0)
  assert.equal((await stored(pg)).revision, 2_147_483_647)

  const catchup = await update(pg, {
    expectedRevision: 2_147_483_646,
    draft: { screen: "thickness", answers: { texture: "wavy" } },
    allowRevisionCatchup: true,
  })
  assert.equal(catchup.rows.length, 0)
  assert.equal((await stored(pg)).revision, 2_147_483_647)
})

test("legacy RPC rejects an identical +1 normal replay before the forward migration", async (t) => {
  const pg = await database(t, { applyForward: false })
  const replay = await update(pg, { expectedRevision: 4 })
  assert.equal(replay.rows.length, 0)
})

test("updated quiz draft RPC remains service-role-only", async (t) => {
  const pg = await database(t, { applyForward: false, polluteLegacyExecute: true })
  const signature = "public.update_personal_plan_quiz_draft(uuid, integer, integer, jsonb, boolean)"
  const privileges = await pg.query<{
    anon: boolean
    authenticated: boolean
    public: boolean
    service_role: boolean
  }>(
    `SELECT
       has_function_privilege('anon', $1, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', $1, 'EXECUTE') AS authenticated,
       has_function_privilege('public', $1, 'EXECUTE') AS public,
       has_function_privilege('service_role', $1, 'EXECUTE') AS service_role`,
    [signature],
  )
  assert.deepEqual(privileges.rows[0], {
    anon: true,
    authenticated: true,
    public: true,
    service_role: true,
  })

  await pg.exec(await readFile(migrationPath, "utf8"))
  const restored = await pg.query<(typeof privileges.rows)[0]>(
    `SELECT
       has_function_privilege('anon', $1, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', $1, 'EXECUTE') AS authenticated,
       has_function_privilege('public', $1, 'EXECUTE') AS public,
       has_function_privilege('service_role', $1, 'EXECUTE') AS service_role`,
    [signature],
  )
  assert.deepEqual(restored.rows[0], {
    anon: false,
    authenticated: false,
    public: false,
    service_role: true,
  })
})
