"use client"

import { ScanProductThumb } from "@/components/scan/scan-product-thumb"
import { Button } from "@/components/ui/button"

import type { DiscoveryIntakeItemView } from "./types"
import {
  beginChange,
  itemDisplayName,
  missingCategoryLabels,
  reviewGroups,
  usagePillLabel,
} from "./usage-flow"

/**
 * „Passt das so?" (R6): her products grouped by how she uses them, each row changeable
 * through the same sheets as the list, and what she left empty. „Stimmt so – abschicken"
 * confirms the empty categories as „benutzt sie nicht" in the one submit call.
 */

const TITLE = "Passt das so?"
const LEDE = "Tipp an, was nicht stimmt."
const CHANGE_LABEL = "Ändern"
const MISSING_LABEL = "Nichts eingetragen für:"
const SUBMIT_LABEL = "Stimmt so – abschicken"
const SUBMIT_BUSY_LABEL = "Wird gesendet"
const BACK_LABEL = "Noch was ergänzen"

function ReviewRowContent({ item }: { item: DiscoveryIntakeItemView }) {
  const title = itemDisplayName(item)
  // Inside a usage group the pill would only repeat the heading — except for an oil role,
  // which says WHEN she uses it.
  const shown = item.usageRole ? usagePillLabel(item) : null
  return (
    <>
      <ScanProductThumb imageUrl={item.imageUrl ?? null} label={title} size={44} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
          {title}
        </span>
        {shown ? (
          <span className="mt-0.5 block text-xs text-[var(--text-caption)]">{shown}</span>
        ) : null}
      </span>
    </>
  )
}

export function DiscoveryIntakeReview({
  items,
  submitting,
  error,
  onChange,
  onSubmit,
  onBack,
}: {
  items: DiscoveryIntakeItemView[]
  submitting: boolean
  error: string | null
  onChange: (item: DiscoveryIntakeItemView) => void
  onSubmit: () => void
  onBack: () => void
}) {
  const groups = reviewGroups(items)
  const missing = missingCategoryLabels(items)

  return (
    <main className="flex min-h-dvh flex-col bg-[#fbf9f7]">
      <div className="flex-1 px-5 pb-6 pt-7">
        <p className="mb-6 font-header text-[15px] tracking-[0.02em] text-[var(--brand-plum)]">
          Chaarlie
        </p>
        <h1 className="font-header text-2xl leading-tight text-[var(--brand-plum-darkest)]">
          {TITLE}
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-[var(--text-sub)]">{LEDE}</p>

        {groups.map((group) => (
          <section key={group.key} className="mt-5">
            <h2 className="mb-2 pl-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-caption)]">
              {group.label}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item.id}>
                  {beginChange(item) ? (
                    <button
                      type="button"
                      onClick={() => onChange(item)}
                      disabled={submitting}
                      className="flex min-h-[64px] w-full items-center gap-3 rounded-[14px] border border-[#e8e3dd] bg-white py-2.5 pl-3 pr-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-60"
                    >
                      <ReviewRowContent item={item} />
                      <span className="shrink-0 text-[13px] font-semibold text-[var(--brand-plum)]">
                        {CHANGE_LABEL}
                      </span>
                    </button>
                  ) : (
                    <div className="flex min-h-[64px] items-center gap-3 rounded-[14px] border border-[#e8e3dd] bg-white py-2.5 pl-3 pr-3.5">
                      <ReviewRowContent item={item} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {missing.length > 0 ? (
          <div className="mt-6 rounded-[14px] bg-[#f3efea] px-4 py-3.5">
            <p className="mb-1 text-[13px] font-semibold text-[var(--text-sub)]">{MISSING_LABEL}</p>
            <p className="text-[15px] leading-relaxed text-[var(--brand-plum-darkest)]">
              {missing.join(" · ")}
            </p>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 border-t border-[#efeae4] bg-[#fbf9f7] px-5 pb-6 pt-3.5">
        {error ? (
          <p role="alert" className="mb-3 text-center text-sm text-[var(--brand-coral-dark)]">
            {error}
          </p>
        ) : null}
        <Button type="button" variant="funnelCta" onClick={onSubmit} disabled={submitting}>
          {submitting ? SUBMIT_BUSY_LABEL : SUBMIT_LABEL}
        </Button>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="mt-1.5 min-h-[44px] w-full text-[15px] font-semibold text-[var(--brand-plum-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-60"
        >
          {BACK_LABEL}
        </button>
      </div>
    </main>
  )
}
