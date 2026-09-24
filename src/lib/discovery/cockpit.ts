import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { createPresentationRowLoader } from "@/lib/scan/presentation-rows"
import type { ScanCatalogPresentationRow } from "@/lib/scan/product-presentation"
import type { ScanPresentedVerdictPayload, ScanProductHeader } from "@/lib/scan/types"
import { SCAN_VERDICT_COPY } from "@/lib/scan/verdict-labels"

import { DISCOVERY_USAGE_ROLES, type DiscoveryUsageRole } from "./classify"
import {
  loadDiscoveryIdealRoutine,
  type DiscoveryIdealStep,
  type DiscoveryPreviewInput,
  type DiscoveryStepDepth,
} from "./load-ideal-routine"
import {
  loadParticipantScanVerdicts,
  type DiscoveryParticipantVerdict,
  type DiscoveryUsageDifference,
  type DiscoveryVerdictStatus,
} from "./load-participant-verdicts"
import { discoveryProductTitle } from "./product-label"
import type { DiscoveryPropertyRow } from "./property-rows"
import { loadDiscoveryResearchState } from "./research"
import {
  DISCOVERY_RESEARCH_STATUS_COPY,
  discoveryResearchLinks,
  discoveryResearchStatus,
  withDiscoveryResearchLinks,
  type DiscoveryResearchState,
  type DiscoveryResearchStatusKind,
} from "./research-status"
import {
  composeDiscoveryRefinedRoutine,
  describeDiscoveryIntakeItem,
  DISCOVERY_SCANNED_PRODUCT_LABEL,
  discoveryPrintedRecommendationIds,
  discoverySwapProductIds,
  reduceIntakeItemsToSteps,
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
  "id,category,source,brand_text,product_name_text,barcode_identifier,product_id,product_submission_id,created_at,product_type,usage_role"
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
  category: string | null
  source: string
  brand_text: string | null
  product_name_text: string | null
  barcode_identifier: string | null
  product_id: string | null
  product_submission_id: string | null
  created_at: string
  product_type?: string | null
  usage_role?: string | null
}

