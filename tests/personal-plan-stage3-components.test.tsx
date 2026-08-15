import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  IntakeFallbackBoundary,
  ProductCaptureScreen,
  ProductFrequencyPicker,
  ProductKindReviewScreen,
  ProductSearchResults,
  productImageErrorTransition,
  SemanticRoleAssignment,
  Stage3Shell,
  Stage3SystemState,
  Stage3Transition,
} from "../src/components/personal-plan-products"
import { FrequencySliderField } from "../src/components/ui/frequency-slider-field"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type PersonalPlanCategory,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products/contracts"
import { PRODUCT_FREQUENCIES, PRODUCT_FREQUENCY_LABELS } from "../src/lib/vocabulary/frequencies"

const forbiddenFlowLabels = /\b(?:Pass|Teil\s+\d|Stage|Stufe)\b/i

test("product image failures fall back once, then hide without leaking identity", () => {
  assert.deepEqual(
    productImageErrorTransition({
      source: "thumbnail.webp",
      thumbnailImageUrl: "thumbnail.webp",
      imageUrl: "canonical.webp",
    }),
    { source: "canonical.webp", outcome: "thumbnail_fallback" },
  )
  assert.deepEqual(
    productImageErrorTransition({
      source: "canonical.webp",
      thumbnailImageUrl: "thumbnail.webp",
      imageUrl: "canonical.webp",
    }),
    { source: undefined, outcome: "thumbnail_total_failure" },
  )
  assert.deepEqual(
    productImageErrorTransition({
      source: "canonical.webp",
      imageUrl: "canonical.webp",
    }),
    { source: undefined, outcome: null },
  )
})

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
  assert.match(captureHtml, /rounded-full bg-\[var\(--brand-coral\)\]/)
  assert.match(captureHtml, /font-header/)
  assert.doesNotMatch(captureHtml, />(?:Pass|Teil\s+\d|Stage|Stufe)</i)
  assert.match(decisionHtml, /<h1[^>]*>Wie gut passen deine Produkte\?<\/h1>/)
  assert.match(decisionHtml, /Jetzt schauen wir uns die gefundenen Produkte an/)
  assert.doesNotMatch(decisionHtml, forbiddenFlowLabels)
})

test("stage 3 shell renders the supplied save state instead of a hard-coded saved label", () => {
  const renderShell = (status: "idle" | "saving" | "saved" | "error", label: string) =>
    renderToStaticMarkup(
      <Stage3Shell
        title="Produkte"
        currentStepLabel="Produkte finden"
        completedSteps={2}
        totalSteps={8}
        saveState={{ status, label }}
      >
        <div>Inhalt</div>
      </Stage3Shell>,
    )

  assert.match(renderShell("saving", "Wird gespeichert"), /Wird gespeichert/)
  assert.match(renderShell("saved", "Gespeichert"), /Gespeichert/)
  assert.match(renderShell("error", "Nicht gespeichert"), /Nicht gespeichert/)
  // A recovery label stays truthful instead of falling back to the status copy.
  assert.match(renderShell("error", "Speicherstatus offen"), /Speicherstatus offen/)
  assert.doesNotMatch(renderShell("error", "Speicherstatus offen"), /Nicht gespeichert/)
  assert.doesNotMatch(renderShell("idle", ""), /Wird gespeichert|Gespeichert|Nicht gespeichert/)
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
      selectedCandidateId="candidate-1"
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
  assert.match(html, /aria-selected="true"/)
  assert.match(html, /Ausgewählt/)
  assert.match(html, /role="slider"/)
  assert.match(html, /aria-label="Nutzungshäufigkeit"/)
  assert.match(html, /aria-valuetext="2x\/Woche"/)
  assert.match(html, /Weiteres Shampoo hinzufügen/)
  assert.match(html, /Nicht dabei\? Produkt hinzufügen/)
  assert.match(html, /Kérastase Bain Satin/)
  assert.doesNotMatch(html, /Suchtreffer als eigenes Produkt gespeichert/)
  assert.doesNotMatch(html, /Ich habe dafür kein Produkt/)
})

test("search results expose one complete identity and distinguish temporary analysis from selection", () => {
  const html = renderToStaticMarkup(
    <ProductSearchResults
      results={[
        {
          candidateId: "ogx-ready",
          displayName: "Renewing + Argan Oil of Morocco Shampoo",
          brandName: "OGX",
          imageUrl: "https://example.test/canonical.webp",
          thumbnailImageUrl: "https://example.test/thumbnail.webp",
          assessmentStatus: "ready",
        },
        {
          candidateId: "ogx-pending",
          displayName: "Biotin & Collagen Shampoo",
          brandName: "OGX",
          assessmentStatus: "pending_analysis",
        },
        {
          candidateId: "ogx-selected",
          displayName: "Rosemary Mint Shampoo",
          brandName: "OGX",
          assessmentStatus: "ready",
        },
      ]}
      selectedCandidateId="ogx-selected"
      status="ready"
      onSelectCandidate={() => {}}
    />,
  )

  assert.match(html, /aria-label="OGX Renewing \+ Argan Oil of Morocco Shampoo auswählen"/)
  assert.match(html, /aria-label="OGX Biotin &amp; Collagen Shampoo: Analyse ausstehend"/)
  assert.match(html, /aria-label="OGX Rosemary Mint Shampoo auswählen"/)
  assert.equal((html.match(/>OGX</g) ?? []).length, 3)
  assert.match(html, /Analyse ausstehend/)
  assert.match(html, /Ausgewählt/)
  assert.doesNotMatch(html, /Wahrscheinlich dein Produkt|Eindeutiger Treffer/)
  assert.match(html, /aria-selected="true"/)
  assert.match(
    html,
    /src="https:\/\/example\.test\/thumbnail\.webp"[^>]*width="48"[^>]*height="48"[^>]*decoding="async"/,
  )
  assert.doesNotMatch(html, /src="https:\/\/example\.test\/canonical\.webp"/)
})

