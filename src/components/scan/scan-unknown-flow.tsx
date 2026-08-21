"use client"

import { useEffect, useRef, useState } from "react"

import { ChevronDown } from "lucide-react"

import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { ScanUnknownProductResult } from "@/lib/scan/types"
import { SCAN_UNKNOWN_HEADLINE, SCAN_UNKNOWN_QUESTION } from "@/lib/scan/verdict-labels"
import { cn } from "@/lib/utils"

/**
 * Unknown-product intake (UI spec §6): two steps, both short. Step 1 is the only
 * required answer — the category the submission is filed under. Step 2 is optional
 * research seed. The card visual follows `ProductKindReviewScreen`
 * (`personal-plan-products/index.tsx`) so the two intake surfaces read as one product.
 */

/** The five most-scanned shelf categories stay visible; the rest sit behind the expander. */
const PRIMARY_CATEGORIES: PersonalPlanCategory[] = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
]

export type ScanSubmissionInput = {
  category: PersonalPlanCategory
  brandText?: string
  productNameText?: string
}

export function ScanUnknownFlow({
  unknown,
  submitting,
  error,
  onSubmit,
}: {
  unknown: ScanUnknownProductResult
  submitting: boolean
  error: string | null
  onSubmit: (input: ScanSubmissionInput) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [category, setCategory] = useState<PersonalPlanCategory | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [brand, setBrand] = useState("")
  const [productName, setProductName] = useState("")

  // Brand typeahead: debounced catalog suggestions under the field. Best-effort — any
  // failure just means no chips. `suggestSeqRef` drops stale responses; picking a chip
  // suppresses the refetch its own setBrand would trigger.
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const suggestSeqRef = useRef(0)
  const suppressSuggestRef = useRef(false)

  // Bumping the sequence here (not only on new valid queries) is what keeps a fetch
  // that is already in flight from resurrecting chips the user just cleared or picked.
  const invalidateSuggestions = () => {
    suggestSeqRef.current += 1
    setBrandSuggestions([])
  }

  const handleBrandChange = (value: string) => {
    suppressSuggestRef.current = false
    setBrand(value)
    if (value.trim().length < 2) invalidateSuggestions()
  }

  const pickBrandSuggestion = (name: string) => {
    suppressSuggestRef.current = true
    setBrand(name)
    invalidateSuggestions()
  }

  useEffect(() => {
    if (suppressSuggestRef.current) return
    const query = brand.trim()
    // Too-short queries were already cleared in handleBrandChange (no setState here —
    // synchronous setState in an effect cascades renders, lint react-you-might-not-need-an-effect).
    if (query.length < 2) return
    const seq = ++suggestSeqRef.current
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/scan/brands?q=${encodeURIComponent(query)}`)
        if (suggestSeqRef.current !== seq) return
        if (!response.ok) {
          // Chips from the previous query must not outlive a failed refresh.
          setBrandSuggestions([])
          return
        }
        const payload = (await response.json()) as { brands?: string[] }
        if (suggestSeqRef.current !== seq) return
        setBrandSuggestions(
          (payload.brands ?? []).filter(
            (name) => name.toLocaleLowerCase() !== query.toLocaleLowerCase(),
          ),
        )
      } catch {
        // Typeahead is a convenience — free text always works.
      }
    }, 200)
    return () => window.clearTimeout(timer)
  }, [brand])

  const primary = unknown.categories.filter((entry) => PRIMARY_CATEGORIES.includes(entry.key))
  const rest = unknown.categories.filter((entry) => !PRIMARY_CATEGORIES.includes(entry.key))
  const visible = showAll ? [...primary, ...rest] : primary

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator step={step} />

      {step === 1 ? (
        <>
          {/* Two-line header (sign-off 2026-08-21): warm headline + question; the ~24h
              promise lives in the post-submit confirmation, the barcode in a mini line
              below the cards. */}
          <div>
            <h2 className="font-header text-2xl leading-tight text-foreground">
              {SCAN_UNKNOWN_HEADLINE}
            </h2>
            <p className="mt-2 text-[15px] font-semibold leading-6 text-foreground">
              {SCAN_UNKNOWN_QUESTION}
            </p>
          </div>

          <div className="grid gap-2">
            {visible.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setCategory(entry.key)}
                aria-pressed={category === entry.key}
                className={cn(
                  "flex min-h-[56px] items-center rounded-xl border p-3 text-left transition-colors",
                  category === entry.key
                    ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                    : "border-border bg-card hover:border-[var(--brand-plum)]/40",
                )}
              >
                <span className="block text-[17px] font-bold text-foreground">{entry.label}</span>
              </button>
            ))}
            {!showAll && rest.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="flex min-h-[56px] items-center justify-between rounded-xl border border-dashed border-[var(--brand-plum-light)] p-3 text-left text-[15px] font-semibold text-[var(--brand-plum)] transition-colors hover:border-[var(--brand-plum)]"
              >
                <span>Weitere Produktarten</span>
                <ChevronDown className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <p className="text-center text-xs tabular-nums text-muted-foreground">
            Barcode {unknown.identifier.value}
          </p>

          <PrimaryAction disabled={category === null} onClick={() => setStep(2)}>
            Weiter
          </PrimaryAction>
        </>
      ) : (
        <>
          <div>
            <h2 className="font-header text-2xl leading-tight text-foreground">
              Magst du uns noch die Marke verraten?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">
              Alles optional — der Barcode reicht uns meistens schon.
            </p>
          </div>

          <div>
            <TextField
              label="Marke"
              value={brand}
              onChange={handleBrandChange}
              placeholder="z. B. Olaplex"
            />
            {brandSuggestions.length > 0 ? (
              <div
                className="mt-2 flex flex-wrap gap-1.5"
                role="status"
                aria-live="polite"
                aria-label="Marken-Vorschläge"
              >
                {brandSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => pickBrandSuggestion(name)}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-[var(--brand-plum)] hover:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <TextField
            label="Produktname"
            value={productName}
            onChange={setProductName}
            placeholder="z. B. No. 4 Bond Maintenance"
          />

          {error ? (
            <p role="alert" className="text-sm text-[var(--brand-coral-dark)]">
              {error}
            </p>
          ) : null}

          <PrimaryAction
            disabled={submitting || category === null}
            onClick={() => {
              if (!category) return
              onSubmit({
                category,
                brandText: brand.trim() || undefined,
                productNameText: productName.trim() || undefined,
              })
            }}
          >
            {submitting ? "Wird eingereicht" : "Zur Prüfung einreichen"}
          </PrimaryAction>

          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={submitting}
            className="min-h-[44px] self-center text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Zurück
          </button>
        </>
      )}
    </div>
  )
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Schritt ${step} von 2`}>
      {[1, 2].map((entry) => (
        <span
          key={entry}
          aria-hidden="true"
          className={cn(
            "h-1 flex-1 rounded-full",
            entry <= step ? "bg-[var(--brand-plum)]" : "bg-muted",
          )}
        />
      ))}
    </div>
  )
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        className="w-full rounded-[10px] border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"
      />
    </label>
  )
}

function PrimaryAction({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-[48px] w-full rounded-[12px] bg-[var(--brand-coral)] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  )
}
