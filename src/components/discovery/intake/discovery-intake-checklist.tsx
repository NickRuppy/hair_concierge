"use client"

import { Check, ChevronRight } from "lucide-react"
import { useState } from "react"

import type { ScannerRuntime } from "@/components/scan/scanner"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

import {
  DISCOVERY_INTAKE_CATEGORY_COUNT,
  DISCOVERY_INTAKE_CATEGORY_COPY,
  DISCOVERY_INTAKE_GROUPS,
} from "./categories"
import { DiscoveryProductEntry } from "./discovery-product-entry"
import { submitIntake } from "./intake-api"
import type { DiscoveryIntakeItemView } from "./types"

/**
 * The participant checklist (mockup frames A, D and E).
 *
 * One job per screen: the overview collects what the participant uses, a
 * category screen answers „was benutzt du hier?".
 *
 * Nothing is mandatory. The one CTA, „Fertig – abschicken", appears as soon as ONE
 * category carries an answer (a product or an explicit „benutze ich nicht"); the
 * server re-checks that same „at least one" from the stored rows. A category the
 * participant never touched stays honestly unanswered — no tick, no stored row —
 * and the call covers it (the caption under the CTA says so while anything is
 * open). There is deliberately no counter or progress bar: „3 von 10" read as ten
 * required answers.
 *
 * Optimistic state mirrors the server's own replacement rule exactly: a category
 * is either „benutze ich nicht" or a non-empty product list, never both.
 */

const TITLE = "Was benutzt du gerade?"
const LEDE = "Trag ein, was du benutzt. Scannen oder Namen tippen."
const SUBMIT_LABEL = "Fertig – abschicken"
const SUBMIT_BUSY_LABEL = "Wird gesendet"
const SUBMIT_ERROR = "Das Absenden hat nicht geklappt. Versuch es nochmal."
const OPEN_CAPTION = "Was fehlt, klären wir im Call."
const NONE_STATE = "benutze ich nicht"
const CONFIRM_TITLE = "Danke!"
const CONFIRM_BODY = "Wir bereiten deinen Termin vor."
const CONFIRM_FOOT = "Mehr musst du vorher nicht machen."

function categoryState(items: DiscoveryIntakeItemView[]): string | null {
  if (items.length === 0) return null
  if (items.some((item) => item.source === "none")) return NONE_STATE
  if (items.length > 1) return `${items.length} Produkte`
  // Answered rows show the brand, not the full product name — the overview is a
  // progress view, the detail screen is where the products live.
  return items[0].brandText ?? "1 Produkt"
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
  scannerRuntime?: ScannerRuntime
}) {
  const [items, setItems] = useState(initialItems)
  const [openCategory, setOpenCategory] = useState<PersonalPlanCategory | null>(null)
  const [submitted, setSubmitted] = useState(initialSubmitted)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const answeredCount = new Set(items.map((item) => item.category)).size
  const canSubmit = answeredCount > 0
  const somethingOpen = answeredCount < DISCOVERY_INTAKE_CATEGORY_COUNT

  function handleAdded(item: DiscoveryIntakeItemView) {
    setItems((previous) => [
      ...previous.filter((existing) => {
        if (existing.category !== item.category) return true
        // Mirrors the server: „benutze ich nicht" replaces the products, and a
        // product replaces a standing „benutze ich nicht".
        return item.source === "none" ? false : existing.source !== "none"
      }),
      item,
    ])
  }

  function handleRemoved(itemId: string) {
    setItems((previous) => previous.filter((existing) => existing.id !== itemId))
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await submitIntake()
      setSubmitted(true)
    } catch {
      setError(SUBMIT_ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-dvh flex-col bg-[#fbf9f7] px-5 pb-6 pt-7">
        <p className="font-header text-[15px] tracking-[0.02em] text-[var(--brand-plum)]">
          Chaarlie
        </p>
        <div className="flex flex-1 flex-col items-center justify-center px-3 pb-14 text-center">
          <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
            <Check className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="font-header text-2xl text-[var(--brand-plum-darkest)]">{CONFIRM_TITLE}</h1>
          <p className="mt-2.5 max-w-[250px] text-[15px] leading-relaxed text-[var(--text-sub)]">
            {CONFIRM_BODY}
          </p>
          <p className="mt-7 text-[13px] text-[var(--text-caption)]">{CONFIRM_FOOT}</p>
        </div>
      </main>
    )
  }

  if (openCategory) {
    return (
      <main>
        <DiscoveryProductEntry
          category={DISCOVERY_INTAKE_CATEGORY_COPY[openCategory]}
          items={items.filter((item) => item.category === openCategory)}
          retailerSearchEnabled={retailerSearchEnabled}
          onAdded={handleAdded}
          onRemoved={handleRemoved}
          onBack={() => setOpenCategory(null)}
          scannerRuntime={scannerRuntime}
        />
      </main>
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
        <p className="mb-2 mt-1.5 text-sm leading-6 text-[var(--text-sub)]">{LEDE}</p>

        {DISCOVERY_INTAKE_GROUPS.map((group) => (
          // The gap belongs to the SECTION. On the heading it did nothing: an `h2` is
          // always the first child of its own section, so `first:mt-0` there killed the
          // gap above every group instead of only the first one.
          <section key={group.label} className="mt-4">
            <h2 className="mb-2 pl-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-caption)]">
              {group.label}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.categories.map((category) => {
                const categoryItems = items.filter((item) => item.category === category.key)
                const state = categoryState(categoryItems)
                return (
                  <li key={category.key}>
                    <button
                      type="button"
                      onClick={() => setOpenCategory(category.key)}
                      // Nothing may be captured underneath a submit in flight.
                      disabled={submitting}
                      className={`flex min-h-[52px] w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:opacity-60 ${
                        state
                          ? "border-[var(--brand-plum-light)] bg-[#fdfcff]"
                          : "border-border bg-white"
                      }`}
                    >
                      {state ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-plum)] text-white">
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-border" />
                      )}
                      <span className="flex-1 text-[15px] font-semibold text-[var(--brand-plum-darkest)]">
                        {category.rowLabel}
                      </span>
                      {state ? (
                        <span className="truncate text-xs text-[var(--text-caption)]">{state}</span>
                      ) : (
                        <ChevronRight
                          className="h-4 w-4 text-[var(--brand-plum-light)]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        {error ? (
          <p role="alert" className="mt-4 text-center text-sm text-[var(--brand-coral-dark)]">
            {error}
          </p>
        ) : null}
      </div>

      {canSubmit ? (
        <div className="sticky bottom-0 bg-[#fbf9f7] px-5 pb-6 pt-3.5">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="min-h-[54px] w-full rounded-full bg-[var(--brand-coral)] text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {submitting ? SUBMIT_BUSY_LABEL : SUBMIT_LABEL}
          </button>
          {somethingOpen ? (
            <p className="mt-2.5 text-center text-[13px] text-[var(--text-caption)]">
              {OPEN_CAPTION}
            </p>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}
