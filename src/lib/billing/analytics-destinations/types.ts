import type { BillingAnalyticsOutboxRow, SupabaseBillingClient } from "@/lib/billing/types"

export type BillingAnalyticsProfile = {
  id: string
  email: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_interval?: string | null
  subscription_status?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
}

export type BillingAnalyticsDeliveryInput = {
  event: BillingAnalyticsOutboxRow
  profile: BillingAnalyticsProfile | null
  supabase: SupabaseBillingClient
}

export type BillingAnalyticsDeliveryResult = {
  ok: boolean
  skipped?: boolean
  status?: number
  error?: string
  providerRequestId?: string
}
