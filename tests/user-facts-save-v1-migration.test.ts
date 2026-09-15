import assert from "node:assert/strict"
import test from "node:test"

import {
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
 * Executable contract for `public.user_facts_save_v1` (central user profile PR1,
 * migration 20260915120200), run against the REAL migration chain on PGlite.
 *
 * Everything asserted here is a literal: the derived legacy columns are written
 * out by hand from the vocabulary tables rather than recomputed in the test, so
 * a silent change on either side of the SQL/TypeScript boundary fails loudly.
 * The differential guard against `src/lib/user-facts/derive-legacy-columns.ts`
 * lives in `user-facts-derive-parity.test.ts`.
 *
 * NOT covered here (no Docker / no local Supabase in this environment): the
 * two-session race lane — interleaved diagnostics/habits saves on two
 * connections and stale-revision rejection under `FOR UPDATE`. PGlite is a
 * single-connection engine, so those are a documented manual recipe in
 * `.superpowers/sdd/2026-09-15-care-habits-source-of-truth/task-3-report.md`.
 */

const USER = id(1, 1)

const DIAGNOSTICS_SOURCE = {
  kind: "personal_plan_v3",
  version: 3,
  leadId: "lead-1",
  raw: { kind: "personal_plan", version: 3, answers: {} },
}

/** A complete v3-native diagnostics document, every field answered. */
const FULL_DIAGNOSTICS = {
  texture: "wavy",
  thickness: "fine",
  density: "medium",
  hairLength: "long",
  hairSurface: "slightly_uneven",
  elasticResponse: "stretches_stays",
  chemicalTreatments: ["lightened"],
  scalpOiliness: "oily",
  scalpConcerns: ["dry_dandruff", "irritated"],
  goals: ["volume_balance"],
  currentConcerns: ["dry_lengths", "low_shine"],
  concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
  source: DIAGNOSTICS_SOURCE,
}

const DIAGNOSTICS_PROVENANCE = {
  source: { kind: "personal_plan_artifact", id: "artifact-1" },
  schemaVersion: 1,
  at: "2026-09-15T10:00:00.000Z",
}

const CARE_HABITS_PROVENANCE = {
  source: { kind: "feinschliff_draft", id: "draft-1" },
  schemaVersion: 1,
  at: "2026-09-15T11:00:00.000Z",
}

const QUIZ_CONTEXT_PROVENANCE = {
  source: { kind: "personal_plan_artifact", id: "artifact-1" },
  schemaVersion: 1,
  at: "2026-09-15T12:00:00.000Z",
}

const HEX_64 = /^[0-9a-f]{64}$/

async function freshDatabase(t: {
  after: (fn: () => Promise<void>) => void
}): Promise<PersonalPlanTestDb> {
  const pg = await migratedPersonalPlanDatabase(t)
  await insertProfile(pg, USER)
  return pg
}

// ---------------------------------------------------------------------------
// 1. Insert path
// ---------------------------------------------------------------------------

test("inserts the profile row, stores the domain verbatim and derives every diagnostics column", async (t) => {
  const pg = await freshDatabase(t)

  const result = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: DIAGNOSTICS_PROVENANCE,
  })

  assert.equal(result.status, "ok")
  assert.equal(result.revision, 1)
  assert.equal(result.changed, true)
  assert.match(result.diagnosticsHash ?? "", HEX_64)

  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  assert.deepEqual(row.diagnostics, FULL_DIAGNOSTICS)
  assert.equal(row.care_habits, null)
  assert.equal(row.quiz_context, null)
  assert.deepEqual(row.facts_provenance, { diagnostics: DIAGNOSTICS_PROVENANCE })
  assert.equal(row.facts_revision, 1)

  assert.equal(row.hair_texture, "wavy")
  assert.equal(row.thickness, "fine")
  assert.equal(row.density, "medium")
  assert.equal(row.hair_length, "long")
  assert.equal(row.cuticle_condition, "slightly_rough")
  assert.equal(row.protein_moisture_balance, "stretches_stays")
  assert.equal(row.scalp_type, "oily")
  assert.equal(row.scalp_condition, "irritated")
  assert.deepEqual(row.chemical_treatment, ["bleached"])
  assert.deepEqual(row.concerns, ["dryness"])
  assert.deepEqual(row.goals, ["volume"])
  assert.equal(row.desired_volume, "more")

  // No care-habits write happened: the habits columns keep their table defaults.
  assert.equal(row.drying_method, null)
  assert.equal(row.heat_styling, null)
  assert.equal(row.styling_tools, null)
  assert.equal(row.uses_heat_protection, false)
})

