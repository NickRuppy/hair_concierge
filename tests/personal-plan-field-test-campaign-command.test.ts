import assert from "node:assert/strict"
import test from "node:test"

import {
  canApplyFieldTestCampaign,
  parseFieldTestCampaignCommand,
} from "../scripts/personal-plan-field-test-campaign"

test("campaign command defaults to a non-writing create preview", () => {
  assert.deepEqual(parseFieldTestCampaignCommand(["create"]), {
    action: "create",
    apply: false,
    name: "Personal Plan Feldtest 2026-08",
  })
})

test("campaign writes require explicit apply, write gate, project confirmation, and matching URL", () => {
  const args = ["create", "--apply", "--confirm-project=pqdkhefxsxkyeqelqegq"]
  const environment = {
    ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE: "1",
    NEXT_PUBLIC_SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
  }
  assert.equal(canApplyFieldTestCampaign(args, environment), true)
  assert.equal(
    canApplyFieldTestCampaign(args, {
      ...environment,
      NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co",
    }),
    false,
  )
  assert.equal(
    canApplyFieldTestCampaign(args, {
      ...environment,
      ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE: undefined,
    }),
    false,
  )
})

test("inspect and revoke require an exact campaign id argument", () => {
  assert.deepEqual(parseFieldTestCampaignCommand(["inspect", "--campaign=campaign-id"]), {
    action: "inspect",
    campaignId: "campaign-id",
  })
  assert.deepEqual(parseFieldTestCampaignCommand(["revoke", "--campaign=campaign-id", "--apply"]), {
    action: "revoke",
    campaignId: "campaign-id",
    apply: true,
  })
  assert.throws(() => parseFieldTestCampaignCommand(["revoke"]), /requires --campaign/)
})
