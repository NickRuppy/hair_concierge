import type {
  BillingOneTimePurchaseInput,
  BillingOneTimePurchaseRow,
  BillingOneTimePurchaseStatus,
  BillingProvider,
  OneTimeAccessState,
  SupabaseBillingClient,
} from "./types"
import {
  findPersonalPlanOneTimeConsentById,
  type PersonalPlanOneTimeCheckoutConsentRow,
} from "./personal-plan-one-time-consents"

export const PERSONAL_PLAN_ONCE_PRODUCT_KIND = "personal_plan_once" as const

export type OneTimePurchaseEntitlement = {
  purchase: BillingOneTimePurchaseRow
  consent: PersonalPlanOneTimeCheckoutConsentRow | null
}

export function hasCurrentOneTimePurchaseAccess(
  entitlement: OneTimePurchaseEntitlement | null,
): boolean {
  return resolveOneTimePurchaseAccessState(entitlement) === "active"
}

export function resolveOneTimePurchaseAccessState(
  entitlement: OneTimePurchaseEntitlement | null,
): OneTimeAccessState {
  if (!entitlement) return "none"

  const { purchase, consent } = entitlement
  if (purchase.status !== "paid") return "revoked"
  if (!consent) return "paid_pending"
  if (!purchase.user_id || !consent.user_id || purchase.user_id !== consent.user_id) {
    return "paid_pending"
  }
  if (purchase.consent_id !== consent.id) return "paid_pending"
  if (consent.product_kind !== PERSONAL_PLAN_ONCE_PRODUCT_KIND) return "paid_pending"
  if (consent.confirmation_status !== "sent" && consent.confirmation_status !== "delivered") {
    return "paid_pending"
  }
  if (
    !consent.generation_started_at ||
    !consent.generation_completed_at ||
    !consent.generated_content_sha256 ||
    !consent.delivery_provider ||
    !consent.delivery_reference ||
    !consent.delivered_at
  ) {
    return "paid_pending"
  }
  return "active"
}

export async function findCurrentOneTimePurchaseForUser(
  supabase: SupabaseBillingClient,
  userId: string,
): Promise<BillingOneTimePurchaseRow | null> {
  const state = await resolveOneTimeAccessStateForUser(supabase, userId)
  if (state !== "active") return null

  const { data, error } = await supabase
    .from("billing_one_time_purchases")
    .select("*")
    .eq("user_id", userId)
    .eq("product_kind", PERSONAL_PLAN_ONCE_PRODUCT_KIND)
    .eq("status", "paid")

  if (error) {
    if (isMissingOneTimePurchasesTableError(error)) return null
    throw error
  }

  const rows = (data as BillingOneTimePurchaseRow[] | null) ?? []
  rows.sort(compareOneTimePurchasesForAccess)
  return rows[0] ?? null
}

export async function resolveOneTimeAccessStateForUser(
  supabase: SupabaseBillingClient,
  userId: string,
): Promise<OneTimeAccessState> {
  if (hasRpc(supabase)) {
    const { data, error } = await supabase.rpc("get_personal_plan_one_time_access_state", {
      p_user_id: userId,
    })
    if (!error && isOneTimeAccessState(data)) return data
    if (error && !isMissingAccessStateRpcError(error)) throw error
  }
  return resolveOneTimePurchaseAccessState(
    await findOneTimePurchaseEntitlementForUser(supabase, userId),
  )
}

export async function findOneTimePurchaseEntitlementForUser(
  supabase: SupabaseBillingClient,
  userId: string,
): Promise<OneTimePurchaseEntitlement | null> {
  const { data, error } = await supabase
    .from("billing_one_time_purchases")
    .select("*")
    .eq("user_id", userId)
    .eq("product_kind", PERSONAL_PLAN_ONCE_PRODUCT_KIND)

  if (error) {
    if (isMissingOneTimePurchasesTableError(error)) return null
    throw error
  }

  const rows = (data as BillingOneTimePurchaseRow[] | null) ?? []
  rows.sort(compareOneTimePurchasesForAccess)

  for (const purchase of rows) {
    let consent: PersonalPlanOneTimeCheckoutConsentRow | null
    if (!purchase.consent_id) {
      // A code-before-migration deploy can expose legacy rows without the new
      // consent_id column/value. Keep the buyer paid-pending instead of issuing
      // an invalid private-consent lookup or granting access without evidence.
      consent = null
    } else {
      try {
        consent = await findPersonalPlanOneTimeConsentById(supabase, purchase.consent_id)
      } catch (error) {
        // Browser/authenticated clients can see their own purchase row but not the
        // private consent evidence when the access-state RPC has not been deployed.
        // A paid row must still block a duplicate checkout, but never grant access
        // without the evidence that a service/admin client can read.
        if (isConsentReadPermissionError(error)) consent = null
        else throw error
      }
    }
    const entitlement = { purchase, consent }
    if (resolveOneTimePurchaseAccessState(entitlement) !== "none") return entitlement
  }
  return null
}

