"use client"

import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ImageIcon,
  Minus,
  X,
} from "lucide-react"
import { type ReactElement, useState } from "react"

import { Button } from "@/components/ui/button"
import type {
  Stage3AuthorityActionKind,
  Stage3AuthorityEvaluation,
} from "@/lib/personal-plan/products/authority/contracts"
import type {
  Stage3FitComparison,
  Stage3FitEvidenceRelation,
  Stage3FitEvidenceRow,
  Stage3SelectedComparisonCandidate,
} from "@/lib/personal-plan/products/fit-comparison"
import { cn } from "@/lib/utils"
import { categorySelectionHeading } from "./stage3-product-copy"

type ReviewProduct = {
  displayName: string
  presentationImageUrl?: string | null
  presentation?: { priceLabel: string | null; netContentLabel: string | null }
}

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
  categoryLabel?: string
  roleLabel?: string
  reviewPosition?: number
  reviewTotal?: number
  /** Parent-owned, presentation-only candidate focus. It is never a pending intent. */
  displayedAlternativeIndex: number
  onDisplayedAlternativeChange: (index: number) => void
  selectedRecommendationProductId?: string | null
  onSelectedRecommendationChange?: (productId: string) => void
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
  categoryLabel = "Produkt",
  roleLabel = "Prüfung",
  reviewPosition = 1,
  reviewTotal = 1,
  displayedAlternativeIndex,
  onDisplayedAlternativeChange,
  selectedRecommendationProductId = null,
  onSelectedRecommendationChange,
  disabled = false,
  recoveryMessage,
  onAction,
  onRetry,
  onBack,
}: ProductFitComparisonProps): ReactElement {
  const alternatives = comparison.alternatives.slice(0, 3)
  const selectedIndex = normalizeIndex(displayedAlternativeIndex, alternatives.length)
  const displayedAlternative = alternatives[selectedIndex] ?? null
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
  const isUncoveredReview = currentProduct === null
  const selectedRecommendation =
    alternatives.find((candidate) => candidate.productId === selectedRecommendationProductId) ??
    alternatives[0] ??
    null
  const selectedAlternative = isUncoveredReview ? selectedRecommendation : displayedAlternative
  // The bounded comparison bundle is the server's replacement allowlist. Adapters deliberately
  // do not expose select_replacement through allowedActions.
  const replacementAllowed = selectedAlternative !== null
  const authorityPrimaryAction = primaryActionFor({ evaluation, replacementAllowed })
  const uncoveredRetryIsPrimary = isUncoveredReview && !selectedAlternative && Boolean(onRetry)
  const primaryAction = isUncoveredReview && !selectedAlternative ? null : authorityPrimaryAction
  const quietActions = quietActionsFor({
    allowedActions,
    selectedAlternative,
    replacementAllowed,
    primaryAction,
  })
  const visiblePrimaryAction = primaryAction?.kind === "leave_uncovered" ? null : primaryAction
  const secondaryActions = quietActions.filter((action) => action.kind !== "leave_uncovered")
  const leaveUncoveredAction =
    primaryAction?.kind === "leave_uncovered"
      ? primaryAction
      : quietActions.find((action) => action.kind === "leave_uncovered")
  const hasTruthfulAction =
    uncoveredRetryIsPrimary || primaryAction !== null || quietActions.length > 0
  const contextLabel = `${categoryLabel} · ${roleLabel} · Produkt ${reviewPosition} von ${reviewTotal}`
  const evidenceRows = comparison.evidenceRows ?? []
  const isUnknownFit =
    evaluation.status === "unknown" ||
    (evaluation.status === "known" && evaluation.verdict === "unknown")

  let content: ReactElement
  if (evaluation.status === "unsupported") {
    content = <AnalysisUnavailable disabled={disabled} onRetry={onRetry} onBack={onBack} />
  } else if (evaluation.status === "pending") {
    content = (
      <PendingReview
        contextLabel={contextLabel}
        categoryLabel={categoryLabel}
        currentProduct={currentProduct}
        comparison={comparison}
        alternatives={alternatives}
        selectedAlternative={selectedAlternative}
        selectedIndex={selectedIndex}
        disabled={disabled}
        onDisplayedAlternativeChange={onDisplayedAlternativeChange}
      />
    )
  } else if (isUncoveredReview) {
    content = (
      <UncoveredRecommendationReview
        contextLabel={contextLabel}
        categoryLabel={categoryLabel}
        comparison={comparison}
        alternatives={alternatives}
        selectedIndex={selectedIndex}
        selectedProductId={selectedRecommendation?.productId ?? null}
        disabled={disabled}
        onDisplayedAlternativeChange={onDisplayedAlternativeChange}
        onSelect={onSelectedRecommendationChange ?? (() => undefined)}
        onRetry={onRetry}
      />
    )
  } else if (isUnknownFit) {
    content = (
      <UnassessableReview
        contextLabel={contextLabel}
        categoryLabel={categoryLabel}
        currentProduct={currentProduct}
        alternatives={alternatives}
        selectedAlternative={selectedAlternative}
        selectedIndex={selectedIndex}
        comparison={comparison}
        disabled={disabled}
        onDisplayedAlternativeChange={onDisplayedAlternativeChange}
      />
    )
  } else if (!hasTruthfulAction && evaluation.status === "known") {
    content = <NoTruthfulAction disabled={disabled} onBack={onBack} />
  } else if (!hasTruthfulAction) {
    content = <ReviewStillOpen disabled={disabled} onBack={onBack} />
  } else if (currentProduct && !selectedAlternative) {
    content = (
      <FitOnlyReview
        contextLabel={contextLabel}
        categoryLabel={categoryLabel}
        product={currentProduct}
        evaluation={evaluation}
        evidenceRows={evidenceRows}
        productId={ownedProduct?.productId}
      />
    )
  } else {
    content = (
      <ComparisonReview
        contextLabel={contextLabel}
        categoryLabel={categoryLabel}
        currentProduct={currentProduct}
        ownedProductId={ownedProduct?.productId}
        comparison={comparison}
        evaluation={evaluation}
        alternatives={alternatives}
        selectedAlternative={selectedAlternative}
        selectedIndex={selectedIndex}
        disabled={disabled}
        onDisplayedAlternativeChange={onDisplayedAlternativeChange}
      />
    )
  }

  return (
    <section className="min-w-0 pb-40 md:pb-0" aria-labelledby="product-fit-comparison-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          disabled={disabled}
          aria-label="Zurück zur vorherigen Prüfung"
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
          className="mb-4 rounded-xl border border-[var(--status-pending-text)]/25 bg-[var(--status-pending-bg)] px-4 py-3 text-sm text-[var(--status-pending-text)]"
        >
          {recoveryMessage}
        </p>
      ) : null}

      {content}

      {evaluation.status !== "unsupported" && hasTruthfulAction ? (
        <>
          {visiblePrimaryAction || secondaryActions.length > 0 || leaveUncoveredAction ? (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 py-3 backdrop-blur md:static md:mt-6 md:rounded-2xl md:border md:bg-card md:p-4 md:shadow-sm md:backdrop-blur-none">
              <div className="mx-auto flex max-w-3xl flex-col gap-2 md:flex-row md:flex-wrap md:justify-end">
                {secondaryActions.map((action) => (
                  <Button
                    key={action.kind}
                    type="button"
                    variant="outline"
                    className="h-auto min-h-12 w-full whitespace-normal px-5 py-3 text-center leading-tight md:w-auto md:min-w-56"
                    disabled={disabled}
                    onClick={() => invokeAction(action.kind, selectedAlternative, onAction)}
                  >
                    {action.label}
                  </Button>
                ))}
                {visiblePrimaryAction ? (
                  <Button
                    type="button"
                    variant="funnelCta"
                    className="h-auto min-h-12 w-full whitespace-normal px-5 py-3 text-center leading-tight md:w-auto md:min-w-64"
                    disabled={disabled}
                    onClick={() =>
                      invokeAction(visiblePrimaryAction.kind, selectedAlternative, onAction)
                    }
                    aria-label={
                      selectedAlternative && isUncoveredReview
                        ? "Dieses Produkt einplanen"
                        : visiblePrimaryAction.label
                    }
                  >
                    {selectedAlternative && isUncoveredReview
                      ? "Dieses Produkt einplanen"
                      : visiblePrimaryAction.label}
                  </Button>
                ) : null}
              </div>
              {leaveUncoveredAction ? (
                <Button
                  type="button"
                  variant="link"
                  aria-label={leaveUncoveredAction.label}
                  className="mx-auto mt-1 flex h-auto min-h-9 whitespace-normal text-center text-muted-foreground underline underline-offset-4"
                  disabled={disabled}
                  onClick={() =>
                    invokeAction(leaveUncoveredAction.kind, selectedAlternative, onAction)
                  }
                >
                  {leaveUncoveredAction.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function ReviewHeader({
  contextLabel,
  title,
  description,
}: {
  contextLabel: string
  title: string
  description?: string
}) {
  return (
    <header className="mb-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--brand-plum)]">
        {contextLabel}
      </p>
      <h1
        id="product-fit-comparison-title"
        className="font-header text-3xl leading-tight text-foreground"
      >
        {title}
      </h1>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </header>
  )
}

function ComparisonReview({
  contextLabel,
  categoryLabel,
  currentProduct,
  ownedProductId,
  comparison,
  evaluation,
  alternatives,
  selectedAlternative,
  selectedIndex,
  disabled,
  onDisplayedAlternativeChange,
}: {
  contextLabel: string
  categoryLabel: string
  currentProduct: ReviewProduct | null
  ownedProductId?: string
  comparison: Stage3FitComparison
  evaluation: Stage3AuthorityEvaluation
  alternatives: readonly Stage3SelectedComparisonCandidate[]
  selectedAlternative: Stage3SelectedComparisonCandidate | null
  selectedIndex: number
  disabled: boolean
  onDisplayedAlternativeChange: (index: number) => void
}) {
  const alternativeProduct = selectedAlternative
    ? (comparison.products.find((product) => product.productId === selectedAlternative.productId) ??
      null)
    : null
  const count = targetCount(comparison.evidenceRows ?? [], ownedProductId)
  return (
    <>
      <ReviewHeader
        contextLabel={contextLabel}
        title={`Dein ${categoryLabel || "Produkt"} im Vergleich`}
      />
      <OverallVerdict
        evaluation={evaluation}
        count={count}
        rows={comparison.evidenceRows ?? []}
        currentProductId={ownedProductId}
      />
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <ProductCard product={currentProduct} label="Dein Produkt" />
        <ProductCard
          product={alternativeProduct}
          label={
            selectedAlternative?.verdict === "supportive"
              ? "Alternative · passt mit Einschränkung"
              : "Passende Alternative"
          }
          alternativeVerdict={selectedAlternative?.verdict ?? null}
        />
      </div>
      {alternatives.length > 1 ? (
        <AlternativeNavigation
          alternatives={alternatives}
          selectedIndex={selectedIndex}
          disabled={disabled}
          onChange={onDisplayedAlternativeChange}
        />
      ) : null}
      {(comparison.evidenceRows?.length ?? 0) > 0 && selectedAlternative ? (
        <EvidenceMatrix
          key={evidenceMatrixKey(
            comparison.evidenceRows ?? [],
            ownedProductId,
            selectedAlternative.productId,
          )}
          rows={comparison.evidenceRows ?? []}
          firstProductId={ownedProductId}
          secondProductId={selectedAlternative.productId}
          firstLabel="Deins"
          secondLabel="Alternative"
        />
      ) : (
        <CompactEvidence evaluation={evaluation} selectedAlternative={selectedAlternative} />
      )}
    </>
  )
}

function FitOnlyReview({
  contextLabel,
  categoryLabel,
  product,
  evaluation,
  evidenceRows,
  productId,
}: {
  contextLabel: string
  categoryLabel: string
  product: ReviewProduct
  evaluation: Stage3AuthorityEvaluation
  evidenceRows: Stage3FitEvidenceRow[]
  productId?: string
}) {
  const verdict = evaluation.status === "known" ? evaluation.verdict : "unknown"
  const presentation =
    verdict === "ideal"
      ? {
          title: `Dein ${categoryLabel || "Produkt"} passt`,
          description: "Dein Produkt liegt in den relevanten bestätigten Punkten im Ziel.",
        }
      : verdict === "supportive"
        ? {
            title: `Dein ${categoryLabel || "Produkt"} passt mit Einschränkung`,
            description: "Dein Produkt passt grundsätzlich zu deinem Bedarf.",
          }
        : {
            title: `Dein ${categoryLabel || "Produkt"} passt nicht`,
            description:
              "Dein Produkt liegt in mindestens einem bestätigten Prüfpunkt außerhalb deines Ziels.",
          }
  return (
    <>
      <ReviewHeader
        contextLabel={contextLabel}
        title={presentation.title}
        description={presentation.description}
      />
      <ProductCard product={product} label="Dein Produkt" />
      {evidenceRows.length > 0 && productId ? (
        <CompactOwnedEvidence rows={evidenceRows} productId={productId} />
      ) : null}
      <p
        className={cn(
          "mt-4 rounded-xl px-4 py-3 text-sm font-medium",
          verdict === "mismatch"
            ? "bg-muted text-muted-foreground"
            : "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]",
        )}
      >
        {verdict === "mismatch"
          ? "Aktuell ist keine verifizierte Alternative verfügbar."
          : "Aktuell ist keine klar bessere verifizierte Alternative verfügbar."}
      </p>
    </>
  )
}

function PendingReview({
  contextLabel,
  categoryLabel,
  currentProduct,
  comparison,
  alternatives,
  selectedAlternative,
  selectedIndex,
  disabled,
  onDisplayedAlternativeChange,
}: {
  contextLabel: string
  categoryLabel: string
  currentProduct: ReviewProduct | null
  comparison: Stage3FitComparison
  alternatives: readonly Stage3SelectedComparisonCandidate[]
  selectedAlternative: Stage3SelectedComparisonCandidate | null
  selectedIndex: number
  disabled: boolean
  onDisplayedAlternativeChange: (index: number) => void
}) {
  const alternativeProduct = selectedAlternative
    ? (comparison.products.find((product) => product.productId === selectedAlternative.productId) ??
      null)
    : null
  return (
    <>
      <ReviewHeader
        contextLabel={contextLabel}
        title={`Dein ${categoryLabel || "Produkt"} wird noch geprüft`}
        description="Wir haben noch nicht genug bestätigte Produktdaten für ein verlässliches Urteil."
      />
      <div className={cn("grid min-w-0 gap-2", selectedAlternative && "grid-cols-2")}>
        <ProductCard product={currentProduct} label="Dein Produkt" />
        {selectedAlternative ? (
          <ProductCard
            product={alternativeProduct}
            label="Verifizierte Alternative"
            alternativeVerdict={selectedAlternative.verdict}
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
      <p className="mt-4 rounded-xl border border-[var(--status-pending-text)]/25 bg-[var(--status-pending-bg)] px-4 py-3 text-sm text-[var(--status-pending-text)]">
        Bis zur Prüfung behaupten wir weder, dass dein Produkt passt, noch dass es nicht passt.
      </p>
    </>
  )
}

function UnassessableReview({
  contextLabel,
  categoryLabel,
  currentProduct,
  alternatives,
  selectedAlternative,
  selectedIndex,
  comparison,
  disabled,
  onDisplayedAlternativeChange,
}: {
  contextLabel: string
  categoryLabel: string
  currentProduct: ReviewProduct | null
  alternatives: readonly Stage3SelectedComparisonCandidate[]
  selectedAlternative: Stage3SelectedComparisonCandidate | null
  selectedIndex: number
  comparison: Stage3FitComparison
  disabled: boolean
  onDisplayedAlternativeChange: (index: number) => void
}) {
  const alternativeProduct = selectedAlternative
    ? (comparison.products.find((product) => product.productId === selectedAlternative.productId) ??
      null)
    : null
  return (
    <>
      <ReviewHeader
        contextLabel={contextLabel}
        title="Noch nicht eindeutig beurteilbar"
        description="Für diesen Vergleich fehlen noch verifizierte Produktdaten."
      />
      <div className={cn("grid min-w-0 gap-2", selectedAlternative && "grid-cols-2")}>
        <ProductCard product={currentProduct} label={`Dein ${categoryLabel || "Produkt"}`} />
        {selectedAlternative ? (
          <ProductCard
            product={alternativeProduct}
            label="Verifizierte Alternative"
            alternativeVerdict={selectedAlternative.verdict}
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
      <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        Deshalb zeigen wir hier bewusst keine Zielmarken und kein Fit-Urteil.
      </p>
    </>
  )
}

function UncoveredRecommendationReview({
  contextLabel,
  categoryLabel,
  comparison,
  alternatives,
  selectedIndex,
  selectedProductId,
  disabled,
  onDisplayedAlternativeChange,
  onSelect,
  onRetry,
}: {
  contextLabel: string
  categoryLabel: string
  comparison: Stage3FitComparison
  alternatives: readonly Stage3SelectedComparisonCandidate[]
  selectedIndex: number
  selectedProductId: string | null
  disabled: boolean
  onDisplayedAlternativeChange: (index: number) => void
  onSelect: (productId: string) => void
  onRetry?: () => void
}) {
  const first = alternatives[0] ?? null
  const secondaryIndex = alternatives.length > 1 ? (selectedIndex > 0 ? selectedIndex : 1) : null
  const secondary = secondaryIndex === null ? null : (alternatives[secondaryIndex] ?? null)
  const firstProduct = first
    ? (comparison.products.find((product) => product.productId === first.productId) ?? null)
    : null
  const secondaryProduct = secondary
    ? (comparison.products.find((product) => product.productId === secondary.productId) ?? null)
    : null
  const firstLabel = first?.verdict === "ideal" ? "Beste Passung" : "Beste verfügbare Option"
  const secondaryBaseLabel = secondaryIndex === null ? null : `Alternative ${secondaryIndex}`
  const secondaryLabel =
    secondary && secondaryBaseLabel ? recommendationCardLabel(secondaryBaseLabel, secondary) : null

  return (
    <>
      <ReviewHeader
        contextLabel={contextLabel}
        title={categorySelectionHeading(categoryLabel)}
        description={
          first
            ? first.verdict === "ideal"
              ? "Chaarlie hat geprüfte Produkte für diesen Bedarf ausgewählt. Du entscheidest, welches davon in deine Routine kommt."
              : "Das sind die besten geprüften Optionen im Katalog. Wir zeigen die Einschränkung offen."
            : "Dein gespeicherter Bedarf bleibt erhalten. Prüfe später erneut oder fahre ohne Produkt fort, wenn das hier erlaubt ist."
        }
      />
      {first ? (
        <>
          <div className={cn("grid min-w-0 gap-2", secondary && "grid-cols-2")}>
            <ProductCard
              product={firstProduct}
              label={firstLabel}
              alternativeVerdict={first.verdict}
              selected={selectedProductId === first.productId}
              disabled={disabled}
              onSelect={() => onSelect(first.productId)}
            />
            {secondary && secondaryIndex !== null ? (
              <ProductCard
                product={secondaryProduct}
                label={secondaryLabel ?? "Alternative"}
                alternativeVerdict={secondary.verdict}
                selected={selectedProductId === secondary.productId}
                disabled={disabled}
                onSelect={() => onSelect(secondary.productId)}
              />
            ) : null}
          </div>
          {alternatives.length > 2 && secondaryIndex !== null ? (
            <RecommendationNavigation
              alternatives={alternatives}
              secondaryIndex={secondaryIndex}
              disabled={disabled}
              onChange={onDisplayedAlternativeChange}
            />
          ) : null}
          {(comparison.evidenceRows?.length ?? 0) > 0 && secondary ? (
            <EvidenceMatrix
              key={evidenceMatrixKey(
                comparison.evidenceRows ?? [],
                first.productId,
                secondary.productId,
              )}
              rows={comparison.evidenceRows ?? []}
              firstProductId={first.productId}
              secondProductId={secondary.productId}
              firstLabel={firstLabel}
              secondLabel={secondaryBaseLabel ?? "Alternative"}
            />
          ) : (
            <CompactRecommendationEvidence
              first={first}
              firstLabel={firstLabel}
              second={secondary}
              secondLabel={secondaryLabel}
            />
          )}
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-[var(--brand-plum)]/35 bg-muted/30 p-5 text-center">
          <h2 className="text-base font-semibold text-foreground">
            Gerade ist keine geprüfte Empfehlung verfügbar.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Dein Bedarf bleibt gespeichert. Wir planen kein generisches Produkt ein.
          </p>
          {onRetry ? (
            <Button
              type="button"
              variant="funnelCta"
              className="mt-4 w-full"
              disabled={disabled}
              onClick={onRetry}
              aria-label="Erneut prüfen"
            >
              Erneut prüfen
            </Button>
          ) : null}
        </section>
      )}
    </>
  )
}

function recommendationCardLabel(baseLabel: string, candidate: Stage3SelectedComparisonCandidate) {
  return candidate.verdict === "supportive" ? `${baseLabel} · passt teilweise` : baseLabel
}

function OverallVerdict({
  evaluation,
  count,
  rows,
  currentProductId,
}: {
  evaluation: Stage3AuthorityEvaluation
  count: ReturnType<typeof targetCount>
  rows: Stage3FitEvidenceRow[]
  currentProductId?: string
}) {
  if (evaluation.status !== "known" || evaluation.verdict === "unknown") return null
  const label =
    evaluation.verdict === "ideal"
      ? "Passt"
      : evaluation.verdict === "supportive"
        ? "Passt mit Einschränkung"
        : "Passt nicht"
  const inTargetLabels = rows
    .filter((row) => relationFor(row, currentProductId) === "in_target")
    .map((row) => row.label)
  const outsideTargetLabels = rows
    .filter((row) => relationFor(row, currentProductId) === "outside_target")
    .map((row) => row.label)
  const supportiveLabels = rows
    .filter((row) => relationFor(row, currentProductId) === "supportive")
    .map((row) => row.label)
  const unknownLabels = rows
    .filter((row) => relationFor(row, currentProductId) === "unknown")
    .map((row) => row.label)
  return (
    <div className="mb-4 rounded-xl bg-muted/60 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong className="text-sm text-foreground">{label}</strong>
        {count ? (
          <span className="text-xs text-muted-foreground">
            {count.inTarget} im Ziel · {count.supportive} mit Einschränkung · {count.outsideTarget}{" "}
            außerhalb{count.unknown ? ` · ${count.unknown} nicht bestätigt` : ""}
            {count.noTarget ? ` · ${count.noTarget} ohne Einordnung` : ""}
          </span>
        ) : null}
      </div>
      {inTargetLabels.length > 0 ||
      supportiveLabels.length > 0 ||
      outsideTargetLabels.length > 0 ||
      unknownLabels.length > 0 ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {inTargetLabels.length > 0 ? `Im Ziel: ${inTargetLabels.join(", ")}.` : null}{" "}
          {supportiveLabels.length > 0
            ? `Passt mit Einschränkung: ${supportiveLabels.join(", ")}.`
            : null}{" "}
          {outsideTargetLabels.length > 0 ? `Außerhalb: ${outsideTargetLabels.join(", ")}.` : null}
          {unknownLabels.length > 0 ? ` Nicht bestätigt: ${unknownLabels.join(", ")}.` : null}
        </p>
      ) : null}
    </div>
  )
}

function ProductCard({
  product,
  label,
  alternativeVerdict = null,
  selected = false,
  disabled = false,
  onSelect,
}: {
  product: ReviewProduct | null
  label: string
  alternativeVerdict?: Stage3SelectedComparisonCandidate["verdict"] | null
  selected?: boolean
  disabled?: boolean
  onSelect?: () => void
}) {
  const idealAlternative = alternativeVerdict === "ideal"
  const supportiveAlternative = alternativeVerdict === "supportive"
  return (
    <article
      className={cn(
        "relative min-w-0 rounded-2xl border bg-card p-3",
        idealAlternative
          ? "border-[var(--status-ok-text)]/45"
          : supportiveAlternative
            ? "border-[var(--status-pending-text)]/45"
            : "border-[var(--brand-plum)]",
        selected && "ring-2 ring-[var(--brand-plum)] ring-offset-2",
      )}
    >
      {onSelect ? (
        <>
          <ProductCardContent
            product={product}
            label={label}
            idealAlternative={idealAlternative}
            supportiveAlternative={supportiveAlternative}
          />
          <button
            type="button"
            className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`${product?.displayName ?? label} als Auswahl markieren`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={onSelect}
          >
            <span className="sr-only">{product?.displayName ?? label} als Auswahl markieren</span>
          </button>
        </>
      ) : (
        <ProductCardContent
          product={product}
          label={label}
          idealAlternative={idealAlternative}
          supportiveAlternative={supportiveAlternative}
        />
      )}
    </article>
  )
}

function ProductCardContent({
  product,
  label,
  idealAlternative,
  supportiveAlternative,
}: {
  product: ReviewProduct | null
  label: string
  idealAlternative: boolean
  supportiveAlternative: boolean
}) {
  return (
    <>
      <p
        className={cn(
          "text-[10px] font-bold uppercase tracking-wide text-muted-foreground",
          idealAlternative && "text-[var(--status-ok-text)]",
          supportiveAlternative && "text-[var(--status-pending-text)]",
        )}
      >
        {label}
      </p>
      <div className="mt-2 flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
        <ProductImage
          imageUrl={product?.presentationImageUrl}
          label={product?.displayName ?? "Produkt"}
        />
        <div className="min-w-0">
          <h2 className="break-words text-xs font-semibold leading-snug text-foreground sm:text-sm">
            {product?.displayName ?? "Noch kein Produkt"}
          </h2>
          {product?.presentation?.priceLabel || product?.presentation?.netContentLabel ? (
            <p className="mt-1 flex flex-wrap justify-center gap-x-2 text-[10px] text-muted-foreground sm:justify-start">
              {product.presentation.netContentLabel ? (
                <span>{product.presentation.netContentLabel}</span>
              ) : null}
              {product.presentation.priceLabel ? (
                <span>{product.presentation.priceLabel}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </>
  )
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
        className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover"
      />
    )
  }
  return (
    <div
      aria-label={`${label}: Bild nicht verfügbar`}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
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
  return (
    <nav
      className="mt-3 flex items-center justify-center gap-3"
      aria-label="Weitere passende Alternativen"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Vorherige Alternative"
        disabled={disabled}
        onClick={() => onChange(normalizeIndex(selectedIndex - 1, alternatives.length))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <p
        role="status"
        aria-live="polite"
        className="min-w-28 text-center text-xs text-muted-foreground"
      >
        Alternative {selectedIndex + 1} von {alternatives.length}
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Nächste Alternative"
        disabled={disabled}
        onClick={() => onChange(normalizeIndex(selectedIndex + 1, alternatives.length))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}

function RecommendationNavigation({
  alternatives,
  secondaryIndex,
  disabled,
  onChange,
}: {
  alternatives: readonly Stage3SelectedComparisonCandidate[]
  secondaryIndex: number
  disabled: boolean
  onChange: (index: number) => void
}) {
  const secondaryIndexes = alternatives.map((_, index) => index).filter((index) => index > 0)
  const position = Math.max(0, secondaryIndexes.indexOf(secondaryIndex))
  const secondaryCount = Math.max(0, alternatives.length - 1)
  const move = (delta: number) => {
    const next = secondaryIndexes[normalizeIndex(position + delta, secondaryIndexes.length)]
    if (next !== undefined) onChange(next)
  }
  return (
    <nav
      className="mt-3 flex items-center justify-center gap-3"
      aria-label="Weitere passende Alternativen"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Vorherige Alternative"
        disabled={disabled}
        onClick={() => move(-1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <p
        role="status"
        aria-live="polite"
        className="min-w-32 text-center text-xs text-muted-foreground"
      >
        Alternative {secondaryIndex} von {secondaryCount}
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Nächste Alternative"
        disabled={disabled}
        onClick={() => move(1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}

function EvidenceMatrix({
  rows,
  firstProductId,
  secondProductId,
  firstLabel,
  secondLabel,
}: {
  rows: Stage3FitEvidenceRow[]
  firstProductId?: string
  secondProductId: string
  firstLabel: string
  secondLabel: string
}) {
  const initialRow = preferredEvidenceRow(rows, firstProductId)
  const [selectedRowId, setSelectedRowId] = useState(initialRow?.rowId ?? "")
  const selectedRow = rows.find((row) => row.rowId === selectedRowId) ?? initialRow
  const choose = (rowId: string) => setSelectedRowId(rowId)

  return (
    <>
      <section
        className="mt-5 overflow-hidden rounded-2xl border border-border bg-card"
        aria-labelledby="evidence-matrix-title"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
          <h2 id="evidence-matrix-title" className="text-sm font-semibold text-foreground">
            Eigenschaft für Eigenschaft
          </h2>
          <span className="text-[10px] text-muted-foreground">Zeile antippen</span>
        </div>
        <table className="w-full table-fixed border-collapse text-center text-[10px] sm:text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="w-[34%] px-2 py-2 text-left">Prüfpunkt</th>
              <th className="px-1 py-2">{firstLabel}</th>
              <th className="bg-[var(--brand-plum)]/5 px-1 py-2">Ziel</th>
              <th className="bg-[var(--brand-plum)]/5 px-1 py-2">{secondLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const current = valueFor(row, firstProductId)
              const alternative = valueFor(row, secondProductId)
              const relation = current?.relation ?? "unknown"
              const alternativeRelation = alternative?.relation ?? "unknown"
              const selected = row.rowId === selectedRow?.rowId
              return (
                <tr
                  key={row.rowId}
                  className={cn(
                    "border-t border-border",
                    relation === "in_target" && "bg-[var(--status-ok-bg)]/35",
                    relation === "supportive" && "bg-[var(--status-pending-bg)]/35",
                    relation === "outside_target" && "bg-[var(--status-danger-bg)]/35",
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      "break-words border-l-2 border-transparent px-2 py-3 text-left text-[11px] font-semibold leading-tight text-foreground",
                      relation === "in_target" && "border-l-[var(--status-ok-text)]",
                      relation === "supportive" && "border-l-[var(--status-pending-text)]",
                      relation === "outside_target" && "border-l-[var(--status-danger-text)]",
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${row.label} auswählen`}
                      onClick={() => choose(row.rowId)}
                      className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {row.label}
                    </button>
                  </th>
                  <td className="break-words px-1 py-3 text-foreground">
                    <span className="flex items-center gap-1.5 text-left">
                      <span className="min-w-0">{current?.valueLabel ?? "–"}</span>
                      <RelationMark relation={relation} />
                    </span>
                  </td>
                  <td className="break-words bg-[var(--brand-plum)]/5 px-1 py-3 text-[var(--brand-plum)]">
                    {row.target?.valueLabel ?? "kein Ziel"}
                  </td>
                  <td
                    className={cn(
                      "break-words px-1 py-3",
                      alternativeRelation === "in_target" &&
                        "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]",
                      alternativeRelation === "supportive" &&
                        "bg-[var(--status-pending-bg)]/60 text-[var(--status-pending-text)]",
                      alternativeRelation === "outside_target" &&
                        "bg-[var(--status-danger-bg)]/35 text-[var(--status-danger-text)]",
                      (alternativeRelation === "unknown" || alternativeRelation === "no_target") &&
                        "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-left">
                      <span className="min-w-0">{alternative?.valueLabel ?? "–"}</span>
                      <RelationMark relation={alternativeRelation} />
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      {selectedRow ? (
        <SelectedEvidencePanel
          row={selectedRow}
          firstProductId={firstProductId}
          secondProductId={secondProductId}
          firstLabel={firstLabel}
          secondLabel={secondLabel}
        />
      ) : null}
    </>
  )
}

function preferredEvidenceRow(rows: Stage3FitEvidenceRow[], productId?: string) {
  return (
    rows.find((row) => relationFor(row, productId) === "outside_target") ??
    rows.find((row) => relationFor(row, productId) === "supportive") ??
    rows.find((row) => relationFor(row, productId) === "unknown") ??
    rows[0]
  )
}

function evidenceMatrixKey(
  rows: Stage3FitEvidenceRow[],
  firstProductId: string | undefined,
  secondProductId: string,
) {
  return `${firstProductId ?? "none"}:${secondProductId}:${rows
    .map(
      (row) =>
        `${row.rowId}:${relationFor(row, firstProductId)}:${relationFor(row, secondProductId)}`,
    )
    .join("|")}`
}

function RelationMark({ relation }: { relation: Stage3FitEvidenceRelation }) {
  const presentation = relationPresentation(relation)
  const Icon = presentation.Icon
  return (
    <span
      aria-label={presentation.ariaLabel}
      className={cn(
        "ml-auto inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
        presentation.className,
      )}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
    </span>
  )
}

function relationPresentation(relation: Stage3FitEvidenceRelation) {
  switch (relation) {
    case "in_target":
      return {
        ariaLabel: "Im Ziel",
        Icon: Check,
        className: "border-[var(--status-ok-text)] text-[var(--status-ok-text)]",
      }
    case "supportive":
      return {
        ariaLabel: "Passt mit Einschränkung",
        Icon: Minus,
        className: "border-[var(--status-pending-text)] text-[var(--status-pending-text)]",
      }
    case "outside_target":
      return {
        ariaLabel: "Außerhalb des Ziels",
        Icon: X,
        className: "border-[var(--status-danger-text)] text-[var(--status-danger-text)]",
      }
    case "unknown":
      return {
        ariaLabel: "Nicht bestätigt",
        Icon: CircleHelp,
        className: "border-muted-foreground text-muted-foreground",
      }
    case "no_target":
      return {
        ariaLabel: "Kein Zielwert",
        Icon: Minus,
        className: "border-muted-foreground/60 text-muted-foreground",
      }
  }
}

function SelectedEvidencePanel({
  row,
  firstProductId,
  secondProductId,
  firstLabel,
  secondLabel,
}: {
  row: Stage3FitEvidenceRow
  firstProductId?: string
  secondProductId: string
  firstLabel: string
  secondLabel: string
}) {
  const relation = relationFor(row, firstProductId)
  const currentValue = valueFor(row, firstProductId)?.valueLabel ?? "nicht bestätigt"
  const alternativeValue = valueFor(row, secondProductId)?.valueLabel ?? "nicht bestätigt"
  const eyebrow =
    relation === "in_target"
      ? "Im Ziel"
      : relation === "supportive"
        ? "Passt mit Einschränkung"
        : relation === "outside_target"
          ? "Außerhalb des Ziels"
          : relation === "unknown"
            ? "Nicht bestätigt"
            : "Kein Zielwert"
  return (
    <section
      className="mt-3 min-h-28 rounded-2xl border border-[var(--brand-plum)]/35 bg-card p-4"
      aria-live="polite"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--brand-plum)]">
        Ausgewählter Prüfpunkt · {eyebrow}
      </p>
      <h2 className="mt-1 text-base font-semibold text-foreground">{row.label}</h2>
      {row.target ? (
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">{firstLabel}:</strong> {currentValue}.{" "}
            <strong className="text-foreground">{secondLabel}:</strong> {alternativeValue}.{" "}
            <strong className="text-foreground">Ziel:</strong> {row.target.valueLabel}.
          </p>
          <p>
            <strong className="text-foreground">Warum dieses Ziel?</strong> {row.target.rationale}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Für diesen Prüfpunkt gibt es bewusst keinen Zielwert. Wir zeigen nur bestätigte
          Produktwerte.
        </p>
      )}
      {row.target?.profileEvidenceLabels.length ? (
        <p className="mt-2 inline-flex flex-wrap gap-x-1 rounded-md bg-[var(--brand-plum)]/8 px-2 py-1 text-xs text-[var(--brand-plum)]">
          <span className="font-semibold">Aus deinem Profil:</span>
          <span>{row.target.profileEvidenceLabels.join(" · ")}</span>
        </p>
      ) : null}
    </section>
  )
}

function CompactOwnedEvidence({
  rows,
  productId,
}: {
  rows: Stage3FitEvidenceRow[]
  productId: string
}) {
  return (
    <section
      className="mt-4 rounded-2xl border border-border bg-card p-4"
      aria-label="Bestätigte Prüfpunkte"
    >
      <h2 className="text-sm font-semibold text-foreground">Bestätigte Prüfpunkte</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((row) => {
          const value = valueFor(row, productId)
          return (
            <li key={row.rowId} className="flex items-center justify-between gap-3">
              <span>{row.label}</span>
              <span className="flex min-w-32 items-center gap-2 text-muted-foreground">
                <span className="min-w-0">{value?.valueLabel ?? "nicht bestätigt"}</span>
                <RelationMark relation={value?.relation ?? "unknown"} />
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function CompactEvidence({
  evaluation,
  selectedAlternative,
}: {
  evaluation: Stage3AuthorityEvaluation
  selectedAlternative: Stage3SelectedComparisonCandidate | null
}) {
  const criteria =
    selectedAlternative?.criteria ?? (evaluation.status === "known" ? evaluation.criteria : [])
  if (!criteria.length) return null
  return (
    <section
      className="mt-5 rounded-2xl border border-border bg-card p-4"
      aria-label="Verifizierte Produktfakten"
    >
      <h2 className="text-sm font-semibold text-foreground">Warum diese Einordnung?</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {criteria.slice(0, 3).map((criterion) => (
          <li key={criterion.criterionId}>
            <strong className="text-foreground">{criterion.label}:</strong> {criterion.explanation}
          </li>
        ))}
      </ul>
    </section>
  )
}

function CompactRecommendationEvidence({
  first,
  firstLabel,
  second,
  secondLabel,
}: {
  first: Stage3SelectedComparisonCandidate
  firstLabel: string
  second: Stage3SelectedComparisonCandidate | null
  secondLabel: string | null
}) {
  const candidates = [
    { candidate: first, label: firstLabel },
    ...(second ? [{ candidate: second, label: secondLabel ?? "Alternative" }] : []),
  ]
  return (
    <section
      className="mt-5 rounded-2xl border border-border bg-card p-4"
      aria-label="Bestätigte Empfehlungskriterien"
    >
      <h2 className="text-sm font-semibold text-foreground">Warum diese Produkte passen</h2>
      <div className={cn("mt-3 grid gap-4", candidates.length > 1 && "sm:grid-cols-2")}>
        {candidates.map(({ candidate, label }) => (
          <div key={candidate.productId}>
            <h3 className="text-xs font-semibold text-[var(--brand-plum)]">{label}</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {candidate.criteria.slice(0, 3).map((criterion) => (
                <li key={criterion.criterionId}>
                  <strong className="text-foreground">{criterion.label}:</strong>{" "}
                  {criterion.explanation}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
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
    <div className="rounded-2xl border border-[var(--status-danger-text)]/30 bg-card p-5 text-center">
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

function targetCount(rows: Stage3FitEvidenceRow[], currentProductId?: string) {
  if (!currentProductId) return null
  const relations = rows
    .filter((row) => row.target !== null)
    .map((row) => relationFor(row, currentProductId))
  if (!relations.length) return null
  return {
    inTarget: relations.filter((relation) => relation === "in_target").length,
    supportive: relations.filter((relation) => relation === "supportive").length,
    outsideTarget: relations.filter((relation) => relation === "outside_target").length,
    unknown: relations.filter((relation) => relation === "unknown").length,
    noTarget: relations.filter((relation) => relation === "no_target").length,
  }
}

function valueFor(row: Stage3FitEvidenceRow, productId?: string) {
  return productId
    ? (row.productValues.find((value) => value.productId === productId) ?? null)
    : null
}

function relationFor(row: Stage3FitEvidenceRow, productId?: string): Stage3FitEvidenceRelation {
  return valueFor(row, productId)?.relation ?? "unknown"
}

function primaryActionFor({
  evaluation,
  replacementAllowed,
}: {
  evaluation: Stage3AuthorityEvaluation
  replacementAllowed: boolean
}): { kind: ProductFitComparisonAction; label: string } | null {
  const allowed = new Set(evaluation.allowedActions)
  if (evaluation.status === "pending" && replacementAllowed)
    return { kind: "select_replacement", label: "Diese Alternative wählen" }
  if (evaluation.status === "pending" && allowed.has("keep_pending"))
    return { kind: "keep_pending", label: "Auf Analyse warten" }
  if (
    replacementAllowed &&
    (!allowed.has("keep_owned") ||
      (evaluation.status === "known" && evaluation.verdict === "mismatch"))
  )
    return { kind: "select_replacement", label: "Diese Alternative wählen" }
  if (allowed.has("keep_owned")) return { kind: "keep_owned", label: "Mein Produkt behalten" }
  if (replacementAllowed) return { kind: "select_replacement", label: "Diese Alternative wählen" }
  if (allowed.has("leave_uncovered"))
    return { kind: "leave_uncovered", label: "Vorerst ohne Produkt fortfahren" }
  if (allowed.has("acknowledge_override"))
    return { kind: "acknowledge_override", label: "Mein Produkt behalten" }
  return null
}

function quietActionsFor({
  allowedActions,
  selectedAlternative,
  replacementAllowed,
  primaryAction,
}: {
  allowedActions: Set<Stage3AuthorityActionKind>
  selectedAlternative: Stage3SelectedComparisonCandidate | null
  replacementAllowed: boolean
  primaryAction: { kind: ProductFitComparisonAction; label: string } | null
}) {
  const actions: Array<{ kind: ProductFitComparisonAction; label: string }> = []
  if (allowedActions.has("keep_owned") && primaryAction?.kind !== "keep_owned")
    actions.push({ kind: "keep_owned", label: "Mein Produkt trotzdem behalten" })
  if (
    allowedActions.has("acknowledge_override") &&
    !allowedActions.has("keep_owned") &&
    primaryAction?.kind !== "acknowledge_override"
  )
    actions.push({ kind: "acknowledge_override", label: "Mein Produkt trotzdem behalten" })
  if (replacementAllowed && selectedAlternative && primaryAction?.kind !== "select_replacement")
    actions.push({ kind: "select_replacement", label: "Diese Alternative wählen" })
  if (allowedActions.has("keep_pending") && primaryAction?.kind !== "keep_pending")
    actions.push({ kind: "keep_pending", label: "Auf Analyse warten" })
  if (allowedActions.has("leave_uncovered") && primaryAction?.kind !== "leave_uncovered")
    actions.push({ kind: "leave_uncovered", label: "Vorerst ohne Produkt fortfahren" })
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

function normalizeIndex(index: number, length: number) {
  if (length === 0) return 0
  return ((index % length) + length) % length
}
