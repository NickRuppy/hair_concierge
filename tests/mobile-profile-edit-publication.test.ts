import assert from "node:assert/strict"
import test from "node:test"
import { prepareScannerContext, type ScannerSourceRead } from "../src/lib/scan/scanner-context"

const answers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long" as const,
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  treatment: ["natur"],
  concerns: ["dryness" as const],
  goals: ["moisture" as const],
}
const profile = {
  hair_texture: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  cuticle_condition: "rough",
  protein_moisture_balance: "stretches_bounces",
  scalp_type: "balanced",
  scalp_condition: null,
  chemical_treatment: ["natural"],
  concerns: ["dryness"],
  goals: ["moisture"],
  styling_methods: ["air_dry"],
}
const source = (overrides: Partial<ScannerSourceRead> = {}): ScannerSourceRead => ({
  userId: "owner",
  sourceRevision: "1",
  profileRevision: "1",
  profile,
  plan: null,
  initial: null,
  refined: null,
  refinements: [],
  leads: [{ id: "lead", user_id: "owner", quiz_kind: "legacy", quiz_answers: answers }],
  ...overrides,
})

test("persisted explicit edit remains completed source when original lead disappears", () => {
  const prepared = prepareScannerContext(source())!
  const next = prepareScannerContext(
    source({
      leads: [],
      profileRevision: "2",
      edit: {
        profileRevision: "2",
        quizAnswers: answers,
        input: {
          source: prepared.source,
          userRefinementAnswers: {},
          userRefinementQuestionIds: [],
        },
      },
    } as never),
  )
  assert.equal(next?.snapshot.profile.hair.thickness, "fine")
})

import {
  editableScannerQuizAnswers,
  publishProfileEdit,
  ProfileEditError,
} from "../src/lib/scan/profile-edit"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { hashPersonalPlanNeedVersionInput } from "../src/lib/personal-plan/persistence"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"
import { adaptPersonalPlanAnswersForOffer } from "../src/lib/personal-plan-quiz/offer-adapter"
import { buildProfileDataFromQuizAnswers } from "../src/lib/quiz/link-to-profile"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { mergeDiagnosticsPatch } from "../src/lib/user-facts/hand-edit"
import { parseUserFactsRow } from "../src/lib/user-facts/read"

