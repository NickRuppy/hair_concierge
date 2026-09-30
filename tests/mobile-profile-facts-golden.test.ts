import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { saveMobileProfileEdit } from "../src/lib/mobile/profile-edit-service"
import {
  completeMobileProfile,
  completeMobileRegistration,
} from "../src/lib/mobile/registration-completion"
import type { ProfileEditRequest } from "../src/lib/mobile/profile-edit-contract"
import { projectQuizAnswersToLegacyVocabulary } from "../src/lib/quiz/normalization"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import type { QuizAnswers } from "../src/lib/quiz/types"
import {
  DIAGNOSTICS_COLUMNS,
  mobileFactsDatabase,
  pgliteRpcClient,
  readRow,
  registrationIntent,
} from "./mobile-profile-facts-pglite.fixtures"
import {
  legacyMissingProfilePatch,
  legacyMobileEditProfilePatch,
} from "./mobile-legacy-profile-patch.oracle"
import {
  id,
  insertProfile,
  saveUserFacts,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Golden tests, clean-switch tasks 3 + 4: for the existing iOS edit / registration fixtures, the columns
 * `user_facts_save_v1` derives on the real schema equal what the old direct write stored —
 * today's `legacyMobileEditProfilePatch(answers)` — except for these ENUMERATED exceptions, each
 * applied by exactly one rule below. Any other difference fails: it is a finding, not
 * something to adapt here.
 *
 *  E1 goal vocabulary (plan §3 migration table M, via `resolveVisibleDiagnosticGoals`): a legacy
 *     goal the quiz folded into a family derives as that family's column value.
 *  E2 `primary_concern`: the old patch never wrote it; the door derives it (explicit pick while
 *     it is a current concern, else her only concern, else NULL).
 *  E3 canonical array order: array columns are compared as sets.
 *  E4 `[]` instead of NULL for chemical_treatment / concerns / goals.
 */

const OWNER = id(1, 1)
const LEAD = id(2, 2)

const BASE: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  treatment: ["natur"],
  concerns: ["dryness"],
  goals: ["moisture"],
}

/** E1: legacy goal -> the column value its quiz family derives to (plan §3 table M). */
const MIGRATION_TABLE_M: Record<string, string> = {
  healthier_hair: "anti_breakage",
  strengthen: "anti_breakage",
  less_split_ends: "anti_breakage",
  color_protection: "shine",
}
const E4_ARRAY_COLUMNS = new Set(["chemical_treatment", "concerns", "goals"])

async function fixtureAnswers(): Promise<Array<[string, QuizAnswers]>> {
  const shared = JSON.parse(
    await readFile(new URL("./fixtures/mobile/profile-edit-v1.json", import.meta.url), "utf8"),
  ) as { answers: QuizAnswers }
  return [
    // tests/fixtures/mobile/profile-edit-v1.json == ios/ChaarlieTests/Fixtures/profile-edit-v1.json
    ["shared iOS fixture profile-edit-v1", shared.answers],
    // tests/mobile-profile-edit-contract.test.ts: every current diagnostic goal
    [
      "all eight quiz goals",
      {
        ...BASE,
        goals: [
          "moisture",
          "frizz_surface",
          "shine",
          "strength_ends",
          "scalp_balance",
          "manageability_styling",
          "shape_definition",
          "volume_balance",
        ],
      },
    ],
    // tests/mobile-profile-edit-publication.test.ts fixtures
    ["publication base answers", BASE],
    [
      "publication raw choices",
      {
        ...BASE,
        thickness: "coarse",
        concerns: ["low_shine"],
        goals: ["manageability_styling"],
        concerns_other_text: "Meine Spitzen",
      },
    ],
    ["scalp issue", { ...BASE, has_scalp_issue: true, scalp_condition: "gereizt" }],
    // tests/mobile-registration-publication-postgres.test.ts replace fixture
    ["registration replace", { ...BASE, thickness: "coarse" }],
    // Synthetic: exercises E1 (not an existing iOS fixture).
    ["E1 legacy goals", { ...BASE, goals: ["healthier_hair", "color_protection", "less_frizz"] }],
  ]
}

