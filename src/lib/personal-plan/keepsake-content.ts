import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Keepsake evidence (T17, freemium-scanner-first PR5).
 *
 * "Lapsed" is not a stored state anywhere in this schema — it is a composition:
 * the paid-access composite says DENIED right now, but this user demonstrably
 * held paid access at some point. `personal_plans.active_routine_version_id` is
 * the conservative proof of that second half: a Routine version can only become
 * *active* through Stage 4 acceptance, which is reachable only for an owner whose
 * journey access resolved to `personal_plan` — i.e. `accessState === "active"`
 * plus a prepared source (see `journey-access-loader.ts`). A never-paid freemium
 * user has no `personal_plans` row at all (T14's `freemium_plan_admissions` is
 * written only at VERIFIED purchase activation), so this signal cannot promote
 * one into keepsake reads.
 *
 * A pending proposal is deliberately NOT accepted as evidence: it is an unaccepted
 * suggestion, not something the user ever owned, and T17's promise is "nothing you
 * already had is taken away", not "a draft becomes readable forever".
 *
 * Reads throw on a query error rather than resolving to `null`. Callers fail
 * closed by catching — a keepsake lookup that cannot be trusted degrades to
 * today's free-tier behaviour (the T12 „Beispiel" page), never to a wrongly
 * unlocked surface.
 */
export type PersonalPlanKeepsakeContent = {
  personalPlanId: string
  activeRoutineVersionId: string
}

type KeepsakeQuery = {
  select: (columns: string) => KeepsakeQuery
  eq: (column: string, value: unknown) => KeepsakeQuery
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}

export type PersonalPlanKeepsakeReadClient = {
  from: (table: "personal_plans") => KeepsakeQuery
}

export async function loadPersonalPlanKeepsakeContent(
  client: PersonalPlanKeepsakeReadClient,
  userId: string,
): Promise<PersonalPlanKeepsakeContent | null> {
  const { data, error } = await client
    .from("personal_plans")
    .select("id,active_routine_version_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return parsePersonalPlanKeepsakeContent(data)
}

export function parsePersonalPlanKeepsakeContent(
  value: unknown,
): PersonalPlanKeepsakeContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== "string" || typeof row.active_routine_version_id !== "string") return null
  return { personalPlanId: row.id, activeRoutineVersionId: row.active_routine_version_id }
}

export function loadPersonalPlanKeepsakeContentForUser(
  userId: string,
): Promise<PersonalPlanKeepsakeContent | null> {
  return loadPersonalPlanKeepsakeContent(
    createAdminClient() as unknown as PersonalPlanKeepsakeReadClient,
    userId,
  )
}
