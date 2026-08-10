import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_TEST_OWNER,
  canApplyPersonalPlanTestOwnerWrite,
  classifyPersonalPlanTestOwner,
  isAllowedPersonalPlanTestOwnerBaseUrl,
  parsePersonalPlanTestOwnerCommand,
} from "../scripts/personal-plan/test-owner-policy.mjs"
import {
  assertPersonalPlanTestOwnerStage1Frontier,
  resolvePersonalPlanTestOwnerProjectContext,
} from "../scripts/personal-plan/test-owner.mjs"

type SnapshotRow = Record<string, unknown>

type OwnerSnapshotFixture = {
  user: {
    id: string
    email: string
    app_metadata: Record<string, unknown>
  }
  profiles: SnapshotRow[]
  campaigns: SnapshotRow[]
  leads: SnapshotRow[]
  funnelSessions: SnapshotRow[]
  consents: SnapshotRow[]
  purchases: SnapshotRow[]
  artifacts: SnapshotRow[]
  fieldTestEnrollments: SnapshotRow[]
  manualAccessGrants: SnapshotRow[]
  plans: SnapshotRow[]
  userProducts: SnapshotRow[]
  customerIoOutbox: SnapshotRow[]
}

function readySnapshot(): OwnerSnapshotFixture {
  const ids = PERSONAL_PLAN_TEST_OWNER.ids
  const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  return {
    user: {
      id: userId,
      email: PERSONAL_PLAN_TEST_OWNER.email,
      app_metadata: { personal_plan_test_owner: true },
    },
    profiles: [{ id: userId, email: PERSONAL_PLAN_TEST_OWNER.email, is_admin: false }],
    campaigns: [
      {
        id: ids.campaign,
        status: "revoked",
        revoked_at: PERSONAL_PLAN_TEST_OWNER.sourceTimestamp,
      },
    ],
    leads: [
      {
        id: ids.lead,
        user_id: userId,
        email: PERSONAL_PLAN_TEST_OWNER.email,
        quiz_kind: "personal_plan",
      },
    ],
    funnelSessions: [
      {
        id: ids.funnelSession,
        user_id: userId,
        lead_id: ids.lead,
        package_key: "meta_personal_plan_v1",
        channel: "test",
        is_internal_test: true,
        test_kind: "field_test",
        field_test_campaign_id: ids.campaign,
      },
    ],
    consents: [
      {
        id: ids.consent,
        user_id: userId,
        lead_id: ids.lead,
        funnel_session_id: ids.funnelSession,
        product_kind: "personal_plan_once",
        confirmation_status: "delivered",
      },
    ],
    purchases: [
      {
        id: ids.purchase,
        user_id: userId,
        consent_id: ids.consent,
        provider: "stripe",
        provider_transaction_id: PERSONAL_PLAN_TEST_OWNER.providerTransactionId,
        product_kind: "personal_plan_once",
        status: "paid",
        metadata: { is_internal_test: true, personal_plan_test_owner: true },
      },
    ],
    artifacts: [
      {
        id: ids.artifact,
        user_id: userId,
        lead_id: ids.lead,
        claim_token_hash: PERSONAL_PLAN_TEST_OWNER.claimTokenHash,
        status: "attached",
      },
    ],
    fieldTestEnrollments: [
      {
        id: ids.enrollment,
        campaign_id: ids.campaign,
        funnel_session_id: ids.funnelSession,
        lead_id: ids.lead,
        user_id: userId,
        manual_access_grant_id: ids.manualAccessGrant,
        prepared_artifact_id: ids.artifact,
        status: "active",
        expires_at: "2099-01-01T00:00:00.000Z",
        revoked_at: null,
      },
    ],
    manualAccessGrants: [
      {
        id: ids.manualAccessGrant,
        user_id: userId,
        reason: "tester",
        expires_at: "2099-01-01T00:00:00.000Z",
        revoked_at: null,
      },
    ],
    plans: [],
    userProducts: [],
    customerIoOutbox: [],
  }
}

