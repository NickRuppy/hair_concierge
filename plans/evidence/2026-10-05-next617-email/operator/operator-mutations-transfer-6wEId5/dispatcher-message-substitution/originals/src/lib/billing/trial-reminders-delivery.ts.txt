import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildTrialReminderMessage, type TrialReminderMessage } from "@/lib/billing/trial-reminders"
import {
  sendTrialReminder,
  TRIAL_REMINDER_MESSAGE_ID_ENV,
  TRIAL_REMINDER_FROM_ENV,
  DEFAULT_TRIAL_REMINDER_SENDER,
} from "@/lib/customerio/trial-reminder"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
} from "@/lib/customerio/transactional"

export const TRIAL_REMINDERS_ENABLED_ENV = "TRIAL_REMINDERS_ENABLED"
export const TRIAL_REMINDERS_ROLLOUT_AT_ENV = "TRIAL_REMINDERS_ROLLOUT_AT"
export const TRIAL_REMINDER_LEASE_SECONDS = 90
// Three sequential 10-second sends fit within the 60-second route budget.
export const TRIAL_REMINDER_LIMIT = 3
export type TrialReminderClaim = {
  reminder_id: string
  attempt_id: string
  user_id: string
  snapshot: unknown
}
export type TrialReminderOutcome =
  | { status: "queued"; deliveryId: string; queuedAt: string }
  | { status: "support_required"; errorCode: string }
