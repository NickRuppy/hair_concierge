import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import {
  createPartnerActivateHandler,
  resolvePartnerActivationDestinationLead,
} from "../src/app/api/partner-access/activate/route"

const ids = {
  invitation: "10000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  funnel: "30000000-0000-4000-8000-000000000003",
  lead: "40000000-0000-4000-8000-000000000004",
  paidLead: "50000000-0000-4000-8000-000000000005",
}

function request(origin = "https://chaarlie.de") {
  return new NextRequest("https://chaarlie.de/api/partner-access/activate", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ leadId: ids.lead }),
  })
}

test("partner activation requires exact authorization and sends ready email only once", async () => {
  const calls: string[] = []
  const response = await createPartnerActivateHandler({
    getUserId: async () => ids.user,
    resolveFunnelSessionId: async () => ids.funnel,
    authorize: async () => ({
      invitationId: ids.invitation,
      userId: ids.user,
      funnelSessionId: ids.funnel,
      leadId: ids.lead,
    }),
    activate: async () => ({ grantId: "grant", reused: false }),
    resolveDestinationLeadId: async (_userId, partnerLeadId) => partnerLeadId,
    sendReadyEmail: async () => {
      calls.push("ready-email")
      return true
    },
  })(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { destination: `/plan-bereit?lead=${ids.lead}` })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(calls, ["ready-email"])

  const denied = await createPartnerActivateHandler({
    getUserId: async () => ids.user,
    resolveFunnelSessionId: async () => ids.funnel,
    authorize: async () => null,
  })(request())
  assert.equal(denied.status, 403)
})

test("partner activation sends an existing paid creator to their canonical plan lead", async () => {
  const response = await createPartnerActivateHandler({
    getUserId: async () => ids.user,
    resolveFunnelSessionId: async () => ids.funnel,
    authorize: async () => ({
      invitationId: ids.invitation,
      userId: ids.user,
      funnelSessionId: ids.funnel,
      leadId: ids.lead,
    }),
    activate: async () => ({ grantId: "grant", reused: false }),
    sendReadyEmail: async () => true,
    resolveDestinationLeadId: async (userId, partnerLeadId) => {
      assert.equal(userId, ids.user)
      assert.equal(partnerLeadId, ids.lead)
      return ids.paidLead
    },
  })(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    destination: `/plan-bereit?lead=${ids.paidLead}`,
  })
  assert.equal(
    resolvePartnerActivationDestinationLead(
      { accessState: "active", artifactLeadId: ids.paidLead },
      ids.lead,
    ),
    ids.paidLead,
  )
  assert.equal(
    resolvePartnerActivationDestinationLead(
      { accessState: "none", artifactLeadId: null },
      ids.lead,
    ),
    ids.lead,
  )
})

test("partner activation rejects cross-origin requests before authorization", async () => {
  let called = false
  const response = await createPartnerActivateHandler({
    authorize: async () => {
      called = true
      return null
    },
  })(request("https://example.test"))
  assert.equal(response.status, 403)
  assert.equal(called, false)
})
