import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { hasLandingVariant, renderLandingVariant } from "../src/funnels/landing/registry"

const landingSource = readFileSync(
  new URL("../src/funnels/landing/scan-regal.tsx", import.meta.url),
  "utf8",
)

function renderScanRegal() {
  const element = renderLandingVariant("scan-regal")
  assert.ok(element, "the scan-regal variant is registered")
  return renderToStaticMarkup(element)
}

test("the scan landing renders through the registry with its approved hero copy", () => {
  assert.equal(hasLandingVariant("scan-regal"), true)
  const html = renderScanRegal()

  assert.match(html, /Drogerie-Regal/)
  assert.match(html, /200 Shampoos im Regal\. Eins passt zu dir\./)
  assert.match(
    html,
    /Chaarlie zeigt dir per Scan, welches\. Dafür braucht es dein Haarprofil – 10 Fragen, 2 Minuten\./,
  )
  assert.match(html, /„Ich weiß nie, welche Produkte wirklich zu mir passen\.“/)
  assert.match(html, /Häufigste Antwort · eigene Umfrage, 4\.024 Frauen/)
  // The photo is the shelf moment the whole variant is named after.
  assert.match(html, /%2Fimages%2Ffunnels%2Fscan%2Ffrau-regal-aha\.webp/)
  assert.doesNotMatch(html, /Urteil/)
})

test("the scan landing explains the sequence and what the profile unlocks", () => {
  const html = renderScanRegal()

  assert.match(html, /So funktioniert’s/)
  assert.match(html, /Haarprofil/)
  assert.match(html, /10 Fragen zu Struktur, Kopfhaut und Zielen\./)
  assert.match(html, /Scannen/)
  assert.match(html, /Barcode in den Rahmen halten – im Regal oder zu Hause\./)
  assert.match(
    html,
    /Passt, passt mit Einschränkung oder passt nicht – plus Alternativen, die passen\./,
  )

  assert.match(html, /Im Chaarlie-Abo/)
  for (const item of [
    "Produkt-Scanner",
    "Persönlicher Plan",
    "Anwendung Schritt für Schritt",
    "Chat mit Chaarlie",
  ]) {
    assert.match(html, new RegExp(item), item)
  }
})

test("the scan landing shows insert 16's example card and sends every CTA to the quiz", () => {
  const html = renderScanRegal()

  // Same card, same animation class as the first scanner insert.
  assert.match(html, /Beispiel/)
  assert.match(html, /scan-insert-example-card/)
  assert.match(html, /OGX Argan Oil of Morocco Shampoo/)
  assert.match(html, /Passt nicht zu deinem Haar/)
  assert.match(html, /Haardicke: dick statt fein/)

  // Header CTA plus the primary CTA, both to /quiz, with the fine print once.
  assert.equal((html.match(/href="\/quiz"/g) ?? []).length, 2)
  assert.equal((html.match(/Haarprofil erstellen/g) ?? []).length, 2)
  assert.match(html, /10 Fragen · 2 Minuten · danach ist dein Scanner startklar/)
  assert.match(html, /Impressum/)
})

test("the scan landing variant mounts no tracking of its own", () => {
  assert.doesNotMatch(landingSource, /LandingTracking/)
  assert.doesNotMatch(landingSource, /providers\/tracking/)
  assert.doesNotMatch(landingSource, /lib\/analytics/)
  assert.doesNotMatch(landingSource, /trackAppEvent|posthog|useEffect/)
})
