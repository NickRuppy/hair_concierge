import type { NextRequest } from "next/server"
import { z } from "zod"

import {
  setDiscoveryIntakeItemFrequency,
  type DiscoveryItemFrequencyOutcome,
} from "@/lib/discovery/cockpit"
import { DISCOVERY_ITEM_FREQUENCIES } from "@/lib/discovery/frequency"

import {
  discoveryCockpitError,
  discoveryCockpitJson,
  guardDiscoveryCockpitRequest,
  readJsonBody,
  refuseFinalizedIntake,
  type DiscoveryCockpitRouteDependencies,
} from "../../../../shared"

/**
 * `PUT /api/admin/beratung/<enrollmentId>/items/<itemId>/frequency` — the cockpit's frequency
 * correction after she submitted (batch 7, plan §2.2/§2.3). Body `{ frequency }`, one of
 * `DISCOVERY_ITEM_FREQUENCIES` (incl. `unknown`).
 *
 * Gate order as the usage correction: same-origin (403) → kill switch (404) → the shared
 * `requireAdmin` (401/403) → the intake the URL names (404). Then:
 *
 *   finalised      → 409 `finalized`  („Erst Finalisierung aufheben")
 *   still a draft  → 409 `not_submitted`
 *   bad body       → 400 `invalid_body`
 *   foreign / `none` item → 404 `not_found`
 *   200 `{ outcome: "updated" }`
 *
 * ONE database call (`discovery_admin_set_intake_item_frequency`) re-checks the refusals
 * under a lock on the intake. A frequency moves no binding, so no decision is cleared.
 */

const bodySchema = z.object({ frequency: z.enum(DISCOVERY_ITEM_FREQUENCIES) }).strict()

const OUTCOME_STATUS: Record<Exclude<DiscoveryItemFrequencyOutcome, "updated">, number> = {
  not_found: 404,
  item_not_found: 404,
  not_submitted: 409,
  finalized: 409,
}

export type DiscoveryItemFrequencyRouteDependencies = DiscoveryCockpitRouteDependencies & {
  setFrequency?: typeof setDiscoveryIntakeItemFrequency
}

export function createDiscoveryItemFrequencyHandler(
  overrides: DiscoveryItemFrequencyRouteDependencies = {},
) {
  const { setFrequency = setDiscoveryIntakeItemFrequency, ...guardOverrides } = overrides

  return async function PUT(
    request: NextRequest,
    context: { params: Promise<{ enrollmentId: string; itemId: string }> },
  ) {
    // CSRF first: the admin cookie rides along on a cross-site request too.
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return discoveryCockpitError("cross_origin", 403)
    }
    const { enrollmentId, itemId } = await context.params
    const guard = await guardDiscoveryCockpitRequest(enrollmentId, guardOverrides)
    if (!guard.ok) return guard.response
    const { admin, intake } = guard

    const frozen = refuseFinalizedIntake(intake)
    if (frozen) return frozen
    if (intake.state !== "submitted") return discoveryCockpitError("not_submitted", 409)

    const body = bodySchema.safeParse(await readJsonBody(request))
    if (!body.success) return discoveryCockpitError("invalid_body", 400)

    try {
      const result = await setFrequency(
        { intakeId: intake.id, itemId, frequency: body.data.frequency },
        admin,
      )
      if (result.outcome !== "updated") {
        const code = result.outcome === "item_not_found" ? "not_found" : result.outcome
        return discoveryCockpitError(code, OUTCOME_STATUS[result.outcome])
      }
      return discoveryCockpitJson(result)
    } catch (error) {
      console.error("[discovery] cockpit frequency correction failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
  }
}

export const PUT = createDiscoveryItemFrequencyHandler()
