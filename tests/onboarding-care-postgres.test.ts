import assert from "node:assert/strict"
import test from "node:test"

import {
  saveOnboardingCare,
  type OnboardingCareSaveDeps,
} from "../src/lib/hair-profile/onboarding-care-route"
import {
  onboardingCareSchema,
  type OnboardingCareValues,
} from "../src/lib/hair-profile/onboarding-care"
import { deriveCareHabitsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { parseUserFactsRow } from "../src/lib/user-facts/read"
import { saveUserFacts as saveUserFactsRpc } from "../src/lib/user-facts/save"
import {
  mobileFactsDatabase,
  pgliteRpcClient,
  readRow,
} from "./mobile-profile-facts-pglite.fixtures"
import {
  applyUserFactsLock,
  id,
  insertProfile,
  saveUserFacts,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Clean-switch task 6 on the REAL schema (PGlite): the onboarding care steps
 * (`POST /api/profile/care-habits` → `saveOnboardingCare`) write facts only through
 * `user_facts_save_v1`, and the door derives the eight legacy care columns.
 *
 * The second half compares those derived columns with what the OLD browser upsert would have
 * stored for the same input (`oldUpsert`). The differences the new model allows are enumerated in
 * `ALLOWED_DIFFERENCES` and nowhere else; every other divergence is a FINDING, pinned as its own
 * test below so the suite records it without hiding it.
 */

const OWNER = id(1, 1)
const NOW = "2026-09-30T12:00:00.000Z"

const CARE_COLUMNS = [
  "drying_method",
  "heat_styling",
  "styling_tools",
  "uses_heat_protection",
  "towel_material",
  "towel_technique",
  "night_protection",
  "brush_type",
] as const
type CareColumn = (typeof CARE_COLUMNS)[number]
type CareRow = Record<CareColumn, unknown>

const BLANK: CareRow = {
  drying_method: null,
  heat_styling: null,
  styling_tools: null,
  uses_heat_protection: false,
  towel_material: null,
  towel_technique: null,
  night_protection: null,
  brush_type: null,
}

/** An established profile the way the old onboarding stored it: legacy columns, no document. */
const ESTABLISHED: CareRow = {
  drying_method: "blow_dry",
  heat_styling: "several_weekly",
  styling_tools: ["blow_dryer", "flat_iron"],
  uses_heat_protection: true,
  towel_material: "frottee",
  towel_technique: "rough_rubbing",
  night_protection: ["silk_satin_pillow"],
  brush_type: ["paddle"],
}

function values(body: unknown): OnboardingCareValues {
  return onboardingCareSchema.parse(body)
}

/** Seeds the profile (and, with `columns`, a legacy row) on a database opened with
 * `{ lock: false }`, then applies the lock — the order production goes through. */
async function seedRow(pg: PersonalPlanTestDb, columns?: CareRow) {
  await insertProfile(pg, OWNER)
  if (columns) await insertLegacyRow(pg, columns)
  await applyUserFactsLock(pg)
}

async function insertLegacyRow(pg: PersonalPlanTestDb, columns: CareRow) {
  await pg.query(
    `INSERT INTO public.hair_profiles
       (user_id, drying_method, heat_styling, styling_tools, uses_heat_protection,
        towel_material, towel_technique, night_protection, brush_type)
     VALUES ($1, $2, $3, $4::text[], $5, $6, $7, $8::text[], $9::text[])`,
    [
      OWNER,
      columns.drying_method,
      columns.heat_styling,
      columns.styling_tools,
      columns.uses_heat_protection,
      columns.towel_material,
      columns.towel_technique,
      columns.night_protection,
      columns.brush_type,
    ],
  )
}

function deps(pg: PersonalPlanTestDb, client = pgliteRpcClient(pg)) {
  const value: OnboardingCareSaveDeps = {
    createAdminClient: () => client as never,
    saveUserFacts: saveUserFactsRpc,
    loadProfileRow: async () => readRow(pg, OWNER),
    now: () => NOW,
  }
  return value
}

async function careColumns(pg: PersonalPlanTestDb): Promise<CareRow> {
  const row = (await readRow(pg, OWNER))!
  return Object.fromEntries(CARE_COLUMNS.map((column) => [column, row[column]])) as CareRow
}

// ---------------------------------------------------------------------------
// create / update / no-op / conflict
// ---------------------------------------------------------------------------

test("create: a user without a hair_profiles row gets one with exactly what she entered", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  assert.equal(await readRow(pg, OWNER), null)

  const result = await saveOnboardingCare(deps(pg), OWNER, values({ towel_material: "frottee" }))
  assert.ok(result.profile)

  const row = (await readRow(pg, OWNER))!
  assert.equal(row.facts_revision, 1)
  const facts = parseUserFactsRow(OWNER, row)
  assert.deepEqual(facts.careHabits, { towel: { material: "frottee" } })
  assert.deepEqual(facts.provenance.care_habits?.source, { kind: "onboarding" })
  assert.deepEqual(facts.provenance.care_habits?.fields, { towel: "user" })
  assert.equal(row.towel_material, "frottee")
  assert.deepEqual(await careColumns(pg), { ...BLANK, towel_material: "frottee" })
  assert.equal(facts.diagnostics, null, "no diagnostics invented")
})

test("update: one step changes its own fields, keeps the other answers and their markers", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  const seeded = await saveUserFacts(pg, {
    userId: OWNER,
    domain: "care_habits",
    patch: {
      wetWashFrequency: "weekly_2x",
      towel: { material: "frottee", technique: "gentle_press" },
      dryingRoutes: ["air_dry"],
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
      },
    },
    provenance: {
      source: { kind: "feinschliff_draft", id: "draft-1" },
      schemaVersion: 1,
      at: "2026-09-01T08:00:00.000Z",
      fields: { wetWashFrequency: "user", towel: "user", heatEvents: "assumed" },
    },
  })
  assert.equal(seeded.status, "ok")
  const before = (await readRow(pg, OWNER))!

  await saveOnboardingCare(
    deps(pg),
    OWNER,
    values({ night_protection: ["pineapple", "loose_tied"] }),
  )

  const row = (await readRow(pg, OWNER))!
  assert.equal(row.facts_revision, (before.facts_revision as number) + 1)
  const facts = parseUserFactsRow(OWNER, row)
  assert.deepEqual(facts.careHabits, {
    ...parseUserFactsRow(OWNER, before).careHabits,
    nightProtection: ["pineapple", "loose_tied"],
  })
  assert.deepEqual(facts.provenance.care_habits?.source, { kind: "onboarding" })
  assert.deepEqual(facts.provenance.care_habits?.fields, {
    wetWashFrequency: "user",
    towel: "user",
    heatEvents: "assumed",
    nightProtection: "user",
  })
  assert.deepEqual(row.night_protection, ["pineapple", "loose_tied"])
  assert.equal(
    row.towel_material,
    "frottee",
    "the other columns are re-derived from the same facts",
  )
  assert.equal(row.heat_styling, "once_weekly")
  assert.deepEqual(
    await careColumns(pg),
    { ...deriveCareHabitsColumns(facts.careHabits!) },
    "the row holds exactly what the TS oracle derives",
  )
})

