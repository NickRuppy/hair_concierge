import "server-only"

import type { FunnelCookieContext } from "@/lib/funnel/cookie"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { MODERATOR_INTENT_COOKIE, type ModeratorUser } from "./moderator-contract"
import { resolveModeratorIntent } from "./moderator"
import { PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE } from "./constants"
import { resolvePersonalPlanFieldTestCampaignCookie } from "./server"

type CookieReader = { get(name: string): { value: string } | undefined }

/** The lead remains account-only even if a later quiz replaces its funnel link. */
export async function loadModeratorResultCampaign(
  leadId: string,
  loadRow = async (
    id: string,
  ): Promise<{
    data: { moderator_campaign_id: string | null } | null
    error: { code?: string; message?: string } | null
  }> =>
    createAdminClient().from("leads").select("moderator_campaign_id").eq("id", id).maybeSingle(),
) {
  try {
    const { data, error } = await loadRow(leadId)
    if (error) {
      // Before this additive migration there cannot be an email-bound lead.
      if (
        ["42703", "PGRST204"].includes(error.code ?? "") &&
        error.message?.includes("moderator_campaign_id")
      )
        return { kind: "ordinary" as const }
      return { kind: "unavailable" as const }
    }
    return data?.moderator_campaign_id
      ? { kind: "moderator" as const, campaignId: data.moderator_campaign_id }
      : { kind: "ordinary" as const }
  } catch {
    return { kind: "unavailable" as const }
  }
}

type ResultFunnelRow = {
  id: string
  visitor_id: string
  package_key: string
  first_seen_at: string
  offer_variant: string | null
  offer_viewed_at: string | null
  checkout_started_at: string | null
  is_internal_test: boolean
  test_kind: string | null
  field_test_campaign_id: string | null
}

/** Result authorization must remain available when analytics is disabled. */
export async function loadPersonalPlanResultFunnel(
  leadId: string,
  loadRow = async (id: string): Promise<{ data: ResultFunnelRow | null; error: unknown }> => {
    return createAdminClient()
      .from("funnel_sessions")
      .select(
        "id,visitor_id,package_key,first_seen_at,offer_variant,offer_viewed_at,checkout_started_at,is_internal_test,test_kind,field_test_campaign_id",
      )
      .eq("lead_id", id)
      .order("first_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  },
) {
  try {
    const { data, error } = await loadRow(leadId)
    if (error) return { kind: "unavailable" as const }
    return {
      kind: "loaded" as const,
      context: data
        ? {
            sessionId: data.id,
            visitorId: data.visitor_id,
            packageKey: data.package_key,
            issuedAt: Date.parse(data.first_seen_at),
            offerVariant: data.offer_variant,
            offerViewedAt: data.offer_viewed_at,
            checkoutStartedAt: data.checkout_started_at,
            isInternalTest: data.is_internal_test,
            testKind: data.test_kind,
            fieldTestCampaignId: data.field_test_campaign_id,
          }
        : null,
    }
  } catch {
    return { kind: "unavailable" as const }
  }
}

export type ModeratorJourney =
  | { kind: "ordinary" }
  | { kind: "unavailable" }
  | {
      kind: "authorized"
      campaignId: string
      userId: string
      email: string
      funnelSessionId: string
    }

export async function loadFunnelIdentityMode(
  sessionId: string,
): Promise<"guest" | "email_bound" | "unavailable" | null> {
  const admin = createAdminClient()
  const { data: funnel, error } = await admin
    .from("funnel_sessions")
    .select("field_test_campaign_id")
    .eq("id", sessionId)
    .maybeSingle()
  if (error) return "unavailable"
  if (!funnel?.field_test_campaign_id) return null
  const { data: campaign, error: campaignError } = await admin
    .from("personal_plan_test_campaigns")
    .select("identity_mode")
    .eq("id", funnel.field_test_campaign_id)
    .maybeSingle()
  if (campaignError) {
    if (
      ["42703", "PGRST204"].includes(campaignError.code) &&
      campaignError.message.includes("identity_mode")
    )
      return "guest"
    return "unavailable"
  }
  return campaign?.identity_mode === "guest" || campaign?.identity_mode === "email_bound"
    ? campaign.identity_mode
    : "unavailable"
}

type ModeratorJourneyDependencies = {
  loadMode: typeof loadFunnelIdentityMode
  resolveCampaign: typeof resolvePersonalPlanFieldTestCampaignCookie
  resolveIntent: typeof resolveModeratorIntent
  getUser: () => Promise<ModeratorUser | null>
}

/** Cookie removal cannot turn a persisted moderator session into a paid funnel. */
export async function resolveModeratorJourney(
  input: {
    cookies: CookieReader
    funnelContext: FunnelCookieContext | null
    leadId?: string
  },
  overrides: Partial<ModeratorJourneyDependencies> = {},
): Promise<ModeratorJourney> {
  const dependencies: ModeratorJourneyDependencies = {
    loadMode: loadFunnelIdentityMode,
    resolveCampaign: resolvePersonalPlanFieldTestCampaignCookie,
    resolveIntent: resolveModeratorIntent,
    getUser: async () => (await (await createClient()).auth.getUser()).data.user,
    ...overrides,
  }
  try {
    const intent = input.cookies.get(MODERATOR_INTENT_COOKIE)?.value
    const cookie = input.cookies.get(PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE)?.value
    const mode = input.funnelContext
      ? await dependencies.loadMode(input.funnelContext.sessionId)
      : null
    if (mode === "unavailable") return { kind: "unavailable" }
    const campaign = cookie ? await dependencies.resolveCampaign(cookie) : null
    const moderator =
      Boolean(intent) ||
      mode === "email_bound" ||
      (campaign?.kind === "eligible" && campaign.campaign.identityMode === "email_bound")
    if (!moderator) return { kind: "ordinary" }
    if (
      !intent ||
      !input.funnelContext ||
      campaign?.kind !== "eligible" ||
      campaign.campaign.identityMode !== "email_bound"
    )
      return { kind: "unavailable" }
    const user = await dependencies.getUser()
    if (!user?.email || !user.email_confirmed_at) return { kind: "unavailable" }
    const resolved = await dependencies.resolveIntent(intent, user, input.funnelContext, {
      leadId: input.leadId,
    })
    if (resolved.kind !== "ready" || resolved.intent.campaignId !== campaign.campaign.id)
      return { kind: "unavailable" }
    return {
      kind: "authorized",
      campaignId: resolved.intent.campaignId,
      userId: user.id,
      email: user.email.trim().toLowerCase(),
      funnelSessionId: input.funnelContext.sessionId,
    }
  } catch {
    return { kind: "unavailable" }
  }
}
