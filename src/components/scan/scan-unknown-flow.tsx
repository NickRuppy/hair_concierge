"use client"

import { useState } from "react"

import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { ScanUnknownProductResult } from "@/lib/scan/types"
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

  const primary = unknown.categories.filter((entry) => PRIMARY_CATEGORIES.includes(entry.key))
  const rest = unknown.categories.filter((entry) => !PRIMARY_CATEGORIES.includes(entry.key))
  const visible = showAll ? [...primary, ...rest] : primary

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator step={step} />

      {step === 1 ? (
        <>
          <div>
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-plum)]">
              Neues Produkt
            </p>
            <h2 className="font-header text-2xl leading-tight text-foreground">
              Das kennen wir noch nicht.
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">
              Wir recherchieren es für dich — meist innerhalb von 24 Stunden. Was für ein Produkt
              ist es?
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Barcode {unknown.identifier.value}</p>
          </div>

          <div className="grid gap-2">
            {visible.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setCategory(entry.key)}
                aria-pressed={category === entry.key}
                className={cn(
                  "grid min-h-[64px] grid-cols-[minmax(0,1fr)] items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                  category === entry.key
                    ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)]"
                    : "border-border bg-card hover:border-[var(--brand-plum)]/40",
                )}
              >
                <span className="block text-sm font-semibold text-foreground">{entry.label}</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {CATEGORY_COPY[entry.key].need}
                </span>
              </button>
            ))}
          </div>

          {!showAll && rest.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="min-h-[44px] self-start text-sm font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline"
            >
              Weitere Produktart …
            </button>
          ) : null}

          <PrimaryAction disabled={category === null} onClick={() => setStep(2)}>
            Weiter
          </PrimaryAction>
        </>
      ) : (
        <>
          <div>
            <h2 className="font-header text-2xl leading-tight text-foreground">
              Welche Marke ist es?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">
              Alles optional — der Barcode reicht meist schon.
            </p>
          </div>

          <TextField label="Marke" value={brand} onChange={setBrand} placeholder="z. B. Olaplex" />
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
