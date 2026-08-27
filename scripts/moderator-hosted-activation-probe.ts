#!/usr/bin/env tsx
import { randomBytes, randomUUID, createHash } from "node:crypto"
import { chmod, mkdir, writeFile } from "node:fs/promises"
import { relative, resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const HOSTED_ACTIVATION_PROBE_PROJECT = "pqdkhefxsxkyeqelqegq"
export const HOSTED_ACTIVATION_PROBE_MARKER = "moderator-hosted-activation-probe-v1"
const EXPECTED_URL = `https://${HOSTED_ACTIVATION_PROBE_PROJECT}.supabase.co`

type ProbeError = { status?: number; code?: string; name?: string }
type Outcome<T> = { data: T | null; error: ProbeError | null; status?: number }
type User = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  app_metadata?: Record<string, unknown> | null
}
type Session = { access_token: string; refresh_token: string }
type CampaignResult = {
  campaign_id: string
  max_activations: number
  access_duration_hours: number
  member_count: number
}
type SaveResult = { lead_id: string; reused: boolean; artifact_id: string }
type ActivationResult = {
  enrollment_id: string
  manual_access_grant_id: string
  prepared_artifact_id: string
  activated_at: string
  expires_at: string
  reused: boolean
}
type FixtureIds = {
  userId?: string
  email?: string
  campaignId?: string
  duplicateTokenHash?: string
  tokenHash?: string
  funnelSessionId?: string
  artifactId?: string
  leadId?: string
  enrollmentId?: string
  grantId?: string
}
type CleanupResiduals = {
  authUserAbsent: boolean
  profileAbsent: boolean
  memberAbsent: boolean
  enrollmentAbsent: boolean
  outboxAbsent: boolean
  artifactAbsent: boolean
  funnelAbsent: boolean
  leadAbsent: boolean
  grantAbsent: boolean
  campaignAbsent: boolean
}

export type HostedActivationProbeOperations = {
  createUser(input: { email: string; password: string; marker: string }): Promise<Outcome<User>>
  getUserById(userId: string): Promise<Outcome<User>>
  deleteUser(userId: string): Promise<Outcome<unknown>>
  signIn(email: string, password: string): Promise<Outcome<Session>>
  createModeratorCampaign(input: {
    name: string
    tokenHash: string
    roster: Array<{ user_id: string; email: string; reset_receipt_ref: string }>
    startsAt: string
    expiresAt: string
  }): Promise<Outcome<CampaignResult>>
  markMemberReady(input: {
    campaignId: string
    userId: string
    resetReceiptRef: string
  }): Promise<Outcome<{ id: string }>>
  createFunnel(input: {
    id: string
    userId: string
    campaignId: string
  }): Promise<Outcome<{ id: string }>>
  createPreparedArtifact(input: {
    id: string
    userId: string
    answerHash: string
    claimTokenHash: string
    quizAnswers: Record<string, unknown>
    expiresAt: string
  }): Promise<Outcome<{ id: string }>>
  saveModeratorLead(input: {
    campaignId: string
    userId: string
    confirmedEmail: string
    funnelSessionId: string
    artifactId: string
    claimTokenHash: string
    answerHash: string
    quizAnswers: Record<string, unknown>
  }): Promise<Outcome<SaveResult>>
  loadPostSaveState(input: {
    campaignId: string
    userId: string
    leadId: string
    artifactId: string
    funnelSessionId: string
  }): Promise<Outcome<Record<string, unknown>>>
  activateModerator(input: {
    client: "a" | "b"
    campaignId: string
    userId: string
    confirmedEmail: string
    funnelSessionId: string
    leadId: string
    eventId: string
  }): Promise<Outcome<ActivationResult>>
  anonActivate(input: {
    campaignId: string
    userId: string
    confirmedEmail: string
    funnelSessionId: string
    leadId: string
    eventId: string
  }): Promise<Outcome<unknown>>
  authenticatedMemberSelect(input: {
    session: Session
    campaignId: string
    userId: string
  }): Promise<Outcome<Array<Record<string, unknown>>>>
  wrongEmailActivationProgress(input: {
    campaignId: string
    userId: string
  }): Promise<Outcome<Record<string, number>>>
  duplicateRosterCreate(input: {
    tokenHash: string
    userId: string
    email: string
  }): Promise<Outcome<unknown>>
  countCampaignsByToken(tokenHash: string): Promise<Outcome<{ count: number }>>
  recoverCampaignByTokenHash(input: {
    tokenHash: string
    userId: string
    email: string
  }): Promise<Outcome<CampaignResult>>
  recoverSaveByArtifact(input: {
    artifactId: string
    userId: string
    campaignId: string
  }): Promise<Outcome<SaveResult>>
  recoverActivationByScope(input: {
    campaignId: string
    userId: string
    leadId: string
  }): Promise<Outcome<ActivationResult>>
  revokeCampaign(campaignId: string): Promise<Outcome<{ revoked: boolean }>>
  loadRevocationState(input: {
    campaignId: string
    userId: string
    enrollmentId: string
    grantId: string
  }): Promise<Outcome<Record<string, unknown>>>
  guestBindModeratorCampaign(input: {
    campaignId: string
    funnelSessionId: string
    leadId: string
  }): Promise<Outcome<unknown>>
  cleanup(ids: FixtureIds): Promise<Outcome<CleanupResiduals>>
}

export type HostedActivationProbeCommand = {
  apply: boolean
  project: string | null
  receiptDir: string | null
}
export type HostedActivationProbeResult = {
  dryRun: boolean
  success: boolean
  marker: string
  fixture: FixtureIds
  checks: Record<string, boolean | "unknown">
  denials: Record<string, { status: number | null; code: string | null }>
  errors: Array<{ step: string; status: number | null; code: string | null }>
  cleanup: {
    attempted: boolean
    guardMatched: boolean
    deleted: boolean
    residuals?: CleanupResiduals
  }
  note?: string
}

