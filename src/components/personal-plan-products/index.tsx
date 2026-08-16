"use client"

import { AlertCircle, ArrowLeft, Check, ImageIcon, Loader2, Plus, Search } from "lucide-react"
import { useState, type ReactNode } from "react"

import { PersonalPlanJourneyHeader } from "@/components/personal-plan-journey"
import { Button } from "@/components/ui/button"
import { FrequencySliderField } from "@/components/ui/frequency-slider-field"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { cn } from "@/lib/utils"

export { Stage3StickyAction } from "./stage3-sticky-action"

/**
 * Einzige Quelle fuer den Leertreffer-Hinweis der Produktsuche: Die Suche in
 * `index.tsx` rendert ihn, `stage3-products-flow.tsx` setzt ihn als
 * Status-Nachricht. Zwei Kopien waren zuvor typografisch auseinandergelaufen.
 */
export const STAGE3_PRODUCT_SEARCH_EMPTY_MESSAGE =
  "Wir haben dein Produkt nicht gefunden. Füge es über „Produkt hinzufügen“ einfach selbst hinzu."

export type Stage3TransitionContext = "product_capture" | "fit_check" | "routine_ready"

export type Stage3SaveState = {
  status: "local" | "saved" | "saving" | "error" | "conflict" | "idle"
  label: string
}

export type Stage3CatalogCandidate = {
  candidateId: string
  displayName: string
  brandName?: string
  detail?: string
  imageUrl?: string
  thumbnailImageUrl?: string
  assessmentStatus?: "ready" | "pending_analysis"
  assessmentReasonCodes?: Array<"missing_required_spec" | "missing_application_protocol">
}

export type Stage3CapturedProductSummary = {
  capturedProductId: string
  displayName: string
  frequencyLabel: string
  sourceLabel?: string
  statusLabel?: string
  imageUrl?: string
  thumbnailImageUrl?: string
}

export type Stage3FrequencyOption = {
  value: string
  label: string
}

export type Stage3ProductKindOption = {
  value: PersonalPlanCategory
  label: string
  description: string
}

export type Stage3RoleOption = {
  role: string
  label: string
  description?: string
}

export type Stage3RoleProduct = {
  capturedProductId: string
  displayName: string
  supportingText?: string
}

export function Stage3Shell({
  title,
  currentStepLabel,
  completedSteps,
  totalSteps,
  saveState,
  children,
  onBack,
  contentEntrance = false,
}: {
  title: string
  currentStepLabel: string
  completedSteps: number
  totalSteps: number
  saveState: Stage3SaveState
  children: ReactNode
  onBack?: () => void
  contentEntrance?: boolean
}) {
  const saveStatus = saveState.status === "conflict" ? "error" : saveState.status

  return (
    <div className="min-h-[100dvh] bg-[var(--background)]">
      <PersonalPlanJourneyHeader currentStage={3} saveStatus={saveStatus} onBack={onBack} />
      <main
        className={`personal-plan-cookie-clearance mx-auto min-w-0 w-full max-w-[720px] px-5 pt-7 md:my-8 md:rounded-3xl md:border md:border-border md:bg-card md:px-10 md:pt-10 md:shadow-sm${contentEntrance ? " personal-plan-stage-target-fade" : ""}`}
        data-stage3-progress={`${completedSteps}/${totalSteps}`}
        data-stage3-context={`${title}:${currentStepLabel}`}
      >
        {children}
      </main>
    </div>
  )
}

