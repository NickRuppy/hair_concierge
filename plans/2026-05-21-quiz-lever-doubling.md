# Quiz Lever Decision Tree — Doubling (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `buildNeedsSection` in `src/lib/quiz/result-narrative.ts` from 5 branches to 11, with each new branch catalog-backed by the existing Supabase product schema. The lever section on the post-quiz offer page and the share view becomes much more personalised — splitting scalp into 3 (dandruff/irritated/oily-balanced), splitting the protein/moisture axis (severe damage + protein-moderate + moisture-needs), and adding curl-definition and shine as their own routes.

**Architecture:** All changes live inside `buildNeedsSection`. The function stays an in-file series of `if`-blocks evaluated in priority order (first match wins). No new files, no extracted modules — the function grows from ~110 lines to ~210 lines, which is still well within the file's scope (`result-narrative.ts` ~950 lines today). The narrative type (`QuizResultNeedsSection`) and structured product tuple (`products: readonly [Product, Product]`) stay unchanged. Six new branches each contribute one new `mainLeverTitle`, `mainLeverWhy`, `mainLeverProducts` prose, and a 2-product tuple. The surface-support branch's conditions narrow so `curl_definition` and `shine` goals no longer fall through to it.

**Tech Stack:** TypeScript narrative builder, Node test runner (`node:test`), German consumer hair-care copy.

**Branch:** `codex/quiz-lever-doubling` in a new worktree under `.worktrees/quiz-lever-doubling`, based on `origin/main`.

---

## Decisions (locked)

- **Six new branches added; one refined; one narrowed:**
  | Old (5 branches) | New (11 branches, evaluated in this order) |
  |---|---|
  | Scalp (1 branch) | **Scalp: dandruff** + **Scalp: irritated** + **Scalp: oily/balanced** (3 branches) |
  | Structural repair | **Severe bond damage** (refined — tighter trigger) |
  |  | **Protein-needs (moderate)** *(NEW)* |
  |  | **Moisture-needs** *(NEW)* |
  |  | **Curl definition** *(NEW)* |
  |  | **Shine** *(NEW)* |
  | Surface support | **Surface support** (narrowed — `curl_definition` and `shine` carved out) |
  | Split-ends | Split-ends (unchanged) |
  | Default fallback | Default fallback (unchanged) |
- **All new branches catalog-backed.** Each maps to actual Supabase rerank rows:
  - Scalp routes → `product_shampoo_specs.shampoo_bucket` ∈ {schuppen, irritationen, dehydriert-fettig}
  - Protein-needs → `product_mask_specs.balance_direction='protein'` + `product_conditioner_specs.protein_moisture_balance='stretches_stays'`
  - Moisture-needs → `product_mask_specs.balance_direction='moisture'` + `product_conditioner_specs.protein_moisture_balance='snaps'`
  - Curl → `product_leave_in_eligibility.need_bucket='curl_definition'` (8 SKUs)
  - Shine → `product_leave_in_eligibility.need_bucket='shine_protect'` (28 SKUs)
- **`mainLeverProducts` prose string stays.** It's pinned by 5 existing narrative tests. Each new branch adds a corresponding prose line; we update existing prose only where the branch's nature changed (none, in this plan).
- **`structured products` tuple is the source of truth for what the UI renders.** Each new branch defines a `[primary, secondary]` `{name, description}` pair.
- **Branch priority order (TOP = highest priority, evaluated first):**
  1. Scalp: dandruff
  2. Scalp: irritated
  3. Scalp: oily/balanced
  4. Severe bond damage
  5. Protein-needs (moderate)
  6. Moisture-needs
  7. Curl definition
  8. Shine
  9. Surface support (narrowed)
  10. Split-ends
  11. Default fallback
- **No new quiz questions.** All routing uses existing `QuizAnswers` fields.
- **No new UI work.** Both the share view and the offer page already render `narrative.needs.products` via `<QuizResultLeverRows>` from the previous PR.
- **Untouched:** the transformation card, hero, locked plan teaser, comparison table, pricing, social proof, the share view's `cta` block. None of those code paths are visited by this plan.
- **Catalog-gap branches deferred:** Volume, Anti-volume, Color-protection, Heat-protection (no quiz signal). Reasoning: no catalog support today. Separate plan once the catalog is extended.

---

## Files

**Create:** none.

**Modify:**
- `src/lib/quiz/result-narrative.ts` — `buildNeedsSection` function (the 5 existing branches become 11 — 3 scalp branches replace 1, plus 4 new branches between the scalp block and the surface-support block, plus refinements to surface-support conditions). Lines roughly 833-940 grow to ~210 lines.
- `tests/quiz-result-narrative.test.ts` — add 6 new test cases (one per new branch), update 0 existing assertions (verified: existing routing for current test fixtures stays unchanged because of how the new branch conditions slot in). Adds ~120 lines of test code.

**Delete:** none.

---

## Reference: branch conditions (exact code that goes into `buildNeedsSection`)

The new function structure, in priority order:

```ts
function buildNeedsSection(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
  primaryGoal: Goal | null,
): QuizResultNeedsSection {
  const hasScalpSignals =
    answers.scalp_condition === "schuppen" ||
    answers.scalp_condition === "trockene_schuppen" ||
    answers.scalp_condition === "gereizt" ||
    answers.scalp_type === "fettig" ||
    answers.scalp_type === "trocken" ||
    primaryGoal === "healthy_scalp"

  const hasTexture = answers.structure === "wavy" || answers.structure === "curly" || answers.structure === "coily"

  // -------- Scalp branches (only fire when scalp wins over concern) --------
  // Gate: primaryGoal === "healthy_scalp" OR (!primaryConcern AND scalp signal).
  // This preserves "concern wins over scalp" semantics from the original code.
  const scalpAllowed = primaryGoal === "healthy_scalp" || (!primaryConcern && hasScalpSignals)

  if (scalpAllowed && (answers.scalp_condition === "schuppen" || answers.scalp_condition === "trockene_schuppen")) {
    return SCALP_DANDRUFF_NEEDS
  }

  if (scalpAllowed && answers.scalp_condition === "gereizt") {
    return SCALP_IRRITATED_NEEDS
  }

  if (scalpAllowed) {
    // Reaches here when scalp_condition is null but scalp_type signals oily/dry, or the user explicitly picked healthy_scalp.
    return SCALP_OILY_BALANCED_NEEDS
  }

  // -------- Severity-driven bond-damage branch (concern-driven, no pulltest gate) --------
  const hasSeveritySignal =
    primaryConcern === "breakage" ||
    primaryConcern === "hair_damage" ||
    hasColorTreatment(answers)

  if (hasSeveritySignal) {
    return SEVERE_BOND_DAMAGE_NEEDS
  }

  // -------- Pulltest-driven branches (only fire when no severity signal) --------
  if (answers.pulltest === "stretches_stays") {
    // Overstretched but no other damage signal — needs protein at the mask level.
    return PROTEIN_MODERATE_NEEDS
  }

  if (answers.pulltest === "snaps") {
    // Brittle / snaps in pulltest → needs moisture, not protein.
    return MOISTURE_NEEDS
  }

  // -------- Goal-driven specialty branches (only fire when no concern to address first) --------
  if (primaryGoal === "curl_definition" && hasTexture && !primaryConcern) {
    return CURL_DEFINITION_NEEDS
  }

  if (primaryGoal === "shine" && !primaryConcern) {
    return SHINE_NEEDS
  }

  // -------- Surface support (narrowed) --------
  // Narrowed: curl_definition + shine carved out above. Original conditions for less_frizz / moisture / dryness / frizz / tangling remain.
  const needsSurfaceSupport =
    primaryConcern === "frizz" ||
    primaryConcern === "dryness" ||
    primaryConcern === "tangling" ||
    primaryGoal === "less_frizz" ||
    primaryGoal === "moisture"

  if (needsSurfaceSupport) {
    return SURFACE_SUPPORT_NEEDS
  }

  // -------- Split-ends + Default fallback --------
  if (primaryConcern === "split_ends" || primaryGoal === "less_split_ends") {
    return SPLIT_ENDS_NEEDS
  }

  return DEFAULT_FALLBACK_NEEDS
}
```

