"use client"

import { useAuth } from "@/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import type { HairProfile } from "@/lib/types"
import { hydrateHairProfileForConsumers } from "@/lib/hair-profile/derived"
import {
  coerceProductUsageFrequencyRows,
  USER_PRODUCT_USAGE_ROUTINE_SELECT,
} from "@/lib/product-usage/shampoo-fallback"
import { useEffect, useState } from "react"

const supabase = createClient()

export function useHairProfile() {
  const { user } = useAuth()
  const userId = user?.id
  const [hairProfile, setHairProfile] = useState<HairProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!userId) {
        setLoading(false)
        return
      }
      try {
        const [{ data: profile }, { data: routineItems }] = await Promise.all([
          supabase.from("hair_profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase
            .from("user_product_usage")
            .select(USER_PRODUCT_USAGE_ROUTINE_SELECT)
            .eq("user_id", userId),
        ])

        setHairProfile(
          hydrateHairProfileForConsumers(
            profile as HairProfile | null,
            coerceProductUsageFrequencyRows(routineItems),
          ),
        )
      } catch (err) {
        console.error("Error loading hair profile:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId])

  return { hairProfile, loading }
}