test("command parsing defaults to read-only inspect and rejects unknown actions", () => {
  assert.deepEqual(parsePersonalPlanTestOwnerCommand([]), { action: "inspect", apply: false })
  assert.deepEqual(parsePersonalPlanTestOwnerCommand(["reset", "--apply"]), {
    action: "reset",
    apply: true,
  })
  assert.throws(() => parsePersonalPlanTestOwnerCommand(["impersonate"]), /Usage:/)
})

test("production writes require apply, exact project confirmation, and the environment gate", () => {
  const args = ["prepare", "--apply", `--confirm-project=${PERSONAL_PLAN_TEST_OWNER.projectId}`]
  assert.equal(
    canApplyPersonalPlanTestOwnerWrite({
      args,
      environment: { ALLOW_PERSONAL_PLAN_TEST_OWNER_PRODUCTION_WRITE: "1" },
      projectId: PERSONAL_PLAN_TEST_OWNER.projectId,
      isLocal: false,
    }),
    true,
  )
  assert.equal(
    canApplyPersonalPlanTestOwnerWrite({
      args: args.filter((argument) => !argument.startsWith("--confirm-project=")),
      environment: { ALLOW_PERSONAL_PLAN_TEST_OWNER_PRODUCTION_WRITE: "1" },
      projectId: PERSONAL_PLAN_TEST_OWNER.projectId,
      isLocal: false,
    }),
    false,
  )
  assert.equal(
    canApplyPersonalPlanTestOwnerWrite({
      args,
      environment: {},
      projectId: PERSONAL_PLAN_TEST_OWNER.projectId,
      isLocal: false,
    }),
    false,
  )
  assert.equal(
    canApplyPersonalPlanTestOwnerWrite({
      args: ["prepare", "--apply"],
      environment: {},
      projectId: "local",
      isLocal: true,
    }),
    true,
  )
})

test("one-time auth links can only be consumed by the canonical production or local origin", () => {
  assert.equal(
    isAllowedPersonalPlanTestOwnerBaseUrl("https://chaarlie.de", { isLocal: false }),
    true,
  )
  assert.equal(
    isAllowedPersonalPlanTestOwnerBaseUrl("https://chaarlie.de/path", { isLocal: false }),
    false,
  )
  assert.equal(
    isAllowedPersonalPlanTestOwnerBaseUrl("https://hostile.example", { isLocal: false }),
    false,
  )
  assert.equal(
    isAllowedPersonalPlanTestOwnerBaseUrl("http://127.0.0.1:3226", { isLocal: true }),
    true,
  )
  assert.equal(
    isAllowedPersonalPlanTestOwnerBaseUrl("http://hostile.example", { isLocal: true }),
    false,
  )
})

test("the admin client accepts only the exact canonical production Supabase host", () => {
  assert.deepEqual(
    resolvePersonalPlanTestOwnerProjectContext(
      `https://${PERSONAL_PLAN_TEST_OWNER.projectId}.supabase.co`,
    ),
    { isLocal: false, projectId: PERSONAL_PLAN_TEST_OWNER.projectId },
  )
  assert.throws(
    () =>
      resolvePersonalPlanTestOwnerProjectContext(
        `https://${PERSONAL_PLAN_TEST_OWNER.projectId}.attacker.example`,
      ),
    /test_owner_supabase_url_not_allowed/,
  )
  assert.throws(
    () =>
      resolvePersonalPlanTestOwnerProjectContext(
        `https://${PERSONAL_PLAN_TEST_OWNER.projectId}.supabase.co.attacker.example`,
      ),
    /test_owner_supabase_url_not_allowed/,
  )
})

test("auth-state requires the rendered Stage 1 frontier before it can persist browser state", async () => {
  const calls: unknown[] = []
  const readyPage = {
    getByRole(role: string, options: unknown) {
      calls.push({ role, options })
      return {
        async waitFor(waitOptions: unknown) {
          calls.push(waitOptions)
        },
      }
    },
  }
  await assertPersonalPlanTestOwnerStage1Frontier(readyPage)
  assert.deepEqual(calls, [
    { role: "heading", options: { name: "Deine Basis", exact: true } },
    { state: "visible", timeout: 30_000 },
  ])

  const unavailablePage = {
    getByRole() {
      return {
        async waitFor() {
          throw new Error("frontier unavailable")
        },
      }
    },
  }
  await assert.rejects(
    assertPersonalPlanTestOwnerStage1Frontier(unavailablePage),
    /frontier unavailable/,
  )
})

