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
  type WebRefundDue,
  AccountDeletionRefundManualError,
  AccountDeletionRefundPendingError,
  retryAccountDeletionWebRefunds,
  settleAccountDeletionWebRefunds,
} from "../src/lib/account-deletion/service"
import {
  reportAccountDeletionCleanupFailure,
  reportAccountDeletionRefundFailure,
} from "../src/lib/observability/account-deletion"

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const REQUEST = "33333333-3333-4333-8333-333333333333"

type Refund = {
  requestId: string
  kind: "deletion" | "post_deletion"
  paymentsFrom: string | null
  state: "recorded" | "due" | "done" | "failed_manual"
  attempts: number
  refundedMinor: number | null
  plannedMinor: number | null
  plannedPaymentRef: string | null
}

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
  const refunds = new Map<string, Refund>()
  let failMark = 0
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
        // Latest request wins; its recorded refunds move along (I1).
        for (const [id, o] of [...ops.entries()])
          if (
            o.userId === userId &&
            (o.state === "requested" || o.state === "web_billing_cancelled")
          ) {
            for (const r of refunds.values())
              if (r.requestId === id && r.state === "recorded") r.requestId = requestId
            ops.delete(id)
          }
        ops.set(requestId, {
          userId,
          email: "hanna@example.com",
          state: "requested",
          storagePaths: [],
          attempts: 0,
        })
        return ok({ state: "requested" })
      }
      case "account_deletion_record_web_subscriptions": {
        if (op?.state !== "requested") return fail("operation_not_requested")
        for (const s of args.p_subscriptions as { provider: string; id: string }[]) {
          const existing = refunds.get(`${s.provider}:${s.id}`)
          if (!existing)
            refunds.set(`${s.provider}:${s.id}`, {
              requestId,
              kind: "deletion",
              paymentsFrom: null,
              state: "recorded",
              attempts: 0,
              refundedMinor: null,
              plannedMinor: null,
              plannedPaymentRef: null,
            })
          else if (existing.state === "recorded") existing.requestId = requestId
        }
        return ok(1)
      }
      case "account_deletion_mark_billing_cancelled":
        if (failMark > 0) {
          failMark -= 1
          return fail("connection reset")
        }
        if (op!.state === "requested") op!.state = "web_billing_cancelled"
        for (const r of refunds.values())
          if (r.requestId === requestId && r.state === "recorded") r.state = "due"
        return ok({ state: op!.state })
      case "account_deletion_due_web_refunds":
        return ok(
          [...refunds.entries()]
            .filter(
              ([, r]) =>
                r.state === "due" && (!args.p_request_id || r.requestId === args.p_request_id),
            )
            .map(([key, r]) => ({
              provider: key.split(":")[0],
              subscriptionId: key.split(":")[1],
              requestId: r.requestId,
              kind: r.kind,
              recordedAt: "2026-09-28T10:00:00Z",
              paymentsFrom: r.paymentsFrom,
              attempts: r.attempts,
              plannedMinor: r.plannedMinor,
              plannedPaymentRef: r.plannedPaymentRef,
            })),
        )
      case "account_deletion_web_refund_result": {
        const r = refunds.get(`${args.p_provider}:${args.p_subscription_id}`)
        if (r?.state !== "due") return fail("refund_not_due")
        if (args.p_error_code === null) {
          r.state = "done"
          r.refundedMinor = args.p_refunded_minor as number
        } else {
          r.attempts += 1
          if (args.p_manual || r.attempts >= 10) r.state = "failed_manual"
        }
        return ok({ state: r.state, attempts: r.attempts })
      }
      case "account_deletion_record_post_deletion_refund": {
        const key = `${args.p_provider}:${args.p_subscription_id}`
        const existing = refunds.get(key)
        // I-1: a deletion row that paid nothing out is taken over.
        if (
          existing &&
          !(
            existing.kind === "deletion" &&
            existing.state === "done" &&
            existing.refundedMinor === 0
          )
        )
          return ok(false)
        refunds.set(key, {
          requestId: crypto.randomUUID(),
          kind: "post_deletion",
          paymentsFrom: args.p_payments_from as string,
          state: "due",
          attempts: 0,
          refundedMinor: null,
          plannedMinor: null,
          plannedPaymentRef: null,
        })
        return ok(true)
      }
      case "account_deletion_web_refund_plan": {
        const r = refunds.get(`${args.p_provider}:${args.p_subscription_id}`)
        if (r?.state !== "due") return fail("refund_not_due")
        r.plannedMinor = args.p_planned_minor as number
        r.plannedPaymentRef = args.p_payment_ref as string
        return ok(null)
      }
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
  return {
    users,
    ops,
    refunds,
    calls,
    rpc,
    failMarkOnce: () => void (failMark = 1),
  }
}

