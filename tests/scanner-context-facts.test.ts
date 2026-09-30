import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildLegacyQuizStage1Source } from "../src/lib/personal-plan/input"
import { buildMobileHandEditFacts } from "../src/lib/mobile/profile-facts-patch"
import { profileEditRequestSchema } from "../src/lib/mobile/profile-edit-contract"
import type { QuizAnswers } from "../src/lib/quiz/types"
import { publishProfileEdit } from "../src/lib/scan/profile-edit"
import {
  editableScannerQuizAnswers,
  prepareScannerContext,
  scannerSourceHash,
  type ScannerSourceRead,
} from "../src/lib/scan/scanner-context"
import { projectArtifactToFacts } from "../src/lib/user-facts/project-artifact"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import { parseUserFactsRow } from "../src/lib/user-facts/read"
import type { DiagnosticsV1 } from "../src/lib/user-facts/schema"
import {
  PAID_VARIANTS,
  backfilledRow,
  envelope,
  factsRow,
  mainEraColumns,
  paidRead,
  publishHarness,
  type Envelope,
} from "./scanner-context-facts.fixtures"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * Clean switch — the scanner decides on the FACTS when the profile has a diagnostics document
 * (branch-blocking regression: door-derived columns no longer carry the offer adapter's inferred
 * goals, so a backfilled paid buyer looked "incompatible" and the lossy rebase ran).
 */

const NOW = "2026-10-01T10:00:00.000Z"
const sorted = (values: readonly string[] | undefined) => [...(values ?? [])].sort()

function facts(env: unknown): DiagnosticsV1 {
  return projectArtifactToFacts({ envelope: env, artifactId: "a", leadId: "l" }).diagnostics
}

function request(quizAnswers: QuizAnswers, expectedProfileRevision = "1") {
  return {
    expectedProfileRevision,
    requestId: "33333333-3333-4333-8333-333333333333",
    quizAnswers,
    saveAsFacts: true as const,
  }
}

/** What the iOS client sends back: its `QuizAnswers` struct has no `primary_concern`. */
function iosEcho(answers: QuizAnswers): QuizAnswers {
  const echoed = JSON.parse(JSON.stringify(answers)) as QuizAnswers
  delete echoed.primary_concern
  return echoed
}

/** The fields of her paid answers a rebase must never lose. */
function assertKeepsPaidAnswers(
  answers: Record<string, unknown>,
  env: Envelope,
  label: string,
  except: string[] = [],
) {
  const paid = env.answers as Record<string, unknown>
  for (const field of ["goals", "currentConcerns", "scalpConcerns", "chemicalTreatments"]) {
    if (except.includes(field)) continue
    assert.deepEqual(
      sorted(answers[field] as string[]),
      sorted(paid[field] as string[]),
      `${label} ${field}`,
    )
  }
  for (const field of ["concernRecurrence", "primaryConcern", "texture", "thickness", "density"]) {
    if (except.includes(field)) continue
    assert.deepEqual(answers[field] ?? null, paid[field] ?? null, `${label} ${field}`)
  }
}

