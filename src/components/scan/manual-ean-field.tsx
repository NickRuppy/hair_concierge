"use client"

import { useId, useState } from "react"

import { validateEanInput } from "@/lib/scan/identifier-lookup"

type ManualEanFieldProps = {
  onSubmit: (identifier: { type: "ean"; value: string }) => void
  disabled?: boolean
  label?: string
  submitLabel?: string
}

const inputClass =
  "w-full rounded-[10px] border border-border bg-card px-4 py-3.5 text-base tracking-wide text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"

/**
 * Manual EAN fallback entry — used when the camera scanner is unavailable or the user
 * can't get a stable read. Validates on submit via the shared `validateEanInput`
 * (GS1 mod-10, 8/13 digits) so the client and the resolve API route agree on what's valid.
 */
export function ManualEanField({
  onSubmit,
  disabled = false,
  label = "Barcode-Nummer eingeben",
  submitLabel = "Suchen",
}: ManualEanFieldProps) {
  const id = useId()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value.replace(/\D/g, "").slice(0, 13))
    if (error) setError(null)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return
    const result = validateEanInput(value)
    if (!result.ok) {
      setError(
        result.reason === "length"
          ? "Bitte 8 oder 13 Ziffern eingeben"
          : "Diese Nummer scheint ungültig — prüfe die Ziffern",
      )
      return
    }
    setError(null)
    onSubmit({ type: "ean", value: result.value })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div>
        <label htmlFor={`${id}-ean`} className="mb-1.5 block text-sm font-medium">
          {label}
        </label>
        <input
          id={`${id}-ean`}
          name="ean"
          inputMode="numeric"
          pattern="\d*"
          autoComplete="off"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-ean-error` : undefined}
          className={inputClass}
        />
        {error ? (
          <p
            id={`${id}-ean-error`}
            role="alert"
            className="mt-1 text-sm text-[var(--brand-coral-dark)]"
          >
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={disabled || value.length === 0}
        className="w-full rounded-[10px] bg-[var(--brand-coral)] px-6 py-4 text-base font-semibold text-white transition hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  )
}
