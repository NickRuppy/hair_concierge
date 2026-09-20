"use client"

import { ArrowRight, ChevronDown, ChevronLeft, Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"

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
// Task 8: the persistent recovery link, shown below whatever post-submit results are
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
  onSubmitResearchIntake,
  submitting = false,
  submitError = null,
  retailerSearchEnabled = false,
  analytics = noOpScanAnalytics,
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
}) {
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("idle")
  const [catalogResults, setCatalogResults] = useState<ScanSearchResult[]>([])
  const [retailerStatus, setRetailerStatus] = useState<RetailerStatus>("idle")
  const [retailerResults, setRetailerResults] = useState<ScanRetailerResult[]>([])
  const [retailerCatalogMatches, setRetailerCatalogMatches] = useState<ScanSearchResult[]>([])
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [intakeBrandText, setIntakeBrandText] = useState("")
  const [intakeProductNameText, setIntakeProductNameText] = useState("")

  const catalogRequests = useLatestRequest()
  const retailerRequests = useLatestRequest()
  // The typing effect's pending debounce timer. Cleared explicitly on submit so a submit
  // never races a duplicate, debounced fetch for the same query (T4 brief §3).
  const debounceTimeoutRef = useRef<number | null>(null)
  // Focus management (task 6 a11y pass). The search field is unmounted/remounted whenever
  // `intakeOpen` toggles (conditional render, not hidden CSS), so "focus returns to the
  // search field on Zurück" is done via a callback ref rather than an effect: the flag is
  // armed right before the intake form closes, and the field's ref callback consumes it the
  // moment the new input element mounts.
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const focusSearchOnMountRef = useRef(false)

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
      setIntakeOpen(false)
      setIntakeBrandText("")
      setIntakeProductNameText("")
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
    // Task 6: `scan_retailer_search` fires once per submit, whichever way the lane's
    // response settles — success, disabled, or failure/timeout. Never the query text.
    const startedAt = performance.now()
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
        analytics.track("scan_retailer_search", {
          catalogCount: 0,
          retailerCount: 0,
          outcome: "unavailable",
          durationMs: Math.round(performance.now() - startedAt),
        })
        return
      }
      setRetailerResults(body.retailer ?? [])
      setRetailerCatalogMatches(body.catalog ?? [])
      setRetailerStatus(body.retailerOutcome === "disabled" ? "disabled" : "ready")
      analytics.track("scan_retailer_search", {
        catalogCount: body.catalog?.length ?? 0,
        retailerCount: body.retailer?.length ?? 0,
        outcome: body.retailerOutcome,
        durationMs: Math.round(performance.now() - startedAt),
      })
    } catch {
      if (!retailerRequests.isCurrent(token)) return
      setRetailerStatus("error")
      analytics.track("scan_retailer_search", {
        catalogCount: 0,
        retailerCount: 0,
        outcome: "unavailable",
        durationMs: Math.round(performance.now() - startedAt),
      })
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
  // Task 8's persistent recovery link: dm's semantic search returns neighbor products for
  // most real queries, so the terminal empty state above (and with it its own recovery CTA)
  // is rarely reached — a user searching a product we can't find otherwise sees only
  // results that aren't theirs, with no path to research it. Shown once ANY post-submit
  // results are on screen (dm-only rows and/or merged catalog rows, either or both) — not
  // pre-submit (live typing), and not in the terminal empty state (its own CTA owns
  // recovery there). Works with the retailer flag off too: `dmReadyResults` is always `[]`
  // in that case, so this reduces to catalog-only results.
  const showPersistentRecoveryLink =
    submitted && (mergedCatalog.length > 0 || dmReadyResults.length > 0)

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        className="max-h-[85vh]"
        contentClassName="px-4 pb-6 sm:px-5"
        header={
          intakeOpen ? (
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
        {intakeOpen ? (
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
                          <ScanProductThumb
                            imageUrl={result.imageUrl}
                            label={result.name}
                            size={44}
                          />
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
                              onClick={() => {
                                analytics.track("scan_retailer_result_opened", {
                                  categoryLabel: result.categoryLabel,
                                })
                                onSelectRetailerResult?.(result.gtin)
                              }}
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
            </div>
          </>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}
