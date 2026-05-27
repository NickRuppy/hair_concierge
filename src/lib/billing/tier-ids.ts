import type { SupabaseClient } from "@supabase/supabase-js"

export interface BillingTierIds {
  freeTierId: string
  premiumTierId: string
}

let tierIds: BillingTierIds | null = null
let tierIdsPromise: Promise<BillingTierIds> | null = null
let premiumTierId: string | null = null
let premiumTierIdPromise: Promise<string> | null = null

export async function getBillingTierIds(supabase: SupabaseClient): Promise<BillingTierIds> {
  if (tierIds) return tierIds
  if (tierIdsPromise) return tierIdsPromise

  tierIdsPromise = loadBillingTierIds(supabase)
    .then((ids) => {
      tierIds = ids
      return ids
    })
    .catch((err) => {
      tierIdsPromise = null
      throw err
    })

  return tierIdsPromise
}

export async function getPremiumTierId(supabase: SupabaseClient): Promise<string> {
  if (tierIds) return tierIds.premiumTierId
  if (premiumTierId) return premiumTierId
  if (premiumTierIdPromise) return premiumTierIdPromise

  premiumTierIdPromise = loadPremiumTierId(supabase)
    .then((id) => {
      premiumTierId = id
      return id
    })
    .catch((err) => {
      premiumTierIdPromise = null
      throw err
    })

  return premiumTierIdPromise
}

export function resetBillingTierIdsCacheForTests() {
  tierIds = null
  tierIdsPromise = null
  premiumTierId = null
  premiumTierIdPromise = null
}

async function loadBillingTierIds(supabase: SupabaseClient): Promise<BillingTierIds> {
  const { data, error } = await supabase.from("subscription_tiers").select("id, slug")
  if (error) throw new Error(`failed to load subscription_tiers: ${error.message}`)

  const free = data?.find((row: { id: string; slug: string }) => row.slug === "free")?.id
  const premium = data?.find((row: { id: string; slug: string }) => row.slug === "premium")?.id
  if (!free || !premium) throw new Error("subscription_tiers seed rows missing")

  return { freeTierId: free, premiumTierId: premium }
}

async function loadPremiumTierId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.from("subscription_tiers").select("id, slug")
  if (error) throw new Error(`failed to load subscription_tiers: ${error.message}`)

  const premium = data?.find((row: { id: string; slug: string }) => row.slug === "premium")?.id
  if (!premium) throw new Error("subscription_tiers premium seed row missing")

  return premium
}
