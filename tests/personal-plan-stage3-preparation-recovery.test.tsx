import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { Stage3PreparationRecoveryPanel } from "../src/components/personal-plan-products/stage3-preparation-recovery"

test("Stage 3 recovery states expose only actions that can resolve their failure", () => {
  const checkpoint = renderToStaticMarkup(
    <Stage3PreparationRecoveryPanel
      kind="checkpoint_changed"
      diagnosticQueued={false}
      onRecover={() => {}}
      onExit={() => {}}
      exitLabel="Zur Routine"
    />,
  )
  assert.match(checkpoint, /Dein Feinschliff wurde aktualisiert\./)
  assert.match(checkpoint, /Aktuellen Stand laden/)
  assert.match(checkpoint, /Zur Routine/)

  const transient = renderToStaticMarkup(
    <Stage3PreparationRecoveryPanel
      kind="transient"
      diagnosticQueued={false}
      onRecover={() => {}}
      onExit={() => {}}
      exitLabel="Zur Routine"
    />,
  )
  assert.match(transient, /Die Produktauswahl ist gerade nicht verfügbar\./)
  assert.match(transient, /Erneut versuchen/)
  assert.match(transient, /Zur Routine/)

  const contract = renderToStaticMarkup(
    <Stage3PreparationRecoveryPanel
      kind="contract_violation"
      diagnosticQueued
      onExit={() => {}}
      exitLabel="Zur Routine"
    />,
  )
  assert.match(contract, /Die Produktauswahl kann gerade nicht geöffnet werden\./)
  assert.match(contract, /Wir haben das Problem registriert\./)
  assert.doesNotMatch(contract, /Erneut versuchen|Aktuellen Stand laden/)
})

test("the terminal recovery does not claim registration when capture was not queued", () => {
  const html = renderToStaticMarkup(
    <Stage3PreparationRecoveryPanel
      kind="contract_violation"
      diagnosticQueued={false}
      onExit={() => {}}
      exitLabel="Zum Profil"
    />,
  )
  assert.doesNotMatch(html, /registriert/)
  assert.match(html, /Zum Profil/)
})

test("a recovery state remains informative when a future bridge caller has no exit action", () => {
  const html = renderToStaticMarkup(
    <Stage3PreparationRecoveryPanel
      kind="transient"
      diagnosticQueued={false}
      onRecover={() => {}}
      exitLabel="Zur Routine"
    />,
  )

  assert.match(html, /Die Produktauswahl ist gerade nicht verfügbar\./)
  assert.match(html, /Erneut versuchen/)
  assert.doesNotMatch(html, /Zur Routine/)
})
