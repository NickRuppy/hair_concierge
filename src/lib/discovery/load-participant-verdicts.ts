import type { SupabaseClient } from "@supabase/supabase-js"

import {
  loadScanProductFacts,
  loadStage3RecommendationCandidatesByRole,
} from "@/lib/personal-plan/products/authority/catalog-facts"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import {
  isProductSearchQuarantined,
  loadQuarantinedProductIdsAmong,
} from "@/lib/scan/catalog-eligibility"
import { loadScanVerdictForProduct, type LoadScanVerdictDeps } from "@/lib/scan/load-scan-verdict"
import {
  createActiveProductByIdLoader,
  createPresentationRowLoader,
  type ScanActiveProductLoader,
  type ScanPresentationRowLoader,
} from "@/lib/scan/presentation-rows"
import {
  presentScanVerdictPayload,
  toScanProductHeader,
  withEligibleAlternatives,
} from "@/lib/scan/product-presentation"
import type { ScanEvaluationContext } from "@/lib/scan/profile-context"
import { buildScanVerdict } from "@/lib/scan/resolve-verdict"
import type {
  ScanPresentedVerdictPayload,
  ScanProductHeader,
  ScanVerdictPayload,
} from "@/lib/scan/types"

import { mobileAssessmentRows } from "@/lib/mobile/result-presentation"

import { isDiscoveryUsageWithinProductFamily } from "./classify"
import { discoveryPropertyRows, type DiscoveryPropertyRow } from "./property-rows"
import type { DiscoveryIntakeItem } from "./refined-routine"

/**
 * The scan verdict for every product a discovery participant actually owns, rendered for
 * the cockpit.
 *
 * Same engine as `/api/scan/resolve`'s direct-productId path — `loadScanVerdictForProduct`
 * with the resolve route's own dependency wiring — so the cockpit can never show a verdict
 * the participant's own scanner would not. Two deliberate differences:
 *
 *  - the evaluation context is INJECTED, never loaded here: `loadDiscoveryIdealRoutine`
 *    already prepared it without publishing, and loading it again would re-enter the
 *    publishing path this feature must not touch;
 *  - there is no `savedState`. Merkliste/routine membership is the participant's own state
 *    and has no meaning in an admin read model, so it is absent from the return type
 *    rather than merely unread.
 *
 * Nothing here throws per item: a call is a live conversation, and one unresolvable
 * product must degrade to a labelled row instead of blanking the whole cockpit.
 */

export type DiscoveryVerdictStatus =
  | "verdict"
  | "product_unavailable"
  | "quarantined"
  | "target_mismatch"
  | "decision_missing"
  | "unavailable"

/**
 * Target-vs-product rows (iOS result-card rows) for her product and for every alternative
 * the verdict displays. Cockpit-only: computed from the FULL verdict before the web
 * presenter strips `mobileDimensions`/`criteria`, so the shared scan sheet and the web scan
 * API keep their exact shape. Absent when the rows could not be built — the verdict itself
 * still renders.
 */
export type DiscoveryVerdictPropertyRows = {
  product: DiscoveryPropertyRow[]
  alternatives: Array<{ productId: string; rows: DiscoveryPropertyRow[] }>
}

/**
 * F2: she uses the product differently from what it is, and that difference is one of the
 * product type's own usages (conditioner used as a mask, an oil on the scalp). The verdict
 * then grades the PRODUCT against its own category; the cockpit says
 * „Benutzt als Maske · Produkt: Conditioner" next to it.
 */
export type DiscoveryUsageDifference = {
  usageCategory: PersonalPlanCategory
  productCategory: PersonalPlanCategory
}

export type DiscoveryParticipantVerdict =
  | {
      itemId: string
      productId: string
      status: "verdict"
      product: ScanProductHeader
      payload: ScanPresentedVerdictPayload
      propertyRows?: DiscoveryVerdictPropertyRows
      /** Present only for a legitimate usage difference (F2). */
      usageDifference?: DiscoveryUsageDifference
    }
  | {
      itemId: string
      productId: string
      status: Exclude<DiscoveryVerdictStatus, "verdict">
    }

