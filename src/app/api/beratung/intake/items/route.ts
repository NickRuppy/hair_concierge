import type { NextRequest } from "next/server"

import type { DiscoveryIntakeItemView } from "@/components/discovery/intake/types"
import {
  buildDiscoveryIntakeItemRow,
  checkDiscoveryIntakeItemIdentity,
  clearDiscoveryIntakeCategory,
  discoveryIntakeItemBodySchema,
  insertDiscoveryIntakeItem,
  toDiscoveryIntakeItemView,
  type DiscoveryIntakeIdentityRefusal,
} from "@/lib/discovery/intake"

import {
  discoveryIntakeError,
  discoveryIntakeJson,
  guardDiscoveryIntakeRequest,
  readJsonBody,
  refuseSubmittedIntake,
  type DiscoveryIntakeRouteDependencies,
} from "../shared"

/**
 * `POST /api/beratung/intake/items` — records one checklist answer.
 *
 * The client declares WHAT it captured (`capture`, one variant per source); the
 * row shape itself is derived server-side by `buildDiscoveryIntakeItemRow`, so
 * no request can compose an identity combination the table's
 * `captured_has_identity` CHECK would reject. The ids inside that capture are then
 * re-established by `checkDiscoveryIntakeItemIdentity` — 422 — because a UUID-shaped
 * id from the browser proves nothing about what it points at: the product must be one
 * the identify endpoint would have answered with and sit in this category, and the
 * research submission must be this participant's own.
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
  category_mismatch: "Dieses Produkt gehört nicht in diese Kategorie.",
  unknown_submission: "Diese Produktanfrage kennen wir nicht. Versuch es bitte nochmal.",
}

export type DiscoveryIntakeItemsRouteDependencies = DiscoveryIntakeRouteDependencies & {
  clearCategory?: typeof clearDiscoveryIntakeCategory
  insertItem?: typeof insertDiscoveryIntakeItem
  checkIdentity?: typeof checkDiscoveryIntakeItemIdentity
}

export function createDiscoveryIntakeItemsHandler(
  overrides: DiscoveryIntakeItemsRouteDependencies = {},
) {
  const { clearCategory, insertItem, checkIdentity, ...guardOverrides } = overrides
  const clear = clearCategory ?? clearDiscoveryIntakeCategory
  const insert = insertItem ?? insertDiscoveryIntakeItem
  const checkIdentityOf = checkIdentity ?? checkDiscoveryIntakeItemIdentity

  return async function POST(request: NextRequest) {
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response
    const { intake, admin, userId } = guard.context

    const frozen = refuseSubmittedIntake(guard.context)
    if (frozen) return frozen

    const parsed = discoveryIntakeItemBodySchema.safeParse(await readJsonBody(request))
    if (!parsed.success) return discoveryIntakeError("invalid_body", 400)

    const built = buildDiscoveryIntakeItemRow(intake.id, parsed.data.category, parsed.data.capture)
    if (!built.ok) return discoveryIntakeError(built.reason, 400)

    try {
      // Before anything is written: the ids in the capture have to resolve, to resolve
      // into THIS category, and — for a submission — to belong to this participant.
      // `userId` comes from the guard, never from the body.
      const identity = await checkIdentityOf(
        {
          category: parsed.data.category,
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
  }
}

export const POST = createDiscoveryIntakeItemsHandler()
