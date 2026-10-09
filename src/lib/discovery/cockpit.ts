import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { createPresentationRowLoader } from "@/lib/scan/presentation-rows"
import type { ScanCatalogPresentationRow } from "@/lib/scan/product-presentation"
import type { ScanPresentedVerdictPayload, ScanProductHeader } from "@/lib/scan/types"
import { SCAN_VERDICT_COPY } from "@/lib/scan/verdict-labels"

import {
  loadDiscoveryApplication,
  type DiscoveryApplication,
  type DiscoveryApplicationGap,
  type DiscoveryApplicationPrint,
} from "./application"
import {
  DISCOVERY_STYLING_PRODUCT_TYPE,
  DISCOVERY_USAGE_ROLES,
  isDiscoveryProductType,
  type DiscoveryProductType,
  type DiscoveryUsageRole,
} from "./classify"
import {
  DISCOVERY_FREQUENCY_LABELS,
  isDiscoveryItemFrequency,
  type DiscoveryItemFrequency,
} from "./frequency"
import {
  describeDiscoveryHeatStyling,
  readDiscoveryHeatStyling,
  type DiscoveryHeatStylingSummary,
  type DiscoveryHeatStylingV1,
} from "./heat-styling"
import {
  discoveryConsultSnapshotFacts,
  type DiscoveryConsultSnapshotFacts,
} from "./consult-brief/snapshot-facts"
import {
  discoveryConcernProfileFacts,
  discoveryHairElasticity,
  type DiscoveryConcernProfileFacts,
} from "./concern-recipe-view"
import {
  loadDiscoveryIdealRoutine,
  type DiscoveryIdealStep,
  type DiscoveryPreviewInput,
  type DiscoveryRoutineSource,
  type DiscoveryStepDepth,
} from "./load-ideal-routine"
import type { DiscoveryEqualOption } from "./equal-options"
import {
  loadDiscoveryRecommendationPropertyRows,
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
import { buildDiscoveryRoutineContext, discoveryIntakeHasRoutineAnswers } from "./routine-context"
import type { WashAllowedRange } from "./runsheet/frequency"
import {
  composeDiscoveryRefinedRoutine,
  describeDiscoveryIntakeItem,
  DISCOVERY_SCANNED_PRODUCT_LABEL,
  discoveryPrintedRecommendationIds,
  discoverySwapProductIds,
  reduceIntakeItemsToSteps,
  withDiscoveryApplicationHash,
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
  "id,category,source,brand_text,product_name_text,barcode_identifier,product_id,product_submission_id,created_at,product_type,usage_role,frequency"
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
  frequency?: string | null
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
    // The styling marker (batch 7, D2) is kept: it keeps the item out of „Kategorie offen".
    ...(isDiscoveryProductType(row.product_type) ? { productType: row.product_type } : {}),
    ...(isDiscoveryUsageRole(row.usage_role) ? { usageRole: row.usage_role } : {}),
    // Batch 7: only when asked — NULL (every legacy row) adds no key.
    ...(isDiscoveryItemFrequency(row.frequency) ? { frequency: row.frequency } : {}),
  }))
}

