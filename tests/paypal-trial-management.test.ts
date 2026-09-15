import {
  paypalTrialCollectionStart,
  paypalTrialProviderStart,
} from "../src/lib/paypal/trial-collection-start"
import assert from "node:assert/strict"
import test from "node:test"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
import {
  beginPayPalTrialManagement,
  reconcilePayPalTrialManagement,
  abandonPayPalTrialManagement,
} from "../src/lib/paypal/trial-management"
import { buildPayPalDeferredTrialPlanRequest } from "../src/lib/paypal/trial-plan-shape"

const USER = "11111111-1111-4111-8111-111111111111",
  ENROLLMENT = "22222222-2222-4222-8222-222222222222",
  OP = "33333333-3333-4333-8333-333333333333"
function fixture(
  kind: "switch" | "restore" = "restore",
  options: {
    v2Schedule?: boolean
    legacyFrozen?: boolean
    alignedTrialEnd?: boolean
    corruptSchedule?:
      | "partial"
      | "non_string"
      | "missing"
      | "altered_target"
      | "legacy_pair"
      | "bad_v2_key"
    corruptBinding?: boolean
  } = {},
) {
  const catalog = {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon_year",
  }
  const sourceOffer = createTrialOfferSnapshot(kind === "restore" ? "year" : "month", catalog),
    targetOffer = createTrialOfferSnapshot("year", catalog)
  const deadline = options.alignedTrialEnd
    ? new Date((Math.floor(Date.now() / 86400000) + 5) * 86400000).toISOString()
    : new Date(Date.now() + 4 * 86400000).toISOString()
  const operation: any = {
    id: OP,
    enrollmentId: ENROLLMENT,
    userId: USER,
    kind,
    status: "pending",
    expectedRevision: 0,
    cancellationVersion: 1,
    provider: "paypal",
    providerCustomerId: "PAYER",
    originalAgreementId: "I-old",
    sourceAgreementId: "I-old",
    originalTrialEndAt: deadline,
    sourceOffer,
    targetOffer,
    cancelAtPeriodEnd: false,
    targetAgreementId: null,
  }
  const source: any = {
    id: "I-old",
    plan_id: kind === "restore" ? "P-year" : "P-month",
    custom_id: "original-token",
    status: kind === "restore" ? "CANCELLED" : "ACTIVE",
    start_time: deadline,
    subscriber: { payer_id: "PAYER" },
    billing_info: { next_billing_time: deadline },
    plan: buildPayPalDeferredTrialPlanRequest({
      interval: kind === "restore" ? "year" : "month",
      productId: "PROD",
    }),
  }
  const providerStart = paypalTrialProviderStart(deadline)
  if (options.v2Schedule) {
    source.start_time = providerStart
    source.billing_info.next_billing_time = new Date(
      Date.parse(paypalTrialCollectionStart(deadline)) + 10 * 60 * 60 * 1000,
    ).toISOString()
  }
  const subscriptions: Record<string, any> = { "I-old": source }
  let frozen: any = options.legacyFrozen
      ? {
          operation_id: options.corruptBinding ? "foreign-operation" : OP,
          enrollment_id: ENROLLMENT,
          app_id: "APP",
          product_id: "PROD",
          source_plan_id: source.plan_id,
          target_plan_id: "P-year",
          request_id: `paypal-trial-management:${OP}`,
          request_expires_at: new Date(Date.now() + 72 * 3600000).toISOString(),
          return_url: "https://chaarlie.de/profile?trial_operation=" + OP,
          cancel_url: "https://chaarlie.de/profile?trial_operation=" + OP,
          request_sent_at: null,
          target_agreement_id: null,
          approval_url: null,
          source_start_time: options.corruptSchedule === "legacy_pair" ? source.start_time : null,
          target_start_time: options.corruptSchedule === "legacy_pair" ? providerStart : null,
        }
      : null,
    commitAllowed = true,
    guardAllowed = true,
    failProjection = false
  const calls: any[] = []
  const tables: Record<string, any[]> = {
    billing_subscriptions: [
      {
        id: "billing-old",
        user_id: USER,
        provider: "paypal",
        provider_subscription_id: "I-old",
        provider_customer_id: "PAYER",
        provider_status: source.status,
        entitlement_status: "active",
        trial_enrollment_id: ENROLLMENT,
        current_period_end: deadline,
        cancel_at_period_end: kind === "restore",
        interval: "month",
        metadata: { trial_cohort: "trial_v1", paypal_plan_id: "P-month" },
      },
    ],
    trial_enrollments: [
      {
        id: ENROLLMENT,
        user_id: USER,
        cancel_at_period_end: kind === "restore",
        paid_through_at: null,
      },
    ],
    profiles: [{ id: USER }],
  }
  function from(table: string) {
    let patch: any = null,
      upsert = false,
      single = false
    const filters: any[] = []
    const q: any = {
      select() {
        return q
      },
      eq(k: string, v: any) {
        filters.push((r: any) => r[k] === v)
        return q
      },
      maybeSingle() {
        single = true
        return q
      },
      single() {
        single = true
        return q
      },
      update(v: any) {
        patch = v
        return q
      },
      upsert(v: any) {
        patch = v
        upsert = true
        return q
      },
      then(resolve: any, reject: any) {
        return Promise.resolve()
          .then(() => {
            if (failProjection && table === "billing_subscriptions" && upsert)
              throw new Error("projection unavailable")
            const rows = tables[table] ?? []
            let selected = rows.filter((r) => filters.every((f) => f(r)))
            if (upsert) {
              const old = rows.find(
                (r) => r.provider_subscription_id === patch.provider_subscription_id,
              )
              const row = Object.assign(old ?? { id: "billing-new" }, patch)
              if (!old) rows.push(row)
              selected = [row]
            } else if (patch) selected.forEach((r) => Object.assign(r, patch))
            return { data: single ? (selected[0] ?? null) : selected, error: null }
          })
          .then(resolve, reject)
      },
    }
    return q
  }
  const deps: any = {
    supabase: {
      from,
      rpc: async (name: string, args: any) => {
        calls.push({ rpc: name, args })
        if (name === "load_trial_management_operation")
          return { data: { ...operation }, error: null }
        if (name === "guard_trial_management_operation") return { data: guardAllowed, error: null }
        if (name === "read_trial_effective_contract")
          return {
            data: {
              accepted_offer: operation.status === "committed" ? targetOffer : sourceOffer,
              provider: "paypal",
              provider_agreement_id: operation.targetAgreementId ?? "I-old",
              revision: operation.status === "committed" ? 1 : 0,
            },
            error: null,
          }
        if (name === "get_paypal_trial_plan_catalog")
          return {
            data: {
              enrollment_id: ENROLLMENT,
              app_id: "APP",
              product_id: "PROD",
              month_plan_id: "P-month",
              year_plan_id: "P-year",
            },
            error: null,
          }
        if (
          name === "get_paypal_trial_management_request" ||
          name === "get_paypal_trial_management_request_v2"
        )
          return { data: frozen ? { ...frozen } : null, error: null }
        if (
          name === "freeze_paypal_trial_management_request" ||
          name === "freeze_paypal_trial_management_request_v2"
        ) {
          const isV2 = name === "freeze_paypal_trial_management_request_v2"
          const frozenOperationId = options.corruptBinding ? "foreign-operation" : OP
          frozen = {
            operation_id: frozenOperationId,
            enrollment_id: ENROLLMENT,
            app_id: "APP",
            product_id: "PROD",
            source_plan_id: args.p_source_plan_id,
            target_plan_id: args.p_target_plan_id,
            request_id:
              options.corruptSchedule === "bad_v2_key"
                ? `paypal-trial-management:foreign:${OP}:v2`
                : `paypal-trial-management:${frozenOperationId}${isV2 ? ":v2" : ""}`,
            request_expires_at: new Date(Date.now() + 72 * 3600000).toISOString(),
            return_url: args.p_return_url,
            cancel_url: args.p_cancel_url,
            request_sent_at: null,
            target_agreement_id: null,
            approval_url: null,
            source_start_time:
              isV2 && options.corruptSchedule === "non_string"
                ? 42
                : isV2 && options.corruptSchedule === "missing"
                  ? null
                  : isV2
                    ? args.p_source_start_time
                    : null,
            target_start_time: isV2
              ? options.corruptSchedule === "partial" || options.corruptSchedule === "missing"
                ? null
                : options.corruptSchedule === "non_string"
                  ? 43
                  : options.corruptSchedule === "altered_target"
                    ? new Date(Date.parse(providerStart) + 60 * 60 * 1000).toISOString()
                    : options.v2Schedule || kind === "restore"
                      ? providerStart
                      : args.p_source_start_time
              : null,
          }
          return { data: { ...frozen }, error: null }
        }
        if (name === "claim_paypal_trial_management_request") {
          if (frozen.request_sent_at) return { data: false, error: null }
          frozen.request_sent_at = new Date().toISOString()
          return { data: true, error: null }
        }
        if (name === "bind_paypal_trial_management_response") {
          frozen.target_agreement_id = args.p_target_agreement_id
          frozen.approval_url = args.p_approval_url
          return { data: { ...frozen }, error: null }
        }
        if (name === "commit_trial_management_operation") {
          if (commitAllowed) {
            operation.status = "committed"
            operation.targetAgreementId = args.p_evidence.targetAgreementId
            tables.trial_enrollments[0].cancel_at_period_end = false
          }
          return { data: commitAllowed, error: null }
        }
        if (name === "abandon_trial_management_operation") {
          operation.status = "abandoned"
          return { data: true, error: null }
        }
        throw new Error(name)
      },
    },
    premiumTierId: "premium",
    attestApp: async () => "APP",
    retrieve: async (id: string) => structuredClone(subscriptions[id]),
    getPlan: async (id: string) =>
      buildPayPalDeferredTrialPlanRequest({
        interval: id === "P-year" ? "year" : "month",
        productId: "PROD",
      }),
    transactions: async () => [],
    cancel: async (id: string) => {
      calls.push({ cancel: id })
      subscriptions[id].status = "CANCELLED"
    },
    request: async (path: string, init: any) => {
      const body = JSON.parse(init.body)
      calls.push({ path, body, requestId: init.headers["PayPal-Request-Id"] })
      if (kind === "restore") {
        subscriptions["I-new"] = {
          id: "I-new",
          custom_id: body.custom_id,
          plan_id: body.plan_id,
          start_time: body.start_time,
          status: "APPROVAL_PENDING",
          plan: buildPayPalDeferredTrialPlanRequest({ interval: "year", productId: "PROD" }),
          billing_info: { next_billing_time: body.start_time },
          links: [{ rel: "approve", href: "https://www.paypal.com/approve?token=owned" }],
        }
        return structuredClone(subscriptions["I-new"])
      }
      return {
        plan_id: "P-year",
        links: [{ rel: "approve", href: "https://www.paypal.com/approve?token=owned" }],
      }
    },
  }
  const input = {
    operationId: OP,
    authenticatedUserId: USER,
    returnUrl: "https://chaarlie.de/profile?trial_operation=" + OP,
    cancelUrl: "https://chaarlie.de/profile?trial_operation=" + OP,
  }
  function approve() {
    if (kind === "restore") {
      subscriptions["I-new"].status = "ACTIVE"
      subscriptions["I-new"].subscriber = { payer_id: "PAYER" }
    } else {
      source.plan_id = "P-year"
      source.plan = buildPayPalDeferredTrialPlanRequest({ interval: "year", productId: "PROD" })
    }
  }
  return {
    deps,
    input,
    operation,
    source,
    subscriptions,
    calls,
    tables,
    deadline,
    approve,
    frozen: () => frozen,
    setCommit: (value: boolean) => {
      commitAllowed = value
    },
    setGuard: (value: boolean) => {
      guardAllowed = value
    },
    setProjectionFailure: (value: boolean) => {
      failProjection = value
    },
  }
}

