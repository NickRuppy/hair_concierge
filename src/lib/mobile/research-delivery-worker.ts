import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
  type CustomerIoTransactionalDeliveryReceipt,
} from "@/lib/customerio/transactional"
import {
  APNS_PROVIDER_CREDENTIAL_REASONS,
  ApnsClient,
  readApnsConfig,
  type ApnsDeliveryReceipt,
} from "./apns-client"
import { readApnsTopicAllowlist, researchDeliveryEnabled } from "./push-installation-service"
import {
  buildMobileResearchEmail,
  mobileResearchMessageId,
  sendMobileResearchEmail,
} from "./research-email"
import { resolveMobileResearchResult } from "./research-result-service"

type Candidate = { submission_id: string; user_id: string; lease_token: string }
type Delivery = Candidate & {
  id: string
  channel: "email" | "push"
  installation_id: string | null
  send_attempts: number
}
type Installation = {
  token: string
  bindingVersion: string
  environment: "sandbox" | "production"
  topic: string
}
type Action = "queued" | "unknown" | "retry" | "failed_terminal" | "suppressed"
type Settlement = {
  action: Action
  error?: string
  providerId?: string
  queuedAt?: string
  retrySeconds?: number
}

export type ResearchDeliveryDependencies = {
  enabled: () => boolean
  now: () => number
  resolve: typeof resolveMobileResearchResult
  prepareEmail: (
    email: string,
    submissionId: string,
  ) => () => Promise<CustomerIoTransactionalDeliveryReceipt>
  preparePush: (
    installation: Installation,
    submissionId: string,
  ) => () => Promise<ApnsDeliveryReceipt>
}

function defaultDependencies(): ResearchDeliveryDependencies {
  const clients = new Map<string, ApnsClient>()
  return {
    enabled: researchDeliveryEnabled,
    now: Date.now,
    resolve: resolveMobileResearchResult,
    prepareEmail(email, submissionId) {
      if (!process.env.CUSTOMERIO_APP_API_KEY) throw new Error("email_not_configured")
      const input = { email, submissionId, messageId: mobileResearchMessageId() }
      buildMobileResearchEmail(input)
      return () => sendMobileResearchEmail(input)
    },
    preparePush(installation, submissionId) {
      const allowlist = readApnsTopicAllowlist()
      if (!allowlist[installation.environment]?.includes(installation.topic))
        throw new Error("push_not_configured")
      const key = `${installation.environment}:${installation.topic}`
      let client = clients.get(key)
      if (!client) {
        client = new ApnsClient({
          ...readApnsConfig(),
          environment: installation.environment,
          topic: installation.topic,
        })
        clients.set(key, client)
      }
      return () => client.sendResearchReady({ deviceToken: installation.token, submissionId })
    },
  }
}

export type ResearchDeliveryStats = {
  disabled: boolean
  candidates: number
  materialized: number
  queued: number
  unknown: number
  retry: number
  failed_terminal: number
  suppressed: number
  errors: number
}

/** No provider request is made before the durable sending transition succeeds.
 * A crashed/ambiguous send is held for reconciliation, never automatically resent. */
