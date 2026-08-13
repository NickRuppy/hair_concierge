"use client"

import { ArrowLeft, Check, ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react"
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
  const primaryAction = primaryActionFor({ evaluation, replacementAllowed })
  const quietActions = quietActionsFor({
    allowedActions,
    selectedAlternative,
    replacementAllowed,
    primaryAction,
  })
  const hasTruthfulAction = primaryAction !== null || quietActions.length > 0
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
  } else if (!currentProduct && !selectedAlternative) {
    content = <UncoveredReview contextLabel={contextLabel} categoryLabel={categoryLabel} />
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
    <section className="min-w-0 pb-40" aria-labelledby="product-fit-comparison-title">
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
          {quietActions.length > 0 ? (
            <section
              className="mt-5 rounded-2xl border border-border bg-card p-4"
              aria-labelledby="other-decisions-title"
            >
              <h2 id="other-decisions-title" className="text-sm font-semibold text-foreground">
                Andere Möglichkeit
              </h2>
              <div className="mt-2 grid gap-1">
                {quietActions.map((action) => (
                  <Button
                    key={action.kind}
                    type="button"
                    variant="ghost"
                    className="h-auto justify-start whitespace-normal px-2 py-3 text-left text-muted-foreground hover:text-foreground"
                    disabled={disabled}
                    onClick={() => invokeAction(action.kind, selectedAlternative, onAction)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}

          {primaryAction ? (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 py-3 backdrop-blur md:absolute md:inset-x-auto md:bottom-4 md:left-10 md:right-10 md:rounded-2xl md:border">
              <Button
                type="button"
                variant="funnelCta"
                className="h-auto min-h-14 w-full whitespace-normal px-5 py-3 text-center leading-tight"
                disabled={disabled}
                onClick={() => invokeAction(primaryAction.kind, selectedAlternative, onAction)}
                aria-label={primaryAction.label}
              >
                {primaryAction.label}
              </Button>
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
              ? "Alternative · passt teilweise"
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
          rows={comparison.evidenceRows ?? []}
          currentProductId={ownedProductId}
          alternativeProductId={selectedAlternative.productId}
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
            title: `Dein ${categoryLabel || "Produkt"} passt teilweise`,
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

function UncoveredReview({
  contextLabel,
  categoryLabel,
}: {
  contextLabel: string
  categoryLabel: string
}) {
  return (
    <>
      <ReviewHeader
        contextLabel={contextLabel}
        title={`Noch kein ${categoryLabel || "Produkt"}`}
        description="Aktuell ist keine verifizierte Empfehlung verfügbar. Das bedeutet nicht, dass es grundsätzlich kein passendes Produkt gibt."
      />
      <ProductCard product={null} label="Dein Produkt" />
    </>
  )
}

function OverallVerdict({
  evaluation,
  count,
  rows,
  currentProductId,
}: {
  evaluation: Stage3AuthorityEvaluation
  count: { inTarget: number; total: number } | null
  rows: Stage3FitEvidenceRow[]
  currentProductId?: string
}) {
  if (evaluation.status !== "known" || evaluation.verdict === "unknown") return null
  const label =
    evaluation.verdict === "ideal"
      ? "Passt"
      : evaluation.verdict === "supportive"
        ? "Passt teilweise"
        : "Passt nicht"
  const inTargetLabels = rows
    .filter((row) => relationFor(row, currentProductId) === "in_target")
    .map((row) => row.label)
  const outsideTargetLabels = rows
    .filter((row) => relationFor(row, currentProductId) === "outside_target")
    .map((row) => row.label)
  return (
    <div className="mb-4 rounded-xl bg-muted/60 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong className="text-sm text-foreground">{label}</strong>
        {count ? (
          <span className="text-xs text-muted-foreground">
            {count.inTarget} von {count.total} im Ziel
          </span>
        ) : null}
      </div>
      {inTargetLabels.length > 0 || outsideTargetLabels.length > 0 ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {inTargetLabels.length > 0 ? `Im Ziel: ${inTargetLabels.join(", ")}.` : null}{" "}
          {outsideTargetLabels.length > 0 ? `Außerhalb: ${outsideTargetLabels.join(", ")}.` : null}
        </p>
      ) : null}
    </div>
  )
}

function ProductCard({
  product,
  label,
  alternativeVerdict = null,
}: {
  product: ReviewProduct | null
  label: string
  alternativeVerdict?: Stage3SelectedComparisonCandidate["verdict"] | null
}) {
  const idealAlternative = alternativeVerdict === "ideal"
  const supportiveAlternative = alternativeVerdict === "supportive"
  return (
    <article
      className={cn(
        "min-w-0 rounded-2xl border bg-card p-3",
        idealAlternative
          ? "border-[var(--status-ok-text)]/45"
          : supportiveAlternative
            ? "border-[var(--status-pending-text)]/45"
            : "border-[var(--brand-plum)]",
      )}
    >
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
    </article>
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

function EvidenceMatrix({
  rows,
  currentProductId,
  alternativeProductId,
}: {
  rows: Stage3FitEvidenceRow[]
  currentProductId?: string
  alternativeProductId: string
}) {
  const initialRow =
    rows.find((row) => relationFor(row, currentProductId) === "outside_target") ?? rows[0]
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
              <th className="px-1 py-2">Deins</th>
              <th className="bg-[var(--brand-plum)]/5 px-1 py-2">Ziel</th>
              <th className="bg-[var(--brand-plum)]/5 px-1 py-2">Alternative</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const current = valueFor(row, currentProductId)
              const alternative = valueFor(row, alternativeProductId)
              const relation = current?.relation ?? "unknown"
              const alternativeRelation = alternative?.relation ?? "unknown"
              const knownStatus = relation === "in_target" || relation === "outside_target"
              const selected = row.rowId === selectedRow?.rowId
              return (
                <tr
                  key={row.rowId}
                  className={cn(
                    "border-t border-border",
                    relation === "in_target" && "bg-[var(--status-ok-bg)]/35",
                    relation === "outside_target" && "bg-[var(--status-danger-bg)]/35",
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      "break-words border-l-2 border-transparent px-2 py-3 text-left text-[11px] font-semibold leading-tight text-foreground",
                      relation === "in_target" && "border-l-[var(--status-ok-text)]",
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
                    <span className="grid justify-items-center gap-1">
                      {current?.valueLabel ?? "–"}
                      {knownStatus ? <RelationMark relation={relation} /> : null}
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
                      alternativeRelation === "outside_target" &&
                        "bg-[var(--status-danger-bg)]/35 text-[var(--status-danger-text)]",
                      (alternativeRelation === "unknown" || alternativeRelation === "no_target") &&
                        "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <span className="grid justify-items-center gap-1">
                      {alternative?.valueLabel ?? "–"}
                      {alternativeRelation === "in_target" ||
                      alternativeRelation === "outside_target" ? (
                        <RelationMark relation={alternativeRelation} />
                      ) : null}
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
          currentProductId={currentProductId}
          alternativeProductId={alternativeProductId}
        />
      ) : null}
    </>
  )
}

function RelationMark({ relation }: { relation: Stage3FitEvidenceRelation }) {
  const inTarget = relation === "in_target"
  const Icon = inTarget ? Check : X
  return (
    <span
      aria-label={inTarget ? "Im Ziel" : "Außerhalb des Ziels"}
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded-full border",
        inTarget
          ? "border-[var(--status-ok-text)] text-[var(--status-ok-text)]"
          : "border-[var(--status-danger-text)] text-[var(--status-danger-text)]",
      )}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
    </span>
  )
}

function SelectedEvidencePanel({
  row,
  currentProductId,
  alternativeProductId,
}: {
  row: Stage3FitEvidenceRow
  currentProductId?: string
  alternativeProductId: string
}) {
  const relation = relationFor(row, currentProductId)
  const currentValue = valueFor(row, currentProductId)?.valueLabel ?? "nicht bestätigt"
  const alternativeValue = valueFor(row, alternativeProductId)?.valueLabel ?? "nicht bestätigt"
  const eyebrow =
    relation === "in_target"
      ? "Im Ziel"
      : relation === "outside_target"
        ? "Außerhalb des Ziels"
        : "Noch nicht beurteilbar"
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
            <strong className="text-foreground">Deins:</strong> {currentValue}.{" "}
            <strong className="text-foreground">Alternative:</strong> {alternativeValue}.{" "}
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
              <span className="flex items-center gap-2 text-muted-foreground">
                {value?.valueLabel ?? "nicht bestätigt"}
                {value?.relation === "in_target" || value?.relation === "outside_target" ? (
                  <RelationMark relation={value.relation} />
                ) : null}
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
  if (
    !relations.length ||
    relations.some((relation) => relation === "unknown" || relation === "no_target")
  )
    return null
  return {
    inTarget: relations.filter((relation) => relation === "in_target").length,
    total: relations.length,
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
