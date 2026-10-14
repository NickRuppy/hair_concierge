import assert from "node:assert/strict"
import test from "node:test"

import type { DiscoveryQuizAnswers } from "../src/lib/discovery/quiz-answers"
import { runsheetProfileStrip } from "../src/lib/discovery/runsheet/profile-strip"

/**
 * Cockpit call-ready E1: her profile at a glance, at the top of the page — the facts that
 * decide the plan, without opening „Alle Antworten" (Nomi's case as the fixture).
 */

const nomi: DiscoveryQuizAnswers = {
  status: "ready",
  kind: "personal_plan",
  concerns: [],
  mainConcern: null,
  groups: [
    {
      title: "Haar",
      rows: [
        { question: "Struktur?", answers: [{ label: "Glatt" }] },
        { question: "Dicke?", answers: [{ label: "Fein" }] },
        { question: "Elastizität?", answers: [{ label: "Reißt sofort" }] },
        { question: "Nicht beantwortet?", answers: [] },
      ],
    },
    {
      title: "Kopfhaut",
      rows: [
        {
          question: "Kopfhaut?",
          answers: [{ label: "Eher trocken" }, { label: "Trockene Schuppen" }],
        },
      ],
    },
    {
      title: "Behandlung",
      rows: [{ question: "Chemisch?", answers: [{ label: "Blondiert / aufgehellt" }] }],
    },
    {
      title: "Probleme",
      rows: [
        {
          question: "Probleme?",
          answers: [
            { label: "Wenig Glanz" },
            { label: "Mein Haar wirkt insgesamt strapaziert oder geschädigt", main: true },
            { label: "Mein Haar wirkt schnell platt oder beschwert" },
          ],
        },
      ],
    },
    { title: "Ziele", rows: [{ question: "Ziele?", answers: [{ label: "Mehr Glanz" }] }] },
  ],
}

test("her profile in five rows: hair (with treatment), scalp, routine, problems (main first), goals", () => {
  const rows = runsheetProfileStrip({
    quiz: nomi,
    heat: {
      drying: "Gewöhnlich föhnen",
      tools: [
        { label: "Föhnen", frequency: "2× pro Woche", protection: null },
        {
          label: "Lockenstab oder Welleneisen",
          frequency: "2× pro Woche",
          protection: "Hitzeschutz: manchmal",
        },
      ],
    },
    washFrequencyLabel: "2× pro Woche",
  })
  assert.deepEqual(rows, [
    {
      label: "Haar",
      items: [
        { text: "Glatt" },
        { text: "Fein" },
        { text: "Reißt sofort" },
        { text: "Blondiert / aufgehellt" },
      ],
    },
    { label: "Kopfhaut", items: [{ text: "Eher trocken" }, { text: "Trockene Schuppen" }] },
    {
      label: "Routine",
      items: [
        { text: "Waschen 2× pro Woche" },
        { text: "Föhnen 2× pro Woche" },
        { text: "Lockenstab oder Welleneisen 2× pro Woche · Hitzeschutz: manchmal" },
      ],
    },
    {
      label: "Probleme",
      items: [
        { text: "Mein Haar wirkt insgesamt strapaziert oder geschädigt", main: true },
        { text: "Wenig Glanz" },
        { text: "Mein Haar wirkt schnell platt oder beschwert" },
      ],
    },
    { label: "Ziele", items: [{ text: "Mehr Glanz" }] },
  ])
})

test("missing sources leave their rows out — never an empty row", () => {
  assert.deepEqual(runsheetProfileStrip({ quiz: null, heat: null, washFrequencyLabel: null }), [])
  assert.deepEqual(
    runsheetProfileStrip({
      quiz: { status: "no_lead" },
      heat: null,
      washFrequencyLabel: "1× pro Woche",
    }),
    [{ label: "Routine", items: [{ text: "Waschen 1× pro Woche" }] }],
  )
})