test("capped ready search results disclose that a more specific query can reveal more products", () => {
  const results = [
    {
      candidateId: "ogx-oil",
      displayName: "Argan Oil of Morocco Penetrating Oil",
      brandName: "OGX",
      assessmentStatus: "ready" as const,
    },
  ]

  const cappedHtml = renderToStaticMarkup(
    <ProductCaptureScreen
      categoryLabel="Öl"
      needSummary="Pflege für Längen und Spitzen"
      query="ogx"
      searchStatus="ready"
      searchResults={results}
      searchTotalCapped
      capturedProducts={[]}
      frequencyOptions={[]}
      selectedFrequency={null}
      showFrequency={false}
      showAddAnotherProduct={false}
      canContinue={false}
      intakeAvailable
      onQueryChange={() => {}}
      onSelectCandidate={() => {}}
      onFrequencyChange={() => {}}
      onAddAnotherProduct={() => {}}
      onOpenFallbackIntake={() => {}}
      onContinue={() => {}}
    />,
  )
  const uncappedHtml = renderToStaticMarkup(
    <ProductCaptureScreen
      categoryLabel="Öl"
      needSummary="Pflege für Längen und Spitzen"
      query="ogx"
      searchStatus="ready"
      searchResults={results}
      searchTotalCapped={false}
      capturedProducts={[]}
      frequencyOptions={[]}
      selectedFrequency={null}
      showFrequency={false}
      showAddAnotherProduct={false}
      canContinue={false}
      intakeAvailable
      onQueryChange={() => {}}
      onSelectCandidate={() => {}}
      onFrequencyChange={() => {}}
      onAddAnotherProduct={() => {}}
      onOpenFallbackIntake={() => {}}
      onContinue={() => {}}
    />,
  )

  assert.match(cappedHtml, /Weitere Treffer vorhanden/)
  assert.match(cappedHtml, /Verfeinere deine Suche mit Marke oder Produktname\./)
  assert.match(cappedHtml, /role="status"/)
  assert.match(cappedHtml, /aria-live="polite"/)
  assert.equal((cappedHtml.match(/role="listbox"/g) ?? []).length, 1)
  assert.doesNotMatch(uncappedHtml, /Weitere Treffer vorhanden/)
})

test("pending analysis keeps cadence editable and names the temporary action", () => {
  const html = renderToStaticMarkup(
    <ProductCaptureScreen
      categoryLabel="Shampoo"
      needSummary="Sanfte Reinigung"
      query="ogx"
      searchStatus="ready"
      searchResults={[
        {
          candidateId: "ogx-pending",
          displayName: "Renewing + Argan Oil of Morocco Shampoo",
          brandName: "OGX",
          assessmentStatus: "pending_analysis",
        },
      ]}
      capturedProducts={[]}
      frequencyOptions={[
        { value: "weekly_1x", label: "1x/Woche" },
        { value: "weekly_2x", label: "2x/Woche" },
      ]}
      selectedFrequency="weekly_2x"
      selectedCandidateId="ogx-pending"
      frequencyProductName="Renewing + Argan Oil of Morocco Shampoo"
      intakeAvailable
      canContinue
      onQueryChange={() => {}}
      onSelectCandidate={() => {}}
      onFrequencyChange={() => {}}
      onAddAnotherProduct={() => {}}
      onOpenFallbackIntake={() => {}}
      onChooseOtherProduct={() => {}}
      onContinue={() => {}}
    />,
  )

  assert.match(html, /Analyse läuft/)
  assert.match(html, /role="slider"/)
  assert.match(html, /aria-valuetext="2x\/Woche"/)
  assert.match(html, />Auf Analyse warten</)
  assert.match(html, />Anderes Produkt wählen</)
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
  const slider = findByType<React.ComponentProps<typeof FrequencySliderField>>(
    element,
    FrequencySliderField,
  )

  assert.deepEqual(
    slider?.props.stops.map((stop) => stop.value),
    [...PRODUCT_FREQUENCIES],
  )
  assert.equal(slider?.props.value, "weekly_2x")
  assert.equal(slider?.props.ariaLabel, "Nutzungshäufigkeit")
  assert.equal(slider?.props.disabled, false)

  const html = renderToStaticMarkup(element)
  assert.match(html, /aria-valuemin="0"/)
  assert.match(html, /aria-valuemax="7"/)
  assert.match(html, /aria-valuenow="4"/)
  assert.match(html, /aria-valuetext="2x\/Woche"/)
  assert.match(html, /aria-label="&lt;1×\/Monat"/)
  assert.match(html, /aria-label="2×\/Woche"/)
  assert.match(html, /aria-label="1×\/Tag"/)
  assert.match(html, /data-slider-label-line="1"[^>]*>2×\/<\/span>/)
  assert.match(html, /data-slider-label-line="2"[^>]*>Woche<\/span>/)
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
