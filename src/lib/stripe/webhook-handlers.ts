import type Stripe from "stripe"
import type { CheckoutAccountResult, CheckoutActivationDeps } from "./checkout-activation"
import {
  ensureCheckoutAccount,
  stripeEntitlementStatus,
  subPeriodEndIso,
} from "./checkout-activation"
import { intervalFromPrice } from "./intervals"
import { upsertBillingSubscription } from "@/lib/billing/subscriptions"

export type HandlerDeps = CheckoutActivationDeps
type SubscriptionUpdateDeps = Pick<HandlerDeps, "supabase">

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  deps: HandlerDeps,
): Promise<CheckoutAccountResult> {
  return ensureCheckoutAccount(session, deps)
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

export async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  deps: SubscriptionUpdateDeps,
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

  const profile = await findProfileByStripeCustomerId(deps.supabase, s.customer)
  if (!profile) return

  await upsertBillingSubscription(deps.supabase, {
    user_id: profile.id,
    provider: "stripe",
    provider_customer_id: s.customer,
    provider_subscription_id: s.id,
    provider_status: s.status,
    entitlement_status: stripeEntitlementStatus(s.status),
    interval,
    current_period_end: subPeriodEndIso(s),
    cancel_at_period_end: s.cancel_at_period_end ?? false,
  })
}

export interface DeleteDeps {
  supabase: HandlerDeps["supabase"]
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

  const profile = await findProfileByStripeCustomerId(deps.supabase, customer)
  if (!profile) return

  await upsertBillingSubscription(deps.supabase, {
    user_id: profile.id,
    provider: "stripe",
    provider_customer_id: customer,
    provider_subscription_id: sub.id,
    provider_status: sub.status ?? "canceled",
    entitlement_status: "canceled",
    cancelled_at: new Date().toISOString(),
  })
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.warn("[stripe] invoice.payment_failed", {
    invoiceId: invoice.id,
    customer: invoice.customer,
    attempt: invoice.attempt_count,
  })
}

export type StripeCustomerProfile = {
  id: string
  email: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id: string | null
  subscription_interval: string | null
  subscription_status: string | null
}

export async function findProfileByStripeCustomerId(
  supabase: HandlerDeps["supabase"],
  customerId: string,
): Promise<StripeCustomerProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,email,stripe_customer_id,stripe_subscription_id,subscription_interval,subscription_status",
    )
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  if (error) throw error
  return data as StripeCustomerProfile | null
}