for (const [name, env] of Object.entries(PAID_VARIANTS)) {
  test(`${name}: a backfilled paid buyer keeps her paid source verbatim`, () => {
    const prepared = prepareScannerContext(paidRead(env, backfilledRow(env)))
    assert.ok(prepared, "context")
    assert.equal(scannerSourceHash(prepared.source), scannerSourceHash(env))
    assert.equal(prepared.snapshotSource, "initial")
    assert.deepEqual(prepared.rejectedPaidSources, [])
  })

  test(`${name}: the iOS prefill round-trips — submitted unchanged it is no edit`, async () => {
    const row = backfilledRow(env)
    const read = paidRead(env, row)
    const prefill = editableScannerQuizAnswers(read)
    const parsed = profileEditRequestSchema.safeParse({
      expectedProfileRevision: "1",
      requestId: "33333333-3333-4333-8333-333333333333",
      answers: iosEcho(prefill),
    })
    assert.ok(
      parsed.success,
      `the iOS edit contract accepts the prefill: ${JSON.stringify(parsed.error?.issues)}`,
    )
    for (const answers of [prefill, iosEcho(prefill)]) {
      const write = buildMobileHandEditFacts({
        answers,
        stored: parseUserFactsRow("owner", row),
        now: NOW,
      })
      assert.equal(write.unchanged, true, JSON.stringify(write.diagnostics.patch))
    }

    const db = publishHarness(read)
    const saved = await publishProfileEdit(db as never, "owner", request(iosEcho(prefill)))
    const publication = db.published[0]
    assert.deepEqual(publication.p_facts.diagnostics.patch, {})
    assert.equal(publication.p_facts.diagnostics.provenance.editedAt, undefined)
    assert.equal(scannerSourceHash(saved.prepared.source), scannerSourceHash(env))
    const reread = prepareScannerContext(db.read)
    assert.equal(reread?.sourceHash, saved.prepared.sourceHash, "the next read republishes nothing")
    // A paid source bound to the current revision is eligible again: it matches the facts.
    const bound = prepareScannerContext({
      ...db.read,
      paidBindings: { initial: db.read.profileRevision },
    })
    assert.deepEqual(bound?.rejectedPaidSources, [])
    assert.equal(scannerSourceHash(bound!.source), scannerSourceHash(env))
  })

  test(`${name}: an iOS edit of one field keeps every other paid answer`, async () => {
    const db = publishHarness(paidRead(env, backfilledRow(env)))
    const prefill = editableScannerQuizAnswers(db.read)
    const saved = await publishProfileEdit(
      db as never,
      "owner",
      request({
        ...iosEcho(prefill),
        hair_length: prefill.hair_length === "long" ? "medium" : "long",
      }),
    )
    const answers = saved.prepared.source.answers as Record<string, unknown>
    assert.equal(answers.hairLength, prefill.hair_length === "long" ? "medium" : "long")
    assertKeepsPaidAnswers(answers, env, "published source")
    const stored = parseUserFactsRow("owner", db.read.profile!).diagnostics!
    assertKeepsPaidAnswers(stored as Record<string, unknown>, env, "stored facts")

    const reread = prepareScannerContext(db.read)
    assert.ok(reread, "context after the edit")
    assert.equal(reread.sourceHash, saved.prepared.sourceHash, "publish and read agree")
    // The new prefill still round-trips.
    const again = buildMobileHandEditFacts({
      answers: iosEcho(editableScannerQuizAnswers(db.read)),
      stored: parseUserFactsRow("owner", db.read.profile!),
      now: NOW,
    })
    assert.equal(again.unchanged, true)
  })
}

test("multiple scalp concerns survive an unrelated iOS edit and a scalp-type change", async () => {
  const env = PAID_VARIANTS.V14_multi_scalp_concerns
  const db = publishHarness(paidRead(env, backfilledRow(env)))
  const prefill = iosEcho(editableScannerQuizAnswers(db.read))
  assert.equal(prefill.scalp_condition, "gereizt", "the iOS format carries one scalp condition")
  await publishProfileEdit(db as never, "owner", request({ ...prefill, scalp_type: "trocken" }))
  const stored = parseUserFactsRow("owner", db.read.profile!).diagnostics!
  assert.equal(stored.scalpOiliness, "dry")
  assert.deepEqual(sorted(stored.scalpConcerns), ["irritated", "oily_dandruff"])

  // A real change of the condition is written.
  await publishProfileEdit(
    db as never,
    "owner",
    request(
      { ...iosEcho(editableScannerQuizAnswers(db.read)), scalp_condition: "schuppen" },
      db.read.profileRevision,
    ),
  )
  assert.deepEqual(parseUserFactsRow("owner", db.read.profile!).diagnostics!.scalpConcerns, [
    "oily_dandruff",
  ])
})

