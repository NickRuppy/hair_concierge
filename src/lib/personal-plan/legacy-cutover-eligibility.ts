import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getPersonalPlanNewBuyerCohortCutoff,
  isPersonalPlanLegacyQuizCutoverEnabled,
} from "./release"
import { isPersonalPlanAppV1AllowedForUser } from "./rollout-access"

type EligibilityDependencies = {
  cutoverEnabled: () => boolean
  cohortCutoff: () => Date | null
  appAllowedForUser: (userId: string, client: unknown) => Promise<boolean>
  report: (event: LegacyQuizTransitionEvent) => void
}

export type LegacyQuizTransitionEvent = {
  provider: "stripe" | "paypal"
  quizSourceKind: "legacy"
  transitionState: "cutover_eligible" | "cutover_ineligible"
  reasonCode:
    | "eligible"
    | "cutoff_unavailable"
    | "invalid_purchase_timestamp"
    | "pre_cutoff_purchase"
    | "app_rollout_excluded"
}

export function reportLegacyQuizTransition(event: LegacyQuizTransitionEvent) {
  console.info("personal_plan_legacy_quiz_transition", event)
}

const defaults: EligibilityDependencies = {
  cutoverEnabled: isPersonalPlanLegacyQuizCutoverEnabled,
  cohortCutoff: getPersonalPlanNewBuyerCohortCutoff,
  appAllowedForUser: (userId, client) => isPersonalPlanAppV1AllowedForUser(userId, client as never),
  report: reportLegacyQuizTransition,
}

export async function resolveLegacyQuizFuturePurchaseEligibility(
  client: Pick<SupabaseClient, "from">,
  input: {
    userId: string
    leadId?: string | null
    paidAt?: string | null
    provider: "stripe" | "paypal"
  },
  dependencies: EligibilityDependencies = defaults,
): Promise<boolean> {
  if (!dependencies.cutoverEnabled() || !input.leadId || !input.paidAt) return false
  const cutoff = dependencies.cohortCutoff()
  const paidAt = new Date(input.paidAt)

  const { data, error } = await client
    .from("leads")
    .select("id,user_id,quiz_kind")
    .eq("id", input.leadId)
    .eq("user_id", input.userId)
    .eq("quiz_kind", "legacy")
    .maybeSingle()
  if (
    error ||
    !data ||
    data.id !== input.leadId ||
    data.user_id !== input.userId ||
    data.quiz_kind !== "legacy"
  ) {
    return false
  }

  if (!cutoff) {
    dependencies.report(transitionEvent(input.provider, "cutoff_unavailable"))
    return false
  }
  if (Number.isNaN(paidAt.getTime())) {
    dependencies.report(transitionEvent(input.provider, "invalid_purchase_timestamp"))
    return false
  }
  if (paidAt.getTime() < cutoff.getTime()) {
    dependencies.report(transitionEvent(input.provider, "pre_cutoff_purchase"))
    return false
  }

  const eligible = await dependencies.appAllowedForUser(input.userId, client)
  dependencies.report(
    transitionEvent(input.provider, eligible ? "eligible" : "app_rollout_excluded"),
  )
  return eligible
}

function transitionEvent(
  provider: LegacyQuizTransitionEvent["provider"],
  reasonCode: LegacyQuizTransitionEvent["reasonCode"],
): LegacyQuizTransitionEvent {
  return {
    provider,
    quizSourceKind: "legacy",
    transitionState: reasonCode === "eligible" ? "cutover_eligible" : "cutover_ineligible",
    reasonCode,
  }
}