// ---------------------------------------------------------------------------
// 2. Field-level merge
// ---------------------------------------------------------------------------

test("a patch replaces only the fields it names, and the revision counts writes rather than diffs", async (t) => {
  const pg = await freshDatabase(t)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: DIAGNOSTICS_PROVENANCE,
  })

  const second = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "curly" },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(second.status, "ok")
  assert.equal(second.revision, 2)
  assert.equal(second.changed, true)

  const merged = await readHairProfile(pg, USER)
  assert.ok(merged)
  assert.deepEqual(merged.diagnostics, { ...FULL_DIAGNOSTICS, texture: "curly" })
  assert.equal(merged.hair_texture, "curly")
  assert.equal(merged.thickness, "fine")
  assert.deepEqual(merged.concerns, ["dryness"])

  const third = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "curly" },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(third.status, "ok")
  assert.equal(third.revision, 3)
  assert.equal(third.changed, false)
})

// ---------------------------------------------------------------------------
// 3. Null clears
// ---------------------------------------------------------------------------

test("a JSON null in the patch removes that key; an empty array is a real answer", async (t) => {
  const pg = await freshDatabase(t)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: DIAGNOSTICS_PROVENANCE,
  })

  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { concernRecurrence: null },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  const cleared = await readHairProfile(pg, USER)
  assert.ok(cleared)
  assert.equal("concernRecurrence" in cleared.diagnostics!, false)
  assert.equal(cleared.diagnostics!.texture, "wavy")

  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { scalpConcerns: [], goals: [] },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  const emptied = await readHairProfile(pg, USER)
  assert.ok(emptied)
  assert.deepEqual(emptied.diagnostics!.scalpConcerns, [])
  assert.equal(emptied.scalp_condition, null)
  assert.deepEqual(emptied.goals, [])
  assert.equal(emptied.desired_volume, null)

  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { towel: { material: "mikrofaser", technique: "gentle_press" } },
    provenance: CARE_HABITS_PROVENANCE,
  })
  const withTowel = await readHairProfile(pg, USER)
  assert.equal(withTowel?.towel_material, "mikrofaser")
  assert.equal(withTowel?.towel_technique, "gentle_press")

  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { towel: null },
    provenance: CARE_HABITS_PROVENANCE,
  })
  const withoutTowel = await readHairProfile(pg, USER)
  assert.ok(withoutTowel)
  assert.equal("towel" in withoutTowel.care_habits!, false)
  assert.equal(withoutTowel.towel_material, null)
  assert.equal(withoutTowel.towel_technique, null)
})

test("only TOP-LEVEL nulls clear: the verbatim source envelope keeps its own nulls", async (t) => {
  const pg = await freshDatabase(t)
  // `diagnostics.source.raw` is the quiz envelope stored verbatim (task 1). A
  // recursive strip (jsonb_strip_nulls) would silently rewrite it, so the merge
  // only ever deletes keys the PATCH names with a null.
  const withNullsInRaw = {
    ...FULL_DIAGNOSTICS,
    source: {
      ...DIAGNOSTICS_SOURCE,
      raw: { kind: "personal_plan", version: 3, answers: { blockersOtherText: null } },
    },
  }
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: withNullsInRaw,
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { concernRecurrence: null },
    provenance: DIAGNOSTICS_PROVENANCE,
  })

  const { concernRecurrence: _cleared, ...expected } = withNullsInRaw
  const row = await readHairProfile(pg, USER)
  assert.deepEqual(row?.diagnostics, expected)
})

// ---------------------------------------------------------------------------
// 4. Domain ownership
// ---------------------------------------------------------------------------

