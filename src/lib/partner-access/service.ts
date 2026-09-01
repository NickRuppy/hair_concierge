import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

import { decodePartnerInvitationCredential, projectPartnerInvitationCredential } from "./token"
import type { PartnerAccessIntent } from "./intent"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type RpcResult = { data: unknown; error: unknown }
type PartnerRpc = (name: string, args: Record<string, unknown>) => Promise<RpcResult>

type InvitationRow = {
  id: string
  display_name: string
  normalized_email: string
  token_version: number
  claimed_user_id: string | null
  activated_at: string | null
  revoked_at: string | null
  current_manual_access_grant_id: string | null
}

type CreatedRow = {
  invitation_id: string
  display_name: string
  normalized_email: string
  token_version: number
}

export type PartnerInvitationInput = { name: string; email: string }
export type PartnerInvitationReceipt = {
  invitationId: string
  name: string
  email: string
  credential: string
  url: string
  message: string
}

export type PartnerInvitationResolution = {
  invitationId: string
  name: string
  email: string
  state: "pending" | "claimed" | "active"
}

export type PartnerInvitationStatus = "invited" | "claimed" | "active" | "revoked"

export type PartnerInvitationListItem = {
  invitationId: string
  name: string
  email: string
  status: PartnerInvitationStatus
  claimedAt: string | null
  activatedAt: string | null
  revokedAt: string | null
  emailStatus: "not_requested" | "sent" | "failed"
  url: string
  message: string
}

function normalizeInput(input: PartnerInvitationInput): PartnerInvitationInput {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name || name.length > 120) throw new Error("Bitte gib einen gültigen Namen ein.")
  if (!EMAIL.test(email) || email.length > 320) {
    throw new Error("Bitte gib eine gültige E-Mail-Adresse ein.")
  }
  return { name, email }
}

function signingSecret(explicit?: string) {
  const secret = explicit ?? process.env.PARTNER_ACCESS_INVITATION_SIGNING_SECRET
  if (!secret) throw new Error("Partner access is not configured")
  return secret
}

function publicSiteUrl(explicit?: string) {
  const value = explicit ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://chaarlie.de"
  return value.replace(/\/$/, "")
}

function projectInvitationLink(input: {
  invitationId: string
  name: string
  tokenVersion: number
  secret: string
  siteUrl: string
}) {
  const credential = projectPartnerInvitationCredential(
    { invitationId: input.invitationId, tokenVersion: input.tokenVersion },
    input.secret,
  )
  const url = `${input.siteUrl}/partner/einladung#code=${encodeURIComponent(credential)}`
  const firstName = input.name.trim().split(/\s+/)[0] || input.name
  return {
    credential,
    url,
    message: `Hi ${firstName}, dein Zugang ist bereit:\n${url}`,
  }
}

function defaultRpc(name: string, args: Record<string, unknown>) {
  return createAdminClient().rpc(name, args) as unknown as Promise<RpcResult>
}

async function defaultLoadInvitation(id: string): Promise<InvitationRow | null> {
  const { data, error } = await createAdminClient()
    .from("partner_access_invitations")
    .select(
      "id,display_name,normalized_email,token_version,claimed_user_id,activated_at,revoked_at,current_manual_access_grant_id",
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return (data as InvitationRow | null) ?? null
}

export async function createPartnerInvitations(
  inputs: PartnerInvitationInput[],
  dependencies: {
    secret?: string
    siteUrl?: string
    createdByUserId?: string | null
    rpc?: PartnerRpc
  } = {},
): Promise<PartnerInvitationReceipt[]> {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 100) {
    throw new Error("Bitte füge zwischen 1 und 100 Creator hinzu.")
  }
  const normalized = inputs.map(normalizeInput)
  if (new Set(normalized.map((input) => input.email)).size !== normalized.length) {
    throw new Error("Jede E-Mail-Adresse darf nur einmal vorkommen.")
  }
  const secret = signingSecret(dependencies.secret)
  const siteUrl = publicSiteUrl(dependencies.siteUrl)
  const { data, error } = await (dependencies.rpc ?? defaultRpc)(
    "create_partner_access_invitations",
    {
      p_invitations: normalized,
      p_created_by_user_id: dependencies.createdByUserId ?? null,
    },
  )
  if (error) throw new Error("Creator-Zugänge konnten nicht erstellt werden.")
  const rows = Array.isArray(data) ? (data as CreatedRow[]) : []
  if (rows.length !== normalized.length) {
    throw new Error("Creator-Zugänge konnten nicht vollständig erstellt werden.")
  }
  return rows.map((row) => {
    const projection = projectInvitationLink({
      invitationId: row.invitation_id,
      name: row.display_name,
      tokenVersion: row.token_version,
      secret,
      siteUrl,
    })
    return {
      invitationId: row.invitation_id,
      name: row.display_name,
      email: row.normalized_email,
      ...projection,
    }
  })
}

