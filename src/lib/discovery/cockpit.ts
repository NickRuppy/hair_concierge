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
import {
  composeDiscoveryRefinedRoutine,
  describeDiscoveryIntakeItem,
  DISCOVERY_SCANNED_PRODUCT_LABEL,
  discoveryPrintedRecommendationIds,
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

/** Re-exported: the label rules live with the (pure, hashed) composition now. */
export { describeDiscoveryIntakeItem, DISCOVERY_SCANNED_PRODUCT_LABEL }
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

/**
 * Catalog product id → product line name, for every product a cockpit/PDF label names.
 * Only products that HAVE a line appear in the map.
 */
export async function loadDiscoveryProductLines(
  client: DiscoveryCockpitAdminClient,
  productIds: string[],
): Promise<Map<string, string>> {
  const lines = new Map<string, string>()
  if (productIds.length === 0) return lines
  const { data, error } = await client
    .from("products")
    .select("id, product_line:product_lines(canonical_name)")
    .in("id", productIds)
  if (error) throw new Error("discovery_product_line_lookup_failed")
  type LineRelation = { canonical_name: string | null }
  for (const row of (data as Array<{
    id: string
    product_line: LineRelation | LineRelation[] | null
  }> | null) ?? []) {
    const relation = Array.isArray(row.product_line) ? row.product_line[0] : row.product_line
    const name = relation?.canonical_name?.trim()
    if (name) lines.set(row.id, name)
  }
  return lines
}

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
  /**
   * False when the brand lookup for a call WITHOUT swaps failed, or the product-line
   * lookup failed. The cockpit still renders (labels without brand or line), but the
   * routine's `sourceHash` then describes a degraded document — so finalising refuses and
   * the PDF sends Nick back to the cockpit rather than printing a degraded sheet or a
   * false drift warning.
   */
  recommendationBrandsAvailable: boolean
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
  loadProductLines: typeof loadDiscoveryProductLines
}

export const DISCOVERY_COCKPIT_DEPENDENCIES: DiscoveryCockpitDependencies = {
  loadIdealRoutine: loadDiscoveryIdealRoutine,
  loadItems: loadDiscoveryCockpitItems,
  loadVerdicts: loadParticipantScanVerdicts,
  loadDecisions: loadDiscoveryCallDecisions,
  loadSwapProducts: loadSwapPresentationRows,
  loadProductLines: loadDiscoveryProductLines,
}

/**
 * The catalog identity each owned product's verdict names — handed to the composition so
 * the owned label it prints is also the label it fingerprints.
 */
export function discoveryOwnedProductIdentities(
  verdicts: readonly DiscoveryParticipantVerdict[],
): { itemId: string; brand: string | null; name: string }[] {
  return verdicts.flatMap((verdict) =>
    verdict.status === "verdict"
      ? [{ itemId: verdict.itemId, brand: verdict.product.brand, name: verdict.product.name }]
      : [],
  )
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
  // Outcomes first (composition is pure): only an `ideal` step prints the Idealplan's
  // recommendation, so only those brands are read — and only those gate availability.
  const outline = composeDiscoveryRefinedRoutine({
    steps: ideal.steps,
    items,
    decisions,
    swapProducts: [],
  })
  const printedIds = new Set(discoveryPrintedRecommendationIds(outline))
  // One batched catalog read for both: the swap targets and the printed brands.
  const catalogIds = [...new Set([...swapProductIds, ...printedIds])].sort()
  let catalogRows: ScanCatalogPresentationRow[] = []
  let lookupFailed = false
  if (swapProductIds.size > 0) {
    // Swap rows are required: a failed read fails the composition, exactly as before.
    catalogRows = await deps.loadSwapProducts(admin, catalogIds)
  } else if (catalogIds.length > 0) {
    // Only brand enrichment is at stake — degrade instead of failing the whole call.
    try {
      catalogRows = await deps.loadSwapProducts(admin, catalogIds)
    } catch (error) {
      console.error("[discovery] recommendation brand lookup failed:", error)
      lookupFailed = true
    }
  }
  const swapProducts = catalogRows.filter((row) => swapProductIds.has(row.id))
  const recommendationProducts = catalogRows.filter((row) => printedIds.has(row.id))
  // Product lines for every product a label names: owned catalog products, swap targets
  // and printed recommendations. Enrichment only, like the brands: a failed read degrades
  // (and blocks finalize/PDF) rather than failing the call.
  const lineIds = [
    ...new Set([
      ...items.flatMap((item) => (item.productId ? [item.productId] : [])),
      ...swapProductIds,
      ...printedIds,
    ]),
  ].sort()
  let productLines = new Map<string, string>()
  let linesFailed = false
  if (lineIds.length > 0) {
    try {
      productLines = await deps.loadProductLines(admin, lineIds)
    } catch (error) {
      console.error("[discovery] product line lookup failed:", error)
      linesFailed = true
    }
  }
  // A printed recommendation whose row did not come back would print (and fingerprint)
  // brandless — the same degraded state as a failed read.
  const recommendationBrandsAvailable =
    !lookupFailed && !linesFailed && recommendationProducts.length === printedIds.size

  return {
    status: "ready",
    routine: composeDiscoveryRefinedRoutine({
      steps: ideal.steps,
      items,
      decisions,
      swapProducts,
      recommendationProducts,
      ownedProducts: discoveryOwnedProductIdentities(verdicts),
      productLines,
    }),
    steps: ideal.steps,
    verdicts,
    previewSource: ideal.previewSource,
    recommendationProducts,
    recommendationBrandsAvailable,
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
  /**
   * No product bound AND the participant never answered this category at all — not the
   * same as „benutze ich nicht". Only meaningful once the checklist is submitted; before
   * that an open category is simply not done yet.
   */
  unanswered: boolean
  verdict: DiscoveryCockpitVerdictView | null
  swapOptions: DiscoveryCockpitSwapOption[]
  /** The decided swap target, even when its catalog row could not be read. */
  swapProductId: string | null
  swapProductLabel: string | null
  /** The Idealplan's own recommendation for this step, for the „Neu:" slot. */
  idealRecommendation: DiscoveryCockpitSwapOption | null
  /** That recommendation as the PDF prints it (brand + line + name) — hashed, see routine. */
  recommendationLabel: string | null
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
  /** Categories the participant never answered — the call asks about them. */
  unansweredCategories: PersonalPlanCategory[]
  sourceHash: string
  /** See `DiscoveryCockpitModel.recommendationBrandsAvailable`. */
  recommendationBrandsAvailable: boolean
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

  const unanswered = new Set(model.routine.unansweredCategories)
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
      // Every printed label comes from the composition, which fingerprints it.
      ownedLabel: refined.ownedLabel,
      intakeItemId: item?.id ?? null,
      unanswered: !item && unanswered.has(step.category),
      verdict: verdict
        ? verdict.status === "verdict"
          ? { status: "verdict", product: verdict.product, payload: verdict.payload }
          : { status: verdict.status }
        : null,
      swapOptions,
      swapProductId: refined.swapProductId,
      swapProductLabel: refined.swapProductLabel,
      recommendationLabel: refined.recommendationLabel,
      idealRecommendation: ideal,
    }
  })

  return {
    steps,
    unassigned: model.routine.unassignedIntakeProducts.map((entry) => ({
      itemId: entry.item.id,
      category: entry.item.category,
      label: entry.label,
      reason: entry.reason,
    })),
    declinedCategories: model.routine.declinedCategories,
    unansweredCategories: model.routine.unansweredCategories,
    sourceHash: model.routine.sourceHash,
    recommendationBrandsAvailable: model.recommendationBrandsAvailable,
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
