import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ApplicationDay } from "../src/components/application/application-day"
import type { ApplicationDayView } from "../src/components/application/application-types"

function emptyDay(overrides: Partial<ApplicationDayView>): ApplicationDayView {
  return {
    dayType: "rest_day",
    sortOrder: 1,
    labelDe: "Pausentag",
    summaryDe: "Heute braucht dein Haar nichts.",
    cadenceDe: null,
    steps: [],
    isPartial: false,
    provisionalProductCount: 0,
    unresolvedProductCount: 0,
    shelf: [],
    ...overrides,
  }
}

test("the rest day keeps its Pausentag empty-state copy", () => {
  const html = renderToStaticMarkup(<ApplicationDay day={emptyDay({})} overviewHref="/anwendung" />)
  assert.match(html, /An einem Pausentag ist keine Anwendung nötig\./)
})

test("a non-rest day with no steps must not claim to be a Pausentag", () => {
  // The compiler guarantees non-rest days never compile empty (see
  // "no non-rest day ever compiles with an empty outer sequence"), but the view
  // contract permits it — the fallback copy must not contradict the day label.
  const html = renderToStaticMarkup(
    <ApplicationDay
      day={emptyDay({
        dayType: "intensive_care_day",
        labelDe: "Intensivpflegetag",
        summaryDe: "Deine vorbereitete Anleitung für diesen Tag.",
      })}
      overviewHref="/anwendung"
    />,
  )
  assert.doesNotMatch(html, /Pausentag/)
  assert.match(html, /Für diesen Tag liegt gerade keine Anleitung vor\./)
})
