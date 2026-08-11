import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  IntakeFallbackBoundary,
  ProductCaptureScreen,
  ProductDecisionScreen,
  ProductFrequencyPicker,
  ProductKindReviewScreen,
  SemanticRoleAssignment,
  Stage3Shell,
  Stage3SystemState,
  Stage3Transition,
  type Stage3ProductDecisionProjection,
} from "../src/components/personal-plan-products"
import { DiscreteSlider } from "../src/components/ui/slider"
import { authorityEvaluationProjection } from "../src/components/personal-plan-products/stage3-products-flow"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type PersonalPlanCategory,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products/contracts"
import { PRODUCT_FREQUENCIES, PRODUCT_FREQUENCY_LABELS } from "../src/lib/vocabulary/frequencies"

const forbiddenFlowLabels = /\b(?:Pass|Teil\s+\d|Stage|Stufe)\b/i

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  const element = node as ReactElement<{ children?: ReactNode }>
  return React.Children.toArray(element.props.children)
}

function findByType<P>(node: ReactNode, type: ReactElement<P>["type"]): ReactElement<P> | null {
  if (!React.isValidElement(node)) return null
  const element = node as ReactElement<P & { children?: ReactNode }>
  if (element.type === type) return element as ReactElement<P>
  for (const child of childrenOf(element)) {
    const match = findByType<P>(child, type)
    if (match) return match
  }
  return null
}

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
  assert.doesNotMatch(captureHtml, />(?:Pass|Teil\s+\d|Stage|Stufe)</i)
  assert.match(decisionHtml, /<h1[^>]*>Wie gut passen deine Produkte\?<\/h1>/)
  assert.match(decisionHtml, /Jetzt schauen wir uns die gefundenen Produkte an/)
  assert.doesNotMatch(decisionHtml, forbiddenFlowLabels)
})

test("stage 3 shell renders the supplied save state instead of a hard-coded saved label", () => {
  const renderShell = (status: "idle" | "saving" | "saved" | "error") =>
    renderToStaticMarkup(
      <Stage3Shell
        title="Produkte"
        currentStepLabel="Produkte finden"
        completedSteps={2}
        totalSteps={8}
        saveState={{ status, label: "Gespeichert" }}
      >
        <div>Inhalt</div>
      </Stage3Shell>,
    )

  assert.match(renderShell("saving"), /Wird gespeichert/)
  assert.match(renderShell("saved"), /Gespeichert/)
  assert.match(renderShell("error"), /Nicht gespeichert/)
  assert.doesNotMatch(renderShell("idle"), /Wird gespeichert|Gespeichert|Nicht gespeichert/)
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
  assert.match(html, /role="slider"/)
  assert.match(html, /aria-label="Nutzungshäufigkeit"/)
  assert.match(html, /aria-valuetext="2x\/Woche"/)
  assert.match(html, /Weiteres Shampoo hinzufügen/)
  assert.match(html, /Nicht dabei\? Produkt hinzufügen/)
  assert.match(html, /Kérastase Bain Satin/)
  assert.doesNotMatch(html, /Suchtreffer als eigenes Produkt gespeichert/)
  assert.doesNotMatch(html, /Ich habe dafür kein Produkt/)
})

test("saving product capture disables search-result selection and captured-product removal", () => {
  const html = renderToStaticMarkup(
    <ProductCaptureScreen
      categoryLabel="Shampoo"
      needSummary="Bedarf"
      query="kerastase"
      searchStatus="ready"
      searchResults={[
        {
          candidateId: "candidate-1",
          displayName: "Kérastase Bain Satin",
          brandName: "Kérastase",
          detail: "Shampoo",
        },
      ]}
      capturedProducts={[
        {
          capturedProductId: "owned-1",
          displayName: "Kérastase Bain Satin",
          frequencyLabel: "2x/Woche",
        },
      ]}
      frequencyOptions={[]}
      selectedFrequency={null}
      showFrequency={false}
      intakeAvailable
      onQueryChange={() => {}}
      onSelectCandidate={() => {}}
      onFrequencyChange={() => {}}
      onAddAnotherProduct={() => {}}
      onRemoveProduct={() => {}}
      onOpenFallbackIntake={() => {}}
      onContinue={() => {}}
      disabled
    />,
  )

  assert.match(html, /aria-label="Kérastase Bain Satin auswählen"[^>]*disabled/)
  assert.match(html, /aria-label="Kérastase Bain Satin aus Shampoo entfernen"[^>]*disabled/)
})