function isDiscoveryUsageRole(value: unknown): value is DiscoveryUsageRole {
  return typeof value === "string" && (DISCOVERY_USAGE_ROLES as readonly string[]).includes(value)
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
    // NULL = her usage is unknown („Weiß ich nicht", batch 5).
    category: (row.category ?? null) as PersonalPlanCategory | null,
    source: row.source as DiscoveryIntakeItemSource,
    brandText: row.brand_text,
    productNameText: row.product_name_text,
    barcodeIdentifier: row.barcode_identifier,
    productId: row.product_id,
    productSubmissionId: row.product_submission_id,
    createdAt: row.created_at,
    // Only when set (F4): a legacy row's item object — and so its fingerprint — is unchanged.
    ...(row.product_type ? { productType: row.product_type as PersonalPlanCategory } : {}),
    ...(isDiscoveryUsageRole(row.usage_role) ? { usageRole: row.usage_role } : {}),
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

/** How the catalog names a product: the parts of a brand + line + name label. */
export type DiscoveryProductIdentity = {
  name: string
  brand: string | null
  productLine: string | null
  /** The packshot, for the „Eingetragene Produkte" list — display only, never hashed. */
  imageUrl?: string | null
}

/**
 * Catalog identity (name, brand, product line) for every product a cockpit/PDF label or
 * swap option names — one batched read, independent of whether a product's verdict could
 * be computed, so a transient verdict failure never changes a printed name.
 */
export async function loadDiscoveryProductIdentities(
  client: DiscoveryCockpitAdminClient,
  productIds: string[],
): Promise<Map<string, DiscoveryProductIdentity>> {
  const identities = new Map<string, DiscoveryProductIdentity>()
  if (productIds.length === 0) return identities
  const { data, error } = await client
    .from("products")
    .select("id, name, brand, image_url, product_line:product_lines(canonical_name)")
    .in("id", productIds)
  if (error) throw new Error("discovery_product_identity_lookup_failed")
  type LineRelation = { canonical_name: string | null }
  for (const row of (data as Array<{
    id: string
    name: string
    brand: string | null
    image_url?: string | null
    product_line: LineRelation | LineRelation[] | null
  }> | null) ?? []) {
    const relation = Array.isArray(row.product_line) ? row.product_line[0] : row.product_line
    identities.set(row.id, {
      name: row.name,
      brand: row.brand,
      productLine: relation?.canonical_name?.trim() || null,
      imageUrl: row.image_url?.trim() || null,
    })
  }
  return identities
}

/** Product id → line name, for the composition (only products that HAVE a line). */
export function discoveryProductLinesOf(
  identities: ReadonlyMap<string, DiscoveryProductIdentity>,
): Map<string, string> {
  const lines = new Map<string, string>()
  for (const [id, identity] of identities) {
    if (identity.productLine) lines.set(id, identity.productLine)
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
   * False when a printed name could come out degraded: the brand lookup for a call
   * WITHOUT swaps failed, the product-identity lookup failed, or an owned product whose
   * verdict failed transiently has no catalog identity to be named by. The cockpit still
   * renders, but the routine's `sourceHash` then describes a degraded document — so
   * finalising refuses and the PDF sends Nick back to the cockpit rather than printing a
   * degraded sheet or a false drift warning.
   */
  recommendationBrandsAvailable: boolean
  /** Catalog identities of every labelled product and swap option (see the loader). */
  productIdentities?: ReadonlyMap<string, DiscoveryProductIdentity>
  /**
   * The intake as captured (before auto-link) and its research read, for the
   * „Eingetragene Produkte" list. `state` is null when the research read failed — then
   * nothing is auto-linked and `recommendationBrandsAvailable` is false as well, so the
   * degraded composition can never become a stored fingerprint.
   */
  research?: {
    items: DiscoveryIntakeItem[]
    state: DiscoveryResearchState | null
  }
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
  loadProductIdentities: typeof loadDiscoveryProductIdentities
  loadResearchState: (
    client: DiscoveryCockpitAdminClient,
    items: DiscoveryIntakeItem[],
  ) => Promise<DiscoveryResearchState>
}

export const DISCOVERY_COCKPIT_DEPENDENCIES: DiscoveryCockpitDependencies = {
  loadIdealRoutine: loadDiscoveryIdealRoutine,
  loadItems: loadDiscoveryCockpitItems,
  loadVerdicts: loadParticipantScanVerdicts,
  loadDecisions: loadDiscoveryCallDecisions,
  loadSwapProducts: loadSwapPresentationRows,
  loadProductIdentities: loadDiscoveryProductIdentities,
  loadResearchState: (client, items) => loadDiscoveryResearchState(client, items),
}

/**
 * The catalog identity each owned product is named by — handed to the composition so the
 * owned label it prints is also the label it fingerprints.
 *
 * A computed verdict names its product. A TRANSIENT verdict failure (`unavailable`) is
 * named from the separately loaded catalog identity instead, so a flaky verdict never
 * flips the printed name back to the participant's own words (a false drift). The
 * permanent states (not sellable, quarantined, category mismatch, no decision) keep
 * their established label: the participant's own words.
 */
export function discoveryOwnedProductIdentities(
  verdicts: readonly DiscoveryParticipantVerdict[],
  identities: ReadonlyMap<string, DiscoveryProductIdentity> = new Map(),
): { itemId: string; brand: string | null; name: string }[] {
  return verdicts.flatMap((verdict) => {
    if (verdict.status === "verdict") {
      return [{ itemId: verdict.itemId, brand: verdict.product.brand, name: verdict.product.name }]
    }
    const identity = verdict.status === "unavailable" ? identities.get(verdict.productId) : null
    return identity ? [{ itemId: verdict.itemId, brand: identity.brand, name: identity.name }] : []
  })
}

export async function loadDiscoveryCockpitModel(
  admin: DiscoveryCockpitAdminClient,
  input: { intakeId: string; userId: string },
  overrides: Partial<DiscoveryCockpitDependencies> = {},
): Promise<DiscoveryCockpitModelResult> {
  const deps = { ...DISCOVERY_COCKPIT_DEPENDENCIES, ...overrides }

  const ideal = await deps.loadIdealRoutine(admin, input.userId, input.intakeId)
  if (ideal.status !== "ready") return { status: ideal.status }

  const capturedItems = await deps.loadItems(input.intakeId, admin)
  // Auto-link, read-only: research approved onto an eligible product counts as the item's
  // product for everything below — verdicts, binding, labels, the PDF and the fingerprint —
  // without writing `product_id` (the reconcile CLI still can). A failed research read
  // links nothing and blocks finalising, like a failed brand read: the composition would
  // otherwise fingerprint (and print) the pre-approval state as if it were current.
  let researchState: DiscoveryResearchState | null
  try {
    researchState = await deps.loadResearchState(admin, capturedItems)
  } catch (error) {
    console.error("[discovery] research state lookup failed:", error)
    researchState = null
  }
  const links = researchState
    ? discoveryResearchLinks(capturedItems, researchState)
    : new Map<string, string>()
  // Nothing linked: the very rows as loaded, untouched.
  const items = links.size > 0 ? withDiscoveryResearchLinks(capturedItems, links) : capturedItems
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
  // Catalog identity (brand, line, name) for every product a label or a swap option names:
  // owned catalog products, swap targets, printed recommendations and every option the
  // cockpit offers. Enrichment only, like the brands: a failed read degrades (and blocks
  // finalize/PDF) rather than failing the call.
  const identityIds = [
    ...new Set([
      ...items.flatMap((item) => (item.productId ? [item.productId] : [])),
      ...swapProductIds,
      ...printedIds,
      ...ideal.steps.flatMap((entry) =>
        entry.preview?.kind === "recommendation" ? [entry.preview.productId] : [],
      ),
      ...verdicts.flatMap((verdict) =>
        verdict.status === "verdict" && verdict.payload.kind === "in_catalog"
          ? verdict.payload.alternatives.map((alternative) => alternative.productId)
          : [],
      ),
    ]),
  ].sort()
  let productIdentities = new Map<string, DiscoveryProductIdentity>()
  let identitiesFailed = false
  if (identityIds.length > 0) {
    try {
      productIdentities = await deps.loadProductIdentities(admin, identityIds)
    } catch (error) {
      console.error("[discovery] product identity lookup failed:", error)
      identitiesFailed = true
    }
  }
  // An owned product whose verdict failed transiently is named by its catalog identity;
  // without one, its printed name would silently fall back to her own words.
  const ownedIdentityMissing = verdicts.some(
    (verdict) => verdict.status === "unavailable" && !productIdentities.has(verdict.productId),
  )
  // A printed recommendation whose row did not come back would print (and fingerprint)
  // brandless — the same degraded state as a failed read.
  const recommendationBrandsAvailable =
    researchState !== null &&
    !lookupFailed &&
    !identitiesFailed &&
    !ownedIdentityMissing &&
    recommendationProducts.length === printedIds.size

  return {
    status: "ready",
    routine: composeDiscoveryRefinedRoutine({
      steps: ideal.steps,
      items,
      decisions,
      swapProducts,
      recommendationProducts,
      ownedProducts: discoveryOwnedProductIdentities(verdicts, productIdentities),
      productLines: discoveryProductLinesOf(productIdentities),
    }),
    steps: ideal.steps,
    verdicts,
    previewSource: ideal.previewSource,
    recommendationProducts,
    recommendationBrandsAvailable,
    productIdentities,
    research: { items: capturedItems, state: researchState },
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
  /**
   * The option as the PDF would print it once chosen (the swap label): the catalog's
   * brand + line + name, falling back to the engine's own name and brand.
   */
  label: string
  verdictLabel: string
  origin: "alternative" | "ideal_recommendation"
  /** Target-vs-product rows for a displayed alternative; null when there are none. */
  propertyRows: DiscoveryPropertyRow[] | null
}

export type DiscoveryCockpitVerdictView =
  | {
      status: "verdict"
      product: ScanProductHeader
      payload: ScanPresentedVerdictPayload
      /** Her product's target-vs-product rows (empty when they could not be built). */
      propertyRows: DiscoveryPropertyRow[]
    }
  | { status: Exclude<DiscoveryVerdictStatus, "verdict"> }

export type DiscoveryCockpitStepView = {
  decisionKey: string
  category: PersonalPlanCategory
  categoryLabel: string
  roleLabel: string
  roleDescription: string | null
  frequencyLabel: string
  /** Why / product type / criteria / fit / timing, for the call (not printed, not hashed). */
  depth: DiscoveryStepDepth | null
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
  /** „als Haarmaske benutzt" as the PDF prints it next to her product (F6), else null. */
  ownedUsageLabel: string | null
  /**
   * She uses her product differently from what it is, legitimately (F2): the verdict grades
   * the product against its own category, and the cockpit names both. Null otherwise.
   */
  usageDifference: DiscoveryUsageDifference | null
}

export type DiscoveryCockpitUnassignedView = {
  itemId: string
  /** Null only for `category_unknown`. */
  category: PersonalPlanCategory | null
  label: string
  reason: DiscoveryUnassignedReason
  /** „als Haarmaske benutzt" as the PDF prints it (F6), else null. */
  usageLabel: string | null
}

/** One captured product in „Eingetragene Produkte" — every row but „benutze ich nicht". */
export type DiscoveryCockpitIntakeProductView = {
  itemId: string
  /** Her usage; null = „Kategorie offen" (batch 5, R7). */
  category: PersonalPlanCategory | null
  /** The routine role of her usage (oil roles, scalp oil), else null. */
  usageRole: DiscoveryUsageRole | null
  /** What the product IS (batch 5, F1); null for a legacy row or when nobody knows yet. */
  productType: PersonalPlanCategory | null
  /**
   * Nobody knows what the product is: no type, no catalog product, no research. Only then
   * may the cockpit set its product type (R7) — before research can start.
   */
  typeOpen: boolean
  /** Her own product name (for the usage preselection, F5); null when she typed none. */
  productName: string | null
  /** Brand + line + name from the catalog when the item has a product, else her words. */
  label: string
  imageUrl: string | null
  status: DiscoveryResearchStatusKind
  statusLabel: string
  /** „Recherche starten" applies (the route re-decides server-side). */
  canStartResearch: boolean
}

export type DiscoveryCockpitView = {
  /** The captured products, in capture order (the page sorts them onto the shelf). */
  intakeProducts: DiscoveryCockpitIntakeProductView[]
  /** False when the research read failed: statuses say so, and finalising is blocked. */
  researchStatusAvailable: boolean
  steps: DiscoveryCockpitStepView[]
  unassigned: DiscoveryCockpitUnassignedView[]
  declinedCategories: PersonalPlanCategory[]
  /** Categories the participant never answered — the call asks about them. */
  unansweredCategories: PersonalPlanCategory[]
  sourceHash: string
  /** See `DiscoveryCockpitModel.recommendationBrandsAvailable`. */
  recommendationBrandsAvailable: boolean
}

function optionLabel(
  productId: string,
  fallback: { name: string; brand: string | null },
  identities: ReadonlyMap<string, DiscoveryProductIdentity>,
): string {
  const identity = identities.get(productId)
  return discoveryProductTitle({
    brand: identity ? identity.brand : fallback.brand,
    productLine: identity?.productLine ?? null,
    name: identity ? identity.name : fallback.name,
  })
}

function alternativeOption(
  alternative: {
    productId: string
    displayName: string
    brand: string | null
    verdictLabel: string
  },
  identities: ReadonlyMap<string, DiscoveryProductIdentity>,
  propertyRows: DiscoveryPropertyRow[] | null,
): DiscoveryCockpitSwapOption {
  return {
    productId: alternative.productId,
    name: alternative.displayName,
    brand: alternative.brand,
    label: optionLabel(
      alternative.productId,
      { name: alternative.displayName, brand: alternative.brand },
      identities,
    ),
    verdictLabel: alternative.verdictLabel,
    origin: "alternative",
    propertyRows,
  }
}

function idealRecommendationOption(
  step: DiscoveryIdealStep,
  brandsByProductId: ReadonlyMap<string, string | null>,
  identities: ReadonlyMap<string, DiscoveryProductIdentity>,
): DiscoveryCockpitSwapOption | null {
  const preview = step.preview
  if (!preview || preview.kind !== "recommendation") return null
  const brand = brandsByProductId.get(preview.productId) ?? null
  return {
    productId: preview.productId,
    name: preview.productName,
    brand,
    label: optionLabel(preview.productId, { name: preview.productName, brand }, identities),
    verdictLabel: SCAN_VERDICT_COPY[preview.verdict].label,
    origin: "ideal_recommendation",
    propertyRows: null,
  }
}

/**
 * The „Eingetragene Produkte" rows: every captured product (not „benutze ich nicht"), named
 * like the routine names it once it has a catalog product — her own or auto-linked — and
 * with its research state otherwise.
 */
function intakeProductViews(model: DiscoveryCockpitModel): DiscoveryCockpitIntakeProductView[] {
  if (!model.research) return []
  const identities = model.productIdentities ?? new Map<string, DiscoveryProductIdentity>()
  const state = model.research.state
  const links = state ? discoveryResearchLinks(model.research.items, state) : new Map()
  return model.research.items
    .filter((item) => item.source !== "none")
    .map((item) => {
      const productId = item.productId ?? links.get(item.id) ?? null
      const identity = productId ? identities.get(productId) : undefined
      const status = discoveryResearchStatus(item, state)
      return {
        itemId: item.id,
        category: item.category,
        usageRole: item.usageRole ?? null,
        productType: item.productType ?? null,
        typeOpen:
          (item.productType ?? null) === null &&
          item.productId === null &&
          item.productSubmissionId === null,
        productName: identity?.name ?? item.productNameText ?? null,
        label: identity
          ? discoveryProductTitle({
              brand: identity.brand,
              productLine: identity.productLine,
              name: identity.name,
            })
          : describeDiscoveryIntakeItem(item),
        imageUrl: identity?.imageUrl ?? null,
        status: status.kind,
        statusLabel: DISCOVERY_RESEARCH_STATUS_COPY[status.kind],
        canStartResearch: status.action !== null,
      }
    })
}

export function buildDiscoveryCockpitView(model: DiscoveryCockpitModel): DiscoveryCockpitView {
  const verdictsByItemId = new Map(model.verdicts.map((entry) => [entry.itemId, entry]))
  const brandsByProductId = new Map(
    model.recommendationProducts.map((row) => [row.id, row.brand] as const),
  )

  const identities = model.productIdentities ?? new Map<string, DiscoveryProductIdentity>()
  const unanswered = new Set(model.routine.unansweredCategories)
  const steps = model.routine.steps.map((refined): DiscoveryCockpitStepView => {
    const { step, item } = refined
    const verdict = item ? (verdictsByItemId.get(item.id) ?? null) : null
    const alternatives =
      verdict?.status === "verdict" && verdict.payload.kind === "in_catalog"
        ? verdict.payload.alternatives
        : []
    const alternativeRows = new Map(
      (verdict?.status === "verdict" ? (verdict.propertyRows?.alternatives ?? []) : []).map(
        (entry) => [entry.productId, entry.rows] as const,
      ),
    )
    const ideal = idealRecommendationOption(step, brandsByProductId, identities)
    // The ruled fallback: with no displayed alternatives the only swap target the cockpit
    // can honestly offer is the Idealplan's own pick — and never the product already in
    // the participant's bathroom.
    const swapOptions =
      alternatives.length > 0
        ? alternatives.map((alternative) =>
            alternativeOption(
              alternative,
              identities,
              alternativeRows.get(alternative.productId) ?? null,
            ),
          )
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
      depth: step.depth ?? null,
      section: step.section,
      outcome: refined.outcome,
      // Every printed label comes from the composition, which fingerprints it.
      ownedLabel: refined.ownedLabel,
      intakeItemId: item?.id ?? null,
      unanswered: !item && unanswered.has(step.category),
      verdict: verdict
        ? verdict.status === "verdict"
          ? {
              status: "verdict",
              product: verdict.product,
              payload: verdict.payload,
              propertyRows: verdict.propertyRows?.product ?? [],
            }
          : { status: verdict.status }
        : null,
      swapOptions,
      swapProductId: refined.swapProductId,
      swapProductLabel: refined.swapProductLabel,
      recommendationLabel: refined.recommendationLabel,
      idealRecommendation: ideal,
      ownedUsageLabel: refined.ownedUsageLabel ?? null,
      usageDifference: verdict?.status === "verdict" ? (verdict.usageDifference ?? null) : null,
    }
  })

  return {
    intakeProducts: intakeProductViews(model),
    researchStatusAvailable: model.research ? model.research.state !== null : true,
    steps,
    unassigned: model.routine.unassignedIntakeProducts.map((entry) => ({
      itemId: entry.item.id,
      category: entry.item.category,
      label: entry.label,
      reason: entry.reason,
      usageLabel: entry.usageLabel ?? null,
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

// --- Usage correction (batch 5: R7, R10, P1-3, F3) ------------------------------

export type DiscoveryItemUsageChange = {
  itemId: string
  category: PersonalPlanCategory
  role: DiscoveryUsageRole | null
  /** Only for a type-open item („Kategorie offen", R7). */
  productType: PersonalPlanCategory | null
}

/**
 * The items exactly as the composition bound them — auto-linked research included — so a
 * re-binding after a usage change is computed on the same inputs the cockpit rendered.
 * `none` rows never bind and are left out.
 */
function composedItems(model: DiscoveryCockpitModel): DiscoveryIntakeItem[] {
  return [
    ...model.routine.steps.flatMap((entry) => (entry.item ? [entry.item] : [])),
    ...model.routine.unassignedIntakeProducts.map((entry) => entry.item),
  ]
}

/**
 * F3 — decisions follow the item: the decision keys of every step whose bound item a usage
 * change would change (the item's own old step, the step it lands on, and any step whose
 * item it displaces). Decisions that reference the moved item itself are cleared by id in
 * the same database call; these keys cover the rest. Pure.
 */
export function discoveryStaleDecisionKeysForUsageChange(
  model: DiscoveryCockpitModel,
  change: DiscoveryItemUsageChange,
): string[] {
  const before = new Map(
    model.routine.steps.map((entry) => [entry.step.decisionKey, entry.item?.id ?? null] as const),
  )
  const items = composedItems(model).map((item): DiscoveryIntakeItem => {
    if (item.id !== change.itemId) return item
    const moved: DiscoveryIntakeItem = { ...item, category: change.category }
    delete moved.usageRole
    if (change.role) moved.usageRole = change.role
    if (change.productType) moved.productType = change.productType
    return moved
  })
  const after = reduceIntakeItemsToSteps(model.steps, items).bindings
  return after
    .filter(
      (binding) => (binding.item?.id ?? null) !== (before.get(binding.step.decisionKey) ?? null),
    )
    .map((binding) => binding.step.decisionKey)
    .sort()
}

export type DiscoveryItemUsageOutcome =
  | "not_found"
  | "not_submitted"
  | "finalized"
  | "item_not_found"
  | "type_known"
  | "product_type_required"
  | "updated"

export type DiscoveryItemUsageResult = {
  outcome: DiscoveryItemUsageOutcome
  noneInserted?: boolean
  noneRemoved?: boolean
  decisionsCleared?: number
}

/**
 * The correction as ONE database call (`discovery_admin_set_intake_item_usage`): refuses
 * while finalised or a draft, sets usage (+ type for a type-open item), removes the
 * destination's „benutzt sie nicht", records one for a vacated category, and clears the
 * moved item's decisions plus `staleDecisionKeys`.
 */
export async function setDiscoveryIntakeItemUsage(
  input: DiscoveryItemUsageChange & { intakeId: string; staleDecisionKeys: string[] },
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryItemUsageResult> {
  const { data, error } = await client.rpc("discovery_admin_set_intake_item_usage", {
    target_intake_id: input.intakeId,
    target_item_id: input.itemId,
    new_category: input.category,
    new_usage_role: input.role,
    new_product_type: input.productType,
    stale_decision_keys: input.staleDecisionKeys,
  })
  if (error) throw error
  const row = (data ?? {}) as {
    outcome?: string
    none_inserted?: boolean
    none_removed?: boolean
    decisions_cleared?: number
  }
  const outcomes: readonly DiscoveryItemUsageOutcome[] = [
    "not_found",
    "not_submitted",
    "finalized",
    "item_not_found",
    "type_known",
    "product_type_required",
    "updated",
  ]
  if (!outcomes.includes(row.outcome as DiscoveryItemUsageOutcome)) {
    throw new Error("discovery_item_usage_unexpected_outcome")
  }
  return {
    outcome: row.outcome as DiscoveryItemUsageOutcome,
    ...(row.outcome === "updated"
      ? {
          noneInserted: row.none_inserted === true,
          noneRemoved: row.none_removed === true,
          decisionsCleared: row.decisions_cleared ?? 0,
        }
      : {}),
  }
}

/** Items whose usage is unknown — finalising waits for them (P1-5). */
export function discoveryCategoryOpenItems(
  view: Pick<DiscoveryCockpitView, "unassigned">,
): DiscoveryCockpitUnassignedView[] {
  return view.unassigned.filter((entry) => entry.reason === "category_unknown")
}
