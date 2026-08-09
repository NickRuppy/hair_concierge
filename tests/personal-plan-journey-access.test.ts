import assert from "node:assert/strict"
import test from "node:test"

import { resolvePersonalPlanJourneyAccess } from "../src/lib/personal-plan/journey-access"

const eligible = {
  accessState: "active",
  isNewBuyerCohort: true,
  appEnabled: true,
  stage2Enabled: true,
  stage3Enabled: true,
  stage4Enabled: true,
  stage5Allowed: true,
  stage3AuthorityReady: true,
  preparedSourceReady: true,
  plan: {
    id: "plan-1",
    currentInitialNeedVersionId: "need-initial-1",
    currentRefinedNeedVersionId: "need-refined-1",
    productDraftCompleted: true,
    pendingRoutineProposalId: "proposal-1",
    activeRoutineVersionId: "routine-1",
  },
} as const

test("the server-derived frontier admits only contiguous persisted Personal Plan stages", () => {
  const access = resolvePersonalPlanJourneyAccess(eligible)

  assert.deepEqual(access, {
    kind: "personal_plan",
    personalPlanId: "plan-1",
    frontier: "stage5",
    nextHref: "/anwendung",
    allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: true },
  })
})

test("the frontier fails closed when a required fact or downstream release is absent", () => {
  const stage2Off = resolvePersonalPlanJourneyAccess({ ...eligible, stage2Enabled: false })
  assert.equal(stage2Off.kind, "personal_plan")
  if (stage2Off.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.deepEqual(stage2Off.allowed, {
    stage1: true,
    stage2: false,
    stage3: false,
    stage4: false,
    stage5: false,
  })

  const stage3Off = resolvePersonalPlanJourneyAccess({ ...eligible, stage3Enabled: false })
  assert.equal(stage3Off.kind, "personal_plan")
  if (stage3Off.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.deepEqual(stage3Off.allowed, {
    stage1: true,
    stage2: true,
    stage3: false,
    stage4: false,
    stage5: false,
  })

  const missingAuthority = resolvePersonalPlanJourneyAccess({
    ...eligible,
    stage3AuthorityReady: false,
    plan: { ...eligible.plan, activeRoutineVersionId: null, pendingRoutineProposalId: null },
  })
  assert.equal(missingAuthority.kind, "personal_plan")
  if (missingAuthority.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(missingAuthority.frontier, "stage2")
  assert.deepEqual(missingAuthority.allowed, {
    stage1: true,
    stage2: true,
    stage3: false,
    stage4: false,
    stage5: false,
  })

  const stage4Off = resolvePersonalPlanJourneyAccess({ ...eligible, stage4Enabled: false })
  assert.equal(stage4Off.kind, "personal_plan")
  if (stage4Off.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(stage4Off.frontier, "stage3")
  assert.equal(stage4Off.allowed.stage4, false)
  assert.equal(stage4Off.allowed.stage5, false)

  const unstaged = resolvePersonalPlanJourneyAccess({
    ...eligible,
    plan: { ...eligible.plan, pendingRoutineProposalId: null, activeRoutineVersionId: null },
  })
  assert.equal(unstaged.kind, "personal_plan")
  if (unstaged.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(unstaged.frontier, "stage3")
  assert.equal(unstaged.allowed.stage4, false)
})

test("a prepared source without an aggregate is an explicit Stage 1 admission, never an empty id", () => {
  assert.deepEqual(resolvePersonalPlanJourneyAccess({ ...eligible, plan: null }), {
    kind: "personal_plan_start",
    frontier: "stage1",
    nextHref: "/plan-start",
    allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
  })
})

test("legacy, provisioning, and globally disabled cohorts never receive a Personal Plan route", () => {
  assert.deepEqual(resolvePersonalPlanJourneyAccess({ ...eligible, isNewBuyerCohort: false }), {
    kind: "legacy",
  })
  assert.deepEqual(
    resolvePersonalPlanJourneyAccess({
      ...eligible,
      accessState: "paid_pending",
      preparedSourceReady: false,
      plan: null,
    }),
    { kind: "paid_pending", recoveryHref: "/plan-bereit" },
  )
  assert.deepEqual(resolvePersonalPlanJourneyAccess({ ...eligible, appEnabled: false }), {
    kind: "paid_pending",
    recoveryHref: "/profile",
  })
})

test("none and revoked access remain legacy, while accepted Routines survive later Stage 3 staleness only with all downstream gates", () => {
  assert.deepEqual(resolvePersonalPlanJourneyAccess({ ...eligible, accessState: "none" }), {
    kind: "legacy",
  })
  assert.deepEqual(resolvePersonalPlanJourneyAccess({ ...eligible, accessState: "revoked" }), {
    kind: "legacy",
  })

  const acceptedRoutine = resolvePersonalPlanJourneyAccess({
    ...eligible,
    stage3AuthorityReady: false,
    plan: { ...eligible.plan, pendingRoutineProposalId: null },
  })
  assert.equal(acceptedRoutine.kind, "personal_plan")
  if (acceptedRoutine.kind !== "personal_plan") throw new Error("expected Personal Plan access")
  assert.equal(acceptedRoutine.frontier, "stage5")
  assert.equal(acceptedRoutine.allowed.stage3, false)
  assert.equal(acceptedRoutine.allowed.stage4, true)
  assert.equal(acceptedRoutine.allowed.stage5, true)

  const stage3DisabledRoutine = resolvePersonalPlanJourneyAccess({
    ...eligible,
    stage3Enabled: false,
    stage3AuthorityReady: false,
    plan: { ...eligible.plan, pendingRoutineProposalId: null },
  })
  assert.equal(stage3DisabledRoutine.kind, "personal_plan")
  if (stage3DisabledRoutine.kind !== "personal_plan")
    throw new Error("expected Personal Plan access")
  assert.deepEqual(stage3DisabledRoutine.allowed, {
    stage1: true,
    stage2: true,
    stage3: false,
    stage4: false,
    stage5: false,
  })
})
