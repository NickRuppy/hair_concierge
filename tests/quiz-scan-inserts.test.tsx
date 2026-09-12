import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizBrowserHistoryProvider } from "../src/components/quiz/quiz-browser-history"
import { ScanInsertHomeView } from "../src/components/quiz/scan-inserts/scan-insert-home"
import { ScanInsertProblemView } from "../src/components/quiz/scan-inserts/scan-insert-problem"
import { ScanInsertSolutionView } from "../src/components/quiz/scan-inserts/scan-insert-solution"
import { eventRoutes } from "../src/lib/analytics/routes"
import { getQuizScreenOrder, isQuizInsertStep } from "../src/lib/quiz/screen-order"
import type { QuizAnswers, QuizStep } from "../src/lib/quiz/types"

const quizPageSource = readFileSync(new URL("../src/app/quiz/page.tsx", import.meta.url), "utf8")
const globalsSource = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")

function renderInsert(step: QuizStep, answers: QuizAnswers) {
  const View =
    step === 16 ? ScanInsertProblemView : step === 17 ? ScanInsertSolutionView : ScanInsertHomeView
  return renderToStaticMarkup(
    <QuizBrowserHistoryProvider>
      <View answers={answers} funnelPackageKey="scan_v1" />
    </QuizBrowserHistoryProvider>,
  )
}

/** next/image rewrites a local source into an encoded optimizer URL. */
function imageUrl(file: string) {
  return new RegExp(`%2Fimages%2Ffunnels%2Fscan%2F${file.replace(".", "\\.")}`)
}

test("the problem insert names the shelf moment and the answers already given", () => {
  const html = renderInsert(16, { structure: "curly", thickness: "coarse", density: "high" })

  assert.match(html, /Das Problem/)
  assert.match(html, /Vorm Regal raten alle\./)
  assert.match(html, /63 %/)
  assert.match(
    html,
    /suchen Klarheit, welche Produkte wirklich zu ihnen passen\. Raten kostet Geld, Zeit und ein Regal voller halbleerer Flaschen\./,
  )
  assert.match(html, /Dein Anfang der Lösung:/)
  assert.match(html, /lockiges Haar, dick\./)
  assert.match(html, /Drei Antworten, die der Scanner ab jetzt kennt\./)
  assert.match(html, imageUrl("frau-regal-aha.webp"))
  assert.match(html, /Weiter/)
})

test("the solution insert quotes the scalp answer the user just gave", () => {
  const html = renderInsert(17, {
    scalp_type: "fettig",
    has_scalp_issue: true,
    scalp_condition: "schuppen",
  })

  assert.match(html, /Die Lösung/)
  assert.match(html, /Nicht mehr raten\. Scannen\./)
  assert.match(
    html,
    /Du hast „Schuppen“ angegeben\. Jedes Shampoo, das nicht dazu passt, erkennt der Scanner in Sekunden – bevor es im Korb landet\./,
  )
  assert.match(html, imageUrl("regal-scan-flasche.webp"))
  assert.match(html, /Passt nicht zu deiner Kopfhaut/)
})

test("the home insert turns the user's own bathroom into the first shelf", () => {
  const html = renderInsert(18, { thickness: "coarse", treatment: ["blondiert"] })

  assert.match(html, /Und zu Hause/)
  assert.match(html, /Dein Bad ist das erste Regal\./)
  assert.match(
    html,
    /Scann, was da steht\. Was passt, bleibt\. Was nicht passt, fliegt raus\. Was fehlt, kommt in deinen Plan\./,
  )
  assert.match(html, imageUrl("bad-ablage.webp"))
  assert.match(html, /Balea Professional Repair Kur/)
  assert.match(html, /Haarmaske · ca\. 1,95 €/)
  assert.match(html, /Pflegegewicht: mittel statt reichhaltig · Repair-Pflege: mittel statt hoch/)
})

