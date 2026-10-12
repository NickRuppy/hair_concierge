import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { isAdminUser } from "@/lib/auth/is-admin-user"

import { canAccessPersonalPlanTools, resolvePersonalPlanToolsRollout } from "./release"

export async function isPersonalPlanAppV1AllowedForUser(
  _userId: string,
  _client?: unknown,
): Promise<boolean> {
  void _userId
  void _client
  return true
}

/**
 * Server-owned gate for the Hair Tools domain, resolved once per request and
 * passed down as a boolean. Default on: an unset or unknown environment value
 * means on for everyone, and only `off` (any case) disables. Under `admin` an
 * unreadable identity or a missing client fails closed to false. Browser
 * answers never reach this decision.
 */
export async function isPersonalPlanToolsEnabledForUser(
  userId: string,
  client?: Pick<SupabaseClient, "from">,
): Promise<boolean> {
  const rollout = resolvePersonalPlanToolsRollout()
  if (rollout === "off") return false
  if (rollout === "all") return true
  if (!client) return false
  return canAccessPersonalPlanTools({ rollout, isAdmin: await isAdminUser(userId, client) })
}
