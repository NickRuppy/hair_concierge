"use client"

import Image from "next/image"
import { useState } from "react"

import { cn } from "@/lib/utils"

/**
 * The Feinschliff Tool trip reuses the large two-column image-card grammar of the
 * production hair-texture question. Every page shows at most four options, and
 * `Nichts davon` is an explicit answer — never the same thing as skipping.
 */

export type ToolVisualOption = {
  value: string
  label: string
  hint?: string
  imageUrl: string
  imageAlt: string
}

export function ToolVisualMultiSelect({
  options,
  selected,
  onChange,
  nothingLabel = "Nichts davon",
  ariaLabel,
}: {
  options: readonly ToolVisualOption[]
  /** `null` means the page has not been answered yet. */
  selected: readonly string[] | null
  onChange: (next: string[], announcement?: string) => void
  nothingLabel?: string
  ariaLabel: string
}) {
  const current = selected ?? []
  // A family can span several pages, and every page receives the whole family
  // array. Anything not offered on THIS page belongs to another page and must
  // survive every edit here — including "Nichts davon".
  const isOnThisPage = (value: string) => options.some((option) => option.value === value)
  const foreign = current.filter((value) => !isOnThisPage(value))
  const onThisPage = current.filter(isOnThisPage)
  // "Nothing" is page-local: it answers this page, not the whole family.
  const nothingSelected = selected !== null && onThisPage.length === 0

  const toggle = (value: string) => {
    const ordered = options
      .map((option) => option.value)
      .filter((candidate) =>
        candidate === value ? !current.includes(value) : current.includes(candidate),
      )
    onChange([...foreign, ...ordered])
  }

  return (
    <div data-tool-visual-select>
      <div
        className="grid auto-rows-fr grid-cols-2 gap-3"
        role="group"
        aria-label={ariaLabel}
        data-tool-option-count={options.length}
      >
        {options.map((option) => (
          <ToolOptionCard
            key={option.value}
            option={option}
            selected={current.includes(option.value)}
            onToggle={() => toggle(option.value)}
          />
        ))}
      </div>
      <button
        type="button"
        aria-pressed={nothingSelected}
        data-tool-nothing-option
        onClick={() => onChange([...foreign], nothingLabel)}
        className={cn(
          "mt-3 w-full rounded-2xl border px-4 py-3 text-left text-[15px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum-dark)] focus-visible:ring-offset-2",
          nothingSelected
            ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] text-[var(--brand-plum-darkest)]"
            : "border-[var(--brand-plum-light)] bg-white text-[var(--brand-plum-darkest)]",
        )}
      >
        {nothingLabel}
      </button>
    </div>
  )
}

function ToolOptionCard({
  option,
  selected,
  onToggle,
}: {
  option: ToolVisualOption
  selected: boolean
  onToggle: () => void
}) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      data-tool-option={option.value}
      className={cn(
        "personal-plan-option-card group relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border bg-white text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum-dark)] focus-visible:ring-offset-2",
        selected
          ? "border-[var(--brand-plum)] bg-[var(--brand-plum-ice)] ring-2 ring-[rgba(var(--brand-plum-rgb),0.2)]"
          : "border-[var(--brand-plum-light)]",
      )}
    >
      <span className="relative flex h-32 w-full shrink-0 items-center justify-center overflow-hidden bg-[var(--brand-plum-ice)] [@media(max-height:700px)]:h-24">
        {imageFailed ? (
          <span aria-hidden="true" className="h-8 w-8 rounded-full bg-[var(--brand-plum-light)]" />
        ) : (
          <Image
            alt={option.imageAlt}
            src={option.imageUrl}
            width={160}
            height={160}
            className="h-full w-full object-contain p-4"
            onError={() => setImageFailed(true)}
            unoptimized
          />
        )}
      </span>
      <span className="flex w-full flex-1 items-start gap-2 px-3 pb-3 pt-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]">
            {option.label}
          </span>
          {option.hint ? (
            <span className="mt-1 block text-sm leading-5 text-[var(--text-sub)]">
              {option.hint}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "personal-plan-option-check mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            selected
              ? "border-[var(--brand-plum)] bg-[var(--brand-plum)] text-white"
              : "border-[var(--brand-plum-light)] bg-white text-transparent",
          )}
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="m5 10.5 3.2 3.2L15 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </button>
  )
}
