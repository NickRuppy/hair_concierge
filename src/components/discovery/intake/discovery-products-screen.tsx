"use client"

import { Plus, Search, X } from "lucide-react"

import { Icon } from "@/components/ui/icon"
import { REFINEMENT_CATEGORY_OPTIONS } from "@/components/personal-plan-refinement/refinement-options"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { cn } from "@/lib/utils"

import {
  capsuleLabel,
  categoryLabel,
  DISCOVERY_PRODUCT_SLOTS,
  frequencyLine,
  isProductItem,
  itemDisplayName,
  itemSubject,
  needsFrequency,
  slotOf,
  type DiscoveryProductSlot,
} from "./add-flow"
import { DiscoveryPackshot } from "./discovery-motion"
import type { DiscoveryIntakeItemView } from "./types"
import { CORAL_BUTTON, CTA_BAR, SCREEN_TITLE } from "./ui-classes"

/**
 * „Deine Produkte" (batch 7, C1/C3): title only, search + „Scannen", and ghost slots for the
 * six everyday categories that turn into iOS-style product cards as she adds — the page
 * visibly fills up. Sticky coral „Weiter" once one product is in.
 */

export const PRODUCTS_TITLE = "Deine Produkte"
export const SEARCH_LABEL = "Produkt suchen"
export const SCAN_LABEL = "Scannen"
export const MORE_LABEL = "Weiteres"
export const CONTINUE_LABEL = "Weiter"
export const FREQUENCY_PILL_LABEL = "Wie oft?"
const CAMERA_ERROR = "Die Kamera geht hier nicht. Such das Produkt einfach."

const CATEGORY_ICONS = Object.fromEntries(
  REFINEMENT_CATEGORY_OPTIONS.map((option) => [option.value, option.icon]),
) as Record<PersonalPlanCategory, (typeof REFINEMENT_CATEGORY_OPTIONS)[number]["icon"]>

export type DiscoveryGridEntry =
  | { kind: "ghost"; slot: DiscoveryProductSlot }
  | { kind: "card"; item: DiscoveryIntakeItemView }
  | { kind: "more" }

/** Slots in shelf order — her products in the slot they belong to — then the rest, then „+". */
export function discoveryGridEntries(
  items: readonly DiscoveryIntakeItemView[],
): DiscoveryGridEntry[] {
  const products = items.filter(isProductItem)
  const entries: DiscoveryGridEntry[] = []
  for (const slot of DISCOVERY_PRODUCT_SLOTS) {
    const inSlot = products.filter((item) => slotOf(item) === slot)
    if (inSlot.length === 0) entries.push({ kind: "ghost", slot })
    else for (const item of inSlot) entries.push({ kind: "card", item })
  }
  for (const item of products) {
    if (slotOf(item) === null) entries.push({ kind: "card", item })
  }
  entries.push({ kind: "more" })
  return entries
}

function BarcodeGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M8 8.5v7M11 8.5v7M14 8.5v7M16.5 8.5v7" />
    </svg>
  )
}

