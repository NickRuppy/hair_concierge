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

type FieldTestEnrollmentClient = {
  from: (table: "personal_plan_test_enrollments") => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>
        }
      }
    }
  }
}

type FieldTestEnrollmentRow = {
  id?: unknown
  user_id?: unknown
  status?: unknown
  expires_at?: unknown
  revoked_at?: unknown
  manual_access_grant_id?: unknown
  manual_access_grants?: unknown
}

type ManualAccessGrantRow = {
  id?: unknown
  user_id?: unknown
  reason?: unknown
  expires_at?: unknown
  revoked_at?: unknown
}

function activeFutureTimestamp(value: unknown, now: Date): boolean {
  return (
    typeof value === "string" &&
    !Number.isNaN(new Date(value).getTime()) &&
    new Date(value).getTime() > now.getTime()
  )
}

export async function isActivePersonalPlanFieldTestOwner(
  userId: string,
  client: FieldTestEnrollmentClient,
  now: Date = new Date(),
): Promise<boolean> {
  const { data, error } = await client
    .from("personal_plan_test_enrollments")
    .select(
      "id,user_id,status,expires_at,revoked_at,manual_access_grant_id,manual_access_grants!inner(id,user_id,reason,expires_at,revoked_at)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()
  if (error) throw error
  const enrollment = (data as FieldTestEnrollmentRow | null) ?? null
  const grant = enrollment?.manual_access_grants as ManualAccessGrantRow | null
  return Boolean(
    enrollment &&
    typeof enrollment.id === "string" &&
    enrollment.user_id === userId &&
    enrollment.status === "active" &&
    enrollment.revoked_at === null &&
    activeFutureTimestamp(enrollment.expires_at, now) &&
    typeof enrollment.manual_access_grant_id === "string" &&
    grant &&
    grant.id === enrollment.manual_access_grant_id &&
    grant.user_id === userId &&
    grant.reason === "tester" &&
    grant.revoked_at === null &&
    activeFutureTimestamp(grant.expires_at, now),
  )
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

  if (
    await isActivePersonalPlanFieldTestOwner(userId, client as unknown as FieldTestEnrollmentClient)
  ) {
    return true
  }

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
