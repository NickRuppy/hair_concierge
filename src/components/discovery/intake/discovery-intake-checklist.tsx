"use client"

import { useState } from "react"

import type { ScanRetailerResult } from "@/app/api/scan/search-retailer/route"
import type { ScanSearchResult } from "@/app/api/scan/search/route"
import type { ScanDecodedIdentifier, ScannerRuntime } from "@/components/scan/scanner"
import type { DiscoveryHeatStylingV1 } from "@/lib/discovery/heat-styling"
import { MOTION_MS } from "@/lib/motion"

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
  isProvisionalItem,
  pickCapture,
  productSubject,
  provisionalIntakeItem,
  provisionalItemId,
  startTyped,
  submitTypedName,
  type AddCommit,
  type AddFlow,
  type DiscoveryProductSlot,
} from "./add-flow"
import { DiscoveryAddSheet, type DiscoveryAddSheetHandlers } from "./discovery-add-sheet"
import { DiscoveryHeatScreen, DiscoveryIntakeThanks } from "./discovery-heat-flow"
import { motionMs, SlideStage } from "./discovery-motion"
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
import type { DiscoveryIntakeItemView, DiscoveryIntakeProductBody } from "./types"

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
 * Batch 8 (plan `plans/discovery-b8-motion-days/plan.md` Part B items 6, 7, 12): writes are
 * optimistic where they can be — an added card lands right after the settle, a removed card
 * collapses at once, heat answers move on while their PUT runs — and roll back on an error.
 * Nothing dims the page: only the control that waits shows it, after 300 ms.
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

function later(ms: number, run: () => void) {
  if (ms <= 0) run()
  else setTimeout(run, ms)
}

/**
 * What the optimistic writes need across renders without re-rendering (kept in a `useState`
 * box — the flow tests' dispatcher knows only `useState`).
 */
