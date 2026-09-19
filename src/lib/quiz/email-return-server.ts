import "server-only"

import { isQuizEmailReturnEnabled } from "@/lib/funnel/flags"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveQuizEmailReturnLinkById } from "./email-return-credential"
import { decodeQuizEmailReturnContext, QUIZ_EMAIL_RETURN_PACKAGE_KEY } from "./email-return-context"

export async function resolveQuizEmailReturnCookie(cookieValue: string | undefined) {
  if (!isQuizEmailReturnEnabled()) return { status: "invalid" as const }
  const context = decodeQuizEmailReturnContext(
    cookieValue,
    process.env.FUNNEL_COOKIE_SIGNING_SECRET,
  )
  if (!context) return { status: "invalid" as const }
  const resolved = await resolveQuizEmailReturnLinkById(context.linkId)
  if (resolved.status !== "resolved") return { status: resolved.status }
  if (
    resolved.packageKey !== QUIZ_EMAIL_RETURN_PACKAGE_KEY ||
    !resolved.leadId ||
    !resolved.quizKind ||
    !resolved.campaignKey ||
    !resolved.linkId
  )
    return { status: "invalid" as const }
  return {
    status: "resolved" as const,
    leadId: resolved.leadId,
    quizKind: resolved.quizKind,
    campaignKey: resolved.campaignKey,
    linkId: resolved.linkId,
  }
}

export type QuizEmailReturnSourceIdentity = {
  leadId: string
  name: string
  email: string
  marketingConsent: boolean
  consentTimestamp: string
}

async function loadQuizEmailReturnSourceLead(leadId: string) {
  return createAdminClient()
    .from("leads")
    .select("id,quiz_kind,name,email,marketing_consent,created_at")
    .eq("id", leadId)
    .maybeSingle()
}

/** Resolve the exact lead bound to the signed return cookie, including identity. */
export async function resolveQuizEmailReturnSourceIdentity(
  cookieValue: string | undefined,
  loadLead: typeof loadQuizEmailReturnSourceLead = loadQuizEmailReturnSourceLead,
): Promise<
  | { status: "resolved"; identity: QuizEmailReturnSourceIdentity }
  | { status: "invalid" | "unavailable" }
> {
  const source = await resolveQuizEmailReturnCookie(cookieValue)
  if (source.status !== "resolved") return { status: source.status }

  const { data, error } = await loadLead(source.leadId)
  if (error) return { status: "unavailable" }
  if (
    !data ||
    data.id !== source.leadId ||
    data.quiz_kind !== source.quizKind ||
    typeof data.email !== "string" ||
    !data.email.trim() ||
    typeof data.created_at !== "string"
  ) {
    return { status: "invalid" }
  }

  return {
    status: "resolved",
    identity: {
      leadId: data.id,
      name: typeof data.name === "string" ? data.name.trim() : "",
      email: data.email.trim().toLowerCase(),
      marketingConsent: data.marketing_consent === true,
      consentTimestamp: data.created_at,
    },
  }
}
