import { buildCustomerIoQuizLeadSync } from "@/lib/customerio/quiz-traits"
import {
  identifyCustomerIoServerPerson,
  logCustomerIoServerResult,
  trackCustomerIoServerEvent,
} from "@/lib/customerio/server"
import type { QuizAnswers } from "@/lib/quiz/types"

export async function syncQuizLeadToCustomerIo({
  createdAt,
  email,
  leadId,
  marketingConsent,
  name,
  quizAnswers,
  funnelSessionId,
  funnelPackageKey,
}: {
  createdAt: string
  email: string
  leadId: string
  marketingConsent: boolean
  name: string
  quizAnswers: QuizAnswers
  funnelSessionId?: string | null
  funnelPackageKey?: string | null
}) {
  const sync = buildCustomerIoQuizLeadSync({
    createdAt,
    email,
    leadId,
    marketingConsent,
    name,
    quizAnswers,
    funnelSessionId,
    funnelPackageKey,
  })

  if (!sync.shouldIdentify) return {}

  const identify = await identifyCustomerIoServerPerson({
    userId: sync.userId,
    traits: sync.identifyTraits,
    messageId: `identify:quiz_lead:${leadId}`,
    timestamp: createdAt,
  })
  logCustomerIoServerResult(`identify quiz lead ${leadId}`, identify)

  if (!sync.shouldTrackProfileSubmitted) return { identify }

  const profileSubmitted = await trackCustomerIoServerEvent({
    userId: sync.userId,
    event: sync.eventName,
    properties: sync.eventProperties,
    messageId: `quiz_profile_submitted:${leadId}`,
    timestamp: createdAt,
  })
  logCustomerIoServerResult(`track quiz_profile_submitted ${leadId}`, profileSubmitted)

  return { identify, profileSubmitted }
}
