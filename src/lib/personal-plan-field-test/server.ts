import "server-only"

import type { FunnelCookieContext } from "@/lib/funnel/cookie"
import { createAdminClient } from "@/lib/supabase/admin"

import {
  decodePersonalPlanFieldTestCampaignCookie,
  type PersonalPlanFieldTestCampaignCookie,
} from "./campaign-cookie"
import {
  isMissingPersonalPlanFieldTestFunnelColumn,
  personalPlanFieldTestUnavailable,
  type PersonalPlanFieldTestUnavailable,
} from "./errors"
import {
  evaluatePersonalPlanFieldTestCampaign,
  type PersonalPlanFieldTestCampaignLifecycle,
} from "./lifecycle"
import { hashPersonalPlanFieldTestToken } from "./token"

type CampaignRow = {
  id: string
  status: "active" | "revoked"
  starts_at: string
  expires_at: string
  max_activations: number
  access_duration_hours: number
}

type CampaignLifecycle = PersonalPlanFieldTestCampaignLifecycle

export type EligiblePersonalPlanFieldTestCampaign = {
  kind: "eligible"
  campaign: {
    id: string
    accessDurationHours: number
    startsAt: number
    expiresAt: number
  }
}

export type PersonalPlanFieldTestCampaignResolution =
  | EligiblePersonalPlanFieldTestCampaign
  | PersonalPlanFieldTestUnavailable

type CampaignDependencies = {
  now?: number
  cookieSecret?: string
  loadCampaignByTokenHash?: (tokenHash: string) => Promise<CampaignLifecycle | null>
  loadCampaignById?: (campaignId: string) => Promise<CampaignLifecycle | null>
}

type OfferSession = {
  id: string
  leadId: string | null
  packageKey: string
  testKind: string | null
  campaignId: string | null
}

export type PersonalPlanFieldTestOfferAuthorization = {
  campaignId: string
  funnelSessionId: string
  leadId: string
  accessDurationHours: number
}

type FieldTestEnrollmentIdentity = {
  campaignId: string
  funnelSessionId: string
  leadId: string
  userId: string
}

function resolveCookieSecret(explicit?: string) {
  const root = explicit ?? process.env.PERSONAL_PLAN_FIELD_TEST_COOKIE_SIGNING_SECRET
  return root ? `${root}:personal-plan-field-test:v1` : null
}

function eligibleCampaign(
  campaign: CampaignLifecycle,
  now: number,
): PersonalPlanFieldTestCampaignResolution {
  const evaluation = evaluatePersonalPlanFieldTestCampaign(campaign, now)
  if (evaluation.kind !== "eligible") return evaluation
  return {
    kind: "eligible",
    campaign: {
      id: campaign.id,
      accessDurationHours: campaign.accessDurationHours,
      startsAt: campaign.startsAt,
      expiresAt: campaign.expiresAt,
    },
  }
}

export async function resolvePersonalPlanFieldTestCampaignToken(
  token: string,
  dependencies: CampaignDependencies = {},
): Promise<PersonalPlanFieldTestCampaignResolution> {
  if (!token || token.length > 512) return personalPlanFieldTestUnavailable()
  try {
    const campaign = await (dependencies.loadCampaignByTokenHash ?? loadCampaignByTokenHash)(
      hashPersonalPlanFieldTestToken(token),
    )
    return campaign
      ? eligibleCampaign(campaign, dependencies.now ?? Date.now())
      : personalPlanFieldTestUnavailable()
  } catch {
    return personalPlanFieldTestUnavailable()
  }
}

export async function resolvePersonalPlanFieldTestCampaignCookie(
  value: string | null | undefined,
  dependencies: CampaignDependencies = {},
): Promise<PersonalPlanFieldTestCampaignResolution> {
  const now = dependencies.now ?? Date.now()
  const secret = resolveCookieSecret(dependencies.cookieSecret)
  const cookie = decodePersonalPlanFieldTestCampaignCookie(value, secret, now)
  if (!cookie) return personalPlanFieldTestUnavailable()
  try {
    const campaign = await (dependencies.loadCampaignById ?? loadCampaignById)(cookie.campaignId)
    if (!campaign) return personalPlanFieldTestUnavailable()
    const resolved = eligibleCampaign(campaign, now)
    if (
      resolved.kind !== "eligible" ||
      resolved.campaign.accessDurationHours !== cookie.accessDurationHours ||
      resolved.campaign.expiresAt !== cookie.expiresAt
    ) {
      return personalPlanFieldTestUnavailable()
    }
    return resolved
  } catch {
    return personalPlanFieldTestUnavailable()
  }
}

export function personalPlanFieldTestCookieSecret(explicit?: string) {
  return resolveCookieSecret(explicit)
}

export async function resolvePersonalPlanFieldTestOfferAuthorization(
  input: {
    campaignCookieValue: string | null | undefined
    funnelSessionId?: string | null
    leadId: string
  },
  dependencies: CampaignDependencies & {
    loadOfferSession?: (leadId: string, sessionId?: string | null) => Promise<OfferSession | null>
  } = {},
): Promise<PersonalPlanFieldTestOfferAuthorization | null> {
  const campaign = await resolvePersonalPlanFieldTestCampaignCookie(
    input.campaignCookieValue,
    dependencies,
  )
  if (campaign.kind !== "eligible") return null
  try {
    const session = await (dependencies.loadOfferSession ?? loadOfferSession)(
      input.leadId,
      input.funnelSessionId,
    )
    if (
      !session ||
      session.id !== (input.funnelSessionId ?? session.id) ||
      session.leadId !== input.leadId ||
      session.packageKey !== "meta_personal_plan_v1" ||
      session.testKind !== "field_test" ||
      session.campaignId !== campaign.campaign.id
    ) {
      return null
    }
    return {
      campaignId: campaign.campaign.id,
      funnelSessionId: session.id,
      leadId: input.leadId,
      accessDurationHours: campaign.campaign.accessDurationHours,
    }
  } catch {
    return null
  }
}