/** The columns today's direct write stored, with E1/E2/E4 applied as the only rewrites. */
function expectedColumns(
  answers: QuizAnswers,
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  const expected: Record<string, unknown> = {}
  for (const column of DIAGNOSTICS_COLUMNS) {
    let value = column in patch ? patch[column] : before[column]
    if (column === "goals" && Array.isArray(value)) {
      value = [...new Set(value.map((goal: string) => MIGRATION_TABLE_M[goal] ?? goal))] // E1
    }
    if (column === "primary_concern") {
      // E2: the door's rule, not the untouched old column.
      const concerns = projectQuizAnswersToLegacyVocabulary({ concerns: answers.concerns }).concerns
      value = concerns.length === 1 ? concerns[0] : null
    }
    if (E4_ARRAY_COLUMNS.has(column) && value === null) value = [] // E4
    expected[column] = value
  }
  return expected
}

function comparable(columns: Record<string, unknown>) {
  // E3: arrays as sorted sets.
  return Object.fromEntries(
    Object.entries(columns).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value].sort() : (value ?? null),
    ]),
  )
}

async function seed(pg: PersonalPlanTestDb) {
  await insertProfile(pg, OWNER)
  const seedAnswers: QuizAnswers = {
    ...BASE,
    structure: "straight",
    thickness: "normal",
    concerns: ["frizz", "tangling"],
    goals: ["shine"],
  }
  await pg.query(
    "insert into public.leads(id,user_id,quiz_kind,quiz_answers,status) values($1,$2,'legacy',$3,'linked')",
    [LEAD, OWNER, JSON.stringify(seedAnswers)],
  )
  await saveUserFacts(pg, {
    userId: OWNER,
    domain: "diagnostics",
    patch: projectLegacyLeadToFacts({ leadId: LEAD, quizAnswers: seedAnswers }).diagnostics,
    provenance: {
      source: { kind: "legacy_lead", id: LEAD },
      schemaVersion: 1,
      at: "2026-09-01T00:00:00.000Z",
    },
  })
}

test("golden (task 3): iOS edit fixtures derive today's columns up to E1-E4", async (t) => {
  for (const [name, answers] of await fixtureAnswers()) {
    const pg = await mobileFactsDatabase(t)
    await seed(pg)
    const client = pgliteRpcClient(pg)
    const before = (await readRow(pg, OWNER))!
    const read = (await client.rpc("scanner_context_read_source", { p_user_id: OWNER })).data as {
      profileRevision: string
    }
    await saveMobileProfileEdit(client as never, OWNER, {
      expectedProfileRevision: read.profileRevision,
      requestId: randomUUID(),
      answers: answers as ProfileEditRequest["answers"],
    })
    const row = (await readRow(pg, OWNER))!
    const actual = Object.fromEntries(DIAGNOSTICS_COLUMNS.map((column) => [column, row[column]]))
    assert.deepEqual(
      comparable(actual),
      comparable(expectedColumns(answers, before, legacyMobileEditProfilePatch(answers))),
      name,
    )
  }
})

// ---------------------------------------------------------------------------
// Task 4: registration create / replace / missing. Today's function wrote
// `legacyMobileEditProfilePatch(answers)` (create, replace) or the missing-only patch of
// `mergeMissingProfileAnswers` over the row; the same E1-E4 are the only allowed differences.
// ---------------------------------------------------------------------------

/** Registration answers the repo already uses: the registration tests' answers and replace
 * variant, and the iOS onboarding QA fixture (ios/Chaarlie/QA/OnboardingFixture.swift
 * `completedDraft`). Onboarding offers the quiz's own goal cards only (mobileEditQuestions({})). */
const REGISTRATION_FIXTURES: Array<[string, QuizAnswers]> = [
  ["registration answers", BASE],
  ["registration replace", { ...BASE, thickness: "coarse" }],
  ["iOS onboarding QA fixture", { ...BASE, fingertest: "glatt", concerns: [], goals: ["shine"] }],
  [
    "all eight quiz goals",
    {
      ...BASE,
      goals: [
        "moisture",
        "frizz_surface",
        "shine",
        "strength_ends",
        "scalp_balance",
        "manageability_styling",
        "shape_definition",
        "volume_balance",
      ],
    },
  ],
]

const TABLE_DEFAULTS: Record<string, unknown> = Object.fromEntries(
  DIAGNOSTICS_COLUMNS.map((column) => [column, E4_ARRAY_COLUMNS.has(column) ? [] : null]),
)

async function registration(
  pg: PersonalPlanTestDb,
  client: ReturnType<typeof pgliteRpcClient>,
  choice: "create" | "replace",
  answers: QuizAnswers,
) {
  const input = await registrationIntent(pg, client, OWNER, choice, answers as never)
  await completeMobileRegistration(client as never, OWNER, input.submission.email, input as never)
}

