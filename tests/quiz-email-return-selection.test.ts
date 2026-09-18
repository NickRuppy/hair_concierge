import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizeQuizEmailReturnEmail,
  selectNewestQuizEmailReturnLead,
  type QuizEmailReturnLeadCandidate,
} from "../src/lib/quiz/email-return-credential"

const legacyLead: QuizEmailReturnLeadCandidate = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "lea@example.test",
  quizKind: "legacy",
  quizAnswers: { structure: "wavy" },
  createdAt: "2026-07-01T12:00:00.000Z",
}

test("email matching is normalized and chooses the newest completed record across quiz kinds", () => {
  const selected = selectNewestQuizEmailReturnLead(" LEA@EXAMPLE.TEST ", [
    legacyLead,
    {
      id: "20000000-0000-4000-8000-000000000002",
      email: "Lea@Example.Test",
      quizKind: "personal_plan",
      quizAnswers: { kind: "personal_plan", answers: {} },
      createdAt: "2026-08-01T12:00:00.000Z",
    },
  ])

  assert.equal(normalizeQuizEmailReturnEmail(" LEA@EXAMPLE.TEST "), "lea@example.test")
  assert.equal(selected?.id, "20000000-0000-4000-8000-000000000002")
  assert.equal(normalizeQuizEmailReturnEmail(selected?.email ?? ""), "lea@example.test")
})

test("selection breaks equal submission timestamps by id and rejects drafts or unsupported records", () => {
  const selected = selectNewestQuizEmailReturnLead("lea@example.test", [
    {
      ...legacyLead,
      id: "10000000-0000-4000-8000-000000000003",
      createdAt: "2026-09-01T12:00:00.000Z",
    },
    {
      ...legacyLead,
      id: "10000000-0000-4000-8000-000000000004",
      quizKind: "personal_plan",
      createdAt: "2026-09-01T12:00:00.000Z",
    },
    {
      ...legacyLead,
      id: "10000000-0000-4000-8000-000000000005",
      quizAnswers: null,
      createdAt: "2026-10-01T12:00:00.000Z",
    },
    {
      ...legacyLead,
      id: "10000000-0000-4000-8000-000000000008",
      quizAnswers: {},
      createdAt: "2026-10-02T12:00:00.000Z",
    },
    {
      ...legacyLead,
      id: "10000000-0000-4000-8000-000000000006",
      quizKind: "other",
      createdAt: "2026-10-01T12:00:00.000Z",
    },
    { ...legacyLead, email: "other@example.test", createdAt: "2026-10-01T12:00:00.000Z" },
  ])

  assert.equal(selected?.id, "10000000-0000-4000-8000-000000000004")
})

test("a supplied lead id remains bound even if a newer lead later exists", () => {
  const selectedAtIssuance = selectNewestQuizEmailReturnLead("lea@example.test", [legacyLead])
  assert.equal(selectedAtIssuance?.id, legacyLead.id)

  const selectedLater = selectNewestQuizEmailReturnLead("lea@example.test", [
    legacyLead,
    {
      ...legacyLead,
      id: "10000000-0000-4000-8000-000000000007",
      createdAt: "2026-09-10T12:00:00.000Z",
    },
  ])
  assert.equal(selectedLater?.id, "10000000-0000-4000-8000-000000000007")
  assert.equal(selectedAtIssuance?.id, legacyLead.id)
})
