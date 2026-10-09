import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  comparisonHasBudgetAllocation,
  defaultRecommendationCandidate,
  ProductFitComparison,
  selectedComparisonCandidate,
} from "../src/components/personal-plan-products/product-fit-comparison"
import {
  initialStage3BudgetAnswer,
  sameStage3Budget,
  Stage3BudgetStep,
  stage3BudgetFromAnswer,
} from "../src/components/personal-plan-products/stage3-budget-step"
import {
  budgetCardLabel,
  budgetFlexibilityQuestion,
  budgetLineValue,
  budgetNoticeCopy,
} from "../src/components/personal-plan-products/stage3-product-copy"
import type { Stage3AuthorityEvaluation } from "../src/lib/personal-plan/products/authority/contracts"
import type {
  Stage3FitComparison,
  Stage3SelectedComparisonCandidate,
} from "../src/lib/personal-plan/products/fit-comparison"

/* ---------------------------------------------------------------- copy */

test("budget line copy names the saved budget exactly", () => {
  assert.equal(
    budgetLineValue({ kind: "capped", limitEur: 5, allowExceptions: false }),
    "Bis 5 € für jedes Produkt",
  )
  assert.equal(
    budgetLineValue({ kind: "capped", limitEur: 5, allowExceptions: true }),
    "Bis 5 € · einzelne dürfen mehr kosten",
  )
  assert.equal(budgetLineValue({ kind: "uncapped" }), "Ohne feste Preisgrenze")
  assert.equal(budgetFlexibilityQuestion(15), "Bis 15 € für jedes Produkt?")
})

test("budget card labels map label kinds; neutral keeps the card's own label", () => {
  assert.equal(budgetCardLabel("within_budget"), "Im Budget")
  assert.equal(budgetCardLabel("recommended"), "Empfohlen")
  assert.equal(budgetCardLabel("alternative"), "Alternative")
  assert.equal(budgetCardLabel("neutral"), null)
  assert.equal(budgetCardLabel(undefined), null)
})

test("budget notices use the saved limit and the improved dimension's label", () => {
  const strict5 = { kind: "capped" as const, limitEur: 5 as const, allowExceptions: false }
  const flex15 = { kind: "capped" as const, limitEur: 15 as const, allowExceptions: true }
  assert.equal(
    budgetNoticeCopy({ notice: "strict_none_affordable", budget: strict5 }),
    "Bis 5 € gibt es hier nichts, das zu deinem Haar passt. Du kannst eine teurere Option wählen oder ohne neues Produkt weitergehen.",
  )
  assert.equal(
    budgetNoticeCopy({ notice: "strict_one_affordable", budget: strict5 }),
    "Nur eine passende Option bis 5 €. Weitere Optionen liegen über deinem Budget.",
  )
  assert.equal(
    budgetNoticeCopy({ notice: "flex_gap", budget: flex15 }),
    "Bis 15 € gibt es hier nichts Passendes. Diese Option liegt darüber.",
  )
  assert.equal(
    budgetNoticeCopy({ notice: "allowance_used_elsewhere", budget: flex15 }),
    "Ein Produkt liegt schon über deinem Budget. Hier bleiben wir im Budget.",
  )
  assert.equal(
    budgetNoticeCopy({
      notice: "flex_improvement",
      budget: flex15,
      improvedDimensionIds: ["conditioner.weight"],
    }),
    "Passt beim Pflegegewicht deutlich besser als die Option im Budget.",
  )
  assert.equal(
    budgetNoticeCopy({
      notice: "flex_improvement",
      budget: flex15,
      improvedDimensionIds: ["mask.repair_support", "mask.weight"],
      dimensionLabel: (id) => (id === "mask.repair_support" ? "Repair-Unterstützung" : null),
    }),
    "Passt bei der Repair-Unterstützung deutlich besser als die Option im Budget.",
  )
  // A notice that needs a value the client lacks is omitted, never guessed.
  assert.equal(budgetNoticeCopy({ notice: "strict_one_affordable", budget: null }), null)
  assert.equal(
    budgetNoticeCopy({ notice: "flex_improvement", budget: flex15, improvedDimensionIds: [] }),
    null,
  )
})

/* ---------------------------------------------------------------- budget step */

