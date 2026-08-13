import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  ProductFitComparison,
  type ProductFitComparisonAction,
} from "../src/components/personal-plan-products/product-fit-comparison"
import type { Stage3AuthorityEvaluation } from "../src/lib/personal-plan/products/authority/contracts"
import type { Stage3FitComparison } from "../src/lib/personal-plan/products/fit-comparison"

const comparison: Stage3FitComparison = {
  schemaVersion: 1,
  mode: "comparison",
  category: "shampoo",
  role: "shampoo_everyday",
  subjectKey: "subject:shampoo",
  sourceIdentity: {
    kind: "catalog_product",
    productId: "owned-shampoo",
    displayName: "Mein Shampoo",
    category: "shampoo",
  },
  products: [
    {
      productId: "owned-shampoo",
      displayName: "Mein Shampoo",
      category: "shampoo",
      role: "shampoo_everyday",
      source: "current",
      presentation: { netContentLabel: "300 ml", priceLabel: "4,29 €" },
    },
    {
      productId: "alternative-one",
      displayName: "Sanfte Alternative",
      category: "shampoo",
      role: "shampoo_everyday",
      source: "alternative",
      presentation: { netContentLabel: "250 ml", priceLabel: "13,01 €" },
    },
    {
      productId: "alternative-two",
      displayName: "Zweite Alternative",
      category: "shampoo",
      role: "shampoo_everyday",
      source: "alternative",
      presentation: { netContentLabel: "200 ml", priceLabel: "8,99 €" },
    },
  ],
  alternatives: [
    {
      productId: "alternative-one",
      category: "shampoo",
      role: "shampoo_everyday",
      verdict: "ideal",
      criteria: [
        { criterionId: "cleanse", label: "Reinigung", result: "pass", explanation: "Sanft genug." },
      ],
      recommendation: {
        recommendationId: "recommendation-one",
        productId: "alternative-one",
        category: "shampoo",
        role: "shampoo_everyday",
        displayName: "Sanfte Alternative",
        reason: "Passt zu deinem Bedarf.",
        authorityRuleId: "rule-one",
      },
      factFingerprint: "fingerprint-one",
    },
    {
      productId: "alternative-two",
      category: "shampoo",
      role: "shampoo_everyday",
      verdict: "supportive",
      criteria: [
        {
          criterionId: "cleanse",
          label: "Reinigung",
          result: "caution",
          explanation: "Mit Einschränkung.",
        },
      ],
      recommendation: {
        recommendationId: "recommendation-two",
        productId: "alternative-two",
        category: "shampoo",
        role: "shampoo_everyday",
        displayName: "Zweite Alternative",
        reason: "Unterstützt deinen Bedarf.",
        authorityRuleId: "rule-two",
      },
      factFingerprint: "fingerprint-two",
    },
  ],
  dimensions: [
    {
      dimensionId: "cleanse",
      label: "Reinigung",
      presentationKind: "ordered",
      stops: [
        { stopId: "gentle", label: "Sanft" },
        { stopId: "strong", label: "Stark" },
      ],
      targetPosition: { kind: "position", stopId: "gentle" },
      productPositions: [
        { productId: "owned-shampoo", position: { kind: "position", stopId: "strong" } },
        { productId: "alternative-one", position: { kind: "position", stopId: "gentle" } },
        { productId: "alternative-two", position: { kind: "position", stopId: "gentle" } },
      ],
      reason: "Sanft genug.",
    },
  ],
  evidenceRows: [
    {
      rowId: "cleanse",
      label: "Reinigung",
      target: {
        valueLabel: "sanft",
        rationale: "Sanfte Reinigung schützt die bestätigte Kopfhautbalance.",
        profileEvidenceLabels: ["trockene Kopfhaut"],
      },
      productValues: [
        { productId: "owned-shampoo", valueLabel: "stark", relation: "outside_target" },
        { productId: "alternative-one", valueLabel: "sanft", relation: "in_target" },
        { productId: "alternative-two", valueLabel: "sanft", relation: "in_target" },
      ],
    },
  ],
}

