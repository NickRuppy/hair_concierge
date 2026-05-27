import type { SupabaseClient } from "@supabase/supabase-js"

export type BillingProvider = "stripe" | "paypal"
export type BillingInterval = "month" | "quarter" | "year"
export type BillingEntitlementStatus = "active" | "past_due" | "canceled" | "incomplete"

export interface BillingSubscriptionRow {
  id: string
  user_id: string
  provider: BillingProvider
  provider_customer_id: string | null
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
  interval?: BillingInterval | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean
  cancelled_at?: string | null
  metadata?: Record<string, unknown>
}

export type SupabaseBillingClient = Pick<SupabaseClient, "from">
