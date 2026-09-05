import { z } from "zod"

import { checkRateLimit } from "@/lib/rate-limit"
import {
  loadScanSavedState,
  moveScanSavedProduct,
  removeScanRoutineProduct,
  removeScanWishlistProduct,
  type ScanSaveKind,
} from "@/lib/scan/saved-state"
import { captureScanException } from "@/lib/observability/scan"
import { createScanRoute, parseJsonBody, scanFail, scanOk } from "@/lib/scan/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const saveBodySchema = z
  .object({
    productId: z.string().uuid(),
    kind: z.enum(["routine", "merkliste"]),
  })
  .strict()

type SaveBody = z.infer<typeof saveBodySchema>

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

export function createScanSaveRouteHandlers(deps: ScanSaveRouteDeps) {
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

  const POST = createScanRoute<SaveBody>({
    route: "save",
    deps,
    parse: parseJsonBody(saveBodySchema),
    failureReason: "save_failed",
    handler: async (ctx) => {
      const client = deps.createAdminClient()
      // The two destinations are exclusive, so a save is a MOVE — destination write
      // plus source cleanup plus the state read, all inside one transaction
      // (`scan_move_saved_product`). A source row another surface owns is left
      // standing and is not a failure; the returned state reports what stands.
      const result = await deps.moveSavedProduct(
        client,
        ctx.userId,
        ctx.body.productId,
        ctx.body.kind,
      )
      if (result.outcome === "product_not_found") return scanFail("product_not_found", 404)
      if (result.outcome === "product_not_saveable") return scanFail("product_not_saveable", 409)

      return scanOk({
        ok: true,
        kind: ctx.body.kind,
        productId: ctx.body.productId,
        savedState: result.savedState,
      })
    },
  })

  const DELETE = createScanRoute<SaveBody>({
    route: "save",
    deps,
    parse: parseJsonBody(saveBodySchema),
    failureReason: "save_removal_failed",
    handler: async (ctx) => {
      const client = deps.createAdminClient()
      const result = await removeKind(client, ctx.userId, ctx.body.productId, ctx.body.kind)
      // The routine row belongs to Stage-3 / product intake: the scan sheet has no
      // authority to delete it, and reporting success would render as "removed" for a
      // row that is still there.
      if (result.outcome === "not_removable_here") return scanFail("not_removable_here", 409)
      // Not necessarily `null`: removing the Merkliste entry of a product the user also
      // owns via Stage-3 leaves a truthful "routine" state behind, so re-read it.
      const savedState = await deps.loadSavedState(client, ctx.userId, ctx.body.productId)
      return scanOk({
        ok: true,
        kind: ctx.body.kind,
        productId: ctx.body.productId,
        savedState,
      })
    },
  })

  return { POST, DELETE }
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