test("facts newer than the paid source: rebuilt from the facts, keeping the paid quiz context", () => {
  const paid = PAID_VARIANTS.V3_two_concerns_pick
  const newer = envelope({
    thickness: "coarse",
    goals: ["volume_balance", "manageability_styling"],
    currentConcerns: ["frizz_flyaways", "low_shine", "tangling", "lost_shape"],
    primaryConcern: "low_shine",
    concernRecurrence: { concernId: "low_shine", frequency: "sometimes" },
    scalpConcerns: ["dry_dandruff", "irritated"],
    routineStyle: "flexible_versatile",
  })
  const prepared = prepareScannerContext(paidRead(paid, backfilledRow(newer)))
  assert.ok(prepared)
  const answers = prepared.source.answers as Record<string, unknown>
  assertKeepsPaidAnswers(answers, newer, "rebased")
  assert.equal(answers.routineStyle, paid.answers.routineStyle, "quiz context stays the paid one")
  assert.equal(prepared.source.kind, "personal_plan")
})

test("an assumed hair length never makes a paid source incompatible nor replaces its answer", () => {
  const env = envelope({ hairLength: "short" })
  const assumed = { ...facts(env), hairLength: "long" as const }
  const compatible = prepareScannerContext(
    paidRead(env, factsRow(assumed, { fields: { hairLength: "assumed" } })),
  )
  assert.equal(scannerSourceHash(compatible!.source), scannerSourceHash(env))

  const rebased = prepareScannerContext(
    paidRead(
      env,
      factsRow({ ...assumed, thickness: "coarse" }, { fields: { hairLength: "assumed" } }),
    ),
  )
  assert.equal(rebased?.source.answers.thickness, "coarse")
  assert.equal(rebased?.source.answers.hairLength, "short")
})

test("partial facts: an absent field is unknown, never a reason to drop the paid answer", () => {
  const env = PAID_VARIANTS.V9_goals_manageability
  const partial = { ...facts(env) } as Partial<DiagnosticsV1>
  delete partial.goals
  delete partial.hairLength
  const row = factsRow(partial as DiagnosticsV1)
  const prepared = prepareScannerContext(paidRead(env, row))
  assert.equal(scannerSourceHash(prepared!.source), scannerSourceHash(env))

  const rebased = prepareScannerContext(
    paidRead(env, factsRow({ ...(partial as DiagnosticsV1), density: "high" })),
  )
  assert.deepEqual(rebased?.source.answers.goals, ["manageability_styling"])
  assert.equal(rebased?.source.answers.hairLength, env.answers.hairLength)
  assert.equal(rebased?.source.answers.density, "high")
})

test("a legacy lead as the source: compared and rebuilt on the facts", () => {
  const lead: QuizAnswers = {
    structure: "straight",
    thickness: "normal",
    density: "medium",
    hair_length: "long",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    treatment: ["natur"],
    concerns: ["dryness", "hair_damage", "low_shine"],
    primary_concern: "hair_damage",
    goals: ["less_frizz", "volume"],
  }
  const diagnostics = projectLegacyLeadToFacts({ leadId: "lead", quizAnswers: lead }).diagnostics
  const row = factsRow(diagnostics)
  // Door-derived columns lose `volume` on neutral hair and `low_shine`.
  assert.deepEqual(row.goals, ["less_frizz"])
  const read: ScannerSourceRead = {
    ...paidRead(PAID_VARIANTS.V0_fixture_split_ends, row),
    plan: null,
    initial: null,
    leads: [{ id: "lead", user_id: "owner", quiz_kind: "legacy", quiz_answers: lead }],
  }
  const prepared = prepareScannerContext(read)
  assert.deepEqual(prepared?.source, buildLegacyQuizStage1Source({ leadId: "lead", answers: lead }))
  const prefill = editableScannerQuizAnswers(read)
  assert.deepEqual(sorted(prefill.goals), ["frizz_surface", "volume_balance"])
  assert.equal(
    buildMobileHandEditFacts({
      answers: iosEcho(prefill),
      stored: parseUserFactsRow("owner", row),
      now: NOW,
    }).unchanged,
    true,
  )

  // Facts changed after the lead (a web edit): the lead source follows them.
  const edited = prepareScannerContext({
    ...read,
    profile: factsRow({ ...diagnostics, thickness: "fine", goals: ["shine"] }),
  })
  assert.equal(edited?.source.kind, "legacy_quiz")
  assert.equal(edited?.source.answers.thickness, "fine")
  assert.deepEqual(edited?.source.answers.goals, ["shine"])
  assert.deepEqual(edited?.source.answers.currentConcerns, [
    "dry_lengths",
    "hair_damage",
    "low_shine",
  ])
})