export function Stage3Transition({
  context,
  onContinue,
  onBack,
}: {
  context: Stage3TransitionContext
  onContinue: () => void
  onBack?: () => void
}) {
  const copy = transitionCopy[context]

  return (
    <section className="pt-8">
      {onBack ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Zurück"
          className="mb-3 rounded-full text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      ) : null}

      <div className="animate-fade-in-up">
        <p className="mb-3 text-sm font-semibold text-[var(--brand-plum)]">{copy.kicker}</p>
        <h1 className="mb-4 font-header text-3xl leading-tight text-foreground">{copy.title}</h1>
        <p className="mb-10 text-base leading-relaxed text-muted-foreground">{copy.body}</p>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        <Button type="button" variant="funnelCta" onClick={onContinue}>
          {copy.buttonLabel}
        </Button>
      </div>
    </section>
  )
}

const transitionCopy: Record<
  Stage3TransitionContext,
  { kicker: string; title: string; body: string; buttonLabel: string }
> = {
  product_capture: {
    kicker: "Produkte finden",
    title: "Welche Produkte nutzt du?",
    body: "Jetzt finden wir die Produkte, die du wirklich benutzt.",
    buttonLabel: "Produkte suchen",
  },
  fit_check: {
    kicker: "Produkte prüfen",
    title: "Wie gut passen deine Produkte?",
    body: "Jetzt schauen wir uns die gefundenen Produkte an und prüfen, wie gut sie zu deinem Haar passen.",
    buttonLabel: "Produkte prüfen",
  },
  routine_ready: {
    kicker: "Routine vorbereiten",
    title: "Deine Produktauswahl steht.",
    body: "Als Nächstes bauen wir daraus deine Routine und markieren offene Punkte direkt an der passenden Stelle.",
    buttonLabel: "Routine öffnen",
  },
}

export function ProductCaptureScreen({
  categoryLabel,
  needSummary,
  query,
  searchStatus,
  searchResults,
  searchTotalCapped = false,
  capturedProducts,
  frequencyOptions,
  selectedFrequency,
  selectedCandidateId,
  frequencyProductName,
  showFrequency = true,
  showAddAnotherProduct = true,
  canContinue = true,
  intakeAvailable,
  searchMessage,
  onQueryChange,
  onSelectCandidate,
  onFrequencyChange,
  onAddAnotherProduct,
  onRemoveProduct,
  onOpenFallbackIntake,
  onChooseOtherProduct,
  onChangeProductKinds,
  onContinue,
  onBack,
  onImageOutcome,
  disabled = false,
}: {
  categoryLabel: string
  needSummary: string
  query: string
  searchStatus: "idle" | "loading" | "ready" | "empty" | "error"
  searchResults: Stage3CatalogCandidate[]
  searchTotalCapped?: boolean
  capturedProducts: Stage3CapturedProductSummary[]
  frequencyOptions: Stage3FrequencyOption[]
  selectedFrequency: string | null
  selectedCandidateId?: string
  frequencyProductName?: string
  showFrequency?: boolean
  showAddAnotherProduct?: boolean
  canContinue?: boolean
  intakeAvailable: boolean
  searchMessage?: string
  onQueryChange: (value: string) => void
  onSelectCandidate: (candidateId: string) => void
  onFrequencyChange: (value: string) => void
  onAddAnotherProduct: () => void
  onRemoveProduct?: (capturedProductId: string) => void
  onOpenFallbackIntake: () => void
  onChooseOtherProduct?: () => void
  onChangeProductKinds?: () => void
  onContinue: () => void
  onBack?: () => void
  onImageOutcome?: (outcome: "thumbnail_fallback" | "thumbnail_total_failure") => void
  disabled?: boolean
}) {
  const selectedSearchCandidate = searchResults.find(
    (candidate) => candidate.candidateId === selectedCandidateId,
  )
  const analysisPending = selectedSearchCandidate?.assessmentStatus === "pending_analysis"

  return (
    <section>
      {onBack ? <BackButton onBack={onBack} /> : null}
      <div className="animate-fade-in-up mb-2">
        <h1 className="font-header text-3xl leading-tight text-foreground">
          {categoryHeading(categoryLabel)}
        </h1>
      </div>
      <p className="animate-fade-in-up mb-6 text-sm text-[var(--text-sub)]">{needSummary}</p>

      {onChangeProductKinds ? (
        <div className="mb-5 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onChangeProductKinds}
            disabled={disabled}
            className="h-auto px-0 py-1 text-sm font-semibold text-[var(--brand-plum)] hover:bg-transparent"
          >
            Produktarten ändern
          </Button>
        </div>
      ) : null}

      <label
        className="mb-2 block text-sm font-semibold text-foreground"
        htmlFor="stage3-product-search"
      >
        Produkt suchen
      </label>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="stage3-product-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          disabled={disabled}
          aria-label="Produkt suchen"
          aria-controls="stage3-search-results"
          aria-busy={searchStatus === "loading"}
          className="h-12 w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-base text-foreground placeholder:text-[var(--text-caption)] focus:border-[var(--brand-plum)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-plum)]/30"
          placeholder="Marke oder Produktname"
        />
      </div>

      <ProductSearchResults
        results={searchResults}
        status={searchStatus}
        message={searchMessage}
        onSelectCandidate={onSelectCandidate}
        selectedCandidateId={selectedCandidateId}
        onImageOutcome={onImageOutcome}
        disabled={disabled}
      />

      {searchStatus === "ready" && searchTotalCapped ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 rounded-xl border border-[var(--brand-plum)]/25 bg-[var(--brand-plum-ice)] p-3"
        >
          <p className="text-sm font-semibold text-[var(--brand-plum-dark)]">
            Weitere Treffer vorhanden
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-sub)]">
            Verfeinere deine Suche mit Marke oder Produktname.
          </p>
        </div>
      ) : null}

      {analysisPending ? (
        <div
          role="status"
          className="mb-5 rounded-2xl border border-[var(--status-pending-text)]/25 bg-[var(--status-pending-bg)] p-4"
        >
          <p className="text-sm font-semibold text-[var(--status-pending-text)]">Analyse läuft</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-sub)]">
            Die Produktangaben sind noch nicht vollständig geprüft. Es wird bis dahin nicht in deine
            aktive Routine eingeplant.
          </p>
          <div className="mt-4">
            <ProductFrequencyPicker
              options={frequencyOptions}
              selected={selectedFrequency}
              productName={frequencyProductName}
              onChange={onFrequencyChange}
              disabled={disabled}
            />
          </div>
          <div className="mt-4">
            {onChooseOtherProduct ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onChooseOtherProduct}
              >
                Anderes Produkt wählen
              </Button>
            ) : null}
          </div>
        </div>
      ) : showFrequency ? (
        <ProductFrequencyPicker
          options={frequencyOptions}
          selected={selectedFrequency}
          productName={frequencyProductName}
          onChange={onFrequencyChange}
          disabled={disabled}
        />
      ) : null}

      <ProductCapturedProductList
        categoryLabel={categoryLabel}
        products={capturedProducts}
        onRemoveProduct={onRemoveProduct}
        onImageOutcome={onImageOutcome}
        disabled={disabled}
      />

      <ProductMultiProductControls
        categoryLabel={categoryLabel}
        intakeAvailable={intakeAvailable}
        showAddAnotherProduct={showAddAnotherProduct}
        canContinue={canContinue}
        onAddAnotherProduct={onAddAnotherProduct}
        onOpenFallbackIntake={onOpenFallbackIntake}
        onContinue={onContinue}
        continueLabel={analysisPending ? "Auf Analyse warten" : "Weiter"}
        disabled={disabled}
      />
    </section>
  )
}

