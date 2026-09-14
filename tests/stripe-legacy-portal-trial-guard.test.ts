import assert from "node:assert/strict"
import test from "node:test"
import { createLegacyPortalSession } from "../src/lib/stripe/legacy-portal"

const input = {
  userId: "owner",
  customerId: "cus_owner",
  returnUrl: "https://www.chaarlie.de/profile",
}

test("legacy portal refuses trial contracts and incomplete markers before creating a session", async () => {
  for (const row of [
    { trial_enrollment_id: "trial-owned" },
    { metadata: { trial_cohort: "trial_v1" } },
    { trial_access_facts: {} },
  ]) {
    let created = 0
    await assert.rejects(
      createLegacyPortalSession(input, {
        readSubscriptions: async (userId) => {
          assert.equal(userId, "owner")
          return [{ metadata: {} }, row]
        },
        createSession: async () => {
          created++
          return { url: "https://billing.stripe.com/session" }
        },
      }),
      /trial_management_required/,
    )
    assert.equal(created, 0)
  }
})

test("legacy portal preserves old subscribers but never ignores a failed cohort lookup", async () => {
  let created = 0
  const createSession = async (params: { customer: string; return_url: string }) => {
    created++
    assert.deepEqual(params, { customer: "cus_owner", return_url: input.returnUrl })
    return { url: "https://billing.stripe.com/session" }
  }
  assert.equal(
    (
      await createLegacyPortalSession(input, {
        readSubscriptions: async () => [{ metadata: {} }],
        createSession,
      })
    ).url,
    "https://billing.stripe.com/session",
  )
  await assert.rejects(
    createLegacyPortalSession(input, {
      readSubscriptions: async () => {
        throw new Error("database unavailable")
      },
      createSession,
    }),
    /database unavailable/,
  )
  assert.equal(created, 1)
})
