import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseProductIntakeRepository } from "@/lib/product-intake/repository"
import type { ScanProductIntakeSubmissionInput } from "@/lib/product-intake/schemas"
import { submitScanProductIntake } from "@/lib/product-intake/submissions"
import { filterScanEligibleProductIds } from "@/lib/scan/catalog-eligibility"
import { resolveRetailerEnrichment } from "@/lib/scan/enrichment/resolve-enrichment"
import { findOpenScanSubmissionByName } from "@/lib/scan/pending-submission"
import type { createAdminClient } from "@/lib/supabase/admin"

import { loadDiscoverySubmissionOutcomes } from "./reconcile"
import {
  discoveryItemAwaitsResearch,
  discoveryResearchCandidateIds,
  type DiscoveryResearchItem,
  type DiscoveryResearchJob,
  type DiscoveryResearchState,
  type DiscoveryResearchSubmissionInput,
} from "./research-status"

/**
 * The cockpit's research reads, and the three writes behind „Recherche starten".
 *
 * Research itself runs only in Nick's LOCAL review center (`npm run
 * products:intake:review-center`, whose watch mode picks up queued jobs). The deployed app
 * therefore never runs or kicks a worker: it only puts work in the durable queue, through
 * the same two SECURITY DEFINER RPCs the local review app calls
 * (`product_intake_enqueue_research_job`, `product_intake_retry_research_job`, migration
 * 20260630120000). They are called here directly rather than through
 * `@chaarlie/product-intake-core`'s `enqueueResearchJob` / `retryResearchJob` — the app build
 * does not transpile that TypeScript-source workspace package, and the wrappers are a
 * single `rpc` call each.
 */

type Client = SupabaseClient

const JOBS_TABLE = "product_intake_research_jobs"
const ITEMS_TABLE = "discovery_intake_items"

/** The newest job per submission (by `created_at`), for the status list. */
export async function loadDiscoveryLatestResearchJobs(
  client: Client,
  submissionIds: readonly string[],
): Promise<Map<string, DiscoveryResearchJob>> {
  const unique = [...new Set(submissionIds)]
  const latest = new Map<string, DiscoveryResearchJob>()
  if (unique.length === 0) return latest
  const { data, error } = await client
    .from(JOBS_TABLE)
    .select("id,submission_id,status,created_at")
    .in("submission_id", unique)
    .order("created_at", { ascending: false })
  if (error) throw new Error("discovery_research_jobs_lookup_failed")
  for (const row of (data as Array<{ id: string; submission_id: string; status: string }> | null) ??
    []) {
    if (!latest.has(row.submission_id)) {
      latest.set(row.submission_id, { id: row.id, status: row.status })
    }
  }
  return latest
}

export type DiscoveryResearchStateDependencies = {
  loadSubmissions: (
    client: Client,
    submissionIds: readonly string[],
  ) => Promise<Map<string, { status: string | null; approvedProductId: string | null }>>
  loadLatestJobs: typeof loadDiscoveryLatestResearchJobs
  filterEligibleProductIds: (client: Client, productIds: readonly string[]) => Promise<Set<string>>
}

export const DISCOVERY_RESEARCH_STATE_DEPENDENCIES: DiscoveryResearchStateDependencies = {
  loadSubmissions: (client, ids) =>
    loadDiscoverySubmissionOutcomes(ids, client as ReturnType<typeof createAdminClient>),
  loadLatestJobs: loadDiscoveryLatestResearchJobs,
  // The SAME gate capture (`POST /api/beratung/identify`) and the reconcile CLI run.
  filterEligibleProductIds: filterScanEligibleProductIds,
}

/**
 * Submissions, their latest jobs and the eligibility of every approved product, for the
 * items still waiting on research. Throws on any failed read: the caller decides how to
 * degrade (the cockpit blocks finalising rather than fingerprinting a half-read state).
 */
export async function loadDiscoveryResearchState(
  client: Client,
  items: readonly DiscoveryResearchItem[],
  deps: DiscoveryResearchStateDependencies = DISCOVERY_RESEARCH_STATE_DEPENDENCIES,
): Promise<DiscoveryResearchState> {
  const submissionIds = [
    ...new Set(items.filter(discoveryItemAwaitsResearch).map((item) => item.productSubmissionId!)),
  ].sort()
  if (submissionIds.length === 0) {
    return { submissions: new Map(), latestJobs: new Map(), eligible: new Set() }
  }
  const [submissions, latestJobs] = await Promise.all([
    deps.loadSubmissions(client, submissionIds),
    deps.loadLatestJobs(client, submissionIds),
  ])
  const candidates = discoveryResearchCandidateIds(submissions)
  const eligible =
    candidates.length > 0 ? await deps.filterEligibleProductIds(client, candidates) : new Set()
  return { submissions, latestJobs, eligible: eligible as Set<string> }
}

