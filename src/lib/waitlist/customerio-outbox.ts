import type { SupabaseClient } from "@supabase/supabase-js"

import {
  syncWaitlistSignupToCustomerIo,
  type WaitlistCustomerIoDelivery,
  type WaitlistCustomerIoSignup,
} from "@/lib/waitlist/customerio"

const MAX_ATTEMPTS = 5
const STALE_PROCESSING_MINUTES = 15

export type WaitlistCustomerIoOutboxRow = {
  id: string
  signup_id: string
  event_type: "waitlist_signup" | "waitlist_survey_completed"
  message_id: string
  status: "pending" | "processing" | "delivered" | "failed" | "failed_permanent"
  attempts: number
  processing_started_at: string | null
  next_attempt_at: string | null
  created_at: string
}

export type WaitlistCustomerIoDispatchDependencies = {
  findRows: (supabase: SupabaseClient, signupId: string) => Promise<WaitlistCustomerIoOutboxRow[]>
  findDueRows: (supabase: SupabaseClient, limit: number) => Promise<WaitlistCustomerIoOutboxRow[]>
  claimRow: (
    supabase: SupabaseClient,
    row: WaitlistCustomerIoOutboxRow,
  ) => Promise<WaitlistCustomerIoOutboxRow | null>
  loadSignup: (supabase: SupabaseClient, signupId: string) => Promise<WaitlistCustomerIoSignup>
  deliver: (input: {
    signup: WaitlistCustomerIoSignup
    eventType: WaitlistCustomerIoOutboxRow["event_type"]
    messageId: string
  }) => Promise<WaitlistCustomerIoDelivery>
  markDelivered: (supabase: SupabaseClient, row: WaitlistCustomerIoOutboxRow) => Promise<boolean>
  markFailed: (
    supabase: SupabaseClient,
    row: WaitlistCustomerIoOutboxRow,
    error: string,
    permanent: boolean,
  ) => Promise<boolean>
}

type Options = { dependencies?: Partial<WaitlistCustomerIoDispatchDependencies> }
export type WaitlistCustomerIoDispatchStats = {
  processed: number
  delivered: number
  failed: number
}

export async function dispatchWaitlistCustomerIoForSignup(
  supabase: SupabaseClient,
  signupId: string,
  options: Options = {},
): Promise<"skipped" | "delivered" | "failed"> {
  const deps = { ...DEFAULT_DEPENDENCIES, ...options.dependencies }
  const rows = await deps.findRows(supabase, signupId)
  let outcome: "skipped" | "delivered" | "failed" = "skipped"
  for (const row of rows) {
    const rowOutcome = await dispatchRow(supabase, row, deps)
    if (rowOutcome === "failed") outcome = "failed"
    else if (rowOutcome === "delivered" && outcome === "skipped") outcome = "delivered"
  }
  return outcome
}

export async function dispatchWaitlistCustomerIoDue(
  supabase: SupabaseClient,
  options: { limit: number; dependencies?: Partial<WaitlistCustomerIoDispatchDependencies> },
): Promise<WaitlistCustomerIoDispatchStats> {
  const deps = { ...DEFAULT_DEPENDENCIES, ...options.dependencies }
  const stats: WaitlistCustomerIoDispatchStats = { processed: 0, delivered: 0, failed: 0 }
  for (const row of await deps.findDueRows(supabase, options.limit)) {
    const outcome = await dispatchRow(supabase, row, deps)
    if (outcome === "skipped") continue
    stats.processed += 1
    stats[outcome] += 1
  }
  return stats
}

async function dispatchRow(
  supabase: SupabaseClient,
  row: WaitlistCustomerIoOutboxRow,
  deps: WaitlistCustomerIoDispatchDependencies,
) {
  if (row.status === "delivered" || row.status === "failed_permanent") return "skipped" as const
  const claimed = await deps.claimRow(supabase, row)
  if (!claimed) return "skipped" as const
  try {
    const result = await deps.deliver({
      signup: await deps.loadSignup(supabase, claimed.signup_id),
      eventType: claimed.event_type,
      messageId: claimed.message_id,
    })
    const failure = deliveryFailure(result)
    if (failure) {
      return (await deps.markFailed(supabase, claimed, failure.error, failure.permanent))
        ? ("failed" as const)
        : ("skipped" as const)
    }
    return (await deps.markDelivered(supabase, claimed))
      ? ("delivered" as const)
      : ("skipped" as const)
  } catch {
    return (await deps.markFailed(supabase, claimed, "Customer.io delivery threw", false))
      ? ("failed" as const)
      : ("skipped" as const)
  }
}

