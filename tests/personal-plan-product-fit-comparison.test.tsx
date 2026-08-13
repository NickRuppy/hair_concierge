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
        { productId: "alternative-two", position: { kind: "position", stopId: "strong" } },
      ],
      reason: "Sanft genug.",
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
    if (typeof element.type === "function") {
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
  assert.match(html, /2 von 2/)
  assert.match(html, /Zweite Alternative trotz Einschränkung übernehmen/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /aria-label="Ziel"/)
  assert.doesNotMatch(html, /Öl|Gruppiert/)

  const tree = ProductFitComparison({
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
  ;(
    findByAriaLabel(tree, "Zweite Alternative auswählen").props.onClick as (() => void) | undefined
  )?.()
  assert.deepEqual(focusChanges, [0, 1])
  assert.deepEqual(calls, [])
  ;(
    findByAriaLabel(tree, "Zweite Alternative trotz Einschränkung übernehmen").props.onClick as
      | (() => void)
      | undefined
  )?.()
  assert.deepEqual(calls, [
    ["select_replacement", { productId: "alternative-two", factFingerprint: "fingerprint-two" }],
  ])
})

test("focused alternative keeps identity, facts, CTA, counter, and purple rail markers in one presentation state", () => {
  const first = renderToStaticMarkup(
    <ProductFitComparison
      comparison={comparison}
      evaluation={evaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )
  const second = renderToStaticMarkup(
    <ProductFitComparison
      comparison={comparison}
      evaluation={evaluation}
      displayedAlternativeIndex={1}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(first, /Sanfte Alternative/)
  assert.match(first, /250 ml/)
  assert.match(first, /13,01/)
  assert.match(first, /1 von 2/)
  assert.match(first, /Sanfte Alternative als Ersatz übernehmen/)
  assert.match(first, /left:8%/)
  assert.match(second, /Zweite Alternative/)
  assert.match(second, /200 ml/)
  assert.match(second, /8,99/)
  assert.match(second, /2 von 2/)
  assert.match(second, /Zweite Alternative trotz Einschränkung übernehmen/)
  assert.match(second, /left:92%/)
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
    verdict: "unknown",
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
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
      comparison={comparison}
      evaluation={pendingEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Verifizierte Alternative wählen/)
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
    reason: "specialist_category",
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      comparison={compactComparison}
      evaluation={evaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Verifizierte Produktfakten/)
  assert.match(html, /Reinigung: Sanft genug\./)
  assert.doesNotMatch(html, /aria-label="Ziel"/)
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
      comparison={openComparison}
      evaluation={unknownEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Diese Passung ist noch offen\./)
  assert.doesNotMatch(html, /Keine passende Alternative verfügbar\./)
})
