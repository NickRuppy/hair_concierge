import type { SupabaseClient } from "@supabase/supabase-js"

export interface StripeTierIds {
  freeTierId: string
  premiumTierId: string
}

let tierIds: StripeTierIds | null = null
let tierIdsPromise: Promise<StripeTierIds> | null = null

export async function getStripeTierIds(supabase: SupabaseClient): Promise<StripeTierIds> {
  if (tierIds) return tierIds
  if (tierIdsPromise) return tierIdsPromise

  tierIdsPromise = loadStripeTierIds(supabase)
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

export function resetStripeTierIdsCacheForTests() {
  tierIds = null
  tierIdsPromise = null
}

async function loadStripeTierIds(supabase: SupabaseClient): Promise<StripeTierIds> {
  const { data, error } = await supabase.from("subscription_tiers").select("id, slug")
  if (error) throw new Error(`failed to load subscription_tiers: ${error.message}`)
  const free = data?.find((r: { id: string; slug: string }) => r.slug === "free")?.id
  const premium = data?.find((r: { id: string; slug: string }) => r.slug === "premium")?.id
  if (!free || !premium) throw new Error("subscription_tiers seed rows missing")
  return { freeTierId: free, premiumTierId: premium }
}
