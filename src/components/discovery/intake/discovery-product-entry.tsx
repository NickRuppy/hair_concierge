"use client"

import { ChevronLeft, Search, X } from "lucide-react"
import { useState } from "react"

import { Scanner, type ScanDecodedIdentifier, type ScannerRuntime } from "@/components/scan/scanner"
import { ScanProductThumb } from "@/components/scan/scan-product-thumb"
import { ScanSearchSheet, type ScanResearchIntakeInput } from "@/components/scan/scan-search-sheet"
import type { ScanSearchResult } from "@/app/api/scan/search/route"
import type { ScanRetailerResult } from "@/app/api/scan/search-retailer/route"

import type { DiscoveryIntakeCategoryCopy } from "./categories"
import {
  addIntakeItem,
  identifyBarcode,
  removeIntakeItem,
  submitProductForResearch,
} from "./intake-api"
import type { DiscoveryIntakeCaptureInput, DiscoveryIntakeItemView } from "./types"

/**
 * One category of the checklist (mockup frames B and C).
 *
 * Every entry path ends in the same place — one `discovery_intake_items` row —
 * but they reach it differently, and which one was used is what the cockpit
 * later reads out of `source`:
 *
 *   Barcode   -> `POST /api/beratung/identify`. A catalog hit is `barcode`; a
 *                miss opens a research submission and is stored as
 *                `barcode_unknown`, identified by the barcode itself.
 *   Suchen    -> the SHARED `ScanSearchSheet`. A catalog row is `catalog_search`,
 *                a dm row is `dm_search`, „Nicht dabei" is `name_research`. The
 *                last two go through `POST /api/scan/submit` first, and either of
 *                its outcomes (already catalogued, or a pending submission)
 *                becomes the item's identity.
 *   Benutze
 *   ich nicht  -> `none`, the explicit empty answer — a terminal one, so it
 *                returns to the overview instead of leaving an empty screen.
 *
 * The scanner, the sheet and its research form are reused as they are: the sheet
 * gained two ADDITIVE optional props (`onSelectProductResult`,
 * `onSelectRetailerResultRow`) so this screen can store the participant's own
 * wording for a product without re-fetching the row it just displayed.
 */

const GENERIC_ERROR = "Das hat gerade nicht geklappt. Versuch es nochmal."
const CAMERA_ERROR = "Die Kamera geht hier nicht. Tipp den Namen ein."
const SCAN_LABEL = "Barcode scannen"
const SEARCH_LABEL = "Produkt suchen"
const NONE_LABEL = "Benutze ich nicht"
const NONE_CONFIRMED_LABEL = "Benutzt du nicht."
const ADD_MORE_LABEL = "+ Noch eins"
const DONE_LABEL = "Fertig"
const CANCEL_LABEL = "Abbrechen"
const UNNAMED_PRODUCT = "Gescanntes Produkt"

function BarcodeGlyph() {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" aria-hidden="true" className="shrink-0">
      <g fill="currentColor">
        <rect x="0" y="1" width="2" height="16" rx="0.6" />
        <rect x="3.5" y="1" width="1" height="16" rx="0.4" />
        <rect x="6" y="1" width="2.5" height="16" rx="0.6" />
        <rect x="10" y="1" width="1" height="16" rx="0.4" />
        <rect x="12.5" y="1" width="2" height="16" rx="0.6" />
        <rect x="16" y="1" width="1" height="16" rx="0.4" />
        <rect x="18.5" y="1" width="1.5" height="16" rx="0.5" />
      </g>
    </svg>
  )
}

/** A captured row always has SOMETHING to show — a name, or the barcode it was read from. */
export function itemDisplayName(item: DiscoveryIntakeItemView): string {
  return item.productNameText ?? UNNAMED_PRODUCT
}

export function itemDisplaySubline(item: DiscoveryIntakeItemView): string | null {
  return item.brandText ?? item.barcodeIdentifier
}

