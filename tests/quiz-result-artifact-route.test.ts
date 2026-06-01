import assert from "node:assert/strict"
import test from "node:test"

import {
  handleQuizResultArtifactRequest,
  type ResultArtifactStore,
} from "../src/app/api/quiz/result-artifact/route"
import type { CustomerIoTransactionalEmailPayload } from "../src/lib/customerio/transactional"
import type { QuizAnswers } from "../src/lib/quiz/types"

const leadId = "550e8400-e29b-41d4-a716-446655440000"

const completeAnswers: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  fingertest: "leicht_uneben",
  pulltest: "stretches_stays",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["frizz", "dryness"],
  treatment: ["gefaerbt"],
  goals: ["less_frizz", "moisture"],
}

type Lead = Awaited<ReturnType<ResultArtifactStore["claimLead"]>>

function createStore(initialLead: Lead): ResultArtifactStore & {
  sent: string[]
  failures: Array<{ leadId: string; error: string }>
} {
  let lead = initialLead
  const sent: string[] = []
  const failures: Array<{ leadId: string; error: string }> = []

  return {
    sent,
    failures,
    async claimLead(id) {
      if (!lead || lead.id !== id) return null
      if (lead.artifact_email_status !== null) {
        return null
      }

      lead = { ...lead, artifact_email_status: "sending" }
      return lead
    },
    async markSent(id) {
      sent.push(id)
    },
    async markFailed(id, error) {
      failures.push({ leadId: id, error })
    },
  }
}

function createDeps(store: ResultArtifactStore, sends: CustomerIoTransactionalEmailPayload[] = []) {
  return {
    store,
    siteUrl: "https://chaarlie.de",
    checkRateLimit: async () => ({ allowed: true }),
    isConfigured: () => true,
    send: async (payload: CustomerIoTransactionalEmailPayload) => {
      sends.push(payload)
    },
  }
}

test("claims, sends, and marks the result artifact email sent", async () => {
  const sends: CustomerIoTransactionalEmailPayload[] = []
  const store = createStore({
    id: leadId,
    name: "Lea Beispiel",
    email: "lea@example.com",
    quiz_answers: completeAnswers,
    artifact_email_status: null,
  })

  const response = await handleQuizResultArtifactRequest({ leadId }, createDeps(store, sends))

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { sent: true, skipped: false })
  assert.equal(sends.length, 1)
  assert.equal(sends[0].to, "lea@example.com")
  assert.deepEqual(store.sent, [leadId])
})

test("does not claim or mutate when Customer.io transactional config is missing", async () => {
  let claimCount = 0
  const store = createStore({
    id: leadId,
    name: "Lea Beispiel",
    email: "lea@example.com",
    quiz_answers: completeAnswers,
    artifact_email_status: null,
  })
  const originalClaimLead = store.claimLead
  store.claimLead = async (id) => {
    claimCount += 1
    return originalClaimLead(id)
  }

  const response = await handleQuizResultArtifactRequest(
    { leadId },
    {
      ...createDeps(store),
      isConfigured: () => false,
    },
  )

  assert.equal(response.status, 503)
  assert.equal(claimCount, 0)
  assert.deepEqual(store.sent, [])
  assert.deepEqual(store.failures, [])
})

test("skips when the result artifact email was already sent or is sending", async () => {
  for (const status of ["sent", "sending"] as const) {
    const sends: CustomerIoTransactionalEmailPayload[] = []
    const store = createStore({
      id: leadId,
      name: "Lea Beispiel",
      email: "lea@example.com",
      quiz_answers: completeAnswers,
      artifact_email_status: status,
    })

    const response = await handleQuizResultArtifactRequest({ leadId }, createDeps(store, sends))

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, { sent: false, skipped: true })
    assert.equal(sends.length, 0)
  }
})

test("skips a failed result artifact email until manual retry resets it", async () => {
  const sends: CustomerIoTransactionalEmailPayload[] = []
  const store = createStore({
    id: leadId,
    name: "Lea Beispiel",
    email: "lea@example.com",
    quiz_answers: completeAnswers,
    artifact_email_status: "failed",
  })

  const response = await handleQuizResultArtifactRequest({ leadId }, createDeps(store, sends))

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { sent: false, skipped: true })
  assert.equal(sends.length, 0)
  assert.deepEqual(store.sent, [])
})

test("sends with a blank first name fallback", async () => {
  const sends: CustomerIoTransactionalEmailPayload[] = []
  const store = createStore({
    id: leadId,
    name: null,
    email: "lea@example.com",
    quiz_answers: completeAnswers,
    artifact_email_status: null,
  })

  const response = await handleQuizResultArtifactRequest({ leadId }, createDeps(store, sends))

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { sent: true, skipped: false })
  assert.equal(sends.length, 1)
  assert.equal(sends[0].messageData.first_name, "")
  assert.deepEqual(store.sent, [leadId])
})

test("two calls only send once with an atomic store claim", async () => {
  const sends: CustomerIoTransactionalEmailPayload[] = []
  const store = createStore({
    id: leadId,
    name: "Lea Beispiel",
    email: "lea@example.com",
    quiz_answers: completeAnswers,
    artifact_email_status: null,
  })

  const [first, second] = await Promise.all([
    handleQuizResultArtifactRequest({ leadId }, createDeps(store, sends)),
    handleQuizResultArtifactRequest({ leadId }, createDeps(store, sends)),
  ])

  assert.deepEqual(
    [first.body, second.body],
    [
      { sent: true, skipped: false },
      { sent: false, skipped: true },
    ],
  )
  assert.equal(sends.length, 1)
  assert.deepEqual(store.sent, [leadId])
})

test("send failure marks failed and redacts secret-ish tokens", async () => {
  const store = createStore({
    id: leadId,
    name: "Lea Beispiel",
    email: "lea@example.com",
    quiz_answers: completeAnswers,
    artifact_email_status: null,
  })

  const response = await handleQuizResultArtifactRequest(
    { leadId },
    {
      ...createDeps(store),
      send: async () => {
        throw new Error(`Customer.io failed for secret-token with ${"x".repeat(600)}`)
      },
    },
  )

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { sent: false, skipped: false })
  assert.equal(store.failures.length, 1)
  assert.doesNotMatch(store.failures[0].error, /secret-token/)
  assert.match(store.failures[0].error, /\[redacted\]/)
  assert.ok(store.failures[0].error.length <= 500)
})

test("incomplete quiz answers fail before sending", async () => {
  const sends: CustomerIoTransactionalEmailPayload[] = []
  const store = createStore({
    id: leadId,
    name: "Lea Beispiel",
    email: "lea@example.com",
    quiz_answers: { structure: "wavy" },
    artifact_email_status: null,
  })

  const response = await handleQuizResultArtifactRequest({ leadId }, createDeps(store, sends))

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { sent: false, skipped: false })
  assert.equal(sends.length, 0)
  assert.equal(store.failures.length, 1)
  assert.match(store.failures[0].error, /quiz answers/i)
})
