import "server-only"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  loadAdminProductReviewDetail,
  loadAdminProductReviewQueue,
} from "./admin-review-repository"

const NO_STORE = { "Cache-Control": "private, no-store" }
export const productReviewId = z.string().uuid()
const DEFAULTS = {
  requireAdmin,
  createAdminClient,
  loadAdminProductReviewQueue,
  loadAdminProductReviewDetail,
}

/** Shared transport guard: authentication always precedes service-role creation. */
export function createProductReviewReadHandlers(overrides: Partial<typeof DEFAULTS> = {}) {
  const deps = { ...DEFAULTS, ...overrides }
  async function read(submissionId?: string) {
    try {
      const auth = await deps.requireAdmin()
      if ("response" in auth) {
        auth.response.headers.set("Cache-Control", "private, no-store")
        return auth.response
      }
      if (submissionId !== undefined && !productReviewId.safeParse(submissionId).success)
        return NextResponse.json(
          { error: "Produktprüfung nicht gefunden." },
          { status: 404, headers: NO_STORE },
        )
      const admin = deps.createAdminClient()
      const data =
        submissionId === undefined
          ? { entries: await deps.loadAdminProductReviewQueue(admin) }
          : await deps.loadAdminProductReviewDetail(admin, submissionId)
      if (!data)
        return NextResponse.json(
          { error: "Produktprüfung nicht gefunden." },
          { status: 404, headers: NO_STORE },
        )
      return NextResponse.json(data, { headers: NO_STORE })
    } catch {
      return NextResponse.json(
        { error: "Die Produktprüfung konnte nicht geladen werden. Bitte versuche es erneut." },
        { status: 503, headers: NO_STORE },
      )
    }
  }
  return {
    queue: () => read(),
    detail: (_request: Request, context: { params: Promise<{ submissionId: string }> }) =>
      context.params.then(({ submissionId }) => read(submissionId)),
  }
}
