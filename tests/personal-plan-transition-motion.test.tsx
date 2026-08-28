import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ApplicationPage } from "../src/components/application/application-page"
import type { ApplicationDayView } from "../src/components/application/application-types"
import {
  PlanStartFlow,
  performPersonalPlanRoutineHandoff,
} from "../src/components/personal-plan-start/plan-start-flow"
import { RefinementFlow } from "../src/components/personal-plan-refinement/refinement-flow"
import { createStage2RefinementSession } from "../src/lib/personal-plan/refinement/session"
import { acquireManualScrollRestoration } from "../src/components/personal-plan-journey/view-transition"
import {
  PERSONAL_PLAN_STAGE_NAVIGATION_TTL_MS,
  consumePersonalPlanStageNavigationIntent,
  writePersonalPlanStageNavigationIntent,
} from "../src/lib/personal-plan/stage-navigation-intent"

const days: ApplicationDayView[] = [
  {
    dayType: "wash_day",
    sortOrder: 10,
    labelDe: "Waschtag",
    summaryDe: "Waschen und pflegen.",
    cadenceDe: "Nach deinem Rhythmus",
    steps: [],
    isPartial: false,
    provisionalProductCount: 0,
    unresolvedProductCount: 0,
    shelf: [],
  },
  {
    dayType: "rest_day",
    sortOrder: 80,
    labelDe: "Pausentag",
    summaryDe: "Heute ist keine Anwendung nötig.",
    cadenceDe: null,
    steps: [],
    isPartial: false,
    provisionalProductCount: 0,
    unresolvedProductCount: 0,
    shelf: [],
  },
]

test("Anwendung has no journey header — Bottom-Nav carries orientation, the day view keeps a quiet in-page Back (Task 2.7 + fix round 1 I-2)", () => {
  const overview = renderToStaticMarkup(<ApplicationPage view={{ state: "ready", days }} />)
  assert.match(overview, /data-personal-plan-view-transition="quiz"/)
  assert.match(overview, /data-application-navigation="day"/)
  assert.match(overview, /href="\/anwendung\/wash_day"/)
  assert.doesNotMatch(overview, /data-personal-plan-journey-header/)

  const detail = renderToStaticMarkup(
    <ApplicationPage view={{ state: "ready", days, selectedDayType: "wash_day" }} />,
  )
  assert.match(detail, /data-personal-plan-view-transition="quiz"/)
  assert.doesNotMatch(detail, /data-personal-plan-journey-header/)
  assert.doesNotMatch(detail, /role="progressbar"/)
  assert.doesNotMatch(detail, /data-application-navigation="overview"/)
  // I-2: a quiet in-page Back replaces the retired header's "Alle Tage" link.
  assert.match(detail, /<a class="[^"]*" href="\/anwendung">← Anwendung<\/a>/)
})

test("non-ready Anwendung surfaces never claim a successful view transition", () => {
  const unavailable = renderToStaticMarkup(
    <ApplicationPage view={{ state: "day_unavailable", overviewHref: "/anwendung" }} />,
  )
  assert.doesNotMatch(unavailable, /data-personal-plan-view-transition=/)
})

test("malformed Anwendung day segments fall back without throwing during render", () => {
  const html = renderToStaticMarkup(
    <ApplicationPage view={{ state: "ready", days }} currentPathname="/anwendung/%E0%A4%A" />,
  )

  assert.match(html, /application-overview-title/)
  assert.doesNotMatch(html, /application-day-title/)
})

test("Bedarfsplan keeps its Journey header outside a bounded depth surface", () => {
  const screen = {
    overline: "Dein Plan",
    title: "Deine Basis",
    lead: "Das ist dein Ausgangspunkt.",
    sectionTitle: "Basis",
    countLabel: "0 Bausteine",
    cards: [],
  }
  const html = renderToStaticMarkup(
    <PlanStartFlow
      state="ready"
      plan={{
        basis: { ...screen, kind: "basis", progress: 50 },
        optional: { ...screen, kind: "optional", title: "Optional", progress: 100 },
      }}
    />,
  )

  assert.equal(html.match(/data-personal-plan-stage="1"/g)?.length, 1)
  assert.match(html, /data-personal-plan-view-transition="quiz"/)
  assert.match(html, /data-plan-start-screen="basis"/)
})

