import assert from "node:assert/strict"
import test from "node:test"

import { seedHairProfile } from "../src/lib/user-facts/seed-profile"
import { pgliteRpcClient, readRow } from "./mobile-profile-facts-pglite.fixtures"
import {
  id,
  insertProfile,
  migratedPersonalPlanDatabase,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Clean-switch task 7B: THE seeding helper every dev seed, eval seed, local fixture script and
 * Playwright spec now uses, on the real schema in PGlite WITH the lock applied — the state the
 * seeds run against after rollout step 4.
 */

/** The supabase-js surface `seedHairProfile` uses: the door's rpc, one guarded read, and the
 * update / insert of the columns no domain derives. */
function seedClient(pg: PersonalPlanTestDb) {
  const rpc = pgliteRpcClient(pg)
  const safe = (name: string) => {
    if (!/^[a-z_]+$/.test(name)) throw new Error(`unsupported identifier ${name}`)
    return name
  }
  const run = async (sql: string, params: unknown[]) => {
    try {
      await pg.query(sql, params)
      return { error: null }
    } catch (error) {
      return { error: error as { message: string } }
    }
  }
  return {
    rpc: rpc.rpc,
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              return {
                async maybeSingle() {
                  const { rows } = await pg.query(
                    `SELECT ${columns
                      .split(",")
                      .map((c) => safe(c.trim()))
                      .join(",")} FROM public.${safe(table)} WHERE ${safe(column)} = $1`,
                    [value],
                  )
                  return { data: rows[0] ?? null, error: null }
                },
              }
            },
          }
        },
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              const names = Object.keys(values).map(safe)
              return run(
                `UPDATE public.${safe(table)} SET ${names.map((name, i) => `${name} = $${i + 1}`).join(", ")} WHERE ${safe(column)} = $${names.length + 1}`,
                [...Object.values(values), value],
              )
            },
          }
        },
        insert(values: Record<string, unknown>) {
          const names = Object.keys(values).map(safe)
          return run(
            `INSERT INTO public.${safe(table)} (${names.join(", ")}) VALUES (${names.map((_, i) => `$${i + 1}`).join(", ")})`,
            Object.values(values),
          )
        },
      }
    },
  }
}

const NOW = "2026-09-30T12:00:00.000Z"

/** `src/lib/dev/local-login.ts`'s dev-user seed. */
const DEV_USER_SEED = {
  hair_texture: "wavy",
  thickness: "fine",
  density: "medium",
  concerns: ["frizz"],
  goals: ["less_frizz", "shine", "volume"],
  cuticle_condition: "rough",
  protein_moisture_balance: "stretches_bounces",
  scalp_type: "balanced",
  scalp_condition: null,
  chemical_treatment: ["colored"],
  heat_styling: "never",
  styling_tools: [],
  towel_material: "mikrofaser",
  towel_technique: "gentle_press",
  drying_method: "air_dry",
  brush_type: ["wide_tooth_comb"],
  night_protection: [],
  uses_heat_protection: false,
}

async function lockedDatabase(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = await migratedPersonalPlanDatabase(t)
  const userId = id(8, 1)
  await insertProfile(pg, userId)
  return { pg, userId, client: seedClient(pg) }
}

test("the dev-user seed goes through the door under the lock: real documents, the seeded columns derived back", async (t) => {
  const { pg, userId, client } = await lockedDatabase(t)
  const { revision } = await seedHairProfile(client as never, userId, DEV_USER_SEED, { now: NOW })
  assert.equal(revision, 2, "one door write per domain")

  const row = (await readRow(pg, userId))!
  assert.ok(row.diagnostics && row.care_habits, "both documents exist")
  const provenance = row.facts_provenance as Record<string, { source: { kind: string } }>
  assert.equal(provenance.diagnostics?.source.kind, "legacy_columns")
  assert.equal(provenance.care_habits?.source.kind, "legacy_columns")
  assert.equal(row.hair_texture, "wavy")
  assert.equal(row.cuticle_condition, "rough")
  assert.deepEqual(row.concerns, ["frizz"])
  assert.deepEqual([...(row.goals as string[])].sort(), ["less_frizz", "shine", "volume"])
  assert.equal(row.desired_volume, "more", "derived from the goals")
  assert.deepEqual(row.chemical_treatment, ["colored"])
  assert.equal(row.towel_material, "mikrofaser")
  assert.equal(row.drying_method, "air_dry")
  assert.equal(row.heat_styling, "never")
  assert.deepEqual(row.brush_type, ["wide_tooth_comb"])
  assert.equal(row.uses_heat_protection, false)

  // Re-seeding (every dev login) is idempotent in content and keeps going through the door.
  await seedHairProfile(client as never, userId, DEV_USER_SEED, { now: NOW })
  const again = (await readRow(pg, userId))!
  assert.equal(again.facts_revision, 4)
  assert.deepEqual(again.diagnostics, row.diagnostics)
})

