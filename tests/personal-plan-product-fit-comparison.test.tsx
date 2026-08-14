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

  assert.match(html, /Passt mit Einschränkung/)
  assert.match(html, /Mein Produkt behalten/)
  assert.doesNotMatch(html, /Mein Produkt trotzdem behalten/)
  assert.match(html, /Diese Alternative wählen/)
  assert.match(html, /Vorerst ohne Produkt fortfahren/)
  assert.match(html, /fixed/)
  assert.doesNotMatch(html, /md:static/)
  assert.doesNotMatch(html, /md:absolute/)
  const leaveAction = findByAriaLabel(
    treeFor(supportiveEvaluation),
    "Vorerst ohne Produkt fortfahren",
  )
  assert.match(String(leaveAction.props.className), /underline/)
})

test("shows exact replacement as a direct secondary action when the owned product fits", () => {
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Shampoo"
      roleLabel="Shampoo"
      reviewPosition={1}
      reviewTotal={1}
      comparison={comparison}
      evaluation={{ ...evaluation, verdict: "ideal", allowedActions: ["keep_owned"] }}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Mein Produkt behalten/)
  assert.match(html, /aria-label="Diese Alternative wählen"/)
  assert.doesNotMatch(html, /Andere Möglichkeit/)
  assert.match(html, /h-16 w-16/)
  assert.match(html, /Diese Alternative wählen[\s\S]*Eigenschaft für Eigenschaft/)
})

