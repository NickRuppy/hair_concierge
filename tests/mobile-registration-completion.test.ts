import assert from "node:assert/strict"
import test from "node:test"
import {
  completeMobileRegistration,
  completeMobileProfile,
} from "../src/lib/mobile/registration-completion"
import { mobileEditProfilePatch } from "../src/lib/mobile/profile-edit-contract"
const owner = "11111111-1111-4111-8111-111111111111"
const id = "22222222-2222-4222-8222-222222222222"
const answers = {
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
} as const
const submission = {
  requestId: id,
  email: "registration@example.test",
  firstName: "Test",
  marketingOptIn: true,
  answers,
}
const input = {
  attemptId: id,
  sendGeneration: id,
  submission,
  choice: "create",
  expectedProfileRevision: "0",
} as const
function harness(profile: Record<string, unknown> | null = null) {
  const calls: Array<{ name: string; args: Record<string, any> }> = []
  const ready = { outcome: "ready", status: "ready", profileRevision: "1", contextRevision: id }
  let receipt: unknown = null
  return {
    calls,
    ready,
    set receipt(v: unknown) {
      receipt = v
    },
    async rpc(name: string, args: Record<string, any>) {
      calls.push({ name, args })
      if (name === "mobile_registration_publication_receipt") return { data: receipt, error: null }
      if (name === "scanner_context_read_source")
        return {
          data: {
            userId: owner,
            sourceRevision: "0",
            profileRevision: "0",
            profile,
            plan: null,
            initial: null,
            refined: null,
            refinements: [],
            leads: [],
          },
          error: null,
        }
      assert.equal(name, "mobile_registration_publish")
      return { data: ready, error: null }
    },
  }
}
test("new registration computes real scanner context and binds exact submission/generation before one atomic publication", async () => {
  const db = harness()
  assert.deepEqual(
    await completeMobileRegistration(db as never, owner, submission.email, input as never),
    { status: "ready", profileRevision: "1", contextRevision: id },
  )
  const call = db.calls.at(-1)!.args
  assert.equal(call.p_send_generation, id)
  assert.equal(call.p_mode, "create")
  assert.equal(call.p_user_id, owner)
  assert.equal(call.p_quiz_answers.has_scalp_issue, false)
  assert.equal(call.p_patch.scalp_condition, null)
  assert.equal(call.p_output_snapshot.computationVersion, "stage1-v1")
  assert.equal(call.p_input_snapshot.source.leadId, call.p_lead_id)
  assert.equal(call.p_submission.marketingOptIn, true)
})
test("receipt replay precedes stale profile read and preserves output", async () => {
  const db = harness()
  db.receipt = db.ready
  await completeMobileRegistration(db as never, owner, submission.email, input as never)
  assert.deepEqual(
    db.calls.map((c) => c.name),
    ["mobile_registration_publication_receipt"],
  )
})
test("mismatched verified email never reads or publishes", async () => {
  const db = harness()
  await assert.rejects(
    completeMobileRegistration(db as never, owner, "other@example.test", input as never),
    /invalid_submission/,
  )
  assert.equal(db.calls.length, 0)
})
test("create cannot overwrite existing profile and keep cannot fabricate completed source", async () => {
  const db = harness(mobileEditProfilePatch(answers as never))
  await assert.rejects(
    completeMobileRegistration(db as never, owner, submission.email, input as never),
    /profile_conflict/,
  )
  await assert.rejects(
    completeMobileRegistration(db as never, owner, submission.email, {
      ...input,
      choice: "keep",
    } as never),
    /profile_required/,
  )
  assert.ok(!db.calls.some((c) => c.name === "mobile_registration_publish"))
})
test("replace preserves unrelated profile fields and uses exact source revision", async () => {
  const db = harness({ ...mobileEditProfilePatch(answers as never), styling_methods: ["air_dry"] })
  await completeMobileRegistration(db as never, owner, submission.email, {
    ...input,
    choice: "replace",
  } as never)
  const call = db.calls.at(-1)!.args
  assert.equal(call.p_expected_source_revision, "0")
  assert.equal(call.p_patch.styling_methods, undefined)
  assert.equal(call.p_mode, "replace")
})
test("missing-only asks merged helper for allowed patch, ignores supplied present-field replacements", async () => {
  const profile = mobileEditProfilePatch(answers as never)
  delete profile.hair_length
  const db = harness(profile)
  await completeMobileProfile(db as never, owner, {
    requestId: id,
    expectedProfileRevision: "0",
    answers: { hair_length: "short", thickness: "coarse" },
  })
  const call = db.calls.at(-1)!.args
  assert.equal(call.p_mode, "missing")
  assert.deepEqual(call.p_patch, { hair_length: "short" })
  assert.equal(call.p_quiz_answers.thickness, "fine")
  assert.equal(call.p_quiz_answers.has_scalp_issue, false)
  assert.equal(call.p_submission, null)
})

test("missing required answers are a validation error, never a partial publication", async () => {
  const db = harness(null)
  await assert.rejects(
    completeMobileProfile(db as never, owner, {
      requestId: id,
      expectedProfileRevision: "0",
      answers: { thickness: "fine" },
    }),
    /invalid_submission/,
  )
  assert.ok(!db.calls.some((c) => c.name === "mobile_registration_publish"))
})
