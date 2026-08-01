import assert from "node:assert/strict"
import test from "node:test"

import {
  CheckoutActivationError,
  ensureOneTimeCheckoutAccount,
  PERSONAL_PLAN_PREPARED_ARTIFACT_DELIVERY_PROVIDER,
  processStripeOneTimeFulfillmentJob,
  verifyStripeOneTimePaymentForRecovery,
} from "../src/lib/stripe/checkout-activation"

const originalPrice = process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE
process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE = "price_once"

const consentId = "0f762541-b540-4d26-8328-28d79737d39c"
const leadId = "11111111-1111-4111-8111-111111111111"
const funnelSessionId = "22222222-2222-4222-8222-222222222222"

function fixture() {
  const calls: string[] = []
  const consent: any = {
    id: consentId,
    lead_id: leadId,
    funnel_session_id: funnelSessionId,
    user_id: null,
    product_kind: "personal_plan_once",
    offer_variant: "personal-plan-one-time-v1",
    stripe_checkout_session_id: "cs_once",
    consent_text: "Sofort erstellen",
    copy_version: "2026-07-31",
    accepted_at: "2026-07-31T00:00:00.000Z",
    confirmation_status: "pending",
    confirmation_provider: null,
    confirmation_reference: null,
    confirmation_sent_at: null,
    delivered_at: null,
  }
  const artifact: any = {
    id: "artifact-1",
    lead_id: consent.lead_id,
    user_id: null,
    status: "attached",
    locked_plan: { routine: ["shampoo", "conditioner"] },
    created_at: "2026-07-31T00:00:00.000Z",
  }
  const purchases: any[] = []
  const jobs: any[] = []
  const profiles: Record<string, any> = {}
  const authUsers: Record<string, any> = {}
  const analyticsEvents: any[] = []
  const linkedLeadIds: Array<string | undefined> = []

  const table = (name: string) => {
    const filters: Array<[string, unknown]> = []
    let pendingPatch: any = null
    const rows = () => {
      if (name === "personal_plan_one_time_checkout_consents") return [consent]
      if (name === "billing_one_time_purchases") return purchases
      if (name === "personal_plan_one_time_fulfillment_jobs") return jobs
      if (name === "personal_plan_prepared_artifacts") return [artifact]
      if (name === "billing_analytics_outbox") return analyticsEvents
      return Object.values(profiles)
    }
    const matchedRow = () =>
      rows().find((row: any) => filters.every(([key, value]) => row[key] === value)) ?? null
    const finish = async () => {
      const row = matchedRow()
      if (pendingPatch && row) {
        calls.push(`update:${name}:${pendingPatch.confirmation_status ?? pendingPatch.status}`)
        Object.assign(row, pendingPatch)
      }
      return { data: row, error: null }
    }
    const api: any = {
      select: () => api,
      eq: (key: string, value: unknown) => (filters.push([key, value]), api),
      order: () => api,
      limit: () => api,
      maybeSingle: finish,
      single: finish,
      insert: (row: any) => {
        calls.push(`insert:${name}`)
        if (name === "personal_plan_one_time_fulfillment_jobs") {
          const inserted = {
            id: `job-${jobs.length + 1}`,
            attempts: 0,
            processing_started_at: null,
            next_attempt_at: null,
            last_error: null,
            delivery_provider: null,
            delivery_reference: null,
            canonical_content_sha256: null,
            delivered_at: null,
            created_at: "2026-07-31T00:00:00.000Z",
            ...row,
          }
          jobs.push(inserted)
          return { select: () => ({ single: async () => ({ data: inserted, error: null }) }) }
        }
        if (name === "billing_analytics_outbox") {
          const inserted = { id: `event-${analyticsEvents.length + 1}`, ...row }
          analyticsEvents.push(inserted)
          return { select: () => ({ single: async () => ({ data: inserted, error: null }) }) }
        }
        return { select: () => ({ single: async () => ({ data: row, error: null }) }) }
      },
      upsert: (row: any) => {
        calls.push(`upsert:${name}`)
        if (name === "profiles") {
          profiles[row.id] = { ...(profiles[row.id] ?? {}), ...row }
          return {
            select: () => ({ single: async () => ({ data: profiles[row.id], error: null }) }),
          }
        }
        if (name === "billing_analytics_deliveries") {
          return {
            error: null,
            select: () => ({ single: async () => ({ data: row, error: null }) }),
          }
        }
        const existing = purchases.find(
          (purchase) =>
            purchase.provider === row.provider &&
            purchase.provider_transaction_id === row.provider_transaction_id,
        )
        if (existing) Object.assign(existing, row)
        else
          purchases.push({
            id: `purchase-${purchases.length + 1}`,
            consent_id: consent.id,
            refunded_amount_minor: 0,
            refunded_at: null,
            created_at: "2026-07-31T00:00:00.000Z",
            ...row,
          })
        const data = existing ?? purchases[purchases.length - 1]
        return { select: () => ({ single: async () => ({ data, error: null }) }) }
      },
      update: (patch: any) => {
        pendingPatch = patch
        return api
      },
    }
    return api
  }

  const session: any = {
    id: "cs_once",
    created: 1_753_923_200,
    status: "complete",
    mode: "payment",
    payment_status: "paid",
    amount_total: 2999,
    currency: "eur",
    customer: null,
    customer_details: { email: "paid@example.com" },
    payment_intent: {
      id: "pi_1",
      created: 1_753_923_100,
      latest_charge: { id: "ch_1", created: 1_753_923_234 },
    },
    line_items: { data: [{ price: { id: "price_once" } }] },
    metadata: {
      product_kind: "personal_plan_once",
      personal_plan_once_consent_id: consent.id,
      lead_id: consent.lead_id,
      funnel_session_id: consent.funnel_session_id,
    },
  }
  const deps: any = {
    supabase: {
      from: table,
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push(`rpc:${fn}`)
        if (fn === "claim_personal_plan_one_time_fulfillment_job") {
          const job = jobs.find((row) => row.id === args.p_job_id)
          if (!job) return { data: null, error: null }
          Object.assign(job, {
            status: "processing",
            processing_started_at: "2026-07-31T00:00:00.000Z",
          })
          return { data: job, error: null }
        }
        if (fn === "link_personal_plan_artifact_to_user") {
          if (args.p_lead_id !== artifact.lead_id || artifact.status !== "attached") {
            return { data: null, error: new Error("artifact missing") }
          }
          if (artifact.user_id && artifact.user_id !== args.p_user_id) {
            return { data: null, error: new Error("artifact belongs to another user") }
          }
          artifact.user_id = args.p_user_id
          return {
            data: {
              artifact_id: artifact.id,
              locked_plan: artifact.locked_plan,
            },
            error: null,
          }
        }
        if (fn !== "bind_personal_plan_one_time_purchase_user") {
          return { data: null, error: new Error(`unexpected rpc ${fn}`) }
        }
        const purchase = purchases.find((row) => row.id === args.p_purchase_id)
        if (!purchase) return { data: null, error: new Error("purchase missing") }
        purchase.user_id = args.p_user_id
        consent.user_id = args.p_user_id
        return { data: purchase, error: null }
      },
      auth: {
        admin: {
          createUser: async (input: any) => {
            calls.push("create-user")
            authUsers["user-1"] = {
              id: "user-1",
              app_metadata: input.app_metadata ?? {},
            }
            return { data: { user: { id: "user-1" } }, error: null }
          },
          getUserById: async (userId: string) => ({
            data: { user: authUsers[userId] ?? null },
            error: null,
          }),
        },
      },
    },
    stripe: { checkout: { sessions: { retrieve: async () => session } } },
    premiumTierId: "",
    linkQuizToProfile: async (
      userId: string,
      _email: string | undefined,
      linkedLeadId?: string,
    ) => {
      calls.push("link-quiz")
      linkedLeadIds.push(linkedLeadId)
      artifact.user_id = userId
    },
  }
  return {
    calls,
    consent,
    purchases,
    jobs,
    analyticsEvents,
    deps,
    session,
    artifact,
    linkedLeadIds,
  }
}

