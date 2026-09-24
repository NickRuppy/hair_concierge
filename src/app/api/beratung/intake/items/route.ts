import type { NextRequest } from "next/server"

import type { DiscoveryIntakeItemView } from "@/components/discovery/intake/types"
import { isValidDiscoveryUsage } from "@/lib/discovery/classify"
import {
  buildDiscoveryIntakeItemRow,
  checkDiscoveryIntakeItemIdentity,
  clearDiscoveryIntakeCategory,
  discoveryIntakeItemBodySchema,
  discoveryIntakeProductBodySchema,
  discoveryIntakeProductIdentity,
  insertDiscoveryIntakeItem,
  toDiscoveryIntakeItemView,
  type DiscoveryIntakeCategory,
  type DiscoveryIntakeIdentityRefusal,
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
  readJsonBody,
  refuseSubmittedIntake,
  type DiscoveryIntakeRouteDependencies,
} from "../shared"

/**
 * `POST /api/beratung/intake/items` — records one checklist answer. Two request shapes:
 *
 * FLAT CHECKLIST (batch 5, plan Rev. 3) — `{ capture, productType?, usage }`, sent once the
 * participant has answered the usage question (R9):
 *   - a catalog capture's product type is read from `products.category_key` (P2-6);
 *   - otherwise `productType` is the classifier's or her „Was ist das?" answer, and — when
 *     known — the server opens the research submission from it (F1), as the participant,
 *     through the same scan lane „Recherche starten" uses. A submission that fails to open
 *     leaves the item stored without one (the cockpit can start research later);
 *   - `productType: null` („Weiß ich nicht") stores the item with no type, no usage and no
 *     submission; a usage without a type is refused (400 `product_type_required`).
 *   201 `{ item }` · 400 `invalid_body` | `invalid_usage` | `product_type_required` ·
 *   409 `already_submitted` · 422 `unknown_product` · 503 `unavailable`.
 *
 * LEGACY (tile checklist, until the flat UI replaces it) — `{ category, capture }`, as below.
 *
 *
 * The client declares WHAT it captured (`capture`, one variant per source); the
 * row shape itself is derived server-side by `buildDiscoveryIntakeItemRow`, so
 * no request can compose an identity combination the table's
 * `captured_has_identity` CHECK would reject. The ids inside that capture are then
 * re-established by `checkDiscoveryIntakeItemIdentity` — 422 — because a UUID-shaped
 * id from the browser proves nothing about what it points at: the product must be one
 * the identify endpoint would have answered with, and the research submission must be
 * this participant's own. The item's category is NOT part of that check — it is the
 * shelf slot the participant opened, and the catalog is allowed to disagree with it.
 *
 * Writing an answer also clears the answer it replaces, because a category is
 * either „benutze ich nicht" or a non-empty product list:
 *   - a `none` answer removes the category's products,
 *   - a product removes a standing `none`.
 *
 * That clear runs AFTER the insert. The obvious order loses data: deleting first and
 * then failing to insert leaves the category with no answer at all — the participant's
 * previous one gone and the new one never stored, which the checklist shows as an
 * untouched category hours before the call. Inserting first can at worst leave the two
 * answers coexisting for a moment, which is visible, harmless, and healed on submit by
 * `clearDiscoveryIntakeCoexistingNone`.
 */

// `unknown_submission` covers a submission that does not exist AND one that belongs to
// another account — deliberately the same code and the same sentence, because to this
// intake they are the same fact and the copy should not hint at the difference.
const IDENTITY_REFUSALS: Record<DiscoveryIntakeIdentityRefusal, string> = {
  unknown_product: "Dieses Produkt können wir gerade nicht übernehmen. Such es bitte neu.",
  unknown_submission: "Diese Produktanfrage kennen wir nicht. Versuch es bitte nochmal.",
}

export type DiscoveryIntakeItemsRouteDependencies = DiscoveryIntakeRouteDependencies &
  Partial<DiscoveryIntakeResearchDependencies> & {
    clearCategory?: typeof clearDiscoveryIntakeCategory
    insertItem?: typeof insertDiscoveryIntakeItem
    checkIdentity?: typeof checkDiscoveryIntakeItemIdentity
  }

