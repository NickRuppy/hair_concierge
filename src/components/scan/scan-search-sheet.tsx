"use client"

import { ArrowRight, ChevronDown, ChevronLeft, Search } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { ScanSearchResult } from "@/app/api/scan/search/route"
import type {
  ScanRetailerResult,
  ScanRetailerSearchResponse,
} from "@/app/api/scan/search-retailer/route"
import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import { PERSONAL_PLAN_PRODUCT_CATEGORIES } from "@/lib/personal-plan/products/contracts"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { useDelayedLoader } from "@/lib/motion-loader"
import { composeProductIdentityTitle } from "@/lib/product-identity/display-title"
import { identityMatchesQuery } from "@/lib/scan/catalog-search"
import { cn } from "@/lib/utils"

import { noOpScanAnalytics, type ScanAnalyticsPort } from "@/lib/scan/scan-analytics"
import { useLatestRequest } from "@/lib/scan/use-latest-request"

import { ScanProductThumb } from "./scan-product-thumb"

/**
 * Fallback sheet (UI spec §7; reworked per plan Rev. 6 §4/§6/§8 — the search-sheet
 * rebuild, T4). Opens from the "Produkt suchen" link, after the scanner fails to get a
 * stable read, or when the camera is unavailable — the scanner is an enhancement, this is
 * the path that always works.
 *
 * Name-only now: barcode entry is gone (`ManualEanField` deleted). Two independent lanes
 * feed the same field (F2 search ruling, plan Rev. 3 §1.2):
 * - the live catalog lane — debounced 250ms while typing, min 2 chars, GET
 *   `/api/scan/search` (typo-tolerant server-side).
 * - the dm name-search lane (only while `retailerSearchEnabled`) — auto-fires after a
 *   ~500ms typing pause from 3 chars on, GET `/api/scan/search-retailer` (its own rate
 *   bucket). Its rows — dm-mapped catalog matches deduped against the live rows, then
 *   dm-only rows — render in a stable section BELOW the live rows, so live rows never
 *   reorder when dm lands.
 * The round arrow / Enter is optional: it cancels both pending debounces and fires both
 * lanes at once (a 2-char query reaches dm only this way).
 *
 * Each lane owns a `useLatestRequest` guard plus an `AbortController`: a query change,
 * resubmit or close invalidates AND cancels the lane's in-flight fetch; an abort never
 * surfaces as an error. Successful responses are cached per sheet session (query → result,
 * cleared on close), so a repeated query is served without a refetch.
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
// F2: the dm lane is slower and rate-limited on its own bucket — a longer pause, 3+ chars.
const RETAILER_AUTO_MIN_QUERY_LENGTH = 3
const RETAILER_DEBOUNCE_MS = 500
const ERROR_COPY = "Die Suche klappt gerade nicht."
const QUIET_INVITATION_COPY = "Drück Suchen für mehr Treffer."
const POST_SUBMIT_EMPTY_COPY = "Dazu haben wir nichts gefunden."
const RESEARCH_CTA_LABEL = "Für dich prüfen lassen"
// Task 8: the persistent recovery link, shown below whatever settled search results are
// displayed — dm's semantic search returns neighbor products for most real queries, so the
// terminal empty state (and with it its own big CTA) is rarely reached.
const PERSISTENT_RECOVERY_PROMPT = "Nicht dabei?"
const CATALOG_SECTION_LABEL = "In deinem Chaarlie-Katalog"
const RETAILER_SECTION_LABEL = "Weitere Treffer"
const RETAILER_SECTION_SUBLINE = "Noch nicht geprüft — tippe drauf, wir übernehmen das."
const RETAILER_PILL_LABEL = "Prüfen lassen"
const RETAILER_UNAVAILABLE_COPY = "Die erweiterte Suche ist gerade nicht verfügbar."

// Task 5: the name-based research intake, entered from the terminal empty state's CTA.
const RESEARCH_INTAKE_HEADING = "Wir prüfen es für dich"
const RESEARCH_INTAKE_SUBLINE = "Das Ergebnis kommt in den Chat – meist innerhalb von 24 Stunden."
const RESEARCH_INTAKE_BRAND_LABEL = "Marke"
const RESEARCH_INTAKE_BRAND_PLACEHOLDER = "z. B. Kérastase"
const RESEARCH_INTAKE_PRODUCT_LABEL = "Produktname"
const RESEARCH_INTAKE_CATEGORY_LABEL = "Was ist es?"
const RESEARCH_INTAKE_CATEGORY_HELPER = "Tippe die Kategorie an – das reicht uns schon."
const RESEARCH_INTAKE_MORE_LABEL = "Mehr …"
const RESEARCH_INTAKE_BACK_LABEL = "Zurück"
const RESEARCH_INTAKE_SUBMITTING_LABEL = "Wird eingereicht"
const RESEARCH_INTAKE_BRAND_MAX = 200
const RESEARCH_INTAKE_PRODUCT_NAME_MAX = 240

/** The five most-scanned shelf categories stay visible; the rest sit behind "Mehr …". */
const RESEARCH_INTAKE_PRIMARY_CATEGORIES: PersonalPlanCategory[] = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
]

