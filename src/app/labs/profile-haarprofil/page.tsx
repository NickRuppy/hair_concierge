import { notFound } from "next/navigation"

import { HairProfileSection } from "@/components/profile/hair-profile-section"

import { HAARPROFIL_LAB_SCENARIOS } from "./scenarios"

/**
 * Dev-only preview of the Profil tab's „Dein Haarprofil" section (Task 2.5) in
 * every state the mockup defines, with and without the Hair Tools module (four
 * steps with the rollout off, five with it on). The real `/profile` surface
 * needs an authenticated plan owner, so this is where the section is checked
 * live against the signed-off mockup — same idiom as `labs/profile-reactivation`.
 */

export default function ProfileHairProfileLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-8 font-[family-name:var(--font-display)] text-3xl font-medium text-[var(--text-heading)]">
        Labs · Haarprofil-Sektion
      </h1>
      <div className="grid gap-10 md:grid-cols-2">
        {HAARPROFIL_LAB_SCENARIOS.map((scenario) => (
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
