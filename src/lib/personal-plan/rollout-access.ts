import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  canAccessPersonalPlanAppV1Rollout,
  isPersonalPlanAppV1Enabled,
  resolvePersonalPlanAppV1Rollout,
  resolvePersonalPlanAppV1InternalEmails,
} from "./release"

export type PersonalPlanInternalUserClient = {
  from: (table: "profiles") => {
    select: (columns: "is_admin") => {
      eq: (
        column: "id",
        value: string,
      ) => {
        maybeSingle: () => Promise<{ data: { is_admin?: unknown } | null; error: unknown }>
      }
    }
  }
  auth: {
    admin: {
      getUserById: (userId: string) => Promise<{
        data: {
          user: { email?: string | null; email_confirmed_at?: string | null } | null
        }
        error: unknown
      }>
    }
  }
}

export async function isPersonalPlanInternalUser(
  userId: string,
  client: PersonalPlanInternalUserClient,
): Promise<boolean> {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle()
  if (profileError) throw profileError
  if (profile?.is_admin === true) return true

  const allowedEmails = resolvePersonalPlanAppV1InternalEmails()
  if (allowedEmails.size === 0) return false
  const { data, error } = await client.auth.admin.getUserById(userId)
  if (error) throw error
  const email = data.user?.email?.trim().toLowerCase()
  return Boolean(email && data.user?.email_confirmed_at && allowedEmails.has(email))
}

export async function isPersonalPlanAppV1AllowedForUser(
  userId: string,
  client: PersonalPlanInternalUserClient = createAdminClient() as unknown as PersonalPlanInternalUserClient,
): Promise<boolean> {
  const appEnabled = isPersonalPlanAppV1Enabled()
  const rollout = resolvePersonalPlanAppV1Rollout()
  if (!appEnabled || rollout === "off") return false
  if (rollout === "all") return true

  return canAccessPersonalPlanAppV1Rollout({
    appEnabled,
    rollout,
    isInternal: await isPersonalPlanInternalUser(userId, client),
  })
}