test("canonical Stripe one-time activation sends confirmation, records delivery, and activates access", async () => {
  const state = fixture()
  state.deps.sendOneTimeConfirmation = async () => {
    state.calls.push("send")
    return { confirmationReference: "ref-1" }
  }
  const result = await ensureOneTimeCheckoutAccount(state.session, state.deps)
  assert.equal(result.state, "active")
  assert.equal(result.stripeCustomerId, undefined)
  assert.equal(result.paymentIntentId, "pi_1")
  assert.equal(result.chargeId, "ch_1")
  assert.equal(state.purchases.length, 1)
  assert.equal(state.purchases[0].user_id, "user-1")
  assert.equal(state.purchases[0].paid_at, "2025-07-31T00:53:54.000Z")
  assert.equal(state.consent.confirmation_status, "sent")
  assert.equal(state.consent.delivery_provider, PERSONAL_PLAN_PREPARED_ARTIFACT_DELIVERY_PROVIDER)
  assert.equal(state.consent.delivery_reference, "artifact-1")
  assert.equal(state.analyticsEvents.length, 1)
  assert.ok(state.calls.indexOf("upsert:billing_one_time_purchases") < state.calls.indexOf("send"))
})

test("one-time activation links the prepared artifact before finalization even when called with deferred linking", async () => {
  const state = fixture()
  const deferred: Array<() => void | Promise<void>> = []
  state.deps.profileLinkMode = "defer"
  state.deps.defer = (work: () => void | Promise<void>) => deferred.push(work)
  state.deps.sendOneTimeConfirmation = async () => ({ confirmationReference: "ref-1" })

  const result = await ensureOneTimeCheckoutAccount(state.session, state.deps)

  assert.equal(result.state, "active")
  assert.equal(state.consent.delivery_provider, PERSONAL_PLAN_PREPARED_ARTIFACT_DELIVERY_PROVIDER)
  assert.equal(state.artifact.user_id, "user-1")
  // Quiz/profile linking stays synchronous for the artifact bind; only vendor
  // analytics is deferred after durable outbox rows exist.
  assert.equal(deferred.length, 1)
})

