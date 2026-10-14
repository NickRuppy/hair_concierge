"use client"

import { useEffect } from "react"

import { bootstrapFunnelContext } from "@/lib/funnel/client"

export function PublicFunnelContextBootstrap() {
  useEffect(() => {
    void bootstrapFunnelContext()
  }, [])

  return null
}
