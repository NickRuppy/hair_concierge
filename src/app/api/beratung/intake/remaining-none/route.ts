import type { DiscoveryIntakeItemView } from "@/components/discovery/intake/types"
import {
  insertDiscoveryIntakeNoneItems,
  loadDiscoveryIntakeItems,
  missingDiscoveryIntakeCategories,
  toDiscoveryIntakeItemView,
} from "@/lib/discovery/intake"

import {
  discoveryIntakeError,
  discoveryIntakeJson,
  guardDiscoveryIntakeRequest,
  refuseSubmittedIntake,
  type DiscoveryIntakeRouteDependencies,
} from "../shared"

/**
 * `POST /api/beratung/intake/remaining-none` — „Mehr benutze ich nicht".
 *
 * Answers every category that has NO answer yet with the explicit `none`, in one
 * round-trip. Which categories are open is decided from the STORED rows, never from
 * the client: a category holding products or a standing `none` is not touched, so
 * the none-XOR-products rule holds without a clear.
 *
 * It is „the rest", so it needs something to be the rest of: an intake with no
 * answer at all is refused (400 `nothing_answered`), mirroring the checklist, which
 * only offers the action once one category is answered.
 *
 * It does NOT submit. The answer is the whole list after the write, so the client
 * replaces its state from the response and the ordinary „Absenden" dock appears.
 */

export type DiscoveryIntakeRemainingNoneDependencies = DiscoveryIntakeRouteDependencies & {
  loadItems?: typeof loadDiscoveryIntakeItems
  insertNoneItems?: typeof insertDiscoveryIntakeNoneItems
}

export function createDiscoveryIntakeRemainingNoneHandler(
  overrides: DiscoveryIntakeRemainingNoneDependencies = {},
) {
  const { loadItems, insertNoneItems, ...guardOverrides } = overrides
  const load = loadItems ?? loadDiscoveryIntakeItems
  const insertNone = insertNoneItems ?? insertDiscoveryIntakeNoneItems

  return async function POST() {
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response
    const { intake, admin } = guard.context

    const frozen = refuseSubmittedIntake(guard.context)
    if (frozen) return frozen

    try {
      const items = await load(intake.id, admin)
      if (items.length === 0) return discoveryIntakeError("nothing_answered", 400)

      const inserted = await insertNone(
        { intakeId: intake.id, categories: missingDiscoveryIntakeCategories(items) },
        admin,
      )

      // The same browser projection the checklist page and the items route use —
      // `product_id` / `product_submission_id` never leave the server.
      const body = { items: [...items, ...inserted].map(toDiscoveryIntakeItemView) }
      return discoveryIntakeJson(body satisfies { items: DiscoveryIntakeItemView[] })
    } catch (error) {
      console.error("[discovery] intake remaining-none write failed:", error)
      return discoveryIntakeError("unavailable", 503)
    }
  }
}

export const POST = createDiscoveryIntakeRemainingNoneHandler()
