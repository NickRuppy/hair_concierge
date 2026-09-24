"use client"

import { ChevronDown, X } from "lucide-react"

import { ScanProductThumb } from "@/components/scan/scan-product-thumb"

import type { DiscoveryIntakeItemView } from "./types"
import {
  beginChange,
  isProductItem,
  itemDisplayName,
  itemDisplaySubline,
  usagePillLabel,
} from "./usage-flow"

/**
 * Her products, one card each (Variante A): packshot, name, the coral usage pill and
 * the remove X. The pill is a button only when there is something to change — a product
 * type without a usage question (heat protectant, dry shampoo, …) shows it as plain text.
 */

const PILL =
  "inline-flex items-center gap-1 rounded-full bg-[var(--brand-coral-light)] py-1 pl-2.5 pr-2 text-[12.5px] font-semibold text-[var(--brand-coral-deeper)]"

export function DiscoveryUsagePill({
  item,
  disabled,
  onChange,
}: {
  item: DiscoveryIntakeItemView
  disabled: boolean
  onChange: (item: DiscoveryIntakeItemView) => void
}) {
  const label = usagePillLabel(item)
  if (!beginChange(item)) {
    return (
      <span className="mt-1.5 inline-flex">
        <span className={PILL}>{label}</span>
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onChange(item)}
      disabled={disabled}
      aria-label={`${label} – ändern`}
      className="-my-1.5 -ml-0.5 inline-flex min-h-[44px] items-center rounded-full px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-60"
    >
      <span className={PILL}>
        {label}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  )
}

export function DiscoveryProductList({
  items,
  busy,
  onChange,
  onRemove,
}: {
  items: DiscoveryIntakeItemView[]
  busy: boolean
  onChange: (item: DiscoveryIntakeItemView) => void
  onRemove: (itemId: string) => void
}) {
  const products = items.filter(isProductItem)
  if (products.length === 0) return null
  return (
    <ul className="flex flex-col gap-2">
      {products.map((item) => {
        const title = itemDisplayName(item)
        const subline = itemDisplaySubline(item)
        return (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-[14px] border border-[#e8e3dd] bg-white py-2.5 pl-3 pr-1"
          >
            <ScanProductThumb imageUrl={item.imageUrl ?? null} label={title} size={44} />
            <div className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
                {title}
              </span>
              {subline ? (
                <span className="mt-0.5 block truncate text-xs text-[var(--text-caption)]">
                  {subline}
                </span>
              ) : null}
              <DiscoveryUsagePill item={item} disabled={busy} onChange={onChange} />
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={busy}
              aria-label={`${title} entfernen`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-sub)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