test("no-op: a save that changes nothing writes nothing (revision, provenance, updated_at stay)", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  await saveOnboardingCare(deps(pg), OWNER, values({ towel_material: "mikrofaser" }))
  const before = (await readRow(pg, OWNER))!

  const calls: unknown[] = []
  const client = pgliteRpcClient(pg)
  const result = await saveOnboardingCare(
    deps(pg, client),
    OWNER,
    values({ towel_material: "mikrofaser" }),
  )
  calls.push(...client.calls)

  assert.deepEqual(calls, [], "the door was not called")
  assert.deepEqual(await readRow(pg, OWNER), before)
  assert.deepEqual(result.profile, before)
})

test("no-op on a row with legacy columns and no document: the row is left alone", async (t) => {
  const pg = await mobileFactsDatabase(t, { lock: false })
  await seedRow(pg, ESTABLISHED)
  const before = (await readRow(pg, OWNER))!
  const client = pgliteRpcClient(pg)
  await saveOnboardingCare(
    deps(pg, client),
    OWNER,
    values({ night_protection: ["silk_satin_pillow"], towel_material: "frottee" }),
  )
  assert.deepEqual(client.calls, [])
  assert.deepEqual(await readRow(pg, OWNER), before)
  assert.equal(before.care_habits, null)
})

