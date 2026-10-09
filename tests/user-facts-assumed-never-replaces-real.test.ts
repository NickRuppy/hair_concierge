import assert from "node:assert/strict"
import test from "node:test"

import {
  id,
  insertProfile,
  migratedPersonalPlanDatabase,
  readHairProfile,
  saveUserFacts,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"
import { simulateUserFactsSave } from "./user-facts-save-rpc.fixtures"
import { buildDirectAcceptanceStage2Defaults } from "../src/lib/personal-plan/direct-acceptance/defaults"
import type { Stage2TriggerContext } from "../src/lib/personal-plan/refinement/types"
import { toCareHabitsPatch, toFieldProvenance } from "../src/lib/user-facts/from-refinement-draft"
import { knownCareAnswers } from "../src/lib/user-facts/known-care-answers"

/**
 * `user_facts_save_v1` care_habits precedence (migration 20261006180000), run against the REAL
 * migration chain on PGlite: an `assumed` field only fills a gap — it never replaces a stored
 * `user` / `unknown_historical` (or provenance-less) answer. Regression for the 2026-10-05
 * rebase that overwrote a legacy member's real towel/drying answers with the Stage-2 defaults.
 */

const USER = id(1, 1)

const LEGACY_PROVENANCE = {
  source: { kind: "legacy_columns" },
  schemaVersion: 1,
  at: "2026-10-01T08:00:00.000Z",
}

const FEINSCHLIFF_PROVENANCE = {
  source: { kind: "feinschliff_draft", id: "draft-1" },
  schemaVersion: 1,
  at: "2026-10-05T08:31:55.000Z",
}

const ASSUMED_DEFAULTS = {
  towel: { material: "mikrofaser", technique: "gentle_press" },
  dryingRoutes: ["air_dry"],
  nightProtection: [],
  additionalHeatTools: [],
  wetWashFrequency: "weekly_2x",
}

const ALL_ASSUMED = {
  towel: "assumed",
  dryingRoutes: "assumed",
  nightProtection: "assumed",
  additionalHeatTools: "assumed",
  wetWashFrequency: "assumed",
}

async function legacyMember(t: {
  after: (fn: () => Promise<void>) => void
}): Promise<PersonalPlanTestDb> {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER)
  const result = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: {
      towel: { material: "frottee", technique: "rough_rubbing" },
      dryingRoutes: ["ordinary_blow_dry"],
      nightProtection: ["silk_satin_pillow"],
    },
    provenance: {
      ...LEGACY_PROVENANCE,
      fields: {
        towel: "unknown_historical",
        dryingRoutes: "unknown_historical",
        nightProtection: "unknown_historical",
      },
    },
  })
  assert.equal(result.status, "ok")
  return pg
}

test("an assumed write keeps every stored real answer and fills only the gaps", async (t) => {
  const pg = await legacyMember(t)

  const result = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: ASSUMED_DEFAULTS,
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: ALL_ASSUMED },
  })
  assert.equal(result.status, "ok")

  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  assert.deepEqual(row.care_habits, {
    towel: { material: "frottee", technique: "rough_rubbing" },
    dryingRoutes: ["ordinary_blow_dry"],
    nightProtection: ["silk_satin_pillow"],
    additionalHeatTools: [],
    wetWashFrequency: "weekly_2x",
  })
  assert.deepEqual(
    (row.facts_provenance as Record<string, { fields: unknown }>).care_habits.fields,
    {
      towel: "unknown_historical",
      dryingRoutes: "unknown_historical",
      nightProtection: "unknown_historical",
      additionalHeatTools: "assumed",
      wetWashFrequency: "assumed",
    },
  )
  // The derived legacy columns follow the kept answers, not the assumptions.
  assert.equal(row.towel_material, "frottee")
  assert.equal(row.towel_technique, "rough_rubbing")
  assert.equal(row.drying_method, "blow_dry")
  assert.deepEqual(row.night_protection, ["silk_satin_pillow"])
})