test("Stripe finalization binds the prepared artifact when generic profile linking no-ops", async () => {
  const state = fixture()
  state.deps.linkQuizToProfile = async () => {
    state.calls.push("link-quiz-noop")
  }
  state.deps.sendOneTimeConfirmation = async () => ({ confirmationReference: "ref-1" })

  const result = await ensureOneTimeCheckoutAccount(state.session, state.deps)

  assert.equal(result.state, "active")
  assert.equal(state.artifact.user_id, "user-1")
  assert.equal(state.consent.delivery_provider, PERSONAL_PLAN_PREPARED_ARTIFACT_DELIVERY_PROVIDER)
  assert.equal(state.consent.delivery_reference, "artifact-1")
  assert.ok(state.calls.includes("rpc:link_personal_plan_artifact_to_user"))
})

test("confirmation failure leaves the captured Stripe purchase in paid pending for retry", async () => {
  const state = fixture()
  state.deps.sendOneTimeConfirmation = async () => {
    throw new Error("down")
  }
  const result = await ensureOneTimeCheckoutAccount(state.session, state.deps)
  assert.equal(result.state, "paid_pending")
  assert.equal(state.purchases.length, 1)
  assert.equal(state.purchases[0].user_id, "user-1")
  assert.equal(state.consent.confirmation_status, "pending")
  assert.equal(state.jobs[0].status, "failed")
})

test("missing prepared locked plan leaves the captured Stripe purchase in paid pending", async () => {
  const state = fixture()
  state.artifact.status = "superseded"
  state.deps.sendOneTimeConfirmation = async () => ({ confirmationReference: "ref-1" })
  const result = await ensureOneTimeCheckoutAccount(state.session, state.deps)
  assert.equal(result.state, "paid_pending")
  assert.equal(state.purchases.length, 1)
  assert.equal(state.consent.confirmation_status, "sent")
  assert.equal(state.consent.delivered_at, null)
  assert.equal(state.jobs[0].status, "failed")
})

test("a null prepared locked plan leaves the captured Stripe purchase undelivered", async () => {
  const state = fixture()
  state.artifact.locked_plan = null
  state.deps.sendOneTimeConfirmation = async () => ({ confirmationReference: "ref-1" })

  const result = await ensureOneTimeCheckoutAccount(state.session, state.deps)

  assert.equal(result.state, "paid_pending")
  assert.equal(state.consent.delivered_at, null)
  assert.equal(state.consent.delivery_provider ?? null, null)
  assert.equal(state.jobs[0].status, "failed")
})

