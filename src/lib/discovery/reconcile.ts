import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { filterScanEligibleProductIds } from "@/lib/scan/catalog-eligibility"
import { createAdminClient } from "@/lib/supabase/admin"

import {
  DISCOVERY_RESOLVED_SUBMISSION_STATUSES,
  isResolvedDiscoverySubmissionStatus,
  type DiscoverySubmissionOutcome,
} from "./research-status"

/**
 * The T-1 reconciliation surface: the database half of `npm run discovery -- reconcile`.
 *
 * `discovery_intake_items.product_id` is written once, at capture. A product the
 * participant typed or scanned that the catalog did not know is captured with a
 * `product_submission_id` and no `product_id`, so the cockpit shows it as „Noch in
 * Recherche" and it earns no verdict and no routine step. When the product-intake
 * pipeline later publishes that submission, nothing walks back to the intake — the
 * item stays research-pending in the DATA. The cockpit no longer depends on this walk
 * back — it treats approved, eligible research as the item's product at read time
 * (`research-status.ts`, `discoveryResearchLinks`) — but the CLI still writes it through,
 * so the row itself stops being research-pending.
 *
 * Two rules it must not soften:
 *
 * 1. Only rows with `product_id IS NULL` are ever touched. A product the participant
 *    already resolved at capture is their answer, not ours to overwrite.
 * 2. An approved product still has to pass `filterScanEligibleProductIds` — the same
 *    gate `POST /api/beratung/identify` runs at capture. A submission can be approved
 *    onto a product that is since deactivated or disposition-quarantined; writing that
 *    id would put a product in front of the participant that no scan surface would.
 * 3. `approved_product_id` alone is not a verdict — the STATUS has to say so too. See
 *    `DISCOVERY_RESOLVED_SUBMISSION_STATUSES` (`research-status.ts`).
 *
 * Everything here runs on the service-role client: all three tables are service-only.
 */

export type DiscoveryAdminClient = ReturnType<typeof createAdminClient>

const ENROLLMENTS_TABLE = "discovery_enrollments"
const INTAKES_TABLE = "discovery_intakes"
const ITEMS_TABLE = "discovery_intake_items"
const SUBMISSIONS_TABLE = "product_submissions"

export type DiscoveryReconcileScope =
  | { kind: "enrollment"; enrollmentId: string }
  | { kind: "email"; email: string }
  | { kind: "all" }

/** One research-pending row: captured, submission attached, catalog id still missing. */
export type DiscoveryPendingIntakeItem = {
  itemId: string
  category: string
  source: string
  brandText: string | null
  productNameText: string | null
  productSubmissionId: string
}

export type DiscoveryReconcileTarget = {
  enrollmentId: string
  name: string
  email: string | null
  intakeId: string
  finalizedAt: string | null
  items: DiscoveryPendingIntakeItem[]
}

export type { DiscoverySubmissionOutcome }

/**
 * The resolved-status rule and its constant live with the cockpit's research read
 * (`research-status.ts`), so the CLI and the cockpit's read-time auto-link share one
 * definition of „research is done". Re-exported for the CLI's existing imports.
 */
export { DISCOVERY_RESOLVED_SUBMISSION_STATUSES, isResolvedDiscoverySubmissionStatus }

type EnrollmentRow = { id: string; display_name: string; normalized_email: string | null }
type IntakeRow = { id: string; enrollment_id: string; call_finalized_at: string | null }
type ItemRow = {
  id: string
  intake_id: string
  category: string
  source: string
  brand_text: string | null
  product_name_text: string | null
  product_submission_id: string
}

/**
 * Resolves what the run covers.
 *
 * `--all` is deliberately narrower than the named scopes: it skips revoked
 * enrollments and finalized intakes, because reconciling a finalized call would
 * move the routine under a document that was already printed. A named enrollment
 * is reconciled either way — the operator asked for that one — and the receipt
 * carries `finalizedAt` so the re-finalize is visible.
 */