export async function hasPersonalPlanFieldTestOfferIntent(
  input: { leadId: string; funnelSessionId?: string | null },
  dependencies: {
    loadOfferSession?: (leadId: string, sessionId?: string | null) => Promise<OfferSession | null>
  } = {},
) {
  try {
    const session = await (dependencies.loadOfferSession ?? loadOfferSession)(
      input.leadId,
      input.funnelSessionId,
    )
    return Boolean(
      session &&
      session.leadId === input.leadId &&
      session.id === (input.funnelSessionId ?? session.id) &&
      session.packageKey === "meta_personal_plan_v1" &&
      session.testKind === "field_test" &&
      typeof session.campaignId === "string",
    )
  } catch (error) {
    // Before the additive field-test migration exists, the test_kind columns
    // are unavailable. That is normal absence and must not break paid results.
    if (isMissingPersonalPlanFieldTestFunnelColumn(error)) return false
    // Once the columns should exist, uncertainty must not expose a paid offer
    // inside a journey that may be a field test.
    return true
  }
}

export async function bindPersonalPlanFieldTestLead(
  input: {
    campaignCookieValue: string | null | undefined
    funnelContext: FunnelCookieContext
    leadId: string
  },
  dependencies: CampaignDependencies & {
    bindFunnel?: (args: Record<string, unknown>) => Promise<boolean>
  } = {},
) {
  if (input.funnelContext.packageKey !== "meta_personal_plan_v1") return false
  const campaign = await resolvePersonalPlanFieldTestCampaignCookie(
    input.campaignCookieValue,
    dependencies,
  )
  if (campaign.kind !== "eligible") return false
  const args = {
    p_campaign_id: campaign.campaign.id,
    p_funnel_session_id: input.funnelContext.sessionId,
    p_lead_id: input.leadId,
  }
  try {
    return await (dependencies.bindFunnel ?? bindFunnel)(args)
  } catch {
    return false
  }
}

export async function isPersonalPlanFieldTestGuestRetry(
  input: FieldTestEnrollmentIdentity,
  dependencies?: {
    loadEnrollment?: (
      input: FieldTestEnrollmentIdentity,
    ) => Promise<FieldTestEnrollmentIdentity | null>
  },
) {
  try {
    const row = await (dependencies?.loadEnrollment ?? loadFieldTestEnrollment)(input)
    return Boolean(
      row &&
      row.campaignId === input.campaignId &&
      row.funnelSessionId === input.funnelSessionId &&
      row.leadId === input.leadId &&
      row.userId === input.userId,
    )
  } catch {
    return false
  }
}

async function loadCampaignByTokenHash(tokenHash: string) {
  const { data, error } = await createAdminClient()
    .from("personal_plan_test_campaigns")
    .select("id, status, starts_at, expires_at, max_activations, access_duration_hours")
    .eq("token_hash", tokenHash)
    .maybeSingle()
  if (error || !data) return null
  return loadCampaignLifecycle(data as CampaignRow)
}

async function loadCampaignById(campaignId: string) {
  const { data, error } = await createAdminClient()
    .from("personal_plan_test_campaigns")
    .select("id, status, starts_at, expires_at, max_activations, access_duration_hours")
    .eq("id", campaignId)
    .maybeSingle()
  if (error || !data) return null
  return loadCampaignLifecycle(data as CampaignRow)
}

async function loadCampaignLifecycle(row: CampaignRow): Promise<CampaignLifecycle | null> {
  const { count, error } = await createAdminClient()
    .from("personal_plan_test_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", row.id)
  if (error) return null
  const startsAt = Date.parse(row.starts_at)
  const expiresAt = Date.parse(row.expires_at)
  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt)) return null
  return {
    id: row.id,
    status: row.status,
    startsAt,
    expiresAt,
    maxActivations: row.max_activations,
    successfulActivations: count ?? 0,
    accessDurationHours: row.access_duration_hours,
  }
}

async function loadOfferSession(leadId: string, sessionId?: string | null) {
  let query = createAdminClient()
    .from("funnel_sessions")
    .select("id, lead_id, package_key, test_kind, field_test_campaign_id")
    .eq("lead_id", leadId)
    .eq("package_key", "meta_personal_plan_v1")
    .eq("test_kind", "field_test")
    .order("first_seen_at", { ascending: false })
    .limit(1)
  if (sessionId) query = query.eq("id", sessionId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    leadId: data.lead_id,
    packageKey: data.package_key,
    testKind: data.test_kind,
    campaignId: data.field_test_campaign_id,
  }
}

async function bindFunnel(args: Record<string, unknown>) {
  const { data, error } = await createAdminClient().rpc(
    "bind_personal_plan_field_test_funnel",
    args,
  )
  return !error && Array.isArray(data) && data.length === 1
}

async function loadFieldTestEnrollment(input: FieldTestEnrollmentIdentity) {
  const { data, error } = await createAdminClient()
    .from("personal_plan_test_enrollments")
    .select("campaign_id,funnel_session_id,lead_id,user_id")
    .eq("campaign_id", input.campaignId)
    .eq("funnel_session_id", input.funnelSessionId)
    .eq("lead_id", input.leadId)
    .eq("user_id", input.userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    campaignId: data.campaign_id,
    funnelSessionId: data.funnel_session_id,
    leadId: data.lead_id,
    userId: data.user_id,
  }
}

export type { PersonalPlanFieldTestCampaignCookie }