export function createDiscoveryIntakeItemsHandler(
  overrides: DiscoveryIntakeItemsRouteDependencies = {},
) {
  const {
    clearCategory,
    insertItem,
    checkIdentity,
    loadCatalogProductType = DISCOVERY_INTAKE_RESEARCH_DEPENDENCIES.loadCatalogProductType,
    createResearchSubmission = DISCOVERY_INTAKE_RESEARCH_DEPENDENCIES.createResearchSubmission,
    ...guardOverrides
  } = overrides
  const clear = clearCategory ?? clearDiscoveryIntakeCategory
  const insert = insertItem ?? insertDiscoveryIntakeItem
  const checkIdentityOf = checkIdentity ?? checkDiscoveryIntakeItemIdentity

  return async function POST(request: NextRequest) {
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response
    const { intake, admin, userId } = guard.context

    const frozen = refuseSubmittedIntake(guard.context)
    if (frozen) return frozen

    const body = await readJsonBody(request)
    const isLegacy = typeof body === "object" && body !== null && "category" in body
    if (!isLegacy) {
      return addFlatChecklistProduct(body)
    }

    const parsed = discoveryIntakeItemBodySchema.safeParse(body)
    if (!parsed.success) return discoveryIntakeError("invalid_body", 400)

    const built = buildDiscoveryIntakeItemRow(intake.id, parsed.data.category, parsed.data.capture)
    if (!built.ok) return discoveryIntakeError(built.reason, 400)

    try {
      // Before anything is written: the ids in the capture have to resolve, and — for a
      // submission — to belong to this participant. `userId` comes from the guard, never
      // from the body. Note what is NOT asked: whether the catalog files the product in
      // the category this item is being written under. It often does not, by design.
      const identity = await checkIdentityOf(
        {
          productId: built.row.product_id,
          productSubmissionId: built.row.product_submission_id,
          userId,
        },
        admin,
      )
      if (!identity.ok) {
        return discoveryIntakeJson(
          { code: identity.reason, error: IDENTITY_REFUSALS[identity.reason] },
          422,
        )
      }

      // The one clear that still has to precede the insert, and it costs nothing: the
      // partial unique index `discovery_intake_items_one_none_per_category` allows a
      // single „benutze ich nicht" row per category, so a re-tap would collide. The row
      // dropped here carries no information the row replacing it does not — unlike a
      // product row, which is why products are never pre-cleared.
      if (parsed.data.capture.source === "none") {
        await clear(
          { intakeId: intake.id, category: parsed.data.category, sources: ["none"] },
          admin,
        )
      }

      const stored = await insert(built.row, admin)

      // Past the insert the answer IS stored, so a failing clear must not be reported
      // as a failed write — that would tell the participant to try again while the
      // table already holds what she said. The category is left briefly holding both
      // answers instead, which `clearDiscoveryIntakeCoexistingNone` resolves on submit.
      try {
        await clear(
          {
            intakeId: intake.id,
            category: parsed.data.category,
            // A product only displaces the „benutze ich nicht" answer — multiple
            // products per category are explicitly allowed (mockup frame C).
            ...(parsed.data.capture.source === "none" ? {} : { sources: ["none" as const] }),
            // Never the row this request just stored.
            exceptItemId: stored.id,
          },
          admin,
        )
      } catch (error) {
        console.error("[discovery] intake category clear failed after the insert:", error)
      }

      // The browser gets the same projection the checklist page is built from — never
      // the stored row, whose `product_id` / `product_submission_id` stay server-side.
      const item = toDiscoveryIntakeItemView(stored)
      return discoveryIntakeJson({ item } satisfies { item: DiscoveryIntakeItemView }, 201)
    } catch (error) {
      console.error("[discovery] intake item write failed:", error)
      return discoveryIntakeError("unavailable", 503)
    }

    async function addFlatChecklistProduct(raw: unknown) {
      const parsed = discoveryIntakeProductBodySchema.safeParse(raw)
      if (!parsed.success) return discoveryIntakeError("invalid_body", 400)
      const { capture, usage } = parsed.data
      if (usage && !isValidDiscoveryUsage(usage)) {
        return discoveryIntakeError("invalid_usage", 400)
      }
      const identity = discoveryIntakeProductIdentity(capture)

      try {
        let productType: DiscoveryIntakeCategory | null = parsed.data.productType ?? null
        let productId = identity.product_id
        let productSubmissionId: string | null = null

        if (productId) {
          const checked = await checkIdentityOf(
            { productId, productSubmissionId: null, userId },
            admin,
          )
          if (!checked.ok) {
            return discoveryIntakeJson(
              { code: checked.reason, error: IDENTITY_REFUSALS[checked.reason] },
              422,
            )
          }
          // Catalog authority (P2-6): what the client classified is not asked.
          productType = await loadCatalogProductType(admin, productId)
        } else if (productType === null && usage !== null) {
          // „Weiß ich nicht" carries no usage: a usage alone would read as a legacy row.
          return discoveryIntakeError("product_type_required", 400)
        }

        if (!productId && productType) {
          // Opened only now — on the add that carries her usage answer — and from the
          // product type, never from the usage (F1).
          const research = await openDiscoveryIntakeResearch(
            { userId, productType, identity },
            admin,
            { createResearchSubmission, loadCatalogProductType },
          )
          productId = research.productId
          productSubmissionId = research.productSubmissionId
          productType = research.productType
        }

        const stored = await insert(
          {
            intake_id: intake.id,
            category: usage?.category ?? null,
            usage_role: usage?.role ?? null,
            product_type: productType,
            ...identity,
            product_id: productId,
            product_submission_id: productSubmissionId,
          },
          admin,
        )

        // A standing legacy „benutze ich nicht" in her usage category is displaced, exactly
        // as on the tile path — best effort, after the insert.
        if (usage) {
          try {
            await clear(
              {
                intakeId: intake.id,
                category: usage.category,
                sources: ["none"],
                exceptItemId: stored.id,
              },
              admin,
            )
          } catch (error) {
            console.error("[discovery] intake category clear failed after the insert:", error)
          }
        }

        const item = toDiscoveryIntakeItemView(stored)
        return discoveryIntakeJson({ item } satisfies { item: DiscoveryIntakeItemView }, 201)
      } catch (error) {
        console.error("[discovery] intake product write failed:", error)
        return discoveryIntakeError("unavailable", 503)
      }
    }
  }
}

export const POST = createDiscoveryIntakeItemsHandler()
