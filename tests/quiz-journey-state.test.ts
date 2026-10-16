import assert from "node:assert/strict"
import test from "node:test"

import { initialQuizJourneyState, reduceQuizJourney } from "../src/lib/quiz/journey-state"
import type { QuizJourneyState } from "../src/lib/quiz/journey-state"

function freshState(): QuizJourneyState {
  return structuredClone(initialQuizJourneyState)
}

test("answer-and-advance commits the reconciled answer set in one forward transition", () => {
  const state: QuizJourneyState = {
    ...freshState(),
    step: 8,
    answers: {
      concerns: ["dry_lengths", "frizz_flyaways"],
      primary_concern: "dry_lengths",
    },
  }

  const next = reduceQuizJourney(state, {
    type: "answersAndAdvance",
    changes: { concerns: ["frizz_flyaways"] },
  })

  assert.equal(next.step, 12)
  assert.deepEqual(next.answers, { concerns: ["frizz_flyaways"] })
  assert.equal(next.navigationRevision, 1)
  assert.deepEqual(next.transition, {
    id: 1,
    kind: "forward",
    from: { step: 8, leadCaptureSubStep: "name" },
    to: { step: 12, leadCaptureSubStep: "name" },
  })
})

test("plain answer edits do not invalidate a scheduled navigation", () => {
  const state = freshState()
  const next = reduceQuizJourney(state, { type: "answer", key: "structure", value: "wavy" })

  assert.equal(next.navigationRevision, 0)
  assert.equal(next.transition, null)
  assert.deepEqual(next.answers, { structure: "wavy" })
})

test("restore is an explicit transition even when it restores the current screen", () => {
  const state: QuizJourneyState = {
    ...freshState(),
    step: 3,
    leadCaptureSubStep: "email",
    leadCaptureMode: "partner",
    lead: { name: "Existing", email: "existing@example.test", marketingConsent: true },
    leadId: "lead-id",
    funnelPackageKey: "scan_v1",
  }

  const next = reduceQuizJourney(state, {
    type: "restore",
    step: 3,
    answers: { structure: "wavy" },
  })

  assert.equal(next.navigationRevision, 1)
  assert.equal(next.transition?.kind, "restore")
  assert.deepEqual(next.transition?.from, { step: 3, leadCaptureSubStep: "email" })
  assert.deepEqual(next.transition?.to, { step: 3, leadCaptureSubStep: "name" })
  assert.equal(next.funnelPackageKey, "scan_v1")
  assert.equal(next.leadCaptureMode, "regular")
  assert.deepEqual(next.lead, { name: "", email: "", marketingConsent: false })
  assert.equal(next.leadId, null)
})

test("package authority invalidates a delayed action once but ignores redundant application", () => {
  const state: QuizJourneyState = { ...freshState(), step: 13, funnelPackageKey: "scan_v1" }
  const remapped = reduceQuizJourney(state, { type: "setFunnelPackageKey", key: null })
  const repeated = reduceQuizJourney(remapped, { type: "setFunnelPackageKey", key: null })

  assert.equal(remapped.step, 13)
  assert.equal(remapped.navigationRevision, 1)
  assert.equal(remapped.transition?.kind, "package")
  assert.strictEqual(repeated, remapped)
})

test("migration and return initialization preserve their distinct identity contracts", () => {
  const state: QuizJourneyState = {
    ...freshState(),
    leadCaptureMode: "discovery",
    funnelPackageKey: "scan_v1",
    lead: { name: "Mira", email: "mira@example.test", marketingConsent: true },
    leadId: "lead-id",
  }
  const migration = reduceQuizJourney(state, {
    type: "initializeMigration",
    step: 6,
    answers: { structure: "curly" },
  })
  const returned = reduceQuizJourney(migration, { type: "initializeReturn" })

  assert.equal(migration.leadCaptureMode, "discovery")
  assert.equal(migration.step, 6)
  assert.deepEqual(migration.lead, { name: "", email: "", marketingConsent: false })
  assert.equal(migration.leadId, null)
  assert.equal(migration.transition?.kind, "init")

  assert.equal(returned.leadCaptureMode, "regular")
  assert.equal(returned.step, 2)
  assert.deepEqual(returned.answers, {})
  assert.equal(returned.navigationRevision, 2)
})
