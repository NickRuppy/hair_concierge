import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { classifyPlanBereitSourceFacts } from "@/app/plan-bereit/readiness"

/**
 * The prep runbook's preflight, read straight off the participant's quiz lead.
 *
 * `classifyPlanBereitSourceFacts` is the SAME classification `/plan-bereit` uses to decide
 * whether a profile can carry a plan at all, so an intake it calls incomplete would give
 * the call a thin Idealroutine. Nick sees that before the call, as a banner naming the
 * questions that are still open — not as a surprise while the participant is on the line.
 */

export type DiscoverySourceFactsPreflight =
  | { status: "ready" }
  | { status: "missing_source_facts"; questions: string[] }
  | { status: "invalid_source" }
  | { status: "no_lead" }

type LeadRow = { id: string; quiz_kind: string; quiz_answers: unknown }

export async function loadDiscoverySourceFactsPreflight(
  client: SupabaseClient,
  userId: string,
): Promise<DiscoverySourceFactsPreflight> {
  const { data, error } = await client
    .from("leads")
    .select("id,quiz_kind,quiz_answers,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
  if (error) throw error
  const lead = ((data as LeadRow[] | null) ?? [])[0]
  if (!lead) return { status: "no_lead" }
  if (lead.quiz_kind !== "legacy" && lead.quiz_kind !== "personal_plan") {
    return { status: "invalid_source" }
  }

  const classified = classifyPlanBereitSourceFacts({
    id: lead.id,
    quiz_kind: lead.quiz_kind,
    quiz_answers: lead.quiz_answers,
  })
  if (classified.status === "missing_source_facts") {
    return {
      status: "missing_source_facts",
      questions: classified.missingFacts.map((fact) => fact.question),
    }
  }
  return { status: classified.status }
}
