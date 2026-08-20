# Quiz Transition "Variante D" (Commitment + Auto-Advance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy quiz transition page (progress card + milestone timeline + "ansehen" CTA) with the approved Variante D: a single commitment question → quiet loading beat → brief "Bereit." moment → automatic navigation to the result.

**Architecture:** `src/components/quiz/quiz-analysis.tsx` is rewritten as a three-phase state machine (`commit` → `loading` → `ready`) with pure, unit-testable helpers (phase resolution, headings, timer scheduling) and a presentational `QuizAnalysisView`. The container `QuizAnalysis` keeps its external contract (`{ name, onReveal, ready }`, plus a new optional `onCommit`) so `quiz-preparation.tsx` wiring stays minimal. Readiness gating (`resultPath && accessSettled`) is unchanged — the loading phase simply holds until `ready` is true.

**Tech Stack:** Next.js 16 / React client components, node:test + react-dom/server for unit tests, Playwright for e2e, Tailwind + globals.css for the shimmer animation.

**Spec:** Approved evidence = mockup artifact "Haaranalyse-Übergang" (Variante D frame) + user-journey sign-off recorded 2026-08-20 in the conversation. Evidence review: CONFIRMED. Journey sign-off: CONFIRMED (milestone timeline is dropped, not relocated).

## Global Constraints

- All UI text in German. Exact approved copy (do not improvise):
  - Commit heading with name: `{Name}, bereit für den nächsten Schritt mit deinem Haar?`
  - Commit heading without name: `Bereit für den nächsten Schritt mit deinem Haar?`
  - Primary commit button: `Ja, zeig mir meine Analyse`
  - Ghost commit button: `Ich bin neugierig`
  - Loading heading with name: `Einen Moment, {Name}.` / without name: `Einen Moment.`
  - Loading subline: `Deine Haaranalyse wird erstellt.`
  - Ready beat heading: `Bereit.`
- Deleted entirely (must not appear anywhere in the new component): `Deine Angaben sind gespeichert`, the subcopy lines, `Deine Auswertung ist bereit`, percentages, `QUIZ_ANALYSIS_STEPS`, `QUIZ_ANALYSIS_MILESTONES`, `Meine Haaranalyse ansehen`.
- Timing: loading beat minimum `2600` ms; ready beat `900` ms. Reduced motion skips both beats (tap → reveal as soon as `ready`).
- Both commit buttons proceed identically; the choice (`"ja"` | `"neugierig"`) is tracked once via a new analytics event `quiz_analysis_commitment` (PostHog only).
- One-shot protection: the commit tap and the final reveal each fire at most once (reuse `startQuizAnalysisReveal` lock pattern).
- TDD for the deterministic logic (repo rule for `src/lib/quiz/`-adjacent logic); run suites via npm scripts only (server-only shim — never bare `npx tsx --test`).
- Worktree: `.worktrees/quiz-transition-commitment` on `codex/quiz-transition-commitment` (base f019782c == origin/main). All work happens there.

## File Structure

- `src/components/quiz/quiz-analysis.tsx` — rewritten: phase helpers + `QuizAnalysisView` + `QuizAnalysis` container. Same filename to keep the `quiz-preparation.tsx` import stable.
- `src/components/quiz/quiz-preparation.tsx` — passes `onCommit` (analytics with `leadId`); everything else untouched.
- `src/lib/analytics/events.ts` + `src/lib/analytics/routes.ts` — new `quiz_analysis_commitment` event.
- `src/app/globals.css` — `quiz-shimmer` keyframes + `.quiz-shimmer-bar` component class.
- `tests/quiz-analysis.test.tsx` — rewritten for the new state machine.
- `tests/editorial-pages.test.tsx`, `tests/auth-intake-routing.e2e.spec.ts`, `tests/quiz-onboarding-e2e.spec.ts`, `tests/stripe-subscription-e2e.spec.ts`, `tests/quiz-result-routing.e2e.spec.ts`, `tests/legacy-quiz-email-deliverability.spec.ts` — updated to the new copy/flow.

---

### Task 1: Rewrite unit tests for the new state machine (red)

