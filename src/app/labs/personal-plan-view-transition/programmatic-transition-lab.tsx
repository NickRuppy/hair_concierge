"use client"

import { useState } from "react"

import { PersonalPlanViewTransition } from "@/components/personal-plan-journey/view-transition"

export function ProgrammaticTransitionLab() {
  const [mounted, setMounted] = useState(true)
  const [viewKey, setViewKey] = useState<"overview" | "detail">("overview")
  const [outgoingScrollY, setOutgoingScrollY] = useState(0)

  const openView = (nextView: "overview" | "detail") => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })
    setOutgoingScrollY(window.scrollY)
    setViewKey(nextView)
  }

  return (
    <main
      data-programmatic-transition-lab="true"
      data-outgoing-scroll-y={outgoingScrollY}
      className="bg-background"
    >
      <button type="button" onClick={() => setMounted(false)}>
        Übergang entfernen
      </button>
      {mounted ? (
        <PersonalPlanViewTransition
          viewKey={viewKey}
          direction={viewKey === "detail" ? "forward" : "reverse"}
          variant="depth"
        >
          {viewKey === "overview" ? (
            <section className="min-h-[2400px] p-6">
              <h1 tabIndex={-1} data-personal-plan-transition-focus>
                Programmatische Übersicht
              </h1>
              <button type="button" onClick={() => openView("detail")}>
                Detail programmatisch öffnen
              </button>
            </section>
          ) : (
            <section className="min-h-[1200px] p-6">
              <h1 tabIndex={-1} data-personal-plan-transition-focus>
                Programmatisches Detail
              </h1>
              <button type="button" onClick={() => openView("overview")}>
                Übersicht programmatisch öffnen
              </button>
            </section>
          )}
        </PersonalPlanViewTransition>
      ) : null}
    </main>
  )
}