test("an assumed write never replaces a user answer either", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { towel: { material: "tshirt", technique: "gentle_press" } },
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: { towel: "user" } },
  })

  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { towel: { material: "mikrofaser", technique: "gentle_press" } },
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: { towel: "assumed" } },
  })

  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  assert.deepEqual((row.care_habits as Record<string, unknown>).towel, {
    material: "tshirt",
    technique: "gentle_press",
  })
})

test("a stored answer without a provenance entry counts as real", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["ordinary_blow_dry"] },
    provenance: LEGACY_PROVENANCE,
  })

  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["air_dry"] },
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: { dryingRoutes: "assumed" } },
  })

  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  assert.deepEqual((row.care_habits as Record<string, unknown>).dryingRoutes, ["ordinary_blow_dry"])
})

test("an assumption still replaces an earlier assumption, and a user answer replaces anything", async (t) => {
  const pg = await legacyMember(t)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { wetWashFrequency: "weekly_2x" },
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: { wetWashFrequency: "assumed" } },
  })

  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { wetWashFrequency: "weekly_1x" },
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: { wetWashFrequency: "assumed" } },
  })
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { towel: { material: "mikrofaser", technique: "gentle_press" } },
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: { towel: "user" } },
  })

  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  const careHabits = row.care_habits as Record<string, unknown>
  assert.equal(careHabits.wetWashFrequency, "weekly_1x")
  assert.deepEqual(careHabits.towel, { material: "mikrofaser", technique: "gentle_press" })
  const fields = (row.facts_provenance as Record<string, { fields: Record<string, string> }>)
    .care_habits.fields
  assert.equal(fields.wetWashFrequency, "assumed")
  assert.equal(fields.towel, "user")
})

test("an assumed clear cannot erase a real answer; a user clear can", async (t) => {
  const pg = await legacyMember(t)

  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { nightProtection: null },
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: { nightProtection: "assumed" } },
  })
  let row = await readHairProfile(pg, USER)
  assert.ok(row)
  assert.deepEqual((row.care_habits as Record<string, unknown>).nightProtection, [
    "silk_satin_pillow",
  ])

  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { nightProtection: null },
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: { nightProtection: "user" } },
  })
  row = await readHairProfile(pg, USER)
  assert.ok(row)
  assert.equal("nightProtection" in (row.care_habits as Record<string, unknown>), false)
})

test("diagnostics keep the existing latest-write-wins merge (account-link ruling)", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER)
  const provenance = {
    source: { kind: "personal_plan_artifact", id: "artifact-1" },
    schemaVersion: 1,
    at: "2026-09-15T10:00:00.000Z",
  }
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { density: "high" },
    provenance: { ...provenance, fields: { density: "user" } },
  })

  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { density: "medium" },
    provenance: { ...provenance, fields: { density: "assumed" } },
  })

  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  assert.equal((row.diagnostics as Record<string, unknown>).density, "medium")
})

test("the in-memory stand-in applies the same precedence as the SQL function", async (t) => {
  const pg = await legacyMember(t)
  const assumedWrite = {
    patch: ASSUMED_DEFAULTS,
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: ALL_ASSUMED },
  }
  await saveUserFacts(pg, { userId: USER, domain: "care_habits", ...assumedWrite })
  const sqlRow = await readHairProfile(pg, USER)
  assert.ok(sqlRow)

  const rows: Record<string, unknown>[] = []
  simulateUserFactsSave(rows, {
    p_user_id: USER,
    p_domain: "care_habits",
    p_mode: "upsert",
    p_patch: {
      towel: { material: "frottee", technique: "rough_rubbing" },
      dryingRoutes: ["ordinary_blow_dry"],
      nightProtection: ["silk_satin_pillow"],
    },
    p_provenance: {
      ...LEGACY_PROVENANCE,
      fields: {
        towel: "unknown_historical",
        dryingRoutes: "unknown_historical",
        nightProtection: "unknown_historical",
      },
    },
  })
  simulateUserFactsSave(rows, {
    p_user_id: USER,
    p_domain: "care_habits",
    p_mode: "upsert",
    p_patch: assumedWrite.patch,
    p_provenance: assumedWrite.provenance,
  })

  assert.deepEqual(rows[0].care_habits, sqlRow.care_habits)
  assert.deepEqual(
    (rows[0].facts_provenance as Record<string, unknown>).care_habits,
    (sqlRow.facts_provenance as Record<string, unknown>).care_habits,
  )
})