test("a write recomputes only the columns owned by its own domain", async (t) => {
  const pg = await freshDatabase(t)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: DIAGNOSTICS_PROVENANCE,
  })

  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: {
      dryingRoutes: ["ordinary_blow_dry"],
      additionalHeatTools: ["straightener"],
      heatEvents: {
        "heat:ordinary_blow_dry": { frequency: "weekly_1x" },
        "heat:straightener": { frequency: "daily_1x", protectionConsistency: "always" },
      },
      nightProtection: ["silk_satin_bonnet"],
      brushesCombs: ["paddle", "wide_tooth_comb"],
    },
    provenance: CARE_HABITS_PROVENANCE,
  })

  const afterHabits = await readHairProfile(pg, USER)
  assert.ok(afterHabits)
  // Habits columns derived …
  assert.equal(afterHabits.drying_method, "blow_dry")
  assert.equal(afterHabits.heat_styling, "daily")
  assert.deepEqual(afterHabits.styling_tools, ["blow_dryer", "flat_iron"])
  assert.equal(afterHabits.uses_heat_protection, true)
  assert.deepEqual(afterHabits.night_protection, ["silk_satin_bonnet"])
  assert.deepEqual(afterHabits.brush_type, ["paddle", "wide_tooth_comb"])
  // … while every diagnostics column is untouched.
  assert.equal(afterHabits.hair_texture, "wavy")
  assert.equal(afterHabits.scalp_condition, "irritated")
  assert.deepEqual(afterHabits.goals, ["volume"])
  assert.equal(afterHabits.desired_volume, "more")

  await saveUserFacts(pg, {
    userId: USER,
    domain: "quiz_context",
    patch: { routineClarity: "partial", blockers: ["conflicting_tips"] },
    provenance: QUIZ_CONTEXT_PROVENANCE,
  })
  const afterContext = await readHairProfile(pg, USER)
  assert.ok(afterContext)
  assert.deepEqual(afterContext.quiz_context, {
    routineClarity: "partial",
    blockers: ["conflicting_tips"],
  })
  assert.equal(afterContext.facts_revision, 3)
  // quiz_context owns no projection: every derived column is exactly as the
  // habits write left it.
  const owned = [
    "hair_texture",
    "thickness",
    "density",
    "hair_length",
    "cuticle_condition",
    "protein_moisture_balance",
    "scalp_type",
    "scalp_condition",
    "chemical_treatment",
    "concerns",
    "goals",
    "desired_volume",
    "drying_method",
    "heat_styling",
    "styling_tools",
    "uses_heat_protection",
    "towel_material",
    "towel_technique",
    "night_protection",
    "brush_type",
  ] as const
  for (const column of owned) {
    assert.deepEqual(afterContext[column], afterHabits[column], column)
  }
})

test("a care_habits write leaves legacy diagnostics columns alone when diagnostics is still NULL", async (t) => {
  const pg = await freshDatabase(t)
  // A pre-migration onboarding row: narrow columns filled, no fact domains yet.
  await pg.query(
    `INSERT INTO public.hair_profiles (user_id, hair_texture, thickness, scalp_condition, goals, desired_volume)
     VALUES ($1, 'coily', 'coarse', 'dandruff', ARRAY['moisture']::text[], 'less')`,
    [USER],
  )

  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["air_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
  })

  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  assert.equal(row.diagnostics, null)
  assert.equal(row.hair_texture, "coily")
  assert.equal(row.thickness, "coarse")
  assert.equal(row.scalp_condition, "dandruff")
  assert.deepEqual(row.goals, ["moisture"])
  assert.equal(row.desired_volume, "less")
  assert.equal(row.drying_method, "air_dry")
  assert.equal(row.heat_styling, "never")
  assert.deepEqual(row.styling_tools, [])
})

// ---------------------------------------------------------------------------
// 5. Revision CAS
// ---------------------------------------------------------------------------

test("a stale expected revision is rejected without writing anything", async (t) => {
  const pg = await freshDatabase(t)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "curly" },
    provenance: DIAGNOSTICS_PROVENANCE,
  })

  const before = await readHairProfile(pg, USER)
  const conflict = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "coily" },
    provenance: DIAGNOSTICS_PROVENANCE,
    expectedRevision: 1,
  })
  assert.equal(conflict.status, "revision_conflict")
  assert.equal(conflict.revision, 2)
  assert.deepEqual(await readHairProfile(pg, USER), before)
})

test("a missing row counts as revision 0 for the CAS", async (t) => {
  const pg = await freshDatabase(t)
  const result = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: DIAGNOSTICS_PROVENANCE,
    expectedRevision: 0,
  })
  assert.equal(result.status, "ok")
  assert.equal(result.revision, 1)
  assert.equal((await readHairProfile(pg, USER))?.hair_texture, "wavy")
})

