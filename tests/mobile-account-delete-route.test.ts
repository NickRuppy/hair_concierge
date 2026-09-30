import assert from "node:assert/strict"
import test from "node:test"
import { enableAccountDeletionForTests } from "./helpers/account-deletion-flag"
import type { SupabaseClient } from "@supabase/supabase-js"
import { POST as deleteRoute } from "../src/app/api/mobile/v1/account/delete/route"
import { GET as preflightRoute } from "../src/app/api/mobile/v1/account/delete/preflight/route"
import type { AccountDeletionDeps, AccountDeletionState } from "../src/lib/account-deletion/service"
import {
  handleAccountDeletePost,
  handleAccountDeletePreflight,
  handleAccountDeleteStatus,
  type MobileAccountDeletionDeps,
} from "../src/lib/mobile/account-deletion"
import { MobileError } from "../src/lib/mobile/errors"
import { appStoreEnv, withEnv } from "./helpers/app-store-supabase"

enableAccountDeletionForTests()

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const ADMIN = "44444444-4444-4444-8444-444444444444"
const REQUEST = "33333333-3333-4333-8333-333333333333"

const mobileEnv = {
  ...appStoreEnv,
  MOBILE_API_ENABLED: "true",
  MOBILE_AUTH_MODE: "local",
  MOBILE_AUTH_CALLBACK_URL: "chaarlie-local://auth",
  MOBILE_PILOT_ENABLED: undefined,
  MOBILE_REGISTRATION_ENABLED: undefined,
}

/** In-memory twin of the Task 6 lifecycle RPCs (the SQL is proven in the Postgres test). */
function fakeWorld(options: { webSubscriptions?: number } = {}) {
  const users = new Set([USER, OTHER, ADMIN])
  const ops = new Map<string, { userId: string; state: AccountDeletionState }>()
  const state = {
    failCancel: 0,
    failDelete: false,
    failList: false,
    rateLimited: false,
    statusError: false,
  }
  const signOuts: string[] = []
  const rateKeys: string[] = []
  const cancelled: string[] = []
  const deferred: (() => Promise<unknown>)[] = []
  const settled: string[] = []
  const ok = (data: unknown) => ({ data, error: null })
  const fail = (message: string) => ({ data: null, error: { message } })

  const rpc = async (name: string, args: Record<string, unknown>) => {
    if (name === "check_rate_limit") {
      rateKeys.push(String(args.p_key))
      return ok(!state.rateLimited)
    }
    const op = ops.get(args.p_request_id as string)
    switch (name) {
      case "account_deletion_begin": {
        const userId = args.p_user_id as string
        if (op) return op.userId === userId ? ok({ state: op.state }) : fail("request_id_conflict")
        if (userId === ADMIN) return fail("admin_account")
        if (!users.has(userId)) return fail("account_not_found")
        ops.set(args.p_request_id as string, { userId, state: "requested" })
        return ok({ state: "requested" })
      }
      case "account_deletion_mark_billing_cancelled":
        op!.state = "web_billing_cancelled"
        return ok({ state: op!.state })
      case "delete_account_data":
        if (state.failDelete) return fail("boom")
        users.delete(op!.userId)
        op!.state = "data_deleted"
        return ok({ state: op!.state })
      case "account_deletion_pending_cleanup":
        return ok([])
      case "account_deletion_due_web_refunds":
        settled.push(args.p_request_id as string)
        return ok([])
      case "account_deletion_record_web_subscriptions":
        return ok(1)
      case "account_deletion_status":
        if (state.statusError) return fail("boom")
        return ok(op?.state ?? null)
    }
    throw new Error(`unexpected rpc ${name}`)
  }

  const client = {
    rpc,
    auth: {
      admin: {
        async signOut(token: string) {
          signOuts.push(token)
          // The auth user is already gone after deletion.
          return { error: { message: "user_not_found", status: 404 } }
        },
      },
    },
  } as unknown as SupabaseClient

  const deletionDeps = (): AccountDeletionDeps => ({
    rpc,
    async listWebSubscriptions() {
      if (state.failList) throw new Error("provider down")
      return Array.from({ length: options.webSubscriptions ?? 0 }, (_, i) => ({
        provider: "stripe" as const,
        id: `sub_${i}`,
      }))
    },
    async cancelWebSubscription(subscription) {
      if (state.failCancel > 0) {
        state.failCancel -= 1
        throw new Error("stripe down")
      }
      cancelled.push(subscription.id)
    },
    refundWebSubscription: async () => ({ refundedMinor: 0, paymentRef: null }),
    removeStorageObjects: async () => {},
    deleteCustomerIoPerson: async () => {},
    deletePostHogPerson: async () => {},
    reportCleanupFailure: () => {},
    reportRefundFailure: () => {},
    reportRefundWaiting: () => {},
  })

  const asUser = (userId: string): MobileAccountDeletionDeps => ({
    requireUser: (async (request: Request) => {
      if (!request.headers.get("authorization")) throw new MobileError("unauthorized", 401)
      if (!users.has(userId)) throw new MobileError("unauthorized", 401)
      return { userId, email: "hanna@example.com", token: "provider-token", client }
    }) as never,
    deletionDeps,
    adminClient: () => client,
    defer: (task) => void deferred.push(task),
  })

  return { users, ops, state, signOuts, rateKeys, cancelled, deferred, settled, asUser, client }
}

