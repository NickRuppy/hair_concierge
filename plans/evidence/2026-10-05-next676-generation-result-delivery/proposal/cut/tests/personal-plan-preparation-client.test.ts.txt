import assert from "node:assert/strict"
import test from "node:test"

import {
  clearPendingPersonalPlanPreparationCredential,
  createPendingPersonalPlanPreparationCredential,
  isPendingPersonalPlanPreparationCredentialFresh,
  loadPendingPersonalPlanPreparationCredential,
  parsePersonalPlanPreparationRetryAfterSeconds,
  runPersonalPlanPreparationRequest,
  savePendingPersonalPlanPreparationCredential,
} from "../src/lib/personal-plan-quiz/preparation-client"

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

const cryptoFixture = {
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
    if (array instanceof Uint8Array) {
      for (let index = 0; index < array.length; index += 1) array[index] = index
    }
    return array
  },
}

test("preparation credentials use a Web Crypto UUID and 32-byte claim token", () => {
  const credential = createPendingPersonalPlanPreparationCredential(
    "answers-a",
    cryptoFixture,
    1_000,
  )

  assert.deepEqual(credential, {
    preparationId: "00010203-0405-4607-8809-0a0b0c0d0e0f",
    claimToken: "EBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8",
    answersKey: "answers-a",
    createdAt: 1_000,
  })
})

test("pending preparation survives a lost response only for the same fresh answers", () => {
  const target = storage()
  const credential = createPendingPersonalPlanPreparationCredential(
    "answers-a",
    cryptoFixture,
    1_000,
  )
  savePendingPersonalPlanPreparationCredential(target, credential)

  assert.deepEqual(
    loadPendingPersonalPlanPreparationCredential(target, "answers-a", 1_000 + 49 * 60_000),
    credential,
  )
  assert.equal(
    isPendingPersonalPlanPreparationCredentialFresh(credential, "answers-a", 1_000 + 49 * 60_000),
    true,
  )
  assert.equal(
    isPendingPersonalPlanPreparationCredentialFresh(credential, "answers-a", 1_000 + 51 * 60_000),
    false,
  )
  assert.equal(
    loadPendingPersonalPlanPreparationCredential(target, "answers-b", 1_000 + 49 * 60_000),
    null,
  )
  assert.equal(
    loadPendingPersonalPlanPreparationCredential(target, "answers-a", 1_000 + 51 * 60_000),
    null,
  )

  savePendingPersonalPlanPreparationCredential(target, credential)
  clearPendingPersonalPlanPreparationCredential(target)
  assert.equal(loadPendingPersonalPlanPreparationCredential(target, "answers-a", 2_000), null)
})

test("preparation Retry-After accepts only the bounded short-window contract", () => {
  assert.equal(parsePersonalPlanPreparationRetryAfterSeconds("1"), 1)
  assert.equal(parsePersonalPlanPreparationRetryAfterSeconds("10"), 10)
  for (const value of [null, "", "0", "11", "1.5", "later", "-1"]) {
    assert.equal(parsePersonalPlanPreparationRetryAfterSeconds(value), null)
  }
})

function readyResponse(claimToken = "expected-claim-token-with-at-least-forty-characters") {
  return new Response(
    JSON.stringify({
      artifactId: "22222222-2222-4222-8222-222222222222",
      claimToken,
      expiresAt: "2026-09-01T18:00:00.000Z",
      status: "ready",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  )
}

const expectedClaimToken = "expected-claim-token-with-at-least-forty-characters"
const expectedPreparationId = "22222222-2222-4222-8222-222222222222"

test("one 429 waits for the short server boundary and retries exactly once", async () => {
  const waits: number[] = []
  const calls: number[] = []
  const result = await runPersonalPlanPreparationRequest({
    fetch: async () => {
      calls.push(calls.length + 1)
      return calls.length === 1
        ? new Response(null, { status: 429, headers: { "retry-after": "3" } })
        : readyResponse()
    },
    body: { answers: {} },
    expectedPreparationId,
    expectedClaimToken,
    wait: async (milliseconds) => {
      waits.push(milliseconds)
    },
  })

  assert.deepEqual(calls, [1, 2])
  assert.deepEqual(waits, [3_000])
  assert.deepEqual(result, {
    status: "ready",
    artifactId: "22222222-2222-4222-8222-222222222222",
    claimToken: expectedClaimToken,
    expiresAt: "2026-09-01T18:00:00.000Z",
  })
})

test("preparation detaches an injected browser fetch before calling it", async () => {
  let observedThis: unknown = "not-called"
  const browserFetch = function (this: unknown) {
    observedThis = this
    return Promise.resolve(readyResponse())
  }
  const result = await runPersonalPlanPreparationRequest({
    fetch: browserFetch as typeof fetch,
    body: {},
    expectedPreparationId,
    expectedClaimToken,
  })

  assert.equal(observedThis, undefined)
  assert.equal(result.status, "ready")
})

test("credential conflicts and mismatched success receipts discard only the poisoned credential", async () => {
  const conflict = await runPersonalPlanPreparationRequest({
    fetch: async () => new Response(null, { status: 409 }),
    body: {},
    expectedPreparationId,
    expectedClaimToken,
  })
  assert.deepEqual(conflict, {
    status: "error",
    error: "Preparation credential conflicted",
    discardCredential: true,
  })

  const mismatched = await runPersonalPlanPreparationRequest({
    fetch: async () => readyResponse("different-claim-token-with-at-least-forty-characters"),
    body: {},
    expectedPreparationId,
    expectedClaimToken,
  })
  assert.deepEqual(mismatched, {
    status: "error",
    error: "Preparation response is incomplete",
    discardCredential: true,
  })
})

test("a second 429 or invalid wait contract stops without a third request", async () => {
  for (const retryAfter of ["3", "3600", null]) {
    let calls = 0
    const waits: number[] = []
    const result = await runPersonalPlanPreparationRequest({
      fetch: async () => {
        calls += 1
        return new Response(null, {
          status: 429,
          headers: retryAfter ? { "retry-after": retryAfter } : undefined,
        })
      },
      body: {},
      expectedPreparationId,
      expectedClaimToken,
      wait: async (milliseconds) => {
        waits.push(milliseconds)
      },
    })
    assert.equal(result.status, "error")
    assert.equal(calls, retryAfter === "3" ? 2 : 1)
    assert.deepEqual(waits, retryAfter === "3" ? [3_000] : [])
  }
})

test("non-rate failures retain one bounded retry but ordinary 4xx stops", async () => {
  let calls = 0
  const waits: number[] = []
  const recovered = await runPersonalPlanPreparationRequest({
    fetch: async () => {
      calls += 1
      if (calls === 1) throw new Error("network")
      return readyResponse()
    },
    body: {},
    expectedPreparationId,
    expectedClaimToken,
    wait: async (milliseconds) => {
      waits.push(milliseconds)
    },
  })
  assert.equal(recovered.status, "ready")
  assert.equal(calls, 2)
  assert.deepEqual(waits, [250])

  calls = 0
  const rejected = await runPersonalPlanPreparationRequest({
    fetch: async () => {
      calls += 1
      return new Response(null, { status: 400 })
    },
    body: {},
    expectedPreparationId,
    expectedClaimToken,
  })
  assert.equal(rejected.status, "error")
  assert.equal(calls, 1)
  if (rejected.status === "error") assert.equal(rejected.discardCredential, false)
})
