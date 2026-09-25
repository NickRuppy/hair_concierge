"use client"

import { useState } from "react"

import type { ScanRetailerResult } from "@/app/api/scan/search-retailer/route"
import type { ScanSearchResult } from "@/app/api/scan/search/route"
import type { ScanDecodedIdentifier, ScannerRuntime } from "@/components/scan/scanner"
import type { DiscoveryHeatStylingV1 } from "@/lib/discovery/heat-styling"

import {
  answerFrequency,
  answerSpray,
  answerType,
  answerUsage,
  backStep,
  needsFrequency,
  openAddEdit,
  openAddScan,
  openAddSearch,
  pickCapture,
  productSubject,
  startTyped,
  submitTypedName,
  type AddCommit,
  type AddFlow,
  type DiscoveryProductSlot,
} from "./add-flow"
import { DiscoveryAddSheet, type DiscoveryAddSheetHandlers } from "./discovery-add-sheet"
import { DiscoveryHeatScreen, DiscoveryIntakeThanks } from "./discovery-heat-flow"
import { SlideStage } from "./discovery-motion"
import { DiscoveryProductsScreen } from "./discovery-products-screen"
import { DiscoveryRoutineScreen } from "./discovery-routine-screen"
import {
  discoveryHeatSteps,
  heatDraftFrom,
  isHeatStepAnswered,
  setHeatEvent,
  toDiscoveryHeatStyling,
  type DiscoveryHeatDraft,
} from "./heat-flow"
import {
  addIntakeProduct,
  DiscoveryIntakeRequestError,
  identifyBarcode,
  removeIntakeItem,
  saveIntakeHeatStyling,
  submitIntakeConfirmingNone,
  updateIntakeItemUsage,
} from "./intake-api"
import type { DiscoveryIntakeItemView } from "./types"

/**
 * The participant flow (batch 7, plan `plans/discovery-refinement-b7/plan.md` Rev. 3 §2.1;
 * the approved prototype `prototype/index.html`, round 6):
 *
 *   products „Deine Produkte" — ghost slots that fill with product cards; one persistent add
 *            sheet (search → usage → frequency, typed path, scanner). Sticky „Weiter".
 *   routine  „Deine Routine" — her products as day cards; „Stimmt so" / „Noch was ergänzen".
 *   heat     „Hitze & Styling" — one question per screen, saved whole on the way to the final
 *            page „Alles bereit für unser Gespräch", whose „Abschicken" submits.
 *   done     „Danke! Bis bald im Gespräch." — also a returning, already-submitted participant.
 *
 * Every product write is ONE request at the end of its sheet flow (the frequency tap). The
 * decisions live in `add-flow.ts` / `heat-flow.ts`.
 *
 * Hooks: `useState` only — the flow tests drive this component with a hand-rolled dispatcher
 * (no jsdom in this repo). Motion and focus live in the child components.
 */

const GENERIC_ERROR = "Das hat gerade nicht geklappt. Versuch es nochmal."
const SUBMIT_ERROR = "Das Absenden hat nicht geklappt. Versuch es nochmal."

type Screen = "products" | "routine" | "heat" | "done"

function isAlreadySubmitted(error: unknown): boolean {
  return error instanceof DiscoveryIntakeRequestError && error.code === "already_submitted"
}

function scrollToTop() {
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
    window.scrollTo({ top: 0 })
  }
}

export { DiscoveryIntakeThanks }

