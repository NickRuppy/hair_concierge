import assert from "node:assert/strict"
import test from "node:test"

import { computeNeedPlan } from "../../src/lib/personal-plan/compute-stage1"
import { handleStage1ProductExamplePreviews } from "../../src/app/api/personal-plan/stage-1/previews/route"
import { computeStage1ProductExamplePreviews } from "../../src/lib/personal-plan/product-previews"
import type { Stage1PersistenceDependencies } from "../../src/lib/personal-plan/persistence/stage1-service"
import { expectedShampooBucket } from "../../src/lib/personal-plan/products/authority/categories/shampoo"
import type {
  Stage3ConditionerFacts,
  Stage3ShampooFacts,
} from "../../src/lib/personal-plan/products/authority/contracts"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./fixtures"

function conditionerSnapshot() {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const decision = result.snapshot.decisions.find((item) => item.category === "conditioner")
  assert.ok(decision?.target?.category === "conditioner")
  return {
    ...result.snapshot,
    decisions: [decision],
    renderedOrder: ["conditioner" as const],
  }
}

test("uses the shared Conditioner authority and maps its selected product back to the image fact", async () => {
  const snapshot = conditionerSnapshot()
  const target = snapshot.decisions[0]!.target
  assert.ok(target?.category === "conditioner")
  let receivedTarget: unknown = null
  const candidate: Stage3ConditionerFacts = {
    productId: "conditioner-profile-fit",
    displayName: "Conditioner Profil Fit",
    category: "conditioner",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [
      {
        role: "conditioner_rinse_out",
        status: "verified_complete",
        fingerprint: "protocol-conditioner",
      },
    ],
    presentationImageUrl: "https://example.com/conditioner-profile-fit.webp",
    factFingerprint: "facts-conditioner",
    spec: {
      thickness: snapshot.profile.hair.thickness,
      proteinMoistureBalance: target.careDirection,
      weight: target.weight,
      repairSupportLevel: target.repairSupportLevel,
      balanceDirection: target.careDirection,
      targetFit: "matched",
    },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async (selection) => {
      receivedTarget = selection.conditionerTarget
      return [candidate]
    },
  })

  assert.deepEqual(receivedTarget, target)
  assert.deepEqual(response.previews, [
    {
      category: "conditioner",
      role: "conditioner_rinse_out",
      productId: "conditioner-profile-fit",
      productName: "Conditioner Profil Fit",
      imageUrl: "https://example.com/conditioner-profile-fit.webp",
      verdict: "ideal",
      authorityVersion: "personal-plan.conditioner.v3",
    },
  ])
})

test("fails closed when the shared authority product has no presentation image", async () => {
  const snapshot = conditionerSnapshot()
  const target = snapshot.decisions[0]!.target
  assert.ok(target?.category === "conditioner")
  const candidate: Stage3ConditionerFacts = {
    productId: "conditioner-no-image",
    displayName: "Conditioner ohne Bild",
    category: "conditioner",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [
      {
        role: "conditioner_rinse_out",
        status: "verified_complete",
        fingerprint: "protocol-conditioner",
      },
    ],
    presentationImageUrl: null,
    factFingerprint: "facts-conditioner",
    spec: {
      thickness: snapshot.profile.hair.thickness,
      proteinMoistureBalance: target.careDirection,
      weight: target.weight,
      repairSupportLevel: target.repairSupportLevel,
      balanceDirection: target.careDirection,
      targetFit: "matched",
    },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot,
    loadCandidates: async () => [candidate],
  })

  assert.deepEqual(response.previews, [])
})