test("restore requests its frozen no-free replacement schedule and cancellation remains effective until verified approval", async () => {
  const f = fixture()
  const result = await beginPayPalTrialManagement(f.input, f.deps)
  assert.equal(result.status, "approval_required")
  assert.equal(f.tables.trial_enrollments[0].cancel_at_period_end, true)
  const request = f.calls.find((c) => c.path)
  assert.equal(request.body.start_time, f.frozen().target_start_time)
  assert.equal(request.body.plan.billing_cycles[0].pricing_scheme.fixed_price.value, "69.99")
  assert.equal(request.body.plan.billing_cycles[1].pricing_scheme.fixed_price.value, "99.99")
  assert.equal(f.operation.status, "pending")
  assert.equal((await reconcilePayPalTrialManagement(f.input, f.deps)).status, "approval_required")
  f.approve()
  assert.equal((await reconcilePayPalTrialManagement(f.input, f.deps)).status, "committed")
  assert.equal(f.tables.trial_enrollments[0].cancel_at_period_end, false)
  assert.equal(
    f.tables.billing_subscriptions.find((b) => b.provider_subscription_id === "I-new").metadata
      .paypal_plan_id,
    "P-year",
  )
  assert.equal(
    f.tables.billing_subscriptions.find((b) => b.provider_subscription_id === "I-old").metadata
      .trial_management_superseded_by,
    "I-new",
  )
})