test("global product-kind review uses one-column German category choices", () => {
  const html = renderToStaticMarkup(
    <ProductKindReviewScreen
      options={[
        {
          value: "shampoo",
          label: "Shampoo",
          description: "Reinigung passend zu deiner Kopfhaut",
        },
        {
          value: "conditioner",
          label: "Conditioner",
          description: "Pflege nach jeder Wäsche",
        },
      ]}
      selected={["shampoo"]}
      onToggle={() => {}}
      onContinue={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /<h1[^>]*>Deine Produktarten<\/h1>/)
  assert.match(html, /Prüfe einmal global/)
  assert.match(html, /aria-label="Shampoo"/)
  assert.match(html, /checked/)
  assert.match(html, /Produktarten bestätigen/)
  assert.doesNotMatch(html, /grid-cols-2|Ich habe dafür kein Produkt/)
})

test("product frequency picker delegates the canonical 8-stop rare-to-daily slider", () => {
  const element = ProductFrequencyPicker({
    options: PRODUCT_FREQUENCIES.map((value) => ({
      value,
      label: PRODUCT_FREQUENCY_LABELS[value],
    })),
    selected: "weekly_2x",
    productName: "Test Shampoo",
    onChange: () => {},
  })
  const slider = findByType<React.ComponentProps<typeof DiscreteSlider>>(element, DiscreteSlider)

  assert.deepEqual(
    slider?.props.stops.map((stop) => stop.value),
    [...PRODUCT_FREQUENCIES],
  )
  assert.equal(slider?.props.value, "weekly_2x")
  assert.equal(slider?.props["aria-label"], "Nutzungshäufigkeit")
  assert.equal(slider?.props.disabled, false)

  const html = renderToStaticMarkup(element)
  assert.match(html, /aria-valuemin="0"/)
  assert.match(html, /aria-valuemax="7"/)
  assert.match(html, /aria-valuenow="4"/)
  assert.match(html, /aria-valuetext="2x\/Woche"/)
  assert.match(html, /Seltener als 1x\/Monat/)
  assert.match(html, /Täglich/)
})

test("product frequency slider disables pointer, label buttons, and focus when saving", () => {
  const html = renderToStaticMarkup(
    <ProductFrequencyPicker
      options={PRODUCT_FREQUENCIES.map((value) => ({
        value,
        label: PRODUCT_FREQUENCY_LABELS[value],
      }))}
      selected="weekly_2x"
      onChange={() => {}}
      disabled
    />,
  )

  assert.match(html, /role="slider"/)
  assert.match(html, /aria-disabled="true"/)
  assert.match(html, /tabIndex="-1"|tabindex="-1"/)
  assert.match(html, /disabled/)
})

test("every supported Personal Plan category renders an explicit German capture heading", () => {
  const labels = {
    shampoo: "Shampoo",
    conditioner: "Conditioner",
    leave_in: "Leave-in",
    heat_protectant: "Hitzeschutz",
    oil: "Öl",
    mask: "Maske",
    scalp_care: "Kopfhautprodukt",
    dry_shampoo: "Trockenshampoo",
    bondbuilder: "Bondbuilder",
    deep_cleansing_shampoo: "Tiefenreinigung",
  } satisfies Record<PersonalPlanCategory, string>
  const expectedHeadings = {
    shampoo: "Dein Shampoo",
    conditioner: "Dein Conditioner",
    leave_in: "Dein Leave-in",
    heat_protectant: "Dein Hitzeschutz",
    oil: "Dein Öl",
    mask: "Deine Maske",
    scalp_care: "Dein Kopfhautprodukt",
    dry_shampoo: "Dein Trockenshampoo",
    bondbuilder: "Dein Bondbuilder",
    deep_cleansing_shampoo: "Deine Tiefenreinigung",
  } satisfies Record<PersonalPlanCategory, string>

  assert.deepEqual(Object.keys(expectedHeadings), [...PERSONAL_PLAN_PRODUCT_CATEGORIES])
  for (const category of PERSONAL_PLAN_PRODUCT_CATEGORIES) {
    const html = renderToStaticMarkup(
      <ProductCaptureScreen
        categoryLabel={labels[category]}
        needSummary="Bedarf"
        query=""
        searchStatus="idle"
        searchResults={[]}
        capturedProducts={[]}
        frequencyOptions={[]}
        selectedFrequency={null}
        intakeAvailable={false}
        onQueryChange={() => {}}
        onSelectCandidate={() => {}}
        onFrequencyChange={() => {}}
        onAddAnotherProduct={() => {}}
        onOpenFallbackIntake={() => {}}
        onContinue={() => {}}
      />,
    )

    assert.match(html, new RegExp(`<h1[^>]*>${expectedHeadings[category]}</h1>`), category)
  }

  const unknownHtml = renderToStaticMarkup(
    <ProductCaptureScreen
      categoryLabel="Unbekannte Kategorie"
      needSummary="Bedarf"
      query=""
      searchStatus="idle"
      searchResults={[]}
      capturedProducts={[]}
      frequencyOptions={[]}
      selectedFrequency={null}
      intakeAvailable={false}
      onQueryChange={() => {}}
      onSelectCandidate={() => {}}
      onFrequencyChange={() => {}}
      onAddAnotherProduct={() => {}}
      onOpenFallbackIntake={() => {}}
      onContinue={() => {}}
    />,
  )
  assert.match(unknownHtml, /<h1[^>]*>Unbekannte Kategorie<\/h1>/)
})

test("semantic role assignment puts multiple oils and their exclusive uses on one checkbox screen", () => {
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
        "oil-2": [],
      }}
      onToggleRole={() => {}}
      onContinue={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /<h1[^>]*>Wofür nutzt du deine Öle\?<\/h1>/)
  assert.match(html, /Ordne jede Verwendung dem Öl zu, das sie tatsächlich übernimmt\./)
  assert.match(html, /aria-label="Olaplex No\. 7 Bonding Oil: Glanz und Finish"/)
  assert.match(html, /aria-label="Olaplex No\. 7 Bonding Oil: Laengen schuetzen"/)
  assert.match(html, /name="stage3-role-oil-1-finish"/)
  assert.match(html, /name="stage3-role-oil-1-schutz"/)
  assert.match(html, /Aktuell: Olaplex No\. 7 Bonding Oil/)
  assert.match(html, /Auswahl übernehmen/)
  assert.doesNotMatch(html, /role="alert"/)
  assert.doesNotMatch(html, /Primäres Öl|Hauptöl|global/)
})