test("keeps a matching Shampoo preview when another category candidate load fails", async () => {
  const result = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-08-14T10:00:00.000Z",
  })
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected ready snapshot")
  const shampooDecision = result.snapshot.decisions.find((item) => item.category === "shampoo")
  const conditionerDecision = result.snapshot.decisions.find(
    (item) => item.category === "conditioner",
  )
  assert.ok(shampooDecision?.target?.category === "shampoo")
  assert.ok(conditionerDecision?.target?.category === "conditioner")
  const role = shampooDecision.roles[0]
  assert.ok(role === "shampoo_everyday" || role === "shampoo_dandruff")
  const bucket = expectedShampooBucket({ role, target: shampooDecision.target })
  assert.ok(bucket)
  const candidate: Stage3ShampooFacts = {
    productId: "shampoo-profile-fit",
    displayName: "Shampoo Profil Fit",
    category: "shampoo",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: [result.snapshot.profile.hair.thickness],
    knownReaction: false,
    protocols: [{ role, status: "verified_complete", fingerprint: "protocol-shampoo" }],
    presentationImageUrl: "https://example.com/shampoo-profile-fit.webp",
    factFingerprint: "facts-shampoo",
    spec: {
      thickness: result.snapshot.profile.hair.thickness,
      shampooBucket: bucket,
      scalpRoute: shampooDecision.target.scalpRoute,
      cleansingIntensity: "balanced",
      targetFit: "matched",
    },
  }

  const response = await computeStage1ProductExamplePreviews({
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    snapshot: {
      ...result.snapshot,
      decisions: [conditionerDecision, shampooDecision],
      renderedOrder: ["conditioner", "shampoo"],
    },
    loadCandidates: async (selection) => {
      if (selection.category === "conditioner") throw new Error("conditioner unavailable")
      return [candidate]
    },
  })

  assert.deepEqual(
    response.previews.map((preview) => [preview.category, preview.productId]),
    [["shampoo", "shampoo-profile-fit"]],
  )
})

function persistence(): Stage1PersistenceDependencies {
  return {
    isEnabled: () => true,
    cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
    findEntitlement: async () => ({
      accessState: "active",
      enrollmentSourceId: "purchase-1",
      qualifiedAt: "2026-08-08T01:00:00.000Z",
      artifactLeadId: "lead-1",
    }),
    loadArtifact: async () => ({ id: "artifact-1", quizAnswers: COMPLETE_V3_PLAN_ENVELOPE }),
    createOrReuseInitialNeed: async (request) => ({
      outcome: "completed",
      personalPlanId: "plan-1",
      needVersionId: "need-1",
      outputSnapshot: request.outputSnapshot,
    }),
    now: () => new Date("2026-08-14T10:00:00.000Z"),
  }
}

test("preview route enforces authentication before reading plan or catalog data", async () => {
  let candidateLoads = 0
  const result = await handleStage1ProductExamplePreviews({
    getAuthenticatedUser: async () => null,
    loadJourneyAccess: async () => ({ kind: "legacy" }),
    persistence: persistence(),
    loadCandidates: async () => {
      candidateLoads += 1
      return []
    },
  })

  assert.deepEqual(result, { status: 401, body: { error: "unauthorized" } })
  assert.equal(candidateLoads, 0)
})

test("preview route returns source-bound presentation data without mutating Stage 1", async () => {
  const result = await handleStage1ProductExamplePreviews({
    getAuthenticatedUser: async () => ({ id: "user-1" }),
    loadJourneyAccess: async () => ({
      kind: "personal_plan_start",
      frontier: "stage1",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: true, stage3: false, stage4: false, stage5: false },
    }),
    persistence: persistence(),
    loadCandidates: async (selection) => {
      if (selection.category !== "conditioner" || !selection.conditionerTarget) return []
      const target = selection.conditionerTarget
      return [
        {
          productId: "conditioner-route-fit",
          displayName: "Conditioner Route Fit",
          category: "conditioner",
          isActive: true,
          lifecycleStatus: "active",
          recommendable: true,
          suitableThicknesses: [selection.hairThickness],
          knownReaction: false,
          protocols: [
            {
              role: "conditioner_rinse_out",
              status: "verified_complete",
              fingerprint: "protocol-conditioner",
            },
          ],
          presentationImageUrl: "https://example.com/conditioner-route-fit.webp",
          factFingerprint: "facts-conditioner",
          spec: {
            thickness: selection.hairThickness,
            proteinMoistureBalance: target.careDirection,
            weight: target.weight,
            repairSupportLevel: target.repairSupportLevel,
            balanceDirection: target.careDirection,
            targetFit: "matched",
          },
        },
      ]
    },
  })

  assert.equal(result.status, 200)
  assert.equal("personalPlanId" in result.body ? result.body.personalPlanId : null, "plan-1")
  assert.deepEqual(
    "previews" in result.body
      ? result.body.previews.map((preview) => [preview.category, preview.productId])
      : [],
    [["conditioner", "conditioner-route-fit"]],
  )
})
