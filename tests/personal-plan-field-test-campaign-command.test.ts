import assert from "node:assert/strict"
import test from "node:test"

import {
  canApplyFieldTestCampaign,
  parseFieldTestCampaignCommand,
  runFieldTestCampaignCommand,
} from "../scripts/personal-plan-field-test-campaign"

test("campaign command defaults to a non-writing create preview", () => {
  assert.deepEqual(parseFieldTestCampaignCommand(["create"]), {
    action: "create",
    apply: false,
    name: "Personal Plan Feldtest 2026-08",
    flow: "personal-plan",
  })
})

test("campaign command supports an explicit regular-quiz flow while preserving Personal Plan defaults", () => {
  assert.deepEqual(parseFieldTestCampaignCommand(["create", "--flow=regular-quiz"]), {
    action: "create",
    apply: false,
    name: "Regulärer Quiz Feldtest 2026-08",
    flow: "regular-quiz",
  })
  assert.deepEqual(
    parseFieldTestCampaignCommand(["inspect", "--campaign=campaign-id", "--flow=regular-quiz"]),
    {
      action: "inspect",
      campaignId: "campaign-id",
      flow: "regular-quiz",
    },
  )
  assert.throws(() => parseFieldTestCampaignCommand(["create", "--flow=unknown"]), /--flow/)
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
    flow: "personal-plan",
  })
  assert.deepEqual(parseFieldTestCampaignCommand(["revoke", "--campaign=campaign-id", "--apply"]), {
    action: "revoke",
    campaignId: "campaign-id",
    apply: true,
    flow: "personal-plan",
  })
  assert.throws(() => parseFieldTestCampaignCommand(["revoke"]), /requires --campaign/)
})

test("regular-quiz creation writes its flow kind and emits only the regular quiz link", async () => {
  const inserted: Record<string, unknown>[] = []
  const logs: unknown[] = []
  const admin = {
    from() {
      return {
        insert(row: Record<string, unknown>) {
          inserted.push(row)
          return {
            select() {
              return {
                single: async () => ({ data: { id: "campaign-id", ...row }, error: null }),
              }
            },
          }
        },
      }
    },
  }
  await runFieldTestCampaignCommand({
    args: ["create", "--flow=regular-quiz", "--apply", "--confirm-project=pqdkhefxsxkyeqelqegq"],
    environment: {
      ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
    },
    admin: admin as never,
    log: (value) => logs.push(value),
  })
  assert.equal(inserted[0].flow_kind, "regular_quiz")
  assert.match((logs[0] as { link: string }).link, /^https:\/\/chaarlie\.de\/test\/quiz\//)
})

test("regular-quiz revocation refuses a campaign from the Personal Plan flow", async () => {
  let revokeCalls = 0
  const filters: Array<[string, string]> = []
  const query = {
    select() {
      return query
    },
    eq(column: string, expected: string) {
      filters.push([column, expected])
      return query
    },
    maybeSingle: async () => ({ data: null, error: null }),
  }
  const admin = {
    from: () => query,
    rpc: async () => {
      revokeCalls += 1
      return { data: true, error: null }
    },
  }

  await assert.rejects(
    runFieldTestCampaignCommand({
      args: [
        "revoke",
        "--campaign=11111111-1111-4111-8111-111111111111",
        "--flow=regular-quiz",
        "--apply",
        "--confirm-project=pqdkhefxsxkyeqelqegq",
      ],
      environment: {
        ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE: "1",
        NEXT_PUBLIC_SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
      },
      admin: admin as never,
    }),
    /regular-quiz campaign not found/,
  )
  assert.deepEqual(filters, [
    ["id", "11111111-1111-4111-8111-111111111111"],
    ["flow_kind", "regular_quiz"],
  ])
  assert.equal(revokeCalls, 0)
})
