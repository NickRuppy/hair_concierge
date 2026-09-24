"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  DISCOVERY_INTAKE_CATEGORY_COPY,
  DISCOVERY_INTAKE_GROUPS,
} from "@/components/discovery/intake/categories"
import { ScanProductThumb } from "@/components/scan/scan-product-thumb"
import type { DiscoveryCockpitIntakeProductView } from "@/lib/discovery/cockpit"
import type { DiscoveryResearchStatusKind } from "@/lib/discovery/research-status"

import { useDiscoveryDecisionWritePending } from "./decision-writes"

/**
 * „Eingetragene Produkte": everything the participant captured, at the top of the call —
 * packshot, the product's name, the shelf it sits on and where its research stands.
 *
 * „Recherche starten" only QUEUES research (`/api/admin/beratung/<id>/research`); the work
 * runs in the local review center, which the hint under the title names. The route decides
 * server-side what starting means for the item and answers with its new status.
 */

const TITLE = "Eingetragene Produkte"
const RESEARCH_HINT =
  "Recherchen laufen nur, solange lokal das Review-Center läuft: npm run products:intake:review-center"
const START_LABEL = "Recherche starten"
const START_BUSY = "Wird gestartet …"
const START_ERROR = "Nicht gestartet. Bitte noch einmal."
const EMPTY = "Noch keine Produkte eingetragen."

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

function shelfSorted(products: DiscoveryCockpitIntakeProductView[]) {
  // Stable: within a shelf, capture order stays.
  return [...products].sort(
    (left, right) => SHELF_ORDER.indexOf(left.category) - SHELF_ORDER.indexOf(right.category),
  )
}

export function DiscoveryIntakeProducts({
  enrollmentId,
  products,
}: {
  enrollmentId: string
  products: DiscoveryCockpitIntakeProductView[]
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
                <span className="block text-[12px] text-muted-foreground">
                  {DISCOVERY_INTAKE_CATEGORY_COPY[row.category].label}
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
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
