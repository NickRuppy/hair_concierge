# Quiz Results Narrative Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the quiz results page feel genuinely personalized by connecting the spectrum cards to quiz-derived severity, tightening the row copy, and adding a concise “what your hair needs now” bridge into the detailed routine.

**Architecture:** Keep `buildQuizResultNarrative()` as the single source of truth for row scopes, slider positions, one main lever, and the CTA lead-in copy. Use lightweight quiz-local scoring helpers inspired by the recommendation engine’s damage/care-needs approach, but do not import the full recommendation runtime because the results page only has quiz answers, not the full normalized onboarding profile.

**Tech Stack:** Next.js App Router, React, TypeScript, Zustand, lucide-react, Node `node:test`, Playwright

**Spec:** Thread design agreement from April 20, 2026 (results follow-up: combined Row 1 scoring, real slider positions, single main lever, concise CTA bridge)

---

## File Map

| Task | Creates | Modifies |
|------|---------|----------|
| 1: Narrative contract + scoring | — | `src/lib/quiz/result-narrative.ts`, `tests/quiz-result-narrative.test.ts` |
| 2: Results UI + E2E coverage | — | `src/components/quiz/quiz-results.tsx`, `tests/quiz-onboarding-e2e.spec.ts`, `tests/auth-intake-routing.e2e.spec.ts` |
| 3: Final verification | — | — |

## Shared Decisions To Preserve

- Remove the extra reveal line `Das ist dein Haarprofil — berechnet aus deinen Antworten.`
- Keep the page headline `SO KOMMEN WIR DEINEM HAARZIEL NÄHER`
- Row roles stay fixed:
  - `Haargefühl`
  - `Was dich gerade ausbremst`
  - `Worauf wir hinarbeiten`
- Add a short scope badge to each row header instead of repeating `in den Längen / in der Kopfhaut` inside both value texts
- Slider semantics:
  - `currentPosition` = severity now
  - bucketed positions only: `18`, `34`, `50`, `66`, `82`
  - fixed `targetPosition` per row:
    - `Haargefühl` = `78`
    - `Was dich gerade ausbremst` = `84`
    - `Worauf wir hinarbeiten` = `88`
- Row 1 uses combined scoring (`structural`, `surface`, `scalp`) and then chooses the dominant copy family
- Row 3 left copy is concise and deficit-led:
  - `wenig Glanz`
  - `wenig Ruhe`
  - `wenig Definition`
  - `wenig Kontrolle`
- `Was dein Haar jetzt braucht` shows exactly:
  - one short reassurance + rationale sentence
  - one main lever only
  - one product-category-specific bridge sentence
- CTA block must explain that the next step is the detailed routine, plan, and products

---

### Task 1: Narrative Contract + Scoring

**Context:** The current narrative builder already picks `primaryConcern`, `primaryGoal`, icons, and tick labels, but it still uses a priority cascade for Row 1, fixed 0/100 marker placement, a now-removed reveal line, and no “needs” or CTA lead-in model. This task locks the new data contract in tests first, then implements it in `result-narrative.ts`.

**Files:**
- Modify: `src/lib/quiz/result-narrative.ts`
- Test: `tests/quiz-result-narrative.test.ts`

- [ ] **Step 1: Write failing contract tests for scopes, positions, concise goal copy, and needs**

Add these tests to `tests/quiz-result-narrative.test.ts`:

```typescript
test("surface-led results expose scope labels, bucketed positions, and concise goal copy", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_bounces",
    concerns: ["frizz"],
    goals: ["less_frizz", "shine"],
  })

  assert.equal(narrative.rows[0]?.label, "Haargefühl")
  assert.equal(narrative.rows[0]?.scope, "LÄNGEN")
  assert.equal(narrative.rows[0]?.currentPosition, 66)
  assert.equal(narrative.rows[0]?.targetPosition, 78)

  assert.equal(narrative.rows[1]?.label, "Was dich gerade ausbremst")
  assert.equal(narrative.rows[1]?.scope, "LÄNGEN")
  assert.equal(narrative.rows[1]?.currentPosition, 66)
  assert.equal(narrative.rows[1]?.targetPosition, 84)

  assert.equal(narrative.rows[2]?.label, "Worauf wir hinarbeiten")
  assert.equal(narrative.rows[2]?.scope, "LÄNGEN")
  assert.equal(narrative.rows[2]?.before, "wenig Kontrolle")
  assert.equal(narrative.rows[2]?.after, "mehr Geschmeidigkeit & Kontrolle")
  assert.equal(narrative.rows[2]?.currentPosition, 50)
  assert.equal(narrative.rows[2]?.targetPosition, 88)

  assert.equal(narrative.needs.title, "Was dein Haar jetzt braucht")
  assert.equal(narrative.needs.mainLeverLabel, "Jetzt zuerst")
  assert.equal(narrative.needs.mainLeverTitle, "Mehr Schutz für Oberfläche und Längen aufbauen")
  assert.match(narrative.needs.mainLeverBody, /Conditioner/i)
  assert.match(narrative.needs.mainLeverBody, /Leave-in/i)

  assert.equal(narrative.cta.lead, "Das ist dein Überblick")
  assert.match(narrative.cta.subline, /persönlichen Pflegeplan/i)
})

test("dandruff fallback becomes scalp-scoped and names scalp-specific categories", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "fettig",
    has_scalp_issue: true,
    scalp_condition: "schuppen",
    concerns: [],
    goals: ["healthy_scalp"],
  })

  assert.equal(narrative.primaryConcern, null)
  assert.equal(narrative.rows[0]?.scope, "KOPFHAUT")
  assert.equal(narrative.rows[1]?.scope, "KOPFHAUT")
  assert.equal(narrative.rows[2]?.scope, "KOPFHAUT")
  assert.equal(narrative.rows[2]?.before, "wenig Ruhe")
  assert.equal(narrative.rows[2]?.after, "mehr Ruhe & Ausgeglichenheit")
  assert.equal(narrative.rows[1]?.currentPosition, 66)
  assert.equal(narrative.rows[2]?.currentPosition, 50)
  assert.equal(narrative.needs.mainLeverTitle, "Die Kopfhaut gezielter ausgleichen")
  assert.match(narrative.needs.mainLeverBody, /Anti-Schuppen-Shampoo/i)
})

test("severe structural signals can mention a bondbuilder in the main lever", () => {
  const narrative = buildQuizResultNarrative({
    structure: "wavy",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_stays",
    treatment: ["blondiert"],
    concerns: ["breakage", "hair_damage"],
    goals: ["anti_breakage", "healthier_hair"],
  })

  assert.equal(narrative.rows[0]?.scope, "HAAR")
  assert.equal(narrative.rows[0]?.currentPosition, 82)
  assert.equal(narrative.rows[1]?.currentPosition, 82)
  assert.equal(narrative.rows[2]?.before, "wenig Stabilität")
  assert.match(narrative.needs.mainLeverBody, /Bondbuilder/i)
})
```

- [ ] **Step 2: Run the narrative unit tests to verify they fail**

Run:

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected:
- FAIL because `scope`, `currentPosition`, `targetPosition`, and `needs` do not exist yet
- FAIL because Row 3 still uses the old `mehr ...` left copy
- FAIL because `cta.lead` is not present and the old `reveal` string still exists in the return shape

- [ ] **Step 3: Extend the narrative types and base constants**

In `src/lib/quiz/result-narrative.ts`, add the new row scope, bucket, positions, and needs-section types near the existing icon/type declarations:

