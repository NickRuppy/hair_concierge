import type { NextRequest } from "next/server"
import { z } from "zod"

import {
  discoveryCategoryOpenItems,
  discoveryResearchOpenItems,
  finalizeDiscoveryCall,
  unfinalizeDiscoveryCall,
} from "@/lib/discovery/cockpit"

import {
  discoveryCockpitError,
  discoveryCockpitJson,
  guardDiscoveryCockpitRequest,
  readJsonBody,
  resolveDiscoveryCockpitView,
  type DiscoveryCockpitRouteDependencies,
} from "../../shared"

/**
 * `POST /api/admin/beratung/<enrollmentId>/finalize` — „Finalisieren" and its undo.
 *
 * Finalising stores the timestamp together with `finalized_source_hash`, the fingerprint
 * of the routine AS COMPOSED RIGHT NOW. That pair is the whole point: the PDF renders only
 * from a finalised intake, and it warns when a freshly computed hash no longer matches —
 * i.e. the profile or the catalog drifted since the call. Computing the hash here, from
 * the same composition the cockpit renders, is what makes that comparison meaningful.
 *
 * It requires `state = 'submitted'` (the predicate is in the UPDATE, so a draft intake
 * finalises nothing), and un-finalising clears BOTH columns and is allowed at any time —
 * sending the PDF is manual, so there is nothing to protect against a second thought.
 *
 * Batch 5 (P1-5): finalising is refused (409 `category_open`) while any product's usage is
 * unknown („Kategorie offen") — re-checked here from the composition it fingerprints, so
 * every product is understood before she gets a result. Accepted risk (plan Rev. 3): no
 * compare-and-set against a concurrent usage write; the correction itself refuses while
 * finalised.
 *
 * Batch 6 (Nick, 2026-09-24): finalising is also refused while any captured product is not
 * yet resolved to a catalog product (409 `research_open`), and while a printed product has
 * no complete verified application guide (409 `application_missing`) — every researched
 * product carries its verified guide, so a finalised sheet always has complete
 * „So wendest du es an" guidance, never invented copy. A section that cannot be read right
 * now refuses like unreadable brands (503 `unavailable`).
 */

const bodySchema = z.object({ finalized: z.boolean() })

export type DiscoveryFinalizeRouteDependencies = DiscoveryCockpitRouteDependencies & {
  finalize?: typeof finalizeDiscoveryCall
  unfinalize?: typeof unfinalizeDiscoveryCall
  now?: () => string
}

export function createDiscoveryFinalizeHandler(overrides: DiscoveryFinalizeRouteDependencies = {}) {
  const { finalize, unfinalize, now, ...guardOverrides } = overrides
  const applyFinalize = finalize ?? finalizeDiscoveryCall
  const applyUnfinalize = unfinalize ?? unfinalizeDiscoveryCall

  return async function POST(
    request: NextRequest,
    context: { params: Promise<{ enrollmentId: string }> },
  ) {
    const { enrollmentId } = await context.params
    const guard = await guardDiscoveryCockpitRequest(enrollmentId, guardOverrides)
    if (!guard.ok) return guard.response
    const { admin, intake } = guard

    const body = bodySchema.safeParse(await readJsonBody(request))
    if (!body.success) return discoveryCockpitError("invalid_body", 400)

    if (!body.data.finalized) {
      try {
        const cleared = await applyUnfinalize(intake.id, admin)
        if (!cleared) return discoveryCockpitError("not_found", 404)
        return discoveryCockpitJson({
          callFinalizedAt: cleared.callFinalizedAt,
          finalizedSourceHash: cleared.finalizedSourceHash,
        })
      } catch (error) {
        console.error("[discovery] cockpit un-finalize failed:", error)
        return discoveryCockpitError("unavailable", 503)
      }
    }

    if (intake.state !== "submitted") return discoveryCockpitError("not_submitted", 409)

    const composed = await resolveDiscoveryCockpitView(admin, intake, guardOverrides)
    if (!composed.ok) return composed.response
    if (discoveryCategoryOpenItems(composed.view).length > 0) {
      return discoveryCockpitError("category_open", 409)
    }
    if (discoveryResearchOpenItems(composed.view).length > 0) {
      return discoveryCockpitError("research_open", 409)
    }
    if (composed.view.applicationGaps.length > 0) {
      return discoveryCockpitError("application_missing", 409)
    }
    // A degraded composition (recommendation brands or the application section unreadable)
    // must never become the stored fingerprint — the PDF would later read as drifted for no
    // real reason.
    if (!composed.view.recommendationBrandsAvailable || !composed.view.applicationAvailable) {
      return discoveryCockpitError("unavailable", 503)
    }

    try {
      const finalized = await applyFinalize(
        { intakeId: intake.id, sourceHash: composed.view.sourceHash, now },
        admin,
      )
      // The UPDATE carries the `submitted` predicate too, so a state that changed between
      // the read and the write lands here rather than storing an impossible pair.
      if (!finalized) return discoveryCockpitError("not_submitted", 409)
      return discoveryCockpitJson({
        callFinalizedAt: finalized.callFinalizedAt,
        finalizedSourceHash: finalized.finalizedSourceHash,
      })
    } catch (error) {
      console.error("[discovery] cockpit finalize failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
  }
}

export const POST = createDiscoveryFinalizeHandler()
