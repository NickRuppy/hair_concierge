import assert from "node:assert/strict"
import test from "node:test"

import { listDiscoveryQuizProgress } from "../src/lib/discovery/quiz-progress"
import type { DiscoveryEnrollmentListRow } from "../src/lib/discovery/enrollment"

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  user: "20000000-0000-4000-8000-000000000002",
  stranger: "20000000-0000-4000-8000-000000000003",
}

const enrollment: DiscoveryEnrollmentListRow = {
  id: ids.enrollment,
  display_name: "Lena M.",
  normalized_email: "lena@example.test",
  token_version: 1,
  claimed_user_id: ids.user,
  claimed_at: "2026-09-19T10:00:00.000Z",
  revoked_at: null,
  created_at: "2026-09-18T10:00:00.000Z",
}

const otherEnrollment: DiscoveryEnrollmentListRow = {
  ...enrollment,
  id: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a2f",
  display_name: "Mira K.",
  normalized_email: "mira@example.test",
  claimed_user_id: "20000000-0000-4000-8000-000000000004",
}

const completeAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  fingertest: "glatt",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: [],
  treatment: ["natur"],
  goals: ["moisture"],
}

type Lead = {
  email: string | null
  user_id: string | null
  quiz_answers: unknown
  created_at: string
}

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    email: enrollment.normalized_email,
    user_id: null,
    quiz_answers: completeAnswers,
    created_at: "2026-09-19T10:15:00.000Z",
    ...overrides,
  }
}

function leadsClient(rows: Lead[], error: Error | null = null) {
  const ranges: Array<[number, number]> = []
  const client = {
    from(table: string) {
      assert.equal(table, "leads")
      const chain = {
        select() {
          return chain
        },
        in() {
          return chain
        },
        eq() {
          return chain
        },
        not() {
          return chain
        },
        order() {
          return chain
        },
        range(from: number, to: number) {
          ranges.push([from, to])
          return Promise.resolve({ data: rows.slice(from, to + 1), error })
        },
      }
      return chain
    },
  }
  return { client: client as never, ranges }
}

test("completed quiz progress accepts a same-account lead that predates the claim", async () => {
  const { client } = leadsClient([
    lead({ user_id: ids.user, created_at: "2026-09-18T10:15:00.000Z" }),
  ])
  const progress = await listDiscoveryQuizProgress([enrollment], client)
  assert.deepEqual(progress.get(ids.enrollment), { completedAt: "2026-09-18T10:15:00.000Z" })
})

test("quiz progress keeps participants on their own matching email and account", async () => {
  const { client } = leadsClient([
    lead({ created_at: "2026-09-19T10:15:00.000Z" }),
    lead({
      email: otherEnrollment.normalized_email,
      user_id: otherEnrollment.claimed_user_id,
      created_at: "2026-09-18T10:15:00.000Z",
    }),
  ])
  const progress = await listDiscoveryQuizProgress([enrollment, otherEnrollment], client)
  assert.deepEqual(progress.get(enrollment.id), { completedAt: "2026-09-19T10:15:00.000Z" })
  assert.deepEqual(progress.get(otherEnrollment.id), { completedAt: "2026-09-18T10:15:00.000Z" })
})

test("quiz progress excludes pre-claim anonymous, foreign-owned, and partial leads", async () => {
  const { client } = leadsClient([
    lead({ created_at: "2026-09-18T10:15:00.000Z" }),
    lead({ user_id: ids.stranger, created_at: "2026-09-20T10:15:00.000Z" }),
    lead({ quiz_answers: { structure: "wavy" }, created_at: "2026-09-20T11:15:00.000Z" }),
    lead({ quiz_answers: { ...completeAnswers, concerns: undefined } }),
  ])
  const progress = await listDiscoveryQuizProgress([enrollment], client)
  assert.equal(progress.size, 0)
})

test("quiz progress accepts a complete historical answer shape after normalizing it", async () => {
  const {
    pulltest: _pulltest,
    scalp_type: _scalpType,
    has_scalp_issue: _hasScalpIssue,
    ...historical
  } = completeAnswers
  const { client } = leadsClient([
    lead({
      quiz_answers: {
        ...historical,
        pulltest: "elastisch",
        scalp: "unauffaellig",
        legacy_note: "kept for old records",
      },
    }),
  ])
  const progress = await listDiscoveryQuizProgress([enrollment], client)
  assert.deepEqual(progress.get(enrollment.id), { completedAt: "2026-09-19T10:15:00.000Z" })
})

test("quiz progress paginates lead reads", async () => {
  const rows = [
    ...Array.from({ length: 200 }, () => lead({ quiz_answers: { structure: "wavy" } })),
    lead({ created_at: "2026-09-20T10:15:00.000Z" }),
  ]
  const { client, ranges } = leadsClient(rows)
  const progress = await listDiscoveryQuizProgress([enrollment], client)
  assert.deepEqual(progress.get(enrollment.id), { completedAt: "2026-09-20T10:15:00.000Z" })
  assert.deepEqual(ranges, [
    [0, 199],
    [200, 399],
  ])
})

test("quiz progress compares claim and lead times as instants and rejects invalid timestamps", async () => {
  const zonedEnrollment = { ...enrollment, claimed_at: "2026-09-19T11:00:00.000+01:00" }
  const { client } = leadsClient([
    lead({ created_at: "2026-09-19T10:30:00.000Z" }),
    lead({ created_at: "not-a-timestamp" }),
  ])
  const progress = await listDiscoveryQuizProgress([zonedEnrollment], client)
  assert.deepEqual(progress.get(zonedEnrollment.id), { completedAt: "2026-09-19T10:30:00.000Z" })
})

test("quiz progress surfaces lead-read failures to the admin boundary", async () => {
  const { client } = leadsClient([], new Error("leads unavailable"))
  await assert.rejects(() => listDiscoveryQuizProgress([enrollment], client), /leads unavailable/)
})
