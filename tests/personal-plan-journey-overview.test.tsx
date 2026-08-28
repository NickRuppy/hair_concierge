import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  PERSONAL_PLAN_CHAPTERS,
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
    ["Plan", "Feinschliff", "Produkte", "Routine", "Anwendung"],
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

test("journey header's 5-stage bar can retire while Back and the wordmark stay (Task 2.7)", () => {
  const fullHeader = renderToStaticMarkup(
    React.createElement(PersonalPlanJourneyHeader, { currentStage: 2 }),
  )
  const compactHeader = renderToStaticMarkup(
    React.createElement(PersonalPlanJourneyHeader, {
      currentStage: 2,
      onBack: () => {},
      showStageProgress: false,
    }),
  )

  assert.match(fullHeader, /role="progressbar"/)
  assert.match(fullHeader, /Personal-Plan-Stufen/)

  assert.doesNotMatch(compactHeader, /role="progressbar"/)
  assert.doesNotMatch(compactHeader, /Personal-Plan-Stufen/)
  assert.match(compactHeader, />chaarlie</)
  assert.match(compactHeader, /aria-label="Zurück"/)
  // The stage marker survives for CSS/analytics hooks even without the bar.
  assert.match(compactHeader, /data-personal-plan-stage="2"/)
})

test("shared chapter transition renders the approved stage-specific copy and one primary action", () => {
  const chapter = renderToStaticMarkup(
    React.createElement(PersonalPlanChapterTransition, {
      currentStage: 4,
      onAction: () => {},
    }),
  )

  assert.match(chapter, /Deine Produktauswahl steht\./)
  assert.match(chapter, /Jetzt ordnen wir alles zu deiner persönlichen Routine\./)
  assert.match(chapter, /Routine ansehen/)
  assert.equal((chapter.match(/<button/g) ?? []).length, 1)
  assert.match(chapter, /data-personal-plan-chapter="4"/)
  // Variante D (2026-08-17): the page scrolls naturally under a sticky header
  // instead of squeezing all five cards into one locked viewport.
  assert.match(chapter, /min-h-dvh/)
  assert.doesNotMatch(chapter, /overflow-hidden/)
  assert.doesNotMatch(chapter, /max-height:519px/)
})

test("only stages 3 and 4 still have chapter screens", () => {
  // Field test 26.08.2026 retired stage 5's chapter (the Bottom-Nav tab owns
  // Anwendung). Relic removal 28.08.2026 retired chapters 1 and 2: the
  // /plan-bereit arrival screen replaced chapter 1, and every Stage-2 entry is
  // a module entry (or the legacy linear question flow) with no invitation
  // chapter. The journey OVERVIEW keeps its five stages — only chapters go.
  assert.equal(PERSONAL_PLAN_CHAPTERS.length, 2)
  assert.deepEqual(
    PERSONAL_PLAN_CHAPTERS.map((entry) => entry.stage),
    [3, 4],
  )
  assert.doesNotMatch(JSON.stringify(PERSONAL_PLAN_CHAPTERS), /Deine Routine steht/)
  assert.doesNotMatch(JSON.stringify(PERSONAL_PLAN_CHAPTERS), /Anwendung ansehen/)
  assert.doesNotMatch(JSON.stringify(PERSONAL_PLAN_CHAPTERS), /Wir haben deinen Plan erstellt/)
  assert.doesNotMatch(JSON.stringify(PERSONAL_PLAN_CHAPTERS), /Feinschliff starten/)
  assert.equal(PERSONAL_PLAN_JOURNEY_STAGES.length, 5)
})
