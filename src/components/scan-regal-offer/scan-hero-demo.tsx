"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

import {
  getScanInsertExample,
  type ScanExampleCard,
  type ScanExampleStatus,
} from "@/lib/quiz/scan-insert-examples"
import type { QuizAnswers } from "@/lib/quiz/types"

/** The scan the hero replays: barcode found, then the result for this profile. */
export type ScanHeroDemoPhase = "scanning" | "detected" | "result"

const BARCODE_DETECTED_DELAY_MS = 1800
const RESULT_DELAY_MS = 2500
const REPLAY_INTERVAL_MS = 7500

const STATUS_CHIP_CLASSES: Record<ScanExampleStatus, string> = {
  ok: "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]",
  warn: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]",
  bad: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
}

/**
 * The demo frame at a fixed phase. Pure — the phase is a prop — so the finished
 * state is what server rendering and reduced motion produce, and a test can
 * walk any phase without a clock.
 */
export function ScanHeroDemoView({
  card,
  phase,
}: {
  card: ScanExampleCard
  phase: ScanHeroDemoPhase
}) {
  return (
    <div
      className="relative h-[300px] overflow-hidden rounded-[22px] bg-[#111111]"
      data-scan-hero-demo-phase={phase}
    >
      <Image
        alt=""
        className="object-cover object-top"
        sizes="(max-width: 640px) 100vw, 26rem"
        src="/images/funnels/scan/tour-scanner.png"
        fill
      />
      {/* Top-right: the centred barcode pill and the frame's own hint keep the middle. */}
      <span className="absolute right-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur-[4px]">
        Demo
      </span>
      <Image
        alt=""
        className="absolute left-1/2 top-[38%] h-[140px] w-auto -translate-x-1/2 drop-shadow-[0_12px_22px_rgba(0,0,0,0.5)]"
        height={140}
        src="/images/funnels/scan/packshot-ogx.png"
        width={56}
      />

      {phase === "scanning" ? (
        <span
          aria-hidden="true"
          className="absolute left-[14%] right-[14%] top-[8%] h-[2px] bg-[rgba(212,97,106,0.9)] shadow-[0_0_12px_rgba(212,97,106,0.9)] motion-safe:animate-[scanHeroDemoLine_2.2s_ease-in-out_infinite]"
          data-scan-hero-demo-line
        />
      ) : (
        <span
          className="absolute left-1/2 top-[22px] -translate-x-1/2 whitespace-nowrap rounded-full bg-[rgba(53,107,69,0.95)] px-3.5 py-[7px] text-[12.5px] font-bold text-white motion-safe:animate-[scanHeroDemoPop_400ms_both]"
          data-scan-hero-demo-pill
        >
          ✓ Barcode erkannt
        </span>
      )}

      {phase === "result" ? (
        <div
          className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-[#faf8f5] px-4 pb-3 pt-3.5 motion-safe:animate-[scanHeroDemoSheetUp_400ms_cubic-bezier(0.22,0.8,0.36,1)_both]"
          data-scan-hero-demo-sheet
        >
          <p
            className={`font-header text-[20px] font-semibold leading-[1.15] ${
              card.verdict === "warn"
                ? "text-[var(--status-pending-text)]"
                : "text-[var(--brand-plum-darkest)]"
            }`}
          >
            {card.headline}
          </p>
          <p className="mt-[3px] text-[12.5px] text-[var(--text-body)]">{card.deviation}</p>
          <div className="mt-2 flex gap-1.5">
            {card.rows.map((row) => (
              <span
                className={`flex-1 rounded-lg px-2 py-[5px] text-center text-[11px] font-bold ${STATUS_CHIP_CLASSES[row.status]}`}
                key={row.label}
              >
                {row.label}: {row.productValue}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The looping scanner demo in the offer hero.
 *
 * It starts on its finished state, so the server and a visitor who asked for
 * reduced motion get the same still frame and no timer ever runs. Only when
 * motion is welcome does the effect rewind to the scan and replay it.
 */
export function ScanHeroDemo({ quizAnswers }: { quizAnswers: QuizAnswers }) {
  const [phase, setPhase] = useState<ScanHeroDemoPhase>("result")
  const card = getScanInsertExample(16, quizAnswers)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let pending: number[] = []
    const replay = () => {
      pending.forEach((timer) => window.clearTimeout(timer))
      setPhase("scanning")
      pending = [
        window.setTimeout(() => setPhase("detected"), BARCODE_DETECTED_DELAY_MS),
        window.setTimeout(() => setPhase("result"), RESULT_DELAY_MS),
      ]
    }

    replay()
    const loop = window.setInterval(replay, REPLAY_INTERVAL_MS)
    return () => {
      window.clearInterval(loop)
      pending.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  return <ScanHeroDemoView card={card} phase={phase} />
}