```typescript
export type QuizResultScope =
  | "HAAR"
  | "LÄNGEN"
  | "SPITZEN"
  | "KOPFHAUT"
  | "ANSATZ"
  | "WELLEN & LOCKEN"

type SeverityBucket = "very_low" | "low" | "medium" | "high" | "very_high"

const BUCKET_TO_POSITION: Record<SeverityBucket, number> = {
  very_low: 18,
  low: 34,
  medium: 50,
  high: 66,
  very_high: 82,
}

const ROW_TARGET_POSITIONS = {
  hairFeel: 78,
  friction: 84,
  outcome: 88,
} as const

export interface QuizResultNarrativeRow {
  label: "Haargefühl" | "Was dich gerade ausbremst" | "Worauf wir hinarbeiten"
  scope: QuizResultScope
  before: string
  after: string
  iconKey: QuizResultIconKey
  tickBefore: string
  tickAfter: string
  currentPosition: number
  targetPosition: number
}

interface QuizResultNeedsSection {
  title: string
  summary: string
  mainLeverLabel: string
  mainLeverTitle: string
  mainLeverBody: string
}

export interface QuizResultNarrative {
  intro: string
  rows: [QuizResultNarrativeRow, QuizResultNarrativeRow, QuizResultNarrativeRow]
  needs: QuizResultNeedsSection
  cta: {
    lead: string
    subline: string
    label: string
  }
  primaryConcern: QuizConcern | null
  primaryGoal: Goal | null
}
```

- [ ] **Step 4: Replace the Row 1 priority cascade with combined score helpers**

Still in `src/lib/quiz/result-narrative.ts`, add quiz-local scoring helpers above the row builders. Mirror the engine’s “multiple subscores + level mapping” style, but stay local to quiz answers:

```typescript
function scoreToBucket(score: number): SeverityBucket {
  if (score >= 8) return "very_high"
  if (score >= 6) return "high"
  if (score >= 4) return "medium"
  if (score >= 2) return "low"
  return "very_low"
}

function buildHairFeelScores(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
) {
  let structural = 0
  let surface = 0
  let scalp = 0

  if (answers.pulltest === "stretches_stays") structural += 3
  if (answers.pulltest === "snaps") structural += 2
  if (hasColorTreatment(answers)) structural += 3
  if (primaryConcern === "breakage" || primaryConcern === "hair_damage") structural += 3
  if (primaryConcern === "split_ends") structural += 2
  if (
    primaryGoal === "anti_breakage" ||
    primaryGoal === "strengthen" ||
    primaryGoal === "healthier_hair"
  ) {
    structural += 2
  }

  if (answers.fingertest === "rau") surface += 3
  if (answers.fingertest === "leicht_uneben") surface += 2
  if (primaryConcern === "dryness" || primaryConcern === "frizz" || primaryConcern === "tangling") {
    surface += 2
  }
  if (
    primaryGoal === "moisture" ||
    primaryGoal === "shine" ||
    primaryGoal === "less_frizz" ||
    primaryGoal === "curl_definition"
  ) {
    surface += 2
  }

  if (answers.scalp_condition) scalp += 4
  if (answers.scalp_type === "fettig" || answers.scalp_type === "trocken") scalp += 3
  if (primaryGoal === "healthy_scalp") scalp += 2

  return { structural, surface, scalp }
}

function resolveDominantHairFeelAxis(scores: ReturnType<typeof buildHairFeelScores>) {
  const entries = [
    ["scalp", scores.scalp],
    ["structural", scores.structural],
    ["surface", scores.surface],
  ] as const

  return [...entries].sort((left, right) => right[1] - left[1])[0][0]
}
```

Use those helpers in `buildHairFeelRow()`. Keep the copy families concise:

```typescript
function buildHairFeelRow(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
): QuizResultNarrativeRow {
  const scores = buildHairFeelScores(answers, primaryConcern, primaryGoal)
  const dominantAxis = resolveDominantHairFeelAxis(scores)

  if (dominantAxis === "scalp") {
    const before =
      answers.scalp_condition === "gereizt"
        ? "unruhig & gereizt"
        : answers.scalp_type === "fettig"
          ? "schnell fettig & schwer"
          : "unruhig & unausgeglichen"

    return {
      label: "Haargefühl",
      scope: "KOPFHAUT",
      before,
      after: "ruhiger & ausgeglichener",
      iconKey: answers.scalp_condition === "gereizt" ? "heart" : "leaf",
      tickBefore: "unruhig",
      tickAfter: "ausgeglichen",
      currentPosition: BUCKET_TO_POSITION[scoreToBucket(scores.scalp)],
      targetPosition: ROW_TARGET_POSITIONS.hairFeel,
    }
  }

  if (dominantAxis === "structural") {
    return {
      label: "Haargefühl",
      scope: "HAAR",
      before: "geschwächt & strapaziert",
      after: "kräftiger & geschützter",
      iconKey: "shield",
      tickBefore: "strapaziert",
      tickAfter: "geschützt",
      currentPosition: BUCKET_TO_POSITION[scoreToBucket(scores.structural)],
      targetPosition: ROW_TARGET_POSITIONS.hairFeel,
    }
  }

  return {
    label: "Haargefühl",
    scope: "LÄNGEN",
    before: primaryConcern === "dryness" || primaryGoal === "moisture"
      ? "trocken & spröde"
      : "stumpf & unruhig",
    after: primaryConcern === "dryness" || primaryGoal === "moisture"
      ? "weicher & geschmeidiger"
      : "ruhiger & glänzender",
    iconKey: primaryConcern === "dryness" || primaryGoal === "moisture" ? "droplet" : "sparkles",
    tickBefore: primaryConcern === "dryness" || primaryGoal === "moisture" ? "trocken" : "stumpf",
    tickAfter: primaryConcern === "dryness" || primaryGoal === "moisture" ? "geschmeidig" : "glänzend",
    currentPosition: BUCKET_TO_POSITION[scoreToBucket(scores.surface)],
    targetPosition: ROW_TARGET_POSITIONS.hairFeel,
  }
}
```

- [ ] **Step 5: Rebuild Row 2, Row 3, needs, and CTA data from the new contract**

Still in `src/lib/quiz/result-narrative.ts`, update the row copy maps so Row 3 uses short deficit-led `before` values and row scopes are explicit. Then add one main lever and CTA lead-in copy.

Use this exact goal-row direction:

```typescript
const GOAL_COPY: Record<Goal, QuizResultRowCopy & { intro: string; scope: QuizResultScope }> = {
  less_frizz: {
    intro: "ruhigeres, geschmeidigeres Haar",
    scope: "LÄNGEN",
    before: "wenig Kontrolle",
    after: "mehr Geschmeidigkeit & Kontrolle",
    iconKey: "sparkles",
    tickBefore: "unruhig",
    tickAfter: "kontrolliert",
  },
  moisture: {
    intro: "weichere, besser mit Feuchtigkeit versorgte Längen",
    scope: "LÄNGEN",
    before: "wenig Feuchtigkeit",
    after: "mehr Elastizität & Geschmeidigkeit",
    iconKey: "droplet",
    tickBefore: "trocken",
    tickAfter: "geschmeidig",
  },
  anti_breakage: {
    intro: "widerstandsfähigere, geschützte Längen",
    scope: "LÄNGEN",
    before: "wenig Stabilität",
    after: "mehr Spannkraft & Widerstandskraft",
    iconKey: "shield-check",
    tickBefore: "instabil",
    tickAfter: "stabil",
  },
  shine: {
    intro: "glänzenderes, lebendigeres Haar",
    scope: "HAAR",
    before: "wenig Glanz",
    after: "mehr Leuchtkraft & Lebendigkeit",
    iconKey: "sparkles",
    tickBefore: "matt",
    tickAfter: "lebendig",
  },
  healthy_scalp: {
    intro: "eine ruhigere, ausgeglichenere Kopfhaut",
    scope: "KOPFHAUT",
    before: "wenig Ruhe",
    after: "mehr Ruhe & Ausgeglichenheit",
    iconKey: "heart",
    tickBefore: "unruhig",
    tickAfter: "ruhig",
  },
  // keep the remaining goals in the same concise pattern
}
```

