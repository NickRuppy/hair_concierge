import assert from "node:assert/strict"
import test from "node:test"
import {
  HOSTED_ACTIVATION_PROBE_MARKER,
  parseHostedActivationProbeCommand,
  runHostedActivationProbe,
  validateHostedActivationSupabaseUrl,
  type HostedActivationProbeOperations,
} from "../scripts/moderator-hosted-activation-probe"

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email_confirmed_at: "2026-08-27T10:00:00Z",
  app_metadata: { operational_test: HOSTED_ACTIVATION_PROBE_MARKER },
}
const notFound = { status: 404, code: "user_not_found" }
const err403 = { status: 403, code: "42501" }

function activation(reused: boolean, overrides: Partial<Record<string, string>> = {}) {
  const activated = overrides.activated_at ?? "2026-08-27T10:00:00.000Z"
  return {
    enrollment_id: overrides.enrollment_id ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    manual_access_grant_id:
      overrides.manual_access_grant_id ?? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    prepared_artifact_id: overrides.prepared_artifact_id ?? "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    activated_at: activated,
    expires_at:
      overrides.expires_at ??
      new Date(new Date(activated).getTime() + 2160 * 60 * 60 * 1000).toISOString(),
    reused,
  }
}

function fakeOperations(overrides: Partial<HostedActivationProbeOperations> = {}) {
  const calls: string[] = []
  let email = ""
  let userDeleted = false
  let leadId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  let campaignId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
  let wrongProgress = { activatedMembers: 0, enrollments: 0, testerGrants: 0 }
  let activationCalls = 0
  const operations: HostedActivationProbeOperations = {
    async createUser(input) {
      calls.push("createUser")
      email = input.email
      return { data: { ...USER, email }, error: null }
    },
    async getUserById() {
      calls.push("getUser")
      return userDeleted
        ? { data: null, error: notFound }
        : { data: { ...USER, email }, error: null }
    },
    async deleteUser() {
      calls.push("deleteUser")
      userDeleted = true
      return { data: {}, error: null }
    },
    async signIn() {
      calls.push("signIn")
      return { data: { access_token: "access", refresh_token: "refresh" }, error: null }
    },
    async createModeratorCampaign() {
      calls.push("createCampaign")
      return {
        data: {
          campaign_id: campaignId,
          max_activations: 1,
          access_duration_hours: 2160,
          member_count: 1,
        },
        error: null,
      }
    },
    async markMemberReady() {
      calls.push("memberReady")
      return { data: { id: "member-id" }, error: null }
    },
    async createFunnel(input) {
      calls.push(`createFunnel:${input.userId}:${input.campaignId}`)
      return { data: { id: input.id }, error: null }
    },
    async createPreparedArtifact(input) {
      calls.push(`createArtifact:${input.userId}:${input.id}`)
      return { data: { id: input.id }, error: null }
    },
    async saveModeratorLead(input) {
      calls.push(`save:${input.confirmedEmail}:${input.funnelSessionId}:${input.artifactId}`)
      return {
        data: { lead_id: leadId, reused: false, artifact_id: input.artifactId },
        error: null,
      }
    },
    async loadPostSaveState() {
      calls.push("postSave")
      return {
        data: { artifactAttached: true, leadBoundToModerator: true, outboxNonCommercial: true },
        error: null,
      }
    },
    async activateModerator(input) {
      calls.push(`activate:${input.client}:${input.confirmedEmail}:${input.eventId}`)
      if (input.confirmedEmail.startsWith("wrong-"))
        return { data: null, error: { status: 400, code: "22023" } }
      activationCalls += 1
      return {
        data: activation(activationCalls > 1, { prepared_artifact_id: input.leadId }),
        error: null,
      }
    },
    async anonActivate() {
      calls.push("anonActivate")
      return { data: null, error: err403 }
    },
    async authenticatedMemberSelect(input) {
      calls.push(`memberSelect:${input.campaignId}:${input.userId}`)
      return { data: [], error: null }
    },
    async wrongEmailActivationProgress() {
      calls.push("wrongProgress")
      return { data: wrongProgress, error: null }
    },
    async duplicateRosterCreate() {
      calls.push("duplicateRoster")
      return { data: null, error: { status: 409, code: "23505" } }
    },
    async countCampaignsByToken() {
      calls.push("countDuplicateToken")
      return { data: { count: 0 }, error: null }
    },
    async recoverCampaignByTokenHash() {
      calls.push("recoverCampaign")
      return {
        data: {
          campaign_id: campaignId,
          max_activations: 1,
          access_duration_hours: 2160,
          member_count: 1,
        },
        error: null,
      }
    },
    async recoverSaveByArtifact(input) {
      calls.push("recoverSave")
      return {
        data: { lead_id: leadId, reused: false, artifact_id: input.artifactId },
        error: null,
      }
    },
    async recoverActivationByScope() {
      calls.push("recoverActivation")
      return { data: activation(true), error: null }
    },
    async revokeCampaign() {
      calls.push("revoke")
      return { data: { revoked: true }, error: null }
    },
    async loadRevocationState() {
      calls.push("revocationState")
      return { data: { allRevoked: true }, error: null }
    },
    async guestBindModeratorCampaign() {
      calls.push("guestBind")
      return { data: null, error: { status: 400, code: "22023" } }
    },
    async cleanup() {
      calls.push("cleanup")
      userDeleted = true
      return {
        data: {
          authUserAbsent: true,
          profileAbsent: true,
          memberAbsent: true,
          enrollmentAbsent: true,
          outboxAbsent: true,
          artifactAbsent: true,
          funnelAbsent: true,
          leadAbsent: true,
          grantAbsent: true,
          campaignAbsent: true,
        },
        error: null,
      }
    },
    ...overrides,
  }
  return {
    operations,
    calls,
    setWrongProgress(value: typeof wrongProgress) {
      wrongProgress = value
    },
    setLeadAndCampaign(next: { lead?: string; campaign?: string }) {
      leadId = next.lead ?? leadId
      campaignId = next.campaign ?? campaignId
    },
  }
}

