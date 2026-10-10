import assert from "node:assert/strict"
import test from "node:test"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  TOOL_CARE_KEYS,
  parseToolsRollbackArguments,
  planToolsRollbackForRow,
  runToolsRollback,
} from "../scripts/personal-plan/tools-rollback-clear-facts"
import {
  id,
  insertProfile,
  migratedPersonalPlanDatabase,
  readHairProfile,
  saveUserFacts,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Hair Tools port, Task 12: the rollback script over the REAL SQL (the migrated PGlite chain incl.
 * `user_facts_save_v1`, the assumed-never-replaces-real rule and the user-facts lock). The script
 * talks to a thin PostgREST-shaped adapter; every write goes through the RPC, which is the only
 * door the lock admits.
 */

const AT = "2026-10-10T09:00:00.000Z"
const NOW = new Date("2026-10-10T12:00:00.000Z")

const LENA = id(1, 1)
const CONTROL = id(2, 2)
const GEWOHNHEITEN = id(3, 3)
const NO_TOOLS = id(4, 4)

const UNRELATED = {
  wetWashFrequency: "weekly_2x",
  dryingRoutes: ["air_dry", "ordinary_blow_dry"],
  currentProductCategories: ["shampoo", "conditioner"],
} as const

const TOOL_PAGES = {
  toolFamiliesWithSomething: [
    "drying_textiles",
    "brushes_combs",
    "airflow",
    "heated_styling",
    "night_protection",
  ],
  toolForms_drying_textiles_1: ["microfiber_towel"],
  toolForms_brushes_combs_1: ["wide_tooth_comb"],
  toolForms_brushes_combs_2: ["round_brush"],
  toolForms_airflow_1: ["hair_dryer", "hot_air_brush"],
  toolForms_heated_styling_1: ["flat_iron"],
  toolForms_night_protection_1: ["pillowcase"],
} as const

const DERIVED = {
  additionalHeatTools: ["dryer_brush", "straightener"],
  towel: { material: "mikrofaser" },
  nightProtection: ["silk_satin_pillow"],
  brushesCombs: ["wide_tooth_comb", "round"],
} as const

function provenanceFor(keys: readonly string[]) {
  return {
    source: { kind: "feinschliff_draft" as const, id: "draft-1" },
    schemaVersion: 1,
    at: AT,
    fields: Object.fromEntries(keys.map((key) => [key, "user" as const])),
  }
}

async function seed(pg: PersonalPlanTestDb, userId: string, patch: Record<string, unknown>) {
  await insertProfile(pg, userId)
  const result = await saveUserFacts(pg, {
    userId,
    domain: "care_habits",
    patch,
    provenance: provenanceFor(Object.keys(patch)),
  })
  assert.equal(result.status, "ok")
}

const PARAM_TYPES: Record<string, string> = {
  p_user_id: "uuid",
  p_domain: "text",
  p_patch: "jsonb",
  p_provenance: "jsonb",
  p_expected_revision: "integer",
  p_mode: "text",
  p_source_draft_id: "uuid",
  p_expected_draft_revision: "bigint",
  p_expected_initial_version_id: "uuid",
  p_expected_updated_at: "timestamptz",
}

/** The PostgREST surface the script uses: select/order/limit/gt/eq on hair_profiles + the rpc. */
function pgliteSupabaseClient(pg: PersonalPlanTestDb): { client: SupabaseClient; rpcs: string[] } {
  const rpcs: string[] = []
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          const filters: string[] = []
          const values: unknown[] = []
          const order: string[] = []
          let rowLimit: number | null = null
          const builder = {
            eq(column: string, value: unknown) {
              values.push(value)
              filters.push(`${column} = $${values.length}`)
              return builder
            },
            gt(column: string, value: unknown) {
              values.push(value)
              filters.push(`${column} > $${values.length}`)
              return builder
            },
            order(column: string) {
              order.push(column)
              return builder
            },
            limit(count: number) {
              rowLimit = count
              return builder
            },
            then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
              const sql = [
                `SELECT ${columns} FROM public.${table}`,
                filters.length ? `WHERE ${filters.join(" AND ")}` : "",
                order.length ? `ORDER BY ${order.join(", ")}` : "",
                rowLimit === null ? "" : `LIMIT ${rowLimit}`,
              ]
                .filter(Boolean)
                .join(" ")
              return pg
                .query<Record<string, unknown>>(sql, values)
                .then(({ rows }) => ({ data: rows, error: null }))
                .catch((error: unknown) => ({ data: null, error: { message: String(error) } }))
                .then(resolve, reject)
            },
          }
          return builder
        },
      }
    },
    async rpc(functionName: string, args: Record<string, unknown>) {
      rpcs.push(functionName)
      assert.equal(functionName, "user_facts_save_v1")
      const keys = Object.keys(args)
      for (const key of keys) assert.ok(PARAM_TYPES[key], `unknown parameter ${key}`)
      try {
        const { rows } = await pg.query<{ result: unknown }>(
          `SELECT public.${functionName}(${keys
            .map((key, index) => `${key} => $${index + 1}::${PARAM_TYPES[key]}`)
            .join(", ")}) AS result`,
          keys.map((key) => (PARAM_TYPES[key] === "jsonb" ? JSON.stringify(args[key]) : args[key])),
        )
        return { data: rows[0]!.result, error: null }
      } catch (error) {
        return { data: null, error: { message: String(error) } }
      }
    },
  }
  return { client: client as unknown as SupabaseClient, rpcs }
}

