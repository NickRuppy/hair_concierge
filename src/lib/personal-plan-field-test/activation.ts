import "server-only"

import { randomBytes, randomUUID } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"

type CreateUserAttributes = {
  email: string
  password: string
  email_confirm: true
  app_metadata: {
    access_kind: "field_test"
    field_test_campaign_id?: string
    field_test_funnel_session_id?: string
    field_test_lead_id?: string
  }
}

type CreateUserResult = {
  data: { user: { id: string } | null }
  error: unknown
}

export type PersonalPlanFieldTestGuest = {
  userId: string
  email: string
  password: string
}

export async function createPersonalPlanFieldTestGuest(
  dependencies?: {
    createUser?: (attributes: CreateUserAttributes) => Promise<CreateUserResult>
  },
  activation?: { campaignId: string; funnelSessionId: string; leadId: string },
): Promise<PersonalPlanFieldTestGuest> {
  const email = `field-test+${randomUUID()}@guest.chaarlie.invalid`
  const password = randomBytes(32).toString("base64url")
  const createUser =
    dependencies?.createUser ??
    ((attributes: CreateUserAttributes) => createAdminClient().auth.admin.createUser(attributes))
  const { data, error } = await createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      access_kind: "field_test",
      ...(activation
        ? {
            field_test_campaign_id: activation.campaignId,
            field_test_funnel_session_id: activation.funnelSessionId,
            field_test_lead_id: activation.leadId,
          }
        : {}),
    },
  })
  if (error || !data.user?.id) throw new Error("Field-test guest creation failed")
  return { userId: data.user.id, email, password }
}

export type PersonalPlanFieldTestActivation = {
  enrollmentId: string
  expiresAt: string
  reused: boolean
}

export async function activatePersonalPlanFieldTestEnrollment(
  input: {
    campaignId: string
    funnelSessionId: string
    leadId: string
    userId: string
    eventId: string
  },
  dependencies?: {
    rpc?: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>
  },
): Promise<PersonalPlanFieldTestActivation> {
  const rpc =
    dependencies?.rpc ??
    ((name: string, args: Record<string, unknown>) => createAdminClient().rpc(name, args))
  const { data, error } = await rpc("activate_personal_plan_field_test", {
    p_campaign_id: input.campaignId,
    p_funnel_session_id: input.funnelSessionId,
    p_lead_id: input.leadId,
    p_user_id: input.userId,
    p_activation_event_id: input.eventId,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (
    error ||
    !row ||
    typeof row !== "object" ||
    typeof row.enrollment_id !== "string" ||
    typeof row.expires_at !== "string"
  ) {
    throw new Error("Field-test activation failed")
  }
  return {
    enrollmentId: row.enrollment_id,
    expiresAt: row.expires_at,
    reused: row.reused === true,
  }
}
