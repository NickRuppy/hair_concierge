"use client"

import Image from "next/image"
import { useState } from "react"

import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import { cn } from "@/lib/utils"

/**
 * The Feinschliff Tool trip reuses the large two-column image-card grammar of the
 * production hair-texture question. Every page shows at most four options, and
 * `Nichts davon` is an explicit answer — never the same thing as skipping. Answers are
 * per page (`toolForms[pageKey]`), the overview answers per section.
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
  nothingDescription = "Ich habe hier nichts davon.",
  ariaLabel,
  answered = true,
}: {
  options: readonly ToolVisualOption[]
  /** `null` means the page has not been answered yet. */
  selected: readonly string[] | null
  onChange: (next: string[], announcement?: string) => void
  nothingLabel?: string
  /** One line under „Nichts davon", like the Feinschliff none card. */
  nothingDescription?: string
  ariaLabel: string
  /**
   * Whether `selected` is the user's own submitted answer.
   *
   * A care-derived starting value (`D3a`) is shown ticked but is not an answer: an empty
   * starting value must not light up „Nichts davon" (a pre-lit „Nichts davon" is a claim the
   * user never made). Touching the page makes it their answer again.
   */
  answered?: boolean
}) {
  const [touched, setTouched] = useState(false)
  const current = selected ?? []
  // Every page owns exactly the forms it offers (per-page answers): a selection holds nothing
  // that belongs to another page, and „Nichts davon" answers THIS page with an explicit `[]`.
  const nothingSelected = (answered || touched) && selected !== null && current.length === 0

  const toggle = (value: string) => {
    setTouched(true)
    const ordered = options
      .map((option) => option.value)
      .filter((candidate) =>
        candidate === value ? !current.includes(value) : current.includes(candidate),
      )
    onChange(ordered)
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
      {/*
        Rev. 6: „Nichts davon" is the same card as the Feinschliff none option
        (`RefinementOptions`): a multi-select QuizOptionCard with the square checkbox and a
        one-line description, in the same muted wrapper.
      */}
      <div className="mt-3 opacity-[0.92]" data-refinement-none-option data-tool-nothing-option>
        <QuizOptionCard
          label={nothingLabel}
          description={nothingDescription}
          active={nothingSelected}
          multi
          animateIn={false}
          onClick={() => {
            setTouched(true)
            onChange([], nothingLabel)
          }}
        />
      </div>
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
      {/* Rev. 6: the photo area matches the `QuizOptionCard` grid card. */}
      <span className="relative flex h-[140px] w-full shrink-0 items-center justify-center overflow-hidden bg-[var(--brand-plum-ice)] sm:h-36 [@media(max-height:700px)]:h-28">
        {imageFailed ? (
          <span aria-hidden="true" className="h-8 w-8 rounded-full bg-[var(--brand-plum-light)]" />
        ) : option.imageUrl.endsWith(".webp") ? (
          // Photo Bildkarten are 1.9:1 letterbox-blur compositions (see
          // plans/tool-bildkarten.md): the packshot sits on a blurred copy of
          // itself so `object-cover` can crop safely. A centered square window
          // crops back to exactly the original packshot — showing the full 1.9 canvas (as
          // `object-contain` did) exposes them as ghost shapes on wide cards.
          <span className="relative h-full aspect-square max-w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)]">
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
        {/* Rev. 6: multi-select → the square checkbox of `QuizOptionCard` (`rounded-[6px]`, 20px). */}
        <span
          aria-hidden="true"
          className={cn(
            "personal-plan-option-check mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border",
            selected
              ? "border-[var(--brand-plum)] bg-[var(--brand-plum)] text-primary-foreground"
              : "border-[var(--brand-plum-light)] bg-white text-transparent",
          )}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </button>
  )
}
