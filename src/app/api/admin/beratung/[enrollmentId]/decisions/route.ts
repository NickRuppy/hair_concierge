import type { NextRequest } from "next/server"
import { z } from "zod"

import { discoveryCockpitSwapOptionIds, upsertDiscoveryCallDecision } from "@/lib/discovery/cockpit"

import {
  discoveryCockpitError,
  discoveryCockpitJson,
  guardDiscoveryCockpitRequest,
  readJsonBody,
  refuseFinalizedIntake,
  resolveDiscoveryCockpitView,
  type DiscoveryCockpitRouteDependencies,
} from "../../shared"

/**
 * `POST /api/admin/beratung/<enrollmentId>/decisions` — one keep/swap ruling for one
 * routine step, upserted by `decision_key`.
 *
 * Three refusals carry the contract:
 *
 *  - **frozen while finalised** — the PDF is made from a fingerprinted routine, so a
 *    decision landing after „Finalisieren" would silently invalidate it (409).
 *  - **unknown step** — a `decision_key` the participant's Idealplan does not carry is
 *    rejected rather than stored as an orphan the read model would ignore (400).
 *  - **swap target not offered** — a swap may only name a product the cockpit DISPLAYED
 *    for that step (the engine's alternatives, or the Idealplan's own recommendation where
 *    there are none). Nick's ruling: no catalog picker (400).
 *
 * `intake_item_id` is never taken from the request: the server writes the item its own
 * binding put in that step, so the stored decision and the composed routine agree.
 */

const bodySchema = z
  .object({
    decisionKey: z.string().trim().min(1).max(200),
    decision: z.enum(["keep", "swap"]),
    swapProductId: z.string().uuid().nullish(),
  })
  .refine((body) => (body.decision === "swap") === Boolean(body.swapProductId), {
    message: "swap_product_pair",
  })

export type DiscoveryDecisionsRouteDependencies = DiscoveryCockpitRouteDependencies & {
  upsertDecision?: typeof upsertDiscoveryCallDecision
}

export function createDiscoveryDecisionsHandler(
  overrides: DiscoveryDecisionsRouteDependencies = {},
) {
  const { upsertDecision, ...guardOverrides } = overrides
  const upsert = upsertDecision ?? upsertDiscoveryCallDecision

  return async function POST(
    request: NextRequest,
    context: { params: Promise<{ enrollmentId: string }> },
  ) {
    const { enrollmentId } = await context.params
    const guard = await guardDiscoveryCockpitRequest(enrollmentId, guardOverrides)
    if (!guard.ok) return guard.response
    const { admin, intake } = guard

    const frozen = refuseFinalizedIntake(intake)
    if (frozen) return frozen

    const body = bodySchema.safeParse(await readJsonBody(request))
    if (!body.success) return discoveryCockpitError("invalid_body", 400)

    const composed = await resolveDiscoveryCockpitView(admin, intake, guardOverrides)
    if (!composed.ok) return composed.response

    const step = composed.view.steps.find((entry) => entry.decisionKey === body.data.decisionKey)
    if (!step) return discoveryCockpitError("unknown_decision_key", 400)

    const swapProductId = body.data.swapProductId ?? null
    if (body.data.decision === "swap") {
      const allowed = discoveryCockpitSwapOptionIds(composed.view, body.data.decisionKey) ?? []
      if (!swapProductId || !allowed.includes(swapProductId)) {
        return discoveryCockpitError("swap_not_offered", 400)
      }
    }

    try {
      const decision = await upsert(
        {
          intakeId: intake.id,
          decisionKey: body.data.decisionKey,
          decision: body.data.decision,
          swapProductId,
          intakeItemId: step.intakeItemId,
        },
        admin,
      )
      return discoveryCockpitJson({ decision })
    } catch (error) {
      console.error("[discovery] cockpit decision write failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
  }
}

export const POST = createDiscoveryDecisionsHandler()