export async function listPartnerInvitations(
  dependencies: {
    secret?: string
    siteUrl?: string
    load?: () => Promise<Array<Record<string, unknown>>>
  } = {},
): Promise<PartnerInvitationListItem[]> {
  const secret = signingSecret(dependencies.secret)
  const siteUrl = publicSiteUrl(dependencies.siteUrl)
  const rows: Array<Record<string, unknown>> = dependencies.load
    ? await dependencies.load()
    : await defaultListInvitations()
  return rows.map((row) => {
    const invitationId = String(row.id)
    const name = String(row.display_name)
    const projection = projectInvitationLink({
      invitationId,
      name,
      tokenVersion: Number(row.token_version),
      secret,
      siteUrl,
    })
    const activatedAt = typeof row.activated_at === "string" ? row.activated_at : null
    const claimedAt = typeof row.claimed_at === "string" ? row.claimed_at : null
    const revokedAt = typeof row.revoked_at === "string" ? row.revoked_at : null
    return {
      invitationId,
      name,
      email: String(row.normalized_email),
      status: derivePartnerInvitationStatus({
        claimedAt,
        activatedAt,
        revokedAt,
        grantActive: row.grant_active === true,
      }),
      claimedAt,
      activatedAt,
      revokedAt,
      emailStatus:
        row.invitation_email_status === "sent" || row.invitation_email_status === "failed"
          ? row.invitation_email_status
          : "not_requested",
      url: projection.url,
      message: projection.message,
    }
  })
}

async function defaultListInvitations() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("partner_access_invitations")
    .select(
      "id,display_name,normalized_email,token_version,claimed_at,activated_at,revoked_at,current_manual_access_grant_id,invitation_email_status",
    )
    .order("created_at", { ascending: false })
    .limit(250)
  if (error) throw error
  const rows = (data as Array<Record<string, unknown>> | null) ?? []
  const grantIds = rows
    .map((row) => row.current_manual_access_grant_id)
    .filter((value): value is string => typeof value === "string")
  if (grantIds.length === 0) return rows.map((row) => ({ ...row, grant_active: false }))
  const grants = await admin.from("manual_access_grants").select("id,revoked_at").in("id", grantIds)
  if (grants.error) throw grants.error
  const active = new Set(
    ((grants.data as Array<Record<string, unknown>> | null) ?? [])
      .filter((row) => row.revoked_at === null)
      .map((row) => String(row.id)),
  )
  return rows.map((row) => ({
    ...row,
    grant_active:
      typeof row.current_manual_access_grant_id === "string" &&
      active.has(row.current_manual_access_grant_id),
  }))
}

export async function resolvePartnerInvitation(
  credential: string | null | undefined,
  dependencies: {
    secret?: string
    loadInvitation?: (id: string) => Promise<InvitationRow | null>
  } = {},
): Promise<PartnerInvitationResolution | null> {
  const decoded = decodePartnerInvitationCredential(credential, signingSecret(dependencies.secret))
  if (!decoded) return null
  return resolvePartnerInvitationByIntent(decoded, dependencies)
}

export async function resolvePartnerInvitationByIntent(
  intent: Pick<PartnerAccessIntent, "invitationId" | "tokenVersion">,
  dependencies: { loadInvitation?: (id: string) => Promise<InvitationRow | null> } = {},
): Promise<PartnerInvitationResolution | null> {
  try {
    const row = await (dependencies.loadInvitation ?? defaultLoadInvitation)(intent.invitationId)
    if (!row || row.revoked_at !== null || row.token_version !== intent.tokenVersion) return null
    return projectPartnerInvitation(row)
  } catch {
    return null
  }
}

function projectPartnerInvitation(row: InvitationRow): PartnerInvitationResolution {
  return {
    invitationId: row.id,
    name: row.display_name,
    email: row.normalized_email,
    state: row.activated_at ? "active" : row.claimed_user_id ? "claimed" : "pending",
  }
}

export function derivePartnerInvitationStatus(input: {
  claimedAt: string | null
  revokedAt: string | null
  activatedAt: string | null
  grantActive: boolean
}): PartnerInvitationStatus {
  if (input.revokedAt || (input.activatedAt && !input.grantActive)) return "revoked"
  if (input.activatedAt && input.grantActive) return "active"
  return input.claimedAt ? "claimed" : "invited"
}

export async function mutatePartnerInvitation(
  action: "revoke" | "reactivate" | "rotate",
  invitationId: string,
  dependencies: { rpc?: PartnerRpc } = {},
) {
  const functions = {
    revoke: "revoke_partner_access",
    reactivate: "reactivate_partner_access",
    rotate: "rotate_partner_access_invitation",
  } as const
  const { data, error } = await (dependencies.rpc ?? defaultRpc)(functions[action], {
    p_invitation_id: invitationId,
  })
  if (error) throw new Error("Creator-Zugang konnte nicht aktualisiert werden.")
  return Array.isArray(data) ? (data[0] ?? null) : data
}