function harness(initial: ScannerSourceRead) {
  let read = initial
  const receipts = new Map<string, Record<string, any>>()
  const calls: string[] = []
  let failPublish = false
  return {
    calls,
    get read() {
      return read
    },
    set read(value) {
      read = value
    },
    set failPublish(value: boolean) {
      failPublish = value
    },
    rpc: async (name: string, args: Record<string, any>) => {
      calls.push(name)
      const receipt = receipts.get(args.p_request_id)
      if (name === "scanner_profile_edit_receipt")
        return {
          data: receipt
            ? receipt.hash === args.p_request_hash
              ? receipt.result
              : { outcome: "profile_conflict" }
            : null,
          error: null,
        }
      if (name === "scanner_context_read_source") return { data: read, error: null }
      assert.equal(name, "scanner_profile_edit_publish")
      if (failPublish) return { data: null, error: { code: "40P01" } }
      assert.equal(args.p_expected_source_revision, read.sourceRevision)
      assert.equal(args.p_expected_profile_revision, read.profileRevision)
      const profileRevision = String(Number(read.profileRevision) + 1)
      // What the door does: merge the facts patch, derive the 13 columns from the document.
      assert.equal(args.p_patch, undefined, "no column patch reaches the publisher")
      const diagnostics = mergeDiagnosticsPatch(
        parseUserFactsRow("owner", read.profile ?? {}).diagnostics,
        args.p_facts.diagnostics.patch,
      )
      const result = {
        outcome: "ready",
        profileRevision,
        contextRevision: `context-${profileRevision}`,
        profile: { ...read.profile, ...deriveDiagnosticsColumns(diagnostics), diagnostics },
        quizAnswers: args.p_quiz_answers,
        context: {
          input_snapshot: args.p_input_snapshot,
          output_snapshot: args.p_output_snapshot,
          source_hash: args.p_source_hash,
          snapshot_source: args.p_snapshot_source,
        },
      }
      read = {
        ...read,
        profile: result.profile,
        profileRevision,
        sourceRevision: String(Number(read.sourceRevision) + 1),
        edit: {
          profileRevision,
          quizAnswers: args.p_quiz_answers,
          profile: result.profile,
          input: args.p_input_snapshot,
        },
      }
      receipts.set(args.p_request_id, { hash: args.p_request_hash, result })
      return { data: result, error: null }
    },
  }
}
// Clean-switch fix round 1 (A): the column-patch input is gone. These requests are the iOS edit
// (complete answers, saved as facts); `web()` is the web editors' input (changed groups only).
const request = (extra: Record<string, unknown> = {}, quizAnswers: object = answers) => ({
  expectedProfileRevision: "1",
  requestId: "33333333-3333-4333-8333-333333333333",
  quizAnswers: { ...quizAnswers, thickness: "coarse" },
  saveAsFacts: true as const,
  ...extra,
})
const web = (extra: Record<string, unknown> = {}) => ({
  expectedProfileRevision: "1",
  requestId: "33333333-3333-4333-8333-333333333333",
  profileAnswers: { thickness: "coarse" as const },
  ...extra,
})
test("publisher preserves nonquiz fields, saves raw diagnostic choices/text and retries before stale CAS/computation", async () => {
  const db = harness(source())
  const quizAnswers = {
    ...answers,
    thickness: "coarse",
    concerns: ["low_shine" as const],
    goals: ["manageability_styling" as const],
    concerns_other_text: "Meine Spitzen",
  }
  const input = request({ quizAnswers })
  const saved = await publishProfileEdit(db as never, "owner", input)
  assert.deepEqual(saved.profile.styling_methods, ["air_dry"])
  assert.deepEqual(saved.quizAnswers, quizAnswers)
  assert.deepEqual(saved.prepared.source.answers.currentConcerns, ["low_shine"])
  assert.deepEqual(saved.prepared.source.answers.goals, ["manageability_styling"])
  assert.deepEqual(JSON.parse(JSON.stringify(editableScannerQuizAnswers(db.read))), quizAnswers)
  const subsequent = prepareScannerContext(db.read)!
  assert.deepEqual(subsequent.source.answers.currentConcerns, ["low_shine"])
  assert.deepEqual(subsequent.source.answers.goals, ["manageability_styling"])
  db.read = { ...db.read, profileRevision: "99", profile: null }
  db.calls.length = 0
  assert.deepEqual(await publishProfileEdit(db as never, "owner", input), saved)
  assert.deepEqual(db.calls, ["scanner_profile_edit_receipt"])
  await assert.rejects(
    publishProfileEdit(db as never, "owner", {
      ...input,
      quizAnswers: { ...quizAnswers, thickness: "fine" },
    }),
    { code: "profile_conflict" },
  )
})
test("stale/missing source and compute/publication failures do not perform partial writes", async () => {
  const stale = harness(source({ profileRevision: "2" }))
  await assert.rejects(publishProfileEdit(stale as never, "owner", request()), {
    code: "profile_conflict",
  })
  assert.ok(!stale.calls.includes("scanner_profile_edit_publish"))
  const incomplete = harness(source({ leads: [] }))
  await assert.rejects(publishProfileEdit(incomplete as never, "owner", request()), {
    code: "profile_required",
  })
  assert.ok(!incomplete.calls.includes("scanner_profile_edit_publish"))
  const db = harness(source())
  db.failPublish = true
  await assert.rejects(
    publishProfileEdit(db as never, "owner", request()),
    (error) => error instanceof ProfileEditError && error.code === "temporarily_unavailable",
  )
  assert.equal(db.read.profile?.thickness, "fine")
})
test("saved raw legacy volume direction survives prefill and unrelated web edits", async () => {
  const raw = { ...answers, goals: ["less_volume" as const], concerns_other_text: "Spitzen" }
  const db = harness(
    source({
      profile: { ...profile, goals: ["less_volume"] },
      leads: [{ id: "lead", user_id: "owner", quiz_kind: "legacy", quiz_answers: raw }],
    }),
  )
  assert.deepEqual(editableScannerQuizAnswers(db.read).goals, ["less_volume"])
  const saved = await publishProfileEdit(db as never, "owner", web())
  assert.deepEqual(saved.quizAnswers.goals, ["less_volume"])
  assert.equal(saved.quizAnswers.concerns_other_text, "Spitzen")
})
// `hair_damage` instead of `split_ends`: the offer adapter adds the legacy goal `less_split_ends`
// for `split_ends`, which a goals column derived by `user_facts_save_v1` never carries — that paid
// source would stop being basics-compatible after any facts write (reported in clean-switch fix
// round 1). These tests are about discarded details and bindings, so their fixture avoids that
// separate interaction.
function paidEnvelope() {
  const envelope = structuredClone(COMPLETE_V3_PLAN_ENVELOPE)
  envelope.answers.currentConcerns = ["dry_lengths", "hair_damage"]
  return envelope
}
function paidSource(): ScannerSourceRead {
  const envelope = paidEnvelope()
  const computed = computeNeedPlan({
    rawEnvelope: envelope,
    artifactId: "initial",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "1970-01-01T00:00:00.000Z",
  })
  if (computed.status !== "ready") throw new Error("fixture")
  const raw = adaptPersonalPlanAnswersForOffer(envelope.answers).answers
  return source({
    leads: [],
    profile: { ...buildProfileDataFromQuizAnswers(raw), goals: raw.goals },
    plan: {
      id: "plan",
      current_initial_need_version_id: "initial",
      current_refined_need_version_id: null,
    },
    initial: {
      id: "initial",
      user_id: "owner",
      personal_plan_id: "plan",
      kind: "initial",
      input_snapshot: envelope,
      output_snapshot: computed.snapshot,
      schema_version: 1,
      computation_version: "stage1-v1",
      input_hash: hashPersonalPlanNeedVersionInput({
        schemaVersion: 1,
        computationVersion: "stage1-v1",
        inputSnapshot: envelope as never,
      }),
    },
  })
}
const paidAnswers = () => adaptPersonalPlanAnswersForOffer(paidEnvelope().answers).answers
function recurrence(prepared: ReturnType<typeof prepareScannerContext>) {
  const answers = prepared?.source.answers
  return answers && "concernRecurrence" in answers ? answers.concernRecurrence : undefined
}
test("old paid source never restores a discarded detail after basics return; new paid publication requires matching profile revision and basics", async () => {
  const db = harness(paidSource())
  assert.ok(recurrence(prepareScannerContext(db.read)))
  // What the iOS edit screen does: prefill from the editable answers, change one group, save.
  const first = await publishProfileEdit(
    db as never,
    "owner",
    request({ quizAnswers: { ...editableScannerQuizAnswers(db.read), concerns: [] } }),
  )
  assert.equal(recurrence(first.prepared), undefined)
  const second = await publishProfileEdit(
    db as never,
    "owner",
    request({
      requestId: "44444444-4444-4444-8444-444444444444",
      expectedProfileRevision: first.profileRevision,
      quizAnswers: { ...editableScannerQuizAnswers(db.read), concerns: ["dryness", "hair_damage"] },
    }),
  )
  assert.equal(recurrence(second.prepared), undefined)
  assert.equal(recurrence(prepareScannerContext(db.read)), undefined)
  assert.equal(
    recurrence(prepareScannerContext({ ...db.read, paidBindings: { initial: "1" } })),
    undefined,
  )
  // After the edits the row has a facts document, which the scanner reads first: a changed
  // basic is a changed fact (the door derives the column from it).
  const document = db.read.profile!.diagnostics as Record<string, unknown>
  assert.ok(document, "the edit created the facts document")
  // A paid publication bound to the current revision with matching basics stays eligible. Fix
  // round 3 (item 2): its recurrence is used only where the facts carry it — these facts (the
  // edits cleared it) do not, so the read already gives what an unchanged edit would publish.
  const eligible = prepareScannerContext({
    ...db.read,
    paidBindings: { initial: db.read.profileRevision },
  })!
  assert.deepEqual(eligible.rejectedPaidSources, [])
  assert.equal(recurrence(eligible), undefined)
  const withRecurrence = prepareScannerContext({
    ...db.read,
    profile: {
      ...db.read.profile,
      diagnostics: {
        ...document,
        concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
      },
    },
    paidBindings: { initial: db.read.profileRevision },
  })!
  assert.deepEqual(withRecurrence.rejectedPaidSources, [])
  assert.deepEqual(recurrence(withRecurrence), {
    concernId: "dry_lengths",
    frequency: "often",
  })
  const incompatible = prepareScannerContext({
    ...db.read,
    profile: {
      ...db.read.profile,
      thickness: "coarse",
      diagnostics: { ...document, thickness: "coarse" },
    },
    paidBindings: { initial: db.read.profileRevision },
  })!
  assert.equal(recurrence(incompatible), undefined)
})

