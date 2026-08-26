import { STAGE1_STAGE2_LAB_ENVELOPE } from "../src/app/labs/personal-plan-stage-1-2/fixture"
import { adaptInitialNeedSnapshotToPlanStartViewModel } from "../src/components/personal-plan-start/snapshot-adapter"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import type { Stage1ProductExamplePreviewResponse } from "../src/lib/personal-plan/product-preview-contract"
import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import { stage3DecisionKey } from "../src/lib/personal-plan/products/contracts"

/**
 * The Stage-1 preview payload the `/labs/personal-plan-start` harness must be
 * answered with. It is derived from the very fixture the lab page computes, so
 * its `sourceInputHash` matches the rendered plan — the flow discards a payload
 * whose hash disagrees, which would silently look like "previews unavailable".
 * Shared by every browser spec that drives the Idealplan accept path.
 */
export const PLAN_START_LAB_PATH = "/labs/personal-plan-start"
export const PLAN_START_LAB_PERSONAL_PLAN_ID = "20000000-0000-4000-8000-000000000001"

const computed = computeNeedPlan({
  rawEnvelope: STAGE1_STAGE2_LAB_ENVELOPE,
  artifactId: "10000000-0000-4000-8000-000000000001",
  projection: "initial_quiz",
  computationVersion: "stage1-v1",
  createdAt: "2026-08-08T12:00:00.000Z",
})
if (computed.status !== "ready") throw new Error("production browser fixture failed to compute")
const adapted = adaptInitialNeedSnapshotToPlanStartViewModel(computed.snapshot)
if (!adapted) throw new Error("production browser fixture failed to adapt")

export const planStartLabSnapshot = computed.snapshot
export const planStartLabPlan = adapted
export const planStartLabOptionalCategories = adapted.optional?.cards.map((card) => card.id) ?? []

export const planStartPreviewResponse = {
  schemaVersion: 2 as const,
  personalPlanId: PLAN_START_LAB_PERSONAL_PLAN_ID,
  sourceNeedVersionId: "10000000-0000-4000-8000-000000000002",
  sourceInputHash: computed.snapshot.inputHash,
  previews: computed.snapshot.renderedOrder.flatMap((category) => {
    const decision = computed.snapshot.decisions.find((item) => item.category === category)
    const role = decision?.roles.find((candidate) =>
      CATEGORY_ROLE_POLICIES[category].allowedRoles.includes(candidate as never),
    )
    if (!role) return []
    return [
      {
        kind: "recommendation" as const,
        category,
        role,
        decisionKey: stage3DecisionKey(category, role, null),
        productId: `fixture-${category}`,
        productName: `Fixture ${category}`,
        imageUrl: `http://127.0.0.1:3217/labs/product-images/${category}.svg`,
        verdict: "ideal" as const,
        authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
        factFingerprint: `fixture-fingerprint-${category}`,
        commerce: {
          priceEur: 12.9,
          purchaseLinkStatus: "available" as const,
          netContentValue: 250,
          netContentUnit: "ml" as const,
          priceLabel: "12,90 €",
          netContentLabel: "250 ml",
          availabilityLabel: "Aktuell verfügbar",
          productUrl: "https://example.com/fixture-product",
          affiliateDisclosure:
            "Affiliate-Hinweis: Bei einem Kauf über diesen Link erhalten wir möglicherweise eine Provision.",
        },
        reasoning: {
          productCriteria: `Fixture-Kriterien für ${category}.`,
          fit: `Fixture-Begründung für ${category}.`,
          frequency: "Fixture-Rhythmus.",
        },
      },
    ]
  }),
  directAcceptance: { available: true },
} satisfies Stage1ProductExamplePreviewResponse

/** The exact accept payload those previews must produce, role for role. */
export const planStartExpectedSeenRoles = planStartPreviewResponse.previews.map((preview) => ({
  decisionKey: preview.decisionKey,
  productId: preview.productId,
  factFingerprint: preview.factFingerprint,
}))