export async function reconcileMobileResearchDeliveries(
  client: SupabaseClient,
  dependencies: Partial<ResearchDeliveryDependencies> = {},
): Promise<ResearchDeliveryStats> {
  const deps = { ...defaultDependencies(), ...dependencies }
  const stats: ResearchDeliveryStats = {
    disabled: !deps.enabled(),
    candidates: 0,
    materialized: 0,
    queued: 0,
    unknown: 0,
    retry: 0,
    failed_terminal: 0,
    suppressed: 0,
    errors: 0,
  }
  if (stats.disabled) return stats

  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await client.rpc(name, args)
    if (error) throw new Error("delivery_storage_unavailable")
    return data as T
  }
  const nextAttempt = (seconds = 300) => new Date(deps.now() + seconds * 1000).toISOString()
  async function settle(row: Delivery, result: Settlement, sent = false) {
    const saved = await rpc<boolean>("finish_mobile_research_delivery", {
      p_delivery_id: row.id,
      p_lease_token: row.lease_token,
      p_action: result.action,
      p_next_attempt_at:
        result.action === "retry"
          ? nextAttempt(result.retrySeconds ?? Math.min(3600, 60 * 2 ** row.send_attempts))
          : null,
      p_provider_delivery_id: result.providerId ?? null,
      p_provider_queued_at: result.queuedAt ?? null,
      p_error_code: result.error ?? null,
    })
    const persistedAction =
      result.action === "retry" && row.send_attempts + Number(sent) >= 5
        ? "failed_terminal"
        : result.action
    if (saved) stats[persistedAction] += 1
  }
  async function candidate(row: Candidate) {
    const readiness = await deps.resolve(client, row.user_id, row.submission_id)
    if (readiness.kind === "ready") {
      if (
        await rpc<boolean>("materialize_mobile_research_deliveries", {
          p_submission_id: row.submission_id,
          p_candidate_lease_token: row.lease_token,
        })
      )
        stats.materialized += 1
    } else {
      await rpc("finish_mobile_research_delivery_candidate", {
        p_submission_id: row.submission_id,
        p_lease_token: row.lease_token,
        p_action: readiness.kind === "not_found" ? "failed_terminal" : "retry",
        p_next_attempt_at: readiness.kind === "not_found" ? null : nextAttempt(900),
        p_error: readiness.kind === "not_found" ? "submission_missing" : "result_not_ready",
      })
    }
  }
  async function deliver(row: Delivery) {
    // Prepare credentials and addresses before committing to a possible send.
    let sendEmail: (() => Promise<CustomerIoTransactionalDeliveryReceipt>) | undefined
    let sendPush: (() => Promise<ApnsDeliveryReceipt>) | undefined
    let installation: Installation | null = null
    try {
      if (row.channel === "email") {
        const { data, error } = await client.auth.admin.getUserById(row.user_id)
        if (error) throw new Error("recipient_lookup_unavailable")
        if (!data.user?.email || !data.user.email_confirmed_at) {
          await settle(row, { action: "suppressed", error: "confirmed_email_missing" })
          return
        }
        sendEmail = deps.prepareEmail(data.user.email, row.submission_id)
      } else {
        installation = await rpc<Installation | null>("mobile_research_push_installation", {
          p_user_id: row.user_id,
          p_installation_id: row.installation_id,
        })
        if (!installation) {
          await settle(row, { action: "suppressed", error: "installation_unavailable" })
          return
        }
      }
      const readiness = await deps.resolve(client, row.user_id, row.submission_id)
      if (readiness.kind !== "ready") {
        await settle(row, {
          action: readiness.kind === "not_found" ? "suppressed" : "retry",
          error: "result_not_ready",
          retrySeconds: 900,
        })
        return
      }
      if (row.channel === "push") {
        installation = await rpc<Installation | null>("mobile_research_push_installation", {
          p_user_id: row.user_id,
          p_installation_id: row.installation_id,
        })
        if (!installation) {
          await settle(row, { action: "suppressed", error: "installation_unavailable" })
          return
        }
        sendPush = deps.preparePush(installation, row.submission_id)
      }
    } catch {
      await settle(row, { action: "retry", error: "preflight_unavailable", retrySeconds: 900 })
      return
    }
    if (
      !(await rpc<boolean>("begin_mobile_research_delivery_send", {
        p_delivery_id: row.id,
        p_lease_token: row.lease_token,
      }))
    )
      return

    // Separate request classification from persistence: a lost settlement must
    // never cause another network attempt or overwrite an accepted receipt.
    let result: Settlement
    if (sendEmail) {
      try {
        const receipt = await sendEmail()
        result = {
          action: "queued",
          providerId: receipt.deliveryId,
          queuedAt: String(receipt.queuedAt),
        }
      } catch (error) {
        result =
          error instanceof CustomerIoHttpError
            ? {
                // Without an API idempotency key, a timeout or 5xx does not
                // prove Customer.io failed before queueing the email.
                action:
                  error.status === 429
                    ? "retry"
                    : error.status === 408 || error.status >= 500
                      ? "unknown"
                      : "failed_terminal",
                error: `email_http_${error.status}`,
              }
            : {
                action: "unknown",
                error:
                  error instanceof CustomerIoAmbiguousDeliveryError
                    ? "email_ambiguous"
                    : "email_outcome_unknown",
              }
      }
    } else {
      let receipt: ApnsDeliveryReceipt
      try {
        receipt = await sendPush!()
      } catch {
        receipt = { state: "unknown", apnsId: "", reason: "transport_failure" }
      }
      switch (receipt.state) {
        case "accepted":
          result = { action: "queued", providerId: receipt.apnsId }
          break
        case "unknown":
          result = {
            action: "unknown",
            error: "push_ambiguous",
            providerId: receipt.apnsId || undefined,
          }
          break
        case "retryable":
          result = {
            action: "retry",
            // The outbox refunds this attempt: a wrong provider key is ours to fix.
            error: APNS_PROVIDER_CREDENTIAL_REASONS.has(receipt.reason)
              ? "push_provider_credentials"
              : "push_provider_retry",
            retrySeconds: Math.min(86400, Math.max(60, receipt.retryAfterSeconds ?? 300)),
          }
          break
        case "rejected":
          result = { action: "failed_terminal", error: "push_provider_rejected" }
          break
        case "invalid_token":
          result = { action: "failed_terminal", error: "push_invalid_token" }
          try {
            await rpc("mobile_research_invalidate_push_token", {
              p_user_id: row.user_id,
              p_installation_id: row.installation_id,
              p_apns_token: installation!.token,
              p_binding_version: installation!.bindingVersion,
            })
          } catch {
            stats.errors += 1
          }
      }
    }
    await settle(row, result, true)
  }
  const guarded = async (work: () => Promise<unknown>) => {
    try {
      await work()
    } catch {
      stats.errors += 1
    }
  }
  await guarded(async () => {
    const rows = await rpc<Candidate[]>("claim_mobile_research_delivery_candidates", { p_limit: 5 })
    stats.candidates = rows.length
    await Promise.all(rows.map((row) => guarded(() => candidate(row))))
  })
  // Channel failures do not prevent work on the other independently leased queue.
  await Promise.all(
    (["email", "push"] as const).map((channel) =>
      guarded(async () => {
        const rows = await rpc<Delivery[]>("claim_mobile_research_deliveries", {
          p_channel: channel,
          p_limit: 5,
        })
        await Promise.all(rows.map((row) => guarded(() => deliver(row))))
      }),
    ),
  )
  return stats
}
