import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { intervalFromPrice } from "./intervals"

export interface HandlerDeps {
  supabase: SupabaseClient
  stripe: Stripe
  premiumTierId: string
}

/** Shape we actually read from the retrieved subscription. */
interface RetrievedSub {
  id: string
  current_period_end?: number
  items: {
    data: Array<{
      current_period_end?: number
      price: {
        interval?: string
        interval_count?: number
        recurring?: { interval: string; interval_count: number }
      }
    }>
  }
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  deps: HandlerDeps,
): Promise<void> {
  const email = session.customer_details?.email
  if (!email) throw new Error("session has no customer email")
  if (typeof session.customer !== "string") throw new Error("session.customer missing")
  if (typeof session.subscription !== "string") throw new Error("session.subscription missing")

  // 1. Ensure a Supabase user exists for this email
  const { data: existing } = await deps.supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle()

  let userId: string
  if (existing) {
    userId = existing.id
  } else {
    const { data, error } = await deps.supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (error || !data.user) {
      throw new Error(`createUser failed: ${error?.message ?? "unknown"}`)
    }
    userId = data.user.id
  }

  // 2. Retrieve full subscription to get interval + period end
  const sub = (await deps.stripe.subscriptions.retrieve(session.subscription, {
    expand: ["items.data.price"],
  })) as unknown as RetrievedSub
  const price = sub.items.data[0].price
  const interval = intervalFromPrice({
    interval: price.recurring?.interval ?? price.interval ?? "",
    interval_count: price.recurring?.interval_count ?? price.interval_count ?? 1,
  })

  // 3. Update profile
  await deps.supabase
    .from("profiles")
    .update({
      stripe_customer_id: session.customer,
      stripe_subscription_id: sub.id,
      subscription_status: "active",
      subscription_interval: interval,
      current_period_end: subPeriodEndIso(sub as unknown as RetrievedSub),
      subscription_tier_id: deps.premiumTierId,
    })
    .eq("id", userId)
}

/** Narrow shape we read from a subscription event. */
interface UpdatedSub {
  id: string
  customer: string | { id: string } | null
  status: string
  current_period_end?: number
  cancel_at_period_end?: boolean
  items: {
    data: Array<{
      current_period_end?: number
      price: {
        recurring?: { interval: string; interval_count: number }
        interval?: string
        interval_count?: number
      }
    }>
  }
}

/**
 * In Stripe API version 2025-08-27.basil, current_period_end moved from the
 * Subscription root to each SubscriptionItem. Read item first, fall back to
 * root for older API versions.
 */
function subPeriodEndIso(sub: RetrievedSub | UpdatedSub): string {
  const itemEnd = sub.items.data[0]?.current_period_end
  const rootEnd = (sub as { current_period_end?: number }).current_period_end
  const unix = itemEnd ?? rootEnd
  if (typeof unix !== "number" || Number.isNaN(unix)) {
    throw new Error("subscription has no current_period_end on item or root")
  }
  return new Date(unix * 1000).toISOString()
}

export async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  deps: HandlerDeps,
): Promise<void> {
  const s = sub as unknown as UpdatedSub
  if (typeof s.customer !== "string") throw new Error("sub.customer not a string")
  const price = s.items.data[0].price
  const interval = intervalFromPrice({
    interval: price.recurring?.interval ?? price.interval ?? "",
    interval_count: price.recurring?.interval_count ?? price.interval_count ?? 1,
  })
  await deps.supabase
    .from("profiles")
    .update({
      subscription_status: s.status,
      subscription_interval: interval,
      current_period_end: subPeriodEndIso(s),
    })
    .eq("stripe_customer_id", s.customer)
}

export interface DeleteDeps extends HandlerDeps {
  freeTierId: string
}

export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  deps: DeleteDeps,
): Promise<void> {
  const customer = typeof sub.customer === "string" ? sub.customer : null
  if (!customer) throw new Error("sub.customer not a string")
  await deps.supabase
    .from("profiles")
    .update({
      subscription_status: "canceled",
      subscription_tier_id: deps.freeTierId,
    })
    .eq("stripe_customer_id", customer)
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.warn("[stripe] invoice.payment_failed", {
    invoiceId: invoice.id,
    customer: invoice.customer,
    attempt: invoice.attempt_count,
  })
}
