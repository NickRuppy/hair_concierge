import "server-only"

import type { DiscoveryAdminClient } from "@/lib/discovery/intake"
import { hasCompletedQuizDiagnostics } from "@/lib/quiz/completion"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"

/**
 * The checklist page owns the quiz projection, because nobody upstream does.
 *
 * `/auth/confirm` deliberately does NOT run `linkQuizToProfile` for a
 * `/beratung/weiter` continuation (stale-lead protection: the magic link is
 * followed BEFORE the discovery quiz is taken, so whatever lead the account
 * looked like it had then is the wrong one). That makes this page the first
 * surface that can project the FRESH discovery lead — and the last one that can
 * notice it did not work.
 *
 * "Worked" means two things, and both are checked against the database rather
 * than against `linkQuizToProfile`'s return value: `hair_profiles` carries
 * complete diagnostics, AND the legacy lead is bound to this account
 * (`leads.user_id`). `linkQuizToProfile` returns silently on several no-op paths
 * ("no matching lead", "no usable diagnostics", a lost `create_only` race), so a
 * clean return proves nothing on its own — the mismatch is logged loudly instead
 * of being swallowed.
 */

export type DiscoveryQuizProjectionState = {
  hasDiagnostics: boolean
  leadBound: boolean
}

const PROFILE_COLUMNS =
  "hair_texture, thickness, density, cuticle_condition, protein_moisture_balance, scalp_type, scalp_condition, chemical_treatment, concerns"

export async function loadDiscoveryQuizProjectionState(
  client: DiscoveryAdminClient,
  input: { userId: string; leadId: string | null },
): Promise<DiscoveryQuizProjectionState> {
  const { data: profile, error: profileError } = await client
    .from("hair_profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", input.userId)
    .maybeSingle()
  if (profileError) throw profileError

  let leadQuery = client.from("leads").select("id").eq("user_id", input.userId).limit(1)
  // With a `lead` parameter the requirement is that THAT lead is bound — the one
  // the quiz just wrote. Without it (a returning visit, a bookmarked URL) any
  // lead already bound to the account is enough.
  if (input.leadId) leadQuery = leadQuery.eq("id", input.leadId)
  const { data: leads, error: leadError } = await leadQuery
  if (leadError) throw leadError

  return {
    hasDiagnostics: hasCompletedQuizDiagnostics(profile as never),
    leadBound: ((leads as Array<{ id: string }> | null) ?? []).length > 0,
  }
}

export type EnsureDiscoveryQuizProjectionDependencies = {
  linkQuizToProfile: typeof linkQuizToProfile
  loadState: typeof loadDiscoveryQuizProjectionState
}

/**
 * Idempotent: `linkQuizToProfile` runs in its ORDINARY mode (not `create_only`),
 * which is the ruled behaviour for discovery — the fresh discovery quiz is the
 * source of truth even for a re-used existing account (plan §5).
 */
export async function ensureDiscoveryQuizProjection(
  input: {
    client: DiscoveryAdminClient
    userId: string
    email: string
    leadId: string | null
  },
  overrides: Partial<EnsureDiscoveryQuizProjectionDependencies> = {},
): Promise<DiscoveryQuizProjectionState> {
  const link = overrides.linkQuizToProfile ?? linkQuizToProfile
  const loadState = overrides.loadState ?? loadDiscoveryQuizProjectionState

  let linkFailed = false
  try {
    await link(input.userId, input.email, input.leadId ?? undefined)
  } catch (error) {
    linkFailed = true
    console.error("[discovery] linkQuizToProfile threw for a checklist visit:", {
      userId: input.userId,
      leadId: input.leadId,
      error,
    })
  }

  const state = await loadState(input.client, { userId: input.userId, leadId: input.leadId })
  if (!state.hasDiagnostics || !state.leadBound) {
    console.error("[discovery] quiz projection incomplete after linkQuizToProfile", {
      userId: input.userId,
      leadId: input.leadId,
      linkFailed,
      ...state,
    })
  }
  return state
}