function post(body: unknown, headers: Record<string, string> = { authorization: "Bearer t" }) {
  return new Request("http://localhost/api/mobile/v1/account/delete", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/mobile/v1/account/delete${path}`, { headers })

async function withMobile(run: () => Promise<void>) {
  const restore = withEnv(mobileEnv)
  const error = console.error
  console.error = () => {}
  try {
    await run()
  } finally {
    console.error = error
    restore()
  }
}

test("the real routes require a bearer and never fall back to cookies", async () => {
  await withMobile(async () => {
    const deleted = await deleteRoute(post({ requestId: REQUEST, confirm: "delete" }, {}))
    assert.equal(deleted.status, 401)
    assert.deepEqual(await deleted.json(), { error: "unauthorized" })
    assert.equal(deleted.headers.get("cache-control"), "no-store")
    const preflight = await preflightRoute(get("/preflight", { cookie: "session=fabricated" }))
    assert.equal(preflight.status, 401)
  })
})

test("the routes fail closed when the native API is off", async () => {
  const restore = withEnv({ MOBILE_API_ENABLED: undefined })
  try {
    const world = fakeWorld()
    const response = await handleAccountDeleteStatus(
      get(`/${REQUEST}`),
      REQUEST,
      world.asUser(USER),
    )
    assert.equal(response.status, 404)
    assert.equal(world.rateKeys.length, 0)
  } finally {
    restore()
  }
})

test("the body is strict: the confirm literal and a UUID requestId are required", async () => {
  await withMobile(async () => {
    const world = fakeWorld()
    for (const body of [
      { requestId: REQUEST },
      { requestId: REQUEST, confirm: "yes" },
      { requestId: REQUEST, confirm: "DELETE" },
      { requestId: "not-a-uuid", confirm: "delete" },
      { confirm: "delete" },
      { requestId: REQUEST, confirm: "delete", userId: OTHER },
      "not json",
    ]) {
      const response = await handleAccountDeletePost(post(body), world.asUser(USER))
      assert.equal(response.status, 400, JSON.stringify(body))
      assert.deepEqual(await response.json(), { error: "invalid_request" })
    }
    assert.equal(world.ops.size, 0)
    assert.equal(world.users.has(USER), true)
  })
})

test("deletion answers deleted, revokes the session best effort and rate-limits per user", async () => {
  await withMobile(async () => {
    const world = fakeWorld({ webSubscriptions: 1 })
    const response = await handleAccountDeletePost(
      post({ requestId: REQUEST, confirm: "delete" }),
      world.asUser(USER),
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: "deleted" })
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(world.users.has(USER), false)
    assert.deepEqual(world.cancelled, ["sub_0"])
    // M7: the refund attempt runs after the response, never inside it.
    assert.deepEqual(world.settled, [])
    assert.equal(world.deferred.length, 1)
    await world.deferred[0]()
    assert.deepEqual(world.settled, [REQUEST])
    assert.deepEqual(world.signOuts, ["provider-token"])
    assert.equal(world.rateKeys.length, 1)
    assert.match(world.rateKeys[0], /^mobile-account-delete:/)
    assert.equal(world.rateKeys[0].includes(USER), false)
  })
})

test("a replay with the same requestId is idempotent while the caller still authenticates", async () => {
  await withMobile(async () => {
    const world = fakeWorld()
    const deps = world.asUser(USER)
    const first = await handleAccountDeletePost(
      post({ requestId: REQUEST, confirm: "delete" }),
      deps,
    )
    assert.equal(first.status, 200)
    // The service replays a finished operation: begin answers its state, nothing reruns.
    world.users.add(USER)
    const replay = await handleAccountDeletePost(
      post({ requestId: REQUEST, confirm: "delete" }),
      deps,
    )
    assert.equal(replay.status, 200)
    assert.deepEqual(await replay.json(), { status: "deleted" })
    assert.equal(world.ops.size, 1)
  })
})

test("a failed web cancellation is a retryable 503 and the same requestId then succeeds", async () => {
  await withMobile(async () => {
    const world = fakeWorld({ webSubscriptions: 1 })
    world.state.failCancel = 1
    const deps = world.asUser(USER)
    const failed = await handleAccountDeletePost(
      post({ requestId: REQUEST, confirm: "delete" }),
      deps,
    )
    assert.equal(failed.status, 503)
    assert.deepEqual(await failed.json(), { error: "billing_cancel_failed" })
    assert.equal(world.users.has(USER), true)
    assert.equal(world.ops.get(REQUEST)?.state, "requested")
    assert.deepEqual(world.signOuts, [])

    const retried = await handleAccountDeletePost(
      post({ requestId: REQUEST, confirm: "delete" }),
      deps,
    )
    assert.equal(retried.status, 200)
    assert.equal(world.users.has(USER), false)
  })
})

test("service errors map to admin_account, request_id_conflict and temporarily_unavailable", async () => {
  await withMobile(async () => {
    const world = fakeWorld()
    const admin = await handleAccountDeletePost(
      post({ requestId: REQUEST, confirm: "delete" }),
      world.asUser(ADMIN),
    )
    assert.equal(admin.status, 403)
    assert.deepEqual(await admin.json(), { error: "admin_account" })

    const other = "55555555-5555-4555-8555-555555555555"
    world.ops.set(other, { userId: OTHER, state: "requested" })
    const conflict = await handleAccountDeletePost(
      post({ requestId: other, confirm: "delete" }),
      world.asUser(USER),
    )
    assert.equal(conflict.status, 409)
    assert.deepEqual(await conflict.json(), { error: "request_id_conflict" })

    world.state.failDelete = true
    const failed = await handleAccountDeletePost(
      post({ requestId: REQUEST, confirm: "delete" }),
      world.asUser(USER),
    )
    assert.equal(failed.status, 503)
    assert.deepEqual(await failed.json(), { error: "temporarily_unavailable" })
    assert.equal(world.users.has(USER), true)
    assert.deepEqual(world.signOuts, [])
  })
})

test("a rate-limited caller gets 429 before anything is deleted", async () => {
  await withMobile(async () => {
    const world = fakeWorld()
    world.state.rateLimited = true
    const response = await handleAccountDeletePost(
      post({ requestId: REQUEST, confirm: "delete" }),
      world.asUser(USER),
    )
    assert.equal(response.status, 429)
    assert.equal(world.ops.size, 0)
  })
})

test("status lookup is unauthenticated, UUID-only and answers only the state", async () => {
  await withMobile(async () => {
    const world = fakeWorld()
    const deps = world.asUser(USER)
    const invalid = await handleAccountDeleteStatus(get("/nope"), "nope", deps)
    assert.equal(invalid.status, 400)

    const unknown = await handleAccountDeleteStatus(get(`/${REQUEST}`), REQUEST, deps)
    assert.equal(unknown.status, 404)
    assert.deepEqual(await unknown.json(), { error: "not_found" })

    await handleAccountDeletePost(post({ requestId: REQUEST, confirm: "delete" }), deps)
    // After deletion the caller cannot authenticate; the lookup needs no bearer.
    const known = await handleAccountDeleteStatus(
      get(`/${REQUEST}`, { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }),
      REQUEST,
      deps,
    )
    assert.equal(known.status, 200)
    assert.deepEqual(await known.json(), { state: "data_deleted" })
    assert.match(world.rateKeys.at(-1)!, /^mobile-account-delete-status-ip:/)
    assert.equal(world.rateKeys.at(-1)!.includes("203.0.113.9"), false)

    world.state.statusError = true
    const unavailable = await handleAccountDeleteStatus(get(`/${REQUEST}`), REQUEST, deps)
    assert.equal(unavailable.status, 503)

    world.state.rateLimited = true
    const limited = await handleAccountDeleteStatus(get(`/${REQUEST}`), REQUEST, deps)
    assert.equal(limited.status, 429)
  })
})

test("preflight reports whether a live web subscription will be cancelled (A1)", async () => {
  await withMobile(async () => {
    const auth = { authorization: "Bearer t" }
    const none = fakeWorld()
    const plain = await handleAccountDeletePreflight(get("/preflight", auth), none.asUser(USER))
    assert.equal(plain.status, 200)
    assert.deepEqual(await plain.json(), { webSubscription: false })

    const subscriber = fakeWorld({ webSubscriptions: 2 })
    const paid = await handleAccountDeletePreflight(
      get("/preflight", auth),
      subscriber.asUser(USER),
    )
    assert.deepEqual(await paid.json(), { webSubscription: true })
    assert.deepEqual(subscriber.cancelled, [])

    subscriber.state.failList = true
    const down = await handleAccountDeletePreflight(
      get("/preflight", auth),
      subscriber.asUser(USER),
    )
    assert.equal(down.status, 503)
    assert.deepEqual(await down.json(), { error: "temporarily_unavailable" })

    const anonymous = await handleAccountDeletePreflight(get("/preflight"), none.asUser(USER))
    assert.equal(anonymous.status, 401)
  })
})
