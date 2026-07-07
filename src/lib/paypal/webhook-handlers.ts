import type { SupabaseClient } from "@supabase/supabase-js"
import { mirrorBillingSubscriptionToProfile } from "@/lib/billing/entitlements"
import {
  findBillingSubscriptionByProviderId,
  upsertBillingSubscription,
} from "@/lib/billing/subscriptions"
import { claimWebhookEvent, releaseWebhookEventClaim } from "@/lib/billing/webhook-events"
import type { BillingInterval, BillingSubscriptionInput } from "@/lib/billing/types"
import {
  bindPayPalCheckoutIntentToSubscription,
  findPayPalCheckoutIntentByProviderSubscriptionId,
  findPayPalCheckoutIntentByToken,
  isPayPalCheckoutIntentExpired,
  markPayPalCheckoutIntentActivated,
  markPayPalCheckoutIntentExpired,
  PayPalCheckoutIntentBindingError,
} from "@/lib/paypal/checkout-intents"
import {
  ensurePayPalCheckoutAccount,
  type PayPalCheckoutAccountResult,
} from "@/lib/paypal/checkout-activation"
import {
  cancelAndMarkPayPalDuplicate,
  findPayPalCheckoutDuplicateReason,
} from "@/lib/paypal/duplicate-guard"
import type { PayPalSubscription } from "@/lib/paypal/subscription-shapes"
import { toBillingSubscriptionInputFromPayPal } from "@/lib/paypal/subscription-shapes"
import { getPayPalIntervalForPlanId } from "@/lib/paypal/plans"

export type PayPalWebhookEvent = {
  id?: string
  event_type?: string
  resource?: {
    id?: string
    billing_agreement_id?: string
    subscription_id?: string
  }
}

export interface PayPalWebhookDeps {
  supabase: SupabaseClient
  premiumTierId: string
  freeTierId: string
  retrievePayPalSubscription?: (subscriptionId: string) => Promise<PayPalSubscription>
  cancelPayPalSubscription?: (subscriptionId: string, reason: string) => Promise<void>
  linkQuizToProfile?: (userId: string, email: string | undefined, leadId?: string) => Promise<void>
}

export type PayPalWebhookResult =
  | { handled: true; skipped?: false }
  | { handled: true; skipped: true }
  | { handled: false; skipped?: false }

const MUTATING_EVENTS = new Set([
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "PAYMENT.SALE.COMPLETED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
])

const KNOWN_LOG_ONLY_EVENTS = new Set([
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "PAYMENT.SALE.REFUNDED",
  "PAYMENT.SALE.REVERSED",
])

export async function handlePayPalWebhookEvent(
  event: PayPalWebhookEvent,
  deps: PayPalWebhookDeps,
): Promise<PayPalWebhookResult> {
  const eventId = event.id
  const eventType = event.event_type
  if (!eventId || !eventType) throw new Error("PayPal webhook event is missing id or event_type")

  const subscriptionId = MUTATING_EVENTS.has(eventType)
    ? getEventSubscriptionId(event, eventType)
    : null
  const claimed = await claimWebhookEvent(deps.supabase, "paypal", eventId, eventType)
  if (!claimed) return { handled: true, skipped: true }

  try {
    if (KNOWN_LOG_ONLY_EVENTS.has(eventType)) {
      console.info("[paypal:webhook] known log-only event", { eventId, eventType })
      return { handled: false }
    }

    if (!MUTATING_EVENTS.has(eventType)) {
      console.warn("[paypal:webhook] unhandled event type", { eventId, eventType })
      return { handled: false }
    }

    if (!subscriptionId) throw new Error("PayPal webhook event is missing subscription id")
    const retrieve = deps.retrievePayPalSubscription ?? retrievePayPalSubscriptionForWebhook
    const subscription = await retrieve(subscriptionId)

    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "PAYMENT.SALE.COMPLETED":
        await activateOrRefreshSubscription(subscription, deps)
        return { handled: true }
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      case "BILLING.SUBSCRIPTION.SUSPENDED":
        await updateExistingSubscription(subscription, deps, {
          provider_status: subscription.status ?? "SUSPENDED",
          entitlement_status: "past_due",
        })
        return { handled: true }
      case "BILLING.SUBSCRIPTION.CANCELLED":
        await updateExistingSubscription(subscription, deps, {
          provider_status: "CANCELLED",
          entitlement_status: "canceled",
          cancel_at_period_end: true,
          cancelled_at: new Date().toISOString(),
        })
        return { handled: true }
      case "BILLING.SUBSCRIPTION.EXPIRED":
        await updateExistingSubscription(subscription, deps, {
          provider_status: "EXPIRED",
          entitlement_status: "canceled",
          current_period_end: subscription.billing_info?.next_billing_time ?? null,
          cancel_at_period_end: false,
          cancelled_at: new Date().toISOString(),
        })
        return { handled: true }
      default:
        return { handled: false }
    }
  } catch (error) {
    await releaseWebhookEventClaim(deps.supabase, "paypal", eventId)
    throw error
  }
}

