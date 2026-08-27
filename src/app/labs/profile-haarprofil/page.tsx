import { notFound } from "next/navigation"

import { HairProfileSection } from "@/components/profile/hair-profile-section"
import { buildHairProfileSection } from "@/lib/personal-plan/refinement/hair-profile-section"
import type { RefinementStatusResponse } from "@/lib/personal-plan/refinement/refinement-status"

/**
 * Dev-only preview of the Profil tab's „Dein Haarprofil" section (Task 2.5) in
 * every state the mockup defines. The real `/profile` surface needs an
 * authenticated plan owner, so this is where the section is checked live
 * against the signed-off mockup — same idiom as `labs/profile-reactivation`.
 */

function statusResponse(
  products: "open" | "complete",
  habits: "open" | "complete",
): RefinementStatusResponse {
  const completedModules = [products, habits].filter((entry) => entry === "complete").length
  return {
    modules: [
      { module: "products", status: products, openQuestionCount: products === "open" ? 2 : 0 },
      { module: "habits", status: habits, openQuestionCount: habits === "open" ? 4 : 0 },
    ],
    progress: { completedSteps: 2 + completedModules, totalSteps: 4 },
    module1HandedOff: products === "complete",
    banner: { visible: false, module: null, dismissed: false },
  }
}

const SCENARIOS = [
  {
    title: "Frisch akzeptiert · 2 von 4",
    view: buildHairProfileSection({ status: statusResponse("open", "open") }),
  },
  {
    title: "Deferred-Kohorte · 2 von 4 mit Freischalt-Hinweis",
    view: buildHairProfileSection({
      status: statusResponse("open", "open"),
      deferredRolesPendingRefinement: true,
    }),
  },
  {
    title: "Produkte fertig · 3 von 4",
    view: buildHairProfileSection({ status: statusResponse("complete", "open") }),
  },
  {
    title: "Alles fertig · 4 von 4",
    view: buildHairProfileSection({ status: statusResponse("complete", "complete") }),
  },
]

export default function ProfileHairProfileLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-8 font-[family-name:var(--font-display)] text-3xl font-medium text-[var(--text-heading)]">
        Labs · Haarprofil-Sektion
      </h1>
      <div className="grid gap-10 md:grid-cols-2">
        {SCENARIOS.map((scenario) => (
          <div key={scenario.title}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {scenario.title}
            </p>
            <HairProfileSection view={scenario.view} />
          </div>
        ))}
      </div>
    </main>
  )
}
