import assert from "node:assert/strict"
import test from "node:test"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import {
  TOOL_CARE_KEYS,
  parseToolsRollbackArguments,
  planToolsDraftDowngrade,
  planToolsRollbackForRow,
  runToolsRollback,
} from "../scripts/personal-plan/tools-rollback-clear-facts"
import { resolveStage2RefinementContract } from "../src/lib/personal-plan/refinement/question-path"
import type { PersonalPlanRefinementAnswersV1 } from "../src/lib/personal-plan/refinement/types"
import { careHabitsPatchSchema } from "../src/lib/user-facts/schema"
import {
  completeRefinementDraft,
  createInitialNeed,
  id,
  insertOpenRefinementDraft,
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
function pgliteSupabaseClient(pg: PersonalPlanTestDb): {
  client: SupabaseClient
  rpcs: string[]
  updates: string[]
} {
  const rpcs: string[] = []
  const updates: string[] = []
  const client = {
    from(table: string) {
      type Mode = "select" | "update"
      const make = (mode: Mode, columns: string, setValues: Record<string, unknown> = {}) => {
        const filters: string[] = []
        const values: unknown[] = []
        const order: string[] = []
        let rowLimit: number | null = null
        let returning = columns
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
          in(column: string, list: unknown[]) {
            values.push(list)
            filters.push(`${column} = ANY($${values.length})`)
            return builder
          },
          order(column: string, options?: { ascending?: boolean }) {
            order.push(`${column}${options?.ascending === false ? " DESC" : ""}`)
            return builder
          },
          limit(count: number) {
            rowLimit = count
            return builder
          },
          select(selected: string) {
            returning = selected
            return builder
          },
          then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
            const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""
            let sql: string
            if (mode === "select") {
              sql = [
                `SELECT ${columns} FROM public.${table}`,
                where,
                order.length ? `ORDER BY ${order.join(", ")}` : "",
                rowLimit === null ? "" : `LIMIT ${rowLimit}`,
              ]
                .filter(Boolean)
                .join(" ")
            } else {
              const sets = Object.entries(setValues).map(([column, value]) => {
                values.push(
                  Array.isArray(value) && column === "completed_question_ids"
                    ? value
                    : typeof value === "object"
                      ? JSON.stringify(value)
                      : value,
                )
                return `${column} = $${values.length}`
              })
              sql = `UPDATE public.${table} SET ${sets.join(", ")} ${where} RETURNING ${returning}`
            }
            return pg
              .query<Record<string, unknown>>(sql, values)
              .then(({ rows }) => ({ data: rows, error: null }))
              .catch((error: unknown) => ({ data: null, error: { message: String(error) } }))
              .then(resolve, reject)
          },
        }
        return builder
      }
      return {
        select: (columns: string) => make("select", columns),
        update: (setValues: Record<string, unknown>) => {
          updates.push(table)
          return make("update", "id", setValues)
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
  return { client: client as unknown as SupabaseClient, rpcs, updates }
}

async function run(pg: PersonalPlanTestDb, argv: string[]) {
  const { client, rpcs, updates } = pgliteSupabaseClient(pg)
  const lines: string[] = []
  const summary = await runToolsRollback(argv, {
    supabase: client,
    log: (line) => lines.push(line),
    now: () => NOW,
  })
  return { summary, rpcs, updates, lines }
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

/* ── Draft downgrade (fix wave F2) ────────────────────────────────────────── */

const IN_PROGRESS_MEMBER = id(5, 5)
const COMPLETE_MEMBER = id(6, 6)
const PLAIN_DRAFT_MEMBER = id(7, 7)

const TOOL_PAGE_KEYS = [
  "wash_application:1",
  "drying_textiles:1",
  "brushes_combs:1",
  "brushes_combs:2",
  "airflow:1",
  "heated_styling:1",
  "heatless_styling:1",
  "securing_sectioning:1",
  "securing_sectioning:2",
  "night_protection:1",
] as const

/** A flag-on draft: tool answers, plus the Gewohnheiten answers the old path asks for. */
function toolDraftAnswers(): PersonalPlanRefinementAnswersV1 {
  return {
    currentProductCategories: [],
    wetWashFrequency: "weekly_2x",
    toolFamiliesWithSomething: ["airflow"],
    toolForms: Object.fromEntries(
      TOOL_PAGE_KEYS.map((key) => [key, key === "airflow:1" ? ["hair_dryer"] : []]),
    ),
    towel: { material: "mikrofaser", technique: "gentle_press" },
    dryingRoutes: ["air_dry"],
    additionalHeatTools: [],
    nightProtection: [],
  } as PersonalPlanRefinementAnswersV1
}
const TOOL_DRAFT_COMPLETED = [
  "current_product_categories",
  "wet_wash_frequency",
  "tools_overview",
  "tools:airflow:1",
  "tools:wash_application:1",
  "towel_handling",
  "drying_routes",
]
const TOOL_DRAFT_PROVENANCE = {
  current_product_categories: "user",
  wet_wash_frequency: "user",
  tools_overview: "user",
  "tools:airflow:1": "user",
  "tools:wash_application:1": "assumed",
  towel_handling: "user",
  drying_routes: "user",
}
const PRE_PORT_CONTEXT = {
  relevantCategories: [],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible" as const,
}

async function seedDraft(
  pg: PersonalPlanTestDb,
  input: {
    userId: string
    planId: string
    needVersionId: string
    draftId: string
    answers: PersonalPlanRefinementAnswersV1
    completed: string[]
    provenance: Record<string, string>
    complete?: string
  },
) {
  await insertOpenRefinementDraft(pg, {
    draftId: input.draftId,
    userId: input.userId,
    planId: input.planId,
    baseInitialNeedVersionId: input.needVersionId,
  })
  await pg.query(
    `UPDATE public.personal_plan_refinement_drafts
        SET answers = $2::jsonb, completed_question_ids = $3, answer_provenance = $4::jsonb
      WHERE id = $1`,
    [
      input.draftId,
      JSON.stringify(input.answers),
      input.completed,
      JSON.stringify(input.provenance),
    ],
  )
  if (input.complete) {
    const result = await completeRefinementDraft(pg, {
      userId: input.userId,
      planId: input.planId,
      draftId: input.draftId,
      expectedRevision: 0,
      inputHash: input.complete,
    })
    assert.equal(result.outcome, "completed")
  }
}

type DraftRow = {
  id: string
  status: string
  revision: number
  answers: Record<string, unknown>
  completed_question_ids: string[]
  answer_provenance: Record<string, string>
}
async function readDraft(pg: PersonalPlanTestDb, draftId: string): Promise<DraftRow> {
  const { rows } = await pg.query<DraftRow>(
    `SELECT id, status, revision, answers, completed_question_ids, answer_provenance
       FROM public.personal_plan_refinement_drafts WHERE id = $1`,
    [draftId],
  )
  return rows[0]!
}

const DRAFTS = {
  inProgress: id(8, 1),
  completeOld: id(8, 2),
  completeLatest: id(8, 3),
  plain: id(8, 4),
}

async function seedDraftMembers(pg: PersonalPlanTestDb) {
  const shared = {
    answers: toolDraftAnswers(),
    completed: TOOL_DRAFT_COMPLETED,
    provenance: TOOL_DRAFT_PROVENANCE,
  }
  // In-progress draft with tool answers.
  await insertProfile(pg, IN_PROGRESS_MEMBER)
  const a = await createInitialNeed(pg, { userId: IN_PROGRESS_MEMBER, inputHash: "a".repeat(64) })
  await seedDraft(pg, {
    ...shared,
    userId: IN_PROGRESS_MEMBER,
    planId: a.personalPlanId,
    needVersionId: a.needVersionId,
    draftId: DRAFTS.inProgress,
  })
  // Two completed drafts on one base: only the latest one can be reopened.
  await insertProfile(pg, COMPLETE_MEMBER)
  const b = await createInitialNeed(pg, { userId: COMPLETE_MEMBER, inputHash: "b".repeat(64) })
  await seedDraft(pg, {
    ...shared,
    userId: COMPLETE_MEMBER,
    planId: b.personalPlanId,
    needVersionId: b.needVersionId,
    draftId: DRAFTS.completeOld,
    complete: "c".repeat(64),
  })
  await seedDraft(pg, {
    ...shared,
    userId: COMPLETE_MEMBER,
    planId: b.personalPlanId,
    needVersionId: b.needVersionId,
    draftId: DRAFTS.completeLatest,
    complete: "d".repeat(64),
  })
  // A member whose draft never saw the tools.
  await insertProfile(pg, PLAIN_DRAFT_MEMBER)
  const c = await createInitialNeed(pg, { userId: PLAIN_DRAFT_MEMBER, inputHash: "e".repeat(64) })
  await seedDraft(pg, {
    userId: PLAIN_DRAFT_MEMBER,
    planId: c.personalPlanId,
    needVersionId: c.needVersionId,
    draftId: DRAFTS.plain,
    answers: { currentProductCategories: [], wetWashFrequency: "weekly_2x" },
    completed: ["current_product_categories", "wet_wash_frequency"],
    provenance: { current_product_categories: "user", wet_wash_frequency: "user" },
  })
}

/** `careHabitsPatchSchema` as origin/main shipped it: without the tools keys. */
const prePortPatchSchema = (() => {
  const shape = (careHabitsPatchSchema as unknown as { shape: Record<string, z.ZodType> }).shape
  const kept = Object.fromEntries(
    Object.entries(shape).filter(
      ([key]) => key !== "toolFamiliesWithSomething" && !key.startsWith("toolForms_"),
    ),
  )
  // The post-port schema flattens `toolForms` into page keys; the draft's nested `toolForms`
  // answer is the other key the old strict schema rejects (it never existed there).
  return z.object(kept).strict()
})()

/** What origin/main `toCareHabitsPatch` did with the stored answers: `{ ...answers }`. */
function prePortPatch(row: DraftRow) {
  const contract = resolveStage2RefinementContract({
    triggerContext: PRE_PORT_CONTEXT,
    answers: row.answers as PersonalPlanRefinementAnswersV1,
    completedQuestionIds: row.completed_question_ids as never,
  })
  return { patch: { ...contract.answers }, contract }
}

test("before the downgrade a pre-port patch from a tool draft is rejected (the review's probe)", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedDraftMembers(pg)
  const row = await readDraft(pg, DRAFTS.inProgress)
  const result = prePortPatchSchema.safeParse(prePortPatch(row).patch)
  assert.equal(result.success, false)
  assert.ok(
    result.error?.issues.some((issue) => issue.code === "unrecognized_keys"),
    "toolFamiliesWithSomething / toolForms are unrecognized for the old schema",
  )
})

test("a dry run reports the drafts and writes nothing", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedDraftMembers(pg)
  const before = await readDraft(pg, DRAFTS.inProgress)

  const { summary, updates, lines } = await run(pg, [])

  assert.equal(updates.length, 0)
  assert.equal(summary.draftsWithToolAnswers, 2)
  assert.equal(summary.draftsApplied, 0)
  assert.ok(lines.some((line) => line.startsWith(`draft ${DRAFTS.inProgress}`)))
  assert.deepEqual(await readDraft(pg, DRAFTS.inProgress), before)
})

test("--apply downgrades the in-progress and the latest complete draft, nothing else", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedDraftMembers(pg)
  const before = {
    inProgress: await readDraft(pg, DRAFTS.inProgress),
    old: await readDraft(pg, DRAFTS.completeOld),
    latest: await readDraft(pg, DRAFTS.completeLatest),
    plain: await readDraft(pg, DRAFTS.plain),
  }

  const { summary, updates } = await run(pg, ["--apply"])

  assert.equal(summary.draftsApplied, 2)
  assert.equal(updates.length, 2, "one UPDATE per draft")
  assert.deepEqual(summary.failures, [])
  for (const [name, draftId] of [
    ["inProgress", DRAFTS.inProgress],
    ["latest", DRAFTS.completeLatest],
  ] as const) {
    const draft = await readDraft(pg, draftId)
    assert.equal("toolFamiliesWithSomething" in draft.answers, false, name)
    assert.equal("toolForms" in draft.answers, false, name)
    assert.deepEqual(draft.completed_question_ids, [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
    ])
    assert.deepEqual(draft.answer_provenance, {
      current_product_categories: "user",
      wet_wash_frequency: "user",
      towel_handling: "user",
      drying_routes: "user",
    })
    // Every other answer is untouched, the revision moved so CAS clients refetch.
    const kept = { ...before[name].answers }
    delete kept.toolFamiliesWithSomething
    delete kept.toolForms
    assert.deepEqual(draft.answers, kept)
    assert.equal(Number(draft.revision), Number(before[name].revision) + 1)
    assert.equal(draft.status, before[name].status)
  }
  // The superseded complete draft and the tool-free draft are not rows the script owns.
  assert.deepEqual(await readDraft(pg, DRAFTS.completeOld), before.old)
  assert.deepEqual(await readDraft(pg, DRAFTS.plain), before.plain)
})

test("after the downgrade the pre-port code path accepts the draft and it still completes", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedDraftMembers(pg)
  await run(pg, ["--apply"])

  for (const draftId of [DRAFTS.inProgress, DRAFTS.completeLatest]) {
    const row = await readDraft(pg, draftId)
    const { patch, contract } = prePortPatch(row)
    const parsed = prePortPatchSchema.safeParse(patch)
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues))
    // The old path asks the (derived-during-the-port) Gewohnheiten questions again until they
    // are confirmed; with them confirmed the draft completes.
    const completed = resolveStage2RefinementContract({
      triggerContext: PRE_PORT_CONTEXT,
      answers: row.answers as PersonalPlanRefinementAnswersV1,
      completedQuestionIds: [...contract.path.orderedQuestionIds],
    })
    assert.equal(completed.isComplete, true, completed.validationErrors.join("; "))
  }
})

