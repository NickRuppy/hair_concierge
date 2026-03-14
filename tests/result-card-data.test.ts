import assert from "node:assert/strict"
import test from "node:test"

import { buildCardData } from "../src/lib/quiz/result-card-data"

test("legacy result payloads render protein and scalp cards without blanks", () => {
  const cardData = buildCardData({
    structure: "curly",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "ueberdehnt",
    scalp: "fettig_schuppen",
    treatment: ["gefaerbt"],
  } as never)

  assert.equal(cardData.cards.length, 5)
  assert.equal(cardData.cards[3]?.title, "Protein vs. Feuchtigkeit")
  assert.match(cardData.cards[3]?.description ?? "", /ueberdehnt|Protein/i)
  assert.equal(cardData.cards[4]?.title, "Kopfhaut")
  assert.match(cardData.cards[4]?.description ?? "", /Schuppen|Fettet/i)
})

test("shared result summary still derives from normalized answers", () => {
  const cardData = buildCardData({
    structure: "wavy",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "elastisch",
    scalp: "unauffaellig",
    treatment: ["natur"],
  } as never)

  assert.equal(cardData.summaryLine, "Wellig · Fein · Ausgeglichen")
})
