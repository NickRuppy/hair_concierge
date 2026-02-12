"use client"

import { useAuth } from "@/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import type { HairProfile } from "@/lib/types"
import { useEffect, useState } from "react"

const supabase = createClient()

export function useHairProfile() {
  const { user } = useAuth()
  const [hairProfile, setHairProfile] = useState<HairProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!user) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from("hair_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
      setHairProfile(data)
      setLoading(false)
    }
    load()
  }, [user])

  return { hairProfile, loading }
}
