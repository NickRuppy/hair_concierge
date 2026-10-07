import assert from "node:assert/strict"
import test from "node:test"
import {
  GET as reconcileRoute,
  handleAccountDeletionReconcile,
} from "../src/app/api/account-deletion/reconcile/route"
import { accountDeletionEnabled } from "../src/lib/account-deletion/enabled"
import { handleAppStoreNotificationPost } from "../src/lib/app-store/notifications"
import {
  handleAccountDeletePost,
  handleAccountDeletePreflight,
  handleAccountDeleteStatus,
} from "../src/lib/mobile/account-deletion"
import { handleAppStoreTransactionsPost } from "../src/lib/mobile/app-store-transactions"
import { cancelDeletedAccountStripeSubscription } from "../src/lib/stripe/deleted-account"
import { appStoreEnv, withEnv } from "./helpers/app-store-supabase"

/**
 * The account-deletion / App Store schema lands via migrations after this code is deployed.
 * With ACCOUNT_DELETION_ENABLED unset (or anything but "true") every path that touches that
 * schema must be inert: no database, RPC, Stripe or Apple work, and a defined response.
 */

const USER = "11111111-1111-4111-8111-111111111111"
const REQUEST = "33333333-3333-4333-8333-333333333333"

const off = { ACCOUNT_DELETION_ENABLED: undefined }
const mobileEnv = {
  ...appStoreEnv,
  ...off,
  MOBILE_API_ENABLED: "true",
  MOBILE_AUTH_MODE: "local",
  MOBILE_AUTH_CALLBACK_URL: "chaarlie-local://auth",
  MOBILE_PILOT_ENABLED: undefined,
  MOBILE_REGISTRATION_ENABLED: undefined,
  MOBILE_PAYWALL_ENABLED: "true",
}

/** Any property access is a failure: the guarded path must not touch the object. */
function forbidden(name: string, touched: string[]) {
  return new Proxy({}, { get: (_, key) => void touched.push(`${name}.${String(key)}`) }) as never
}

test("only the exact string true enables the switch", () => {
  const cases: [string | undefined, boolean][] = [
    [undefined, false],
    ["", false],
    ["false", false],
    ["1", false],
    ["TRUE", false],
    [" true", false],
    ["true", true],
  ]
  for (const [value, expected] of cases) {
    const restore = withEnv({ ACCOUNT_DELETION_ENABLED: value })
    try {
      assert.equal(accountDeletionEnabled(), expected, String(value))
    } finally {
      restore()
    }
  }
})

test("off: the Stripe deleted-account check returns false without a DB read or a Stripe call", async () => {
  const restore = withEnv(off)
  const touched: string[] = []
  try {
    assert.equal(
      await cancelDeletedAccountStripeSubscription(
        {
          eventType: "checkout.session.completed",
          subscriptionId: "sub_1",
          metadata: {
            lead_id: "11111111-1111-4111-8111-111111111111",
            trial_enrollment_id: "22222222-2222-4222-8222-222222222222",
          },
        },
        { supabase: forbidden("supabase", touched), stripe: forbidden("stripe", touched) },
      ),
      false,
    )
    assert.deepEqual(touched, [])
  } finally {
    restore()
  }
})

test("off: the reconcile cron still authenticates, then skips without any RPC", async () => {
  const restore = withEnv(off)
  const calls: string[] = []
  const deps = {
    cronSecret: "secret",
    closeOrphans: async () => (calls.push("closeOrphans"), { closed: 0, priorStates: [] }),
    retryCleanup: async () => (calls.push("retryCleanup"), { pending: 0, completed: 0, failed: 0 }),
    retryRefunds: async () => (calls.push("retryRefunds"), { pending: 0, completed: 0, failed: 0 }),
    purge: async () => (calls.push("purge"), { deleted: {}, failed: [] }),
  }
  const request = (token?: string) =>
    new Request("http://localhost/api/account-deletion/reconcile", {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  try {
    assert.equal((await handleAccountDeletionReconcile(request(), deps)).status, 401)
    assert.equal((await handleAccountDeletionReconcile(request("nope"), deps)).status, 401)
    assert.deepEqual(await handleAccountDeletionReconcile(request("secret"), deps), {
      status: 200,
      body: { skipped: "account_deletion_disabled" },
    })
    assert.deepEqual(calls, [])
  } finally {
    restore()
  }

  // The real route: the same gate, wired to the production dependencies.
  const restoreRoute = withEnv({ ...appStoreEnv, ...off, CRON_SECRET: "secret" })
  const originalFetch = globalThis.fetch
  const requests: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input))
    throw new Error("must not fetch")
  }) as typeof fetch
  try {
    const response = await reconcileRoute(request("secret"))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { skipped: "account_deletion_disabled" })
    assert.equal((await reconcileRoute(request("wrong"))).status, 401)
    assert.deepEqual(requests, [])
  } finally {
    globalThis.fetch = originalFetch
    restoreRoute()
  }
})

