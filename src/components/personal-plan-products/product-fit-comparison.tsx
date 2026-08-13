"use client"

import { ArrowLeft, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react"
import type { ReactElement } from "react"

import { Button } from "@/components/ui/button"
import type {
  Stage3AuthorityActionKind,
  Stage3AuthorityEvaluation,
} from "@/lib/personal-plan/products/authority/contracts"
import type {
  Stage3FitComparison,
  Stage3FitComparisonPosition,
  Stage3SelectedComparisonCandidate,
} from "@/lib/personal-plan/products/fit-comparison"
import { cn } from "@/lib/utils"

export type ProductFitComparisonSelection = {
  productId: string
  factFingerprint: string
}

export type ProductFitComparisonAction = Extract<
  Stage3AuthorityActionKind,
  "keep_owned" | "acknowledge_override" | "select_replacement" | "keep_pending" | "leave_uncovered"
>

type ProductFitComparisonProps = {
  comparison: Stage3FitComparison
  evaluation: Stage3AuthorityEvaluation
  /** Parent-owned, presentation-only candidate focus. It is never a pending intent. */
  displayedAlternativeIndex: number
  onDisplayedAlternativeChange: (index: number) => void
  disabled?: boolean
  recoveryMessage?: string
  onAction: (
    action: ProductFitComparisonAction,
    selectedCandidate?: ProductFitComparisonSelection,
  ) => void
  onRetry?: () => void
  onBack: () => void
}

export function ProductFitComparison({
  comparison,
  evaluation,
  displayedAlternativeIndex,
  onDisplayedAlternativeChange,
  disabled = false,
  recoveryMessage,
  onAction,
  onRetry,
  onBack,
}: ProductFitComparisonProps): ReactElement {
  const alternatives = comparison.alternatives.slice(0, 3)
  const selectedIndex = normalizeIndex(displayedAlternativeIndex, alternatives.length)
  const selectedAlternative = alternatives[selectedIndex] ?? null
  const ownedProduct = comparison.products.find((product) => product.source === "current") ?? null
  const currentProduct =
    ownedProduct ??
    (comparison.sourceIdentity
      ? {
          displayName: comparison.sourceIdentity.displayName,
          presentationImageUrl: comparison.sourceIdentity.imageUrl ?? null,
          presentation: { priceLabel: null, netContentLabel: null },
        }
      : null)
  const allowedActions = new Set(evaluation.allowedActions)
  // The bounded comparison bundle is the server's replacement allowlist. Adapters deliberately
  // do not expose select_replacement through allowedActions.
  const replacementAllowed = selectedAlternative !== null
  const primaryAction = primaryActionFor({
    evaluation,
    ownedProductName: currentProduct?.displayName,
    selectedAlternative,
    replacementAllowed,
  })
  const quietActions = quietActionsFor({
    allowedActions,
    ownedProductName: currentProduct?.displayName,
    selectedAlternative,
    replacementAllowed,
    primaryAction,
  })
  const hasTruthfulAction = primaryAction !== null || quietActions.length > 0

  return (
    <section className="min-w-0 pb-28" aria-labelledby="product-fit-comparison-title">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          disabled={disabled}
          aria-label="Zurück zu meinen Produkten"
          className="shrink-0 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <p className="text-right text-sm font-medium text-muted-foreground">Produkte prüfen</p>
      </div>

      {recoveryMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-4 rounded-xl border border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] px-4 py-3 text-sm text-[var(--status-pending-text)]"
        >
          {recoveryMessage}
        </p>
      ) : null}

      {evaluation.status === "unsupported" ? (
        <AnalysisUnavailable disabled={disabled} onRetry={onRetry} onBack={onBack} />
      ) : !hasTruthfulAction &&
        (evaluation.status === "known" || evaluation.status === "pending") ? (
        <NoTruthfulAction disabled={disabled} onBack={onBack} />
      ) : !hasTruthfulAction ? (
        <ReviewStillOpen disabled={disabled} onBack={onBack} />
      ) : (
        <>
          <header className="mb-5">
            <p className="mb-2 text-sm font-semibold text-[var(--brand-plum)]">
              Ein Produkt nach dem anderen
            </p>
            <h1
              id="product-fit-comparison-title"
              className="font-header text-3xl leading-tight text-foreground"
            >
              Wie gut passt dein Produkt?
            </h1>
          </header>

          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            <ProductCard product={currentProduct} label="Dein Produkt" focused />
            {selectedAlternative ? (
              <ProductCard
                product={
                  comparison.products.find(
                    (product) => product.productId === selectedAlternative.productId,
                  ) ?? null
                }
                label={selectedAlternative.verdict === "ideal" ? "Ideal für dich" : "Sehr passend"}
                focused
                candidate={selectedAlternative}
                onFocus={() => onDisplayedAlternativeChange(selectedIndex)}
              />
            ) : null}
          </div>

          {alternatives.length > 1 ? (
            <AlternativeNavigation
              alternatives={alternatives}
              selectedIndex={selectedIndex}
              disabled={disabled}
              onChange={onDisplayedAlternativeChange}
            />
          ) : null}

          {comparison.mode === "comparison" && selectedAlternative ? (
            <ComparisonDimensions
              comparison={comparison}
              selectedAlternative={selectedAlternative}
            />
          ) : comparison.mode === "compact" ? (
            <CompactFacts selectedAlternative={selectedAlternative} />
          ) : null}

          {quietActions.length > 0 ? (
            <div className="mt-5 grid gap-2" aria-label="Weitere Optionen">
              {quietActions.map((action) => (
                <Button
                  key={action.kind}
                  type="button"
                  variant="ghost"
                  className="h-auto whitespace-normal py-3 text-muted-foreground hover:text-foreground"
                  disabled={disabled}
                  onClick={() => invokeAction(action.kind, selectedAlternative, onAction)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </>
      )}

      {evaluation.status !== "unsupported" && hasTruthfulAction && primaryAction ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 py-3 backdrop-blur md:absolute md:inset-x-auto md:bottom-4 md:left-10 md:right-10 md:rounded-2xl md:border">
          <Button
            type="button"
            variant="funnelCta"
            className="w-full"
            disabled={disabled}
            onClick={() => invokeAction(primaryAction.kind, selectedAlternative, onAction)}
            aria-label={primaryAction.label}
          >
            {primaryAction.label}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function AnalysisUnavailable({
  disabled,
  onRetry,
  onBack,
}: {
  disabled: boolean
  onRetry?: () => void
  onBack: () => void
}) {
  return (
    <div className="rounded-2xl border border-[var(--status-danger-border)] bg-card p-5 text-center">
      <h1 id="product-fit-comparison-title" className="font-header text-2xl text-foreground">
        Analyse konnte nicht geladen werden.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Bitte versuche es noch einmal. Deine Produktauswahl bleibt erhalten.
      </p>
      <div className="mt-5 grid gap-2">
        <Button
          type="button"
          variant="funnelCta"
          className="w-full"
          disabled={disabled}
          onClick={onRetry}
        >
          Erneut versuchen
        </Button>
        <Button type="button" variant="ghost" disabled={disabled} onClick={onBack}>
          Zurück zu meinen Produkten
        </Button>
      </div>
    </div>
  )
}

function ReviewStillOpen({ disabled, onBack }: { disabled: boolean; onBack: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center">
      <h1 id="product-fit-comparison-title" className="font-header text-2xl text-foreground">
        Diese Passung ist noch offen.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Für eine verlässliche Entscheidung fehlen noch bestätigte Produktinformationen.
      </p>
      <Button type="button" variant="ghost" className="mt-5" disabled={disabled} onClick={onBack}>
        Zurück zu meinen Produkten
      </Button>
    </div>
  )
}

function NoTruthfulAction({ disabled, onBack }: { disabled: boolean; onBack: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ImageIcon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h1 id="product-fit-comparison-title" className="font-header text-2xl text-foreground">
        Keine passende Alternative verfügbar.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Aktuell können wir dir für dieses Produkt keine verifizierte Alternative empfehlen.
      </p>
      <Button
        type="button"
        variant="funnelCta"
        className="mt-5 w-full"
        disabled={disabled}
        onClick={onBack}
      >
        Zurück zu meinen Produkten
      </Button>
    </div>
  )
}

function ProductCard({
  product,
  label,
  focused,
  candidate,
  onFocus,
}: {
  product: Pick<
    Stage3FitComparison["products"][number],
    "displayName" | "presentationImageUrl" | "presentation"
  > | null
  label: string
  focused: boolean
  candidate?: Stage3SelectedComparisonCandidate
  onFocus?: () => void
}) {
  const content = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-3 flex min-w-0 items-center gap-3">
        <ProductImage
          imageUrl={product?.presentationImageUrl}
          label={product?.displayName ?? "Produkt"}
        />
        <div className="min-w-0">
          <h2 className="break-words font-semibold text-foreground">
            {product?.displayName ?? "Noch kein Produkt"}
          </h2>
          {candidate ? (
            <p className="mt-1 text-sm text-[var(--brand-plum)]">
              {candidate.recommendation.reason}
            </p>
          ) : null}
          {product?.presentation?.priceLabel || product?.presentation?.netContentLabel ? (
            <p className="mt-2 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              {product.presentation?.netContentLabel ? (
                <span>{product.presentation.netContentLabel}</span>
              ) : null}
              {product.presentation?.priceLabel ? (
                <span>{product.presentation.priceLabel}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </>
  )
  const className = cn(
    "min-w-0 rounded-2xl border bg-card p-4",
    focused && "border-[var(--brand-plum)]",
  )
  if (onFocus) {
    return (
      <button
        type="button"
        aria-label={`${product?.displayName ?? "Alternative"} auswählen`}
        className={cn(
          className,
          "w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onClick={onFocus}
      >
        {content}
      </button>
    )
  }
  return <article className={className}>{content}</article>
}

function ProductImage({ imageUrl, label }: { imageUrl?: string | null; label: string }) {
  if (imageUrl) {
    return (
      // Product images may come from owner-submitted catalog sources that are not configured
      // as Next image hosts, so the review keeps this bounded thumbnail unoptimized.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover"
      />
    )
  }
  return (
    <div
      aria-label={`${label}: Bild nicht verfügbar`}
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
    >
      <ImageIcon className="h-5 w-5" aria-hidden="true" />
    </div>
  )
}

function AlternativeNavigation({
  alternatives,
  selectedIndex,
  disabled,
  onChange,
}: {
  alternatives: readonly Stage3SelectedComparisonCandidate[]
  selectedIndex: number
  disabled: boolean
  onChange: (index: number) => void
}) {
  const previous = normalizeIndex(selectedIndex - 1, alternatives.length)
  const next = normalizeIndex(selectedIndex + 1, alternatives.length)
  return (
    <nav
      className="mt-4 flex items-center justify-center gap-3"
      aria-label="Weitere passende Alternativen"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Vorherige Alternative"
        disabled={disabled}
        onClick={() => onChange(previous)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <p
        role="status"
        aria-live="polite"
        className="min-w-16 text-center text-sm text-muted-foreground"
      >
        {selectedIndex + 1} von {alternatives.length}
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Nächste Alternative"
        disabled={disabled}
        onClick={() => onChange(next)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}

function ComparisonDimensions({
  comparison,
  selectedAlternative,
}: {
  comparison: Extract<Stage3FitComparison, { mode: "comparison" }>
  selectedAlternative: Stage3SelectedComparisonCandidate
}) {
  return (
    <section
      className="mt-6 min-w-0 rounded-2xl border border-border bg-card p-4"
      aria-label="Vergleich der Produkteigenschaften"
    >
      <h2 className="font-semibold text-foreground">Produkteigenschaften</h2>
      <div className="mt-4 space-y-5">
        {comparison.dimensions.slice(0, 3).map((dimension) => (
          <article key={dimension.dimensionId} className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{dimension.label}</h3>
            <div className="relative mt-3 h-6" aria-label={`${dimension.label}: Vergleich`}>
              <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-muted" />
              <RailMarker
                label="Ziel"
                position={dimension.targetPosition}
                stops={dimension.stops}
                className="bg-[var(--status-ok-text)]"
              />
              <RailMarker
                label="Deins"
                position={findPosition(
                  dimension.productPositions,
                  comparison.products.find((product) => product.source === "current")?.productId,
                )}
                stops={dimension.stops}
                className="bg-foreground"
              />
              <RailMarker
                label="Alternative"
                position={findPosition(dimension.productPositions, selectedAlternative.productId)}
                stops={dimension.stops}
                className="bg-[var(--brand-plum)]"
              />
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              {dimension.stops.map((stop) => (
                <span key={stop.stopId} className="min-w-0 text-center">
                  {stop.label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{dimension.reason}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function CompactFacts({
  selectedAlternative,
}: {
  selectedAlternative: Stage3SelectedComparisonCandidate | null
}) {
  if (!selectedAlternative) return null
  return (
    <section
      className="mt-6 rounded-2xl border border-border bg-card p-4"
      aria-label="Verifizierte Produktfakten"
    >
      <h2 className="font-semibold text-foreground">Verifizierte Produktfakten</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {selectedAlternative.criteria.slice(0, 3).map((criterion) => (
          <li key={criterion.criterionId}>
            {criterion.label}: {criterion.explanation}
          </li>
        ))}
      </ul>
    </section>
  )
}

function RailMarker({
  label,
  position,
  stops,
  className,
}: {
  label: string
  position: Stage3FitComparisonPosition | null
  stops: Array<{ stopId: string }>
  className: string
}) {
  const left = positionPercentage(position, stops)
  if (left === null) return null
  return (
    <span
      aria-label={label}
      className={cn(
        "absolute top-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-background",
        className,
      )}
      style={{ left: `${left}%` }}
    />
  )
}

function primaryActionFor({
  evaluation,
  ownedProductName,
  selectedAlternative,
  replacementAllowed,
}: {
  evaluation: Stage3AuthorityEvaluation
  ownedProductName?: string
  selectedAlternative: Stage3SelectedComparisonCandidate | null
  replacementAllowed: boolean
}): { kind: ProductFitComparisonAction; label: string } | null {
  const allowed = new Set(evaluation.allowedActions)
  if (evaluation.status === "pending" && replacementAllowed)
    return { kind: "select_replacement", label: "Verifizierte Alternative wählen" }
  if (evaluation.status === "pending" && allowed.has("keep_pending"))
    return { kind: "keep_pending", label: "Auf Analyse warten" }
  if (
    replacementAllowed &&
    (!allowed.has("keep_owned") ||
      (evaluation.status === "known" && evaluation.verdict === "mismatch"))
  ) {
    return { kind: "select_replacement", label: replacementLabel(selectedAlternative!) }
  }
  if (allowed.has("keep_owned"))
    return { kind: "keep_owned", label: `${ownedProductName ?? "Mein Produkt"} weiterverwenden` }
  if (replacementAllowed)
    return { kind: "select_replacement", label: replacementLabel(selectedAlternative!) }
  if (allowed.has("leave_uncovered"))
    return { kind: "leave_uncovered", label: "Vorerst ohne Produkt weiter" }
  if (allowed.has("acknowledge_override"))
    return {
      kind: "acknowledge_override",
      label: `${ownedProductName ?? "Mein Produkt"} trotzdem behalten`,
    }
  return null
}

function quietActionsFor({
  allowedActions,
  ownedProductName,
  selectedAlternative,
  replacementAllowed,
  primaryAction,
}: {
  allowedActions: Set<Stage3AuthorityActionKind>
  ownedProductName?: string
  selectedAlternative: Stage3SelectedComparisonCandidate | null
  replacementAllowed: boolean
  primaryAction: { kind: ProductFitComparisonAction; label: string } | null
}) {
  const actions: Array<{ kind: ProductFitComparisonAction; label: string }> = []
  if (replacementAllowed && primaryAction?.kind !== "select_replacement")
    actions.push({ kind: "select_replacement", label: replacementLabel(selectedAlternative!) })
  if (allowedActions.has("keep_pending") && primaryAction?.kind !== "keep_pending")
    actions.push({ kind: "keep_pending", label: "Auf Analyse warten" })
  if (allowedActions.has("acknowledge_override") && primaryAction?.kind !== "acknowledge_override")
    actions.push({
      kind: "acknowledge_override",
      label: `${ownedProductName ?? "Mein Produkt"} mit Einschränkung weiterverwenden`,
    })
  if (allowedActions.has("leave_uncovered") && primaryAction?.kind !== "leave_uncovered")
    actions.push({ kind: "leave_uncovered", label: "Vorerst ohne Produkt weiter" })
  return actions
}

function invokeAction(
  action: ProductFitComparisonAction,
  selectedAlternative: Stage3SelectedComparisonCandidate | null,
  onAction: ProductFitComparisonProps["onAction"],
) {
  if (action === "select_replacement" && selectedAlternative) {
    onAction(action, {
      productId: selectedAlternative.productId,
      factFingerprint: selectedAlternative.factFingerprint,
    })
    return
  }
  onAction(action)
}

function replacementLabel(candidate: Stage3SelectedComparisonCandidate) {
  return candidate.verdict === "supportive"
    ? `${candidate.recommendation.displayName} trotz Einschränkung übernehmen`
    : `${candidate.recommendation.displayName} als Ersatz übernehmen`
}

function normalizeIndex(index: number, length: number) {
  if (length === 0) return 0
  return ((index % length) + length) % length
}

function findPosition(
  entries: Array<{ productId: string; position: Stage3FitComparisonPosition }>,
  productId?: string,
) {
  return entries.find((entry) => entry.productId === productId)?.position ?? null
}

function positionPercentage(
  position: Stage3FitComparisonPosition | null,
  stops: Array<{ stopId: string }>,
) {
  if (!position || position.kind === "unknown" || stops.length === 0) return null
  const stopIds = position.kind === "position" ? [position.stopId] : position.stopIds
  const indexes = stopIds
    .map((stopId) => stops.findIndex((stop) => stop.stopId === stopId))
    .filter((index) => index >= 0)
  if (indexes.length === 0) return null
  const averageIndex = indexes.reduce((sum, index) => sum + index, 0) / indexes.length
  return stops.length === 1 ? 50 : 8 + (averageIndex / (stops.length - 1)) * 84
}