Then add one main-lever builder:

```typescript
function buildNeedsSection(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
): QuizResultNarrative["needs"] {
  if (answers.scalp_condition === "schuppen" || answers.scalp_condition === "trockene_schuppen") {
    return {
      title: "Was dein Haar jetzt braucht",
      summary:
        "Die gute Nachricht: Das lässt sich mit der richtigen Pflege gut ausgleichen. Deine Antworten zeigen, dass deine Kopfhaut gerade mehr Balance braucht, damit sie ruhiger wird und Schuppen gezielter reduziert werden können.",
      mainLeverLabel: "Jetzt zuerst",
      mainLeverTitle: "Die Kopfhaut gezielter ausgleichen",
      mainLeverBody:
        "Das erreichen wir vor allem über ein passendes Anti-Schuppen-Shampoo und, wenn sinnvoll, ein beruhigendes Kopfhautserum.",
    }
  }

  if (
    primaryConcern === "breakage" ||
    primaryConcern === "hair_damage" ||
    (hasColorTreatment(answers) && answers.pulltest === "stretches_stays")
  ) {
    return {
      title: "Was dein Haar jetzt braucht",
      summary:
        "Die gute Nachricht: Das lässt sich mit der richtigen Pflege gut ausgleichen. Deine Antworten zeigen, dass deine Längen gerade mehr Stabilität brauchen, damit sie widerstandsfähiger werden und weniger schnell nachgeben.",
      mainLeverLabel: "Jetzt zuerst",
      mainLeverTitle: "Mehr Stabilität in die Längen bringen",
      mainLeverBody:
        "Das erreichen wir vor allem über einen Repair-Conditioner, eine stärkende Maske und bei stark belasteten Längen auch einen Bondbuilder.",
    }
  }

  if (primaryConcern === "split_ends") {
    return {
      title: "Was dein Haar jetzt braucht",
      summary:
        "Die gute Nachricht: Das lässt sich mit der richtigen Pflege gut ausgleichen. Deine Antworten zeigen, dass deine Spitzen gerade mehr Schutz brauchen, damit dein Haar glatter fällt und wieder mehr Glanz aufbauen kann.",
      mainLeverLabel: "Jetzt zuerst",
      mainLeverTitle: "Mehr Schutz für Oberfläche und Spitzen aufbauen",
      mainLeverBody:
        "Das erreichen wir vor allem über den richtigen Conditioner, ein passendes Leave-in und bei Bedarf ein leichtes Öl in den Spitzen.",
    }
  }

  if (primaryConcern === "frizz") {
    return {
      title: "Was dein Haar jetzt braucht",
      summary:
        "Die gute Nachricht: Das lässt sich mit der richtigen Pflege gut ausgleichen. Deine Antworten zeigen, dass deine Längen gerade mehr Schutz brauchen, damit sie ruhiger fallen und sich besser kontrollieren lassen.",
      mainLeverLabel: "Jetzt zuerst",
      mainLeverTitle: "Mehr Schutz für Oberfläche und Längen aufbauen",
      mainLeverBody:
        "Das erreichen wir vor allem über den richtigen Conditioner und ein passendes Leave-in, das die Oberfläche glättet und Frizz bremst.",
    }
  }

  return {
    title: "Was dein Haar jetzt braucht",
    summary:
      "Die gute Nachricht: Das lässt sich mit der richtigen Pflege gut ausgleichen. Deine Antworten zeigen, dass dein Haar jetzt vor allem passgenaue Pflege braucht, damit es ruhiger, geschmeidiger und stimmiger wird.",
    mainLeverLabel: "Jetzt zuerst",
    mainLeverTitle: "Das Pflegegewicht besser auf dein Haar abstimmen",
    mainLeverBody:
      "Das erreichen wir vor allem über einen passenden Conditioner und ein Leave-in, das dein Haar unterstützt, ohne es zu beschweren.",
  }
}
```

