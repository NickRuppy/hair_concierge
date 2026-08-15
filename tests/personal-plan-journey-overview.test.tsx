import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  PERSONAL_PLAN_JOURNEY_STAGES,
  PersonalPlanJourneyHeader,
  PersonalPlanJourneyOverview,
} from "../src/components/personal-plan-journey"

test("journey overview and progress header share the approved five-stage vocabulary", () => {
  const overview = renderToStaticMarkup(React.createElement(PersonalPlanJourneyOverview))
  const header = renderToStaticMarkup(
    React.createElement(PersonalPlanJourneyHeader, { currentStage: 1 }),
  )

  assert.deepEqual(
    PERSONAL_PLAN_JOURNEY_STAGES.map(({ headerLabel }) => headerLabel),
    ["Idealplan", "Feinschliff", "Produkte", "Routine", "Anwendung"],
  )

  for (const stage of PERSONAL_PLAN_JOURNEY_STAGES) {
    assert.match(overview, new RegExp(stage.title))
    assert.match(overview, new RegExp(stage.description))
    assert.match(header, new RegExp(stage.headerLabel))
  }

  assert.match(overview, /aria-current="step"/)
  assert.match(overview, /Für schönes, gesundes Haar\./)
  assert.doesNotMatch(overview, /<a|<button/)
  assert.doesNotMatch(header, /Bedarf|Verfeinerung/)
})
