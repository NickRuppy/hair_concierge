import assert from "node:assert/strict"
import test from "node:test"
import { reconcilePayPalTrialCandidateExpiry } from "../src/lib/paypal/trial-candidate-expiry"
import { handleTrialCancellationReconcile } from "../src/app/api/billing/trial-cancellation/reconcile/route"
function fixture() {
  const c: any = {
      agreement_id: "I-candidate",
      lease_token: "lease",
      kind: "initial",
      reference_id: "reference",
      app_id: "APP",
      plan_id: "PLAN",
      custom_id: "TOKEN",
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    s: any = {
      id: c.agreement_id,
      plan_id: c.plan_id,
      custom_id: c.custom_id,
      status: "APPROVAL_PENDING",
    }
  const calls: any[] = []
  let committed = false,
    reads = 0
  const d: any = {
    supabase: {
      rpc: async (name: string, a: any) => {
        calls.push({ rpc: name, args: a })
        if (name === "claim_paypal_trial_candidate_expiry") return { data: [c], error: null }
        if (name === "read_paypal_trial_candidate_expiry_state")
          return { data: { committed, userId: "owner" }, error: null }
        if (name === "complete_paypal_trial_candidate_expiry") return { data: true, error: null }
        throw new Error(name)
      },
    },
    attestApp: async () => "APP",
    retrieve: async () => {
      reads++
      return { ...s }
    },
    cancel: async () => {
      calls.push({ cancel: true })
      s.status = "CANCELLED"
    },
    transactions: async () => [],
  }
  return { c, s, d, calls, reads: () => reads, setCommitted: (v: boolean) => (committed = v) }
}
test("expiry re-reads pending approval then verifies cancellation and no payment before durable completion", async () => {
  const f = fixture()
  assert.deepEqual(await reconcilePayPalTrialCandidateExpiry(f.d), {
    claimed: 1,
    canceled: 1,
    accepted: 0,
    pending: 0,
  })
  assert.equal(f.reads(), 3)
  assert.equal(f.calls.at(-1).args.p_result, "canceled_no_payment")
})
test("provider activation racing expiry reconciles approval instead of canceling it", async () => {
  const f = fixture()
  let n = 0
  f.d.retrieve = async () => ({ ...f.s, status: ++n === 1 ? "APPROVAL_PENDING" : "ACTIVE" })
  f.d.reconcileAccepted = async () => true
  assert.equal((await reconcilePayPalTrialCandidateExpiry(f.d)).accepted, 1)
  assert.equal(
    f.calls.some((c) => c.cancel),
    false,
  )
})
test("initial ACTIVE without canonical activation remains explicit reconciliation debt", async () => {
  const f = fixture()
  f.s.status = "ACTIVE"
  assert.equal((await reconcilePayPalTrialCandidateExpiry(f.d)).pending, 1)
  assert.equal(
    f.calls.some((c) => c.cancel),
    false,
  )
  assert.equal(f.calls.at(-1).args.p_result, "reconciliation_required")
})
test("committed local access and ownership mismatch prevent cancellation", async () => {
  for (const variant of ["committed", "foreign"]) {
    const f = fixture()
    if (variant === "committed") f.setCommitted(true)
    else f.s.custom_id = "foreign"
    const r = await reconcilePayPalTrialCandidateExpiry(f.d)
    assert.equal(variant === "committed" ? r.accepted : r.pending, 1)
    assert.equal(
      f.calls.some((c) => c.cancel),
      false,
    )
  }
})
test("a collection racing cancellation is preserved as debt instead of abandoned", async () => {
  const f = fixture()
  f.d.transactions = async () => [{ id: "sale", status: "COMPLETED" }]
  assert.equal((await reconcilePayPalTrialCandidateExpiry(f.d)).pending, 1)
  assert.equal(f.calls.at(-1).args.p_result, "reconciliation_required")
})
test("authenticated five-minute cron runs expiry and declaration retry together", async () => {
  let calls = 0
  const r = await handleTrialCancellationReconcile(
    new Request("https://chaarlie.de/api/billing/trial-cancellation/reconcile", {
      headers: { authorization: "Bearer secret" },
    }),
    {
      cronSecret: "secret",
      client: {} as any,
      reconcile: async () => ({ claimed: 0, confirmed: 0, pending: 0, unsupported: 0 }),
      expirePayPalCandidates: async () => {
        calls++
        return { claimed: 1, canceled: 1, accepted: 0, pending: 0 }
      },
    },
  )
  assert.equal(r.status, 200)
  assert.equal(calls, 1)
  assert.deepEqual((r.body as any).paypalTrialCandidateExpiry, {
    claimed: 1,
    canceled: 1,
    accepted: 0,
    pending: 0,
  })
  const denied = await handleTrialCancellationReconcile(new Request("https://chaarlie.de"), {
    cronSecret: "secret",
    client: {} as any,
    expirePayPalCandidates: async () => {
      calls++
      return null
    },
  })
  assert.equal(denied.status, 401)
  assert.equal(calls, 1)
})

test("new accepted cancellation invalidates an approved hidden replacement and prevents future collection", async () => {
  const f = fixture()
  f.c.kind = "paid_recovery"
  f.s.status = "ACTIVE"
  const rpc = f.d.supabase.rpc
  f.d.supabase.rpc = async (name: string, a: any) =>
    name === "read_paypal_trial_candidate_expiry_state"
      ? { data: { committed: false, userId: "owner", invalidated: true }, error: null }
      : rpc(name, a)
  assert.equal((await reconcilePayPalTrialCandidateExpiry(f.d)).canceled, 1)
  assert.equal(f.s.status, "CANCELLED")
})
