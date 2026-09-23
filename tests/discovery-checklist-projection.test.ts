import assert from "node:assert/strict"
import test from "node:test"

import {
  ensureDiscoveryQuizProjection,
  type DiscoveryQuizProjectionState,
} from "../src/app/beratung/produkte/quiz-projection"

/**
 * The checklist page's projection gate.
 *
 * `linkQuizToProfile` returns silently on several no-op paths, so "it returned"
 * is not evidence that the quiz landed. The criterion is read back from the
 * database — diagnostics present AND the legacy lead bound — and a mismatch is
 * logged loudly instead of being swallowed, because the participant is then sent
 * back to `/quiz` and nothing else would say why.
 */

const userId = "20000000-0000-4000-8000-000000000002"
const leadId = "60000000-0000-4000-8000-000000000006"
const client = {} as never

function captureErrors<T>(run: () => Promise<T>): Promise<{ value: T; errors: unknown[][] }> {
  const errors: unknown[][] = []
  const original = console.error
  console.error = (...args: unknown[]) => errors.push(args)
  return run()
    .then((value) => ({ value, errors }))
    .finally(() => {
      console.error = original
    })
}

function state(overrides: Partial<DiscoveryQuizProjectionState> = {}) {
  return async () => ({ hasDiagnostics: true, leadBound: true, ...overrides })
}

test("the fresh lead is projected in ordinary mode, with the enrollment's e-mail", async () => {
  const calls: unknown[][] = []
  const { value, errors } = await captureErrors(() =>
    ensureDiscoveryQuizProjection(
      { client, userId, email: "lea@example.test", leadId },
      {
        linkQuizToProfile: (async (...args: unknown[]) => {
          calls.push(args)
        }) as never,
        loadState: state(),
      },
    ),
  )

  assert.deepEqual(value, { hasDiagnostics: true, leadBound: true })
  // No `create_only`: the fresh discovery quiz is the source of truth, including
  // for a re-used existing account (plan §5).
  assert.deepEqual(calls, [[userId, "lea@example.test", leadId]])
  assert.deepEqual(errors, [])
})

test("a silent linkQuizToProfile that achieved nothing is logged loudly", async () => {
  const { value, errors } = await captureErrors(() =>
    ensureDiscoveryQuizProjection(
      { client, userId, email: "lea@example.test", leadId },
      {
        // The exact no-op path: "no matching lead found, skipping".
        linkQuizToProfile: (async () => undefined) as never,
        loadState: state({ hasDiagnostics: false, leadBound: false }),
      },
    ),
  )

  assert.deepEqual(value, { hasDiagnostics: false, leadBound: false })
  assert.equal(errors.length, 1)
  assert.match(String(errors[0][0]), /quiz projection incomplete/)
  assert.deepEqual(errors[0][1], {
    userId,
    leadId,
    linkFailed: false,
    hasDiagnostics: false,
    leadBound: false,
  })
})

test("diagnostics without a bound lead is still incomplete", async () => {
  const { value, errors } = await captureErrors(() =>
    ensureDiscoveryQuizProjection(
      { client, userId, email: "lea@example.test", leadId },
      {
        linkQuizToProfile: (async () => undefined) as never,
        loadState: state({ hasDiagnostics: true, leadBound: false }),
      },
    ),
  )
  assert.equal(value.leadBound, false)
  assert.equal(errors.length, 1)
})

test("a throwing linkQuizToProfile does not take the page down, and is recorded", async () => {
  const { value, errors } = await captureErrors(() =>
    ensureDiscoveryQuizProjection(
      { client, userId, email: "lea@example.test", leadId: null },
      {
        linkQuizToProfile: (async () => {
          throw new Error("lead lookup failed")
        }) as never,
        // A previous visit had already projected everything, so the page still works.
        loadState: state(),
      },
    ),
  )

  assert.deepEqual(value, { hasDiagnostics: true, leadBound: true })
  assert.equal(errors.length, 1)
  assert.match(String(errors[0][0]), /linkQuizToProfile threw/)
})
