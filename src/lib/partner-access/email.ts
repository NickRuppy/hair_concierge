import "server-only"

import {
  sendCustomerIoTransactionalEmailWithReceipt,
  type CustomerIoTransactionalEmailPayload,
} from "@/lib/customerio/transactional"
import { createAdminClient } from "@/lib/supabase/admin"

import { projectPartnerInvitationCredential } from "./token"

type PartnerEmailKind = "invitation" | "account_ready"

function messageId(kind: PartnerEmailKind) {
  const key =
    kind === "invitation"
      ? "CUSTOMERIO_PARTNER_INVITATION_TRANSACTIONAL_MESSAGE_ID"
      : "CUSTOMERIO_PARTNER_ACCOUNT_READY_TRANSACTIONAL_MESSAGE_ID"
  const value = process.env[key]
  if (!value) throw new Error(`${key} is not configured`)
  return value
}

function receiptDate(value: string | number) {
  const normalized = typeof value === "number" && value < 1_000_000_000_000 ? value * 1000 : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export function buildPartnerInvitationEmail(input: {
  name: string
  email: string
  url: string
  transactionalMessageId?: string | number
}): CustomerIoTransactionalEmailPayload {
  const firstName = input.name.trim().split(/\s+/)[0] || input.name
  return {
    to: input.email,
    transactionalMessageId: input.transactionalMessageId ?? messageId("invitation"),
    messageData: { first_name: firstName, invitation_url: input.url },
  }
}

export function buildPartnerAccountReadyEmail(input: {
  name: string
  email: string
  loginUrl: string
  transactionalMessageId?: string | number
}): CustomerIoTransactionalEmailPayload {
  const firstName = input.name.trim().split(/\s+/)[0] || input.name
  return {
    to: input.email,
    transactionalMessageId: input.transactionalMessageId ?? messageId("account_ready"),
    messageData: { first_name: firstName, login_url: input.loginUrl },
  }
}

export async function sendPartnerInvitationEmail(invitationId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("partner_access_invitations")
    .select("id,display_name,normalized_email,token_version,revoked_at")
    .eq("id", invitationId)
    .maybeSingle()
  if (error || !data || data.revoked_at) throw error ?? new Error("Partner invitation unavailable")
  const secret = process.env.PARTNER_ACCESS_INVITATION_SIGNING_SECRET
  if (!secret) throw new Error("Partner access is not configured")
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://chaarlie.de").replace(/\/$/, "")
  const credential = projectPartnerInvitationCredential(
    { invitationId: data.id, tokenVersion: data.token_version },
    secret,
  )
  const url = `${siteUrl}/partner/einladung#code=${encodeURIComponent(credential)}`
  const attemptedAt = new Date().toISOString()
  try {
    const receipt = await sendCustomerIoTransactionalEmailWithReceipt(
      buildPartnerInvitationEmail({
        name: data.display_name,
        email: data.normalized_email,
        url,
      }),
    )
    await admin
      .from("partner_access_invitations")
      .update({
        invitation_email_status: "sent",
        invitation_email_message_id: receipt.deliveryId,
        invitation_email_accepted_at: receiptDate(receipt.queuedAt),
        invitation_email_last_attempt_at: attemptedAt,
      })
      .eq("id", invitationId)
    return { status: "sent" as const }
  } catch (sendError) {
    await admin
      .from("partner_access_invitations")
      .update({
        invitation_email_status: "failed",
        invitation_email_last_attempt_at: attemptedAt,
      })
      .eq("id", invitationId)
    throw sendError
  }
}

export async function sendPartnerAccountReadyEmailBestEffort(invitationId: string) {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("partner_access_invitations")
      .select("display_name,normalized_email,revoked_at")
      .eq("id", invitationId)
      .maybeSingle()
    if (error || !data || data.revoked_at) return false
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://chaarlie.de").replace(/\/$/, "")
    await sendCustomerIoTransactionalEmailWithReceipt(
      buildPartnerAccountReadyEmail({
        name: data.display_name,
        email: data.normalized_email,
        loginUrl: `${siteUrl}/auth`,
      }),
    )
    return true
  } catch {
    return false
  }
}
