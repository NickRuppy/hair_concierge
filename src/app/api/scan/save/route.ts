import { NextResponse } from "next/server"
import { z } from "zod"

import {
  removeScanRoutineProduct,
  removeScanWishlistProduct,
  saveScanRoutineProduct,
  saveScanWishlistProduct,
} from "@/lib/scan/saved-state"
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
  createAdminClient: typeof createAdminClient
  saveWishlist: typeof saveScanWishlistProduct
  removeWishlist: typeof removeScanWishlistProduct
  saveRoutine: typeof saveScanRoutineProduct
  removeRoutine: typeof removeScanRoutineProduct
}

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } })

export function createScanSaveRouteHandlers(deps: ScanSaveRouteDeps) {
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

  return {
    async POST(request: Request) {
      const userId = await deps.getUserId()
      if (!userId) return fail("unauthorized", 401)

      const parsed = await readBody(request)
      if (!parsed) return fail("invalid_request", 400)

      try {
        const client = deps.createAdminClient()
        if (parsed.kind === "merkliste") {
          await deps.saveWishlist(client, userId, parsed.productId)
        } else {
          const result = await deps.saveRoutine(client, userId, parsed.productId)
          if (result.outcome === "product_not_found") return fail("product_not_found", 404)
        }
        return NextResponse.json(
          { ok: true, kind: parsed.kind, productId: parsed.productId },
          { headers: { "Cache-Control": "no-store" } },
        )
      } catch (error) {
        console.error("[scan] save failed", error)
        return fail("temporarily_unavailable", 503)
      }
    },

    async DELETE(request: Request) {
      const userId = await deps.getUserId()
      if (!userId) return fail("unauthorized", 401)

      const parsed = await readBody(request)
      if (!parsed) return fail("invalid_request", 400)

      try {
        const client = deps.createAdminClient()
        if (parsed.kind === "merkliste") {
          await deps.removeWishlist(client, userId, parsed.productId)
        } else {
          await deps.removeRoutine(client, userId, parsed.productId)
        }
        return NextResponse.json(
          { ok: true, kind: parsed.kind, productId: parsed.productId },
          { headers: { "Cache-Control": "no-store" } },
        )
      } catch (error) {
        console.error("[scan] save removal failed", error)
        return fail("temporarily_unavailable", 503)
      }
    },
  }
}

const handlers = createScanSaveRouteHandlers({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  createAdminClient,
  saveWishlist: saveScanWishlistProduct,
  removeWishlist: removeScanWishlistProduct,
  saveRoutine: saveScanRoutineProduct,
  removeRoutine: removeScanRoutineProduct,
})

export const POST = handlers.POST
export const DELETE = handlers.DELETE