export function parseHostedActivationProbeCommand(
  argv: readonly string[],
): HostedActivationProbeCommand {
  let apply = false
  let project: string | null = null
  let receiptDir: string | null = null
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--apply") {
      apply = true
      continue
    }
    if (arg === "--project" || arg === "--receipt-dir") {
      const value = argv[++index]
      if (!value) throw new Error(`${arg} requires a value`)
      if (arg === "--project") project = value
      else receiptDir = value
      continue
    }
    if (arg.startsWith("--project=") || arg.startsWith("--receipt-dir=")) {
      const [flag, value] = arg.split("=", 2)
      if (!value) throw new Error(`${flag} requires a value`)
      if (flag === "--project") project = value
      else receiptDir = value
      continue
    }
    throw new Error(`Unknown or unsafe argument ${arg}`)
  }
  if (apply && project !== HOSTED_ACTIVATION_PROBE_PROJECT)
    throw new Error(`--apply requires --project ${HOSTED_ACTIVATION_PROBE_PROJECT}`)
  if (apply && !receiptDir) throw new Error("--apply requires --receipt-dir outside the repository")
  if (receiptDir && pathIsWithin(process.cwd(), receiptDir))
    throw new Error("--receipt-dir must be outside the repository")
  return { apply, project, receiptDir }
}