// ---------------------------------------------------------------------------
// 6. create_only (account linking)
// ---------------------------------------------------------------------------

test("create_only preserves existing diagnostics and records the candidate it did not apply", async (t) => {
  const pg = await freshDatabase(t)
  const initial = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: DIAGNOSTICS_PROVENANCE,
  })

  const linkProvenance = {
    source: { kind: "account_link", id: "artifact-2" },
    schemaVersion: 1,
    at: "2026-09-15T13:00:00.000Z",
    preservedCandidates: [{ kind: "artifact", id: "artifact-2", at: "2026-09-15T13:00:00.000Z" }],
  }

  const preserved = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "straight" },
    provenance: linkProvenance,
    mode: "create_only",
  })
  assert.equal(preserved.status, "preserved")
  assert.equal(preserved.revision, 1)
  assert.equal(preserved.changed, false)
  assert.equal(preserved.diagnosticsHash, initial.diagnosticsHash)

  const after = await readHairProfile(pg, USER)
  assert.ok(after)
  assert.deepEqual(after.diagnostics, FULL_DIAGNOSTICS)
  assert.equal(after.hair_texture, "wavy")
  assert.equal(after.facts_revision, 1)
  assert.deepEqual(after.facts_provenance, {
    diagnostics: {
      ...DIAGNOSTICS_PROVENANCE,
      preservedCandidates: linkProvenance.preservedCandidates,
    },
  })

  // Replaying the same link must not duplicate the candidate.
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "straight" },
    provenance: linkProvenance,
    mode: "create_only",
  })
  const replayed = await readHairProfile(pg, USER)
  assert.deepEqual(
    (replayed?.facts_provenance as { diagnostics: { preservedCandidates: unknown[] } }).diagnostics
      .preservedCandidates,
    linkProvenance.preservedCandidates,
  )
})

test("create_only writes normally when the domain is NULL and when there is no row at all", async (t) => {
  const pg = await freshDatabase(t)
  // (a) existing row, diagnostics NULL.
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["air_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
  })
  const onNullDomain = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: DIAGNOSTICS_PROVENANCE,
    mode: "create_only",
  })
  assert.equal(onNullDomain.status, "ok")
  assert.equal(onNullDomain.revision, 2)
  assert.equal((await readHairProfile(pg, USER))?.hair_texture, "wavy")

  // (b) no row at all.
  const otherUser = id(2, 2)
  await insertProfile(pg, otherUser)
  const onMissingRow = await saveUserFacts(pg, {
    userId: otherUser,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: DIAGNOSTICS_PROVENANCE,
    mode: "create_only",
  })
  assert.equal(onMissingRow.status, "ok")
  assert.equal(onMissingRow.revision, 1)
  assert.equal((await readHairProfile(pg, otherUser))?.hair_texture, "wavy")
})

test("create_only overwrites diagnostics whose source is the backfill's own legacy_columns", async (t) => {
  const pg = await freshDatabase(t)
  // What task 6's backfill writes for an onboarding-only user: facts rebuilt
  // from the narrow columns, with no quiz envelope behind them.
  const backfilled = {
    texture: "coily",
    thickness: "coarse",
    scalpOiliness: "dry",
    source: { kind: "legacy_columns", version: 1, leadId: "legacy-1", raw: {} },
  }
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: backfilled,
    provenance: {
      source: { kind: "legacy_columns" },
      schemaVersion: 1,
      at: "2026-09-14T08:00:00.000Z",
    },
  })

  const linked = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "wavy", source: DIAGNOSTICS_SOURCE },
    provenance: {
      ...DIAGNOSTICS_PROVENANCE,
      preservedCandidates: [{ kind: "artifact", id: "artifact-9", at: "2026-09-15T13:00:00.000Z" }],
    },
    mode: "create_only",
  })
  assert.equal(linked.status, "ok")
  assert.equal(linked.revision, 2)
  assert.equal(linked.changed, true)

  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  // Field-level merge still applies: `thickness` came only from the backfilled
  // document and survives the artifact write.
  assert.deepEqual(row.diagnostics, {
    texture: "wavy",
    thickness: "coarse",
    scalpOiliness: "dry",
    source: DIAGNOSTICS_SOURCE,
  })
  assert.equal(row.hair_texture, "wavy")
  assert.equal(row.thickness, "coarse")
  // A normal write: the link provenance replaces the backfill's, and the
  // candidate the caller passed is NOT recorded — this write applied its source
  // rather than preserving anything.
  assert.deepEqual(row.facts_provenance, { diagnostics: DIAGNOSTICS_PROVENANCE })
})