test("noon-scheduled restore preserves its frozen provider start while accepting the provider's 10:00 billing batch", async () => {
  const f = fixture("restore", { v2Schedule: true })
  const result = await beginPayPalTrialManagement(f.input, f.deps)
  assert.equal(result.status, "approval_required")
  const request = f.calls.find((c) => c.path)
  assert.equal(request.body.start_time, f.frozen().target_start_time)
  assert.equal(
    f.calls.some((c) => c.rpc === "freeze_paypal_trial_management_request_v2"),
    true,
  )
  f.approve()
  f.subscriptions["I-new"].billing_info.next_billing_time = new Date(
    Date.parse(paypalTrialCollectionStart(f.deadline)) + 10 * 60 * 60 * 1000,
  ).toISOString()
  assert.equal((await reconcilePayPalTrialManagement(f.input, f.deps)).status, "committed")
})

test("an aligned midnight trial end freezes a same-date noon restore start", async () => {
  const f = fixture("restore", { alignedTrialEnd: true })
  await beginPayPalTrialManagement(f.input, f.deps)
  const request = f.calls.find((c) => c.path)
  assert.equal(request.body.start_time, paypalTrialProviderStart(f.deadline))
  assert.equal(request.body.start_time.slice(0, 10), f.deadline.slice(0, 10))
  assert.equal(request.body.start_time.slice(11), "12:00:00.000Z")
})

