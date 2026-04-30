import { createAdminClient } from "@/lib/supabase/admin"
import { getUserContext } from "@/lib/agent/tools/get-user-context"
import type { AgentCompareUserOption, AgentCompareUserSnapshot } from "./types"

type EligibleCompareUserRow = {
  id: string
  full_name: string | null
  onboarding_completed: boolean
  has_hair_profile: boolean
  hair_texture?: string | null
  thickness?: string | null
  concerns?: string[]
}

export function filterEligibleCompareUsers(rows: EligibleCompareUserRow[]): EligibleCompareUserRow[] {
  return rows.filter((row) => row.onboarding_completed && row.has_hair_profile)
}

export function buildCompareUserLabel(row: {
  id: string
  full_name: string | null
  hair_texture?: string | null
  thickness?: string | null
  concerns?: string[]
}): string {
  const summary = [row.hair_texture, row.thickness, ...(row.concerns ?? []).slice(0, 2)]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" · ")

  const base = row.full_name?.trim() || `Testnutzer ${row.id.slice(0, 8)}`
  return summary ? `${base} · ${summary}` : base
}

export function projectCompareUserSnapshot(params: {
  userId: string
  routineInventory: Awaited<ReturnType<typeof getUserContext>>["routine_inventory"]
  relevantMemory: Awaited<ReturnType<typeof getUserContext>>["relevant_memory"]
  derivedSignals: Awaited<ReturnType<typeof getUserContext>>["derived_signals"]
}): AgentCompareUserSnapshot {
  return {
    user_id: params.userId,
    derived_signals: params.derivedSignals,
    routine_inventory: params.routineInventory.map((item) => ({
      category: item.category,
      product_name: item.product_name,
      frequency_range: item.frequency_range ?? null,
    })),
    relevant_memory: params.relevantMemory.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      content: entry.content,
    })),
  }
}

export async function listEligibleCompareUsers(): Promise<AgentCompareUserOption[]> {
  const admin = createAdminClient()
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, onboarding_completed")

  if (profileError) {
    throw new Error(`Failed to load compare users: ${profileError.message}`)
  }

  const userIds = (profiles ?? []).map((profile) => profile.id)
  if (userIds.length === 0) {
    return []
  }

  const { data: hairProfiles, error: hairProfileError } = await admin
    .from("hair_profiles")
    .select("user_id, hair_texture, thickness, concerns")
    .in("user_id", userIds)

  if (hairProfileError) {
    throw new Error(`Failed to load compare hair profiles: ${hairProfileError.message}`)
  }

  const hairByUserId = new Map((hairProfiles ?? []).map((profile) => [profile.user_id, profile]))

  return filterEligibleCompareUsers(
    (profiles ?? []).map((profile) => {
      const hairProfile = hairByUserId.get(profile.id)
      return {
        id: profile.id,
        full_name: profile.full_name,
        onboarding_completed: profile.onboarding_completed,
        has_hair_profile: Boolean(hairProfile),
        hair_texture: hairProfile?.hair_texture ?? null,
        thickness: hairProfile?.thickness ?? null,
        concerns: hairProfile?.concerns ?? [],
      }
    }),
  ).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    label: buildCompareUserLabel(row),
  }))
}

export async function loadCompareUserSnapshot(userId: string): Promise<AgentCompareUserSnapshot> {
  const context = await getUserContext(userId)

  return projectCompareUserSnapshot({
    userId,
    routineInventory: context.routine_inventory,
    relevantMemory: context.relevant_memory,
    derivedSignals: context.derived_signals,
  })
}