/** Her „Hitze & Styling" answers (batch 7); `null` = not asked (every legacy intake). */
export async function loadDiscoveryIntakeHeatStyling(
  intakeId: string,
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryHeatStylingV1 | null> {
  const { data, error } = await client
    .from(INTAKES_TABLE)
    .select("heat_styling")
    .eq("id", intakeId)
    .maybeSingle()
  if (error) throw error
  return readDiscoveryHeatStyling((data as { heat_styling?: unknown } | null)?.heat_styling)
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
  return ((data as DecisionRow[] | null) ?? []).map(projectCallDecision)
}

type DecisionRow = {
  decision_key: string
  decision: string
  swap_product_id: string | null
  intake_item_id: string | null
}

function projectCallDecision(row: DecisionRow): DiscoveryCallDecision {
  return {
    decisionKey: row.decision_key,
    decision: row.decision === "swap" ? "swap" : row.decision === "drop" ? "drop" : "keep",
    swapProductId: row.swap_product_id,
    intakeItemId: row.intake_item_id,
  }
}

const loadSwapPresentationRows = createPresentationRowLoader("discovery_swap_lookup_failed")

/** How the catalog names a product: the parts of a brand + line + name label. */
export type DiscoveryProductIdentity = {
  name: string
  brand: string | null
  productLine: string | null
  /**
   * The packshot: the „Eingetragene Produkte" list shows it, and the PDF prints it next to
   * every product (batch 6) — there it is fingerprinted, via `discoveryProductImagesOf`.
   */
  imageUrl?: string | null
  /**
   * When the catalog price was last checked (`products.price_checked_at`). Kept for
   * diagnostics/PDF wiring; since 2026-09-30 it no longer gates the Idealplan card's
   * price — the stored price always shows and the recurring audit keeps it honest.
   */
  priceCheckedAt?: string | null
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
    .select(
      "id, name, brand, image_url, price_checked_at, product_line:product_lines(canonical_name)",
    )
    .in("id", productIds)
  if (error) throw new Error("discovery_product_identity_lookup_failed")
  type LineRelation = { canonical_name: string | null }
  for (const row of (data as Array<{
    id: string
    name: string
    brand: string | null
    image_url?: string | null
    price_checked_at?: string | null
    product_line: LineRelation | LineRelation[] | null
  }> | null) ?? []) {
    const relation = Array.isArray(row.product_line) ? row.product_line[0] : row.product_line
    identities.set(row.id, {
      name: row.name,
      brand: row.brand,
      productLine: relation?.canonical_name?.trim() || null,
      imageUrl: row.image_url?.trim() || null,
      priceCheckedAt: row.price_checked_at ?? null,
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

/**
 * Product id → packshot URL, for the composition (only products that HAVE a printable one:
 * an http(s) URL — anything else would print as a broken image or worse).
 */
export function discoveryProductImagesOf(
  identities: ReadonlyMap<string, DiscoveryProductIdentity>,
): Map<string, string> {
  const images = new Map<string, string>()
  for (const [id, identity] of identities) {
    const url = identity.imageUrl?.trim()
    if (!url) continue
    try {
      const protocol = new URL(url).protocol
      if (protocol === "https:" || protocol === "http:") images.set(id, url)
    } catch {
      // Not a URL: nothing to print.
    }
  }
  return images
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
  /**
   * „So wendest du es an" (batch 6): the production application pipeline over the printed
   * products. `unavailable` when it could not be read or compiled right now — then, like a
   * failed brand read, finalising refuses and the PDF sends Nick back to the cockpit. Absent
   * only for a model composed without it (tests): no section, nothing blocked.
   */
  application?: { status: "ready"; section: DiscoveryApplication } | { status: "unavailable" }
  /**
   * Her profile as the „Hauptproblem" recipe gates read it (batch 7c) — off the same
   * snapshot the Idealroutine was computed from. Absent only for a model composed without
   * it (tests): every gate then reads „prüfen".
   */
  concernProfileFacts?: DiscoveryConcernProfileFacts
  /**
   * Her pull test off the same snapshot (consult-runsheet T3: the „Vor dem Call" checklist).
   * Absent for a model composed without it (tests); null when it cannot be read.
   */
  hairElasticity?: string | null
  /**
   * The consult brief's snapshot facts off the same snapshot (consult-agent T2: concerns,
   * scalp concerns, heat tools, wash cadence, hair-loss boundary). Absent for a model composed
   * without it (tests); every field unknown then.
   */
  consultFacts?: DiscoveryConsultSnapshotFacts
  /** Her „Hitze & Styling" answers (batch 7); null/absent = not asked. */
  heatStyling?: DiscoveryHeatStylingV1 | null
  /** Whether the Idealroutine ran on her checklist answers (batch 7, discovery-only). */
  routineSource?: DiscoveryRoutineSource
  /** The heat protectant waits for heat answers — „Hitzeschutz: im Call fragen" (display only). */
  heatProtectionDeferred?: boolean
  /**
   * F1: the Idealplan recommendation's target-vs-product rows, by decision key — only for
   * steps where the cockpit shows that recommendation and the engine could evaluate it (see
   * `loadDiscoveryRecommendationPropertyRows`). Display only, never hashed. Absent = no rows.
   */
  recommendationPropertyRows?: ReadonlyMap<string, DiscoveryPropertyRow[]>
}

export type DiscoveryCockpitModelResult =
  | DiscoveryCockpitModel
  | { status: "no_usable_source" }
  | { status: "temporarily_unavailable" }

export type DiscoveryCockpitDependencies = {
  loadIdealRoutine: typeof loadDiscoveryIdealRoutine
  loadItems: typeof loadDiscoveryCockpitItems
  loadHeatStyling: typeof loadDiscoveryIntakeHeatStyling
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
  loadApplication: typeof loadDiscoveryApplication
  loadRecommendationRows: typeof loadDiscoveryRecommendationPropertyRows
}

export const DISCOVERY_COCKPIT_DEPENDENCIES: DiscoveryCockpitDependencies = {
  loadIdealRoutine: loadDiscoveryIdealRoutine,
  loadItems: loadDiscoveryCockpitItems,
  loadHeatStyling: loadDiscoveryIntakeHeatStyling,
  loadVerdicts: loadParticipantScanVerdicts,
  loadDecisions: loadDiscoveryCallDecisions,
  loadSwapProducts: loadSwapPresentationRows,
  loadProductIdentities: loadDiscoveryProductIdentities,
  loadResearchState: (client, items) => loadDiscoveryResearchState(client, items),
  loadApplication: loadDiscoveryApplication,
  loadRecommendationRows: loadDiscoveryRecommendationPropertyRows,
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

  // Batch 7 (plan §2.3): her answers are read BEFORE the Idealroutine, because they may shape
  // it. Only an intake with new answers (heat, or any product frequency) gets a routine
  // override; every legacy intake runs exactly today's computation — same steps, same
  // fingerprint. Nothing is written on this path.
  const capturedItems = await deps.loadItems(input.intakeId, admin)
  const heatStyling = await deps.loadHeatStyling(input.intakeId, admin)
  const routineOverride = discoveryIntakeHasRoutineAnswers(capturedItems, heatStyling)
    ? buildDiscoveryRoutineContext(capturedItems, heatStyling)
    : null

  const ideal = await deps.loadIdealRoutine(
    admin,
    input.userId,
    input.intakeId,
    routineOverride ? { routineOverride } : undefined,
  )
  if (ideal.status !== "ready") return { status: ideal.status }

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
  // F1: rows for the recommendation wherever the cockpit shows it — a step with no product of
  // hers („Neu dazu"), or one whose products have no displayed alternative (the recommendation
  // is then the swap option, see `buildDiscoveryCockpitView`). Display only: a failure drops
  // the table, never the call.
  const verdictsByItemId = new Map(verdicts.map((verdict) => [verdict.itemId, verdict]))
  const recommendationRowKeys = new Set(
    outline.steps
      .filter((entry) => {
        const verdict = entry.item ? verdictsByItemId.get(entry.item.id) : undefined
        return !(
          verdict?.status === "verdict" &&
          verdict.payload.kind === "in_catalog" &&
          verdict.payload.alternatives.length > 0
        )
      })
      .map((entry) => entry.step.decisionKey),
  )
  let recommendationPropertyRows = new Map<string, DiscoveryPropertyRow[]>()
  try {
    recommendationPropertyRows = await deps.loadRecommendationRows(
      admin,
      ideal.steps.filter((step) => recommendationRowKeys.has(step.decisionKey)),
      ideal.context,
    )
  } catch (error) {
    console.error("[discovery] recommendation rows unavailable:", error)
  }
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
      ...ideal.steps.flatMap((entry) =>
        (entry.equalOptions ?? []).map((option) => option.productId),
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

  const composed = composeDiscoveryRefinedRoutine({
    steps: ideal.steps,
    items,
    decisions,
    swapProducts,
    recommendationProducts,
    ownedProducts: discoveryOwnedProductIdentities(verdicts, productIdentities),
    productLines: discoveryProductLinesOf(productIdentities),
    productImages: discoveryProductImagesOf(productIdentities),
    heatStyling,
  })
  // „So wendest du es an": the production application pipeline over exactly the products
  // this composition prints. A failure degrades (finalize/PDF wait) instead of failing the
  // call — the cockpit must stay usable mid-conversation.
  let application: NonNullable<DiscoveryCockpitModel["application"]>
  try {
    application = {
      status: "ready",
      section: await deps.loadApplication(admin, { routine: composed, context: ideal.context }),
    }
  } catch (error) {
    console.error("[discovery] application section unavailable:", error)
    application = { status: "unavailable" }
  }

  return {
    status: "ready",
    // The printed application section is part of the fingerprint (only when it prints).
    routine: withDiscoveryApplicationHash(
      composed,
      application.status === "ready" ? application.section.print : null,
    ),
    steps: ideal.steps,
    verdicts,
    previewSource: ideal.previewSource,
    recommendationProducts,
    recommendationBrandsAvailable,
    productIdentities,
    research: { items: capturedItems, state: researchState },
    application,
    concernProfileFacts: discoveryConcernProfileFacts(ideal.context?.snapshot),
    hairElasticity: discoveryHairElasticity(ideal.context?.snapshot),
    consultFacts: discoveryConsultSnapshotFacts(ideal.context?.snapshot),
    heatStyling,
    routineSource: ideal.routineSource ?? "quiz_only",
    heatProtectionDeferred: ideal.heatProtectionDeferred === true,
    recommendationPropertyRows,
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
  /**
   * The catalog's price label („5,45 €") — display only (R19): it may reorder the list on
   * screen, never a verdict, ranking or bucket. Null when the catalog has no fresh price.
   * No retailer: the catalog carries no retailer field (only the affiliate link).
   */
  priceLabel: string | null
  /** The catalog packshot (`products.image_url`), for the option's thumbnail; null = none. */
  imageUrl: string | null
  /** How it is applied, where equals need telling apart (E2); absent/null = not shown. */
  applicationLabel?: string | null
  /**
   * `equal_alternative`: rated exactly as well as the Idealplan's pick, which a house
   * default chose among equals (Bondbuilder tie, see `equal-options.ts`).
   */
  origin: "alternative" | "ideal_recommendation" | "equal_alternative"
  /**
   * Target-vs-product rows for a displayed alternative or (F1) the Idealplan's
   * recommendation; null when there are none.
   */
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
  /** Her product's catalog product (the one a kept entry prints); null for an empty step. */
  ownedProductId: string | null
  /**
   * Her product's usage role as composed (batch 9): the decision write re-checks it — with
   * `category` — under the intake lock, so a concurrent usage correction cannot slip past.
   */
  ownedUsageRole: DiscoveryUsageRole | null
  /**
   * Batch 9: how many entries this step has — one per product of hers in it (adjacent in
   * `steps`, same `decisionKey`), or 1 for a step she owns nothing or one product for.
   */
  stepEntryCount: number
  /** „3–4× pro Woche" — how often she uses THIS product (batch 7); null when not asked. */
  ownedFrequencyLabel: string | null
  /** The same answer as stored (`unknown` = „Weiß ich nicht"); null when not asked. */
  ownedFrequency: DiscoveryItemFrequency | null
  /**
   * The engine's tolerated wash range for a shampoo (`wet_wash_total`) step — the frequency
   * chip's band (verdict-layer T3); null for every other step.
   */
  idealAllowedRange: WashAllowedRange | null
  /**
   * „Weglassen" may be chosen (R3): she has ≥2 products in this step, this is one of them,
   * and at least one sibling is not dropped — a step is never left empty.
   */
  canDrop: boolean
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
  /** The packshots the PDF prints next to each name (batch 6) — hashed with the routine. */
  ownedImageUrl: string | null
  swapProductImageUrl: string | null
  recommendationImageUrl: string | null
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
  /** The packshot the PDF prints next to it (batch 6), else null. */
  imageUrl: string | null
}

/** One captured product in „Eingetragene Produkte" — every row but „benutze ich nicht". */
export type DiscoveryCockpitIntakeProductView = {
  itemId: string
  /** Her usage; null = „Kategorie offen" (batch 5, R7) — or a styling product (batch 7). */
  category: PersonalPlanCategory | null
  /** The routine role of her usage (oil roles, scalp oil, pre-wash conditioner), else null. */
  usageRole: DiscoveryUsageRole | null
  /**
   * What the product IS (batch 5, F1); null for a legacy row or when nobody knows yet.
   * `styling` (batch 7, D2): listed as „Styling (nicht bewertet)", no usage to correct.
   */
  productType: DiscoveryProductType | null
  /** How often she uses it (batch 7); null = not asked (legacy). */
  frequency: DiscoveryItemFrequency | null
  /** „3–4× pro Woche", „Weiß ich nicht"; null when not asked. */
  frequencyLabel: string | null
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
  /** The PDF's „So wendest du es an" section; null when there is none (or it is unreadable). */
  application: DiscoveryApplicationPrint | null
  /** False when the section could not be read right now: finalising and the PDF wait. */
  applicationAvailable: boolean
  /** Printed products without complete verified guidance — finalising waits for them. */
  applicationGaps: DiscoveryApplicationGap[]
  /** The compact „Hitze & Styling" block (batch 7); null when she was not asked. */
  heatStyling: DiscoveryHeatStylingSummary | null
  /**
   * „Hitzeschutz: im Call fragen": the heat protectant is deferred for lack of heat answers.
   * Display only — the deferred decision is never a step, so it is in no hash.
   */
  heatProtectionAsk: boolean
  /** Whether the Idealroutine ran on her checklist answers (batch 7). */
  routineSource: DiscoveryRoutineSource
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
    /** Optional: a payload stored before the field existed has none. */
    priceLabel?: string | null
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
    priceLabel: alternative.priceLabel ?? null,
    // Already loaded: every alternative's id is in the identity batch (iteration 3).
    imageUrl: identities.get(alternative.productId)?.imageUrl ?? null,
    origin: "alternative",
    propertyRows,
  }
}

function idealRecommendationOption(
  step: DiscoveryIdealStep,
  brandsByProductId: ReadonlyMap<string, string | null>,
  identities: ReadonlyMap<string, DiscoveryProductIdentity>,
  propertyRows: DiscoveryPropertyRow[] | null,
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
    // The stored price always shows (Nick, 2026-09-30: an outdated price beats a
    // price-less card; the recurring price audit keeps it honest). Optional chaining:
    // a preview composed before commerce existed carries none.
    priceLabel: preview.commerce?.priceLabel ?? null,
    imageUrl: identities.get(preview.productId)?.imageUrl ?? null,
    origin: "ideal_recommendation",
    // F1: the recommendation against her target — null when it could not be evaluated.
    propertyRows,
  }
}

/** An equally ideal product next to the Idealplan's tie-default pick (T1). */
function equalAlternativeOption(
  option: DiscoveryEqualOption,
  identities: ReadonlyMap<string, DiscoveryProductIdentity>,
): DiscoveryCockpitSwapOption {
  const brand = identities.get(option.productId)?.brand ?? null
  return {
    productId: option.productId,
    name: option.productName,
    brand,
    label: optionLabel(option.productId, { name: option.productName, brand }, identities),
    verdictLabel: SCAN_VERDICT_COPY.ideal.label,
    priceLabel: option.priceLabel,
    imageUrl: identities.get(option.productId)?.imageUrl ?? option.imageUrl,
    applicationLabel: option.applicationLabel,
    origin: "equal_alternative",
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
        frequency: item.frequency ?? null,
        frequencyLabel: item.frequency ? DISCOVERY_FREQUENCY_LABELS[item.frequency] : null,
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
  // Batch 9: a step's entries (one per product of hers in it), by decision key.
  const entriesByKey = new Map<string, DiscoveryRefinedRoutine["steps"]>()
  for (const entry of model.routine.steps) {
    const siblings = entriesByKey.get(entry.step.decisionKey)
    if (siblings) siblings.push(entry)
    else entriesByKey.set(entry.step.decisionKey, [entry])
  }
  const steps = model.routine.steps.map((refined): DiscoveryCockpitStepView => {
    const { step, item } = refined
    const stepEntries = entriesByKey.get(step.decisionKey) ?? [refined]
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
    const ideal = idealRecommendationOption(
      step,
      brandsByProductId,
      identities,
      model.recommendationPropertyRows?.get(step.decisionKey) ?? null,
    )
    // The ruled fallback: with no displayed alternatives the only swap target the cockpit
    // can honestly offer is the Idealplan's own pick — and never a product already in the
    // participant's bathroom for this step (any of her products in it, batch 9).
    const ownedInStep = new Set(
      stepEntries.flatMap((entry) => (entry.item?.productId ? [entry.item.productId] : [])),
    )
    // E2: with equals on offer, the pick names its application too — the comparison is the point.
    const idealWithApplication =
      ideal && step.equalOptions && step.equalOptions.length > 0
        ? { ...ideal, applicationLabel: step.idealApplicationLabel ?? null }
        : ideal
    const swapOptions =
      alternatives.length > 0
        ? alternatives.map((alternative) =>
            alternativeOption(
              alternative,
              identities,
              alternativeRows.get(alternative.productId) ?? null,
            ),
          )
        : idealWithApplication
          ? [
              idealWithApplication,
              // T1: a tie-default pick brings its equals — the call may choose any of them.
              ...(step.equalOptions ?? []).map((option) =>
                equalAlternativeOption(option, identities),
              ),
            ].filter((option) => !ownedInStep.has(option.productId))
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
      ownedProductId: item?.productId ?? null,
      ownedUsageRole: item?.usageRole ?? null,
      stepEntryCount: stepEntries.length,
      ownedFrequencyLabel: item?.frequency ? DISCOVERY_FREQUENCY_LABELS[item.frequency] : null,
      ownedFrequency: item?.frequency ?? null,
      idealAllowedRange: step.depth?.washAllowedRange ?? null,
      canDrop:
        item !== null &&
        stepEntries.length >= 2 &&
        stepEntries.some((entry) => entry !== refined && entry.outcome !== "dropped"),
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
      ownedImageUrl: refined.ownedImageUrl ?? null,
      swapProductImageUrl: refined.swapProductImageUrl ?? null,
      recommendationImageUrl: refined.recommendationImageUrl ?? null,
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
      imageUrl: entry.imageUrl ?? null,
    })),
    declinedCategories: model.routine.declinedCategories,
    unansweredCategories: model.routine.unansweredCategories,
    sourceHash: model.routine.sourceHash,
    recommendationBrandsAvailable: model.recommendationBrandsAvailable,
    application:
      model.application?.status === "ready" && model.application.section.print.days.length > 0
        ? model.application.section.print
        : null,
    applicationAvailable: model.application?.status !== "unavailable",
    applicationGaps: model.application?.status === "ready" ? model.application.section.gaps : [],
    heatStyling: model.heatStyling ? describeDiscoveryHeatStyling(model.heatStyling) : null,
    heatProtectionAsk: model.heatProtectionDeferred === true,
    routineSource: model.routineSource ?? "quiz_only",
  }
}

/**
 * What a `swap` of this product (or of the empty step, `intakeItemId` null) may name. Empty
 * means the entry offers no swap at all, so every swap for it is refused — the call can
 * still keep, or un-finalize and think again. `null`: no such entry in the view.
 */
export function discoveryCockpitSwapOptionIds(
  view: DiscoveryCockpitView,
  decisionKey: string,
  intakeItemId: string | null,
): string[] | null {
  const step = view.steps.find(
    (entry) => entry.decisionKey === decisionKey && entry.intakeItemId === intakeItemId,
  )
  if (!step) return null
  return step.swapOptions.map((option) => option.productId)
}

// --- Writes ------------------------------------------------------------------

export type DiscoveryCallDecisionInput = {
  intakeId: string
  decisionKey: string
  decision: "keep" | "swap" | "drop"
  swapProductId: string | null
  /** The product the decision is about, from the SERVER's composition; null = empty step. */
  intakeItemId: string | null
  /**
   * The step's other products as the server composed them, each with ITS OWN usage — the
   * drop invariant counts a sibling only while its usage is still this one (under the lock).
   */
  siblings: Array<{
    itemId: string
    category: PersonalPlanCategory
    usageRole: DiscoveryUsageRole | null
  }>
  /**
   * The target's usage (category, role) as the server composed it — re-checked under the
   * lock (`stale_binding`). Both null for an empty step.
   */
  expectedCategory: PersonalPlanCategory | null
  expectedUsageRole: DiscoveryUsageRole | null
}

export type DiscoveryCallDecisionOutcome =
  | "not_found"
  | "finalized"
  | "item_not_found"
  | "stale_binding"
  | "drop_last"
  | "swap_taken"
  | "stored"

export type DiscoveryCallDecisionResult =
  | { outcome: "stored"; decision: DiscoveryCallDecision }
  | { outcome: Exclude<DiscoveryCallDecisionOutcome, "stored"> }

const DECISION_OUTCOMES: readonly DiscoveryCallDecisionOutcome[] = [
  "not_found",
  "finalized",
  "item_not_found",
  "stale_binding",
  "drop_last",
  "swap_taken",
  "stored",
]

/**
 * One row per (intake, step, product) — the call changes its mind by overwriting, not by
 * accumulating. ONE call to `discovery_admin_set_call_decision` (migration 20260927120000):
 * under the same intake row lock as the usage correction it refuses a finalised intake
 * (a draft is decidable, as before), re-checks the composed binding (`stale_binding`),
 * keeps a step from being dropped empty (`drop_last`, counting only siblings still in the
 * step) and two products of one step from swapping to the same product (`swap_taken`),
 * then upserts.
 */
export async function setDiscoveryCallDecision(
  input: DiscoveryCallDecisionInput,
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryCallDecisionResult> {
  const { data, error } = await client.rpc("discovery_admin_set_call_decision", {
    target_intake_id: input.intakeId,
    target_decision_key: input.decisionKey,
    target_item_id: input.intakeItemId,
    expected_category: input.expectedCategory,
    expected_usage_role: input.expectedUsageRole,
    new_decision: input.decision,
    new_swap_product_id: input.decision === "swap" ? input.swapProductId : null,
    siblings: input.siblings.map((sibling) => ({
      id: sibling.itemId,
      category: sibling.category,
      usage_role: sibling.usageRole,
    })),
  })
  if (error) throw error
  const row = (data ?? {}) as Partial<DecisionRow> & { outcome?: string }
  const outcome = row.outcome as DiscoveryCallDecisionOutcome
  if (!DECISION_OUTCOMES.includes(outcome)) {
    throw new Error("discovery_call_decision_unexpected_outcome")
  }
  if (outcome !== "stored") return { outcome }
  if (typeof row.decision_key !== "string" || typeof row.decision !== "string") {
    throw new Error("Discovery call decision could not be stored")
  }
  return {
    outcome,
    decision: projectCallDecision({
      decision_key: row.decision_key,
      decision: row.decision,
      swap_product_id: row.swap_product_id ?? null,
      intake_item_id: row.intake_item_id ?? null,
    }),
  }
}

export type DiscoveryCallDecisionsResetResult =
  | { outcome: "reset"; deleted: number }
  | { outcome: "not_found" | "finalized" }

/**
 * „Testlauf zurücksetzen" (cockpit call-ready A2): every decision of this intake deleted in
 * ONE locked call to `discovery_admin_reset_call_decisions` (migration 20261009140000) — the
 * same intake row lock as every decision write, so it serialises with them and with
 * finalising; a finalised call is frozen. The call sheet is not touched.
 */
export async function resetDiscoveryCallDecisions(
  intakeId: string,
  client: DiscoveryCockpitAdminClient,
): Promise<DiscoveryCallDecisionsResetResult> {
  const { data, error } = await client.rpc("discovery_admin_reset_call_decisions", {
    target_intake_id: intakeId,
  })
  if (error) throw error
  const row = (data ?? {}) as { outcome?: string; deleted?: unknown }
  if (row.outcome === "reset" && typeof row.deleted === "number") {
    return { outcome: "reset", deleted: row.deleted }
  }
  if (row.outcome === "not_found" || row.outcome === "finalized") return { outcome: row.outcome }
  throw new Error("discovery_call_decisions_reset_unexpected_outcome")
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
  /** `null` only together with `productType: "styling"` (batch 7, D2): no usage. */
  category: PersonalPlanCategory | null
  role: DiscoveryUsageRole | null
  /**
   * Only for a type-open item („Kategorie offen", R7) or a styling item leaving styling —
   * or `"styling"` to move an evaluated item INTO the non-evaluated styling bucket.
   */
  productType: DiscoveryProductType | null
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

/** Decision key → the sorted ids of her products in that step (batch 9: a set per step). */
function stepItemSets(
  bindings: ReadonlyArray<{ step: DiscoveryIdealStep; item: DiscoveryIntakeItem | null }>,
) {
  const sets = new Map<string, string[]>()
  for (const { step, item } of bindings) {
    const ids = sets.get(step.decisionKey) ?? []
    if (item) ids.push(item.id)
    sets.set(step.decisionKey, ids)
  }
  return new Map([...sets].map(([key, ids]) => [key, [...ids].sort().join(",")]))
}

/**
 * F3 — decisions follow the item: the decision keys of every step whose SET of bound
 * products a usage change would change (the item's own old step, the step it lands on, and
 * any step it displaces or joins). Conservative (batch 9): the siblings of a changed step are
 * re-decided too. Decisions that reference the moved item itself are cleared by id in the
 * same database call; these keys cover the rest. Pure.
 */
export function discoveryStaleDecisionKeysForUsageChange(
  model: DiscoveryCockpitModel,
  change: DiscoveryItemUsageChange,
): string[] {
  const before = stepItemSets(model.routine.steps)
  const items = composedItems(model).map((item): DiscoveryIntakeItem => {
    if (item.id !== change.itemId) return item
    const moved: DiscoveryIntakeItem = { ...item, category: change.category }
    delete moved.usageRole
    if (change.role) moved.usageRole = change.role
    if (change.productType) moved.productType = change.productType
    // Into styling: the research link goes with the usage (the row's CHECK).
    if (change.productType === DISCOVERY_STYLING_PRODUCT_TYPE) moved.productSubmissionId = null
    return moved
  })
  const after = stepItemSets(reduceIntakeItemsToSteps(model.steps, items).bindings)
  return [...after]
    .filter(([key, ids]) => ids !== (before.get(key) ?? ""))
    .map(([key]) => key)
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
 * while finalised or a draft, sets usage (+ type for a type-open or styling item — or moves
 * an item into styling, dropping usage and research link, 20260925150000), removes the
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

// --- Frequency correction (batch 7, plan §2.2/§2.3) ------------------------------------

export type DiscoveryItemFrequencyOutcome =
  | "not_found"
  | "not_submitted"
  | "finalized"
  | "item_not_found"
  | "updated"

const FREQUENCY_OUTCOMES: readonly DiscoveryItemFrequencyOutcome[] = [
  "not_found",
  "not_submitted",
  "finalized",
  "item_not_found",
  "updated",
]

/**
 * The cockpit's frequency correction after submit: ONE call to
 * `discovery_admin_set_intake_item_frequency` (migration 20260925120000), refused while
 * finalised or a draft — the same guard as the usage correction. A frequency moves no
 * binding, so no decision is cleared; the fingerprint moves with it by design.
 */
export async function setDiscoveryIntakeItemFrequency(
  input: { intakeId: string; itemId: string; frequency: DiscoveryItemFrequency },
  client: DiscoveryCockpitAdminClient,
): Promise<{ outcome: DiscoveryItemFrequencyOutcome }> {
  const { data, error } = await client.rpc("discovery_admin_set_intake_item_frequency", {
    target_intake_id: input.intakeId,
    target_item_id: input.itemId,
    new_frequency: input.frequency,
  })
  if (error) throw error
  const outcome = ((data ?? {}) as { outcome?: string }).outcome
  if (!FREQUENCY_OUTCOMES.includes(outcome as DiscoveryItemFrequencyOutcome)) {
    throw new Error("discovery_item_frequency_unexpected_outcome")
  }
  return { outcome: outcome as DiscoveryItemFrequencyOutcome }
}

/** A styling product (batch 7, D2): listed, never evaluated — it has no usage to correct. */
export function isDiscoveryStylingItem(item: { productType?: DiscoveryProductType | null }) {
  return item.productType === DISCOVERY_STYLING_PRODUCT_TYPE
}

/**
 * Captured products not yet resolved to a catalog product (research pending, not started,
 * failed …) — finalising waits for them (Nick, 2026-09-24): every researched product carries
 * its verified application guide, so a finalised sheet always has complete guidance.
 */
export function discoveryResearchOpenItems(
  view: Pick<DiscoveryCockpitView, "unassigned">,
): DiscoveryCockpitUnassignedView[] {
  return view.unassigned.filter((entry) => entry.reason === "research_pending")
}

/** Items whose usage is unknown — finalising waits for them (P1-5). */
export function discoveryCategoryOpenItems(
  view: Pick<DiscoveryCockpitView, "unassigned">,
): DiscoveryCockpitUnassignedView[] {
  return view.unassigned.filter((entry) => entry.reason === "category_unknown")
}
