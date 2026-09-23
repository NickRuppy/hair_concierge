"use client"

import { ExternalLink } from "lucide-react"

import {
  scanAlternativeMetaLine,
  scanCriterionMarker,
  scanNotNeededSections,
  scanReasonsLabel,
} from "@/lib/scan/result-presentation"
import type {
  ScanAlternativePresentation,
  ScanInCatalogVerdictPayload,
  ScanNotNeededVerdictPayload,
  ScanProductHeader,
  ScanStatusToken,
} from "@/lib/scan/types"
import type { Stage3CriterionResult } from "@/lib/personal-plan/products/contracts"
import { cn } from "@/lib/utils"

import { ScanDimensionBar } from "./scan-dimension-bar"
import { ScanProductThumb } from "./scan-product-thumb"
import { SCAN_MARKER_CLASS, SCAN_STATUS_CLASS } from "./scan-status-tokens"

/**
 * The verdict body of the scan sheet (UI spec §2), minus the alternatives block and the
 * re-scan link: product header, state-coloured banner, bars or criterion rows, the
 * "Warum"-block and the `not_needed` sections.
 *
 * Extracted from `ScanResultCard` so the discovery-call cockpit can show a participant's
 * product exactly as their own scanner would, without importing the scan sheet's
 * interaction model (reveal CTA, buy links, "Nochmal scannen"). Two rules keep that split
 * honest:
 *
 *  - **`ScanVerdictSections` returns a FRAGMENT, never a wrapper element.** The card's root
 *    is a `flex flex-col gap-4` column whose gap applies to its DIRECT children; a wrapper
 *    here would collapse every section into one gap slot. `tests/scan-result-card-parity.test.tsx`
 *    compares the card's rendered markup against a golden captured before this extraction.
 *  - **Nothing here decides anything about a product.** Every sentence comes from the
 *    payload; this file owns fixed section chrome only.
 */

const STATUS_CLASS = SCAN_STATUS_CLASS
const MARKER_CLASS = SCAN_MARKER_CLASS

/**
 * Fixed reassurance for a verdict that can change with the profile behind it. Not
 * user-specific, so it is UI chrome rather than payload copy.
 */
const GOOD_TO_KNOW_TITLE = "Gut zu wissen"
const GOOD_TO_KNOW_BODY = "Ändert sich dein Haar oder deine Routine, prüfen wir das für dich neu."

/**
 * What the sections need: a verdict payload of either kind plus the scanned product.
 * Deliberately written over the shared payload types rather than over
 * `ScanResolvedVerdictResult`, so the masked free-tier shape and the cockpit's
 * `ScanPresentedVerdictPayload` (which has neither `savedState` nor a masking marker) both
 * fit without either surface widening its own contract.
 */
export type ScanVerdictSectionsPayload =
  | (Omit<ScanInCatalogVerdictPayload, "alternatives" | "mobileDimensions" | "mobileAuthority"> & {
      product: ScanProductHeader
    })
  | (ScanNotNeededVerdictPayload & { product: ScanProductHeader })

export function ScanVerdictSections({
  result,
  productTitle,
}: {
  result: ScanVerdictSectionsPayload
  /**
   * Optional heading override for the product header. The scan feature never passes it
   * (its header stays `product.name` over „brand · category"); the discovery cockpit
   * passes its composed brand + line + name label so cockpit and PDF name a product alike.
   */
  productTitle?: string
}) {
  const sections =
    result.kind === "not_needed"
      ? scanNotNeededSections(result)
      : { reasons: false, goodToKnow: false, coveredBy: false }

  return (
    <>
      <ProductHeader product={result.product} title={productTitle} />

      {result.kind === "in_catalog" ? (
        <Banner status={result.status} title={result.verdictTitle} subtitle={result.subtitle} />
      ) : (
        <Banner status={result.status} title={result.headline} subtitle={result.subtitle} />
      )}

      {result.dimensions.length > 0 ? (
        <section className="divide-y divide-border rounded-[14px] border border-border bg-card px-4 py-1">
          {result.dimensions.map((dimension) => (
            <ScanDimensionBar key={dimension.dimensionId} dimension={dimension} />
          ))}
        </section>
      ) : null}

      {result.kind === "in_catalog" &&
      result.dimensions.length === 0 &&
      result.criteria.length > 0 ? (
        <CriterionRows criteria={result.criteria} />
      ) : null}

      {result.kind === "in_catalog" && result.fitNarrative ? (
        <WhyCard label={scanReasonsLabel({ kind: "in_catalog", verdict: result.verdict })}>
          <p className="text-sm leading-6 text-foreground">{result.fitNarrative.fit}</p>
          <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
            {result.fitNarrative.productCriteria}
          </p>
        </WhyCard>
      ) : null}

      {result.kind === "not_needed" && sections.reasons ? (
        <WhyCard
          label={scanReasonsLabel({
            kind: "not_needed",
            mode: result.mode,
            category: result.product.category,
          })}
        >
          <ul className="flex flex-col gap-2">
            {result.reasons.map((reason) => (
              <li key={reason} className="text-sm leading-6 text-foreground">
                {reason}
              </li>
            ))}
          </ul>
        </WhyCard>
      ) : null}

      {result.kind === "not_needed" && sections.goodToKnow ? (
        <section className="rounded-[14px] bg-muted px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {GOOD_TO_KNOW_TITLE}
          </p>
          <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">{GOOD_TO_KNOW_BODY}</p>
        </section>
      ) : null}

      {result.kind === "not_needed" && sections.coveredBy ? (
        <CoveredBy entries={result.coveredBy} />
      ) : null}
    </>
  )
}

