"use client"

import { useAuth } from "@/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import type { HairProfile } from "@/lib/types"
import { hydrateHairProfileForConsumers } from "@/lib/hair-profile/derived"
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
            .select("category, product_name, frequency_range")
            .eq("user_id", userId),
        ])

        setHairProfile(
          hydrateHairProfileForConsumers(profile as HairProfile | null, routineItems ?? []),
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