test("budget answers: saved value or suggestion opens the step; only complete answers save", () => {
  assert.deepEqual(initialStage3BudgetAnswer({ saved: null, suggestion: 15 }), {
    limit: 15,
    allowExceptions: null,
  })
  assert.deepEqual(initialStage3BudgetAnswer({ saved: null, suggestion: null }), {
    limit: null,
    allowExceptions: null,
  })
  assert.deepEqual(
    initialStage3BudgetAnswer({
      saved: { kind: "capped", limitEur: 5, allowExceptions: true },
      suggestion: 15,
    }),
    { limit: 5, allowExceptions: true },
  )
  assert.equal(stage3BudgetFromAnswer({ limit: 5, allowExceptions: null }), null)
  assert.deepEqual(stage3BudgetFromAnswer({ limit: 15, allowExceptions: false }), {
    kind: "capped",
    limitEur: 15,
    allowExceptions: false,
  })
  assert.deepEqual(stage3BudgetFromAnswer({ limit: "uncapped", allowExceptions: null }), {
    kind: "uncapped",
  })
  assert.equal(sameStage3Budget({ kind: "uncapped" }, { kind: "uncapped" }), true)
  assert.equal(
    sameStage3Budget(
      { kind: "capped", limitEur: 5, allowExceptions: true },
      { kind: "capped", limitEur: 5, allowExceptions: false },
    ),
    false,
  )
})

function renderStep(props: Partial<React.ComponentProps<typeof Stage3BudgetStep>>) {
  return renderToStaticMarkup(
    <Stage3BudgetStep
      screen="limit"
      answer={{ limit: null, allowExceptions: null }}
      suggestion={null}
      saveStatus="idle"
      onSelectLimit={() => {}}
      onSelectFlexibility={() => {}}
      onContinue={() => {}}
      {...props}
    />,
  )
}

test("budget step screen 1 shows the approved copy and keeps the chip on the suggestion", () => {
  const markup = renderStep({ answer: { limit: 5, allowExceptions: null }, suggestion: 15 })
  assert.match(markup, /Dein Budget/)
  assert.match(markup, /Was darf ein Pflegeprodukt ungefähr kosten\?/)
  assert.match(markup, /Preis pro Packung – gilt für jedes Produkt deiner Routine\./)
  for (const label of ["Bis 5 €", "Bis 15 €", "Keine feste Preisgrenze"]) {
    assert.match(markup, new RegExp(label))
  }
  // The chip sits on „Bis 15 €“ while „Bis 5 €“ is the selected answer.
  const chipIndex = markup.indexOf("Wie deine bisherigen Produkte")
  assert.ok(chipIndex > markup.indexOf("Bis 15 €"))
  assert.ok(chipIndex < markup.indexOf("Keine feste Preisgrenze"))
  assert.match(markup, /aria-pressed="true"[^>]*>.*?Bis 5 €/)
  assert.doesNotMatch(markup, /überspringen|Weiß nicht/i)
  assert.match(markup, />Weiter</)
})

test("budget step without an answer cannot continue and shows no chip without a suggestion", () => {
  const markup = renderStep({})
  assert.doesNotMatch(markup, /Wie deine bisherigen Produkte/)
  assert.match(markup, /<button[^>]*disabled=""[^>]*>Weiter<\/button>/)
})

test("budget step screen 2 asks the follow-up for the chosen limit", () => {
  const markup = renderStep({ screen: "flexibility", answer: { limit: 5, allowExceptions: null } })
  assert.match(markup, /Bis 5 € für jedes Produkt\?/)
  assert.match(markup, /Ja, für jedes\./)
  assert.match(markup, /Teurere zeigen wir nur, wenn es im Budget kaum Passendes gibt\./)
  assert.match(markup, /Einzelne dürfen mehr kosten\./)
  assert.match(markup, /Nur einzelne – wenn sie deutlich besser passen\./)
  assert.doesNotMatch(markup, /Preis pro Packung/)
})

test("budget save failures keep the answer and name the recovery action", () => {
  const unavailable = renderStep({
    answer: { limit: "uncapped", allowExceptions: null },
    saveStatus: "unavailable",
  })
  assert.match(unavailable, /role="alert"[^>]*>Nicht gespeichert\. Deine Auswahl bleibt erhalten\./)
  assert.match(unavailable, />Erneut versuchen</)
  const conflict = renderStep({
    screen: "flexibility",
    answer: { limit: 15, allowExceptions: true },
    saveStatus: "conflict",
  })
  assert.match(
    conflict,
    /Dein Budget wurde gerade an anderer Stelle geändert\. Deine Auswahl ist noch nicht gespeichert\./,
  )
  assert.match(conflict, />Meine Auswahl speichern</)
  assert.match(conflict, /aria-pressed="true"[^>]*>.*?Einzelne dürfen mehr kosten/)
})

