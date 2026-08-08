import { Header } from "@/components/layout/header"
import { PersonalPlanRoutineClient } from "@/components/routine/personal-plan"
import { RoutinePageClient } from "@/components/routine/routine-page-client"
import { loadPersonalPlanRoutineView } from "@/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "@/lib/personal-plan/routine/repository"
import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export type RoutinePageResolverDeps = {
  getUserId: () => Promise<string | null>
  readView: (input: {
    userId: string
    enabled: boolean
  }) => ReturnType<typeof loadPersonalPlanRoutineView>
  stage4Enabled: () => boolean
}

export async function resolveRoutinePage(deps: RoutinePageResolverDeps) {
  const userId = await deps.getUserId()
  if (!userId) return { kind: "legacy" as const }

  const enabled = deps.stage4Enabled()
  try {
    const view = await deps.readView({ userId, enabled })
    return view.status === "no_personal_plan"
      ? { kind: "legacy" as const }
      : { kind: "personal_plan" as const, view, enabled }
  } catch {
    // The legacy Routine is not a safe substitute once a Personal Plan exists.
    // Preserve the scoped recovery state instead of silently presenting it as confirmed.
    return { kind: "unavailable" as const }
  }
}

const defaultDeps: RoutinePageResolverDeps = {
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  readView: ({ userId, enabled }) =>
    loadPersonalPlanRoutineView({
      client: createAdminClient() as unknown as PersonalPlanRoutineReadClient,
      userId,
      enabled,
    }),
  stage4Enabled: () => isPersonalPlanAppV1Enabled() && isPersonalPlanStage4Enabled(),
}

export default async function RoutinePage() {
  const resolved = await resolveRoutinePage(defaultDeps)
  if (resolved.kind === "legacy") return <RoutinePageClient />

  if (resolved.kind === "unavailable") {
    return (
      <>
        <Header />
        <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
          <section aria-live="polite" className="space-y-3 rounded-[8px] border border-border p-5">
            <h1 className="text-xl font-semibold">Deine Routine ist gerade nicht verfügbar</h1>
            <p className="text-sm text-muted-foreground">
              Bitte lade diese Seite erneut. Deine bestätigte Routine bleibt unverändert.
            </p>
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <PersonalPlanRoutineClient initialView={resolved.view} enabled={resolved.enabled} />
    </>
  )
}