Finish the builder by removing `reveal` and returning the new CTA lead:

```typescript
return {
  intro: buildIntro(answers, primaryConcern, primaryGoal),
  rows: [buildHairFeelRow(answers, primaryConcern, primaryGoal), frictionRow, goalRow],
  needs: buildNeedsSection(answers, primaryConcern, primaryGoal),
  cta: {
    lead: "Das ist dein Überblick",
    subline:
      "Im nächsten Schritt zeigen wir dir deinen persönlichen Pflegeplan mit den passenden Produkten, der richtigen Reihenfolge und wie du sie in deiner Routine anwendest.",
    label: "MEINE ROUTINE STARTEN",
  },
  primaryConcern,
  primaryGoal,
}
```

- [ ] **Step 6: Run the narrative unit tests again**

Run:

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected:
- PASS for the new scope/position/needs assertions
- PASS for the older concern-ranking tests after you update them to the new row contract where needed

- [ ] **Step 7: Commit the narrative model**

```bash
git add src/lib/quiz/result-narrative.ts tests/quiz-result-narrative.test.ts
git commit -m "feat(quiz): derive scoped results, slider positions, and main lever copy"
```

---

### Task 2: Results UI + E2E Coverage

**Context:** Once the builder exposes row scopes, real positions, and the needs/CTA bridge, the results component has to render them clearly. This task also updates the end-to-end assertions to match the new results page contract and to protect against regressions on both the normal and signed-in quiz paths.

**Files:**
- Modify: `src/components/quiz/quiz-results.tsx`
- Modify: `tests/quiz-onboarding-e2e.spec.ts`
- Modify: `tests/auth-intake-routing.e2e.spec.ts`

- [ ] **Step 1: Update the results component to render scope badges and real slider positions**

In `src/components/quiz/quiz-results.tsx`, update `SpectrumCard` so it uses the new row data.

Header change:

```tsx
<div className="mb-4 flex items-center gap-3">
  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
    <Icon className="size-5 stroke-[1.75]" />
  </div>
  <span className="type-label text-[11px] font-semibold tracking-[0.22em] text-[var(--brand-plum)]">
    {row.label}
  </span>
  <span className="ml-auto rounded-full bg-[var(--brand-plum-ice)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-plum)] [font-family:var(--font-mono)]">
    {row.scope}
  </span>
</div>
```

Marker change:

```tsx
<div
  className="absolute top-1/2 grid size-[22px] place-items-center rounded-full bg-white"
  style={{
    left: `${row.currentPosition}%`,
    transform: "translate(-50%, -50%)",
    boxShadow: "0 0 0 2px #E35858, 0 4px 12px -2px rgba(227, 88, 88, 0.5)",
  }}
>
  <div className="size-[14px] rounded-full bg-[#E35858]" />
</div>
<div
  className="absolute top-1/2 grid size-[22px] place-items-center rounded-full bg-white"
  style={{
    left: `${row.targetPosition}%`,
    transform: "translate(-50%, -50%)",
    boxShadow: "0 0 0 2px #4FAE7A",
  }}
>
  <div className="size-[14px] rounded-full border-2 border-dashed border-[#4FAE7A] bg-transparent" />
</div>
```

- [ ] **Step 2: Remove the reveal line and add the needs + CTA bridge block**

Still in `src/components/quiz/quiz-results.tsx`, remove the extra paragraph that renders `narrative.reveal`. Keep the intro paragraph, then insert the new section between the cards and CTA buttons:

```tsx
<div className="mb-8 flex flex-col gap-[18px] sm:gap-[22px]">
  {narrative.rows.map((row, index) => (
    <SpectrumCard key={row.label} row={row} index={index} />
  ))}
</div>

<section className="mb-8 rounded-[20px] border border-black/6 bg-white px-5 py-5 shadow-[0_1px_0_rgba(var(--brand-plum-rgb),0.04),0_8px_28px_-18px_rgba(var(--brand-plum-rgb),0.22)] sm:px-6">
  <h2 className="mb-3 type-label text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-plum)]">
    {narrative.needs.title}
  </h2>
  <p className="mb-4 text-[15.5px] leading-[1.65] text-muted-foreground sm:text-base">
    {narrative.needs.summary}
  </p>
  <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-plum)] [font-family:var(--font-mono)]">
    {narrative.needs.mainLeverLabel}: {narrative.needs.mainLeverTitle}
  </p>
  <p className="text-[15px] leading-[1.6] text-foreground sm:text-[15.5px]">
    {narrative.needs.mainLeverBody}
  </p>
</section>

<div className="mx-auto mt-1 flex w-full max-w-[480px] flex-col gap-3">
  <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-plum)] [font-family:var(--font-mono)]">
    {narrative.cta.lead}
  </p>
  <p className="text-center text-[13.5px] leading-[1.5] text-muted-foreground">
    {narrative.cta.subline}
  </p>
  <Button
    onClick={handleStart}
    variant="unstyled"
    className="min-h-14 w-full rounded-[14px] bg-[var(--brand-coral)] px-5 py-3 text-[15px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_10px_28px_-14px_rgba(212,97,106,0.55)] transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-12px_rgba(212,97,106,0.6)]"
  >
    {narrative.cta.label}
  </Button>
```

Keep the share button as-is below the primary CTA.

- [ ] **Step 3: Update the E2E assertions for both result-page entry paths**

In `tests/quiz-onboarding-e2e.spec.ts`, replace the reveal assertion with the new result-page contract:

```typescript
await page.getByRole("button", { name: /MEIN HAARPROFIL ANSEHEN/i }).click()
await expect(
  page.getByRole("heading", { name: /So kommen wir deinem Haarziel näher/i }),
).toBeVisible({ timeout: 15_000 })
await expect(page.getByText(/Was dein Haar jetzt braucht/i)).toBeVisible()
await expect(page.getByText(/Das ist dein Überblick/i)).toBeVisible()
await expect(page.getByText(/berechnet aus deinen Antworten/i)).toHaveCount(0)
await expect(
  page.getByRole("button", { name: /MEINE ROUTINE STARTEN/i }),
).toBeVisible()
```

Apply the same assertion swap in `tests/auth-intake-routing.e2e.spec.ts`:

```typescript
await page.getByRole("button", { name: /MEIN HAARPROFIL ANSEHEN/i }).click()
await expect(
  page.getByRole("heading", { name: /So kommen wir deinem Haarziel näher/i }),
).toBeVisible({ timeout: 15_000 })
await expect(page.getByText(/Was dein Haar jetzt braucht/i)).toBeVisible()
await expect(page.getByText(/Das ist dein Überblick/i)).toBeVisible()
await expect(page.getByText(/berechnet aus deinen Antworten/i)).toHaveCount(0)
await expect(
  page.getByRole("button", { name: /MEINE ROUTINE STARTEN/i }),
).toBeVisible()
```

- [ ] **Step 4: Run focused verification for UI + E2E**