**Files:**
- Modify: `tests/quiz-analysis.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the executable spec for Task 2. Exact exports Task 2 must implement, all from `../src/components/quiz/quiz-analysis`:
  - `type QuizTransitionPhase = "commit" | "loading" | "ready"`
  - `type QuizCommitChoice = "ja" | "neugierig"`
  - `QUIZ_TRANSITION_LOADING_MS = 2600`, `QUIZ_TRANSITION_READY_BEAT_MS = 900`
  - `getCommitHeading(name: string): string`, `getLoadingHeading(name: string): string`
  - `getQuizTransitionPhase(input: { committed: boolean; loadingElapsed: boolean; ready: boolean }): QuizTransitionPhase`
  - `scheduleQuizTransitionLoading({ onElapsed, reducedMotion }: { onElapsed: () => void; reducedMotion: boolean }): () => void`
  - `scheduleQuizTransitionReveal({ onReveal, reducedMotion }: { onReveal: () => void; reducedMotion: boolean }): () => void`
  - `startQuizAnalysisReveal(lock: { current: boolean }, onReveal: () => void | Promise<void>): boolean` (kept from the old file, unchanged)
  - `QuizAnalysisView(props: { commitPending: boolean; name: string; onCommit: (choice: QuizCommitChoice) => void; phase: QuizTransitionPhase }): JSX.Element`
  - `QuizAnalysis(props: { name: string; onCommit?: (choice: QuizCommitChoice) => void; onReveal: () => void | Promise<void>; ready: boolean }): JSX.Element`

- [ ] **Step 1: Replace the entire content of `tests/quiz-analysis.test.tsx` with:**

```tsx
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
  assert.equal(
    getCommitHeading(" Lena "),
    "Lena, bereit für den nächsten Schritt mit deinem Haar?",
  )
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
```

- [ ] **Step 2: Run the suite to verify it fails**

Run (from the worktree root): `npm run test:node -- --test-name-pattern "phase resolution" 2>&1 | tail -5` — actually run the full file: `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-analysis.test.tsx` via `npm run test:node` is broad; acceptable narrow form: `npm run test:node 2>&1 | grep -A2 "quiz-analysis"`. Expected: FAIL — imports like `getCommitHeading` do not exist yet.

- [ ] **Step 3: Commit the red tests**

```bash
git add tests/quiz-analysis.test.tsx
git commit -m "test(quiz): red tests for commitment transition state machine"
```

---

### Task 2: Rewrite `quiz-analysis.tsx` (green)

**Files:**
- Modify: `src/components/quiz/quiz-analysis.tsx` (full rewrite)
- Modify: `src/app/globals.css` (append shimmer styles)

**Interfaces:**
- Consumes: the export list specified in Task 1.
- Produces: `QuizAnalysis({ name, onCommit?, onReveal, ready })` — the container `quiz-preparation.tsx` mounts in Task 3. `onCommit` receives `"ja" | "neugierig"` exactly once.

- [ ] **Step 1: Replace the entire content of `src/components/quiz/quiz-analysis.tsx` with:**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"

export type QuizTransitionPhase = "commit" | "loading" | "ready"
export type QuizCommitChoice = "ja" | "neugierig"

export const QUIZ_TRANSITION_LOADING_MS = 2600
export const QUIZ_TRANSITION_READY_BEAT_MS = 900

export function getCommitHeading(name: string) {
  const normalized = name.trim()
  return normalized
    ? `${normalized}, bereit für den nächsten Schritt mit deinem Haar?`
    : "Bereit für den nächsten Schritt mit deinem Haar?"
}

export function getLoadingHeading(name: string) {
  const normalized = name.trim()
  return normalized ? `Einen Moment, ${normalized}.` : "Einen Moment."
}

export function getQuizTransitionPhase({
  committed,
  loadingElapsed,
  ready,
}: {
  committed: boolean
  loadingElapsed: boolean
  ready: boolean
}): QuizTransitionPhase {
  if (!committed) return "commit"
  if (!loadingElapsed || !ready) return "loading"
  return "ready"
}

export function scheduleQuizTransitionLoading({
  onElapsed,
  reducedMotion,
}: {
  onElapsed: () => void
  reducedMotion: boolean
}) {
  if (reducedMotion) {
    onElapsed()
    return () => {}
  }
  const timer = setTimeout(onElapsed, QUIZ_TRANSITION_LOADING_MS)
  return () => clearTimeout(timer)
}

export function scheduleQuizTransitionReveal({
  onReveal,
  reducedMotion,
}: {
  onReveal: () => void
  reducedMotion: boolean
}) {
  if (reducedMotion) {
    onReveal()
    return () => {}
  }
  const timer = setTimeout(onReveal, QUIZ_TRANSITION_READY_BEAT_MS)
  return () => clearTimeout(timer)
}

export function startQuizAnalysisReveal(
  lock: { current: boolean },
  onReveal: () => void | Promise<void>,
): boolean {
  if (lock.current) return false

  lock.current = true

  try {
    void Promise.resolve(onReveal()).catch(() => {})
  } catch {
    // Navigation owns its error handling. Keep this terminal action one-shot so
    // a competing transition can never start.
  }

  return true
}

export function QuizAnalysisView({
  commitPending,
  name,
  onCommit,
  phase,
}: {
  commitPending: boolean
  name: string
  onCommit: (choice: QuizCommitChoice) => void
  phase: QuizTransitionPhase
}) {
  if (phase === "commit") {
    return (
      <div className="mx-auto flex w-full max-w-[26rem] flex-col items-center py-10 text-center sm:py-16">
        <h2 className="text-balance font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
          {getCommitHeading(name)}
        </h2>
        <button
          className="quiz-btn-primary mt-9 min-h-12 w-full rounded-[14px] px-5 py-3 text-base font-bold disabled:cursor-wait disabled:opacity-80"
          disabled={commitPending}
          onClick={() => onCommit("ja")}
          type="button"
        >
          Ja, zeig mir meine Analyse
        </button>
        <button
          className="mt-3 min-h-11 w-full rounded-[14px] px-5 py-2.5 text-sm font-semibold text-[var(--text-sub)] transition-colors hover:bg-[var(--brand-plum-ice)] hover:text-[var(--brand-plum)] disabled:cursor-wait disabled:opacity-80"
          disabled={commitPending}
          onClick={() => onCommit("neugierig")}
          type="button"
        >
          Ich bin neugierig
        </button>
      </div>
    )
  }

  if (phase === "loading") {
    return (
      <div
        aria-atomic="true"
        aria-live="polite"
        className="mx-auto flex w-full max-w-[26rem] flex-col items-center py-10 text-center sm:py-16"
        role="status"
      >
        <h2 className="text-balance font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
          {getLoadingHeading(name)}
        </h2>
        <p className="mt-3 text-[15px] leading-6 text-[var(--text-sub)]">
          Deine Haaranalyse wird erstellt.
        </p>
        <div aria-hidden="true" className="quiz-shimmer-bar mt-8" />
      </div>
    )
  }

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="mx-auto flex w-full max-w-[26rem] flex-col items-center py-10 text-center sm:py-16"
      role="status"
    >
      <h2 className="font-header text-[2rem] font-medium leading-tight text-[var(--brand-plum-darkest)] sm:text-[2.4rem]">
        Bereit.
      </h2>
    </div>
  )
}

export interface QuizAnalysisProps {
  name: string
  onCommit?: (choice: QuizCommitChoice) => void
  onReveal: () => void | Promise<void>
  ready: boolean
}

export function QuizAnalysis({ name, onCommit, onReveal, ready }: QuizAnalysisProps) {
  const [choice, setChoice] = useState<QuizCommitChoice | null>(null)
  const [loadingElapsed, setLoadingElapsed] = useState(false)
  const revealStartedRef = useRef(false)
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    reducedMotionRef.current =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  useEffect(() => {
    if (!choice) return
    return scheduleQuizTransitionLoading({
      onElapsed: () => setLoadingElapsed(true),
      reducedMotion: reducedMotionRef.current,
    })
  }, [choice])

  const phase = getQuizTransitionPhase({
    committed: choice !== null,
    loadingElapsed,
    ready,
  })

  useEffect(() => {
    if (phase !== "ready") return
    return scheduleQuizTransitionReveal({
      onReveal: () => startQuizAnalysisReveal(revealStartedRef, onReveal),
      reducedMotion: reducedMotionRef.current,
    })
    // onReveal is stable for the lifetime of the preparation screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const handleCommit = (selected: QuizCommitChoice) => {
    if (choice) return
    setChoice(selected)
    onCommit?.(selected)
  }

  return (
    <QuizAnalysisView
      commitPending={choice !== null}
      name={name}
      onCommit={handleCommit}
      phase={phase}
    />
  )
}
```