test("conflict: a concurrent facts write between read and save is a profile_conflict", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  const base = deps(pg)
  await assert.rejects(
    saveOnboardingCare(
      {
        ...base,
        // Another writer lands right after this save read the row.
        loadProfileRow: async (admin, userId) => {
          const read = await base.loadProfileRow(admin, userId)
          await saveUserFacts(pg, {
            userId: OWNER,
            domain: "care_habits",
            patch: { nightProtection: ["pineapple"] },
            provenance: {
              source: { kind: "feinschliff_draft", id: "d" },
              schemaVersion: 1,
              at: NOW,
            },
          })
          return read
        },
      },
      OWNER,
      values({ night_protection: [] }),
    ),
    { code: "profile_conflict" },
  )
  const facts = parseUserFactsRow(OWNER, (await readRow(pg, OWNER))!)
  assert.deepEqual(
    facts.careHabits?.nightProtection,
    ["pineapple"],
    "the other writer's save survives",
  )
})

test("a row with legacy columns and no document: a partial step keeps every other column", async (t) => {
  const pg = await mobileFactsDatabase(t, { lock: false })
  await seedRow(pg, ESTABLISHED)
  await saveOnboardingCare(deps(pg), OWNER, values({ night_protection: [] }))

  const after = await careColumns(pg)
  assert.deepEqual(after, { ...ESTABLISHED, night_protection: [] })
  const facts = parseUserFactsRow(OWNER, (await readRow(pg, OWNER))!)
  assert.ok(facts.careHabits?.towel && facts.careHabits.heatEvents && facts.careHabits.brushesCombs)
  assert.equal(facts.provenance.care_habits?.fields?.nightProtection, "user")
  assert.equal(facts.provenance.care_habits?.fields?.towel, "unknown_historical")
})

test("a legacy_columns-sourced document is updated like any other and re-sourced to onboarding", async (t) => {
  const pg = await mobileFactsDatabase(t)
  await insertProfile(pg, OWNER)
  await saveUserFacts(pg, {
    userId: OWNER,
    domain: "care_habits",
    patch: { towel: { material: "frottee" }, nightProtection: ["pineapple"] },
    provenance: {
      source: { kind: "legacy_columns" },
      schemaVersion: 1,
      at: "2026-09-20T08:00:00.000Z",
      fields: { towel: "unknown_historical", nightProtection: "unknown_historical" },
    },
  })
  await saveOnboardingCare(deps(pg), OWNER, values({ towel_technique: "rough_rubbing" }))
  const facts = parseUserFactsRow(OWNER, (await readRow(pg, OWNER))!)
  assert.deepEqual(facts.careHabits, {
    towel: { material: "frottee", technique: "rough_rubbing" },
    nightProtection: ["pineapple"],
  })
  assert.deepEqual(facts.provenance.care_habits?.source, { kind: "onboarding" })
  assert.deepEqual(facts.provenance.care_habits?.fields, {
    towel: "user",
    nightProtection: "unknown_historical",
  })
})

// ---------------------------------------------------------------------------
// Old browser upsert vs the door: the eight derived columns
// ---------------------------------------------------------------------------

/** What the old `saveHairProfile` left in the eight columns: the named columns over the row. */
function oldUpsert(row: CareRow, step: OnboardingCareValues): CareRow {
  return { ...row, ...step } as CareRow
}

/**
 * The differences the new model allows. Each is applied to BOTH sides before comparing and is the
 * only normalisation the comparison does:
 *  1. canonical array order: the door derives lists in the canonical vocabulary order, the old
 *     upsert kept click order;
 *  2. `wave_iron` / `curling_iron`: the conversion folds both into the combined curling/wave iron
 *     (plan §3, combined "Lockenstab / Welleneisen" label), which derives back as `curling_iron`;
 *  3. `[]` vs NULL on the three list columns, and NULL vs false on `uses_heat_protection`
 *     (an unanswered list / flag derives as NULL / false, the same "nothing answered").
 */