function deps(db: ReturnType<typeof fakeDatabase>, overrides: Partial<AccountDeletionDeps> = {}) {
  const log = {
    cancelled: [] as string[],
    refunded: [] as WebRefundDue[],
    removed: [] as string[][],
    customerIo: [] as string[],
    posthog: [] as string[],
    reports: [] as { errorCode: string; attempts: number }[],
    refundReports: [] as {
      provider: string
      errorCode: string
      attempts: number
      manual: boolean
    }[],
  }
  const value: AccountDeletionDeps = {
    rpc: db.rpc,
    listWebSubscriptions: async () => [{ provider: "paypal", id: "I-HANNA" }],
    cancelWebSubscription: async (s) => void log.cancelled.push(s.id),
    refundWebSubscription: async (refund, hooks) => {
      await hooks.plan({ amountMinor: 750, paymentRef: "PAY-1" })
      log.refunded.push(refund)
      return { refundedMinor: 750, paymentRef: "PAY-1" }
    },
    removeStorageObjects: async (paths) => void log.removed.push(paths),
    deleteCustomerIoPerson: async (identifier) => void log.customerIo.push(identifier),
    deletePostHogPerson: async (id) => void log.posthog.push(id),
    reportCleanupFailure: (details) => void log.reports.push(details),
    reportRefundFailure: (details) => void log.refundReports.push(details),
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
  // Recorded before the cancel, but no refund is due while the cancellation failed.
  assert.equal(db.refunds.get("paypal:I-HANNA")!.state, "recorded")
  assert.deepEqual(failing.log.refunded, [])

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
  // M7: the request itself never waits on refunds; the route defers the first attempt.
  assert.equal(working.log.refunded.length, 0)
  assert.equal(db.refunds.get("paypal:I-HANNA")!.state, "due")
  assert.deepEqual(await settleAccountDeletionWebRefunds(working.value, REQUEST), {
    pending: 1,
    completed: 1,
    manual: 0,
    waiting: 0,
    failed: 0,
  })
  assert.deepEqual(
    working.log.refunded.map((r) => [r.provider, r.subscriptionId, r.requestId]),
    [["paypal", "I-HANNA", REQUEST]],
  )
  assert.equal(db.refunds.get("paypal:I-HANNA")!.state, "done")
  assert.equal(db.refunds.get("paypal:I-HANNA")!.plannedPaymentRef, "PAY-1")
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
  const orphanReports: unknown[] = []
  let purges = 0
  const deps = (failed: number, purgeFailed: string[] = [], refundsFailed = 0) => ({
    cronSecret: "secret",
    closeOrphans: async () => ({
      closed: 2,
      priorStates: ["requested", "web_billing_cancelled"] as (
        | "requested"
        | "web_billing_cancelled"
      )[],
    }),
    retryCleanup: async () => ({ pending: 1, completed: 1 - failed, failed }),
    retryRefunds: async () => ({ pending: 1, completed: 1 - refundsFailed, failed: refundsFailed }),
    purge: async () => {
      purges += 1
      return { deleted: { "public.leads": 2 }, failed: purgeFailed }
    },
    reportPurgeFailure: (details: { table: string }) => void reports.push(details),
    reportOrphanClosed: (details: { priorState: string }) => void orphanReports.push(details),
  })
  assert.equal((await handleAccountDeletionReconcile(request(), deps(0))).status, 401)
  assert.equal((await handleAccountDeletionReconcile(request("nope"), deps(0))).status, 401)
  assert.deepEqual(await handleAccountDeletionReconcile(request("secret"), deps(0)), {
    status: 200,
    body: {
      orphansClosed: 2,
      cleanup: { pending: 1, completed: 1, failed: 0 },
      refunds: { pending: 1, completed: 1, failed: 0 },
      purged: { deleted: { "public.leads": 2 }, failed: [] },
    },
  })
  assert.equal((await handleAccountDeletionReconcile(request("secret"), deps(1))).status, 503)
  assert.equal(
    (await handleAccountDeletionReconcile(request("secret"), deps(0, [], 1))).status,
    503,
  )
  assert.equal(
    (await handleAccountDeletionReconcile(request("secret"), deps(0, ["public.leads"]))).status,
    503,
  )
  assert.deepEqual(reports, [{ table: "public.leads" }])
  // Only a close before web billing was cancelled is reported (once per cron run here).
  assert.equal(orphanReports.length, 4)
  assert.ok(orphanReports.every((r) => JSON.stringify(r) === '{"priorState":"requested"}'))
  assert.equal(purges, 4)
  assert.equal(
    (
      await handleAccountDeletionReconcile(request("secret"), {
        ...deps(0),
        retryCleanup: async () => Promise.reject(new Error("db down")),
      })
    ).status,
    503,
  )
  // Steps are isolated: a refund outage never skips the purge (M7).
  const before = purges
  const isolated = await handleAccountDeletionReconcile(request("secret"), {
    ...deps(0),
    retryRefunds: async () => Promise.reject(new Error("Stripe down")),
  })
  assert.equal(isolated.status, 503)
  assert.equal(purges, before + 1)
  assert.deepEqual(isolated.body.refunds, { error: "temporarily_unavailable" })
  assert.deepEqual(isolated.body.cleanup, { pending: 1, completed: 1, failed: 0 })
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

test("a refund failure never blocks the deletion; the cron retries once done and reports from the 5th attempt", async () => {
  const db = fakeDatabase()
  let refundCalls = 0
  const failing = deps(db, {
    refundWebSubscription: async () => {
      refundCalls += 1
      throw new Error("PayPal 500")
    },
  })
  assert.deepEqual(
    await requestAccountDeletion({ userId: USER, requestId: REQUEST }, failing.value),
    { state: "external_cleanup_done" },
  )
  assert.deepEqual(failing.log.cancelled, ["I-HANNA"])
  for (let run = 0; run < 5; run++) await retryAccountDeletionWebRefunds(failing.value)
  assert.equal(refundCalls, 5)
  assert.equal(db.refunds.get("paypal:I-HANNA")!.state, "due")
  assert.deepEqual(failing.log.refundReports, [
    { provider: "paypal", errorCode: "paypal_refund_failed", attempts: 5, manual: false },
  ])
  assert.deepEqual(failing.log.reports, [], "cleanup reports stay separate (M8)")

  const working = deps(db)
  assert.deepEqual(await retryAccountDeletionWebRefunds(working.value), {
    pending: 1,
    completed: 1,
    manual: 0,
    waiting: 0,
    failed: 0,
  })
  assert.equal(db.refunds.get("paypal:I-HANNA")!.refundedMinor, 750)
  // Settled: later cron runs and replays refund nothing more.
  assert.deepEqual(await retryAccountDeletionWebRefunds(working.value), {
    pending: 0,
    completed: 0,
    manual: 0,
    waiting: 0,
    failed: 0,
  })
  await requestAccountDeletion({ userId: USER, requestId: REQUEST }, working.value)
  await settleAccountDeletionWebRefunds(working.value, REQUEST)
  assert.equal(working.log.refunded.length, 1)
})

test("the 10th failure or a permanent provider error ends in failed_manual with one report; the cron stops failing", async () => {
  const db = fakeDatabase()
  const failing = deps(db, {
    refundWebSubscription: async () => {
      throw new Error("PayPal 500")
    },
  })
  await requestAccountDeletion({ userId: USER, requestId: REQUEST }, failing.value)
  const runs = []
  for (let run = 0; run < 11; run++) runs.push(await retryAccountDeletionWebRefunds(failing.value))
  assert.deepEqual(runs[8], { pending: 1, completed: 0, manual: 0, waiting: 0, failed: 1 })
  assert.deepEqual(runs[9], { pending: 1, completed: 0, manual: 1, waiting: 0, failed: 0 })
  assert.deepEqual(runs[10], { pending: 0, completed: 0, manual: 0, waiting: 0, failed: 0 })
  assert.equal(db.refunds.get("paypal:I-HANNA")!.state, "failed_manual")
  assert.deepEqual(
    failing.log.refundReports.filter((r) => r.manual),
    [{ provider: "paypal", errorCode: "paypal_refund_failed", attempts: 10, manual: true }],
  )

  const permanentDb = fakeDatabase()
  const permanent = deps(permanentDb, {
    listWebSubscriptions: async () => [{ provider: "stripe", id: "sub_disputed" }],
    refundWebSubscription: async () => {
      throw new AccountDeletionRefundManualError("Stripe refused the refund permanently")
    },
  })
  await requestAccountDeletion({ userId: USER, requestId: REQUEST }, permanent.value)
  assert.deepEqual(await retryAccountDeletionWebRefunds(permanent.value), {
    pending: 1,
    completed: 0,
    manual: 1,
    waiting: 0,
    failed: 0,
  })
  assert.deepEqual(permanent.log.refundReports, [
    { provider: "stripe", errorCode: "stripe_refund_failed", attempts: 1, manual: true },
  ])
})

test("a lost billing mark after the cancel keeps the refund although the retry no longer lists the subscription", async () => {
  const db = fakeDatabase()
  db.failMarkOnce()
  const first = deps(db)
  await assert.rejects(
    requestAccountDeletion({ userId: USER, requestId: REQUEST }, first.value),
    (error) => error instanceof AccountDeletionError && error.code === "deletion_failed",
  )
  assert.deepEqual(first.log.cancelled, ["I-HANNA"])
  // The provider webhook marked it cancelled meanwhile: the listing is empty now.
  const retry = deps(db, { listWebSubscriptions: async () => [] })
  assert.equal(
    (await requestAccountDeletion({ userId: USER, requestId: REQUEST }, retry.value)).state,
    "external_cleanup_done",
  )
  await settleAccountDeletionWebRefunds(retry.value, REQUEST)
  assert.deepEqual(
    retry.log.refunded.map((r) => r.subscriptionId),
    ["I-HANNA"],
  )
})

test("I1: a new request id supersedes a failed one without stranding its cancelled subscription's refund", async () => {
  const db = fakeDatabase()
  db.failMarkOnce()
  const first = deps(db)
  await assert.rejects(requestAccountDeletion({ userId: USER, requestId: REQUEST }, first.value))
  assert.deepEqual(first.log.cancelled, ["I-HANNA"])
  // The app starts over with a new request id; the cancel webhook already ended the billing row.
  const NEXT = "44444444-4444-4444-8444-444444444444"
  const second = deps(db, { listWebSubscriptions: async () => [] })
  assert.equal(
    (await requestAccountDeletion({ userId: USER, requestId: NEXT }, second.value)).state,
    "external_cleanup_done",
  )
  assert.ok(!db.ops.has(REQUEST), "the superseded operation is gone")
  await settleAccountDeletionWebRefunds(second.value, NEXT)
  assert.deepEqual(
    second.log.refunded.map((r) => [r.subscriptionId, r.requestId]),
    [["I-HANNA", NEXT]],
  )
  assert.equal(db.refunds.get("paypal:I-HANNA")!.state, "done")
})

test("the refund Sentry report is distinct and carries no ids", () => {
  const captured: { tags: Record<string, string>; context: unknown; error: unknown }[] = []
  const sink = {
    withScope(callback: (scope: never) => void) {
      const entry = {
        tags: {} as Record<string, string>,
        context: null as unknown,
        error: null as unknown,
      }
      captured.push(entry)
      callback({
        setTag: (k: string, v: string) => void (entry.tags[k] = v),
        setContext: (_: string, c: unknown) => void (entry.context = c),
        setLevel: () => undefined,
      } as never)
    },
    captureException(error: unknown) {
      captured.at(-1)!.error = error
    },
  }
  reportAccountDeletionRefundFailure(
    { provider: "stripe", errorCode: "stripe_refund_failed", attempts: 5, manual: false },
    sink,
  )
  reportAccountDeletionRefundFailure(
    { provider: "paypal", errorCode: "sub_123 hanna@example.com", attempts: 10, manual: true },
    sink,
  )
  assert.equal((captured[0].error as Error).message, "account_deletion_refund_failed")
  assert.equal((captured[1].error as Error).message, "account_deletion_refund_needs_manual_review")
  assert.deepEqual(captured[0].context, {
    provider: "stripe",
    error_code: "stripe_refund_failed",
    attempts: 5,
    manual: false,
  })
  assert.equal(captured[1].tags["account_deletion.error_code"], "unknown")
})

test("I-1: an agreement never billed at deletion (done, 0) is taken over when it activates later and refunded in full", async () => {
  const db = fakeDatabase()
  const kinds: string[] = []
  const neverBilled = deps(db, {
    refundWebSubscription: async (refund) => {
      kinds.push(refund.kind)
      return refund.kind === "deletion"
        ? { refundedMinor: 0, paymentRef: null }
        : { refundedMinor: 3999, paymentRef: "TX-1" }
    },
  })
  await requestAccountDeletion({ userId: USER, requestId: REQUEST }, neverBilled.value)
  await settleAccountDeletionWebRefunds(neverBilled.value, REQUEST)
  assert.equal(db.refunds.get("paypal:I-HANNA")!.state, "done")
  assert.equal(db.refunds.get("paypal:I-HANNA")!.refundedMinor, 0)
  // The payer approves afterwards; the activation webhook records the R-a refund (takeover).
  const recorded = await db.rpc("account_deletion_record_post_deletion_refund", {
    p_provider: "paypal",
    p_subscription_id: "I-HANNA",
    p_payments_from: "2026-09-28T10:00:00Z",
  })
  assert.equal(recorded.data, true)
  assert.deepEqual(await retryAccountDeletionWebRefunds(neverBilled.value), {
    pending: 1,
    completed: 1,
    manual: 0,
    waiting: 0,
    failed: 0,
  })
  assert.deepEqual(kinds, ["deletion", "post_deletion"])
  assert.equal(db.refunds.get("paypal:I-HANNA")!.refundedMinor, 3999)
  // Paid out once: a further record never reopens it.
  const again = await db.rpc("account_deletion_record_post_deletion_refund", {
    p_provider: "paypal",
    p_subscription_id: "I-HANNA",
    p_payments_from: "2026-09-28T10:00:00Z",
  })
  assert.equal(again.data, false)
})

test("m4: a pending payment keeps the refund due without counting an attempt", async () => {
  const db = fakeDatabase()
  let pending = true
  const d = deps(db, {
    refundWebSubscription: async () => {
      if (pending) throw new AccountDeletionRefundPendingError("PayPal payment is still pending")
      return { refundedMinor: 750, paymentRef: "PAY-1" }
    },
  })
  await requestAccountDeletion({ userId: USER, requestId: REQUEST }, d.value)
  for (let run = 0; run < 12; run++)
    assert.deepEqual(await retryAccountDeletionWebRefunds(d.value), {
      pending: 1,
      completed: 0,
      manual: 0,
      waiting: 1,
      failed: 0,
    })
  assert.equal(db.refunds.get("paypal:I-HANNA")!.attempts, 0)
  assert.deepEqual(d.log.refundReports, [])
  pending = false
  assert.equal((await retryAccountDeletionWebRefunds(d.value)).completed, 1)
  assert.equal(db.refunds.get("paypal:I-HANNA")!.state, "done")
})
