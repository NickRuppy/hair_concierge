import assert from "node:assert/strict"
import test from "node:test"
import { handleAccountDeletionReconcile } from "../src/app/api/account-deletion/reconcile/route"
import { cancelWebSubscriptionWith } from "../src/lib/account-deletion/runtime"
import {
  proRataRefundMinor,
  refundPayPalSubscriptionWith,
  refundStripeSubscriptionWith,
  type PayPalRefundApi,
  type StripeRefundApi,
} from "../src/lib/account-deletion/web-refund"
import {
  AccountDeletionError,
  getAccountDeletionStatus,
  requestAccountDeletion,
  retryAccountDeletionCleanup,
  type AccountDeletionDeps,
  type AccountDeletionState,
  type WebRefundDue,
  retryAccountDeletionWebRefunds,
} from "../src/lib/account-deletion/service"
import { reportAccountDeletionCleanupFailure } from "../src/lib/observability/account-deletion"

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const REQUEST = "33333333-3333-4333-8333-333333333333"

type Refund = {
  requestId: string
  state: "recorded" | "due" | "done"
  attempts: number
  refundedMinor: number | null
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
              state: "recorded",
              attempts: 0,
              refundedMinor: null,
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
              recordedAt: "2026-09-28T10:00:00Z",
              attempts: r.attempts,
            })),
        )
      case "account_deletion_web_refund_result": {
        const r = refunds.get(`${args.p_provider}:${args.p_subscription_id}`)
        if (r?.state !== "due") return fail("refund_not_due")
        if (args.p_error_code === null) {
          r.state = "done"
          r.refundedMinor = args.p_refunded_minor as number
        } else r.attempts += 1
        return ok({ state: r.state, attempts: r.attempts })
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
  }
  const value: AccountDeletionDeps = {
    rpc: db.rpc,
    listWebSubscriptions: async () => [{ provider: "paypal", id: "I-HANNA" }],
    cancelWebSubscription: async (s) => void log.cancelled.push(s.id),
    refundWebSubscription: async (refund) => {
      log.refunded.push(refund)
      return { refundedMinor: 750, paymentRef: "PAY-1" }
    },
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
  assert.deepEqual(
    working.log.refunded.map((r) => [r.provider, r.subscriptionId, r.requestId]),
    [["paypal", "I-HANNA", REQUEST]],
  )
  assert.equal(db.refunds.get("paypal:I-HANNA")!.state, "done")
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

test("a refund failure after the cancel never blocks the deletion; the cron retries once done and reports from the 5th attempt", async () => {
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
  assert.equal(db.refunds.get("paypal:I-HANNA")!.state, "due")
  assert.equal(db.refunds.get("paypal:I-HANNA")!.attempts, 1)
  for (let run = 0; run < 4; run++) await retryAccountDeletionWebRefunds(failing.value)
  assert.equal(refundCalls, 5)
  assert.deepEqual(failing.log.reports, [{ errorCode: "paypal_refund_failed", attempts: 5 }])

  const working = deps(db)
  assert.deepEqual(await retryAccountDeletionWebRefunds(working.value), {
    pending: 1,
    completed: 1,
    failed: 0,
  })
  assert.equal(db.refunds.get("paypal:I-HANNA")!.refundedMinor, 750)
  // Settled: later cron runs and replays refund nothing more.
  assert.deepEqual(await retryAccountDeletionWebRefunds(working.value), {
    pending: 0,
    completed: 0,
    failed: 0,
  })
  await requestAccountDeletion({ userId: USER, requestId: REQUEST }, working.value)
  assert.equal(working.log.refunded.length, 1)
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
  assert.deepEqual(first.log.refunded, [])
  // The provider webhook marked it cancelled meanwhile: the listing is empty now.
  const retry = deps(db, { listWebSubscriptions: async () => [] })
  assert.equal(
    (await requestAccountDeletion({ userId: USER, requestId: REQUEST }, retry.value)).state,
    "external_cleanup_done",
  )
  assert.deepEqual(
    retry.log.refunded.map((r) => r.subscriptionId),
    ["I-HANNA"],
  )
})

test("pro-rata math: unused share of the paid amount, rounded down to cents", () => {
  const day = 86_400_000
  const base = { paidMinor: 1499, periodStart: 0, periodEnd: 30 * day }
  assert.equal(proRataRefundMinor({ ...base, endedAt: 15 * day }), 749) // mid-period, 749.5 → 749
  assert.equal(proRataRefundMinor({ ...base, endedAt: 10 * day }), 999) // 999.33 → 999
  assert.equal(proRataRefundMinor({ ...base, endedAt: 30 * day }), 0) // period end
  assert.equal(proRataRefundMinor({ ...base, endedAt: 31 * day }), 0) // after the period
  assert.equal(proRataRefundMinor({ ...base, endedAt: -day }), 1499) // never more than paid
  assert.equal(proRataRefundMinor({ ...base, paidMinor: 0, endedAt: day }), 0) // trial / €0
  assert.equal(proRataRefundMinor({ ...base, periodEnd: 0, endedAt: 0 }), 0) // empty period
})

const DAY_S = 86_400
const DUE: WebRefundDue = {
  provider: "stripe",
  subscriptionId: "sub_live",
  requestId: REQUEST,
  recordedAt: new Date(10 * DAY_S * 1000).toISOString(),
  attempts: 0,
}

function fakeStripe(overrides: {
  status?: string
  endedAt?: number | null
  invoice?: { status: string; amount_paid: number }
  refunds?: unknown[]
}) {
  const created: unknown[] = []
  const api: StripeRefundApi = {
    subscriptions: {
      retrieve: async () => ({
        status: overrides.status ?? "canceled",
        ended_at: overrides.endedAt === undefined ? 10 * DAY_S : overrides.endedAt,
        latest_invoice: "in_1",
      }),
    },
    invoices: {
      retrieve: async () => ({
        ...(overrides.invoice ?? { status: "paid", amount_paid: 1499 }),
        lines: { data: [{ period: { start: 0, end: 30 * DAY_S } }] },
      }),
    },
    invoicePayments: {
      list: async () => ({
        data: [{ payment: { type: "payment_intent", payment_intent: "pi_1" } }],
      }),
    },
    refunds: {
      list: async () => ({ data: overrides.refunds ?? [] }),
      create: async (params, options) => {
        created.push([params, options])
        return { id: "re_1" }
      },
    },
  }
  return { api, created }
}

test("Stripe: refunds the unused part of the latest paid invoice with a request-derived idempotency key", async () => {
  const live = fakeStripe({})
  assert.deepEqual(await refundStripeSubscriptionWith(DUE, live.api), {
    refundedMinor: 999,
    paymentRef: "pi_1",
  })
  assert.deepEqual(live.created, [
    [
      {
        payment_intent: "pi_1",
        amount: 999,
        reason: "requested_by_customer",
        metadata: { source: "account_deletion" },
      },
      { idempotencyKey: `account-deletion-refund-${REQUEST}-sub_live` },
    ],
  ])
  const nothing = { refundedMinor: 0, paymentRef: null }
  // Trial: the only invoice is €0.
  const trial = fakeStripe({ invoice: { status: "paid", amount_paid: 0 } })
  assert.deepEqual(await refundStripeSubscriptionWith(DUE, trial.api), nothing)
  // Unpaid renewal.
  const unpaid = fakeStripe({ invoice: { status: "open", amount_paid: 0 } })
  assert.deepEqual(await refundStripeSubscriptionWith(DUE, unpaid.api), nothing)
  // Ended at the period end.
  const periodEnd = fakeStripe({ endedAt: 30 * DAY_S })
  assert.deepEqual(await refundStripeSubscriptionWith(DUE, periodEnd.api), nothing)
  // Ended days before this deletion (not our cancellation).
  const earlier = fakeStripe({ endedAt: 2 * DAY_S })
  assert.deepEqual(await refundStripeSubscriptionWith(DUE, earlier.api), nothing)
  // Already refunded.
  const refunded = fakeStripe({ refunds: [{ id: "re_0" }] })
  assert.deepEqual(await refundStripeSubscriptionWith(DUE, refunded.api), {
    refundedMinor: 0,
    paymentRef: "pi_1",
  })
  for (const f of [trial, unpaid, periodEnd, earlier, refunded]) assert.deepEqual(f.created, [])
  // Not cancelled (yet): a retryable failure, never a refund.
  const active = fakeStripe({ status: "active", endedAt: null })
  await assert.rejects(refundStripeSubscriptionWith(DUE, active.api), /not cancelled/)
  assert.deepEqual(active.created, [])
})

function fakePayPal(overrides: {
  status?: string
  transactions?: { id: string; status: string; time: string; value?: string }[]
}) {
  const refunds: unknown[] = []
  const windows: string[][] = []
  const api: PayPalRefundApi = {
    retrieve: async () => ({
      status: overrides.status ?? "CANCELLED",
      status_update_time: "2026-09-16T00:00:00Z",
      plan_id: "P-MONTH",
    }),
    plan: async () => ({
      billing_cycles: [
        { tenure_type: "TRIAL", frequency: { interval_unit: "DAY", interval_count: 7 } },
        { tenure_type: "REGULAR", frequency: { interval_unit: "MONTH", interval_count: 1 } },
      ],
    }),
    transactions: async (_id, from, to) => {
      windows.push([from, to])
      return (overrides.transactions ?? []).map((t) => ({
        id: t.id,
        status: t.status,
        time: t.time,
        amount_with_breakdown: {
          gross_amount: { value: t.value ?? "14.99", currency_code: "EUR" },
        },
      }))
    },
    refund: async (...args) => void refunds.push(args),
  }
  return { api, refunds, windows }
}

test("PayPal: refunds the unused part of the last completed payment with a PayPal-Request-Id", async () => {
  const due: WebRefundDue = {
    ...DUE,
    provider: "paypal",
    subscriptionId: "I-HANNA",
    recordedAt: "2026-09-16T00:00:00Z",
  }
  const live = fakePayPal({
    transactions: [
      { id: "OLD", status: "COMPLETED", time: "2026-08-01T00:00:00Z" },
      { id: "TX-SEPT", status: "COMPLETED", time: "2026-09-01T00:00:00Z" },
    ],
  })
  // Sept 1 → Oct 1 (30 days), cancelled Sept 16: 15/30 of €14.99 = 749.5 → €7.49.
  assert.deepEqual(await refundPayPalSubscriptionWith(due, live.api), {
    refundedMinor: 749,
    paymentRef: "TX-SEPT",
  })
  assert.deepEqual(live.refunds, [
    [
      "TX-SEPT",
      { value: "7.49", currency_code: "EUR" },
      `account-deletion-refund-${REQUEST}-I-HANNA`,
    ],
  ])
  assert.ok(live.windows[0][0] < "2026-08-16T00:00:00Z", "window covers one interval back")
  // Trial: no completed payment.
  const trial = fakePayPal({ transactions: [] })
  assert.deepEqual(await refundPayPalSubscriptionWith(due, trial.api), {
    refundedMinor: 0,
    paymentRef: null,
  })
  // Already (partially) refunded.
  const refunded = fakePayPal({
    transactions: [{ id: "TX-SEPT", status: "PARTIALLY_REFUNDED", time: "2026-09-01T00:00:00Z" }],
  })
  assert.deepEqual(await refundPayPalSubscriptionWith(due, refunded.api), {
    refundedMinor: 0,
    paymentRef: "TX-SEPT",
  })
  // Expired naturally.
  const expired = fakePayPal({ status: "EXPIRED" })
  assert.deepEqual(await refundPayPalSubscriptionWith(due, expired.api), {
    refundedMinor: 0,
    paymentRef: null,
  })
  for (const f of [trial, refunded, expired]) assert.deepEqual(f.refunds, [])
  const active = fakePayPal({ status: "ACTIVE" })
  await assert.rejects(refundPayPalSubscriptionWith(due, active.api), /not cancelled/)
})