test("a legacy frozen restore retains its original midnight request body", async () => {
  const f = fixture("restore", { legacyFrozen: true })
  const result = await beginPayPalTrialManagement(f.input, f.deps)
  assert.equal(result.status, "approval_required")
  assert.equal(f.calls.find((c) => c.path).body.start_time, paypalTrialCollectionStart(f.deadline))
  assert.equal(
    f.calls.some((c) => c.rpc === "freeze_paypal_trial_management_request_v2"),
    false,
  )
})

test("switch preserves its frozen noon source schedule without a start-time patch", async () => {
  const f = fixture("switch", { v2Schedule: true })
  await beginPayPalTrialManagement(f.input, f.deps)
  const request = f.calls.find((c) => c.path)
  assert.equal("start_time" in request.body, false)
  assert.equal(f.frozen().source_start_time, f.source.start_time)
  assert.equal(f.frozen().target_start_time, f.source.start_time)
  f.approve()
  assert.equal((await reconcilePayPalTrialManagement(f.input, f.deps)).status, "committed")
})

test("a restore target whose start differs from its frozen schedule is rejected", async () => {
  const f = fixture("restore", { v2Schedule: true })
  await beginPayPalTrialManagement(f.input, f.deps)
  f.approve()
  f.subscriptions["I-new"].start_time = f.deadline
  await assert.rejects(() => reconcilePayPalTrialManagement(f.input, f.deps), /deadline/)
  assert.equal(f.operation.status, "pending")
})

test("a source changed after its v2 freeze cannot create a replacement", async () => {
  const f = fixture("restore", { v2Schedule: true })
  const retrieve = f.deps.retrieve
  let sourceReads = 0
  f.deps.retrieve = async (id: string) => {
    const subscription = await retrieve(id)
    if (id === "I-old" && ++sourceReads === 2) subscription.start_time = f.deadline
    return subscription
  }
  await assert.rejects(() => beginPayPalTrialManagement(f.input, f.deps), /deadline/)
  assert.equal(
    f.calls.some((c) => c.path),
    false,
  )
})

