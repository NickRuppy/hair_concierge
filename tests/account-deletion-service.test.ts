import assert from "node:assert/strict"
import test from "node:test"
import { handleAccountDeletionReconcile } from "../src/app/api/account-deletion/reconcile/route"
import { cancelWebSubscriptionWith } from "../src/lib/account-deletion/runtime"
import {
  AccountDeletionError,
  getAccountDeletionStatus,
  requestAccountDeletion,
  retryAccountDeletionCleanup,
  type AccountDeletionDeps,
  type AccountDeletionState,
} from "../src/lib/account-deletion/service"
import { reportAccountDeletionCleanupFailure } from "../src/lib/observability/account-deletion"

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const REQUEST = "33333333-3333-4333-8333-333333333333"

type Op = {
  userId: string | null
  email: string | null
  state: AccountDeletionState
  storagePaths: string[]
  attempts: number
}

/** In-memory twin of the SQL lifecycle functions (the real ones are proven in the Postgres test). */
function fakeDatabase() {
  const users = new Set([USER, OTHER])
  const ops = new Map<string, Op>()
  const calls: string[] = []
  const ok = (data: unknown) => ({ data, error: null })
  const fail = (message: string) => ({ data: null, error: { message } })
  const rpc: AccountDeletionDeps["rpc"] = async (name, args) => {
    calls.push(name)
    const requestId = args.p_request_id as string
    const op = ops.get(requestId)
    switch (name) {
      case "account_deletion_begin": {
        const userId = args.p_user_id as string
        if (op) {
          if (op.userId !== userId && (op.userId !== null || users.has(userId)))
            return fail("request_id_conflict")
          return ok({ state: op.state })
        }
        if (!users.has(userId)) return fail("account_not_found")
        ops.set(requestId, {
          userId,
          email: "hanna@example.com",
          state: "requested",
          storagePaths: [],
          attempts: 0,
        })
        return ok({ state: "requested" })
      }
      case "account_deletion_mark_billing_cancelled":
        if (op!.state === "requested") op!.state = "web_billing_cancelled"
        return ok({ state: op!.state })
      case "delete_account_data":
        if (op!.state === "web_billing_cancelled") {
          users.delete(op!.userId!)
          op!.state = "data_deleted"
          op!.storagePaths = [`${op!.userId}/sub/front.jpg`]
        }
        return ok({ state: op!.state, storagePaths: op!.storagePaths })
      case "account_deletion_pending_cleanup":
        return ok(
          [...ops.entries()]
            .filter(
              ([id, o]) =>
                o.state === "data_deleted" && (!args.p_request_id || id === args.p_request_id),
            )
            .map(([id, o]) => ({
              requestId: id,
              userId: o.userId,
              email: o.email,
              storagePaths: o.storagePaths,
              externalAttempts: o.attempts,
            })),
        )
      case "account_deletion_record_external_failure":
        op!.attempts += 1
        return ok({ state: op!.state, externalAttempts: op!.attempts })
      case "account_deletion_complete":
        Object.assign(op!, {
          state: "external_cleanup_done",
          userId: null,
          email: null,
          storagePaths: [],
        })
        return ok({ state: op!.state })
      case "account_deletion_status":
        return ok(op?.state ?? null)
      default:
        throw new Error(`unexpected rpc ${name}`)
    }
  }
  return { users, ops, calls, rpc }
}

function deps(db: ReturnType<typeof fakeDatabase>, overrides: Partial<AccountDeletionDeps> = {}) {
  const log = {
    cancelled: [] as string[],
    removed: [] as string[][],
    customerIo: [] as string[],
    posthog: [] as string[],
    reports: [] as { errorCode: string; attempts: number }[],
  }
  const value: AccountDeletionDeps = {
    rpc: db.rpc,
    listWebSubscriptions: async () => [{ provider: "paypal", id: "I-HANNA" }],
    cancelWebSubscription: async (s) => void log.cancelled.push(s.id),
    removeStorageObjects: async (paths) => void log.removed.push(paths),
    deleteCustomerIoPerson: async (identifier) => void log.customerIo.push(identifier),
    deletePostHogPerson: async (id) => void log.posthog.push(id),
    reportCleanupFailure: (details) => void log.reports.push(details),
    ...overrides,
  }
  return { value, log }
}

