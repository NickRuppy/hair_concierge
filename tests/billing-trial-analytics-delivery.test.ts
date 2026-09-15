import assert from "node:assert/strict"
import test from "node:test"
import { deliverBillingAnalyticsToMeta } from "../src/lib/billing/analytics-destinations/meta-capi"
import { deliverBillingAnalyticsToPostHog } from "../src/lib/billing/analytics-destinations/posthog-server"
import { deliverBillingAnalyticsToCustomerIo } from "../src/lib/billing/analytics-destinations/customerio"
import { trialAnalyticsRequestContext } from "../src/lib/billing/trial-analytics-context"

const id = "11111111-1111-4111-8111-111111111111"
const event: any = {
  id: "outbox",
  event_key: `stripe:trial_started:${id}`,
  event_name: "trial_started",
  user_id: "user",
  provider: "stripe",
  provider_customer_id: null,
  provider_subscription_id: "sub",
  source_event_id: null,
  source_object_id: id,
  occurred_at: "2026-09-15T10:00:00Z",
  payload: {
    trial_enrollment_id: id,
    trial_analytics_version: 1,
    trial_authorized_at: "2026-09-15T10:00:00Z",
    value: 0,
    currency: "EUR",
    funnel_session_id: "session",
    funnel_package_key: "scan_v1",
  },
}

test("browser context requires explicit marketing consent and excludes IP, URLs, tokens and arbitrary fields", () => {
  const request = new Request(
    "https://chaarlie.de/api/stripe/create-checkout-session?token=secret",
    {
      headers: {
        cookie: "_fbp=fb.1.1234567890123.456; _fbc=fb.1.1234567890123.click",
        "user-agent": "browser",
        "x-forwarded-for": "1.2.3.4",
      },
    },
  )
  assert.deepEqual(trialAnalyticsRequestContext(request, false, "session"), {
    funnelSessionId: "session",
    meta: { marketing_consent: false },
  })
  const result = trialAnalyticsRequestContext(request, true, "session")
  assert.deepEqual(result.meta, {
    marketing_consent: true,
    fbp: "fb.1.1234567890123.456",
    fbc: "fb.1.1234567890123.click",
    client_user_agent: "browser",
  })
  assert.equal(JSON.stringify(result).includes("1.2.3.4"), false)
})

test("Meta verified activation maps to StartTrial with consented private matching and stable identity; diagnostics never leave PostHog", async (t) => {
  const previous = { token: process.env.META_CAPI_ACCESS_TOKEN, pixel: process.env.META_PIXEL_ID }
  const fetchBefore = global.fetch
  t.after(() => {
    global.fetch = fetchBefore
    if (previous.token === undefined) delete process.env.META_CAPI_ACCESS_TOKEN
    else process.env.META_CAPI_ACCESS_TOKEN = previous.token
    if (previous.pixel === undefined) delete process.env.META_PIXEL_ID
    else process.env.META_PIXEL_ID = previous.pixel
  })
  process.env.META_CAPI_ACCESS_TOKEN = "test"
  process.env.META_PIXEL_ID = "pixel"
  const sent: any[] = []
  global.fetch = async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
  }
  let consent = true
  const supabase: any = {
    rpc: async (name: string, args: any) => {
      assert.equal(name, "read_trial_analytics_meta_context")
      assert.equal(args.p_enrollment_id, id)
      return {
        data: {
          marketing_consent: consent,
          fbp: "fb.1.1234567890123.456",
          fbc: "fb.1.1234567890123.click",
          client_user_agent: "browser",
        },
        error: null,
      }
    },
  }
  const input = { event, profile: { id: "user", email: "person@example.com" }, supabase }
  assert.equal((await deliverBillingAnalyticsToMeta(input)).ok, true)
  assert.equal((await deliverBillingAnalyticsToMeta(input)).ok, true)
  assert.equal(sent[0].data[0].event_name, "StartTrial")
  assert.equal(sent[0].data[0].custom_data.value, 0)
  assert.equal(sent[0].data[0].event_id, `stripe:trial_started:${id}`)
  assert.equal(sent[0].data[0].event_id, sent[1].data[0].event_id)
  assert.equal(sent[0].data[0].user_data.fbp, "fb.1.1234567890123.456")
  assert.equal(sent[0].data[0].event_source_url, "https://chaarlie.de/result")
  assert.equal(JSON.stringify(sent).includes("person@example.com"), false)
  for (const provider of ["stripe", "paypal"]) {
    assert.equal(
      (
        await deliverBillingAnalyticsToMeta({
          ...input,
          event: {
            ...event,
            provider,
            event_name: "purchase_completed",
            payload: { ...event.payload, value: 9.99 },
          },
        })
      ).ok,
      true,
    )
    const purchase = sent.at(-1).data[0]
    assert.equal(purchase.event_name, "Purchase")
    assert.equal(purchase.action_source, "system_generated")
    assert.equal(purchase.event_source_url, undefined)
    assert.equal(purchase.custom_data.value, 9.99)
  }
  consent = false
  assert.equal((await deliverBillingAnalyticsToMeta(input)).permanent, true)
  assert.equal(
    (
      await deliverBillingAnalyticsToMeta({
        ...input,
        event: {
          ...event,
          event_name: "purchase_completed",
          payload: { ...event.payload, value: 9.99 },
        },
      })
    ).permanent,
    true,
  )
  for (const name of [
    "trial_cancellation_requested",
    "trial_cancellation_confirmed",
    "trial_cancellation_restored",
    "trial_cancellation_observed",
    "trial_first_payment_failed",
  ]) {
    const diagnostic = { ...input, event: { ...event, event_name: name } }
    assert.equal((await deliverBillingAnalyticsToMeta(diagnostic)).permanent, true)
    assert.equal((await deliverBillingAnalyticsToCustomerIo(diagnostic)).permanent, true)
  }
  assert.equal(sent.length, 4)
})

