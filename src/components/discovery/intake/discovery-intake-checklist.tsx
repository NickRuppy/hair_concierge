"use client"

import { Check, Search } from "lucide-react"
import { useState } from "react"

import type { ScanRetailerResult } from "@/app/api/scan/search-retailer/route"
import type { ScanSearchResult } from "@/app/api/scan/search/route"
import { Scanner, type ScanDecodedIdentifier, type ScannerRuntime } from "@/components/scan/scanner"
import { ScanSearchSheet, scanResultTitle } from "@/components/scan/scan-search-sheet"
import { Button } from "@/components/ui/button"
import type { DiscoveryUsageOption } from "@/lib/discovery/classify"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { composeProductIdentityTitle } from "@/lib/product-identity/display-title"

import { DiscoveryChoiceSheet } from "./discovery-choice-sheet"
import { DiscoveryIntakeReview } from "./discovery-intake-review"
import { DiscoveryProductList } from "./discovery-product-list"
import {
  DiscoveryTypedProductSheet,
  type DiscoveryTypedProduct,
} from "./discovery-typed-product-sheet"
import {
  addIntakeProduct,
  DiscoveryIntakeRequestError,
  identifyBarcode,
  removeIntakeItem,
  submitIntakeConfirmingNone,
  updateIntakeItemUsage,
} from "./intake-api"
import type { DiscoveryIntakeItemView } from "./types"
import {
  beginAdd,
  beginChange,
  chooseType,
  chooseUsage,
  isProductItem,
  type DiscoveryFlowNext,
  type DiscoveryFlowSheet,
} from "./usage-flow"

/**
 * The participant checklist (batch 5, Variante A): one flat list, no category tiles.
 *
 *   list    „Deine Produkte" — search, scan or type a product; each card carries her usage
 *           as a coral pill she can tap to change. Sticky „Fertig" once one product is in.
 *   review  „Passt das so?" — grouped by usage, plus what she left empty; „Stimmt so –
 *           abschicken" confirms those as „benutzt sie nicht" and submits in ONE call.
 *   done    „Danke!" — also where a returning, already-submitted participant lands.
 *
 * Every capture runs the same flow (`usage-flow.ts`): product type (catalog, else name,
 * else „Was ist das?"), then the usage question of that type — and only the final answer
 * sends a request, so research opens server-side from a settled product type.
 *
 * Hooks: `useState` only — the checklist tests drive this component with a hand-rolled
 * dispatcher (no jsdom in this repo).
 */

const TITLE = "Deine Produkte"
const LEDE = "Trag ein, was du benutzt."
const SEARCH_LABEL = "Produkt suchen"
const SCAN_LABEL = "Scannen"
const TYPE_LABEL = "Nicht gefunden? Namen eintippen"
const CANCEL_LABEL = "Abbrechen"
const DONE_LABEL = "Fertig"
const UNNAMED_PRODUCT = "Gescanntes Produkt"
const GENERIC_ERROR = "Das hat gerade nicht geklappt. Versuch es nochmal."
const CAMERA_ERROR = "Die Kamera geht hier nicht. Such das Produkt oder tipp den Namen ein."
const SUBMIT_ERROR = "Das Absenden hat nicht geklappt. Versuch es nochmal."
const THANKS_TITLE = "Danke!"
const THANKS_BODY = "Wir sehen uns im Call."

type Screen = "list" | "review" | "done"
type Panel = "search" | "typed" | "scan" | null

function isAlreadySubmitted(error: unknown): boolean {
  return error instanceof DiscoveryIntakeRequestError && error.code === "already_submitted"
}

