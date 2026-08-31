import "server-only"

export const SAVE_PERSONAL_PLAN_MIGRATION_QUIZ_LEAD_RPC = "personal_plan_save_migration_quiz_lead"
export const MIGRATION_QUIZ_COMPLETION_HREF = "/plan-bereit"

export type MigrationQuizSaveResult =
  | { status: "saved"; leadId: string; nextHref: typeof MIGRATION_QUIZ_COMPLETION_HREF }
  | { status: "invalid_context" }
  | { status: "temporarily_unavailable" }

export type MigrationQuizSaveClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

export async function saveMigrationQuizLead(input: {
  client: MigrationQuizSaveClient
  userId: string
  enrollmentId: string
  name: string
  email: string
  marketingConsent: boolean
  quizAnswers: Record<string, unknown>
}): Promise<MigrationQuizSaveResult> {
  const { data, error } = await input.client.rpc(SAVE_PERSONAL_PLAN_MIGRATION_QUIZ_LEAD_RPC, {
    p_user_id: input.userId,
    p_enrollment_id: input.enrollmentId,
    p_name: input.name,
    p_email: input.email,
    p_marketing_consent: input.marketingConsent,
    p_quiz_answers: input.quizAnswers,
  })
  if (error) throw error
  return parseMigrationQuizSaveResult(data)
}

export function parseMigrationQuizSaveResult(value: unknown): MigrationQuizSaveResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "temporarily_unavailable" }
  }

  const row = value as Record<string, unknown>
  if (row.status === "invalid_context") return { status: "invalid_context" }
  if (row.status === "temporarily_unavailable") return { status: "temporarily_unavailable" }
  if (row.status === "saved" && typeof row.lead_id === "string" && row.lead_id.trim()) {
    return {
      status: "saved",
      leadId: row.lead_id.trim(),
      nextHref: MIGRATION_QUIZ_COMPLETION_HREF,
    }
  }
  return { status: "temporarily_unavailable" }
}
