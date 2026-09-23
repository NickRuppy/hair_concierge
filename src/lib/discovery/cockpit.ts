import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { createPresentationRowLoader } from "@/lib/scan/presentation-rows"
import type { ScanCatalogPresentationRow } from "@/lib/scan/product-presentation"
import type { ScanPresentedVerdictPayload, ScanProductHeader } from "@/lib/scan/types"
import { SCAN_VERDICT_COPY } from "@/lib/scan/verdict-labels"

import {
  loadDiscoveryIdealRoutine,
  type DiscoveryIdealStep,
  type DiscoveryPreviewInput,
} from "./load-ideal-routine"
import {
  loadParticipantScanVerdicts,
  type DiscoveryParticipantVerdict,
  type DiscoveryVerdictStatus,
} from "./load-participant-verdicts"
import { discoveryProductLabel } from "./product-label"
import {
  composeDiscoveryRefinedRoutine,
  discoverySwapProductIds,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
  type DiscoveryIntakeItemSource,
  type DiscoveryRefinedRoutine,
  type DiscoveryStepOutcome,
  type DiscoveryUnassignedReason,
} from "./refined-routine"

/**
 * The call cockpit's own layer: the one composition both the page and the decisions API
 * read, plus the three writes the call performs.
 *
 * Two rules the rest of the feature depends on:
 *
 *  - **One composition per request.** `loadDiscoveryIdealRoutine` prepares the evaluation
 *    context (without publishing anything) and that SAME context is handed to
 *    `loadParticipantScanVerdicts`. Loading it twice would re-enter the publishing path
 *    this feature must not touch, and the verdict fan-out is one computation per owned
 *    product.
 *  - **The API validates against the view it renders.** A swap may only name a product the
 *    cockpit actually offered for that step, so `buildDiscoveryCockpitView` is what both
 *    surfaces read — the page to render the radios, the route to decide whether a
 *    `swap_product_id` is admissible.
 */

const INTAKES_TABLE = "discovery_intakes"
const ITEMS_TABLE = "discovery_intake_items"
const DECISIONS_TABLE = "discovery_call_decisions"

const INTAKE_COLUMNS =
  "id,enrollment_id,user_id,state,submitted_at,call_finalized_at,finalized_source_hash"
const ITEM_COLUMNS =
  "id,category,source,brand_text,product_name_text,barcode_identifier,product_id,product_submission_id,created_at"
const DECISION_COLUMNS = "decision_key,decision,swap_product_id,intake_item_id"

/** „Gescanntes Produkt" — a `barcode_unknown` row carries no text at all, only the code. */
export const DISCOVERY_SCANNED_PRODUCT_LABEL = "Gescanntes Produkt"
/** Everything not yet reconciled into the catalog, in one internal phrase. */
export const DISCOVERY_RESEARCH_PENDING_LABEL = "Noch in Recherche"

export type DiscoveryCockpitAdminClient = SupabaseClient

// --- Reads -------------------------------------------------------------------

/**
 * The intake as the CALL sees it — T3's `loadDiscoveryIntake` deliberately projects only
 * the participant-side columns, and finalising lives on the two this adds.
 */
export type DiscoveryCallIntake = {
  id: string
  enrollmentId: string
  userId: string
  state: "draft" | "submitted"
  submittedAt: string | null
  callFinalizedAt: string | null
  finalizedSourceHash: string | null
}

type IntakeRow = {
  id: string
  enrollment_id: string
  user_id: string
  state: string
  submitted_at: string | null
  call_finalized_at: string | null
  finalized_source_hash: string | null
}

function projectCallIntake(row: IntakeRow): DiscoveryCallIntake {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    userId: row.user_id,
    state: row.state === "submitted" ? "submitted" : "draft",
    submittedAt: row.submitted_at,
    callFinalizedAt: row.call_finalized_at,
    finalizedSourceHash: row.finalized_source_hash,
  }
}

