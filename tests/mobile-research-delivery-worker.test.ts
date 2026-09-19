import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
} from "@/lib/customerio/transactional"
import {
  reconcileMobileResearchDeliveries,
  type ResearchDeliveryDependencies,
} from "@/lib/mobile/research-delivery-worker"

const submissionId = "33333333-3333-4333-8333-333333333333"
const candidate = { submission_id: submissionId, user_id: "owner", lease_token: "candidate-lease" }
const makeRow = (channel: "email" | "push") => ({
  ...candidate,
  id: channel,
  lease_token: `${channel}-lease`,
  channel,
  installation_id: channel === "push" ? "device" : null,
  send_attempts: 0,
})

function fixture(
  options: {
    candidate?: boolean
    channels?: ("email" | "push")[]
    confirmed?: boolean
    installation?: boolean
    sendAttempts?: number
  } = {},
) {
  const rows = (options.channels ?? ["email", "push"]).map(makeRow)
  for (const row of rows) row.send_attempts = options.sendAttempts ?? 0
  const states = new Map<string, string>(rows.map((row) => [row.id, "pending"]))
  const calls: { name: string; args: Record<string, unknown> }[] = []
  let candidateClaimed = false
  let emailSends = 0
  let pushSends = 0
  const client = {
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              email: "user@example.com",
              email_confirmed_at: options.confirmed === false ? null : "2026-01-01",
            },
          },
          error: null,
        }),
      },
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      let data: unknown = true
      if (name === "claim_mobile_research_delivery_candidates") {
        data = options.candidate && !candidateClaimed ? [candidate] : []
        candidateClaimed = true
      } else if (name === "claim_mobile_research_deliveries") {
        data = rows.filter(
          (row) => row.channel === args.p_channel && states.get(row.id) === "pending",
        )
        for (const row of data as typeof rows) states.set(row.id, "processing")
      } else if (name === "begin_mobile_research_delivery_send") {
        data = states.get(String(args.p_delivery_id)) === "processing"
        if (data) states.set(String(args.p_delivery_id), "sending")
      } else if (name === "finish_mobile_research_delivery") {
        states.set(
          String(args.p_delivery_id),
          args.p_action === "retry" &&
            (options.sendAttempts ?? 0) >= 4 &&
            args.p_error_code !== "push_provider_credentials" &&
            states.get(String(args.p_delivery_id)) === "sending"
            ? "failed_terminal"
            : String(args.p_action),
        )
      } else if (name === "mobile_research_push_installation") {
        data =
          options.installation === false
            ? null
            : {
                token: "a".repeat(64),
                bindingVersion: "original-binding",
                environment: "production",
                topic: "de.chaarlie.app",
              }
      }
      return { data, error: null }
    },
  } as unknown as SupabaseClient
  const deps: ResearchDeliveryDependencies = {
    enabled: () => true,
    now: () => Date.parse("2026-09-18T20:00:00Z"),
    resolve: async () =>
      ({ kind: "ready", result: {} }) as Awaited<
        ReturnType<ResearchDeliveryDependencies["resolve"]>
      >,
    prepareEmail: () => async () => {
      emailSends++
      return { deliveryId: "receipt", queuedAt: "now" }
    },
    preparePush: () => async () => {
      pushSends++
      return { state: "accepted", apnsId: "apns-receipt" }
    },
  }
  return { client, deps, calls, states, sends: () => ({ email: emailSends, push: pushSends }) }
}

test("disabled delivery does not claim, resolve, or contact providers", async () => {
  const f = fixture({ candidate: true })
  f.deps.enabled = () => false
  const result = await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.equal(result.disabled, true)
  assert.deepEqual(f.calls, [])
  assert.deepEqual(f.sends(), { email: 0, push: 0 })
})