test("a paid v2 envelope: verbatim while compatible, promoted to v3 when its concerns change", async () => {
  const v2 = structuredClone(COMPLETE_V3_PLAN_ENVELOPE) as unknown as {
    kind: string
    version: number
    answers: Record<string, unknown>
  }
  v2.version = 2
  delete v2.answers.concernRecurrence
  v2.answers.currentConcerns = ["dry_dull_lengths", "breakage_or_split_ends", "low_shine"]
  const db = publishHarness(paidRead(v2, backfilledRow(v2)))
  const before = prepareScannerContext(db.read)
  assert.equal(scannerSourceHash(before!.source), scannerSourceHash(v2))

  const prefill = iosEcho(editableScannerQuizAnswers(db.read))
  const saved = await publishProfileEdit(
    db as never,
    "owner",
    request({ ...prefill, concerns: [...(prefill.concerns ?? []), "tangling"] }),
  )
  assert.equal(saved.prepared.source.kind, "personal_plan")
  assert.equal(saved.prepared.source.version, 3)
  assert.deepEqual(
    sorted(saved.prepared.source.answers.currentConcerns),
    sorted([...(facts(v2).currentConcerns ?? []), "tangling"]),
  )
  assert.equal(saved.prepared.source.answers.routineStyle, v2.answers.routineStyle)
  assert.equal(prepareScannerContext(db.read)?.sourceHash, saved.prepared.sourceHash)
})

test("a stored volume direction is handed back as the legacy goal and kept", () => {
  const env = PAID_VARIANTS.V12_neutral_volume_only
  const row = factsRow({ ...facts(env), volumeDirection: "more" })
  const prefill = editableScannerQuizAnswers(paidRead(env, row))
  assert.deepEqual(prefill.goals, ["volume"])
  assert.equal(
    buildMobileHandEditFacts({
      answers: iosEcho(prefill),
      stored: parseUserFactsRow("owner", row),
      now: NOW,
    }).unchanged,
    true,
  )
})

// ---------------------------------------------------------------------------
// Rows without a facts document: today's column + adapter path, unchanged (characterisation
// recorded from the pre-fix code at 0fd36195).
// ---------------------------------------------------------------------------