test("dry run makes no hosted calls and reads no environment", async () => {
  const fake = fakeOperations()
  const result = await runHostedActivationProbe(fake.operations, { apply: false })
  assert.equal(result.success, true)
  assert.equal(result.dryRun, true)
  assert.deepEqual(fake.calls, [])
  assert.equal(result.checks.dryRunNoHostedCalls, true)
})

test("rejects wrong project, unsafe args, and non-production URL before apply", () => {
  assert.throws(
    () =>
      parseHostedActivationProbeCommand([
        "--apply",
        "--project",
        "wrong",
        "--receipt-dir",
        "/tmp/probe",
      ]),
    /requires --project/,
  )
  assert.throws(() => parseHostedActivationProbeCommand(["--user-id", USER.id]), /unsafe argument/)
  assert.throws(
    () => parseHostedActivationProbeCommand(["--apply", "--project", "pqdkhefxsxkyeqelqegq"]),
    /receipt-dir/,
  )
  assert.throws(() => validateHostedActivationSupabaseUrl("http://127.0.0.1:54321"), /https/)
  assert.throws(
    () =>
      parseHostedActivationProbeCommand([
        "--apply",
        "--project",
        "pqdkhefxsxkyeqelqegq",
        "--receipt-dir",
        process.cwd(),
      ]),
    /outside the repository/,
  )
  assert.equal(
    validateHostedActivationSupabaseUrl("https://pqdkhefxsxkyeqelqegq.supabase.co/"),
    "https://pqdkhefxsxkyeqelqegq.supabase.co",
  )
})

