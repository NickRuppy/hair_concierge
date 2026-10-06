export const MODERATOR_INTENT_COOKIE = "chaarlie_personal_plan_moderator_intent"
export const MODERATOR_ACCESS_UNAVAILABLE_CODE = "moderator_access_unavailable" as const

export type ModeratorUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
}

export type ModeratorFunnelContext = {
  sessionId: string
  packageKey: string
}

export type ModeratorCampaignRef = {
  id: string
  expiresAt: number
  accessDurationHours: number
}

export type ModeratorMemberRef = {
  id: string
  userId: string
}

export type ModeratorIntent = {
  campaignId: string
  userId: string
  funnelSessionId: string
  leadId?: string
  issuedAt: number
  expiresAt: number
}

export type ModeratorMemberResolution =
  | { kind: "ready"; campaign: ModeratorCampaignRef; member: ModeratorMemberRef }
  | { kind: "active"; campaignId: string; expiresAt: string; member?: ModeratorMemberRef }
  | { kind: "ended"; campaignId?: string; reason?: "expired" | "revoked" }
  | {
      kind: "forbidden"
      reason?:
        | "missing_confirmed_email"
        | "email_mismatch"
        | "not_rostered"
        | "not_ready"
        | "wrong_campaign"
    }
  | { kind: "unavailable"; code?: typeof MODERATOR_ACCESS_UNAVAILABLE_CODE }

export type ModeratorAccessResolution =
  | { kind: "active"; campaignId: string; expiresAt: string }
  | { kind: "ended"; campaignId: string; reason?: "expired" | "revoked" }
  | { kind: "none" }
  | { kind: "unavailable"; code?: typeof MODERATOR_ACCESS_UNAVAILABLE_CODE }

export type ModeratorIntentResolution =
  | {
      kind: "ready"
      intent: ModeratorIntent
      campaign: ModeratorCampaignRef
      member: ModeratorMemberRef
    }
  | {
      kind: "active"
      intent: ModeratorIntent
      campaignId: string
      expiresAt: string
      member?: ModeratorMemberRef
    }
  | { kind: "forbidden"; reason?: string }
  | { kind: "unavailable"; code?: typeof MODERATOR_ACCESS_UNAVAILABLE_CODE }
