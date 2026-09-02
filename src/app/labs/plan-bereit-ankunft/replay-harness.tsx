"use client"

import { useEffect, useState } from "react"

import { PLAN_OPENING_BEAT_MS } from "@/app/plan-bereit/opening-beat"
import { PlanBereitArrival } from "@/app/plan-bereit/plan-ready-arrival"

/**
 * Dev-only replay of the two-state opening choreography: mounts in the loading
 * phase and morphs to ready after the production beat, with a replay control.
 */
export function PlanBereitOpeningReplay() {
  const [run, setRun] = useState({ id: 0, ready: false })
  const runId = run.id
  const ready = run.ready

  useEffect(() => {
    const timer = setTimeout(
      () => setRun((current) => (current.id === runId ? { id: runId, ready: true } : current)),
      PLAN_OPENING_BEAT_MS,
    )
    return () => clearTimeout(timer)
  }, [runId])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setRun((current) => ({ id: current.id + 1, ready: false }))}
        className="fixed right-4 top-4 z-50 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm"
        data-plan-opening-replay="true"
      >
        Replay
      </button>
      <PlanBereitArrival
        key={runId}
        actionHref="/plan-start"
        phase={ready ? "ready" : "loading"}
        interactive={ready}
      />
    </div>
  )
}