test("golden (task 4): registration create and replace derive today's columns up to E1-E4", async (t) => {
  for (const [name, answers] of REGISTRATION_FIXTURES) {
    const created = await mobileFactsDatabase(t)
    await insertProfile(created, OWNER)
    const createClient = pgliteRpcClient(created)
    await registration(created, createClient, "create", answers)
    const createdRow = (await readRow(created, OWNER))!
    assert.deepEqual(
      comparable(Object.fromEntries(DIAGNOSTICS_COLUMNS.map((c) => [c, createdRow[c]]))),
      comparable(expectedColumns(answers, TABLE_DEFAULTS, legacyMobileEditProfilePatch(answers))),
      `create: ${name}`,
    )

    const replaced = await mobileFactsDatabase(t)
    await insertProfile(replaced, OWNER)
    const replaceClient = pgliteRpcClient(replaced)
    await registration(replaced, replaceClient, "create", {
      ...BASE,
      structure: "curly",
      concerns: ["tangling", "breakage"],
      goals: ["shape_definition"],
    })
    const before = (await readRow(replaced, OWNER))!
    await registration(replaced, replaceClient, "replace", answers)
    const row = (await readRow(replaced, OWNER))!
    assert.deepEqual(
      comparable(Object.fromEntries(DIAGNOSTICS_COLUMNS.map((c) => [c, row[c]]))),
      comparable(expectedColumns(answers, before, legacyMobileEditProfilePatch(answers))),
      `replace: ${name}`,
    )
  }
})

test("golden (task 4): profile completion (missing) derives today's columns up to E1-E4", async (t) => {
  const cases: Array<[string, (pg: PersonalPlanTestDb) => Promise<void>, Partial<QuizAnswers>]> = [
    [
      "legacy row without facts, hair length missing",
      async (pg) => {
        await pg.query(
          `insert into hair_profiles(user_id,hair_texture,thickness,density,cuticle_condition,protein_moisture_balance,scalp_type,scalp_condition,chemical_treatment,concerns,goals) values($1,'wavy','fine','medium','rough','stretches_bounces','balanced',null,ARRAY['natural'],ARRAY['dryness'],ARRAY['moisture'])`,
          [OWNER],
        )
        await pg.query(
          "insert into public.leads(id,user_id,quiz_kind,quiz_answers,status) values($1,$2,'legacy',$3,'linked')",
          [LEAD, OWNER, JSON.stringify({ ...BASE, hair_length: undefined })],
        )
      },
      { hair_length: "short" },
    ],
    [
      "facts profile, hair length missing",
      async (pg) => {
        const quiz = { ...BASE, hair_length: undefined } as unknown as QuizAnswers
        await pg.query(
          "insert into public.leads(id,user_id,quiz_kind,quiz_answers,status) values($1,$2,'legacy',$3,'linked')",
          [LEAD, OWNER, JSON.stringify(quiz)],
        )
        await saveUserFacts(pg, {
          userId: OWNER,
          domain: "diagnostics",
          patch: projectLegacyLeadToFacts({ leadId: LEAD, quizAnswers: quiz }).diagnostics,
          provenance: {
            source: { kind: "legacy_lead", id: LEAD },
            schemaVersion: 1,
            at: "2026-09-01T00:00:00.000Z",
          },
        })
      },
      { hair_length: "very_long" },
    ],
  ]
  for (const [name, seedRow, submitted] of cases) {
    const pg = await mobileFactsDatabase(t)
    await insertProfile(pg, OWNER)
    await seedRow(pg)
    const client = pgliteRpcClient(pg)
    const read = (await client.rpc("scanner_context_read_source", { p_user_id: OWNER })).data as {
      profileRevision: string
      profile: Record<string, unknown>
    }
    const before = (await readRow(pg, OWNER))!
    const merged = legacyMissingProfilePatch(read.profile, submitted)
    await completeMobileProfile(client as never, OWNER, {
      requestId: randomUUID(),
      expectedProfileRevision: read.profileRevision,
      answers: submitted,
    })
    const row = (await readRow(pg, OWNER))!
    const expected = expectedColumns(merged.answers, before, merged.patch)
    // E2 for a row whose pick nobody touched: the door's rule over the merged answers applies
    // either way (the old column was untouched: NULL here).
    assert.deepEqual(
      comparable(Object.fromEntries(DIAGNOSTICS_COLUMNS.map((c) => [c, row[c]]))),
      comparable(expected),
      name,
    )
  }
})
