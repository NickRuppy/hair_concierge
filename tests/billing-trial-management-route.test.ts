import assert from "node:assert/strict"
import test from "node:test"
import {
  handleTrialManagementGet,
  handleTrialManagementPost,
  validTrialManagementApprovalUrl,
} from "../src/app/api/billing/trial-management/route"
import { createTrialOfferSnapshot } from "../src/lib/billing/trial-offer"
const USER = "11111111-1111-4111-8111-111111111111",
  ENROLLMENT = "22222222-2222-4222-8222-222222222222",
  OP = "33333333-3333-4333-8333-333333333333"
const catalog = {
  month: createTrialOfferSnapshot("month", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon",
  }),
  year: createTrialOfferSnapshot("year", {
    monthPriceId: "price_month",
    yearPriceId: "price_year",
    annualCouponId: "coupon",
  }),
}
const command = {
  action: "begin",
  operationId: OP,
  enrollmentId: ENROLLMENT,
  expectedRevision: 0,
  kind: "switch",
  targetInterval: "year",
}
function request(
  body: unknown = command,
  origin = "https://chaarlie.de",
  type = "application/json",
) {
  return new Request("https://chaarlie.de/api/billing/trial-management", {
    method: "POST",
    headers: { origin, "content-type": type },
    body: JSON.stringify(body),
  })
}
function fixture() {
  const calls: string[] = [],
    operation: any = {
      id: OP,
      enrollmentId: ENROLLMENT,
      userId: USER,
      kind: "switch",
      status: "pending",
      expectedRevision: 0,
      cancellationVersion: 0,
      provider: "stripe",
      providerCustomerId: "cus_private",
      originalAgreementId: "sub_original",
      sourceAgreementId: "sub_original",
      originalTrialEndAt: "2090-01-08T00:00:00Z",
      sourceOffer: catalog.month,
      targetOffer: catalog.year,
      cancelAtPeriodEnd: false,
      targetAgreementId: null,
    }
  const publicView: any = {
    enrollmentId: ENROLLMENT,
    revision: 0,
    interval: "month",
    originalTrialEndAt: operation.originalTrialEndAt,
    cancelAtPeriodEnd: false,
    canManage: true,
    offers: catalog,
    pendingOperation: { operationId: OP, kind: "switch", targetInterval: "year" },
  }
  const deps: any = {
    userId: async () => USER,
    admin: { rpc: async () => ({ data: publicView, error: null }) },
    stripe: () => ({}),
    readMembership: async () => ({
      kind: "trial_membership",
      phase: "trial",
      firstPaymentSucceededAt: null,
      originalTrialEndAt: operation.originalTrialEndAt,
      cancelAtPeriodEnd: false,
    }),
    loadState: async () => ({
      enrollmentId: ENROLLMENT,
      revision: 0,
      effectiveOffer: catalog.month,
    }),
    loadCatalog: async () => catalog,
    begin: async (_client: unknown, input: any) => {
      assert.equal(input.authenticatedUserId, USER)
      calls.push("begin")
      return operation
    },
    loadOperation: async (_client: unknown, input: any) => {
      assert.equal(input.authenticatedUserId, USER)
      calls.push("load")
      return operation
    },
    stripeManagement: async (input: any) => {
      assert.equal(input.authenticatedUserId, USER)
      calls.push("stripe")
      return { status: "committed", operationId: OP }
    },
    paypalManagement: async (input: any) => {
      assert.equal(input.authenticatedUserId, USER)
      calls.push("paypal")
      return {
        status: "approval_required",
        operationId: OP,
        approvalUrl: "https://www.paypal.com/agreements/approve?token=approved",
      }
    },
    now: () => new Date("2089-01-01T00:00:00Z"),
  }
  return { deps, calls, operation, publicView }
}
test("authentication, exact JSON and same-origin guard precede any trial mutation", async () => {
  for (const payload of [
    { ...command, userId: USER },
    { ...command, price: 1 },
    { ...command, expectedRevision: -1 },
    { ...command, targetInterval: "quarter" },
    { action: "reconcile", operationId: OP, approved: true },
  ]) {
    const f = fixture()
    assert.equal((await handleTrialManagementPost(request(payload), f.deps)).status, 400)
    assert.deepEqual(f.calls, [])
  }
  for (const origin of ["https://evil.example", ""]) {
    const f = fixture()
    assert.equal((await handleTrialManagementPost(request(command, origin), f.deps)).status, 403)
    assert.deepEqual(f.calls, [])
  }
  const f = fixture()
  assert.equal(
    (await handleTrialManagementPost(request(command, "https://chaarlie.de", "text/plain"), f.deps))
      .status,
    400,
  )
  f.deps.userId = async () => null
  assert.equal((await handleTrialManagementPost(request(), f.deps)).status, 401)
  assert.deepEqual(f.calls, [])
})
test("begin reserves once; reconcile only loads the authenticated durable operation", async () => {
  const f = fixture()
  const started = await handleTrialManagementPost(request(), f.deps)
  assert.deepEqual(await started.json(), { status: "committed", operationId: OP })
  assert.deepEqual(f.calls, ["begin", "stripe"])
  f.calls.length = 0
  assert.equal(
    (await handleTrialManagementPost(request({ action: "reconcile", operationId: OP }), f.deps))
      .status,
    200,
  )
  assert.deepEqual(f.calls, ["load", "stripe"])
  f.operation.userId = "someone_else"
  f.calls.length = 0
  assert.equal((await handleTrialManagementPost(request(), f.deps)).status, 409)
  assert.deepEqual(f.calls, ["begin"])
})
test("provider failure retains accepted operation for reconciliation without claiming success", async () => {
  const f = fixture()
  f.deps.stripeManagement = async () => {
    throw new Error("provider timeout")
  }
  const response = await handleTrialManagementPost(request(), f.deps)
  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), { status: "pending", operationId: OP })
  f.deps.begin = async () => {
    throw new Error("revision conflict")
  }
  f.calls.length = 0
  assert.equal((await handleTrialManagementPost(request(), f.deps)).status, 409)
  assert.deepEqual(f.calls, [])
})
test("PayPal receives server constructed returns and only exact HTTPS approval destinations are forwarded", async () => {
  const f = fixture()
  f.operation.provider = "paypal"
  f.deps.paypalManagement = async (input: any) => {
    assert.equal(input.returnUrl, `https://chaarlie.de/profile?trialManagement=${OP}`)
    assert.equal(
      input.cancelUrl,
      `https://chaarlie.de/profile?trialManagement=${OP}&trialManagementReturn=cancel`,
    )
    return {
      status: "approval_required",
      operationId: OP,
      approvalUrl: "https://www.paypal.com/agreements/approve?token=ok",
    }
  }
  assert.equal(
    (await (await handleTrialManagementPost(request(), f.deps)).json()).status,
    "approval_required",
  )
  for (const url of [
    "http://www.paypal.com/approve",
    "https://www.paypal.com.evil.test/approve",
    "https://user@www.paypal.com/approve",
    "https://www.paypal.com:8443/approve",
    "https://checkout.stripe.com/pay/test",
    "javascript:alert(1)",
  ]) {
    f.deps.paypalManagement = async () => ({
      status: "approval_required",
      operationId: OP,
      approvalUrl: url,
    })
    const response = await handleTrialManagementPost(request(), f.deps)
    assert.equal(response.status, 202)
    assert.equal((await response.json()).approvalUrl, undefined)
  }
  assert.equal(
    validTrialManagementApprovalUrl("https://www.sandbox.paypal.com/approve", "paypal"),
    "https://www.sandbox.paypal.com/approve",
  )
})
test("GET discloses only public frozen prices and the owned pending operation", async () => {
  const f = fixture()
  f.publicView.providerCustomerId = "cus_private"
  f.publicView.provider = "stripe"
  const response = await handleTrialManagementGet(
    new Request(`https://chaarlie.de/api/billing/trial-management?enrollmentId=${ENROLLMENT}`),
    f.deps,
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  const body = await response.json()
  assert.equal(body.offers.year.firstAmountMinor, 6999)
  assert.equal(body.revision, 0)
  assert.deepEqual(body.pendingOperation, {
    operationId: OP,
    kind: "switch",
    targetInterval: "year",
  })
  assert.doesNotMatch(
    JSON.stringify(body),
    /cus_private|sub_original|price_year|coupon|stripe|paypal/,
  )
  f.deps.admin.rpc = async () => ({ data: null, error: null })
  assert.equal(
    (
      await handleTrialManagementGet(
        new Request(`https://chaarlie.de/api/billing/trial-management?enrollmentId=${ENROLLMENT}`),
        f.deps,
      )
    ).status,
    409,
  )
})
test("public snapshot eligibility is preserved and malformed snapshots fail closed", async () => {
  const f = fixture()
  f.publicView.canManage = false
  const url = new Request(
    `https://chaarlie.de/api/billing/trial-management?enrollmentId=${ENROLLMENT}`,
  )
  assert.equal((await (await handleTrialManagementGet(url, f.deps)).json()).canManage, false)
  f.publicView.revision = -1
  assert.equal((await handleTrialManagementGet(url, f.deps)).status, 503)
})

test("a fully canceled Stripe restore starts fresh hosted authorization on the same durable operation", async () => {
  const f = fixture()
  f.operation.kind = "restore"
  f.deps.stripeManagement = async () => ({ status: "requires_approval", operationId: OP })
  f.deps.stripeApproval = async (input: any) => {
    assert.equal(input.operationId, OP)
    assert.equal(input.authenticatedUserId, USER)
    assert.equal(input.successUrl, `https://chaarlie.de/profile?trialManagement=${OP}`)
    assert.equal(
      input.cancelUrl,
      `https://chaarlie.de/profile?trialManagement=${OP}&trialManagementReturn=cancel`,
    )
    return {
      status: "approval_required",
      operationId: OP,
      approvalUrl: "https://checkout.stripe.com/c/pay/cs_restore",
    }
  }
  const result = await handleTrialManagementPost(
    request({ action: "reconcile", operationId: OP }),
    f.deps,
  )
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), {
    status: "approval_required",
    operationId: OP,
    approvalUrl: "https://checkout.stripe.com/c/pay/cs_restore",
  })
})