test("a web cancellation failure keeps the account and the state requested; the same request retries", async () => {
  const db = fakeDatabase()
  const failing = deps(db, {
    cancelWebSubscription: async () => {
      throw new Error("PayPal 503")
    },
  })
  await assert.rejects(
    requestAccountDeletion({ userId: USER, requestId: REQUEST }, failing.value),
    (error) => error instanceof AccountDeletionError && error.code === "web_billing_cancel_failed",
  )
  assert.equal(db.ops.get(REQUEST)!.state, "requested")
  assert.ok(db.users.has(USER), "account kept")
  assert.ok(!db.calls.includes("delete_account_data"))

  const working = deps(db)
  assert.deepEqual(
    await requestAccountDeletion({ userId: USER, requestId: REQUEST }, working.value),
    {
      state: "external_cleanup_done",
    },
  )
  assert.deepEqual(working.log.cancelled, ["I-HANNA"])
  assert.deepEqual(working.log.removed, [[`${USER}/sub/front.jpg`]])
  assert.deepEqual(working.log.customerIo, [USER, "hanna@example.com"])
  assert.deepEqual(working.log.posthog, [USER])
  assert.ok(!db.users.has(USER))
})

test("an external failure keeps data_deleted; the cron retries until done and reports from the 5th attempt", async () => {
  const db = fakeDatabase()
  const failing = deps(db, {
    deletePostHogPerson: async () => {
      throw new Error("PostHog 500")
    },
  })
  assert.deepEqual(
    await requestAccountDeletion({ userId: USER, requestId: REQUEST }, failing.value),
    {
      state: "data_deleted",
    },
  )
  assert.ok(!db.users.has(USER), "the account is gone once data is deleted")
  assert.equal(db.ops.get(REQUEST)!.attempts, 1)
  for (let run = 0; run < 4; run++) await retryAccountDeletionCleanup(failing.value)
  assert.equal(db.ops.get(REQUEST)!.attempts, 5)
  assert.deepEqual(failing.log.reports, [{ errorCode: "posthog_failed", attempts: 5 }])

  const working = deps(db)
  assert.deepEqual(await retryAccountDeletionCleanup(working.value), {
    pending: 1,
    completed: 1,
    failed: 0,
  })
  assert.equal(db.ops.get(REQUEST)!.state, "external_cleanup_done")
  assert.equal(db.ops.get(REQUEST)!.userId, null)
  assert.deepEqual(await retryAccountDeletionCleanup(working.value), {
    pending: 0,
    completed: 0,
    failed: 0,
  })
})

test("response loss: the status lookup and a replay report completion without repeating work", async () => {
  const db = fakeDatabase()
  const first = deps(db)
  await requestAccountDeletion({ userId: USER, requestId: REQUEST }, first.value)
  assert.equal(await getAccountDeletionStatus(REQUEST, first.value), "external_cleanup_done")
  assert.equal(
    await getAccountDeletionStatus("44444444-4444-4444-8444-444444444444", first.value),
    null,
  )
  const replay = deps(db)
  assert.deepEqual(
    await requestAccountDeletion({ userId: USER, requestId: REQUEST }, replay.value),
    {
      state: "external_cleanup_done",
    },
  )
  assert.deepEqual(replay.log.cancelled, [])
  assert.equal(db.calls.filter((call) => call === "delete_account_data").length, 1)
})

test("a request id reused by another account is rejected, in progress and after completion", async () => {
  const db = fakeDatabase()
  const stalled = deps(db, {
    deletePostHogPerson: async () => {
      throw new Error("PostHog down")
    },
  })
  assert.equal(
    (await requestAccountDeletion({ userId: USER, requestId: REQUEST }, stalled.value)).state,
    "data_deleted",
  )
  const conflict = (error: unknown) =>
    error instanceof AccountDeletionError && error.code === "request_id_conflict"
  await assert.rejects(
    requestAccountDeletion({ userId: OTHER, requestId: REQUEST }, deps(db).value),
    conflict,
  )
  await retryAccountDeletionCleanup(deps(db).value)
  assert.equal(db.ops.get(REQUEST)!.state, "external_cleanup_done")
  await assert.rejects(
    requestAccountDeletion({ userId: OTHER, requestId: REQUEST }, deps(db).value),
    conflict,
  )
  assert.ok(db.users.has(OTHER))
})

