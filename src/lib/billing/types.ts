import type { SupabaseClient } from "@supabase/supabase-js"

export type BillingProvider = "stripe" | "paypal"
export type BillingInterval = "month" | "quarter" | "year"
export type BillingEntitlementStatus = "active" | "past_due" | "canceled" | "incomplete"
export type BillingAnalyticsDestination = "customerio" | "meta" | "posthog"
export type BillingAnalyticsDeliveryStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed"
  | "failed_permanent"
export type BillingAnalyticsEventName =
  | "purchase_completed"
  | "payment_completed"
  | "subscription_started"
  | "subscription_updated"
  | "subscription_cancelled"
  | "subscription_expired"
  | "payment_failed"
  | "refund_completed"

export interface BillingSubscriptionRow {
  id: string
  user_id: string
  provider: BillingProvider
  provider_customer_id: string | null
  provider_subscriber_email: string | null
  provider_subscription_id: string
  provider_status: string
  entitlement_status: BillingEntitlementStatus
  interval: BillingInterval | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  cancelled_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BillingSubscriptionInput = {
  user_id: string
  provider: BillingProvider
  provider_subscription_id: string
  provider_status: string
  entitlement_status: BillingEntitlementStatus
  provider_customer_id?: string | null
  provider_subscriber_email?: string | null
  interval?: BillingInterval | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean
  cancelled_at?: string | null
  metadata?: Record<string, unknown>
}

export interface BillingAnalyticsOutboxRow {
  id: string
  event_key: string
  event_name: BillingAnalyticsEventName
  user_id: string
  provider: BillingProvider
  provider_customer_id: string | null
  provider_subscription_id: string | null
  source_event_id: string | null
  source_object_id: string | null
  occurred_at: string
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BillingAnalyticsDeliveryRow {
  id: string
  outbox_id: string
  destination: BillingAnalyticsDestination
  status: BillingAnalyticsDeliveryStatus
  attempts: number
  processing_started_at: string | null
  next_attempt_at: string | null
  delivered_at: string | null
  last_error: string | null
  provider_request_id: string | null
  created_at: string
  updated_at: string
}

export type SupabaseBillingClient = Pick<SupabaseClient, "from">
