"use client"

import { signOutAction } from "@/app/auth/actions"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"
import { type User } from "@supabase/supabase-js"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()
        setProfile(data)
      } catch (err) {
        console.error("Error fetching profile:", err)
        setProfile(null)
      }
    },
    [supabase]
  )

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  const signOut = useCallback(async () => {
    setUser(null)
    setProfile(null)
    await signOutAction()
  }, [])

  useEffect(() => {
    let resolved = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      resolved = true
      try {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      } finally {
        setLoading(false)
      }
    })

    // Safety net: if INITIAL_SESSION never fires, resolve loading
    // to prevent an infinite spinner
    const safety = setTimeout(() => {
      if (!resolved) setLoading(false)
    }, 3000)

    return () => {
      clearTimeout(safety)
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, refreshProfile, signOut }}
    >
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
