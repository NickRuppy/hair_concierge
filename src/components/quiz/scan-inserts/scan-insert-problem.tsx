"use client"

import { ScanInsertFrame, type ScanInsertViewProps } from "./scan-insert-frame"
import {
  getScanInsertDensityLabel,
  getScanInsertExample,
  getScanInsertTextureAdjective,
  getScanInsertThicknessLabel,
} from "@/lib/quiz/scan-insert-examples"
import { useQuizStore } from "@/lib/quiz/store"

/**
 * Insert after the density question: names the problem the scanner solves and
 * shows the answers the quiz already has working on an example product.
 */
export function ScanInsertProblemView({ answers, funnelPackageKey }: ScanInsertViewProps) {
  return (
    <ScanInsertFrame
      card={getScanInsertExample(16, answers)}
      eyebrow="Das Problem"
      funnelPackageKey={funnelPackageKey}
      headline="Vorm Regal raten alle."
      insertId="problem"
      photoAlt="Frau vor einem Drogerieregal voller Shampoo-Flaschen"
      photoSrc="/images/funnels/scan/frau-regal-aha.webp"
      step={16}
    >
      <span>
        <span className="block font-header text-[46px] leading-none text-[var(--brand-plum)]">
          63 %
        </span>
        suchen Klarheit, welche Produkte wirklich zu ihnen passen. Raten kostet Geld, Zeit und ein
        Regal voller halbleerer Flaschen.
        {/*
          Short form of the offer page's source line. The insert has to fit a
          375 x 812 viewport above the sticky "Weiter"; the survey's sample size
          is the part that must not drift, the multi-answer note is not.
        */}
        <span className="mt-2 block text-xs text-[var(--text-caption)]">
          Quelle: eigene Umfrage · 4.024 Antworten
        </span>
      </span>
      <span>
        <strong className="font-semibold text-foreground">Dein Anfang der Lösung:</strong>{" "}
        {`${getScanInsertTextureAdjective(answers)} Haar, ${getScanInsertThicknessLabel(answers)}, ${getScanInsertDensityLabel(answers)}. Drei Antworten, die der Scanner ab jetzt kennt.`}
      </span>
    </ScanInsertFrame>
  )
}

export function ScanInsertProblem() {
  const answers = useQuizStore((s) => s.answers)
  const funnelPackageKey = useQuizStore((s) => s.funnelPackageKey)

  return <ScanInsertProblemView answers={answers} funnelPackageKey={funnelPackageKey} />
}