const CHARACTERISATION = JSON.parse(
  readFileSync(
    new URL("./fixtures/scanner-context/column-path-characterisation.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>

test("rows without a facts document keep the column path exactly", async () => {
  const { deriveDiagnosticsColumns } = await import("../src/lib/user-facts/derive-legacy-columns")
  const safe = (run: () => any) => {
    try {
      return run()
    } catch (error) {
      return { error: (error as Error).message }
    }
  }
  const actual: Record<string, unknown> = {}
  for (const [name, env] of Object.entries(PAID_VARIANTS)) {
    const derived = deriveDiagnosticsColumns(facts(env))
    for (const [label, profile] of [
      ["mainEra", mainEraColumns(env)],
      ["derivedNoDocument", { ...mainEraColumns(env), ...derived }],
    ] as const) {
      const read = paidRead(env, profile)
      const prepared = safe(() => prepareScannerContext(read))
      actual[`${name}/${label}`] = {
        prepared:
          prepared === null
            ? null
            : prepared.error
              ? prepared
              : {
                  sourceHash: scannerSourceHash(prepared.source),
                  goals: prepared.source.answers.goals,
                  currentConcerns: prepared.source.answers.currentConcerns,
                  snapshotSource: prepared.snapshotSource,
                  rejectedPaidSources: prepared.rejectedPaidSources.length,
                },
        editable: scannerSourceHash(
          JSON.parse(JSON.stringify(safe(() => editableScannerQuizAnswers(read)))),
        ),
      }
    }
  }
  assert.deepEqual(actual, CHARACTERISATION)
})

// ---------------------------------------------------------------------------
// Fix round 3, item 4: a corrupt fact domain the scanner does not read never breaks a scan.
// ---------------------------------------------------------------------------

test("a corrupt unrelated facts domain does not break the scanner read", () => {
  const env = PAID_VARIANTS.V11_four_plus_low_shine
  const row = backfilledRow(env)
  for (const [label, corrupt] of [
    ["care_habits", { care_habits: { wetWashFrequency: "nonsense" } }],
    ["quiz_context", { quiz_context: { routineClarity: 42 } }],
    [
      "facts_provenance.care_habits",
      {
        facts_provenance: {
          ...(row.facts_provenance as object),
          care_habits: { source: { kind: "nobody" } },
        },
      },
    ],
  ] as const) {
    const read = paidRead(env, { ...row, ...corrupt })
    assert.throws(() => parseUserFactsRow("owner", read.profile!), /corrupt/, label)
    const prepared = prepareScannerContext(read)
    assert.equal(scannerSourceHash(prepared!.source), scannerSourceHash(env), label)
    assert.deepEqual(
      editableScannerQuizAnswers(read),
      editableScannerQuizAnswers(paidRead(env, row)),
      label,
    )
  }
})

test("a corrupt diagnostics document (or its provenance) falls back to the column path", () => {
  const env = PAID_VARIANTS.V0_fixture_split_ends
  const row = backfilledRow(env)
  const columnPath = paidRead(env, { ...row, diagnostics: null })
  const expected = prepareScannerContext(columnPath)
  const expectedPrefill = editableScannerQuizAnswers(columnPath)
  for (const [label, corrupt] of [
    ["diagnostics", { diagnostics: { ...(row.diagnostics as object), texture: "zigzag" } }],
    [
      "facts_provenance.diagnostics",
      {
        facts_provenance: {
          diagnostics: {
            ...(row.facts_provenance as any).diagnostics,
            fields: { texture: "maybe" },
          },
        },
      },
    ],
  ] as const) {
    const read = paidRead(env, { ...row, ...corrupt })
    assert.deepEqual(prepareScannerContext(read)?.sourceHash, expected?.sourceHash, label)
    assert.deepEqual(editableScannerQuizAnswers(read), expectedPrefill, label)
  }
})

// ---------------------------------------------------------------------------
// Fix round 3, item 3: a paid v2 source is promoted to v3 only when something must change.
// ---------------------------------------------------------------------------

function paidV2() {
  const v2 = structuredClone(COMPLETE_V3_PLAN_ENVELOPE) as unknown as {
    kind: string
    version: number
    answers: Record<string, unknown>
  }
  v2.version = 2
  delete v2.answers.concernRecurrence
  v2.answers.currentConcerns = ["dry_dull_lengths", "breakage_or_split_ends", "low_shine"]
  return v2
}

test("v2: a stale main problem or recurrence in the facts does not promote the source", () => {
  const v2 = paidV2()
  const native = facts(v2)
  const stale = native.currentConcerns!.includes("tangling") ? "frizz_flyaways" : "tangling"
  const withoutConcerns = { ...native } as Partial<DiagnosticsV1>
  delete withoutConcerns.currentConcerns
  const thickness = native.thickness === "coarse" ? "fine" : "coarse"
  for (const [label, stored] of [
    ["stale pick", { ...native, primaryConcern: stale }],
    // A recurrence can only be stale where the facts do not know the concerns (partial facts).
    [
      "stale recurrence",
      { ...withoutConcerns, concernRecurrence: { concernId: stale, frequency: "often" } },
    ],
  ] as const) {
    // Unchanged otherwise: verbatim.
    const same = prepareScannerContext(paidRead(v2, factsRow(stored as DiagnosticsV1)))
    assert.equal(scannerSourceHash(same!.source), scannerSourceHash(v2), `${label}: verbatim`)
    // A real difference (thickness) is rebuilt without a promotion.
    const rebased = prepareScannerContext(
      paidRead(v2, factsRow({ ...stored, thickness } as DiagnosticsV1)),
    )
    assert.equal(rebased?.source.version, 2, label)
    assert.equal(rebased?.source.answers.thickness, thickness, label)
    assert.deepEqual(rebased?.source.answers.currentConcerns, v2.answers.currentConcerns, label)
  }
})
