import type {
  BillingOneTimePurchaseInput,
  BillingOneTimePurchaseRow,
  BillingOneTimePurchaseStatus,
  BillingProvider,
  SupabaseBillingClient,
} from "./types"

export const PERSONAL_PLAN_ONCE_PRODUCT_KIND = "personal_plan_once" as const

export function hasCurrentOneTimePurchaseAccess(
  purchase: Pick<BillingOneTimePurchaseRow, "status">,
): boolean {
  return purchase.status === "paid"
}

export async function findCurrentOneTimePurchaseForUser(
  supabase: SupabaseBillingClient,
  userId: string,
): Promise<BillingOneTimePurchaseRow | null> {
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
  return rows.find(hasCurrentOneTimePurchaseAccess) ?? null
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