test("web cancellation is immediate without proration and a no-op for ended agreements", async () => {
  const stripeCalls: unknown[] = []
  const paypalCalls: string[] = []
  const stripeStatus = new Map([
    ["sub_live", "active"],
    ["sub_gone", "canceled"],
  ])
  const paypalStatus = new Map([
    ["I-LIVE", "ACTIVE"],
    ["I-GONE", "CANCELLED"],
    ["I-PENDING", "APPROVAL_PENDING"],
  ])
  const providers = {
    stripe: () => ({
      retrieve: async (id: string) => {
        if (!stripeStatus.has(id))
          throw Object.assign(new Error("No such subscription"), { code: "resource_missing" })
        return { status: stripeStatus.get(id)! }
      },
      cancel: async (id: string, params: unknown) => void stripeCalls.push([id, params]),
    }),
    paypal: {
      retrieve: async (id: string) => ({ status: paypalStatus.get(id) }),
      cancel: async (id: string) => void paypalCalls.push(id),
    },
  }
  for (const id of ["sub_live", "sub_gone", "sub_missing"])
    await cancelWebSubscriptionWith({ provider: "stripe", id }, providers)
  for (const id of ["I-LIVE", "I-GONE", "I-PENDING"])
    await cancelWebSubscriptionWith({ provider: "paypal", id }, providers)
  assert.deepEqual(stripeCalls, [["sub_live", { prorate: false, invoice_now: false }]])
  assert.deepEqual(paypalCalls, ["I-LIVE"])
})

test("cron route: bearer auth, orphans closed, 503 while cleanup or purge fails, purge failures reported", async () => {
  const request = (token?: string) =>
    new Request("https://chaarlie.de/api/account-deletion/reconcile", {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  const reports: unknown[] = []
  let purges = 0
  const deps = (failed: number, purgeFailed: string[] = []) => ({
    cronSecret: "secret",
    closeOrphans: async () => 1,
    retryCleanup: async () => ({ pending: 1, completed: 1 - failed, failed }),
    purge: async () => {
      purges += 1
      return { deleted: { "public.leads": 2 }, failed: purgeFailed }
    },
    reportPurgeFailure: (details: { table: string }) => void reports.push(details),
  })
  assert.equal((await handleAccountDeletionReconcile(request(), deps(0))).status, 401)
  assert.equal((await handleAccountDeletionReconcile(request("nope"), deps(0))).status, 401)
  assert.deepEqual(await handleAccountDeletionReconcile(request("secret"), deps(0)), {
    status: 200,
    body: {
      orphansClosed: 1,
      cleanup: { pending: 1, completed: 1, failed: 0 },
      purged: { deleted: { "public.leads": 2 }, failed: [] },
    },
  })
  assert.equal((await handleAccountDeletionReconcile(request("secret"), deps(1))).status, 503)
  assert.equal(
    (await handleAccountDeletionReconcile(request("secret"), deps(0, ["public.leads"]))).status,
    503,
  )
  assert.deepEqual(reports, [{ table: "public.leads" }])
  assert.equal(purges, 3)
  assert.equal(
    (
      await handleAccountDeletionReconcile(request("secret"), {
        ...deps(0),
        retryCleanup: async () => Promise.reject(new Error("db down")),
      })
    ).status,
    503,
  )
})

test("the Sentry report carries only the machine code and attempt count", () => {
  const captured: {
    tags: Record<string, string>
    context: Record<string, unknown>
    error: unknown
  }[] = []
  const sink = {
    withScope(callback: (scope: never) => void) {
      const entry = {
        tags: {} as Record<string, string>,
        context: {} as Record<string, unknown>,
        error: null as unknown,
      }
      captured.push(entry)
      callback({
        setTag: (k: string, v: string) => void (entry.tags[k] = v),
        setContext: (_: string, c: Record<string, unknown>) => void (entry.context = c),
        setLevel: () => undefined,
      } as never)
    },
    captureException(error: unknown) {
      captured.at(-1)!.error = error
    },
  }
  reportAccountDeletionCleanupFailure({ errorCode: "posthog_failed", attempts: 5 }, sink)
  reportAccountDeletionCleanupFailure({ errorCode: "hanna@example.com", attempts: 6 }, sink)
  assert.deepEqual(captured[0].context, { error_code: "posthog_failed", attempts: 5 })
  assert.equal(captured[1].tags["account_deletion.error_code"], "unknown")
  assert.equal((captured[0].error as Error).message, "account_deletion_external_cleanup_failed")
})
