import assert from "node:assert/strict"
import test from "node:test"
import {
  handleTrialPaidRecoveryGet,
  handleTrialPaidRecoveryPost,
} from "../src/app/api/billing/trial-paid-recovery/route"
const USER = "11111111-1111-4111-8111-111111111111",
  ENROLLMENT = "22222222-2222-4222-8222-222222222222",
  OP = "33333333-3333-4333-8333-333333333333"
const body = {
  action: "begin",
  operationId: OP,
  enrollmentId: ENROLLMENT,
  expectedRevision: 0,
  kind: "recover_unpaid",
}
const request = (value: unknown = body, origin = "https://chaarlie.de") =>
  new Request("https://chaarlie.de/api/billing/trial-paid-recovery", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(value),
  })
function fixture() {
  const calls: string[] = []
  const operation: any = {
    id: OP,
    userId: USER,
    enrollmentId: ENROLLMENT,
    provider: "paypal",
    kind: "recover_unpaid",
    status: "pending",
  }
  const view: any = {
    enrollmentId: ENROLLMENT,
    revision: 0,
    originalTrialEndAt: "2026-01-08T10:00:00Z",
    paidThroughAt: null,
    cancelAtPeriodEnd: true,
    kind: "recover_unpaid",
    offer: {
      interval: "year",
      currency: "EUR",
      firstAmountMinor: 6999,
      renewalAmountMinor: 9999,
      stripePriceId: "private_price",
    },
    pendingOperation: null,
    providerCustomerId: "private_payer",
  }
  const deps: any = {
    userId: async () => USER,
    admin: {
      rpc: async (name: string, args: any) => {
        assert.equal(name, "load_trial_paid_recovery_public_view")
        assert.equal(args.p_authenticated_user_id, USER)
        return { data: view, error: null }
      },
    },
    stripe: () => ({}),
    begin: async (_client: any, input: any) => {
      assert.equal(input.authenticatedUserId, USER)
      calls.push("begin")
      return operation
    },
    load: async (_client: any, input: any) => {
      assert.equal(input.authenticatedUserId, USER)
      calls.push("load")
      return operation
    },
    paypal: async (input: any) => {
      assert.equal(input.returnUrl, `https://chaarlie.de/profile?trialPaidRecovery=${OP}`)
      assert.equal(input.authenticatedUserId, USER)
      calls.push("paypal")
      return {
        status: "approval_required",
        operationId: OP,
        approvalUrl: "https://www.paypal.com/agreements/approve?token=test",
      }
    },
    stripeRecovery: async (input: any) => {
      assert.equal(input.successUrl, `https://chaarlie.de/profile?trialPaidRecovery=${OP}`)
      assert.equal(input.authenticatedUserId, USER)
      calls.push("stripe")
      return {
        status: "approval_required",
        operationId: OP,
        approvalUrl: "https://checkout.stripe.com/c/pay/test",
      }
    },
  }
  return { deps, calls, operation, view }
}
test("paid recovery requires server authentication, exact consent fields and same origin before mutation", async () => {
  for (const value of [
    { ...body, amount: 1 },
    { ...body, paid: true },
    { ...body, kind: "free_trial" },
    { ...body, expectedRevision: -1 },
    { action: "reconcile", operationId: OP, payerId: USER },
  ]) {
    const f = fixture()
    assert.equal((await handleTrialPaidRecoveryPost(request(value), f.deps)).status, 400)
    assert.deepEqual(f.calls, [])
  }
  const f = fixture()
  assert.equal(
    (await handleTrialPaidRecoveryPost(request(body, "https://other.example"), f.deps)).status,
    403,
  )
  f.deps.userId = async () => null
  assert.equal((await handleTrialPaidRecoveryPost(request(), f.deps)).status, 401)
  assert.deepEqual(f.calls, [])
})
test("provider approval follows accepted durable action and retries load the same owned operation", async () => {
  const f = fixture()
  assert.equal(
    (await (await handleTrialPaidRecoveryPost(request(), f.deps)).json()).status,
    "approval_required",
  )
  assert.deepEqual(f.calls, ["begin", "paypal"])
  f.calls.length = 0
  f.operation.provider = "stripe"
  const result = await handleTrialPaidRecoveryPost(
    request({ action: "reconcile", operationId: OP }),
    f.deps,
  )
  assert.equal((await result.json()).approvalUrl, "https://checkout.stripe.com/c/pay/test")
  assert.deepEqual(f.calls, ["load", "stripe"])
  f.operation.userId = "another_owner"
  f.calls.length = 0
  assert.equal((await handleTrialPaidRecoveryPost(request(), f.deps)).status, 409)
  assert.deepEqual(f.calls, ["begin"])
})
test("ambiguous provider results preserve pending action; forged return destinations never reach client", async () => {
  for (const mode of ["throw", "foreign", "port", "userinfo"]) {
    const f = fixture()
    f.deps.paypal = async () => {
      if (mode === "throw") throw new Error("lost response")
      return {
        operationId: OP,
        status: "approval_required",
        approvalUrl:
          mode === "foreign"
            ? "https://www.paypal.com.evil.example/approve"
            : mode === "port"
              ? "https://www.paypal.com:8443/approve"
              : "https://user@www.paypal.com/approve",
      }
    }
    const result = await handleTrialPaidRecoveryPost(request(), f.deps)
    assert.equal(result.status, 202)
    assert.deepEqual(await result.json(), { status: "pending", operationId: OP })
  }
})
test("public recovery view omits provider internals and preserves frozen first/renewal terms", async () => {
  const f = fixture(),
    url = new Request(
      `https://chaarlie.de/api/billing/trial-paid-recovery?enrollmentId=${ENROLLMENT}`,
    )
  const result = await handleTrialPaidRecoveryGet(url, f.deps)
  assert.equal(result.status, 200)
  assert.equal(result.headers.get("cache-control"), "private, no-store")
  const v = await result.json()
  assert.equal(v.offer.firstAmountMinor, 6999)
  assert.equal(v.offer.renewalAmountMinor, 9999)
  assert.doesNotMatch(JSON.stringify(v), /private_price|private_payer|stripePriceId/)
  f.view.pendingOperation = { operationId: OP, kind: "repair_paid" }
  assert.deepEqual(
    (await (await handleTrialPaidRecoveryGet(url, f.deps)).json()).pendingOperation,
    { operationId: OP, kind: "repair_paid" },
  )
  f.view.revision = -1
  assert.equal((await handleTrialPaidRecoveryGet(url, f.deps)).status, 503)
})
