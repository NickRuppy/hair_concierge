import type { NextRequest } from "next/server"
import { z } from "zod"

import { isShoppingBudgetEnabled } from "@/lib/personal-plan/release"
import { loadUserFacts } from "@/lib/user-facts/read"
import { SHOPPING_PREFERENCES_SCHEMA_VERSION, shoppingBudgetSchema } from "@/lib/user-facts/schema"
import { saveUserFacts } from "@/lib/user-facts/save"

import {
  discoveryCockpitError,
  discoveryCockpitJson,
  guardDiscoveryCockpitRequest,
  readJsonBody,
  refuseFinalizedIntake,
  type DiscoveryCockpitRouteDependencies,
} from "../../shared"

/**
 * `PUT /api/admin/beratung/<enrollmentId>/shopping-preferences` — the call cockpit's „Kundenbudget"
 * correction (Profi-tier plan, Task 8). Body `{ budget }`, the strict `shoppingBudgetSchema`
 * (`capped` 5 | 15 with `allowExceptions`, or `uncapped`); the stored budget is replaced whole.
 *
 * Gate order as the other cockpit writes: same-origin (403) → kill switch (404) → the shared
 * `requireAdmin` (401/403) → the intake the URL names (404). Then:
 *
 *   budget flag off → 404 `not_found`   (`SHOPPING_BUDGET_ENABLED`: nothing can be stored)
 *   finalised       → 409 `finalized`   („Erst Finalisierung aufheben")
 *   bad body        → 400 `invalid_body`
 *   facts changed since the revision this save read → 409 `profile_conflict`
 *   anything else   → 503 `unavailable`
 *   200 `{ budget, revision }`
 *
 * The write goes through the facts door (`user_facts_save_v1`) for the customer
 * (`intake.userId`), compare-and-set on the revision it just read, with provenance
 * `consultation_staff` and the enrollment as the source id. A budget is a preference: this
 * route never rebases diagnostics, syncs a plan or recomputes a routine.
 */

const bodySchema = z.object({ budget: shoppingBudgetSchema }).strict()

export type DiscoveryShoppingPreferencesRouteDependencies = DiscoveryCockpitRouteDependencies & {
  isBudgetEnabled?: () => boolean
  loadFacts?: typeof loadUserFacts
  saveFacts?: typeof saveUserFacts
  now?: () => string
}

export function createDiscoveryShoppingPreferencesHandler(
  overrides: DiscoveryShoppingPreferencesRouteDependencies = {},
) {
  const {
    isBudgetEnabled = isShoppingBudgetEnabled,
    loadFacts = loadUserFacts,
    saveFacts = saveUserFacts,
    now = () => new Date().toISOString(),
    ...guardOverrides
  } = overrides

  return async function PUT(
    request: NextRequest,
    context: { params: Promise<{ enrollmentId: string }> },
  ) {
    // CSRF first: the admin cookie rides along on a cross-site request too.
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return discoveryCockpitError("cross_origin", 403)
    }
    const { enrollmentId } = await context.params
    const guard = await guardDiscoveryCockpitRequest(enrollmentId, guardOverrides)
    if (!guard.ok) return guard.response
    const { admin, intake } = guard

    if (!isBudgetEnabled()) return discoveryCockpitError("not_found", 404)
    const frozen = refuseFinalizedIntake(intake)
    if (frozen) return frozen

    const body = bodySchema.safeParse(await readJsonBody(request))
    if (!body.success) return discoveryCockpitError("invalid_body", 400)

    try {
      // A customer without a facts row yet counts as revision 0 and gets one.
      const stored = await loadFacts(admin, intake.userId)
      const saved = await saveFacts(admin, {
        userId: intake.userId,
        domain: "shopping_preferences",
        patch: { budget: body.data.budget },
        provenance: {
          source: { kind: "consultation_staff", id: enrollmentId },
          schemaVersion: SHOPPING_PREFERENCES_SCHEMA_VERSION,
          at: now(),
          fields: { budget: "user" },
        },
        expectedRevision: stored?.revision ?? 0,
      })
      if (saved.status === "revision_conflict") {
        return discoveryCockpitError("profile_conflict", 409)
      }
      if (saved.status !== "ok") return discoveryCockpitError("unavailable", 503)
      return discoveryCockpitJson({ budget: body.data.budget, revision: saved.revision })
    } catch (error) {
      console.error("[discovery] cockpit shopping preferences save failed:", error)
      return discoveryCockpitError("unavailable", 503)
    }
  }
}

export const PUT = createDiscoveryShoppingPreferencesHandler()
