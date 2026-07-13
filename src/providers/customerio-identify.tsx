"use client"

import { useEffect, useRef } from "react"
import { identifyCustomerIoUser, resetCustomerIoBrowserClient } from "@/lib/customerio-tracking"
import { useAuth } from "@/providers/auth-provider"

export function CustomerIoIdentify() {
  const { user, profile } = useAuth()
  const prevUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!user || !profile || prevUserId.current === user.id) return
    identifyCustomerIoUser(user.id, {
      email: profile.email,
      is_admin: profile.is_admin,
      name: profile.full_name,
    })
    prevUserId.current = user.id
  }, [user, profile])

  useEffect(() => {
    if (user || !prevUserId.current) return
    resetCustomerIoBrowserClient()
    prevUserId.current = null
  }, [user])

  return null
}