test("PostHog keeps original versioned trial attribution and stable insert ID without private Meta fields", async (t) => {
  const key = process.env.POSTHOG_PROJECT_API_KEY,
    previousFetch = global.fetch
  t.after(() => {
    global.fetch = previousFetch
    if (key === undefined) delete process.env.POSTHOG_PROJECT_API_KEY
    else process.env.POSTHOG_PROJECT_API_KEY = key
  })
  process.env.POSTHOG_PROJECT_API_KEY = "test"
  const sent: any[] = []
  global.fetch = async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)))
    return new Response("1", { status: 200 })
  }
  const input: any = {
    event: {
      ...event,
      event_name: "purchase_completed",
      payload: {
        ...event.payload,
        value: 9.99,
        fbp: "private",
        fbc: "private",
        client_user_agent: "private",
        marketing_consent: true,
        meta_context: { raw: "private" },
      },
    },
    profile: null,
    supabase: {
      from: () => {
        throw new Error("immutable trial attribution must not rejoin a newer session")
      },
    },
  }
  await deliverBillingAnalyticsToPostHog(input)
  await deliverBillingAnalyticsToPostHog(input)
  assert.equal(sent[0].properties.funnel_package_key, "scan_v1")
  assert.equal(sent[0].properties.$insert_id, event.event_key)
  assert.equal(sent[0].properties.$insert_id, sent[1].properties.$insert_id)
  assert.equal(JSON.stringify(sent).includes("private"), false)
})

test("versioned trial funnel delivery respects both rollout flags", async (t) => {
  const { deliverBillingAnalyticsToFunnel } =
    await import("../src/lib/billing/analytics-destinations/funnel")
  const oldAttribution = process.env.FUNNEL_ATTRIBUTION_ENABLED,
    oldDelivery = process.env.BILLING_FUNNEL_DELIVERY_ENABLED
  t.after(() => {
    if (oldAttribution === undefined) delete process.env.FUNNEL_ATTRIBUTION_ENABLED
    else process.env.FUNNEL_ATTRIBUTION_ENABLED = oldAttribution
    if (oldDelivery === undefined) delete process.env.BILLING_FUNNEL_DELIVERY_ENABLED
    else process.env.BILLING_FUNNEL_DELIVERY_ENABLED = oldDelivery
  })
  const input: any = {
    event: {
      ...event,
      event_name: "purchase_completed",
      payload: { ...event.payload, value: 9.99 },
    },
    profile: null,
    supabase: {
      rpc: () => {
        throw new Error("disabled funnel must not write")
      },
    },
  }
  for (const [attribution, delivery] of [
    ["true", "false"],
    ["false", "true"],
  ]) {
    process.env.FUNNEL_ATTRIBUTION_ENABLED = attribution
    process.env.BILLING_FUNNEL_DELIVERY_ENABLED = delivery
    assert.deepEqual(await deliverBillingAnalyticsToFunnel(input), { ok: true, skipped: true })
  }
})