**(The `*_NEEDS` constants are defined inline inside the function below each branch — the named placeholders are only for clarity in this reference. The actual code in `result-narrative.ts` will have each `return { ... }` block written out inline, matching today's style.)**

---

## Reference: branch content (the 11 `QuizResultNeedsSection` payloads)

### Existing branches kept verbatim
- **Severe bond damage**: title/why/products and prose are exactly today's structural-repair branch (the one that says "Mehr Stabilität in die Längen bringen" + Bondbuilder + Stärkende Maske).
- **Surface support**: same title/why/products/prose as today's surface-support branch ("Mehr Schutz für Oberfläche und Längen aufbauen" + Conditioner + Leave-in).
- **Split-ends**: unchanged.
- **Default fallback**: unchanged.

### Scalp: dandruff (replaces today's single scalp branch when scalp_condition ∈ {schuppen, trockene_schuppen})

- `title`: "Was dein Haar jetzt braucht"
- `mainLeverTitle`: "Die Kopfhaut gezielter ausgleichen"
- `mainLeverWhy`: "Wenn die Kopfhaut aus dem Gleichgewicht ist, bleibt sie leichter gereizt und Schuppen kommen schneller wieder."
- `mainLeverProducts`: "Am meisten erreichen wir hier mit einem passenden Anti-Schuppen-Shampoo; zusätzlich kann ein beruhigendes Kopfhautserum helfen, die Kopfhaut zwischen den Haarwäschen ruhiger zu halten."
- `products`: `[{ name: "Anti-Schuppen-Shampoo", description: "Reguliert die Kopfhaut bei jeder Wäsche." }, { name: "Kopfhautserum", description: "Hält die Kopfhaut zwischen den Wäschen ruhig." }]`

(All four fields above are byte-identical to today's scalp branch — so no existing narrative test breaks.)

### Scalp: irritated (NEW — fires when scalp_condition === "gereizt")

- `mainLeverTitle`: "Die Kopfhaut beruhigen"
- `mainLeverWhy`: "Wenn die Kopfhaut gereizt ist, fällt das ganze Haarbild stumpfer und uneinheitlicher aus."
- `mainLeverProducts`: "Am meisten erreichen wir hier mit einem beruhigenden Shampoo; zusätzlich kann ein leichtes Leave-in helfen, die Längen zu pflegen, ohne die Kopfhaut zu belasten."
- `products`: `[{ name: "Beruhigendes Shampoo", description: "Mildert die Kopfhautreizung bei jeder Wäsche." }, { name: "Leichtes Leave-in", description: "Pflegt die Längen, ohne die Kopfhaut zu belasten." }]`

### Scalp: oily/balanced (NEW — fires when scalp_type ∈ {fettig, trocken} or primaryGoal=healthy_scalp without specific scalp_condition)

- `mainLeverTitle`: "Die Kopfhaut in Balance bringen"
- `mainLeverWhy`: "Wenn die Kopfhaut zu schnell fettet oder austrocknet, verliert das Haar Frische und Volumen schon nach kurzer Zeit."
- `mainLeverProducts`: "Am meisten erreichen wir hier mit einem Balance-Shampoo; zusätzlich kann ein Trockenshampoo helfen, zwischen den Wäschen frisch zu wirken."
- `products`: `[{ name: "Balance-Shampoo", description: "Bringt die Kopfhaut in Balance, ohne sie auszutrocknen." }, { name: "Trockenshampoo", description: "Hält den Ansatz zwischen den Wäschen frisch." }]`

### Protein-needs (moderate) (NEW — fires when pulltest=stretches_stays AND not severe)

- `mainLeverTitle`: "Überdehnten Längen wieder Struktur geben"
- `mainLeverWhy`: "Wenn die Längen überdehnt sind und langsam zurückspringen, fehlt ihnen Struktur — nicht unbedingt Feuchtigkeit."
- `mainLeverProducts`: "Am meisten erreichen wir hier mit einer Protein-Maske; zusätzlich kann ein Conditioner für strapaziertes Haar helfen, die Längen zwischen den Wäschen zu stützen."
- `products`: `[{ name: "Protein-Maske", description: "Gibt überdehnten Längen wieder Struktur." }, { name: "Conditioner für strapaziertes Haar", description: "Stützt die Längen zwischen den Masken." }]`

### Moisture-needs (NEW — fires when pulltest=snaps)

- `mainLeverTitle`: "Den Längen mehr Feuchtigkeit zurückgeben"
- `mainLeverWhy`: "Wenn die Längen schnell brechen statt nachzugeben, fehlt ihnen Feuchtigkeit — nicht mehr Protein."
- `mainLeverProducts`: "Am meisten erreichen wir hier mit einer Feuchtigkeitsmaske; zusätzlich kann ein Conditioner für trockenes Haar helfen, die Längen zwischen den Masken geschmeidig zu halten."
- `products`: `[{ name: "Feuchtigkeitsmaske", description: "Versorgt trockene Längen tief mit Feuchtigkeit." }, { name: "Conditioner für trockenes Haar", description: "Hält die Längen geschmeidig zwischen den Masken." }]`

### Curl definition (NEW — fires when primaryGoal=curl_definition AND structure ∈ {wavy, curly, coily})

- `mainLeverTitle`: "Wellen und Locken besser definieren"
- `mainLeverWhy`: "Wenn die Locken sich verlieren, fehlt es selten an Pflege — sondern an einem Produkt, das die Bündelung hält."
- `mainLeverProducts`: "Am meisten erreichen wir hier mit einem Curl-Leave-in; zusätzlich kann ein pflegender Conditioner helfen, die Locken weich und beweglich zu halten."
- `products`: `[{ name: "Curl-Leave-in", description: "Definiert Wellen und Locken zwischen den Wäschen." }, { name: "Pflegender Conditioner", description: "Hält die Locken weich und beweglich." }]`

### Shine (NEW — fires when primaryGoal=shine)

- `mainLeverTitle`: "Mehr Glanz in die Längen bringen"
- `mainLeverWhy`: "Wenn die Oberfläche stumpf wirkt, reflektiert das Licht nicht — eine kleine Versiegelung reicht oft schon."
- `mainLeverProducts`: "Am meisten erreichen wir hier mit einem Glanz-Leave-in; zusätzlich kann ein leichtes Haaröl helfen, die Oberfläche zu versiegeln."
- `products`: `[{ name: "Glanz-Leave-in", description: "Bringt Glanz zurück in die Längen." }, { name: "Leichtes Haaröl", description: "Versiegelt die Oberfläche und betont den Glanz." }]`

---

## Task 1: Set up isolated worktree

**Files:** none yet.

- [ ] **Step 1: Create the worktree**

From the repo root:

```bash
git fetch origin main
npm run worktree:new -- quiz-lever-doubling
```

Expected: worktree at `.worktrees/quiz-lever-doubling`, branch `codex/quiz-lever-doubling`, deps installed.

- [ ] **Step 2: Verify baseline narrative tests pass**

From inside the worktree:

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: 17 / 17 pass.

- [ ] **Step 3: Run the related quiz test set as a wider baseline**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts tests/quiz-results-view.test.tsx tests/result-offer-page.test.tsx tests/quiz-result-transformation-card.test.tsx tests/quiz-result-lever-rows.test.tsx
```

Expected: 22 / 22 pass.

---

## Task 2: Split scalp branch into three (dandruff / irritated / oily-balanced)

**Files:**
- Modify: `src/lib/quiz/result-narrative.ts` (function `buildNeedsSection`, around line 833-855)
- Modify: `tests/quiz-result-narrative.test.ts` — add 2 new test cases (existing scalp test still passes for dandruff; we add irritated + oily-balanced tests)

- [ ] **Step 1: Add the two new tests (failing first)**

Append these test cases to `tests/quiz-result-narrative.test.ts`, just below the existing `"no-concern fallback can become scalp-led when scalp is the strongest real friction"` test:

```tsx
test("scalp-irritated branch fires when scalp_condition === gereizt and no concern is set", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: true,
    scalp_condition: "gereizt",
    goals: ["healthy_scalp"],
    concerns: [],
  })

  assert.equal(narrative.needs.mainLeverTitle, "Die Kopfhaut beruhigen")
  assert.match(narrative.needs.mainLeverWhy, /gereizt/i)
  assert.match(narrative.needs.mainLeverProducts, /beruhigendes Shampoo/i)
  assert.deepEqual(narrative.needs.products, [
    {
      name: "Beruhigendes Shampoo",
      description: "Mildert die Kopfhautreizung bei jeder Wäsche.",
    },
    {
      name: "Leichtes Leave-in",
      description: "Pflegt die Längen, ohne die Kopfhaut zu belasten.",
    },
  ])
})

