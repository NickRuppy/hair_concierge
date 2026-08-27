import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { PersonalPlanReadyClient } from "../src/app/plan-bereit/personal-plan-ready-client"
import { HAIR_LENGTH_OPTIONS } from "../src/lib/vocabulary/hair-length"

const clientSource = readFileSync(
  new URL("../src/app/plan-bereit/personal-plan-ready-client.tsx", import.meta.url),
  "utf8",
)
const pageSource = readFileSync(new URL("../src/app/plan-bereit/page.tsx", import.meta.url), "utf8")

test("server-first pending envelope renders approved static copy and no-JS recovery", () => {
  const html = renderToStaticMarkup(
    React.createElement(PersonalPlanReadyClient, {
      leadId: "lead-legacy",
      nextHref: "/plan-start",
      initialReadiness: {
        status: "checking",
        leadId: "lead-legacy",
        quizSourceKind: "legacy",
        sourceVersion: "2026-08-12T08:00:00.000Z",
        missingFacts: [],
        initialAction: "link",
      },
    }),
  )

  assert.match(html, /Deine Angaben sind gespeichert/)
  assert.match(html, /Wir bereiten deinen Haarplan vor\./)
  assert.match(
    html,
    /Du musst nichts tun\. Wir prüfen gerade, ob dein vollständiges Profil mit deinem Konto verbunden ist\./,
  )
  assert.match(html, /Haarplan wird geprüft/)
  assert.match(html, /Bitte kurz warten/)
  assert.match(html, /<noscript>/)
  assert.match(html, /href="\/plan-bereit\?lead=lead-legacy"/)
  assert.match(html, /href="\/kontakt"/)
  assert.doesNotMatch(html, /motion-safe:animate-spin/)
  assert.doesNotMatch(html, /lucide-loader-circle/)
  assert.doesNotMatch(html, /Deine Zahlung/)
  assert.doesNotMatch(html, /Bedarfsplan ansehen/)
})

