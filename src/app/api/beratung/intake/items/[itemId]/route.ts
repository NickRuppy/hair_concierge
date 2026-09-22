import type { NextRequest } from "next/server"

import { deleteDiscoveryIntakeItem } from "@/lib/discovery/intake"

import {
  discoveryIntakeError,
  discoveryIntakeJson,
  guardDiscoveryIntakeRequest,
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
    _request: NextRequest,
    context: { params: Promise<{ itemId: string }> },
  ) {
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
