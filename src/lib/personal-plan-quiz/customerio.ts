import { identifyCustomerIoServerPerson, logCustomerIoServerResult } from "@/lib/customerio/server"

export async function syncPersonalPlanLeadToCustomerIo({
  createdAt,
  email,
  leadId,
  marketingConsent,
}: {
  createdAt: string
  email: string
  leadId: string
  marketingConsent: boolean
}) {
  const result = await identifyCustomerIoServerPerson({
    userId: email,
    messageId: `identify:personal_plan_lead:${leadId}`,
    timestamp: createdAt,
    traits: {
      email,
      lead_id: leadId,
      quiz_kind: "personal_plan",
      marketing_consent: marketingConsent,
    },
  })
  logCustomerIoServerResult(`identify personal-plan lead ${leadId}`, result)
  return result
}
