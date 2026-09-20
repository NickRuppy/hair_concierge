"use client"

import { ArrowRight, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { ScanSearchResult } from "@/app/api/scan/search/route"
import type {
  ScanRetailerResult,
  ScanRetailerSearchResponse,
} from "@/app/api/scan/search-retailer/route"
import { cn } from "@/lib/utils"

import { useLatestRequest } from "@/lib/scan/use-latest-request"

import { ScanProductThumb } from "./scan-product-thumb"

/**
 * Fallback sheet (UI spec §7; reworked per plan Rev. 6 §4/§6/§8 — the search-sheet
 * rebuild, T4). Opens from the "Produkt suchen" link, after the scanner fails to get a
 * stable read, or when the camera is unavailable — the scanner is an enhancement, this is
 * the path that always works.
 *
 * Name-only now: barcode entry is gone (`ManualEanField` deleted). Two independent lanes
 * feed the same field:
 * - the live catalog lane, unchanged — debounced 250ms while typing, min 2 chars, GET
 *   `/api/scan/search`.
 * - the dm name-search lane, which only ever fires once the user explicitly submits
 *   (Enter or the round arrow button) AND `retailerSearchEnabled` is true. Submitting
 *   fires both lanes in parallel: a FRESH (non-debounced) catalog request plus the
 *   retailer request.
 *
 * Each lane owns its own `useLatestRequest` guard (its own "lane token"), so a query
 * change or a resubmit invalidates one lane without racing the other. Every keystroke
 * resets the "submitted" flag back to the plain live-typing state and clears whatever the
 * dm lane had — a fresh submit is required again for it to re-fire.
 *
 * The header answers the question the user actually has, which depends on how they got
 * here (plan 2026-09-05): after the 3s timeout the sheet appeared on its own while they
 * were still pointing at a barcode, so it names that ("Barcode nicht lesbar?") and says
 * what happens next. Opened deliberately, or after a camera failure they have already
 * been told about, it stays the plain "Produkt finden" (F13).
 */

export type ScanSearchReason = "timeout" | "manual" | "camera"

const TIMEOUT_TITLE = "Barcode nicht lesbar?"
const TIMEOUT_SUBLINE = "So findest du's trotzdem."
const DEFAULT_TITLE = "Produkt finden"

const FIELD_PLACEHOLDER = "Produktname oder Marke"

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250
const ERROR_COPY = "Die Suche klappt gerade nicht."
const QUIET_INVITATION_COPY = "Drück Suchen für mehr Treffer."
const POST_SUBMIT_EMPTY_COPY = "Dazu haben wir nichts gefunden."
const RESEARCH_CTA_LABEL = "Für dich prüfen lassen"
const CATALOG_SECTION_LABEL = "In deinem Chaarlie-Katalog"
const RETAILER_SECTION_LABEL = "Weitere Treffer"
const RETAILER_SECTION_SUBLINE = "Noch nicht geprüft — tippe drauf, wir übernehmen das."
const RETAILER_PILL_LABEL = "Prüfen lassen"
const RETAILER_UNAVAILABLE_COPY = "Die erweiterte Suche ist gerade nicht verfügbar."

type CatalogStatus = "idle" | "loading" | "ready" | "error"
type RetailerStatus = "idle" | "loading" | "ready" | "error" | "disabled"

/**
 * Merge policy (T4 brief §4): the live lane keeps its own order; any GTIN-mapped catalog
 * hit the retailer route also resolved (its `catalog` array) is appended after, deduped by
 * product id.
 */
function mergeCatalogResults(
  live: ScanSearchResult[],
  retailerCatalog: ScanSearchResult[],
): ScanSearchResult[] {
  if (retailerCatalog.length === 0) return live
  const seen = new Set(live.map((result) => result.id))
  const appended = retailerCatalog.filter((result) => !seen.has(result.id))
  return appended.length === 0 ? live : [...live, ...appended]
}

export function ScanSearchSheet({
  open,
  reason,
  onOpenChange,
  onSelectProduct,
  onSelectRetailerResult,
  onStartResearchIntake,
  retailerSearchEnabled = false,
}: {
  open: boolean
  /** Why this sheet is up. Drives the header only — the search itself is identical. */
  reason: ScanSearchReason
  onOpenChange: (open: boolean) => void
  onSelectProduct: (productId: string) => void
  /**
   * dm-row tap (T4 brief §5). Only ever invoked while `retailerSearchEnabled` is true —
   * the row it lives on only renders in that state.
   */
  onSelectRetailerResult?: (gtin: string) => void
  /**
   * The post-submit empty state's CTA (T4 brief §7). Task 5 builds the research intake
   * behind it; this sheet only renders the CTA (and only while this prop is supplied), so
   * T4 ships inert without T5.
   */
  onStartResearchIntake?: () => void
  /**
   * Server-derived flag (T3's `isRetailerSearchEnabled()`), threaded down through
   * `ScanFlow`. `false` (the default) means zero retailer-lane fetches ever — every
   * existing caller (labs, tests) that does not pass this stays byte-identical to the
   * plain live-catalog-only sheet.
   */
  retailerSearchEnabled?: boolean
}) {
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("idle")
  const [catalogResults, setCatalogResults] = useState<ScanSearchResult[]>([])
  const [retailerStatus, setRetailerStatus] = useState<RetailerStatus>("idle")
  const [retailerResults, setRetailerResults] = useState<ScanRetailerResult[]>([])
  const [retailerCatalogMatches, setRetailerCatalogMatches] = useState<ScanSearchResult[]>([])

  const catalogRequests = useLatestRequest()
  const retailerRequests = useLatestRequest()
  // The typing effect's pending debounce timer. Cleared explicitly on submit so a submit
  // never races a duplicate, debounced fetch for the same query (T4 brief §3).
  const debounceTimeoutRef = useRef<number | null>(null)

  function resetToUnsubmitted() {
    setSubmitted(false)
    setRetailerStatus("idle")
    setRetailerResults([])
    setRetailerCatalogMatches([])
  }

  useEffect(() => {
    if (!open) {
      // Invalidate anything still in flight: without it, a response that lands after the
      // sheet closed still writes results/status into a fresh session and the next open
      // flashes the previous query's hits.
      catalogRequests.invalidateAll()
      retailerRequests.invalidateAll()
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }
      setQuery("")
      setCatalogResults([])
      setCatalogStatus("idle")
      resetToUnsubmitted()
    }
  }, [open, catalogRequests, retailerRequests])

  async function runCatalogSearch(trimmed: string, token: number) {
    try {
      const response = await fetch(`/api/scan/search?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      })
      if (!response.ok) throw new Error("search_unavailable")
      const body = (await response.json()) as { results: ScanSearchResult[] }
      if (!catalogRequests.isCurrent(token)) return
      setCatalogResults(body.results ?? [])
      setCatalogStatus("ready")
    } catch {
      if (!catalogRequests.isCurrent(token)) return
      setCatalogStatus("error")
    }
  }

  async function runRetailerSearch(trimmed: string, token: number) {
    try {
      const response = await fetch(`/api/scan/search-retailer?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      })
      if (!response.ok) throw new Error("retailer_search_unavailable")
      const body = (await response.json()) as ScanRetailerSearchResponse
      if (!retailerRequests.isCurrent(token)) return
      if (body.retailerOutcome === "unavailable") {
        setRetailerStatus("error")
        setRetailerResults([])
        setRetailerCatalogMatches([])
        return
      }
      setRetailerResults(body.retailer ?? [])
      setRetailerCatalogMatches(body.catalog ?? [])
      setRetailerStatus(body.retailerOutcome === "disabled" ? "disabled" : "ready")
    } catch {
      if (!retailerRequests.isCurrent(token)) return
      setRetailerStatus("error")
    }
  }

  // Every query change (typing) invalidates both lanes, drops back to unsubmitted state,
  // and re-arms the live catalog debounce — T4 brief §3. Also fires on mount (query "").
  useEffect(() => {
    catalogRequests.invalidateAll()
    retailerRequests.invalidateAll()
    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = null
    }
    resetToUnsubmitted()

    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setCatalogStatus("idle")
      setCatalogResults([])
      return
    }
    const token = catalogRequests.begin()
    setCatalogStatus("loading")
    debounceTimeoutRef.current = window.setTimeout(() => {
      debounceTimeoutRef.current = null
      void runCatalogSearch(trimmed, token)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const trimmedQuery = query.trim()
  const submittable = trimmedQuery.length >= MIN_QUERY_LENGTH

  function handleSubmit() {
    if (!submittable) return
    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = null
    }
    setSubmitted(true)
    const catalogToken = catalogRequests.begin()
    setCatalogStatus("loading")
    void runCatalogSearch(trimmedQuery, catalogToken)

    if (retailerSearchEnabled) {
      const retailerToken = retailerRequests.begin()
      setRetailerStatus("loading")
      setRetailerResults([])
      setRetailerCatalogMatches([])
      void runRetailerSearch(trimmedQuery, retailerToken)
    }
  }

  const mergedCatalog = mergeCatalogResults(catalogResults, retailerCatalogMatches)
  // "The dm section exists" (T4 brief §4) once a submit with the lane enabled happened,
  // unless the server itself answered `disabled` — that renders as if the lane were off.
  const dmActive = retailerSearchEnabled && submitted && retailerStatus !== "disabled"
  const dmLoading = dmActive && retailerStatus === "loading"
  const dmFailed = dmActive && retailerStatus === "error"
  const dmReadyResults = dmActive && retailerStatus === "ready" ? retailerResults : []

  const showCatalogLabel = dmActive && catalogStatus === "ready" && mergedCatalog.length > 0
  // Pre-submit catalog miss with the dm lane available (T4 brief §6): a quiet nudge, not
  // the terminal empty state.
  const showQuietInvitation =
    catalogStatus === "ready" && mergedCatalog.length === 0 && retailerSearchEnabled && !submitted
  // The terminal empty state (T4 brief §7): both lanes came back empty, or the dm lane is
  // disabled/off entirely and the catalog alone is empty. Never shown while the dm lane is
  // still loading or has failed — those get their own presentation.
  const showTerminalEmptyState =
    catalogStatus === "ready" &&
    mergedCatalog.length === 0 &&
    !dmLoading &&
    !dmFailed &&
    dmReadyResults.length === 0 &&
    (!retailerSearchEnabled || submitted)

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        className="max-h-[85vh]"
        contentClassName="px-4 pb-6 sm:px-5"
        header={
          <div className="px-4 pb-2 pt-1 sm:px-5">
            <BottomSheetTitle className="text-[17px]">
              {reason === "timeout" ? TIMEOUT_TITLE : DEFAULT_TITLE}
            </BottomSheetTitle>
            {reason === "timeout" ? (
              <p className="mt-0.5 text-sm leading-6 text-[var(--text-sub)]">{TIMEOUT_SUBLINE}</p>
            ) : null}
          </div>
        }
      >
        <div className="flex items-center gap-2 rounded-[14px] border-[1.5px] border-[var(--brand-plum)] bg-card py-1.5 pl-3.5 pr-1.5 shadow-[0_5px_14px_rgba(107,80,160,0.10)] focus-within:ring-2 focus-within:ring-[var(--brand-plum)] focus-within:ring-offset-2">
          <Search className="h-4 w-4 shrink-0 text-[var(--brand-plum)]" aria-hidden="true" />
          <input
            type="search"
            autoComplete="off"
            aria-label={FIELD_PLACEHOLDER}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={FIELD_PLACEHOLDER}
            className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!submittable}
            aria-label="Suchen"
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2",
              submittable
                ? "bg-[var(--brand-coral)] text-white hover:bg-[var(--brand-coral-dark)]"
                : "border border-border bg-transparent text-muted-foreground",
            )}
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 min-h-[64px]" aria-live="polite">
          {catalogStatus === "loading" ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-[64px] w-full rounded-[12px]" />
              ))}
            </div>
          ) : null}

          {catalogStatus === "error" ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{ERROR_COPY}</p>
          ) : null}

          {showQuietInvitation ? (
            <p className="py-4 text-center text-sm leading-6 text-muted-foreground">
              {QUIET_INVITATION_COPY}
            </p>
          ) : null}

          {showTerminalEmptyState ? (
            <div className="py-4 text-center">
              <p className="text-sm leading-6 text-muted-foreground">{POST_SUBMIT_EMPTY_COPY}</p>
              {onStartResearchIntake ? (
                <button
                  type="button"
                  onClick={onStartResearchIntake}
                  className="mt-4 w-full rounded-[10px] bg-[var(--brand-coral)] px-6 py-4 text-base font-semibold text-white transition hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
                >
                  {RESEARCH_CTA_LABEL}
                </button>
              ) : null}
            </div>
          ) : null}

          {catalogStatus === "ready" && mergedCatalog.length > 0 ? (
            <>
              {showCatalogLabel ? (
                <div className="mb-2 mt-1 text-xs font-bold text-[var(--text-sub)]">
                  {CATALOG_SECTION_LABEL}
                </div>
              ) : null}
              <ul className="flex flex-col gap-2">
                {mergedCatalog.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => onSelectProduct(result.id)}
                      className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-[var(--brand-plum)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
                    >
                      <ScanProductThumb imageUrl={result.imageUrl} label={result.name} size={44} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-foreground">
                          {result.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                          {result.brand ? `${result.brand} · ` : ""}
                          {result.categoryLabel}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {dmActive ? (
            <div className={mergedCatalog.length > 0 ? "mt-4" : undefined}>
              {dmLoading ? (
                <>
                  <div className="mb-1 mt-1 text-xs font-bold text-[var(--text-sub)]">
                    {RETAILER_SECTION_LABEL}
                  </div>
                  <p className="mb-2 text-xs leading-5 text-[var(--text-sub)]">
                    {RETAILER_SECTION_SUBLINE}
                  </p>
                  <div className="flex flex-col gap-2">
                    {[0, 1].map((index) => (
                      <Skeleton key={index} className="h-[64px] w-full rounded-[12px]" />
                    ))}
                  </div>
                </>
              ) : null}

              {retailerStatus === "ready" && retailerResults.length > 0 ? (
                <>
                  <div className="mb-1 mt-1 text-xs font-bold text-[var(--text-sub)]">
                    {RETAILER_SECTION_LABEL}
                  </div>
                  <p className="mb-2 text-xs leading-5 text-[var(--text-sub)]">
                    {RETAILER_SECTION_SUBLINE}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {retailerResults.map((result) => (
                      <li key={result.gtin}>
                        <button
                          type="button"
                          onClick={() => onSelectRetailerResult?.(result.gtin)}
                          className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-[var(--brand-plum)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
                        >
                          <ScanProductThumb imageUrl={null} label={result.name} size={44} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-foreground">
                              {result.name}
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                              {result.brand ? `${result.brand} · ` : ""}
                              {result.categoryLabel ?? ""}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-[var(--brand-coral-light)] px-2.5 py-1 text-[11px] font-bold text-[var(--brand-coral-dark)]">
                            {RETAILER_PILL_LABEL}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {dmFailed ? (
                <p className="py-2 text-center text-xs leading-5 text-muted-foreground">
                  {RETAILER_UNAVAILABLE_COPY}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  )
}