test("labels a supportive replacement as only partly fitting", () => {
  const supportiveComparison: Stage3FitComparison = {
    ...comparison,
    evidenceRows: comparison.evidenceRows?.map((row) => ({
      ...row,
      productValues: row.productValues.map((value) =>
        value.productId === "alternative-two"
          ? { ...value, valueLabel: "ausgeglichen", relation: "supportive" as const }
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

  assert.match(html, /Alternative · passt mit Einschränkung/)
  assert.doesNotMatch(html, /Passende Alternative/)
  assert.equal((html.match(/aria-label="Passt mit Einschränkung"/g) ?? []).length, 1)
})

test("keeps the comparison matrix without promising search when no alternative exists", () => {
  const fitComparison: Stage3FitComparison = {
    ...comparison,
    products: comparison.products.filter((product) => product.source === "current"),
    alternatives: [],
    candidateCatalogComplete: true,
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
  assert.match(html, /Eigenschaft für Eigenschaft/)
  assert.match(html, />Prüfpunkt</)
  assert.match(html, />Deins</)
  assert.match(html, />Ziel</)
  assert.doesNotMatch(html, /Bestätigte Prüfpunkte/)
  assert.match(html, /Vollständiger Katalog geprüft/)
  assert.match(html, /kein weiteres verifiziertes Shampoo/)
  assert.match(html, /Mein Produkt behalten/)
  assert.doesNotMatch(html, /Produkt suchen/)
  assert.doesNotMatch(html, /Passende Alternative/)
  assert.doesNotMatch(html, /Weitere passende Alternativen/)
})

test("does not claim exhaustive catalog coverage on the rollback path", () => {
  const html = renderToStaticMarkup(
    <ProductFitComparison
      comparison={{
        ...comparison,
        products: comparison.products.filter((product) => product.source === "current"),
        alternatives: [],
        candidateCatalogComplete: false,
      }}
      evaluation={{ ...evaluation, verdict: "ideal", allowedActions: ["keep_owned"] }}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.doesNotMatch(html, /Vollständiger Katalog geprüft/)
  assert.match(html, /keine klar bessere verifizierte Alternative verfügbar/)
})

test("keeps mismatch fallback copy truthful on the rollback path", () => {
  const html = renderToStaticMarkup(
    <ProductFitComparison
      comparison={{
        ...comparison,
        products: comparison.products.filter((product) => product.source === "current"),
        alternatives: [],
        candidateCatalogComplete: false,
      }}
      evaluation={{ ...evaluation, verdict: "mismatch", allowedActions: ["keep_owned"] }}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Aktuell ist keine verifizierte Alternative verfügbar/)
  assert.doesNotMatch(html, /keine klar bessere verifizierte Alternative verfügbar/)
})

test("renders an explicit uncovered state instead of an empty review", () => {
  let retryCalls = 0
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
      onRetry={() => {
        retryCalls += 1
      }}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Wähle dein Leave-in/)
  assert.match(html, /Gerade ist keine geprüfte Empfehlung verfügbar/)
  assert.match(html, /Erneut prüfen/)
  assert.doesNotMatch(html, /Produkt suchen/)
  assert.match(html, /Vorerst ohne Produkt fortfahren/)

  const tree = ProductFitComparison({
    categoryLabel: "Leave-in",
    roleLabel: "Leave-in",
    reviewPosition: 3,
    reviewTotal: 3,
    comparison: uncoveredComparison,
    evaluation: uncoveredEvaluation,
    displayedAlternativeIndex: 0,
    onDisplayedAlternativeChange: () => {},
    onAction: () => {},
    onRetry: () => {
      retryCalls += 1
    },
    onBack: () => {},
  })
  ;(findByAriaLabel(tree, "Erneut prüfen").props.onClick as (() => void) | undefined)?.()
  assert.equal(retryCalls, 1)
})

test("compares strict recommendations without judging an absent owned product", () => {
  const recommendationComparison: Stage3FitComparison = {
    ...comparison,
    subjectKey: "subject:uncovered-shampoo",
    sourceIdentity: null,
    products: comparison.products.filter((product) => product.source === "alternative"),
    alternatives: comparison.alternatives,
    evidenceRows: comparison.evidenceRows?.map((row) => ({
      ...row,
      productValues: row.productValues
        .filter((value) => value.productId !== "owned-shampoo")
        .map((value) =>
          value.productId === "alternative-two"
            ? { ...value, valueLabel: "stark", relation: "outside_target" as const }
            : value,
        ),
    })),
  }
  const uncoveredEvaluation: Stage3AuthorityEvaluation = {
    status: "known",
    category: "shampoo",
    subjectKey: "subject:uncovered-shampoo",
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
      categoryLabel="Shampoo"
      roleLabel="Hauptreinigung"
      comparison={recommendationComparison}
      evaluation={uncoveredEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Wähle dein Shampoo/)
  assert.match(html, /Beste Passung/)
  assert.match(html, /Alternative 1 · passt teilweise/)
  assert.match(html, /Alternative 1:[\s\S]*stark/)
  assert.match(html, /Außerhalb des Ziels/)
  assert.doesNotMatch(html, /Dein Produkt/)
  assert.doesNotMatch(html, /Du hast noch kein Shampoo/)
})

test("keeps browsing separate from selecting and saves the exact selected recommendation", () => {
  const thirdCandidate = {
    ...comparison.alternatives[0]!,
    productId: "alternative-three",
    recommendation: {
      ...comparison.alternatives[0]!.recommendation,
      recommendationId: "recommendation-three",
      productId: "alternative-three",
      displayName: "Dritte Alternative",
    },
    factFingerprint: "fingerprint-three",
  }
  const recommendationComparison: Stage3FitComparison = {
    ...comparison,
    subjectKey: "subject:uncovered-shampoo-selection",
    sourceIdentity: null,
    products: [
      ...comparison.products.filter((product) => product.source === "alternative"),
      {
        ...comparison.products.find((product) => product.productId === "alternative-one")!,
        productId: "alternative-three",
        displayName: "Dritte Alternative",
      },
    ],
    alternatives: [
      { ...comparison.alternatives[0]!, verdict: "ideal" as const },
      { ...comparison.alternatives[1]!, verdict: "ideal" as const },
      thirdCandidate,
    ],
    evidenceRows: [],
  }
  const uncoveredEvaluation: Stage3AuthorityEvaluation = {
    status: "known",
    category: "shampoo",
    subjectKey: recommendationComparison.subjectKey,
    verdict: "unknown",
    criteria: [],
    allowedActions: ["leave_uncovered"],
    recommendation: null,
    productFactFingerprint: null,
    recommendationFactFingerprint: null,
    coverageRuleIds: [],
  }
  const browseChanges: number[] = []
  const selectionChanges: string[] = []
  const calls: Array<[ProductFitComparisonAction, unknown]> = []
  const tree = ProductFitComparison({
    comparison: recommendationComparison,
    evaluation: uncoveredEvaluation,
    displayedAlternativeIndex: 2,
    selectedRecommendationProductId: "alternative-one",
    onDisplayedAlternativeChange: (index) => browseChanges.push(index),
    onSelectedRecommendationChange: (productId) => selectionChanges.push(productId),
    onAction: (action, selectedCandidate) => calls.push([action, selectedCandidate]),
    onBack: () => {},
  })

  const html = renderToStaticMarkup(tree)
  assert.match(html, /Alternative 2 von 2/)
  assert.match(html, /Dieses Produkt einplanen/)
  ;(findByAriaLabel(tree, "Nächste Alternative").props.onClick as (() => void) | undefined)?.()
  assert.deepEqual(browseChanges, [1])
  assert.equal(selectionChanges.length, 0)
  ;(findByAriaLabel(tree, "Dieses Produkt einplanen").props.onClick as (() => void) | undefined)?.()
  assert.deepEqual(calls, [
    ["select_replacement", { productId: "alternative-one", factFingerprint: "fingerprint-one" }],
  ])

  const thirdSelectedTree = ProductFitComparison({
    comparison: recommendationComparison,
    evaluation: uncoveredEvaluation,
    displayedAlternativeIndex: 2,
    selectedRecommendationProductId: "alternative-three",
    onDisplayedAlternativeChange: () => {},
    onSelectedRecommendationChange: (productId) => selectionChanges.push(productId),
    onAction: (action, selectedCandidate) => calls.push([action, selectedCandidate]),
    onBack: () => {},
  })
  ;(
    findByAriaLabel(thirdSelectedTree, "Dritte Alternative als Auswahl markieren").props.onClick as
      | (() => void)
      | undefined
  )?.()
  ;(
    findByAriaLabel(thirdSelectedTree, "Dieses Produkt einplanen").props.onClick as
      | (() => void)
      | undefined
  )?.()
  assert.equal(selectionChanges.at(-1), "alternative-three")
  assert.deepEqual(calls.at(-1), [
    "select_replacement",
    { productId: "alternative-three", factFingerprint: "fingerprint-three" },
  ])
})

test("does not expose product search for zero-candidate uncovered decisions", () => {
  let retryCalls = 0
  const tree = ProductFitComparison({
    comparison: {
      ...comparison,
      sourceIdentity: null,
      products: [],
      alternatives: [],
      evidenceRows: [],
    },
    evaluation: {
      ...evaluation,
      verdict: "unknown",
      allowedActions: ["leave_uncovered"],
    },
    displayedAlternativeIndex: 0,
    onDisplayedAlternativeChange: () => {},
    onAction: () => {},
    onRetry: () => {
      retryCalls += 1
    },
    onBack: () => {},
  })

  const html = renderToStaticMarkup(tree)
  assert.match(html, /Erneut prüfen/)
  assert.doesNotMatch(html, /Produkt suchen/)
  ;(findByAriaLabel(tree, "Erneut prüfen").props.onClick as (() => void) | undefined)?.()
  assert.equal(retryCalls, 1)
})

test("labels an all-supportive uncovered recommendation as the best available option", () => {
  const supportiveComparison: Stage3FitComparison = {
    ...comparison,
    subjectKey: "subject:uncovered-supportive-leave-in",
    sourceIdentity: null,
    products: comparison.products.filter((product) => product.source === "alternative"),
    alternatives: comparison.alternatives.map((candidate) => ({
      ...candidate,
      category: "leave_in",
      role: "post_wash_leave_in",
      verdict: "supportive" as const,
      criteria: [
        {
          criterionId: "moisture",
          label: "Pflege",
          result: "caution" as const,
          explanation: "Unterstützt den Bedarf, bleibt aber nicht die strengste Passung.",
        },
      ],
    })),
    evidenceRows: [],
  }
  const supportiveEvaluation: Stage3AuthorityEvaluation = {
    ...evaluation,
    category: "leave_in",
    subjectKey: supportiveComparison.subjectKey,
    verdict: "unknown",
    allowedActions: ["leave_uncovered"],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Leave-in"
      roleLabel="Pflege im feuchten Haar"
      comparison={supportiveComparison}
      evaluation={supportiveEvaluation}
      displayedAlternativeIndex={1}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Beste verfügbare Option/)
  assert.match(html, /Alternative 1 · passt teilweise/)
  assert.match(html, /Unterstützt den Bedarf/)
  assert.doesNotMatch(html, /Beste Passung/)
})

test("renders one uncovered candidate without an empty second slot or carousel", () => {
  const singleCandidateComparison: Stage3FitComparison = {
    ...comparison,
    subjectKey: "subject:uncovered-single-leave-in",
    sourceIdentity: null,
    products: [comparison.products.find((product) => product.productId === "alternative-one")!],
    alternatives: [comparison.alternatives[0]!],
    evidenceRows: [],
  }
  const uncoveredEvaluation: Stage3AuthorityEvaluation = {
    ...evaluation,
    subjectKey: singleCandidateComparison.subjectKey,
    verdict: "unknown",
    allowedActions: ["leave_uncovered"],
  }
  const html = renderToStaticMarkup(
    <ProductFitComparison
      categoryLabel="Leave-in"
      roleLabel="Pflege im feuchten Haar"
      comparison={singleCandidateComparison}
      evaluation={uncoveredEvaluation}
      displayedAlternativeIndex={0}
      onDisplayedAlternativeChange={() => {}}
      onAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /Wähle dein Leave-in/)
  assert.match(html, /Beste Passung/)
  assert.match(html, /Dieses Produkt einplanen/)
  assert.doesNotMatch(html, /Noch kein Produkt/)
  assert.doesNotMatch(html, /Alternative 1 von/)
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

  assert.match(html, /Dein Shampoo passt mit Einschränkung/)
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

test("keeps confirmed relation counts visible while identifying unknown rows separately", () => {
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
      {
        rowId: "neutral-route",
        label: "Kopfhaut-Route",
        target: {
          valueLabel: "ausgeglichen",
          rationale: "Die Route bleibt bis zur exakten Zielprofil-Passung neutral.",
          profileEvidenceLabels: [],
        },
        productValues: [
          { productId: "owned-shampoo", valueLabel: "trocken", relation: "no_target" },
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
  assert.match(html, /1 außerhalb · 1 nicht bestätigt · 1 ohne Einordnung/)
})

function treeFor(authorityEvaluation: Stage3AuthorityEvaluation) {
  return ProductFitComparison({
    categoryLabel: "Shampoo",
    roleLabel: "Shampoo",
    reviewPosition: 1,
    reviewTotal: 1,
    comparison,
    evaluation: authorityEvaluation,
    displayedAlternativeIndex: 0,
    onDisplayedAlternativeChange: () => {},
    onAction: () => {},
    onBack: () => {},
  })
}