function ProductHeader({ product, title }: { product: ScanProductHeader; title?: string }) {
  return (
    // pr-9 keeps the title clear of the sheet's absolute close button (right-3, 40px).
    <div className="flex items-center gap-3 pr-9">
      <ScanProductThumb imageUrl={product.imageUrl} label={product.name} size={48} />
      <div className="min-w-0">
        <h2 className="break-words text-[15px] font-bold leading-snug text-foreground">
          {title ?? product.name}
        </h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {/* A composed title already names the brand. */}
          {product.brand && !title ? `${product.brand} · ` : ""}
          <span className="font-semibold text-[var(--brand-plum)]">{product.categoryLabel}</span>
        </p>
      </div>
    </div>
  )
}

function Banner({
  status,
  title,
  subtitle,
}: {
  status: ScanStatusToken
  title: string
  subtitle: string
}) {
  return (
    <div className={cn("rounded-[14px] px-4 py-3.5", STATUS_CLASS[status])}>
      <p className="text-[17px] font-bold leading-snug">{title}</p>
      <p className="mt-1 text-[13px] leading-5 opacity-90">{subtitle}</p>
    </div>
  )
}

function WhyCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] bg-[var(--brand-plum-ice)] px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--brand-plum)]">
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function CriterionRows({ criteria }: { criteria: Stage3CriterionResult[] }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-card px-4 py-3.5">
      {criteria.map((criterion) => {
        const marker = scanCriterionMarker(criterion.result)
        return (
          <div key={criterion.criterionId} className="flex gap-2.5">
            <span
              aria-hidden="true"
              className={cn("mt-0.5 shrink-0 text-sm font-bold", MARKER_CLASS[marker.tone])}
            >
              {marker.marker}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">{criterion.label}</p>
              <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                {criterion.explanation}
              </p>
            </div>
          </div>
        )
      })}
    </section>
  )
}

function CoveredBy({ entries }: { entries: Array<{ label: string; detail: string | null }> }) {
  return (
    <section>
      {/* Inline lead-in sentence, not a standalone header like "Passende Alternativen"
          above it (copy sign-off 2026-09-01, reverting the earlier header deviation) —
          the colon reads straight into the covering entries below. */}
      <p className="mb-2 text-[13px] leading-5 text-muted-foreground">Das übernimmt bei dir:</p>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={`${entry.label}|${entry.detail}`}
            className="rounded-[12px] border border-border bg-card px-3 py-2.5"
          >
            <p className="text-[13px] font-semibold text-foreground">{entry.label}</p>
            {entry.detail ? (
              <p className="mt-0.5 text-[12px] text-muted-foreground">{entry.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The "Passende Alternativen" list.
 *
 * `onOpen`/`onBuy` are optional: with them the row opens the alternative and the price
 * link fires the buy event, exactly as the scan sheet has always done. Without them the
 * rows render as plain text and the purchase link is omitted entirely — the read-only
 * shape the cockpit and the call PDF need, where an alternative is something Nick reads
 * out, not something to tap.
 */
export function ScanAlternativesList({
  alternatives,
  onOpen,
  onBuy,
}: {
  alternatives: ScanAlternativePresentation[]
  onOpen?: (productId: string) => void
  onBuy?: (productId: string) => void
}) {
  return (
    <section>
      <p className="mb-2 text-[13px] font-bold text-foreground">Passende Alternativen</p>
      <ul className="flex flex-col gap-2">
        {alternatives.map((alternative) => {
          const meta = scanAlternativeMetaLine(alternative)
          const identity = (
            <>
              <ScanProductThumb
                imageUrl={alternative.imageUrl}
                label={alternative.displayName}
                size={40}
              />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-foreground">
                  {alternative.displayName}
                </span>
                {meta ? (
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">{meta}</span>
                ) : null}
              </span>
            </>
          )
          return (
            <li
              key={alternative.productId}
              className="flex items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5"
            >
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(alternative.productId)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
                >
                  {identity}
                </button>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-3 text-left">{identity}</span>
              )}
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    STATUS_CLASS[alternative.verdict === "ideal" ? "ok" : "pending"],
                  )}
                >
                  {alternative.verdictLabel}
                </span>
                {onBuy && alternative.purchaseUrl ? (
                  <a
                    href={alternative.purchaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onBuy(alternative.productId)}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--brand-coral-dark)] underline-offset-4 hover:underline"
                  >
                    Kaufen
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