test("happy path uses independent parallel activation calls and exact guarded cleanup", async () => {
  const fake = fakeOperations()
  const receipts: unknown[] = []
  const result = await runHostedActivationProbe(fake.operations, {
    apply: true,
    writeReceipt: async (value) => {
      receipts.push(JSON.parse(JSON.stringify(value)))
    },
  })
  assert.equal(result.success, true)
  assert.equal(result.checks.duplicateRosterRejected, true)
  assert.equal(result.checks.duplicateRosterRolledBack, true)
  assert.equal(result.checks.postSaveAttachedArtifact, true)
  assert.equal(result.checks.postSaveOutboxNonCommercial, true)
  assert.equal(result.checks.wrongEmailRejected, true)
  assert.equal(result.checks.wrongEmailNoProgress, true)
  assert.equal(result.checks.parallelActivationSameEnrollment, true)
  assert.equal(result.checks.parallelActivationOneFreshOneReplay, true)
  assert.equal(result.checks.parallelActivationFixed2160HourExpiry, true)
  assert.equal(result.checks.anonActivationDenied, true)
  assert.equal(result.checks.authenticatedMemberSelectDeniedOrEmpty, true)
  assert.equal(result.checks.guestBindRejectsModeratorCampaign, true)
  assert.equal(result.checks.revokeChainAllRevoked, true)
  assert.equal(result.cleanup.deleted, true)
  const activationCalls = fake.calls.filter((call) => call.startsWith("activate:"))
  assert.equal(activationCalls.length, 3)
  assert.ok(activationCalls.some((call) => call.startsWith("activate:a:")))
  assert.ok(activationCalls.some((call) => call.startsWith("activate:b:")))
  assert.ok(
    fake.calls.some((call) =>
      call.startsWith(
        "memberSelect:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee:11111111-1111-4111-8111-111111111111",
      ),
    ),
  )
  assert.ok(receipts.length >= 8)
  assert.ok(!JSON.stringify(receipts).includes("refresh"))
})

test("cleanup refuses to delete when fixture identity marker mismatches", async () => {
  const fake = fakeOperations({
    async getUserById() {
      return {
        data: { ...USER, email: "wrong@example.test", app_metadata: { operational_test: "other" } },
        error: null,
      }
    },
  })
  const result = await runHostedActivationProbe(fake.operations, { apply: true })
  assert.equal(result.success, false)
  assert.equal(result.cleanup.guardMatched, false)
  assert.equal(result.cleanup.deleted, false)
  assert.ok(!fake.calls.includes("cleanup"))
  assert.ok(result.errors.some((error) => error.step === "cleanupIdentityMismatch"))
})

test("wrong email progress change fails the probe even when rejected", async () => {
  const fake = fakeOperations()
  let reads = 0
  fake.operations.wrongEmailActivationProgress = async () => {
    reads += 1
    return {
      data:
        reads === 1
          ? { activatedMembers: 0, enrollments: 0, testerGrants: 0 }
          : { activatedMembers: 1, enrollments: 0, testerGrants: 0 },
      error: null,
    }
  }
  const result = await runHostedActivationProbe(fake.operations, { apply: true })
  assert.equal(result.success, false)
  assert.equal(result.checks.wrongEmailRejected, true)
  assert.equal(result.checks.wrongEmailNoProgress, false)
  assert.equal(result.cleanup.deleted, true)
})

test("unexpected 4xx denials are not accepted as proof", async () => {
  const fake = fakeOperations({
    async duplicateRosterCreate() {
      return { data: null, error: { status: 429, code: "rate_limit" }, status: 429 }
    },
    async anonActivate() {
      return { data: null, error: { status: 404, code: "PGRST202" }, status: 404 }
    },
  })
  const result = await runHostedActivationProbe(fake.operations, { apply: true })
  assert.equal(result.success, false)
  assert.equal(result.checks.duplicateRosterRejected, false)
  assert.equal(result.checks.anonActivationDenied, false)
  assert.deepEqual(result.denials.duplicateRosterCreate, { status: 429, code: "rate_limit" })
  assert.deepEqual(result.denials.anonActivation, { status: 404, code: "PGRST202" })
  assert.equal(result.cleanup.deleted, true)
})

