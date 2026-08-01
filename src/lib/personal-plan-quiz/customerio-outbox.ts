import type { SupabaseClient } from "@supabase/supabase-js"

import { personalPlanPrepareRequestSchema } from "@/lib/personal-plan-quiz/persistence"
import { syncPersonalPlanLeadToCustomerIo } from "@/lib/personal-plan-quiz/customerio"
import {
  PERSONAL_PLAN_QUIZ_KIND,
  PERSONAL_PLAN_QUIZ_VERSION,
  type PersonalPlanQuizSubmissionEnvelope,
} from "@/lib/personal-plan-quiz/types"

const MAX_ATTEMPTS = 5
const STALE_PROCESSING_MINUTES = 15

export type CustomerIoProfileSyncOutboxRow = {
  lead_id: string
  profile_revision: number
  completion_event_eligible: boolean
  send_completion_event: boolean
  completion_event_delivered_at: string | null
  status: "pending" | "processing" | "delivered" | "failed" | "failed_permanent"
  attempts: number
  processing_started_at: string | null
  next_attempt_at: string | null
  delivered_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

type PersonalPlanLeadRow = {
  id: string
  email: string | null
  marketing_consent: boolean | null
  quiz_answers: unknown
  quiz_kind: string | null
  created_at: string
}

type FunnelAttributionRow = {
  id: string
  package_key: string
}

type SyncResult = Awaited<ReturnType<typeof syncPersonalPlanLeadToCustomerIo>>

type DispatchDependencies = {
  findRow: (
    supabase: SupabaseClient,
    leadId: string,
  ) => Promise<CustomerIoProfileSyncOutboxRow | null>
  claimRow: (
    supabase: SupabaseClient,
    row: CustomerIoProfileSyncOutboxRow,
  ) => Promise<CustomerIoProfileSyncOutboxRow | null>
  loadLead: (supabase: SupabaseClient, leadId: string) => Promise<PersonalPlanLeadRow>
  loadFunnel: (supabase: SupabaseClient, leadId: string) => Promise<FunnelAttributionRow | null>
  deliver: typeof syncPersonalPlanLeadToCustomerIo
  markDelivered: (
    supabase: SupabaseClient,
    row: CustomerIoProfileSyncOutboxRow,
    completionEventDelivered: boolean,
  ) => Promise<void>
  markFailed: (
    supabase: SupabaseClient,
    row: CustomerIoProfileSyncOutboxRow,
    error: string,
    permanent: boolean,
  ) => Promise<void>
}

type DispatchOptions = {
  dependencies?: Partial<DispatchDependencies>
}

export type CustomerIoProfileSyncStats = {
  processed: number
  delivered: number
  failed: number
}

export async function dispatchCustomerIoProfileSyncForLead(
  supabase: SupabaseClient,
  leadId: string,
  options: DispatchOptions = {},
): Promise<"skipped" | "delivered" | "failed"> {
  const deps: DispatchDependencies = { ...DEFAULT_DEPENDENCIES, ...options.dependencies }
  const row = await deps.findRow(supabase, leadId)
  if (!row || row.status === "delivered" || row.status === "failed_permanent") return "skipped"

  const claimed = await deps.claimRow(supabase, row)
  if (!claimed) return "skipped"

  try {
    const lead = await deps.loadLead(supabase, leadId)
    const quizAnswers = parseStoredEnvelope(lead)
    const funnel = await deps.loadFunnel(supabase, leadId)
    const shouldSendCompletionEvent =
      claimed.send_completion_event && claimed.completion_event_delivered_at === null
    const result = await deps.deliver({
      createdAt: lead.created_at,
      email: lead.email!,
      identifyTimestamp: claimed.processing_started_at ?? lead.created_at,
      leadId: lead.id,
      marketingConsent: lead.marketing_consent ?? false,
      quizAnswers,
      funnelSessionId: funnel?.id,
      funnelPackageKey: funnel?.package_key,
      profileSyncRevision: claimed.profile_revision,
      sendCompletionEvent: shouldSendCompletionEvent,
    })

    const failure = customerIoFailure(result, shouldSendCompletionEvent)
    if (failure) {
      await deps.markFailed(supabase, claimed, failure.error, failure.permanent)
      return "failed"
    }

    await deps.markDelivered(
      supabase,
      claimed,
      shouldSendCompletionEvent && result.completionEvent?.ok === true,
    )
    return "delivered"
  } catch (error) {
    await deps.markFailed(supabase, claimed, errorMessage(error), false)
    return "failed"
  }
}

export async function dispatchCustomerIoProfileSyncDue(
  supabase: SupabaseClient,
  options: { limit?: number; dependencies?: Partial<DispatchDependencies> } = {},
): Promise<CustomerIoProfileSyncStats> {
  const now = new Date().toISOString()
  const staleProcessingCutoff = new Date(
    Date.now() - STALE_PROCESSING_MINUTES * 60_000,
  ).toISOString()
  const { data, error } = await supabase
    .from("customerio_profile_sync_outbox")
    .select("lead_id")
    .in("status", ["pending", "failed", "processing"])
    .or(
      `next_attempt_at.is.null,next_attempt_at.lte.${now},processing_started_at.lte.${staleProcessingCutoff}`,
    )
    .order("created_at", { ascending: true })
    .limit(options.limit ?? 25)

  if (error) throw error

  const stats: CustomerIoProfileSyncStats = { processed: 0, delivered: 0, failed: 0 }
  for (const candidate of (data ?? []) as Array<{ lead_id: string }>) {
    const outcome = await dispatchCustomerIoProfileSyncForLead(supabase, candidate.lead_id, {
      dependencies: options.dependencies,
    })
    if (outcome === "skipped") continue
    stats.processed += 1
    stats[outcome] += 1
  }
  return stats
}

function parseStoredEnvelope(lead: PersonalPlanLeadRow): PersonalPlanQuizSubmissionEnvelope {
  if (lead.quiz_kind !== PERSONAL_PLAN_QUIZ_KIND || !lead.email) {
    throw new Error("Customer.io profile sync lead is missing canonical identity")
  }
  if (!lead.quiz_answers || typeof lead.quiz_answers !== "object") {
    throw new Error("Customer.io profile sync lead has no quiz answers")
  }
  const candidate = lead.quiz_answers as {
    kind?: unknown
    version?: unknown
    answers?: unknown
  }
  if (
    candidate.kind !== PERSONAL_PLAN_QUIZ_KIND ||
    candidate.version !== PERSONAL_PLAN_QUIZ_VERSION
  ) {
    throw new Error("Customer.io profile sync lead has an unsupported quiz envelope")
  }
  const parsed = personalPlanPrepareRequestSchema.safeParse({ answers: candidate.answers })
  if (!parsed.success) throw new Error("Customer.io profile sync lead has invalid quiz answers")
  return {
    kind: PERSONAL_PLAN_QUIZ_KIND,
    version: PERSONAL_PLAN_QUIZ_VERSION,
    answers: candidate.answers as PersonalPlanQuizSubmissionEnvelope["answers"],
  }
}

function customerIoFailure(result: SyncResult, expectedEvent: boolean) {
  if (!result.identify.ok) {
    return {
      error: result.identify.error ?? "Customer.io identify failed",
      permanent: isPermanentStatus(result.identify.status),
    }
  }
  if (expectedEvent && result.completionEvent?.ok !== true) {
    return {
      error: result.completionEvent?.error ?? "Customer.io completion event failed",
      permanent: isPermanentStatus(result.completionEvent?.status),
    }
  }
  return null
}

function isPermanentStatus(status?: number) {
  return status !== undefined && status >= 400 && status < 500 && ![408, 409, 429].includes(status)
}

async function findRow(supabase: SupabaseClient, leadId: string) {
  const { data, error } = await supabase
    .from("customerio_profile_sync_outbox")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle()
  if (error) throw error
  return (data as CustomerIoProfileSyncOutboxRow | null) ?? null
}

async function claimRow(supabase: SupabaseClient, row: CustomerIoProfileSyncOutboxRow) {
  const now = new Date().toISOString()
  let query = supabase
    .from("customerio_profile_sync_outbox")
    .update({ status: "processing", processing_started_at: now, updated_at: now })
    .eq("lead_id", row.lead_id)

  if (row.status === "processing") {
    const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000).toISOString()
    query = query.eq("status", "processing").lte("processing_started_at", staleCutoff)
  } else {
    query = query.in("status", ["pending", "failed"])
  }

  const { data, error } = await query.select("*").maybeSingle()
  if (error) throw error
  return (data as CustomerIoProfileSyncOutboxRow | null) ?? null
}