- [ ] **Step 2: Append the shimmer styles to `src/app/globals.css`** (inside the existing `@layer components` block that holds other quiz utilities, or as a new `@layer components` block at the end of the file):

```css
@layer components {
  .quiz-shimmer-bar {
    position: relative;
    height: 4px;
    width: 180px;
    overflow: hidden;
    border-radius: 9999px;
    background: var(--brand-plum-light);
  }
  .quiz-shimmer-bar::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: var(--brand-plum);
    transform: translateX(-100%);
    animation: quiz-shimmer-sweep 2.6s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .quiz-shimmer-bar::after {
      animation: none;
      transform: none;
      opacity: 0.6;
    }
  }
}

@keyframes quiz-shimmer-sweep {
  0% {
    transform: translateX(-100%);
  }
  55% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(100%);
  }
}
```

- [ ] **Step 3: Run the unit suite to verify green**

Run: `npm run test:node 2>&1 | tail -20` (from the worktree). Expected: `tests/quiz-analysis.test.tsx` passes. `tests/editorial-pages.test.tsx` will now FAIL (it asserts the old source strings) — that is expected and fixed in Task 4; note it, don't fix here.

- [ ] **Step 4: Commit**

```bash
git add src/components/quiz/quiz-analysis.tsx src/app/globals.css
git commit -m "feat(quiz): commitment-first transition with auto-advance (Variante D)"
```

