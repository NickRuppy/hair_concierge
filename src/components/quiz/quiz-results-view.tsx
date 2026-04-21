"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowDown,
  ArrowUp,
  Droplets,
  Heart,
  Leaf,
  Link2Off,
  Palette,
  Scissors,
  Shield,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  QuizResultIconKey,
  QuizResultNarrative,
  QuizResultNarrativeRow,
} from "@/lib/quiz/result-narrative"

const ICONS: Record<QuizResultIconKey, LucideIcon> = {
  droplet: Droplets,
  shield: Shield,
  waves: Waves,
  "shield-check": ShieldCheck,
  scissors: Scissors,
  "link-off": Link2Off,
  heart: Heart,
  sparkles: Sparkles,
  leaf: Leaf,
  "arrow-up": ArrowUp,
  "arrow-down": ArrowDown,
  palette: Palette,
}

const CARD_DELAYS = [0.1, 0.22, 0.34]

export interface QuizResultsViewAction {
  label: string
  href?: string
  onClick?: () => void
}

interface QuizResultsViewProps {
  name: string
  narrative: QuizResultNarrative
  primaryAction: QuizResultsViewAction
  secondaryAction?: QuizResultsViewAction | null
}

function SpectrumCard({ row, index }: { row: QuizResultNarrativeRow; index: number }) {
  const Icon = ICONS[row.iconKey] ?? Sparkles

  return (
    <article
      className="animate-fade-in-up rounded-[20px] border border-black/6 bg-white px-5 py-5 shadow-[0_1px_0_rgba(var(--brand-plum-rgb),0.04),0_8px_28px_-18px_rgba(var(--brand-plum-rgb),0.22)] transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_1px_0_rgba(var(--brand-plum-rgb),0.06),0_18px_40px_-22px_rgba(var(--brand-plum-rgb),0.3)] sm:px-6 sm:py-6"
      style={{ animationDelay: `${CARD_DELAYS[index] ?? 0}s` }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-plum-ice)] text-[var(--brand-plum)]">
            <Icon className="size-5 stroke-[1.75]" />
          </div>
          <span className="type-label text-[11px] font-semibold tracking-[0.22em] text-[var(--brand-plum)]">
            {row.label}
          </span>
        </div>

        <span className="rounded-full border border-[rgba(var(--brand-plum-rgb),0.14)] bg-[rgba(var(--brand-plum-rgb),0.04)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-plum)]">
          {row.scope}
        </span>
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-3 sm:gap-6">
        <div className="flex min-h-12 flex-col justify-center">
          <div className="mb-1.5 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#E35858] [font-family:var(--font-mono)]">
            <span className="size-[7px] rounded-full bg-[#E35858]" />
            Heute
          </div>
          <div className="font-header text-[15px] leading-[1.25] text-foreground sm:text-lg">
            {row.before}
          </div>
        </div>

        <div className="flex min-h-12 flex-col justify-center text-right">
          <div className="mb-1.5 inline-flex items-center justify-end gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#4FAE7A] [font-family:var(--font-mono)]">
            Ziel
            <span className="size-[7px] rounded-full bg-[#4FAE7A]" />
          </div>
          <div className="font-header text-[15px] leading-[1.25] text-foreground sm:text-lg">
            {row.after}
          </div>
        </div>
      </div>

      <div className="px-3.5 pb-1.5 pt-3.5">
        <div className="relative h-2.5 rounded-full bg-[linear-gradient(90deg,#E35858_0%,#EA8247_28%,#F4B23C_50%,#9EC765_72%,#4FAE7A_100%)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]">
          <div
            className="absolute top-1/2 grid size-[22px] place-items-center rounded-full bg-white"
            style={{
              left: `${row.currentPosition}%`,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 0 2px #E35858, 0 4px 12px -2px rgba(227, 88, 88, 0.5)",
            }}
          >
            <div className="size-[14px] rounded-full bg-[#E35858]" />
          </div>
          <div
            className="absolute top-1/2 grid size-[22px] place-items-center rounded-full bg-white"
            style={{
              left: `${row.targetPosition}%`,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 0 2px #4FAE7A",
            }}
          >
            <div className="size-[14px] rounded-full border-2 border-dashed border-[#4FAE7A] bg-transparent" />
          </div>
        </div>

        <div className="mt-2.5 flex justify-between px-0.5 text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-sub)] [font-family:var(--font-mono)] sm:text-[10px]">
          <span>{row.tickBefore}</span>
          <span>{row.tickAfter}</span>
        </div>
      </div>
    </article>
  )
}