async function run(pg: PersonalPlanTestDb, argv: string[]) {
  const { client, rpcs } = pgliteSupabaseClient(pg)
  const lines: string[] = []
  const summary = await runToolsRollback(argv, {
    supabase: client,
    log: (line) => lines.push(line),
    now: () => NOW,
  })
  return { summary, rpcs, lines }
}

async function seedMembers(pg: PersonalPlanTestDb) {
  // Lena: tool pages + the fields they derive + unrelated Gewohnheiten facts.
  await seed(pg, LENA, { ...UNRELATED, ...TOOL_PAGES, ...DERIVED })
  // Control: the same member as if the tools module had never run.
  await seed(pg, CONTROL, { ...UNRELATED })
  // Gewohnheiten member: a towel answer the pages do NOT explain (frottee vs a microfiber page).
  await seed(pg, GEWOHNHEITEN, {
    ...UNRELATED,
    toolFamiliesWithSomething: ["drying_textiles"],
    toolForms_drying_textiles_1: ["microfiber_towel"],
    towel: { material: "frottee", technique: "gentle_press" },
    nightProtection: ["bonnet"],
  })
  // A member without any tool fact.
  await seed(pg, NO_TOOLS, { ...UNRELATED, towel: { material: "mikrofaser" } })
}

test("a dry run reports the keys and writes nothing", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedMembers(pg)
  const before = await readHairProfile(pg, LENA)

  const { summary, rpcs, lines } = await run(pg, [])

  assert.equal(summary.mode, "dry-run")
  assert.equal(summary.membersExamined, 4)
  assert.equal(summary.membersWithToolFacts, 2)
  assert.equal(rpcs.length, 0)
  assert.ok(lines.some((line) => line.startsWith(`${LENA}: clear toolFamiliesWithSomething`)))
  assert.deepEqual(await readHairProfile(pg, LENA), before)
})