test("Feinschliff keeps its Journey header outside the ordered-question depth surface", () => {
  const session = createStage2RefinementSession({
    pathVersion: "transition-test",
    triggerContext: {
      relevantCategories: ["shampoo"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
  })
  const html = renderToStaticMarkup(
    <RefinementFlow gateway={{} as never} initialSession={session} directEntry />,
  )

  assert.equal(html.match(/data-personal-plan-stage="2"/g)?.length, 1)
  assert.equal(html.match(/personal-plan-cookie-clearance/g)?.length, 1)
  assert.match(html, /min-h-\[calc\(100dvh-71px\)\]/)
  assert.match(html, /data-personal-plan-view-transition="quiz"/)
  assert.match(html, /data-personal-plan-transition-focus/)
  // Task 2.7: Stage 2 keeps minimal chrome (Back + wordmark), no 5-stage bar.
  assert.doesNotMatch(html, /role="progressbar"/)
})

test("stage navigation intent is destination-bound, single-use, and time-bounded", () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }

  assert.equal(writePersonalPlanStageNavigationIntent(storage, "/routine", 1_000), true)
  assert.equal(consumePersonalPlanStageNavigationIntent(storage, "/routine", 1_001), true)
  assert.equal(consumePersonalPlanStageNavigationIntent(storage, "/routine", 1_002), false)

  writePersonalPlanStageNavigationIntent(storage, "/routine", 2_000)
  assert.equal(consumePersonalPlanStageNavigationIntent(storage, "/anwendung", 2_001), false)
  assert.equal(consumePersonalPlanStageNavigationIntent(storage, "/routine", 2_002), false)

  writePersonalPlanStageNavigationIntent(storage, "/routine", 3_000)
  assert.equal(
    consumePersonalPlanStageNavigationIntent(
      storage,
      "/routine",
      3_000 + PERSONAL_PLAN_STAGE_NAVIGATION_TTL_MS + 1,
    ),
    false,
  )
})

test("manual scroll restoration ownership is nested, idempotent, and cleanup-safe", () => {
  const history = { scrollRestoration: "auto" as History["scrollRestoration"] }
  const releaseFirst = acquireManualScrollRestoration(history)
  const releaseSecond = acquireManualScrollRestoration(history)

  assert.equal(history.scrollRestoration, "manual")
  releaseFirst()
  releaseFirst()
  assert.equal(history.scrollRestoration, "manual")
  releaseSecond()
  assert.equal(history.scrollRestoration, "auto")

  history.scrollRestoration = "manual"
  const releaseExistingManual = acquireManualScrollRestoration(history)
  releaseExistingManual()
  assert.equal(history.scrollRestoration, "manual")
})

test("stage navigation intent fails closed when storage is unavailable", () => {
  const storage = {
    getItem: () => {
      throw new Error("blocked")
    },
    setItem: () => {
      throw new Error("blocked")
    },
    removeItem: () => {
      throw new Error("blocked")
    },
  }
  assert.equal(writePersonalPlanStageNavigationIntent(storage, "/plan-start"), false)
  assert.equal(consumePersonalPlanStageNavigationIntent(storage, "/plan-start"), false)
})

test("successful Stage 3 handoff marks Routine before invoking client route replacement", () => {
  const calls: string[] = []
  performPersonalPlanRoutineHandoff({ next: { href: "/routine" } } as never, {
    markNavigation: (destination) => calls.push(`mark:${destination}`),
    replaceRoute: (href) => calls.push(`replace:${href}`),
  })

  assert.deepEqual(calls, ["mark:/routine", "replace:/routine"])
})

test("automatic Stage 3 bootstrap keeps the meaningful Feinschliff bridge visible", () => {
  const session = createStage2RefinementSession({
    pathVersion: "transition-complete",
    triggerContext: {
      relevantCategories: ["shampoo"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
    answers: {
      currentProductCategories: [],
      wetWashFrequency: "weekly_1x",
      towel: { material: "no_towel" },
      dryingRoutes: [],
      additionalHeatTools: [],
      nightProtection: [],
    },
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ],
    completedHandoff: { refinedVersionId: "refined-transition", nextHref: "/plan-start" },
    status: "complete",
  })
  const html = renderToStaticMarkup(
    <RefinementFlow
      gateway={{} as never}
      initialSession={session}
      onHandoff={() => new Promise(() => {})}
      autoHandoff
      directEntry
    />,
  )

  assert.match(html, /Jetzt gleichen wir deine Produkte ab\./)
  assert.match(html, /data-personal-plan-chapter="3"/)
  assert.match(html, /Produkte erfassen/)
  assert.doesNotMatch(html, /Wir laden deinen Stand\./)
})