Run:

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
npm run typecheck -- --pretty false
npm exec eslint -- --no-ignore src/components/quiz/quiz-results.tsx src/lib/quiz/result-narrative.ts tests/quiz-result-narrative.test.ts tests/quiz-onboarding-e2e.spec.ts tests/auth-intake-routing.e2e.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:3675 npx playwright test tests/quiz-onboarding-e2e.spec.ts --grep "quiz hands off into onboarding" --reporter=line
PLAYWRIGHT_BASE_URL=http://localhost:3675 npx playwright test tests/auth-intake-routing.e2e.spec.ts --grep "signed-in quiz completion skips auth" --reporter=line
```

Expected:
- unit tests PASS
- typecheck PASS
- eslint PASS
- both Playwright flows PASS and reach the updated results page

- [ ] **Step 5: Commit the UI follow-up**

```bash
git add src/components/quiz/quiz-results.tsx tests/quiz-onboarding-e2e.spec.ts tests/auth-intake-routing.e2e.spec.ts
git commit -m "feat(quiz): add scoped result cards and action bridge"
```

---

### Task 3: Final Verification

**Context:** The new result page is copy-heavy and visually specific. Before calling it done, verify the full story in a browser and make sure the page still reads well for both hair-length and scalp-led cases.

**Files:**
- Modify: none

- [ ] **Step 1: Run the full local verification stack**

From the worktree root, run:

```bash
npx tsx --test tests/quiz-result-narrative.test.ts tests/quiz-normalization.test.ts tests/result-card-data.test.ts
npm run typecheck -- --pretty false
npm exec eslint -- --no-ignore src/components/quiz/quiz-results.tsx src/lib/quiz/result-narrative.ts tests/quiz-result-narrative.test.ts tests/quiz-onboarding-e2e.spec.ts tests/auth-intake-routing.e2e.spec.ts
PLAYWRIGHT_BASE_URL=http://localhost:3675 npx playwright test tests/quiz-onboarding-e2e.spec.ts --grep "quiz hands off into onboarding" --reporter=line
PLAYWRIGHT_BASE_URL=http://localhost:3675 npx playwright test tests/auth-intake-routing.e2e.spec.ts --grep "signed-in quiz completion skips auth" --reporter=line
```

Expected:
- all commands PASS

- [ ] **Step 2: Do one browser sanity pass for a hair-length case and one scalp-led case**

Use the local dev server at `http://localhost:3675/quiz` and confirm:

- Hair-length case:
  - row scopes are distinct (`HAAR`, `LÄNGEN`, `SPITZEN` etc.)
  - current markers are not all pinned to the far-left edge
  - `Was dein Haar jetzt braucht` shows only one main lever
  - CTA lead-in explains that the next step is the detailed plan/products view

- Scalp-led case:
  - row scopes use `KOPFHAUT`
  - row 3 is concise (`wenig Ruhe` -> `mehr Ruhe & Ausgeglichenheit`)
  - the main lever mentions scalp-specific categories (`Anti-Schuppen-Shampoo`, `Kopfhautserum`) when appropriate

- [ ] **Step 3: Commit if the verification task required any tiny fixes**

If no code changed during the sanity pass, skip this step.

If tiny copy or spacing fixes were needed:

```bash
git add src/components/quiz/quiz-results.tsx src/lib/quiz/result-narrative.ts tests/quiz-result-narrative.test.ts
git commit -m "fix(quiz): polish results narrative follow-up"
```

---

## Self-Review

### Spec coverage

- Real slider logic: covered in Task 1 (bucketed positions + row targets) and Task 2 (UI marker positions)
- Row 1 combined scoring: covered in Task 1 (`buildHairFeelScores`, dominant-axis selection)
- Row 3 concise `wenig ...` copy: covered in Task 1 (goal copy remap + unit tests)
- Scope badge instead of repetitive `in Y` text: covered in Task 2
- Single main lever only: covered in Task 1 (`needs.mainLever*`) and Task 2 rendering
- Product-category-specific lever copy including advanced categories: covered in Task 1 unit tests + lever builder
- CTA lead-in clarifying that the next step is the detailed routine/products view: covered in Task 1/2
- Remove the extra reveal line: covered in Task 2 E2E assertions

### Placeholder scan

- No `TODO`, `TBD`, or “similar to above” steps remain
- All code-changing steps include concrete snippets
- All verification steps include exact commands and expected outcomes

### Type consistency

- `scope`, `currentPosition`, `targetPosition`, and `needs` are defined once in Task 1 and used consistently in Task 2
- `cta.lead`, `cta.subline`, and `cta.label` are used consistently across the builder and UI
- `QuizResultScope` values are explicitly enumerated and reused in row builders/tests

