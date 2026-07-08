import type {
  BillingAnalyticsDeliveryRow,
  BillingAnalyticsDestination,
  BillingAnalyticsEventName,
  BillingAnalyticsOutboxRow,
  BillingProvider,
  SupabaseBillingClient,
} from "@/lib/billing/types"
import { deliverBillingAnalyticsToCustomerIo } from "./analytics-destinations/customerio"
import { deliverBillingAnalyticsToMeta } from "./analytics-destinations/meta-capi"
import { deliverBillingAnalyticsToPostHog } from "./analytics-destinations/posthog-server"
import type {
  BillingAnalyticsDeliveryInput,
  BillingAnalyticsDeliveryResult,
  BillingAnalyticsProfile,
} from "./analytics-destinations/types"

const DESTINATIONS: BillingAnalyticsDestination[] = ["customerio", "meta", "posthog"]
const MAX_DELIVERY_ATTEMPTS = 5
const STALE_PROCESSING_MINUTES = 15

export type BillingAnalyticsEventInput = {
  eventKey: string
  eventName: BillingAnalyticsEventName
  userId: string
  provider: BillingProvider
  providerCustomerId?: string | null
  providerSubscriptionId?: string | null
  sourceEventId?: string | null
  sourceObjectId?: string | null
  occurredAt: string
  payload?: Record<string, unknown>
}

type CreateBillingAnalyticsEventOptions = {
  dispatch?: boolean
  destinations?: BillingAnalyticsDestination[]
}

type DeferWork = (work: () => void | Promise<void>) => void

type DispatchBillingAnalyticsOptions = {
  destination?: BillingAnalyticsDestination
  eventKey?: string
  limit?: number
}

export async function createBillingAnalyticsEvent(
  supabase: SupabaseBillingClient,
  input: BillingAnalyticsEventInput,
  options: CreateBillingAnalyticsEventOptions = {},
): Promise<BillingAnalyticsOutboxRow> {
  const event = await insertOrFindOutboxEvent(supabase, input)
  await ensureDeliveryRows(supabase, event.id, options.destinations ?? DESTINATIONS)

  if (options.dispatch !== false) {
    await dispatchBillingAnalyticsEvent(supabase, event, options.destinations ?? DESTINATIONS)
  }

  return event
}