test("corrupt frozen schedules and bindings cannot create a replacement", async () => {
  for (const [label, options, error] of [
    ["partial", { corruptSchedule: "partial" }, /schedule unavailable/],
    ["non-string", { corruptSchedule: "non_string" }, /schedule unavailable/],
    ["v2 missing", { corruptSchedule: "missing" }, /schedule unavailable/],
    ["wrong v2 key", { corruptSchedule: "bad_v2_key" }, /schedule unavailable/],
    ["legacy pair", { legacyFrozen: true, corruptSchedule: "legacy_pair" }, /schedule unavailable/],
    ["altered target", { corruptSchedule: "altered_target" }, /schedule mismatch/],
    ["binding", { corruptBinding: true }, /binding mismatch/],
  ] as const) {
    const f = fixture("restore", options)
    await assert.rejects(() => beginPayPalTrialManagement(f.input, f.deps), error, label)
    assert.equal(
      f.calls.some((c) => c.path),
      false,
      label,
    )
  }
})

test("management keeps the trial-end billing bounds even when the provider start is noon", async () => {
  for (const boundary of ["before_trial_end", "window_end"] as const) {
    const f = fixture("restore", { v2Schedule: true })
    await beginPayPalTrialManagement(f.input, f.deps)
    f.approve()
    f.subscriptions["I-new"].billing_info.next_billing_time =
      boundary === "before_trial_end"
        ? new Date(Date.parse(f.deadline) - 1).toISOString()
        : new Date(
            Date.parse(paypalTrialCollectionStart(f.deadline)) + 48 * 60 * 60 * 1000,
          ).toISOString()
    await assert.rejects(
      () => reconcilePayPalTrialManagement(f.input, f.deps),
      /deadline/,
      boundary,
    )
    assert.equal(f.operation.status, "pending")
  }
})

test("switch needs payer reapproval and never rewrites or patches the original trial deadline", async () => {
  const f = fixture("switch")
  await beginPayPalTrialManagement(f.input, f.deps)
  assert.equal(f.source.plan_id, "P-month")
  assert.equal(f.operation.status, "pending")
  assert.equal(f.calls.find((c) => c.path).path, "/v1/billing/subscriptions/I-old/revise")
  assert.equal("start_time" in f.calls.find((c) => c.path).body, false)
  await beginPayPalTrialManagement(f.input, f.deps)
  assert.equal(f.calls.filter((c) => c.path).length, 1)
  f.approve()
  assert.equal((await reconcilePayPalTrialManagement(f.input, f.deps)).status, "committed")
  assert.equal(f.operation.targetAgreementId, "I-old")
  assert.equal(f.source.start_time, f.deadline)
})

test("changed next billing boundary after revision is rejected without local terms commit", async () => {
  const f = fixture("switch")
  await beginPayPalTrialManagement(f.input, f.deps)
  f.approve()
  // Within the day-after collection window a shifted boundary is provider
  // normalization; only a boundary outside the window is a changed contract.
  f.source.billing_info.next_billing_time = new Date(
    Date.parse(f.deadline) + 4 * 86400000,
  ).toISOString()
  await assert.rejects(() => reconcilePayPalTrialManagement(f.input, f.deps), /deadline/)
  assert.equal(f.operation.status, "pending")
})

test("lost revision response is not blindly reissued, and source terms remain operative", async () => {
  const f = fixture("switch")
  const request = f.deps.request
  f.deps.request = async (...args: any[]) => {
    await request(...args)
    throw new Error("timeout")
  }
  await assert.rejects(() => beginPayPalTrialManagement(f.input, f.deps), /timeout/)
  assert.equal((await beginPayPalTrialManagement(f.input, f.deps)).status, "pending")
  assert.equal(f.calls.filter((c) => c.path).length, 1)
  assert.equal(f.source.plan_id, "P-month")
})

test("lost create response retries exact frozen request within documented idempotency window", async () => {
  const f = fixture()
  const request = f.deps.request
  let first = true
  f.deps.request = async (...args: any[]) => {
    const response = await request(...args)
    if (first) {
      first = false
      throw new Error("timeout")
    }
    return response
  }
  await assert.rejects(() => beginPayPalTrialManagement(f.input, f.deps), /timeout/)
  await beginPayPalTrialManagement({ ...f.input, returnUrl: "https://chaarlie.de/changed" }, f.deps)
  const requests = f.calls.filter((c) => c.path)
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[0], requests[1])
  assert.equal(requests[0].requestId, `paypal-trial-management:${OP}:v2`)
})

