"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { DISCOVERY_INTAKE_GROUPS } from "@/components/discovery/intake/categories"
import { ScanProductThumb } from "@/components/scan/scan-product-thumb"
import type { DiscoveryCockpitIntakeProductView } from "@/lib/discovery/cockpit"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"
import type { DiscoveryResearchStatusKind } from "@/lib/discovery/research-status"

import { beginDiscoveryDecisionWrite, useDiscoveryDecisionWritePending } from "./decision-writes"
import {
  DISCOVERY_CATEGORY_OPEN_LABEL,
  discoveryCategoryLabel,
  discoveryCockpitUsageOptions,
  discoveryDefaultUsageFor,
  discoveryUsageDifferenceLabel,
  discoveryUsageLabel,
  discoveryUsageValue,
} from "./usage-options"

/**
 * „Eingetragene Produkte": everything the participant captured, at the top of the call —
 * packshot, the product's name, the shelf it sits on and where its research stands.
 *
 * „Recherche starten" only QUEUES research (`/api/admin/beratung/<id>/research`); the work
 * runs in the local review center, which the hint under the title names. The route decides
 * server-side what starting means for the item and answers with its new status.
 *
 * Batch 5: each row names her USAGE („Maske", „Öl · Als Finish ins trockene Haar") and, when
 * it differs from what the product is, both („Benutzt als Maske · Produkt: Conditioner").
 * A product whose usage nobody knows reads „Kategorie offen" with the product type and usage
 * selects already open (R7); every other row can be corrected via „Kategorie ändern" once
 * she submitted (R10). Both save through `PATCH /api/admin/beratung/<id>/items/<itemId>`,
 * which refuses while the call is finalised.
 */

const TITLE = "Eingetragene Produkte"
const RESEARCH_HINT =
  "Recherchen laufen nur, solange lokal das Review-Center läuft: npm run products:intake:review-center"
const START_LABEL = "Recherche starten"
const START_BUSY = "Wird gestartet …"
const START_ERROR = "Nicht gestartet. Bitte noch einmal."
const EMPTY = "Noch keine Produkte eingetragen."
const CHANGE_LABEL = "Kategorie ändern"
const TYPE_LABEL = "Produkttyp"
const TYPE_PLACEHOLDER = "Was ist das?"
const USAGE_LABEL = "Benutzt als"
const USAGE_PLACEHOLDER = "Bitte wählen"
const SAVE_LABEL = "Speichern"
const SAVE_BUSY = "Wird gespeichert …"
const CANCEL_LABEL = "Abbrechen"
const SAVE_ERROR = "Nicht gespeichert. Bitte noch einmal."
const FINALIZED_HINT = "Erst Finalisierung aufheben."

const SHELF_ORDER = DISCOVERY_INTAKE_GROUPS.flatMap((group) =>
  group.categories.map((category) => category.key),
)

type Tone = "ok" | "pending" | "danger" | "neutral"

const TONE: Record<DiscoveryResearchStatusKind, Tone> = {
  in_catalog: "ok",
  research_linked: "ok",
  research_approved_ineligible: "danger",
  research_rejected: "danger",
  research_withdrawn: "neutral",
  research_queued: "pending",
  research_running: "pending",
  research_review: "pending",
  research_rework: "pending",
  research_publishing: "pending",
  research_needs_info: "pending",
  research_failed: "danger",
  research_blocked: "danger",
  research_exhausted: "danger",
  research_not_started: "neutral",
  research_unknown: "neutral",
  barcode_only: "neutral",
  no_research: "neutral",
  not_researchable: "neutral",
  type_unknown: "neutral",
  status_unavailable: "neutral",
}

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
}

type RowStatus = Pick<
  DiscoveryCockpitIntakeProductView,
  "status" | "statusLabel" | "canStartResearch"
>

export type DiscoveryResearchStartBody = {
  status?: { kind: DiscoveryResearchStatusKind; label: string; canStartResearch: boolean }
  identityChanged?: boolean
} | null

/**
 * What a research-start answer means for the list, pure so it can be tested:
 *
 *  - `row` — the item's new badge (a 409 carries the current status too);
 *  - `refresh` — the item's product or submission changed (ours or a concurrent start's):
 *    its name, verdict, routine step and the fingerprint finalize will use are all stale,
 *    so the whole cockpit reloads from the server rather than just the badge;
 *  - `failed` — nothing usable came back.
 */