test("a repeat run is a no-op for the drafts", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedDraftMembers(pg)
  await run(pg, ["--apply"])
  const afterFirst = await readDraft(pg, DRAFTS.inProgress)

  const second = await run(pg, ["--apply"])

  assert.equal(second.summary.draftsWithToolAnswers, 0)
  assert.equal(second.summary.draftsApplied, 0)
  assert.equal(second.updates.length, 0)
  assert.deepEqual(await readDraft(pg, DRAFTS.inProgress), afterFirst)
})

test("--user narrows the draft pass too", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedDraftMembers(pg)
  const completeBefore = await readDraft(pg, DRAFTS.completeLatest)

  const { summary } = await run(pg, ["--apply", `--user=${IN_PROGRESS_MEMBER}`])

  assert.equal(summary.draftsApplied, 1)
  assert.deepEqual(await readDraft(pg, DRAFTS.completeLatest), completeBefore)
})

test("a draft changed between read and write is a conflict, left for the next run", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await seedDraftMembers(pg)
  const { client } = pgliteSupabaseClient(pg)
  type Chain = {
    eq: (column: string, value: unknown) => Chain
    select: (columns: string) => Chain
    then: (resolve: never, reject: never) => unknown
  }
  const racing = new Proxy(client, {
    get(target, property, receiver) {
      if (property !== "from") return Reflect.get(target, property, receiver)
      return (table: string) => {
        const builder = (
          target as never as { from: (name: string) => { update: (v: unknown) => Chain } }
        ).from(table)
        if (table !== "personal_plan_refinement_drafts") return builder
        return {
          ...builder,
          update: (values: unknown) => {
            const inner = builder.update(values)
            const wrapper: Chain = {
              eq: (column, value) => (inner.eq(column, value), wrapper),
              select: (columns) => (inner.select(columns), wrapper),
              // A save lands first: the revision the script read is no longer current.
              then: (resolve, reject) =>
                pg
                  .query(
                    `UPDATE public.personal_plan_refinement_drafts SET revision = revision + 1 WHERE id = $1`,
                    [DRAFTS.inProgress],
                  )
                  .then(() => inner.then(resolve, reject)),
            }
            return wrapper
          },
        }
      }
    },
  }) as SupabaseClient
  const summary = await runToolsRollback(["--apply", `--user=${IN_PROGRESS_MEMBER}`], {
    supabase: racing,
    log: () => {},
    now: () => NOW,
  })
  assert.equal(summary.draftConflicts, 1)
  assert.equal(summary.draftsApplied, 0)
  assert.ok(
    "toolForms" in (await readDraft(pg, DRAFTS.inProgress)).answers,
    "left for the next run",
  )
  const next = await run(pg, ["--apply", `--user=${IN_PROGRESS_MEMBER}`])
  assert.equal(next.summary.draftsApplied, 1)
})

test("planToolsDraftDowngrade is pure and returns null without tool state", () => {
  assert.equal(
    planToolsDraftDowngrade({
      answers: { wetWashFrequency: "weekly_2x" },
      completedQuestionIds: ["wet_wash_frequency"],
      answerProvenance: { wet_wash_frequency: "user" },
    }),
    null,
  )
  const plan = planToolsDraftDowngrade({
    answers: { wetWashFrequency: "weekly_2x" },
    completedQuestionIds: ["wet_wash_frequency", "tools_overview"],
    answerProvenance: { wet_wash_frequency: "user", tools_overview: "assumed" },
  })
  assert.deepEqual(plan?.completedQuestionIds, ["wet_wash_frequency"])
  assert.deepEqual(plan?.answerProvenance, { wet_wash_frequency: "user" })
})
