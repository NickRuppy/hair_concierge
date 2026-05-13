import type Stripe from "stripe"
import type { CheckoutActivationDeps } from "./checkout-activation"
import { ensureCheckoutAccount, subPeriodEndIso } from "./checkout-activation"
import { intervalFromPrice } from "./intervals"

export type HandlerDeps = CheckoutActivationDeps
type SubscriptionUpdateDeps = Pick<HandlerDeps, "supabase">

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  deps: HandlerDeps,
): Promise<void> {
  await ensureCheckoutAccount(session, deps)
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
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.warn("[stripe] invoice.payment_failed", {
    invoiceId: invoice.id,
    customer: invoice.customer,
    attempt: invoice.attempt_count,
  })
}
