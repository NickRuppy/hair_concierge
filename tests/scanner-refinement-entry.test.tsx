import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizFunnelPackageProvider } from "../src/components/quiz/quiz-funnel-package-provider"
import { QuizInfoStrip } from "../src/components/quiz/quiz-info-strip"
import { buildScannerQuizRedirect } from "../src/app/lp/[slug]/route-helpers"

function renderEntry({
  funnelPackageKey,
  scannerFunnelRefinementEnabled,
}: {
  funnelPackageKey: string | null
  scannerFunnelRefinementEnabled: boolean
}) {
  return renderToStaticMarkup(
    <QuizFunnelPackageProvider
      funnelPackageKey={funnelPackageKey}
      scannerFunnelRefinementEnabled={scannerFunnelRefinementEnabled}
    >
      <QuizInfoStrip onDismiss={() => {}} />
    </QuizFunnelPackageProvider>,
  )
}

test("the enabled attributed scanner entry explains the profile before question one", () => {
  const html = renderEntry({
    funnelPackageKey: "scan_v1",
    scannerFunnelRefinementEnabled: true,
  })

  assert.match(html, /Damit der Scanner zu deinem Haar passt\./)
  assert.match(
    html,
    /Der Scanner gleicht Produkte mit deinem Haarprofil ab\. Dafür brauchen wir ein paar Angaben zu deinen Haaren\./,
  )
  assert.match(html, /10 kurze Fragen · ca\. 2 Minuten/)
  assert.match(html, /data-scanner-refinement-entry="true"/)
})

test("the scanner entry refinement cannot change organic or disabled scanner copy", () => {
  for (const entry of [
    { funnelPackageKey: "scan_v1", scannerFunnelRefinementEnabled: false },
    { funnelPackageKey: null, scannerFunnelRefinementEnabled: true },
  ]) {
    const html = renderEntry(entry)

    assert.match(html, /Lass uns deine Haare verstehen — Schritt für Schritt\./)
    assert.doesNotMatch(html, /Damit der Scanner zu deinem Haar passt\./)
    assert.doesNotMatch(html, /data-scanner-refinement-entry="true"/)
  }
})

test("the scanner redirect preserves campaign query values for the attributed quiz request", () => {
  assert.equal(
    buildScannerQuizRedirect({
      utm_source: "instagram",
      utm_campaign: "scanner-herbst",
      fbclid: "fb-click",
      variant: ["a", "b"],
    }),
    "/quiz?utm_source=instagram&utm_campaign=scanner-herbst&fbclid=fb-click&variant=a&variant=b",
  )
  assert.equal(buildScannerQuizRedirect({}), "/quiz")
})