export function ProductKindReviewScreen({
  options,
  selected,
  disabled = false,
  status = "idle",
  onToggle,
  onContinue,
  onBack,
}: {
  options: Stage3ProductKindOption[]
  selected: PersonalPlanCategory[]
  disabled?: boolean
  status?: "idle" | "saving" | "error"
  onToggle: (category: PersonalPlanCategory, checked: boolean) => void
  onContinue: () => void
  onBack?: () => void
}) {
  const selectedSet = new Set(selected)

  return (
    <section>
      {onBack ? <BackButton onBack={onBack} disabled={disabled} /> : null}
      <div className="animate-fade-in-up mb-2">
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
          Produktarten
        </p>
        <h1 className="font-header text-3xl leading-tight text-foreground">Deine Produktarten</h1>
      </div>
      <p className="animate-fade-in-up mb-6 text-sm leading-6 text-[var(--text-sub)]">
        Prüfe einmal global, welche Produktarten du aktuell wirklich benutzt. Danach fragen wir nur
        für diese Kategorien nach konkreten Produkten.
      </p>

      <div className="grid gap-2">
        {options.map((option) => {
          const checked = selectedSet.has(option.value)
          return (
            <label
              key={option.value}
              className={cn(
                "grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border p-3 transition-colors",
                checked
                  ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                  : "border-border bg-card",
                disabled && "opacity-60",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onToggle(option.value, event.target.checked)}
                aria-label={option.label}
                className="mt-1 h-4 w-4 accent-[var(--brand-plum)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      {status === "error" ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-destructive/30 bg-card p-3 text-sm text-destructive"
        >
          Die Produktarten konnten gerade nicht gespeichert werden.
        </p>
      ) : null}

      <Button
        type="button"
        variant="unstyled"
        onClick={onContinue}
        disabled={disabled}
        className="personal-plan-primary-action mt-5 w-full"
      >
        {status === "saving" ? "Wird gespeichert" : "Produktarten bestätigen"}
      </Button>
    </section>
  )
}

export function ProductSearchResults({
  results,
  status,
  message,
  onSelectCandidate,
  selectedCandidateId,
  onImageOutcome,
  disabled = false,
}: {
  results: Stage3CatalogCandidate[]
  status: "idle" | "loading" | "ready" | "empty" | "error"
  message?: string
  onSelectCandidate: (candidateId: string) => void
  selectedCandidateId?: string
  onImageOutcome?: (outcome: "thumbnail_fallback" | "thumbnail_total_failure") => void
  disabled?: boolean
}) {
  if (status === "idle") {
    return <p className="mb-5 text-sm text-muted-foreground">Tippe mindestens zwei Zeichen ein.</p>
  }

  if (status === "loading") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mb-5 flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Produkte werden gesucht.
      </p>
    )
  }

  if (status === "empty" || status === "error") {
    return (
      <p
        role={status === "error" ? "alert" : "status"}
        aria-live="polite"
        className="mb-5 rounded-xl border border-border bg-muted p-3 text-sm text-[var(--text-sub)]"
      >
        {message ?? STAGE3_PRODUCT_SEARCH_EMPTY_MESSAGE}
      </p>
    )
  }

  return (
    <div
      id="stage3-search-results"
      role="listbox"
      aria-label="Suchergebnisse"
      className="mb-5 space-y-2"
    >
      {results.map((result) => {
        const selected = result.candidateId === selectedCandidateId
        const pending = result.assessmentStatus === "pending_analysis"
        const identity = completeProductIdentity(result)
        return (
          <button
            key={result.candidateId}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={pending ? `${identity}: Analyse ausstehend` : `${identity} auswählen`}
            onClick={() => onSelectCandidate(result.candidateId)}
            disabled={disabled}
            className={cn(
              "grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
              selected
                ? "border-[var(--brand-plum)] ring-1 ring-[var(--brand-plum)]/20"
                : "border-border hover:border-[var(--brand-plum)]/40",
            )}
          >
            <ProductImage
              thumbnailImageUrl={result.thumbnailImageUrl}
              imageUrl={result.imageUrl}
              label={identity}
              onOutcome={onImageOutcome}
            />
            <span className="min-w-0">
              <strong className="block break-words text-sm text-foreground">
                {result.displayName}
              </strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                {[result.brandName, result.detail].filter(Boolean).join(" · ")}
              </span>
            </span>
            {selected || pending ? (
              <span className="flex items-center gap-1 rounded-full bg-[var(--brand-plum-ice)] px-2 py-1 text-[11px] font-semibold text-[var(--brand-plum-dark)]">
                {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {selected ? "Ausgewählt" : "Analyse ausstehend"}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function completeProductIdentity(result: Stage3CatalogCandidate) {
  const title = result.displayName.trim()
  const brand = result.brandName?.trim()
  if (!brand || title.toLocaleLowerCase().startsWith(brand.toLocaleLowerCase())) return title
  return `${brand} ${title}`
}

export function ProductFrequencyPicker({
  options,
  selected,
  productName,
  onChange,
  disabled = false,
}: {
  options: Stage3FrequencyOption[]
  selected: string | null
  productName?: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const stops = options.map((option) => ({
    value: option.value,
    label: option.label,
  }))

  return (
    <FrequencySliderField
      stops={stops}
      value={selected ?? undefined}
      onValueChange={onChange}
      disabled={disabled}
      ariaLabel="Nutzungshäufigkeit"
      selectedPlaceholder="Bitte auswählen"
      legend={productName ? `Wie oft nutzt du ${productName}?` : "Wie oft nutzt du dieses Produkt?"}
    />
  )
}

export function ProductCapturedProductList({
  categoryLabel,
  products,
  onRemoveProduct,
  onImageOutcome,
  disabled = false,
}: {
  categoryLabel: string
  products: Stage3CapturedProductSummary[]
  onRemoveProduct?: (capturedProductId: string) => void
  onImageOutcome?: (outcome: "thumbnail_fallback" | "thumbnail_total_failure") => void
  disabled?: boolean
}) {
  if (products.length === 0) return null

  return (
    <section aria-labelledby="stage3-captured-products-title" className="mb-4">
      <h2
        id="stage3-captured-products-title"
        className="mb-2 text-sm font-semibold text-foreground"
      >
        Ausgewählte Produkte
      </h2>
      <div className="space-y-2">
        {products.map((product) => (
          <article
            key={product.capturedProductId}
            className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <ProductImage
              thumbnailImageUrl={product.thumbnailImageUrl}
              imageUrl={product.imageUrl}
              label={product.displayName}
              onOutcome={onImageOutcome}
            />
            <div className="min-w-0">
              <h3 className="break-words text-sm font-semibold text-foreground">
                {product.displayName}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {product.frequencyLabel}
                {product.sourceLabel ? ` · ${product.sourceLabel}` : ""}
              </p>
              {product.statusLabel ? (
                <p
                  role="status"
                  className="mt-1 text-xs font-semibold text-[var(--status-pending-text)]"
                >
                  {product.statusLabel}
                </p>
              ) : null}
            </div>
            {onRemoveProduct ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveProduct(product.capturedProductId)}
                aria-label={`${product.displayName} aus ${categoryLabel} entfernen`}
                disabled={disabled}
              >
                Entfernen
              </Button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

export function ProductMultiProductControls({
  categoryLabel,
  intakeAvailable,
  showAddAnotherProduct = true,
  canContinue = true,
  onAddAnotherProduct,
  onOpenFallbackIntake,
  onContinue,
  continueLabel = "Weiter",
  disabled = false,
}: {
  categoryLabel: string
  intakeAvailable: boolean
  showAddAnotherProduct?: boolean
  canContinue?: boolean
  onAddAnotherProduct: () => void
  onOpenFallbackIntake: () => void
  onContinue: () => void
  continueLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="mt-5 grid gap-2">
      {showAddAnotherProduct ? (
        <Button type="button" variant="outline" onClick={onAddAnotherProduct} disabled={disabled}>
          <Plus className="h-4 w-4" />
          Weiteres {categoryLabel} hinzufügen
        </Button>
      ) : null}
      {intakeAvailable ? (
        <Button type="button" variant="ghost" onClick={onOpenFallbackIntake} disabled={disabled}>
          Nicht dabei? Produkt hinzufügen
        </Button>
      ) : null}
      <Button
        type="button"
        variant="funnelCta"
        onClick={onContinue}
        disabled={disabled || !canContinue}
      >
        {continueLabel}
      </Button>
    </div>
  )
}

export function SemanticRoleAssignment({
  categoryLabel,
  category,
  products,
  roles,
  assignments,
  onToggleRole,
  onContinue,
  onBack,
  disabled = false,
}: {
  categoryLabel: string
  category: string
  products: Stage3RoleProduct[]
  roles: Stage3RoleOption[]
  assignments: Record<string, string[]>
  onToggleRole: (capturedProductId: string, role: string, checked: boolean) => void
  onContinue: () => void
  onBack: () => void
  disabled?: boolean
}) {
  const isOil = category === "oil"
  const multipleOils = isOil && products.length > 1
  const heading = isOil
    ? multipleOils
      ? "Wofür nutzt du deine Öle?"
      : "Wofür nutzt du dein Öl?"
    : `Welche Aufgabe hat dein ${categoryLabel}?`
  const roleCopy = isOil
    ? multipleOils
      ? "Ordne jede Verwendung dem Öl zu, das sie tatsächlich übernimmt."
      : "Wähle alles aus, was auf dieses Produkt zutrifft."
    : "Ordne jedes Produkt nur den Aufgaben zu, die es wirklich übernimmt. Ein Produkt darf mehrere Aufgaben abdecken."

  return (
    <section>
      <BackButton onBack={onBack} disabled={disabled} />
      <div className="animate-fade-in-up mb-2">
        <h1 className="font-header text-3xl leading-tight text-foreground">{heading}</h1>
      </div>
      <p className="animate-fade-in-up mb-6 text-sm text-[var(--text-sub)]">{roleCopy}</p>
      {!isOil ? (
        <p className="animate-fade-in-up mb-6 text-sm font-semibold text-[var(--text-sub)]">
          Nicht ausgewählte Aufgaben bleiben als offene Lücke im Plan erhalten.
        </p>
      ) : null}

      <div className="space-y-3">
        {products.map((product) => (
          <article
            key={product.capturedProductId}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h2 className="text-base font-semibold text-foreground">{product.displayName}</h2>
            {product.supportingText ? (
              <p className="mt-1 text-sm text-muted-foreground">{product.supportingText}</p>
            ) : null}
            <div className="mt-4 grid gap-2">
              {roles.map((role) => {
                const checked = assignments[product.capturedProductId]?.includes(role.role) ?? false
                const assignedProduct = checked
                  ? undefined
                  : products.find((candidate) =>
                      assignments[candidate.capturedProductId]?.includes(role.role),
                    )
                const inputName = `stage3-role-${product.capturedProductId}-${role.role}`

                return (
                  <label
                    key={role.role}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border border-border bg-muted/55 p-3"
                  >
                    <input
                      type="checkbox"
                      name={inputName}
                      checked={checked}
                      disabled={disabled}
                      onChange={(event) =>
                        onToggleRole(product.capturedProductId, role.role, event.target.checked)
                      }
                      aria-label={`${product.displayName}: ${role.label}`}
                      className="mt-1 h-4 w-4 accent-[var(--brand-plum)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {role.label}
                      </span>
                      {role.description ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {role.description}
                        </span>
                      ) : null}
                      {isOil && assignedProduct ? (
                        <span className="mt-1 block text-xs font-semibold text-[var(--brand-plum)]">
                          Aktuell: {assignedProduct.displayName}
                        </span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5">
        <Button type="button" variant="funnelCta" onClick={onContinue} disabled={disabled}>
          Auswahl übernehmen
        </Button>
      </div>
    </section>
  )
}

export function Stage3SystemState({
  state,
  title,
  message,
  actionLabel,
  onAction,
}: {
  state: "loading" | "empty" | "error" | "conflict" | "saved"
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  const isLoading = state === "loading"
  const role = state === "error" || state === "conflict" ? "alert" : "status"

  return (
    <section
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      aria-busy={isLoading}
      className="mx-auto max-w-md pt-12 text-center"
    >
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : state === "saved" ? (
          <Check className="h-5 w-5" />
        ) : (
          <AlertCircle className="h-5 w-5" />
        )}
      </div>
      <h1 className="font-header text-3xl leading-tight text-foreground">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-sub)]">{message}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="funnelCta" onClick={onAction} className="mt-7">
          {actionLabel}
        </Button>
      ) : null}
    </section>
  )
}

export function IntakeFallbackBoundary({
  categoryLabel,
  status,
  message,
  frequencyOptions,
  selectedFrequency,
  productName = "",
  onProductNameChange = () => {},
  onFrequencyChange,
  onOpen,
  onRetry,
  onCancel,
}: {
  categoryLabel: string
  status: "idle" | "pending" | "error"
  message?: string
  frequencyOptions: Stage3FrequencyOption[]
  selectedFrequency: string | null
  productName?: string
  onProductNameChange?: (value: string) => void
  onFrequencyChange: (value: string) => void
  onOpen: () => void
  onRetry?: () => void
  onCancel: () => void
}) {
  const role = status === "error" ? "alert" : "status"

  return (
    <section
      role={role}
      aria-live={status === "error" ? "assertive" : "polite"}
      aria-busy={status === "pending"}
      className="rounded-xl border border-border bg-card p-4"
    >
      <h1 className="font-header text-2xl leading-tight text-foreground">
        {categoryLabel} nicht gefunden?
      </h1>
      <p className="mt-2 text-sm text-[var(--text-sub)]">
        Gib Marke und Produktname ein, damit du es später wiedererkennst. Ein Foto ist nicht nötig.
      </p>
      <label
        className="mt-4 block text-sm font-semibold text-foreground"
        htmlFor="stage3-manual-product-name"
      >
        Produktname
      </label>
      <input
        id="stage3-manual-product-name"
        value={productName}
        onChange={(event) => onProductNameChange(event.target.value)}
        placeholder="Marke und Produktname"
        className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-base text-foreground focus:border-[var(--brand-plum)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-plum)]/30"
      />
      <div className="mt-4">
        <ProductFrequencyPicker
          options={frequencyOptions}
          selected={selectedFrequency}
          productName={categoryLabel}
          onChange={onFrequencyChange}
        />
      </div>
      {message ? (
        <p
          className={cn(
            "mt-3 rounded-xl p-3 text-sm font-semibold",
            status === "error"
              ? "bg-red-50 text-destructive"
              : "bg-[var(--brand-plum-ice)] text-[var(--brand-plum-dark)]",
          )}
        >
          {message}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2">
        <Button
          type="button"
          variant="funnelCta"
          onClick={onOpen}
          disabled={
            status === "pending" || selectedFrequency === null || productName.trim().length < 2
          }
        >
          Produkt speichern
        </Button>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            disabled={status === "pending" || selectedFrequency === null}
          >
            Erneut versuchen
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onCancel}>
          Zurück zur Suche
        </Button>
      </div>
    </section>
  )
}

function ProductImage({
  thumbnailImageUrl,
  imageUrl,
  label,
  onOutcome,
}: {
  thumbnailImageUrl?: string
  imageUrl?: string
  label: string
  onOutcome?: (outcome: "thumbnail_fallback" | "thumbnail_total_failure") => void
}) {
  return (
    <ProductImageAttempt
      key={`${thumbnailImageUrl ?? ""}\u0000${imageUrl ?? ""}`}
      thumbnailImageUrl={thumbnailImageUrl}
      imageUrl={imageUrl}
      label={label}
      onOutcome={onOutcome}
    />
  )
}

function ProductImageAttempt({
  thumbnailImageUrl,
  imageUrl,
  label,
  onOutcome,
}: {
  thumbnailImageUrl?: string
  imageUrl?: string
  label: string
  onOutcome?: (outcome: "thumbnail_fallback" | "thumbnail_total_failure") => void
}) {
  const preferred = thumbnailImageUrl ?? imageUrl
  const [source, setSource] = useState(preferred)

  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
      {source ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt=""
          width={48}
          height={48}
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => {
            const transition = productImageErrorTransition({
              source,
              thumbnailImageUrl,
              imageUrl,
            })
            if (transition.outcome) onOutcome?.(transition.outcome)
            setSource(transition.source)
          }}
        />
      ) : (
        <ImageIcon className="h-5 w-5" aria-label={`Kein Produktbild für ${label}`} />
      )}
    </div>
  )
}

export function productImageErrorTransition({
  source,
  thumbnailImageUrl,
  imageUrl,
}: {
  source?: string
  thumbnailImageUrl?: string
  imageUrl?: string
}): {
  source: string | undefined
  outcome: "thumbnail_fallback" | "thumbnail_total_failure" | null
} {
  if (source === thumbnailImageUrl && imageUrl && imageUrl !== thumbnailImageUrl) {
    return { source: imageUrl, outcome: "thumbnail_fallback" }
  }
  return {
    source: undefined,
    outcome: thumbnailImageUrl ? "thumbnail_total_failure" : null,
  }
}

const PERSONAL_PLAN_CATEGORY_HEADING_COPY = {
  shampoo: { label: "Shampoo", heading: "Dein Shampoo" },
  conditioner: { label: "Conditioner", heading: "Dein Conditioner" },
  leave_in: { label: "Leave-in", heading: "Dein Leave-in" },
  heat_protectant: { label: "Hitzeschutz", heading: "Dein Hitzeschutz" },
  oil: { label: "Öl", heading: "Dein Öl" },
  mask: { label: "Maske", heading: "Deine Maske" },
  scalp_care: { label: "Kopfhautprodukt", heading: "Dein Kopfhautprodukt" },
  dry_shampoo: { label: "Trockenshampoo", heading: "Dein Trockenshampoo" },
  bondbuilder: { label: "Bondbuilder", heading: "Dein Bondbuilder" },
  deep_cleansing_shampoo: {
    label: "Tiefenreinigung",
    heading: "Deine Tiefenreinigung",
  },
} as const satisfies Record<PersonalPlanCategory, { label: string; heading: string }>

const CATEGORY_HEADING_BY_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(PERSONAL_PLAN_CATEGORY_HEADING_COPY).map(({ label, heading }) => [label, heading]),
)

function categoryHeading(categoryLabel: string) {
  return CATEGORY_HEADING_BY_LABEL[categoryLabel] ?? categoryLabel
}

function BackButton({ onBack, disabled = false }: { onBack: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onBack}
      disabled={disabled}
      aria-label="Zurück"
      className="mb-2 rounded-full text-muted-foreground"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  )
}
