"use client"

import { AlertCircle, ArrowLeft, Check, Clock, Loader2, Plus, Search } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "positive" | "warning" | "negative"

export type Stage3TransitionContext = "product_capture" | "fit_check" | "routine_ready"

export type Stage3SaveState = {
  status: "saved" | "saving" | "error" | "conflict" | "idle"
  label: string
}

export type Stage3CatalogCandidate = {
  candidateId: string
  displayName: string
  brandName?: string
  detail?: string
  confidenceLabel?: string
}

export type Stage3CapturedProductSummary = {
  capturedProductId: string
  displayName: string
  frequencyLabel: string
  sourceLabel?: string
  statusLabel?: string
}

export type Stage3FrequencyOption = {
  value: string
  label: string
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

export type Stage3DecisionCriterion = {
  label: string
  result: string
  tone: Exclude<Tone, "neutral">
  explanation?: string
}

export type Stage3DecisionAction = {
  kind: "keep" | "override" | "plan_purchase" | "pending" | "skip" | "choose_other"
  label: string
  productName?: string
}

export type Stage3RecommendationSummary = {
  productName: string
  priceLabel?: string
  availabilityLabel?: string
  sellerLabel?: string
}

export type Stage3ProductDecisionProjection = {
  kind: "fit" | "mismatch" | "pending" | "gap"
  decisionKey: string
  categoryLabel: string
  needSummary: string
  verdictLabel: string
  rationale: string
  ownedProductName?: string
  criteria?: Stage3DecisionCriterion[]
  recommendation?: Stage3RecommendationSummary
  actions: Stage3DecisionAction[]
}

export function Stage3Shell({
  title,
  currentStepLabel,
  completedSteps,
  totalSteps,
  saveState,
  children,
  onBack,
}: {
  title: string
  currentStepLabel: string
  completedSteps: number
  totalSteps: number
  saveState: Stage3SaveState
  children: ReactNode
  onBack?: () => void
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[540px] flex-col px-5 py-7 md:px-10 md:py-10">
      <header className="mb-7 space-y-4">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Zurück"
            className={cn("rounded-full text-muted-foreground", !onBack && "invisible")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="min-w-0 text-center">
            <p className="truncate text-xs font-semibold text-foreground">{title}</p>
            <p className="truncate text-[11px] text-[var(--text-caption)]">{currentStepLabel}</p>
          </div>

          <p
            aria-live="polite"
            className={cn(
              "min-w-[5.75rem] text-right text-[11px] font-semibold",
              saveState.status === "saved" && "text-emerald-700",
              saveState.status === "saving" && "text-[var(--brand-plum)]",
              saveState.status === "idle" && "text-[var(--text-caption)]",
              (saveState.status === "error" || saveState.status === "conflict") &&
                "text-destructive",
            )}
          >
            {saveState.label}
          </p>
        </div>

        <Progress
          value={completedSteps}
          max={totalSteps}
          aria-label="Fortschritt Produkte"
          className="h-[6px] bg-border"
        />
      </header>

      <main className="min-w-0 flex-1">{children}</main>
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
        <Button
          type="button"
          variant="unstyled"
          onClick={onContinue}
          className="quiz-btn-primary w-full"
        >
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
  capturedProducts,
  frequencyOptions,
  selectedFrequency,
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
  onExplicitNone,
  onContinue,
  onBack,
}: {
  categoryLabel: string
  needSummary: string
  query: string
  searchStatus: "idle" | "loading" | "ready" | "empty" | "error"
  searchResults: Stage3CatalogCandidate[]
  capturedProducts: Stage3CapturedProductSummary[]
  frequencyOptions: Stage3FrequencyOption[]
  selectedFrequency: string | null
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
  onExplicitNone?: () => void
  onContinue: () => void
  onBack?: () => void
}) {
  return (
    <section>
      {onBack ? <BackButton onBack={onBack} /> : null}
      <div className="animate-fade-in-up mb-2">
        <h1 className="font-header text-3xl leading-tight text-foreground">Dein {categoryLabel}</h1>
      </div>
      <p className="animate-fade-in-up mb-6 text-sm text-[var(--text-sub)]">{needSummary}</p>

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
      />

      {showFrequency ? (
        <ProductFrequencyPicker
          options={frequencyOptions}
          selected={selectedFrequency}
          productName={frequencyProductName}
          onChange={onFrequencyChange}
        />
      ) : null}

      <ProductCapturedProductList
        categoryLabel={categoryLabel}
        products={capturedProducts}
        onRemoveProduct={onRemoveProduct}
      />

      <ProductMultiProductControls
        categoryLabel={categoryLabel}
        intakeAvailable={intakeAvailable}
        showAddAnotherProduct={showAddAnotherProduct}
        canContinue={canContinue}
        onAddAnotherProduct={onAddAnotherProduct}
        onOpenFallbackIntake={onOpenFallbackIntake}
        onExplicitNone={onExplicitNone}
        onContinue={onContinue}
      />
    </section>
  )
}

export function ProductSearchResults({
  results,
  status,
  message,
  onSelectCandidate,
}: {
  results: Stage3CatalogCandidate[]
  status: "idle" | "loading" | "ready" | "empty" | "error"
  message?: string
  onSelectCandidate: (candidateId: string) => void
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
        {message ?? "Kein sicherer Treffer gefunden."}
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
      {results.map((result) => (
        <button
          key={result.candidateId}
          type="button"
          role="option"
          aria-selected="false"
          aria-label={`${result.displayName} auswählen`}
          onClick={() => onSelectCandidate(result.candidateId)}
          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-[var(--brand-plum)]/40"
        >
          <span className="min-w-0">
            <strong className="block break-words text-sm text-foreground">
              {result.displayName}
            </strong>
            <span className="mt-1 block text-xs text-muted-foreground">
              {[result.brandName, result.detail].filter(Boolean).join(" · ")}
            </span>
          </span>
          {result.confidenceLabel ? (
            <span className="rounded-full bg-[var(--brand-plum-ice)] px-2 py-1 text-[11px] font-semibold text-[var(--brand-plum-dark)]">
              {result.confidenceLabel}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function ProductFrequencyPicker({
  options,
  selected,
  productName,
  onChange,
}: {
  options: Stage3FrequencyOption[]
  selected: string | null
  productName?: string
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-sm font-semibold text-foreground">
        {productName ? `Wie oft nutzt du ${productName}?` : "Wie oft nutzt du dieses Produkt?"}
      </legend>
      <div aria-label="Nutzungshäufigkeit" className="grid grid-cols-2 gap-2" role="group">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
              selected === option.value
                ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] text-[var(--brand-plum-dark)]"
                : "border-border bg-card text-[var(--text-sub)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function ProductCapturedProductList({
  categoryLabel,
  products,
  onRemoveProduct,
}: {
  categoryLabel: string
  products: Stage3CapturedProductSummary[]
  onRemoveProduct?: (capturedProductId: string) => void
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
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="min-w-0">
              <h3 className="break-words text-sm font-semibold text-foreground">
                {product.displayName}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {product.frequencyLabel}
                {product.sourceLabel ? ` · ${product.sourceLabel}` : ""}
              </p>
              {product.statusLabel ? (
                <p role="status" className="mt-1 text-xs font-semibold text-amber-700">
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
  onExplicitNone,
  onContinue,
}: {
  categoryLabel: string
  intakeAvailable: boolean
  showAddAnotherProduct?: boolean
  canContinue?: boolean
  onAddAnotherProduct: () => void
  onOpenFallbackIntake: () => void
  onExplicitNone?: () => void
  onContinue: () => void
}) {
  return (
    <div className="mt-5 grid gap-2">
      {showAddAnotherProduct ? (
        <Button type="button" variant="outline" onClick={onAddAnotherProduct}>
          <Plus className="h-4 w-4" />
          Weiteres {categoryLabel} hinzufügen
        </Button>
      ) : null}
      {intakeAvailable ? (
        <Button type="button" variant="ghost" onClick={onOpenFallbackIntake}>
          Nicht dabei? Produkt hinzufügen
        </Button>
      ) : null}
      {onExplicitNone ? (
        <Button type="button" variant="ghost" onClick={onExplicitNone}>
          Ich habe dafür kein Produkt
        </Button>
      ) : null}
      <Button
        type="button"
        variant="unstyled"
        onClick={onContinue}
        disabled={!canContinue}
        className="quiz-btn-primary w-full"
      >
        Kategorie abschließen
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
  errors = [],
  onToggleRole,
  onContinue,
  onBack,
}: {
  categoryLabel: string
  category: string
  products: Stage3RoleProduct[]
  roles: Stage3RoleOption[]
  assignments: Record<string, string[]>
  errors?: string[]
  onToggleRole: (capturedProductId: string, role: string, checked: boolean) => void
  onContinue: () => void
  onBack: () => void
}) {
  const roleCopy =
    category === "oil"
      ? "Ordne dein Öl den Zwecken zu, die es wirklich übernimmt. Ein Öl darf mehrere Zwecke abdecken."
      : "Ordne jedes Produkt nur den Aufgaben zu, die es wirklich übernimmt. Ein Produkt darf mehrere Aufgaben abdecken."

  return (
    <section>
      <BackButton onBack={onBack} />
      <div className="animate-fade-in-up mb-2">
        <h1 className="font-header text-3xl leading-tight text-foreground">
          Welche Aufgabe hat dein {categoryLabel}?
        </h1>
      </div>
      <p className="animate-fade-in-up mb-6 text-sm text-[var(--text-sub)]">{roleCopy}</p>

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
                    </span>
                  </label>
                )
              })}
            </div>
          </article>
        ))}
      </div>

      {errors.length > 0 ? (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-destructive"
        >
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        <Button
          type="button"
          variant="unstyled"
          onClick={onContinue}
          className="quiz-btn-primary w-full"
        >
          Zuordnung speichern
        </Button>
      </div>
    </section>
  )
}

export function ProductDecisionScreen({
  decisions,
  onChooseAction,
  onBack,
}: {
  decisions: Stage3ProductDecisionProjection[]
  onChooseAction: (decisionKey: string, action: Stage3DecisionAction) => void
  onBack: () => void
}) {
  return (
    <section>
      <BackButton onBack={onBack} />
      <div className="animate-fade-in-up mb-2">
        <h1 className="font-header text-3xl leading-tight text-foreground">Produkte prüfen</h1>
      </div>

      <div className="mt-5 space-y-4">
        {decisions.map((decision) => (
          <DecisionCard
            key={decision.decisionKey}
            decision={decision}
            onChooseAction={onChooseAction}
          />
        ))}
      </div>
    </section>
  )
}

function DecisionCard({
  decision,
  onChooseAction,
}: {
  decision: Stage3ProductDecisionProjection
  onChooseAction: (decisionKey: string, action: Stage3DecisionAction) => void
}) {
  const Icon = decision.kind === "fit" ? Check : decision.kind === "pending" ? Clock : AlertCircle
  const toneClass = decisionToneClass(decision.kind)

  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card",
        decision.actions.length > 1 ? "pb-40" : "pb-24",
      )}
    >
      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 p-4">
        <div className={cn("grid h-10 w-10 place-items-center rounded-full", toneClass.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--brand-plum)]">{decision.categoryLabel}</p>
          <h2 className="mt-1 break-words text-base font-semibold text-foreground">
            {decision.ownedProductName ?? decision.categoryLabel}
          </h2>
          <p
            className={cn(
              "mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold",
              toneClass.badge,
            )}
          >
            {decision.verdictLabel}
          </p>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{decision.needSummary}</p>
        <p className="mt-2 text-sm text-[var(--text-sub)]">{decision.rationale}</p>
      </div>

      {decision.criteria && decision.criteria.length > 0 ? (
        <dl className="border-t border-border">
          {decision.criteria.map((criterion) => (
            <div
              key={`${decision.decisionKey}-${criterion.label}`}
              className="grid grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <dt className="text-sm font-semibold text-foreground">
                {criterion.label}
                {criterion.explanation ? (
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {criterion.explanation}
                  </span>
                ) : null}
              </dt>
              <dd className={cn("text-sm font-semibold", criterionResultClass(criterion.tone))}>
                {criterion.result}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {decision.recommendation ? (
        <div className="border-t border-border bg-[var(--brand-plum-ice)]/50 px-4 py-3">
          <p className="text-xs font-semibold text-[var(--brand-plum)]">Empfehlung</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {decision.recommendation.productName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[
              decision.recommendation.priceLabel,
              decision.recommendation.availabilityLabel,
              decision.recommendation.sellerLabel,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ) : null}

      {decision.kind === "pending" ? (
        <p
          role="status"
          aria-live="polite"
          className="border-t border-border px-4 py-3 text-sm text-amber-700"
        >
          Dieses Produkt bleibt lokal in Prüfung und wird noch nicht als Routine-Schritt verwendet.
        </p>
      ) : null}

      <div className="fixed inset-x-5 bottom-4 z-40 mx-auto grid max-w-[500px] gap-2 rounded-xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur-sm">
        {decision.actions.map((action) => (
          <Button
            key={`${decision.decisionKey}-${action.kind}-${action.label}`}
            type="button"
            variant={primaryActionKinds.has(action.kind) ? "default" : "outline"}
            onClick={() => onChooseAction(decision.decisionKey, action)}
            data-stage3-decision-key={decision.decisionKey}
            data-stage3-action-kind={action.kind}
            aria-label={
              action.productName
                ? `${action.label}: ${action.productName}`
                : `${action.label}: ${decision.categoryLabel} — ${decision.needSummary}`
            }
          >
            {action.label}
          </Button>
        ))}
      </div>
    </article>
  )
}

const primaryActionKinds = new Set<Stage3DecisionAction["kind"]>(["keep", "plan_purchase"])

function decisionToneClass(kind: Stage3ProductDecisionProjection["kind"]) {
  if (kind === "fit") {
    return {
      icon: "bg-emerald-50 text-emerald-700",
      badge: "bg-emerald-50 text-emerald-700",
    }
  }

  if (kind === "pending") {
    return {
      icon: "bg-amber-50 text-amber-700",
      badge: "bg-amber-50 text-amber-700",
    }
  }

  return {
    icon: "bg-red-50 text-destructive",
    badge: "bg-red-50 text-destructive",
  }
}

function criterionResultClass(tone: Exclude<Tone, "neutral">) {
  if (tone === "positive") return "text-emerald-700"
  if (tone === "warning") return "text-amber-700"
  return "text-destructive"
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
        <Button
          type="button"
          variant="unstyled"
          onClick={onAction}
          className="quiz-btn-primary mt-7 w-full"
        >
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
        Produkt per Foto oder manuell hinzufügen. Wenn es noch nicht sicher zugeordnet werden kann,
        bleibt es in Prüfung und du kannst fortfahren.
      </p>
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
          variant="default"
          onClick={onOpen}
          disabled={status === "pending" || selectedFrequency === null}
        >
          Produkt per Foto oder manuell hinzufügen
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

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onBack}
      aria-label="Zurück"
      className="mb-2 rounded-full text-muted-foreground"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  )
}