export function DiscoveryProductEntry({
  category,
  items,
  retailerSearchEnabled,
  onAdded,
  onRemoved,
  onBack,
  scannerRuntime,
}: {
  category: DiscoveryIntakeCategoryCopy
  items: DiscoveryIntakeItemView[]
  retailerSearchEnabled: boolean
  onAdded: (item: DiscoveryIntakeItemView) => void
  onRemoved: (itemId: string) => void
  onBack: () => void
  /** Camera/detector seam handed to `<Scanner>`; production leaves it undefined. */
  scannerRuntime?: ScannerRuntime
}) {
  const [scanning, setScanning] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraBlocked, setCameraBlocked] = useState(false)
  const [entryOpen, setEntryOpen] = useState(false)

  const products = items.filter((item) => item.source !== "none")
  const answeredNone = items.some((item) => item.source === "none")
  const showEntry = products.length === 0 || entryOpen

  async function capture(build: () => Promise<DiscoveryIntakeCaptureInput>): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    setError(null)
    try {
      onAdded(await addIntakeItem(category.key, await build()))
      setSheetOpen(false)
      setScanning(false)
      setEntryOpen(false)
      return true
    } catch {
      setError(GENERIC_ERROR)
      return false
    } finally {
      setBusy(false)
    }
  }

  function handleDecoded(identifier: ScanDecodedIdentifier): boolean {
    // The loop re-offers the same read while this is false, so a decode that
    // arrives mid-write is simply not consumed yet.
    if (busy) return false
    void capture(async () => {
      const identity = await identifyBarcode(identifier.value)
      if (identity.kind === "catalog") {
        return {
          source: "barcode",
          productId: identity.productId,
          barcodeIdentifier: identifier.value,
          brandText: identity.brand,
          productNameText: identity.name,
        }
      }
      // Unknown to the catalog: open the research submission a reviewer later
      // picks up. The barcode stays the row's identity either way.
      const outcome = await submitProductForResearch({
        category: category.key,
        identifier: identifier.value,
      })
      return {
        source: "barcode_unknown",
        barcodeIdentifier: identifier.value,
        ...(outcome.kind === "already_in_catalog"
          ? { productId: outcome.productId }
          : { productSubmissionId: outcome.submissionId }),
      }
    })
    return true
  }

  function handleCatalogResult(result: ScanSearchResult) {
    void capture(async () => ({
      source: "catalog_search",
      productId: result.id,
      brandText: result.brand,
      productNameText: result.name,
    }))
  }

  function handleRetailerResult(result: ScanRetailerResult) {
    void capture(async () => {
      const outcome = await submitProductForResearch({
        category: category.key,
        identifier: result.gtin,
        ...(result.brand ? { brandText: result.brand } : {}),
        productNameText: result.name,
      })
      return {
        source: "dm_search",
        barcodeIdentifier: result.gtin,
        brandText: result.brand,
        productNameText: result.name,
        ...(outcome.kind === "already_in_catalog"
          ? { productId: outcome.productId }
          : { productSubmissionId: outcome.submissionId }),
      }
    })
  }

  function handleResearchIntake(input: ScanResearchIntakeInput) {
    void capture(async () => {
      // The sheet's own form asks what the product is — that answer belongs to
      // the RESEARCH submission (it is what a reviewer will catalogue it as).
      // The checklist row stays under the category the participant opened, which
      // is the shelf slot they are filling.
      const outcome = await submitProductForResearch({
        category: input.category,
        brandText: input.brandText,
        productNameText: input.productNameText,
      })
      return {
        source: "name_research",
        brandText: input.brandText,
        productNameText: input.productNameText,
        ...(outcome.kind === "already_in_catalog"
          ? { productId: outcome.productId }
          : { productSubmissionId: outcome.submissionId }),
      }
    })
  }

  function handleNone() {
    void capture(async () => ({ source: "none" })).then((stored) => {
      if (stored) onBack()
    })
  }

  async function handleRemove(itemId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await removeIntakeItem(itemId)
      onRemoved(itemId)
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#fbf9f7]">
      <div className="flex flex-1 flex-col px-5 pb-6 pt-7">
        <div className="mb-6 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Zurück zur Übersicht"
            className="-ml-3 flex h-11 w-11 items-center justify-center rounded-full text-[var(--brand-plum)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="text-[13px] font-semibold tracking-[0.02em] text-[var(--text-sub)]">
            {category.label}
          </span>
        </div>

        <h1 className="font-header text-2xl leading-tight text-[var(--brand-plum-darkest)]">
          {products.length > 0
            ? `${category.possessive} ${category.label}`
            : `${category.interrogative} ${category.label} benutzt du?`}
        </h1>
        <p className="mb-5 mt-1.5 text-sm leading-6 text-[var(--text-sub)]">
          {products.length > 0 ? "Mehrere sind okay." : "Barcode ist am schnellsten."}
        </p>

        {products.length > 0 ? (
          <ul className="mb-3 flex flex-col gap-2">
            {products.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-[14px] border border-[var(--brand-plum-light)] bg-white px-3 py-2.5"
              >
                <ScanProductThumb imageUrl={null} label={itemDisplayName(item)} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--brand-plum-darkest)]">
                    {itemDisplayName(item)}
                  </span>
                  {itemDisplaySubline(item) ? (
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-caption)]">
                      {itemDisplaySubline(item)}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => void handleRemove(item.id)}
                  disabled={busy}
                  aria-label={`${itemDisplayName(item)} entfernen`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-sub)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-50"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {products.length > 0 && !entryOpen ? (
          <button
            type="button"
            onClick={() => setEntryOpen(true)}
            className="min-h-[48px] w-full rounded-[14px] border border-dashed border-[var(--brand-plum-light)] text-sm font-semibold text-[var(--brand-plum)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
          >
            {ADD_MORE_LABEL}
          </button>
        ) : null}

        {showEntry ? (
          <>
            {scanning && !cameraBlocked ? (
              <div>
                <div className="overflow-hidden rounded-[18px]">
                  <Scanner
                    active
                    runtime={scannerRuntime}
                    detectionPaused={busy || sheetOpen}
                    onDecoded={handleDecoded}
                    onUnavailable={() => {
                      setCameraBlocked(true)
                      setScanning(false)
                    }}
                    onTimeout={() => undefined}
                    onStalled={() => {
                      setCameraBlocked(true)
                      setScanning(false)
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setScanning(false)}
                  className="mt-3 min-h-[48px] w-full rounded-[14px] border border-border text-sm font-semibold text-[var(--text-sub)]"
                >
                  {CANCEL_LABEL}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setScanning(true)
                }}
                disabled={cameraBlocked || busy}
                className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-[16px] border-[1.5px] border-[var(--brand-plum)] bg-white text-base font-semibold text-[var(--brand-plum-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <BarcodeGlyph />
                {SCAN_LABEL}
              </button>
            )}

            {cameraBlocked ? (
              <p className="mt-2 text-center text-xs leading-5 text-[var(--text-sub)]">
                {CAMERA_ERROR}
              </p>
            ) : null}

            <div className="my-4 flex items-center gap-3 text-xs text-[var(--text-caption)]">
              <span className="h-px flex-1 bg-border" />
              oder
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              disabled={busy}
              className="flex min-h-[52px] w-full items-center gap-2.5 rounded-[14px] border border-[var(--brand-plum-light)] bg-white px-3.5 text-left text-[15px] text-[var(--text-sub)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <Search className="h-4 w-4 shrink-0 text-[var(--brand-plum)]" aria-hidden="true" />
              {SEARCH_LABEL}
            </button>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-center text-sm text-[var(--brand-coral-dark)]">
            {error}
          </p>
        ) : null}

        {products.length > 0 ? (
          // With products on screen „benutze ich nicht" is the competing answer,
          // so it is an option, not a link — choosing it replaces them.
          <button
            type="button"
            onClick={handleNone}
            disabled={busy}
            className="mt-2 flex min-h-[52px] w-full items-center gap-3 rounded-[14px] border border-border bg-white px-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-50"
          >
            <span className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-border" />
            <span className="text-[15px] text-[var(--text-sub)]">{NONE_LABEL}</span>
          </button>
        ) : answeredNone ? (
          <p className="mt-auto pt-6 text-center text-sm font-semibold text-[var(--brand-plum)]">
            {NONE_CONFIRMED_LABEL}
          </p>
        ) : (
          // Empty state: a quiet link, never a second loud button competing with
          // the scanner — and never a dead CTA.
          <div className="mt-auto pt-6 text-center">
            <button
              type="button"
              onClick={handleNone}
              disabled={busy}
              className="min-h-[44px] px-2 text-sm font-semibold text-[var(--text-caption)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-50"
            >
              {NONE_LABEL}
            </button>
          </div>
        )}
      </div>

      {products.length > 0 ? (
        <div className="sticky bottom-0 bg-[#fbf9f7] px-5 pb-6 pt-3.5">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[54px] w-full rounded-full bg-[var(--brand-coral)] text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
          >
            {DONE_LABEL}
          </button>
        </div>
      ) : null}

      <ScanSearchSheet
        open={sheetOpen}
        reason="manual"
        onOpenChange={setSheetOpen}
        // The checklist consumes the WHOLE row (`onSelectProductResult` /
        // `onSelectRetailerResultRow`) because it stores the displayed name and
        // brand next to the id; the id-only callbacks are the sheet's existing
        // contract and stay wired to nothing here.
        onSelectProduct={() => undefined}
        onSelectProductResult={handleCatalogResult}
        onSelectRetailerResultRow={handleRetailerResult}
        onStartResearchIntake={() => setError(null)}
        onSubmitResearchIntake={handleResearchIntake}
        submitting={busy}
        submitError={error}
        retailerSearchEnabled={retailerSearchEnabled}
      />
    </div>
  )
}