/**
 * A result row names the product the way the routine and the iOS search do: brand,
 * product line and name as one de-duplicated title (the shared identity formatter).
 * dm rows carry no product line, so theirs is brand + name.
 */
export function scanResultTitle(result: {
  brand: string | null
  name: string
  productLine?: string | null
}): string {
  return (
    composeProductIdentityTitle({
      brand: result.brand,
      productLine: result.productLine,
      name: result.name,
    }) || result.name
  )
}

type CatalogStatus = "idle" | "loading" | "ready" | "error"
type RetailerStatus = "idle" | "loading" | "ready" | "error" | "disabled"

export type ScanResearchIntakeInput = {
  brandText: string
  productNameText: string
  category: PersonalPlanCategory
}

/**
 * The one-step research intake form (T5): a swapped content state inside the sheet, not a
 * separate sheet or a modification of `ScanUnknownFlow` (that component stays untouched —
 * this is a deliberately separate, smaller component with its own category-grid state).
 * A category tap submits; it is blocked (and redirects focus to the first empty field)
 * until both text fields are non-empty.
 */
export function ScanResearchIntakeForm({
  brandText,
  productNameText,
  onBrandTextChange,
  onProductNameTextChange,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  brandText: string
  productNameText: string
  onBrandTextChange: (value: string) => void
  onProductNameTextChange: (value: string) => void
  submitting: boolean
  error: string | null
  onBack: () => void
  onSubmit: (category: PersonalPlanCategory) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [tappedCategory, setTappedCategory] = useState<PersonalPlanCategory | null>(null)
  const brandInputRef = useRef<HTMLInputElement>(null)
  const productNameInputRef = useRef<HTMLInputElement>(null)

  const brandValid = brandText.trim().length > 0
  const productNameValid = productNameText.trim().length > 0
  const fieldsValid = brandValid && productNameValid

  const rest = PERSONAL_PLAN_PRODUCT_CATEGORIES.filter(
    (key) => !RESEARCH_INTAKE_PRIMARY_CATEGORIES.includes(key),
  )
  const visible = showAll
    ? [...RESEARCH_INTAKE_PRIMARY_CATEGORIES, ...rest]
    : RESEARCH_INTAKE_PRIMARY_CATEGORIES

  function handleTap(category: PersonalPlanCategory) {
    if (submitting) return
    if (!brandValid) {
      brandInputRef.current?.focus()
      return
    }
    if (!productNameValid) {
      productNameInputRef.current?.focus()
      return
    }
    setTappedCategory(category)
    onSubmit(category)
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-[var(--brand-plum)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {RESEARCH_INTAKE_BACK_LABEL}
      </button>

      <div>
        <div className="mb-1 text-xs font-bold text-[var(--text-sub)]">
          {RESEARCH_INTAKE_BRAND_LABEL}
        </div>
        <input
          ref={brandInputRef}
          type="text"
          value={brandText}
          onChange={(event) => onBrandTextChange(event.target.value)}
          maxLength={RESEARCH_INTAKE_BRAND_MAX}
          placeholder={RESEARCH_INTAKE_BRAND_PLACEHOLDER}
          aria-label={RESEARCH_INTAKE_BRAND_LABEL}
          // Entering the intake state moves focus to Marke (task 6 a11y pass) — declarative
          // so it works the moment the form mounts, without a `useEffect` this component
          // doesn't otherwise need.
          autoFocus
          className="w-full rounded-[12px] border border-border bg-card px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
        />
      </div>

      <div>
        <div className="mb-1 text-xs font-bold text-[var(--text-sub)]">
          {RESEARCH_INTAKE_PRODUCT_LABEL}
        </div>
        <input
          ref={productNameInputRef}
          type="text"
          value={productNameText}
          onChange={(event) => onProductNameTextChange(event.target.value)}
          maxLength={RESEARCH_INTAKE_PRODUCT_NAME_MAX}
          aria-label={RESEARCH_INTAKE_PRODUCT_LABEL}
          className="w-full rounded-[12px] border border-border bg-card px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
        />
      </div>

      <div>
        <div className="mb-2 text-xs font-bold text-[var(--text-sub)]">
          {RESEARCH_INTAKE_CATEGORY_LABEL}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {visible.map((key) => {
            const isTapped = tappedCategory === key && submitting
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTap(key)}
                disabled={submitting}
                aria-pressed={isTapped}
                className={cn(
                  "flex min-h-[52px] items-center justify-center rounded-xl border p-3 text-center transition-colors disabled:cursor-not-allowed",
                  isTapped
                    ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                    : "border-border bg-card hover:border-[var(--brand-plum)]/40",
                  !fieldsValid && !isTapped ? "opacity-60" : null,
                )}
              >
                <span className="text-[15px] font-bold text-foreground">
                  {isTapped ? RESEARCH_INTAKE_SUBMITTING_LABEL : CATEGORY_COPY[key].label}
                </span>
              </button>
            )
          })}
          {!showAll && rest.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              disabled={submitting}
              className="flex min-h-[52px] items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--brand-plum-light)] p-3 text-center text-[15px] font-semibold text-[var(--brand-plum)] transition-colors hover:border-[var(--brand-plum)] disabled:cursor-not-allowed"
            >
              {RESEARCH_INTAKE_MORE_LABEL}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {RESEARCH_INTAKE_CATEGORY_HELPER}
        </p>
      </div>

      {error ? (
        <p role="alert" aria-live="polite" className="text-sm text-[var(--brand-coral-dark)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

type RetailerSearchTrigger = "auto" | "submit"

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

export function ScanSearchSheet({
  open,
  reason,
  onOpenChange,
  onSelectProduct,
  onSelectProductResult,
  onSelectRetailerResult,
  onSelectRetailerResultRow,
  onStartResearchIntake,
  onSubmitResearchIntake,
  submitting = false,
  submitError = null,
  retailerSearchEnabled = false,
  analytics = noOpScanAnalytics,
  stepContent,
  stepHeader,
  resultsFooter,
  autoFocusSearch = false,
  sheetClassName,
}: {
  open: boolean
  /** Why this sheet is up. Drives the header only — the search itself is identical. */
  reason: ScanSearchReason
  onOpenChange: (open: boolean) => void
  onSelectProduct: (productId: string) => void
  /**
   * The same catalog-row tap as `onSelectProduct`, carrying the WHOLE result instead of
   * just its id — called right beside it, never instead of it, so every existing caller is
   * untouched. Added for the discovery-call checklist, which stores the participant's own
   * wording (`brand_text` / `product_name_text`) alongside the resolved `product_id` and
   * would otherwise have to re-fetch what the row already displayed.
   */
  onSelectProductResult?: (result: ScanSearchResult) => void
  /**
   * dm-row tap (T4 brief §5). Only ever invoked while `retailerSearchEnabled` is true —
   * the row it lives on only renders in that state.
   */
  onSelectRetailerResult?: (gtin: string) => void
  /** The dm-row analogue of `onSelectProductResult`: the whole row, called beside it. */
  onSelectRetailerResultRow?: (result: ScanRetailerResult) => void
  /**
   * The post-submit empty state's CTA (T4 brief §7): invoked (in addition to opening the
   * intake form below) when the CTA is tapped, and gates the CTA's rendering — while it is
   * `undefined` no CTA renders, so T4 ships inert without T5.
   */
  onStartResearchIntake?: () => void
  /**
   * T5: submits the name-based research intake form once a category is tapped with both
   * text fields filled. `ScanFlow` wires this to `submitResearchFromSearch`, which reuses
   * `submitUnknown`'s fetch/dispatch machinery without an identifier. Optional so any
   * existing caller that only wants the CTA to render (without a working submit) keeps
   * compiling.
   */
  onSubmitResearchIntake?: (input: ScanResearchIntakeInput) => void
  /** `ScanFlow`'s `state.submitting` — keeps the intake grid busy while a submit is in flight. */
  submitting?: boolean
  /** `ScanFlow`'s `state.submitError` — the standard error copy, shown inside the intake form. */
  submitError?: string | null
  /**
   * Server-derived flag (T3's `isRetailerSearchEnabled()`), threaded down through
   * `ScanFlow`. `false` (the default) means zero retailer-lane fetches ever — every
   * existing caller (labs, tests) that does not pass this stays byte-identical to the
   * plain live-catalog-only sheet.
   */
  retailerSearchEnabled?: boolean
  /**
   * Task 6: the search-events port (`scan_retailer_search`, `scan_retailer_result_opened`).
   * Defaults to the safe no-op, matching `ScanFlow`'s own default — every existing caller
   * (labs, tests) that does not pass this stays inert.
   */
  analytics?: ScanAnalyticsPort
  /**
   * Discovery add sheet (batch 7): while set, the SAME open sheet shows this instead of the
   * search (header and body) — the query and its results stay, so going back finds them.
   */
  stepContent?: ReactNode
  /**
   * Batch 8: what the header slot shows while `stepContent` is set. Optional and
   * backward compatible — when `stepContent` is set and this is omitted, the header
   * slot renders nothing (`undefined`), same as before this prop existed. Given, it
   * replaces the plain search header the same way `stepContent` replaces the search
   * body, so a step's own title survives the header-slot swap instead of vanishing.
   */
  stepHeader?: ReactNode
  /** Rendered at the end of the results once the catalog lane has answered. */
  resultsFooter?: ReactNode
  /** Focus the search field when the sheet opens. */
  autoFocusSearch?: boolean
  /** Extra classes for the sheet panel (e.g. a large fixed height). */
  sheetClassName?: string
}) {
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("idle")
  const [catalogResults, setCatalogResults] = useState<ScanSearchResult[]>([])
  const [retailerStatus, setRetailerStatus] = useState<RetailerStatus>("idle")
  const [retailerResults, setRetailerResults] = useState<ScanRetailerResult[]>([])
  const [retailerCatalogMatches, setRetailerCatalogMatches] = useState<ScanSearchResult[]>([])
  // Batch 8: the query each lane's rows (and settled status) belong to. While a NEW query
  // is pending, only previous rows that still match it stay on screen — every rendered
  // row belongs to (or matches) the query in the field.
  const [catalogResultsQuery, setCatalogResultsQuery] = useState<string | null>(null)
  const [retailerResultsQuery, setRetailerResultsQuery] = useState<string | null>(null)
  // `resultsFooter` (discovery's "Selbst eintragen"), once shown, stays mounted through
  // later reloads of the SAME query series — reset only on close or query < 2 chars.
  const [footerEligible, setFooterEligible] = useState(false)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [intakeBrandText, setIntakeBrandText] = useState("")
  const [intakeProductNameText, setIntakeProductNameText] = useState("")

  const catalogRequests = useLatestRequest()
  const retailerRequests = useLatestRequest()
  // Each lane's pending debounce timer. Cleared explicitly on submit so a submit never
  // races a duplicate, debounced fetch for the same query (T4 brief §3).
  const debounceTimeoutRef = useRef<number | null>(null)
  const retailerDebounceTimeoutRef = useRef<number | null>(null)
  // F2: each lane's in-flight fetch, cancelled (not just ignored) once superseded.
  const catalogAbortRef = useRef<AbortController | null>(null)
  const retailerAbortRef = useRef<AbortController | null>(null)
  // F2: per-session query → successful response caches, cleared when the sheet closes.
  const catalogCacheRef = useRef(new Map<string, ScanSearchResult[]>())
  const retailerCacheRef = useRef(new Map<string, ScanRetailerSearchResponse>())
  // Focus management (task 6 a11y pass). The search field is unmounted/remounted whenever
  // `intakeOpen` toggles (conditional render, not hidden CSS), so "focus returns to the
  // search field on Zurück" is done via a callback ref rather than an effect: the flag is
  // armed right before the intake form closes, and the field's ref callback consumes it the
  // moment the new input element mounts.
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const focusSearchOnMountRef = useRef(false)

  /** Only resets the submit flag — the dm lane's rows are a separate concern (below). */
  function resetToUnsubmitted() {
    setSubmitted(false)
  }

  /**
   * Drops the dm lane back to idle with no rows — used only where NOTHING will replace
   * them (the query fell below the dm minimum, below `MIN_QUERY_LENGTH` entirely, or the
   * sheet closed). A query change that will keep running the dm lane must NOT call this:
   * its rows stay on screen (stale) until the next answer lands (batch 8, F4).
   */
  function clearRetailerLane() {
    setRetailerStatus("idle")
    setRetailerResults([])
    setRetailerCatalogMatches([])
    setRetailerResultsQuery(null)
  }

  function clearPendingDebounces() {
    for (const timeoutRef of [debounceTimeoutRef, retailerDebounceTimeoutRef]) {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }

  function abortLane(abortRef: { current: AbortController | null }) {
    abortRef.current?.abort()
    abortRef.current = null
  }

  /** Invalidate + cancel everything in flight on both lanes, pending debounces included. */
  function cancelBothLanes() {
    catalogRequests.invalidateAll()
    retailerRequests.invalidateAll()
    abortLane(catalogAbortRef)
    abortLane(retailerAbortRef)
    clearPendingDebounces()
  }

  // Unmount: nothing may keep fetching — or write state — for a sheet that no longer
  // exists: abort both lanes, drop their debounces and invalidate their tokens.
  useEffect(
    () => () => {
      cancelBothLanes()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    if (!open) {
      // Invalidate anything still in flight: without it, a response that lands after the
      // sheet closed still writes results/status into a fresh session and the next open
      // flashes the previous query's hits.
      cancelBothLanes()
      catalogCacheRef.current.clear()
      retailerCacheRef.current.clear()
      setQuery("")
      setCatalogResults([])
      setCatalogResultsQuery(null)
      setCatalogStatus("idle")
      setFooterEligible(false)
      resetToUnsubmitted()
      clearRetailerLane()
      setIntakeOpen(false)
      setIntakeBrandText("")
      setIntakeProductNameText("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function runCatalogSearch(trimmed: string, token: number) {
    abortLane(catalogAbortRef)
    const controller = new AbortController()
    catalogAbortRef.current = controller
    // Batch 8: "loading" starts here — when the fetch itself begins, not when the
    // debounce that led to it started. The skeleton (first load only, after 300 ms) is
    // derived at render time from this status.
    setCatalogStatus("loading")
    try {
      const response = await fetch(`/api/scan/search?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      if (!response.ok) throw new Error("search_unavailable")
      const body = (await response.json()) as { results: ScanSearchResult[] }
      const results = body.results ?? []
      catalogCacheRef.current.set(trimmed, results)
      if (!catalogRequests.isCurrent(token)) return
      setCatalogResults(results)
      setCatalogResultsQuery(trimmed)
      setCatalogStatus("ready")
      setFooterEligible(true)
    } catch (error) {
      if (isAbortError(error) || !catalogRequests.isCurrent(token)) return
      // The latest request failed: stale rows from an earlier query may no longer be
      // relevant, and showing them under an error banner is more confusing than useful.
      setCatalogResults([])
      setCatalogResultsQuery(trimmed)
      setCatalogStatus("error")
      setFooterEligible(true)
    }
  }

  function applyRetailerResponse(body: ScanRetailerSearchResponse, trimmed: string) {
    setRetailerResults(body.retailer ?? [])
    setRetailerCatalogMatches(body.catalog ?? [])
    setRetailerResultsQuery(trimmed)
    setRetailerStatus(body.retailerOutcome === "disabled" ? "disabled" : "ready")
  }

  async function runRetailerSearch(trimmed: string, token: number, trigger: RetailerSearchTrigger) {
    // Task 6: `scan_retailer_search` fires once per dm request, whichever way the lane's
    // response settles — success, disabled, or failure/timeout (incl. a 429 from its own
    // rate bucket). Never the query text; never for a cache hit or an aborted request.
    abortLane(retailerAbortRef)
    const controller = new AbortController()
    retailerAbortRef.current = controller
    // Batch 8: same "loading starts when the fetch starts" rule as the catalog lane.
    setRetailerStatus("loading")
    const startedAt = performance.now()
    const track = (
      body: Pick<ScanRetailerSearchResponse, "catalog" | "retailer" | "retailerOutcome">,
    ) =>
      analytics.track("scan_retailer_search", {
        catalogCount: body.catalog.length,
        retailerCount: body.retailer.length,
        outcome: body.retailerOutcome,
        durationMs: Math.round(performance.now() - startedAt),
        trigger,
      })
    try {
      const response = await fetch(`/api/scan/search-retailer?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      if (!response.ok) throw new Error("retailer_search_unavailable")
      const body = (await response.json()) as ScanRetailerSearchResponse
      if (body.retailerOutcome === "ok") retailerCacheRef.current.set(trimmed, body)
      if (!retailerRequests.isCurrent(token)) return
      if (body.retailerOutcome === "unavailable") {
        setRetailerStatus("error")
        setRetailerResults([])
        setRetailerCatalogMatches([])
        setRetailerResultsQuery(trimmed)
        track({ catalog: [], retailer: [], retailerOutcome: "unavailable" })
        return
      }
      applyRetailerResponse(body, trimmed)
      track({
        catalog: body.catalog ?? [],
        retailer: body.retailer ?? [],
        retailerOutcome: body.retailerOutcome,
      })
    } catch (error) {
      if (isAbortError(error) || !retailerRequests.isCurrent(token)) return
      // Same call as the catalog lane's error path: nothing replaced these rows, and the
      // unavailable copy reads oddly next to a stale hit list.
      setRetailerStatus("error")
      setRetailerResults([])
      setRetailerCatalogMatches([])
      setRetailerResultsQuery(trimmed)
      track({ catalog: [], retailer: [], retailerOutcome: "unavailable" })
    }
  }

  /**
   * Starts (or re-starts) the catalog lane for `trimmed`: a cache hit is applied at once
   * (no loading state); otherwise the fetch fires after `debounceMs` (0 = right away) and
   * `runCatalogSearch` itself flips the lane to "loading" once that fetch actually
   * starts — nothing here does, so the debounce window shows no visible change (batch 8).
   */
  function startCatalogLane(trimmed: string, debounceMs: number) {
    const token = catalogRequests.begin()
    const cached = catalogCacheRef.current.get(trimmed)
    if (cached) {
      abortLane(catalogAbortRef)
      setCatalogResults(cached)
      setCatalogResultsQuery(trimmed)
      setCatalogStatus("ready")
      setFooterEligible(true)
      return
    }
    if (debounceMs === 0) {
      void runCatalogSearch(trimmed, token)
      return
    }
    debounceTimeoutRef.current = window.setTimeout(() => {
      debounceTimeoutRef.current = null
      void runCatalogSearch(trimmed, token)
    }, debounceMs)
  }

  /**
   * The dm-lane analogue of `startCatalogLane`. Existing dm rows (if the caller is
   * re-starting the lane for a refined query that still runs it) are left in place —
   * cleared only by `clearRetailerLane` when nothing will replace them, or once this
   * lane's own request settles.
   */
  function startRetailerLane(trimmed: string, trigger: RetailerSearchTrigger, debounceMs: number) {
    const token = retailerRequests.begin()
    const cached = retailerCacheRef.current.get(trimmed)
    if (cached) {
      abortLane(retailerAbortRef)
      applyRetailerResponse(cached, trimmed)
      return
    }
    if (debounceMs === 0) {
      void runRetailerSearch(trimmed, token, trigger)
      return
    }
    retailerDebounceTimeoutRef.current = window.setTimeout(() => {
      retailerDebounceTimeoutRef.current = null
      void runRetailerSearch(trimmed, token, trigger)
    }, debounceMs)
  }

  // Every query change (typing) cancels both lanes, drops back to unsubmitted state and
  // re-arms both debounces — T4 brief §3, F2. Also fires on mount (query "").
  //
  // Batch 8: this no longer clears `catalogResults` (or the dm lane's rows) just because
  // a new query is coming — the previous, still-settled rows stay on screen until this
  // query's own answer lands (or an error drops them). The dm lane's rows are only
  // dropped here when NOTHING will replace them: the query fell below the dm minimum or
  // below `MIN_QUERY_LENGTH` entirely.
  useEffect(() => {
    cancelBothLanes()
    resetToUnsubmitted()

    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setCatalogStatus("idle")
      setCatalogResults([])
      setCatalogResultsQuery(null)
      setFooterEligible(false)
      clearRetailerLane()
      return
    }
    startCatalogLane(trimmed, DEBOUNCE_MS)
    if (retailerSearchEnabled && trimmed.length >= RETAILER_AUTO_MIN_QUERY_LENGTH) {
      startRetailerLane(trimmed, "auto", RETAILER_DEBOUNCE_MS)
    } else {
      clearRetailerLane()
    }
    return clearPendingDebounces
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const trimmedQuery = query.trim()
  const submittable = trimmedQuery.length >= MIN_QUERY_LENGTH

  function handleSubmit() {
    if (!submittable) return
    clearPendingDebounces()
    setSubmitted(true)
    startCatalogLane(trimmedQuery, 0)
    if (retailerSearchEnabled) startRetailerLane(trimmedQuery, "submit", 0)

    // Task 6: submitting via the round button moves DOM focus to it natively — pull it
    // back into the field so typing (or Enter, which never left it) keeps working the same
    // way either submit path is used.
    searchInputRef.current?.focus()
  }

  /**
   * Shared by the terminal empty state's CTA and Task 8's persistent recovery link — both
   * enter the exact same intake state (empty Marke, Produktname prefilled with the full
   * trimmed query, clamped to its own max).
   */
  function openResearchIntake() {
    onStartResearchIntake?.()
    setIntakeBrandText("")
    // `maxLength` on the input only limits typing, not this programmatic prefill -- a
    // query longer than the field's own bound would otherwise submit an over-length value
    // and 400 with only the generic error (fix round 1, Important finding).
    setIntakeProductNameText(trimmedQuery.slice(0, RESEARCH_INTAKE_PRODUCT_NAME_MAX))
    setIntakeOpen(true)
  }

  // Batch 8: rows stay on screen while a new query is pending — but ONLY rows that belong
  // to the query in the field: all of them once this query answered, otherwise just the
  // previous rows that still match it (same matcher as the server), so a row for product A
  // is never selectable after she typed B. The settled status counts only for this query.
  const rowsFor = <Row extends { brand: string | null; name: string }>(
    rows: Row[],
    rowsQuery: string | null,
  ) =>
    rowsQuery === trimmedQuery
      ? rows
      : rowsQuery === null
        ? []
        : rows.filter((row) => identityMatchesQuery(row, trimmedQuery))
  const catalogSettled =
    catalogResultsQuery === trimmedQuery && (catalogStatus === "ready" || catalogStatus === "error")
  const catalogRows = rowsFor(catalogResults, catalogResultsQuery)
  // A first load (nothing matching on screen) shows skeletons — only after 300 ms, and once
  // shown for at least 500 ms; the rows swap in only when the skeleton goes.
  const catalogSkeletonVisible = useDelayedLoader(
    catalogStatus === "loading" && !catalogSettled && catalogRows.length === 0,
  )
  const liveRows = catalogSkeletonVisible ? [] : catalogRows
  const showCatalogResults = liveRows.length > 0
  const catalogFailed = catalogSettled && catalogStatus === "error"
  // A RELOAD, not a first load: rows are already on screen while a fresh fetch runs.
  const catalogReloading = catalogStatus === "loading" && showCatalogResults
  // The dm lane has been started for this query — typing pause (3+ chars) or submit.
  // The server answering `disabled` renders as if the lane were off.
  const dmStarted = retailerSearchEnabled && retailerStatus !== "idle"
  const dmActive = dmStarted && retailerStatus !== "disabled"
  const dmLoading = dmActive && retailerStatus === "loading"
  const dmFailed = dmActive && retailerStatus === "error" && retailerResultsQuery === trimmedQuery
  // F2: dm-derived rows live in their own section below the live rows, never merged into
  // them — dm catalog matches deduped against the live rows on screen, then dm-only rows.
  const liveIds = new Set(liveRows.map((result) => result.id))
  const dmCatalogCandidates = dmActive
    ? rowsFor(retailerCatalogMatches, retailerResultsQuery).filter(
        (result) => !liveIds.has(result.id),
      )
    : []
  const dmOnlyCandidates = dmActive ? rowsFor(retailerResults, retailerResultsQuery) : []
  const dmSkeletonVisible = useDelayedLoader(
    dmLoading && dmCatalogCandidates.length === 0 && dmOnlyCandidates.length === 0,
  )
  const dmCatalogRows = dmSkeletonVisible ? [] : dmCatalogCandidates
  const dmOnlyRows = dmSkeletonVisible ? [] : dmOnlyCandidates
  const dmHasRows = dmCatalogRows.length > 0 || dmOnlyRows.length > 0
  const dmReloading = dmLoading && dmHasRows
  // dm has produced a settled answer for the rows on screen — for this query, or it is
  // reloading with still-matching rows standing (a reload must not un-settle what is shown,
  // or the recovery link would flicker off for the length of the refetch).
  const dmSettled =
    dmStarted &&
    ((retailerResultsQuery === trimmedQuery && retailerStatus !== "loading") || dmHasRows)

  const showCatalogLabel = dmActive && showCatalogResults
  // Catalog miss on a query the dm lane has not searched (2 chars: below its auto
  // minimum): a quiet nudge towards the arrow, not the terminal empty state.
  const showQuietInvitation =
    catalogSettled &&
    catalogStatus === "ready" &&
    liveRows.length === 0 &&
    retailerSearchEnabled &&
    !submitted &&
    !dmStarted
  // The terminal empty state (T4 brief §7): both lanes came back empty, or the dm lane is
  // disabled/off entirely and the catalog alone is empty. Never shown while the dm lane is
  // still loading or has failed — those get their own presentation. Gating on
  // `catalogStatus === "ready"` (a SETTLED answer, not a reload in flight) keeps this from
  // flashing empty while a reload with old rows is still running.
  const showTerminalEmptyState =
    catalogSettled &&
    catalogStatus === "ready" &&
    liveRows.length === 0 &&
    !dmLoading &&
    !dmFailed &&
    !dmHasRows &&
    (!retailerSearchEnabled || dmSettled)
  // Task 8's persistent recovery link: dm's semantic search returns neighbor products for
  // most real queries, so the terminal empty state above (and with it its own recovery CTA)
  // is rarely reached — a user searching a product we can't find otherwise sees only
  // results that aren't theirs, with no path to research it. Shown once the search is
  // "done" — submitted, or the dm lane's auto search settled — and rows are ACTUALLY
  // DISPLAYED (live and/or dm-derived); not while only live typing results are up, and not
  // in the terminal empty state (its own CTA owns recovery there). With the retailer flag
  // off this reduces to submitted + catalog rows. Batch 8: rows staying up through a
  // reload keeps this link up too — it never disappears out from under rows still shown.
  const showPersistentRecoveryLink = (submitted || dmSettled) && (showCatalogResults || dmHasRows)

  function renderCatalogRow(result: ScanSearchResult) {
    return (
      <li key={result.id}>
        <button
          type="button"
          onClick={() => {
            onSelectProduct(result.id)
            onSelectProductResult?.(result)
          }}
          className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-[var(--brand-plum)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
        >
          <ScanProductThumb imageUrl={result.imageUrl} label={result.name} size={44} />
          <span className="min-w-0">
            <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
              {scanResultTitle(result)}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
              {result.categoryLabel}
            </span>
          </span>
        </button>
      </li>
    )
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        className={cn("max-h-[85vh]", sheetClassName)}
        contentClassName="px-4 pb-6 sm:px-5"
        initialFocusRef={autoFocusSearch ? searchInputRef : undefined}
        header={
          stepContent ? (
            stepHeader
          ) : intakeOpen ? (
            <div className="px-4 pb-2 pt-1 sm:px-5">
              <BottomSheetTitle className="text-[17px]">{RESEARCH_INTAKE_HEADING}</BottomSheetTitle>
              <p className="mt-0.5 text-sm leading-6 text-[var(--text-sub)]">
                {RESEARCH_INTAKE_SUBLINE}
              </p>
            </div>
          ) : (
            <div className="px-4 pb-2 pt-1 sm:px-5">
              <BottomSheetTitle className="text-[17px]">
                {reason === "timeout" ? TIMEOUT_TITLE : DEFAULT_TITLE}
              </BottomSheetTitle>
              {reason === "timeout" ? (
                <p className="mt-0.5 text-sm leading-6 text-[var(--text-sub)]">{TIMEOUT_SUBLINE}</p>
              ) : null}
            </div>
          )
        }
      >
        {stepContent ? (
          stepContent
        ) : intakeOpen ? (
          <ScanResearchIntakeForm
            brandText={intakeBrandText}
            productNameText={intakeProductNameText}
            onBrandTextChange={setIntakeBrandText}
            onProductNameTextChange={setIntakeProductNameText}
            submitting={submitting}
            error={submitError}
            onBack={() => {
              // Task 6: Zurück returns focus to the search field. The field itself
              // unmounts/remounts with this toggle (conditional render), so the flag is
              // consumed by the input's own ref callback once it exists again.
              focusSearchOnMountRef.current = true
              setIntakeOpen(false)
            }}
            onSubmit={(category) =>
              onSubmitResearchIntake?.({
                brandText: intakeBrandText.trim(),
                productNameText: intakeProductNameText.trim(),
                category,
              })
            }
          />
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-[14px] border-[1.5px] border-[var(--brand-plum)] bg-card py-1.5 pl-3.5 pr-1.5 shadow-[0_5px_14px_rgba(107,80,160,0.10)] focus-within:ring-2 focus-within:ring-[var(--brand-plum)] focus-within:ring-offset-2">
              <Search className="h-4 w-4 shrink-0 text-[var(--brand-plum)]" aria-hidden="true" />
              <input
                ref={(element) => {
                  searchInputRef.current = element
                  if (element && focusSearchOnMountRef.current) {
                    focusSearchOnMountRef.current = false
                    element.focus()
                  }
                }}
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
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

            {/* A reload keeps the old rows exactly as they are — no dimming, which would
                blink on every keystroke — and only tells assistive tech it is busy. */}
            <div
              className="mt-3 min-h-[64px]"
              aria-live="polite"
              aria-busy={catalogReloading || dmReloading ? true : undefined}
            >
              {catalogSkeletonVisible ? (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-[64px] w-full rounded-[12px]" />
                  ))}
                </div>
              ) : null}

              {catalogFailed ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{ERROR_COPY}</p>
              ) : null}

              {showQuietInvitation ? (
                <p className="py-4 text-center text-sm leading-6 text-muted-foreground">
                  {QUIET_INVITATION_COPY}
                </p>
              ) : null}

              {showTerminalEmptyState ? (
                <div className="py-4 text-center">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {POST_SUBMIT_EMPTY_COPY}
                  </p>
                  {onStartResearchIntake ? (
                    <button
                      type="button"
                      onClick={openResearchIntake}
                      className="mt-4 w-full rounded-[10px] bg-[var(--brand-coral)] px-6 py-4 text-base font-semibold text-white transition hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2"
                    >
                      {RESEARCH_CTA_LABEL}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {showCatalogResults ? (
                <>
                  {showCatalogLabel ? (
                    <div className="mb-2 mt-1 text-xs font-bold text-[var(--text-sub)]">
                      {CATALOG_SECTION_LABEL}
                    </div>
                  ) : null}
                  <ul className="flex flex-col gap-2">{liveRows.map(renderCatalogRow)}</ul>
                </>
              ) : null}

              {dmActive ? (
                <div className={showCatalogResults ? "mt-4" : undefined}>
                  {dmSkeletonVisible || dmHasRows ? (
                    <div className="mb-1 mt-1 text-xs font-bold text-[var(--text-sub)]">
                      {RETAILER_SECTION_LABEL}
                    </div>
                  ) : null}

                  {dmSkeletonVisible ? (
                    <Skeleton className="mt-1 h-[64px] w-full rounded-[12px]" />
                  ) : null}

                  {dmCatalogRows.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-2">
                      {dmCatalogRows.map(renderCatalogRow)}
                    </ul>
                  ) : null}

                  {dmOnlyRows.length > 0 ? (
                    <>
                      <p
                        className={cn(
                          "mb-2 text-xs leading-5 text-[var(--text-sub)]",
                          dmCatalogRows.length > 0 ? "mt-3" : null,
                        )}
                      >
                        {RETAILER_SECTION_SUBLINE}
                      </p>
                      <ul className="flex flex-col gap-2">
                        {dmOnlyRows.map((result) => (
                          <li key={result.gtin}>
                            <button
                              type="button"
                              onClick={() => {
                                analytics.track("scan_retailer_result_opened", {
                                  categoryLabel: result.categoryLabel,
                                })
                                onSelectRetailerResult?.(result.gtin)
                                onSelectRetailerResultRow?.(result)
                              }}
                              className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-[var(--brand-plum)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
                            >
                              <ScanProductThumb imageUrl={null} label={result.name} size={44} />
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                                  {scanResultTitle(result)}
                                </span>
                                {result.categoryLabel ? (
                                  <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                                    {result.categoryLabel}
                                  </span>
                                ) : null}
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

              {showPersistentRecoveryLink && onStartResearchIntake ? (
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  {PERSISTENT_RECOVERY_PROMPT}{" "}
                  <button
                    type="button"
                    onClick={openResearchIntake}
                    className="inline-flex min-h-[44px] items-center px-1 align-middle font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
                  >
                    {RESEARCH_CTA_LABEL}
                  </button>
                </p>
              ) : null}

              {resultsFooter && footerEligible ? resultsFooter : null}
            </div>
          </>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}
