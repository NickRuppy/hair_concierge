import {
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
 */

export type DiscoveryIntakeSubmitDependencies = DiscoveryIntakeRouteDependencies & {
  loadItems?: typeof loadDiscoveryIntakeItems
  submitIntake?: typeof submitDiscoveryIntake
}

export function createDiscoveryIntakeSubmitHandler(
  overrides: DiscoveryIntakeSubmitDependencies = {},
) {
  const { loadItems, submitIntake, ...guardOverrides } = overrides
  const load = loadItems ?? loadDiscoveryIntakeItems
  const submit = submitIntake ?? submitDiscoveryIntake

  return async function POST() {
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response
    const { intake, admin } = guard.context

    const frozen = refuseSubmittedIntake(guard.context)
    if (frozen) return frozen

    try {
      const missing = missingDiscoveryIntakeCategories(await load(intake.id, admin))
      if (missing.length > 0) {
        return discoveryIntakeJson({ code: "incomplete", missing }, 400)
      }
      const submitted = await submit(intake.id, admin)
      return discoveryIntakeJson({ state: submitted.state, submittedAt: submitted.submittedAt })
    } catch (error) {
      console.error("[discovery] intake submit failed:", error)
      return discoveryIntakeError("unavailable", 503)
    }
  }
}

export const POST = createDiscoveryIntakeSubmitHandler()
