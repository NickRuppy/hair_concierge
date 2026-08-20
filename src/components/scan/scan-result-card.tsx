"use client"

import { ExternalLink } from "lucide-react"

import {
  scanAlternativeMetaLine,
  scanCriterionMarker,
  scanReasonsLabel,
} from "@/lib/scan/result-presentation"
import type {
  ScanAlternativePresentation,
  ScanProductHeader,
  ScanResolvedVerdictResult,
  ScanStatusToken,
} from "@/lib/scan/types"
import type { Stage3CriterionResult } from "@/lib/personal-plan/products/contracts"
import { cn } from "@/lib/utils"

import { ScanDimensionBar } from "./scan-dimension-bar"
import { ScanProductThumb } from "./scan-product-thumb"

/**
 * The scan verdict body (UI spec §2). Same anatomy in every verdict: product header,
 * state-coloured banner, bars, "Warum"-block, alternatives (or what already covers the
 * job), quiet re-scan link. Every sentence about the user comes from the payload —
 * this file only owns fixed section chrome.
 */

const STATUS_CLASS: Record<ScanStatusToken, string> = {
  ok: "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
}

const MARKER_CLASS: Record<ScanStatusToken, string> = {
  ok: "text-[var(--status-ok-text)]",
  pending: "text-[var(--status-pending-text)]",
  danger: "text-[var(--status-danger-text)]",
  neutral: "text-muted-foreground",
}

/**
 * Fixed reassurance for a verdict that can change with the profile behind it. Not
 * user-specific, so it is UI chrome rather than payload copy.
 */
const GOOD_TO_KNOW_TITLE = "Gut zu wissen"
const GOOD_TO_KNOW_BODY = "Ändert sich dein Haar oder deine Routine, prüfen wir das für dich neu."

export function ScanResultCard({
  result,
  onRescan,
  onOpenAlternative,
}: {
  result: ScanResolvedVerdictResult
  onRescan: () => void
  onOpenAlternative: (productId: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <ProductHeader product={result.product} />

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

      {result.kind === "not_needed" && result.reasons.length > 0 ? (
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

      {result.kind === "not_needed" ? (
        <section className="rounded-[14px] bg-muted px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {GOOD_TO_KNOW_TITLE}
          </p>
          <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">{GOOD_TO_KNOW_BODY}</p>
        </section>
      ) : null}

      {result.kind === "not_needed" && result.coveredBy.length > 0 ? (
        <CoveredBy entries={result.coveredBy} />
      ) : null}

      {result.kind === "in_catalog" && result.alternatives.length > 0 ? (
        <Alternatives alternatives={result.alternatives} onOpen={onOpenAlternative} />
      ) : null}

      <button
        type="button"
        onClick={onRescan}
        className="min-h-[44px] self-center text-sm font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
      >
        Nochmal scannen
      </button>
    </div>
  )
}

function ProductHeader({ product }: { product: ScanProductHeader }) {
  return (
    <div className="flex items-center gap-3">
      <ScanProductThumb imageUrl={product.imageUrl} label={product.name} size={48} />
      <div className="min-w-0">
        <h2 className="break-words text-[15px] font-bold leading-snug text-foreground">
          {product.name}
        </h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {product.brand ? `${product.brand} · ` : ""}
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
      <p className="mb-2 text-[13px] font-bold text-foreground">Das übernimmt bei dir</p>
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

function Alternatives({
  alternatives,
  onOpen,
}: {
  alternatives: ScanAlternativePresentation[]
  onOpen: (productId: string) => void
}) {
  return (
    <section>
      <p className="mb-2 text-[13px] font-bold text-foreground">Passende Alternativen</p>
      <ul className="flex flex-col gap-2">
        {alternatives.map((alternative) => {
          const meta = scanAlternativeMetaLine(alternative)
          return (
            <li
              key={alternative.productId}
              className="flex items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => onOpen(alternative.productId)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
              >
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
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    STATUS_CLASS[alternative.verdict === "ideal" ? "ok" : "pending"],
                  )}
                >
                  {alternative.verdictLabel}
                </span>
                {alternative.purchaseUrl ? (
                  <a
                    href={alternative.purchaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
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
