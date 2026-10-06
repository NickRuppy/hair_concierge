import assert from "node:assert/strict"
import test from "node:test"

import {
  activatePersonalPlanFieldTestEnrollment,
  createPersonalPlanFieldTestGuest,
} from "../src/lib/personal-plan-field-test"

test("guest creation uses a non-deliverable synthetic identity and never returns persisted credentials", async () => {
  const calls: Record<string, unknown>[] = []
  const guest = await createPersonalPlanFieldTestGuest(
    {
      createUser: async (attributes) => {
        calls.push(attributes)
        return { data: { user: { id: "guest-user" } }, error: null }
      },
    },
    { campaignId: "campaign", funnelSessionId: "session", leadId: "lead" },
  )

  assert.equal(guest.userId, "guest-user")
  assert.match(guest.email, /@guest\.chaarlie\.invalid$/)
  assert.equal(guest.password.length >= 43, true)
  assert.equal(calls.length, 1)
  const metadata = calls[0].app_metadata as Record<string, unknown>
  assert.deepEqual(metadata.access_kind, "field_test")
  assert.equal(metadata.field_test_campaign_id, "campaign")
  assert.equal(metadata.field_test_funnel_session_id, "session")
  assert.equal(metadata.field_test_lead_id, "lead")
  assert.equal(calls[0].email_confirm, true)
})

test("activation calls the service-only RPC with exact campaign, session, lead, guest, and event", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const result = await activatePersonalPlanFieldTestEnrollment(
    {
      campaignId: "campaign",
      funnelSessionId: "session",
      leadId: "lead",
      userId: "user",
      eventId: "event",
    },
    {
      rpc: async (name, args) => {
        calls.push({ name, args })
        return {
          data: [{ enrollment_id: "enrollment", expires_at: "2026-08-17T10:00:00Z" }],
          error: null,
        }
      },
    },
  )

  assert.deepEqual(calls, [
    {
      name: "activate_personal_plan_field_test",
      args: {
        p_campaign_id: "campaign",
        p_funnel_session_id: "session",
        p_lead_id: "lead",
        p_user_id: "user",
        p_activation_event_id: "event",
      },
    },
  ])
  assert.equal(result.enrollmentId, "enrollment")
})
