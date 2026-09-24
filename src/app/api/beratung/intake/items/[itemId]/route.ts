import type { NextRequest } from "next/server"

import type { DiscoveryIntakeItemView } from "@/components/discovery/intake/types"
import { isValidDiscoveryUsage } from "@/lib/discovery/classify"
import {
  clearDiscoveryIntakeCategory,
  deleteDiscoveryIntakeItem,
  discoveryIntakeUsagePatchSchema,
  isDiscoveryIntakeItemTypeOpen,
  loadDiscoveryIntakeItem,
  toDiscoveryIntakeItemView,
  updateDiscoveryIntakeItemUsage,
  type DiscoveryIntakeItemUsageUpdate,
} from "@/lib/discovery/intake"
import {
  DISCOVERY_INTAKE_RESEARCH_DEPENDENCIES,
  openDiscoveryIntakeResearch,
  type DiscoveryIntakeResearchDependencies,
} from "@/lib/discovery/intake-research"

import {
  discoveryIntakeError,
  discoveryIntakeJson,
  guardDiscoveryIntakeRequest,
  refuseCrossOrigin,
  readJsonBody,
  refuseSubmittedIntake,
  type DiscoveryIntakeRouteDependencies,
} from "../../shared"

/**
 * `DELETE /api/beratung/intake/items/<id>` — removes one captured answer.
 *
 * The delete is scoped to the caller's own `intake_id`, so an item id belonging
 * to another participant's intake matches no row and answers 404 rather than
 * deleting anything.
 */

export type DiscoveryIntakeItemDeleteDependencies = DiscoveryIntakeRouteDependencies & {
  deleteItem?: typeof deleteDiscoveryIntakeItem
}

export function createDiscoveryIntakeItemDeleteHandler(
  overrides: DiscoveryIntakeItemDeleteDependencies = {},
) {
  const { deleteItem, ...guardOverrides } = overrides
  const remove = deleteItem ?? deleteDiscoveryIntakeItem

  return async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ itemId: string }> },
  ) {
    const crossOrigin = refuseCrossOrigin(request)
    if (crossOrigin) return crossOrigin
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response

    const frozen = refuseSubmittedIntake(guard.context)
    if (frozen) return frozen

    const { itemId } = await context.params
    try {
      const deleted = await remove(
        { intakeId: guard.context.intake.id, itemId },
        guard.context.admin,
      )
      if (!deleted) return discoveryIntakeError("not_found", 404)
      return discoveryIntakeJson({ deleted: true })
    } catch (error) {
      console.error("[discovery] intake item delete failed:", error)
      return discoveryIntakeError("unavailable", 503)
    }
  }
}

export const DELETE = createDiscoveryIntakeItemDeleteHandler()

/**
 * `PATCH /api/beratung/intake/items/<id>` — changes how she USES a product (batch 5, R5/R9):
 * body `{ usage: { category, role } | null, productType? }`. Draft only (409
 * `already_submitted`), scoped to the caller's intake like DELETE (404 `not_found` for a
 * foreign, missing or `none` row).
 *
 * The usage never touches what the product IS or its research (identity ≠ usage): a
 * submission already opened stays as it is, whatever the new usage. The one exception is a
 * TYPE-OPEN item („Weiß ich nicht" at capture: no type, no product, no submission): there
 * `productType` answers „Was ist das?" and opens its research, exactly as the add would
 * have (F1). On any other item `productType` is refused (409 `product_type_locked`), and a
 * type-open item cannot take a usage without a type (400 `product_type_required`).
 *
 *   200 `{ item }` · 400 `invalid_body` | `invalid_usage` | `product_type_required` ·
 *   404 `not_found` · 409 `already_submitted` | `product_type_locked` · 503 `unavailable`
 */

export type DiscoveryIntakeItemPatchDependencies = DiscoveryIntakeRouteDependencies &
  Partial<DiscoveryIntakeResearchDependencies> & {
    loadItem?: typeof loadDiscoveryIntakeItem
    updateItem?: typeof updateDiscoveryIntakeItemUsage
    clearCategory?: typeof clearDiscoveryIntakeCategory
  }

export function createDiscoveryIntakeItemPatchHandler(
  overrides: DiscoveryIntakeItemPatchDependencies = {},
) {
  const {
    loadItem = loadDiscoveryIntakeItem,
    updateItem = updateDiscoveryIntakeItemUsage,
    clearCategory = clearDiscoveryIntakeCategory,
    createResearchSubmission = DISCOVERY_INTAKE_RESEARCH_DEPENDENCIES.createResearchSubmission,
    loadCatalogProductType = DISCOVERY_INTAKE_RESEARCH_DEPENDENCIES.loadCatalogProductType,
    ...guardOverrides
  } = overrides

  return async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ itemId: string }> },
  ) {
    const crossOrigin = refuseCrossOrigin(request)
    if (crossOrigin) return crossOrigin
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response
    const { intake, admin, userId } = guard.context

    const frozen = refuseSubmittedIntake(guard.context)
    if (frozen) return frozen

    const parsed = discoveryIntakeUsagePatchSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) return discoveryIntakeError("invalid_body", 400)
    const { usage, productType } = parsed.data
    if (usage && !isValidDiscoveryUsage(usage)) return discoveryIntakeError("invalid_usage", 400)

    const { itemId } = await context.params
    try {
      const item = await loadItem({ intakeId: intake.id, itemId }, admin)
      if (!item || item.source === "none") return discoveryIntakeError("not_found", 404)

      const typeOpen = isDiscoveryIntakeItemTypeOpen(item)
      if (productType && !typeOpen) return discoveryIntakeError("product_type_locked", 409)
      if (!productType && typeOpen && usage) {
        return discoveryIntakeError("product_type_required", 400)
      }

      const update: DiscoveryIntakeItemUsageUpdate = {
        category: usage?.category ?? null,
        usage_role: usage?.role ?? null,
      }
      if (productType) {
        const research = await openDiscoveryIntakeResearch(
          {
            userId,
            productType,
            identity: {
              source: item.source,
              brand_text: item.brandText,
              product_name_text: item.productNameText,
              barcode_identifier: item.barcodeIdentifier,
            },
          },
          admin,
          { createResearchSubmission, loadCatalogProductType },
        )
        update.product_type = research.productType
        if (research.productId) update.product_id = research.productId
        if (research.productSubmissionId) {
          update.product_submission_id = research.productSubmissionId
        }
      }

      const stored = await updateItem({ intakeId: intake.id, itemId, update }, admin)
      // Gone in between, or typed by a concurrent write (the update re-states type-open).
      if (!stored) return discoveryIntakeError("not_found", 404)

      if (usage) {
        try {
          await clearCategory(
            {
              intakeId: intake.id,
              category: usage.category,
              sources: ["none"],
              exceptItemId: itemId,
            },
            admin,
          )
        } catch (error) {
          console.error("[discovery] intake category clear failed after the usage update:", error)
        }
      }

      const view = toDiscoveryIntakeItemView(stored)
      return discoveryIntakeJson({ item: view } satisfies { item: DiscoveryIntakeItemView })
    } catch (error) {
      console.error("[discovery] intake usage update failed:", error)
      return discoveryIntakeError("unavailable", 503)
    }
  }
}

export const PATCH = createDiscoveryIntakeItemPatchHandler()