test("--apply clears the tool keys and their provenance and leaves everything else", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedMembers(pg)
  const lenaBefore = (await readHairProfile(pg, LENA))!
  const noToolsBefore = (await readHairProfile(pg, NO_TOOLS))!

  const { summary } = await run(pg, ["--apply"])

  assert.equal(summary.applied, 2)
  assert.deepEqual(summary.failures, [])
  const lena = (await readHairProfile(pg, LENA))!
  const careHabits = lena.care_habits as Record<string, unknown>
  for (const key of TOOL_CARE_KEYS) assert.equal(key in careHabits, false, `${key} cleared`)
  const provenance = (lena.facts_provenance as { care_habits: { fields: Record<string, string> } })
    .care_habits
  for (const key of TOOL_CARE_KEYS) assert.equal(key in provenance.fields, false, `${key} field`)
  // Unrelated and derived keys, with their provenance, are untouched (no --include-derived).
  assert.deepEqual(careHabits.wetWashFrequency, "weekly_2x")
  assert.deepEqual(careHabits.currentProductCategories, ["shampoo", "conditioner"])
  assert.deepEqual(careHabits.towel, { material: "mikrofaser" })
  assert.deepEqual(careHabits.additionalHeatTools, ["dryer_brush", "straightener"])
  assert.equal(provenance.fields.towel, "user")
  assert.equal(provenance.fields.wetWashFrequency, "user")
  // The lineage survives and only `at` moves.
  const stored = (lenaBefore.facts_provenance as { care_habits: Record<string, unknown> })
    .care_habits
  assert.deepEqual(
    (lena.facts_provenance as { care_habits: Record<string, unknown> }).care_habits.source,
    stored.source,
  )
  assert.equal(
    (lena.facts_provenance as { care_habits: { at: string } }).care_habits.at,
    NOW.toISOString(),
  )
  // The legacy columns are a function of the document: unchanged keys, unchanged columns.
  assert.equal(lena.towel_material, lenaBefore.towel_material)
  assert.deepEqual(lena.night_protection, lenaBefore.night_protection)
  assert.deepEqual(lena.brush_type, lenaBefore.brush_type)
  assert.equal(lena.facts_revision, lenaBefore.facts_revision + 1)
  // A member without tool facts is not written at all.
  assert.deepEqual(await readHairProfile(pg, NO_TOOLS), noToolsBefore)
})

test("a repeat run is a no-op: nothing planned, no RPC, no revision bump", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedMembers(pg)
  await run(pg, ["--apply", "--include-derived"])
  const afterFirst = (await readHairProfile(pg, LENA))!

  const second = await run(pg, ["--apply", "--include-derived"])

  assert.equal(second.summary.membersWithToolFacts, 0)
  assert.equal(second.summary.applied, 0)
  assert.equal(second.rpcs.length, 0)
  assert.deepEqual(await readHairProfile(pg, LENA), afterFirst)
})

test("--include-derived clears the tools-derived fields and re-derives the legacy columns", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedMembers(pg)
  const lenaBefore = (await readHairProfile(pg, LENA))!
  assert.equal(lenaBefore.towel_material, "mikrofaser")
  assert.ok(lenaBefore.night_protection?.length)

  await run(pg, ["--apply", "--include-derived"])

  const lena = (await readHairProfile(pg, LENA))!
  const control = (await readHairProfile(pg, CONTROL))!
  // Lena's document and every derived column now read exactly like a member who never ran tools.
  assert.deepEqual(lena.care_habits, control.care_habits)
  assert.equal(lena.towel_material, null)
  assert.equal(lena.towel_material, control.towel_material)
  assert.deepEqual(lena.night_protection, control.night_protection)
  assert.deepEqual(lena.brush_type, control.brush_type)
  assert.deepEqual(lena.styling_tools, control.styling_tools)
  assert.equal(lena.heat_styling, control.heat_styling)
  assert.equal(lena.uses_heat_protection, control.uses_heat_protection)
  const provenance = (lena.facts_provenance as { care_habits: { fields: Record<string, string> } })
    .care_habits.fields
  for (const key of [...TOOL_CARE_KEYS, ...Object.keys(DERIVED)]) {
    assert.equal(key in provenance, false, `${key} provenance removed`)
  }
  assert.equal(provenance.wetWashFrequency, "user")
})