test("scalp-oily-balanced branch fires when scalp_type signals oily without a specific scalp_condition", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "fine",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    scalp_type: "fettig",
    has_scalp_issue: false,
    goals: ["healthy_scalp"],
    concerns: [],
  })

  assert.equal(narrative.needs.mainLeverTitle, "Die Kopfhaut in Balance bringen")
  assert.match(narrative.needs.mainLeverWhy, /Frische und Volumen/i)
  assert.match(narrative.needs.mainLeverProducts, /Balance-Shampoo/i)
  assert.deepEqual(narrative.needs.products, [
    {
      name: "Balance-Shampoo",
      description: "Bringt die Kopfhaut in Balance, ohne sie auszutrocknen.",
    },
    {
      name: "Trockenshampoo",
      description: "Hält den Ansatz zwischen den Wäschen frisch.",
    },
  ])
})
```

- [ ] **Step 2: Run tests to confirm the two new ones fail**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: 17 of 19 PASS, 2 NEW FAIL (the irritated + oily-balanced ones — because today's single scalp branch returns the dandruff payload regardless of which scalp signal triggered it).

- [ ] **Step 3: Edit `src/lib/quiz/result-narrative.ts`**

Find the existing scalp branch (around lines 833-855 — the `if (primaryGoal === "healthy_scalp" || …) { return { ... } }` block). Replace it with this three-branch sequence:

```ts
  const scalpAllowed = primaryGoal === "healthy_scalp" || (!primaryConcern && hasScalpSignals)

  if (
    scalpAllowed &&
    (answers.scalp_condition === "schuppen" || answers.scalp_condition === "trockene_schuppen")
  ) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Die Kopfhaut gezielter ausgleichen",
      mainLeverWhy:
        "Wenn die Kopfhaut aus dem Gleichgewicht ist, bleibt sie leichter gereizt und Schuppen kommen schneller wieder.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem passenden Anti-Schuppen-Shampoo; zusätzlich kann ein beruhigendes Kopfhautserum helfen, die Kopfhaut zwischen den Haarwäschen ruhiger zu halten.",
      products: [
        { name: "Anti-Schuppen-Shampoo", description: "Reguliert die Kopfhaut bei jeder Wäsche." },
        { name: "Kopfhautserum", description: "Hält die Kopfhaut zwischen den Wäschen ruhig." },
      ],
    }
  }

  if (scalpAllowed && answers.scalp_condition === "gereizt") {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Die Kopfhaut beruhigen",
      mainLeverWhy:
        "Wenn die Kopfhaut gereizt ist, fällt das ganze Haarbild stumpfer und uneinheitlicher aus.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem beruhigenden Shampoo; zusätzlich kann ein leichtes Leave-in helfen, die Längen zu pflegen, ohne die Kopfhaut zu belasten.",
      products: [
        { name: "Beruhigendes Shampoo", description: "Mildert die Kopfhautreizung bei jeder Wäsche." },
        { name: "Leichtes Leave-in", description: "Pflegt die Längen, ohne die Kopfhaut zu belasten." },
      ],
    }
  }

  if (scalpAllowed) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Die Kopfhaut in Balance bringen",
      mainLeverWhy:
        "Wenn die Kopfhaut zu schnell fettet oder austrocknet, verliert das Haar Frische und Volumen schon nach kurzer Zeit.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem Balance-Shampoo; zusätzlich kann ein Trockenshampoo helfen, zwischen den Wäschen frisch zu wirken.",
      products: [
        { name: "Balance-Shampoo", description: "Bringt die Kopfhaut in Balance, ohne sie auszutrocknen." },
        { name: "Trockenshampoo", description: "Hält den Ansatz zwischen den Wäschen frisch." },
      ],
    }
  }
```

The existing `hasScalpSignals` local variable above is untouched. The replacement is exactly three `if`-returns in priority order.

- [ ] **Step 4: Re-run narrative tests, confirm 19 / 19 pass**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: 19 PASS, 0 FAIL.

- [ ] **Step 5: Run the wider quiz test set as a regression guard**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts tests/quiz-results-view.test.tsx tests/result-offer-page.test.tsx tests/quiz-result-transformation-card.test.tsx tests/quiz-result-lever-rows.test.tsx
```