---

### Task 3: Analytics event + preparation wiring

**Files:**
- Modify: `src/lib/analytics/events.ts` (add to `AppEventMap`, alphabetical position near `quiz_completed`)
- Modify: `src/lib/analytics/routes.ts` (add route entry near `quiz_completed`)
- Modify: `src/components/quiz/quiz-preparation.tsx:222-230` (the `QuizAnalysis` mount)

**Interfaces:**
- Consumes: `QuizAnalysis`'s `onCommit?: (choice: "ja" | "neugierig") => void` from Task 2; existing `trackAppEvent` from `@/lib/analytics/track-app-event`.
- Produces: analytics event `quiz_analysis_commitment` with payload `{ choice: "ja" | "neugierig"; leadId?: string | null }`.

- [ ] **Step 1: Add the event type to `AppEventMap` in `src/lib/analytics/events.ts`** (keep alphabetical ordering with its `quiz_` siblings):

```ts
  quiz_analysis_commitment: {
    choice: "ja" | "neugierig"
    leadId?: string | null
  }
```

- [ ] **Step 2: Add the route in `src/lib/analytics/routes.ts`** (same ordering):

```ts
  quiz_analysis_commitment: { customerio: false, meta: false, posthog: true },
```

- [ ] **Step 3: Wire `onCommit` in `src/components/quiz/quiz-preparation.tsx`** — replace the final `return` block:

```tsx
  return (
    <QuizAnalysis
      name={lead.name}
      onCommit={(choice) => {
        trackAppEvent("quiz_analysis_commitment", { choice, leadId })
      }}
      onReveal={() => {
        if (resultPath) router.push(resultPath)
      }}
      ready={Boolean(resultPath && accessSettled)}
    />
  )
```

(`trackAppEvent` is already imported in this file.)

- [ ] **Step 4: Typecheck**