async function activateOrRefreshSubscription(
  subscription: PayPalSubscription,
  deps: PayPalWebhookDeps,
) {
  if (!subscription.id) throw new Error("PayPal subscription is missing id")

  const token = subscription.custom_id?.trim()
  const intent = token ? await findPayPalCheckoutIntentByToken(deps.supabase, token) : null
  const existing = await findBillingSubscriptionByProviderId(
    deps.supabase,
    "paypal",
    subscription.id,
  )

  if (intent?.status === "duplicate") return
  if (!existing && !intent) {
    throw new Error(`PayPal subscription ${subscription.id} has no checkout intent or local row`)
  }
  if (!existing && intent && isPayPalCheckoutIntentExpired(intent)) {
    await markPayPalCheckoutIntentExpired(deps.supabase, intent.token)
    const cancel = deps.cancelPayPalSubscription ?? cancelPayPalSubscriptionForWebhook
    await cancel(subscription.id, "PayPal checkout intent expired before activation")
    return
  }

  let boundIntent = intent
  if (token && intent && !intent.provider_subscription_id) {
    try {
      boundIntent = await bindPayPalCheckoutIntentToSubscription(
        deps.supabase,
        token,
        subscription.id,
        intent.email ?? null,
      )
    } catch (error) {
      if (error instanceof PayPalCheckoutIntentBindingError && !existing) {
        const cancel = deps.cancelPayPalSubscription ?? cancelPayPalSubscriptionForWebhook
        await cancel(
          subscription.id,
          "Duplicate PayPal subscription reused an existing Chaarlie checkout token",
        )
        return
      }
      throw error
    }
  } else if (token && intent && intent.provider_subscription_id !== subscription.id) {
    if (!existing) {
      const cancel = deps.cancelPayPalSubscription ?? cancelPayPalSubscriptionForWebhook
      await cancel(
        subscription.id,
        "Duplicate PayPal subscription reused an existing Chaarlie checkout token",
      )
      return
    }
    boundIntent = null
  }

  if (!existing && boundIntent) {
    const fallbackAccountEmail = boundIntent.email ?? subscription.subscriber?.email_address ?? null
    const duplicateReason = await findPayPalCheckoutDuplicateReason(
      deps.supabase,
      boundIntent,
      subscription,
      { fallbackAccountEmail },
    )
    if (duplicateReason) {
      await cancelAndMarkPayPalDuplicate({
        cancelPayPalSubscription:
          deps.cancelPayPalSubscription ?? cancelPayPalSubscriptionForWebhook,
        reason: duplicateReason,
        retrievePayPalSubscription:
          deps.retrievePayPalSubscription ?? retrievePayPalSubscriptionForWebhook,
        subscriptionId: subscription.id,
        supabase: deps.supabase,
        token: boundIntent.token,
      })
      return
    }
  }

  const activation: PayPalCheckoutAccountResult = await ensurePayPalCheckoutAccount(subscription, {
    supabase: deps.supabase,
    premiumTierId: deps.premiumTierId,
    activationKey: boundIntent?.token,
    accountEmail: boundIntent?.email ?? null,
    interval: boundIntent?.interval ?? existing?.interval ?? intervalFromMetadata(subscription),
    leadId: boundIntent?.lead_id ?? null,
    linkQuizToProfile: deps.linkQuizToProfile,
  })

  if (activation.status === "pending" || activation.status === "duplicate") return
  if (boundIntent) await markPayPalCheckoutIntentActivated(deps.supabase, boundIntent.token)
}

async function updateExistingSubscription(
  subscription: PayPalSubscription,
  deps: PayPalWebhookDeps,
  patch: Partial<BillingSubscriptionInput>,
): Promise<void> {
  if (!subscription.id) throw new Error("PayPal subscription is missing id")

  const existing = await findBillingSubscriptionByProviderId(
    deps.supabase,
    "paypal",
    subscription.id,
  )
  if (!existing) {
    const intent = await findPayPalCheckoutIntentByProviderSubscriptionId(
      deps.supabase,
      subscription.id,
    )
    if (intent?.status === "duplicate") return
    throw new Error(`PayPal billing subscription ${subscription.id} has no local billing row`)
  }

  const input = {
    ...toBillingSubscriptionInputFromPayPal(
      subscription,
      existing.user_id,
      existing.interval ?? intervalFromMetadata(subscription),
    ),
    current_period_end:
      subscription.billing_info?.next_billing_time ?? existing.current_period_end ?? null,
    ...patch,
  }
  const billingRow = await upsertBillingSubscription(deps.supabase, input)
  await mirrorBillingSubscriptionToProfile(deps.supabase, billingRow, deps.premiumTierId, {
    freeTierId: deps.freeTierId,
  })
}

function getEventSubscriptionId(event: PayPalWebhookEvent, eventType: string): string {
  const id = eventType.startsWith("PAYMENT.")
    ? (event.resource?.billing_agreement_id ?? event.resource?.subscription_id)
    : (event.resource?.subscription_id ?? event.resource?.id)
  if (!id) throw new Error("PayPal webhook event is missing subscription id")
  return id
}

function intervalFromMetadata(subscription: PayPalSubscription): BillingInterval {
  const configuredInterval = getPayPalIntervalForPlanId(subscription.plan_id)
  if (configuredInterval) return configuredInterval

  const interval = subscription.plan_id?.toLowerCase()
  if (interval?.includes("quarter")) return "quarter"
  if (interval?.includes("year") || interval?.includes("annual")) return "year"
  return "month"
}

async function retrievePayPalSubscriptionForWebhook(
  subscriptionId: string,
): Promise<PayPalSubscription> {
  const { retrievePayPalSubscription } = await import("@/lib/paypal/subscriptions")
  return retrievePayPalSubscription(subscriptionId)
}

async function cancelPayPalSubscriptionForWebhook(
  subscriptionId: string,
  reason: string,
): Promise<void> {
  const { cancelPayPalSubscription } = await import("@/lib/paypal/subscriptions")
  return cancelPayPalSubscription(subscriptionId, reason)
}