test("applicable detailed answers survive edits, discarded answers never return, and assumptions refresh", async () => {
  const raw = { ...answers, has_scalp_issue: true, scalp_condition: "gereizt" }
  const irritated = { ...profile, scalp_condition: "irritated" }
  const read = source({
    profile: irritated,
    leads: [{ id: "lead", user_id: "owner", quiz_kind: "legacy", quiz_answers: raw }],
  })
  const initial = prepareScannerContext(read)!
  read.edit = {
    profileRevision: "1",
    profile: irritated,
    quizAnswers: raw,
    input: {
      source: initial.source,
      userRefinementAnswers: {
        wetWashFrequency: "weekly_3_4x",
        scalpIrritationDetail: "burning_painful_or_inflamed",
      },
      userRefinementQuestionIds: ["wet_wash_frequency", "scalp_irritation_detail"],
    },
  }
  const db = harness(read)
  const first = await publishProfileEdit(
    db as never,
    "owner",
    request({ quizAnswers: { ...raw, has_scalp_issue: false, scalp_condition: undefined } }),
  )
  assert.equal(first.prepared.userRefinementAnswers.wetWashFrequency, "weekly_3_4x")
  assert.equal(first.prepared.userRefinementAnswers.scalpIrritationDetail, undefined)
  assert.ok(!first.prepared.userRefinementQuestionIds.includes("scalp_irritation_detail"))
  const second = await publishProfileEdit(
    db as never,
    "owner",
    request({
      expectedProfileRevision: first.profileRevision,
      requestId: "55555555-5555-4555-8555-555555555555",
      quizAnswers: raw,
    }),
  )
  assert.equal(second.prepared.userRefinementAnswers.wetWashFrequency, "weekly_3_4x")
  assert.equal(second.prepared.userRefinementAnswers.scalpIrritationDetail, undefined)
  assert.ok(second.prepared.assumedQuestionIds.includes("scalp_irritation_detail"))
  assert.ok(!second.prepared.userRefinementQuestionIds.includes("scalp_irritation_detail"))
})

