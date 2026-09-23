import {
  clearDiscoveryIntakeCoexistingNone,
  loadDiscoveryIntakeItems,
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
 * Nothing on the checklist is mandatory: a category the participant never touched
 * stays unanswered (no row) and the call covers it. What IS required is one answer —
 * a product or an explicit „benutze ich nicht" — decided from the STORED items,
 * never from what the client claims. An intake with nothing in it is refused
 * (400 `nothing_answered`): there would be nothing to prepare the call from.
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
      if (items.length === 0) return discoveryIntakeError("nothing_answered", 400)
      // Deliberately after the emptiness check and before the freeze. It cannot empty
      // the intake — a healed category keeps its products — and running it on an
      // intake that is about to be refused anyway would write for nothing.
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