export type TrialReminderDependencies = {
  enabled: boolean
  rolloutAt: string | undefined
  messageId: string | undefined
  sender: string | undefined
  apiKeyPresent: boolean
  enqueue: (cutoff: string) => Promise<void>
  claim: () => Promise<TrialReminderClaim[]>
  recipient: (userId: string) => Promise<string | null>
  prepare: (claim: TrialReminderClaim) => Promise<TrialReminderClaim | null>
  send: typeof sendTrialReminder
  settle: (
    claim: TrialReminderClaim,
    outcome: TrialReminderOutcome,
    message: TrialReminderMessage | null,
  ) => Promise<void>
}
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await createAdminClient().rpc(name, args)
  if (error) throw new Error("Trial reminder storage operation failed")
  return data
}
const storage = {
  enqueue: async (cutoff: string) => {
    await rpc("enqueue_due_trial_reminders", { p_rollout_at: cutoff })
  },
  claim: async () => {
    const data = await rpc("claim_trial_reminders", {
      p_limit: TRIAL_REMINDER_LIMIT,
      p_lease_seconds: TRIAL_REMINDER_LEASE_SECONDS,
    })
    if (!Array.isArray(data) || data.length > TRIAL_REMINDER_LIMIT)
      throw new Error("Invalid trial reminder claim response")
    return data as TrialReminderClaim[]
  },
  recipient: async (userId: string) => {
    const { data, error } = await createAdminClient().auth.admin.getUserById(userId)
    if (error || !data.user?.email_confirmed_at) return null
    const email = data.user.email?.trim()
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
  },
  prepare: async (claim: TrialReminderClaim) => {
    const data = await rpc("prepare_trial_reminder_send", {
      p_reminder_id: claim.reminder_id,
      p_attempt_id: claim.attempt_id,
    })
    if (!Array.isArray(data) || data.length > 1)
      throw new Error("Invalid trial reminder preparation response")
    return (data[0] as TrialReminderClaim | undefined) ?? null
  },
  settle: async (
    claim: TrialReminderClaim,
    outcome: TrialReminderOutcome,
    message: TrialReminderMessage | null,
  ) => {
    const result = await rpc("complete_trial_reminder", {
      p_reminder_id: claim.reminder_id,
      p_attempt_id: claim.attempt_id,
      p_outcome: outcome.status,
      p_error_code: "errorCode" in outcome ? outcome.errorCode : "",
      p_provider_delivery_id: "deliveryId" in outcome ? outcome.deliveryId : "",
      p_provider_queued_at: "queuedAt" in outcome ? outcome.queuedAt : null,
      p_subject: message?.subject ?? "",
      p_receipt_text: message?.receipt_text ?? "",
    })
    if (result !== true) throw new Error("Trial reminder settlement failed")
  },
}
// Accept only complete UTC timestamps; reject rollover dates such as February 30.
function rolloutInstant(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  const canonical = new Date(parsed).toISOString()
  return canonical.slice(0, 19) === value.slice(0, 19) ? canonical : null
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function validClaim(claim: TrialReminderClaim) {
  return (
    claim && UUID.test(claim.reminder_id) && UUID.test(claim.attempt_id) && UUID.test(claim.user_id)
  )
}
function acknowledgementTime(value: string | number) {
  const ms =
    typeof value === "number" ? (value < 100_000_000_000 ? value * 1000 : value) : Date.parse(value)
  if (!Number.isFinite(ms) || Number.isNaN(new Date(ms).getTime()))
    throw new CustomerIoAmbiguousDeliveryError("Invalid queue acknowledgement time")
  return new Date(ms).toISOString()
}
export async function dispatchTrialReminders(overrides: Partial<TrialReminderDependencies> = {}) {
  const d: TrialReminderDependencies = {
    enabled: process.env[TRIAL_REMINDERS_ENABLED_ENV] === "true",
    rolloutAt: process.env[TRIAL_REMINDERS_ROLLOUT_AT_ENV],
    messageId: process.env[TRIAL_REMINDER_MESSAGE_ID_ENV],
    sender: process.env[TRIAL_REMINDER_FROM_ENV] ?? DEFAULT_TRIAL_REMINDER_SENDER,
    apiKeyPresent: Boolean(process.env.CUSTOMERIO_APP_API_KEY?.trim()),
    ...storage,
    send: sendTrialReminder,
    ...overrides,
  }
  const stats = {
    claimed: 0,
    queued: 0,
    supportRequired: 0,
    skipped: 0,
    blocked: false,
    disabled: false,
  }
  if (!d.enabled) return { ...stats, disabled: true }
  const cutoff = rolloutInstant(d.rolloutAt)
  if (
    !cutoff ||
    !d.messageId?.trim() ||
    d.messageId.length > 200 ||
    !d.apiKeyPresent ||
    !d.sender?.trim() ||
    /[\r\n]/.test(d.sender)
  )
    return { ...stats, blocked: true }
  await d.enqueue(cutoff)
  const claims = await d.claim()
  stats.claimed = claims.length
  for (const claim of claims) {
    let message: TrialReminderMessage | null = null
    let outcome: TrialReminderOutcome
    let sendStarted = false
    try {
      if (!validClaim(claim)) throw new Error("Malformed reminder claim")
      const email = await d.recipient(claim.user_id)
      if (!email) {
        outcome = { status: "support_required", errorCode: "recipient_owner_unavailable" }
      } else {
        // Auth lookup may be slow. Recheck DB state/lease after it, immediately
        // before rendering and the provider boundary. SQL atomically suppresses
        // ineligible rows and fences this send attempt.
        const fresh = await d.prepare(claim)
        if (!fresh) {
          stats.skipped++
          continue
        }
        if (
          !validClaim(fresh) ||
          fresh.reminder_id !== claim.reminder_id ||
          fresh.attempt_id !== claim.attempt_id ||
          fresh.user_id !== claim.user_id
        )
          throw new Error("Reminder preparation identity mismatch")
        message = buildTrialReminderMessage(fresh.snapshot)
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
          queuedAt: acknowledgementTime(receipt.queuedAt),
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
                : "reminder_preparation_failed",
      }
    }
    // If this fails after send, the expired lease parks. Never repeat the email.
    await d.settle(claim, outcome, message)
    if (outcome.status === "queued") stats.queued++
    else stats.supportRequired++
  }
  return stats
}