export function DiscoveryIntakeChecklist({
  initialItems,
  initialSubmitted,
  initialHeatStyling = null,
  retailerSearchEnabled,
  scannerRuntime,
}: {
  initialItems: DiscoveryIntakeItemView[]
  initialSubmitted: boolean
  /** Her saved „Hitze & Styling" answers — prefill when she comes back to edit them. */
  initialHeatStyling?: DiscoveryHeatStylingV1 | null
  retailerSearchEnabled: boolean
  /** Camera/detector seam handed to `<Scanner>`; production leaves it undefined. */
  scannerRuntime?: ScannerRuntime
}) {
  const [items, setItems] = useState(initialItems)
  const [screen, setScreen] = useState<Screen>(initialSubmitted ? "done" : "products")
  const [screenDirection, setScreenDirection] = useState<1 | -1>(1)
  const [flow, setFlow] = useState<AddFlow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [cameraBlocked, setCameraBlocked] = useState(false)
  const [landedItemId, setLandedItemId] = useState<string | null>(null)
  const [heat, setHeat] = useState<DiscoveryHeatDraft>(() => heatDraftFrom(initialHeatStyling))
  const [heatIndex, setHeatIndex] = useState(0)
  const [heatDirection, setHeatDirection] = useState<1 | -1>(1)

  const heatSteps = discoveryHeatSteps(heat)

  function go(to: Screen, direction: 1 | -1) {
    setError(null)
    setScreenDirection(direction)
    setScreen(to)
    if (direction === 1) scrollToTop()
  }

  // --- The add sheet ---------------------------------------------------------------------

  function openSheet(next: AddFlow | null) {
    if (!next || busy) return
    setSheetError(null)
    setError(null)
    setFlow(next)
    setSheetOpen(true)
  }

  function advance(next: (current: AddFlow) => AddFlow) {
    if (!flow || busy) return
    setSheetError(null)
    setFlow(next(flow))
  }

  async function commit(change: AddCommit | null) {
    if (!change || busy) return
    setBusy(true)
    setSheetError(null)
    try {
      if (change.kind === "add") {
        const item = await addIntakeProduct(change.body)
        setItems((previous) => [...previous, item])
        setLandedItemId(item.id)
      } else {
        const item = await updateIntakeItemUsage(change.itemId, change.body)
        setItems((previous) =>
          previous.map((existing) => (existing.id === item.id ? item : existing)),
        )
      }
      setSheetOpen(false)
    } catch (caught) {
      if (isAlreadySubmitted(caught)) {
        setSheetOpen(false)
        go("done", 1)
      } else {
        setSheetError(GENERIC_ERROR)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(itemId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await removeIntakeItem(itemId)
      setItems((previous) => previous.filter((existing) => existing.id !== itemId))
    } catch (caught) {
      if (isAlreadySubmitted(caught)) go("done", 1)
      else setError(GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  function handleDecoded(identifier: ScanDecodedIdentifier): boolean {
    // The loop re-offers the same read while this is false, so a decode that arrives
    // mid-write is simply not consumed yet.
    if (busy || !flow) return false
    const scanning = flow
    setBusy(true)
    setSheetError(null)
    void (async () => {
      try {
        const identity = await identifyBarcode(identifier.value)
        const next =
          identity.kind === "catalog"
            ? pickCapture(
                scanning,
                {
                  source: "barcode",
                  productId: identity.productId,
                  barcodeIdentifier: identifier.value,
                  brandText: identity.brand,
                  productNameText: identity.name,
                },
                productSubject({ brand: identity.brand, name: identity.name }),
                { catalogCategory: identity.category, name: identity.name },
                items,
              )
            : // Unknown to the catalog: nothing to classify, so „Was ist das?" follows.
              pickCapture(
                scanning,
                { source: "barcode_unknown", barcodeIdentifier: identifier.value },
                productSubject({ barcode: identifier.value }),
                { name: null },
                items,
              )
        setFlow(next)
      } catch {
        setSheetError(GENERIC_ERROR)
      } finally {
        setBusy(false)
      }
    })()
    return true
  }

  const sheetHandlers: DiscoveryAddSheetHandlers = {
    onOpenChange: (open) => {
      // Never mid-write: the answer is on its way, the sheet closes when it lands.
      if (!open && !busy) setSheetOpen(false)
    },
    onPickCatalog: (result: ScanSearchResult) =>
      advance((current) =>
        pickCapture(
          current,
          {
            source: "catalog_search",
            productId: result.id,
            brandText: result.brand,
            productNameText: result.name,
          },
          productSubject({
            brand: result.brand,
            line: result.productLine,
            name: result.name,
            imageUrl: result.imageUrl,
          }),
          { catalogCategory: result.category, name: result.name },
          items,
        ),
      ),
    onPickRetailer: (result: ScanRetailerResult) =>
      advance((current) =>
        pickCapture(
          current,
          {
            source: "dm_search",
            barcodeIdentifier: result.gtin,
            brandText: result.brand,
            productNameText: result.name,
          },
          productSubject({ brand: result.brand, name: result.name }),
          { name: result.name },
          items,
        ),
      ),
    onStartTyped: () => advance(startTyped),
    onSubmitName: (typed) => advance((current) => submitTypedName(current, typed, items)),
    onType: (productType) => advance((current) => answerType(current, productType, items)),
    onUsage: (option) => advance((current) => answerUsage(current, option, items)),
    onSpray: (option) => advance((current) => answerSpray(current, option, items)),
    onFrequency: (frequency) => {
      if (flow) void commit(answerFrequency(flow, frequency))
    },
    onBack: () => advance(backStep),
    onRemove: (item) => {
      setSheetOpen(false)
      void handleRemove(item.id)
    },
    onDecoded: handleDecoded,
    onCameraUnavailable: () => {
      setCameraBlocked(true)
      setSheetOpen(false)
    },
  }

  // --- Screens ---------------------------------------------------------------------------

  function continueFromProducts() {
    // A draft from the old checklist still owes its „Wie oft?" — asked before the routine.
    const missing = items.find(needsFrequency)
    if (missing) {
      openSheet(openAddEdit(missing, items, { frequencyOnly: true }))
      return
    }
    go("routine", 1)
  }

  function enterHeat(index: number, direction: 1 | -1) {
    setHeatIndex(index)
    setHeatDirection(direction)
  }

  async function advanceHeat(draft: DiscoveryHeatDraft) {
    if (busy) return
    const steps = discoveryHeatSteps(draft)
    const current = steps[Math.min(heatIndex, steps.length - 1)]
    if (!isHeatStepAnswered(draft, current)) return
    const nextIndex = Math.min(heatIndex + 1, steps.length - 1)
    if (steps[nextIndex].kind !== "summary") {
      setError(null)
      enterHeat(nextIndex, 1)
      return
    }
    // The last question answered: the whole object is saved on the way to the final page.
    const body = toDiscoveryHeatStyling(draft)
    if (!body) return
    setBusy(true)
    setError(null)
    try {
      await saveIntakeHeatStyling(body)
      enterHeat(nextIndex, 1)
    } catch (caught) {
      if (isAlreadySubmitted(caught)) go("done", 1)
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
      go("done", 1)
    } catch (caught) {
      if (isAlreadySubmitted(caught)) go("done", 1)
      else setError(SUBMIT_ERROR)
    } finally {
      setBusy(false)
    }
  }

  let body
  if (screen === "done") {
    body = <DiscoveryIntakeThanks />
  } else if (screen === "routine") {
    body = (
      <DiscoveryRoutineScreen
        items={items}
        busy={busy}
        onEdit={(item) => openSheet(openAddEdit(item, items))}
        onBack={() => go("products", -1)}
        onConfirm={() => {
          enterHeat(0, 1)
          go("heat", 1)
        }}
      />
    )
  } else if (screen === "heat") {
    body = (
      <DiscoveryHeatScreen
        steps={heatSteps}
        index={heatIndex}
        direction={heatDirection}
        draft={heat}
        items={items}
        busy={busy}
        error={error}
        onBack={() => {
          if (busy) return
          setError(null)
          if (heatIndex === 0) go("routine", -1)
          else enterHeat(heatIndex - 1, -1)
        }}
        onNext={() => void advanceHeat(heat)}
        onDrying={(dryingRoutes) => setHeat({ ...heat, dryingRoutes })}
        onTools={(additionalHeatTools) => setHeat({ ...heat, additionalHeatTools })}
        onFrequency={(source, frequency) => {
          const next = setHeatEvent(heat, source, { frequency })
          setHeat(next)
          void advanceHeat(next)
        }}
        onProtection={(source, protectionConsistency) => {
          const next = setHeatEvent(heat, source, { protectionConsistency })
          setHeat(next)
          void advanceHeat(next)
        }}
        onSubmit={() => void handleSubmit()}
        onEditProducts={() => go("products", -1)}
        onEditHeat={() => enterHeat(0, -1)}
      />
    )
  } else {
    body = (
      <DiscoveryProductsScreen
        items={items}
        busy={busy}
        error={error}
        cameraBlocked={cameraBlocked}
        landedItemId={landedItemId}
        onSearch={(slot: DiscoveryProductSlot | null) => openSheet(openAddSearch(slot))}
        onScan={() => openSheet(openAddScan())}
        onEdit={(item) => openSheet(openAddEdit(item, items))}
        onFrequency={(item) => openSheet(openAddEdit(item, items, { frequencyOnly: true }))}
        onRemove={(itemId) => void handleRemove(itemId)}
        onContinue={continueFromProducts}
      />
    )
  }

  return (
    <>
      <SlideStage stepKey={screen} direction={screenDirection}>
        {body}
      </SlideStage>
      {screen === "done" ? null : (
        <DiscoveryAddSheet
          open={sheetOpen}
          flow={flow}
          busy={busy}
          error={sheetError}
          retailerSearchEnabled={retailerSearchEnabled}
          scannerRuntime={scannerRuntime}
          handlers={sheetHandlers}
        />
      )}
    </>
  )
}
