import { NextResponse } from "next/server"

import { loadModuleBannerDismissals } from "@/lib/personal-plan/lifecycle/repository"
import { loadRefinementStatusSource } from "@/lib/personal-plan/persistence/refinement-status-read"
import { buildRefinementStatusResponse } from "@/lib/personal-plan/refinement/refinement-status"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * Read-only module-status contract (Task 1.7): per-module open/complete state
 * (`products`/`habits`, user-provenance-derived), coarse "X von 4" progress,
 * the persisted Modul-1 -> Stage-3 handoff marker, and the refinement banner's
 * dismissal state. PR 2's Routine banner and Profil tab are the consumers.
 *
 * Sibling route of `refinement-presentation` (same client shape, same
 * unauthenticated/error conventions) rather than an extension of it: that
 * route's response (answers + routineProducts, for the completed-draft-only
 * Profil summary) and this one's (per-module status + progress + banner, for
 * an in-progress draft too) do not overlap enough to share one response
 * shape without a mode param branching the whole body — a second route
 * keeps both contracts simple and leaves the existing consumer untouched.
 */

type Query = {
  select: (columns: string) => Query
  eq: (column: string, value: unknown) => Query
  order: (column: string, options: { ascending: boolean }) => Query
  limit: (count: number) => Query
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>
  upsert: (
    row: Record<string, unknown>,
    options?: { onConflict?: string },
  ) => PromiseLike<{ error: unknown }>
}
export type RefinementStatusRouteReadClient = { from: (table: string) => Query }

export type RefinementStatusRouteDeps = {
  getUserId: () => Promise<string | null>
  client: () => RefinementStatusRouteReadClient
}

const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export function createRefinementStatusRouteHandlers(deps: RefinementStatusRouteDeps) {
  return {
    async GET() {
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      try {
        const client = deps.client()
        const source = await loadRefinementStatusSource(client, userId)
        if (source.status === "no_personal_plan") {
          return response({ error: "no_personal_plan" }, 404)
        }

        const bannerDismissals = await loadModuleBannerDismissals(client, userId)

        return response(
          buildRefinementStatusResponse({
            moduleStatusInput: {
              triggerContext: source.triggerContext,
              answers: source.answers,
              completedQuestionIds: source.completedQuestionIds,
              answerProvenance: source.answerProvenance,
            },
            moduleProjections: source.moduleProjections,
            bannerDismissals,
          }),
        )
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
  }
}

const handlers = createRefinementStatusRouteHandlers({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  client: () => createAdminClient() as unknown as RefinementStatusRouteReadClient,
})

export const GET = () => handlers.GET()