export function validateHostedActivationSupabaseUrl(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== `${HOSTED_ACTIVATION_PROBE_PROJECT}.supabase.co` ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL must be ${EXPECTED_URL}`)
  return parsed.toString().replace(/\/$/, "")
}

function pathIsWithin(root: string, candidate: string) {
  const value = relative(resolve(root), resolve(candidate))
  return value === "" || (!value.startsWith("..") && !value.includes("/../"))
}
function sanitizedError(error: unknown): ProbeError {
  if (!error || typeof error !== "object") return {}
  const value = error as { status?: unknown; code?: unknown; name?: unknown }
  return {
    ...(typeof value.status === "number" ? { status: value.status } : {}),
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.name === "string" ? { name: value.name } : {}),
  }
}
function recordError(result: HostedActivationProbeResult, step: string, error: unknown) {
  const value = sanitizedError(error)
  result.errors.push({ step, status: value.status ?? null, code: value.code ?? null })
}
async function call<T>(
  result: HostedActivationProbeResult,
  step: string,
  operation: () => Promise<Outcome<T>>,
): Promise<T | null> {
  try {
    const outcome = await operation()
    if (outcome.error || !outcome.data) {
      recordError(result, step, outcome.error)
      return null
    }
    return outcome.data
  } catch (error) {
    recordError(result, step, error)
    return null
  }
}
function recordExpectedDenial(
  result: HostedActivationProbeResult,
  step: string,
  outcome: Outcome<unknown>,
  expected: { codes: readonly string[]; statuses?: readonly number[] },
) {
  const status = outcome.error?.status ?? outcome.status ?? null
  const code = outcome.error?.code ?? null
  result.denials[step] = { status, code }
  return (
    !!outcome.error &&
    code != null &&
    expected.codes.includes(code) &&
    (expected.statuses ? status != null && expected.statuses.includes(status) : true)
  )
}
function hex(bytes = 32) {
  return randomBytes(bytes).toString("hex")
}
function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}
function bool(value: unknown) {
  return value === true
}
function allResidualsAbsent(residuals?: CleanupResiduals) {
  return !!residuals && Object.values(residuals).every((value) => value === true)
}
function exact2160HourExpiry(value: ActivationResult) {
  return (
    new Date(value.expires_at).getTime() - new Date(value.activated_at).getTime() ===
    2160 * 60 * 60 * 1000
  )
}
function sameActivationReceipt(a: ActivationResult, b: ActivationResult) {
  return (
    a.enrollment_id === b.enrollment_id &&
    a.manual_access_grant_id === b.manual_access_grant_id &&
    a.prepared_artifact_id === b.prepared_artifact_id &&
    new Date(a.activated_at).toISOString() === new Date(b.activated_at).toISOString() &&
    new Date(a.expires_at).toISOString() === new Date(b.expires_at).toISOString()
  )
}

export async function runHostedActivationProbe(
  operations: HostedActivationProbeOperations,
  options: {
    apply: boolean
    writeReceipt?: (result: HostedActivationProbeResult) => Promise<void>
  },
): Promise<HostedActivationProbeResult> {
  const result: HostedActivationProbeResult = {
    dryRun: !options.apply,
    success: false,
    marker: HOSTED_ACTIVATION_PROBE_MARKER,
    fixture: {},
    checks: {},
    denials: {},
    errors: [],
    cleanup: { attempted: false, guardMatched: false, deleted: false },
    note: "Synthetic SQL-only probe. Empty JSON plan/profile fixtures are DB-valid but not valid Personal Plan content.",
  }
  if (!options.apply) {
    result.success = true
    result.checks.dryRunNoHostedCalls = true
    result.note = "Dry run only: no environment, network, Auth, or database request was made."
    return result
  }

  const email = `moderator-activation-probe-${randomUUID()}@example.test`
  const password = randomBytes(32).toString("base64url")
  const tokenHash = sha256(`moderator-token-${randomUUID()}-${hex(8)}`)
  const duplicateTokenHash = sha256(`moderator-duplicate-${randomUUID()}-${hex(8)}`)
  const funnelSessionId = randomUUID()
  const artifactId = randomUUID()
  const answerHash = sha256(`answers-${randomUUID()}`)
  const claimTokenHash = sha256(`claim-${randomUUID()}`)
  const quizAnswers = { synthetic: true, marker: HOSTED_ACTIVATION_PROBE_MARKER }
  const resetReceiptRef = `${HOSTED_ACTIVATION_PROBE_MARKER}:fixture-reset:${randomUUID()}`
  const startsAt = new Date(Date.now() - 60_000).toISOString()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const artifactExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  let fixtureCreated = false

  const writeReceipt = async (step: string) => {
    if (!options.writeReceipt) return true
    try {
      await options.writeReceipt(result)
      return true
    } catch (error) {
      recordError(result, `${step}Receipt`, error)
      return false
    }
  }

  try {
    const user = await call(result, "createUser", () =>
      operations.createUser({ email, password, marker: HOSTED_ACTIVATION_PROBE_MARKER }),
    )
    if (!user?.id) return result
    fixtureCreated = true
    result.fixture = { userId: user.id, email, tokenHash, duplicateTokenHash }
    result.checks.createdExactSyntheticUser =
      user.email === email &&
      user.email_confirmed_at != null &&
      user.app_metadata?.operational_test === HOSTED_ACTIVATION_PROBE_MARKER
    if (!(await writeReceipt("createdUser")) || !result.checks.createdExactSyntheticUser)
      return result

    const duplicate = await operations.duplicateRosterCreate({
      tokenHash: duplicateTokenHash,
      userId: user.id,
      email,
    })
    result.checks.duplicateRosterRejected = recordExpectedDenial(
      result,
      "duplicateRosterCreate",
      duplicate,
      { codes: ["23505"] },
    )
    const duplicateCount = await call(result, "duplicateRosterRollbackCount", () =>
      operations.countCampaignsByToken(duplicateTokenHash),
    )
    result.checks.duplicateRosterRolledBack = duplicateCount?.count === 0
    if (!(await writeReceipt("duplicateRosterRollback"))) return result

    const campaignCreate = await operations.createModeratorCampaign({
      name: `${HOSTED_ACTIVATION_PROBE_MARKER} ${user.id}`,
      tokenHash,
      roster: [{ user_id: user.id, email, reset_receipt_ref: resetReceiptRef }],
      startsAt,
      expiresAt,
    })
    let campaign = campaignCreate.data
    if (campaignCreate.error || !campaign) {
      recordError(result, "createModeratorCampaign", campaignCreate.error)
      const recovered = await operations.recoverCampaignByTokenHash({
        tokenHash,
        userId: user.id,
        email,
      })
      if (recovered.error || !recovered.data) {
        if (recovered.error) recordError(result, "recoverCampaignByTokenHash", recovered.error)
        return result
      }
      campaign = recovered.data
      result.checks.campaignRecoveredAfterUncertainCreate = true
    }
    if (!campaign?.campaign_id) return result
    result.fixture.campaignId = campaign.campaign_id
    result.checks.campaignCreatedWith2160Hours =
      campaign.access_duration_hours === 2160 && campaign.member_count === 1
    if (!(await writeReceipt("createdCampaign"))) return result

    const memberReady = await call(result, "markMemberReady", () =>
      operations.markMemberReady({
        campaignId: campaign.campaign_id,
        userId: user.id,
        resetReceiptRef: resetReceiptRef,
      }),
    )
    result.checks.memberReady = !!memberReady
    if (!memberReady || !(await writeReceipt("memberReady"))) return result

    const session = await call(result, "signIn", () => operations.signIn(email, password))
    if (!session) return result
    const memberSelect = await operations.authenticatedMemberSelect({
      session,
      campaignId: campaign.campaign_id,
      userId: user.id,
    })
    result.checks.authenticatedMemberSelectDeniedOrEmpty =
      recordExpectedDenial(result, "authenticatedMemberSelect", memberSelect, {
        codes: ["42501"],
      }) ||
      (Array.isArray(memberSelect.data) && memberSelect.data.length === 0)

    result.fixture.funnelSessionId = funnelSessionId
    if (!(await writeReceipt("plannedFunnel"))) return result
    const funnel = await call(result, "createFunnel", () =>
      operations.createFunnel({
        id: funnelSessionId,
        userId: user.id,
        campaignId: campaign.campaign_id,
      }),
    )
    if (!funnel) return result
    if (!(await writeReceipt("createdFunnel"))) return result

    result.fixture.artifactId = artifactId
    if (!(await writeReceipt("plannedArtifact"))) return result
    const artifact = await call(result, "createPreparedArtifact", () =>
      operations.createPreparedArtifact({
        id: artifactId,
        userId: user.id,
        answerHash,
        claimTokenHash,
        quizAnswers,
        expiresAt: artifactExpiresAt,
      }),
    )
    if (!artifact) return result
    if (!(await writeReceipt("createdArtifact"))) return result

    const saveAttempt = await operations.saveModeratorLead({
      campaignId: campaign.campaign_id,
      userId: user.id,
      confirmedEmail: email,
      funnelSessionId,
      artifactId,
      claimTokenHash,
      answerHash,
      quizAnswers,
    })
    let save = saveAttempt.data
    if (saveAttempt.error || !save) {
      recordError(result, "saveModeratorLead", saveAttempt.error)
      const recovered = await operations.recoverSaveByArtifact({
        artifactId,
        userId: user.id,
        campaignId: campaign.campaign_id,
      })
      if (recovered.error || !recovered.data) {
        if (recovered.error) recordError(result, "recoverSaveByArtifact", recovered.error)
        return result
      }
      save = recovered.data
      result.checks.saveRecoveredAfterUncertainResponse = true
    }
    if (!save?.lead_id) return result
    result.fixture.leadId = save.lead_id
    result.checks.savedFreshLead = save.reused === false && save.artifact_id === artifactId
    const postSave = await call(result, "loadPostSaveState", () =>
      operations.loadPostSaveState({
        campaignId: campaign.campaign_id,
        userId: user.id,
        leadId: save.lead_id,
        artifactId,
        funnelSessionId,
      }),
    )
    result.checks.postSaveAttachedArtifact = bool(postSave?.artifactAttached)
    result.checks.postSaveLeadBoundToModerator = bool(postSave?.leadBoundToModerator)
    result.checks.postSaveOutboxNonCommercial = bool(postSave?.outboxNonCommercial)
    if (!(await writeReceipt("savedLead"))) return result

    const wrongBefore = await call(result, "wrongEmailProgressBefore", () =>
      operations.wrongEmailActivationProgress({
        campaignId: campaign.campaign_id,
        userId: user.id,
      }),
    )
    const wrong = await operations.activateModerator({
      client: "a",
      campaignId: campaign.campaign_id,
      userId: user.id,
      confirmedEmail: `wrong-${email}`,
      funnelSessionId,
      leadId: save.lead_id,
      eventId: `${HOSTED_ACTIVATION_PROBE_MARKER}:wrong-email:${randomUUID()}`,
    })
    result.checks.wrongEmailRejected = recordExpectedDenial(result, "wrongEmailActivation", wrong, {
      codes: ["22023"],
    })
    const wrongAfter = await call(result, "wrongEmailProgressAfter", () =>
      operations.wrongEmailActivationProgress({
        campaignId: campaign.campaign_id,
        userId: user.id,
      }),
    )
    result.checks.wrongEmailNoProgress =
      JSON.stringify(wrongBefore ?? {}) === JSON.stringify(wrongAfter ?? {})

    const firstEvent = `${HOSTED_ACTIVATION_PROBE_MARKER}:activate-a:${randomUUID()}`
    const secondEvent = `${HOSTED_ACTIVATION_PROBE_MARKER}:activate-b:${randomUUID()}`
    const activationSettled = await Promise.allSettled([
      operations.activateModerator({
        client: "a",
        campaignId: campaign.campaign_id,
        userId: user.id,
        confirmedEmail: email,
        funnelSessionId,
        leadId: save.lead_id,
        eventId: firstEvent,
      }),
      operations.activateModerator({
        client: "b",
        campaignId: campaign.campaign_id,
        userId: user.id,
        confirmedEmail: email,
        funnelSessionId,
        leadId: save.lead_id,
        eventId: secondEvent,
      }),
    ])
    const activationResults: ActivationResult[] = []
    for (const [index, settled] of activationSettled.entries()) {
      const step = index === 0 ? "activateA" : "activateB"
      if (settled.status === "rejected") {
        recordError(result, step, settled.reason)
        continue
      }
      if (settled.value.error || !settled.value.data) {
        recordError(result, step, settled.value.error)
        continue
      }
      activationResults.push(settled.value.data)
      result.fixture.enrollmentId = settled.value.data.enrollment_id
      result.fixture.grantId = settled.value.data.manual_access_grant_id
      if (!(await writeReceipt(step))) return result
    }
    if (activationResults.length < 2) {
      const recovered = await operations.recoverActivationByScope({
        campaignId: campaign.campaign_id,
        userId: user.id,
        leadId: save.lead_id,
      })
      if (recovered.error || !recovered.data) {
        if (recovered.error) recordError(result, "recoverActivationByScope", recovered.error)
        return result
      }
      activationResults.push(recovered.data)
      result.fixture.enrollmentId = recovered.data.enrollment_id
      result.fixture.grantId = recovered.data.manual_access_grant_id
      result.checks.activationRecoveredAfterPartialParallelResponse = true
      if (!(await writeReceipt("recoveredActivation"))) return result
    }
    const [a, b] = activationResults
    if (!a || !b) return result
    result.fixture.enrollmentId = a.enrollment_id
    result.fixture.grantId = a.manual_access_grant_id
    result.checks.parallelActivationSameEnrollment = sameActivationReceipt(a, b)
    result.checks.parallelActivationOneFreshOneReplay =
      [a.reused, b.reused].sort().join(",") === "false,true"
    result.checks.parallelActivationFixed2160HourExpiry =
      exact2160HourExpiry(a) && exact2160HourExpiry(b)
    if (!(await writeReceipt("activated"))) return result

    const anon = await operations.anonActivate({
      campaignId: campaign.campaign_id,
      userId: user.id,
      confirmedEmail: email,
      funnelSessionId,
      leadId: save.lead_id,
      eventId: `${HOSTED_ACTIVATION_PROBE_MARKER}:anon:${randomUUID()}`,
    })
    result.checks.anonActivationDenied = recordExpectedDenial(result, "anonActivation", anon, {
      codes: ["42501"],
    })

    const guestBind = await operations.guestBindModeratorCampaign({
      campaignId: campaign.campaign_id,
      funnelSessionId,
      leadId: save.lead_id,
    })
    result.checks.guestBindRejectsModeratorCampaign = recordExpectedDenial(
      result,
      "guestBindModeratorCampaign",
      guestBind,
      { codes: ["22023"] },
    )

    const revoked = await call(result, "revokeCampaign", () =>
      operations.revokeCampaign(campaign.campaign_id),
    )
    result.checks.revokeReturnedTrue = revoked?.revoked === true
    const revocationState = await call(result, "loadRevocationState", () =>
      operations.loadRevocationState({
        campaignId: campaign.campaign_id,
        userId: user.id,
        enrollmentId: a.enrollment_id,
        grantId: a.manual_access_grant_id,
      }),
    )
    result.checks.revokeChainAllRevoked = bool(revocationState?.allRevoked)
    result.success =
      Object.values(result.checks).every((value) => value === true) && result.errors.length === 0
  } catch (error) {
    recordError(result, "unexpected", error)
  } finally {
    if (fixtureCreated) {
      result.cleanup.attempted = true
      const current = await call(result, "cleanupGuard", () =>
        operations.getUserById(result.fixture.userId!),
      )
      result.cleanup.guardMatched =
        current?.email === result.fixture.email &&
        current?.app_metadata?.operational_test === HOSTED_ACTIVATION_PROBE_MARKER
      if (!result.cleanup.guardMatched) recordError(result, "cleanupIdentityMismatch", {})
      else {
        const cleanup = await call(result, "cleanup", () => operations.cleanup(result.fixture))
        result.cleanup.residuals = cleanup ?? undefined
        result.cleanup.deleted = allResidualsAbsent(cleanup ?? undefined)
      }
    }
    result.success = result.success && result.cleanup.deleted && result.errors.length === 0
    const finalReceiptOk = await writeReceipt("final")
    result.success = result.success && finalReceiptOk && result.errors.length === 0
  }
  return result
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for --apply`)
  return value
}
function one<T>(data: T[] | T | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data ?? null
}
function responseStatus(response: unknown): number | undefined {
  if (!response || typeof response !== "object") return undefined
  const status = (response as { status?: unknown }).status
  return typeof status === "number" ? status : undefined
}
function errorWithStatus(error: ProbeError | null, status?: number): ProbeError | null {
  if (!error) return null
  return { ...error, ...(typeof error.status === "number" ? {} : { status }) }
}
function outcome<T>(response: {
  data: T | null
  error: ProbeError | null
  status?: number
}): Outcome<T> {
  const error = errorWithStatus(response.error, response.status)
  return { data: error ? null : response.data, error, status: response.status }
}
function rpcOne<T>(response: {
  data: T[] | T | null
  error: ProbeError | null
  status?: number
}): Outcome<T> {
  const error = errorWithStatus(response.error, response.status)
  return { data: error ? null : one(response.data), error, status: response.status }
}
async function existsById(client: SupabaseClient, table: string, id: string | undefined) {
  if (!id) return true
  const response = await client.from(table).select("id").eq("id", id).maybeSingle()
  if (response.error) throw response.error
  return response.data == null
}