Expected: 24 / 24 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/quiz/result-narrative.ts tests/quiz-result-narrative.test.ts
git commit -m "feat(quiz): split scalp lever into dandruff/irritated/oily-balanced"
```

---

## Task 3: Add Severe-vs-Protein-vs-Moisture branches (pulltest-driven)

**Files:**
- Modify: `src/lib/quiz/result-narrative.ts` (`buildNeedsSection`, refining the existing structural-repair branch + adding two new branches after it)
- Modify: `tests/quiz-result-narrative.test.ts` — add 2 new tests (severe-damage tests already exist; add protein-moderate and moisture-needs)

- [ ] **Step 1: Add the two new tests (failing first)**

Append to `tests/quiz-result-narrative.test.ts`, after the scalp-oily-balanced test:

```tsx
test("protein-moderate branch fires when pulltest=stretches_stays without severe-damage signals", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_stays",
    treatment: ["natur"],
    concerns: [],
    goals: ["healthier_hair"],
  })

  assert.equal(narrative.needs.mainLeverTitle, "Überdehnten Längen wieder Struktur geben")
  assert.match(narrative.needs.mainLeverWhy, /überdehnt/i)
  assert.match(narrative.needs.mainLeverProducts, /Protein-Maske/i)
  assert.deepEqual(narrative.needs.products, [
    {
      name: "Protein-Maske",
      description: "Gibt überdehnten Längen wieder Struktur.",
    },
    {
      name: "Conditioner für strapaziertes Haar",
      description: "Stützt die Längen zwischen den Masken.",
    },
  ])
})

test("moisture-needs branch fires when pulltest=snaps", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "snaps",
    treatment: ["natur"],
    concerns: [],
    goals: ["moisture"],
  })

  assert.equal(narrative.needs.mainLeverTitle, "Den Längen mehr Feuchtigkeit zurückgeben")
  assert.match(narrative.needs.mainLeverWhy, /Feuchtigkeit/i)
  assert.match(narrative.needs.mainLeverProducts, /Feuchtigkeitsmaske/i)
  assert.deepEqual(narrative.needs.products, [
    {
      name: "Feuchtigkeitsmaske",
      description: "Versorgt trockene Längen tief mit Feuchtigkeit.",
    },
    {
      name: "Conditioner für trockenes Haar",
      description: "Hält die Längen geschmeidig zwischen den Masken.",
    },
  ])
})
```

- [ ] **Step 2: Run narrative tests, confirm the two new ones fail**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: 19 PASS, 2 FAIL (the new ones).

- [ ] **Step 3: Refine and extend `buildNeedsSection` in `src/lib/quiz/result-narrative.ts`**

Find the existing structural-repair block (today's `if (needsStructuralRepair) { return { ... } }` around line 875). Replace the whole block — from the `const needsStructuralRepair = ...` definition through the `return { ... }` — with this refined-plus-two-new-branches sequence:

```ts
  // -------- Severe bond damage (concern-driven, preserves today's "any severity signal" routing) --------
  const hasSeveritySignal =
    primaryConcern === "breakage" ||
    primaryConcern === "hair_damage" ||
    hasColorTreatment(answers)

  if (hasSeveritySignal) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Mehr Stabilität in die Längen bringen",
      mainLeverWhy:
        "Wenn die Längen geschwächt sind, geben sie schneller nach und Spliss oder Haarbruch werden leichter weiter begünstigt.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem Bondbuilder; zusätzlich kann eine stärkende Maske helfen, die Längen belastbarer zu halten.",
      products: [
        { name: "Bondbuilder", description: "Stabilisiert die Längen von innen." },
        { name: "Stärkende Maske", description: "Macht die Längen wieder belastbar." },
      ],
    }
  }

  // -------- Protein-needs (moderate) — fires when pulltest=stretches_stays without severity signals --------
  if (answers.pulltest === "stretches_stays") {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Überdehnten Längen wieder Struktur geben",
      mainLeverWhy:
        "Wenn die Längen überdehnt sind und langsam zurückspringen, fehlt ihnen Struktur — nicht unbedingt Feuchtigkeit.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einer Protein-Maske; zusätzlich kann ein Conditioner für strapaziertes Haar helfen, die Längen zwischen den Wäschen zu stützen.",
      products: [
        { name: "Protein-Maske", description: "Gibt überdehnten Längen wieder Struktur." },
        {
          name: "Conditioner für strapaziertes Haar",
          description: "Stützt die Längen zwischen den Masken.",
        },
      ],
    }
  }

  // -------- Moisture-needs --------
  if (answers.pulltest === "snaps") {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Den Längen mehr Feuchtigkeit zurückgeben",
      mainLeverWhy:
        "Wenn die Längen schnell brechen statt nachzugeben, fehlt ihnen Feuchtigkeit — nicht mehr Protein.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einer Feuchtigkeitsmaske; zusätzlich kann ein Conditioner für trockenes Haar helfen, die Längen zwischen den Masken geschmeidig zu halten.",
      products: [
        {
          name: "Feuchtigkeitsmaske",
          description: "Versorgt trockene Längen tief mit Feuchtigkeit.",
        },
        {
          name: "Conditioner für trockenes Haar",
          description: "Hält die Längen geschmeidig zwischen den Masken.",
        },
      ],
    }
  }
```

This refactor:
- Replaces the old `const needsStructuralRepair = ...` and its `if` block with a `hasSeveritySignal` check that preserves today's "any of breakage/hair_damage/color-treated triggers bondbuilder" semantics (regardless of pulltest result).
- Adds two new branches immediately after — `stretches_stays` (overstretched without severity = protein-needs moderate) and `snaps` (brittle = moisture-needs).
- The `stretches_bounces` pulltest (balanced) passes through to the goal-driven and surface-support branches below.
- **Important:** this preserves today's routing for the existing "severe structural signals" test (which uses `treatment: ["gefaerbt"]`, `pulltest: "stretches_stays"`) — both the severity signal and the pulltest are present, severe-damage branch fires. Same products.

- [ ] **Step 4: Re-run narrative tests, confirm all pass**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: 21 / 21 PASS.

- [ ] **Step 5: Regression-check the wider test set**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts tests/quiz-results-view.test.tsx tests/result-offer-page.test.tsx tests/quiz-result-transformation-card.test.tsx tests/quiz-result-lever-rows.test.tsx
```