test("a Stripe one-time session cannot activate a different stored consent", async () => {
  const state = fixture()
  state.consent.stripe_checkout_session_id = "cs_other"
  await assert.rejects(
    () => ensureOneTimeCheckoutAccount(state.session, state.deps),
    (error: unknown) =>
      error instanceof CheckoutActivationError && error.code === "checkout_one_time_invalid",
  )
  assert.equal(state.purchases.length, 0)
})

test("a Stripe one-time session cannot activate consent with different lead or funnel metadata", async () => {
  const state = fixture()
  state.session.metadata.funnel_session_id = "33333333-3333-4333-8333-333333333333"
  await assert.rejects(
    () => ensureOneTimeCheckoutAccount(state.session, state.deps),
    (error: unknown) =>
      error instanceof CheckoutActivationError && error.code === "checkout_one_time_invalid",
  )
  assert.equal(state.purchases.length, 0)
})

test("missing historical Stripe one-time lead and funnel metadata resolves from bound consent", async () => {
  const state = fixture()
  delete state.session.metadata.lead_id
  delete state.session.metadata.funnel_session_id
  state.deps.sendOneTimeConfirmation = async () => ({ confirmationReference: "ref-1" })

  const verification = await verifyStripeOneTimePaymentForRecovery(
    "cs_once",
    state.deps.stripe,
    state.deps.supabase,
  )
  assert.equal(verification.refs.leadId, leadId)
  assert.equal(verification.refs.funnelSessionId, funnelSessionId)

  const result = await ensureOneTimeCheckoutAccount(state.session, state.deps)

  assert.equal(result.state, "active")
  assert.equal(result.leadId, leadId)
  assert.deepEqual(state.linkedLeadIds, [leadId])
  assert.equal(state.purchases.length, 1)
  assert.equal(state.artifact.user_id, "user-1")
})

test("present Stripe one-time offer metadata must match the bound consent", async () => {
  const state = fixture()
  state.session.metadata.offer_variant = "other-offer"

  await assert.rejects(
    () => ensureOneTimeCheckoutAccount(state.session, state.deps),
    (error: unknown) =>
      error instanceof CheckoutActivationError && error.code === "checkout_one_time_invalid",
  )
  assert.equal(state.purchases.length, 0)
})

test("a fully refunded latest Stripe charge is rejected before one-time fulfillment", async () => {
  const state = fixture()
  state.session.payment_intent.latest_charge = {
    ...state.session.payment_intent.latest_charge,
    amount: 2999,
    amount_refunded: 2999,
    refunded: true,
  }
  state.deps.sendOneTimeConfirmation = async () => {
    state.calls.push("send")
    return { confirmationReference: "unexpected" }
  }

  await assert.rejects(
    () => ensureOneTimeCheckoutAccount(state.session, state.deps),
    (error: unknown) =>
      error instanceof CheckoutActivationError && error.code === "checkout_one_time_charge_revoked",
  )

  assert.equal(state.purchases.length, 0)
  assert.equal(state.analyticsEvents.length, 0)
  assert.equal(state.calls.includes("create-user"), false)
  assert.equal(state.calls.includes("send"), false)
  assert.equal(state.artifact.user_id, null)
})

test("a disputed latest Stripe charge is rejected before one-time fulfillment", async () => {
  const state = fixture()
  state.session.payment_intent.latest_charge = {
    ...state.session.payment_intent.latest_charge,
    disputed: true,
  }
  state.deps.sendOneTimeConfirmation = async () => {
    state.calls.push("send")
    return { confirmationReference: "unexpected" }
  }

  await assert.rejects(
    () => ensureOneTimeCheckoutAccount(state.session, state.deps),
    (error: unknown) =>
      error instanceof CheckoutActivationError && error.code === "checkout_one_time_charge_revoked",
  )

  assert.equal(state.purchases.length, 0)
  assert.equal(state.analyticsEvents.length, 0)
  assert.equal(state.calls.includes("create-user"), false)
  assert.equal(state.calls.includes("send"), false)
  assert.equal(state.artifact.user_id, null)
})

