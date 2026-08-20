import "server-only"

import {
  hasCompletedQuizDiagnostics,
  type PersistedQuizDiagnosticsProfile,
} from "@/lib/quiz/completion"
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

export type ScanRouteAccess = { kind: "allow" } | { kind: "redirect"; href: "/quiz" }

export type ScanRouteAccessDependencies = {
  getUser: () => Promise<{ id: string } | null>
  getHairProfile: (userId: string) => Promise<PersistedQuizDiagnosticsProfile>
}

/**
 * Scan's server boundary verifies an authenticated user AND a completed quiz:
 * the verdict engine needs the hair profile the quiz writes, so an
 * unqualified user is sent to `/quiz` rather than shown an empty scanner.
 */
export async function resolveScanRouteAccess(
  deps: ScanRouteAccessDependencies,
): Promise<ScanRouteAccess> {
  try {
    const user = await deps.getUser()
    if (!user) return { kind: "redirect", href: "/quiz" }
    const hairProfile = await deps.getHairProfile(user.id)
    return hasCompletedQuizDiagnostics(hairProfile)
      ? { kind: "allow" }
      : { kind: "redirect", href: "/quiz" }
  } catch {
    return { kind: "redirect", href: "/quiz" }
  }
}

export async function loadScanRouteAccess(): Promise<ScanRouteAccess> {
  const supabase = await createClient()
  return resolveScanRouteAccess({
    getUser: async () => (await supabase.auth.getUser()).data.user,
    getHairProfile: async (userId) => {
      const { data } = await supabase
        .from("hair_profiles")
        .select(
          "hair_texture, thickness, density, cuticle_condition, protein_moisture_balance, scalp_type, scalp_condition, chemical_treatment, concerns",
        )
        .eq("user_id", userId)
        .maybeSingle()
      return data
    },
  })
}
