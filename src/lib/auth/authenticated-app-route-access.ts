import "server-only"

import { createClient } from "@/lib/supabase/server"

export type TrackerRouteAccess = { kind: "allow" } | { kind: "redirect"; href: "/quiz" }

export type TrackerRouteAccessDependencies = {
  getUser: () => Promise<{ id: string } | null>
}

/**
 * Tracker's server boundary intentionally verifies only an authenticated user.
 * The proxy already owns subscription access; tracker has no intake, frontier,
 * entitlement, or Personal Plan routing decision to repeat here.
 */
export async function resolveTrackerRouteAccess(
  deps: TrackerRouteAccessDependencies,
): Promise<TrackerRouteAccess> {
  try {
    return (await deps.getUser()) ? { kind: "allow" } : { kind: "redirect", href: "/quiz" }
  } catch {
    return { kind: "redirect", href: "/quiz" }
  }
}

export async function loadTrackerRouteAccess(): Promise<TrackerRouteAccess> {
  const supabase = await createClient()
  return resolveTrackerRouteAccess({
    getUser: async () => (await supabase.auth.getUser()).data.user,
  })
}