test("candidate and each channel require a fresh usable assessment", async () => {
  const f = fixture({ candidate: true })
  let checks = 0
  f.deps.resolve = async () => {
    checks++
    return { kind: "not_ready" }
  }
  const result = await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.equal(checks, 3)
  assert.equal(result.materialized, 0)
  assert.deepEqual(f.sends(), { email: 0, push: 0 })
  assert.equal(
    f.calls.some((call) => call.name === "begin_mobile_research_delivery_send"),
    false,
  )
  assert.equal(
    f.calls.find((call) => call.name === "finish_mobile_research_delivery_candidate")?.args
      .p_action,
    "retry",
  )
})

test("candidate materialization does not bypass the second eligibility check", async () => {
  const f = fixture({ candidate: true })
  let checks = 0
  const ready = f.deps.resolve
  f.deps.resolve = async (...args) => (++checks === 1 ? ready(...args) : { kind: "not_ready" })
  const result = await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.equal(result.materialized, 1)
  assert.deepEqual(f.sends(), { email: 0, push: 0 })
})

test("concurrent workers send each independently leased channel only once", async () => {
  const f = fixture({ candidate: true })
  const results = await Promise.all([
    reconcileMobileResearchDeliveries(f.client, f.deps),
    reconcileMobileResearchDeliveries(f.client, f.deps),
  ])
  assert.deepEqual(f.sends(), { email: 1, push: 1 })
  assert.equal(
    results.reduce((sum, result) => sum + result.queued, 0),
    2,
  )
  for (const channel of ["email", "push"]) {
    assert.equal(f.states.get(channel), "queued")
    const settlement = f.calls.find(
      (call) =>
        call.name === "finish_mobile_research_delivery" && call.args.p_delivery_id === channel,
    )
    assert.ok(settlement?.args.p_provider_delivery_id)
  }
})

test("ambiguous email remains held on later runs while push can finish", async () => {
  const f = fixture()
  let attempts = 0
  f.deps.prepareEmail = () => async () => {
    attempts++
    throw new CustomerIoAmbiguousDeliveryError("private provider body")
  }
  const first = await reconcileMobileResearchDeliveries(f.client, f.deps)
  await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.equal(attempts, 1)
  assert.equal(first.unknown, 1)
  assert.equal(f.states.get("email"), "unknown")
  assert.equal(f.states.get("push"), "queued")
  assert.doesNotMatch(JSON.stringify(f.calls), /private provider body/)
})

test("missing or rebound device suppresses push but email is still delivered", async () => {
  const f = fixture({ installation: false })
  await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.deepEqual(f.sends(), { email: 1, push: 0 })
  assert.equal(f.states.get("push"), "suppressed")
})

test("device rebound during assessment resolution prevents the old owner's push", async () => {
  const f = fixture({ channels: ["push"] })
  const original = f.client.rpc.bind(f.client)
  let lookups = 0
  f.client.rpc = (async (name: string, args: Record<string, unknown>) => {
    if (name === "mobile_research_push_installation" && ++lookups === 2)
      return { data: null, error: null }
    return original(name, args)
  }) as unknown as typeof f.client.rpc
  await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.deepEqual(f.sends(), { email: 0, push: 0 })
  assert.equal(f.states.get("push"), "suppressed")
})

test("unconfirmed email suppresses only email", async () => {
  const f = fixture({ confirmed: false })
  await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.deepEqual(f.sends(), { email: 0, push: 1 })
  assert.equal(f.states.get("email"), "suppressed")
})

for (const [status, expected] of [
  [400, "failed_terminal"],
  [408, "unknown"],
  [429, "retry"],
  [503, "unknown"],
] as const) {
  test(`email HTTP ${status} settles ${expected}`, async () => {
    const f = fixture({ channels: ["email"] })
    f.deps.prepareEmail = () => async () => {
      throw new CustomerIoHttpError(status, "sensitive provider detail")
    }
    await reconcileMobileResearchDeliveries(f.client, f.deps)
    assert.equal(f.states.get("email"), expected)
    assert.doesNotMatch(JSON.stringify(f.calls), /sensitive provider detail/)
  })
}