function BarcodeGlyph() {
  return (
    <svg width="18" height="16" viewBox="0 0 20 18" aria-hidden="true" className="shrink-0">
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

export function DiscoveryIntakeThanks() {
  return (
    <main className="flex min-h-dvh flex-col bg-[#fbf9f7] px-5 pb-6 pt-7">
      <p className="font-header text-[15px] tracking-[0.02em] text-[var(--brand-plum)]">Chaarlie</p>
      <div className="flex flex-1 flex-col items-center justify-center px-3 pb-14 text-center">
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
          <Check className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="font-header text-2xl text-[var(--brand-plum-darkest)]">{THANKS_TITLE}</h1>
        <p className="mt-2.5 max-w-[250px] text-[15px] leading-relaxed text-[var(--text-sub)]">
          {THANKS_BODY}
        </p>
      </div>
    </main>
  )
}

export function DiscoveryIntakeChecklist({
  initialItems,
  initialSubmitted,
  retailerSearchEnabled,
  scannerRuntime,
}: {
  initialItems: DiscoveryIntakeItemView[]
  initialSubmitted: boolean
  retailerSearchEnabled: boolean
  /** Camera/detector seam handed to `<Scanner>`; production leaves it undefined. */
  scannerRuntime?: ScannerRuntime
}) {
  const [items, setItems] = useState(initialItems)
  const [screen, setScreen] = useState<Screen>(initialSubmitted ? "done" : "list")
  const [panel, setPanel] = useState<Panel>(null)
  const [sheet, setSheet] = useState<DiscoveryFlowSheet | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [cameraBlocked, setCameraBlocked] = useState(false)

  const hasProducts = items.some(isProductItem)

  /** One step of the flow: another sheet, or the ONE request its final answer sends. */
  async function run(next: DiscoveryFlowNext) {
    setSheetError(null)
    if (next.kind === "close") {
      setSheet(null)
      return
    }
    if (next.kind === "sheet") {
      setSheet(next.sheet)
      return
    }
    if (busy) return
    const fromSheet = sheet !== null
    setBusy(true)
    setError(null)
    try {
      if (next.kind === "add") {
        const item = await addIntakeProduct(next.body)
        setItems((previous) => [...previous, item])
      } else {
        const item = await updateIntakeItemUsage(next.itemId, next.body)
        setItems((previous) =>
          previous.map((existing) => (existing.id === item.id ? item : existing)),
        )
      }
      setSheet(null)
    } catch (caught) {
      if (isAlreadySubmitted(caught)) {
        setSheet(null)
        setScreen("done")
      } else if (fromSheet) {
        setSheetError(GENERIC_ERROR)
      } else {
        setError(GENERIC_ERROR)
      }
    } finally {
      setBusy(false)
    }
  }

  function handleCatalogResult(result: ScanSearchResult) {
    setPanel(null)
    void run(
      beginAdd(
        {
          source: "catalog_search",
          productId: result.id,
          brandText: result.brand,
          productNameText: result.name,
        },
        { title: scanResultTitle(result), imageUrl: result.imageUrl, name: result.name },
        result.category,
      ),
    )
  }

  function handleRetailerResult(result: ScanRetailerResult) {
    setPanel(null)
    void run(
      beginAdd(
        {
          source: "dm_search",
          barcodeIdentifier: result.gtin,
          brandText: result.brand,
          productNameText: result.name,
        },
        { title: scanResultTitle(result), imageUrl: null, name: result.name },
      ),
    )
  }

  function handleTyped(product: DiscoveryTypedProduct) {
    setPanel(null)
    void run(
      beginAdd(
        { source: "name_research", ...product },
        {
          title:
            composeProductIdentityTitle({
              brand: product.brandText,
              name: product.productNameText,
            }) || product.productNameText,
          imageUrl: null,
          name: product.productNameText,
        },
      ),
    )
  }

  function handleDecoded(identifier: ScanDecodedIdentifier): boolean {
    // The loop re-offers the same read while this is false, so a decode that arrives
    // mid-write (or while a question is open) is simply not consumed yet.
    if (busy || sheet) return false
    setBusy(true)
    setError(null)
    void (async () => {
      let next: DiscoveryFlowNext
      try {
        const identity = await identifyBarcode(identifier.value)
        next =
          identity.kind === "catalog"
            ? beginAdd(
                {
                  source: "barcode",
                  productId: identity.productId,
                  barcodeIdentifier: identifier.value,
                  brandText: identity.brand,
                  productNameText: identity.name,
                },
                {
                  title:
                    composeProductIdentityTitle({ brand: identity.brand, name: identity.name }) ||
                    identity.name,
                  imageUrl: null,
                  name: identity.name,
                },
                identity.category,
              )
            : // Unknown to the catalog: nothing to classify, so „Was ist das?" follows.
              beginAdd(
                { source: "barcode_unknown", barcodeIdentifier: identifier.value },
                { title: UNNAMED_PRODUCT, imageUrl: null, name: null },
              )
      } catch {
        setError(GENERIC_ERROR)
        setBusy(false)
        return
      }
      setBusy(false)
      setPanel(null)
      await run(next)
    })()
    return true
  }

  async function handleRemove(itemId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await removeIntakeItem(itemId)
      setItems((previous) => previous.filter((existing) => existing.id !== itemId))
    } catch (caught) {
      if (isAlreadySubmitted(caught)) setScreen("done")
      else setError(GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await submitIntakeConfirmingNone()
      setScreen("done")
    } catch (caught) {
      if (isAlreadySubmitted(caught)) setScreen("done")
      else setError(SUBMIT_ERROR)
    } finally {
      setBusy(false)
    }
  }

  function openChange(item: DiscoveryIntakeItemView) {
    setSheetError(null)
    setSheet(beginChange(item))
  }

  const choiceSheet = (
    <DiscoveryChoiceSheet
      sheet={sheet}
      busy={busy}
      error={sheetError}
      onChooseType={(productType: PersonalPlanCategory | null) => {
        if (sheet?.kind === "what_is_it") void run(chooseType(sheet, productType))
      }}
      onChooseUsage={(option: DiscoveryUsageOption) => {
        if (sheet?.kind === "usage") void run(chooseUsage(sheet, option))
      }}
      onClose={() => setSheet(null)}
    />
  )

  if (screen === "done") return <DiscoveryIntakeThanks />

  if (screen === "review") {
    return (
      <>
        <DiscoveryIntakeReview
          items={items}
          submitting={busy}
          error={error}
          onChange={openChange}
          onSubmit={() => void handleSubmit()}
          onBack={() => {
            setError(null)
            setScreen("list")
          }}
        />
        {choiceSheet}
      </>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col bg-[#fbf9f7]">
      <div className="flex-1 px-5 pb-6 pt-7">
        <p className="mb-6 font-header text-[15px] tracking-[0.02em] text-[var(--brand-plum)]">
          Chaarlie
        </p>
        <h1 className="font-header text-2xl leading-tight text-[var(--brand-plum-darkest)]">
          {TITLE}
        </h1>
        <p className="mb-5 mt-1.5 text-sm leading-6 text-[var(--text-sub)]">{LEDE}</p>

        {panel === "scan" && !cameraBlocked ? (
          <div>
            <div className="overflow-hidden rounded-[18px]">
              <Scanner
                active
                runtime={scannerRuntime}
                detectionPaused={busy || sheet !== null}
                onDecoded={handleDecoded}
                onUnavailable={() => {
                  setCameraBlocked(true)
                  setPanel(null)
                }}
                onTimeout={() => undefined}
                onStalled={() => {
                  setCameraBlocked(true)
                  setPanel(null)
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="mt-3 min-h-[48px] w-full rounded-[14px] border border-border text-sm font-semibold text-[var(--text-sub)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
            >
              {CANCEL_LABEL}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null)
                setPanel("search")
              }}
              disabled={busy}
              className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-[14px] border border-[var(--brand-plum-light)] bg-white px-3.5 text-left text-[15px] text-[var(--text-sub)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <Search className="h-4 w-4 shrink-0 text-[var(--brand-plum)]" aria-hidden="true" />
              <span className="truncate">{SEARCH_LABEL}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setPanel("scan")
              }}
              disabled={cameraBlocked || busy}
              className="flex min-h-[52px] shrink-0 items-center gap-2 rounded-[14px] border-[1.5px] border-[var(--brand-plum)] bg-white px-4 text-[15px] font-semibold text-[var(--brand-plum-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <BarcodeGlyph />
              {SCAN_LABEL}
            </button>
          </div>
        )}

        {cameraBlocked ? (
          <p className="mt-2 text-center text-xs leading-5 text-[var(--text-sub)]">
            {CAMERA_ERROR}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setError(null)
            setPanel("typed")
          }}
          disabled={busy}
          className="mb-4 mt-1 min-h-[44px] w-full text-sm font-semibold text-[var(--brand-plum-dark)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-50"
        >
          {TYPE_LABEL}
        </button>

        <DiscoveryProductList
          items={items}
          busy={busy}
          onChange={openChange}
          onRemove={(itemId) => void handleRemove(itemId)}
        />

        {error ? (
          <p role="alert" className="mt-4 text-center text-sm text-[var(--brand-coral-dark)]">
            {error}
          </p>
        ) : null}
      </div>

      {hasProducts ? (
        <div className="sticky bottom-0 bg-[#fbf9f7] px-5 pb-6 pt-3.5">
          <Button
            type="button"
            variant="funnelCta"
            disabled={busy}
            onClick={() => {
              setError(null)
              setPanel(null)
              setScreen("review")
            }}
          >
            {DONE_LABEL}
          </Button>
        </div>
      ) : null}

      <ScanSearchSheet
        open={panel === "search"}
        reason="manual"
        onOpenChange={(open) => {
          if (open) setPanel("search")
          else setPanel((current) => (current === "search" ? null : current))
        }}
        // The checklist consumes the WHOLE row: it keeps the displayed name and brand, and
        // the catalog row's category is the product type (P2-6).
        onSelectProduct={() => undefined}
        onSelectProductResult={handleCatalogResult}
        onSelectRetailerResultRow={handleRetailerResult}
        // „Nicht dabei?" leads to the checklist's own typed form, which asks no category.
        onStartResearchIntake={() => setPanel("typed")}
        submitting={busy}
        retailerSearchEnabled={retailerSearchEnabled}
      />
      <DiscoveryTypedProductSheet
        open={panel === "typed"}
        busy={busy}
        onOpenChange={(open) => {
          if (!open) setPanel((current) => (current === "typed" ? null : current))
        }}
        onSubmit={handleTyped}
      />
      {choiceSheet}
    </main>
  )
}
