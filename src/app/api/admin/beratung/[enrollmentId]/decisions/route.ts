import type { NextRequest } from "next/server"
import { z } from "zod"

import {
  discoveryCockpitSwapOptionIds,
  resetDiscoveryCallDecisions,
  setDiscoveryCallDecision,
  type DiscoveryCallDecisionOutcome,
} from "@/lib/discovery/cockpit"

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
 * `POST /api/admin/beratung/<enrollmentId>/decisions` — one keep/swap/drop ruling for one
 * product in one routine step (batch 9: a step may hold several of her products, each with
 * its own decision).
 *
 * The client names the pair (`decisionKey`, `intakeItemId`); the server finds that entry in
 * a FRESH composition — the same one the cockpit renders — and refuses what it did not show:
 *
 *  - **frozen while finalised** — the PDF is made from a fingerprinted routine, so a
 *    decision landing after „Finalisieren" would silently invalidate it (409).
 *  - **unknown step** — a `decision_key` the participant's Idealplan does not carry (400).
 *  - **unknown product** — the step does not hold that product (any more): a stale tab (409).
 *  - **old tab without `intakeItemId`** — accepted only for a step with exactly one entry;
 *    otherwise the server cannot know which product is meant (409 `item_required`).
 *  - **„Weglassen"** — only for one of ≥2 products in a step (409 `drop_single`) and never
 *    the last one standing (409 `drop_last`).
 *  - **swap target not offered** — a swap may only name a product the cockpit DISPLAYED
 *    for that very product (its verdict's alternatives, or the Idealplan's own pick where
 *    there are none). Nick's ruling: no catalog picker (400).
 *
 * The write itself is one locked database call (`discovery_admin_set_call_decision`). The
 * composition runs BEFORE that lock, so the call re-checks it inside: the target's usage
 * must still be the composed one (409 `stale_binding`), and only siblings still in the
 * step count for a drop — two tabs or a concurrent usage correction cannot race a step
 * empty or onto one swap target (409 `drop_last` / `swap_taken`). A draft intake takes
 * decisions like a submitted one; only finalising needs the submit.
 */

const bodySchema = z
  .object({
    decisionKey: z.string().trim().min(1).max(200),
    /** Absent: a deployed old tab (single-entry steps only). `null`: the empty step. */
    intakeItemId: z.string().uuid().nullish(),
    decision: z.enum(["keep", "swap", "drop"]),
    swapProductId: z.string().uuid().nullish(),
  })
  .refine((body) => (body.decision === "swap") === Boolean(body.swapProductId), {
    message: "swap_product_pair",
  })

const OUTCOME_STATUS: Record<Exclude<DiscoveryCallDecisionOutcome, "stored">, number> = {
  not_found: 404,
  finalized: 409,
  item_not_found: 409,
  stale_binding: 409,
  drop_last: 409,
  swap_taken: 409,
}

export type DiscoveryDecisionsRouteDependencies = DiscoveryCockpitRouteDependencies & {
  setDecision?: typeof setDiscoveryCallDecision
}

export function createDiscoveryDecisionsHandler(
  overrides: DiscoveryDecisionsRouteDependencies = {},
) {
  const { setDecision, ...guardOverrides } = overrides
  const write = setDecision ?? setDiscoveryCallDecision

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

    const decisionKey = body.data.decisionKey
    const entries = composed.view.steps.filter((entry) => entry.decisionKey === decisionKey)
    if (entries.length === 0) return discoveryCockpitError("unknown_decision_key", 400)

    let entry = entries[0]!
    if (body.data.intakeItemId === undefined) {
      if (entries.length !== 1) return discoveryCockpitError("item_required", 409)
    } else {
      const named = entries.find((candidate) => candidate.intakeItemId === body.data.intakeItemId)
      if (!named) return discoveryCockpitError("unknown_item", 409)
      entry = named
    }
    // Each sibling with its own composed usage: the write re-checks every one under its lock.
    const siblings = entries.flatMap((candidate) =>
      candidate !== entry && candidate.intakeItemId
        ? [
            {
              itemId: candidate.intakeItemId,
              category: candidate.category,
              usageRole: candidate.ownedUsageRole,
            },
          ]
        : [],
    )

    if (body.data.decision === "drop") {
      if (entry.intakeItemId === null || entries.length < 2) {
        return discoveryCockpitError("drop_single", 409)
      }
      if (!entry.canDrop) return discoveryCockpitError("drop_last", 409)
    }

    const swapProductId = body.data.swapProductId ?? null
    if (body.data.decision === "swap") {
      const allowed =
        discoveryCockpitSwapOptionIds(composed.view, decisionKey, entry.intakeItemId) ?? []
      if (!swapProductId || !allowed.includes(swapProductId)) {
        return discoveryCockpitError("swap_not_offered", 400)
      }
    }

    try {
      const result = await write(
        {
          intakeId: intake.id,
          decisionKey,
          decision: body.data.decision,
          swapProductId,
          intakeItemId: entry.intakeItemId,
          siblings,
          // A bound product always sits in a step of its own usage category.
          expectedCategory: entry.intakeItemId ? entry.category : null,
          expectedUsageRole: entry.intakeItemId ? entry.ownedUsageRole : null,
        },
        admin,
      )
      if (result.outcome !== "stored") {
        return discoveryCockpitError(result.outcome, OUTCOME_STATUS[result.outcome])
      }
      return discoveryCockpitJson({ decision: result.decision })
    } catch (error) {
      console.error("[discovery] cockpit decision write failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
  }
}

export const POST = createDiscoveryDecisionsHandler()

export type DiscoveryDecisionsResetRouteDependencies = DiscoveryCockpitRouteDependencies & {
  resetDecisions?: typeof resetDiscoveryCallDecisions
}

/**
 * `DELETE /api/admin/beratung/<enrollmentId>/decisions` — „Testlauf zurücksetzen" (cockpit
 * call-ready A2): every product decision of this call goes, the routine falls back to the
 * Idealplan. Same gates as a single decision: flag and admin, the intake, frozen while
 * finalised (409) — checked here and again inside the locked write, which also serialises it
 * with finalising. Score, brief and notes live in the call sheet and stay.
 */
export function createDiscoveryDecisionsResetHandler(
  overrides: DiscoveryDecisionsResetRouteDependencies = {},
) {
  const { resetDecisions, ...guardOverrides } = overrides
  const reset = resetDecisions ?? resetDiscoveryCallDecisions

  return async function DELETE(
    _request: NextRequest,
    context: { params: Promise<{ enrollmentId: string }> },
  ) {
    const { enrollmentId } = await context.params
    const guard = await guardDiscoveryCockpitRequest(enrollmentId, guardOverrides)
    if (!guard.ok) return guard.response
    const { admin, intake } = guard

    const frozen = refuseFinalizedIntake(intake)
    if (frozen) return frozen

    try {
      const result = await reset(intake.id, admin)
      if (result.outcome !== "reset") {
        return discoveryCockpitError(result.outcome, result.outcome === "not_found" ? 404 : 409)
      }
      return discoveryCockpitJson({ deleted: result.deleted })
    } catch (error) {
      console.error("[discovery] cockpit decisions reset failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
  }
}

export const DELETE = createDiscoveryDecisionsResetHandler()
