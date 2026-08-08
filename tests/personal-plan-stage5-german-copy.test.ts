import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ApplicationPage } from "../src/components/application/application-page"
import type { ApplicationDayView } from "../src/components/application/application-types"

test("Anwendung view owns German day labels, summaries, and sort order", () => {
  const days: ApplicationDayView[] = [
    {
      dayType: "rest_day",
      sortOrder: 80,
      labelDe: "Pausentag",
      summaryDe: "An einem Pausentag ist keine Anwendung nötig.",
      cadenceDe: null,
      steps: [],
    },
    {
      dayType: "wash_day",
      sortOrder: 10,
      labelDe: "Waschtag aus der Datenbank",
      summaryDe: "Reihenfolge aus dem View.",
      cadenceDe: "Nach deinem Rhythmus",
      steps: [],
    },
  ]

  const html = renderToStaticMarkup(
    createElement(ApplicationPage, { view: { state: "ready", days } }),
  )

  assert.ok(html.indexOf("Waschtag aus der Datenbank") < html.indexOf("Pausentag"))
  assert.match(html, /Reihenfolge aus dem View/)
})

test("no-complete-day state retains visible Pausentag plus recovery explanation", () => {
  const restDay: ApplicationDayView = {
    dayType: "rest_day",
    sortOrder: 80,
    labelDe: "Pausentag",
    summaryDe: "An einem Pausentag ist keine Anwendung nötig.",
    cadenceDe: null,
    steps: [],
  }

  const html = renderToStaticMarkup(
    createElement(ApplicationPage, { view: { state: "no_complete_day", restDay } }),
  )

  assert.match(html, /Noch keine vollständige Anleitung verfügbar/)
  assert.match(html, /Pausentag/)
  assert.match(html, /An einem Pausentag ist keine Anwendung nötig/)
  assert.match(html, /href="\/routine"/)
})

test("unavailable retry refreshes the server route instead of linking to the same page", () => {
  const source = readFileSync("src/components/application/application-state.tsx", "utf8")

  assert.match(source, /router\.refresh\(\)/)
  assert.match(source, /actionHref: null/)
  assert.doesNotMatch(source, /actionHref: "\/anwendung"/)
})

test("customer-facing Anwendung source avoids calendar, tracking, and completion semantics", () => {
  const files = [
    "src/components/application/application-page.tsx",
    "src/components/application/application-state.tsx",
  ]
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n")

  assert.doesNotMatch(
    source,
    /Kalender|Wochentag|heute|morgen|abhaken|erledigt|Fortschritt|Tracking/,
  )
  assert.doesNotMatch(source, /Finish/)
})