/** What direct acceptance publishes: the assumed fields only (accept.ts `onlyAssumedFacts`). */
function assumedOnlyWrite(defaults: ReturnType<typeof buildDirectAcceptanceStage2Defaults>) {
  const fields = toFieldProvenance({
    completedQuestionIds: defaults.completedQuestionIds,
    answerProvenance: defaults.answerProvenance,
    answers: defaults.answers,
  })
  const assumed = Object.keys(fields).filter((key) => fields[key] === "assumed")
  const patch = toCareHabitsPatch(defaults.answers) as Record<string, unknown>
  return {
    patch: Object.fromEntries(assumed.map((key) => [key, patch[key]])),
    fields: Object.fromEntries(assumed.map((key) => [key, "assumed"])),
  }
}

const LEGACY_CARE = {
  towel: { material: "frottee", technique: "rough_rubbing" },
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: [],
  nightProtection: ["silk_satin_pillow"],
  heatEvents: { "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" } },
  currentProductCategories: ["heat_protectant"],
}

const LEGACY_FIELDS = Object.fromEntries(
  Object.keys(LEGACY_CARE).map((key) => [key, "unknown_historical"]),
)

const TRIGGER_CONTEXT: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "conditioner"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
}

async function loadKnown(pg: PersonalPlanTestDb) {
  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  return knownCareAnswers({
    careHabits: row.care_habits as never,
    fields: (row.facts_provenance as { care_habits?: { fields?: never } }).care_habits?.fields,
  })
}

test("direct-accept defaults → assumed-only write → reload: real answers and their provenance survive", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: LEGACY_CARE,
    provenance: { ...LEGACY_PROVENANCE, fields: LEGACY_FIELDS },
  })

  const first = buildDirectAcceptanceStage2Defaults(TRIGGER_CONTEXT, await loadKnown(pg))
  assert.equal(first.answerProvenance.towel_handling, "user")
  const write = assumedOnlyWrite(first)
  const result = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: write.patch,
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: write.fields },
  })
  assert.equal(result.status, "ok")

  const after = await readHairProfile(pg, USER)
  assert.ok(after)
  const stored = after.care_habits as Record<string, unknown>
  for (const [field, value] of Object.entries(LEGACY_CARE)) {
    assert.deepEqual(stored[field], value, field)
  }
  const fields = (after.facts_provenance as { care_habits: { fields: Record<string, string> } })
    .care_habits.fields
  // Kept answers keep their honest historical provenance; only gaps were filled.
  assert.equal(fields.towel, "unknown_historical")
  assert.equal(fields.wetWashFrequency, "assumed")
  assert.equal(after.towel_material, "frottee")
  assert.equal(after.drying_method, "blow_dry")
})

test("an edit made between reading the facts and the accept's write survives", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: LEGACY_CARE,
    provenance: { ...LEGACY_PROVENANCE, fields: LEGACY_FIELDS },
  })
  const defaults = buildDirectAcceptanceStage2Defaults(TRIGGER_CONTEXT, await loadKnown(pg))

  // She changes her towel in the profile while the accept is running.
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { towel: { material: "tshirt", technique: "gentle_press" } },
    provenance: {
      source: { kind: "profile_editor" },
      schemaVersion: 1,
      at: "2026-10-06T12:00:00.000Z",
      fields: { towel: "user" },
    },
  })
  const write = assumedOnlyWrite(defaults)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: write.patch,
    provenance: { ...FEINSCHLIFF_PROVENANCE, fields: write.fields },
  })

  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  assert.deepEqual((row.care_habits as Record<string, unknown>).towel, {
    material: "tshirt",
    technique: "gentle_press",
  })
})
