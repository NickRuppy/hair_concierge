export const PERSONAL_PLAN_TEST_OWNER = Object.freeze({
  email: "personal-plan-qa@hairconscierge.test",
  projectId: "pqdkhefxsxkyeqelqegq",
  productionOrigin: "https://chaarlie.de",
  sourceTimestamp: "2026-08-10T12:00:00.000Z",
  providerTransactionId: "personal-plan-qa-owner-v1",
  answerHash: "a".repeat(64),
  claimTokenHash: "b".repeat(64),
  campaignTokenHash: "c".repeat(64),
  ids: Object.freeze({
    campaign: "b2a10000-0000-4000-8000-000000000001",
    lead: "b2a10000-0000-4000-8000-000000000002",
    funnelSession: "b2a10000-0000-4000-8000-000000000003",
    consent: "b2a10000-0000-4000-8000-000000000004",
    purchase: "b2a10000-0000-4000-8000-000000000005",
    artifact: "b2a10000-0000-4000-8000-000000000006",
    visitor: "b2a10000-0000-4000-8000-000000000007",
    manualAccessGrant: "b2a10000-0000-4000-8000-000000000008",
    enrollment: "b2a10000-0000-4000-8000-000000000009",
  }),
})

const ACTIONS = new Set(["inspect", "prepare", "reset", "auth-state"])

export function parsePersonalPlanTestOwnerCommand(args) {
  const action = args[0] ?? "inspect"
  if (!ACTIONS.has(action)) {
    throw new Error("Usage: inspect|prepare|reset|auth-state [--apply] [--confirm-project=<id>]")
  }
  return { action, apply: args.includes("--apply") }
}

export function canApplyPersonalPlanTestOwnerWrite({ args, environment, projectId, isLocal }) {
  if (!args.includes("--apply")) return false
  if (isLocal) return true
  return (
    projectId === PERSONAL_PLAN_TEST_OWNER.projectId &&
    args.includes(`--confirm-project=${PERSONAL_PLAN_TEST_OWNER.projectId}`) &&
    environment.ALLOW_PERSONAL_PLAN_TEST_OWNER_PRODUCTION_WRITE?.trim() === "1"
  )
}

export function isAllowedPersonalPlanTestOwnerBaseUrl(rawUrl, { isLocal }) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  if (url.origin !== rawUrl.replace(/\/$/, "")) return false
  if (!isLocal) return url.origin === PERSONAL_PLAN_TEST_OWNER.productionOrigin
  return (
    (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
    (url.protocol === "http:" || url.protocol === "https:")
  )
}

function rows(snapshot, key) {
  return Array.isArray(snapshot[key]) ? snapshot[key] : []
}

function exactSingleOrMissing(snapshot, key, predicate, issues) {
  const values = rows(snapshot, key)
  if (values.length > 1) {
    issues.push(`${key}_ambiguous`)
    return false
  }
  if (values.length === 1 && !predicate(values[0])) {
    issues.push(`${key}_mismatch`)
    return false
  }
  return values.length === 1
}

function isExactUser(user) {
  return (
    user &&
    typeof user.id === "string" &&
    user.email?.trim().toLowerCase() === PERSONAL_PLAN_TEST_OWNER.email &&
    user.app_metadata?.personal_plan_test_owner === true
  )
}

function sameTimestamp(left, right) {
  return (
    typeof left === "string" &&
    typeof right === "string" &&
    Number.isFinite(Date.parse(left)) &&
    Date.parse(left) === Date.parse(right)
  )
}