test("user-bound prepared artifact is required before one-time finalization", async () => {
  const state = fixture()
  state.deps.linkQuizToProfile = async () => {
    state.calls.push("link-quiz-wrong-user")
    state.artifact.user_id = "other-user"
  }
  state.deps.sendOneTimeConfirmation = async () => ({ confirmationReference: "ref-1" })
  const result = await ensureOneTimeCheckoutAccount(state.session, state.deps)
  assert.equal(result.state, "paid_pending")
  assert.equal(state.purchases.length, 1)
  assert.equal(state.jobs[0].status, "failed")
  assert.equal(state.consent.delivered_at, null)
})

test("Stripe one-time recovery verification is read-only and omits email from refs", async () => {
  const state = fixture()
  const verification = await verifyStripeOneTimePaymentForRecovery(
    "cs_once",
    state.deps.stripe,
    state.deps.supabase,
  )
  assert.equal(verification.payment.email, "paid@example.com")
  assert.equal(verification.refs.checkoutSessionId, "cs_once")
  assert.equal(verification.refs.paymentIntentId, "pi_1")
  assert.equal(verification.refs.consentId, consentId)
  assert.equal("email" in verification.refs, false)
  assert.deepEqual(state.calls, [])
  assert.equal(state.purchases.length, 0)
})

test("Stripe fulfillment job retry reuses stored Checkout Session validation", async () => {
  const state = fixture()
  state.purchases.push({
    id: "purchase-1",
    user_id: null,
    consent_id: consentId,
    provider: "stripe",
    product_kind: "personal_plan_once",
    provider_transaction_id: "pi_1",
    provider_customer_id: null,
    provider_order_id: "cs_once",
    amount_minor: 2999,
    currency: "eur",
    refunded_amount_minor: 0,
    status: "paid",
    paid_at: "2025-07-31T00:53:54.000Z",
    refunded_at: null,
    metadata: {},
    created_at: "2026-07-31T00:00:00.000Z",
    updated_at: "2026-07-31T00:00:00.000Z",
  })
  const job = {
    id: "job-1",
    purchase_id: "purchase-1",
    consent_id: consentId,
    status: "processing",
    attempts: 1,
    next_attempt_at: null,
    processing_started_at: "2026-07-31T00:00:00.000Z",
    last_error: null,
    delivery_provider: null,
    delivery_reference: null,
    canonical_content_sha256: null,
    delivered_at: null,
    created_at: "2026-07-31T00:00:00.000Z",
    updated_at: "2026-07-31T00:00:00.000Z",
  }
  state.jobs.push(job)
  delete state.session.metadata.lead_id
  delete state.session.metadata.funnel_session_id
  state.deps.sendOneTimeConfirmation = async () => ({ confirmationReference: "ref-1" })
  const result = await processStripeOneTimeFulfillmentJob(job as any, state.deps)
  assert.equal(result.state, "active")
  assert.equal(state.purchases[0].user_id, "user-1")
  assert.equal(state.artifact.user_id, "user-1")
  assert.equal(state.consent.delivery_reference, "artifact-1")
  assert.deepEqual(state.linkedLeadIds, [leadId])
})

test("Stripe fulfillment retry marks deterministic provider identity mismatch permanent", async () => {
  const state = fixture()
  state.purchases.push({
    id: "purchase-1",
    user_id: null,
    consent_id: consentId,
    provider: "stripe",
    product_kind: "personal_plan_once",
    provider_transaction_id: "pi_stored",
    provider_customer_id: null,
    provider_order_id: "cs_once",
    amount_minor: 2999,
    currency: "eur",
    refunded_amount_minor: 0,
    status: "paid",
    paid_at: "2025-07-31T00:53:54.000Z",
    refunded_at: null,
    metadata: {},
    created_at: "2026-07-31T00:00:00.000Z",
    updated_at: "2026-07-31T00:00:00.000Z",
  })
  const job = {
    id: "job-1",
    purchase_id: "purchase-1",
    consent_id: consentId,
    status: "processing",
    attempts: 1,
    next_attempt_at: null,
    processing_started_at: "2026-07-31T00:00:00.000Z",
    last_error: null,
    delivery_provider: null,
    delivery_reference: null,
    canonical_content_sha256: null,
    delivered_at: null,
    created_at: "2026-07-31T00:00:00.000Z",
    updated_at: "2026-07-31T00:00:00.000Z",
  }
  state.jobs.push(job)

  const result = await processStripeOneTimeFulfillmentJob(job as any, state.deps)

  assert.equal(result.state, "paid_pending")
  assert.equal(result.job?.status, "failed_permanent")
  assert.equal(result.job?.attempts, 2)
  assert.equal(result.job?.next_attempt_at, null)
  assert.match(result.job?.last_error ?? "", /fulfillment job purchase/)
  assert.equal(state.calls.includes("create-user"), false)
  assert.equal(state.artifact.user_id, null)
})

