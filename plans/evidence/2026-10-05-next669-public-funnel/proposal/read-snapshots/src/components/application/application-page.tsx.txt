"use client"

import type { MouseEvent } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  PersonalPlanStageEntrance,
  PersonalPlanViewTransition,
  type PersonalPlanTransitionDirection,
} from "@/components/personal-plan-journey"
import type { ApplicationDayTypeKey } from "@/lib/routines/personal-plan/application/contracts"

import { ApplicationDay } from "./application-day"
import { ApplicationOverview } from "./application-overview"
import { ApplicationState } from "./application-state"
import type { ApplicationDayView, ApplicationPageView } from "./application-types"

function sortDays(days: ApplicationDayView[]) {
  return [...days].sort((left, right) => left.sortOrder - right.sortOrder)
}

const APPLICATION_HISTORY_MARKER = "__chaarlieApplicationDay"

function shouldHandleLocalNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.currentTarget.target !== "_blank"
  )
}

function applicationDayFromPathname(
  pathname: string,
  days: ApplicationDayView[],
  basePath: string,
): ApplicationDayTypeKey | null | undefined {
  if (pathname === basePath || pathname === `${basePath}/`) return null
  const escapedBasePath = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = pathname.match(new RegExp(`^${escapedBasePath}/([^/]+)/?$`))
  if (!match) return undefined
  let dayType: ApplicationDayTypeKey
  try {
    dayType = decodeURIComponent(match[1]) as ApplicationDayTypeKey
  } catch {
    return undefined
  }
  return days.some((day) => day.dayType === dayType) ? dayType : undefined
}

function NoCompleteDayView({ restDay }: { restDay: ApplicationDayView }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
      <div className="mb-5 rounded-md border border-[var(--brand-plum-light)] bg-card p-4 shadow-[0_14px_38px_-32px_rgba(var(--brand-plum-rgb),0.7)]">
        <p className="type-overline mb-2 text-[var(--text-caption)]">Anwendung</p>
        <h1 className="type-h1 text-[var(--text-heading)]">
          Noch keine vollständige Anleitung verfügbar
        </h1>
        <p className="type-body-sm mt-2 max-w-2xl text-[var(--text-sub)]">
          Deine Routine bleibt unverändert. Für die vorhandenen Produkte fehlen noch ausreichend
          geprüfte Anwendungsschritte.
        </p>
        <Link
          href="/routine"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Zur Routine
        </Link>
      </div>
      <ApplicationOverview days={[restDay]} showHeader={false} />
    </section>
  )
}

export function ApplicationPage({
  view,
  internalComputeMs,
  navigationBasePath = "/anwendung",
  currentPathname,
}: {
  view: ApplicationPageView
  internalComputeMs?: number
  navigationBasePath?: string
  currentPathname?: string
}) {
  const days = useMemo(() => (view.state === "ready" ? sortDays(view.days) : []), [view])
  const initialDayType = view.state === "ready" ? (view.selectedDayType ?? null) : null
  const pathnameDayType =
    view.state === "ready" && currentPathname
      ? applicationDayFromPathname(currentPathname, days, navigationBasePath)
      : undefined
  // Next only mirrors history.pushState into usePathname once its root passive effect has
  // patched the history API — one effect phase after this tree is already interactive. A day
  // click landing in that window would otherwise change the URL without ever re-rendering, so
  // the local navigation handlers below record the selection here and it renders immediately.
  // The override stays authoritative until the router pathname next changes (reset during
  // render, not in an effect — an effect's initial invocation would revert an early click).
  const [localSelection, setLocalSelection] = useState<{
    dayType: ApplicationDayTypeKey | null
  } | null>(null)
  const [seenRouterPathname, setSeenRouterPathname] = useState(currentPathname)
  if (seenRouterPathname !== currentPathname) {
    setSeenRouterPathname(currentPathname)
    if (localSelection !== null) setLocalSelection(null)
  }
  const routerDayType = pathnameDayType === undefined ? initialDayType : pathnameDayType
  const selectedDayType =
    localSelection !== null && seenRouterPathname === currentPathname
      ? localSelection.dayType
      : routerDayType
  const [direction, setDirection] = useState<PersonalPlanTransitionDirection>(
    initialDayType ? "forward" : "reverse",
  )

  useEffect(() => {
    if (view.state !== "ready") return
    const handlePopState = () => {
      const nextDayType = applicationDayFromPathname(
        window.location.pathname,
        days,
        navigationBasePath,
      )
      if (nextDayType === undefined) return
      setDirection(nextDayType ? "forward" : "reverse")
      setLocalSelection({ dayType: nextDayType })
    }
    // Keep this listener registered from mount with stable deps: re-registering would move it
    // behind Next's popstate listener, whose synchronous traverse commit then removes the
    // pending listener mid-dispatch and skips it entirely.
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [days, navigationBasePath, view.state])

  const openDay = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, dayType: ApplicationDayTypeKey) => {
      if (!shouldHandleLocalNavigation(event)) return
      event.preventDefault()
      const href = `${navigationBasePath}/${dayType}`
      window.history.pushState({ [APPLICATION_HISTORY_MARKER]: dayType }, "", href)
      setDirection("forward")
      setLocalSelection({ dayType })
    },
    [navigationBasePath],
  )

  const openOverview = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!shouldHandleLocalNavigation(event)) return
      event.preventDefault()
      window.history.pushState({ [APPLICATION_HISTORY_MARKER]: null }, "", navigationBasePath)
      setDirection("reverse")
      setLocalSelection({ dayType: null })
    },
    [navigationBasePath],
  )

  let content
  if (view.state === "no_complete_day") {
    content = <NoCompleteDayView restDay={view.restDay} />
  } else if (view.state !== "ready") {
    content = <ApplicationState view={view} />
  } else {
    const selectedDay = days.find((day) => day.dayType === selectedDayType) ?? null
    const viewKey = selectedDay ? `day:${selectedDay.dayType}` : "overview"
    content = (
      <PersonalPlanStageEntrance destination="/anwendung">
        <PersonalPlanViewTransition viewKey={viewKey} direction={direction} variant="quiz">
          {selectedDay ? (
            <ApplicationDay
              day={selectedDay}
              overviewHref={navigationBasePath}
              onOpenOverview={openOverview}
            />
          ) : (
            <ApplicationOverview
              days={days}
              onOpenDay={openDay}
              navigationBasePath={navigationBasePath}
            />
          )}
        </PersonalPlanViewTransition>
      </PersonalPlanStageEntrance>
    )
  }

  return (
    <div
      className="personal-plan-cookie-clearance min-h-dvh bg-[var(--background)]"
      data-personal-plan-application-root="true"
      data-personal-plan-application-compute-ms={internalComputeMs}
      data-application-router-pathname={currentPathname}
    >
      {content}
    </div>
  )
}

export function RouteAwareApplicationPage(
  props: Omit<Parameters<typeof ApplicationPage>[0], "currentPathname">,
) {
  const pathname = usePathname()
  return <ApplicationPage {...props} currentPathname={pathname} />
}
