import assert from "node:assert/strict"
import test from "node:test"

import {
  activateRegularQuizFieldTestEnrollment,
  createRegularQuizFieldTestGuest,
} from "../src/lib/personal-plan-field-test/activation"

test("regular quiz guest creation is synthetic and flow-scoped", async () => {
  const calls: Record<string, unknown>[] = []
  const guest = await createRegularQuizFieldTestGuest(
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
  const metadata = calls[0].app_metadata as Record<string, unknown>
  assert.equal(metadata.access_kind, "field_test")
  assert.equal(metadata.field_test_flow, "regular_quiz")
  assert.equal(metadata.field_test_campaign_id, "campaign")
})

test("regular quiz activation uses only its service RPC and exact correlation", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const result = await activateRegularQuizFieldTestEnrollment(
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
          data: [{ enrollment_id: "enrollment", expires_at: "2026-08-17T10:00:00Z", reused: true }],
          error: null,
        }
      },
    },
  )

  assert.deepEqual(calls, [
    {
      name: "activate_regular_quiz_field_test",
      args: {
        p_campaign_id: "campaign",
        p_funnel_session_id: "session",
        p_lead_id: "lead",
        p_user_id: "user",
        p_activation_event_id: "event",
      },
    },
  ])
  assert.deepEqual(result, {
    enrollmentId: "enrollment",
    expiresAt: "2026-08-17T10:00:00Z",
    reused: true,
  })
})
