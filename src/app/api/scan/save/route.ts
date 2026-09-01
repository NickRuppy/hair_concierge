import { NextResponse } from "next/server"
import { z } from "zod"

import { checkRateLimit, SCAN_RATE_LIMIT } from "@/lib/rate-limit"
import {
  loadScanSavedState,
  removeScanRoutineProduct,
  removeScanWishlistProduct,
  saveScanRoutineProduct,
  saveScanWishlistProduct,
  type ScanSavedStatePayload,
} from "@/lib/scan/saved-state"
import { captureScanException } from "@/lib/observability/scan"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const saveBodySchema = z
  .object({
    productId: z.string().uuid(),
    kind: z.enum(["routine", "merkliste"]),
  })
  .strict()

export type ScanSaveRouteDeps = {
  getUserId: () => Promise<string | null>
  checkRateLimit: typeof checkRateLimit
  createAdminClient: typeof createAdminClient
  saveWishlist: typeof saveScanWishlistProduct
  removeWishlist: typeof removeScanWishlistProduct
  saveRoutine: typeof saveScanRoutineProduct
  removeRoutine: typeof removeScanRoutineProduct
  loadSavedState: typeof loadScanSavedState
  captureScanException?: typeof captureScanException
}

type ScanSaveKind = "routine" | "merkliste"

const otherKind = (kind: ScanSaveKind): ScanSaveKind =>
  kind === "merkliste" ? "routine" : "merkliste"

const fail = (error: string, status: number, headers?: HeadersInit) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } })

export function createScanSaveRouteHandlers(deps: ScanSaveRouteDeps) {
  /** Same shared per-user scan budget the read routes use (`SCAN_RATE_LIMIT`). */
  async function rateLimit(userId: string) {
    const limited = await deps.checkRateLimit(userId, SCAN_RATE_LIMIT)
    if (limited.allowed) return null
    const unavailable = limited.error === "service_unavailable"
    return fail(
      unavailable ? "temporarily_unavailable" : "rate_limited",
      unavailable ? 503 : 429,
      unavailable ? undefined : { "Retry-After": "60" },
    )
  }

  async function readBody(request: Request) {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return null
    }
    const parsed = saveBodySchema.safeParse(body)
    return parsed.success ? parsed.data : null
  }

  function removeKind(
    client: ReturnType<typeof createAdminClient>,
    userId: string,
    productId: string,
    kind: ScanSaveKind,
  ) {
    return kind === "merkliste"
      ? deps.removeWishlist(client, userId, productId)
      : deps.removeRoutine(client, userId, productId)
  }

  return {
    async POST(request: Request) {
      const userId = await deps.getUserId()
      if (!userId) return fail("unauthorized", 401)

      const limited = await rateLimit(userId)
      if (limited) return limited

      const parsed = await readBody(request)
      if (!parsed) return fail("invalid_request", 400)

      try {
        const client = deps.createAdminClient()
        // Both kinds share the eligibility outcome shape (active product, ruling R7
        // quarantine, plus the routine-only origin/ownership gate).
        const result =
          parsed.kind === "merkliste"
            ? await deps.saveWishlist(client, userId, parsed.productId)
            : await deps.saveRoutine(client, userId, parsed.productId)
        if (result.outcome === "product_not_found") return fail("product_not_found", 404)
        if (result.outcome === "product_not_saveable") return fail("product_not_saveable", 409)

        // The two destinations are exclusive, so a save is a MOVE. Doing the cleanup here
        // rather than as a second client call keeps it on one rate-limit charge and
        // removes the window where a dropped/aborted follow-up request left the product
        // in both lists. A cleanup that cannot happen because the other row belongs to
        // another surface (`not_removable_here`) is not a failure — that row was never
        // ours to move, and `loadSavedState` below reports what actually stands.
        try {
          await removeKind(client, userId, parsed.productId, otherKind(parsed.kind))
        } catch (error) {
          console.error("[scan] save move cleanup failed", error)
          ;(deps.captureScanException ?? captureScanException)(error, {
            route: "save",
            status: 500,
            reason: "save_move_cleanup_failed",
            userId,
          })
          return fail("save_incomplete", 500)
        }

        // `result.savedState` already describes the post-move state: the kind just saved
        // wins the loader's priority order in every reachable combination, so no extra
        // round trip is needed to answer "where does this product sit now?".
        const savedState: ScanSavedStatePayload = result.savedState

        return NextResponse.json(
          { ok: true, kind: parsed.kind, productId: parsed.productId, savedState },
          { headers: { "Cache-Control": "no-store" } },
        )
      } catch (error) {
        console.error("[scan] save failed", error)
        ;(deps.captureScanException ?? captureScanException)(error, {
          route: "save",
          status: 503,
          reason: "save_failed",
          userId,
        })
        return fail("temporarily_unavailable", 503)
      }
    },

    async DELETE(request: Request) {
      const userId = await deps.getUserId()
      if (!userId) return fail("unauthorized", 401)

      const limited = await rateLimit(userId)
      if (limited) return limited

      const parsed = await readBody(request)
      if (!parsed) return fail("invalid_request", 400)

      try {
        const client = deps.createAdminClient()
        const result = await removeKind(client, userId, parsed.productId, parsed.kind)
        // The routine row belongs to Stage-3 / product intake: the scan sheet has no
        // authority to delete it, and reporting success would render as "removed" for a
        // row that is still there.
        if (result.outcome === "not_removable_here") return fail("not_removable_here", 409)
        // Not necessarily `null`: removing the Merkliste entry of a product the user also
        // owns via Stage-3 leaves a truthful "routine" state behind, so re-read it.
        const savedState = await deps.loadSavedState(client, userId, parsed.productId)
        return NextResponse.json(
          { ok: true, kind: parsed.kind, productId: parsed.productId, savedState },
          { headers: { "Cache-Control": "no-store" } },
        )
      } catch (error) {
        console.error("[scan] save removal failed", error)
        ;(deps.captureScanException ?? captureScanException)(error, {
          route: "save",
          status: 503,
          reason: "save_removal_failed",
          userId,
        })
        return fail("temporarily_unavailable", 503)
      }
    },
  }
}

const handlers = createScanSaveRouteHandlers({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  checkRateLimit,
  createAdminClient,
  saveWishlist: saveScanWishlistProduct,
  removeWishlist: removeScanWishlistProduct,
  saveRoutine: saveScanRoutineProduct,
  removeRoutine: removeScanRoutineProduct,
  loadSavedState: loadScanSavedState,
})

export const POST = handlers.POST
export const DELETE = handlers.DELETE
