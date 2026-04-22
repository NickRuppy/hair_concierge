import assert from "node:assert/strict"
import test from "node:test"

import { getQuizResultCta } from "../src/lib/quiz/result-cta"

test("logged-out users see that the next step saves the profile before unlocking the plan", () => {
  const cta = getQuizResultCta({ canGoStraightToRoutine: false })

  assert.equal(cta.lead, "Als Nächstes: Profil speichern & Plan freischalten")
  assert.equal(cta.label, "PLAN FREISCHALTEN")
  assert.equal(
    cta.subline,
    "Noch 3 kurze Schritte, dann legen wir Produkte, Reihenfolge und Anwendung für dich fest.",
  )
})

test("signed-in users can go straight into routine setup", () => {
  const cta = getQuizResultCta({ canGoStraightToRoutine: true })

  assert.equal(cta.lead, "Als Nächstes: dein persönlicher Plan")
  assert.equal(cta.label, "MEINE ROUTINE STARTEN")
  assert.equal(cta.subline, "Mit passenden Produkten, Reihenfolge und Anwendung.")
})
