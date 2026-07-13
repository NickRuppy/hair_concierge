"use client"

import { useEffect, useRef } from "react"
import { posthog } from "@/lib/analytics/runtime/posthog"
import { useAuth } from "@/providers/auth-provider"

export function PostHogIdentify() {
  const { user, profile } = useAuth()
  const prevUserId = useRef<string | null>(null)

  useEffect(() => {
    if (user && profile && prevUserId.current !== user.id) {
      posthog.identify(user.id, {
        email: profile.email,
        is_admin: profile.is_admin,
        name: profile.full_name,
      })
      prevUserId.current = user.id
    } else if (!user && prevUserId.current) {
      posthog.reset()
      prevUserId.current = null
    }
  }, [user, profile])

  return null
}