/* ---------------------------------------------------------------- comparison */

function candidate(productId: string, verdict: "ideal" | "supportive" = "ideal") {
  return {
    productId,
    category: "conditioner" as const,
    role: "conditioner_rinse_out" as const,
    verdict,
    criteria: [],
    recommendation: {
      recommendationId: `recommendation-${productId}`,
      productId,
      category: "conditioner" as const,
      role: "conditioner_rinse_out" as const,
      displayName: `Conditioner ${productId}`,
      reason: "Passt.",
      authorityRuleId: "rule",
    },
    factFingerprint: `fingerprint-${productId}`,
  } satisfies Stage3SelectedComparisonCandidate
}

function uncoveredComparison(
  budget: Partial<Stage3FitComparison> = {},
  presentation: Record<string, Record<string, unknown>> = {},
): Stage3FitComparison {
  const ids = ["a", "b", "c"]
  return {
    schemaVersion: 1,
    mode: "comparison",
    category: "conditioner",
    role: "conditioner_rinse_out",
    subjectKey: "decision:conditioner:conditioner_rinse_out:gap",
    sourceIdentity: null,
    products: ids.map((id) => ({
      productId: id,
      displayName: `Conditioner ${id}`,
      category: "conditioner" as const,
      role: "conditioner_rinse_out" as const,
      source: "alternative" as const,
      presentation: {
        priceLabel: "9,95 €",
        netContentLabel: "200 ml",
        ...presentation[id],
      },
    })),
    alternatives: ids.map((id) => candidate(id)),
    dimensions: [],
    evidenceRows: [],
    ...budget,
  } as Stage3FitComparison
}

const uncoveredEvaluation: Stage3AuthorityEvaluation = {
  status: "known",
  category: "conditioner",
  subjectKey: "decision:conditioner:conditioner_rinse_out:gap",
  verdict: "unknown",
  criteria: [],
  allowedActions: ["leave_uncovered"],
  recommendation: null,
  productFactFingerprint: null,
  recommendationFactFingerprint: null,
  coverageRuleIds: ["rule"],
}

test("default selection honors the budget's defaultProductId, including none", () => {
  const plain = uncoveredComparison()
  assert.equal(comparisonHasBudgetAllocation(plain), false)
  assert.equal(defaultRecommendationCandidate(plain)?.productId, "a")
  assert.equal(selectedComparisonCandidate(plain)?.productId, "a")

  const budgetedB = uncoveredComparison({ defaultProductId: "b" })
  assert.equal(comparisonHasBudgetAllocation(budgetedB), true)
  assert.equal(selectedComparisonCandidate(budgetedB)?.productId, "b")
  // An explicit selection always wins over the default.
  assert.equal(
    selectedComparisonCandidate(budgetedB, { selectedRecommendationProductId: "c" })?.productId,
    "c",
  )

  const none = uncoveredComparison({ defaultProductId: null })
  assert.equal(comparisonHasBudgetAllocation(none), true)
  assert.equal(selectedComparisonCandidate(none), null)
  assert.equal(
    selectedComparisonCandidate(none, { selectedRecommendationProductId: "a" })?.productId,
    "a",
  )
})

function renderComparison(
  comparison: Stage3FitComparison,
  props: Partial<React.ComponentProps<typeof ProductFitComparison>> = {},
) {
  return renderToStaticMarkup(
    <ProductFitComparison
      comparison={comparison}
      evaluation={uncoveredEvaluation}
      categoryLabel="Conditioner"
      roleLabel="Pflege nach der Wäsche"
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      {...props}
    />,
  )
}

test("without budget fields the review renders byte-identically, budget props or not", () => {
  const plain = uncoveredComparison()
  const before = renderComparison(plain)
  const withProps = renderComparison(plain, {
    budget: { kind: "capped", limitEur: 5, allowExceptions: false },
    onEditBudget: () => {},
  })
  assert.equal(withProps, before)
  assert.match(before, /Beste Passung/)
  assert.doesNotMatch(before, /Budget/)
})