test("lost prepare lease never contacts the provider", async () => {
  const f = fixture()
  const original = f.client.rpc.bind(f.client)
  f.client.rpc = (async (name: string, args: Record<string, unknown>) =>
    name === "begin_mobile_research_delivery_send"
      ? { data: false, error: null }
      : original(name, args)) as unknown as typeof f.client.rpc
  await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.deepEqual(f.sends(), { email: 0, push: 0 })
})

test("an APNs credential fault is tagged for the outbox refund and retried slowly", async () => {
  const f = fixture({ channels: ["push"] })
  f.deps.preparePush = () => async () => ({
    state: "retryable",
    apnsId: "apns-receipt",
    reason: "InvalidProviderToken",
    retryAfterSeconds: 3600,
  })
  const result = await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.equal(result.retry, 1)
  const settled = f.calls.find((call) => call.name === "finish_mobile_research_delivery")
  assert.equal(settled?.args.p_error_code, "push_provider_credentials")
  assert.equal(Date.parse(String(settled?.args.p_next_attempt_at)) - f.deps.now(), 3600 * 1000)
})

test("a fifth APNs credential fault reports the refunded retry rather than a terminal failure", async () => {
  const f = fixture({ channels: ["push"], sendAttempts: 4 })
  f.deps.preparePush = () => async () => ({
    state: "retryable",
    apnsId: "apns-receipt",
    reason: "InvalidProviderToken",
    retryAfterSeconds: 3600,
  })
  const result = await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.equal(result.retry, 1)
  assert.equal(result.failed_terminal, 0)
  assert.equal(f.states.get("push"), "retry")
})

test("fifth definitive refusal reports the terminal state persisted by the outbox", async () => {
  const f = fixture({ channels: ["email"], sendAttempts: 4 })
  f.deps.prepareEmail = () => async () => {
    throw new CustomerIoHttpError(429)
  }
  const result = await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.equal(result.failed_terminal, 1)
  assert.equal(result.retry, 0)
  assert.equal(f.states.get("email"), "failed_terminal")
})

test("lost accepted receipt settlement leaves sending held and never resends", async () => {
  const f = fixture({ channels: ["email"] })
  const original = f.client.rpc.bind(f.client)
  f.client.rpc = (async (name: string, args: Record<string, unknown>) =>
    name === "finish_mobile_research_delivery"
      ? { data: null, error: { message: "db offline" } }
      : original(name, args)) as unknown as typeof f.client.rpc
  const result = await reconcileMobileResearchDeliveries(f.client, f.deps)
  await reconcileMobileResearchDeliveries(f.client, f.deps)
  assert.equal(result.errors, 1)
  assert.equal(f.states.get("email"), "sending")
  assert.equal(f.sends().email, 1)
})

test("APNs ambiguity is held; invalid token revocation uses the sent owner-bound token", async () => {
  const ambiguous = fixture({ channels: ["push"] })
  ambiguous.deps.preparePush = () => async () => ({
    state: "unknown",
    apnsId: "receipt",
    reason: "transport_failure",
  })
  await reconcileMobileResearchDeliveries(ambiguous.client, ambiguous.deps)
  assert.equal(ambiguous.states.get("push"), "unknown")
  const invalid = fixture({ channels: ["push"] })
  invalid.deps.preparePush = () => async () => ({
    state: "invalid_token",
    apnsId: "receipt",
    reason: "Unregistered",
    invalidatedAt: null,
  })
  await reconcileMobileResearchDeliveries(invalid.client, invalid.deps)
  const revoke = invalid.calls.find((call) => call.name === "mobile_research_invalidate_push_token")
  assert.deepEqual(revoke?.args, {
    p_user_id: "owner",
    p_installation_id: "device",
    p_apns_token: "a".repeat(64),
    p_binding_version: "original-binding",
  })
  assert.equal(invalid.states.get("push"), "failed_terminal")
})
