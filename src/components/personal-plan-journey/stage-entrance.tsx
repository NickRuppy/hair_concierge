"use client"

import type { ReactNode } from "react"
import { useEffect, useRef } from "react"

import {
  consumePersonalPlanStageNavigation,
  type PersonalPlanStageDestination,
} from "@/lib/personal-plan/stage-navigation-intent"

export function PersonalPlanStageEntrance({
  destination,
  children,
}: {
  destination: PersonalPlanStageDestination
  children: ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const intentRef = useRef<{
    destination: PersonalPlanStageDestination
    shouldEnter: boolean
  } | null>(null)

  useEffect(() => {
    if (intentRef.current?.destination !== destination) {
      intentRef.current = {
        destination,
        shouldEnter: consumePersonalPlanStageNavigation(destination),
      }
    }
    if (!intentRef.current.shouldEnter) return
    const root = rootRef.current
    if (!root) return
    root.classList.add("personal-plan-stage-target-enter")
    root.dataset.personalPlanStageEntrance = destination
    const timer = window.setTimeout(() => {
      root.classList.remove("personal-plan-stage-target-enter")
      delete root.dataset.personalPlanStageEntrance
    }, 200)
    return () => {
      window.clearTimeout(timer)
      root.classList.remove("personal-plan-stage-target-enter")
      delete root.dataset.personalPlanStageEntrance
    }
  }, [destination])

  return (
    <div className="overflow-x-clip">
      <div ref={rootRef}>{children}</div>
    </div>
  )
}
