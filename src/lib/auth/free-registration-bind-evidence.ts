import { createAdminClient } from "@/lib/supabase/admin"

import type { FreeRegistrationBindEvidence } from "./free-registration"

/**
 * Server-side evidence for `resolveFreeRegistrationBind` (T18 fix round 1,
 * review finding W1b): may this free magic link adopt the quiz lead it carries
 * into the account that just authenticated?
 *
 * Two reads, both admin-scoped so RLS cannot hide a row and turn "established"
 * into "empty":
 *  - the lead's own `user_id` — a re-click of one's OWN link, which must keep
 *    working (`canLinkDirectQuizLead` deliberately allows the same-user retry);
 *  - whether the account already has a `hair_profiles` row or a `personal_plans`
 *    row — the two things `linkQuizToProfile` and free provisioning would
 *    overwrite / collide with.
 *
 * A read that throws resolves to the most conservative evidence (`skip`): a
 * wrong "bind" destroys a possibly paying customer's profile, a wrong "skip"
 * costs one honest notice.
 */
export async function loadFreeRegistrationBindEvidence(input: {
  userId: string
  leadId: string
  admin?: BindEvidenceAdmin
}): Promise<FreeRegistrationBindEvidence> {
  const admin = input.admin ?? (createAdminClient() as unknown as BindEvidenceAdmin)

  const lead = await admin.from("leads").select("user_id").eq("id", input.leadId).maybeSingle()
  if (lead.error) throw new Error("free_registration_bind_evidence_unavailable")
  const leadUserId = (lead.data as { user_id?: unknown } | null)?.user_id
  const leadOwnedByAccount = typeof leadUserId === "string" && leadUserId === input.userId

  const profile = await admin
    .from("hair_profiles")
    .select("id")
    .eq("user_id", input.userId)
    .maybeSingle()
  if (profile.error) throw new Error("free_registration_bind_evidence_unavailable")
  if (profile.data) return { leadOwnedByAccount, hasEstablishedProfile: true }

  const plan = await admin
    .from("personal_plans")
    .select("id")
    .eq("user_id", input.userId)
    .maybeSingle()
  if (plan.error) throw new Error("free_registration_bind_evidence_unavailable")

  return { leadOwnedByAccount, hasEstablishedProfile: Boolean(plan.data) }
}

type BindEvidenceQuery = {
  select: (columns: string) => BindEvidenceQuery
  eq: (column: string, value: string) => BindEvidenceQuery
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}

type BindEvidenceAdmin = {
  from: (table: "leads" | "hair_profiles" | "personal_plans") => BindEvidenceQuery
}