// --- writes -------------------------------------------------------------------

/** Queues a job for an open submission (returns the existing live job if there is one). */
export async function enqueueDiscoveryResearchJob(
  client: Client,
  submissionId: string,
): Promise<void> {
  const { error } = await client.rpc("product_intake_enqueue_research_job", {
    target_submission_id: submissionId,
    // The stage the insert trigger itself uses for a new scan submission.
    requested_stage: "source_research",
  })
  if (error) throw error
}

/** Re-queues a failed or blocked job at its own stage. */
export async function retryDiscoveryResearchJob(client: Client, jobId: string): Promise<void> {
  const { error } = await client.rpc("product_intake_retry_research_job", {
    target_job_id: jobId,
    retry_progress: {
      message: "Job wurde aus dem Discovery-Cockpit erneut eingereiht.",
      retried_at: new Date().toISOString(),
      source: "discovery_cockpit",
    },
  })
  if (error) throw error
}

/**
 * Attaches a new submission to the intake row. Only a row that still has NO submission and
 * NO product is touched — both are re-stated as predicates, like reconcile's write.
 */
export async function attachDiscoveryIntakeItemSubmission(
  client: Client,
  input: { intakeId: string; itemId: string; submissionId: string },
): Promise<boolean> {
  const { data, error } = await client
    .from(ITEMS_TABLE)
    .update({ product_submission_id: input.submissionId })
    .eq("id", input.itemId)
    .eq("intake_id", input.intakeId)
    .is("product_submission_id", null)
    .is("product_id", null)
    .select("id")
  if (error) throw error
  return ((data as Array<{ id: string }> | null) ?? []).length > 0
}

/** A catalog match the submit path found instead: same guarded write as reconcile's. */
export async function assignDiscoveryIntakeItemCatalogProduct(
  client: Client,
  input: { intakeId: string; itemId: string; productId: string },
): Promise<boolean> {
  const { data, error } = await client
    .from(ITEMS_TABLE)
    .update({ product_id: input.productId })
    .eq("id", input.itemId)
    .eq("intake_id", input.intakeId)
    .is("product_id", null)
    .select("id")
  if (error) throw error
  return ((data as Array<{ id: string }> | null) ?? []).length > 0
}

export type DiscoveryResearchSubmissionResult =
  | { kind: "already_in_catalog"; productId: string }
  | { kind: "pending_submission"; submissionId: string }

/**
 * Opens a research submission for the participant exactly as her own checklist would have
 * — `submitScanProductIntake`, the function behind `POST /api/scan/submit`, as HER (the
 * submission's `user_id` is the participant, which is also what the intake's ownership
 * check reads). Its insert fires the `product_intake_auto_enqueue_research_job` trigger,
 * so the new submission is queued without a second call.
 *
 * Mirrors the route's two lanes: the EAN lane asks dm for a prefill (fail-open, like the
 * route), and the name lane coalesces a lost race onto the open submission that won it.
 */
export async function createDiscoveryResearchSubmission(
  client: Client,
  input: { userId: string; submission: DiscoveryResearchSubmissionInput },
): Promise<DiscoveryResearchSubmissionResult> {
  const { submission } = input
  const scanInput: ScanProductIntakeSubmissionInput = {
    intake_method: "manual",
    category: submission.category,
    frequency_range: null,
    brand_text: submission.brandText ?? undefined,
    product_name_text: submission.productNameText ?? undefined,
    ...(submission.identifier
      ? { scannedIdentifier: { type: "ean" as const, value: submission.identifier } }
      : {}),
    replace_existing_confirmed: false,
  }
  let enrichment = null
  if (submission.identifier) {
    try {
      enrichment = (await resolveRetailerEnrichment(submission.identifier, { route: "submit" }))
        .enrichment
    } catch {
      enrichment = null
    }
  }
  const admin = client as ReturnType<typeof createAdminClient>
  try {
    const result = await submitScanProductIntake({
      userId: input.userId,
      input: scanInput,
      enrichment,
      repository: createSupabaseProductIntakeRepository(admin),
      isMatchScanEligible: async (id) => (await filterScanEligibleProductIds(client, [id])).has(id),
    })
    return result.kind === "already_in_catalog"
      ? { kind: "already_in_catalog", productId: result.productId }
      : { kind: "pending_submission", submissionId: result.submission.id }
  } catch (error) {
    const nameLaneConflict =
      !submission.identifier &&
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "23505"
    if (!nameLaneConflict) throw error
    const existing = await findOpenScanSubmissionByName(
      client,
      input.userId,
      submission.category,
      submission.brandText!,
      submission.productNameText!,
    )
    if (!existing) throw error
    return { kind: "pending_submission", submissionId: existing.submissionId }
  }
}
