export type QuizEmailReturnEditIdentity = {
  name: string
  email: string
  marketingConsent: boolean
}

export function parseQuizEmailReturnEditIdentity(
  payload: unknown,
): QuizEmailReturnEditIdentity | null {
  if (!payload || typeof payload !== "object") return null
  const candidate = payload as Record<string, unknown>
  if (candidate.status !== "resolved" || !candidate.lead || typeof candidate.lead !== "object") {
    return null
  }
  const lead = candidate.lead as Record<string, unknown>
  if (
    typeof lead.name !== "string" ||
    typeof lead.email !== "string" ||
    !lead.email.trim() ||
    typeof lead.marketingConsent !== "boolean"
  ) {
    return null
  }
  return {
    name: lead.name.trim(),
    email: lead.email.trim().toLowerCase(),
    marketingConsent: lead.marketingConsent,
  }
}

export function canInheritQuizEmailReturnConsent(
  identity: QuizEmailReturnEditIdentity | null,
  currentEmail: string,
  inheritanceRejected: boolean,
) {
  return Boolean(
    !inheritanceRejected &&
    identity?.marketingConsent &&
    identity.email === currentEmail.trim().toLowerCase(),
  )
}
