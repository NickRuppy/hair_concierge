import assert from "node:assert/strict"
import test from "node:test"
import {
  registrationSubmissionSchema,
  registrationSubmissionHash,
  registrationCompleteSchema,
} from "../src/lib/mobile/registration-contract"
const input = {
  requestId: "11111111-1111-4111-8111-111111111111",
  firstName: "Ada",
  email: "ada@example.test",
  marketingOptIn: false,
  answers: {
    structure: "wavy",
    thickness: "fine",
    density: "medium",
    hair_length: "long",
    fingertest: "rau",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    treatment: ["natur"],
    concerns: [],
    goals: ["less_volume"],
  },
}
test("registration requires completed quiz, explicit consent and no caller-owned identity", () => {
  assert.equal(registrationSubmissionSchema.safeParse(input).success, true)
  for (const altered of [
    { ...input, marketingOptIn: undefined },
    { ...input, userId: input.requestId },
    { ...input, answers: { ...input.answers, goals: [] } },
    { ...input, answers: { ...input.answers, hair_length: undefined } },
  ])
    assert.equal(registrationSubmissionSchema.safeParse(altered).success, false)
})
test("submission hash pins answers, email, consent, name and request identity", () => {
  const parsed = registrationSubmissionSchema.parse(input)
  const h = registrationSubmissionHash(parsed)
  assert.match(h, /^[a-f0-9]{64}$/)
  assert.equal(registrationSubmissionHash({ ...parsed, answers: { ...parsed.answers } }), h)
  for (const changed of [
    { ...parsed, marketingOptIn: true },
    { ...parsed, firstName: "Grace" },
    { ...parsed, email: "other@example.test" },
    { ...parsed, requestId: "22222222-2222-4222-8222-222222222222" },
    { ...parsed, answers: { ...parsed.answers, thickness: "coarse" as const } },
  ])
    assert.notEqual(registrationSubmissionHash(changed), h)
})
test("completion cannot smuggle another owner or omit explicit collision choice", () => {
  const valid = {
    completionToken: "x".repeat(40),
    submission: input,
    choice: "keep",
    expectedProfileRevision: "4",
  }
  assert.equal(registrationCompleteSchema.safeParse(valid).success, true)
  assert.equal(
    registrationCompleteSchema.safeParse({ ...valid, userId: input.requestId }).success,
    false,
  )
  assert.equal(registrationCompleteSchema.safeParse({ ...valid, choice: undefined }).success, false)
})

test("Swift uppercase UUIDs canonicalize identically at start and completion, including submission hash", () => {
  const canonicalId = "abcdef12-3456-4789-abcd-abcdef123456"
  const lowercase = registrationSubmissionSchema.parse({ ...input, requestId: canonicalId })
  const swiftEncoded = { ...lowercase, requestId: canonicalId.toUpperCase() }
  assert.equal(registrationSubmissionSchema.parse(swiftEncoded).requestId, canonicalId)
  assert.equal(registrationSubmissionHash(swiftEncoded), registrationSubmissionHash(lowercase))
  const completion = registrationCompleteSchema.parse({
    completionToken: "x".repeat(40),
    submission: swiftEncoded,
    choice: "create",
    expectedProfileRevision: "0",
  })
  assert.equal(completion.submission.requestId, canonicalId)
  assert.equal(
    registrationSubmissionHash(completion.submission),
    registrationSubmissionHash(lowercase),
  )
})
