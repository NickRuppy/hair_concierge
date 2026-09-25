import type { NextRequest } from "next/server"
import { z } from "zod"

import {
  DISCOVERY_STYLING_PRODUCT_TYPE,
  DISCOVERY_USAGE_ROLES,
  isValidDiscoveryUsage,
} from "@/lib/discovery/classify"
import {
  discoveryStaleDecisionKeysForUsageChange,
  isDiscoveryStylingItem,
  loadDiscoveryCockpitModel,
  setDiscoveryIntakeItemUsage,
  type DiscoveryItemUsageOutcome,
} from "@/lib/discovery/cockpit"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"

import {
  discoveryCockpitError,
  discoveryCockpitJson,
  guardDiscoveryCockpitRequest,
  readJsonBody,
  refuseFinalizedIntake,
  type DiscoveryCockpitRouteDependencies,
} from "../../../shared"

/**
 * `PATCH /api/admin/beratung/<enrollmentId>/items/<itemId>` — the cockpit's usage
 * correction (batch 5: R7 „Kategorie offen", R10, P1-3, F3). After she submitted, only the
 * cockpit changes how a product is used; she never reopens her list.
 *
 * Body: `{ usage: { category, role }, productType? }`. `productType` sets what the product
 * IS, and only for an item nobody knows the type of („Kategorie offen") or a styling
 * product that turns out to be evaluable (batch 7, D2); then „Recherche starten" opens its
 * research from that type. A known type is never overwritten.
 *
 * Batch 7, D2 — into styling: `{ usage: null, productType: "styling" }` moves an evaluated
 * item into the non-evaluated styling bucket (usage cleared, research link dropped, the
 * vacated category gets its „benutzt sie nicht").
 *
 * Gate order, as the research route: same-origin (403) → kill switch (404) → the shared
 * `requireAdmin` (401/403) → the intake the URL names (404) → the item must belong to THAT
 * intake (404). Then:
 *
 *   finalised               → 409 `finalized`       („Erst Finalisierung aufheben")
 *   still a draft           → 409 `not_submitted`
 *   bad body / pair         → 400 `invalid_body` | `invalid_usage`
 *   type on a typed item    → 409 `type_known` (also: styling on a styling item)
 *   usage with styling / none without → 400 `invalid_usage` / `invalid_body`
 *   usage on a type-open or styling item without a type → 400 `product_type_required`
 *   200 `{ outcome: "updated", noneInserted, noneRemoved, decisionsCleared }`
 *
 * The write is ONE database call (`discovery_admin_set_intake_item_usage`), which re-checks
 * every refusal under a lock on the intake. The decisions it clears besides the moved
 * item's own are the steps whose binding the move changes — computed here from the same
 * composition the cockpit renders, because only that knows the Idealplan's steps.
 */

const categorySchema = z.enum(SUPPORTED_PRODUCT_CATEGORY_KEYS)

const bodySchema = z
  .object({
    usage: z
      .object({ category: categorySchema, role: z.enum(DISCOVERY_USAGE_ROLES).nullable() })
      .strict()
      .nullable(),
    productType: z
      .enum([...SUPPORTED_PRODUCT_CATEGORY_KEYS, DISCOVERY_STYLING_PRODUCT_TYPE])
      .optional(),
  })
  .strict()

const OUTCOME_STATUS: Record<Exclude<DiscoveryItemUsageOutcome, "updated">, number> = {
  not_found: 404,
  item_not_found: 404,
  not_submitted: 409,
  finalized: 409,
  type_known: 409,
  product_type_required: 400,
}

export type DiscoveryItemUsageRouteDependencies = DiscoveryCockpitRouteDependencies & {
  setUsage?: typeof setDiscoveryIntakeItemUsage
}

export function createDiscoveryItemUsageHandler(
  overrides: DiscoveryItemUsageRouteDependencies = {},
) {
  const { setUsage = setDiscoveryIntakeItemUsage, ...guardOverrides } = overrides

  return async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ enrollmentId: string; itemId: string }> },
  ) {
    // CSRF first: the admin cookie rides along on a cross-site request too.
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return discoveryCockpitError("cross_origin", 403)
    }
    const { enrollmentId, itemId } = await context.params
    const guard = await guardDiscoveryCockpitRequest(enrollmentId, guardOverrides)
    if (!guard.ok) return guard.response
    const { admin, intake } = guard

    const frozen = refuseFinalizedIntake(intake)
    if (frozen) return frozen
    if (intake.state !== "submitted") return discoveryCockpitError("not_submitted", 409)

    const body = bodySchema.safeParse(await readJsonBody(request))
    if (!body.success) return discoveryCockpitError("invalid_body", 400)
    const { usage, productType } = body.data
    const toStyling = productType === DISCOVERY_STYLING_PRODUCT_TYPE
    // Into styling there is no usage; everywhere else there must be one.
    if (toStyling && usage) return discoveryCockpitError("invalid_usage", 400)
    if (!toStyling && !usage) return discoveryCockpitError("invalid_body", 400)
    if (usage && !isValidDiscoveryUsage(usage)) return discoveryCockpitError("invalid_usage", 400)

    let model
    try {
      model = await (guardOverrides.loadModel ?? loadDiscoveryCockpitModel)(admin, {
        intakeId: intake.id,
        userId: intake.userId,
      })
    } catch (error) {
      console.error("[discovery] cockpit composition failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
    if (model.status !== "ready") return discoveryCockpitError(model.status, 503)

    // Scoped to this intake by construction: another intake's item is simply not found.
    const item = model.research?.items.find((entry) => entry.id === itemId) ?? null
    if (!item || item.source === "none") return discoveryCockpitError("not_found", 404)
    const styling = isDiscoveryStylingItem(item)
    if (toStyling) {
      // Already styling: nothing to correct.
      if (styling) return discoveryCockpitError("type_known", 409)
    } else if (styling) {
      // Out of styling (batch 7, D2) the type comes with the usage, as on „Kategorie offen".
      if (!productType) return discoveryCockpitError("product_type_required", 400)
    } else {
      const typeOpen =
        !item.productType && item.productId === null && item.productSubmissionId === null
      if (productType && !typeOpen) return discoveryCockpitError("type_known", 409)
      if (!productType && typeOpen) return discoveryCockpitError("product_type_required", 400)
    }

    const change = {
      itemId,
      category: usage?.category ?? null,
      role: usage?.role ?? null,
      productType: productType ?? null,
    }
    try {
      const result = await setUsage(
        {
          ...change,
          intakeId: intake.id,
          staleDecisionKeys: discoveryStaleDecisionKeysForUsageChange(model, change),
        },
        admin,
      )
      if (result.outcome !== "updated") {
        return discoveryCockpitError(result.outcome, OUTCOME_STATUS[result.outcome])
      }
      return discoveryCockpitJson(result)
    } catch (error) {
      console.error("[discovery] cockpit usage correction failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
  }
}

export const PATCH = createDiscoveryItemUsageHandler()