export function discoveryResearchStartOutcome(
  ok: boolean,
  body: DiscoveryResearchStartBody,
): { row: RowStatus | null; refresh: boolean; failed: boolean } {
  const status = body?.status ?? null
  return {
    row: status
      ? {
          status: status.kind,
          statusLabel: status.label,
          canStartResearch: status.canStartResearch,
        }
      : null,
    refresh: body?.identityChanged === true,
    failed: !ok && !status,
  }
}

function shelfRank(category: PersonalPlanCategory | null): number {
  // „Kategorie offen" last, where the finalize block points.
  return category === null ? SHELF_ORDER.length : SHELF_ORDER.indexOf(category)
}

function shelfSorted(products: DiscoveryCockpitIntakeProductView[]) {
  // Stable: within a shelf, capture order stays.
  return [...products].sort((left, right) => shelfRank(left.category) - shelfRank(right.category))
}

/** How a row names her usage — and the product type when the two differ. */
export function discoveryIntakeProductUsageLine(
  product: Pick<DiscoveryCockpitIntakeProductView, "category" | "usageRole" | "productType">,
): string {
  if (product.category === null) return DISCOVERY_CATEGORY_OPEN_LABEL
  return (
    discoveryUsageDifferenceLabel(product.category, product.productType) ??
    discoveryUsageLabel({ category: product.category, role: product.usageRole })
  )
}

/** What a usage answer means for the row: a refusal explains itself, a success refreshes. */
export function discoveryUsageWriteOutcome(
  ok: boolean,
  body: { code?: string } | null,
): { error: string | null; refresh: boolean } {
  if (ok) return { error: null, refresh: true }
  return { error: body?.code === "finalized" ? FINALIZED_HINT : SAVE_ERROR, refresh: false }
}

