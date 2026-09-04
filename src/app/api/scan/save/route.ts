import { NextResponse } from "next/server"
import { z } from "zod"

import { checkRateLimit, SCAN_RATE_LIMIT } from "@/lib/rate-limit"
import {
  loadScanSavedState,
  moveScanSavedProduct,
  removeScanRoutineProduct,
  removeScanWishlistProduct,
  type ScanSaveKind,
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
  moveSavedProduct: typeof moveScanSavedProduct
  removeWishlist: typeof removeScanWishlistProduct
  removeRoutine: typeof removeScanRoutineProduct
  loadSavedState: typeof loadScanSavedState
  captureScanException?: typeof captureScanException
}

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
        // The two destinations are exclusive, so a save is a MOVE — destination write
        // plus source cleanup plus the state read, all inside one transaction
        // (`scan_move_saved_product`). A source row another surface owns is left
        // standing and is not a failure; the returned state reports what stands.
        const result = await deps.moveSavedProduct(client, userId, parsed.productId, parsed.kind)
        if (result.outcome === "product_not_found") return fail("product_not_found", 404)
        if (result.outcome === "product_not_saveable") return fail("product_not_saveable", 409)

        return NextResponse.json(
          {
            ok: true,
            kind: parsed.kind,
            productId: parsed.productId,
            savedState: result.savedState,
          },
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
  moveSavedProduct: moveScanSavedProduct,
  removeWishlist: removeScanWishlistProduct,
  removeRoutine: removeScanRoutineProduct,
  loadSavedState: loadScanSavedState,
})

export const POST = handlers.POST
export const DELETE = handlers.DELETE
