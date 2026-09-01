import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { sendCustomerIoTransactionalEmailWithReceipt } from "@/lib/customerio/transactional"
import { createAdminClient } from "@/lib/supabase/admin"

export const PARTNER_EMAIL_CHANGE_TTL_MS = 30 * 60 * 1000

export function hashPartnerEmailChangeToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export async function issuePartnerEmailChange(input: {
  invitationId: string
  tokenVersion: number
  name: string
  email: string
  siteUrl: string
  now?: number
}) {
  const messageId = process.env.CUSTOMERIO_PARTNER_EMAIL_CHANGE_TRANSACTIONAL_MESSAGE_ID
  if (!messageId) throw new Error("Partner email-change template is not configured")
  const token = randomBytes(32).toString("base64url")
  const now = input.now ?? Date.now()
  const expiresAt = new Date(now + PARTNER_EMAIL_CHANGE_TTL_MS).toISOString()
  const admin = createAdminClient()
  const tokenHash = hashPartnerEmailChangeToken(token)
  const { error } = await admin.rpc("issue_partner_access_email_change", {
    p_invitation_id: input.invitationId,
    p_token_version: input.tokenVersion,
    p_proposed_normalized_email: input.email.trim().toLowerCase(),
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  })
  if (error) throw error

  const confirmationUrl = `${input.siteUrl.replace(/\/$/, "")}/partner/e-mail-bestaetigen#token=${encodeURIComponent(token)}`
  const firstName = input.name.trim().split(/\s+/)[0] || input.name
  try {
    return await sendCustomerIoTransactionalEmailWithReceipt({
      to: input.email,
      transactionalMessageId: messageId,
      messageData: { first_name: firstName, confirmation_url: confirmationUrl },
    })
  } catch (sendError) {
    await admin
      .from("partner_access_email_changes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .is("consumed_at", null)
    throw sendError
  }
}

export async function consumePartnerEmailChange(token: string) {
  const { data, error } = await createAdminClient().rpc("consume_partner_access_email_change", {
    p_token_hash: hashPartnerEmailChangeToken(token),
  })
  const row = Array.isArray(data) ? data[0] : null
  if (
    error ||
    !row ||
    typeof row !== "object" ||
    typeof row.invitation_id !== "string" ||
    typeof row.token_version !== "number"
  ) {
    throw error ?? new Error("Partner email change is unavailable")
  }
  return {
    invitationId: row.invitation_id as string,
    name: row.display_name as string,
    email: row.normalized_email as string,
    tokenVersion: row.token_version as number,
  }
}