const evaluation: Stage3AuthorityEvaluation = {
  status: "known",
  category: "shampoo",
  subjectKey: "subject:shampoo",
  verdict: "mismatch",
  criteria: [],
  allowedActions: ["acknowledge_override"],
  recommendation: null,
  productFactFingerprint: "owned-fingerprint",
  recommendationFactFingerprint: null,
  coverageRuleIds: [],
}

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function findByAriaLabel(node: ReactNode, label: string): ReactElement<Record<string, unknown>> {
  if (React.isValidElement(node)) {
    const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>
    if (element.props["aria-label"] === label) return element
    if (typeof element.type === "function" && element.type.name !== "EvidenceMatrix") {
      try {
        return findByAriaLabel(
          (element.type as (props: Record<string, unknown>) => ReactNode)(element.props),
          label,
        )
      } catch {
        // Continue searching sibling branches.
      }
    }
    for (const child of childrenOf(element)) {
      try {
        return findByAriaLabel(child, label)
      } catch {
        // Continue searching sibling branches.
      }
    }
  }
  throw new Error(`Element with aria-label ${label} was not found`)
}

test("renders one focused server alternative and persists only an explicit exact replacement", () => {
  const calls: Array<[ProductFitComparisonAction, unknown]> = []
  const focusChanges: number[] = []
  const element = (
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={2}
      comparison={comparison}
      evaluation={evaluation}
      displayedAlternativeIndex={1}
      onDisplayedAlternativeChange={(index) => focusChanges.push(index)}
      onAction={(action, selectedCandidate) => calls.push([action, selectedCandidate])}
      onBack={() => {}}
    />
  )
  const html = renderToStaticMarkup(element)

  assert.match(html, /Mein Shampoo/)
  assert.match(html, /Zweite Alternative/)
  assert.match(html, /200 ml/)
  assert.match(html, /8,99/)
  assert.match(html, /Alternative 2 von 2/)
  assert.match(html, /Diese Alternative wählen/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /Außerhalb des Ziels/)
  assert.match(html, /Deins:[\s\S]*stark[\s\S]*Alternative:[\s\S]*sanft[\s\S]*Ziel:[\s\S]*sanft/)
  assert.match(html, /Warum dieses Ziel\?/)
  assert.match(html, /aria-label="Reinigung auswählen"/)
  assert.match(html, /aria-pressed="true"/)
  assert.doesNotMatch(html, /Öl|Gruppiert/)

  const tree = ProductFitComparison({
    categoryLabel: "Shampoo",
    roleLabel: "Shampoo",
    reviewPosition: 1,
    reviewTotal: 2,
    comparison,
    evaluation,
    displayedAlternativeIndex: 1,
    onDisplayedAlternativeChange: (index) => focusChanges.push(index),
    onAction: (action, selectedCandidate) => calls.push([action, selectedCandidate]),
    onBack: () => {},
  })
  ;(findByAriaLabel(tree, "Vorherige Alternative").props.onClick as (() => void) | undefined)?.()
  assert.deepEqual(focusChanges, [0])
  assert.deepEqual(calls, [])
  ;(findByAriaLabel(tree, "Diese Alternative wählen").props.onClick as (() => void) | undefined)?.()
  assert.deepEqual(calls, [
    ["select_replacement", { productId: "alternative-two", factFingerprint: "fingerprint-two" }],
  ])
})

