import "server-only"

import { isQuizEmailReturnEnabled } from "@/lib/funnel/flags"
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