test("single oil role assignment uses the concise approved question and helper", () => {
  const html = renderToStaticMarkup(
    <SemanticRoleAssignment
      categoryLabel="Öl"
      category="oil"
      products={[{ capturedProductId: "oil-1", displayName: "Arganöl" }]}
      roles={[{ role: "finish", label: "Im trockenen Haar" }]}
      assignments={{ "oil-1": ["finish"] }}
      onToggleRole={() => {}}
      onContinue={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /<h1[^>]*>Wofür nutzt du dein Öl\?<\/h1>/)
  assert.match(html, /Wähle alles aus, was auf dieses Produkt zutrifft\./)
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

test("consolidated product decisions show genuine Oil choices together", () => {
  const decisions: Stage3ProductDecisionProjection[] = [
    {
      kind: "mismatch",
      decisionKey: "oil-pre-wash",
      categoryLabel: "Öl",
      roleLabel: "Vor der Haarwäsche",
      needSummary: "Pflege vor der Haarwäsche",
      ownedProductName: "Arganöl",
      verdictLabel: "Andere Option empfohlen",
      rationale: "Ein anderes Produkt passt hier besser.",
      actions: [
        { kind: "plan_purchase", label: "Empfehlung einplanen" },
        { kind: "override", label: "Arganöl trotzdem verwenden" },
      ],
    },
    {
      kind: "pending",
      decisionKey: "oil-finish",
      categoryLabel: "Öl",
      roleLabel: "Im trockenen Haar",
      needSummary: "Glanz und Finish",
      ownedProductName: "Arganöl",
      verdictLabel: "Noch in Prüfung",
      rationale: "Die Produktdaten werden noch geprüft.",
      actions: [
        { kind: "pending", label: "Später prüfen" },
        { kind: "skip", label: "Nicht einplanen" },
      ],
    },
  ]

  const html = renderToStaticMarkup(
    <ProductDecisionScreen
      decisions={decisions}
      consolidated
      onChooseAction={() => {}}
      onBack={() => {}}
    />,
  )

  assert.match(html, /<h1[^>]*>Offene Punkte zu deinem Öl<\/h1>/)
  assert.match(html, /Vor der Haarwäsche/)
  assert.match(html, /Im trockenen Haar/)
  assert.match(html, /aria-label="Empfehlung einplanen: Öl — Vor der Haarwäsche"/)
  assert.match(html, /aria-label="Später prüfen: Öl — Im trockenen Haar"/)
  assert.equal((html.match(/data-stage3-decision-key=/g) ?? []).length, 4)
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
      productName="Curlsmith Conditioner"
      onProductNameChange={() => {}}
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
  assert.match(fallbackHtml, /Produktname/)
  assert.match(fallbackHtml, /Produkt speichern/)
  assert.match(fallbackHtml, /Erneut versuchen/)
  assert.match(fallbackHtml, /Zurück zur Suche/)
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
