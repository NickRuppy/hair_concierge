import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { getQuizFunnelCopy } from "../src/lib/quiz/funnel-copy"
import { QuizFunnelPackageProvider } from "../src/components/quiz/quiz-funnel-package-provider"
import { QuizInfoStrip } from "../src/components/quiz/quiz-info-strip"

test("the default copy (organic, or any unknown package key) matches today's strings", () => {
  for (const packageKey of [null, "default_organic", "unknown_key", "scan_v2"]) {
    const copy = getQuizFunnelCopy(packageKey)

    assert.equal(copy.infoStripLead, "Lass uns deine Haare verstehen — Schritt für Schritt.")
    assert.equal(
      copy.infoStripBody,
      "10 schnelle Fragen zur Basis, dann gehts an deine Routine und Produkte.",
    )
    assert.equal(copy.leadCaptureHeadline, "Dein persönlicher Pflegeplan ist bereit!")
    assert.equal(copy.commitButton, "Ja, zeig mir meine Analyse")
    assert.equal(copy.analysisLoadingHeadline, "Deine Haaranalyse wird erstellt.")
  }
})

test("default commitHeading personalizes with a trimmed name and falls back grammatically", () => {
  const copy = getQuizFunnelCopy(null)

  assert.equal(
    copy.commitHeading(" Lena "),
    "Lena, bereit für den nächsten Schritt mit deinem Haar?",
  )
  assert.equal(copy.commitHeading("  "), "Bereit für den nächsten Schritt mit deinem Haar?")
})

test("scan_v1 swaps the info strip body, lead headline, commit copy, and loading headline verbatim", () => {
  const copy = getQuizFunnelCopy("scan_v1")

  assert.equal(copy.infoStripLead, "Lass uns deine Haare verstehen — Schritt für Schritt.")
  assert.equal(
    copy.infoStripBody,
    "10 schnelle Fragen zur Basis, dann prüft der Scanner deine Produkte.",
  )
  assert.equal(copy.leadCaptureHeadline, "Dein Haarprofil ist fertig.")
  assert.equal(copy.commitButton, "Ja, zeig mir meinen Scanner")
  assert.equal(copy.analysisLoadingHeadline, "Wir richten deinen Scanner ein.")
})

test("scan_v1 commitHeading personalizes with a trimmed name and falls back grammatically", () => {
  const copy = getQuizFunnelCopy("scan_v1")

  assert.equal(copy.commitHeading(" Lena "), "Lena, bereit für deinen ersten Scan?")
  assert.equal(copy.commitHeading("  "), "Bereit für deinen ersten Scan?")
})

test("scan_v1 copy never contains the retired verdict wording", () => {
  const copy = getQuizFunnelCopy("scan_v1")
  const flattened = [
    copy.infoStripLead,
    copy.infoStripBody,
    copy.leadCaptureHeadline,
    copy.commitHeading("Lena"),
    copy.commitHeading(""),
    copy.commitButton,
    copy.analysisLoadingHeadline,
  ].join(" ")

  assert.doesNotMatch(flattened, /urteilt/i)
  assert.doesNotMatch(flattened, /Urteil/)
})

// SSR safety: the info strip is on question 1, the quiz's first paint. Its copy
// must be identical between the server render and the client's first render, so
// it must resolve from the provider's context (available during SSR) rather
// than the zustand store (empty until the client applies it).
test("the info strip renders the scan copy through the provider during a server render", () => {
  const html = renderToStaticMarkup(
    <QuizFunnelPackageProvider funnelPackageKey="scan_v1">
      <QuizInfoStrip onDismiss={() => {}} />
    </QuizFunnelPackageProvider>,
  )

  assert.match(html, /10 schnelle Fragen zur Basis, dann prüft der Scanner deine Produkte\./)
  assert.doesNotMatch(html, /dann gehts an deine Routine und Produkte/)
})

test("the info strip renders the default copy through the provider for an unattributed visit", () => {
  const html = renderToStaticMarkup(
    <QuizFunnelPackageProvider funnelPackageKey={null}>
      <QuizInfoStrip onDismiss={() => {}} />
    </QuizFunnelPackageProvider>,
  )

  assert.match(html, /10 schnelle Fragen zur Basis, dann gehts an deine Routine und Produkte\./)
  assert.doesNotMatch(html, /prüft der Scanner/)
})
