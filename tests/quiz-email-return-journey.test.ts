import assert from "node:assert/strict"
import test from "node:test"

import {
  decodeQuizEmailReturnContext,
  encodeQuizEmailReturnContext,
} from "../src/lib/quiz/email-return-context"
import { projectQuizEmailReturnPrefill } from "../src/lib/quiz/email-return-prefill"
import { formatQuizEmailReturnUrl } from "../src/lib/quiz/email-return-url"

const linkId = "11111111-1111-4111-8111-111111111111"
const secret = "test-secret-with-at-least-thirty-two-characters"
const now = Date.parse("2026-09-18T10:00:00Z")

test("email return context is signed, scoped to one link, and expires", () => {
  const encoded = encodeQuizEmailReturnContext(linkId, secret, now)
  assert.deepEqual(decodeQuizEmailReturnContext(encoded, secret, now + 1000), { linkId })
  assert.equal(decodeQuizEmailReturnContext(encoded, "another-secret", now), null)
  assert.equal(decodeQuizEmailReturnContext(`${encoded}x`, secret, now), null)
  assert.equal(decodeQuizEmailReturnContext(encoded, secret, now + 31 * 24 * 60 * 60 * 1000), null)
  assert.equal(encoded.includes(linkId), false)
})

test("campaign link formatter creates only clean HTTPS bearer URLs", () => {
  const token = "a".repeat(43)
  assert.equal(
    formatQuizEmailReturnUrl(token, "https://chaarlie.de"),
    `https://chaarlie.de/quiz/return?token=${token}`,
  )
  assert.throws(() => formatQuizEmailReturnUrl(token, "http://chaarlie.de"))
  assert.throws(() => formatQuizEmailReturnUrl("bad", "https://chaarlie.de"))
})

test("legacy return edit only prefills valid saved answers", () => {
  assert.deepEqual(
    projectQuizEmailReturnPrefill("legacy", {
      structure: "wavy",
      thickness: "fine",
      goals: ["healthier_hair"],
      hair_length: "made-up-length",
      email: "not-an-answer@example.com",
    }),
    { structure: "wavy", thickness: "fine", goals: ["healthier_hair"] },
  )
})

test("Personal Plan return edit maps known facts but does not prefill adapter defaults", () => {
  const result = projectQuizEmailReturnPrefill("personal_plan", {
    kind: "personal_plan",
    version: 2,
    answers: {
      texture: "wavy",
      thickness: "fine",
      density: "medium",
      goals: ["moisture"],
      routineClarity: "partial",
      resultReliability: "sometimes",
      adaptationConfidence: "partly",
      currentConcerns: ["frizz_flyaways"],
      hairLength: "medium",
      hairSurface: "slightly_uneven",
      previousAttempts: "some_steps_helped",
      blockers: ["product_fit"],
      routineStyle: "simple_reliable",
      meaningfulMoment: "everyday",
    },
  })
  assert.equal(result.structure, "wavy")
  assert.equal(result.thickness, "fine")
  assert.equal(result.density, "medium")
  assert.equal(result.hair_length, "medium")
  assert.equal(result.fingertest, "leicht_uneben")
  assert.equal(result.pulltest, undefined)
  assert.equal(result.scalp_type, undefined)
  assert.equal(result.treatment, undefined)
})

test("unsupported historical envelope never manufactures edit answers", () => {
  assert.deepEqual(
    projectQuizEmailReturnPrefill("personal_plan", {
      kind: "personal_plan",
      version: 1,
      answers: {},
    }),
    {},
  )
})