export function DiscoveryProductCard({
  item,
  busy,
  landed,
  onEdit,
  onFrequency,
  onRemove,
}: {
  item: DiscoveryIntakeItemView
  busy: boolean
  landed: boolean
  onEdit: (item: DiscoveryIntakeItemView) => void
  onFrequency: (item: DiscoveryIntakeItemView) => void
  onRemove: (itemId: string) => void
}) {
  const subject = itemSubject(item)
  const title = itemDisplayName(item)
  const frequency = frequencyLine(item)
  return (
    <li
      className={cn(
        "relative col-span-2 rounded-[20px] border border-border bg-white shadow-[0_1px_2px_rgba(42,24,69,0.04),0_8px_22px_rgba(42,24,69,0.05)]",
        landed && "discovery-land",
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(item)}
        disabled={busy}
        aria-label={`${title} bearbeiten`}
        className="absolute inset-0 z-0 rounded-[20px] transition-colors active:bg-[#fcfbfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
      />
      <div className="pointer-events-none relative z-10 flex items-center gap-3.5 py-3 pl-3 pr-12">
        <DiscoveryPackshot
          imageUrl={item.imageUrl}
          category={item.category}
          className="h-[92px] w-[76px]"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          {subject.brandLine ? (
            <span className="truncate text-xs font-medium text-[var(--text-sub)]">
              {subject.brandLine}
            </span>
          ) : null}
          <span className="line-clamp-2 break-words text-[15px] font-bold leading-[1.3] text-[var(--brand-plum-darkest)] hyphens-auto">
            {subject.name}
          </span>
          <span className="mt-1 self-start whitespace-nowrap rounded-full bg-[var(--brand-plum-ice)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-plum)]">
            {capsuleLabel(item)}
          </span>
          {needsFrequency(item) ? (
            <button
              type="button"
              onClick={() => onFrequency(item)}
              disabled={busy}
              className="pointer-events-auto -my-1.5 mt-0 inline-flex min-h-[44px] items-center self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] rounded-full"
            >
              <span className="rounded-full border-[1.5px] border-[var(--brand-plum)] px-2.5 py-[3px] text-[12.5px] font-bold text-[var(--brand-plum)]">
                {FREQUENCY_PILL_LABEL}
              </span>
            </button>
          ) : frequency ? (
            <span className="mt-[3px] text-[12.5px] leading-snug text-[var(--text-sub)]">
              {frequency}
            </span>
          ) : null}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        disabled={busy}
        aria-label={`${title} entfernen`}
        className="absolute right-0.5 top-0.5 z-20 flex h-11 w-11 items-center justify-center rounded-full text-[#aaa19a] active:bg-[#f4f0ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-50"
      >
        <X className="h-[17px] w-[17px]" strokeWidth={1.9} aria-hidden="true" />
      </button>
    </li>
  )
}

export function DiscoveryProductsScreen({
  items,
  busy,
  error,
  cameraBlocked,
  landedItemId,
  onSearch,
  onScan,
  onEdit,
  onFrequency,
  onRemove,
  onContinue,
}: {
  items: DiscoveryIntakeItemView[]
  busy: boolean
  error: string | null
  cameraBlocked: boolean
  /** The card that just landed in its slot (one-off entrance). */
  landedItemId: string | null
  onSearch: (slot: DiscoveryProductSlot | null) => void
  onScan: () => void
  onEdit: (item: DiscoveryIntakeItemView) => void
  onFrequency: (item: DiscoveryIntakeItemView) => void
  onRemove: (itemId: string) => void
  onContinue: () => void
}) {
  const hasProducts = items.some(isProductItem)
  return (
    <main className="flex min-h-dvh flex-col bg-[#faf8f6]">
      <div className="flex-1 px-4 pb-8 pt-10">
        <h1 className={cn("mb-3.5", SCREEN_TITLE)}>{PRODUCTS_TITLE}</h1>

        <div className="sticky top-0 z-20 -mx-4 flex gap-2 bg-[linear-gradient(#faf8f6_76%,rgba(250,248,246,0))] px-4 pb-4 pt-1.5">
          <button
            type="button"
            onClick={() => onSearch(null)}
            disabled={busy}
            className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-[15px] border border-border bg-white px-3.5 text-left text-[15.5px] text-[var(--text-sub)] shadow-[0_1px_2px_rgba(42,24,69,0.04),0_6px_16px_rgba(42,24,69,0.05)] transition active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-50"
          >
            <Search
              className="h-5 w-5 shrink-0 text-[var(--brand-plum)]"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <span className="truncate">{SEARCH_LABEL}</span>
          </button>
          <button
            type="button"
            onClick={onScan}
            disabled={busy || cameraBlocked}
            className="flex h-[50px] shrink-0 items-center gap-2 rounded-[15px] bg-[var(--brand-plum-darkest)] pl-3.5 pr-4 text-[15px] font-bold text-white transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <BarcodeGlyph />
            {SCAN_LABEL}
          </button>
        </div>
        {cameraBlocked ? (
          <p className="-mt-2 mb-3 text-center text-xs leading-5 text-[var(--text-sub)]">
            {CAMERA_ERROR}
          </p>
        ) : null}

        <ul className="grid grid-cols-2 gap-2.5 [grid-auto-flow:row_dense]">
          {discoveryGridEntries(items).map((entry) => {
            if (entry.kind === "card") {
              return (
                <DiscoveryProductCard
                  key={entry.item.id}
                  item={entry.item}
                  busy={busy}
                  landed={entry.item.id === landedItemId}
                  onEdit={onEdit}
                  onFrequency={onFrequency}
                  onRemove={onRemove}
                />
              )
            }
            if (entry.kind === "more") {
              return (
                <li key="more" className="col-span-2">
                  <button
                    type="button"
                    onClick={() => onSearch(null)}
                    disabled={busy}
                    className="flex h-[54px] w-full items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-[rgba(107,80,160,0.18)] text-[14.5px] font-semibold text-[var(--brand-plum)] transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-50"
                  >
                    <Plus className="h-[18px] w-[18px] opacity-70" aria-hidden="true" />
                    {MORE_LABEL}
                  </button>
                </li>
              )
            }
            return (
              <li key={`ghost-${entry.slot}`}>
                <button
                  type="button"
                  onClick={() => onSearch(entry.slot)}
                  disabled={busy}
                  className="flex h-[112px] w-full flex-col items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-[rgba(107,80,160,0.26)] bg-[rgba(242,238,250,0.62)] text-sm font-semibold text-[var(--brand-plum)] transition active:scale-[0.97] active:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-50"
                >
                  <Icon name={CATEGORY_ICONS[entry.slot]} size={26} className="opacity-50" />
                  {categoryLabel(entry.slot)}
                </button>
              </li>
            )
          })}
        </ul>

        {error ? (
          <p role="alert" className="mt-4 text-center text-sm text-[var(--brand-coral-dark)]">
            {error}
          </p>
        ) : null}
      </div>

      {hasProducts ? (
        <div className={cn(CTA_BAR, "discovery-cta-in")}>
          <button type="button" onClick={onContinue} disabled={busy} className={CORAL_BUTTON}>
            {CONTINUE_LABEL}
          </button>
        </div>
      ) : null}
    </main>
  )
}