export async function findOneTimePurchaseByProviderTransactionId(
  supabase: SupabaseBillingClient,
  provider: BillingProvider,
  providerTransactionId: string,
): Promise<BillingOneTimePurchaseRow | null> {
  const { data, error } = await supabase
    .from("billing_one_time_purchases")
    .select("*")
    .eq("provider", provider)
    .eq("provider_transaction_id", providerTransactionId)
    .maybeSingle()

  if (error) throw error
  return (data as BillingOneTimePurchaseRow | null) ?? null
}

export async function findOneTimePurchaseByConsentId(
  supabase: SupabaseBillingClient,
  consentId: string,
): Promise<BillingOneTimePurchaseRow | null> {
  const { data, error } = await supabase
    .from("billing_one_time_purchases")
    .select("*")
    .eq("consent_id", consentId)
    .maybeSingle()

  if (error) throw error
  return (data as BillingOneTimePurchaseRow | null) ?? null
}

export async function upsertOneTimePurchase(
  supabase: SupabaseBillingClient,
  input: BillingOneTimePurchaseInput,
): Promise<BillingOneTimePurchaseRow> {
  const existing = await findOneTimePurchaseByProviderTransactionId(
    supabase,
    input.provider,
    input.provider_transaction_id,
  )
  const row = {
    ...input,
    user_id: input.user_id ?? existing?.user_id ?? null,
    product_kind: PERSONAL_PLAN_ONCE_PRODUCT_KIND,
    provider_customer_id: input.provider_customer_id ?? existing?.provider_customer_id ?? null,
    provider_order_id: input.provider_order_id ?? existing?.provider_order_id ?? null,
    refunded_amount_minor: input.refunded_amount_minor ?? existing?.refunded_amount_minor ?? 0,
    refunded_at: input.refunded_at ?? existing?.refunded_at ?? null,
    status: existing && existing.status !== "paid" ? existing.status : input.status,
    paid_at: existing?.paid_at ?? input.paid_at,
    metadata: { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) },
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("billing_one_time_purchases")
    .upsert(row, { onConflict: "provider,provider_transaction_id" })
    .select("*")
    .single()

  if (error) throw error
  return data as BillingOneTimePurchaseRow
}

export async function updateOneTimePurchaseStatus(
  supabase: SupabaseBillingClient,
  purchase: Pick<
    BillingOneTimePurchaseRow,
    "id" | "amount_minor" | "refunded_amount_minor" | "refunded_at"
  >,
  input: {
    status: BillingOneTimePurchaseStatus
    refunded_amount_minor?: number
    refunded_at?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<BillingOneTimePurchaseRow> {
  const refundedAmount = input.refunded_amount_minor ?? purchase.refunded_amount_minor
  const status =
    input.status === "paid" && refundedAmount >= purchase.amount_minor ? "refunded" : input.status
  const { data, error } = await supabase
    .from("billing_one_time_purchases")
    .update({
      status,
      refunded_amount_minor: refundedAmount,
      refunded_at: input.refunded_at === undefined ? purchase.refunded_at : input.refunded_at,
      metadata: input.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchase.id)
    .select("*")
    .single()

  if (error) throw error
  return data as BillingOneTimePurchaseRow
}

function isMissingOneTimePurchasesTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === "string" ? candidate.code : ""
  const message = typeof candidate.message === "string" ? candidate.message : ""
  return (code === "PGRST205" || code === "42P01") && message.includes("billing_one_time_purchases")
}

function compareOneTimePurchasesForAccess(
  left: BillingOneTimePurchaseRow,
  right: BillingOneTimePurchaseRow,
): number {
  if (left.status === "paid" && right.status !== "paid") return -1
  if (left.status !== "paid" && right.status === "paid") return 1
  return right.updated_at.localeCompare(left.updated_at)
}

function hasRpc(supabase: SupabaseBillingClient): supabase is SupabaseBillingClient & {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
} {
  return "rpc" in supabase && typeof supabase.rpc === "function"
}

function isOneTimeAccessState(value: unknown): value is OneTimeAccessState {
  return value === "none" || value === "paid_pending" || value === "active" || value === "revoked"
}

function isMissingAccessStateRpcError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === "string" ? candidate.code : ""
  const message = typeof candidate.message === "string" ? candidate.message : ""
  return (
    code === "PGRST202" ||
    code === "42883" ||
    message.includes("get_personal_plan_one_time_access_state")
  )
}

function isConsentReadPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === "string" ? candidate.code : ""
  const message = typeof candidate.message === "string" ? candidate.message : ""
  return (
    code === "42501" ||
    /permission denied|row-level security|violates row-level security/i.test(message)
  )
}