import { scannerSourceHash } from "../src/lib/scan/scanner-context"
import { loadSharedScannerContext } from "../src/lib/scan/scanner-context-supabase"

test("existing pre-edit input upgrades at unchanged source revision and subsequent loads reuse the new context", async () => {
  const read = source(),
    prepared = prepareScannerContext(read)!
  const oldHash = scannerSourceHash({
    source: prepared.source,
    userRefinementAnswers: prepared.userRefinementAnswers,
    assumedQuestionIds: prepared.assumedQuestionIds,
    routine: prepared.snapshot.profile.routine,
    engine: prepared.snapshot.computationVersion,
  })
  const oldInput = {
    source: prepared.source,
    userRefinementAnswers: prepared.userRefinementAnswers,
    assumedQuestionIds: prepared.assumedQuestionIds,
  }
  const versions = new Map([[oldHash, { contextRevision: "old-context", input: oldInput }]])
  const client = {
    rpc: async (name: string, args: Record<string, any>) => {
      if (name === "scanner_context_read_source") return { data: read, error: null }
      assert.equal(name, "scanner_context_publish")
      assert.equal(args.p_expected_source_revision, "1")
      const existing = versions.get(args.p_source_hash)
      if (existing && JSON.stringify(existing.input) !== JSON.stringify(args.p_input_snapshot))
        return { data: null, error: { message: "scanner_context_input_collision" } }
      const row = existing ?? { contextRevision: "upgraded-context", input: args.p_input_snapshot }
      versions.set(args.p_source_hash, row)
      return { data: { outcome: "ready", contextRevision: row.contextRevision }, error: null }
    },
  }
  const upgraded = await loadSharedScannerContext(client as never, "owner")
  assert.equal(upgraded?.contextRevision, "upgraded-context")
  assert.equal(
    (await loadSharedScannerContext(client as never, "owner"))?.contextRevision,
    "upgraded-context",
  )
  assert.equal(versions.size, 2)
  assert.deepEqual(upgraded?.prepared.snapshot, prepared.snapshot)
})