test("a complete synthetic source is ready and a persisted plan is progressed", () => {
  const snapshot = readySnapshot()
  assert.deepEqual(classifyPersonalPlanTestOwner(snapshot), {
    status: "ready",
    safe: true,
    canPrepare: true,
    canReset: true,
    canAuthenticate: true,
    frontier: "stage1",
    issues: [],
  })

  snapshot.plans.push({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", user_id: snapshot.user.id })
  assert.equal(classifyPersonalPlanTestOwner(snapshot).status, "progressed")
  assert.equal(classifyPersonalPlanTestOwner(snapshot).frontier, "in_progress")
})

test("a wholly missing owner is preparable but cannot reset or authenticate", () => {
  const empty = Object.fromEntries(
    [
      "profiles",
      "campaigns",
      "leads",
      "funnelSessions",
      "consents",
      "purchases",
      "artifacts",
      "fieldTestEnrollments",
      "manualAccessGrants",
      "plans",
      "userProducts",
      "customerIoOutbox",
    ].map((key) => [key, []]),
  )
  const classification = classifyPersonalPlanTestOwner({ user: null, ...empty })
  assert.equal(classification.status, "missing")
  assert.equal(classification.safe, true)
  assert.equal(classification.canPrepare, true)
  assert.equal(classification.canReset, false)
  assert.equal(classification.canAuthenticate, false)
})

test("mixed or ambiguous identity state always fails closed", () => {
  const mutations: Array<(snapshot: ReturnType<typeof readySnapshot>) => void> = [
    (snapshot) => delete snapshot.user.app_metadata.personal_plan_test_owner,
    (snapshot) => {
      snapshot.user.email = "customer@example.com"
    },
    (snapshot) => {
      snapshot.profiles[0]["is_admin"] = true
    },
    (snapshot) => snapshot.leads.push({ ...snapshot.leads[0], id: crypto.randomUUID() }),
    (snapshot) => {
      snapshot.funnelSessions[0]["is_internal_test"] = false
    },
    (snapshot) => {
      snapshot.funnelSessions[0]["test_kind"] = null
    },
    (snapshot) => {
      snapshot.purchases[0]["provider_transaction_id"] = "real-provider-reference"
    },
    (snapshot) => snapshot.artifacts.push({ ...snapshot.artifacts[0], id: crypto.randomUUID() }),
    (snapshot) => snapshot.fieldTestEnrollments.push({ id: crypto.randomUUID() }),
    (snapshot) => snapshot.manualAccessGrants.push({ id: crypto.randomUUID() }),
    (snapshot) => snapshot.customerIoOutbox.push({ id: crypto.randomUUID() }),
  ]

  for (const mutate of mutations) {
    const snapshot = readySnapshot()
    mutate(snapshot)
    const classification = classifyPersonalPlanTestOwner(snapshot)
    assert.equal(classification.status, "unsafe")
    assert.equal(classification.safe, false)
    assert.equal(classification.canPrepare, false)
    assert.equal(classification.canReset, false)
    assert.equal(classification.canAuthenticate, false)
    assert.ok(classification.issues.length > 0)
  }
})

test("classification output contains no auth or service secrets", () => {
  const snapshot = readySnapshot() as ReturnType<typeof readySnapshot> & {
    access_token?: string
    refresh_token?: string
    password?: string
    service_role_key?: string
  }
  snapshot.access_token = "access-secret"
  snapshot.refresh_token = "refresh-secret"
  snapshot.password = "password-secret"
  snapshot.service_role_key = "service-secret"
  const serialized = JSON.stringify(classifyPersonalPlanTestOwner(snapshot))
  for (const secret of ["access-secret", "refresh-secret", "password-secret", "service-secret"]) {
    assert.equal(serialized.includes(secret), false)
  }
})
