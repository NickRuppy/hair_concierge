import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { DiscoveryQuizLead } from "./quiz-answers"

/**
 * Her most recent quiz lead, or null. Read once per cockpit render (page: „Quiz-Antworten" +
 * preflight) and by the consult brief's source loader (consult-agent T3), so both see the
 * SAME lead and assemble the same brief input.
 */
export async function loadDiscoveryQuizLead(
  client: SupabaseClient,
  userId: string,
): Promise<DiscoveryQuizLead | null> {
  const { data, error } = await client
    .from("leads")
    .select("id,quiz_kind,quiz_answers,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
  if (error) throw error
  const lead = ((data as DiscoveryQuizLead[] | null) ?? [])[0]
  return lead ? { id: lead.id, quiz_kind: lead.quiz_kind, quiz_answers: lead.quiz_answers } : null
}