const ALLOWED_DIFFERENCES = {
  canonicalOrder: (list: string[]) => [...list].sort(),
  foldWaveIron: (list: string[]) => [
    ...new Set(list.map((tool) => (tool === "wave_iron" ? "curling_iron" : tool))),
  ],
  emptyIsNull: (list: string[] | null) => list ?? [],
}

function normalise(row: CareRow) {
  const tools = ALLOWED_DIFFERENCES.canonicalOrder(
    ALLOWED_DIFFERENCES.foldWaveIron(
      ALLOWED_DIFFERENCES.emptyIsNull(row.styling_tools as string[] | null),
    ),
  )
  return {
    ...row,
    styling_tools: tools,
    night_protection: ALLOWED_DIFFERENCES.canonicalOrder(
      ALLOWED_DIFFERENCES.emptyIsNull(row.night_protection as string[] | null),
    ),
    brush_type: ALLOWED_DIFFERENCES.canonicalOrder(
      ALLOWED_DIFFERENCES.emptyIsNull(row.brush_type as string[] | null),
    ),
    uses_heat_protection: row.uses_heat_protection ?? false,
  }
}

/** Runs the steps through the door and through the old upsert; returns both column sets after each. */
async function compare(
  t: Parameters<typeof mobileFactsDatabase>[0],
  start: CareRow | null,
  steps: unknown[],
) {
  const pg = await mobileFactsDatabase(t, { lock: false })
  await seedRow(pg, start ?? undefined)
  let old: CareRow = start ?? BLANK
  const trail: Array<{ step: unknown; old: CareRow; now: CareRow }> = []
  for (const step of steps) {
    const parsed = values(step)
    await saveOnboardingCare(deps(pg), OWNER, parsed)
    old = oldUpsert(old, parsed)
    // A save that changes nothing creates no row; the old upsert would have created an empty one.
    const row = await readRow(pg, OWNER)
    const now = row
      ? (Object.fromEntries(CARE_COLUMNS.map((column) => [column, row[column]])) as CareRow)
      : BLANK
    trail.push({ step, old, now })
  }
  return trail
}

function assertEquivalent(
  trail: Awaited<ReturnType<typeof compare>>,
  options: { onlyFinal?: boolean } = {},
) {
  for (const { step, old, now } of options.onlyFinal ? trail.slice(-1) : trail) {
    assert.deepEqual(normalise(now), normalise(old), `after ${JSON.stringify(step)}`)
  }
}

test("old vs door: a fresh user's whole flow derives the columns the old upsert stored", async (t) => {
  assertEquivalent(
    await compare(t, null, [
      { styling_tools: ["flat_iron", "wave_iron", "curling_iron"] },
      { heat_styling: "several_weekly" },
      { uses_heat_protection: true },
      { towel_material: "frottee" },
      { towel_technique: "gentle_press" },
      { drying_method: "air_dry" },
      { brush_type: ["wide_tooth_comb", "fingers"] },
      { night_protection: ["silk_satin_pillow", "pineapple"] },
    ]),
  )
})

test("old vs door: a fresh user who blow-dries and owns the blow dryer (after the drying step)", async (t) => {
  // Between the tools step and the drying step the blow dryer tool already derives a drying
  // method the old upsert had not stored yet (FINDING F3); once she has answered the drying
  // step the two agree.
  assertEquivalent(
    await compare(t, null, [
      { styling_tools: ["flat_iron", "blow_dryer"] },
      { heat_styling: "daily" },
      { uses_heat_protection: false },
      { towel_material: "mikrofaser" },
      { towel_technique: "rough_rubbing" },
      { drying_method: "blow_dry" },
      { brush_type: ["round"] },
      { night_protection: ["loose_tied"] },
    ]).then((trail) => trail.slice(5)),
  )
})

