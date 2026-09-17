"use client"

import { useState } from "react"

import { ChevronDown } from "lucide-react"

import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { ScanUnknownProductResult } from "@/lib/scan/types"
import {
  SCAN_UNKNOWN_BRIDGE,
  SCAN_UNKNOWN_HEADLINE,
  SCAN_UNKNOWN_QUESTION,
  SCAN_UNKNOWN_SUBLINE,
  SCAN_UNKNOWN_IDENTIFIED_HEADLINE,
  SCAN_UNKNOWN_IDENTIFIED_SUBLINE,
  SCAN_UNKNOWN_CONFIRM_QUESTION,
  SCAN_UNKNOWN_CONFIRM_CTA,
  SCAN_UNKNOWN_CONFIRM_OTHER,
  scanRetailerBrandLabel,
} from "@/lib/scan/verdict-labels"
import { cn } from "@/lib/utils"
import { ScanProductThumb } from "./scan-product-thumb"

/**
 * Unknown-product intake (success-first, one tap — copy sign-off 2026-09-01): a single
 * step whose only question is the shelf category. Tapping a card submits immediately —
 * there is no brand/product-name step. The barcode plus category is everything the
 * research queue needs; asking for more would only cost taps (product ruling,
 * plans/scan-public-launch.md Task 9).
 */

/** The five most-scanned shelf categories stay visible; the rest sit behind the expander. */
const PRIMARY_CATEGORIES: PersonalPlanCategory[] = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
]

export type ScanSubmissionInput = {
  category: PersonalPlanCategory
}

export function ScanUnknownFlow({
  unknown,
  submitting,
  error,
  onSubmit,
}: {
  unknown: ScanUnknownProductResult
  submitting: boolean
  error: string | null
  onSubmit: (input: ScanSubmissionInput, selectionPath?: "one_tap" | "grid") => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [showCategoryGrid, setShowCategoryGrid] = useState(false)
  // Tracks which card was tapped so only that one swaps its label to the submitting
  // state; `submitting` (parent-owned) still gates every card against a second tap.
  const [tappedCategory, setTappedCategory] = useState<PersonalPlanCategory | null>(null)

  const identified = unknown.identified
  const suggestion = unknown.categories.find((entry) => entry.key === identified?.suggestedCategory)
  const showConfirmation = Boolean(suggestion) && !showCategoryGrid
  const categories = unknown.categories.filter(
    (entry) => !showCategoryGrid || entry.key !== suggestion?.key,
  )
  const primary = categories.filter((entry) => PRIMARY_CATEGORIES.includes(entry.key))
  const rest = categories.filter((entry) => !PRIMARY_CATEGORIES.includes(entry.key))
  const visible = showAll ? [...primary, ...rest] : primary

  const handleTap = (
    category: PersonalPlanCategory,
    selectionPath: "one_tap" | "grid" = "grid",
  ) => {
    if (submitting) return
    setTappedCategory(category)
    onSubmit({ category }, selectionPath)
  }

  return (
    <div className="flex flex-col gap-4">
      {identified ? (
        <div className="flex items-center gap-3 pr-10">
          <ScanProductThumb
            imageUrl={identified.imageUrl}
            label={identified.productName}
            size={48}
            proxied
          />
          <div className="min-w-0">
            <p className="text-[15px] font-bold leading-5 text-foreground">
              {identified.productName}
            </p>
            {identified.brand ? (
              <p className="mt-0.5 text-[13px] leading-[18px] text-[var(--text-sub)]">
                {scanRetailerBrandLabel(identified.brand)}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div>
        <h2 className="font-header text-2xl leading-tight text-foreground">
          {identified ? SCAN_UNKNOWN_IDENTIFIED_HEADLINE : SCAN_UNKNOWN_HEADLINE}
        </h2>
        {!identified ? (
          <p className="mt-2 text-sm leading-6 text-foreground">{SCAN_UNKNOWN_BRIDGE}</p>
        ) : null}
        <p className="mt-1 text-sm leading-6 text-[var(--text-sub)]">
          {identified ? SCAN_UNKNOWN_IDENTIFIED_SUBLINE : SCAN_UNKNOWN_SUBLINE}
        </p>
      </div>

      <p className="text-[15px] font-semibold leading-6 text-foreground">
        {showConfirmation && suggestion
          ? SCAN_UNKNOWN_CONFIRM_QUESTION(suggestion.label)
          : SCAN_UNKNOWN_QUESTION}
      </p>

      {showConfirmation && suggestion ? (
        <div className="grid gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleTap(suggestion.key, "one_tap")}
            className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-[var(--brand-coral)] px-4 text-base font-bold text-white transition-colors hover:bg-[var(--brand-coral-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Wird eingereicht" : SCAN_UNKNOWN_CONFIRM_CTA(suggestion.label)}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              if (!submitting) setShowCategoryGrid(true)
            }}
            className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-[var(--brand-plum)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {SCAN_UNKNOWN_CONFIRM_OTHER}
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          {visible.map((entry) => {
            // Derived, not remembered: once the request has settled no card is "the one
            // being submitted" any more. Keeping the raw `tappedCategory` here left a
            // failed attempt highlighted and labelled as in flight next to its error (F17).
            const isTapped = tappedCategory === entry.key && submitting
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => handleTap(entry.key)}
                disabled={submitting}
                aria-pressed={isTapped}
                className={cn(
                  "flex min-h-[56px] items-center rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed",
                  isTapped
                    ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                    : "border-border bg-card hover:border-[var(--brand-plum)]/40",
                  submitting && !isTapped ? "opacity-60" : null,
                )}
              >
                <span className="block text-[17px] font-bold text-foreground">
                  {isTapped ? "Wird eingereicht" : entry.label}
                </span>
              </button>
            )
          })}
          {!showAll && rest.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              disabled={submitting}
              className="flex min-h-[56px] items-center justify-between rounded-xl border border-dashed border-[var(--brand-plum-light)] p-3 text-left text-[15px] font-semibold text-[var(--brand-plum)] transition-colors hover:border-[var(--brand-plum)] disabled:cursor-not-allowed"
            >
              <span>Weitere Produktarten</span>
              <ChevronDown className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      )}

      <p className="text-center text-xs tabular-nums text-muted-foreground">
        Barcode {unknown.identifier.value}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-[var(--brand-coral-dark)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