test("shared loader exposes rejected paid source without blocking edited context or logging personal values; compatible source emits none", async (t) => {
  const db = harness(paidSource())
  await publishProfileEdit(db as never, "owner", request({}, paidAnswers()))
  let read = { ...db.read, paidBindings: { initial: db.read.profileRevision } }
  let lastInput: unknown, lastHash: unknown
  const client = {
    rpc: async (name: string, args: Record<string, any>) => {
      if (name === "scanner_context_read_source") return { data: read, error: null }
      assert.equal(name, "scanner_context_publish")
      lastInput = args.p_input_snapshot
      lastHash = args.p_source_hash
      return { data: { outcome: "ready", contextRevision: "retained-context" }, error: null }
    },
  }
  const events: unknown[][] = []
  t.mock.method(console, "warn", (...args: unknown[]) => {
    events.push(args)
  })
  const retained = await loadSharedScannerContext(client as never, "owner")
  assert.equal(retained?.prepared.snapshot.profile.hair.thickness, "coarse")
  assert.deepEqual(events, [
    [
      "scanner_context_source_conflict",
      {
        sourceRevision: "2",
        profileRevision: "2",
        rejectedPaidSources: [
          { needVersionId: "initial", boundProfileRevision: "2", reason: "basic_answers_mismatch" },
        ],
      },
    ],
  ])
  const emitted = JSON.stringify(events)
  for (const forbidden of ["owner", "userId", "quizAnswers", "coarse", "concerns", "token"])
    assert.ok(!emitted.includes(forbidden))
  // Diagnostics are observation only; changing the rejection reason cannot
  // change immutable inputs or the hash when retained scanner meaning is equal.
  const inputWithConflict = lastInput,
    hashWithConflict = lastHash
  read = { ...read, paidBindings: { initial: "1" } }
  await loadSharedScannerContext(client as never, "owner")
  assert.deepEqual(lastInput, inputWithConflict)
  assert.equal(lastHash, hashWithConflict)
  events.length = 0
  const compatibleDb = harness(paidSource())
  await publishProfileEdit(compatibleDb as never, "owner", request({ quizAnswers: paidAnswers() }))
  read = { ...compatibleDb.read, paidBindings: { initial: compatibleDb.read.profileRevision } }
  await loadSharedScannerContext(client as never, "owner")
  assert.deepEqual(events, [])
})

test("immediate shared read reuses the atomically published input and output for free and paid edits", async () => {
  for (const initial of [source(), paidSource()]) {
    const db = harness(initial)
    const saved = await publishProfileEdit(db as never, "owner", request())
    const input = {
      source: saved.prepared.source,
      userRefinementAnswers: saved.prepared.userRefinementAnswers,
      userRefinementQuestionIds: saved.prepared.userRefinementQuestionIds,
      assumedQuestionIds: saved.prepared.assumedQuestionIds,
    }
    const client = {
      rpc: async (name: string, args: Record<string, any>) => {
        if (name === "scanner_context_read_source") return { data: db.read, error: null }
        assert.equal(name, "scanner_context_publish")
        assert.equal(args.p_source_hash, saved.prepared.sourceHash)
        assert.deepEqual(args.p_input_snapshot, input)
        assert.deepEqual(args.p_output_snapshot, saved.prepared.snapshot)
        assert.equal(args.p_snapshot_source, saved.prepared.snapshotSource)
        return { data: { outcome: "ready", contextRevision: saved.contextRevision }, error: null }
      },
    }
    const loaded = await loadSharedScannerContext(client as never, "owner")
    assert.equal(loaded?.contextRevision, saved.contextRevision)
  }
})
