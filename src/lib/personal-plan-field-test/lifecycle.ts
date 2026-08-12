import { PERSONAL_PLAN_FIELD_TEST_KIND } from "./constants"
import { personalPlanFieldTestUnavailable, type PersonalPlanFieldTestUnavailable } from "./errors"
import type { TrustedPersonalPlanFieldTestContext } from "./campaign-cookie"

export type PersonalPlanFieldTestCampaignLifecycle = {
  id: string
  status: "active" | "revoked"
  startsAt: number
  expiresAt: number
  maxActivations: number
  successfulActivations: number
  accessDurationHours: number
  flowKind?: "personal_plan" | "regular_quiz"
}

export type PersonalPlanFieldTestCampaignEvaluation =
  | { kind: "eligible"; context: TrustedPersonalPlanFieldTestContext }
  | PersonalPlanFieldTestUnavailable

export function evaluatePersonalPlanFieldTestCampaign(
  campaign: PersonalPlanFieldTestCampaignLifecycle,
  now = Date.now(),
): PersonalPlanFieldTestCampaignEvaluation {
  if (
    !isCampaignShapeValid(campaign) ||
    campaign.status !== "active" ||
    now < campaign.startsAt ||
    now >= campaign.expiresAt ||
    campaign.successfulActivations >= campaign.maxActivations
  ) {
    return personalPlanFieldTestUnavailable()
  }

  return {
    kind: "eligible",
    context: {
      campaignId: campaign.id,
      accessDurationHours: campaign.accessDurationHours,
      testKind: PERSONAL_PLAN_FIELD_TEST_KIND,
    },
  }
}

function isCampaignShapeValid(campaign: PersonalPlanFieldTestCampaignLifecycle) {
  return (
    typeof campaign.id === "string" &&
    campaign.id.length > 0 &&
    Number.isFinite(campaign.startsAt) &&
    Number.isFinite(campaign.expiresAt) &&
    campaign.expiresAt > campaign.startsAt &&
    Number.isInteger(campaign.maxActivations) &&
    campaign.maxActivations > 0 &&
    Number.isInteger(campaign.successfulActivations) &&
    campaign.successfulActivations >= 0 &&
    Number.isInteger(campaign.accessDurationHours) &&
    campaign.accessDurationHours > 0
  )
}
