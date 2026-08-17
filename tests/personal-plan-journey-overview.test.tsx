import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  PERSONAL_PLAN_JOURNEY_STAGES,
  PersonalPlanChapterTransition,
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

test("journey overview distinguishes completed, current, and future chapters", () => {
  const overview = renderToStaticMarkup(
    React.createElement(PersonalPlanJourneyOverview, { currentStage: 4 }),
  )

  assert.equal((overview.match(/data-stage-state="complete"/g) ?? []).length, 3)
  assert.equal((overview.match(/data-stage-state="current"/g) ?? []).length, 1)
  assert.equal((overview.match(/data-stage-state="future"/g) ?? []).length, 1)
  assert.match(overview, /aria-current="step"/)
  assert.equal((overview.match(/>✓</g) ?? []).length, 3)
})

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

test("shared chapter transition renders the approved stage-specific copy and one primary action", () => {
  const chapter = renderToStaticMarkup(
    React.createElement(PersonalPlanChapterTransition, {
      currentStage: 5,
      onAction: () => {},
    }),
  )

  assert.match(chapter, /Deine Routine steht\./)
  assert.match(chapter, /Jetzt zeigen wir dir, wie du alles richtig anwendest\./)
  assert.match(chapter, /Anwendung ansehen/)
  assert.equal((chapter.match(/<button/g) ?? []).length, 1)
  assert.match(chapter, /data-personal-plan-chapter="5"/)
  // Variante D (2026-08-17): the page scrolls naturally under a sticky header
  // instead of squeezing all five cards into one locked viewport.
  assert.match(chapter, /min-h-dvh/)
  assert.doesNotMatch(chapter, /overflow-hidden/)
  assert.doesNotMatch(chapter, /max-height:519px/)
})
