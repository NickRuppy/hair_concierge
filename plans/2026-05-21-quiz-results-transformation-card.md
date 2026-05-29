# Quiz Results — Before/After Transformation Card

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three confusing red→green "spectrum slider" cards on both the post-quiz conversion page and the public share page with one Before/After transformation card (Option B from `.tmp-previews/quiz-results-redesign.html`). Restructure the lever section to render structured product rows. Update the offer-page hero to lead with the transformation promise.

**Architecture:** One new shared component (`QuizResultTransformationCard`) consumes `narrative.rows` and renders the three rows as parallel Heute (coral/red) → In 4 Wochen (green) columns with a centered arrow. The narrative builder is **additively** extended with a new `needs.products: { name, description }[]` field (the existing `mainLeverTitle` / `mainLeverWhy` / `mainLeverProducts` fields stay so existing test fixtures continue to pass). Both result surfaces render the lever as two structured product rows instead of the existing single paragraph. The offer-page hero becomes a fixed transformation headline.

**Tech Stack:** Next.js 15 + React 19 (client components), Tailwind v4, brand tokens already in `src/app/globals.css`. Tests use `node:test` + `react-dom/server` `renderToStaticMarkup` (existing pattern). Playwright e2e at `tests/quiz-onboarding-e2e.spec.ts`.

**Branch:** `codex/quiz-results-transformation-card` in a new worktree under `.worktrees/quiz-results-transformation-card`, based on `origin/main`.

---

## Decisions (locked)

- **Surface:** Option B from `.tmp-previews/quiz-results-redesign.html`. Applied to **both** result surfaces:
  - `QuizResultOfferPageShell` — the priority
  - `QuizResultsView` — share page + signed-in-subscriber path