Run: `npm run ci:verify 2>&1 | tail -5` — or the faster `npx tsc --noEmit` if the repo exposes it via `npm run typecheck` (check `package.json`; use the npm script). Expected: no type errors. (`editorial-pages` test failure remains pending for Task 4.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/events.ts src/lib/analytics/routes.ts src/components/quiz/quiz-preparation.tsx
git commit -m "feat(quiz): track commitment choice as quiz_analysis_commitment"
```

---

### Task 4: Update dependent tests (source assertions + e2e flows)

**Files:**
- Modify: `tests/editorial-pages.test.tsx:100-125` (source-string assertions on quiz-analysis.tsx)
- Modify: `tests/auth-intake-routing.e2e.spec.ts:185-220`
- Modify: `tests/quiz-onboarding-e2e.spec.ts:30-65`
- Modify: `tests/stripe-subscription-e2e.spec.ts:40-75`
- Modify: `tests/quiz-result-routing.e2e.spec.ts:55-100`
- Modify: `tests/legacy-quiz-email-deliverability.spec.ts:118-125`

**Interfaces:**
- Consumes: the approved copy strings from Global Constraints.
- Produces: green suites; the shared e2e pattern below.

- [ ] **Step 1: Update `tests/editorial-pages.test.tsx`** — replace the three legacy assertions (`Deine Angaben sind gespeichert`, the `QUIZ_ANALYSIS_STEPS` source regex, `Meine Haaranalyse ansehen`) with assertions on the new source copy:

```tsx
  assert.match(analysisSource, /bereit für den nächsten Schritt mit deinem Haar\?/)
  assert.match(analysisSource, /Ja, zeig mir meine Analyse/)
  assert.match(analysisSource, /Deine Haaranalyse wird erstellt\./)
  assert.doesNotMatch(analysisSource, /Meine Haaranalyse ansehen/)
```

Read the surrounding test first — keep its structure (it reads the component source into `analysisSource`); only swap the copy expectations.

- [ ] **Step 2: Update the four e2e specs that click the old CTA.** In each of `auth-intake-routing.e2e.spec.ts`, `quiz-onboarding-e2e.spec.ts`, `stripe-subscription-e2e.spec.ts`, `quiz-result-routing.e2e.spec.ts`, apply the same two-part change:

Replace the old visibility wait:
```ts
await expect(page.getByText("Deine Angaben sind gespeichert", { exact: true })).toBeVisible(...)
```
with:
```ts
await expect(
  page.getByRole("button", { name: "Ja, zeig mir meine Analyse" }),
).toBeVisible({ timeout: 15_000 })
```

Replace the old CTA interaction (`getByRole("button", { name: "Meine Haaranalyse ansehen" })` + click) with a single click on the commitment button — after which navigation happens automatically (loading 2.6 s + ready beat 0.9 s), so any subsequent assertion on the result URL needs `timeout: 15_000` on its `expect`/`waitForURL`:
```ts
await page.getByRole("button", { name: "Ja, zeig mir meine Analyse" }).click()
await page.waitForURL(/\/quiz\/ergebnis|\/results?/, { timeout: 15_000 })
```
IMPORTANT: read each spec's existing post-click assertions first and keep its actual expected URL/next assertion — the four specs continue differently (auth intake, onboarding, stripe, result routing). Only the "wait for transition + click" part is shared.

- [ ] **Step 3: Update `tests/legacy-quiz-email-deliverability.spec.ts:122`** — it only waits for `Deine Angaben sind gespeichert` as a completion signal; replace with the commitment-button visibility wait from Step 2.

- [ ] **Step 4: Run the node suite fully green**

Run: `npm run test:node 2>&1 | tail -10`. Expected: PASS including `editorial-pages` and `quiz-analysis`.

- [ ] **Step 5: Commit**

```bash
git add tests/editorial-pages.test.tsx tests/auth-intake-routing.e2e.spec.ts tests/quiz-onboarding-e2e.spec.ts tests/stripe-subscription-e2e.spec.ts tests/quiz-result-routing.e2e.spec.ts tests/legacy-quiz-email-deliverability.spec.ts
git commit -m "test(quiz): align transition specs with commitment auto-advance flow"
```

---

### Task 5: Verify end-to-end and finish the branch

**Files:** none (verification only)

- [ ] **Step 1: `npm run ci:verify`** (typecheck + lint + build) — must pass.
- [ ] **Step 2: Drive the real flow** — `npm run dev:worktree`, then via Playwright/browser on `http://localhost:<worktree-port>/quiz` (use localhost, never 127.0.0.1 — dev hydration trap): complete the quiz with test data through lead capture, verify: commitment screen appears immediately (no loader), tap „Ja, zeig mir meine Analyse", observe shimmer beat → „Bereit." → automatic navigation to the result page. Also verify the ghost button path and the browser-back-from-result → commitment screen again. Restart the dev server before this check if it was already running (stale deep-lib code).
- [ ] **Step 3: Screenshot the three phases** for the PR record.
- [ ] **Step 4: Whole-branch review** — per CLAUDE.md "Finishing a Feature Branch" step 2. NOTE: Codex usage-limited until Sep 15 → use one internal reviewer pass (code-reviewer agent on `git diff origin/main...HEAD`, read-only brief) instead.
- [ ] **Step 5: Fix real findings, then `/ship`** (publish-only: commit, push, PR — include this plan + mockup screenshots in the PR).
