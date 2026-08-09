import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  IntakeFallbackBoundary,
  ProductCaptureScreen,
  ProductDecisionScreen,
  SemanticRoleAssignment,
  Stage3Shell,
  Stage3SystemState,
  Stage3Transition,
  type Stage3ProductDecisionProjection,
} from "../src/components/personal-plan-products"
import {
  PortfolioHandoff,
  authorityEvaluationProjection,
} from "../src/components/personal-plan-products/stage3-products-flow"
import type { Stage3ProductDraft } from "../src/lib/personal-plan/products/contracts"

const forbiddenFlowLabels = /\b(?:Pass|Teil\s+\d|Stage|Stufe)\b/i

test("stage 3 shell and transitions reuse onboarding language without internal numbering", () => {
  const captureHtml = renderToStaticMarkup(
    <Stage3Shell
      title="Produkte"
      currentStepLabel="Produkte finden"
      completedSteps={2}
      totalSteps={8}
      saveState={{ status: "saved", label: "Gespeichert" }}
    >
      <Stage3Transition context="product_capture" onContinue={() => {}} onBack={() => {}} />
    </Stage3Shell>,
  )

  const decisionHtml = renderToStaticMarkup(
    <Stage3Transition context="fit_check" onContinue={() => {}} onBack={() => {}} />,
  )

  assert.match(captureHtml, /role="progressbar"/)
  assert.match(captureHtml, /aria-live="polite"/)
  assert.match(captureHtml, /Gespeichert/)
  assert.match(captureHtml, /<h1[^>]*>Welche Produkte nutzt du\?<\/h1>/)
  assert.match(captureHtml, /Jetzt finden wir die Produkte, die du wirklich benutzt\./)
  assert.match(captureHtml, /quiz-btn-primary/)
  assert.match(captureHtml, /font-header/)
  assert.doesNotMatch(captureHtml, forbiddenFlowLabels)
  assert.match(decisionHtml, /<h1[^>]*>Wie gut passen deine Produkte\?<\/h1>/)
  assert.match(decisionHtml, /Jetzt schauen wir uns die gefundenen Produkte an/)
  assert.doesNotMatch(decisionHtml, forbiddenFlowLabels)
})