test("partial parallel activation response is recovered for cleanup but does not report success", async () => {
  let first = true
  let cleanupIds: { enrollmentId?: string; grantId?: string } | null = null
  const fake = fakeOperations({
    async activateModerator(input) {
      if (input.confirmedEmail.startsWith("wrong-"))
        return { data: null, error: { status: 400, code: "22023" }, status: 400 }
      if (first) {
        first = false
        return { data: activation(false), error: null }
      }
      return { data: null, error: { status: 503, code: "upstream_timeout" }, status: 503 }
    },
    async recoverActivationByScope() {
      return { data: activation(true), error: null }
    },
    async cleanup(ids) {
      cleanupIds = { enrollmentId: ids.enrollmentId, grantId: ids.grantId }
      return {
        data: {
          authUserAbsent: true,
          profileAbsent: true,
          memberAbsent: true,
          enrollmentAbsent: true,
          outboxAbsent: true,
          artifactAbsent: true,
          funnelAbsent: true,
          leadAbsent: true,
          grantAbsent: true,
          campaignAbsent: true,
        },
        error: null,
      }
    },
  })
  const result = await runHostedActivationProbe(fake.operations, { apply: true })
  assert.equal(result.success, false)
  assert.equal(result.checks.activationRecoveredAfterPartialParallelResponse, true)
  assert.equal(result.checks.parallelActivationSameEnrollment, true)
  assert.ok(cleanupIds)
  const recoveredCleanupIds = cleanupIds as { enrollmentId?: string; grantId?: string }
  assert.equal(recoveredCleanupIds.enrollmentId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
  assert.equal(recoveredCleanupIds.grantId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
  assert.ok(result.errors.some((error) => error.step === "activateB" && error.status === 503))
})

test("activation replay must have identical receipt fields and exact 2160 hour expiry", async () => {
  let activationCalls = 0
  const fake = fakeOperations({
    async activateModerator(input) {
      if (input.confirmedEmail.startsWith("wrong-"))
        return { data: null, error: { status: 400, code: "22023" }, status: 400 }
      activationCalls += 1
      if (activationCalls === 1) return { data: activation(false), error: null }
      return {
        data: activation(true, {
          expires_at: new Date(
            new Date("2026-08-27T10:00:00.000Z").getTime() + 2160 * 60 * 60 * 1000 + 1,
          ).toISOString(),
        }),
        error: null,
      }
    },
  })
  const result = await runHostedActivationProbe(fake.operations, { apply: true })
  assert.equal(result.success, false)
  assert.equal(result.checks.parallelActivationSameEnrollment, false)
  assert.equal(result.checks.parallelActivationFixed2160HourExpiry, false)
  assert.equal(result.cleanup.deleted, true)
})

test("final journal failure marks the probe unsuccessful after cleanup", async () => {
  const fake = fakeOperations()
  let writes = 0
  const result = await runHostedActivationProbe(fake.operations, {
    apply: true,
    writeReceipt: async () => {
      writes += 1
      if (writes > 1)
        throw Object.assign(new Error("disk full"), { status: 507, code: "insufficient_storage" })
    },
  })
  assert.equal(result.success, false)
  assert.equal(result.cleanup.deleted, true)
  assert.ok(
    result.errors.some(
      (error) => error.step === "duplicateRosterRollbackReceipt" || error.step === "finalReceipt",
    ),
  )
})

test("source keeps cleanup conservative around auth deletion and exact auth absence", async () => {
  const { readFileSync } = await import("node:fs")
  const source = readFileSync("scripts/moderator-hosted-activation-probe.ts", "utf8")
  assert.match(source, /if \(errors\.length\) return \{ data: null, error: errors\[0\] \}/)
  assert.match(
    source,
    /authResidualError\?\.status === 404[\s\S]*authResidualError\?\.code === "user_not_found"/,
  )
  assert.match(
    source,
    /\.eq\("campaign_id", input\.campaignId\)[\s\S]*\.eq\("user_id", input\.userId\)/,
  )
})
