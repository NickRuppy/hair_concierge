import type { NextRequest } from "next/server"

import type { DiscoveryIntakeItemView } from "@/components/discovery/intake/types"
import {
  buildDiscoveryIntakeItemRow,
  clearDiscoveryIntakeCategory,
  discoveryIntakeItemBodySchema,
  insertDiscoveryIntakeItem,
  toDiscoveryIntakeItemView,
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
 * `captured_has_identity` CHECK would reject.
 *
 * Writing an answer also clears the answer it replaces, because a category is
 * either „benutze ich nicht" or a non-empty product list:
 *   - a `none` answer removes the category's products,
 *   - a product removes a standing `none`.
 */

export type DiscoveryIntakeItemsRouteDependencies = DiscoveryIntakeRouteDependencies & {
  clearCategory?: typeof clearDiscoveryIntakeCategory
  insertItem?: typeof insertDiscoveryIntakeItem
}

export function createDiscoveryIntakeItemsHandler(
  overrides: DiscoveryIntakeItemsRouteDependencies = {},
) {
  const { clearCategory, insertItem, ...guardOverrides } = overrides
  const clear = clearCategory ?? clearDiscoveryIntakeCategory
  const insert = insertItem ?? insertDiscoveryIntakeItem

  return async function POST(request: NextRequest) {
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response
    const { intake, admin } = guard.context

    const frozen = refuseSubmittedIntake(guard.context)
    if (frozen) return frozen

    const parsed = discoveryIntakeItemBodySchema.safeParse(await readJsonBody(request))
    if (!parsed.success) return discoveryIntakeError("invalid_body", 400)

    const built = buildDiscoveryIntakeItemRow(intake.id, parsed.data.category, parsed.data.capture)
    if (!built.ok) return discoveryIntakeError(built.reason, 400)

    try {
      await clear(
        {
          intakeId: intake.id,
          category: parsed.data.category,
          // A product only displaces the „benutze ich nicht" answer — multiple
          // products per category are explicitly allowed (mockup frame C).
          ...(parsed.data.capture.source === "none" ? {} : { sources: ["none" as const] }),
        },
        admin,
      )
      const stored = await insert(built.row, admin)
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