function createHostedActivationOperations(): HostedActivationProbeOperations {
  const url = validateHostedActivationSupabaseUrl(requireEnv("NEXT_PUBLIC_SUPABASE_URL"))
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const serviceA = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const serviceB = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const authenticated = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return {
    async createUser(input) {
      const response = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        app_metadata: { operational_test: input.marker },
      })
      const status = responseStatus(response)
      return {
        data: response.error ? null : response.data.user,
        error: errorWithStatus(response.error, status),
        status,
      }
    },
    async getUserById(userId) {
      const response = await admin.auth.admin.getUserById(userId)
      const status = responseStatus(response)
      return {
        data: response.error ? null : response.data.user,
        error: errorWithStatus(response.error, status),
        status,
      }
    },
    async deleteUser(userId) {
      const response = await admin.auth.admin.deleteUser(userId)
      const status = responseStatus(response)
      return {
        data: response.error ? null : {},
        error: errorWithStatus(response.error, status),
        status,
      }
    },
    async signIn(email, password) {
      const response = await authenticated.auth.signInWithPassword({ email, password })
      const status = responseStatus(response)
      return {
        data: response.error ? null : response.data.session,
        error: errorWithStatus(response.error, status),
        status,
      }
    },
    async createModeratorCampaign(input) {
      return rpcOne<CampaignResult>(
        await serviceA.rpc("create_personal_plan_moderator_test_campaign", {
          p_name: input.name,
          p_token_hash: input.tokenHash,
          p_roster: input.roster,
          p_starts_at: input.startsAt,
          p_expires_at: input.expiresAt,
        }),
      )
    },
    async markMemberReady(input) {
      return outcome(
        await serviceA
          .from("personal_plan_test_members")
          .update({ status: "ready", reset_receipt_ref: input.resetReceiptRef })
          .eq("campaign_id", input.campaignId)
          .eq("user_id", input.userId)
          .select("id")
          .single(),
      )
    },
    async createFunnel(input) {
      return outcome(
        await serviceA
          .from("funnel_sessions")
          .insert({
            id: input.id,
            visitor_id: randomUUID(),
            package_key: "meta_personal_plan_v1",
            channel: "hosted_activation_probe",
            quiz_variant: "synthetic_sql_only",
            user_id: input.userId,
            test_kind: "field_test",
            field_test_campaign_id: input.campaignId,
          })
          .select("id")
          .single(),
      )
    },
    async createPreparedArtifact(input) {
      return outcome(
        await serviceA
          .from("personal_plan_prepared_artifacts")
          .insert({
            id: input.id,
            answer_hash: input.answerHash,
            claim_token_hash: input.claimTokenHash,
            quiz_answers: input.quizAnswers,
            canonical_profile: {},
            fallback_metadata: { synthetic_sql_only: true, marker: HOSTED_ACTIVATION_PROBE_MARKER },
            priorities: [],
            diagnostic_scores: {},
            public_offer_model: {},
            locked_plan: {},
            status: "prepared",
            user_id: input.userId,
            expires_at: input.expiresAt,
          })
          .select("id")
          .single(),
      )
    },
    async saveModeratorLead(input) {
      return rpcOne<SaveResult>(
        await serviceA.rpc("save_personal_plan_moderator_lead_with_artifact", {
          p_campaign_id: input.campaignId,
          p_user_id: input.userId,
          p_confirmed_email: input.confirmedEmail,
          p_funnel_session_id: input.funnelSessionId,
          p_marketing_consent: false,
          p_quiz_answers: input.quizAnswers,
          p_artifact_id: input.artifactId,
          p_claim_token_hash: input.claimTokenHash,
          p_answer_hash: input.answerHash,
        }),
      )
    },
    async loadPostSaveState(input) {
      const [artifact, lead, funnel, outbox] = await Promise.all([
        serviceA
          .from("personal_plan_prepared_artifacts")
          .select("id,status,lead_id,user_id,attached_at,user_attached_at")
          .eq("id", input.artifactId)
          .maybeSingle(),
        serviceA
          .from("leads")
          .select("id,user_id,quiz_kind,status,moderator_campaign_id")
          .eq("id", input.leadId)
          .maybeSingle(),
        serviceA
          .from("funnel_sessions")
          .select("id,lead_id,user_id,test_kind,field_test_campaign_id")
          .eq("id", input.funnelSessionId)
          .maybeSingle(),
        serviceA
          .from("customerio_profile_sync_outbox")
          .select("lead_id,completion_event_eligible,send_completion_event")
          .eq("lead_id", input.leadId)
          .maybeSingle(),
      ])
      const failed = [artifact, lead, funnel, outbox].find((response) => response.error)
      if (failed)
        return {
          data: null,
          error: errorWithStatus(failed.error, failed.status),
          status: failed.status,
        }
      return {
        data: {
          artifactAttached:
            artifact.data?.status === "attached" &&
            artifact.data.lead_id === input.leadId &&
            artifact.data.user_id === input.userId &&
            !!artifact.data.attached_at &&
            !!artifact.data.user_attached_at,
          leadBoundToModerator:
            lead.data?.user_id === input.userId &&
            lead.data?.quiz_kind === "personal_plan" &&
            lead.data?.status === "linked" &&
            lead.data?.moderator_campaign_id === input.campaignId &&
            funnel.data?.lead_id === input.leadId &&
            funnel.data?.user_id === input.userId &&
            funnel.data?.test_kind === "field_test" &&
            funnel.data?.field_test_campaign_id === input.campaignId,
          outboxNonCommercial:
            outbox.data?.completion_event_eligible === false &&
            outbox.data?.send_completion_event === false,
        },
        error: null,
      }
    },
    async activateModerator(input) {
      const client = input.client === "a" ? serviceA : serviceB
      return rpcOne<ActivationResult>(
        await client.rpc("activate_personal_plan_moderator_test", {
          p_campaign_id: input.campaignId,
          p_funnel_session_id: input.funnelSessionId,
          p_lead_id: input.leadId,
          p_user_id: input.userId,
          p_confirmed_email: input.confirmedEmail,
          p_activation_event_id: input.eventId,
        }),
      )
    },
    async anonActivate(input) {
      return rpcOne(
        await anon.rpc("activate_personal_plan_moderator_test", {
          p_campaign_id: input.campaignId,
          p_funnel_session_id: input.funnelSessionId,
          p_lead_id: input.leadId,
          p_user_id: input.userId,
          p_confirmed_email: input.confirmedEmail,
          p_activation_event_id: input.eventId,
        }),
      )
    },
    async authenticatedMemberSelect(input) {
      await authenticated.auth.setSession(input.session)
      const response = await authenticated
        .from("personal_plan_test_members")
        .select("id")
        .eq("campaign_id", input.campaignId)
        .eq("user_id", input.userId)
      return {
        data: response.error ? null : response.data,
        error: errorWithStatus(response.error, response.status),
        status: response.status,
      }
    },
    async wrongEmailActivationProgress(input) {
      const [member, enrollments, grants] = await Promise.all([
        serviceA
          .from("personal_plan_test_members")
          .select("status", { count: "exact", head: false })
          .eq("campaign_id", input.campaignId)
          .eq("user_id", input.userId)
          .eq("status", "activated"),
        serviceA
          .from("personal_plan_test_enrollments")
          .select("id", { count: "exact", head: false })
          .eq("campaign_id", input.campaignId)
          .eq("user_id", input.userId),
        serviceA
          .from("manual_access_grants")
          .select("id", { count: "exact", head: false })
          .eq("user_id", input.userId)
          .eq("reason", "tester"),
      ])
      const failed = [member, enrollments, grants].find((response) => response.error)
      if (failed)
        return {
          data: null,
          error: errorWithStatus(failed.error, failed.status),
          status: failed.status,
        }
      return {
        data: {
          activatedMembers: member.count ?? 0,
          enrollments: enrollments.count ?? 0,
          testerGrants: grants.count ?? 0,
        },
        error: null,
      }
    },
    async duplicateRosterCreate(input) {
      return rpcOne(
        await serviceA.rpc("create_personal_plan_moderator_test_campaign", {
          p_name: `${HOSTED_ACTIVATION_PROBE_MARKER} duplicate ${randomUUID()}`,
          p_token_hash: input.tokenHash,
          p_roster: [
            { user_id: input.userId, email: input.email, reset_receipt_ref: "duplicate-a" },
            { user_id: input.userId, email: input.email, reset_receipt_ref: "duplicate-b" },
          ],
          p_starts_at: new Date(Date.now() - 60_000).toISOString(),
          p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      )
    },
    async countCampaignsByToken(tokenHash) {
      const response = await serviceA
        .from("personal_plan_test_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("token_hash", tokenHash)
      return {
        data: response.error ? null : { count: response.count ?? 0 },
        error: errorWithStatus(response.error, response.status),
        status: response.status,
      }
    },
    async recoverCampaignByTokenHash(input) {
      const campaign = await serviceA
        .from("personal_plan_test_campaigns")
        .select("id,max_activations,access_duration_hours,identity_mode")
        .eq("token_hash", input.tokenHash)
        .maybeSingle()
      if (campaign.error || !campaign.data)
        return {
          data: null,
          error: errorWithStatus(campaign.error, campaign.status),
          status: campaign.status,
        }
      const member = await serviceA
        .from("personal_plan_test_members")
        .select("id")
        .eq("campaign_id", campaign.data.id)
        .eq("user_id", input.userId)
        .eq("normalized_email", input.email)
        .maybeSingle()
      if (member.error || !member.data)
        return {
          data: null,
          error: errorWithStatus(member.error, member.status),
          status: member.status,
        }
      return {
        data: {
          campaign_id: campaign.data.id,
          max_activations: campaign.data.max_activations,
          access_duration_hours: campaign.data.access_duration_hours,
          member_count: 1,
        },
        error: null,
        status: campaign.status,
      }
    },
    async recoverSaveByArtifact(input) {
      const artifact = await serviceA
        .from("personal_plan_prepared_artifacts")
        .select("id,lead_id,user_id,status")
        .eq("id", input.artifactId)
        .eq("user_id", input.userId)
        .eq("status", "attached")
        .maybeSingle()
      if (artifact.error || !artifact.data?.lead_id)
        return {
          data: null,
          error: errorWithStatus(artifact.error, artifact.status),
          status: artifact.status,
        }
      const lead = await serviceA
        .from("leads")
        .select("id,user_id,quiz_kind,status,moderator_campaign_id")
        .eq("id", artifact.data.lead_id)
        .eq("user_id", input.userId)
        .eq("quiz_kind", "personal_plan")
        .eq("status", "linked")
        .eq("moderator_campaign_id", input.campaignId)
        .maybeSingle()
      if (lead.error || !lead.data)
        return { data: null, error: errorWithStatus(lead.error, lead.status), status: lead.status }
      return {
        data: { lead_id: lead.data.id, reused: false, artifact_id: artifact.data.id },
        error: null,
        status: lead.status,
      }
    },
    async recoverActivationByScope(input) {
      const enrollment = await serviceA
        .from("personal_plan_test_enrollments")
        .select("id,manual_access_grant_id,prepared_artifact_id,activated_at,expires_at,status")
        .eq("campaign_id", input.campaignId)
        .eq("user_id", input.userId)
        .eq("lead_id", input.leadId)
        .eq("status", "active")
        .maybeSingle()
      if (enrollment.error || !enrollment.data)
        return {
          data: null,
          error: errorWithStatus(enrollment.error, enrollment.status),
          status: enrollment.status,
        }
      return {
        data: {
          enrollment_id: enrollment.data.id,
          manual_access_grant_id: enrollment.data.manual_access_grant_id,
          prepared_artifact_id: enrollment.data.prepared_artifact_id,
          activated_at: enrollment.data.activated_at,
          expires_at: enrollment.data.expires_at,
          reused: true,
        },
        error: null,
        status: enrollment.status,
      }
    },
    async revokeCampaign(campaignId) {
      const response = await serviceA.rpc("revoke_personal_plan_field_test_campaign", {
        p_campaign_id: campaignId,
      })
      return {
        data: response.error ? null : { revoked: response.data === true },
        error: errorWithStatus(response.error, response.status),
        status: response.status,
      }
    },
    async loadRevocationState(input) {
      const [campaign, member, enrollment, grant] = await Promise.all([
        serviceA
          .from("personal_plan_test_campaigns")
          .select("status,revoked_at")
          .eq("id", input.campaignId)
          .maybeSingle(),
        serviceA
          .from("personal_plan_test_members")
          .select("status,revoked_at")
          .eq("campaign_id", input.campaignId)
          .eq("user_id", input.userId)
          .maybeSingle(),
        serviceA
          .from("personal_plan_test_enrollments")
          .select("status,revoked_at")
          .eq("id", input.enrollmentId)
          .maybeSingle(),
        serviceA
          .from("manual_access_grants")
          .select("revoked_at")
          .eq("id", input.grantId)
          .maybeSingle(),
      ])
      const failed = [campaign, member, enrollment, grant].find((response) => response.error)
      if (failed)
        return {
          data: null,
          error: errorWithStatus(failed.error, failed.status),
          status: failed.status,
        }
      return {
        data: {
          allRevoked:
            campaign.data?.status === "revoked" &&
            !!campaign.data.revoked_at &&
            member.data?.status === "revoked" &&
            !!member.data.revoked_at &&
            enrollment.data?.status === "revoked" &&
            !!enrollment.data.revoked_at &&
            !!grant.data?.revoked_at,
        },
        error: null,
      }
    },
    async guestBindModeratorCampaign(input) {
      return rpcOne(
        await serviceA.rpc("bind_personal_plan_field_test_funnel", {
          p_campaign_id: input.campaignId,
          p_funnel_session_id: input.funnelSessionId,
          p_lead_id: input.leadId,
        }),
      )
    },
    async cleanup(ids) {
      const errors: ProbeError[] = []
      const cleanupIds: FixtureIds = { ...ids }
      if (!cleanupIds.campaignId && cleanupIds.tokenHash) {
        const campaign = await serviceA
          .from("personal_plan_test_campaigns")
          .select("id")
          .eq("token_hash", cleanupIds.tokenHash)
          .maybeSingle()
        if (campaign.error)
          return {
            data: null,
            error: errorWithStatus(campaign.error, campaign.status),
            status: campaign.status,
          }
        cleanupIds.campaignId = campaign.data?.id ?? cleanupIds.campaignId
      }
      if (!cleanupIds.leadId && cleanupIds.artifactId) {
        const artifact = await serviceA
          .from("personal_plan_prepared_artifacts")
          .select("lead_id")
          .eq("id", cleanupIds.artifactId)
          .maybeSingle()
        if (artifact.error)
          return {
            data: null,
            error: errorWithStatus(artifact.error, artifact.status),
            status: artifact.status,
          }
        cleanupIds.leadId = artifact.data?.lead_id ?? cleanupIds.leadId
      }
      if (
        (!cleanupIds.enrollmentId || !cleanupIds.grantId) &&
        cleanupIds.campaignId &&
        cleanupIds.userId &&
        cleanupIds.leadId
      ) {
        const enrollment = await serviceA
          .from("personal_plan_test_enrollments")
          .select("id,manual_access_grant_id")
          .eq("campaign_id", cleanupIds.campaignId)
          .eq("user_id", cleanupIds.userId)
          .eq("lead_id", cleanupIds.leadId)
          .maybeSingle()
        if (enrollment.error)
          return {
            data: null,
            error: errorWithStatus(enrollment.error, enrollment.status),
            status: enrollment.status,
          }
        cleanupIds.enrollmentId = enrollment.data?.id ?? cleanupIds.enrollmentId
        cleanupIds.grantId = enrollment.data?.manual_access_grant_id ?? cleanupIds.grantId
      }
      const attempt = async (
        label: string,
        fn: () => PromiseLike<{ error: ProbeError | null; status?: number }>,
      ) => {
        try {
          const response = await fn()
          const error = errorWithStatus(response.error, response.status)
          if (error) errors.push({ ...error, code: error.code ?? label })
        } catch (error) {
          errors.push({ ...sanitizedError(error), code: sanitizedError(error).code ?? label })
        }
      }
      if (cleanupIds.campaignId && cleanupIds.userId)
        await attempt(
          "cleanup_member",
          async () =>
            await serviceA
              .from("personal_plan_test_members")
              .delete()
              .eq("campaign_id", cleanupIds.campaignId!)
              .eq("user_id", cleanupIds.userId!),
        )
      if (cleanupIds.enrollmentId)
        await attempt(
          "cleanup_enrollment",
          async () =>
            await serviceA
              .from("personal_plan_test_enrollments")
              .delete()
              .eq("id", cleanupIds.enrollmentId!),
        )
      if (cleanupIds.leadId)
        await attempt(
          "cleanup_outbox",
          async () =>
            await serviceA
              .from("customerio_profile_sync_outbox")
              .delete()
              .eq("lead_id", cleanupIds.leadId!),
        )
      if (cleanupIds.artifactId)
        await attempt(
          "cleanup_artifact",
          async () =>
            await serviceA
              .from("personal_plan_prepared_artifacts")
              .delete()
              .eq("id", cleanupIds.artifactId!),
        )
      if (cleanupIds.funnelSessionId)
        await attempt(
          "cleanup_funnel",
          async () =>
            await serviceA.from("funnel_sessions").delete().eq("id", cleanupIds.funnelSessionId!),
        )
      if (cleanupIds.leadId)
        await attempt(
          "cleanup_lead",
          async () => await serviceA.from("leads").delete().eq("id", cleanupIds.leadId!),
        )
      if (cleanupIds.grantId)
        await attempt(
          "cleanup_grant",
          async () =>
            await serviceA.from("manual_access_grants").delete().eq("id", cleanupIds.grantId!),
        )
      if (cleanupIds.campaignId)
        await attempt(
          "cleanup_campaign",
          async () =>
            await serviceA
              .from("personal_plan_test_campaigns")
              .delete()
              .eq("id", cleanupIds.campaignId!),
        )
      if (errors.length) return { data: null, error: errors[0] }
      if (cleanupIds.userId) {
        const authDelete = await admin.auth.admin.deleteUser(cleanupIds.userId)
        if (authDelete.error) {
          const status = responseStatus(authDelete)
          return {
            data: null,
            error: errorWithStatus(authDelete.error, status),
            status,
          }
        }
      }
      try {
        const authResidual = cleanupIds.userId
          ? await admin.auth.admin.getUserById(cleanupIds.userId)
          : null
        const authResidualError = authResidual
          ? errorWithStatus(authResidual.error, responseStatus(authResidual))
          : null
        const authUserAbsent =
          !!cleanupIds.userId &&
          authResidualError?.status === 404 &&
          authResidualError?.code === "user_not_found"
        const memberResidual =
          cleanupIds.campaignId && cleanupIds.userId
            ? await serviceA
                .from("personal_plan_test_members")
                .select("id")
                .eq("campaign_id", cleanupIds.campaignId)
                .eq("user_id", cleanupIds.userId)
                .maybeSingle()
            : null
        if (memberResidual?.error) throw memberResidual.error
        const outboxResidual = cleanupIds.leadId
          ? await serviceA
              .from("customerio_profile_sync_outbox")
              .select("lead_id")
              .eq("lead_id", cleanupIds.leadId)
              .maybeSingle()
          : null
        if (outboxResidual?.error) throw outboxResidual.error
        const residuals: CleanupResiduals = {
          authUserAbsent,
          profileAbsent: await existsById(serviceA, "profiles", cleanupIds.userId),
          memberAbsent:
            !cleanupIds.campaignId || !cleanupIds.userId ? true : memberResidual?.data == null,
          enrollmentAbsent: await existsById(
            serviceA,
            "personal_plan_test_enrollments",
            cleanupIds.enrollmentId,
          ),
          outboxAbsent: !cleanupIds.leadId ? true : outboxResidual?.data == null,
          artifactAbsent: await existsById(
            serviceA,
            "personal_plan_prepared_artifacts",
            cleanupIds.artifactId,
          ),
          funnelAbsent: await existsById(serviceA, "funnel_sessions", cleanupIds.funnelSessionId),
          leadAbsent: await existsById(serviceA, "leads", cleanupIds.leadId),
          grantAbsent: await existsById(serviceA, "manual_access_grants", cleanupIds.grantId),
          campaignAbsent: await existsById(
            serviceA,
            "personal_plan_test_campaigns",
            cleanupIds.campaignId,
          ),
        }
        if (!authUserAbsent)
          return { data: null, error: { status: 500, code: "auth_residual_unknown" } }
        return { data: residuals, error: null }
      } catch (error) {
        return { data: null, error: sanitizedError(error) }
      }
    },
  }
}

async function main() {
  const command = parseHostedActivationProbeCommand(process.argv.slice(2))
  if (!command.apply) {
    console.log(
      JSON.stringify(
        await runHostedActivationProbe({} as HostedActivationProbeOperations, { apply: false }),
        null,
        2,
      ),
    )
    return
  }
  const directory = command.receiptDir!
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const receiptPath = resolve(directory, `moderator-hosted-activation-probe-${Date.now()}.json`)
  const writeReceipt = async (probe: HostedActivationProbeResult) => {
    await writeFile(receiptPath, `${JSON.stringify(probe, null, 2)}\n`, { mode: 0o600 })
  }
  const result = await runHostedActivationProbe(createHostedActivationOperations(), {
    apply: true,
    writeReceipt,
  })
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exitCode = 2
}

if (process.argv[1]?.endsWith("moderator-hosted-activation-probe.ts"))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