test("preservedCandidates is written only by the preserve path", async (t) => {
  const pg = await freshDatabase(t)
  const candidate = { kind: "artifact", id: "artifact-2", at: "2026-09-15T13:00:00.000Z" }

  // (a) A normal write that carries a candidate records nothing: the account-link
  // caller passes one unconditionally, and this write applied its own source.
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: { ...DIAGNOSTICS_PROVENANCE, preservedCandidates: [candidate] },
  })
  assert.deepEqual((await readHairProfile(pg, USER))?.facts_provenance, {
    diagnostics: DIAGNOSTICS_PROVENANCE,
  })

  // (b) A create_only link that really preserves records it.
  const preserved = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "straight" },
    provenance: {
      source: { kind: "account_link", id: "artifact-2" },
      schemaVersion: 1,
      at: "2026-09-15T13:00:00.000Z",
      preservedCandidates: [candidate],
    },
    mode: "create_only",
  })
  assert.equal(preserved.status, "preserved")
  assert.deepEqual((await readHairProfile(pg, USER))?.facts_provenance, {
    diagnostics: { ...DIAGNOSTICS_PROVENANCE, preservedCandidates: [candidate] },
  })

  // (c) A later normal write keeps that history instead of dropping it, and
  // still refuses to add its own candidate.
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "curly" },
    provenance: {
      source: { kind: "profile_editor" },
      schemaVersion: 1,
      at: "2026-09-16T09:00:00.000Z",
      preservedCandidates: [{ kind: "lead", id: "lead-9", at: "2026-09-16T09:00:00.000Z" }],
    },
  })
  assert.deepEqual((await readHairProfile(pg, USER))?.facts_provenance, {
    diagnostics: {
      source: { kind: "profile_editor" },
      schemaVersion: 1,
      at: "2026-09-16T09:00:00.000Z",
      preservedCandidates: [candidate],
    },
  })
})

test("create_only still preserves a non-null care_habits domain", async (t) => {
  const pg = await freshDatabase(t)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["air_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
  })
  const preserved = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["ordinary_blow_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
    mode: "create_only",
  })
  assert.equal(preserved.status, "preserved")
  assert.equal(preserved.revision, 1)
  assert.equal((await readHairProfile(pg, USER))?.drying_method, "air_dry")
})

// ---------------------------------------------------------------------------
// 7. Draft binding (F22)
// ---------------------------------------------------------------------------

type DraftFixture = { planId: string; initialVersionId: string; draftId: string }

async function withOpenDraft(pg: PersonalPlanTestDb): Promise<DraftFixture> {
  const initial = await createInitialNeed(pg, { userId: USER, inputHash: "a".repeat(64) })
  const draftId = id(3, 3)
  await insertOpenRefinementDraft(pg, {
    draftId,
    userId: USER,
    planId: initial.personalPlanId,
    baseInitialNeedVersionId: initial.needVersionId,
  })
  return {
    planId: initial.personalPlanId,
    initialVersionId: initial.needVersionId,
    draftId,
  }
}

test("a matching draft binding lets the facts write through", async (t) => {
  const pg = await freshDatabase(t)
  const draft = await withOpenDraft(pg)

  const result = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["air_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
    sourceDraftId: draft.draftId,
    expectedDraftRevision: 0,
    expectedInitialVersionId: draft.initialVersionId,
  })
  assert.equal(result.status, "ok")
  assert.equal(result.revision, 1)
  assert.equal((await readHairProfile(pg, USER))?.drying_method, "air_dry")
})

