"use client"

import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Bypass Navigator Locks API to prevent AbortError when lock
        // acquisition times out (causes infinite loading spinner).
        // Safe because createBrowserClient returns a singleton per tab.
        lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
          return await fn()
        },
      },
    }
  )
}