export function classifyPersonalPlanTestOwner(snapshot) {
  const issues = []
  const allRowKeys = [
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
  ]

  if (!snapshot.user) {
    if (allRowKeys.some((key) => rows(snapshot, key).length > 0)) {
      return unsafe(["owner_missing_with_persisted_state"])
    }
    return {
      status: "missing",
      safe: true,
      canPrepare: true,
      canReset: false,
      canAuthenticate: false,
      frontier: null,
      issues: [],
    }
  }

  if (!isExactUser(snapshot.user)) return unsafe(["auth_owner_mismatch"])
  const userId = snapshot.user.id
  const ids = PERSONAL_PLAN_TEST_OWNER.ids

  const sourcePresence = [
    exactSingleOrMissing(
      snapshot,
      "profiles",
      (row) =>
        row.id === userId &&
        row.email?.trim().toLowerCase() === PERSONAL_PLAN_TEST_OWNER.email &&
        row.is_admin === false,
      issues,
    ),
    exactSingleOrMissing(
      snapshot,
      "campaigns",
      (row) =>
        row.id === ids.campaign &&
        row.status === "revoked" &&
        sameTimestamp(row.revoked_at, PERSONAL_PLAN_TEST_OWNER.sourceTimestamp),
      issues,
    ),
    exactSingleOrMissing(
      snapshot,
      "leads",
      (row) =>
        row.id === ids.lead &&
        row.user_id === userId &&
        row.email?.trim().toLowerCase() === PERSONAL_PLAN_TEST_OWNER.email &&
        row.quiz_kind === "personal_plan",
      issues,
    ),
    exactSingleOrMissing(
      snapshot,
      "funnelSessions",
      (row) =>
        row.id === ids.funnelSession &&
        row.user_id === userId &&
        row.lead_id === ids.lead &&
        row.package_key === "meta_personal_plan_v1" &&
        row.channel === "test" &&
        row.is_internal_test === true &&
        row.test_kind === "field_test" &&
        row.field_test_campaign_id === ids.campaign,
      issues,
    ),
    exactSingleOrMissing(
      snapshot,
      "consents",
      (row) =>
        row.id === ids.consent &&
        row.user_id === userId &&
        row.lead_id === ids.lead &&
        row.funnel_session_id === ids.funnelSession &&
        row.product_kind === "personal_plan_once" &&
        row.confirmation_status === "delivered",
      issues,
    ),
    exactSingleOrMissing(
      snapshot,
      "purchases",
      (row) =>
        row.id === ids.purchase &&
        row.user_id === userId &&
        row.consent_id === ids.consent &&
        row.provider === "stripe" &&
        row.provider_transaction_id === PERSONAL_PLAN_TEST_OWNER.providerTransactionId &&
        row.product_kind === "personal_plan_once" &&
        row.status === "paid" &&
        row.metadata?.is_internal_test === true &&
        row.metadata?.personal_plan_test_owner === true,
      issues,
    ),
    exactSingleOrMissing(
      snapshot,
      "artifacts",
      (row) =>
        row.id === ids.artifact &&
        row.user_id === userId &&
        row.lead_id === ids.lead &&
        row.claim_token_hash === PERSONAL_PLAN_TEST_OWNER.claimTokenHash &&
        row.status === "attached",
      issues,
    ),
    exactSingleOrMissing(
      snapshot,
      "manualAccessGrants",
      (row) =>
        row.id === ids.manualAccessGrant &&
        row.user_id === userId &&
        row.reason === "tester" &&
        row.revoked_at === null &&
        sameTimestamp(row.expires_at, "2099-01-01T00:00:00.000Z"),
      issues,
    ),
    exactSingleOrMissing(
      snapshot,
      "fieldTestEnrollments",
      (row) =>
        row.id === ids.enrollment &&
        row.campaign_id === ids.campaign &&
        row.funnel_session_id === ids.funnelSession &&
        row.lead_id === ids.lead &&
        row.user_id === userId &&
        row.manual_access_grant_id === ids.manualAccessGrant &&
        row.prepared_artifact_id === ids.artifact &&
        row.status === "active" &&
        row.revoked_at === null &&
        sameTimestamp(row.expires_at, "2099-01-01T00:00:00.000Z"),
      issues,
    ),
  ]

  for (const key of ["customerIoOutbox"]) {
    if (rows(snapshot, key).length > 0) issues.push(`${key}_unexpected`)
  }
  if (rows(snapshot, "plans").length > 1) issues.push("plans_ambiguous")

  if (issues.length > 0) return unsafe(issues)
  const complete = sourcePresence.every(Boolean)
  if (!complete) {
    return {
      status: "partial",
      safe: true,
      canPrepare: true,
      canReset: false,
      canAuthenticate: false,
      frontier: null,
      issues: [],
    }
  }

  const progressed = rows(snapshot, "plans").length > 0 || rows(snapshot, "userProducts").length > 0
  return {
    status: progressed ? "progressed" : "ready",
    safe: true,
    canPrepare: true,
    canReset: true,
    canAuthenticate: true,
    frontier: progressed ? "in_progress" : "stage1",
    issues: [],
  }
}

function unsafe(issues) {
  return {
    status: "unsafe",
    safe: false,
    canPrepare: false,
    canReset: false,
    canAuthenticate: false,
    frontier: null,
    issues,
  }
}
