import assert from "node:assert/strict"
import test from "node:test"

import type { PersonalPlanRoutingFrontier } from "../src/lib/personal-plan/frontier-routing"
import {
  resolvePersonalPlanInvite,
  type PersonalPlanInviteDependencies,
} from "../src/lib/personal-plan/plan-invite"
import type { FreemiumAccessResult } from "../src/lib/entitlements/access"

const recovery: PersonalPlanRoutingFrontier = { kind: "recovery", nextHref: "/plan-bereit" }

function deps(input: {
  user?: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null
  frontier?: PersonalPlanRoutingFrontier | Error
  access?: FreemiumAccessResult | Error
  accessCalls?: Array<{ fieldTestGuest: boolean }>
}): PersonalPlanInviteDependencies {
  return {
    getUser: async () =>
      input.user === undefined ? { id: "user-1", email: "a@b.de" } : input.user,
    loadFrontier: async () => {
      if (input.frontier instanceof Error) throw input.frontier
      return input.frontier ?? recovery
    },
    resolvePaidAccess: async (_userId, _email, fieldTestGuest) => {
      input.accessCalls?.push({ fieldTestGuest })
      if (input.access instanceof Error) throw input.access
      return input.access ?? "allowed"
    },
  }
}

test("a paid member the frontier sends to /plan-bereit sees the invite", async () => {
  assert.equal(await resolvePersonalPlanInvite(deps({})), true)
})

test("members with a plan, legacy members and signed-out visitors see no invite", async () => {
  const accessCalls: Array<{ fieldTestGuest: boolean }> = []
  assert.equal(
    await resolvePersonalPlanInvite(
      deps({
        frontier: { kind: "personal_plan", frontier: "stage1", nextHref: "/plan-start" },
        accessCalls,
      }),
    ),
    false,
  )
  assert.equal(
    await resolvePersonalPlanInvite(deps({ frontier: { kind: "legacy" }, accessCalls })),
    false,
  )
  assert.equal(await resolvePersonalPlanInvite(deps({ user: null, accessCalls })), false)
  // The paid-access composite only runs for the recovery cohort.
  assert.deepEqual(accessCalls, [])
})

test("the invite requires positively allowed paid access", async () => {
  assert.equal(await resolvePersonalPlanInvite(deps({ access: "denied" })), false)
  assert.equal(await resolvePersonalPlanInvite(deps({ access: "unavailable" })), false)
})

test("read failures hide the invite instead of failing the page", async () => {
  assert.equal(await resolvePersonalPlanInvite(deps({ frontier: new Error("rpc down") })), false)
  assert.equal(await resolvePersonalPlanInvite(deps({ access: new Error("billing down") })), false)
})

test("an active field-test tester without a plan is invited like any admitted member", async () => {
  const accessCalls: Array<{ fieldTestGuest: boolean }> = []
  const invited = await resolvePersonalPlanInvite(
    deps({
      user: { id: "user-1", app_metadata: { access_kind: "field_test" } },
      accessCalls,
    }),
  )
  // Same cohort the frontier already routes to /plan-bereit; the tester flag only
  // changes how the access composite reads their grant.
  assert.equal(invited, true)
  assert.deepEqual(accessCalls, [{ fieldTestGuest: true }])
})