Expected: 26 / 26 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/quiz/result-narrative.ts tests/quiz-result-narrative.test.ts
git commit -m "feat(quiz): split structural-repair into severe / protein-moderate / moisture-needs"
```

---

## Task 4: Add curl-definition branch

**Files:**
- Modify: `src/lib/quiz/result-narrative.ts` (`buildNeedsSection`, insert new branch between moisture-needs and surface-support)
- Modify: `tests/quiz-result-narrative.test.ts` — add 1 new test

- [ ] **Step 1: Add the new test (failing first)**

Append to `tests/quiz-result-narrative.test.ts`:

```tsx
test("curl-definition branch fires when primaryGoal=curl_definition and structure is wavy/curly/coily", () => {
  const narrative = buildQuizResultNarrative({
    structure: "curly",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    concerns: [],
    goals: ["curl_definition"],
  })

  assert.equal(narrative.needs.mainLeverTitle, "Wellen und Locken besser definieren")
  assert.match(narrative.needs.mainLeverWhy, /Locken/i)
  assert.match(narrative.needs.mainLeverProducts, /Curl-Leave-in/i)
  assert.deepEqual(narrative.needs.products, [
    {
      name: "Curl-Leave-in",
      description: "Definiert Wellen und Locken zwischen den Wäschen.",
    },
    {
      name: "Pflegender Conditioner",
      description: "Hält die Locken weich und beweglich.",
    },
  ])
})
```

- [ ] **Step 2: Run narrative tests, confirm new one fails**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: 21 PASS, 1 FAIL (the new curl-definition one — today routes to surface support, which has different products).

- [ ] **Step 3: Insert the curl-definition branch in `buildNeedsSection`**

Find the `if (answers.pulltest === "snaps")` block from Task 3. Immediately after its closing brace, insert:

```ts
  // -------- Curl definition --------
  const hasTexture =
    answers.structure === "wavy" || answers.structure === "curly" || answers.structure === "coily"

  if (primaryGoal === "curl_definition" && hasTexture && !primaryConcern) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Wellen und Locken besser definieren",
      mainLeverWhy:
        "Wenn die Locken sich verlieren, fehlt es selten an Pflege — sondern an einem Produkt, das die Bündelung hält.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem Curl-Leave-in; zusätzlich kann ein pflegender Conditioner helfen, die Locken weich und beweglich zu halten.",
      products: [
        { name: "Curl-Leave-in", description: "Definiert Wellen und Locken zwischen den Wäschen." },
        { name: "Pflegender Conditioner", description: "Hält die Locken weich und beweglich." },
      ],
    }
  }
```

The `!primaryConcern` gate ensures that a curly-haired user with `concerns=["frizz"]` and `goals=["curl_definition"]` still hits surface support (frizz is the real friction), not curl. Curl-definition fires only when curl is the user's clean goal and there's no concern to address first.

- [ ] **Step 4: Run narrative tests, confirm all pass**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: 22 / 22 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz/result-narrative.ts tests/quiz-result-narrative.test.ts
git commit -m "feat(quiz): add curl-definition lever branch for textured hair"
```

---

## Task 5: Add shine branch

**Files:**
- Modify: `src/lib/quiz/result-narrative.ts` (`buildNeedsSection`, insert new branch after curl-definition)
- Modify: `tests/quiz-result-narrative.test.ts` — add 1 new test

- [ ] **Step 1: Add the new test**

Append to `tests/quiz-result-narrative.test.ts`:

```tsx
test("shine branch fires when primaryGoal=shine and no earlier branch matches", () => {
  const narrative = buildQuizResultNarrative({
    structure: "straight",
    thickness: "normal",
    fingertest: "glatt",
    pulltest: "stretches_bounces",
    concerns: [],
    goals: ["shine"],
  })

  assert.equal(narrative.needs.mainLeverTitle, "Mehr Glanz in die Längen bringen")
  assert.match(narrative.needs.mainLeverWhy, /Versiegelung|stumpf/i)
  assert.match(narrative.needs.mainLeverProducts, /Glanz-Leave-in/i)
  assert.deepEqual(narrative.needs.products, [
    {
      name: "Glanz-Leave-in",
      description: "Bringt Glanz zurück in die Längen.",
    },
    {
      name: "Leichtes Haaröl",
      description: "Versiegelt die Oberfläche und betont den Glanz.",
    },
  ])
})
```

- [ ] **Step 2: Run narrative tests, confirm new test fails**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: 22 PASS, 1 FAIL.

- [ ] **Step 3: Insert the shine branch immediately after the curl-definition branch from Task 4**

In `src/lib/quiz/result-narrative.ts`, append immediately after the curl-definition `if`-block:

```ts
  // -------- Shine --------
  if (primaryGoal === "shine" && !primaryConcern) {
    return {
      title: "Was dein Haar jetzt braucht",
      mainLeverTitle: "Mehr Glanz in die Längen bringen",
      mainLeverWhy:
        "Wenn die Oberfläche stumpf wirkt, reflektiert das Licht nicht — eine kleine Versiegelung reicht oft schon.",
      mainLeverProducts:
        "Am meisten erreichen wir hier mit einem Glanz-Leave-in; zusätzlich kann ein leichtes Haaröl helfen, die Oberfläche zu versiegeln.",
      products: [
        { name: "Glanz-Leave-in", description: "Bringt Glanz zurück in die Längen." },
        { name: "Leichtes Haaröl", description: "Versiegelt die Oberfläche und betont den Glanz." },
      ],
    }
  }
```

The `!primaryConcern` gate ensures that a user with `concerns=["dryness"], goals=["healthy_scalp", "shine"]` (whose `primaryGoal` resolves to `shine` via the priority resolver) still hits surface support rather than getting a Glanz-Leave-in + Haaröl combination on already-dry hair. Shine fires only when shine is the user's clean goal and there's no concern to address first.

- [ ] **Step 4: Run narrative tests, confirm all pass**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: 23 / 23 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz/result-narrative.ts tests/quiz-result-narrative.test.ts
git commit -m "feat(quiz): add shine lever branch"
```

---

## Task 6: Narrow surface-support conditions

**Files:**
- Modify: `src/lib/quiz/result-narrative.ts` (`buildNeedsSection`, refine the `needsSurfaceSupport` condition)

The existing surface-support block has these conditions:

```ts
const needsSurfaceSupport =
  primaryConcern === "frizz" ||
  primaryConcern === "dryness" ||
  primaryConcern === "tangling" ||
  primaryGoal === "less_frizz" ||
  primaryGoal === "moisture" ||
  primaryGoal === "shine" ||
  primaryGoal === "curl_definition"
```

After Tasks 4 and 5 added `curl_definition` and `shine` as their own branches above, the surface-support condition should drop those two so they don't double-trigger (though they wouldn't reach this code anyway due to first-match-wins). Tightening for clarity.

- [ ] **Step 1: Edit `src/lib/quiz/result-narrative.ts`**

Find the `const needsSurfaceSupport = ...` definition. Replace it with:

```ts
  const needsSurfaceSupport =
    primaryConcern === "frizz" ||
    primaryConcern === "dryness" ||
    primaryConcern === "tangling" ||
    primaryGoal === "less_frizz" ||
    primaryGoal === "moisture"
```

(Drops the `primaryGoal === "shine"` and `primaryGoal === "curl_definition"` lines — those are now handled by Tasks 4 and 5 above.)

- [ ] **Step 2: Run narrative tests**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts
```

Expected: 23 / 23 PASS — no test should change behaviour here because the upstream branches already short-circuit.

- [ ] **Step 3: Run the wider quiz test set**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts tests/quiz-results-view.test.tsx tests/result-offer-page.test.tsx tests/quiz-result-transformation-card.test.tsx tests/quiz-result-lever-rows.test.tsx
```

Expected: 28 / 28 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/quiz/result-narrative.ts
git commit -m "feat(quiz): narrow surface-support condition (curl/shine carved out)"
```

---

## Task 7: Verification + manual visual check + codex review + PR

**Files:** none modified — verification only.

- [ ] **Step 1: Full quiz-related test run**

```bash
npx tsx --test tests/quiz-result-narrative.test.ts tests/quiz-results-view.test.tsx tests/result-offer-page.test.tsx tests/quiz-result-transformation-card.test.tsx tests/quiz-result-lever-rows.test.tsx
```

Expected: 28 / 28 PASS (17 baseline + 6 new + existing UI tests).

- [ ] **Step 2: CI gate**

```bash
npm run ci:verify
```

Expected: PASS (typecheck + lint + build). No new lint warnings introduced by this branch.

- [ ] **Step 3: Manual visual check across 7 lead profiles (one per new branch + dandruff regression)**

Run dev server in the worktree:

```bash
npm run dev:worktree
```

Pull seven existing leads from Supabase, one per branch we want to eyeball:

```bash
# Profile ids the team commonly tests with:
# - dandruff lead (existing scalp branch behavior preserved): scalp_condition=schuppen
# - irritated lead (NEW): scalp_condition=gereizt (Heidemarie b6eca72a-6b8a-4fae-894d-5315beea32f8 — confirms scalp:irritated branch)
# - oily-balanced lead (NEW): scalp_type=fettig, no scalp_condition
# - protein-moderate lead (NEW): pulltest=stretches_stays, natur, no breakage/damage concerns
# - moisture-needs lead (NEW): pulltest=snaps, no breakage/damage concerns
# - curl lead (NEW): structure=curly, goal=curl_definition, no concerns
# - shine lead (NEW): goal=shine alone, no concerns
```

For each, open `http://localhost:<port>/result/<leadId>` in a 390 px iPhone viewport and confirm:

- The lever section's H2 reads the expected new title (e.g. "Die Kopfhaut beruhigen" for Heidemarie).
- The `★ primary` and `+ secondary` rows render the expected new product names.
- The transformation card and hero are unchanged.

Capture screenshots for the PR description.

- [ ] **Step 4: Chat eval regression check**

```bash
npm run test:chat
```

Expected: no new regressions.

- [ ] **Step 5: Codex whole-branch review**

Dispatch the `codex:codex-rescue` agent (via the Agent tool, `subagent_type: "codex:codex-rescue"`) on the branch diff:

```bash
git diff origin/main..HEAD
```

Ask the agent to specifically verify:

- Branch priority order matches the locked decisions section (scalp 3, then severe → protein-mod → moisture, then curl, then shine, then surface, then split-ends, then fallback)
- All 11 branches return a fully populated `QuizResultNeedsSection` (no missing `products` tuple, no undefined fields, no `as` casts)
- The legacy `mainLeverProducts` prose is present and grammatical in each new branch
- `hasTexture` (curl branch) and `hasSeveritySignal` (severe branch) helper variables are scoped tightly and don't shadow anything else in the file
- The existing 17 narrative tests still pass and route to the SAME branches they did before this plan (i.e., none of the existing fixtures accidentally got re-routed)

Fix real findings. Skip false positives.

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin codex/quiz-lever-doubling
gh pr create --title "feat(quiz): double the lever decision tree (Phase 1, 11 branches)" --body "$(cat <<'EOF'
## Summary
- Expands `buildNeedsSection` in `src/lib/quiz/result-narrative.ts` from 5 branches to 11. Each new branch is catalog-backed by existing Supabase rerank tables (shampoo_bucket, balance_direction, need_bucket, repair_level).
- Splits **scalp** into 3 sub-branches: dandruff (existing copy), irritated, oily/balanced.
- Splits the **pulltest** axis into severe-damage (refined from old structural-repair), protein-needs moderate, and moisture-needs.
- Adds **curl-definition** branch (primaryGoal=curl_definition + structure ∈ {wavy, curly, coily}).
- Adds **shine** branch (primaryGoal=shine).
- Narrows surface-support conditions to remove `curl_definition` and `shine` (now their own branches).
- Six new test cases. All 17 existing narrative tests pass without modification.

## Out of scope (deferred — separate plan)
Volume / Anti-volume / Color-protection / Heat-protection — no catalog support today.

## Test plan
- [x] `npx tsx --test` across all 5 quiz test files — 28/28 pass
- [x] `npm run ci:verify` — clean
- [x] Manual mobile check across 7 lead profiles (one per new branch + dandruff regression)
- [x] `npm run test:chat` — no regressions
- [x] Codex whole-branch review

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope (explicit non-goals)

- Volume / Anti-volume branches — no `need_bucket=volume` in the catalog. Source/ingest products first.
- Color-protection branch — no color-specific routing in rerank specs.
- Heat-protection branch — no quiz question for heat styling. Would need a quiz extension.
- Thickness-aware sub-modifiers (light vs rich leave-in per branch) — meaningful UX win but multiplies copy by 2-3× per branch. Worth its own plan.
- Density-aware sub-modifiers — same reasoning.
- Secondary-concern stacking (e.g., user with breakage + dryness gets a hybrid lever) — needs a new product picker, not just a new branch.
- Extracting `buildNeedsSection` into its own file — defer until the file genuinely outgrows comprehension. ~210 lines is still within scope.
- Updating the chat agent / RAG layer to read `narrative.needs.products` — `narrative.needs` is advisory-only today; product picks come from rerank tables directly. The agent already personalises by quiz answers — the lever just sets user expectation.

---

## Self-review notes

- **Spec coverage:** every locked decision maps to a task. Three scalp sub-branches → Task 2. Severe / protein-mod / moisture → Task 3. Curl → Task 4. Shine → Task 5. Surface narrowing → Task 6. Verification → Task 7.
- **Placeholder scan:** no "TBD", "TODO", "later". All German copy strings are written out in full. Every code block is the exact code to paste.
- **Type consistency:** `QuizResultNeedsProduct` and `QuizResultNeedsSection` types (from the previous PR) are unchanged. Each new branch returns the same `QuizResultNeedsSection` shape — title, mainLeverTitle, mainLeverWhy, mainLeverProducts, products tuple.
- **First-match-wins ordering** is preserved: scalp branches gate on `scalpAllowed`, which mirrors today's `primaryGoal === "healthy_scalp" || (!primaryConcern && hasScalpSignals)`. The severe-damage branch preserves today's "any severity signal triggers bondbuilder" behavior via `hasSeveritySignal` (decoupled from pulltest). Goal-driven specialty branches (curl + shine) gate on `!primaryConcern` so they never override a real concern. Existing tests that route to "scalp" with dandruff signals continue to route to the new dandruff sub-branch with byte-identical products → 0 existing tests need updates for that path.
- **Intentional silent routing changes** (no existing test asserts `needs.products` for these fixtures, so they pass without modification, but behavior is now more accurate):
  - The "ansatz fallback" fixture (test at line 168, `scalp_type=fettig`, no `scalp_condition`) previously hit the single scalp branch (Anti-Schuppen-Shampoo + Kopfhautserum). Now hits the new oily-balanced sub-branch (Balance-Shampoo + Trockenshampoo). Better — recommending dandruff products to someone without dandruff was wrong.
  - All other existing fixtures route to the same branches they did before.
- **Helper variables** (`scalpAllowed`, `hasSeveritySignal`, `hasTexture`) live inside `buildNeedsSection`'s local scope — no global pollution.
- **Catalog backing** verified for every branch via the audit queries against `product_shampoo_specs`, `product_mask_specs`, `product_conditioner_specs`, `product_conditioner_rerank_specs`, `product_leave_in_eligibility`, `product_bondbuilder_specs` in the brainstorm preceding this plan.
- **The legacy `mainLeverProducts` prose** is kept up-to-date in every branch so the 5 pinned narrative-test assertions on that field continue to pass for unchanged branches.