function ActionButton({
  action,
  variant,
}: {
  action: QuizResultsViewAction
  variant: "primary" | "secondary"
}) {
  const className =
    variant === "primary"
      ? "min-h-14 w-full rounded-[14px] bg-[var(--brand-coral)] px-5 py-3 text-[15px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_10px_28px_-14px_rgba(212,97,106,0.55)] transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-12px_rgba(212,97,106,0.6)]"
      : "h-[46px] w-full rounded-[14px] bg-[var(--brand-plum-ice)] text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--brand-plum)] transition duration-150 ease-out hover:brightness-[0.98]"

  const button = (
    <Button onClick={action.onClick} variant="unstyled" className={className}>
      {action.label}
    </Button>
  )

  if (action.href && !action.onClick) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    )
  }

  return button
}

export function QuizResultsView({
  name,
  narrative,
  primaryAction,
  secondaryAction,
}: QuizResultsViewProps) {
  const displayName = name.trim().split(/\s+/)[0] ?? ""

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col pb-8 animate-fade-in-up">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex gap-[3px]">
          <div className="h-5 w-[3px] rounded-full bg-[var(--brand-plum)]" />
          <div
            className="h-5 w-[3px] rounded-full"
            style={{ background: "rgba(var(--brand-plum-rgb), 0.6)" }}
          />
          <div
            className="h-5 w-[3px] rounded-full"
            style={{ background: "rgba(var(--brand-plum-rgb), 0.3)" }}
          />
        </div>
        <span className="font-header text-[13px] uppercase tracking-[0.22em] text-muted-foreground">
          Hair Concierge
        </span>
      </div>

      <h1 className="mb-3 font-header">
        {displayName ? (
          <span className="mb-1 block text-2xl font-medium italic text-[var(--brand-plum)]">
            {displayName},
          </span>
        ) : null}
        <span className="block text-[28px] font-medium uppercase leading-[1.18] tracking-[0.01em] text-foreground sm:text-[32px]">
          SO KOMMEN WIR DEINEM HAARZIEL NÄHER
        </span>
      </h1>

      <p className="mb-7 max-w-[56ch] text-base leading-[1.6] text-muted-foreground sm:text-[16.5px]">
        {narrative.intro}
      </p>

      <div className="mb-8 flex flex-col gap-[18px] sm:gap-[22px]">
        {narrative.rows.map((row, index) => (
          <SpectrumCard key={row.label} row={row} index={index} />
        ))}
      </div>

      <section className="mb-7 w-full rounded-[24px] border border-black/6 bg-white px-5 py-5 shadow-[0_1px_0_rgba(var(--brand-plum-rgb),0.04),0_8px_28px_-18px_rgba(var(--brand-plum-rgb),0.22)] sm:px-6 sm:py-6">
        <h2 className="type-label mb-3 text-[11px] font-semibold tracking-[0.22em] text-[var(--brand-plum)]">
          {narrative.needs.title}
        </h2>
        <h3 className="max-w-[34ch] font-header text-[24px] font-medium leading-[1.22] text-foreground sm:text-[28px]">
          {narrative.needs.mainLeverTitle}
        </h3>
        <p className="mt-3 max-w-[48ch] text-[15.5px] leading-[1.65] text-foreground sm:text-[17px]">
          {narrative.needs.mainLeverWhy}
        </p>
        <p className="mt-4 max-w-[50ch] text-[15px] leading-[1.7] text-muted-foreground sm:text-[16px]">
          {narrative.needs.mainLeverProducts}
        </p>
      </section>

      <div className="mx-auto mt-1 flex w-full max-w-[480px] flex-col gap-3">
        <div className="space-y-2 text-center">
          <p className="font-header text-[20px] leading-[1.3] text-foreground sm:text-[22px]">
            {narrative.cta.lead}
          </p>
          <p className="text-[14.5px] leading-[1.55] text-muted-foreground sm:text-[15.5px]">
            {narrative.cta.subline}
          </p>
        </div>

        <ActionButton action={primaryAction} variant="primary" />

        {secondaryAction ? <ActionButton action={secondaryAction} variant="secondary" /> : null}
      </div>
    </div>
  )
}