test("old vs door: no heat tools, no towel, nothing at night", async (t) => {
  assertEquivalent(
    await compare(t, null, [
      { styling_tools: [], heat_styling: "never", uses_heat_protection: false },
      { towel_material: "no_towel", towel_technique: null },
      { drying_method: "air_dry" },
      { brush_type: [] },
      { night_protection: [] },
    ]),
  )
})

test("old vs door: an empty or unset brush answer", async (t) => {
  assertEquivalent(await compare(t, null, [{ brush_type: null }, { night_protection: [] }]))
  assertEquivalent(await compare(t, ESTABLISHED, [{ brush_type: null }, { brush_type: [] }]))
})

test("old vs door: every step re-saved on an established row with legacy columns only", async (t) => {
  assertEquivalent(
    await compare(t, ESTABLISHED, [
      { night_protection: ["pineapple"] },
      { towel_material: "mikrofaser" },
      { towel_technique: "gentle_press" },
      { brush_type: ["fingers", "wide_tooth_comb"] },
      { heat_styling: "once_weekly" },
      { uses_heat_protection: false },
      { styling_tools: ["flat_iron", "blow_dryer", "hot_air_brush"] },
      { heat_styling: "rarely" },
      { uses_heat_protection: true },
    ]),
  )
})

test("old vs door: switching the towel off and on again", async (t) => {
  assertEquivalent(
    await compare(t, ESTABLISHED, [
      { towel_material: "no_towel", towel_technique: null },
      { towel_material: "tshirt" },
      { towel_technique: "rough_rubbing" },
    ]),
  )
})

// ---------------------------------------------------------------------------
// FINDINGS: divergences the one existing conversion cannot avoid. Pinned, not normalised away.
// ---------------------------------------------------------------------------

test("FINDING F1: a drying route she blow-dries with adds the blow dryer to the derived tools", async (t) => {
  const trail = await compare(t, null, [
    { styling_tools: ["flat_iron"] },
    { drying_method: "blow_dry" },
  ])
  const last = trail[trail.length - 1]!
  assert.deepEqual(last.old.styling_tools, ["flat_iron"])
  assert.deepEqual(last.now.styling_tools, ["blow_dryer", "flat_iron"])
  assert.equal(last.now.drying_method, "blow_dry")
})

test("FINDING F2: an air-dry answer next to a blow dryer tool derives as blow_dry", async (t) => {
  const trail = await compare(t, null, [
    { styling_tools: ["blow_dryer"] },
    { drying_method: "air_dry" },
  ])
  const last = trail[trail.length - 1]!
  assert.equal(last.old.drying_method, "air_dry")
  assert.equal(last.now.drying_method, "blow_dry")
})

test("FINDING F3: a dryer tool derives a drying method of its own", async (t) => {
  const diffuser = await compare(t, { ...BLANK, drying_method: "air_dry" }, [
    { styling_tools: ["diffuser"] },
  ])
  assert.equal(diffuser[0]!.old.drying_method, "air_dry")
  assert.equal(diffuser[0]!.now.drying_method, "blow_dry_diffuser")

  // …and with no drying answer yet (the tools step comes before the drying step):
  const dryer = await compare(t, null, [{ styling_tools: ["blow_dryer"] }])
  assert.equal(dryer[0]!.old.drying_method, null)
  assert.equal(dryer[0]!.now.drying_method, "blow_dry")
})

test("FINDING F4: a heat level without any heat source has no place and is dropped", async (t) => {
  const trail = await compare(t, null, [{ heat_styling: "daily" }])
  const last = trail[trail.length - 1]!
  assert.equal(last.old.heat_styling, "daily")
  assert.equal(last.now.heat_styling, null)
})

test("FINDING F5: a towel technique without a towel material has no place and is dropped", async (t) => {
  const trail = await compare(t, null, [{ towel_technique: "gentle_press" }])
  const last = trail[trail.length - 1]!
  assert.equal(last.old.towel_technique, "gentle_press")
  assert.equal(last.now.towel_technique, null)
})