test("product capture exposes controlled search, explicit result selection, frequency, fallback, and multi-product actions", () => {
  const html = renderToStaticMarkup(
    <ProductCaptureScreen
      categoryLabel="Shampoo"
      needSummary="Du brauchst eine milde Reinigung fuer empfindliche Laengen."
      query="kerastase"
      searchStatus="ready"
      searchResults={[
        {
          candidateId: "candidate-1",
          displayName: "Kérastase Bain Satin",
          brandName: "Kérastase",
          detail: "Shampoo",
          confidenceLabel: "Exakter Treffer",
        },
      ]}
      capturedProducts={[
        {
          capturedProductId: "owned-1",
          displayName: "Kérastase Bain Satin",
          frequencyLabel: "2x/Woche",
          sourceLabel: "Aus Katalog gewählt",
        },
      ]}
      frequencyOptions={[
        { value: "weekly_1", label: "1x/Woche" },
        { value: "weekly_2", label: "2x/Woche" },
      ]}
      selectedFrequency="weekly_2"
      intakeAvailable
      onQueryChange={() => {}}
      onSelectCandidate={() => {}}
      onFrequencyChange={() => {}}
      onAddAnotherProduct={() => {}}
      onOpenFallbackIntake={() => {}}
      onContinue={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /<h1[^>]*>Dein Shampoo<\/h1>/)
  assert.match(html, /aria-label="Produkt suchen"/)
  assert.match(html, /role="listbox"/)
  assert.match(html, /aria-label="Kérastase Bain Satin auswählen"/)
  assert.match(html, /aria-label="Nutzungshäufigkeit"/)
  assert.match(html, /aria-pressed="true"[^>]*>2x\/Woche/)
  assert.match(html, /Weiteres Shampoo hinzufügen/)
  assert.match(html, /Nicht dabei\? Produkt hinzufügen/)
  assert.match(html, /Kérastase Bain Satin/)
  assert.doesNotMatch(html, /Suchtreffer als eigenes Produkt gespeichert/)
})

test("semantic role assignment lets one oil product cover several purposes without a global primary", () => {
  const html = renderToStaticMarkup(
    <SemanticRoleAssignment
      categoryLabel="Öl"
      category="oil"
      products={[
        { capturedProductId: "oil-1", displayName: "Olaplex No. 7 Bonding Oil" },
        { capturedProductId: "oil-2", displayName: "Arganöl pur" },
      ]}
      roles={[
        { role: "finish", label: "Glanz und Finish" },
        { role: "schutz", label: "Laengen schuetzen" },
      ]}
      assignments={{
        "oil-1": ["finish", "schutz"],
      }}
      errors={["Bitte ordne jede Rolle hoechstens einem Produkt zu."]}
      onToggleRole={() => {}}
      onContinue={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /<h1[^>]*>Welche Aufgabe hat dein Öl\?<\/h1>/)
  assert.match(html, /aria-label="Olaplex No\. 7 Bonding Oil: Glanz und Finish"/)
  assert.match(html, /aria-label="Olaplex No\. 7 Bonding Oil: Laengen schuetzen"/)
  assert.match(html, /name="stage3-role-oil-1-finish"/)
  assert.match(html, /name="stage3-role-oil-1-schutz"/)
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /Primäres Öl|Hauptöl|global/)
})

test("product decisions keep fit, mismatch, pending, and gap actions product-owned and explicit", () => {
  const decisions: Stage3ProductDecisionProjection[] = [
    {
      kind: "fit",
      decisionKey: "fit-1",
      categoryLabel: "Leave-in",
      needSummary: "Feuchtigkeit ohne zu beschweren.",
      ownedProductName: "Innersense Sweet Spirit Leave In",
      verdictLabel: "Passt sehr gut",
      rationale: "Deckt Feuchtigkeit und leichte Pflege ab.",
      criteria: [
        { label: "Feuchtigkeit", result: "Deckt den Bedarf", tone: "positive" },
        { label: "Gewicht", result: "Leicht genug", tone: "positive" },
      ],
      actions: [
        {
          kind: "keep",
          label: "Innersense weiterverwenden",
          productName: "Innersense Sweet Spirit Leave In",
        },
      ],
    },
    {
      kind: "mismatch",
      decisionKey: "mismatch-1",
      categoryLabel: "Maske",
      needSummary: "Staerkere Pflege fuer strapazierte Laengen.",
      ownedProductName: "Alte Proteinmaske",
      verdictLabel: "Wechseln empfohlen",
      rationale: "Zu proteinlastig fuer den aktuellen Bedarf.",
      criteria: [
        { label: "Balance", result: "Zu viel Protein", tone: "negative" },
        { label: "Pflege", result: "Empfehlung passt besser", tone: "positive" },
      ],
      recommendation: {
        productName: "Briogeo Don't Despair, Repair!",
        priceLabel: "ca. 29 EUR",
        availabilityLabel: "Preis zuletzt geprüft",
      },
      actions: [
        {
          kind: "plan_purchase",
          label: "Briogeo einplanen",
          productName: "Briogeo Don't Despair, Repair!",
        },
        { kind: "override", label: "Alte Proteinmaske behalten", productName: "Alte Proteinmaske" },
      ],
    },
    {
      kind: "pending",
      decisionKey: "pending-1",
      categoryLabel: "Scalp Care",
      needSummary: "Kopfhautprodukt wird noch geprüft.",
      ownedProductName: "Apotheken-Tonic",
      verdictLabel: "Noch in Prüfung",
      rationale: "Wir koennen es noch nicht sicher einordnen.",
      actions: [
        { kind: "pending", label: "Prüfung spaeter fortsetzen", productName: "Apotheken-Tonic" },
      ],
    },
    {
      kind: "gap",
      decisionKey: "gap-1",
      categoryLabel: "Hitzeschutz",
      needSummary: "Schutz vor Foenhitzte fehlt.",
      verdictLabel: "Offene Luecke",
      rationale: "Kein sicher passendes Produkt vorhanden.",
      actions: [{ kind: "skip", label: "Luecke im Plan markieren" }],
    },
  ]

  const html = renderToStaticMarkup(
    <ProductDecisionScreen decisions={decisions} onChooseAction={() => {}} onBack={() => {}} />,
  )

  assert.match(html, /<h1[^>]*>Produkte prüfen<\/h1>/)
  assert.match(html, /Passt sehr gut/)
  assert.match(html, /Wechseln empfohlen/)
  assert.match(html, /Noch in Prüfung/)
  assert.match(html, /Offene Luecke/)
  assert.match(html, /aria-label="Briogeo einplanen: Briogeo Don&#x27;t Despair, Repair!"/)
  assert.match(html, /aria-label="Alte Proteinmaske behalten: Alte Proteinmaske"/)
  assert.match(html, /data-stage3-decision-key="gap-1"/)
  assert.match(html, /data-stage3-action-kind="skip"/)
  assert.match(
    html,
    /aria-label="Luecke im Plan markieren: Hitzeschutz — Schutz vor Foenhitzte fehlt\."/,
  )
  assert.match(html, /ca\. 29 EUR/)
  assert.match(html, /role="status"/)
})

test("system states and intake fallback expose busy, live, retry, and boundary actions", () => {
  const stateHtml = renderToStaticMarkup(
    <Stage3SystemState
      state="loading"
      title="Produkte werden geladen"
      message="Wir holen deinen gespeicherten Stand."
    />,
  )

  const fallbackHtml = renderToStaticMarkup(
    <IntakeFallbackBoundary
      categoryLabel="Conditioner"
      status="error"
      message="Upload konnte nicht gespeichert werden."
      frequencyOptions={[{ value: "weekly_1x", label: "1x/Woche" }]}
      selectedFrequency={null}
      onFrequencyChange={() => {}}
      onOpen={() => {}}
      onRetry={() => {}}
      onCancel={() => {}}
    />,
  )

  assert.match(stateHtml, /aria-busy="true"/)
  assert.match(stateHtml, /role="status"/)
  assert.match(stateHtml, /aria-live="polite"/)
  assert.match(fallbackHtml, /role="alert"/)
  assert.match(fallbackHtml, /Produkt per Foto oder manuell hinzufügen/)
  assert.match(fallbackHtml, /Erneut versuchen/)
  assert.match(fallbackHtml, /Zurück zur Suche/)
})

test("completed Stage 3 offers a truthful Routine handoff without exposing technical IDs", () => {
  const html = renderToStaticMarkup(
    <PortfolioHandoff
      completion={{
        status: "ready_for_routine",
        draft: {} as never,
        portfolio: {
          ownedProducts: [],
          plannedPurchases: [],
          pendingProducts: [],
          uncoveredRoles: [],
        } as never,
        personalPlanId: "plan-opaque-123",
        refinedVersionId: "refined-opaque-123",
        productPortfolioVersionId: "portfolio-opaque-123",
        routineProposalId: "proposal-opaque-123",
        next: { stage: 4, href: "/routine" },
      }}
    />,
  )

  assert.match(html, />Routine öffnen</)
  assert.doesNotMatch(html, /portfolio-opaque-123|proposal-opaque-123|plan-opaque-123/)
  assert.doesNotMatch(html, /bereits aktiv|aktiviert/)
})

test("unknown and unsupported server evaluations stay explicit and do not acquire invented actions", () => {
  const draft = { products: [] } as unknown as Stage3ProductDraft
  const subject = {
    decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
    category: "conditioner" as const,
    role: "conditioner_rinse_out" as const,
    capturedProductId: null,
    subjectKind: "uncovered_role" as const,
  }
  const unknown = authorityEvaluationProjection(draft, subject, {
    status: "unknown",
    category: "conditioner",
    subjectKey: subject.decisionKey,
    missingFacts: ["catalog_product_facts"],
    criteria: [
      {
        criterionId: "conditioner.weight",
        label: "Gewicht",
        result: "unknown",
        explanation: "Noch nicht bestätigt.",
      },
    ],
    allowedActions: ["leave_uncovered"],
    coverageRuleIds: [],
  })
  const unsupported = authorityEvaluationProjection(draft, subject, {
    status: "unsupported",
    category: "conditioner",
    subjectKey: subject.decisionKey,
    reason: "conditioner_target_unavailable",
    allowedActions: [],
    coverageRuleIds: [],
  })

  assert.equal(unknown.verdictLabel, "Noch nicht beurteilbar")
  assert.deepEqual(
    unknown.actions.map((action) => action.kind),
    ["skip"],
  )
  assert.equal(unknown.criteria?.[0]?.result, "Noch offen")
  assert.equal(unsupported.verdictLabel, "Prüfung nicht verfügbar")
  assert.deepEqual(unsupported.actions, [])
})