test("--include-derived never touches a value the tool pages do not explain", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedMembers(pg)

  await run(pg, ["--apply", "--include-derived"])

  const member = (await readHairProfile(pg, GEWOHNHEITEN))!
  const careHabits = member.care_habits as Record<string, unknown>
  for (const key of TOOL_CARE_KEYS) assert.equal(key in careHabits, false)
  // Frottee + technique answered in Gewohnheiten, Bonnet with no night page: both stay.
  assert.deepEqual(careHabits.towel, { material: "frottee", technique: "gentle_press" })
  assert.deepEqual(careHabits.nightProtection, ["bonnet"])
  assert.equal(member.towel_material, "frottee")
  // A member with only a derived-looking value and no tool pages is not examined for it.
  const noTools = (await readHairProfile(pg, NO_TOOLS))!
  assert.deepEqual((noTools.care_habits as Record<string, unknown>).towel, {
    material: "mikrofaser",
  })
})

test("the facts lock admits only the door: a direct clear is rejected", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedMembers(pg)
  await assert.rejects(
    pg.query(`UPDATE public.hair_profiles SET care_habits = '{}'::jsonb WHERE user_id = $1`, [
      LENA,
    ]),
  )
})

test("--user narrows the run to one member", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedMembers(pg)
  const gewohnheitenBefore = (await readHairProfile(pg, GEWOHNHEITEN))!

  const { summary } = await run(pg, ["--apply", `--user=${LENA}`])

  assert.equal(summary.membersExamined, 1)
  assert.equal(summary.applied, 1)
  assert.deepEqual(await readHairProfile(pg, GEWOHNHEITEN), gewohnheitenBefore)
})

test("a concurrent edit is reported as a conflict and left for the next run", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedMembers(pg)
  const { client } = pgliteSupabaseClient(pg)
  // Bump the revision between the script's read and its write.
  const racing = new Proxy(client, {
    get(target, property, receiver) {
      if (property !== "rpc") return Reflect.get(target, property, receiver)
      return async (name: string, args: Record<string, unknown>) => {
        await saveUserFacts(pg, {
          userId: String(args.p_user_id),
          domain: "care_habits",
          patch: { wetWashFrequency: "weekly_1x" },
          provenance: provenanceFor(["wetWashFrequency"]),
        })
        return target.rpc(name, args)
      }
    },
  }) as SupabaseClient
  const summary = await runToolsRollback(["--apply", `--user=${LENA}`], {
    supabase: racing,
    log: () => {},
    now: () => NOW,
  })
  assert.equal(summary.conflicts, 1)
  assert.equal(summary.applied, 0)
  const lena = (await readHairProfile(pg, LENA))!
  assert.ok("toolFamiliesWithSomething" in (lena.care_habits as object), "left for the next run")
  // The next run picks it up.
  const next = await run(pg, ["--apply", `--user=${LENA}`])
  assert.equal(next.summary.applied, 1)
})

test("planToolsRollbackForRow is pure and returns null without tool facts", () => {
  assert.equal(
    planToolsRollbackForRow({
      careHabits: { wetWashFrequency: "weekly_2x" },
      fieldProvenance: { wetWashFrequency: "user" },
      includeDerived: true,
    }),
    null,
  )
  assert.equal(
    planToolsRollbackForRow({
      careHabits: null,
      fieldProvenance: undefined,
      includeDerived: false,
    }),
    null,
  )
  const plan = planToolsRollbackForRow({
    careHabits: { toolFamiliesWithSomething: ["airflow"], toolForms_airflow_1: [] },
    fieldProvenance: { toolFamiliesWithSomething: "user", toolForms_airflow_1: "user" },
    includeDerived: false,
  })
  assert.deepEqual(plan?.clearedKeys, ["toolFamiliesWithSomething", "toolForms_airflow_1"])
  assert.deepEqual(plan?.patch, { toolFamiliesWithSomething: null, toolForms_airflow_1: null })
})

test("the CLI defaults to a dry run and rejects unknown flags", () => {
  assert.deepEqual(parseToolsRollbackArguments([]), {
    apply: false,
    includeDerived: false,
    limit: 100000,
    userId: undefined,
  })
  assert.equal(parseToolsRollbackArguments(["--apply"]).apply, true)
  assert.throws(() => parseToolsRollbackArguments(["--apply", "--dry-run"]))
  assert.throws(() => parseToolsRollbackArguments(["--user=nope"]))
  assert.throws(() => parseToolsRollbackArguments(["--everything"]))
})