export async function loadDiscoveryReconcileTargets(
  scope: DiscoveryReconcileScope,
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<DiscoveryReconcileTarget[]> {
  let enrollmentQuery = client
    .from(ENROLLMENTS_TABLE)
    .select("id,display_name,normalized_email")
    .order("created_at", { ascending: true })
    .limit(250)
  if (scope.kind === "enrollment") {
    enrollmentQuery = enrollmentQuery.eq("id", scope.enrollmentId)
  } else if (scope.kind === "email") {
    // The uniqueness indexes are partial (`WHERE revoked_at IS NULL`), so an email
    // only identifies one enrollment among the live ones.
    enrollmentQuery = enrollmentQuery.eq("normalized_email", scope.email).is("revoked_at", null)
  } else {
    enrollmentQuery = enrollmentQuery.is("revoked_at", null)
  }
  const { data: enrollmentData, error: enrollmentError } = await enrollmentQuery
  if (enrollmentError) throw enrollmentError
  const enrollments = (enrollmentData as EnrollmentRow[] | null) ?? []
  if (enrollments.length === 0) return []

  // This read and the item read below ride PostgREST's default max-rows rather
  // than paginating: the enrollment read is capped at 250 (as `listDiscoveryEnrollments`
  // is), one intake per enrollment, ~10 pending items each — comfortably inside it
  // at the programme's 50–100-call scale. A larger programme needs pagination here.
  let intakeQuery = client
    .from(INTAKES_TABLE)
    .select("id,enrollment_id,call_finalized_at")
    .in(
      "enrollment_id",
      enrollments.map((row) => row.id),
    )
  if (scope.kind === "all") intakeQuery = intakeQuery.is("call_finalized_at", null)
  const { data: intakeData, error: intakeError } = await intakeQuery
  if (intakeError) throw intakeError
  const intakes = (intakeData as IntakeRow[] | null) ?? []
  if (intakes.length === 0) return []

  const { data: itemData, error: itemError } = await client
    .from(ITEMS_TABLE)
    .select("id,intake_id,category,source,brand_text,product_name_text,product_submission_id")
    .in(
      "intake_id",
      intakes.map((row) => row.id),
    )
    .is("product_id", null)
    .not("product_submission_id", "is", null)
    .order("created_at", { ascending: true })
  if (itemError) throw itemError
  const items = (itemData as ItemRow[] | null) ?? []

  const byIntake = new Map<string, DiscoveryPendingIntakeItem[]>()
  for (const row of items) {
    const bucket = byIntake.get(row.intake_id) ?? []
    bucket.push({
      itemId: row.id,
      category: row.category,
      source: row.source,
      brandText: row.brand_text,
      productNameText: row.product_name_text,
      productSubmissionId: row.product_submission_id,
    })
    byIntake.set(row.intake_id, bucket)
  }

  const enrollmentById = new Map(enrollments.map((row) => [row.id, row]))
  const targets: DiscoveryReconcileTarget[] = []
  for (const intake of intakes) {
    const enrollment = enrollmentById.get(intake.enrollment_id)
    if (!enrollment) continue
    const pending = byIntake.get(intake.id) ?? []
    // A sweep over every participant should print the ones that need something,
    // not 100 empty blocks. A named participant is always reported, so „nothing
    // pending" is an answer rather than silence.
    if (scope.kind === "all" && pending.length === 0) continue
    targets.push({
      enrollmentId: enrollment.id,
      name: enrollment.display_name,
      email: enrollment.normalized_email,
      intakeId: intake.id,
      finalizedAt: intake.call_finalized_at,
      items: pending,
    })
  }
  return targets
}

/**
 * Unbounded by design: the id list is whatever the pending-item read returned, so
 * it rides the same default max-rows budget and is bounded by the same scale
 * argument. A submission id with no row comes back missing from the map, which
 * the planner reads as research-pending — never as approved.
 */
export async function loadDiscoverySubmissionOutcomes(
  submissionIds: readonly string[],
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<Map<string, DiscoverySubmissionOutcome>> {
  const unique = [...new Set(submissionIds)]
  if (unique.length === 0) return new Map()
  const { data, error } = await client
    .from(SUBMISSIONS_TABLE)
    .select("id,status,approved_product_id")
    .in("id", unique)
  if (error) throw error
  const rows =
    (data as Array<{
      id: string
      status: string | null
      approved_product_id: string | null
    }> | null) ?? []
  return new Map(
    rows.map((row) => [row.id, { status: row.status, approvedProductId: row.approved_product_id }]),
  )
}

export function filterDiscoveryEligibleProductIds(
  productIds: readonly string[],
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<Set<string>> {
  return filterScanEligibleProductIds(client as unknown as SupabaseClient, productIds)
}

/**
 * The only write. `product_id IS NULL` is re-stated as a predicate rather than
 * trusted from the read: between the plan and the write the participant may have
 * captured the product herself, and her answer wins. Returns whether a row moved.
 */
export async function assignDiscoveryIntakeItemProduct(
  input: { itemId: string; productId: string },
  client: DiscoveryAdminClient = createAdminClient(),
): Promise<boolean> {
  const { data, error } = await client
    .from(ITEMS_TABLE)
    .update({ product_id: input.productId })
    .eq("id", input.itemId)
    .is("product_id", null)
    .select("id")
  if (error) throw error
  return ((data as Array<{ id: string }> | null) ?? []).length > 0
}
