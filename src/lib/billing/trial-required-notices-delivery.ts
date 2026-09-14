import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildTrialRequiredNoticeMessage,
  type TrialRequiredNoticeKind,
  type TrialRequiredNoticeMessage,
} from "@/lib/billing/trial-required-notices"
import {
  sendTrialRequiredNotice,
  TRIAL_REQUIRED_NOTICE_MESSAGE_ID_ENV,
  REQUIRED_NOTICE_FROM_ENV,
  DEFAULT_REQUIRED_NOTICE_TRIGGER,
  DEFAULT_REQUIRED_NOTICE_SENDER,
} from "@/lib/customerio/trial-required-notices"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
} from "@/lib/customerio/transactional"
export const TRIAL_REQUIRED_NOTICE_LEASE_SECONDS = 90
export const TRIAL_REQUIRED_NOTICE_LIMIT = 1
export type TrialNoticeClaim = {
  notice_id: string
  attempt_id: string
  user_id: string
  kind: TrialRequiredNoticeKind
  snapshot: unknown
}
export type TrialNoticeOutcome =
  | { status: "queued"; deliveryId: string; queuedAt: string }
  | { status: "support_required"; errorCode: string }
type Dependencies = {
  messageId: string | undefined
  sender: string | undefined
  apiKeyPresent: boolean
  enqueueAnnual: () => Promise<void>
  claim: () => Promise<TrialNoticeClaim[]>
  recipient: (userId: string) => Promise<string | null>
  send: typeof sendTrialRequiredNotice
  settle: (
    claim: TrialNoticeClaim,
    outcome: TrialNoticeOutcome,
    message: TrialRequiredNoticeMessage | null,
  ) => Promise<void>
}
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await createAdminClient().rpc(name, args)
  if (error) throw new Error("Required notice storage operation failed")
  return data
}
const defaults: Dependencies = {
  messageId: process.env[TRIAL_REQUIRED_NOTICE_MESSAGE_ID_ENV] ?? DEFAULT_REQUIRED_NOTICE_TRIGGER,
  sender: process.env[REQUIRED_NOTICE_FROM_ENV] ?? DEFAULT_REQUIRED_NOTICE_SENDER,
  apiKeyPresent: Boolean(process.env.CUSTOMERIO_APP_API_KEY?.trim()),
  enqueueAnnual: async () => {
    await rpc("enqueue_due_trial_annual_notices", {})
  },
  claim: async () => {
    const data = await rpc("claim_trial_required_notices", {
      p_limit: TRIAL_REQUIRED_NOTICE_LIMIT,
      p_lease_seconds: TRIAL_REQUIRED_NOTICE_LEASE_SECONDS,
    })
    if (!Array.isArray(data)) throw new Error("Invalid required notice claim response")
    return data as TrialNoticeClaim[]
  },
  recipient: async (userId) => {
    // Resolve the account's verified email via admin Auth, never an untrusted
    // provider subscriber email or client-supplied receipt address.
    const { data, error } = await createAdminClient().auth.admin.getUserById(userId)
    if (error || !data.user?.email_confirmed_at) return null
    const email = data.user.email?.trim()
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
  },
  send: sendTrialRequiredNotice,
  settle: async (claim, outcome, message) => {
    const result = await rpc("complete_trial_required_notice", {
      p_notice_id: claim.notice_id,
      p_attempt_id: claim.attempt_id,
      p_outcome: outcome.status,
      p_error_code: "errorCode" in outcome ? outcome.errorCode : "",
      p_provider_delivery_id: "deliveryId" in outcome ? outcome.deliveryId : "",
      p_provider_queued_at: "queuedAt" in outcome ? outcome.queuedAt : "",
      p_subject: message?.subject ?? "",
      p_receipt_text: message?.receipt_text ?? "",
    })
    if (result !== true) throw new Error("Required notice claim settlement failed")
  },
}
function queuedAt(value: string | number) {
  const ms =
    typeof value === "number" ? (value < 100_000_000_000 ? value * 1000 : value) : Date.parse(value)
  if (!Number.isFinite(ms) || Number.isNaN(new Date(ms).getTime()))
    throw new CustomerIoAmbiguousDeliveryError("Invalid queue acknowledgement time")
  return new Date(ms).toISOString()
}
export async function dispatchTrialRequiredNotices(overrides: Partial<Dependencies> = {}) {
  const d = { ...defaults, ...overrides }
  const stats = { claimed: 0, queued: 0, supportRequired: 0, blocked: false }
  if (
    !d.messageId?.trim() ||
    d.messageId.trim().length > 200 ||
    !d.apiKeyPresent ||
    !d.sender?.trim()
  )
    return { ...stats, blocked: true }
  await d.enqueueAnnual()
  const claims = await d.claim()
  stats.claimed = claims.length
  for (const claim of claims) {
    let message: TrialRequiredNoticeMessage | null = null
    let outcome: TrialNoticeOutcome
    let sendStarted = false
    try {
      if (
        !/^[0-9a-f-]{36}$/i.test(claim.notice_id) ||
        !/^[0-9a-f-]{36}$/i.test(claim.attempt_id) ||
        !/^[0-9a-f-]{36}$/i.test(claim.user_id) ||
        ![
          "contract_confirmation",
          "contract_change",
          "cancellation_receipt",
          "paid_cancellation_receipt",
          "payment_receipt",
          "annual_renewal",
        ].includes(claim.kind)
      )
        throw new Error("Malformed required notice claim")
      message = buildTrialRequiredNoticeMessage(claim.kind, claim.snapshot)
      const email = await d.recipient(claim.user_id)
      if (!email) {
        outcome = { status: "support_required", errorCode: "recipient_owner_unavailable" }
      } else {
        sendStarted = true
        const receipt = await d.send({
          email,
          messageId: d.messageId.trim(),
          sender: d.sender.trim(),
          message,
        })
        if (!receipt.deliveryId?.trim())
          throw new CustomerIoAmbiguousDeliveryError("Missing queue identifier")
        outcome = {
          status: "queued",
          deliveryId: receipt.deliveryId,
          queuedAt: queuedAt(receipt.queuedAt),
        }
      }
    } catch (error) {
      outcome = {
        status: "support_required",
        errorCode:
          error instanceof CustomerIoAmbiguousDeliveryError
            ? "customerio_delivery_ambiguous"
            : error instanceof CustomerIoHttpError
              ? "customerio_http_unconfirmed"
              : sendStarted
                ? "customerio_delivery_unconfirmed"
                : "notice_preparation_failed",
      }
    }
    // Settlement failure propagates. A dead lease parks; never retry the send.
    await d.settle(claim, outcome, message)
    if (outcome.status === "queued") stats.queued++
    else stats.supportRequired++
  }
  return stats
}