export type DiscoveryVerdictDeps = {
  loadActiveProductById: ScanActiveProductLoader
  loadPresentationRows: ScanPresentationRowLoader
  isProductSearchQuarantined: typeof isProductSearchQuarantined
  loadQuarantinedProductIdsAmong: typeof loadQuarantinedProductIdsAmong
  loadScanVerdict: (
    client: SupabaseClient,
    category: PersonalPlanCategory,
    productId: string,
    decision: ScanEvaluationContext["snapshot"]["decisions"][number],
    context: ScanEvaluationContext,
  ) => Promise<ScanVerdictPayload>
}

/**
 * The facts/candidate/verdict trio `loadScanVerdictForProduct` runs on — exported so a test
 * can pin each member's identity to the same functions `/api/scan/resolve` wires
 * (the `POST` deps literal, `resolve/route.ts:604-607`). Without that pin, a silent rewire here would give the
 * cockpit a different engine than the participant's own scanner, and every verdict test
 * injects stubs, so nothing else would notice.
 */
export const DISCOVERY_SCAN_VERDICT_DEPS: LoadScanVerdictDeps = {
  loadScanProductFacts,
  loadRecommendationCandidates: loadStage3RecommendationCandidatesByRole,
  buildScanVerdict,
}

export const DISCOVERY_VERDICT_DEPS: DiscoveryVerdictDeps = {
  loadActiveProductById: createActiveProductByIdLoader("discovery_product_lookup_failed"),
  loadPresentationRows: createPresentationRowLoader("discovery_presentation_lookup_failed"),
  isProductSearchQuarantined,
  loadQuarantinedProductIdsAmong,
  loadScanVerdict: (client, category, productId, decision, context) =>
    loadScanVerdictForProduct(
      client,
      DISCOVERY_SCAN_VERDICT_DEPS,
      category,
      productId,
      decision,
      context,
    ),
}

export async function loadParticipantScanVerdicts(
  admin: SupabaseClient,
  userId: string,
  items: readonly DiscoveryIntakeItem[],
  context: ScanEvaluationContext,
  deps: DiscoveryVerdictDeps = DISCOVERY_VERDICT_DEPS,
): Promise<DiscoveryParticipantVerdict[]> {
  // Controller ruling: an item still in research carries no catalog product, so it gets no
  // verdict at all and surfaces through `unassignedIntakeProducts` instead. Neither does an
  // item whose usage is unknown (batch 5): there is no step to judge it for yet.
  const owned = items.filter(
    (item): item is DiscoveryIntakeItem & { productId: string } =>
      item.source !== "none" && item.productId !== null && item.category !== null,
  )
  if (owned.length === 0) return []

  // One batched catalog read for every scanned product plus every alternative the verdicts
  // end up offering — the cockpit lists a whole inventory, so per-item reads would be a
  // request per product.
  const verdicts = await Promise.all(
    owned.map((item) => resolveItemVerdict(admin, userId, item, context, deps)),
  )
  const presentationIds = [
    ...owned.map((item) => item.productId),
    ...verdicts.flatMap((entry) =>
      entry.kind === "verdict" && entry.verdict.kind === "in_catalog"
        ? entry.verdict.alternatives.map((alternative) => alternative.productId)
        : [],
    ),
  ]
  const rows = await deps.loadPresentationRows(admin, presentationIds)
  const rowsById = new Map(rows.map((row) => [row.id, row]))

  return verdicts.map((entry): DiscoveryParticipantVerdict => {
    if (entry.kind !== "verdict") {
      return { itemId: entry.itemId, productId: entry.productId, status: entry.kind }
    }
    const scannedRow = rowsById.get(entry.productId)
    if (!scannedRow) {
      // The verdict resolved but the catalog row vanished between the two reads; without
      // it there is no header to render.
      return { itemId: entry.itemId, productId: entry.productId, status: "unavailable" }
    }
    return {
      itemId: entry.itemId,
      productId: entry.productId,
      status: "verdict",
      product: toScanProductHeader(scannedRow),
      payload: presentScanVerdictPayload(entry.verdict, rows),
      ...propertyRowsFor(entry),
      ...(entry.usageDifference ? { usageDifference: entry.usageDifference } : {}),
    }
  })
}