test("server-first ready envelope renders the signed-off arrival screen (Variante B)", () => {
  const html = renderToStaticMarkup(
    React.createElement(PersonalPlanReadyClient, {
      leadId: null,
      nextHref: "/plan-start",
      initialReadiness: {
        status: "ready",
        leadId: "lead-legacy",
        quizSourceKind: "legacy",
        sourceVersion: "2026-08-12T08:00:00.000Z",
        missingFacts: [],
        initialAction: "none",
      },
    }),
  )

  assert.match(html, /Dein Idealplan ist fertig\./)
  assert.match(html, /Und das wartet dahinter:/)
  assert.match(html, /Deine Routine/)
  assert.match(html, /Schritt für Schritt\./)
  assert.match(html, /Deine Anwendung/)
  assert.match(html, /So setzt du(?:&#x27;|')s um\./)
  assert.match(html, /Dein Chat/)
  assert.match(html, /Fragen\? Immer offen\./)
  assert.match(html, /Idealplan ansehen/)
  assert.match(html, /href="\/plan-start"/)
  assert.match(html, />chaarlie</)

  // The creation funnel ends here: wordmark-only header, no 5-stage bar and no
  // chapter list narrating the retired sequential journey (Feinschliff cutover
  // #467/#471, founder sign-off 27.08.2026).
  assert.doesNotMatch(html, /role="progressbar"/)
  assert.doesNotMatch(html, /Personal-Plan-Stufen/)
  assert.doesNotMatch(html, /Wir haben deinen Idealplan erstellt\./)
  assert.doesNotMatch(html, /wirklich zu deinem/)
  assert.doesNotMatch(html, /Persönlicher Feinschliff/)
  assert.doesNotMatch(html, /Dein Produkt-Check/)
  assert.doesNotMatch(html, /Für schönes, gesundes Haar\./)
  assert.doesNotMatch(html, /Dein Weg zum persönlichen Haarplan/)
  assert.doesNotMatch(html, /Deine Angaben sind gespeichert/)
  assert.doesNotMatch(html, /Dein Haarplan ist bereit\./)
  assert.doesNotMatch(html, /Haaranalyse verbunden/)
  assert.doesNotMatch(html, /Wir bereiten deinen Haarplan vor\./)
  assert.doesNotMatch(html, /Haarplan wird geprüft/)
  assert.doesNotMatch(html, /data-personal-plan-ready-preview/)
  assert.doesNotMatch(html, /motion-safe:animate-spin/)
  assert.doesNotMatch(html, /<noscript>/)
})

test("missing source facts ask for the fact without claiming no action is needed", () => {
  const html = renderToStaticMarkup(
    React.createElement(PersonalPlanReadyClient, {
      leadId: "lead-legacy",
      initialReadiness: {
        status: "missing_source_facts",
        leadId: "lead-legacy",
        quizSourceKind: "legacy",
        sourceVersion: "2026-08-12T08:00:00.000Z",
        initialAction: "none",
        missingFacts: [
          {
            field: "hair_length",
            question: "Wie lang sind deine Haare aktuell?",
            helper: "Wähle die passende Länge.",
            options: HAIR_LENGTH_OPTIONS,
          },
        ],
      },
    }),
  )

  assert.match(html, /Eine Angabe fehlt noch./)
  assert.match(html, /Wie lang sind deine Haare aktuell?/)
  assert.doesNotMatch(html, /Du musst nichts tun/)
  assert.doesNotMatch(html, /Haarplan wird geprüft/)
})

test("forbidden and invalid states show support without waiting or payment claims", () => {
  for (const status of ["forbidden", "invalid_source"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(PersonalPlanReadyClient, {
        leadId: "lead-legacy",
        initialReadiness: {
          status,
          leadId: "lead-legacy",
          quizSourceKind: "legacy",
          sourceVersion: null,
          missingFacts: [],
          initialAction: "none",
        },
      }),
    )

    assert.match(html, /Wir können deinen Haarplan gerade nicht zuordnen./)
    assert.match(html, /Support kontaktieren/)
    assert.doesNotMatch(html, /Haarplan wird geprüft/)
    assert.doesNotMatch(html, /Zahlung/)
  }
})

test("timeout and transient states lead with a retry state instead of a live check", () => {
  for (const status of ["timeout", "transient_error"] as const) {
    const props =
      status === "timeout"
        ? { leadId: "lead-legacy", initialStatus: status }
        : {
            leadId: "lead-legacy",
            initialReadiness: {
              status,
              leadId: "lead-legacy",
              quizSourceKind: "legacy" as const,
              sourceVersion: null,
              missingFacts: [],
              initialAction: "none" as const,
            },
          }
    const html = renderToStaticMarkup(React.createElement(PersonalPlanReadyClient, props))

    assert.match(html, /Die Prüfung dauert länger./)
    assert.match(html, /Erneut prüfen/)
    assert.doesNotMatch(html, /Du musst nichts tun/)
    assert.doesNotMatch(html, /Haarplan wird geprüft/)
  }
})

test("client honors none, link, and poll initial actions instead of always posting", () => {
  assert.match(clientSource, /activeInitialAction === "none"/)
  assert.match(clientSource, /createPersonalPlanReadyPollRequestState\(activeInitialAction\)/)
  assert.match(clientSource, /method: request\.method/)
  assert.match(clientSource, /applyPersonalPlanReadyPollResponse\(body\.initialAction\)/)
  assert.doesNotMatch(clientSource, /method: attempts === 1 \? "POST" : "GET"/)
  assert.doesNotMatch(clientSource, /Sparkles/)
  assert.doesNotMatch(clientSource, /motion-safe:animate-spin/)
  assert.doesNotMatch(clientSource, /data-personal-plan-ready-preview/)
  assert.doesNotMatch(clientSource, /Zahlung bleibt sicher erfasst/)
})

test("page passes the server-first readiness envelope into the client", () => {
  assert.match(pageSource, /loadPlanBereitInitialReadiness/)
  assert.match(pageSource, /initialReadiness=\{initialReadiness\}/)
  assert.match(pageSource, /initialAction: "poll"/)
})