test("Stripe fulfillment retry keeps provider outages retryable", async () => {
  const state = fixture()
  state.deps.now = () => new Date("2026-07-31T10:00:00.000Z")
  state.deps.stripe.checkout.sessions.retrieve = async () => {
    throw new Error("Stripe API 503")
  }
  state.purchases.push({
    id: "purchase-1",
    user_id: null,
    consent_id: consentId,
    provider: "stripe",
    product_kind: "personal_plan_once",
    provider_transaction_id: "pi_1",
    provider_customer_id: null,
    provider_order_id: "cs_once",
    amount_minor: 2999,
    currency: "eur",
    refunded_amount_minor: 0,
    status: "paid",
    paid_at: "2025-07-31T00:53:54.000Z",
    refunded_at: null,
    metadata: {},
    created_at: "2026-07-31T00:00:00.000Z",
    updated_at: "2026-07-31T00:00:00.000Z",
  })
  const job = {
    id: "job-1",
    purchase_id: "purchase-1",
    consent_id: consentId,
    status: "processing",
    attempts: 1,
    next_attempt_at: null,
    processing_started_at: "2026-07-31T00:00:00.000Z",
    last_error: null,
    delivery_provider: null,
    delivery_reference: null,
    canonical_content_sha256: null,
    delivered_at: null,
    created_at: "2026-07-31T00:00:00.000Z",
    updated_at: "2026-07-31T00:00:00.000Z",
  }
  state.jobs.push(job)

  const result = await processStripeOneTimeFulfillmentJob(job as any, state.deps)

  assert.equal(result.state, "paid_pending")
  assert.equal(result.job?.status, "failed")
  assert.equal(result.job?.attempts, 2)
  assert.equal(result.job?.next_attempt_at, "2026-07-31T10:04:00.000Z")
  assert.match(result.job?.last_error ?? "", /Stripe API 503/)
  assert.equal(state.calls.includes("create-user"), false)
})

test("a sent and delivered activation is idempotent during Stripe replay", async () => {
  const state = fixture()
  state.consent.confirmation_status = "sent"
  state.consent.generated_content_sha256 =
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  state.consent.generation_started_at = "2026-07-31T00:00:00.000Z"
  state.consent.generation_completed_at = "2026-07-31T00:00:01.000Z"
  state.consent.delivery_provider = PERSONAL_PLAN_PREPARED_ARTIFACT_DELIVERY_PROVIDER
  state.consent.delivery_reference = "artifact-1"
  state.consent.delivered_at = "2026-07-31T00:00:01.000Z"
  state.deps.sendOneTimeConfirmation = async () => {
    throw new Error("must not send")
  }
  const first = await ensureOneTimeCheckoutAccount(state.session, state.deps)
  const second = await ensureOneTimeCheckoutAccount(state.session, state.deps)
  if (first.state !== "active" || second.state !== "active") {
    throw new Error("expected active replay results")
  }
  assert.equal(first.canSetInitialPassword, true)
  assert.equal(second.canSetInitialPassword, true)
  assert.equal(state.purchases.length, 1)
})

test("an unclaimed prepared one-time session is rejected before account creation", async () => {
  const state = fixture()
  state.session.metadata = {
    ...state.session.metadata,
    checkout_preparation_id: "c2a89c81-7e93-4d81-98d1-c7cfd7047721",
    checkout_preparation_status: "prepared",
  }

  await assert.rejects(
    () => ensureOneTimeCheckoutAccount(state.session, state.deps),
    (error: unknown) =>
      error instanceof CheckoutActivationError && error.code === "checkout_preparation_unclaimed",
  )
  assert.equal(state.calls.includes("create-user"), false)
})

test.after(() => {
  if (originalPrice === undefined) delete process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE
  else process.env.STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE = originalPrice
})