test("off: the mobile deletion endpoints answer 503 temporarily_unavailable after auth, with no DB work", async () => {
  const restore = withEnv(mobileEnv)
  const touched: string[] = []
  const deferred: unknown[] = []
  const deps = {
    requireUser: (async () => ({
      userId: USER,
      email: "hanna@example.com",
      token: "t",
      client: forbidden("client", touched),
    })) as never,
    deletionDeps: (() => {
      touched.push("deletionDeps")
      throw new Error("must not be built")
    }) as never,
    adminClient: (() => {
      touched.push("adminClient")
      throw new Error("must not be built")
    }) as never,
    defer: (task: unknown) => void deferred.push(task),
  }
  const expected = { error: "temporarily_unavailable" }
  try {
    const post = await handleAccountDeletePost(
      new Request("http://localhost/api/mobile/v1/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer t" },
        body: JSON.stringify({ requestId: REQUEST, confirm: "delete" }),
      }),
      deps,
    )
    assert.equal(post.status, 503)
    assert.deepEqual(await post.json(), expected)
    const preflight = await handleAccountDeletePreflight(
      new Request("http://localhost/api/mobile/v1/account/delete/preflight", {
        headers: { authorization: "Bearer t" },
      }),
      deps,
    )
    assert.equal(preflight.status, 503)
    assert.deepEqual(await preflight.json(), expected)
    const status = await handleAccountDeleteStatus(
      new Request(`http://localhost/api/mobile/v1/account/delete/${REQUEST}`),
      REQUEST,
      deps,
    )
    assert.equal(status.status, 503)
    assert.deepEqual(await status.json(), expected)
    assert.deepEqual(touched, [])
    assert.deepEqual(deferred, [], "no deferred settle work is started")
  } finally {
    restore()
  }
})

test("off: the App Store transactions endpoint is 503 after auth, with no database or Apple work", async () => {
  const restore = withEnv(mobileEnv)
  const paths: string[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = new URL(String(input instanceof Request ? input.url : input)).pathname
    paths.push(path)
    if (path === "/auth/v1/user")
      return Response.json({
        id: USER,
        email: "hanna@example.com",
        is_anonymous: false,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00Z",
      })
    throw new Error(`unexpected request ${path}`)
  }) as typeof fetch
  try {
    const response = await handleAppStoreTransactionsPost(
      new Request("http://localhost/api/mobile/v1/app-store/transactions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer raw-token" },
        body: JSON.stringify({ signedTransactions: ["jws"] }),
      }),
      {
        verifier: () => {
          throw new Error("must not verify")
        },
      },
    )
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
    assert.deepEqual(
      paths.filter((path) => path !== "/auth/v1/user"),
      [],
    )
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test("off: Apple's notification webhook answers a retryable 503 with no verification or database access", async () => {
  const restore = withEnv({ ...appStoreEnv, ...off })
  const originalFetch = globalThis.fetch
  const requests: string[] = []
  const verified: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input))
    throw new Error("must not fetch")
  }) as typeof fetch
  try {
    const response = await handleAppStoreNotificationPost(
      new Request("http://localhost/api/app-store/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedPayload: "a.b.c" }),
      }),
      {
        verifier: () => {
          verified.push("verifier")
          throw new Error("must not verify")
        },
      },
    )
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: "temporarily_unavailable" })
    assert.deepEqual(requests, [])
    assert.deepEqual(verified, [])
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})