async function loadLead(supabase: SupabaseClient, leadId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("id,email,marketing_consent,quiz_answers,quiz_kind,created_at")
    .eq("id", leadId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error("Customer.io profile sync lead no longer exists")
  return data as PersonalPlanLeadRow
}

async function loadFunnel(supabase: SupabaseClient, leadId: string) {
  const { data, error } = await supabase
    .from("funnel_sessions")
    .select("id,package_key")
    .eq("lead_id", leadId)
    .order("first_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as FunnelAttributionRow | null) ?? null
}

async function markDelivered(
  supabase: SupabaseClient,
  row: CustomerIoProfileSyncOutboxRow,
  completionEventDelivered: boolean,
) {
  const now = new Date().toISOString()
  let query = supabase
    .from("customerio_profile_sync_outbox")
    .update({
      status: "delivered",
      attempts: row.attempts + 1,
      processing_started_at: null,
      next_attempt_at: null,
      delivered_at: now,
      last_error: null,
      completion_event_delivered_at: completionEventDelivered
        ? now
        : row.completion_event_delivered_at,
      updated_at: now,
    })
    .eq("lead_id", row.lead_id)
    .eq("status", "processing")
  query = row.processing_started_at
    ? query.eq("processing_started_at", row.processing_started_at)
    : query.is("processing_started_at", null)

  const { data, error } = await query.select("lead_id").maybeSingle()
  if (error) throw error

  if (!data && completionEventDelivered) {
    // A newer lead update may have reset this row to pending while the external event was in
    // flight. Preserve that pending profile delivery, but remember the event that already left.
    const { error: markerError } = await supabase
      .from("customerio_profile_sync_outbox")
      .update({
        send_completion_event: false,
        completion_event_delivered_at: now,
        updated_at: now,
      })
      .eq("lead_id", row.lead_id)
      .is("completion_event_delivered_at", null)
    if (markerError) throw markerError
  }
}

async function markFailed(
  supabase: SupabaseClient,
  row: CustomerIoProfileSyncOutboxRow,
  errorMessage: string,
  permanent: boolean,
) {
  const attempts = row.attempts + 1
  const failedPermanently = permanent || attempts >= MAX_ATTEMPTS
  const now = new Date().toISOString()
  let query = supabase
    .from("customerio_profile_sync_outbox")
    .update({
      status: failedPermanently ? "failed_permanent" : "failed",
      attempts,
      processing_started_at: null,
      next_attempt_at: failedPermanently ? null : nextAttemptAt(attempts),
      delivered_at: null,
      last_error: errorMessage,
      updated_at: now,
    })
    .eq("lead_id", row.lead_id)
    .eq("status", "processing")
  query = row.processing_started_at
    ? query.eq("processing_started_at", row.processing_started_at)
    : query.is("processing_started_at", null)

  const { error } = await query
  if (error) throw error
}

function nextAttemptAt(attempts: number) {
  const delayMinutes = Math.min(60, attempts * attempts)
  return new Date(Date.now() + delayMinutes * 60_000).toISOString()
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

const DEFAULT_DEPENDENCIES: DispatchDependencies = {
  findRow,
  claimRow,
  loadLead,
  loadFunnel,
  deliver: syncPersonalPlanLeadToCustomerIo,
  markDelivered,
  markFailed,
}