test("a re-seed replaces the named domain (a named NULL clears) and leaves an unnamed domain alone", async (t) => {
  const { pg, userId, client } = await lockedDatabase(t)
  await seedHairProfile(client as never, userId, DEV_USER_SEED, { now: NOW })
  // conditioner-chat-e2e's second case: the same profile without a density.
  await seedHairProfile(
    client as never,
    userId,
    { hair_texture: "straight", thickness: "fine", density: null, goals: ["shine"] },
    { now: NOW },
  )
  const row = (await readRow(pg, userId))!
  assert.equal(row.density, null)
  assert.equal(row.hair_texture, "straight")
  assert.equal(row.cuticle_condition, null, "not named in the new seed: the domain is replaced")
  assert.deepEqual(row.goals, ["shine"])
  assert.equal(row.towel_material, "mikrofaser", "care habits were not named: untouched")
})

test("under the lock a direct seed write is rejected — explicit NULL for a '{}' column included — while the helper stores the same seed", async (t) => {
  const { pg, userId, client } = await lockedDatabase(t)
  await assert.rejects(
    pg.query("INSERT INTO public.hair_profiles (user_id, goals) VALUES ($1, NULL)", [userId]),
    (error: { message: string; detail?: string }) => {
      assert.equal(error.message, "hair_profiles_fact_write_outside_door")
      assert.equal(error.detail, "columns: goals")
      return true
    },
  )
  await assert.rejects(
    pg.query("INSERT INTO public.hair_profiles (user_id, hair_texture) VALUES ($1, 'wavy')", [
      userId,
    ]),
    /hair_profiles_fact_write_outside_door/,
  )

  await seedHairProfile(
    client as never,
    userId,
    { hair_texture: "wavy", goals: null, concerns: null, chemical_treatment: null },
    { now: NOW },
  )
  const row = (await readRow(pg, userId))!
  assert.equal(row.hair_texture, "wavy")
  assert.deepEqual(row.goals, [], "the door derives '{}' for an absent fact")
  assert.deepEqual(row.concerns, [])
})

test("the free columns no domain derives are written directly, beside the door or on a bare row", async (t) => {
  const { pg, userId, client } = await lockedDatabase(t)
  await seedHairProfile(
    client as never,
    userId,
    {
      user_id: userId,
      hair_texture: "straight",
      routine_preference: "balanced",
      additional_notes: "Bitte nichts Schweres.",
      conversation_memory: null,
      products_used: null,
    },
    { now: NOW },
  )
  const row = (await readRow(pg, userId))!
  assert.equal(row.additional_notes, "Bitte nichts Schweres.")
  assert.equal(row.routine_preference, "balanced")
  assert.equal(row.hair_texture, "straight")

  const other = id(8, 2)
  await insertProfile(pg, other)
  await seedHairProfile(client as never, other, { additional_notes: "nur Notizen" }, { now: NOW })
  const bare = (await readRow(pg, other))!
  assert.equal(bare.additional_notes, "nur Notizen")
  assert.equal(bare.diagnostics, null)
  assert.equal(bare.facts_revision, 0)
})

test("a seed never loses a value silently: unknown columns and a foreign user_id throw", async (t) => {
  const { userId, client } = await lockedDatabase(t)
  await assert.rejects(
    seedHairProfile(client as never, userId, { shampoo_frequency: "daily" } as never),
    /unknown hair_profiles column "shampoo_frequency"/,
  )
  await assert.rejects(
    seedHairProfile(client as never, userId, { user_id: id(9, 9), hair_texture: "wavy" }),
    /user_id mismatch/,
  )
})
