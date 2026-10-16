import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeStoredQuizAnswers } from "@/lib/quiz/normalization"
import { storedQuizAnswersSchema } from "@/lib/quiz/validators"

import type { DiscoveryEnrollmentListRow } from "./enrollment"

const LEAD_PAGE_SIZE = 200
const EMAIL_BATCH_SIZE = 100

export type DiscoveryQuizProgress = { completedAt: string }

type QuizLeadRow = {
  email: string | null
  user_id: string | null
  quiz_answers: unknown
  created_at: string
}

function parseTimestamp(value: string): number | null {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function hasCompleteStoredQuizAnswers(raw: unknown): boolean {
  // The normalizer intentionally defaults missing concerns to [], which is right
  // for historical readers but must not manufacture a completed quiz here.
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return false
  }
  const record = raw as Record<string, unknown>
  if (!Array.isArray(record.concerns)) return false
  return storedQuizAnswersSchema.safeParse(normalizeStoredQuizAnswers(record)).success
}

/**
 * Finds complete legacy quizzes for claimed invitations without binding or
 * changing either record. An anonymous lead only counts from the claim onward;
 * a lead already owned by the same account is safe evidence even if it predates
 * the claim. Another account's lead never counts.
 */
export async function listDiscoveryQuizProgress(
  enrollments: readonly DiscoveryEnrollmentListRow[],
  client = createAdminClient(),
): Promise<Map<string, DiscoveryQuizProgress>> {
  const candidates = enrollments.filter(
    (
      enrollment,
    ): enrollment is DiscoveryEnrollmentListRow & {
      normalized_email: string
      claimed_at: string
      claimed_user_id: string
    } =>
      Boolean(enrollment.normalized_email && enrollment.claimed_at && enrollment.claimed_user_id),
  )
  const byEmail = new Map<string, typeof candidates>()
  for (const enrollment of candidates) {
    const key = enrollment.normalized_email.toLowerCase()
    byEmail.set(key, [...(byEmail.get(key) ?? []), enrollment])
  }

  const progress = new Map<string, DiscoveryQuizProgress>()
  const emails = [...byEmail.keys()]
  for (let batchStart = 0; batchStart < emails.length; batchStart += EMAIL_BATCH_SIZE) {
    const batch = emails.slice(batchStart, batchStart + EMAIL_BATCH_SIZE)
    for (let from = 0; ; from += LEAD_PAGE_SIZE) {
      const { data, error } = await client
        .from("leads")
        .select("email,user_id,quiz_answers,created_at")
        .in("email", batch)
        .eq("quiz_kind", "legacy")
        .not("quiz_answers", "is", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + LEAD_PAGE_SIZE - 1)
      if (error) throw error
      const rows = (data as QuizLeadRow[] | null) ?? []
      for (const lead of rows) {
        if (!lead.email || !hasCompleteStoredQuizAnswers(lead.quiz_answers)) continue
        const leadTimestamp = parseTimestamp(lead.created_at)
        if (leadTimestamp === null) continue
        for (const enrollment of byEmail.get(lead.email.toLowerCase()) ?? []) {
          const sameAccount = lead.user_id === enrollment.claimed_user_id
          const claimTimestamp = parseTimestamp(enrollment.claimed_at)
          const eligibleAnonymousLead =
            lead.user_id === null && claimTimestamp !== null && leadTimestamp >= claimTimestamp
          if (!sameAccount && !eligibleAnonymousLead) continue
          const current = progress.get(enrollment.id)
          if (!current || leadTimestamp > Date.parse(current.completedAt)) {
            progress.set(enrollment.id, { completedAt: lead.created_at })
          }
        }
      }
      if (rows.length < LEAD_PAGE_SIZE) break
    }
  }
  return progress
}
