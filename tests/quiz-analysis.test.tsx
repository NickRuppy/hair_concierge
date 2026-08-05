import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  getQuizAnalysisTimeline,
  getQuizAnalysisProgress,
  QUIZ_ANALYSIS_MILESTONES,
  QUIZ_ANALYSIS_STEPS,
  QuizAnalysisView,
  scheduleQuizAnalysis,
  startQuizAnalysisReveal,
} from "../src/components/quiz/quiz-analysis"

test("preparation keeps a 2.4 second minimum while revealing all three rows in order", () => {
  assert.deepEqual(getQuizAnalysisTimeline(), {
    stepDelays: [800, 1600, 2400],
    minimumDuration: 2400,
  })
  assert.deepEqual(QUIZ_ANALYSIS_STEPS, [
    "Dein Haarprofil wird ausgewertet",
    "Deine wichtigsten Pflegehebel werden sortiert",
    "Dein persönlicher Plan wird zusammengestellt",
  ])
  assert.equal(getQuizAnalysisProgress(0, false), 8)
  assert.equal(getQuizAnalysisProgress(1, false), 36)
  assert.equal(getQuizAnalysisProgress(2, false), 65)
  assert.equal(getQuizAnalysisProgress(3, false), 94)
  assert.equal(getQuizAnalysisProgress(3, true), 100)
})

test("preparation completes the normal row sequence without navigating", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  const completedSteps: number[] = []
  let minimumCompleteCalls = 0

  scheduleQuizAnalysis({
    onMinimumComplete: () => {
      minimumCompleteCalls += 1
    },
    onStepComplete: (step) => completedSteps.push(step),
    reducedMotion: false,
  })

  context.mock.timers.tick(799)
  assert.deepEqual(completedSteps, [])
  assert.equal(minimumCompleteCalls, 0)

  context.mock.timers.tick(801)
  assert.deepEqual(completedSteps, [1, 2])
  assert.equal(minimumCompleteCalls, 0)

  context.mock.timers.tick(800)
  assert.deepEqual(completedSteps, [1, 2, 3])
  assert.equal(minimumCompleteCalls, 1)

  context.mock.timers.tick(10_000)
  assert.equal(minimumCompleteCalls, 1)
})

test("reduced motion skips both the row stagger and artificial dwell", () => {
  const completedSteps: number[] = []
  let minimumCompleteCalls = 0

  scheduleQuizAnalysis({
    onMinimumComplete: () => {
      minimumCompleteCalls += 1
    },
    onStepComplete: (step) => completedSteps.push(step),
    reducedMotion: true,
  })

  assert.deepEqual(completedSteps, [QUIZ_ANALYSIS_STEPS.length])
  assert.equal(minimumCompleteCalls, 1)
})

test("preparation cleanup cancels all pending callbacks", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  const completedSteps: number[] = []
  let minimumCompleteCalls = 0

  const cleanup = scheduleQuizAnalysis({
    onMinimumComplete: () => {
      minimumCompleteCalls += 1
    },
    onStepComplete: (step) => completedSteps.push(step),
    reducedMotion: false,
  })

  cleanup()
  context.mock.timers.tick(10_000)

  assert.deepEqual(completedSteps, [])
  assert.equal(minimumCompleteCalls, 0)
})

test("loading view renders the approved timeline copy and accessible percentage progress", () => {
  const html = renderToStaticMarkup(
    <QuizAnalysisView
      completedSteps={1}
      isReady={false}
      name="Mia"
      onReveal={() => {}}
      revealPending={false}
    />,
  )

  assert.match(html, /Deine Angaben sind gespeichert/)
  assert.match(html, /Mia, wir stellen deine Haaranalyse zusammen\./)
  assert.match(
    html,
    /Während wir rechnen, zeigen wir dir, wie dein Plan dich Schritt für Schritt unterstützen kann\./,
  )
  assert.match(html, /Deine wichtigsten Pflegehebel werden sortiert/)
  for (const milestone of QUIZ_ANALYSIS_MILESTONES) assert.match(html, new RegExp(milestone.label))
  assert.match(html, /Deine Routine wird leichter umsetzbar/)
  assert.match(html, /data-analysis-milestone="week-one"/)
  assert.match(html, /role="status"/)
  assert.match(html, /role="progressbar"/)
  assert.match(html, /aria-valuenow="36"/)
  assert.match(html, />36 %</)
  assert.doesNotMatch(html, /Meine Haaranalyse ansehen/)
  assert.doesNotMatch(html, /commit/i)
})

test("ready view changes copy in place and reveals only the approved CTA", () => {
  const html = renderToStaticMarkup(
    <QuizAnalysisView
      completedSteps={QUIZ_ANALYSIS_STEPS.length}
      isReady
      name="Mia"
      onReveal={() => {}}
      revealPending={false}
    />,
  )

  assert.match(html, /Mia, deine Haaranalyse ist bereit\./)
  assert.match(html, /Deine wichtigsten Prioritäten und Routine-Bausteine warten auf dich\./)
  assert.match(html, /aria-valuenow="100"/)
  assert.match(html, />Meine Haaranalyse ansehen</)
  assert.match(html, /role="progressbar"/)
  assert.doesNotMatch(html, /<button[^>]*\sdisabled(?:=|>)/)
})

test("a slower access check keeps the final preparation row active", () => {
  const html = renderToStaticMarkup(
    <QuizAnalysisView
      completedSteps={QUIZ_ANALYSIS_STEPS.length}
      isReady={false}
      name="Mia"
      onReveal={() => {}}
      revealPending={false}
    />,
  )

  assert.match(html, /Dein Plan wird finalisiert/)
  assert.match(html, /aria-valuenow="94"/)
  assert.doesNotMatch(html, /Meine Haaranalyse ansehen/)
})

test("pending reveal keeps the ready screen stable and disables duplicate interaction", () => {
  const html = renderToStaticMarkup(
    <QuizAnalysisView
      completedSteps={QUIZ_ANALYSIS_STEPS.length}
      isReady
      name="Mia"
      onReveal={() => {}}
      revealPending
    />,
  )

  assert.match(html, /Mia, deine Haaranalyse ist bereit\./)
  assert.match(html, /disabled/)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, />Meine Haaranalyse ansehen</)
})

test("one user action calls the reveal callback exactly once", () => {
  const lock = { current: false }
  let revealCalls = 0
  const onReveal = () => {
    revealCalls += 1
  }

  assert.equal(startQuizAnalysisReveal(lock, onReveal), true)
  assert.equal(startQuizAnalysisReveal(lock, onReveal), false)
  assert.equal(startQuizAnalysisReveal(lock, onReveal), false)
  assert.equal(revealCalls, 1)
})

test("blank restored name uses grammatical generic loading and ready headings", () => {
  const loadingHtml = renderToStaticMarkup(
    <QuizAnalysisView
      completedSteps={0}
      isReady={false}
      name="  "
      onReveal={() => {}}
      revealPending={false}
    />,
  )
  const readyHtml = renderToStaticMarkup(
    <QuizAnalysisView
      completedSteps={QUIZ_ANALYSIS_STEPS.length}
      isReady
      name=""
      onReveal={() => {}}
      revealPending={false}
    />,
  )

  assert.match(loadingHtml, /Wir stellen deine Haaranalyse zusammen\./)
  assert.match(readyHtml, /Deine Haaranalyse ist bereit\./)
  assert.doesNotMatch(`${loadingHtml}${readyHtml}`, />,\s/)
})