test("every insert marks its card as an example and keeps the preceding question's counter", () => {
  const expected: [QuizStep, string][] = [
    [16, "3/10"],
    [17, "8/10"],
    [18, "10/10"],
  ]
  for (const [step, counter] of expected) {
    const html = renderInsert(step, { thickness: "normal", scalp_type: "trocken" })
    assert.match(html, /Beispiel/, `insert ${step} marks the card`)
    assert.match(html, new RegExp(counter.replace("/", "\\/")), `insert ${step} counter`)
    assert.match(html, /scan-insert-example-card/, `insert ${step} animates the card`)
    assert.doesNotMatch(html, /Urteil/, `insert ${step} avoids verdict jargon`)
  }
})

test("the card animation is defined once and disabled under reduced motion", () => {
  assert.match(globalsSource, /@keyframes scanInsertCardUp/)
  assert.match(
    globalsSource,
    /\.scan-insert-example-card \{\s*animation: scanInsertCardUp 1s 0\.8s cubic-bezier\(0\.22, 0\.8, 0\.36, 1\) both;/,
  )
  const reducedMotion = globalsSource.slice(globalsSource.indexOf("prefers-reduced-motion"))
  assert.match(reducedMotion, /\.scan-insert-example-card \{\s*animation: none !important;/)
})

test("only the scan package reaches an insert screen", () => {
  assert.equal(
    getQuizScreenOrder(null).some((step) => isQuizInsertStep(step)),
    false,
  )
  assert.match(quizPageSource, /case 16:\s*return <ScanInsertProblem \/>/)
  assert.match(quizPageSource, /case 17:\s*return <ScanInsertSolution \/>/)
  assert.match(quizPageSource, /case 18:\s*return <ScanInsertHome \/>/)
  assert.doesNotMatch(quizPageSource, /ScanInsertPlaceholder/)
})

test("the start event reports the question an insert sits behind", () => {
  assert.match(quizPageSource, /const startStep = getQuizProgressStep\(step, funnelPackageKey\)/)
  assert.match(quizPageSource, /stepName: STEP_NAMES\[startStep\] \|\| `step_\$\{startStep\}`/)
  assert.match(quizPageSource, /stepNumber: startStep/)
})

test("the insert view event is PostHog-only", () => {
  assert.deepEqual(eventRoutes.quiz_insert_viewed, {
    customerio: false,
    meta: false,
    posthog: true,
  })
})

test("the insert view event maps to snake_case PostHog properties", async () => {
  const { postHogDestination } = await import("../src/lib/analytics/destinations/posthog")
  const { posthog } = await import("../src/lib/analytics/runtime/posthog")

  const calls: { eventName: string; properties: Record<string, unknown> }[] = []
  const originalCapture = posthog.capture
  posthog.capture = ((eventName: string, properties: Record<string, unknown>) => {
    calls.push({ eventName, properties })
    return true
  }) as typeof posthog.capture

  try {
    postHogDestination.track("quiz_insert_viewed", {
      insertId: "solution",
      funnelPackageKey: "scan_v1",
    })
  } finally {
    posthog.capture = originalCapture
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].eventName, "quiz_insert_viewed")
  assert.equal(calls[0].properties.insert_id, "solution")
  assert.equal(calls[0].properties.funnel_package_key, "scan_v1")
  assert.equal(calls[0].properties.insertId, undefined)
  assert.equal(calls[0].properties.funnelPackageKey, undefined)
})

test("an insert reports its own view event and never the per-question one", () => {
  const screenSource = readFileSync(
    new URL("../src/components/quiz/scan-inserts/scan-insert-frame.tsx", import.meta.url),
    "utf8",
  )

  assert.match(screenSource, /trackAppEvent\("quiz_insert_viewed"/)
  assert.doesNotMatch(screenSource, /quiz_step_viewed/)
  // One event per view: the guard survives a re-render and a package-key fill.
  assert.match(screenSource, /if \(trackedRef\.current\) return/)
})
