import type { DiscoveryHeatStylingV1 } from "@/lib/discovery/heat-styling"
import { parseDiscoveryHeatStyling } from "@/lib/discovery/heat-styling"
import { saveDiscoveryIntakeHeatStyling } from "@/lib/discovery/intake"

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
 * `PUT /api/beratung/intake/heat-styling` — her „Hitze & Styling" answers (batch 7, plan
 * `plans/discovery-refinement-b7/plan.md` Rev. 3 §2.2), always the WHOLE object
 * (`DiscoveryHeatStylingV1`):
 *
 *   { dryingRoutes: DryingRoute[], additionalHeatTools: AdditionalHeatTool[],
 *     heatEvents: { "heat:<source>": { frequency, protectionConsistency? } } }
 *
 * Validated like production Feinschliff (`parseDiscoveryHeatStyling`): known values only,
 * no extra keys, exactly one event per heat source her routes and tools imply, a
 * protection answer iff the source needs one.
 *
 * Gate order as every participant write: same-origin (403) → kill switch (404) → the
 * participant guard (401/404/403/503) → frozen after submit (409). The write itself is a
 * compare-and-set on `state = 'draft'`: a write racing the submit either lands before the
 * freeze or answers 409 — never after it.
 *
 *   200 `{ heatStyling }` · 400 `invalid_body` | `invalid_heat_events` ·
 *   409 `already_submitted` · 503 `unavailable`
 */

export type DiscoveryIntakeHeatStylingRouteDependencies = DiscoveryIntakeRouteDependencies & {
  saveHeatStyling?: typeof saveDiscoveryIntakeHeatStyling
}

export function createDiscoveryIntakeHeatStylingHandler(
  overrides: DiscoveryIntakeHeatStylingRouteDependencies = {},
) {
  const { saveHeatStyling = saveDiscoveryIntakeHeatStyling, ...guardOverrides } = overrides

  return async function PUT(request: Request) {
    const crossOrigin = refuseCrossOrigin(request)
    if (crossOrigin) return crossOrigin
    const guard = await guardDiscoveryIntakeRequest(guardOverrides)
    if (!guard.ok) return guard.response
    const { intake, admin } = guard.context

    const frozen = refuseSubmittedIntake(guard.context)
    if (frozen) return frozen

    const parsed = parseDiscoveryHeatStyling(await readJsonBody(request))
    if (!parsed.ok) {
      return discoveryIntakeError(
        parsed.reason === "invalid_shape" ? "invalid_body" : "invalid_heat_events",
        400,
      )
    }

    try {
      const saved = await saveHeatStyling({ intakeId: intake.id, heatStyling: parsed.value }, admin)
      // Submitted between the guard and the write: the compare-and-set matched nothing.
      if (!saved) return discoveryIntakeError("already_submitted", 409)
      return discoveryIntakeJson({
        heatStyling: parsed.value,
      } satisfies { heatStyling: DiscoveryHeatStylingV1 })
    } catch (error) {
      console.error("[discovery] heat styling write failed:", error)
      return discoveryIntakeError("unavailable", 503)
    }
  }
}

export const PUT = createDiscoveryIntakeHeatStylingHandler()
