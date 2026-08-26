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
  answered = true,
}: {
  options: readonly ToolVisualOption[]
  /** `null` means the page has not been answered yet. */
  selected: readonly string[] | null
  onChange: (next: string[], announcement?: string) => void
  nothingLabel?: string
  ariaLabel: string
  /**
   * Whether `selected` is the user's own submitted answer.
   *
   * A care-derived preselection (`D3a`) can legitimately carry only forms that
   * live on another page of the same family. That must not light up „Nichts
   * davon" here: the user never said it, and a pre-lit „Nichts davon" is a claim
   * about the whole page. Touching the page makes it their answer again.
   */
  answered?: boolean
}) {
  const [touched, setTouched] = useState(false)
  const current = selected ?? []
  // A family can span several pages, and every page receives the whole family
  // array. Anything not offered on THIS page belongs to another page and must
  // survive every edit here — including "Nichts davon".
  const isOnThisPage = (value: string) => options.some((option) => option.value === value)
  const foreign = current.filter((value) => !isOnThisPage(value))
  const onThisPage = current.filter(isOnThisPage)
  // "Nothing" is page-local: it answers this page, not the whole family.
  const nothingSelected = (answered || touched) && selected !== null && onThisPage.length === 0

  const toggle = (value: string) => {
    setTouched(true)
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
        onClick={() => {
          setTouched(true)
          onChange([...foreign], nothingLabel)
        }}
        className={cn(
          // Same white-body, plum-border-and-ring selected state as the cards
          // above and as `quiz-card-active`, so nothing on the page signals
          // selection with a different treatment.
          "mt-3 w-full rounded-2xl border bg-white px-4 py-3 text-left text-[15px] font-semibold text-[var(--brand-plum-darkest)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum-dark)] focus-visible:ring-offset-2",
          nothingSelected
            ? "border-[var(--brand-plum)] ring-2 ring-[rgba(var(--brand-plum-rgb),0.2)]"
            : "border-[var(--brand-plum-light)]",
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
        // The card body stays white in every state, exactly as the shared
        // `QuizOptionCard` grid does. Tinting the selected card plum-ice also
        // tinted its label strip, so a selected Bildkarte sat next to
        // unselected ones with a visibly different strip (Nick, 2026-08-26).
        // Selection reads from the plum border, ring and filled check instead.
        "personal-plan-option-card group relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border bg-white text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum-dark)] focus-visible:ring-offset-2",
        selected
          ? "border-[var(--brand-plum)] ring-2 ring-[rgba(var(--brand-plum-rgb),0.2)]"
          : "border-[var(--brand-plum-light)]",
      )}
    >
      <span className="relative flex h-32 w-full shrink-0 items-center justify-center overflow-hidden bg-[var(--brand-plum-ice)] [@media(max-height:700px)]:h-24">
        {imageFailed ? (
          <span aria-hidden="true" className="h-8 w-8 rounded-full bg-[var(--brand-plum-light)]" />
        ) : option.imageUrl.endsWith(".webp") ? (
          // Photo Bildkarten are 1.9:1 letterbox-blur compositions (see
          // plans/tool-bildkarten.md): the packshot sits on a blurred copy of
          // itself so `object-cover` can crop safely. A centered square window
          // crops back to exactly the original packshot — showing the full 1.9 canvas (as
          // `object-contain` did) exposes them as ghost shapes on wide cards.
          <span className="relative h-full aspect-square max-w-full overflow-hidden">
            <Image
              alt={option.imageAlt}
              src={option.imageUrl}
              width={160}
              height={160}
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
              unoptimized
            />
          </span>
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
          {/*
            German compound names („Wildschweinborsten-Bürste") are longer than
            the two-column card is wide. `min-w-0` alone only lets the box
            shrink — the unbreakable word still overflows and runs under the
            selection circle. `hyphens-auto` (with the document's `lang="de"`)
            breaks it at a real syllable, and `break-words` is the fallback for
            anything the hyphenation dictionary does not know.
          */}
          <span
            lang="de"
            className="block hyphens-auto break-words text-[15px] font-semibold leading-snug text-[var(--brand-plum-darkest)]"
          >
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