export async function loadDiscoveryCallIntake(
  enrollmentId: string,
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryCallIntake | null> {
  const { data, error } = await client
    .from(INTAKES_TABLE)
    .select(INTAKE_COLUMNS)
    .eq("enrollment_id", enrollmentId)
    .maybeSingle()
  if (error) throw error
  const row = (data as IntakeRow | null) ?? null
  return row ? projectCallIntake(row) : null
}

/** The cockpit list's one read: every intake, by enrollment. */
export async function listDiscoveryCallIntakes(
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryCallIntake[]> {
  const { data, error } = await client
    .from(INTAKES_TABLE)
    .select(INTAKE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(250)
  if (error) throw error
  return ((data as IntakeRow[] | null) ?? []).map(projectCallIntake)
}

type ItemRow = {
  id: string
  category: string
  source: string
  brand_text: string | null
  product_name_text: string | null
  barcode_identifier: string | null
  product_id: string | null
  product_submission_id: string | null
  created_at: string
}

/**
 * The intake items as the READ model needs them — T3's loader projects the checklist's
 * shape, which has no `created_at`, and `created_at` is a tie-break of the binding order.
 */
export async function loadDiscoveryCockpitItems(
  intakeId: string,
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryIntakeItem[]> {
  const { data, error } = await client
    .from(ITEMS_TABLE)
    .select(ITEM_COLUMNS)
    .eq("intake_id", intakeId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
  if (error) throw error
  return ((data as ItemRow[] | null) ?? []).map((row) => ({
    id: row.id,
    category: row.category as PersonalPlanCategory,
    source: row.source as DiscoveryIntakeItemSource,
    brandText: row.brand_text,
    productNameText: row.product_name_text,
    barcodeIdentifier: row.barcode_identifier,
    productId: row.product_id,
    productSubmissionId: row.product_submission_id,
    createdAt: row.created_at,
  }))
}

export async function loadDiscoveryCallDecisions(
  intakeId: string,
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryCallDecision[]> {
  const { data, error } = await client
    .from(DECISIONS_TABLE)
    .select(DECISION_COLUMNS)
    .eq("intake_id", intakeId)
    .order("decision_key", { ascending: true })
  if (error) throw error
  return (
    (data as Array<{
      decision_key: string
      decision: string
      swap_product_id: string | null
      intake_item_id: string | null
    }> | null) ?? []
  ).map((row) => ({
    decisionKey: row.decision_key,
    decision: row.decision === "swap" ? "swap" : "keep",
    swapProductId: row.swap_product_id,
    intakeItemId: row.intake_item_id,
  }))
}

const loadSwapPresentationRows = createPresentationRowLoader("discovery_swap_lookup_failed")

// --- Composition -------------------------------------------------------------

export type DiscoveryCockpitModel = {
  status: "ready"
  routine: DiscoveryRefinedRoutine
  steps: DiscoveryIdealStep[]
  verdicts: DiscoveryParticipantVerdict[]
  previewSource: DiscoveryPreviewInput
  /**
   * Catalog rows for the Idealplan's own recommendations. The preview carries only the
   * catalog `name`, which is often brandless („Klärendes Serum"); the brand comes from here.
   */
  recommendationProducts: ScanCatalogPresentationRow[]
}

export type DiscoveryCockpitModelResult =
  | DiscoveryCockpitModel
  | { status: "no_usable_source" }
  | { status: "temporarily_unavailable" }

export type DiscoveryCockpitDependencies = {
  loadIdealRoutine: typeof loadDiscoveryIdealRoutine
  loadItems: typeof loadDiscoveryCockpitItems
  loadVerdicts: typeof loadParticipantScanVerdicts
  loadDecisions: typeof loadDiscoveryCallDecisions
  loadSwapProducts: (
    client: DiscoveryCockpitAdminClient,
    productIds: string[],
  ) => Promise<ScanCatalogPresentationRow[]>
}

export const DISCOVERY_COCKPIT_DEPENDENCIES: DiscoveryCockpitDependencies = {
  loadIdealRoutine: loadDiscoveryIdealRoutine,
  loadItems: loadDiscoveryCockpitItems,
  loadVerdicts: loadParticipantScanVerdicts,
  loadDecisions: loadDiscoveryCallDecisions,
  loadSwapProducts: loadSwapPresentationRows,
}

export async function loadDiscoveryCockpitModel(
  admin: DiscoveryCockpitAdminClient,
  input: { intakeId: string; userId: string },
  overrides: Partial<DiscoveryCockpitDependencies> = {},
): Promise<DiscoveryCockpitModelResult> {
  const deps = { ...DISCOVERY_COCKPIT_DEPENDENCIES, ...overrides }

  const ideal = await deps.loadIdealRoutine(admin, input.userId, input.intakeId)
  if (ideal.status !== "ready") return { status: ideal.status }

  const items = await deps.loadItems(input.intakeId, admin)
  // Exactly one verdict pass per render, on the context the Idealplan already prepared.
  const verdicts = await deps.loadVerdicts(admin, input.userId, items, ideal.context)
  const decisions = await deps.loadDecisions(input.intakeId, admin)
  const swapProductIds = new Set(discoverySwapProductIds(decisions))
  const recommendationIds = new Set(
    ideal.steps.flatMap((step) =>
      step.preview?.kind === "recommendation" ? [step.preview.productId] : [],
    ),
  )
  // One batched catalog read for both: the swap targets and the recommendations' brands.
  const catalogIds = [...new Set([...swapProductIds, ...recommendationIds])].sort()
  const catalogRows = catalogIds.length > 0 ? await deps.loadSwapProducts(admin, catalogIds) : []
  const swapProducts = catalogRows.filter((row) => swapProductIds.has(row.id))

  return {
    status: "ready",
    routine: composeDiscoveryRefinedRoutine({
      steps: ideal.steps,
      items,
      decisions,
      swapProducts,
    }),
    steps: ideal.steps,
    verdicts,
    previewSource: ideal.previewSource,
    recommendationProducts: catalogRows.filter((row) => recommendationIds.has(row.id)),
  }
}

// --- View --------------------------------------------------------------------

/**
 * A swap target the cockpit offers for one step.
 *
 * `origin` is the ruling (2026-09-22): the options are the alternatives the engine already
 * DISPLAYS for the participant's product — no catalog picker — plus the Idealplan's own
 * recommendation where the engine offers no alternatives at all (an open step, or a bound
 * product whose verdict could not be computed). Whatever is listed here is exactly what
 * the decisions route accepts.
 */
export type DiscoveryCockpitSwapOption = {
  productId: string
  name: string
  brand: string | null
  verdictLabel: string
  origin: "alternative" | "ideal_recommendation"
}

export type DiscoveryCockpitVerdictView =
  | { status: "verdict"; product: ScanProductHeader; payload: ScanPresentedVerdictPayload }
  | { status: Exclude<DiscoveryVerdictStatus, "verdict"> }

export type DiscoveryCockpitStepView = {
  decisionKey: string
  category: PersonalPlanCategory
  categoryLabel: string
  roleLabel: string
  roleDescription: string | null
  frequencyLabel: string
  section: "basis" | "optional"
  outcome: DiscoveryStepOutcome
  /** What the participant owns for this step, as the cockpit names it. */
  ownedLabel: string | null
  intakeItemId: string | null
  verdict: DiscoveryCockpitVerdictView | null
  swapOptions: DiscoveryCockpitSwapOption[]
  /** The decided swap target, even when its catalog row could not be read. */
  swapProductId: string | null
  swapProductLabel: string | null
  /** The Idealplan's own recommendation for this step, for the „Neu:" slot and the PDF. */
  idealRecommendation: DiscoveryCockpitSwapOption | null
}

export type DiscoveryCockpitUnassignedView = {
  itemId: string
  category: PersonalPlanCategory
  label: string
  reason: DiscoveryUnassignedReason
}

export type DiscoveryCockpitView = {
  steps: DiscoveryCockpitStepView[]
  unassigned: DiscoveryCockpitUnassignedView[]
  declinedCategories: PersonalPlanCategory[]
  sourceHash: string
}

/**
 * How the cockpit names an intake product that has no catalog row behind it.
 *
 * A `barcode_unknown` row carries NO brand and NO name — its identity is the barcode
 * (T3 handoff), so it reads „Gescanntes Produkt · <code>" rather than pretending to a
 * name nobody entered.
 */
export function describeDiscoveryIntakeItem(item: DiscoveryIntakeItem): string {
  const text = discoveryProductLabel(item.brandText, item.productNameText)
  if (text) return text
  if (item.barcodeIdentifier) {
    return `${DISCOVERY_SCANNED_PRODUCT_LABEL} · ${item.barcodeIdentifier}`
  }
  return DISCOVERY_SCANNED_PRODUCT_LABEL
}

function alternativeOption(alternative: {
  productId: string
  displayName: string
  brand: string | null
  verdictLabel: string
}): DiscoveryCockpitSwapOption {
  return {
    productId: alternative.productId,
    name: alternative.displayName,
    brand: alternative.brand,
    verdictLabel: alternative.verdictLabel,
    origin: "alternative",
  }
}

function idealRecommendationOption(
  step: DiscoveryIdealStep,
  brandsByProductId: ReadonlyMap<string, string | null>,
): DiscoveryCockpitSwapOption | null {
  const preview = step.preview
  if (!preview || preview.kind !== "recommendation") return null
  return {
    productId: preview.productId,
    name: preview.productName,
    brand: brandsByProductId.get(preview.productId) ?? null,
    verdictLabel: SCAN_VERDICT_COPY[preview.verdict].label,
    origin: "ideal_recommendation",
  }
}

export function buildDiscoveryCockpitView(model: DiscoveryCockpitModel): DiscoveryCockpitView {
  const verdictsByItemId = new Map(model.verdicts.map((entry) => [entry.itemId, entry]))
  const brandsByProductId = new Map(
    model.recommendationProducts.map((row) => [row.id, row.brand] as const),
  )

  const steps = model.routine.steps.map((refined): DiscoveryCockpitStepView => {
    const { step, item } = refined
    const verdict = item ? (verdictsByItemId.get(item.id) ?? null) : null
    const alternatives =
      verdict?.status === "verdict" && verdict.payload.kind === "in_catalog"
        ? verdict.payload.alternatives
        : []
    const ideal = idealRecommendationOption(step, brandsByProductId)
    // The ruled fallback: with no displayed alternatives the only swap target the cockpit
    // can honestly offer is the Idealplan's own pick — and never the product already in
    // the participant's bathroom.
    const swapOptions =
      alternatives.length > 0
        ? alternatives.map(alternativeOption)
        : ideal && ideal.productId !== item?.productId
          ? [ideal]
          : []

    return {
      decisionKey: step.decisionKey,
      category: step.category,
      categoryLabel: step.categoryLabel,
      roleLabel: step.roleLabel,
      roleDescription: step.roleDescription,
      frequencyLabel: step.frequencyLabel,
      section: step.section,
      outcome: refined.outcome,
      ownedLabel: item
        ? verdict?.status === "verdict"
          ? discoveryProductLabel(verdict.product.brand, verdict.product.name)
          : describeDiscoveryIntakeItem(item)
        : null,
      intakeItemId: item?.id ?? null,
      verdict: verdict
        ? verdict.status === "verdict"
          ? { status: "verdict", product: verdict.product, payload: verdict.payload }
          : { status: verdict.status }
        : null,
      swapOptions,
      swapProductId: refined.swapProductId,
      swapProductLabel: refined.swapProduct
        ? discoveryProductLabel(refined.swapProduct.brand, refined.swapProduct.name)
        : null,
      idealRecommendation: ideal,
    }
  })

  return {
    steps,
    unassigned: model.routine.unassignedIntakeProducts.map((entry) => ({
      itemId: entry.item.id,
      category: entry.item.category,
      label: describeDiscoveryIntakeItem(entry.item),
      reason: entry.reason,
    })),
    declinedCategories: model.routine.declinedCategories,
    sourceHash: model.routine.sourceHash,
  }
}

/**
 * What a `swap` on this step may name. Empty means the step offers no swap at all, so
 * every swap for it is refused — the call can still keep, or un-finalize and think again.
 */
export function discoveryCockpitSwapOptionIds(
  view: DiscoveryCockpitView,
  decisionKey: string,
): string[] | null {
  const step = view.steps.find((entry) => entry.decisionKey === decisionKey)
  if (!step) return null
  return step.swapOptions.map((option) => option.productId)
}

// --- Writes ------------------------------------------------------------------

export type DiscoveryCallDecisionInput = {
  intakeId: string
  decisionKey: string
  decision: "keep" | "swap"
  swapProductId: string | null
  intakeItemId: string | null
}

/**
 * One row per (intake, decision key) — the call changes its mind by overwriting, not by
 * accumulating. `intake_item_id` is written from the SERVER's binding, never from the
 * request: the client names a step, not which of the participant's products sits in it.
 */
export async function upsertDiscoveryCallDecision(
  input: DiscoveryCallDecisionInput,
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryCallDecision> {
  const { data, error } = await client
    .from(DECISIONS_TABLE)
    .upsert(
      {
        intake_id: input.intakeId,
        decision_key: input.decisionKey,
        decision: input.decision,
        swap_product_id: input.decision === "swap" ? input.swapProductId : null,
        intake_item_id: input.intakeItemId,
      },
      { onConflict: "intake_id,decision_key" },
    )
    .select(DECISION_COLUMNS)
    .maybeSingle()
  if (error) throw error
  const row =
    (data as {
      decision_key: string
      decision: string
      swap_product_id: string | null
      intake_item_id: string | null
    } | null) ?? null
  if (!row) throw new Error("Discovery call decision could not be stored")
  return {
    decisionKey: row.decision_key,
    decision: row.decision === "swap" ? "swap" : "keep",
    swapProductId: row.swap_product_id,
    intakeItemId: row.intake_item_id,
  }
}

/**
 * „Finalisieren": the timestamp and the fingerprint of the routine as it stands, written
 * together (the table's CHECK insists on the pair). The `state = 'submitted'` predicate is
 * part of the UPDATE, so a draft intake finalises nothing and says so.
 */
export async function finalizeDiscoveryCall(
  input: { intakeId: string; sourceHash: string; now?: () => string },
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryCallIntake | null> {
  const at = (input.now ?? (() => new Date().toISOString()))()
  const { data, error } = await client
    .from(INTAKES_TABLE)
    .update({ call_finalized_at: at, finalized_source_hash: input.sourceHash })
    .eq("id", input.intakeId)
    .eq("state", "submitted")
    .select(INTAKE_COLUMNS)
    .maybeSingle()
  if (error) throw error
  const row = (data as IntakeRow | null) ?? null
  return row ? projectCallIntake(row) : null
}

/** Un-finalising clears BOTH columns — a stored hash without a timestamp means nothing. */
export async function unfinalizeDiscoveryCall(
  intakeId: string,
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryCallIntake | null> {
  const { data, error } = await client
    .from(INTAKES_TABLE)
    .update({ call_finalized_at: null, finalized_source_hash: null })
    .eq("id", intakeId)
    .select(INTAKE_COLUMNS)
    .maybeSingle()
  if (error) throw error
  const row = (data as IntakeRow | null) ?? null
  return row ? projectCallIntake(row) : null
}