test("an unknown draft, a closed draft and a stale draft revision each reject the write", async (t) => {
  const pg = await freshDatabase(t)
  const draft = await withOpenDraft(pg)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["air_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
  })
  const before = await readHairProfile(pg, USER)

  const notFound = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["ordinary_blow_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
    sourceDraftId: id(9, 9),
    expectedDraftRevision: 0,
    expectedInitialVersionId: draft.initialVersionId,
  })
  assert.equal(notFound.status, "draft_conflict")
  assert.equal(notFound.reason, "not_found")

  const wrongRevision = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["ordinary_blow_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
    sourceDraftId: draft.draftId,
    expectedDraftRevision: 7,
    expectedInitialVersionId: draft.initialVersionId,
  })
  assert.equal(wrongRevision.status, "draft_conflict")
  assert.equal(wrongRevision.reason, "revision_mismatch")

  await pg.query("UPDATE public.personal_plan_refinement_drafts SET status='stale' WHERE id=$1", [
    draft.draftId,
  ])
  const notInProgress = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["ordinary_blow_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
    sourceDraftId: draft.draftId,
    expectedDraftRevision: 0,
    expectedInitialVersionId: draft.initialVersionId,
  })
  assert.equal(notInProgress.status, "draft_conflict")
  assert.equal(notInProgress.reason, "not_in_progress")

  assert.deepEqual(await readHairProfile(pg, USER), before)
})

test("a draft bound to a superseded Stage-1 version is rejected as a stale source", async (t) => {
  const pg = await freshDatabase(t)
  const first = await createInitialNeed(pg, { userId: USER, inputHash: "a".repeat(64) })
  const second = await createInitialNeed(pg, { userId: USER, inputHash: "b".repeat(64) })
  assert.notEqual(first.needVersionId, second.needVersionId)

  // An open draft still pointing at the FIRST initial version. Reached in
  // production when a Stage-1 recompute lands while a draft is being answered.
  const draftId = id(3, 3)
  await insertOpenRefinementDraft(pg, {
    draftId,
    userId: USER,
    planId: first.personalPlanId,
    baseInitialNeedVersionId: first.needVersionId,
  })

  const result = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["air_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
    sourceDraftId: draftId,
    expectedDraftRevision: 0,
    expectedInitialVersionId: first.needVersionId,
  })
  assert.equal(result.status, "draft_conflict")
  assert.equal(result.reason, "stale_source")
  assert.equal(await readHairProfile(pg, USER), null)
})

test("a late write from an older draft revision loses to the one that already landed", async (t) => {
  const pg = await freshDatabase(t)
  const draft = await withOpenDraft(pg)

  const early = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { ...FULL_DIAGNOSTICS, texture: "curly" },
    provenance: DIAGNOSTICS_PROVENANCE,
    sourceDraftId: draft.draftId,
    expectedDraftRevision: 0,
    expectedInitialVersionId: draft.initialVersionId,
  })
  assert.equal(early.status, "ok")

  // The user answers on: the draft advances to revision 1 and that newer write
  // lands.
  await pg.query("UPDATE public.personal_plan_refinement_drafts SET revision=1 WHERE id=$1", [
    draft.draftId,
  ])
  const newer = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "coily" },
    provenance: DIAGNOSTICS_PROVENANCE,
    sourceDraftId: draft.draftId,
    expectedDraftRevision: 1,
    expectedInitialVersionId: draft.initialVersionId,
  })
  assert.equal(newer.status, "ok")

  const late = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "straight" },
    provenance: DIAGNOSTICS_PROVENANCE,
    sourceDraftId: draft.draftId,
    expectedDraftRevision: 0,
    expectedInitialVersionId: draft.initialVersionId,
  })
  assert.equal(late.status, "draft_conflict")
  assert.equal(late.reason, "revision_mismatch")

  const row = await readHairProfile(pg, USER)
  assert.equal(row?.diagnostics!.texture, "coily")
  assert.equal(row?.hair_texture, "coily")
})

// ---------------------------------------------------------------------------
// 8. Provenance
// ---------------------------------------------------------------------------

test("per-field provenance accumulates across writes and cleared keys drop out", async (t) => {
  const pg = await freshDatabase(t)
  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: {
      ...DIAGNOSTICS_PROVENANCE,
      editedAt: "2026-09-15T10:00:00.000Z",
      fields: { texture: "user", thickness: "assumed", concernRecurrence: "user" },
    },
  })

  await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { thickness: "coarse", concernRecurrence: null },
    provenance: {
      source: { kind: "profile_editor" },
      schemaVersion: 1,
      at: "2026-09-16T09:00:00.000Z",
      editedAt: "2026-09-16T09:00:00.000Z",
      fields: { thickness: "user" },
    },
  })

  const row = await readHairProfile(pg, USER)
  assert.ok(row)
  assert.deepEqual(row.facts_provenance, {
    diagnostics: {
      source: { kind: "profile_editor" },
      schemaVersion: 1,
      at: "2026-09-16T09:00:00.000Z",
      editedAt: "2026-09-16T09:00:00.000Z",
      // `texture` survives from the first write, `thickness` is overwritten by
      // the second, `concernRecurrence` drops out with the field it described.
      fields: { texture: "user", thickness: "user" },
    },
  })
})