test("FINDING F6: no heat tools while she dries with the blow dryer keeps the dryer and loses the level", async (t) => {
  const trail = await compare(t, ESTABLISHED, [
    { styling_tools: [], heat_styling: "never", uses_heat_protection: false },
  ])
  const last = trail[trail.length - 1]!
  assert.deepEqual(last.old.styling_tools, [])
  assert.equal(last.old.heat_styling, "never")
  assert.deepEqual(last.now.styling_tools, ["blow_dryer"])
  assert.equal(last.now.heat_styling, null)
})

test("FINDING F7: a stored protection flag without a heat level is lost on the first care save", async (t) => {
  const start: CareRow = {
    ...BLANK,
    styling_tools: ["flat_iron"],
    heat_styling: null,
    uses_heat_protection: true,
  }
  const trail = await compare(t, start, [{ night_protection: ["pineapple"] }])
  const last = trail[trail.length - 1]!
  assert.equal(last.old.uses_heat_protection, true)
  assert.equal(last.now.uses_heat_protection, false)
  assert.deepEqual(last.now.styling_tools, ["flat_iron"], "the tool itself survives")
})

// ---------------------------------------------------------------------------
// Fix round 4: the product owner's decisions and the merge bugs, on the real door + lock
// ---------------------------------------------------------------------------

async function careDocument(pg: PersonalPlanTestDb) {
  const row = (await readRow(pg, OWNER))!
  return row.care_habits as Record<string, unknown>
}

test("DECISION 1: „Nie“ after selected tools is stored as no heat tools", async (t) => {
  const trail = await compare(t, null, [
    { styling_tools: ["flat_iron"] },
    { heat_styling: "never" },
  ])
  const last = trail[trail.length - 1]!
  assert.deepEqual(last.old.styling_tools, ["flat_iron"], "the old upsert kept the tool")
  assert.deepEqual(last.now.styling_tools, [])
  assert.equal(last.now.heat_styling, "never")
  assert.equal(last.now.uses_heat_protection, false)
})

test("DECISION 2: dryer only with protection „Ja“ keeps the column true, via heat_protectant", async (t) => {
  const pg = await mobileFactsDatabase(t, { lock: false })
  await seedRow(pg)
  for (const step of [
    { styling_tools: ["blow_dryer"] },
    { heat_styling: "daily" },
    { uses_heat_protection: true },
  ]) {
    await saveOnboardingCare(deps(pg), OWNER, values(step))
  }
  const columns = await careColumns(pg)
  assert.equal(columns.uses_heat_protection, true, "the old upsert stored true too")
  assert.deepEqual(columns.styling_tools, ["blow_dryer"])
  assert.deepEqual((await careDocument(pg)).currentProductCategories, ["heat_protectant"])
})

test("I4 + I5 on the real door: air_dry next to a dryer is stored, and a tools edit keeps it", async (t) => {
  const pg = await mobileFactsDatabase(t, { lock: false })
  await seedRow(pg)
  for (const step of [
    { styling_tools: ["blow_dryer", "flat_iron"] },
    { heat_styling: "several_weekly" },
    { drying_method: "air_dry" },
  ]) {
    await saveOnboardingCare(deps(pg), OWNER, values(step))
  }
  // I5: the air_dry answer derives the same column (the dryer wins the pick) and is still stored.
  assert.deepEqual((await careDocument(pg)).dryingRoutes, ["air_dry", "ordinary_blow_dry"])
  assert.equal((await careColumns(pg)).drying_method, "blow_dry")

  // I4: dropping the flat iron keeps the route the tool list cannot express.
  await saveOnboardingCare(deps(pg), OWNER, values({ styling_tools: ["blow_dryer"] }))
  const document = await careDocument(pg)
  assert.deepEqual(document.dryingRoutes, ["air_dry", "ordinary_blow_dry"])
  assert.deepEqual(document.additionalHeatTools, [])
  assert.deepEqual((await careColumns(pg)).styling_tools, ["blow_dryer"])

  // A true no-op still writes nothing.
  const before = (await readRow(pg, OWNER))!.facts_revision
  await saveOnboardingCare(deps(pg), OWNER, values({ styling_tools: ["blow_dryer"] }))
  assert.equal((await readRow(pg, OWNER))!.facts_revision, before)
})