export function DiscoveryIntakeProducts({
  enrollmentId,
  products,
  editable = false,
  finalized = false,
}: {
  enrollmentId: string
  products: DiscoveryCockpitIntakeProductView[]
  /** Submitted: the cockpit may correct usages (R10). A draft is still hers. */
  editable?: boolean
  /** While finalised, corrections are refused — the controls say so instead. */
  finalized?: boolean
}) {
  const router = useRouter()
  // A research refresh would remount the decision panel mid-write: wait until it settles.
  const decisionWritePending = useDiscoveryDecisionWritePending()
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const rows = shelfSorted(products).map((product) => ({
    ...product,
    ...(statuses[product.itemId] ?? {}),
  }))
  const showHint = rows.some(
    (row) => row.status !== "in_catalog" && row.status !== "research_linked",
  )

  async function start(itemId: string) {
    setPending(itemId)
    setFailed(null)
    try {
      const response = await fetch(`/api/admin/beratung/${enrollmentId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      })
      const body = (await response.json().catch(() => null)) as DiscoveryResearchStartBody
      const outcome = discoveryResearchStartOutcome(response.ok, body)
      if (outcome.row) {
        const row = outcome.row
        setStatuses((current) => ({ ...current, [itemId]: row }))
      }
      if (outcome.failed) setFailed(itemId)
      // Re-renders the server page; the state key then remounts the decision island too.
      if (outcome.refresh) router.refresh()
    } catch {
      setFailed(itemId)
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {TITLE}
        </h2>
        {showHint ? (
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{RESEARCH_HINT}</p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-muted-foreground">{EMPTY}</p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.itemId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <ScanProductThumb imageUrl={row.imageUrl} label={row.label} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-foreground">
                  {row.label}
                </span>
                <span
                  className={`block text-[12px] ${
                    row.category === null
                      ? "font-bold text-[var(--status-danger-text)]"
                      : "text-muted-foreground"
                  }`}
                >
                  {discoveryIntakeProductUsageLine(row)}
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE_CLASS[TONE[row.status]]}`}
              >
                {row.statusLabel}
              </span>
              {row.canStartResearch ? (
                <button
                  type="button"
                  onClick={() => void start(row.itemId)}
                  disabled={pending !== null || decisionWritePending}
                  className="rounded-lg border border-[var(--brand-plum)] px-3 py-1.5 text-xs font-bold text-[var(--brand-plum)] disabled:opacity-50"
                >
                  {pending === row.itemId ? START_BUSY : START_LABEL}
                </button>
              ) : null}
              {failed === row.itemId ? (
                <p role="status" className="w-full text-[12px] text-[var(--status-danger-text)]">
                  {START_ERROR}
                </p>
              ) : null}
              {editable ? (
                <UsageEditor
                  enrollmentId={enrollmentId}
                  product={row}
                  finalized={finalized}
                  blocked={pending !== null || decisionWritePending}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * „Kategorie offen" (open from the start) or „Kategorie ändern" (behind a text button):
 * product type — only when nobody knows it — and usage, saved together. A newly chosen
 * type preselects its usage the way the participant's own question would (F5).
 */
function UsageEditor({
  enrollmentId,
  product,
  finalized,
  blocked,
}: {
  enrollmentId: string
  product: DiscoveryCockpitIntakeProductView
  finalized: boolean
  blocked: boolean
}) {
  const router = useRouter()
  const categoryOpen = product.category === null
  const current = product.category ? { category: product.category, role: product.usageRole } : null
  const initialUsage = current ?? discoveryDefaultUsageFor(product.productType, product.productName)
  const [open, setOpen] = useState(categoryOpen)
  const [productType, setProductType] = useState<PersonalPlanCategory | "">("")
  const [usageValue, setUsageValue] = useState(
    initialUsage ? discoveryUsageValue(initialUsage) : "",
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = discoveryCockpitUsageOptions(current)
  const chosen = options.find((option) => option.value === usageValue) ?? null
  const needsType = product.typeOpen
  const ready = chosen !== null && (!needsType || productType !== "")

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={finalized}
        title={finalized ? FINALIZED_HINT : undefined}
        className="text-xs font-bold text-[var(--brand-plum)] underline disabled:opacity-50"
      >
        {CHANGE_LABEL}
      </button>
    )
  }

  function chooseType(value: PersonalPlanCategory | "") {
    setProductType(value)
    const preselected = value ? discoveryDefaultUsageFor(value, product.productName) : null
    setUsageValue(preselected ? discoveryUsageValue(preselected) : "")
  }

  async function save() {
    if (!chosen) return
    setSaving(true)
    setError(null)
    const endWrite = beginDiscoveryDecisionWrite()
    try {
      const response = await fetch(`/api/admin/beratung/${enrollmentId}/items/${product.itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usage: chosen.usage,
          ...(needsType && productType ? { productType } : {}),
        }),
      })
      const body = response.ok
        ? null
        : ((await response.json().catch(() => null)) as { code?: string } | null)
      const outcome = discoveryUsageWriteOutcome(response.ok, body)
      if (outcome.error) setError(outcome.error)
      // Binding, decisions, „benutzt sie nicht" and the fingerprint all move: reload it all.
      if (outcome.refresh) router.refresh()
    } catch {
      setError(SAVE_ERROR)
    } finally {
      endWrite()
      setSaving(false)
    }
  }

  const disabled = finalized || saving || blocked
  return (
    <div className="flex w-full flex-wrap items-end gap-2 pl-[52px]">
      {needsType ? (
        <label className="flex flex-col gap-0.5 text-[11px] font-bold text-muted-foreground">
          {TYPE_LABEL}
          <select
            value={productType}
            disabled={disabled}
            onChange={(event) => chooseType(event.target.value as PersonalPlanCategory | "")}
            className="rounded-lg border bg-card px-2 py-1.5 text-xs font-normal text-foreground"
          >
            <option value="">{TYPE_PLACEHOLDER}</option>
            {SUPPORTED_PRODUCT_CATEGORY_KEYS.map((category) => (
              <option key={category} value={category}>
                {discoveryCategoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex flex-col gap-0.5 text-[11px] font-bold text-muted-foreground">
        {USAGE_LABEL}
        <select
          value={usageValue}
          disabled={disabled}
          onChange={(event) => setUsageValue(event.target.value)}
          className="rounded-lg border bg-card px-2 py-1.5 text-xs font-normal text-foreground"
        >
          <option value="">{USAGE_PLACEHOLDER}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={disabled || !ready}
        className="rounded-lg bg-[var(--brand-plum)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        {saving ? SAVE_BUSY : SAVE_LABEL}
      </button>
      {categoryOpen ? null : (
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          disabled={saving}
          className="text-xs text-muted-foreground underline"
        >
          {CANCEL_LABEL}
        </button>
      )}
      {finalized ? (
        <p className="w-full text-[12px] text-muted-foreground">{FINALIZED_HINT}</p>
      ) : null}
      {error ? (
        <p role="status" className="w-full text-[12px] text-[var(--status-danger-text)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