// ---------------------------------------------------------------------------
// 9. Invalid input
// ---------------------------------------------------------------------------

test("an unknown domain, a non-object patch or an unknown mode is rejected before any write", async (t) => {
  const pg = await freshDatabase(t)

  const badDomain = await saveUserFacts(pg, {
    userId: USER,
    domain: "hair_facts",
    patch: { texture: "wavy" },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(badDomain.status, "invalid_input")
  assert.equal(badDomain.reason, "unknown_domain")

  const arrayPatch = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: [{ texture: "wavy" }],
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(arrayPatch.status, "invalid_input")
  assert.equal(arrayPatch.reason, "patch_not_object")

  const arrayProvenance = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "wavy" },
    provenance: ["nope"],
  })
  assert.equal(arrayProvenance.status, "invalid_input")
  assert.equal(arrayProvenance.reason, "provenance_not_object")

  const badMode = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "wavy" },
    provenance: DIAGNOSTICS_PROVENANCE,
    mode: "x",
  })
  assert.equal(badMode.status, "invalid_input")
  assert.equal(badMode.reason, "unknown_mode")

  assert.equal(await readHairProfile(pg, USER), null)
})

// ---------------------------------------------------------------------------
// 10. Grants
// ---------------------------------------------------------------------------

test("only service_role may execute the write function", async (t) => {
  const pg = await freshDatabase(t)
  const signature = "public.user_facts_save_v1(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid)"
  const { rows } = await pg.query<{ role: string; allowed: boolean }>(
    `SELECT role, pg_catalog.has_function_privilege(role, $1, 'EXECUTE') AS allowed
       FROM pg_catalog.unnest(ARRAY['service_role','anon','authenticated']) AS role`,
    [signature],
  )
  assert.deepEqual(rows, [
    { role: "service_role", allowed: true },
    { role: "anon", allowed: false },
    { role: "authenticated", allowed: false },
  ])

  // The derivation helpers are internal: the SECURITY DEFINER function calls
  // them as the owner, so no application role needs EXECUTE on them.
  const helpers = await pg.query<{ signature: string; allowed: boolean }>(
    `SELECT signature, pg_catalog.has_function_privilege('service_role', signature, 'EXECUTE') AS allowed
       FROM pg_catalog.unnest(ARRAY[
         'public.user_facts_jsonb_text_array_v1(jsonb)',
         'public.user_facts_map_vocabulary_array_v1(jsonb,jsonb)',
         'public.user_facts_union_preserved_candidates_v1(jsonb,jsonb)',
         'public.user_facts_diagnostics_hash_v1(jsonb)',
         'public.user_facts_derive_diagnostics_columns_v1(jsonb)',
         'public.user_facts_derive_care_habits_columns_v1(jsonb)'
       ]) AS signature`,
  )
  assert.equal(helpers.rows.length, 6)
  assert.deepEqual(
    helpers.rows.filter((row) => row.allowed),
    [],
  )
})

// ---------------------------------------------------------------------------
// 11. diagnosticsHash
// ---------------------------------------------------------------------------

test("diagnosticsHash tracks the diagnostics document and nothing else", async (t) => {
  const pg = await freshDatabase(t)

  const habitsOnly = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["air_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
  })
  assert.equal(habitsOnly.diagnosticsHash, null)

  const first = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: FULL_DIAGNOSTICS,
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.match(first.diagnosticsHash ?? "", HEX_64)

  const changed = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "curly" },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.notEqual(changed.diagnosticsHash, first.diagnosticsHash)

  const acrossHabits = await saveUserFacts(pg, {
    userId: USER,
    domain: "care_habits",
    patch: { dryingRoutes: ["ordinary_blow_dry"] },
    provenance: CARE_HABITS_PROVENANCE,
  })
  assert.equal(acrossHabits.diagnosticsHash, changed.diagnosticsHash)

  const unchangedDiagnostics = await saveUserFacts(pg, {
    userId: USER,
    domain: "diagnostics",
    patch: { texture: "curly" },
    provenance: DIAGNOSTICS_PROVENANCE,
  })
  assert.equal(unchangedDiagnostics.changed, false)
  assert.equal(unchangedDiagnostics.diagnosticsHash, changed.diagnosticsHash)
})

