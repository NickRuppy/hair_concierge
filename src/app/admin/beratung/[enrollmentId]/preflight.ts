import "server-only"

import { classifyPlanBereitSourceFacts } from "@/app/plan-bereit/readiness"
import type { DiscoveryQuizLead } from "@/lib/discovery/quiz-answers"

// The lead read lives in lib since consult-agent T3 (the consult brief's source loader
// shares it); re-exported so the page keeps its import.
export { loadDiscoveryQuizLead } from "@/lib/discovery/quiz-lead"

/**
 * The prep runbook's preflight, read straight off the participant's quiz lead.
 *
 * `classifyPlanBereitSourceFacts` is the SAME classification `/plan-bereit` uses to decide
 * whether a profile can carry a plan at all, so an intake it calls incomplete would give
 * the call a thin Idealroutine. Nick sees that before the call, as a banner naming the
 * questions that are still open — not as a surprise while the participant is on the line.
 *
 * The lead is read once per render (`loadDiscoveryQuizLead`) and shared with the
 * „Quiz-Antworten" section.
 */

export type DiscoverySourceFactsPreflight =
  | { status: "ready" }
  | { status: "missing_source_facts"; questions: string[] }
  | { status: "invalid_source" }
  | { status: "no_lead" }

export function classifyDiscoverySourceFactsPreflight(
  lead: DiscoveryQuizLead | null,
): DiscoverySourceFactsPreflight {
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
