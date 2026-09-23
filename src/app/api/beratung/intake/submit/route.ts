import {
  clearDiscoveryIntakeCoexistingNone,
  loadDiscoveryIntakeItems,
  missingDiscoveryIntakeCategories,
  submitDiscoveryIntake,
} from "@/lib/discovery/intake"

import {
  discoveryIntakeError,
  discoveryIntakeJson,
  guardDiscoveryIntakeRequest,
  refuseSubmittedIntake,
  type DiscoveryIntakeRouteDependencies,
} from "../shared"

/**
 * `POST /api/beratung/intake/submit` — hands the checklist over for the call.
 *
 * Completeness is decided from the STORED items, never from what the client
 * claims: „Absenden" only renders once all ten categories are answered, and this
 * re-derives the same fact server-side. An incomplete intake is refused with the
 * categories that are still open, so a client whose optimistic state drifted can
 * repair itself.
 *
 * The state transition is a compare-and-set (`state = 'draft'`), so a double tap
 * cannot submit twice — and after it, every write endpoint answers 409.
 *
 * It is also the last moment anything can be repaired, so it is where the one
 * inconsistency the items route tolerates gets healed: a category holding both
 * „benutze ich nicht" and products, left by a clear that failed after its insert
 * succeeded. Products win, and the freeze then makes that permanent.
 */

export type DiscoveryIntakeSubmitDependencies = DiscoveryIntakeRouteDependencies & {
  loadItems?: typeof loadDiscoveryIntakeItems
  submitIntake?: typeof submitDiscoveryIntake
  clearCoexistingNone?: typeof clearDiscoveryIntakeCoexistingNone
}

export function createDiscoveryIntakeSubmitHandler(
  overrides: DiscoveryIntakeSubmitDependencies = {},
) {
  const { loadItems, submitIntake, clearCoexistingNone, ...guardOverrides } = overrides
  const load = loadItems ?? loadDiscoveryIntakeItems
  const submit = submitIntake ?? submitDiscoveryIntake
  const heal = clearCoexistingNone ?? clearDiscoveryIntakeCoexistingNone

  return async function POST() {
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response
    const { intake, admin } = guard.context

    const frozen = refuseSubmittedIntake(guard.context)
    if (frozen) return frozen

    try {
      const items = await load(intake.id, admin)
      const missing = missingDiscoveryIntakeCategories(items)
      if (missing.length > 0) {
        return discoveryIntakeJson({ code: "incomplete", missing }, 400)
      }
      // Deliberately after the completeness check and before the freeze. It cannot
      // change completeness — a healed category keeps its products, so it stays
      // answered — and running it on an intake that is about to be refused anyway
      // would write for nothing.
      await heal({ intakeId: intake.id, items }, admin)
      const submitted = await submit(intake.id, admin)
      return discoveryIntakeJson({ state: submitted.state, submittedAt: submitted.submittedAt })
    } catch (error) {
      console.error("[discovery] intake submit failed:", error)
      return discoveryIntakeError("unavailable", 503)
    }
  }
}

export const POST = createDiscoveryIntakeSubmitHandler()