// ---------------------------------------------------------------------------
// 12. Column comments
// ---------------------------------------------------------------------------

test("every derived legacy column documents its owner and its retirement condition", async (t) => {
  const pg = await freshDatabase(t)
  const diagnosticsColumns = [
    "hair_texture",
    "thickness",
    "density",
    "hair_length",
    "cuticle_condition",
    "protein_moisture_balance",
    "scalp_type",
    "scalp_condition",
    "chemical_treatment",
    "concerns",
    "goals",
    "desired_volume",
  ]
  const careHabitsColumns = [
    "drying_method",
    "heat_styling",
    "styling_tools",
    "uses_heat_protection",
    "towel_material",
    "towel_technique",
    "night_protection",
    "brush_type",
  ]
  const comment = (domain: string) =>
    `Derived projection owned by public.user_facts_save_v1 from hair_profiles.${domain}; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)`

  const { rows } = await pg.query<{ attname: string; description: string | null }>(
    `SELECT a.attname, pg_catalog.col_description(a.attrelid, a.attnum) AS description
       FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = 'public.hair_profiles'::pg_catalog.regclass
        AND a.attname = ANY($1::text[])`,
    [[...diagnosticsColumns, ...careHabitsColumns]],
  )
  const byColumn = new Map(rows.map((row) => [row.attname, row.description]))

  assert.equal(byColumn.size, 20)
  for (const column of diagnosticsColumns) {
    assert.equal(byColumn.get(column), comment("diagnostics"), column)
  }
  for (const column of careHabitsColumns) {
    assert.equal(byColumn.get(column), comment("care_habits"), column)
  }
})

// ---------------------------------------------------------------------------
// 13. personal_plans facts cursor + refinement draft origin
// ---------------------------------------------------------------------------

test("the plan facts cursor starts empty and the draft origin defaults to 'user'", async (t) => {
  const pg = await freshDatabase(t)
  const draft = await withOpenDraft(pg)

  const { rows } = await pg.query<{
    pending_facts_revision: number | null
    pending_facts_draft_id: string | null
    applied_facts_revision: number | null
  }>(
    `SELECT pending_facts_revision, pending_facts_draft_id, applied_facts_revision
       FROM public.personal_plans WHERE id = $1`,
    [draft.planId],
  )
  assert.deepEqual(rows, [
    {
      pending_facts_revision: null,
      pending_facts_draft_id: null,
      applied_facts_revision: null,
    },
  ])

  await pg.query(
    `UPDATE public.personal_plans
        SET pending_facts_revision = 4, pending_facts_draft_id = $2, applied_facts_revision = 2
      WHERE id = $1`,
    [draft.planId, draft.draftId],
  )
  const updated = await pg.query<{
    pending_facts_revision: number
    pending_facts_draft_id: string
    applied_facts_revision: number
  }>(
    `SELECT pending_facts_revision, pending_facts_draft_id, applied_facts_revision
       FROM public.personal_plans WHERE id = $1`,
    [draft.planId],
  )
  assert.deepEqual(updated.rows, [
    {
      pending_facts_revision: 4,
      pending_facts_draft_id: draft.draftId,
      applied_facts_revision: 2,
    },
  ])

  const origin = await pg.query<{ origin: string }>(
    "SELECT origin FROM public.personal_plan_refinement_drafts WHERE id = $1",
    [draft.draftId],
  )
  assert.deepEqual(origin.rows, [{ origin: "user" }])

  await pg.query(
    "UPDATE public.personal_plan_refinement_drafts SET origin='facts_rebase' WHERE id=$1",
    [draft.draftId],
  )
  await assert.rejects(
    pg.query("UPDATE public.personal_plan_refinement_drafts SET origin='other' WHERE id=$1", [
      draft.draftId,
    ]),
    /personal_plan_refinement_drafts_origin_check/,
  )
})
