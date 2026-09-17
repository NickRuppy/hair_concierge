import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
const user = "11111111-1111-4111-8111-111111111111",
  attempt = "22222222-2222-4222-8222-222222222222",
  generation = "33333333-3333-4333-8333-333333333333",
  context = "44444444-4444-4444-8444-444444444444",
  hash = "a".repeat(64)
test("ready enrollment requires owner-bound verified intent and fresh context clocks; deferred keep preserves consent receipt", async () => {
  const db = new PGlite()
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create table public.profiles(id uuid primary key);create table public.hair_profiles(user_id uuid primary key);create table public.scanner_context_sources(user_id uuid primary key,revision bigint,profile_revision bigint);create table public.scanner_context_versions(id uuid primary key,user_id uuid,source_revision bigint,profile_revision bigint);create table public.scanner_context_heads(user_id uuid primary key,context_version_id uuid);`,
    )
    for (const migration of [
      "20260917063601_mobile_registration_intents",
      "20260917065627_mobile_registration_completion_admission",
    ])
      await db.exec(
        readFileSync(new URL(`../supabase/migrations/${migration}.sql`, import.meta.url), "utf8"),
      )
    await db.query("insert into public.profiles values($1);", [user])
    await db.query("insert into public.hair_profiles values($1)", [user])
    await db.query("insert into public.scanner_context_sources values($1,2,3)", [user])
    await db.query(
      `insert into public.mobile_registration_intents(id,request_id,request_hash,email,send_generation,provider_user_id,verified_user_id,verified_at) values($1,$1,$2,'existing@example.test',$3,$4,$4,now())`,
      [attempt, hash, generation, user],
    )
    async function enroll(owner = user) {
      return (
        await db.query<{ v: { outcome: string } }>(
          "select public.mobile_registration_enroll_ready($1,$2,$3,$4,$5,$6,$7) v",
          [attempt, generation, owner, "existing@example.test", hash, context, 3],
        )
      ).rows[0].v
    }
    assert.equal((await enroll()).outcome, "profile_conflict")
    await db.query("insert into public.scanner_context_versions values($1,$2,1,3)", [context, user])
    await db.query("insert into public.scanner_context_heads values($1,$2)", [user, context])
    assert.equal((await enroll()).outcome, "profile_conflict")
    await db.query("update public.scanner_context_versions set source_revision=2 where id=$1", [
      context,
    ])
    assert.equal(
      (await enroll()).outcome,
      "invalid_attempt",
      "registration keep must be explicitly acknowledged",
    )
    const defer = async (revision: number, marketing: boolean) =>
      (
        await db.query<{ v: { outcome: string } }>(
          "select public.mobile_registration_defer_keep($1,$2,$3,$4,$5,$6,$7) v",
          [attempt, generation, user, "existing@example.test", hash, revision, marketing],
        )
      ).rows[0].v
    assert.equal((await defer(2, true)).outcome, "profile_conflict")
    assert.equal((await defer(3, true)).outcome, "pending")
    assert.equal((await defer(3, false)).outcome, "profile_conflict")
    assert.equal((await enroll()).outcome, "ready")
    const row = (
      await db.query<{
        completion_receipt: { consent: { marketingOptIn: boolean; source: string } }
        completed_at: string
      }>(
        "select completion_receipt,completed_at from public.mobile_registration_intents where id=$1",
        [attempt],
      )
    ).rows[0]
    assert.equal(row.completion_receipt.consent.marketingOptIn, true)
    assert.equal(row.completion_receipt.consent.source, "native_registration")
    assert.ok(row.completed_at)
    assert.equal((await enroll()).outcome, "ready")
    await db.query("update public.scanner_context_sources set revision=3 where user_id=$1", [user])
    assert.equal((await enroll()).outcome, "profile_conflict")
    await db.exec("set role anon")
    await assert.rejects(enroll())
  } finally {
    await db.close()
  }
})