/**
 * The same builder `src/lib/mobile/scan-service.ts` runs for the native card — her product
 * against `verdict.criteria`, each alternative against its own `criteria` — over the same
 * `mobileDimensions`. A failure here only drops the rows, never the verdict.
 */
function propertyRowsFor(entry: Extract<ItemVerdict, { kind: "verdict" }>): {
  propertyRows?: DiscoveryVerdictPropertyRows
} {
  const verdict = entry.verdict
  if (verdict.kind !== "in_catalog" || !verdict.evaluatedRole) return {}
  const role = verdict.evaluatedRole
  const fit = verdict.fitNarrative?.fit ?? null
  const dimensions = verdict.mobileDimensions ?? []
  try {
    return {
      propertyRows: {
        product: discoveryPropertyRows(
          mobileAssessmentRows(
            entry.category,
            role,
            entry.productId,
            dimensions,
            verdict.criteria,
            fit,
          ),
        ),
        alternatives: verdict.alternatives.map((alternative) => ({
          productId: alternative.productId,
          rows: discoveryPropertyRows(
            mobileAssessmentRows(
              entry.category,
              role,
              alternative.productId,
              dimensions,
              alternative.criteria ?? [],
              fit,
            ),
          ),
        })),
      },
    }
  } catch (error) {
    console.warn("discovery_property_rows_unavailable", {
      itemId: entry.itemId,
      productId: entry.productId,
      reason: error instanceof Error ? error.message : "unknown",
    })
    return {}
  }
}

type ItemVerdict =
  | {
      kind: "verdict"
      itemId: string
      productId: string
      category: PersonalPlanCategory
      verdict: ScanVerdictPayload
      usageDifference?: DiscoveryUsageDifference
    }
  | {
      kind: Exclude<DiscoveryVerdictStatus, "verdict">
      itemId: string
      productId: string
    }

async function resolveItemVerdict(
  admin: SupabaseClient,
  userId: string,
  item: DiscoveryIntakeItem & { productId: string },
  context: ScanEvaluationContext,
  deps: DiscoveryVerdictDeps,
): Promise<ItemVerdict> {
  const { id: itemId, productId } = item
  try {
    const active = await deps.loadActiveProductById(admin, productId)
    if (!active) return { kind: "product_unavailable", itemId, productId }
    if (await deps.isProductSearchQuarantined(admin, active.id)) {
      return { kind: "quarantined", itemId, productId }
    }
    // The participant uses the product in one category; the catalog files it under another.
    // A usage the product type's own usage question offers (F2) is legitimate: the verdict
    // grades the PRODUCT against its own category and names the difference. Anything else —
    // and every legacy (tile) row, which has no product type and was always shown as a
    // conflict — would grade it against the wrong decision, so the cockpit shows the conflict.
    let usageDifference: DiscoveryUsageDifference | undefined
    if (active.category !== item.category) {
      const usageCategory = item.category
      if (
        item.productType === undefined ||
        usageCategory === null ||
        !isDiscoveryUsageWithinProductFamily(active.category, usageCategory)
      ) {
        return { kind: "target_mismatch", itemId, productId }
      }
      usageDifference = { usageCategory, productCategory: active.category }
    }

    const decision = context.snapshot.decisions.find((entry) => entry.category === active.category)
    if (!decision) return { kind: "decision_missing", itemId, productId }

    const verdict = await deps.loadScanVerdict(admin, active.category, active.id, decision, context)
    return {
      kind: "verdict",
      itemId,
      productId,
      category: active.category,
      verdict: await withEligibleAlternatives(verdict, (ids) =>
        deps.loadQuarantinedProductIdsAmong(admin, ids),
      ),
      ...(usageDifference ? { usageDifference } : {}),
    }
  } catch (error) {
    // No identity or answers in this breadcrumb — the participant's user id is the same
    // pseudonymous handle the scan routes already attach to their Sentry contexts.
    console.warn("discovery_participant_verdict_unavailable", {
      userId,
      itemId,
      productId,
      reason: error instanceof Error ? error.message : "unknown",
    })
    return { kind: "unavailable", itemId, productId }
  }
}