test("strict budget with one affordable option: labels, badge, budget line and notice", () => {
  const markup = renderComparison(
    uncoveredComparison(
      { defaultProductId: "a", budgetNotice: "strict_one_affordable", budgetException: null },
      {
        a: { labelKind: "within_budget", overBudget: false, packagePriceEur: 3.95 },
        b: { labelKind: "alternative", overBudget: true, packagePriceEur: 7.45 },
        c: { labelKind: "alternative", overBudget: true, packagePriceEur: 11.95 },
      },
    ),
    {
      budget: { kind: "capped", limitEur: 5, allowExceptions: false },
      onEditBudget: () => {},
    },
  )
  assert.doesNotMatch(markup, /Beste Passung|Beste verfügbare Option/)
  assert.match(markup, />Im Budget</)
  assert.match(markup, />Alternative</)
  assert.match(markup, /Über deinem Budget/)
  assert.match(markup, /Budget: <span[^>]*>Bis 5 € für jedes Produkt<\/span>/)
  assert.match(markup, />Ändern</)
  assert.match(
    markup,
    /role="status"[^>]*>Nur eine passende Option bis 5 €\. Weitere Optionen liegen über deinem Budget\./,
  )
  // No Drogerie/Profi badge is invented while the server sends no market segment.
  assert.doesNotMatch(markup, /Drogerie|Profi/)
  assert.match(markup, /Dieses Produkt einplanen/)
})

test("strict budget with nothing affordable preselects nothing and continues without a product", () => {
  const markup = renderComparison(
    uncoveredComparison(
      { defaultProductId: null, budgetNotice: "strict_none_affordable", budgetException: null },
      {
        a: { labelKind: "alternative", overBudget: true },
        b: { labelKind: "alternative", overBudget: true },
        c: { labelKind: "alternative", overBudget: true },
      },
    ),
    { budget: { kind: "capped", limitEur: 5, allowExceptions: false } },
  )
  assert.doesNotMatch(markup, /aria-pressed="true"/)
  assert.doesNotMatch(markup, /Dieses Produkt einplanen/)
  // The existing leave action is the sticky primary action, once.
  assert.equal(markup.split("Vorerst ohne Produkt fortfahren").length - 1, 2) // aria-label + text
  assert.match(markup, /Bis 5 € gibt es hier nichts, das zu deinem Haar passt\./)
  // Without onEditBudget there is no „Ändern“ link.
  assert.doesNotMatch(markup, />Ändern</)
})

test("selecting a card under a no-default budget plans it", () => {
  const calls: unknown[] = []
  const comparison = uncoveredComparison(
    { defaultProductId: null, budgetNotice: null, budgetException: null },
    { b: { labelKind: "alternative", overBudget: true } },
  )
  const element = ProductFitComparison({
    comparison,
    evaluation: uncoveredEvaluation,
    displayedAlternativeIndex: 0,
    onDisplayedAlternativeChange: () => {},
    selectedRecommendationProductId: "b",
    onAction: (action, selection) => calls.push([action, selection]),
  })
  const markup = renderToStaticMarkup(element)
  assert.match(markup, /Dieses Produkt einplanen/)
})

test("flexible exception: „Empfohlen“ above budget with the improvement notice", () => {
  const markup = renderComparison(
    uncoveredComparison(
      {
        defaultProductId: "a",
        budgetNotice: "flex_improvement",
        budgetException: { kind: "improvement", improvedDimensionIds: ["conditioner.weight"] },
      },
      {
        a: { labelKind: "recommended", overBudget: true },
        b: { labelKind: "within_budget", overBudget: false },
      },
    ),
    { budget: { kind: "capped", limitEur: 15, allowExceptions: true }, onEditBudget: () => {} },
  )
  assert.match(markup, />Empfohlen</)
  assert.match(markup, />Im Budget</)
  assert.match(markup, /Bis 15 € · einzelne dürfen mehr kosten/)
  assert.match(markup, /Passt beim Pflegegewicht deutlich besser als die Option im Budget\./)
})

test("no-ceiling budget keeps neutral labels without claiming best fit", () => {
  const markup = renderComparison(
    uncoveredComparison(
      { defaultProductId: "a", budgetNotice: null, budgetException: null },
      { a: { labelKind: "neutral" }, b: { labelKind: "neutral" } },
    ),
    { budget: { kind: "uncapped" }, onEditBudget: () => {} },
  )
  assert.doesNotMatch(markup, /Beste Passung/)
  assert.match(markup, />Passende Option</)
  assert.match(markup, />Alternative 1</)
  assert.match(markup, /Ohne feste Preisgrenze/)
  assert.doesNotMatch(markup, /Über deinem Budget/)
})