type WriteLedger = {
  /** Every write still in flight — „Weiter" and „Abschicken" wait for them. */
  pending: Set<Promise<unknown>>
  /** Items fading out; the collapse removes them only while they are still here. */
  removing: Set<string>
  /** Heat saves run one after another, the last answer wins. */
  heatChain: Promise<unknown>
  heatVersion: number
  heatSavedVersion: number
  /** Which sheet opening is current — a failed add reopens only its own sheet. */
  sheetSession: number
  sheetOpen: boolean
  /** The opening whose add went out — one add per opening; a failure frees it again. */
  addCommittedSession: number
  /** Counts failed adds — „Weiter" only moves on when none failed while it waited. */
  addFailures: number
  /** „Already submitted" arrived: the done page is final. */
  done: boolean
  provisional: number
  /** The items as of the latest write — what an async step reads after an await. */
  items: DiscoveryIntakeItemView[]
  /** Capture order of every item (by id) — a failed remove comes back to its own place. */
  order: Map<string, number>
  nextOrder: number
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
  const [sheetSession, setSheetSession] = useState(0)
  /** A write the open sheet waits for (an edit's PATCH, a barcode lookup). */
  const [sheetBusy, setSheetBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [cameraBlocked, setCameraBlocked] = useState(false)
  /** The card that lands (its render key); cleared once the landing played. */
  const [landedKey, setLandedKey] = useState<string | null>(null)
  /** Server id → the provisional card's key, so a confirmed card never re-mounts. */
  const [itemKeys, setItemKeys] = useState<Record<string, string>>({})
  const [removingIds, setRemovingIds] = useState<string[]>([])
  const [removeFailedId, setRemoveFailedId] = useState<string | null>(null)
  const [heat, setHeat] = useState<DiscoveryHeatDraft>(() => heatDraftFrom(initialHeatStyling))
  const [heatIndex, setHeatIndex] = useState(0)
  const [heatDirection, setHeatDirection] = useState<1 | -1>(1)
  /** Failed sheet saves — the frequency step shows the saved answer again after each. */
  const [sheetRejections, setSheetRejections] = useState(0)
  const [writes] = useState<WriteLedger>(() => ({
    pending: new Set(),
    removing: new Set(),
    heatChain: Promise.resolve(),
    heatVersion: 0,
    heatSavedVersion: 0,
    sheetSession: 0,
    sheetOpen: false,
    addCommittedSession: 0,
    addFailures: 0,
    done: initialSubmitted,
    provisional: 0,
    items: initialItems,
    order: new Map(initialItems.map((item, index) => [item.id, index])),
    nextOrder: initialItems.length,
  }))

  const heatSteps = discoveryHeatSteps(heat)

  function go(to: Screen, direction: 1 | -1) {
    // Once „already submitted" landed her on the done page, nothing navigates away again.
    if (writes.done && to !== "done") return
    if (to === "done") writes.done = true
    setError(null)
    setScreenDirection(direction)
    setScreen(to)
  }

  /** Every item change goes through the ledger, so async steps never read a stale list. */
  function updateItems(change: (current: DiscoveryIntakeItemView[]) => DiscoveryIntakeItemView[]) {
    writes.items = change(writes.items)
    setItems(writes.items)
  }

  function setSheet(open: boolean) {
    writes.sheetOpen = open
    setSheetOpen(open)
  }

  /** Puts a restored item back at its capture-order place among the current items. */
  function restoreInOrder(item: DiscoveryIntakeItemView) {
    updateItems((current) => {
      if (current.some((existing) => existing.id === item.id)) return current
      const rank = writes.order.get(item.id) ?? Number.MAX_SAFE_INTEGER
      const at = current.findIndex(
        (existing) => (writes.order.get(existing.id) ?? Number.MAX_SAFE_INTEGER) > rank,
      )
      const next = [...current]
      next.splice(at === -1 ? next.length : at, 0, item)
      return next
    })
  }

  function track<T>(write: Promise<T>): Promise<T> {
    writes.pending.add(write)
    const forget = () => writes.pending.delete(write)
    write.then(forget, forget)
    return write
  }

  async function settledWrites() {
    while (writes.pending.size > 0) await Promise.allSettled([...writes.pending])
  }

  // --- The add sheet ---------------------------------------------------------------------

  function openSheet(next: AddFlow | null) {
    if (!next || sheetBusy) return
    writes.sheetSession += 1
    setSheetSession(writes.sheetSession)
    setSheetError(null)
    setError(null)
    setRemoveFailedId(null)
    setFlow(next)
    setSheet(true)
  }

  function advance(next: (current: AddFlow) => AddFlow) {
    if (!flow || sheetBusy) return
    setSheetError(null)
    setFlow(next(flow))
  }

  function landCard(key: string) {
    setLandedKey(key)
    // Played after the sheet closed (`discovery-land` waits for it); then forgotten, so a
    // re-render or coming back to this screen never replays it.
    later(motionMs(MOTION_MS.sheetOut + MOTION_MS.list) + 80, () =>
      setLandedKey((current) => (current === key ? null : current)),
    )
  }

  /** The frequency tap of an ADD: the card lands at once, the POST runs behind it. */
  function commitAdd(body: DiscoveryIntakeProductBody, committed: AddFlow) {
    const subject = committed.draft?.subject
    const session = writes.sheetSession
    // One add per sheet opening — a double tap or a late settle never adds twice.
    if (!subject || writes.addCommittedSession === session) return
    writes.addCommittedSession = session
    writes.provisional += 1
    const key = provisionalItemId(writes.provisional)
    writes.order.set(key, writes.nextOrder++)
    updateItems((current) => [...current, provisionalIntakeItem(key, body, subject)])
    setSheet(false)
    landCard(key)
    void track(addIntakeProduct(body)).then(
      (item) => {
        writes.order.set(item.id, writes.order.get(key) ?? writes.nextOrder++)
        updateItems((current) => current.map((existing) => (existing.id === key ? item : existing)))
        setItemKeys((previous) => ({ ...previous, [item.id]: key }))
      },
      (caught) => {
        writes.addFailures += 1
        updateItems((current) => current.filter((existing) => existing.id !== key))
        if (isAlreadySubmitted(caught)) {
          go("done", 1)
        } else if (writes.sheetSession === session) {
          // Nothing else opened since: her sheet comes back on the frequency, with the error,
          // showing what is actually saved (nothing) — and she may try again.
          writes.addCommittedSession = 0
          setFlow(committed)
          setSheetError(GENERIC_ERROR)
          setSheetRejections((count) => count + 1)
          setSheet(true)
        } else {
          setError(GENERIC_ERROR)
        }
      },
    )
  }

  /** `session`: the opening the tap came from — a late answer from an earlier one is dropped. */
  async function commit(change: AddCommit | null, session: number) {
    if (!change || !flow || sheetBusy) return
    if (session !== writes.sheetSession || !writes.sheetOpen) return
    if (change.kind === "add") {
      commitAdd(change.body, flow)
      return
    }
    setSheetBusy(true)
    setSheetError(null)
    try {
      const item = await track(updateIntakeItemUsage(change.itemId, change.body))
      updateItems((current) =>
        current.map((existing) => (existing.id === item.id ? item : existing)),
      )
      setSheet(false)
    } catch (caught) {
      if (isAlreadySubmitted(caught)) {
        setSheet(false)
        go("done", 1)
      } else {
        // The server kept the old answer: the step shows it again; the error invites a retry.
        setSheetError(GENERIC_ERROR)
        setSheetRejections((count) => count + 1)
      }
    } finally {
      setSheetBusy(false)
    }
  }

  /**
   * Remove: the card fades and collapses at once (after the sheet closed, when it came from
   * there) while the DELETE runs; a failed DELETE puts it back where it was, with a line.
   */
  function handleRemove(itemId: string, options: { afterSheet?: boolean } = {}) {
    const removed = writes.items.find((existing) => existing.id === itemId)
    if (!removed || isProvisionalItem(removed) || writes.removing.has(itemId)) return
    writes.removing.add(itemId)
    setError(null)
    setRemoveFailedId(null)
    const collapseAfter = options.afterSheet ? motionMs(MOTION_MS.sheetOut) : 0
    later(collapseAfter, () => {
      if (!writes.removing.has(itemId)) return
      setRemovingIds((previous) => [...previous, itemId])
      later(motionMs(MOTION_MS.list), () => {
        if (!writes.removing.has(itemId)) return
        writes.removing.delete(itemId)
        updateItems((current) => current.filter((existing) => existing.id !== itemId))
        setRemovingIds((previous) => previous.filter((id) => id !== itemId))
      })
    })
    void track(removeIntakeItem(itemId)).catch((caught) => {
      writes.removing.delete(itemId)
      setRemovingIds((previous) => previous.filter((id) => id !== itemId))
      restoreInOrder(removed)
      if (isAlreadySubmitted(caught)) go("done", 1)
      else setRemoveFailedId(itemId)
    })
  }

  function handleDecoded(identifier: ScanDecodedIdentifier): boolean {
    // The loop re-offers the same read while this is false, so a decode that arrives
    // mid-lookup is simply not consumed yet.
    if (sheetBusy || !flow) return false
    const scanning = flow
    setSheetBusy(true)
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
        setSheetBusy(false)
      }
    })()
    return true
  }

  const sheetHandlers: DiscoveryAddSheetHandlers = {
    onOpenChange: (open) => {
      // Never mid-write: the answer is on its way, the sheet closes when it lands.
      if (!open && !sheetBusy) setSheet(false)
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
      if (flow) void commit(answerFrequency(flow, frequency), sheetSession)
    },
    onBack: () => advance(backStep),
    onRemove: (item) => {
      if (sheetBusy) return
      setSheet(false)
      handleRemove(item.id, { afterSheet: true })
    },
    onDecoded: handleDecoded,
    onCameraUnavailable: () => {
      setCameraBlocked(true)
      setSheet(false)
    },
  }

  // --- Screens ---------------------------------------------------------------------------

  async function continueFromProducts() {
    if (continuing) return
    if (writes.pending.size > 0) {
      // A card still on its way: „Weiter" waits for it (spinner only after 300 ms) and moves
      // on only if everything it waited for succeeded — a failed add has her sheet back
      // (or „already submitted" has her on the done page, which `go` keeps).
      const failures = writes.addFailures
      setContinuing(true)
      await settledWrites()
      setContinuing(false)
      if (writes.done || writes.addFailures !== failures) return
    }
    // Read NOW, not from the tap: cards confirmed, removed or restored meanwhile count.
    const current = writes.items.filter((item) => !writes.removing.has(item.id))
    // A draft from the old checklist still owes its „Wie oft?" — asked before the routine.
    const missing = current.find(needsFrequency)
    if (missing) {
      openSheet(openAddEdit(missing, current, { frequencyOnly: true }))
      return
    }
    go("routine", 1)
  }

  function enterHeat(index: number, direction: 1 | -1) {
    setHeatIndex(index)
    setHeatDirection(direction)
  }

  /**
   * Heat answers are saved as one object on the way to the final page — in the background:
   * she is already on the final page while the PUT runs, and „Abschicken" waits for it.
   */
  function saveHeat(draft: DiscoveryHeatDraft) {
    const body = toDiscoveryHeatStyling(draft)
    if (!body) return
    writes.heatVersion += 1
    const version = writes.heatVersion
    const run = writes.heatChain.then(() => saveIntakeHeatStyling(body))
    writes.heatChain = run.catch(() => undefined)
    void track(run).then(
      () => {
        writes.heatSavedVersion = Math.max(writes.heatSavedVersion, version)
      },
      (caught) => {
        // Not saved: „Abschicken" saves it again first.
        if (isAlreadySubmitted(caught)) go("done", 1)
      },
    )
  }

  function advanceHeat(draft: DiscoveryHeatDraft) {
    const steps = discoveryHeatSteps(draft)
    const current = steps[Math.min(heatIndex, steps.length - 1)]
    if (!isHeatStepAnswered(draft, current)) return
    const nextIndex = Math.min(heatIndex + 1, steps.length - 1)
    setError(null)
    enterHeat(nextIndex, 1)
    if (steps[nextIndex].kind === "summary") saveHeat(draft)
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await settledWrites()
      if (writes.heatSavedVersion < writes.heatVersion) {
        const body = toDiscoveryHeatStyling(heat)
        if (body) await saveIntakeHeatStyling(body)
        writes.heatSavedVersion = writes.heatVersion
      }
      await submitIntakeConfirmingNone()
      go("done", 1)
    } catch (caught) {
      if (isAlreadySubmitted(caught)) go("done", 1)
      else setError(SUBMIT_ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  let body
  if (screen === "done") {
    body = <DiscoveryIntakeThanks />
  } else if (screen === "routine") {
    body = (
      <DiscoveryRoutineScreen
        items={items}
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
        submitting={submitting}
        error={error}
        onBack={() => {
          if (submitting) return
          setError(null)
          if (heatIndex === 0) go("routine", -1)
          else enterHeat(heatIndex - 1, -1)
        }}
        onNext={() => advanceHeat(heat)}
        onDrying={(dryingRoutes) => setHeat({ ...heat, dryingRoutes })}
        onTools={(additionalHeatTools) => setHeat({ ...heat, additionalHeatTools })}
        onFrequency={(source, frequency) => {
          const next = setHeatEvent(heat, source, { frequency })
          setHeat(next)
          advanceHeat(next)
        }}
        onProtection={(source, protectionConsistency) => {
          const next = setHeatEvent(heat, source, { protectionConsistency })
          setHeat(next)
          advanceHeat(next)
        }}
        onSubmit={() => void handleSubmit()}
        onEditProducts={() => {
          if (!submitting) go("products", -1)
        }}
        onEditHeat={() => {
          if (!submitting) enterHeat(0, -1)
        }}
      />
    )
  } else {
    body = (
      <DiscoveryProductsScreen
        items={items}
        error={error}
        cameraBlocked={cameraBlocked}
        landedKey={landedKey}
        itemKeys={itemKeys}
        removingIds={removingIds}
        removeFailedId={removeFailedId}
        continuing={continuing}
        onSearch={(slot: DiscoveryProductSlot | null) => openSheet(openAddSearch(slot))}
        onScan={() => openSheet(openAddScan())}
        onEdit={(item) => openSheet(openAddEdit(item, items))}
        onFrequency={(item) => openSheet(openAddEdit(item, items, { frequencyOnly: true }))}
        onRemove={(itemId) => handleRemove(itemId)}
        onContinue={() => void continueFromProducts()}
      />
    )
  }

  return (
    <>
      <SlideStage
        stepKey={screen}
        direction={screenDirection}
        variant="screen"
        surfaceClassName="bg-[#faf8f6]"
      >
        {body}
      </SlideStage>
      {screen === "done" ? null : (
        <DiscoveryAddSheet
          open={sheetOpen}
          session={sheetSession}
          flow={flow}
          busy={sheetBusy}
          rejections={sheetRejections}
          error={sheetError}
          retailerSearchEnabled={retailerSearchEnabled}
          scannerRuntime={scannerRuntime}
          handlers={sheetHandlers}
        />
      )}
    </>
  )
}