export async function recordBillingAnalyticsEvent(
  supabase: SupabaseBillingClient,
  input: BillingAnalyticsEventInput,
  options: CreateBillingAnalyticsEventOptions & { defer?: DeferWork } = {},
): Promise<BillingAnalyticsOutboxRow> {
  const event = await createBillingAnalyticsEvent(supabase, input, {
    destinations: options.destinations,
    dispatch: false,
  })
  const dispatch = () => dispatchBillingAnalyticsEvent(supabase, event, options.destinations)

  if (options.defer) {
    options.defer(async () => {
      try {
        await dispatch()
      } catch (error) {
        console.warn("[billing-analytics] deferred dispatch failed", {
          eventKey: event.event_key,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })
  } else if (options.dispatch !== false) {
    await dispatch()
  }

  return event
}

export async function dispatchBillingAnalyticsDue(
  supabase: SupabaseBillingClient,
  options: DispatchBillingAnalyticsOptions = {},
) {
  const event = options.eventKey ? await findOutboxEventByKey(supabase, options.eventKey) : null
  if (options.eventKey && !event) return 0

  const now = new Date().toISOString()
  const staleProcessingCutoff = new Date(
    Date.now() - STALE_PROCESSING_MINUTES * 60_000,
  ).toISOString()
  let query = supabase
    .from("billing_analytics_deliveries")
    .select("*")
    .in("status", ["pending", "failed", "processing"])
    .or(
      `next_attempt_at.is.null,next_attempt_at.lte.${now},processing_started_at.lte.${staleProcessingCutoff}`,
    )
    .order("created_at", { ascending: true })
    .limit(options.limit ?? 50)

  if (options.destination) query = query.eq("destination", options.destination)
  if (event) query = query.eq("outbox_id", event.id)

  const { data, error } = await query
  if (error) throw error

  const deliveries = (data as BillingAnalyticsDeliveryRow[] | null) ?? []

  let processed = 0
  for (const delivery of deliveries) {
    const event = await findOutboxEventById(supabase, delivery.outbox_id)
    if (!event) continue
    if (await dispatchDelivery(supabase, event, delivery)) processed += 1
  }

  return processed
}

export async function dispatchBillingAnalyticsEvent(
  supabase: SupabaseBillingClient,
  event: BillingAnalyticsOutboxRow,
  destinations: BillingAnalyticsDestination[] = DESTINATIONS,
) {
  const { data, error } = await supabase
    .from("billing_analytics_deliveries")
    .select("*")
    .eq("outbox_id", event.id)
    .in("destination", destinations)

  if (error) throw error
  const deliveries = ((data as BillingAnalyticsDeliveryRow[] | null) ?? []).filter(
    (delivery) => delivery.status !== "delivered" && delivery.status !== "failed_permanent",
  )

  for (const delivery of deliveries) {
    await dispatchDelivery(supabase, event, delivery)
  }
}

async function insertOrFindOutboxEvent(
  supabase: SupabaseBillingClient,
  input: BillingAnalyticsEventInput,
): Promise<BillingAnalyticsOutboxRow> {
  const now = new Date().toISOString()
  const row = {
    event_key: input.eventKey,
    event_name: input.eventName,
    user_id: input.userId,
    provider: input.provider,
    provider_customer_id: input.providerCustomerId ?? null,
    provider_subscription_id: input.providerSubscriptionId ?? null,
    source_event_id: input.sourceEventId ?? null,
    source_object_id: input.sourceObjectId ?? null,
    occurred_at: input.occurredAt,
    payload: sanitizePayload(input.payload ?? {}),
    updated_at: now,
  }

  const insert = await supabase.from("billing_analytics_outbox").insert(row).select("*").single()

  if (!insert.error) return insert.data as BillingAnalyticsOutboxRow
  if (!isDuplicateKeyError(insert.error)) throw insert.error

  const existing = await findOutboxEventByKey(supabase, input.eventKey)
  if (!existing) throw insert.error
  return existing
}

async function ensureDeliveryRows(
  supabase: SupabaseBillingClient,
  outboxId: string,
  destinations: BillingAnalyticsDestination[],
) {
  const rows = destinations.map((destination) => ({
    outbox_id: outboxId,
    destination,
  }))
  const { error } = await supabase
    .from("billing_analytics_deliveries")
    .upsert(rows, { onConflict: "outbox_id,destination", ignoreDuplicates: true })

  if (error && !isDuplicateKeyError(error)) throw error
}

async function dispatchDelivery(
  supabase: SupabaseBillingClient,
  event: BillingAnalyticsOutboxRow,
  delivery: BillingAnalyticsDeliveryRow,
) {
  const claimed = await claimDeliveryForDispatch(supabase, delivery)
  if (!claimed) return false

  const profile = await findBillingAnalyticsProfile(supabase, event.user_id)
  const input: BillingAnalyticsDeliveryInput = { event, profile, supabase }
  const result = await deliverToDestination(claimed.destination, input)

  if (result.ok) {
    await markDeliveryDelivered(supabase, claimed, result)
    return true
  }

  await markDeliveryFailed(supabase, claimed, result)
  return true
}

function deliverToDestination(
  destination: BillingAnalyticsDestination,
  input: BillingAnalyticsDeliveryInput,
) {
  switch (destination) {
    case "customerio":
      return deliverBillingAnalyticsToCustomerIo(input)
    case "meta":
      return deliverBillingAnalyticsToMeta(input)
    case "posthog":
      return deliverBillingAnalyticsToPostHog(input)
  }
}

async function claimDeliveryForDispatch(
  supabase: SupabaseBillingClient,
  delivery: BillingAnalyticsDeliveryRow,
): Promise<BillingAnalyticsDeliveryRow | null> {
  const now = new Date().toISOString()
  let query = supabase
    .from("billing_analytics_deliveries")
    .update({
      status: "processing",
      processing_started_at: now,
      updated_at: now,
    })
    .eq("id", delivery.id)

  if (delivery.status === "processing") {
    const staleProcessingCutoff = new Date(
      Date.now() - STALE_PROCESSING_MINUTES * 60_000,
    ).toISOString()
    query = query.eq("status", "processing").lte("processing_started_at", staleProcessingCutoff)
  } else {
    query = query.in("status", ["pending", "failed"])
  }

  const { data, error } = await query.select("*").maybeSingle()
  if (error) throw error
  return (data as BillingAnalyticsDeliveryRow | null) ?? null
}

async function markDeliveryDelivered(
  supabase: SupabaseBillingClient,
  delivery: BillingAnalyticsDeliveryRow,
  result: BillingAnalyticsDeliveryResult,
) {
  const { error } = await supabase
    .from("billing_analytics_deliveries")
    .update({
      status: "delivered",
      attempts: delivery.attempts + 1,
      processing_started_at: null,
      delivered_at: new Date().toISOString(),
      last_error: null,
      next_attempt_at: null,
      provider_request_id: result.providerRequestId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id)

  if (error) throw error
}

async function markDeliveryFailed(
  supabase: SupabaseBillingClient,
  delivery: BillingAnalyticsDeliveryRow,
  result: BillingAnalyticsDeliveryResult,
) {
  const attempts = delivery.attempts + 1
  const permanent = attempts >= MAX_DELIVERY_ATTEMPTS
  const { error } = await supabase
    .from("billing_analytics_deliveries")
    .update({
      status: permanent ? "failed_permanent" : "failed",
      attempts,
      processing_started_at: null,
      delivered_at: null,
      last_error: result.error ?? "Unknown billing analytics delivery error",
      next_attempt_at: permanent ? null : nextAttemptAt(attempts),
      provider_request_id: result.providerRequestId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id)

  if (error) throw error
}

async function findOutboxEventByKey(
  supabase: SupabaseBillingClient,
  eventKey: string,
): Promise<BillingAnalyticsOutboxRow | null> {
  const { data, error } = await supabase
    .from("billing_analytics_outbox")
    .select("*")
    .eq("event_key", eventKey)
    .maybeSingle()

  if (error) throw error
  return (data as BillingAnalyticsOutboxRow | null) ?? null
}

async function findOutboxEventById(
  supabase: SupabaseBillingClient,
  id: string,
): Promise<BillingAnalyticsOutboxRow | null> {
  const { data, error } = await supabase
    .from("billing_analytics_outbox")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return (data as BillingAnalyticsOutboxRow | null) ?? null
}

async function findBillingAnalyticsProfile(
  supabase: SupabaseBillingClient,
  userId: string,
): Promise<BillingAnalyticsProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,email,stripe_customer_id,stripe_subscription_id,subscription_interval,subscription_status,current_period_end,cancel_at_period_end",
    )
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  return (data as BillingAnalyticsProfile | null) ?? null
}

function nextAttemptAt(attempts: number) {
  const delayMinutes = Math.min(60, attempts * attempts)
  return new Date(Date.now() + delayMinutes * 60_000).toISOString()
}

function sanitizePayload(payload: Record<string, unknown>) {
  const blockedKeys = new Set([
    "email",
    "customer_email",
    "provider_signature",
    "signature",
    "access_token",
    "payment_method_details",
    "raw_event",
  ])
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !blockedKeys.has(key)))
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  return candidate.code === "23505" || String(candidate.message ?? "").includes("duplicate key")
}
