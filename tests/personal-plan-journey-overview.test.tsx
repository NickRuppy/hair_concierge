import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { PersonalPlanJourneyHeader } from "../src/components/personal-plan-journey"

test("shared journey Back uses the approved 48px target for callback and link navigation", () => {
  const callbackHeader = renderToStaticMarkup(
    React.createElement(PersonalPlanJourneyHeader, {
      currentStage: 3,
      onBack: () => {},
      backLabel: "Zurück zum Feinschliff",
      backDisabled: true,
    }),
  )
  const linkHeader = renderToStaticMarkup(
    React.createElement(PersonalPlanJourneyHeader, {
      currentStage: 5,
      backHref: "/routine",
      backLabel: "Zur Routine",
    }),
  )

  assert.match(callbackHeader, /aria-label="Zurück zum Feinschliff"/)
  assert.match(callbackHeader, /disabled=""/)
  assert.match(callbackHeader, /h-12 w-12/)
  assert.match(callbackHeader, /rounded-xl/)
  assert.match(callbackHeader, /h-6 w-6/)
  assert.match(callbackHeader, /brand-plum-ice/)
  assert.match(linkHeader, /href="\/routine"/)
  assert.match(linkHeader, /aria-label="Zur Routine"/)
  assert.equal((linkHeader.match(/<a/g) ?? []).length, 1)
})

test("journey header retains Back, save state, wordmark, and its stage hook without the retired five-stage bar", () => {
  const header = renderToStaticMarkup(
    React.createElement(PersonalPlanJourneyHeader, {
      currentStage: 2,
      onBack: () => {},
      saveStatus: "saved",
    }),
  )

  assert.doesNotMatch(header, /Personal-Plan-Stufen/)
  assert.doesNotMatch(header, /Stufen im Personal Plan/)
  assert.match(header, />chaarlie</)
  assert.match(header, /aria-label="Zurück"/)
  assert.match(header, />Gespeichert</)
  assert.match(header, /data-personal-plan-stage="2"/)
})

test("journey header renders the retained module progress as X von 4", () => {
  const header = renderToStaticMarkup(
    React.createElement(PersonalPlanJourneyHeader, {
      currentStage: 2,
      moduleProgress: { completedSteps: 2, totalSteps: 4 },
    }),
  )

  assert.match(header, /aria-label="Fortschritt in deinem Plan"/)
  assert.match(header, /aria-valuenow="2"/)
  assert.match(header, /aria-valuemax="4"/)
  assert.match(header, /2 von 4/)
})