test("shows the truthful zero-action fallback with exactly one enabled primary action", () => {
  const calls: ProductFitComparisonAction[] = []
  const noActionComparison: Stage3FitComparison = {
    ...comparison,
    alternatives: [],
    products: comparison.products.filter((product) => product.source === "current"),
    dimensions: [],
  }
  const noActionEvaluation: Stage3AuthorityEvaluation = {
    ...evaluation,
    allowedActions: [],
    verdict: "ideal",
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={noActionComparison}
      evaluation={noActionEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={(action) => calls.push(action)}
      onBack={() => calls.push("keep_owned")}
    />,
  )

  assert.match(html, /Keine passende Alternative verfügbar\./)
  assert.match(html, /Zurück zu meinen Produkten/)
  assert.doesNotMatch(html, /als Ersatz übernehmen|Vorerst ohne Produkt|trotzdem behalten/)
})

test("uses a verified pending alternative as the primary action even without select_replacement in allowedActions", () => {
  const pendingEvaluation: Stage3AuthorityEvaluation = {
    status: "pending",
    category: "shampoo",
    subjectKey: "subject:shampoo",
    reason: "product_intake_pending",
    allowedActions: ["keep_pending"],
    coverageRuleIds: [],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={comparison}
      evaluation={pendingEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Diese Alternative wählen/)
  assert.match(html, /Auf Analyse warten/)
})

test("shows the pending product identity while its analysis is still open", () => {
  const pendingComparison: Stage3FitComparison = {
    schemaVersion: 1,
    mode: "unavailable",
    category: "scalp_care",
    role: "scalp_comfort",
    subjectKey: "subject:pending-scalp-product",
    sourceIdentity: {
      kind: "pending_submission",
      submissionId: "submission-scalp-product",
      displayName: "Kopfhaut-Tonic",
      category: "scalp_care",
      reviewStatus: "pending_review",
    },
    products: [],
    alternatives: [],
    dimensions: [],
    reason: "no_exact_product",
  }
  const pendingEvaluation: Stage3AuthorityEvaluation = {
    status: "pending",
    category: "scalp_care",
    subjectKey: "subject:pending-scalp-product",
    reason: "product_intake_pending",
    allowedActions: ["keep_pending", "leave_uncovered"],
    coverageRuleIds: [],
  }

  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Kopfhautpflege"
      roleLabel="Kopfhautpflege"
      reviewPosition={1}
      reviewTotal={1}
      comparison={pendingComparison}
      evaluation={pendingEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Kopfhaut-Tonic/)
  assert.doesNotMatch(html, /Noch kein Produkt/)
  assert.match(html, /Auf Analyse warten/)
})

test("keeps an unavailable analysis distinct from the no-alternative decision fallback", () => {
  const unsupportedEvaluation: Stage3AuthorityEvaluation = {
    status: "unsupported",
    category: "shampoo",
    subjectKey: "subject:shampoo",
    reason: "analysis_unavailable",
    allowedActions: [],
    coverageRuleIds: [],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={comparison}
      evaluation={unsupportedEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onRetry={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Analyse konnte nicht geladen werden\./)
  assert.match(html, /Erneut versuchen/)
  assert.doesNotMatch(html, /Keine passende Alternative verfügbar\./)
})

test("renders compact specialist facts without inventing comparison rails", () => {
  const compactComparison: Stage3FitComparison = {
    ...comparison,
    mode: "compact",
    dimensions: [],
    evidenceRows: undefined,
    reason: "specialist_category",
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={compactComparison}
      evaluation={evaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Warum diese Einordnung\?/)
  assert.match(html, /Reinigung:[\s\S]*Sanft genug\./)
  assert.doesNotMatch(html, /Eigenschaft für Eigenschaft/)
})

test("keeps an unknown review open when no authority action is truthful", () => {
  const unknownEvaluation: Stage3AuthorityEvaluation = {
    status: "unknown",
    category: "shampoo",
    subjectKey: "subject:shampoo",
    missingFacts: ["product_specs"],
    criteria: [],
    allowedActions: [],
    coverageRuleIds: [],
  }
  const openComparison: Stage3FitComparison = {
    ...comparison,
    alternatives: [],
    products: comparison.products.filter((product) => product.source === "current"),
    dimensions: [],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={openComparison}
      evaluation={unknownEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Noch nicht eindeutig beurteilbar/)
  assert.doesNotMatch(html, /Keine passende Alternative verfügbar\./)
})

test("offers keep, exact replacement, and go-without for a partly fitting owned product", () => {
  const supportiveEvaluation: Stage3AuthorityEvaluation = {
    ...evaluation,
    verdict: "supportive",
    allowedActions: ["keep_owned", "acknowledge_override", "leave_uncovered"],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={comparison}
      evaluation={supportiveEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Passt teilweise/)
  assert.match(html, /Mein Produkt behalten/)
  assert.doesNotMatch(html, /Mein Produkt trotzdem behalten/)
  assert.match(html, /Diese Alternative wählen/)
  assert.match(html, /Vorerst ohne Produkt fortfahren/)
})

test("labels a supportive replacement as only partly fitting", () => {
  const supportiveComparison: Stage3FitComparison = {
    ...comparison,
    evidenceRows: comparison.evidenceRows?.map((row) => ({
      ...row,
      productValues: row.productValues.map((value) =>
        value.productId === "alternative-two"
          ? { ...value, valueLabel: "stark", relation: "outside_target" as const }
          : value,
      ),
    })),
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={supportiveComparison}
      evaluation={evaluation}
      displayedAlternativeIndex={1}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Alternative · passt teilweise/)
  assert.doesNotMatch(html, /Passende Alternative/)
  assert.equal((html.match(/aria-label="Außerhalb des Ziels"/g) ?? []).length, 2)
})

test("explains a fitting product when no better verified alternative exists", () => {
  const fitComparison: Stage3FitComparison = {
    ...comparison,
    products: comparison.products.filter((product) => product.source === "current"),
    alternatives: [],
  }
  const fitEvaluation: Stage3AuthorityEvaluation = {
    ...evaluation,
    verdict: "ideal",
    allowedActions: ["keep_owned"],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={2}
      reviewTotal={3}
      comparison={fitComparison}
      evaluation={fitEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Shampoo · Produkt 2 von 3/)
  assert.match(html, /Dein Shampoo passt/)
  assert.match(html, /keine klar bessere verifizierte Alternative verfügbar/)
  assert.match(html, /Mein Produkt behalten/)
  assert.doesNotMatch(html, /Passende Alternative/)
})

test("renders an explicit uncovered state instead of an empty review", () => {
  const uncoveredComparison: Stage3FitComparison = {
    schemaVersion: 1,
    mode: "unavailable",
    category: "leave_in",
    role: "post_wash_leave_in",
    subjectKey: "subject:uncovered-leave-in",
    sourceIdentity: null,
    products: [],
    alternatives: [],
    dimensions: [],
    evidenceRows: [],
    reason: "no_exact_product",
  }
  const uncoveredEvaluation: Stage3AuthorityEvaluation = {
    status: "known",
    category: "leave_in",
    subjectKey: "subject:uncovered-leave-in",
    verdict: "unknown",
    criteria: [],
    allowedActions: ["leave_uncovered"],
    recommendation: null,
    productFactFingerprint: null,
    recommendationFactFingerprint: null,
    coverageRuleIds: [],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Leave-in"
      roleLabel="Leave-in"
      reviewPosition={3}
      reviewTotal={3}
      comparison={uncoveredComparison}
      evaluation={uncoveredEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Noch kein Leave-in/)
  assert.match(html, /keine verifizierte Empfehlung verfügbar/)
  assert.match(html, /Noch kein Produkt/)
  assert.match(html, /Vorerst ohne Produkt fortfahren/)
})

test("keeps a partial verdict explicit when no verified alternative exists", () => {
  const partialComparison: Stage3FitComparison = {
    ...comparison,
    products: comparison.products.filter((product) => product.source === "current"),
    alternatives: [],
  }
  const partialEvaluation: Stage3AuthorityEvaluation = {
    ...evaluation,
    verdict: "supportive",
    allowedActions: ["keep_owned", "leave_uncovered"],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={partialComparison}
      evaluation={partialEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Dein Shampoo passt teilweise/)
  assert.match(html, /Außerhalb des Ziels/)
  assert.match(html, /Mein Produkt behalten/)
  assert.match(html, /Vorerst ohne Produkt fortfahren/)
})

test("keeps a mismatch explicit when no verified alternative exists", () => {
  const mismatchComparison: Stage3FitComparison = {
    ...comparison,
    products: comparison.products.filter((product) => product.source === "current"),
    alternatives: [],
  }
  const mismatchEvaluation: Stage3AuthorityEvaluation = {
    ...evaluation,
    verdict: "mismatch",
    allowedActions: ["acknowledge_override", "leave_uncovered"],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={mismatchComparison}
      evaluation={mismatchEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Dein Shampoo passt nicht/)
  assert.match(html, /außerhalb deines Ziels/)
  assert.doesNotMatch(html, /passt grundsätzlich/)
})

test("does not show a misleading target count when any relevant row is unknown", () => {
  const incompleteComparison: Stage3FitComparison = {
    ...comparison,
    evidenceRows: [
      ...(comparison.evidenceRows ?? []),
      {
        rowId: "scalp-focus",
        label: "Kopfhaut-Fokus",
        target: {
          valueLabel: "ausgeglichen",
          rationale: "Der Fokus richtet sich nach deinem bestätigten Kopfhautprofil.",
          profileEvidenceLabels: ["trockene Kopfhaut"],
        },
        productValues: [
          { productId: "owned-shampoo", valueLabel: "nicht bestätigt", relation: "unknown" },
          { productId: "alternative-one", valueLabel: "ausgeglichen", relation: "in_target" },
        ],
      },
    ],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={incompleteComparison}
      evaluation={evaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Passt nicht/)
  assert.doesNotMatch(html, /von 2 im Ziel/)
})