- **Column colors:** Heute = coral/red (`var(--brand-coral-light)` → `#FBDDE0`). In 4 Wochen = green (`#E8F4ED` → `#D2EBDB`). Arrow tinted green. Per user feedback after seeing the updated mockup.
- **Ziel timeline label:** "In 4 Wochen" — kept as a stretch claim per user. (Consistent with the comparison table's "Sichtbares Ergebnis: 4 Wochen".)
- **Hero headline (offer page only):** Replace the rendered `narrative.heroHeadline` with the fixed string **"So fühlt sich dein Haar in 4 Wochen an."**. The `narrative.heroHeadline` field stays on the builder type so the narrative unit tests (which assert the builder's output) keep passing. The share view's header ("SO KOMMEN WIR DEINEM HAARZIEL NÄHER") is unchanged.
- **Lever section:** Add a new `needs.products: { name: string, description: string }[]` field to the narrative. Each of the five `buildNeedsSection` branches supplies a 2-entry products array (primary + secondary, in order). Both views render the lever as two styled rows (★ primary / + secondary). The existing `mainLeverTitle` + `mainLeverWhy` headings stay above the rows. The legacy `mainLeverProducts` prose string is **not removed** — it stays on the type for backward compat so the existing narrative-test assertions (4 exact-string pins + 1 partial-regex pin across the five branches) keep passing without rewrites.
- **Copy tightening:** Four `before` / `after` strings are shortened so they don't wrap to 4+ lines at 320 px column width:
  1. `CONCERN_COPY.dryness.after`: `"weichere, besser mit Feuchtigkeit versorgte Längen"` → `"weichere, geschmeidige Längen"`
  2. `CONCERN_COPY.hair_damage.after`: `"kräftiger wirkende, besser geschützte Längen"` → `"kräftigere, geschützte Längen"`
  3. Structural hairFeel `before` (`result-narrative.ts:399`): `"geschwächt & strapaziert"` → `"strapazierte Längen"`
  4. Fallback friction `before` (`result-narrative.ts:738`): `"Pflege, die noch nicht richtig zu deinem Haar passt"` → `"unpassende Pflege"`
- **Per-row icons / scope chips / tick labels:** dropped from the UI. The `iconKey`, `scope`, `tickBefore`, `tickAfter`, `currentPosition`, `targetPosition` fields stay on the type — narrative builder still produces them — for backward compat. They're no longer rendered on either result page.
- **Animations:** existing `animate-fade-in-up` stays. No new motion.
- **Out of scope:** pricing block, comparison table, social proof, guarantee badge, the locked-plan teaser, the share view's `cta` block, the share view's `heroHeadline` (the share view doesn't currently render it). Splitting the share/offer surfaces into divergent layouts. Pruning the unused narrative fields.

---

## Files

**Create:**
- `src/components/quiz/quiz-result-transformation-card.tsx`
- `src/components/quiz/quiz-result-lever-rows.tsx` — shared 2-row lever renderer (used by both views)
- `tests/quiz-result-transformation-card.test.tsx`
- `tests/quiz-result-lever-rows.test.tsx`

**Modify:**
- `src/lib/quiz/result-narrative.ts` — extend `QuizResultNeedsSection` with `products`, populate in all 5 needs branches, tighten 4 copy strings.
- `src/components/quiz/quiz-results-view.tsx` — drop `SpectrumCard` + unused imports; render the new transformation card; render the new lever rows.
- `src/components/quiz/quiz-result-offer-page.tsx` — drop `ResultSliderCard` + unused imports; render the new transformation card; render the new lever rows; replace `{narrative.heroHeadline}` with the fixed string.
- `tests/quiz-result-narrative.test.ts` — update the one pinned `after` assertion at line 163; add 6 new `needs.products` assertions (one per branch + one smoke test in the first test case — see Task 4 step 1); check no narrative-builder test pins the four shortened strings (greps run in Task 8).
- `tests/quiz-results-view.test.tsx` — add transformation card + lever row assertions.
- `tests/result-offer-page.test.tsx` — update the hero assertion; drop the `Haargefühl` assertion; add transformation card + lever row assertions.
- `tests/quiz-onboarding-e2e.spec.ts` — update lines 210-214 and 485-489 to match the new fixed hero "So fühlt sich dein Haar in 4 Wochen an.".

**Delete:** none. All structural narrative fields stay on the type to minimize blast radius.

---

## Task 1: Set up the isolated worktree

**Files:** none yet.

- [ ] **Step 1: Create the worktree on a branch off origin/main**

Run from the repo root (`/Users/nick/AI_work/hair_conscierge`):

```bash
git fetch origin main
npm run worktree:new -- quiz-results-transformation-card
```

Expected: a new worktree at `.worktrees/quiz-results-transformation-card`, on branch `codex/quiz-results-transformation-card`, dependencies installed.

- [ ] **Step 2: Confirm baseline tests pass before touching anything**

Run from inside the worktree:

```bash
npx tsx --test tests/quiz-result-narrative.test.ts tests/quiz-results-view.test.tsx tests/result-offer-page.test.tsx
```

Expected: all three test files pass on `origin/main`. If any fail before changes, stop and investigate.

---

## Task 2: Write the failing test for QuizResultTransformationCard

**Files:**
- Create: `tests/quiz-result-transformation-card.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// tests/quiz-result-transformation-card.test.tsx
import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizResultTransformationCard } from "../src/components/quiz/quiz-result-transformation-card"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"

test("transformation card renders Heute / In 4 Wochen columns with each row's before and after copy", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_bounces",
    concerns: ["dryness"],
    goals: ["less_frizz", "shine"],
  })

  const html = renderToStaticMarkup(
    <QuizResultTransformationCard rows={narrative.rows} />,
  )

  assert.match(html, /Heute/)
  assert.match(html, /In 4 Wochen/)

  for (const row of narrative.rows) {
    assert.ok(
      html.includes(row.before),
      `expected Heute column to contain row.before "${row.before}"`,
    )
    assert.ok(
      html.includes(row.after),
      `expected Ziel column to contain row.after "${row.after}"`,
    )
  }

  // Old slider visuals gone
  assert.doesNotMatch(html, /linear-gradient\(90deg,#E47474/)
  assert.doesNotMatch(html, /linear-gradient\(90deg,#E35858/)
  assert.doesNotMatch(html, /currentPosition|targetPosition/)
})

test("transformation card renders the green arrow connector", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    concerns: ["frizz"],
    goals: ["less_frizz"],
  })

  const html = renderToStaticMarkup(
    <QuizResultTransformationCard rows={narrative.rows} />,
  )

  assert.match(html, /aria-label="Transformation"/i)
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx tsx --test tests/quiz-result-transformation-card.test.tsx
```

Expected: FAIL — "Cannot find module './quiz-result-transformation-card'".

---

## Task 3: Create QuizResultTransformationCard (red/green palette)

**Files:**
- Create: `src/components/quiz/quiz-result-transformation-card.tsx`

- [ ] **Step 1: Write the component**

Layout notes (read these before writing the code):

1. **Paired grid** — each row's Heute/Ziel cells share a CSS grid row so they auto-size to the tallest cell of the pair. This is what keeps `Trockenheit` (1 line) visually anchored to its multi-line Ziel partner.
2. **Vertical centering within rows** — each item cell uses `display: flex; align-items: center` so the shorter side sits on the visual centerline of the taller side (not pinned to the top).
3. **Headers are single-line** — labels are just "Heute" and "In 4 Wochen". No "— jetzt —" / "— mit Chaarlie —" subtitle (they wrap awkwardly at 390 px and break visual symmetry).
4. **Backgrounds** — two absolutely-positioned panels behind the grid, each spans the full card height regardless of cell content.
5. **Brand stamp** — a vertical composition at the column divider: a small white pill with two lines `mit` / `Chaarlie` (mono uppercase, stacked) sits on top of a large white arrow circle. The arrow stays the dominant visual element; the brand label crowns it from above. One sibling element, no separate-piece collisions.
6. **Stamp clearance** — item cells have padding-right (Heute) / padding-left (Ziel) of 42 px so the stamp never collides with row text. Header cells need only 14 px because the stamp is vertically centered (sits between row 1 and row 3, never near the header).

```tsx
// src/components/quiz/quiz-result-transformation-card.tsx
import { Fragment } from "react"
import type { QuizResultNarrativeRow } from "@/lib/quiz/result-narrative"

interface QuizResultTransformationCardProps {
  rows: readonly QuizResultNarrativeRow[]
}

export function QuizResultTransformationCard({ rows }: QuizResultTransformationCardProps) {
  return (
    <article className="relative overflow-hidden rounded-[22px] border border-black/6 bg-white shadow-[0_18px_40px_-28px_rgba(var(--brand-plum-rgb),0.3)] animate-fade-in-up">
      {/* Background panels — each spans the full card height behind the grid */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 z-0 w-1/2 bg-[linear-gradient(180deg,var(--brand-coral-light)_0%,#FBDDE0_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 z-0 w-1/2 bg-[linear-gradient(180deg,#E8F4ED_0%,#D2EBDB_100%)]"
      />

      {/* Paired grid — Heute/Ziel cells in the same row share grid-row height */}
      <div className="relative z-[1] grid grid-cols-2">
        {/* Header row — single-line label, same height both sides. Tighter padding because the stamp is below them. */}
        <div className="px-4 pt-[20px] pb-[18px] pr-[14px] sm:px-5 sm:pr-[14px]">
          <h4 className="font-mono text-[10.5px] font-semibold uppercase leading-[1.2] tracking-[0.16em] text-[var(--brand-coral-dark)]">
            Heute
          </h4>
        </div>
        <div className="px-4 pt-[20px] pb-[18px] pl-[14px] sm:px-5 sm:pl-[14px]">
          <h4 className="font-mono text-[10.5px] font-semibold uppercase leading-[1.2] tracking-[0.16em] text-[#2D8A57]">
            In 4 Wochen
          </h4>
        </div>

        {/* One Fragment per row, emitting two sibling grid cells (heute / ziel).
            Both cells flex-center so the shorter side sits on the centerline of the taller side.
            42 px inner padding clears the stamp composition. */}
        {rows.map((row, index) => {
          const isFirst = index === 0
          const isLast = index === rows.length - 1
          const topPad = isFirst ? "pt-[14px]" : "pt-[10px]"
          const bottomPad = isLast ? "pb-[22px]" : "pb-[10px]"
          return (
            <Fragment key={row.label}>
              <div className={`flex items-center px-4 pr-[42px] sm:px-5 sm:pr-[42px] ${topPad} ${bottomPad}`}>
                <span className="font-header text-[16px] italic leading-[1.3] text-[#6B3439] opacity-95 sm:text-[17px]">
                  {row.before}
                </span>
              </div>
              <div className={`flex items-center px-4 pl-[42px] sm:px-5 sm:pl-[42px] ${topPad} ${bottomPad}`}>
                <span className="font-header text-[16px] font-medium italic leading-[1.3] text-[#1F4D33] sm:text-[17px]">
                  {row.after}
                </span>
              </div>
            </Fragment>
          )
        })}
      </div>

      {/* Brand stamp — vertical composition: small "mit / Chaarlie" pill above a big arrow circle */}
      <div
        aria-label="Mit Chaarlie"
        className="absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[5px]"
      >
        <div className="flex flex-col items-center gap-px rounded-[22px] bg-white/90 px-[10px] py-[5px] shadow-[0_3px_10px_-6px_rgba(45,138,87,0.35)]">
          <span className="font-mono text-[8.5px] font-semibold uppercase leading-[1.15] tracking-[0.14em] text-[#2D8A57]">
            mit
          </span>
          <span className="font-mono text-[8.5px] font-semibold uppercase leading-[1.15] tracking-[0.14em] text-[#2D8A57]">
            Chaarlie
          </span>
        </div>
        <div className="grid size-[38px] place-items-center rounded-full bg-white text-[19px] font-bold leading-none text-[#2D8A57] shadow-[0_8px_20px_-12px_rgba(45,138,87,0.5),0_0_0_4px_rgba(255,255,255,0.9)]" aria-hidden="true">
          →
        </div>
      </div>
    </article>
  )
}
```

**Why the paired-grid + flex-center + vertical-stamp combo matters:**
- Without paired-grid, each side wraps independently and `Trockenheit` (1 line) sits next to `weichere, geschmeidige Längen` (3 lines on a 390 px viewport) at different vertical positions.
- The paired-grid makes both cells share a grid row sized to the taller; the `flex items-center` inside each cell then vertically centers the text within that shared height.
- Stacking the brand pill above a big arrow circle (rather than fusing them into one horizontal pill) keeps the arrow as the dominant visual element while still attributing the transformation to Chaarlie. The vertical composition is ~58 px wide instead of ~110 px, so we need less inner-edge padding on the row cells (42 px each instead of 64 px), leaving more room for German row copy.

- [ ] **Step 2: Run the test, confirm it passes**

```bash
npx tsx --test tests/quiz-result-transformation-card.test.tsx
```

Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/quiz/quiz-result-transformation-card.tsx tests/quiz-result-transformation-card.test.tsx
git commit -m "feat(quiz): add QuizResultTransformationCard (Heute red → In 4 Wochen green)"
```

---

## Task 4: Extend narrative.needs with structured products

**Files:**
- Modify: `src/lib/quiz/result-narrative.ts`
- Modify: `tests/quiz-result-narrative.test.ts`

- [ ] **Step 1: Add new narrative-test assertions for `needs.products` (failing first)**

Edit `tests/quiz-result-narrative.test.ts`. In the first test (around line 32, after the `mainLeverProducts` assertion at line 38), append:

```tsx
  assert.deepEqual(narrative.needs.products, [
    { name: "Conditioner", description: "Stabilisiert die Oberfläche der Längen." },
    { name: "Leave-in", description: "Hält die Wirkung zwischen den Wäschen." },
  ])
```

In the scalp branch test (line 107, after line 144's Kopfhautserum assertion), append:

```tsx
  assert.deepEqual(narrative.needs.products, [
    { name: "Anti-Schuppen-Shampoo", description: "Reguliert die Kopfhaut bei jeder Wäsche." },
    { name: "Kopfhautserum", description: "Hält die Kopfhaut zwischen den Wäschen ruhig." },
  ])
```

In the structural-repair test (around line 218, after line 220's Maske assertion), append:

```tsx
  assert.deepEqual(narrative.needs.products, [
    { name: "Bondbuilder", description: "Stabilisiert die Längen von innen." },
    { name: "Stärkende Maske", description: "Macht die Längen wieder belastbar." },
  ])
```

In the surface-branch test (around line 234), append after the `assert.equal(narrative.needs.mainLeverProducts, …)` line:

```tsx
  assert.deepEqual(narrative.needs.products, [
    { name: "Conditioner", description: "Stabilisiert die Oberfläche der Längen." },
    { name: "Leave-in", description: "Hält die Wirkung zwischen den Wäschen." },
  ])
```

In the split-ends branch test (around line 269), append:

```tsx
  assert.deepEqual(narrative.needs.products, [
    { name: "Leichtes Haaröl", description: "Schützt und glättet die Spitzen." },
    { name: "Leave-in", description: "Hält die Spitzen geschmeidig." },
  ])
```

In the fallback branch test (around line 285), append:

```tsx
  assert.deepEqual(narrative.needs.products, [
    { name: "Conditioner", description: "Stimmt die Pflegebasis ab." },
    { name: "Leichtes Leave-in", description: "Hält die Wirkung in den Längen." },
  ])
```

- [ ] **Step 2: Run the narrative test and confirm it fails**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: FAIL — `narrative.needs.products` is `undefined`.

- [ ] **Step 3: Edit `src/lib/quiz/result-narrative.ts`**

(a) Extend the `QuizResultNeedsSection` interface (lines 55–60):

```ts
interface QuizResultNeedsProduct {
  name: string
  description: string
}

interface QuizResultNeedsSection {
  title: string
  mainLeverTitle: string
  mainLeverWhy: string
  mainLeverProducts: string
  products: readonly [QuizResultNeedsProduct, QuizResultNeedsProduct]
}
```

Export the new product type for component consumers:

```ts
export type { QuizResultNeedsProduct }
```

(b) Update each of the five `buildNeedsSection` branches to include a `products` tuple. Insert just before the closing `}` of each `return` block:

For the **scalp / dandruff** branch (the `if (primaryGoal === "healthy_scalp" || …)` block, around line 843):

```ts
      products: [
        { name: "Anti-Schuppen-Shampoo", description: "Reguliert die Kopfhaut bei jeder Wäsche." },
        { name: "Kopfhautserum", description: "Hält die Kopfhaut zwischen den Wäschen ruhig." },
      ],
```

For the **structural repair** branch (`if (needsStructuralRepair)`, around line 860):

```ts
      products: [
        { name: "Bondbuilder", description: "Stabilisiert die Längen von innen." },
        { name: "Stärkende Maske", description: "Macht die Längen wieder belastbar." },
      ],
```

For the **surface support** branch (`if (needsSurfaceSupport)`, around line 880):

```ts
      products: [
        { name: "Conditioner", description: "Stabilisiert die Oberfläche der Längen." },
        { name: "Leave-in", description: "Hält die Wirkung zwischen den Wäschen." },
      ],
```

For the **split-ends** branch (around line 891):

```ts
      products: [
        { name: "Leichtes Haaröl", description: "Schützt und glättet die Spitzen." },
        { name: "Leave-in", description: "Hält die Spitzen geschmeidig." },
      ],
```

For the **default fallback** (around line 902, the unconditional final `return`):

```ts
    products: [
      { name: "Conditioner", description: "Stimmt die Pflegebasis ab." },
      { name: "Leichtes Leave-in", description: "Hält die Wirkung in den Längen." },
    ],
```

- [ ] **Step 4: Run the narrative test, confirm PASS**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: all PASS, including the existing `mainLeverProducts` assertions (which are unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz/result-narrative.ts tests/quiz-result-narrative.test.ts
git commit -m "feat(quiz): add structured products to narrative.needs"
```

---

## Task 5: Create QuizResultLeverRows component

**Files:**
- Create: `src/components/quiz/quiz-result-lever-rows.tsx`
- Create: `tests/quiz-result-lever-rows.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/quiz-result-lever-rows.test.tsx
import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizResultLeverRows } from "../src/components/quiz/quiz-result-lever-rows"

test("lever rows renders the primary product with a star and the secondary product with a plus", () => {
  const html = renderToStaticMarkup(
    <QuizResultLeverRows
      products={[
        { name: "Conditioner", description: "Stabilisiert die Oberfläche der Längen." },
        { name: "Leave-in", description: "Hält die Wirkung zwischen den Wäschen." },
      ]}
    />,
  )

  assert.match(html, /Conditioner/)
  assert.match(html, /Stabilisiert die Oberfläche der Längen\./)
  assert.match(html, /Leave-in/)
  assert.match(html, /Hält die Wirkung zwischen den Wäschen\./)
  assert.match(html, /aria-label="Primärer Hebel"/)
  assert.match(html, /aria-label="Sekundärer Hebel"/)
})
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
npx tsx --test tests/quiz-result-lever-rows.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// src/components/quiz/quiz-result-lever-rows.tsx
import type { QuizResultNeedsProduct } from "@/lib/quiz/result-narrative"

interface QuizResultLeverRowsProps {
  products: readonly [QuizResultNeedsProduct, QuizResultNeedsProduct]
}

export function QuizResultLeverRows({ products }: QuizResultLeverRowsProps) {
  const [primary, secondary] = products

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-label="Primärer Hebel"
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--brand-coral-light)] text-[14px] font-bold text-[var(--brand-coral-dark)]"
        >
          ★
        </span>
        <div>
          <h3 className="font-header text-[17px] font-medium leading-[1.25] text-[var(--brand-plum-darkest)]">
            {primary.name}
          </h3>
          <p className="mt-1 text-[13.5px] leading-[1.5] text-muted-foreground">
            {primary.description}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span
          aria-label="Sekundärer Hebel"
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--brand-plum-ice)] text-[14px] font-bold text-[var(--brand-plum)]"
        >
          +
        </span>
        <div>
          <h3 className="font-header text-[17px] font-medium leading-[1.25] text-[var(--brand-plum-darkest)]">
            {secondary.name}
          </h3>
          <p className="mt-1 text-[13.5px] leading-[1.5] text-muted-foreground">
            {secondary.description}
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
npx tsx --test tests/quiz-result-lever-rows.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/quiz/quiz-result-lever-rows.tsx tests/quiz-result-lever-rows.test.tsx
git commit -m "feat(quiz): add QuizResultLeverRows component"
```

---

## Task 6: Wire QuizResultsView (share page)

**Files:**
- Modify: `src/components/quiz/quiz-results-view.tsx`
- Modify: `tests/quiz-results-view.test.tsx`

- [ ] **Step 1: Update the share-view test (failing first)**

Replace `tests/quiz-results-view.test.tsx` entirely with:

```tsx
import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { QuizResultsView } from "../src/components/quiz/quiz-results-view"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"

test("shared results view renders transformation card + structured lever rows", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "leicht_uneben",
    pulltest: "stretches_bounces",
    concerns: ["dryness"],
    goals: ["shine"],
  })

  const html = renderToStaticMarkup(
    <QuizResultsView
      name="Lea"
      narrative={narrative}
      primaryAction={{ label: "QUIZ STARTEN", href: "/quiz" }}
      secondaryAction={{ label: "ERGEBNIS TEILEN", href: "/result/demo" }}
    />,
  )

  assert.match(html, /SO KOMMEN WIR DEINEM HAARZIEL NÄHER/i)
  assert.match(html, /WAS DEIN HAAR JETZT BRAUCHT/i)
  assert.match(html, /ERGEBNIS TEILEN/i)

  // Transformation card
  assert.match(html, /Heute/)
  assert.match(html, /In 4 Wochen/)

  // Lever rows
  assert.match(html, /Primärer Hebel/)
  assert.match(html, /Sekundärer Hebel/)
  assert.match(html, /Conditioner/)

  // Old visuals gone
  assert.doesNotMatch(html, /linear-gradient\(90deg,#E35858/)
  assert.doesNotMatch(html, /Worauf wir hinarbeiten/i)
  assert.doesNotMatch(html, /<a[^>]*>\s*<button/i)
  assert.doesNotMatch(html, /DEINE HAAR-DIAGNOSE|Teile deine Diagnose|ALS BILD SPEICHERN|WHATSAPP/i)
})
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
npx tsx --test tests/quiz-results-view.test.tsx
```

Expected: FAIL on the new transformation-card / lever-row assertions.

- [ ] **Step 3: Edit `src/components/quiz/quiz-results-view.tsx`**

(a) Replace the top imports with:

```tsx
"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { QuizResultTransformationCard } from "@/components/quiz/quiz-result-transformation-card"
import { QuizResultLeverRows } from "@/components/quiz/quiz-result-lever-rows"
import type { QuizResultNarrative } from "@/lib/quiz/result-narrative"
```

(b) Delete the `ICONS` constant (lines 26–39), the `CARD_DELAYS` constant (line 41), and the entire `SpectrumCard` function (lines 56–132).

(c) Replace the rows-rendering block (currently lines 205–209) with:

```tsx
      <div className="mb-8">
        <QuizResultTransformationCard rows={narrative.rows} />
      </div>
```

(d) Replace the lever paragraph in the `needs` section (currently lines 218–223 — the two `<p>` tags rendering `mainLeverWhy` and `mainLeverProducts`) with:

```tsx
        <p className="mt-3 max-w-[48ch] text-[15.5px] leading-[1.65] text-foreground sm:text-[17px]">
          {narrative.needs.mainLeverWhy}
        </p>
        <div className="mt-5">
          <QuizResultLeverRows products={narrative.needs.products} />
        </div>
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
npx tsx --test tests/quiz-results-view.test.tsx tests/quiz-result-transformation-card.test.tsx tests/quiz-result-lever-rows.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/quiz/quiz-results-view.tsx tests/quiz-results-view.test.tsx
git commit -m "feat(quiz): swap share view to transformation card + lever rows"
```

---

## Task 7: Wire QuizResultOfferPageShell + new hero

**Files:**
- Modify: `src/components/quiz/quiz-result-offer-page.tsx`
- Modify: `tests/result-offer-page.test.tsx`
- Modify: `tests/quiz-onboarding-e2e.spec.ts`

- [ ] **Step 1: Update offer-page test (failing first)**

Open `tests/result-offer-page.test.tsx`. Replace the `Haargefühl` assertion at line 23 with new transformation card + lever assertions, and change the hero assertion at line 22.

Specifically:

Replace lines 22–24:

```tsx
  assert.match(html, /Dein Haar braucht mehr Protein als Feuchtigkeit\./i)
  assert.match(html, /Haargefühl/i)
  assert.match(html, /Was dein Haar jetzt braucht/i)
```

…with:

```tsx
  // New fixed hero
  assert.match(html, /So fühlt sich dein Haar in 4 Wochen an\./i)
  // Transformation card
  assert.match(html, /Heute/)
  assert.match(html, /In 4 Wochen/)
  // Lever block
  assert.match(html, /Was dein Haar jetzt braucht/i)
  assert.match(html, /Primärer Hebel/)
  assert.match(html, /Sekundärer Hebel/)
  // Old per-row label chips gone
  assert.doesNotMatch(html, /Haargefühl/i)
  assert.doesNotMatch(html, /Worauf wir hinarbeiten/i)
```

- [ ] **Step 2: Update the e2e spec hero pin**

Edit `tests/quiz-onboarding-e2e.spec.ts`. At lines 210-214, change:

```ts
          name: /Dein Haar braucht mehr Protein als Feuchtigkeit/i,
```

…to:

```ts
          name: /So fühlt sich dein Haar in 4 Wochen an/i,
```

And at lines 485-489, change:

```ts
          name: /Dein Haar braucht mehr Feuchtigkeit als Protein/i,
```

…to:

```ts
          name: /So fühlt sich dein Haar in 4 Wochen an/i,
```

(Both occurrences now look for the same fixed hero string.)

- [ ] **Step 3: Run offer-page test, confirm FAIL**

```bash
npx tsx --test tests/result-offer-page.test.tsx
```

Expected: FAIL on new assertions.

- [ ] **Step 4: Edit `src/components/quiz/quiz-result-offer-page.tsx`**

(a) Replace the per-row lucide imports at the top with only the ones used elsewhere on the page. Inspect lines 1–18, drop `Droplets, Heart, Leaf, Link2Off, Palette, Scissors, Shield, ShieldCheck, Sparkles, Waves` (verify each is unused after this change). Keep `Check`, `LockKeyhole`, `MessageCircle`.

(b) Remove the `ICONS: Record<QuizResultIconKey, LucideIcon>` constant (lines 40–53).

(c) Remove the entire `ResultSliderCard` function (lines 95–151).

(d) Remove the `QuizResultIconKey` import from `@/lib/quiz/result-narrative` if no longer referenced after the above deletions.

(e) Add the new imports:

```tsx
import { QuizResultTransformationCard } from "@/components/quiz/quiz-result-transformation-card"
import { QuizResultLeverRows } from "@/components/quiz/quiz-result-lever-rows"
```

(f) Replace the hero in the top section (currently lines 278–280):

```tsx
          <h1 className="font-header text-[clamp(24px,7vw,34px)] font-medium leading-[1.14] text-[var(--brand-plum-darkest)]">
            {narrative.heroHeadline}
          </h1>
```

…with:

```tsx
          <h1 className="font-header text-[clamp(24px,7vw,34px)] font-medium leading-[1.14] text-[var(--brand-plum-darkest)]">
            So fühlt sich dein Haar in 4 Wochen an.
          </h1>
```

(g) Replace the diagnosis section rows loop (currently lines 283–286):

```tsx
        <section className="space-y-3 border-t border-border py-8">
          {narrative.rows.map((row) => (
            <ResultSliderCard key={row.label} row={row} />
          ))}
```

…with:

```tsx
        <section className="space-y-4 border-t border-border py-8">
          <QuizResultTransformationCard rows={narrative.rows} />
```

(h) Replace the lever `<p>` (currently line 298, the `mainLeverProducts` paragraph) with:

```tsx
            <p className="mt-4 text-[14.5px] leading-[1.65] text-[var(--brand-plum-darkest)]">
              {narrative.needs.mainLeverWhy}
            </p>
            <div className="mt-5">
              <QuizResultLeverRows products={narrative.needs.products} />
            </div>
```

Drop the existing `mt-3 text-[14.5px] leading-[1.65] text-muted-foreground` paragraph that rendered `mainLeverProducts`.

- [ ] **Step 5: Run offer-page test, confirm PASS**

```bash
npx tsx --test tests/result-offer-page.test.tsx tests/quiz-result-transformation-card.test.tsx tests/quiz-result-lever-rows.test.tsx
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/quiz/quiz-result-offer-page.tsx tests/result-offer-page.test.tsx tests/quiz-onboarding-e2e.spec.ts
git commit -m "feat(quiz): swap offer page to transformation card + new hero"
```

---

## Task 8: Shorten the four over-long `before` / `after` strings

**Files:**
- Modify: `src/lib/quiz/result-narrative.ts`
- Modify: `tests/quiz-result-narrative.test.ts`

- [ ] **Step 1: Grep for any other tests or sources pinning the four strings**

Run from the worktree:

```bash
grep -rn "weichere, besser mit Feuchtigkeit versorgte\|kräftiger wirkende, besser geschützte\|geschwächt & strapaziert\|Pflege, die noch nicht richtig zu deinem Haar passt" tests/ src/
```

Expected matches (from codex review):
- `tests/quiz-result-narrative.test.ts:163` — pinned `dryness` after — **update this** in Step 2.
- `src/lib/quiz/result-narrative.ts:144` — the dryness phrase appears as `GOAL_COPY.moisture.intro` ("weichere, besser mit Feuchtigkeit versorgte Längen" embedded in a prose intro sentence). **Do NOT change line 144.** That string is used in the page's intro paragraph ("Du hast gesagt, dass du dir … wünschst"), not in the before/after card columns, and tightening it here would break the intro's grammar. If a later plan refines intro copy, that's the right place to touch it.
- `src/lib/quiz/result-narrative.ts:98, 126, 399, 738` — these are the four source strings we ARE changing in this task.

If grep surfaces anything outside this expected set, investigate before changing.

- [ ] **Step 2: Update narrative test assertions for the four edits (failing first)**

At line 163 of `tests/quiz-result-narrative.test.ts`, replace:

```tsx
    assert.equal(narrative.rows[1]?.after, "weichere, besser mit Feuchtigkeit versorgte Längen")
```

…with:

```tsx
    assert.equal(narrative.rows[1]?.after, "weichere, geschmeidige Längen")
```

For any matches found in Step 1 for the other three strings, update them to:
- `"kräftiger wirkende, besser geschützte Längen"` → `"kräftigere, geschützte Längen"`
- `"geschwächt & strapaziert"` → `"strapazierte Längen"`
- `"Pflege, die noch nicht richtig zu deinem Haar passt"` → `"unpassende Pflege"`

- [ ] **Step 3: Run narrative test, confirm FAIL**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: FAIL on the updated assertions.

- [ ] **Step 4: Edit `src/lib/quiz/result-narrative.ts`**

Make the four substitutions:

At line 98 (`CONCERN_COPY.dryness.after`):
```ts
    after: "weichere, geschmeidige Längen",
```

At line 126 (`CONCERN_COPY.hair_damage.after`):
```ts
    after: "kräftigere, geschützte Längen",
```

At line 399 (the structural hairFeel `before`):
```ts
      before: "strapazierte Längen",
```

At line 738 (the fallback friction `before`):
```ts
        before: "unpassende Pflege",
```

- [ ] **Step 5: Run narrative test, confirm PASS**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/quiz/result-narrative.ts tests/quiz-result-narrative.test.ts
git commit -m "feat(quiz): tighten 4 row strings for tight column layout"
```

---

## Task 9: Verification + manual browser check + codex review + PR

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full quiz-related test suite**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts tests/quiz-results-view.test.tsx tests/result-offer-page.test.tsx tests/quiz-result-transformation-card.test.tsx tests/quiz-result-lever-rows.test.tsx
```

Expected: ALL PASS.

- [ ] **Step 2: Run the CI gate**

```bash
npm run ci:verify
```

Expected: PASS (typecheck + lint + build). If lint reports unused imports in either modified component, remove them.

- [ ] **Step 3: Run the Playwright e2e specs that touch the result page**

```bash
npm run test:e2e -- tests/quiz-onboarding-e2e.spec.ts tests/auth-intake-routing.e2e.spec.ts
```

(Or whichever script the project uses to run Playwright — check `package.json`. If e2e tests are typically run in CI rather than locally, document this and skip locally.)

Expected: in `quiz-onboarding-e2e.spec.ts` the two hero-related lines (210-214, 485-489) now find "So fühlt sich dein Haar in 4 Wochen an." and PASS. In `auth-intake-routing.e2e.spec.ts` the result-heading + CTA assertion at line 181 still PASSES — that test asserts on the share view's section labels ("SO KOMMEN WIR DEINEM HAARZIEL NÄHER" / "WAS DEIN HAAR JETZT BRAUCHT") which are unchanged. If it fails, the share view wiring in Task 6 has regressed those labels.

- [ ] **Step 4: Manual visual check on both surfaces**

Start the dev server in the worktree:

```bash
npm run dev:worktree
```

In a 390 px Chrome devtools viewport (iPhone 14), then also at 320 px (iPhone SE):

1. Visit `http://localhost:<port>/result/b6eca72a-6b8a-4fae-894d-5315beea32f8`. Confirm:
   - Heute column = coral / red tint, In 4 Wochen column = green tint, green arrow centered.
   - Three before/after rows fit on one screen, none wrap to 4+ lines at 320 px.
   - Lever section shows ★ Conditioner + + Leave-in (or appropriate primary/secondary for this lead) as two rows.
2. Step through `/quiz` (or use an existing flow path) to land on the **offer page** post-quiz. Confirm:
   - Hero says "So fühlt sich dein Haar in 4 Wochen an." (the verdict line is gone).
   - Same transformation card appears.
   - Same lever rows.
   - Comparison table, pricing, social proof unchanged.

Capture screenshots for the PR.

- [ ] **Step 5: Chat eval regression check**

```bash
npm run test:chat
```

Expected: no new regressions.

- [ ] **Step 6: Codex whole-branch review**

Per `CLAUDE.md` → "Finishing a Feature Branch": dispatch the `codex:codex-rescue` agent (via the Agent tool, `subagent_type: "codex:codex-rescue"`) on the full branch diff:

```bash
git diff main...HEAD
```

Ask the agent to specifically verify:
- The new components use brand CSS variables, not hardcoded hex literals (except the green palette where there are no brand tokens — those are inline by design).
- All five `buildNeedsSection` branches now populate `products`. No branch returns a needs section without it (would be a TypeScript error, but verify nothing slipped through `as` casts).
- No leftover references to `SpectrumCard`, `ResultSliderCard`, or per-row icon constants in component code.
- The e2e spec change covers both occurrences (210-214, 485-489) — no other hero-pin slipped through.

Fix real findings. Skip false positives.

- [ ] **Step 7: Push and open the PR**

```bash
git push -u origin codex/quiz-results-transformation-card
gh pr create --title "feat(quiz): before/after transformation card on result pages" --body "$(cat <<'EOF'
## Summary
- Replaces 3 confusing red→green spectrum sliders with one Heute (coral/red) → In 4 Wochen (green) transformation card on both the post-quiz offer page and the public share page.
- Adds `QuizResultTransformationCard` + `QuizResultLeverRows` (shared by both surfaces).
- Extends `narrative.needs` with structured `products: { name, description }[]` so the lever section becomes two styled rows (★ primary / + secondary) instead of a single prose paragraph.
- Replaces the offer-page hero with the fixed "So fühlt sich dein Haar in 4 Wochen an." (e2e spec pins updated).
- Tightens four over-long row strings (dryness/hair_damage `after`, structural/fallback `before`) so they don't wrap badly in tight columns.
- Mockup at `.tmp-previews/quiz-results-redesign.html` (Option B).

## Test plan
- [x] `npx tsx --test tests/quiz-result-narrative.test.ts tests/quiz-results-view.test.tsx tests/result-offer-page.test.tsx tests/quiz-result-transformation-card.test.tsx tests/quiz-result-lever-rows.test.tsx`
- [x] `npm run ci:verify`
- [x] Playwright e2e spec passes with updated hero pins
- [x] Manual mobile check at 320 + 390 px on `/result/[leadId]` and post-quiz offer
- [x] `npm run test:chat` (no regressions)
- [x] Codex whole-branch review

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope (explicit non-goals)

- Pruning the unused `iconKey`, `scope`, `tickBefore`, `tickAfter`, `currentPosition`, `targetPosition` fields from `QuizResultNarrativeRow`. They stay — separate cleanup plan.
- Pruning the legacy `mainLeverProducts` prose string from `QuizResultNeedsSection`. Stays so the 5 pinned narrative-test assertions remain unbroken.
- Restructuring the share-view header lockup, the comparison table, social proof, pricing, the guarantee badge, or the locked-plan teaser.
- Splitting the share page from the offer page into divergent layouts.
- Re-tuning the rest of `CONCERN_COPY` / `GOAL_COPY` beyond the 4 strings listed.
- Adding new animations beyond the existing `animate-fade-in-up`.

---

## Self-review notes

- **Spec coverage:** every "Decisions (locked)" entry maps to a task. TransformationCard → Tasks 2–3 (with new red/green colors); structured products → Task 4; LeverRows → Task 5; share view → Task 6; offer page + hero + e2e → Task 7; copy tightening → Task 8; verification → Task 9.
- **Placeholder scan:** no "TBD", "TODO", "implement later". Every code step shows the exact code or exact replacement.
- **Type consistency:** `QuizResultLeverRows` takes `products: readonly [Product, Product]` (Task 5), and `narrative.needs.products` is declared as the same readonly 2-tuple (Task 4). Both views pass `narrative.needs.products` directly. ✓
- **Test coverage of new branches:** Tasks 4 step 1 lists six places where `needs.products` is asserted — covering all five `buildNeedsSection` return branches plus the smoke-test in the first narrative test. ✓
- **e2e coverage:** Task 7 step 2 updates both occurrences in `quiz-onboarding-e2e.spec.ts` (210-214 + 485-489). ✓
- **Color tokens:** Heute uses `--brand-coral-light` (existing token). In 4 Wochen uses inline green hex literals because no green token exists. Acceptable because the green is page-local; if reused, lift to `globals.css` in a follow-up.
