import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"

import {
  MODERATOR_ACCESS_UNAVAILABLE_CODE,
  MODERATOR_INTENT_COOKIE,
  type ModeratorAccessResolution,
  type ModeratorCampaignRef,
  type ModeratorFunnelContext,
  type ModeratorIntent,
  type ModeratorIntentResolution,
  type ModeratorMemberRef,
  type ModeratorMemberResolution,
  type ModeratorUser,
} from "./moderator-contract"

export { MODERATOR_INTENT_COOKIE }
export type {
  ModeratorAccessResolution,
  ModeratorCampaignRef,
  ModeratorFunnelContext,
  ModeratorIntent,
  ModeratorIntentResolution,
  ModeratorMemberRef,
  ModeratorMemberResolution,
  ModeratorUser,
}

const VERSION = 1
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SupabaseLikeClient = {
  from: (table: string) => QueryLike
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

type QueryLike = {
  select: (columns: string) => QueryLike
  eq: (column: string, value: unknown) => QueryLike
  order?: (column: string, options?: unknown) => QueryLike
  limit?: (count: number) => QueryLike
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
}

type CampaignRow = {
  id?: unknown
  status?: unknown
  flow_kind?: unknown
  identity_mode?: unknown
  starts_at?: unknown
  expires_at?: unknown
  max_activations?: unknown
  access_duration_hours?: unknown
  revoked_at?: unknown
}

type MemberRow = {
  id?: unknown
  campaign_id?: unknown
  user_id?: unknown
  normalized_email?: unknown
  status?: unknown
  reset_receipt_ref?: unknown
  enrollment_id?: unknown
  revoked_at?: unknown
}

type EnrollmentRow = {
  id?: unknown
  campaign_id?: unknown
  user_id?: unknown
  lead_id?: unknown
  funnel_session_id?: unknown
  manual_access_grant_id?: unknown
  status?: unknown
  activated_at?: unknown
  expires_at?: unknown
  revoked_at?: unknown
  manual_access_grants?: unknown
}

type GrantRow = {
  id?: unknown
  user_id?: unknown
  reason?: unknown
  expires_at?: unknown
  revoked_at?: unknown
}

function adminClient(explicit?: unknown): SupabaseLikeClient {
  return (explicit ?? createAdminClient()) as SupabaseLikeClient
}

export async function resolveModeratorMember(input: {
  client?: unknown
  campaignId: string
  user: ModeratorUser
  now?: number
}): Promise<ModeratorMemberResolution> {
  const email = normalizeConfirmedEmail(input.user)
  if (!email) return { kind: "forbidden", reason: "missing_confirmed_email" }
  if (!UUID.test(input.campaignId) || !UUID.test(input.user.id)) {
    return { kind: "forbidden", reason: "wrong_campaign" }
  }

  try {
    const client = adminClient(input.client)
    const member = await loadMemberByCampaignAndUser(client, input.campaignId, input.user.id)
    if (!member) return { kind: "forbidden", reason: "not_rostered" }
    const memberRef = memberReference(member)
    if (!memberRef || member.campaign_id !== input.campaignId) {
      return { kind: "forbidden", reason: "not_rostered" }
    }
    if (member.normalized_email !== email) return { kind: "forbidden", reason: "email_mismatch" }

    const campaign = await loadCampaign(client, input.campaignId)
    const campaignRef = resolveCampaignRef(campaign)
    if (!campaignRef) {
      if (isEmailBoundCampaign(campaign)) {
        return { kind: "ended", campaignId: input.campaignId, reason: "revoked" }
      }
      return { kind: "forbidden", reason: "wrong_campaign" }
    }

    if (member.status === "revoked" || isSet(member.revoked_at)) {
      return { kind: "ended", campaignId: input.campaignId, reason: "revoked" }
    }
    if (member.status === "pending") return { kind: "forbidden", reason: "not_ready" }
    if (member.status === "ready") {
      const receipt =
        typeof member.reset_receipt_ref === "string" && member.reset_receipt_ref.trim().length > 0
      if (!receipt) return { kind: "forbidden", reason: "not_ready" }
      const now = input.now ?? Date.now()
      if (campaignRef.expiresAt <= now)
        return { kind: "ended", campaignId: input.campaignId, reason: "expired" }
      if (!isCampaignOpen(campaign, now)) return { kind: "forbidden", reason: "wrong_campaign" }
      return { kind: "ready", campaign: campaignRef, member: memberRef }
    }
    if (member.status !== "activated") return { kind: "forbidden", reason: "not_ready" }

    const enrollmentId = typeof member.enrollment_id === "string" ? member.enrollment_id : null
    if (!enrollmentId) return { kind: "unavailable", code: MODERATOR_ACCESS_UNAVAILABLE_CODE }
    const enrollment = await loadEnrollment(client, enrollmentId)
    const access = resolveEnrollmentAccess(
      enrollment,
      memberRef.userId,
      input.campaignId,
      input.now ?? Date.now(),
    )
    if (access.kind === "active") {
      return {
        kind: "active",
        campaignId: input.campaignId,
        expiresAt: access.expiresAt,
        member: memberRef,
      }
    }
    return { kind: "ended", campaignId: input.campaignId, reason: access.reason }
  } catch {
    return { kind: "unavailable", code: MODERATOR_ACCESS_UNAVAILABLE_CODE }
  }
}

export async function resolveModeratorAccess(input: {
  client?: unknown
  userId: string
  now?: number
}): Promise<ModeratorAccessResolution> {
  if (!UUID.test(input.userId)) return { kind: "none" }
  try {
    const client = adminClient(input.client)
    const member = await loadLatestMemberForUser(client, input.userId)
    if (!member) return { kind: "none" }
    const campaignId = typeof member.campaign_id === "string" ? member.campaign_id : null
    if (!campaignId) return { kind: "unavailable", code: MODERATOR_ACCESS_UNAVAILABLE_CODE }
    if (member.status === "revoked" || isSet(member.revoked_at)) {
      return { kind: "ended", campaignId, reason: "revoked" }
    }
    if (member.status !== "activated") return { kind: "none" }
    const enrollmentId = typeof member.enrollment_id === "string" ? member.enrollment_id : null
    if (!enrollmentId) return { kind: "unavailable", code: MODERATOR_ACCESS_UNAVAILABLE_CODE }
    const enrollment = await loadEnrollment(client, enrollmentId)
    const access = resolveEnrollmentAccess(
      enrollment,
      input.userId,
      campaignId,
      input.now ?? Date.now(),
    )
    if (access.kind === "active") return { kind: "active", campaignId, expiresAt: access.expiresAt }
    return { kind: "ended", campaignId, reason: access.reason }
  } catch (error) {
    if (isMissingModeratorRoster(error)) return { kind: "none" }
    return { kind: "unavailable", code: MODERATOR_ACCESS_UNAVAILABLE_CODE }
  }
}

export function createModeratorIntent(input: ModeratorIntent, secret = resolveModeratorSecret()) {
  if (!secret || !isModeratorIntent(input)) return null
  const payload = Buffer.from(JSON.stringify({ version: VERSION, payload: input })).toString(
    "base64url",
  )
  const signature = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export async function resolveModeratorIntent(
  value: string | null | undefined,
  user: ModeratorUser,
  funnelContext: ModeratorFunnelContext,
  options: {
    client?: unknown
    secret?: string
    leadId?: string
    now?: number
  } = {},
): Promise<ModeratorIntentResolution> {
  const now = options.now ?? Date.now()
  const intent = decodeModeratorIntent(value, options.secret ?? resolveModeratorSecret(), now)
  if (!intent) return { kind: "forbidden", reason: "invalid_intent" }
  const email = normalizeConfirmedEmail(user)
  if (!email) return { kind: "forbidden", reason: "missing_confirmed_email" }
  if (
    intent.userId !== user.id ||
    intent.funnelSessionId !== funnelContext.sessionId ||
    funnelContext.packageKey !== "meta_personal_plan_v1" ||
    (options.leadId && intent.leadId && intent.leadId !== options.leadId)
  ) {
    return { kind: "forbidden", reason: "intent_mismatch" }
  }
  const member = await resolveModeratorMember({
    client: options.client,
    campaignId: intent.campaignId,
    user,
    now,
  })
  if (member.kind === "ready") return { ...member, intent }
  if (member.kind === "active") return { ...member, intent }
  if (member.kind === "unavailable") return member
  return { kind: "forbidden", reason: member.reason ?? member.kind }
}

export async function activatePersonalPlanModeratorTestEnrollment(
  input: {
    campaignId: string
    funnelSessionId: string
    leadId: string
    userId: string
    confirmedEmail: string
    eventId: string
  },
  dependencies?: {
    rpc?: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>
  },
) {
  const rpc =
    dependencies?.rpc ??
    ((name: string, args: Record<string, unknown>) => createAdminClient().rpc(name, args))
  const { data, error } = await rpc("activate_personal_plan_moderator_test", {
    p_campaign_id: input.campaignId,
    p_funnel_session_id: input.funnelSessionId,
    p_lead_id: input.leadId,
    p_user_id: input.userId,
    p_confirmed_email: normalizeEmail(input.confirmedEmail),
    p_activation_event_id: input.eventId,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (
    error ||
    !row ||
    typeof row !== "object" ||
    typeof (row as Record<string, unknown>).enrollment_id !== "string" ||
    typeof (row as Record<string, unknown>).expires_at !== "string"
  ) {
    throw new Error("Moderator field-test activation failed")
  }
  return {
    enrollmentId: (row as Record<string, string>).enrollment_id,
    expiresAt: (row as Record<string, string>).expires_at,
    reused: (row as Record<string, unknown>).reused === true,
  }
}

function normalizeConfirmedEmail(user: ModeratorUser) {
  if (!user.email_confirmed_at) return null
  return normalizeEmail(user.email)
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" && value.trim().includes("@") ? value.trim().toLowerCase() : null
}

function resolveModeratorSecret() {
  const root = process.env.PERSONAL_PLAN_FIELD_TEST_COOKIE_SIGNING_SECRET
  return root ? `${root}:personal-plan-moderator-intent:v1` : null
}

function decodeModeratorIntent(
  value: string | null | undefined,
  secret: string | null | undefined,
  now: number,
): ModeratorIntent | null {
  if (!value || !secret) return null
  const [payload, signature, extra] = value.split(".")
  if (!payload || !signature || extra) return null
  const expected = createHmac("sha256", secret).update(payload).digest("base64url")
  if (!safeEqual(signature, expected)) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    const wrapper = parsed as Record<string, unknown>
    if (wrapper.version !== VERSION || !isModeratorIntent(wrapper.payload)) return null
    if (wrapper.payload.issuedAt > now || wrapper.payload.expiresAt <= now) return null
    return wrapper.payload
  } catch {
    return null
  }
}

function isModeratorIntent(value: unknown): value is ModeratorIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const intent = value as Record<string, unknown>
  return (
    typeof intent.campaignId === "string" &&
    UUID.test(intent.campaignId) &&
    typeof intent.userId === "string" &&
    UUID.test(intent.userId) &&
    typeof intent.funnelSessionId === "string" &&
    UUID.test(intent.funnelSessionId) &&
    (intent.leadId === undefined ||
      (typeof intent.leadId === "string" && UUID.test(intent.leadId))) &&
    Number.isFinite(intent.issuedAt) &&
    Number.isFinite(intent.expiresAt) &&
    Number(intent.expiresAt) > Number(intent.issuedAt)
  )
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

async function loadMemberByCampaignAndUser(
  client: SupabaseLikeClient,
  campaignId: string,
  userId: string,
) {
  const { data, error } = await client
    .from("personal_plan_test_members")
    .select(
      "id,campaign_id,user_id,normalized_email,status,reset_receipt_ref,enrollment_id,revoked_at",
    )
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return (data as MemberRow | null) ?? null
}

async function loadLatestMemberForUser(client: SupabaseLikeClient, userId: string) {
  let query = client
    .from("personal_plan_test_members")
    .select(
      "id,campaign_id,user_id,normalized_email,status,reset_receipt_ref,enrollment_id,revoked_at",
    )
    .eq("user_id", userId)
  query = query.order ? query.order("created_at", { ascending: false }) : query
  query = query.limit ? query.limit(1) : query
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return (data as MemberRow | null) ?? null
}

async function loadCampaign(client: SupabaseLikeClient, campaignId: string) {
  const { data, error } = await client
    .from("personal_plan_test_campaigns")
    .select(
      "id,status,flow_kind,identity_mode,starts_at,expires_at,max_activations,access_duration_hours,revoked_at",
    )
    .eq("id", campaignId)
    .maybeSingle()
  if (error) throw error
  return (data as CampaignRow | null) ?? null
}

async function loadEnrollment(client: SupabaseLikeClient, enrollmentId: string) {
  const { data, error } = await client
    .from("personal_plan_test_enrollments")
    .select(
      "id,campaign_id,user_id,lead_id,funnel_session_id,manual_access_grant_id,status,activated_at,expires_at,revoked_at,manual_access_grants!inner(id,user_id,reason,expires_at,revoked_at)",
    )
    .eq("id", enrollmentId)
    .maybeSingle()
  if (error) throw error
  return (data as EnrollmentRow | null) ?? null
}

function memberReference(member: MemberRow): ModeratorMemberRef | null {
  return typeof member.id === "string" && typeof member.user_id === "string"
    ? { id: member.id, userId: member.user_id }
    : null
}

function resolveCampaignRef(campaign: CampaignRow | null): ModeratorCampaignRef | null {
  if (
    !campaign ||
    typeof campaign.id !== "string" ||
    campaign.status !== "active" ||
    isSet(campaign.revoked_at) ||
    campaign.flow_kind !== "personal_plan" ||
    campaign.identity_mode !== "email_bound" ||
    typeof campaign.expires_at !== "string" ||
    typeof campaign.access_duration_hours !== "number" ||
    campaign.access_duration_hours !== 2160
  ) {
    return null
  }
  const expiresAt = Date.parse(campaign.expires_at)
  return Number.isFinite(expiresAt)
    ? { id: campaign.id, expiresAt, accessDurationHours: campaign.access_duration_hours }
    : null
}

function isEmailBoundCampaign(campaign: CampaignRow | null) {
  return (
    campaign?.flow_kind === "personal_plan" &&
    campaign.identity_mode === "email_bound" &&
    campaign.access_duration_hours === 2160
  )
}

function isCampaignOpen(campaign: CampaignRow | null, now: number) {
  if (!resolveCampaignRef(campaign)) return false
  const startsAt = typeof campaign?.starts_at === "string" ? Date.parse(campaign.starts_at) : NaN
  const expiresAt = typeof campaign?.expires_at === "string" ? Date.parse(campaign.expires_at) : NaN
  return (
    Number.isFinite(startsAt) && Number.isFinite(expiresAt) && startsAt <= now && now < expiresAt
  )
}

function resolveEnrollmentAccess(
  enrollment: EnrollmentRow | null,
  userId: string,
  campaignId: string,
  now: number,
): { kind: "active"; expiresAt: string } | { kind: "ended"; reason: "expired" | "revoked" } {
  const grant = enrollment?.manual_access_grants as GrantRow | null
  if (
    !enrollment ||
    enrollment.campaign_id !== campaignId ||
    enrollment.user_id !== userId ||
    enrollment.status !== "active" ||
    isSet(enrollment.revoked_at) ||
    !grant ||
    grant.id !== enrollment.manual_access_grant_id ||
    grant.user_id !== userId ||
    grant.reason !== "tester" ||
    isSet(grant.revoked_at)
  ) {
    return { kind: "ended", reason: "revoked" }
  }
  const enrollmentExpiry =
    typeof enrollment.expires_at === "string" ? Date.parse(enrollment.expires_at) : NaN
  const grantExpiry = typeof grant.expires_at === "string" ? Date.parse(grant.expires_at) : NaN
  if (!Number.isFinite(enrollmentExpiry) || !Number.isFinite(grantExpiry)) {
    return { kind: "ended", reason: "revoked" }
  }
  if (enrollmentExpiry <= now || grantExpiry <= now) return { kind: "ended", reason: "expired" }
  return { kind: "active", expiresAt: enrollment.expires_at as string }
}

function isSet(value: unknown) {
  return value !== null && value !== undefined
}

function isMissingModeratorRoster(error: unknown) {
  if (!error || typeof error !== "object" || Array.isArray(error)) return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === "string" ? candidate.code : ""
  const message = typeof candidate.message === "string" ? candidate.message : ""
  return (code === "42P01" || code === "PGRST205") && message.includes("personal_plan_test_members")
}
