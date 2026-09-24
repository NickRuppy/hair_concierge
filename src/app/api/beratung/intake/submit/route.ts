import { z } from "zod"

import {
  clearDiscoveryIntakeCoexistingNone,
  loadDiscoveryIntakeItems,
  submitDiscoveryIntake,
  submitDiscoveryIntakeConfirmingNone,
} from "@/lib/discovery/intake"

import {
  discoveryIntakeError,
  discoveryIntakeJson,
  guardDiscoveryIntakeRequest,
  refuseCrossOrigin,
  readJsonBody,
  refuseSubmittedIntake,
  type DiscoveryIntakeRouteDependencies,
} from "../shared"

/**
 * `POST /api/beratung/intake/submit` — hands the checklist over for the call.
 *
 * FLAT CHECKLIST (batch 5, R6) — body `{ "confirmNoneForMissing": true }`, sent by
 * „Stimmt so – abschicken": her confirmation that she uses nothing in the categories she
 * left empty. ONE database call (`submitDiscoveryIntakeConfirmingNone`) inserts a `none`
 * row for each of them and freezes the intake. At least one PRODUCT is required — a
 * product whose usage is unknown counts, a `none` row does not.
 *   200 `{ state: "submitted", submittedAt, confirmedNone: [category…] }` ·
 *   400 `invalid_body` | `no_products` · 409 `already_submitted` · 503 `unavailable`
 *
 * LEGACY (tile checklist; no body) — as below.
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
  submitConfirmingNone?: typeof submitDiscoveryIntakeConfirmingNone
}

const confirmBodySchema = z.object({ confirmNoneForMissing: z.literal(true) }).strict()

export function createDiscoveryIntakeSubmitHandler(
  overrides: DiscoveryIntakeSubmitDependencies = {},
) {
  const {
    loadItems,
    submitIntake,
    clearCoexistingNone,
    submitConfirmingNone = submitDiscoveryIntakeConfirmingNone,
    ...guardOverrides
  } = overrides
  const load = loadItems ?? loadDiscoveryIntakeItems
  const submit = submitIntake ?? submitDiscoveryIntake
  const heal = clearCoexistingNone ?? clearDiscoveryIntakeCoexistingNone

  // `request` is optional only for the legacy callers (and their tests) that post no body.
  return async function POST(request?: Request) {
    const crossOrigin = refuseCrossOrigin(request)
    if (crossOrigin) return crossOrigin
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response
    const { intake, admin } = guard.context

    const frozen = refuseSubmittedIntake(guard.context)
    if (frozen) return frozen

    // An empty body is the legacy submit; any body must be the confirmation.
    const body = request ? await readJsonBody(request) : null
    if (body !== null) {
      const parsed = confirmBodySchema.safeParse(body)
      if (!parsed.success) return discoveryIntakeError("invalid_body", 400)
      try {
        const result = await submitConfirmingNone(intake.id, admin)
        switch (result.outcome) {
          case "submitted":
            return discoveryIntakeJson({
              state: "submitted",
              submittedAt: result.submittedAt,
              confirmedNone: result.confirmedNone,
            })
          case "no_products":
            return discoveryIntakeError("no_products", 400)
          case "not_draft":
            return discoveryIntakeError("already_submitted", 409)
          default:
            // The guard just read this intake; losing it in between is not a client error.
            return discoveryIntakeError("unavailable", 503)
        }
      } catch (error) {
        console.error("[discovery] intake submit with confirmation failed:", error)
        return discoveryIntakeError("unavailable", 503)
      }
    }

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