function deliveryFailure(result: WaitlistCustomerIoDelivery) {
  const failed = !result.identify.ok ? result.identify : !result.event.ok ? result.event : null
  if (!failed) return null
  // Customer.io may echo request values in an error body. Persist only a safe classification.
  return {
    error: failed.status
      ? `Customer.io delivery failed with status ${failed.status}`
      : "Customer.io delivery failed",
    permanent: isPermanentStatus(failed.status),
  }
}

function isPermanentStatus(status?: number) {
  return status !== undefined && status >= 400 && status < 500 && ![408, 409, 429].includes(status)
}

function nextAttemptAt(attempts: number) {
  return new Date(Date.now() + Math.min(60, attempts * attempts) * 60_000).toISOString()
}

async function findRows(supabase: SupabaseClient, signupId: string) {
  const { data, error } = await supabase
    .from("waitlist_customerio_outbox")
    .select("*")
    .eq("signup_id", signupId)
  if (error) throw error
  return (data ?? []) as WaitlistCustomerIoOutboxRow[]
}

async function findDueRows(supabase: SupabaseClient, limit: number) {
  const now = new Date().toISOString()
  const stale = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000).toISOString()
  const { data, error } = await supabase
    .from("waitlist_customerio_outbox")
    .select("*")
    .in("status", ["pending", "failed", "processing"])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now},processing_started_at.lte.${stale}`)
    .order("created_at", { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as WaitlistCustomerIoOutboxRow[]
}

async function claimRow(supabase: SupabaseClient, row: WaitlistCustomerIoOutboxRow) {
  const now = new Date().toISOString()
  let query = supabase
    .from("waitlist_customerio_outbox")
    .update({ status: "processing", processing_started_at: now, updated_at: now })
    .eq("id", row.id)
  query =
    row.status === "processing"
      ? query
          .eq("status", "processing")
          .lte(
            "processing_started_at",
            new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000).toISOString(),
          )
      : query.in("status", ["pending", "failed"])
  const { data, error } = await query.select("*").maybeSingle()
  if (error) throw error
  return (data as WaitlistCustomerIoOutboxRow | null) ?? null
}

async function loadSignup(supabase: SupabaseClient, signupId: string) {
  const { data, error } = await supabase
    .from("waitlist_signups")
    .select(
      "id,campaign,normalized_email,first_name,marketing_consent,survey_response_id,survey_completed_at,created_at",
    )
    .eq("id", signupId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error("Waitlist signup no longer exists")
  return data as WaitlistCustomerIoSignup
}

async function markDelivered(supabase: SupabaseClient, row: WaitlistCustomerIoOutboxRow) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("waitlist_customerio_outbox")
    .update({
      status: "delivered",
      attempts: row.attempts + 1,
      processing_started_at: null,
      next_attempt_at: null,
      delivered_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("status", "processing")
    .eq("processing_started_at", row.processing_started_at)
    .select("id")
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

async function markFailed(
  supabase: SupabaseClient,
  row: WaitlistCustomerIoOutboxRow,
  errorMessage: string,
  permanent: boolean,
) {
  const attempts = row.attempts + 1
  const terminal = permanent || attempts >= MAX_ATTEMPTS
  const { data, error } = await supabase
    .from("waitlist_customerio_outbox")
    .update({
      status: terminal ? "failed_permanent" : "failed",
      attempts,
      processing_started_at: null,
      next_attempt_at: terminal ? null : nextAttemptAt(attempts),
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "processing")
    .eq("processing_started_at", row.processing_started_at)
    .select("id")
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

const DEFAULT_DEPENDENCIES: WaitlistCustomerIoDispatchDependencies = {
  findRows,
  findDueRows,
  claimRow,
  loadSignup,
  deliver: syncWaitlistSignupToCustomerIo,
  markDelivered,
  markFailed,
}
