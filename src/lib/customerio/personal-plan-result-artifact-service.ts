import { buildPersonalPlanResultArtifactEmailPayload } from "./personal-plan-result-artifact"
import { sanitizeArtifactEmailError } from "./result-artifact-service"
import type { CustomerIoTransactionalEmailPayload } from "./transactional"

export interface PersonalPlanResultArtifactLead {
  id: string
  quiz_kind: "personal_plan"
  email: string | null
  artifact_email_status: string | null
}

export interface PersonalPlanResultArtifactRow {
  priorities: unknown
  public_offer_model: unknown
}

export interface PersonalPlanResultArtifactStore {
  claimLead(leadId: string): Promise<PersonalPlanResultArtifactLead | null>
  loadAttachedArtifact(leadId: string): Promise<PersonalPlanResultArtifactRow | null>
  markSent(leadId: string): Promise<void>
  markFailed(leadId: string, error: string): Promise<void>
}

export interface HandlePersonalPlanResultArtifactEmailInput {
  leadId: string
  siteUrl: string
  store: PersonalPlanResultArtifactStore
  send: (payload: CustomerIoTransactionalEmailPayload) => Promise<void>
}

export async function handlePersonalPlanResultArtifactEmail({
  leadId,
  siteUrl,
  store,
  send,
}: HandlePersonalPlanResultArtifactEmailInput): Promise<{ sent: boolean; skipped: boolean }> {
  const lead = await store.claimLead(leadId)
  if (!lead) return { sent: false, skipped: true }

  const email = lead.email?.trim()
  if (!email) {
    await store.markFailed(leadId, "Personal-plan result email is missing the stored email")
    return { sent: false, skipped: false }
  }

  const artifact = await store.loadAttachedArtifact(leadId)
  if (!artifact) {
    await store.markFailed(leadId, "Personal-plan result email is missing its attached artifact")
    return { sent: false, skipped: false }
  }

  try {
    const payload = buildPersonalPlanResultArtifactEmailPayload({
      email,
      leadId,
      priorities: artifact.priorities,
      publicOfferModel: artifact.public_offer_model,
      siteUrl,
    })
    await send(payload)
  } catch (error) {
    await store.markFailed(leadId, sanitizeArtifactEmailError(error))
    return { sent: false, skipped: false }
  }

  await store.markSent(leadId)
  return { sent: true, skipped: false }
}
