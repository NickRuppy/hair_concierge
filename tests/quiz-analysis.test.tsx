import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  getCommitHeading,
  getLoadingHeading,
  getQuizTransitionPhase,
  QUIZ_TRANSITION_LOADING_MS,
  QUIZ_TRANSITION_READY_BEAT_MS,
  QuizAnalysisView,
  scheduleQuizTransitionLoading,
  scheduleQuizTransitionReveal,
  startQuizAnalysisReveal,
} from "../src/components/quiz/quiz-analysis"

test("phase resolution: commit until tapped, loading until elapsed AND ready, then ready", () => {
  assert.equal(
    getQuizTransitionPhase({ committed: false, loadingElapsed: false, ready: false }),
    "commit",
  )
  assert.equal(
    getQuizTransitionPhase({ committed: false, loadingElapsed: true, ready: true }),
    "commit",
  )
  assert.equal(
    getQuizTransitionPhase({ committed: true, loadingElapsed: false, ready: true }),
    "loading",
  )
  assert.equal(
    getQuizTransitionPhase({ committed: true, loadingElapsed: true, ready: false }),
    "loading",
  )
  assert.equal(
    getQuizTransitionPhase({ committed: true, loadingElapsed: true, ready: true }),
    "ready",
  )
})

test("headings personalize with a trimmed name and fall back grammatically", () => {
  assert.equal(getCommitHeading(" Lena "), "Lena, bereit für den nächsten Schritt mit deinem Haar?")
  assert.equal(getCommitHeading("  "), "Bereit für den nächsten Schritt mit deinem Haar?")
  assert.equal(getLoadingHeading("Lena"), "Einen Moment, Lena.")
  assert.equal(getLoadingHeading(""), "Einen Moment.")
})

test("loading beat holds for its minimum and cleanup cancels it", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  let elapsed = 0

  scheduleQuizTransitionLoading({ onElapsed: () => (elapsed += 1), reducedMotion: false })
  context.mock.timers.tick(QUIZ_TRANSITION_LOADING_MS - 1)
  assert.equal(elapsed, 0)
  context.mock.timers.tick(1)
  assert.equal(elapsed, 1)

  const cleanup = scheduleQuizTransitionLoading({
    onElapsed: () => (elapsed += 1),
    reducedMotion: false,
  })
  cleanup()
  context.mock.timers.tick(10_000)
  assert.equal(elapsed, 1)
})

test("ready beat waits 900ms before revealing and cleanup cancels it", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  let reveals = 0

  scheduleQuizTransitionReveal({ onReveal: () => (reveals += 1), reducedMotion: false })
  context.mock.timers.tick(QUIZ_TRANSITION_READY_BEAT_MS - 1)
  assert.equal(reveals, 0)
  context.mock.timers.tick(1)
  assert.equal(reveals, 1)

  const cleanup = scheduleQuizTransitionReveal({
    onReveal: () => (reveals += 1),
    reducedMotion: false,
  })
  cleanup()
  context.mock.timers.tick(10_000)
  assert.equal(reveals, 1)
})

test("reduced motion skips both beats synchronously", () => {
  let elapsed = 0
  let reveals = 0
  scheduleQuizTransitionLoading({ onElapsed: () => (elapsed += 1), reducedMotion: true })
  scheduleQuizTransitionReveal({ onReveal: () => (reveals += 1), reducedMotion: true })
  assert.equal(elapsed, 1)
  assert.equal(reveals, 1)
})

test("commit view shows exactly one question and both approved buttons, nothing else", () => {
  const html = renderToStaticMarkup(
    <QuizAnalysisView commitPending={false} name="Lena" onCommit={() => {}} phase="commit" />,
  )

  assert.match(html, /Lena, bereit für den nächsten Schritt mit deinem Haar\?/)
  assert.match(html, />Ja, zeig mir meine Analyse</)
  assert.match(html, />Ich bin neugierig</)
  assert.doesNotMatch(html, /Angaben sind gespeichert/)
  assert.doesNotMatch(html, /role="progressbar"/)
  assert.doesNotMatch(html, /%/)
  assert.doesNotMatch(html, /Meine Haaranalyse ansehen/)
  assert.doesNotMatch(html, /Nach 4 Wochen|Nach 7 Tagen/)

  // A persistent (always-mounted) role="status" live region is present from the
  // commit phase onward so screen readers pick it up before it first gets content,
  // but it carries no loading/ready copy yet.
  assert.match(html, /role="status"/)
  assert.doesNotMatch(html, /Einen Moment/)
  assert.doesNotMatch(html, />Bereit\.</)
})

test("pending commit disables both buttons against double taps", () => {
  const html = renderToStaticMarkup(
    <QuizAnalysisView commitPending name="Lena" onCommit={() => {}} phase="commit" />,
  )
  const disabledCount = (html.match(/<button[^>]*\sdisabled(?:=|>)/g) ?? []).length
  assert.equal(disabledCount, 2)
})

test("loading view shows the quiet beat copy with a status region and shimmer bar", () => {
  const html = renderToStaticMarkup(
    <QuizAnalysisView commitPending name="Lena" onCommit={() => {}} phase="loading" />,
  )

  assert.match(html, /Einen Moment, Lena\./)
  assert.match(html, /Deine Haaranalyse wird erstellt\./)
  assert.match(html, /role="status"/)
  assert.match(html, /quiz-shimmer-bar/)
  assert.doesNotMatch(html, /%/)
  assert.doesNotMatch(html, /<button/)
})

test("ready view is only the beat headline", () => {
  const html = renderToStaticMarkup(
    <QuizAnalysisView commitPending name="Lena" onCommit={() => {}} phase="ready" />,
  )

  assert.match(html, />Bereit\.</)
  assert.doesNotMatch(html, /<button/)
  assert.doesNotMatch(html, /quiz-shimmer-bar/)
})

test("one user action calls the reveal callback exactly once", () => {
  const lock = { current: false }
  let revealCalls = 0
  const onReveal = () => {
    revealCalls += 1
  }

  assert.equal(startQuizAnalysisReveal(lock, onReveal), true)
  assert.equal(startQuizAnalysisReveal(lock, onReveal), false)
  assert.equal(revealCalls, 1)
})
