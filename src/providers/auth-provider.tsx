"use client"

import { signOutAction } from "@/app/auth/actions"
import {
  createBrowserCategoryCaptureQueueStorage,
  createCategoryCaptureQueue,
} from "@/lib/personal-plan/products/category-capture-queue"
import {
  clearPendingStage3RecoveryForOwner,
  createBrowserPendingStage3RecoveryStorage,
} from "@/lib/personal-plan/products/pending-recovery"
import { clearStage3ReviewDraftsForOwner } from "@/lib/personal-plan/products/review-draft"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"
import { type User } from "@supabase/supabase-js"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
})

function clearPersonalPlanStage3RecoveryForOwner(ownerId: string | null | undefined) {
  if (!ownerId) return
  const categoryStorage = createBrowserCategoryCaptureQueueStorage()
  if (categoryStorage) {
    createCategoryCaptureQueue({ storage: categoryStorage }).clearOnLogout(ownerId)
  }
  const recoveryStorage = createBrowserPendingStage3RecoveryStorage()
  clearPendingStage3RecoveryForOwner(recoveryStorage, ownerId)
  clearStage3ReviewDraftsForOwner(recoveryStorage, ownerId)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const loadProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      try {
        const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
        return data
      } catch (err) {
        console.error("Error fetching profile:", err)
        return null
      }
    },
    [supabase],
  )

  const refreshProfile = useCallback(async () => {
    if (user) {
      setProfile(await loadProfile(user.id))
    }
  }, [user, loadProfile])

  const signOut = useCallback(async () => {
    clearPersonalPlanStage3RecoveryForOwner(user?.id)
    setUser(null)
    setProfile(null)
    await signOutAction()
  }, [user?.id])

  useEffect(() => {
    let resolved = false
    let currentOwnerId: string | undefined
    let profileFetchGeneration = 0
    let profileFetchTimer: ReturnType<typeof setTimeout> | undefined

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      resolved = true
      const next = session?.user ?? null
      if (currentOwnerId !== next?.id) {
        clearPersonalPlanStage3RecoveryForOwner(currentOwnerId)
        currentOwnerId = next?.id
      }
      setUser(next)

      if (profileFetchTimer) clearTimeout(profileFetchTimer)

      if (next) {
        const generation = ++profileFetchGeneration
        setProfile(null)
        profileFetchTimer = setTimeout(() => {
          void loadProfile(next.id).then((nextProfile) => {
            if (profileFetchGeneration === generation) setProfile(nextProfile)
          })
        }, 0)
      } else {
        profileFetchGeneration += 1
        setProfile(null)
      }

      setLoading(false)
    })

    // Safety net: if INITIAL_SESSION never fires, resolve loading
    // to prevent an infinite spinner
    const safety = setTimeout(() => {
      if (!resolved) setLoading(false)
    }, 3000)

    return () => {
      clearTimeout(safety)
      profileFetchGeneration += 1
      if (profileFetchTimer) clearTimeout(profileFetchTimer)
      subscription.unsubscribe()
    }
  }, [supabase, loadProfile])

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