test("fresh cancellation wins commit CAS and replacement is neutralized without clearing old cancellation", async () => {
  const f = fixture()
  await beginPayPalTrialManagement(f.input, f.deps)
  f.approve()
  f.setCommit(false)
  assert.equal(
    (await reconcilePayPalTrialManagement(f.input, f.deps)).status,
    "reconciliation_required",
  )
  assert.equal(f.subscriptions["I-new"].status, "CANCELLED")
  assert.equal(f.tables.trial_enrollments[0].cancel_at_period_end, true)
  assert.equal(f.operation.status, "pending")
})

test("a racing payment prevents restoration activation and cannot be hidden behind ACTIVE", async () => {
  const f = fixture()
  await beginPayPalTrialManagement(f.input, f.deps)
  f.approve()
  f.deps.transactions = async () => [{ id: "SALE", status: "COMPLETED" }]
  await assert.rejects(
    () => reconcilePayPalTrialManagement(f.input, f.deps),
    /payment reconciliation/,
  )
  assert.equal(f.operation.status, "pending")
})

test("a canceled restore is abandoned only after provider cancellation and empty transaction proof", async () => {
  const f = fixture()
  await beginPayPalTrialManagement(f.input, f.deps)
  assert.equal((await abandonPayPalTrialManagement(f.input, f.deps)).status, "abandoned")
  assert.equal(f.subscriptions["I-new"].status, "CANCELLED")
  assert.equal(f.source.status, "CANCELLED")
})

test("browser cancel does not declare an issued revision irreversibly abandoned", async () => {
  const f = fixture("switch")
  await beginPayPalTrialManagement(f.input, f.deps)
  assert.equal((await abandonPayPalTrialManagement(f.input, f.deps)).status, "pending")
  assert.equal(f.operation.status, "pending")
  assert.equal(f.source.plan_id, "P-month")
})

test("a committed operation repairs interrupted billing projection on retry", async () => {
  const f = fixture()
  await beginPayPalTrialManagement(f.input, f.deps)
  f.approve()
  f.setProjectionFailure(true)
  await assert.rejects(
    () => reconcilePayPalTrialManagement(f.input, f.deps),
    /projection unavailable/,
  )
  assert.equal(f.operation.status, "committed")
  f.setProjectionFailure(false)
  assert.equal((await reconcilePayPalTrialManagement(f.input, f.deps)).status, "committed")
  assert.equal(
    f.tables.billing_subscriptions.some((b) => b.provider_subscription_id === "I-new"),
    true,
  )
  assert.equal(f.calls.filter((c) => c.path).length, 1)
})

test("ownership or app mismatch fails before provider mutation", async () => {
  const f = fixture()
  f.deps.attestApp = async () => "OTHER"
  await assert.rejects(() => beginPayPalTrialManagement(f.input, f.deps), /catalog unavailable/)
  assert.equal(
    f.calls.some((c) => c.path),
    false,
  )
})

test("foreign-payer restore candidate is canceled without changing accepted trial owner", async () => {
  const f = fixture("restore")
  await beginPayPalTrialManagement(f.input, f.deps)
  f.approve()
  f.subscriptions["I-new"].subscriber.payer_id = "foreign"
  await assert.rejects(reconcilePayPalTrialManagement(f.input, f.deps), /payer mismatch/)
  assert.equal(f.subscriptions["I-new"].status, "CANCELLED")
  assert.equal(f.operation.status, "pending")
})

test("no-payment check for a frozen midnight trial end never queries a future interval", async () => {
  const { frozenPayPalTrialStart } = await import("../src/lib/paypal/trial-collection-start")
  // Frozen two minutes ago: the trial end sits 8–9 days out, so "end − 7 days" would be in the future.
  const deadline = frozenPayPalTrialStart(
    new Date(Date.now() - 120_000 + 3 * 86400000).toISOString(),
  )
  const f = fixture("switch")
  f.operation.originalTrialEndAt = deadline
  f.source.start_time = deadline
  f.source.billing_info = { next_billing_time: deadline }
  const windows: Array<{ from: string; to: string }> = []
  f.deps.transactions = async (_id: string, from: string, to: string) => {
    windows.push({ from, to })
    return []
  }
  await beginPayPalTrialManagement(f.input, f.deps)
  assert.ok(windows.length >= 1)
  for (const w of windows) {
    assert.ok(Date.parse(w.from) < Date.now() - 60_000, `from ${w.from} lies in the past`)
    assert.ok(Date.parse(w.from) < Date.parse(w.to), `from ${w.from} < to ${w.to}`)
  }
})
